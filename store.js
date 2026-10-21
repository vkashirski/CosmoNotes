'use strict';
/*
 * Sticky Pins - local storage.
 *
 * Every note is its own small JSON file in <data>/notes. Writes are "atomic":
 * the new version is written to a temp file, flushed to disk, and only then
 * swapped in, with the previous version kept as <id>.json.bak. A crash or power
 * cut mid-save can never leave a note half-written.
 *
 * Photos, drawings and voice recordings live in <data>/attachments and are
 * referenced from note HTML as stickyfile://att/<name>.
 *
 * Once a day every note is copied into <data>/backups/<date>. The last 30
 * backups are kept.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange', 'mint', 'charcoal'];
const DEFAULT_SETTINGS = {
  startWithWindows: true,
  defaultColor: 'yellow',
  defaultFont: 'hand',
  firstRunDone: false,
  listBounds: null,
};
const KEEP_BACKUPS = 30;
const ATT_PREFIX = 'stickyfile://att/';
const ATT_NAME = /^[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp|bmp|webm|ogg|mp3|m4a|wav)$/i;
const ATT_REF = /stickyfile:\/\/att\/([A-Za-z0-9_.-]+)/g;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeFileSafe(file, text) {
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) {
    try { fs.copyFileSync(file, file + '.bak'); } catch { /* keep going */ }
  }
  // Antivirus or file indexers sometimes hold a file for a moment on Windows.
  for (let i = 0; i < 4; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (i === 3) {
        fs.writeFileSync(file, text);
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        return;
      }
      sleepSync(40);
    }
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function normalizeBounds(b) {
  if (!b || typeof b !== 'object') return null;
  const nums = ['x', 'y', 'width', 'height'].map((k) => Number(b[k]));
  if (!nums.every(Number.isFinite)) return null;
  const [x, y, width, height] = nums.map(Math.round);
  return { x, y, width: Math.max(180, width), height: Math.max(120, height) };
}

function normalize(n) {
  const now = Date.now();
  return {
    id: String(n.id),
    html: typeof n.html === 'string' ? n.html : '',
    text: typeof n.text === 'string' ? n.text : '',
    firstImage: typeof n.firstImage === 'string' ? n.firstImage : null,
    color: COLORS.includes(n.color) ? n.color : 'yellow',
    font: n.font === 'round' ? 'round' : 'hand',
    size: ['s', 'm', 'l'].includes(n.size) ? n.size : 'm',
    opacity: clamp(Number(n.opacity) || 1, 0.25, 1),
    solidOnHover: n.solidOnHover !== false,
    pinned: !!n.pinned,
    open: !!n.open,
    rolled: !!n.rolled,
    bounds: normalizeBounds(n.bounds),
    createdAt: Number(n.createdAt) || now,
    updatedAt: Number(n.updatedAt) || now,
    deletedAt: n.deletedAt ? Number(n.deletedAt) : null,
    restoredFrom: n.restoredFrom || null,
  };
}

