'use strict';
// 1.1.30: real encryption for locked notes (the owner's wish). See ai-context/architecture.md, "Encryption".
//
// How it works, in short:
// - One key pair (X25519) for the whole app. The public half is stored as it is, so a note can be LOCKED (encrypted)
//   without the PIN. The private half is stored twice, each copy encrypted (AES-256-GCM) with a key made from:
//     byPw:  the PIN / password, through scrypt N=2^17 (about 0.3 s and 128 MB per try, so guessing is slow)
//     byRec: the recovery key (25 random letters and digits, shown to the owner once)
//   Typing the PIN (or the recovery key) opens the private key for this session; it is never written to disk.
// - A locked note's title, html, text, firstImage and ink are sealed together into note.enc
//   ({ v: 2, k: one-time public key, n: nonce, t: tag, c: ciphertext }; v 1 = 1.1.30, still read). Its photos, drawings and voice clips are
//   sealed in their own files (FILE_MAGIC + one-time key + nonce + tag + ciphertext). note.encAtt keeps the names
//   of those files in plain text, so the attachment sweep never deletes them.
// - In memory a note is either still sealed (n.enc set, its secret fields empty) or open (n.enc null).
//   The store writes through sealer(): a note that should be locked is sealed on every write, a sealed note that
//   was never opened is written back exactly as it was read. 1.1.31: old backups' copies of locked notes are sealed too.
// - settings.crypt = { v, pub, byPw, byRec, keyShown, off }. "off" = the owner turned encryption off: notes are
//   written in plain text again, but the keys stay, so backups made while it was on can still be opened.
//   While settings.crypt exists, settings.lock is only the marker 'encrypted' (the PIN is checked by opening byPw).
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { S } = require('./state');

const scrypt = promisify(crypto.scrypt);
const KDF_N_PW = 1 << 17;
const KDF_N_REC = 1 << 15; // the recovery key is long and random already
const KDF_MAXMEM = 512 * 1024 * 1024;
const NOTE_AAD = Buffer.from('cosmonotes-note-v1');
const FILE_AAD = Buffer.from('cosmonotes-file-v1');
const KEY_AAD = Buffer.from('cosmonotes-key-v1');
// 1.1.31: version 2 makes the AES key with plain SHA-256 (fewer crypto features, so it works the same in Electron's crypto
// library); version 1 (1.1.30, HKDF) is still read
const FILE_MAGIC = Buffer.from('CNSEAL2\n');
const FILE_MAGIC_V1 = Buffer.from('CNSEAL1\n');
const SPKI = Buffer.from('302a300506032b656e032100', 'hex'); // X25519 public key in DER, before the 32 raw bytes
const PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex'); // X25519 private key in DER
const CODE_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 letters and digits, no I, L, O, U
const ATT_REF = /stickyfile:\/\/att\/([A-Za-z0-9_.-]+)/g;
const SECRET_FIELDS = ['title', 'html', 'text', 'firstImage', 'ink'];
const MARKER = 'encrypted';

let priv = null; // the private key, once the PIN or the recovery key was typed this session
let pending = null; // a new recovery key that the notes list still has to show
let onPending = null; // set by ipc-crypt.js: shows the list so the key is seen
let turningOff = false;
let lastError = null;
const backupsDone = new Set(); // 1.1.31: locked notes whose copies in the backups were sealed (see syncSeals) // 1.1.31: why encryption could not be set up (shown in the list), null = fine
const attState = new Map(); // attachment name -> 'sealed' | 'plain' (read from the file's first bytes once)

// ------------------------------------------------------------------ small helpers
const b64 = (b) => Buffer.from(b).toString('base64');
const unb64 = (s) => Buffer.from(String(s || ''), 'base64');
const conf = () => (S.store && S.store.settings.crypt) || null;
const isSetUp = () => !!conf();
const cryptOn = () => !!conf() && !conf().off && !turningOff;
const keyLoaded = () => !!priv;
const rawPub = (k) => k.export({ type: 'spki', format: 'der' }).subarray(SPKI.length);
const rawPriv = (k) => k.export({ type: 'pkcs8', format: 'der' }).subarray(PKCS8.length);
const pubFromRaw = (raw) => crypto.createPublicKey({ key: Buffer.concat([SPKI, raw]), format: 'der', type: 'spki' });
const privFromRaw = (raw) => crypto.createPrivateKey({ key: Buffer.concat([PKCS8, raw]), format: 'der', type: 'pkcs8' });
const lockedNow = (n) => !!n.locked || S.store.lockedGroupsOf(n).length > 0;
const shouldSeal = (n) => cryptOn() && lockedNow(n);

