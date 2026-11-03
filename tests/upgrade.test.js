'use strict';
// Upgrading from Sticky Pins (1.0.0): the old data folder is copied (notes, photos, settings) and left as it was; the
// notes that were open reopen where they were (no welcome note for existing users), their dates are kept, the old
// settings still mean the same, and a migrated note is a normal note (it can be edited and locked).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

// an old "Sticky Pins" data folder like the owner's, before the app starts
const OLD = path.join(app.APPDATA, 'Sticky Pins');
fs.mkdirSync(path.join(OLD, 'notes'), { recursive: true }); fs.mkdirSync(path.join(OLD, 'attachments'), { recursive: true });
fs.writeFileSync(path.join(OLD, 'notes', 'old1.json'), JSON.stringify({ id: 'old1', html: '<b>my old note</b> <img src="stickyfile://att/abc-1.png">', text: 'my old note', open: true, createdAt: 1700000000000, updatedAt: 1700000500000, bounds: { x: 40, y: 50, width: 280, height: 260 } }));
fs.writeFileSync(path.join(OLD, 'notes', 'old2.json'), JSON.stringify({ id: 'old2', html: 'second', text: 'second', open: false, createdAt: 1700000000000, updatedAt: 1700000000000 }));
fs.writeFileSync(path.join(OLD, 'attachments', 'abc-1.png'), 'PNG');
fs.writeFileSync(path.join(OLD, 'settings.json'), JSON.stringify({ firstRunDone: true, startWithWindows: true, defaultColor: 'pink' }));

(async () => {
  const { H, E, ev } = await app.start();
  const DATA = app.DATA;
  assert.ok(fs.existsSync(path.join(DATA, 'notes', 'old1.json')), 'old notes copied');
  assert.ok(fs.existsSync(path.join(DATA, 'attachments', 'abc-1.png')), 'old photos copied');
  assert.ok(fs.existsSync(path.join(OLD, 'notes', 'old1.json')), 'old folder left untouched');
  assert.deepEqual(E.__langs, ['en-US'], 'Cyrillic ignored by default');
  const wins = app.noteWins();
  assert.equal(wins.length, 1, 'previously open note reopens (no welcome note for existing users)');
  const w = wins[0];
  assert.deepEqual([w.bounds.x, w.bounds.y], [40, 50], 'where it was');
  let n = await H['note:get'](ev(w));
  assert.equal(n.settings.spellCheck, false); assert.equal(n.settings.hasPassword, false);
  assert.equal(n.createdAt, 1700000000000, 'its dates are kept');
  assert.deepEqual((await app.list()).settings.defaultColors, ['pink'], 'the old new-note colour still applies');
  assert.equal((await app.card('old2')).open, false, 'a closed one stays closed');
  assert.ok((await E.__proto({ url: 'stickyfile://att/abc-1.png' })).url, 'its photo still shows');

  // ---- a migrated note is a normal note
  n = await H['note:update'](ev(w), { title: 'Shopping' });
  assert.ok(n.updatedAt > 1700000500000, 'an edit updates "last edited"');
  assert.equal(n.createdAt, 1700000000000, 'created date never changes');
  assert.ok((await H['lock:set'](null, { next: '1234' })).ok);
  assert.equal((await H['note:set-locked'](ev(w), true)).hidden, true);
  const r = await H['note:unlock'](ev(w), '1234');
  assert.ok(r.html.includes('my old note'), 'contents survive locking');
  console.log('ok');
  process.exit(0);
})();
