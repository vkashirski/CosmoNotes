'use strict';
// 1.4.34: Ground control (Settings → Feedback in the app): a feature request or a bug report, sent to the owner's relay
// (feedback-worker/: a Cloudflare Worker that opens an issue in a private GitHub repo). Rules (architecture.md →
// "Ground control (Settings → Feedback)"):
// - Only the list window may use gc:*. Only main goes online, only on Send, only to RELAY. What is sent is what the form
//   shows: the words typed, the pictures added, the app details if ticked. Nothing from a note.
// - Pictures are made smaller here, never refused: the longest side at most 1600 px, then smaller until the file is at
//   most 600 KB. Re-encoding also drops what a photo carries besides its pixels (place, camera).
// - The puzzle: the relay's challenge + the report's words, hashed with a counter until the hash starts with `bits` zero
//   bits (~0.3 s here, in small steps so main never stalls). The relay checks it with one hash.
// - Drafts: one per kind (a feature request and a bug report can both be half-written), on disk while typed (store.js
//   feedbackDraft: { feature, bug }) and kept after a Send that failed. A Send that worked clears its kind's draft.
// - After a Send, Submit rests (WAIT, or as long as the relay says).
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { app, ipcMain, net, nativeImage, dialog, BrowserWindow } = require('electron');
const { S } = require('./state');

const RELAY = 'https://cosmonotes-feedback.v-kasirski.workers.dev';
const WAIT = 60; // seconds Send rests after a report went out
const MAX_BITS = 24; // a relay asking for more than this would keep the PC busy too long
// the same limits as the relay's (feedback-worker/worker.mjs LIMITS)
const LIMITS = { title: 120, text: 4000, expected: 2000, email: 200, details: 300, images: 3 };
const PIC = { side: 1600, bytes: 600e3 };

let relay = RELAY; // a test points this at its own server
let restUntil = 0;
let sending = false;
const fetcher = () => (process.versions.electron && net && net.fetch ? net.fetch.bind(net) : globalThis.fetch);
const fromList = (e) => !!(S.listWin && !S.listWin.isDestroyed() && e && e.sender === S.listWin.webContents);
const waitNow = () => Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));

function details() {
  const bits = [`CosmoNotes ${app.getVersion()}`, `Windows ${os.release()}`];
  if (process.versions.electron) bits.push(`Electron ${process.versions.electron}`);
  bits.push(process.arch);
  return bits.join(' · ');
}

// ---------------------------------------------------------------- pictures
// bytes (any picture Chromium can read) → { type: 'png' | 'jpeg', data: base64, w, h } or null when it isn't a picture.
// PNG first (screenshots stay sharp), JPEG when PNG is too big, then smaller sizes until it fits.
function shrink(bytes) {
  let img;
  try { img = nativeImage.createFromBuffer(Buffer.from(bytes)); } catch { return null; }
  if (!img || img.isEmpty()) return null;
  const { width: w, height: h } = img.getSize();
  if (!w || !h) return null;
  let side = Math.min(PIC.side, Math.max(w, h));
  let last = null;
  for (let step = 0; step < 10; step++) {
    const k = side / Math.max(w, h);
    const im = k < 1 ? img.resize({ width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), quality: 'best' }) : img;
    const size = im.getSize();
    const png = im.toPNG();
    if (png.length <= PIC.bytes) return { type: 'png', data: png.toString('base64'), w: size.width, h: size.height };
    const jpg = im.toJPEG(step < 2 ? 85 : 70);
    last = { type: 'jpeg', data: jpg.toString('base64'), w: size.width, h: size.height };
    if (jpg.length <= PIC.bytes) return last;
    side = Math.max(64, Math.round(side * 0.75));
  }
  return last;
}