function newCode() {
  const bytes = crypto.randomBytes(25);
  const s = [...bytes].map((b) => CODE_ABC[b & 31]).join(''); // 256 is a multiple of 32: every letter is as likely
  return s.match(/.{5}/g).join('-');
}
// what people type may have spaces, small letters, or O / I / L for 0 / 1
const cleanCode = (c) => String(c || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');

// ------------------------------------------------------------------ sealing (needs only the public key)
function keyFor(shared, ephRaw, pubRaw, v = 2) {
  if (v === 1) return Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([ephRaw, pubRaw]), 'cosmonotes', 32));
  return crypto.createHash('sha256').update('cosmonotes-v2').update(shared).update(ephRaw).update(pubRaw).digest();
}
function sealBytes(plain, aad, pubRaw = unb64(conf().pub)) {
  const eph = crypto.generateKeyPairSync('x25519');
  const ephRaw = rawPub(eph.publicKey);
  const key = keyFor(crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: pubFromRaw(pubRaw) }), ephRaw, pubRaw);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return { k: ephRaw, n: iv, t: c.getAuthTag(), c: ct };
}
// opening needs the private key (after the PIN); null when it can't be opened
function openBytes({ k, n, t, c }, aad, v = 2, key0 = priv, pubRaw = key0 === priv && conf() ? unb64(conf().pub) : null) {
  if (!key0 || !pubRaw) return null;
  try {
    const key = keyFor(crypto.diffieHellman({ privateKey: key0, publicKey: pubFromRaw(k) }), k, pubRaw, v);
    const d = crypto.createDecipheriv('aes-256-gcm', key, n);
    d.setAAD(aad);
    d.setAuthTag(t);
    return Buffer.concat([d.update(c), d.final()]);
  } catch { return null; }
}
function sealNote(n) {
  const secret = {};
  for (const k of SECRET_FIELDS) secret[k] = n[k];
  const s = sealBytes(Buffer.from(JSON.stringify(secret), 'utf8'), NOTE_AAD);
  return { v: 2, k: b64(s.k), n: b64(s.n), t: b64(s.t), c: b64(s.c) };
}
function openNote(enc) {
  if (!enc || (enc.v !== 1 && enc.v !== 2)) return null;
  const buf = openBytes({ k: unb64(enc.k), n: unb64(enc.n), t: unb64(enc.t), c: unb64(enc.c) }, NOTE_AAD, enc.v);
  if (!buf) return null;
  try { return JSON.parse(buf.toString('utf8')); } catch { return null; }
}

