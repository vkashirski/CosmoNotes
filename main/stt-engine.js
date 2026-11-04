'use strict';
// 1.3.1: voice to text. The engine: one shared, hidden window that runs Transformers.js (src/engine/engine.mjs), made on
// first use and closed after 3 idle minutes. Its page and everything it loads come from cosmomodel://engine/ on its own
// in-memory session: a fixed list of files (the page, src/engine/*.js, src/engine/lib/, the test clip, and the files of
// the installed models), every response with COOP/COEP/CORP (multi-threaded WASM needs them) and the page with a strict
// CSP (the import map's sha256). That session allows no permissions, no navigation, no other window, and blocks every
// request that is not cosmomodel: (so http/https/ws never leave it). The note windows can't reach cosmomodel:// at all.
// Only main talks to it ('engine:msg' both ways, src/engine/preload.js); jobs and their rules are in main/ipc-stt.js.
// From the prototype (tools/stt-prototype/main.js, Step 1).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { BrowserWindow, ipcMain, session } = require('electron');
const { ENGINE_DIR, IMPORT_MAP, LIB_DIR, modelFile } = require('./stt-models');

const IDLE_MS = 3 * 60e3;
const PRELOAD = path.join(ENGINE_DIR, 'preload.js');
// the only library files served (src/engine/lib/; tests/stt.test.js checks the folder holds exactly these)
const COMMON = ['backend-impl', 'backend', 'env-impl', 'env', 'index', 'inference-session-impl', 'inference-session', 'onnx-model',
  'onnx-value', 'tensor-conversion-impl', 'tensor-conversion', 'tensor-factory-impl', 'tensor-factory', 'tensor-impl-type-mapping',
  'tensor-impl', 'tensor-utils-impl', 'tensor-utils', 'tensor', 'trace', 'type-helper', 'version'].map((n) => `onnxruntime-common/${n}.js`);
const LIB_FILES = new Set(['transformers.web.js', 'ort.webgpu.bundle.min.mjs', 'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm', ...COMMON]);

// ------------------------------------------------------------------ cosmomodel://engine/
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.wav': 'audio/wav' };
const mimeOf = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

function page() {
  const map = JSON.stringify(IMPORT_MAP);
  const hash = crypto.createHash('sha256').update(map).digest('base64');
  // no blob: anywhere (the prototype's report-only check never saw it needed); 'wasm-unsafe-eval' runs ONNX Runtime
  const csp = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'sha256-${hash}'; worker-src 'self'; connect-src 'self' data:; ` +
    "media-src 'self' data:; style-src 'none'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'";
  const html = '<!doctype html>\n<html><head><meta charset="utf-8">\n' +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<title>CosmoNotes voice to text</title>\n` +
    `<script type="importmap">${map}</script>\n<script type="module" src="/engine.mjs"></script>\n</head><body></body></html>\n`;
  return { html, csp };
}

// What a cosmomodel:// address may serve: { page } or { file }, or null (404). Unknown names, "..", other hosts: null.
function route(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (u.protocol !== 'cosmomodel:' || u.hostname !== 'engine' || u.search || u.username || u.port) return null;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p === '/' || p === '/index.html') return { page: true };
  if (p === '/engine.mjs' || p === '/engine-core.mjs') return { file: path.join(ENGINE_DIR, p.slice(1)) };
  if (p === '/test-clip.wav') return { file: path.join(ENGINE_DIR, 'test-clip.wav') };
  if (p.startsWith('/lib/')) return LIB_FILES.has(p.slice(5)) ? { file: path.join(LIB_DIR, ...p.slice(5).split('/')) } : null;
  if (p.startsWith('/models/')) {
    const [id, ...rest] = p.slice(8).split('/');
    const file = modelFile(id, rest.join('/'));
    return file ? { file } : null;
  }
  return null;
}

function headers(mime, extra = {}) {
  return { 'content-type': mime, 'cache-control': 'no-store', 'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin', 'x-content-type-options': 'nosniff', ...extra };
}
async function handle(req) {
  const r = req.method === 'GET' ? route(req.url) : null;
  if (r && r.page) { const p = page(); return new Response(p.html, { headers: headers('text/html; charset=utf-8', { 'content-security-policy': p.csp }) }); }
  if (r && r.file) {
    try { return new Response(await fs.promises.readFile(r.file), { headers: headers(mimeOf(r.file)) }); } catch { /* not there */ }
  }
  return new Response('Not found', { status: 404, headers: headers('text/plain') });
}

