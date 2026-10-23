// Upgrade from Sticky Pins, titles, locking, spelling settings, groups, sorting, backups.
const assert = require('assert'); const fs=require('fs'); const path=require('path');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b,o){ this.status=o?.status } };
// make an old "Sticky Pins" data folder like the user's
const APPDATA = process.env.FAKE_APPDATA; const OLD = path.join(APPDATA, 'Sticky Pins');
fs.mkdirSync(path.join(OLD, 'notes'), { recursive: true }); fs.mkdirSync(path.join(OLD, 'attachments'), { recursive: true });
fs.writeFileSync(path.join(OLD, 'notes', 'old1.json'), JSON.stringify({ id: 'old1', html: '<b>my old note</b> <img src="stickyfile://att/abc-1.png">', text: 'my old note', open: true, createdAt: 1700000000000, updatedAt: 1700000500000, bounds: { x: 40, y: 50, width: 280, height: 260 } }));
fs.writeFileSync(path.join(OLD, 'notes', 'old2.json'), JSON.stringify({ id: 'old2', html: 'second', text: 'second', open: false, createdAt: 1700000000000, updatedAt: 1700000000000 }));
fs.writeFileSync(path.join(OLD, 'attachments', 'abc-1.png'), 'PNG');
fs.writeFileSync(path.join(OLD, 'settings.json'), JSON.stringify({ firstRunDone: true, startWithWindows: true, defaultColor: 'pink' }));
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms=50) => new Promise(r=>setTimeout(r,ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
(async () => {
  await tick(150);
  const H = E.__handlers, L = E.__listeners;
  const DATA = process.env.FAKE_DATA;
  assert.ok(fs.existsSync(path.join(DATA, 'notes', 'old1.json')), 'old notes copied');
  assert.ok(fs.existsSync(path.join(DATA, 'attachments', 'abc-1.png')), 'old photos copied');
  assert.ok(fs.existsSync(path.join(OLD, 'notes', 'old1.json')), 'old folder left untouched');
  assert.deepEqual(E.__langs, ['en-US'], 'Cyrillic ignored by default');
  let wins = E.__all.filter(w => w.file.endsWith('note.html'));
  assert.equal(wins.length, 1, 'previously open note reopens (no welcome note for existing users)');
  const w = wins[0];
  assert.deepEqual([w.bounds.x, w.bounds.y], [40, 50]);
  let n = await H['note:get'](ev(w));
  assert.equal(n.settings.spellCheck, false); assert.equal(n.settings.hasPassword, false);
  assert.equal(n.createdAt, 1700000000000);
  // title -> window title + counts as an edit
  n = await H['note:update'](ev(w), { title: 'Shopping\nlist' });
  assert.equal(n.title, 'Shopping list'); assert.equal(w.title, 'Shopping list');
  assert.ok(n.updatedAt > 1700000500000, 'title change updates last edited');
  assert.equal(n.createdAt, 1700000000000, 'created date never changes');
  // lock without password -> refused
  let r = await H['note:set-locked'](ev(w), true); assert.equal(r.error, 'no-password');
  r = await H['lock:set'](null, { next: '12' }); assert.ok(r.error);
  r = await H['lock:set'](null, { next: '1234' }); assert.ok(r.ok);
  assert.ok(w.webContents.sent.includes('settings:changed'));
  r = await H['note:set-locked'](ev(w), true);
  assert.equal(r.hidden, true); assert.equal(r.html, ''); assert.equal(r.text, '');
  // hidden window can't wipe contents
  await H['note:update'](ev(w), { html: '', text: '' });
  L['note:update-sync'](ev(w), { html: '', text: '' });
  r = await H['note:unlock'](ev(w), 'nope'); assert.equal(r, null);
  r = await H['note:unlock'](ev(w), '1234'); assert.equal(r.hidden, false); assert.ok(r.html.includes('my old note'), 'contents survive locking');
  // 1.1.14: unlocked in its own window = shown in the list too, until it's locked again or closed
  let list = await H['list:get']();
  assert.equal(list.notes.find(x => x.id === 'old1').locked, false, 'unlocked in its window: shown in the list');
  await H['note:relock'](ev(w));
  list = await H['list:get']();
  const lk = list.notes.find(x => x.id === 'old1');
  assert.equal(lk.locked, true); assert.equal(lk.text, ''); assert.equal(lk.firstImage, null, 'list never sees locked content');
  r = await H['note:unlock'](ev(w), '1234'); assert.equal(r.hidden, false);
  assert.equal(list.settings.lock, undefined); assert.equal(list.settings.hasPassword, true);
  // change password needs the current one
  r = await H['lock:set'](null, { current: 'bad', next: '5678' }); assert.ok(r.error);
  r = await H['lock:set'](null, { current: '1234', next: '5678' }); assert.ok(r.ok);
  await H['note:relock'](ev(w));
  r = await H['note:unlock'](ev(w), '5678'); assert.equal(r.hidden, false);
  r = await H['note:set-locked'](ev(w), false); assert.equal(r.locked, false);
  // spelling settings
  await H['settings:set'](null, { spellCheck: true, spellCyrillic: true });
  assert.deepEqual(E.__langs, ['en-US', 'sr', 'bg', 'ru', 'uk']);
  // groups
  await H['list:new'](); await H['list:new']();
  list = await H['list:get']();
  const [a, b, c] = list.notes.map(x => x.id).filter(id => id !== 'old2' && id !== 'old1').concat('old2');
  const gid = await H['groups:make'](null, a, 'old2');
  assert.ok(gid);
  await H['groups:make'](null, b, gid);
  list = await H['list:get']();
  assert.equal(list.groups.length, 1);
  assert.equal(list.notes.filter(x => x.groupId === gid).length, 3);
  await H['groups:rename'](null, gid, 'Work');
  // drop onto a note that is already in a group -> joins that group
  await H['groups:make'](null, 'old1', a);
  list = await H['list:get']();
  assert.equal(list.notes.filter(x => x.groupId === gid).length, 4);
  await H['groups:ungroup'](null, 'old1');
  await H['groups:ungroup'](null, a);
  await H['groups:ungroup'](null, b);
  list = await H['list:get']();
  assert.equal(list.groups.length, 1, 'group with one note stays');
  await H['groups:dissolve'](null, gid);
  list = await H['list:get']();
  assert.equal(list.groups.length, 0, 'dissolved');
  const g2 = await H['groups:make'](null, a, b);
  await H['list:trash'](null, a); await H['list:trash'](null, b);
  list = await H['list:get']();
  assert.equal(list.groups.length, 1, 'group kept while its notes are in the bin');
  await H['list:restore'](null, a);
  list = await H['list:get']();
  assert.equal(list.notes.find(x => x.id === a).groupId, g2, 'restored note goes back into its group');
  await H['list:destroy'](null, a); await H['list:destroy'](null, b);
  list = await H['list:get']();
  assert.equal(list.groups.length, 0, 'group removed once its notes are gone');
  await H['settings:set'](null, { listSort: { by: 'created', dir: 'asc', groups: 'first', junk: 1 } });
  list = await H['list:get']();
  assert.deepEqual(list.settings.listSort, { by: 'created', dir: 'asc', groups: 'first' });
  // backup includes groups.json and restore ignores it
  await H['groups:make'](null, c, 'old1');
  await H['backups:now']();
  const bdir = fs.readdirSync(path.join(DATA, 'backups')).map(d => path.join(DATA, 'backups', d)).find(d => fs.existsSync(path.join(d, 'groups.json')));
  assert.ok(bdir, 'groups in backup');
  console.log('main smoke test 2 passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
