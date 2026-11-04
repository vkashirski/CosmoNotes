'use strict';
// 1.2.4: voice recordings are written to disk while they are made (the owner's rule: never lose anything). Before 1.2.4
// the note window kept the whole recording in memory until Save, so closing the note, quitting or a crash lost it.
//
// Files in attachments/ (see ai-context/data-model.md):
//   <name>.part      the audio so far: every 250 ms piece the window sends is appended (<name> = the final file, x.webm)
//   <stem>.rec.json  { noteId, file, startedAt, endedAt }: whose recording it is (<stem> = <name> without ".webm")
// Save renames <name>.part to <name>; the .rec.json goes once the note's html points at the file. While a .rec.json is
// there, the sweep leaves its files alone (store.js sweepAttachments).
// Closing the note, locking it, quitting or a crash keep what was recorded, with a 🎤 chip at the end of its note: the
// window adds it when it can (close, lock), main otherwise (settle). A note still sealed (locked, PIN not typed yet) gets
// its chip after the PIN (retryPending, called by notifyList); its clip is sealed at once (crypt.sealLoose).
const fs = require('fs');
const path = require('path');
const crypt = require('./crypt');
const { S } = require('./state');

const PREFIX = 'stickyfile://att/';
const NAME = /^[A-Za-z0-9_-]+\.webm$/;
const MAX_BYTES = 500 * 1024 * 1024; // about 70 hours of speech
const open = new Map(); // name -> { name, noteId, win, fd, bytes, startedAt, writes }
const pending = new Map(); // name -> { noteId, dur }: finished, its note still sealed (chip after the PIN)
const watched = new WeakSet();

const stemOf = (name) => name.split('.')[0];
const dir = () => S.store.attDir;
const sidecar = (name) => path.join(dir(), stemOf(name) + '.rec.json');
const partOf = (name) => path.join(dir(), name + '.part');
const fileOf = (name) => path.join(dir(), name);
const rm = (p) => { try { fs.unlinkSync(p); } catch { /* not there */ } };
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const secs = (ms) => Math.max(1, Math.round(ms / 1000));

function writeSidecar(name, data) {
  const p = sidecar(name);
  const fd = fs.openSync(p + '.tmp', 'w');
  try { fs.writeSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(p + '.tmp', p);
}
function readSidecar(name) {
  try { return JSON.parse(fs.readFileSync(sidecar(name), 'utf8')) || {}; } catch { return {}; }
}
// antivirus or the indexer may hold a fresh file for a moment on Windows
function renameRetry(from, to) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(from, to); return; } catch (e) {
      if (i >= 3) { fs.copyFileSync(from, to); rm(from); return; }
      const until = Date.now() + 40 * (i + 1); while (Date.now() < until) { /* wait */ }
    }
  }
}

// the 🎤 chip, the same markup as voiceChip() in src/note/menus-voice-ink.js (keep both the same)
function chipHtml(url, dur) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  let x = [...url].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  let bars = '';
  for (let i = 0; i < 18; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    bars += `<i class="h${1 + ((x >>> 16) % 5)}"></i>`;
  }
  return `<span class="voice" contenteditable="false" data-src="${esc(url)}" data-dur="${dur}"><span class="v-play"></span><span class="v-bars">${bars}</span><span class="v-time">${fmt(dur)}</span></span>&nbsp;`;
}

// ------------------------------------------------------------------ while recording (calls from the note window)
function start(noteId, win) {
  const name = S.store.newAttachmentName('webm');
  const startedAt = Date.now();
  writeSidecar(name, { noteId, file: name, startedAt });
  const fd = fs.openSync(partOf(name), 'w');
  open.set(name, { name, noteId, win, fd, bytes: 0, startedAt, writes: 0 });
  // the window closes or its page crashes mid-recording: keep what arrived
  if (win && !watched.has(win)) {
    watched.add(win);
    win.once('closed', () => abandon(win));
    if (win.webContents) win.webContents.on('render-process-gone', () => abandon(win));
  }
  return { id: name, url: PREFIX + name };
}

function chunk(win, id, bytes) {
  const r = open.get(String(id));
  if (!r || r.win !== win) return false;
  const buf = Buffer.from(bytes || []);
  if (!buf.length || r.bytes + buf.length > MAX_BYTES) return false;
  try {
    fs.writeSync(r.fd, buf);
    r.bytes += buf.length;
    if (++r.writes % 8 === 0) fs.fsyncSync(r.fd); // on the disk itself every ~2 s (a power cut loses at most that)
    return true;
  } catch (e) { console.error('recording write failed', e); return false; }
}

