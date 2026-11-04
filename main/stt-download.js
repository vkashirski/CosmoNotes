'use strict';
// 1.3.1: voice to text. Downloading the Best model (Settings → Voice to text → Download), the only time CosmoNotes
// itself goes on the internet (and only main, never a window). Each file comes from Hugging Face at the fixed commit of
// main/stt-models.js and is written as <file>.part, checked (size + sha256) and only then renamed. ready.json, written
// last, says the model is complete and which set it is (gpu / cpu). Cancel or a failure leaves no .part behind; a file
// already there with the right hash is kept (Try again goes on from there). The folder is <data>/models/<id>/: not in
// backups, left by the uninstaller. Remove deletes the folder.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { net } = require('electron');
const { HF, dirOf, filesOf } = require('./stt-models');

let endpoint = HF; // a test points this at its own server
function setEndpoint(u) { endpoint = String(u).replace(/\/+$/, ''); }
// Electron's net.fetch uses the PC's proxy settings; plain Node (the tests) has fetch too
const fetcher = () => (process.versions.electron && net && net.fetch ? net.fetch.bind(net) : globalThis.fetch);

const rm = (p) => { try { fs.rmSync(p, { force: true }); } catch { /* ignore */ } };

async function hashOf(p) {
  const h = crypto.createHash('sha256');
  for await (const c of fs.createReadStream(p)) h.update(c);
  return h.digest('hex');
}

// one file: .part, hash while it comes in, rename
async function getFile(m, x, dest, signal, onBytes) {
  const url = `${endpoint}/${m.repo}/resolve/${m.commit}/${x.path.split('/').map(encodeURIComponent).join('/')}`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = dest + '.part';
  const res = await fetcher()(url, { signal, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${x.path}: ${res.status}`);
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(part, 'w');
  let got = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (got > x.size) throw new Error(`${x.path}: bigger than expected`);
      h.update(value);
      fs.writeSync(fd, value);
      onBytes(value.length);
    }
    fs.fsyncSync(fd);
  } catch (e) {
    try { fs.closeSync(fd); } catch { /* ignore */ }
    rm(part);
    throw e;
  }
  fs.closeSync(fd);
  const sha = h.digest('hex');
  if (got !== x.size || sha !== x.sha256) { rm(part); throw new Error(`${x.path}: the file is not the right one (size or hash)`); }
  fs.renameSync(part, dest);
}

// Downloads a model's set (run). onProgress(doneBytes, totalBytes). Resolves when ready.json is written.
async function download(m, run, { signal, onProgress = () => {} } = {}) {
  const dir = dirOf(m);
  rm(path.join(dir, 'ready.json')); // not ready until every file is there again
  const files = filesOf(m, run);
  const total = files.reduce((n, x) => n + x.size, 0);
  let done = 0;
  for (const x of files) {
    if (signal && signal.aborted) throw new Error('Cancelled');
    const dest = path.join(dir, ...x.path.split('/'));
    let ok = false;
    try { ok = fs.statSync(dest).size === x.size && (await hashOf(dest)) === x.sha256; } catch { ok = false; }
    if (!ok) {
      rm(dest);
      await getFile(m, x, dest, signal, (n) => { done += n; onProgress(done, total); });
    } else {
      done += x.size;
      onProgress(done, total);
    }
  }
  // files of the other set (a model downloaded before for the processor, now for the graphics card) go
  const keep = new Set(files.map((x) => path.join(dir, ...x.path.split('/'))));
  for (const r of m.runs) for (const x of r.files) { const p = path.join(dir, ...x.path.split('/')); if (!keep.has(p)) rm(p); }
  const tmp = path.join(dir, 'ready.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify({ run: run.name, at: Date.now() }));
  fs.renameSync(tmp, path.join(dir, 'ready.json'));
}

function remove(m) {
  if (m.builtIn) return false;
  fs.rmSync(dirOf(m), { recursive: true, force: true });
  return true;
}

// at start: a download the app was quit (or crashed) in the middle of leaves .part files: they go
function cleanParts(root) {
  const walk = (d, depth) => {
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && depth < 3) walk(p, depth + 1);
      else if (e.isFile() && (e.name.endsWith('.part') || e.name.endsWith('.tmp'))) rm(p);
    }
  };
  walk(root, 0);
}

module.exports = { cleanParts, download, remove, setEndpoint };
