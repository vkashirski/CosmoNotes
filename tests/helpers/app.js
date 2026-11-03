'use strict';
// The real main process (main.js, main/, store.js) running inside the test's own process, with tests/fake-electron
// standing in for Electron. Requiring this file only installs the fake; nothing starts until app.start(), so a test
// can first put old data in the data folder (or patch something) the way the app would find it.
//
//   const app = require('./helpers/app');
//   const { H, L, E, ev } = await app.start();          // H = ipcMain.handle handlers, L = ipcMain.on listeners
//   const id = await app.newNote({ html: '<p>hi</p>' });  // a note made through the list, with its window open
//   assert.equal((await app.card(id)).text, 'hi');
//
// Made faster on purpose (the app's code is not changed, only what it gets from Node):
// - scrypt (the PIN / password hash) runs with N = 1024 instead of 2^17. What the app saves still says 2^17.
// - the pause after a wrong PIN (450 ms against guessing) is skipped; app.waited lists each pause the app asked for.
// - timers of 100 ms and more fire 10 times sooner (debounced saves, the "closed with Alt+F4" check, the list's
//   120 ms "something changed"). Pass { realTime: true } to app.start() to keep real time.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const FAKE = path.join(__dirname, '..', 'fake-electron', 'index.js');

// ---- the fake Electron, for every require('electron') from here on
const resolve0 = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { return req === 'electron' ? FAKE : resolve0.call(this, req, ...a); };
const E = require(FAKE);
global.Response = class { constructor(body, o) { this.body = body; this.status = (o && o.status) || 200; this.headers = o && o.headers; } };

// ---- cheaper PIN hashing (see above)
const FAST_N = 1024;
const scrypt0 = crypto.scrypt; const scryptSync0 = crypto.scryptSync;
const cheap = (o) => (o && o.N > FAST_N ? { ...o, N: FAST_N } : o);
crypto.scrypt = (pw, salt, len, o, cb) => (typeof o === 'function' ? scrypt0(pw, salt, len, o) : scrypt0(pw, salt, len, cheap(o), cb));
crypto.scryptSync = (pw, salt, len, o) => scryptSync0(pw, salt, len, cheap(o));

const waited = [];