function closeFd(r) {
  open.delete(r.name);
  try { fs.fsyncSync(r.fd); } catch { /* ignore */ }
  try { fs.closeSync(r.fd); } catch { /* ignore */ }
}
// .part -> the finished file. Returns its name, or null when nothing was recorded.
function finalize(r) {
  closeFd(r);
  if (!r.bytes) { rm(partOf(r.name)); rm(sidecar(r.name)); return null; }
  renameRetry(partOf(r.name), fileOf(r.name));
  try { writeSidecar(r.name, { noteId: r.noteId, file: r.name, startedAt: r.startedAt, endedAt: Date.now() }); } catch { /* the old one still says whose it is */ }
  return r.name;
}

// mode: 'save' = Save (the window adds the chip, then calls done) · 'discard' = thrown away (the X) ·
// 'kept' = closed or locked mid-recording (the window added the chip if it could; main makes sure).
function end(win, id, mode) {
  const r = open.get(String(id));
  if (!r || r.win !== win) return null;
  if (mode === 'discard') { closeFd(r); rm(partOf(r.name)); rm(sidecar(r.name)); return null; }
  const name = finalize(r);
  if (!name) return null;
  if (mode === 'kept') settle(name, r.noteId, secs(Date.now() - r.startedAt));
  return PREFIX + name;
}

// the window saved the note with the chip in it: the .rec.json can go (main adds the chip if it isn't there after all)
function done(noteId, id) {
  const name = String(id);
  if (!NAME.test(name) || open.has(name) || !exists(fileOf(name))) return false;
  const sc = readSidecar(name);
  if (sc.noteId !== noteId) return false;
  return settle(name, noteId, secs((sc.endedAt || Date.now()) - (sc.startedAt || Date.now())));
}

function abandon(win) {
  for (const r of [...open.values()]) {
    if (r.win !== win) continue;
    const name = finalize(r);
    if (name) settle(name, r.noteId, secs(Date.now() - r.startedAt));
  }
}
// quitting: finish every recording still open (before the store's last flush)
function finishAll() {
  for (const r of [...open.values()]) {
    try {
      const name = finalize(r);
      if (name) settle(name, r.noteId, secs(Date.now() - r.startedAt));
    } catch (e) { console.error('finishing a recording failed', e); }
  }
}

// ------------------------------------------------------------------ making sure the note shows it
// The note points at the file (a chip at its end if it doesn't yet), then the .rec.json goes. A note that is still
// sealed waits for the PIN (false); a note that is gone gets a new one, "Recovered recording".
function settle(name, noteId, dur) {
  const url = PREFIX + name;
  let n = noteId ? S.store.get(noteId) : null;
  if (n && n.enc) {
    crypt.sealLoose(name, n);
    pending.set(name, { noteId, dur });
    return false;
  }
  try {
    if (!n) {
      n = S.store.create({ title: 'Recovered recording', html: `<div>${chipHtml(url, dur)}</div>`, text: '🎤 Voice note', open: false });
    } else if (!String(n.html || '').includes(url)) {
      S.store.update(n.id, { html: `${n.html || ''}<div>${chipHtml(url, dur)}</div>`, text: n.text || '🎤 Voice note' }, { content: true });
      S.store.writeNow(n.id);
    }
  } catch (e) { console.error('could not add the recording to its note', e); return false; }
  pending.delete(name);
  rm(sidecar(name));
  return true;
}

// after the PIN (notifyList runs this): chips for recordings whose note was sealed
function retryPending() {
  if (!pending.size) return 0;
  let n = 0;
  for (const [name, p] of [...pending]) if (settle(name, p.noteId, p.dur)) n++;
  return n;
}

// At start, before any window opens: recordings a crash (or a power cut) left behind.
function recover() {
  let files = [];
  try { files = fs.readdirSync(dir()); } catch { return 0; }
  let count = 0;
  for (const f of files) {
    if (!f.endsWith('.rec.json')) continue;
    const stem = f.slice(0, -'.rec.json'.length);
    let sc = {};
    try { sc = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8')) || {}; } catch { /* damaged: the file name still says which */ }
    const name = typeof sc.file === 'string' && NAME.test(sc.file) && stemOf(sc.file) === stem ? sc.file : `${stem}.webm`;
    if (!NAME.test(name)) continue;
    try {
      const part = partOf(name);
      if (exists(part)) {
        if (!fs.statSync(part).size) rm(part);
        else if (!exists(fileOf(name))) renameRetry(part, fileOf(name));
      }
      if (!exists(fileOf(name))) { rm(path.join(dir(), f)); continue; }
      const startedAt = Number(sc.startedAt) || 0;
      const endedAt = Number(sc.endedAt) || fs.statSync(fileOf(name)).mtimeMs;
      settle(name, typeof sc.noteId === 'string' ? sc.noteId : '', startedAt ? secs(endedAt - startedAt) : 1);
      count++;
    } catch (e) { console.error('could not recover a recording', f, e); }
  }
  return count;
}

const isRecording = () => open.size > 0;

module.exports = { abandon, chipHtml, chunk, done, end, finishAll, isRecording, recover, retryPending, start };
