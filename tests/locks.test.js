'use strict';
// Locking notes, in the main process (how they open again: unlock.test.js; encryption on disk: crypt.test.js):
// the password or PIN (rules, changing it, a pause after a wrong one), locking a note, what a locked note's window and
// card get (nothing of its title, words, drawing or pictures), a hidden window can't wipe the note, and locked notes
// and groups can't be deleted (also not by emptying the Bin).
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, L, ev } = await app.start();
  const w = app.noteWins()[0];
  const id = w.noteId;
  const att = await H['att:save'](ev(w), new Uint8Array([137, 80, 78, 71]), 'png');
  const ink = { s: [{ t: 'ellipse', c: '#3E7BFA', w: 4, l: 'a', p: [10, 10, 80, 40] }, { t: 'hl', c: '#FFC800', w: 4, l: 'b', p: [0, 20, 90, 20] }] };
  const html = '<ul class="checklist"><li>my secret</li></ul><img class="att-img" alt="passport" src="' + att + '">';
  await H['note:update'](ev(w), { html, text: 'my secret', firstImage: att, ink, wrapWidth: 312 });

  // ---- no password yet: treated as a password; locking is refused
  let s = (await app.list()).settings;
  assert.equal(s.lockKind, 'password'); assert.equal(s.lockLen, 0); assert.equal(s.hasPassword, false);
  assert.equal((await H['note:set-locked'](ev(w), true)).error, 'no-password');

  // ---- a PIN: digits only, 4 to 12; its length is known (so it can open by itself); the hash never leaves main
  let r = await H['lock:set'](null, { next: '12a4', kind: 'pin' }); assert.ok(r.error, 'letters in a PIN');
  r = await H['lock:set'](null, { next: '123', kind: 'pin' }); assert.ok(r.error, 'too short');
  r = await H['lock:set'](null, { next: '1234567890123', kind: 'pin' }); assert.ok(r.error, 'too long');
  r = await H['lock:set'](null, { next: '2580', kind: 'pin' }); assert.ok(r.ok);
  s = (await app.list()).settings;
  assert.equal(s.lockKind, 'pin'); assert.equal(s.lockLen, 4); assert.equal(s.hasPassword, true);
  assert.equal(s.lock, undefined, 'the hash never goes to a window');
  assert.ok(w.webContents.sent.includes('settings:changed'), 'open notes are told');
  const ns = (await H['note:get'](ev(w))).settings;
  assert.equal(ns.lockKind, 'pin'); assert.equal(ns.lockLen, 4); assert.equal(ns.lock, undefined);

  // ---- locking: the window gets nothing of the note
  let n = await H['note:set-locked'](ev(w), true);
  assert.equal(n.hidden, true); assert.equal(n.html, ''); assert.equal(n.text, ''); assert.equal(n.ink, null, 'no drawing');
  // a hidden window can't wipe the note (an empty save from it is dropped)
  await H['note:update'](ev(w), { html: '', text: '', ink: null });
  L['note:update-sync'](ev(w), { html: '', text: '', ink: null });
  // nor does the list get anything: no words, first picture, checklist boxes or picture descriptions
  await H['note:relock'](ev(w));
  const lk = await app.card(id);
  assert.equal(lk.locked, true); assert.equal(lk.text, ''); assert.equal(lk.firstImage, null, 'list never sees locked content');
  assert.ok(!lk.html && !lk.checks && !lk.pics, 'no html, checklist boxes or picture words');
  // a wrong PIN: nothing, after a pause (against guessing); the right one: everything is still there
  app.waited.length = 0;
  assert.equal(await H['note:unlock'](ev(w), '1234'), null, 'wrong PIN');
  assert.ok(app.waited.length === 1 && app.waited[0] >= 400, 'a wrong PIN waits a moment before it answers');
  n = await H['note:unlock'](ev(w), '2580');
  assert.equal(n.hidden, false, 'right PIN opens it');
  assert.equal(n.html, html, 'its words survived');
  assert.equal(n.ink.s.length, 2, 'its drawing survived'); assert.equal(n.wrapWidth, 312);
  const open = await app.card(id);
  assert.equal(open.checks, 'o', 'unlocked: the card gets its checklist boxes'); assert.equal(open.pics, 'passport', 'and its picture words');

  // ---- changing the PIN / password needs the current one
  r = await H['lock:set'](null, { current: '0000', next: 'kitty cat', kind: 'password' });
  assert.ok(/PIN/.test(r.error), 'says "PIN" when the current one is a PIN');
  r = await H['lock:set'](null, { current: '2580', next: 'kitty cat', kind: 'password' }); assert.ok(r.ok);
  s = (await app.list()).settings;
  assert.equal(s.lockKind, 'password'); assert.equal(s.lockLen, 0);
  assert.equal(app.readJSON('settings.json').lockKind, 'password', 'saved');
  await H['note:relock'](ev(w));
  assert.equal(await H['note:unlock'](ev(w), '2580'), null, 'the old PIN no longer opens it');
  assert.equal((await H['note:unlock'](ev(w), 'kitty cat')).hidden, false, 'the new password does');
  n = await H['note:set-locked'](ev(w), false);
  assert.equal(n.locked, false, 'the lock removed from the note itself');

  // ---- locked notes and groups can't be deleted
  const [a, b, c, d] = [await app.newNote(), await app.newNote(), await app.newNote(), await app.newNote()];
  const dup = await H['list:duplicate'](null, a);
  await H['list:set-locked'](null, d, true);
  assert.equal((await H['list:trash'](null, d)).error, 'locked');
  assert.equal((await app.card(d)).deletedAt, null);
  assert.equal((await H['note:trash'](ev(app.winOf(d)))).error, 'locked', 'not from its own window either');
  const g1 = await H['groups:make-from'](null, [a, b], null);
  const g2 = await H['groups:make-from'](null, [c, g1], null);
  await H['groups:set-locked'](null, g2, true);
  assert.equal((await H['groups:trash'](null, g2)).error, 'locked');
  assert.equal((await H['list:trash'](null, a)).error, 'locked', 'a note inside a locked group');
  assert.equal((await app.card(a)).deletedAt, null);
  await H['groups:set-locked'](null, g2, false, 'kitty cat');
  await H['list:set-locked'](null, c, true);
  assert.equal((await H['groups:trash'](null, g2)).error, 'locked', 'a group with a locked note inside');
  await H['list:set-locked'](null, c, false, 'kitty cat');
  // Empty bin keeps a note that became locked while in the Bin (its group got locked)
  await H['list:trash'](null, dup);
  await H['list:trash'](null, b);
  await H['groups:set-locked'](null, g1, true);
  assert.deepEqual(await H['list:empty-bin'](), { removed: 1, kept: 1 }, 'the duplicate is deleted, the locked one stays');
  assert.ok((await app.card(b)).deletedAt, 'still in the bin');
  assert.equal((await H['list:destroy'](null, b)).error, 'locked');
  await H['groups:set-locked'](null, g1, false, 'kitty cat');
  assert.equal(await H['list:destroy'](null, b), true, 'deletable once the lock is gone');
  console.log('ok');
  process.exit(0);
})();