// ---------------------------------------------------------------- the report
const str = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').slice(0, max);
function cleanDraft(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {
    kind: d.kind === 'bug' ? 'bug' : 'feature',
    title: str(d.title, LIMITS.title), text: str(d.text, LIMITS.text), expected: str(d.expected, LIMITS.expected),
    email: str(d.email, LIMITS.email).trim(), withDetails: d.withDetails !== false,
    images: (Array.isArray(d.images) ? d.images : []).slice(0, LIMITS.images)
      .filter((p) => p && (p.type === 'png' || p.type === 'jpeg') && typeof p.data === 'string' && p.data.length <= 1e6)
      .map((p) => ({ type: p.type, data: p.data, w: Number(p.w) || 0, h: Number(p.h) || 0 })),
  };
  const empty = !out.title && !out.text && !out.expected && !out.email && !out.images.length;
  return empty ? null : out;
}
const KINDS = ['feature', 'bug'];
function readDrafts() {
  const raw = S.store.feedbackDraft() || {};
  const out = { feature: null, bug: null };
  if (raw.kind) { const d = cleanDraft(raw); if (d) out[d.kind] = d; return out; } // a draft from before there was one per kind
  for (const k of KINDS) out[k] = raw[k] ? cleanDraft({ ...raw[k], kind: k }) : null;
  return out;
}
function saveDraft(kind, d) {
  if (!KINDS.includes(kind)) return;
  const all = readDrafts();
  all[kind] = d ? cleanDraft({ ...d, kind }) : null;
  S.store.saveFeedbackDraft(all.feature || all.bug ? all : null);
}
// The words the puzzle is tied to: the relay builds the same string (worker.mjs wordsOf)
const wordsOf = (r) => JSON.stringify([r.kind, r.title, r.text, r.expected, r.email, r.details, r.version]);
function zeroBits(buf) {
  let n = 0;
  for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
}
async function solve(challenge, words, bits) {
  const tail = ':' + crypto.createHash('sha256').update(words).digest('hex');
  for (let n = 0; ; ) {
    const stop = n + 5000;
    for (; n < stop; n++) if (zeroBits(crypto.createHash('sha256').update(`${challenge}:${n}${tail}`).digest()) >= bits) return n;
    await new Promise((r) => setImmediate(r));
  }
}

async function call(url, opts, ms) {
  const res = await fetcher()(url, { ...opts, signal: AbortSignal.timeout(ms) });
  let body = {};
  try { body = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body: body || {} };
}

// → { ok: true, wait } | { error: 'wait' | 'empty' | 'closed' | 'limit' | 'busy' | 'offline' | 'failed', wait? }
async function send(draft) {
  if (sending) return { error: 'wait', wait: waitNow() };
  if (waitNow() > 0) return { error: 'wait', wait: waitNow() };
  const d = cleanDraft(draft);
  if (!d || !d.title.trim() || !d.text.trim()) return { error: 'empty' };
  saveDraft(d.kind, d); // kept whatever happens next
  const report = { kind: d.kind, title: d.title.trim(), text: d.text.trim(), expected: d.kind === 'bug' ? d.expected.trim() : '',
    email: d.email, details: d.withDetails ? details() : '', version: app.getVersion() };
  sending = true;
  try {
    const ch = await call(`${relay}/challenge`, { headers: { 'cache-control': 'no-cache' } }, 15000);
    if (ch.status === 503) return { error: 'closed' };
    const bits = Number(ch.body.bits);
    if (ch.status !== 200 || typeof ch.body.challenge !== 'string' || !(bits >= 0 && bits <= MAX_BITS)) return { error: 'failed' };
    const nonce = await solve(ch.body.challenge, wordsOf(report), bits);
    const body = JSON.stringify({ challenge: ch.body.challenge, nonce, report, images: d.images.map((p) => ({ type: p.type, data: p.data })) });
    const r = await call(`${relay}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }, 60000);
    if (r.status === 200 && r.body.ok) {
      saveDraft(d.kind, null);
      restUntil = Date.now() + WAIT * 1000;
      return { ok: true, wait: WAIT };
    }
    if (r.status === 503) return { error: 'closed' };
    if (r.status === 429) {
      restUntil = Date.now() + Math.max(WAIT, Number(r.body.retryAfter) || 0) * 1000;
      return { error: r.body.error === 'busy' ? 'busy' : 'limit', wait: waitNow() };
    }
    return { error: 'failed' };
  } catch (err) {
    console.error('Ground control:', err && err.message);
    return { error: 'offline' };
  } finally {
    sending = false;
  }
}

// ---------------------------------------------------------------- IPC (the list window only)
function registerFeedbackIpc() {
  ipcMain.handle('gc:info', (e) => (fromList(e) ? { details: details(), drafts: readDrafts(), wait: waitNow(), limits: LIMITS } : null));
  ipcMain.handle('gc:draft', (e, kind, d) => { if (fromList(e)) saveDraft(kind, d); return true; });
  ipcMain.handle('gc:image', (e, bytes) => (fromList(e) && bytes && bytes.length ? shrink(bytes) : null));
  ipcMain.handle('gc:pick', async (e) => {
    if (!fromList(e)) return [];
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Add pictures', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });
    if (r.canceled) return [];
    const out = [];
    for (const p of r.filePaths.slice(0, LIMITS.images)) { try { const im = shrink(fs.readFileSync(p)); if (im) out.push(im); } catch { /* skip it */ } }
    return out;
  });
  ipcMain.handle('gc:send', (e, d) => (fromList(e) ? send(d) : { error: 'failed' }));
}

module.exports = { registerFeedbackIpc, setRelay: (u) => { relay = String(u).replace(/\/+$/, ''); restUntil = 0; }, shrink, wordsOf, LIMITS, RELAY, WAIT };
