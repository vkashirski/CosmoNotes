'use strict';
// Updates (1.4.0, main/updater.js + main/ipc-update.js) against a local server playing GitHub Releases: latest.yml and its
// rules, newer / not newer, the check at start (installed app, the switch), a quiet check that fails says nothing, the tray's
// line, Install: not from npm start, not during a recording, the download checked by size + sha512 (a wrong file is
// deleted and never started), Cancel, Install = Quit (the notes are on disk before the installer starts, silently, and it
// opens CosmoNotes again), Windows refusing the installer (CosmoNotes opens again and says so), Try again re-uses the
// checked file, the page to download it by hand, and old installers cleaned up at start.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const EventEmitter = require('events');
const cp = require('child_process');
const app = require('./helpers/app');

// ---- the installer start, played: what was started, and whether Windows lets it ('spawn') or not ('error')
const started = [];
let spawnAnswer = 'spawn';
cp.spawn = (file, args, opts) => {
  const c = new EventEmitter();
  c.unref = () => { c.unrefd = true; };
  started.push({ file, args, opts, bytes: fs.readFileSync(file), notes: fs.readdirSync(path.join(app.DATA, 'notes')).map((f) => app.read(`notes/${f}`)).join('\n') });
  setImmediate(() => (spawnAnswer === 'spawn' ? c.emit('spawn') : c.emit('error', Object.assign(new Error('spawn UNKNOWN'), { code: 'UNKNOWN' }))));
  return c;
};

// ---- GitHub Releases, played
const NEXT = '1.0.1'; // the fake Electron says this app is 1.0.0
const FILE = `CosmoNotes-Setup-${NEXT}.exe`;
const exe = crypto.randomBytes(2 * 1048576);
const sha = (b) => crypto.createHash('sha512').update(b).digest('base64');
const yml = (o = {}) => [`version: ${o.version || NEXT}`, 'files:', `  - url: ${o.file || FILE}`, `    sha512: ${o.sha512 || sha(exe)}`,
  `    size: ${o.size || exe.length}`, `path: ${o.file || FILE}`, `sha512: ${o.sha512 || sha(exe)}`, "releaseDate: '2026-11-14T10:00:00.000Z'", ''].join('\n');
