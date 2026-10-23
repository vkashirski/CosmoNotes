// 1.0.2: groups inside groups, moving, ungrouping, group looks, mass edit, locking groups and notes from the list.
const assert = require('assert'); const path = require('path'); const fs = require('fs');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
(async () => {
  await tick(150);
  const H = E.__handlers;
  for (let i = 0; i < 5; i++) await H['list:new']();
  let list = await H['list:get']();
  const [a, b, c, d, e] = list.notes.map((n) => n.id).filter((id) => list.notes.find((n) => n.id === id && !n.title));
  // a+b -> group G
  await H['groups:make'](null, a, b);
  list = await H['list:get']();
  const G = list.notes.find((n) => n.id === a).groupId;
  assert.ok(G);
  await H['groups:make'](null, c, G);
  // inside G: drag a onto b -> sub-group S inside G
  await H['groups:make'](null, a, b);
  list = await H['list:get']();
  const S = list.notes.find((n) => n.id === a).groupId;
  assert.notEqual(S, G);
  assert.equal(list.groups.find((g) => g.id === S).parentId, G, 'sub-group lives inside G');
  assert.equal(list.notes.find((n) => n.id === c).groupId, G);
  // a group can't go inside its own sub-group
  assert.equal(await H['groups:make'](null, G, S), null);
  // d + e -> group T at top; drag T into G
  await H['groups:make'](null, d, e);
  list = await H['list:get']();
  const T = list.notes.find((n) => n.id === d).groupId;
  await H['groups:make'](null, T, G);
  list = await H['list:get']();
  assert.equal(list.groups.find((g) => g.id === T).parentId, G, 'group dragged into group');
  // move up one level / move to top
  await H['groups:move-up'](null, T);
  list = await H['list:get']();
  assert.equal(list.groups.find((g) => g.id === T).parentId, null);
  await H['groups:move-to'](null, T, S);
  list = await H['list:get']();
  assert.equal(list.groups.find((g) => g.id === T).parentId, S, 'moved straight into S (two levels down)');
  await H['groups:move-to'](null, d, null);
  list = await H['list:get']();
  assert.equal(list.notes.find((n) => n.id === d).groupId, null, 'note moved to the top');
  // look + colour
  await H['groups:update'](null, G, { style: 'folder', color: 'lilac', bogus: 1 });
  await H['groups:update'](null, S, { style: 'nope' });
  list = await H['list:get']();
  const g = list.groups.find((x) => x.id === G);
  assert.equal(g.style, 'folder'); assert.equal(g.color, 'lilac'); assert.equal(g.bogus, undefined);
  assert.equal(list.groups.find((x) => x.id === S).style, 'stack', 'unknown look falls back');
  // mass edit: open window for a gets pushed the new look
  await H['list:open-note'](null, a);
  const wa = E.__all.find((w) => w.noteId === a && !w.destroyed);
  let n = await H['groups:apply'](null, G, { color: 'mint', font: 'round' }, true);
  assert.equal(n, 4, 'a, b, c and e (e is in T inside S inside G)');
  list = await H['list:get']();
  assert.ok(['a', 'b', 'c', 'e'].every((k) => list.notes.find((x) => x.id === { a, b, c, e }[k]).color === 'mint'));
  assert.equal(list.notes.find((x) => x.id === d).color, 'yellow', 'note outside not touched');
  assert.ok(wa.webContents.sent.includes('note:look'));
  assert.equal(wa.bg, '#CDF3E8');
  n = await H['groups:apply'](null, G, { color: 'pink' }, false);
  assert.equal(n, 1, 'only c sits directly in G');
  // lock group: needs a password first
  let r = await H['groups:set-locked'](null, G, true); assert.equal(r.error, 'no-password');
  await H['lock:set'](null, { next: '2468' });
  r = await H['groups:set-locked'](null, G, true); assert.ok(r.ok);
  assert.ok(wa.webContents.sent.includes('note:lock-now'), 'open note inside asked to hide');
  list = await H['list:get']();
  const la = list.notes.find((x) => x.id === a);
  assert.equal(la.locked, true); assert.equal(la.text, ''); assert.equal(la.ownLock, false);
  assert.equal(list.groups.find((x) => x.id === S).open, false, 'sub-group closed too');
  // the window: hidden after relock, can't wipe content, group lock can't be removed from the note
  await H['note:relock'](ev(wa));
  let v = await H['note:get'](ev(wa));
  assert.equal(v.hidden, true); assert.equal(v.lockedBy, 'group');
  await H['note:update'](ev(wa), { html: '', text: '' });
  r = await H['note:unlock'](ev(wa), '2468'); assert.equal(r.hidden, false);
  r = await H['note:set-locked'](ev(wa), false); assert.equal(r.lockedBy, 'group', 'still locked by its group');
  // reveal in the list
  r = await H['groups:reveal'](null, G, 'nope'); assert.equal(r.error, 'wrong');
  r = await H['groups:reveal'](null, G, '2468'); assert.ok(r.ok);
  list = await H['list:get']();
  assert.equal(list.notes.find((x) => x.id === a).locked, false, 'visible in the list once opened');
  // opening a note from an opened locked group doesn't ask again
  await H['list:open-note'](null, c);
  const wc = E.__all.find((w) => w.noteId === c && !w.destroyed);
  v = await H['note:get'](ev(wc)); assert.equal(v.hidden, false);
  await H['groups:hide'](null, G);
  list = await H['list:get']();
  assert.equal(list.notes.find((x) => x.id === b).locked, true);
  // 1.1.14: a, unlocked in its own window, stays shown until that window is closed or locked again
  assert.equal(list.notes.find((x) => x.id === a).locked, false);
  await H['note:relock'](ev(wa));
  list = await H['list:get']();
  assert.equal(list.notes.find((x) => x.id === a).locked, true);
  // remove group lock needs the password
  r = await H['groups:set-locked'](null, G, false, 'bad'); assert.equal(r.error, 'wrong');
  r = await H['groups:set-locked'](null, G, false, '2468'); assert.ok(r.ok);
  // lock a single note from the list
  r = await H['list:set-locked'](null, d, true); assert.ok(r.ok);
  list = await H['list:get']();
  assert.equal(list.notes.find((x) => x.id === d).ownLock, true);
  r = await H['list:set-locked'](null, d, false, 'bad'); assert.equal(r.error, 'wrong');
  r = await H['list:set-locked'](null, d, false, '2468'); assert.ok(r.ok);
  // ungroup S: its notes and group T move up into G
  await H['groups:dissolve'](null, S);
  list = await H['list:get']();
  assert.equal(list.notes.find((x) => x.id === a).groupId, G);
  assert.equal(list.groups.find((x) => x.id === T).parentId, G);
  // trash whole group
  n = await H['groups:trash'](null, T);
  assert.equal(n, 1);
  list = await H['list:get']();
  assert.ok(list.notes.find((x) => x.id === e).deletedAt);
  assert.ok(list.groups.find((x) => x.id === T), 'group kept while its note is in the Bin');
  // 1.0.3: a new note made while a group is open goes into that group
  const before = new Set((await H['list:get']()).notes.map((x) => x.id));
  await H['list:new'](null, T);
  list = await H['list:get']();
  const made = list.notes.find((x) => !before.has(x.id));
  assert.equal(made.groupId, T, 'new note created inside the open group');
  // random colour for new notes (never the dark paper)
  await H['settings:set'](null, { defaultColor: 'random', listSize: 'l' });
  list = await H['list:get']();
  assert.equal(list.settings.defaultColor, 'random'); assert.equal(list.settings.listSize, 'l');
  const colours = new Set();
  for (let i = 0; i < 25; i++) { const b4 = new Set((await H['list:get']()).notes.map((x) => x.id)); await H['list:new'](null, null); const l2 = await H['list:get'](); colours.add(l2.notes.find((x) => !b4.has(x.id)).color); }
  assert.ok(colours.size >= 3, 'random gives different colours');
  assert.ok(!colours.has('charcoal'), 'random never picks the dark paper');
  await H['settings:set'](null, { listSize: 'huge' });
  assert.equal((await H['list:get']()).settings.listSize, 'l', 'unknown size ignored');
  // groups.json on disk has the tree
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.FAKE_DATA, 'groups.json'), 'utf8'));
  assert.equal(saved.groups.find((x) => x.id === T).parentId, G);
  console.log('groups test passed');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
