'use strict';
// How a locked note opens again, in the main process: in its own window (shown in the list too until that window locks
// again or closes, 1.1.14), the lock removed from the list (a window still asking for the PIN shows the note at once,
// unless its group is still locked), Unlock all / Lock again in the Locked tab (closing the list locks again), and
// "Unlock…" from the list (1.1.47): only until CosmoNotes restarts, the lock stays (also on disk); "Lock again" ends it.
// The last part restarts the app: a second process on the same data.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, ['first', 'restart']);

(async () => {
  const { H, E, ev, tick } = await app.start();
  const lockNows = (w) => w.webContents.sent.filter((ch) => ch === 'note:lock-now').length;
  if (app.phase === 'restart') {
    // ---- after a restart, everything unlocked "for now" is locked again
    const { A, C, G } = app.hand();
    const a = await app.card(A); const c = await app.card(C); const g = await app.group(G);
    assert.ok(a.locked && !a.forNow && a.text === '' && a.ownLock, 'after a restart the note is locked again');
    assert.ok(c.locked && c.text === '', 'and the notes in the group');
    assert.ok(g.locked && !g.open && !g.forNow, 'and the group');
    return app.quit();
  }
  assert.ok((await H['lock:set'](null, { next: '2580', kind: 'pin' })).ok);

  // ---- unlocked in its own window = unlocked in the list, until locked again or closed (1.1.14)
  const id = await app.newNote({ html: '<p>secret plan</p>', text: 'secret plan' });
  let w = app.winOf(id);
  assert.ok((await H['list:set-locked'](null, id, true)).ok);
  assert.ok(w.webContents.sent.includes('note:lock-now'), 'the open window is told to hide');
  assert.equal((await H['note:relock'](ev(w))).hidden, true, 'the window shows the PIN screen');
  assert.equal((await app.card(id)).text, '', 'hidden in the list as soon as it is locked');
  assert.equal(await H['note:unlock'](ev(w), '1111'), null, 'wrong PIN');
  assert.equal((await app.card(id)).text, '', 'still hidden after a wrong PIN');
  assert.ok(await H['note:unlock'](ev(w), '2580'));
  let cd = await app.card(id);
  assert.equal(cd.locked, false, 'shown in the list while unlocked in its window');
  assert.equal(cd.text, 'secret plan'); assert.equal(cd.ownLock, true); assert.equal(cd.openUnlocked, true);
  await H['note:relock'](ev(w));
  cd = await app.card(id);
  assert.equal(cd.locked, true, 'locked again in the window = locked in the list'); assert.equal(cd.text, '');
  await H['note:unlock'](ev(w), '2580');
  w.close(); await tick(20);
  cd = await app.card(id);
  assert.equal(cd.locked, true, 'closing the note locks it in the list again'); assert.equal(cd.openUnlocked, false);

  // ---- the lock removed from the list: a window still asking for the PIN shows the note
  await H['list:open-note'](null, id); w = app.winOf(id);
  assert.equal((await H['note:get'](ev(w))).hidden, true);
  assert.equal((await H['list:set-locked'](null, id, false, '0000')).error, 'wrong');
  assert.ok((await H['list:set-locked'](null, id, false, '2580')).ok);
  let v = app.lastLook(w);
  assert.equal(v.hidden, false, 'the window is told the note is no longer hidden');
  assert.equal(v.html, '<p>secret plan</p>', '... and gets its contents to show');
  assert.equal(v.locked, false);
  await H['note:update'](ev(w), { html: '<p>secret plan 2</p>', text: 'secret plan 2' });
  assert.equal((await H['note:get'](ev(w))).html, '<p>secret plan 2</p>', 'its edits are saved again (not dropped as from a hidden window)');
  // the same for a group's lock; still locked by something else = still hidden
  const a = await app.newNote({ html: '<p>in group</p>', text: 'in group' });
  const b = await app.newNote();
  const w2 = app.winOf(a);
  const G = await H['groups:make'](null, a, b);
  assert.ok((await H['groups:set-locked'](null, G, true)).ok);
  await H['note:relock'](ev(w2));
  assert.ok((await H['groups:set-locked'](null, G, false, '2580')).ok);
  v = app.lastLook(w2);
  assert.equal(v.hidden, false, 'group lock removed: the open note shows again');
  assert.equal(v.html, '<p>in group</p>');
  assert.ok((await H['list:set-locked'](null, a, true)).ok);
  await H['note:relock'](ev(w2));
  assert.ok((await H['groups:set-locked'](null, G, true)).ok);
  assert.ok((await H['list:set-locked'](null, a, false, '2580')).ok);
  v = app.lastLook(w2);
  assert.equal(v.hidden, true, 'its group is still locked, so the PIN is still needed');
  assert.equal(v.html, '');
  assert.ok((await H['groups:set-locked'](null, G, false, '2580')).ok);

  // ---- the Locked tab: Unlock all / Lock again
  assert.ok((await H['list:set-locked'](null, id, true)).ok);
  assert.equal((await app.list()).settings.unlockedAll, false);
  assert.deepEqual(await H['list:unlock-all'](null, '0000'), { ok: false }, 'wrong PIN');
  assert.equal((await app.card(id)).text, '');
  assert.deepEqual(await H['list:unlock-all'](null, '2580'), { ok: true });
  assert.equal((await app.list()).settings.unlockedAll, true);
  assert.equal((await app.card(id)).text, 'secret plan 2', 'words show (and can be searched) after Unlock all');
  assert.equal((await app.card(id)).locked, false, 'shown unlocked'); assert.equal((await app.card(id)).ownLock, true, 'but still locked');
  assert.ok((await H['groups:set-locked'](null, G, true)).ok);
  assert.equal((await app.group(G)).open, true, 'a locked group is open while everything is unlocked');
  await H['list:lock-all']();
  assert.equal((await app.list()).settings.unlockedAll, false);
  assert.equal((await app.card(id)).text, '', 'covered again in the list');
  assert.equal((await app.group(G)).open, false, 'the group is covered again');
  await H['list:unlock-all'](null, '2580');
  await H['list:show']();
  app.listWin().close();
  assert.equal((await app.list()).settings.unlockedAll, false, 'closing the list locks everything again');
  await H['groups:set-locked'](null, G, false, '2580');

  // ---- "Unlock…" from the list (1.1.47): only until a restart; the lock stays, also on disk
  const A = id;
  for (const x of app.noteWins()) await H['list:close-note'](null, x.noteId);
  assert.equal((await H['list:unlock-now'](null, A, '0000')).error, 'wrong');
  assert.ok((await app.card(A)).locked, 'a wrong PIN changes nothing');
  assert.ok((await H['list:unlock-now'](null, A, '2580')).ok);
  let c = await app.card(A);
  assert.ok(!c.locked && c.forNow && c.text === 'secret plan 2', 'unlocked: the list shows its words');
  assert.ok(c.ownLock, 'the lock itself stays');
  E.app.emit('will-quit'); // (writes everything now) — not a real quit: nothing else listens
  const disk = fs.readFileSync(path.join(app.DATA, 'notes', A + '.json'), 'utf8');
  assert.ok(!disk.includes('secret plan') && /"locked":\s*true/.test(disk), 'on disk it stays locked and sealed');
  // opening it: no PIN asked; locking another note doesn't hide it; closing it keeps it unlocked
  await H['list:open-note'](null, A);
  w = app.winOf(A);
  v = await H['note:get'](ev(w));
  assert.equal(v.hidden, false, 'the note opens unlocked');
  assert.equal(v.locked, true, '... and still knows it is locked');
  assert.ok((await H['list:set-locked'](null, b, true)).ok);
  assert.equal(lockNows(w), 0, 'locking another note leaves this one open');
  await H['list:close-note'](null, A); await tick(20);
  assert.ok((await app.card(A)).forNow && !(await app.card(A)).locked, 'closing the note keeps it unlocked (until restart)');
  // Lock again (from the list): the list hides it, an open window saves and hides
  await H['list:open-note'](null, A); w = app.winOf(A);
  assert.ok((await H['list:relock'](null, A)).ok);
  assert.equal(lockNows(w), 1, 'the open window is told to save and hide');
  c = await app.card(A);
  assert.ok(c.locked && !c.forNow && c.text === '', 'locked again in the list');
  assert.equal((await H['note:relock'](ev(w))).hidden, true, 'the window shows the PIN screen');
  // Unlock while the window asks for the PIN: it shows the note straight away
  assert.ok((await H['list:unlock-now'](null, A, '2580')).ok);
  v = app.lastLook(w);
  assert.ok(v && v.hidden === false && v.html === '<p>secret plan 2</p>', 'the waiting window gets its contents');
  assert.equal(v.lockedBy, 'note', '(still locked: the window says "Unlocked", not "Lock removed")');
  await H['note:relock'](ev(w));
  assert.ok((await app.card(A)).locked && !(await app.card(A)).forNow, 'Lock again in the note: locked in the list too');
  await H['list:close-note'](null, A);
  // Remove lock… still removes it for good; locking again later is a normal lock
  assert.ok((await H['list:unlock-now'](null, A, '2580')).ok);
  assert.ok((await H['list:set-locked'](null, A, false, '2580')).ok);
  c = await app.card(A);
  assert.ok(!c.ownLock && !c.forNow && !c.locked, 'Remove lock: no lock at all');
  assert.ok((await H['list:set-locked'](null, A, true)).ok);
  assert.ok((await app.card(A)).locked && !(await app.card(A)).forNow, 'locked again: hidden (not still unlocked for now)');
  // a locked group, unlocked for now
  const C = await app.newNote({ html: '<p>group words</p>', text: 'group words', close: true });
  const D = await app.newNote({ close: true });
  const G2 = await H['groups:make'](null, C, D);
  assert.ok((await H['groups:set-locked'](null, G2, true)).ok);
  assert.ok((await app.card(C)).locked && !(await app.group(G2)).open);
  assert.equal((await H['list:unlock-now'](null, G2, '1111')).error, 'wrong');
  assert.ok((await H['list:unlock-now'](null, G2, '2580')).ok);
  assert.ok((await app.group(G2)).open && (await app.group(G2)).forNow, 'the group is unlocked for now');
  assert.ok(!(await app.card(C)).locked && (await app.card(C)).text === 'group words', 'its notes show');
  assert.ok((await app.group(G2)).locked, 'its lock stays');
  await H['list:open-note'](null, C);
  assert.equal((await H['note:get'](ev(app.winOf(C)))).hidden, false, 'a note in it opens without the PIN');
  assert.ok((await H['list:relock'](null, G2)).ok);
  assert.equal(lockNows(app.winOf(C)), 1, 'Lock again on the group hides its open notes');
  await H['note:relock'](ev(app.winOf(C)));
  await H['list:close-note'](null, C);
  assert.ok((await app.card(C)).locked && !(await app.group(G2)).open && !(await app.group(G2)).forNow, 'the group is locked again');
  // "Lock again" in the Locked tab ends everything unlocked for now
  assert.ok((await H['list:unlock-now'](null, A, '2580')).ok);
  assert.ok((await H['list:unlock-now'](null, G2, '2580')).ok);
  await H['list:lock-all']();
  assert.ok((await app.card(A)).locked && (await app.card(C)).locked && !(await app.group(G2)).open, 'Lock again (Locked tab): all locked');
  assert.equal((await H['list:relock'](null, 'nope')).error, 'missing');
  assert.equal((await H['list:unlock-now'](null, 'nope', '2580')).error, 'missing');
  // unlocked for now, then a restart (the next part)
  assert.ok((await H['list:unlock-now'](null, A, '2580')).ok);
  assert.ok((await H['list:unlock-now'](null, G2, '2580')).ok);
  assert.ok(!(await app.card(A)).locked && !(await app.card(C)).locked);
  app.hand({ A, C, G: G2 });
  await app.quit();
})();