function localDate(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

class Store {
  constructor(root) {
    this.root = root;
    this.notesDir = path.join(root, 'notes');
    this.attDir = path.join(root, 'attachments');
    this.backupDir = path.join(root, 'backups');
    this.settingsFile = path.join(root, 'settings.json');
    for (const d of [root, this.notesDir, this.attDir, this.backupDir]) fs.mkdirSync(d, { recursive: true });
    this.notes = new Map();
    this.timers = new Map();
    this.settings = { ...DEFAULT_SETTINGS, ...(readJson(this.settingsFile) || readJson(this.settingsFile + '.bak') || {}) };
    this.load();
  }

  // ---------- loading ----------
  load() {
    const files = fs.readdirSync(this.notesDir);
    const ids = new Set();
    for (const f of files) {
      const m = f.match(/^([A-Za-z0-9-]+)\.json(\.bak|\.tmp)?$/);
      if (m) ids.add(m[1]);
    }
    for (const id of ids) {
      const base = path.join(this.notesDir, id + '.json');
      // Prefer the main file; fall back to the last good version.
      const main = readJson(base);
      const data = main || readJson(base + '.tmp') || readJson(base + '.bak');
      if (data && data.id) {
        this.notes.set(String(data.id), normalize(data));
        // Repair a damaged or missing main file right away.
        if (!main) { try { writeFileSafe(base, JSON.stringify(this.notes.get(String(data.id)), null, 1)); } catch { /* ignore */ } }
      }
    }
  }

  all() {
    return [...this.notes.values()];
  }

  get(id) {
    return this.notes.get(id) || null;
  }

  // ---------- saving ----------
  fileOf(id) {
    return path.join(this.notesDir, id + '.json');
  }

  writeNow(id) {
    const t = this.timers.get(id);
    if (t) { clearTimeout(t); this.timers.delete(id); }
    const n = this.notes.get(id);
    if (!n) return;
    writeFileSafe(this.fileOf(id), JSON.stringify(n, null, 1));
  }

  save(id, delay = 250) {
    if (!this.notes.has(id)) return;
    if (delay <= 0) return this.writeNow(id);
    const old = this.timers.get(id);
    if (old) clearTimeout(old);
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      try { this.writeNow(id); } catch (e) { console.error('save failed', id, e); }
    }, delay));
  }

  flush() {
    for (const id of [...this.timers.keys()]) {
      try { this.writeNow(id); } catch (e) { console.error('flush failed', id, e); }
    }
  }

  create(partial = {}) {
    const n = normalize({
      color: this.settings.defaultColor,
      font: this.settings.defaultFont,
      ...partial,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.notes.set(n.id, n);
    this.writeNow(n.id);
    return n;
  }

  update(id, patch, { content = false } = {}) {
    const n = this.notes.get(id);
    if (!n) return null;
    const merged = normalize({ ...n, ...patch, bounds: patch.bounds || n.bounds });
    if (content) merged.updatedAt = Date.now();
    Object.assign(n, merged);
    this.save(id);
    return n;
  }

  trash(id) {
    const n = this.notes.get(id);
    if (!n) return;
    n.deletedAt = Date.now();
    n.open = false;
    this.writeNow(id);
  }

  restore(id) {
    const n = this.notes.get(id);
    if (!n) return;
    n.deletedAt = null;
    this.writeNow(id);
  }

  destroy(id) {
    const t = this.timers.get(id);
    if (t) { clearTimeout(t); this.timers.delete(id); }
    this.notes.delete(id);
    for (const ext of ['', '.bak', '.tmp']) {
      try { fs.unlinkSync(this.fileOf(id) + ext); } catch { /* not there */ }
    }
    // Attachments still used by another note or a backup are kept.
    this.sweepAttachments(0);
  }

  saveSettings() {
    writeFileSafe(this.settingsFile, JSON.stringify(this.settings, null, 1));
  }

  // ---------- attachments ----------
  newAttachmentName(ext) {
    ext = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext === 'jpeg') ext = 'jpg';
    return `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  }

  saveAttachment(buffer, ext) {
    const name = this.newAttachmentName(ext);
    if (!ATT_NAME.test(name)) throw new Error('Unsupported file type');
    const file = path.join(this.attDir, name);
    writeFileSafe(file, buffer);
    try { fs.unlinkSync(file + '.bak'); } catch { /* none */ }
    return ATT_PREFIX + name;
  }

  importFile(src) {
    const ext = path.extname(src).slice(1);
    return this.saveAttachment(fs.readFileSync(src), ext);
  }

  attachmentPath(name) {
    name = path.basename(String(name || ''));
    if (!ATT_NAME.test(name)) return null;
    return path.join(this.attDir, name);
  }

  attachmentPathFromUrl(url) {
    if (typeof url !== 'string' || !url.startsWith(ATT_PREFIX)) return null;
    return this.attachmentPath(decodeURIComponent(url.slice(ATT_PREFIX.length)));
  }

  referencedAttachments() {
    const used = new Set();
    const scan = (html) => {
      if (typeof html !== 'string') return;
      for (const m of html.matchAll(ATT_REF)) used.add(m[1]);
    };
    for (const n of this.notes.values()) scan(n.html);
    for (const b of this.listBackups()) {
      const dir = path.join(this.backupDir, b.name);
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.json') && f !== 'meta.json') scan((readJson(path.join(dir, f)) || {}).html);
      }
    }
    return used;
  }

  // Remove files nothing points at any more. Fresh files are left alone so an
  // image that was just added (and not yet saved into a note) is never lost.
  sweepAttachments(minAgeMs = 2 * 24 * 3600e3) {
    let used;
    try { used = this.referencedAttachments(); } catch { return; }
    const now = Date.now();
    for (const f of fs.readdirSync(this.attDir)) {
      if (used.has(f)) continue;
      const p = path.join(this.attDir, f);
      try {
        const age = now - fs.statSync(p).mtimeMs;
        if (age > Math.max(minAgeMs, 60e3)) fs.unlinkSync(p);
      } catch { /* ignore */ }
    }
  }

  // ---------- backups ----------
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name))
      .map((d) => {
        const meta = readJson(path.join(this.backupDir, d.name, 'meta.json')) || {};
        return { name: d.name, created: meta.created || null, count: meta.count ?? null };
      })
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  }

  backupNow(name) {
    this.flush();
    let dirName = name || `${localDate()}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}`;
    if (fs.existsSync(path.join(this.backupDir, dirName))) dirName += '_' + Date.now().toString(36);
    const tmpDir = path.join(this.backupDir, '.partial-' + dirName);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    let count = 0;
    for (const n of this.notes.values()) {
      fs.writeFileSync(path.join(tmpDir, n.id + '.json'), JSON.stringify(n));
      count++;
    }
    fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify({ created: Date.now(), count }));
    fs.renameSync(tmpDir, path.join(this.backupDir, dirName));
    this.pruneBackups();
    return dirName;
  }

  backupIfNeeded() {
    try {
      const today = localDate();
      const exists = this.listBackups().some((b) => b.name.startsWith(today));
      if (!exists && this.notes.size > 0) this.backupNow(today);
    } catch (e) {
      console.error('backup failed', e);
    }
  }

  pruneBackups() {
    const all = this.listBackups();
    for (const b of all.slice(KEEP_BACKUPS)) {
      fs.rmSync(path.join(this.backupDir, b.name), { recursive: true, force: true });
    }
    for (const f of fs.readdirSync(this.backupDir)) {
      if (f.startsWith('.partial-')) fs.rmSync(path.join(this.backupDir, f), { recursive: true, force: true });
    }
    this.sweepAttachments();
  }

  // Never overwrites anything: notes from the backup that differ from what you
  // have now come back as extra (closed) notes.
  restoreBackup(name) {
    const dir = path.join(this.backupDir, path.basename(name));
    if (!fs.existsSync(dir)) return 0;
    let restored = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json') || f === 'meta.json') continue;
      const b = readJson(path.join(dir, f));
      if (!b || !b.id) continue;
      const cur = this.notes.get(String(b.id));
      if (cur && cur.html === b.html) {
        if (cur.deletedAt && !b.deletedAt) { this.restore(cur.id); restored++; }
        continue;
      }
      if (b.deletedAt) continue;
      const copy = normalize({ ...b, id: crypto.randomUUID(), open: false, restoredFrom: name, deletedAt: null });
      this.notes.set(copy.id, copy);
      this.writeNow(copy.id);
      restored++;
    }
    return restored;
  }
}

module.exports = { Store, COLORS, normalize, localDate, ATT_PREFIX };