// ------------------------------------------------------------------ attachments (photos, drawings, voice)
function attRefs(n) {
  const out = new Set();
  for (const m of String(n.html || '').matchAll(ATT_REF)) out.add(m[1]);
  const fi = typeof n.firstImage === 'string' && n.firstImage.match(/^stickyfile:\/\/att\/([A-Za-z0-9_.-]+)/);
  if (fi) out.add(fi[1]);
  return [...out];
}
const fileVersion = (buf) => (buf.length < FILE_MAGIC.length ? 0 : buf.subarray(0, 8).equals(FILE_MAGIC) ? 2 : buf.subarray(0, 8).equals(FILE_MAGIC_V1) ? 1 : 0);
const isSealedBuf = (buf) => fileVersion(buf) > 0;
function attStatus(name) {
  if (attState.has(name)) return attState.get(name);
  const p = S.store.attachmentPath(name);
  if (!p || !fs.existsSync(p)) return null;
  let st = 'plain';
  try {
    const fd = fs.openSync(p, 'r');
    try {
      const head = Buffer.alloc(FILE_MAGIC.length);
      const got = fs.readSync(fd, head, 0, head.length, 0);
      if (got === head.length && isSealedBuf(head)) st = 'sealed';
    } finally { fs.closeSync(fd); }
  } catch { return null; }
  attState.set(name, st);
  return st;
}
function writeAtomic(file, buf) {
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  try { fs.unlinkSync(file + '.bak'); } catch { /* none */ }
}
function sealFile(name) {
  const p = S.store.attachmentPath(name);
  if (!p) return;
  try {
    const plain = fs.readFileSync(p);
    if (isSealedBuf(plain)) { attState.set(name, 'sealed'); return; }
    const s = sealBytes(plain, FILE_AAD);
    writeAtomic(p, Buffer.concat([FILE_MAGIC, s.k, s.n, s.t, s.c]));
    attState.set(name, 'sealed');
  } catch (e) { console.error('could not encrypt', name, e); }
}
// the plain bytes of a sealed file; null when it can't be opened (no PIN yet, or damaged)
function openFileBuf(buf) {
  const m = FILE_MAGIC.length;
  if (buf.length < m + 32 + 12 + 16) return null;
  return openBytes({ k: buf.subarray(m, m + 32), n: buf.subarray(m + 32, m + 44), t: buf.subarray(m + 44, m + 60), c: buf.subarray(m + 60) }, FILE_AAD, fileVersion(buf));
}
function unsealFile(name) {
  if (!priv) return;
  const p = S.store.attachmentPath(name);
  if (!p) return;
  try {
    const buf = fs.readFileSync(p);
    if (!isSealedBuf(buf)) { attState.set(name, 'plain'); return; }
    const plain = openFileBuf(buf);
    if (!plain) return; // keep it as it is rather than lose it
    writeAtomic(p, plain);
    attState.set(name, 'plain');
  } catch (e) { console.error('could not decrypt', name, e); }
}
// a file another note shows in plain sight is left as it is (Duplicate shares picture files between notes)
function usedByPlainNote(name, exceptId) {
  for (const m of S.store.notes.values()) {
    if (m.id === exceptId || m.enc || shouldSeal(m)) continue;
    if (typeof m.html === 'string' && m.html.includes(name)) return true;
  }
  return false;
}
// What the stickyfile:// protocol and "open" use: Buffer = the plain bytes of a sealed file, false = sealed and the
// PIN wasn't typed yet, null = an ordinary file (read it directly).
function attachmentBytes(p) {
  const name = path.basename(p);
  if (attStatus(name) !== 'sealed') return null;
  try { return openFileBuf(fs.readFileSync(p)) || false; } catch { return false; }
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const mimeOf = (p) => MIME[path.extname(p).slice(1).toLowerCase()] || 'application/octet-stream';
// "Open" on a sealed photo: a plain copy in a temp folder, for the app that opens it. Emptied at every start and, since
// 1.1.31, when the app quits (a photo still open in another app is left until the next start)
const OPEN_DIR = path.join(os.tmpdir(), 'CosmoNotes-open');
function openableCopy(p) {
  const bytes = attachmentBytes(p);
  if (bytes === null) return p;
  if (bytes === false) return null;
  fs.mkdirSync(OPEN_DIR, { recursive: true });
  const out = path.join(OPEN_DIR, path.basename(p));
  fs.writeFileSync(out, bytes);
  return out;
}
function clearOpenCopies() { try { fs.rmSync(OPEN_DIR, { recursive: true, force: true }); } catch { /* ignore */ } }

// ------------------------------------------------------------------ the store's hooks
// What gets written to disk for a note (store.writeNow and backups).
function sealer(n) {
  if (n.enc) return n; // still sealed from disk: written back as it was read
  if (!isSetUp()) return n;
  const refs = attRefs(n);
  if (!shouldSeal(n)) {
    if (priv) for (const name of refs) if (attStatus(name) === 'sealed') unsealFile(name);
    return n.encAtt ? { ...n, encAtt: null } : n;
  }
  for (const name of refs) if (attStatus(name) === 'plain' && !usedByPlainNote(name, n.id)) sealFile(name);
  return { ...n, title: '', html: '', text: '', firstImage: null, ink: null, enc: sealNote(n), encAtt: refs.length ? refs : null };
}
// A note from a backup, opened if it was sealed and the PIN was typed (null = can't be opened now).
function opener(b) {
  if (!b || !b.enc) return b;
  const o = openNote(b.enc);
  return o ? { ...b, ...o, enc: null, encAtt: null } : null;
}
// Fill in every sealed note in memory (after the PIN). The files stay as they are until the next save.
function openAll() {
  let opened = 0;
  for (const n of S.store.notes.values()) {
    if (!n.enc) continue;
    const o = openNote(n.enc);
    if (!o) continue;
    for (const k of SECRET_FIELDS) if (k in o) n[k] = o[k];
    n.title = typeof n.title === 'string' ? n.title : '';
    n.html = typeof n.html === 'string' ? n.html : '';
    n.text = typeof n.text === 'string' ? n.text : '';
    n.enc = null;
    n.encAtt = null;
    opened++;
  }
  return opened;
}
// Bring every note's file in line with its lock: sealed when it is locked now (by its own lock or a group's), plain when
// not any more. Runs at start and with every change the list hears about (notifyList), so locking a group, dragging a note
// into a locked group or out of one, removing a lock… are all covered. Only notes whose state changed are written.
// 1.1.31: a note that just got sealed has its copies in the daily backups sealed too.
function syncSeals() {
  if (!isSetUp() || turningOff) return 0;
  let count = 0;
  const newlySealed = [];
  for (const n of S.store.notes.values()) {
    if (n.enc) continue; // still sealed from disk
    const want = cryptOn() && lockedNow(n);
    // its copies in the backups: looked at once each time it becomes locked (a backup made while it was unlocked is plain)
    if (!want) backupsDone.delete(n.id);
    else if (!backupsDone.has(n.id)) { backupsDone.add(n.id); newlySealed.push(n.id); }
    if (want === S.store.sealedOnDisk.has(n.id)) continue;
    try { S.store.writeNow(n.id); count++; } catch (e) { console.error('seal failed', n.id, e); }
  }
  if (newlySealed.length && conf().backupsSealed) sealBackups(newlySealed);
  return count;
}

// ------------------------------------------------------------------ old backups (1.1.31, the owner's wish)
// Backups made before encryption (or before a note was locked, or while encryption was off) hold plain copies. Every copy
// of a note that is locked now, or was locked when that backup was made (its own lock, or a locked group in that backup's
// groups.json), is sealed where it is: nothing is removed, and it opens with the PIN / recovery key like the note itself.
// A full pass runs once (settings.crypt.backupsSealed), and again after encryption is turned back on; after that only the
// copies of a note that just became locked are looked at (syncSeals). New backups are written sealed anyway (diskForm).
function lockedInBackup(b, groups) {
  if (b.locked) return true;
  const seen = new Set();
  for (let g = groups.get(b.groupId); g && !seen.has(g.id); g = groups.get(g.parentId)) {
    seen.add(g.id);
    if (g.locked) return true;
  }
  return false;
}
function sealBackups(onlyIds = null) {
  if (!cryptOn()) return 0;
  let count = 0;
  for (const bk of S.store.listBackups()) {
    const dir = path.join(S.store.backupDir, bk.name);
    const groups = new Map();
    try {
      const g = JSON.parse(fs.readFileSync(path.join(dir, 'groups.json'), 'utf8'));
      for (const x of Array.isArray(g.groups) ? g.groups : []) if (x && x.id) groups.set(String(x.id), x);
    } catch { /* no groups in that backup */ }
    let files;
    try {
      files = onlyIds ? onlyIds.map((id) => `${id}.json`) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'meta.json' && f !== 'groups.json');
    } catch { continue; }
    for (const f of files) {
      const p = path.join(dir, f);
      let b;
      try { b = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; } // not in this backup
      if (!b || !b.id || b.enc) continue;
      const now = S.store.get(String(b.id));
      if (!lockedInBackup(b, groups) && !(now && (now.enc || lockedNow(now)))) continue;
      const refs = attRefs(b);
      for (const name of refs) if (attStatus(name) === 'plain' && !usedByPlainNote(name, null)) sealFile(name);
      const sealed = { ...b, title: '', html: '', text: '', firstImage: null, ink: null, enc: sealNote(b), encAtt: refs.length ? refs : null };
      // with the key open this session: check it opens again before the plain copy is replaced
      if (priv) { const o = openNote(sealed.enc); if (!o || o.html !== b.html || o.title !== b.title) continue; }
      try { writeAtomic(p, Buffer.from(JSON.stringify(sealed), 'utf8')); count++; } catch (e) { console.error('could not encrypt a backup copy', p, e); }
    }
  }
  return count;
}
// the full pass over every backup (once, and after encryption is turned back on)
function sealAllBackups() {
  if (!cryptOn()) return 0;
  const lockedIds = [...S.store.notes.values()].filter((n) => n.enc || lockedNow(n)).map((n) => n.id);
  if (conf().backupsSealed) { for (const id of lockedIds) backupsDone.add(id); return 0; }
  let count = 0;
  try { count = sealBackups(); } catch (e) { console.error('sealing backups failed', e); return 0; }
  for (const id of lockedIds) backupsDone.add(id);
  S.store.settings.crypt = { ...conf(), backupsSealed: true };
  S.store.saveSettings();
  return count;
}
function install() {
  S.store.sealer = sealer;
  S.store.opener = opener;
  // while the keys exist the PIN is checked by opening them; an old "salt:hash" next to them would be the weak spot
  if (isSetUp() && S.store.settings.lock !== MARKER) { S.store.settings.lock = MARKER; S.store.saveSettings(); }
  syncSeals(); // e.g. a note locked just before a crash or power cut, before its file was sealed
  sealAllBackups(); // 1.1.31: once, for backups made before
  clearOpenCopies();
}