let latest = yml();
let body = exe; // what the installer's address sends
let slow = false;
const hits = [];
const server = http.createServer((req, res) => {
  hits.push(req.url);
  if (req.url === '/latest/download/latest.yml') { res.writeHead(302, { location: '/assets/latest.yml' }); return res.end(); } // GitHub redirects too
  if (req.url === '/assets/latest.yml') {
    if (latest === 500) { res.writeHead(500); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/yaml' }); return res.end(latest);
  }
  if (req.url === `/download/v${NEXT}/${FILE}`) {
    res.writeHead(200, { 'content-length': body.length });
    if (!slow) return res.end(body);
    res.write(body.subarray(0, 65536)); // then nothing more: Cancel has to stop it
    return undefined;
  }
  res.writeHead(404); return res.end();
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const DIR = path.join(app.APPDATA, '..', 'update-temp');
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'CosmoNotes-Setup-0.9.9.exe'), 'old'); // from an earlier update
  fs.writeFileSync(path.join(DIR, 'keep-me.txt'), 'not ours');
  const U = require('../main/updater');
  U.setPlace({ base: BASE, dir: DIR });

  // ---- latest.yml's rules and what is newer
  assert.deepEqual(U.parseLatest(latest), { version: NEXT, file: FILE, size: exe.length, sha512: sha(exe) });
  assert.throws(() => U.parseLatest(yml({ file: 'CosmoNotes Setup 1.0.1.exe' })), /unexpected file/, 'only CosmoNotes-Setup-<version>.exe');
  assert.throws(() => U.parseLatest(yml({ file: '..\\evil.exe' })), /unexpected file/);
  assert.throws(() => U.parseLatest(yml({ sha512: 'abc' })), /sha512/);
  assert.throws(() => U.parseLatest(yml({ size: 12 })), /size/);
  assert.throws(() => U.parseLatest('<html>Not Found</html>'), /version/);
  assert.ok(U.newer('1.4.0', '1.3.38') && U.newer('1.10.0', '1.9.9') && U.newer('2.0.0', '1.99.99'));
  assert.ok(!U.newer('1.3.38', '1.4.0') && !U.newer('1.4.0', '1.4.0'));

  // ---- the installed app checks by itself at start (a little after the notes open), once
  app.E.app.isPackaged = true;
  let exited = null; let relaunched = null;
  app.E.app.exit = (c) => { exited = c; };
  app.E.app.relaunch = (o) => { relaunched = o; };
  const { H, E } = await app.start();
  const { S } = require('../main/state');
  assert.ok(!fs.existsSync(path.join(DIR, 'CosmoNotes-Setup-0.9.9.exe')), 'an old installer is cleaned up at start');
  assert.ok(fs.existsSync(path.join(DIR, 'keep-me.txt')), 'only our installers');
  assert.equal(S.store.settings.updateCheck, true, 'the switch is on by default');
  assert.equal((await app.list()).settings.updateCheck, true, 'the list sees it');
  const trayLabels = () => E.__tray.menu.t.map((m) => m.label).filter(Boolean);
  assert.ok(!trayLabels().some((l) => /Update/.test(l)), 'nothing in the tray before a newer version is known');
  assert.equal((await H['update:status']()).state, 'idle');
  assert.equal(hits.length, 0, 'not online straight away');
  for (let i = 0; i < 100 && (await H['update:status']()).state !== 'available'; i++) await app.tick(50);
  let st = await H['update:status']();
  assert.equal(st.state, 'available', 'the check at start found the newer version');
  assert.deepEqual([st.current, st.latest], ['1.0.0', NEXT]);
  assert.equal(st.page, `${BASE}/tag/v${NEXT}`, "the release's page");
  assert.deepEqual(hits, ['/latest/download/latest.yml', '/assets/latest.yml'], 'it only fetched latest.yml (through the redirect)');
  assert.ok(trayLabels().includes(`Update to ${NEXT}…`), 'the tray says so');
  await app.tick(30);
  assert.equal(hits.length, 2, 'once, not again and again');

  // ---- the tray's line opens the list at Settings → About
  const item = E.__tray.menu.t.find((m) => m.label === `Update to ${NEXT}…`);
  item.click();
  await app.tick(5);
  const lw = app.listWin();
  assert.ok(lw, 'the list opened');
  assert.ok((lw.webContents.sentArgs || []).some((x) => x[0] === 'update:show'), 'the list is told to show the update');

  // ---- a quiet check that fails says nothing (what was shown stays); the button's check says it failed
  latest = 500;
  st = await U.check({ quiet: true });
  assert.equal(st.state, 'available', 'quiet: nothing changes');
  st = await H['update:check']();
  assert.equal(st.state, 'checkfailed', 'the button: "Couldn’t check"');
  latest = yml({ version: '1.0.0', file: 'CosmoNotes-Setup-1.0.0.exe' });
  st = await H['update:check']();
  assert.deepEqual([st.state, st.latest], ['none', null], 'the same version: you have the newest');
  assert.ok(!trayLabels().some((l) => /Update/.test(l)), 'the tray line goes');
  latest = yml();
  assert.equal((await H['update:check']()).state, 'available');
  assert.ok((lw.webContents.sentArgs || []).some((x) => x[0] === 'update:changed' && x[1].state === 'available'), 'the list hears every change');

  // ---- the switch: off, the daily check doesn't run (the button still does)
  await H['settings:set']({}, { updateCheck: false });
  assert.equal(S.store.settings.updateCheck, false);
  assert.equal(app.readJSON('settings.json').updateCheck, false, 'saved');
  await H['settings:set']({}, { updateCheck: true });

  // ---- Install: not from npm start; not while a voice recording runs
  E.app.isPackaged = false;
  assert.equal((await H['update:install']()).error, 'notinstalled');
  E.app.isPackaged = true;
  const id = await app.newNote({ html: '<div>before the update</div>' });
  const w = app.winOf(id);
  const r = await H['rec:start'](app.ev(w));
  assert.equal((await H['update:install']()).error, 'busy', 'not during a recording');
  await H['rec:end'](app.ev(w), r.id, 'discard');
  assert.equal((await H['update:status']()).state, 'available', 'nothing was downloaded');

  // ---- a wrong file: deleted, never started; the page to get it by hand
  body = Buffer.from(exe); body[1000] ^= 1;
  st = await H['update:install']();
  assert.deepEqual([st.state, st.failure], ['failed', 'download'], '"Couldn’t download the update."');
  assert.deepEqual(fs.readdirSync(DIR).filter((f) => f.startsWith('CosmoNotes')), [], 'no installer and no .part left');
  assert.equal(started.length, 0, 'nothing started');
  assert.ok(trayLabels().includes(`Update to ${NEXT}…`), 'the tray still offers it');
  await H['update:open-page']();
  assert.equal(E.__opened, `${BASE}/tag/v${NEXT}`, 'Open the download page');
  assert.equal((await U.check({ quiet: true })).state, 'failed', 'the daily check keeps the failure showing');

  // ---- Cancel
  body = exe; slow = true;
  const going = H['update:install']();
  for (let i = 0; i < 100 && (await H['update:status']()).state !== 'downloading'; i++) await app.tick(10);
  assert.ok(trayLabels().includes('Downloading the update…'), 'the tray while it downloads');
  await app.tick(30);
  await H['update:cancel']();
  st = await going;
  assert.equal(st.state, 'available', 'cancelled: ready to try again');
  assert.deepEqual(fs.readdirSync(DIR).filter((f) => f.startsWith('CosmoNotes')), [], 'no .part left');
  slow = false;

  // ---- Install = Quit. Windows refuses the installer: CosmoNotes opens again by itself and says so
  await H['note:update'](app.ev(w), { html: '<div>typed just now</div>', text: 'typed just now' }); // still waiting to be written
  spawnAnswer = 'error';
  st = await H['update:install']();
  assert.equal(st.state, 'installing');
  for (let i = 0; i < 100 && exited === null; i++) await app.tick(10);
  assert.equal(S.quitting, true, 'it quit like Quit does');
  assert.equal(started.length, 1);
  assert.ok(started[0].notes.includes('typed just now'), 'every note was on disk before the installer started');
  assert.equal(sha(started[0].bytes), sha(exe), 'the checked file');
  assert.equal(path.basename(started[0].file), FILE);
  assert.deepEqual(started[0].args, ['--updated', '/S', '--force-run'], 'silent, and it opens CosmoNotes again');
  assert.equal(started[0].opts.detached, true, 'it outlives CosmoNotes');
  assert.ok(relaunched && relaunched.args.includes(`--update-failed=${NEXT}`), 'refused: CosmoNotes opens again');
  assert.equal(exited, 0);

  // ... and the next start says so, at Settings → About
  U.startFailed(NEXT);
  st = await H['update:status']();
  assert.deepEqual([st.state, st.failure, st.latest], ['failed', 'start', NEXT], '"Couldn’t start the update."');
  U.startFailed('0.9.0');
  assert.equal((await H['update:status']()).failure, 'start', 'an older version in the flag changes nothing');

  // ---- Try again: the checked file is used again (no new download), Windows starts it, CosmoNotes leaves
  const before = hits.length;
  spawnAnswer = 'spawn'; exited = null; relaunched = null;
  st = await H['update:install']();
  assert.equal(st.state, 'installing');
  for (let i = 0; i < 100 && exited === null; i++) await app.tick(10);
  assert.ok(!hits.slice(before).some((u) => u.endsWith('.exe')), 'the file already there was checked, not downloaded again');
  assert.equal(started.length, 2);
  assert.equal(relaunched, null, 'started: the installer opens CosmoNotes, not us');
  assert.equal(exited, 0);

  server.close();
  console.log('ok');
  process.exit(0);
})();
