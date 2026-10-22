'use strict';
/*
 * CosmoNotes - local storage.
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
const GROUP_STYLES = ['stack', 'folder', 'envelope', 'notebook'];
const GROUP_COLORS = ['kraft', 'sun', 'rose', 'coral', 'lilac', 'sky', 'mint', 'graphite'];
const DEFAULT_SETTINGS = {
  startWithWindows: true,
  defaultColor: 'yellow',
  defaultFont: 'hand',
  firstRunDone: false,
  listBounds: null,
  spellCheck: false, // spelling is ignored unless turned on
  spellCyrillic: false, // Cyrillic words are never underlined unless turned on
  listSort: { by: 'updated', dir: 'desc', groups: 'mixed' },
  listSize: 'm', // card size in the notes list: s | m | l | xl | xxl
  lock: null, // "salt:hash" of the one password/PIN for locked notes
  lockKind: null, // 'pin' (digits only, opens as soon as it's typed) | 'password' (null = password, set before 1.1.6)
  lockLen: 0, // length of the PIN, so a note opens by itself once that many digits are typed
  defaultOpacity: 1, // see-through for new notes (0.25 – 1)
  listTheme: 'cream', // colours of the notes list window (see THEMES in list.js; night, midnight, forest, plum are dark)
  madeGroup: false, // true once a group was ever made: the "drag to make a group" tip stops for good
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

const cleanTitle = (t) => (typeof t === 'string' ? t.replace(/[\r\n\t]+/g, ' ').slice(0, 120) : '');

// Draw-over ink: { s: [stroke, ...] } in the note's own coordinates (px from the top-left of the text area).
// stroke = { t: pen|hl|line|arrow|rect|ellipse, c: '#rrggbb', w: 1-40, l: 'a' (above text) | 'b' (behind),
//            p: [x, y, x, y, ...] }  (pen/hl: the path; shapes: start and end corner)
const INK_TOOLS = ['pen', 'hl', 'line', 'arrow', 'rect', 'ellipse'];
const MAX_STROKES = 4000;
function normalizeInk(ink) {
  if (!ink || !Array.isArray(ink.s)) return null;
  const out = [];
  for (const st of ink.s.slice(0, MAX_STROKES)) {
    if (!st || !INK_TOOLS.includes(st.t) || !Array.isArray(st.p)) continue;
    const p = st.p.slice(0, 20000).map(Number);
    if (p.length < 2 || p.length % 2 || !p.every((v) => Number.isFinite(v) && v > -10000 && v < 100000)) continue;
    out.push({
      t: st.t,
      c: /^#[0-9a-fA-F]{6}$/.test(st.c) ? st.c : '#2B2B2B',
      w: Math.min(40, Math.max(1, Number(st.w) || 3)),
      l: st.l === 'b' ? 'b' : 'a',
      p: p.map((v) => Math.round(v * 10) / 10),
    });
  }
  return out.length ? { s: out } : null;
}

function normalizeGroup(x) {
  return {
    id: String(x.id),
    name: cleanTitle(x.name),
    createdAt: Number(x.createdAt) || Date.now(),
    parentId: typeof x.parentId === 'string' && x.parentId ? x.parentId : null,
    style: GROUP_STYLES.includes(x.style) ? x.style : 'stack',
    color: GROUP_COLORS.includes(x.color) ? x.color : 'kraft',
    locked: !!x.locked,
  };
}

function normalize(n) {
  const now = Date.now();
  return {
    id: String(n.id),
    title: cleanTitle(n.title),
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
    locked: !!n.locked,
    ink: normalizeInk(n.ink),
    // text layout locked at this width (px) so text and pictures don't re-wrap; null = wraps with the note
    wrapWidth: Number.isFinite(Number(n.wrapWidth)) && Number(n.wrapWidth) >= 80 ? Math.min(4000, Math.round(Number(n.wrapWidth))) : null,
    spell: n.spell === true || n.spell === false ? n.spell : null,
    groupId: typeof n.groupId === 'string' && n.groupId ? n.groupId : null,
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
    this.groupsFile = path.join(root, 'groups.json');
    for (const d of [root, this.notesDir, this.attDir, this.backupDir]) fs.mkdirSync(d, { recursive: true });
    this.notes = new Map();
    this.timers = new Map();
    this.settings = { ...DEFAULT_SETTINGS, ...(readJson(this.settingsFile) || readJson(this.settingsFile + '.bak') || {}) };
    this.settings.listSort = { ...DEFAULT_SETTINGS.listSort, ...(this.settings.listSort || {}) };
    this.groups = new Map();
    const g = readJson(this.groupsFile) || readJson(this.groupsFile + '.bak') || {};
    for (const x of Array.isArray(g.groups) ? g.groups : []) {
      if (x && x.id) this.groups.set(String(x.id), normalizeGroup(x));
    }
    // A broken parent link (missing group or a loop) puts the group back at the top level.
    for (const grp of this.groups.values()) {
      if (grp.parentId && (!this.groups.has(grp.parentId) || this.isInside(grp.parentId, grp.id))) grp.parentId = null;
    }
    // groups made before 1.1.6 count too
    if (this.groups.size) this.settings.madeGroup = true;
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
      // "random" picks one of the pastel papers (not the dark one)
      color: this.settings.defaultColor === 'random' ? COLORS[Math.floor(Math.random() * (COLORS.length - 1))] : this.settings.defaultColor,
      font: this.settings.defaultFont,
      opacity: Math.min(1, Math.max(0.25, Number(this.settings.defaultOpacity) || 1)),
      ...partial,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.notes.set(n.id, n);
    this.writeNow(n.id);
    return n;
  }

  // A new note with the same content and look as an existing one (title gets "(copy)").
  // Photos, sketches and voice notes are shared files: the attachment sweep only deletes a
  // file once no note or backup refers to it, so both notes keep working on their own.
  duplicate(id, extra = {}) {
    const src = this.notes.get(id);
    if (!src || src.deletedAt) return null;
    const keys = ['html', 'text', 'firstImage', 'ink', 'wrapWidth', 'color', 'font', 'size', 'opacity', 'solidOnHover', 'spell', 'locked', 'groupId'];
    const copy = {};
    for (const k of keys) copy[k] = src[k] && typeof src[k] === 'object' ? JSON.parse(JSON.stringify(src[k])) : src[k];
    copy.title = src.title ? `${src.title} (copy)` : '';
    if (copy.groupId && !this.groups.has(copy.groupId)) copy.groupId = null;
    return this.create({ ...copy, ...extra });
  }

  update(id, patch, { content = false } = {}) {
    const n = this.notes.get(id);
    if (!n) return null;
    // The drawing is checked (normalizeInk) only when it's part of the change: it can be tens of
    // thousands of numbers, and it is already clean otherwise. Typing saves stay quick that way.
    const inkChanged = 'ink' in patch;
    const merged = normalize({ ...n, ...patch, bounds: patch.bounds || n.bounds, ...(inkChanged ? {} : { ink: null }) });
    if (!inkChanged) merged.ink = n.ink;
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
    this.cleanupGroups();
    // Attachments still used by another note or a backup are kept.
    this.sweepAttachments(0);
  }

  saveSettings() {
    writeFileSafe(this.settingsFile, JSON.stringify(this.settings, null, 1));
  }

  // ---------- groups (a folder tree: a note has groupId, a group has parentId) ----------
  saveGroups() {
    writeFileSafe(this.groupsFile, JSON.stringify({ groups: [...this.groups.values()] }, null, 1));
  }

  // true when group `id` is `ancestorId` itself or somewhere inside it
  isInside(id, ancestorId) {
    const seen = new Set();
    for (let cur = id; cur && !seen.has(cur); cur = this.groups.get(cur)?.parentId) {
      if (cur === ancestorId) return true;
      seen.add(cur);
    }
    return false;
  }

  // the group and all the groups above it, innermost first
  chain(groupId) {
    const out = [];
    const seen = new Set();
    for (let cur = groupId; cur && this.groups.has(cur) && !seen.has(cur); cur = this.groups.get(cur).parentId) {
      seen.add(cur);
      out.push(this.groups.get(cur));
    }
    return out;
  }

  // ids of the group and every group inside it
  subtree(groupId) {
    const ids = new Set([groupId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of this.groups.values()) {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; }
      }
    }
    return ids;
  }

  notesInTree(groupId, { includeBin = false } = {}) {
    const ids = this.subtree(groupId);
    return this.all().filter((n) => n.groupId && ids.has(n.groupId) && (includeBin || !n.deletedAt));
  }

  // the locked groups a note sits inside (innermost first)
  lockedGroupsOf(note) {
    return this.chain(note.groupId).filter((g) => g.locked);
  }

  setGroup(noteId, groupId) {
    const n = this.notes.get(noteId);
    if (!n) return;
    n.groupId = groupId && this.groups.has(groupId) ? groupId : null;
    this.writeNow(noteId);
  }

  setParent(groupId, parentId) {
    const g = this.groups.get(groupId);
    if (!g) return false;
    parentId = parentId && this.groups.has(parentId) ? parentId : null;
    if (parentId && this.isInside(parentId, groupId)) return false; // can't put a group inside itself
    g.parentId = parentId;
    this.saveGroups();
    return true;
  }

  createGroup(noteIds, { name = '', parentId = null } = {}) {
    const g = normalizeGroup({ id: crypto.randomUUID(), name, createdAt: Date.now(), parentId: parentId && this.groups.has(parentId) ? parentId : null });
    this.groups.set(g.id, g);
    this.saveGroups();
    if (!this.settings.madeGroup) { this.settings.madeGroup = true; this.saveSettings(); }
    for (const id of noteIds) this.setGroup(id, g.id);
    return g;
  }

  updateGroup(id, patch = {}) {
    const g = this.groups.get(id);
    if (!g) return null;
    Object.assign(g, normalizeGroup({ ...g, ...patch, id: g.id, parentId: g.parentId, createdAt: g.createdAt }));
    this.saveGroups();
    return g;
  }

  renameGroup(id, name) {
    return this.updateGroup(id, { name });
  }

  // Ungroup: everything inside moves up one level, then the group is removed.
  dissolveGroup(id) {
    const g = this.groups.get(id);
    if (!g) return;
    for (const n of this.notes.values()) if (n.groupId === id) this.setGroup(n.id, g.parentId);
    for (const c of this.groups.values()) if (c.parentId === id) c.parentId = g.parentId;
    this.groups.delete(id);
    this.saveGroups();
    this.cleanupGroups();
  }

  // A group disappears once nothing inside it (not even a note in the bin) is left.
  cleanupGroups() {
    const used = new Set();
    for (const n of this.notes.values()) {
      for (const g of this.chain(n.groupId)) used.add(g.id);
    }
    let changed = false;
    for (const id of [...this.groups.keys()]) {
      if (!used.has(id)) { this.groups.delete(id); changed = true; }
    }
    if (changed) this.saveGroups();
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
        if (f.endsWith('.json') && f !== 'meta.json' && f !== 'groups.json') scan((readJson(path.join(dir, f)) || {}).html);
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
    fs.writeFileSync(path.join(tmpDir, 'groups.json'), JSON.stringify({ groups: [...this.groups.values()] }));
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
  // Brings back the notes of one backup, never overwriting anything. Everything that comes back
  // goes into a new group "Restored Notes from Thursday, 22 Oct 2026" at the top level.
  restoreBackup(name) {
    const dir = path.join(this.backupDir, path.basename(name));
    if (!fs.existsSync(dir)) return 0;
    let restored = 0;
    const ids = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json') || f === 'meta.json' || f === 'groups.json') continue;
      const b = readJson(path.join(dir, f));
      if (!b || !b.id) continue;
      const cur = this.notes.get(String(b.id));
      if (cur && cur.html === b.html) {
        if (cur.deletedAt && !b.deletedAt) { this.restore(cur.id); ids.push(cur.id); restored++; }
        continue;
      }
      if (b.deletedAt) continue;
      const copy = normalize({ ...b, id: crypto.randomUUID(), open: false, restoredFrom: name, deletedAt: null });
      if (copy.groupId && !this.groups.has(copy.groupId)) copy.groupId = null;
      this.notes.set(copy.id, copy);
      this.writeNow(copy.id);
      ids.push(copy.id);
      restored++;
    }
    if (ids.length) {
      this.createGroup(ids, { name: `Restored Notes from ${backupDayName(name)}` });
      this.cleanupGroups();
    }
    return restored;
  }
}

// "2026-10-22" or "2026-10-22_14-30-00" → "Thursday, 22 Oct 2026"
function backupDayName(name) {
  const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(name);
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = { backupDayName, normalizeInk, Store, COLORS, GROUP_STYLES, GROUP_COLORS, normalize, localDate, ATT_PREFIX };