// ------------------------------------------------------------------ keys
async function wrap(raw, secret, N) {
  const salt = crypto.randomBytes(16);
  const kek = await scrypt(String(secret), salt, 32, { N, r: 8, p: 1, maxmem: KDF_MAXMEM });
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kek, iv);
  c.setAAD(KEY_AAD);
  const ct = Buffer.concat([c.update(raw), c.final()]);
  return { s: b64(salt), N, n: b64(iv), t: b64(c.getAuthTag()), c: b64(ct) };
}
async function unwrap(w, secret) {
  if (!w || !w.s) return null;
  try {
    const kek = await scrypt(String(secret), unb64(w.s), 32, { N: Number(w.N) || KDF_N_PW, r: 8, p: 1, maxmem: KDF_MAXMEM });
    const d = crypto.createDecipheriv('aes-256-gcm', kek, unb64(w.n));
    d.setAAD(KEY_AAD);
    d.setAuthTag(unb64(w.t));
    return Buffer.concat([d.update(unb64(w.c)), d.final()]);
  } catch { return null; }
}
function useKey(raw) {
  const k = privFromRaw(raw);
  // it must belong to the stored public key (a damaged or swapped settings file would seal with the wrong one)
  if (!rawPub(crypto.createPublicKey(k)).equals(unb64(conf().pub))) return false;
  priv = k;
  openAll();
  return true;
}
function setPending(code) {
  pending = code;
  if (onPending) { try { onPending(); } catch (e) { console.error(e); } }
}
// The first PIN (or the first time an older PIN is typed after the update): make the keys and seal every locked note.
// 1.1.31: everything is tried out first (seal and open, the keys locked and opened again with the PIN and the recovery
// key). If anything fails, nothing is changed: the notes stay as they are and the list says what went wrong.
async function makeKeys(pw) {
  const kp = crypto.generateKeyPairSync('x25519');
  const code = newCode();
  const raw = rawPriv(kp.privateKey);
  const pubRaw = rawPub(kp.publicKey);
  if (raw.length !== 32 || pubRaw.length !== 32) throw new Error('the key pair has an unexpected size');
  const sample = Buffer.from('CosmoNotes self-test ✓ ' + crypto.randomBytes(8).toString('hex'), 'utf8');
  const s = sealBytes(sample, NOTE_AAD, pubRaw);
  const back = openBytes(s, NOTE_AAD, 2, privFromRaw(raw), pubRaw);
  if (!back || !back.equals(sample)) throw new Error('encrypting and decrypting a test note did not give it back');
  const byPw = await wrap(raw, pw, KDF_N_PW);
  const byRec = await wrap(raw, cleanCode(code), KDF_N_REC);
  const a = await unwrap(byPw, pw);
  const b = await unwrap(byRec, cleanCode(code));
  if (!a || !a.equals(raw) || !b || !b.equals(raw)) throw new Error('the key could not be opened again with the PIN or the recovery key');
  if (await unwrap(byPw, pw + 'x')) throw new Error('a wrong PIN opened the key');
  return { kp, code, pubRaw, byPw, byRec };
}
async function setUp(pw) {
  if (isSetUp()) return null;
  let made;
  try { made = await makeKeys(pw); } catch (e) {
    lastError = String((e && e.message) || e);
    console.error('encryption could not be set up', e);
    if (onPending) { try { onPending(); } catch { /* ignore */ } }
    return null;
  }
  lastError = null;
  const { kp, code, pubRaw, byPw, byRec } = made;
  if (isSetUp()) return null; // set up meanwhile by another window
  S.store.settings.crypt = { v: 2, pub: b64(pubRaw), byPw, byRec, keyShown: false, off: false };
  S.store.settings.lock = MARKER;
  S.store.saveSettings();
  priv = kp.privateKey;
  syncSeals();
  sealAllBackups();
  setPending(code);
  return code;
}
async function unlock(pw) {
  if (!isSetUp()) return false;
  const raw = await unwrap(conf().byPw, pw);
  return !!raw && useKey(raw);
}
async function unlockWithRecovery(code) {
  if (!isSetUp()) return false;
  const raw = await unwrap(conf().byRec, cleanCode(code));
  return !!raw && useKey(raw);
}
// a new PIN / password (the key must be open)
async function changePw(next) {
  if (!priv || !isSetUp()) return false;
  const byPw = await wrap(rawPriv(priv), next, KDF_N_PW);
  S.store.settings.crypt = { ...conf(), byPw };
  S.store.saveSettings();
  return true;
}
// a new recovery key; the old one stops working (the key must be open)
async function newRecovery() {
  if (!priv || !isSetUp()) return null;
  const code = newCode();
  const byRec = await wrap(rawPriv(priv), cleanCode(code), KDF_N_REC);
  S.store.settings.crypt = { ...conf(), byRec, keyShown: false };
  S.store.saveSettings();
  setPending(code);
  return code;
}
const takePending = () => pending;
function keySaved() {
  pending = null;
  if (!isSetUp()) return;
  S.store.settings.crypt = { ...conf(), keyShown: true };
  S.store.saveSettings();
}
// Turn encryption off (every note is written in plain text again) or back on. The key must be open.
function setOff(off) {
  if (!priv || !isSetUp()) return false;
  if (off) {
    openAll();
    turningOff = true;
    try {
      for (const n of S.store.notes.values()) if (!n.enc && lockedNow(n)) S.store.writeNow(n.id);
      for (const f of fs.readdirSync(S.store.attDir)) if (attStatus(f) === 'sealed') unsealFile(f);
    } finally { turningOff = false; }
    S.store.settings.crypt = { ...conf(), off: true, backupsSealed: false }; // backups made while off are plain
    S.store.saveSettings();
  } else {
    S.store.settings.crypt = { ...conf(), off: false };
    S.store.saveSettings();
    syncSeals();
    sealAllBackups();
  }
  return true;
}
// what the notes list shows in Settings
function status() {
  const c = conf();
  return {
    setUp: !!c,
    on: !!c && !c.off,
    keyShown: !!(c && c.keyShown),
    pending: !!pending,
    error: lastError, // 1.1.31: encryption could not be set up (why)
    // 1.1.31: notes locked before the update wait for the PIN to be encrypted: the list asks for it straight away
    needPin: !c && !!S.store.settings.lock && [...S.store.notes.values()].some((n) => !n.deletedAt && lockedNow(n)),
    sealedNow: [...S.store.notes.values()].filter((n) => n.enc || (cryptOn() && lockedNow(n))).length,
  };
}
const setPendingHandler = (fn) => { onPending = fn; };

module.exports = {
  attachmentBytes, changePw, clearOpenCopies, mimeOf, cleanCode, cryptOn, install, isSetUp, keyLoaded, keySaved, newRecovery, openableCopy,
  setOff, setPendingHandler, setUp, status, syncSeals, takePending, unlock, unlockWithRecovery,
};