const DATA = () => process.env.FAKE_DATA;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const app = {
  E, ROOT, waited, tick,
  H: null, L: null,
  get DATA() { return DATA(); },
  get APPDATA() { return process.env.FAKE_APPDATA; },

  // start main.js (once per process) and wait until it has opened its windows
  async start({ realTime = false } = {}) {
    if (!realTime) {
      const st = global.setTimeout; const si = global.setInterval;
      const fast = (ms) => (ms >= 100 ? ms / 10 : ms);
      global.setTimeout = (fn, ms, ...a) => st(fn, fast(ms), ...a);
      global.setInterval = (fn, ms, ...a) => si(fn, fast(ms), ...a);
    }
    // no pause after a wrong PIN: main/locks.js is loaded first, so every ipc-* file picks up this wait. (Loaded here,
    // not above, so a test can still patch crypto before main/crypt.js takes its copy of scrypt.)
    require(path.join(ROOT, 'main', 'locks.js')).wait = (ms) => { waited.push(ms); return new Promise((r) => setImmediate(r)); };
    require(path.join(ROOT, 'main.js'));
    app.H = E.__handlers; app.L = E.__listeners;
    for (let i = 0; i < 100 && !app.H['list:get']; i++) await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r)); // the windows' ready-to-show
    await tick(5);
    return app;
  },

  // the event main's handlers get from a window
  ev: (w) => ({ sender: w.webContents, returnValue: undefined }),
  noteWins: () => E.__all.filter((w) => w.file && w.file.endsWith('note.html') && !w.destroyed),
  listWin: () => E.__all.find((w) => w.file && w.file.endsWith('list.html') && !w.destroyed),
  winOf: (id) => E.__all.find((w) => w.noteId === id && !w.destroyed),
  // what main tells the list
  list: () => app.H['list:get'](),
  card: async (id) => (await app.H['list:get']()).notes.find((n) => n.id === id),
  group: async (id) => (await app.H['list:get']()).groups.find((g) => g.id === id),
  // a new note made like the list's + button: { html, text, title, group, close }  →  its id (its window stays open)
  async newNote(o = {}) {
    const before = new Set((await app.list()).notes.map((n) => n.id));
    await app.H['list:new']({}, o.group || null);
    const id = (await app.list()).notes.map((n) => n.id).find((x) => !before.has(x));
    const patch = {};
    if (o.html !== undefined) { patch.html = o.html; patch.text = o.text ?? o.html.replace(/<[^>]+>/g, ''); }
    if (o.title !== undefined) patch.title = o.title;
    if (Object.keys(patch).length) await app.H['note:update'](app.ev(app.winOf(id)), patch);
    if (o.close) await app.H['list:close-note']({}, id);
    return id;
  },
  // messages main sent to a window: sent(w, 'note:look') → the argument of each one, oldest first
  sent: (w, ch) => (w.webContents.sentArgs || []).filter((x) => x[0] === ch).map((x) => x[1]),
  lastLook: (w) => app.sent(w, 'note:look').pop(),
  // files in the data folder
  read: (f) => fs.readFileSync(path.join(DATA(), f), 'utf8'),
  readJSON: (f) => JSON.parse(fs.readFileSync(path.join(DATA(), f), 'utf8')),
  // quit like the app does, then end the test
  async quit(code = 0) {
    E.app.quit(); E.__all.forEach((w) => w.close());
    await tick(20);
    process.exit(code);
  },

  // A test in parts, each in its own process, like quitting and starting the app again. The test file runs itself:
  //   if (app.phase === 'main') app.phases(__filename, ['first', 'second', { name: 'old', fresh: true }]);
  // A part with fresh: true gets its own empty data folder; the others share the test's one. Exit code 77 in a part
  // means "can't run here" (no Playwright): it is skipped.
  phase: process.argv[2] || 'main',
  phases(file, list) {
    let ran = 0;
    for (const p of list) {
      const { name, fresh } = typeof p === 'string' ? { name: p } : p;
      const env = { ...process.env };
      if (fresh) {
        env.FAKE_APPDATA = path.join(process.env.FAKE_APPDATA, '..', 'fresh-' + name);
        env.FAKE_DATA = path.join(env.FAKE_APPDATA, 'CosmoNotes');
        fs.mkdirSync(env.FAKE_APPDATA, { recursive: true });
      }
      const r = spawnSync(process.execPath, [file, name], { env, encoding: 'utf8', timeout: 100000 });
      if (r.status === 77) { console.log(`(${name}: skipped, ${(r.stdout || '').trim()})`); continue; }
      if (r.status !== 0) { console.log(`---- part "${name}" failed\n${r.stdout || ''}${r.stderr || ''}${r.error || ''}`); process.exit(1); }
      ran++;
    }
    process.exit(ran ? 0 : 77); // every part skipped: the whole test is
  },
  // something one part hands to the next (kept next to the data folder)
  hand(o) {
    const f = path.join(process.env.FAKE_APPDATA, '..', 'handover.json');
    if (o === undefined) return JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(f, JSON.stringify({ ...(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}), ...o }));
    return o;
  },
};

// a test run on its own (node tests/x.test.js, not through run.js) gets a fresh data folder
if (!process.env.FAKE_APPDATA) {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cosmo-test-'));
  process.env.FAKE_APPDATA = path.join(tmp, 'appdata'); process.env.FAKE_DATA = path.join(tmp, 'appdata', 'CosmoNotes');
  fs.mkdirSync(process.env.FAKE_APPDATA, { recursive: true });
}

// an error anywhere fails the test with its message
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });

module.exports = app;
