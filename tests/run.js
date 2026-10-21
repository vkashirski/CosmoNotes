'use strict';
// Runs every test in its own process with its own empty data folder.
// Usage: npm test   (no Electron or Windows needed: tests/fake-electron stands in for it)
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tests = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;
for (const t of tests) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmonotes-test-'));
  const appData = path.join(tmp, 'appdata');
  fs.mkdirSync(appData, { recursive: true });
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], {
    env: { ...process.env, FAKE_APPDATA: appData, FAKE_DATA: path.join(appData, 'CosmoNotes') },
    encoding: 'utf8',
    timeout: 60000,
  });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`);
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nAll ${tests.length} passed`);
process.exit(failed ? 1 : 0);
