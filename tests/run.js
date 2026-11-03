'use strict';
// Runs the tests: every tests/*.test.js in its own process with its own empty data folder, several at a time.
//   npm test                    all of them; prints only failures and a one-line summary
//   npm test -- locks groups    only the files whose name contains "locks" or "groups"
//   npm test -- -v              also one line per file, with its time
// No Electron or Windows needed: tests/fake-electron stands in for it. The browser tests (list-ui-*, note-ui) need
// Playwright (the cloud workspace has it); without it they exit with 77 and show as skipped.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const only = args.filter((a) => !a.startsWith('-'));
let tests = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
if (only.length) tests = tests.filter((t) => only.some((o) => t.includes(o)));
if (!tests.length) { console.log(`No test file matches: ${only.join(' ')}`); process.exit(1); }
// the slow ones (a browser, or several app starts) go first, so the quick ones fill in around them
const slow = (t) => /^(list-ui|note-ui|crypt)/.test(t);
const queue = [...tests.filter(slow), ...tests.filter((t) => !slow(t))];
const JOBS = Math.max(2, Math.min(6, (os.availableParallelism ? os.availableParallelism() : os.cpus().length)));

const t0 = Date.now();
const results = [];
function runOne(t) {
  return new Promise((done) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmonotes-test-'));
    const appData = path.join(tmp, 'appdata');
    fs.mkdirSync(appData, { recursive: true });
    const start = Date.now();
    let out = '';
    const p = spawn(process.execPath, [path.join(__dirname, t)], { env: { ...process.env, FAKE_APPDATA: appData, FAKE_DATA: path.join(appData, 'CosmoNotes') } });
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { out += '\n(stopped: took longer than 120 s)'; p.kill(); }, 120000);
    p.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(tmp, { recursive: true, force: true });
      const r = { t, code, out, s: (Date.now() - start) / 1000 };
      results.push(r);
      if (code === 77) { if (verbose) console.log(`SKIP  ${t}  (${out.trim().replace(/^SKIP: /, '')})`); }
      else if (code !== 0) console.log(`FAIL  ${t}  (${r.s.toFixed(1)} s)\n${out.trim()}\n`);
      else if (verbose) console.log(`PASS  ${t}  ${r.s.toFixed(1)} s`);
      done();
    });
  });
}
(async () => {
  const workers = Array.from({ length: Math.min(JOBS, queue.length) }, async () => { while (queue.length) await runOne(queue.shift()); });
  await Promise.all(workers);
  const failed = results.filter((r) => r.code !== 0 && r.code !== 77);
  const skipped = results.filter((r) => r.code === 77);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (failed.length) console.log(`${failed.length} of ${results.length} test files failed: ${failed.map((r) => r.t).join(', ')} (${secs} s)`);
  else console.log(`All ${results.length - skipped.length} test file${results.length - skipped.length === 1 ? '' : 's'} passed in ${secs} s${skipped.length ? ` (${skipped.length} skipped: no Playwright here)` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
