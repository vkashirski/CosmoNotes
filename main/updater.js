'use strict';
// 1.4.0: updates from GitHub Releases. What is newest, the installer's download and check, and starting it on quit.
// When it runs (the button, the tray, the daily check) is main/ipc-update.js. Rules (ai-context/architecture.md → "Updates"):
// - Only main goes online, only to https://github.com/vkashirski/CosmoNotes/releases. latest.yml (made by electron-builder,
//   published by .github/workflows/release.yml) names the newest version and its installer, with size and sha512.
// - The installer is written as <file>.part in the temp folder, checked (size + sha512) and only then renamed. A file
//   that doesn't match is deleted and never started.
// - Install = Quit: every window saves on unload, will-quit finishes recordings and flushes the store, and only then
//   (finish) the installer starts, silently (/S), and opens CosmoNotes again (--force-run). The notes are in
//   %APPDATA%\CosmoNotes, which the installer never touches. If Windows won't start the installer, CosmoNotes opens
//   again by itself with --update-failed=<version> and says so.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { app, net } = require('electron');

const REPO = 'https://github.com/vkashirski/CosmoNotes/releases';
let base = REPO; // a test points this at its own server
let dir = path.join(os.tmpdir(), 'CosmoNotes-update'); // and this at its own folder
function setPlace(o = {}) {
  if (o.base) base = String(o.base).replace(/\/+$/, '');
  if (o.dir) dir = o.dir;
}
// Electron's net.fetch uses the PC's proxy settings; plain Node (the tests) has fetch too
const fetcher = () => (process.versions.electron && net && net.fetch ? net.fetch.bind(net) : globalThis.fetch);
const rm = (p) => { try { fs.rmSync(p, { force: true }); } catch { /* ignore */ } };

// ------------------------------------------------------------------ versions and latest.yml
const parts = (v) => String(v).split('.').map(Number);
function newer(a, b) {
  const x = parts(a); const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
const current = () => app.getVersion();

// electron-builder's latest.yml, read without a YAML library: its top-level keys, and the size of the first file
function parseLatest(text) {
  const top = {};
  let size = null;
  for (const line of String(text).split(/\r?\n/)) {
    let m = line.match(/^([A-Za-z]\w*):\s*'?([^']*?)'?\s*$/);
    if (m) { top[m[1]] = m[2]; continue; }
    m = line.match(/^\s+size:\s*(\d+)\s*$/);
    if (m && size === null) size = Number(m[1]);
  }
  const version = top.version || '';
  const file = top.path || '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('latest.yml: no version');
  if (file !== `CosmoNotes-Setup-${version}.exe`) throw new Error(`latest.yml: unexpected file ${file}`);
  if (!/^[A-Za-z0-9+/]{86}==$/.test(top.sha512 || '')) throw new Error('latest.yml: no sha512');
  if (!(size > 1e6 && size < 1e9)) throw new Error('latest.yml: no size');
  return { version, file, size, sha512: top.sha512 };
}

// ------------------------------------------------------------------ state (what Settings and the tray show)
// state: idle | checking | none (this is the newest) | checkfailed | available | downloading | installing |
// failed (failure: 'download' or 'start')
const st = { state: 'idle', latest: null, pct: 0, failure: null };
let info = null; // the newest release: { version, file, size, sha512 }
let ctl = null; // the download's AbortController
let pending = null; // the checked installer, started on quit
const listeners = new Set();
function onChange(fn) { listeners.add(fn); }
function set(patch) {
  Object.assign(st, patch);
  for (const fn of listeners) { try { fn(status()); } catch (e) { console.error(e); } }
}
function status() {
  return {
    state: st.state, current: current(), latest: st.latest, pct: st.pct, failure: st.failure,
    page: st.latest ? `${base}/tag/v${st.latest}` : `${base}/latest`, // the release's page (Open the download page)
  };
}
const busyStates = ['checking', 'downloading', 'installing'];

// quiet (the daily check): a failure says nothing and keeps what was shown
async function check({ quiet = false } = {}) {
  if (busyStates.includes(st.state)) return status();
  const was = { ...st };
  set({ state: 'checking' });
  try {
    const res = await fetcher()(`${base}/latest/download/latest.yml`, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`latest.yml: ${res.status}`);
    info = parseLatest(await res.text());
    const fresh = newer(info.version, current());
    // a download or start that failed for this same version stays failed (its message and the page button)
    if (fresh && was.state === 'failed' && was.latest === info.version) set({ state: 'failed' });
    else set({ state: fresh ? 'available' : 'none', latest: fresh ? info.version : null, failure: null, pct: 0 });
  } catch (e) {
    console.error('update check:', e.message || e);
    set(quiet ? { state: was.state } : { state: 'checkfailed' });
  }
  return status();
}

