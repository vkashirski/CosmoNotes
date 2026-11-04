'use strict';
// 1.3.1: build.bat runs this before building. It puts the built-in voice-to-text model (Standard: Moonshine Base q8,
// about 64 MB) into build/models/, and the installer packs that folder into resources/models/ (package.json →
// extraResources). The files, their fixed Hugging Face commit and their sha256 are the list in main/stt-models.js.
// A file already there with the right hash is kept, so only the first build downloads. Each file is written as .part
// and renamed only once its size and hash are right. test-run.bat / npm start use build/models/ too.
//   node build/fetch-model.js            download what is missing
//   node build/fetch-model.js --verify   hash every file again (a wrong one is downloaded again)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { BUILD_DIR, HF, MODELS, filesOf } = require('../main/stt-models');

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
async function hashOf(p) {
  const h = crypto.createHash('sha256');
  for await (const c of fs.createReadStream(p)) h.update(c);
  return h.digest('hex');
}

async function get(m, x, dest) {
  const url = `${HF}/${m.repo}/resolve/${m.commit}/${x.path.split('/').map(encodeURIComponent).join('/')}`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = dest + '.part';
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${x.path}: ${res.status} ${res.statusText}`);
  const h = crypto.createHash('sha256');
  const out = fs.openSync(part, 'w');
  let got = 0;
  let shown = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      h.update(value);
      fs.writeSync(out, value);
      if (x.size > 8e6 && got - shown > x.size / 10) { shown = got; process.stdout.write(`\r     ${x.path}  ${Math.round((got / x.size) * 100)}%   `); }
    }
  } finally { fs.closeSync(out); }
  if (shown) process.stdout.write('\r');
  const sha = h.digest('hex');
  if (got !== x.size || sha !== x.sha256) { fs.rmSync(part, { force: true }); throw new Error(`${x.path}: not the right file (size ${got}, sha256 ${sha.slice(0, 12)}…)`); }
  fs.renameSync(part, dest);
}

async function main() {
  const verify = process.argv.includes('--verify');
  if (typeof fetch !== 'function') throw new Error('This needs Node.js 18 or newer.');
  for (const m of MODELS.filter((x) => x.builtIn)) {
    const dir = path.join(BUILD_DIR, m.id);
    const files = filesOf(m, m.runs[0]);
    const total = files.reduce((n, x) => n + x.size, 0);
    let fetched = 0;
    for (const x of files) {
      const dest = path.join(dir, ...x.path.split('/'));
      let ok = false;
      try { ok = fs.statSync(dest).size === x.size && (!verify || (await hashOf(dest)) === x.sha256); } catch { ok = false; }
      if (ok) continue;
      if (!fetched) console.log(`   Voice model: ${m.repo} (${mb(total)}, only the first time)`);
      await get(m, x, dest);
      fetched++;
    }
    // every file, checked: a file that was copied in by hand or cut short must not reach the installer
    for (const x of files) {
      const dest = path.join(dir, ...x.path.split('/'));
      if (fetched || verify) { if ((await hashOf(dest)) !== x.sha256) throw new Error(`${x.path}: wrong file. Delete build\\models and run build.bat again.`); }
    }
    console.log(`   Voice model ready: ${m.id}${fetched ? ` (${fetched} file${fetched === 1 ? '' : 's'} downloaded)` : ''}`);
  }
}

main().catch((e) => { console.error(`\n   Could not get the voice model: ${e.message || e}`); process.exitCode = 1; });
