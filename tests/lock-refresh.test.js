// 1.1.13: removing a lock from the notes list updates a note window that is still asking for the password/PIN.
const assert = require('assert'); const path = require('path');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const noteWins = () => E.__all.filter((x) => x.file.endsWith('note.html') && !x.destroyed);
const lastLook = (w) => (w.webContents.sentArgs || []).filter(([ch]) => ch === 'note:look').pop()?.[1];
(async () => {
  await tick(150);
  const H = E.__handlers;
  assert.ok((await H['lock:set'](null, { next: '2580', kind: 'pin' })).ok);

  // ---- a note's own lock
  await H['list:new']();
  const w = noteWins().pop();
  const id = (await H['note:get'](ev(w))).id;
  await H['note:update'](ev(w), { html: '<p>secret plan</p>', text: 'secret plan' });
  assert.ok((await H['list:set-locked'](null, id, true)).ok);
  assert.ok(w.webContents.sent.includes('note:lock-now'), 'the open window is told to hide');
  assert.equal((await H['note:relock'](ev(w))).hidden, true, 'window now shows the PIN screen');
  assert.equal((await H['list:set-locked'](null, id, false, '0000')).error, 'wrong');
  assert.ok((await H['list:set-locked'](null, id, false, '2580')).ok);
  let v = lastLook(w);
  assert.equal(v.hidden, false, 'the window is told the note is no longer hidden');
  assert.equal(v.html, '<p>secret plan</p>', '... and gets its contents to show');
  assert.equal(v.locked, false);
  // the window may save again (its edits are not dropped as from a hidden window)
  await H['note:update'](ev(w), { html: '<p>secret plan 2</p>', text: 'secret plan 2' });
  assert.equal((await H['note:get'](ev(w))).html, '<p>secret plan 2</p>');

  // ---- 1.1.14: unlocked in its window = unlocked in the list, until closed or locked again
  assert.ok((await H['list:set-locked'](null, id, true)).ok);
  const card = async () => (await H['list:get']()).notes.find((n) => n.id === id);
  assert.equal((await card()).locked, true, 'hidden in the list as soon as it is locked');
  await H['note:relock'](ev(w));
  assert.equal((await card()).text, '');
  assert.equal(await H['note:unlock'](ev(w), '1111'), null, 'wrong PIN');
  assert.equal((await card()).text, '', 'still hidden after a wrong PIN');
  assert.ok(await H['note:unlock'](ev(w), '2580'));
  let cd = await card();
  assert.equal(cd.locked, false, 'shown in the list while unlocked in its window');
  assert.equal(cd.text, 'secret plan 2'); assert.equal(cd.ownLock, true); assert.equal(cd.openUnlocked, true);
  await H['note:relock'](ev(w));
  cd = await card();
  assert.equal(cd.locked, true, 'locked again in the window = locked in the list'); assert.equal(cd.text, '');
  await H['note:unlock'](ev(w), '2580');
  w.close();
  await tick(20);
  cd = await card();
  assert.equal(cd.locked, true, 'closing the note locks it in the list again'); assert.equal(cd.openUnlocked, false);

  // ---- a locked group
  await H['list:new'](); const w2 = noteWins().pop(); const a = (await H['note:get'](ev(w2))).id;
  await H['list:new'](); const w3 = noteWins().pop(); const b = (await H['note:get'](ev(w3))).id;
  await H['note:update'](ev(w2), { html: '<p>in group</p>', text: 'in group' });
  await H['groups:make'](null, a, b);
  const G = (await H['list:get']()).notes.find((n) => n.id === a).groupId;
  assert.ok(G);
  assert.ok((await H['groups:set-locked'](null, G, true)).ok);
  await H['note:relock'](ev(w2));
  assert.ok((await H['groups:set-locked'](null, G, false, '2580')).ok);
  v = lastLook(w2);
  assert.equal(v.hidden, false, 'group lock removed: the open note shows again');
  assert.equal(v.html, '<p>in group</p>');

  // ---- still locked by something else: stays hidden
  assert.ok((await H['list:set-locked'](null, a, true)).ok);
  await H['note:relock'](ev(w2));
  assert.ok((await H['groups:set-locked'](null, G, true)).ok);
  assert.ok((await H['list:set-locked'](null, a, false, '2580')).ok);
  v = lastLook(w2);
  assert.equal(v.hidden, true, 'its group is still locked, so the PIN is still needed');
  assert.equal(v.html, '');
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