async function hashOf(p) {
  const h = crypto.createHash('sha512');
  for await (const c of fs.createReadStream(p)) h.update(c);
  return h.digest('base64');
}
async function getFile(url, part, x, signal, onBytes) {
  const res = await fetcher()(url, { signal, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${x.file}: ${res.status}`);
  const h = crypto.createHash('sha512');
  const fd = fs.openSync(part, 'w');
  let got = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (got > x.size) throw new Error(`${x.file}: bigger than expected`);
      h.update(value);
      fs.writeSync(fd, value);
      onBytes(got);
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (got !== x.size || h.digest('base64') !== x.sha512) throw new Error(`${x.file}: not the right file (size or sha512)`);
}

// Download and check the newest installer. Resolves with the status: 'installing' = checked, ready to start on quit.
async function download() {
  if (busyStates.includes(st.state)) return status();
  if (!info || st.latest !== info.version) await check();
  if (!info || !newer(info.version, current())) return status();
  const x = info;
  ctl = new AbortController();
  set({ state: 'downloading', pct: 0, failure: null });
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, x.file);
  const part = dest + '.part';
  try {
    let ok = false;
    try { ok = fs.statSync(dest).size === x.size && (await hashOf(dest)) === x.sha512; } catch { ok = false; }
    if (!ok) {
      rm(dest);
      let shown = 0;
      await getFile(`${base}/download/v${x.version}/${x.file}`, part, x, ctl.signal, (got) => {
        const pct = Math.floor((got / x.size) * 100);
        if (pct !== shown) { shown = pct; set({ pct }); }
      });
      fs.renameSync(part, dest);
    }
    pending = { file: dest, version: x.version };
    set({ state: 'installing', pct: 100 });
  } catch (e) {
    rm(part);
    const cancelled = ctl.signal.aborted;
    if (!cancelled) console.error('update download:', e.message || e);
    set(cancelled ? { state: 'available', pct: 0 } : { state: 'failed', failure: 'download', pct: 0 });
  } finally {
    ctl = null;
  }
  return status();
}
function cancel() { if (ctl) ctl.abort(); return status(); }

// After a start that Windows refused: CosmoNotes opened again with --update-failed=<version>
function startFailed(version) {
  if (/^\d+\.\d+\.\d+$/.test(version || '') && newer(version, current())) set({ state: 'failed', failure: 'start', latest: version });
}

// At start: installers from earlier updates go (one that is still running stays until next time)
function cleanup() {
  let list = [];
  try { list = fs.readdirSync(dir); } catch { return; }
  for (const f of list) if (/^CosmoNotes-Setup-[\d.]+\.exe(\.part)?$/.test(f)) rm(path.join(dir, f));
}

// will-quit, after the store was flushed: start the checked installer, then leave. Returns true if it took over the
// quit (the event's default is stopped until Windows says whether the installer started).
function finish(e) {
  if (!pending) return false;
  const p = pending;
  pending = null;
  if (e && e.preventDefault) e.preventDefault();
  let settled = false;
  const leave = (ok) => {
    if (settled) return;
    settled = true;
    if (!ok) {
      set({ state: 'failed', failure: 'start' });
      app.relaunch({ args: [...process.argv.slice(1).filter((a) => !a.startsWith('--update-failed')), `--update-failed=${p.version}`] });
    }
    app.exit(0);
  };
  try {
    const child = spawn(p.file, ['--updated', '/S', '--force-run'], { detached: true, stdio: 'ignore' });
    child.once('spawn', () => { child.unref(); leave(true); });
    child.once('error', (err) => { console.error('update: the installer did not start', err); leave(false); });
  } catch (err) {
    console.error('update: the installer did not start', err);
    leave(false);
  }
  setTimeout(() => leave(true), 15000).unref(); // Windows never answered: leave anyway (the installer may be running)
  return true;
}

module.exports = { cancel, check, cleanup, download, finish, newer, onChange, parseLatest, setPlace, startFailed, status };