// ------------------------------------------------------------------ the engine window
let ses = null;
function engineSession() {
  if (ses) return ses;
  ses = session.fromPartition('cosmonotes-stt'); // no "persist:" = in memory, nothing on disk
  ses.protocol.handle('cosmomodel', handle);
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => {
    const ok = /^(cosmomodel|data|blob|devtools):/i.test(String(d.url));
    if (!ok) console.error('voice to text: blocked', d.url);
    cb({ cancel: !ok });
  });
  return ses;
}

let eng = null; // { win, ready, info, model }
let seq = 0;
const pending = new Map(); // reqId -> { resolve, reject, timer }
const listeners = new Set(); // (msg) for 'event' messages (jobs)
const crashes = new Set(); // (err) when the engine goes away
let idleTimer = null;
let busy = () => false; // set by ipc-stt: a job still needs the engine

function failAll(err) {
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(err); }
  pending.clear();
  for (const f of crashes) { try { f(err); } catch (e) { console.error(e); } }
}

function close() {
  clearTimeout(idleTimer);
  const e = eng;
  eng = null;
  if (!e) return;
  clearTimeout(e.readyTimer);
  e.readyReject(new Error('The engine closed')); // nothing happens if it had started
  failAll(new Error('The engine closed'));
  if (!e.win.isDestroyed()) e.win.destroy();
}

function touch() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (eng && !busy()) close(); else touch(); }, IDLE_MS);
}

function open() {
  if (eng) return eng.opened;
  const win = new BrowserWindow({
    show: false, width: 400, height: 300, title: 'CosmoNotes voice to text', skipTaskbar: true,
    webPreferences: { session: engineSession(), preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false,
      spellcheck: false, backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.on('will-redirect', (e) => e.preventDefault());
  wc.on('render-process-gone', (e, d) => { if (eng && eng.win === win) { console.error('voice to text: engine gone', d && d.reason); close(); } });
  win.on('closed', () => { if (eng && eng.win === win) close(); });
  const e = { win, info: null, model: null };
  e.ready = new Promise((resolve, reject) => {
    e.readyResolve = resolve;
    e.readyReject = reject;
    e.readyTimer = setTimeout(() => reject(new Error('The engine did not start')), 60e3);
  });
  eng = e;
  e.opened = e.ready.then(() => call('probe', {}, 30e3)).then((info) => { e.info = info || {}; return e.info; });
  e.opened.catch(() => { if (eng === e) close(); });
  win.loadURL('cosmomodel://engine/index.html');
  touch();
  return e.opened;
}

function call(type, data = {}, timeoutMs = 10 * 60e3) {
  if (!eng || eng.win.isDestroyed()) return Promise.reject(new Error('No engine'));
  const reqId = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(reqId); reject(new Error(`The engine took too long (${type})`)); }, timeoutMs);
    pending.set(reqId, { resolve, reject, timer });
    eng.win.webContents.send('engine:msg', { ...data, type, reqId });
  });
}
function post(type, data = {}) {
  if (eng && !eng.win.isDestroyed()) eng.win.webContents.send('engine:msg', { ...data, type });
}

// load a model (nothing to do when it is the one loaded already)
async function load(m, run) {
  const info = await open();
  const key = `${m.id}/${run.name}`;
  if (eng.model === key) return { info, same: true };
  eng.model = null;
  const r = await call('load', { modelId: m.id, family: m.family, device: run.device, dtype: run.dtype });
  eng.model = key;
  return { info, ...r };
}

function onMessage(e, m) {
  if (!eng || e.sender !== eng.win.webContents || !m || typeof m !== 'object') return;
  if (m.type === 'ready') { clearTimeout(eng.readyTimer); if (eng.readyResolve) eng.readyResolve(); return; }
  if (m.type === 'reply' || m.type === 'fail') {
    const p = pending.get(m.reqId);
    if (!p) return;
    pending.delete(m.reqId);
    clearTimeout(p.timer);
    if (m.type === 'reply') p.resolve(m.data); else p.reject(new Error(String(m.message || 'failed').split('\n')[0]));
    return;
  }
  if (m.type === 'event') { for (const f of listeners) f(m); return; }
  if (m.type === 'log' && m.level === 'error') console.error('voice to text engine:', String(m.text).slice(0, 500));
}

let wired = false;
function wire({ isBusy } = {}) {
  if (isBusy) busy = isBusy;
  if (wired) return;
  wired = true;
  ipcMain.on('engine:msg', onMessage);
}

const current = () => (eng ? eng.model : null);
const isOpen = () => !!eng;
const onEvent = (f) => listeners.add(f);
const onGone = (f) => crashes.add(f);

module.exports = { LIB_FILES, call, close, current, handle, isOpen, load, onEvent, onGone, open, page, post, route, touch, wire };
