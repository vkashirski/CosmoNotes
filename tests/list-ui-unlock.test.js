'use strict';
// "Unlock…" in the notes list, in a real browser (tests/helpers/list-ui.js; 1.1.47; main's side: unlock.test.js): the
// right-click menu of a locked note / group has "Unlock…" (until CosmoNotes restarts) with "Remove lock…" right under it;
// once unlocked, "Lock again". The padlock on a card does the same; the Locked tab's "Lock again" ends it too.
const assert = require('assert');

(async () => {
  let A, D, G;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password('2468', 'pin');
    A = await s.note({ title: 'Diary', html: '<div>dear diary</div>' });
    D = await s.note({ title: 'Inside', html: '<div>in a box</div>' });
    G = await s.group([D], { name: 'Box' });
    await s.lock(A);
    await s.lock(G);
  });
  const { page } = ui;
  const N = ui.noteKey;
  const note = async (id) => (await ui.get()).notes.find((n) => n.id === id);
  const grp = async (id) => (await ui.get()).groups.find((g) => g.id === id);
  const labels = async (sel) => { await ui.rclick(sel); const l = await ui.menuLabels(); await ui.key('Escape'); return l; };

  // ---- a locked note: "Unlock…", with "Remove lock…" right under it
  let l = await labels(N(A));
  assert.ok(l.includes('Unlock…') && l[l.indexOf('Unlock…') + 1] === 'Remove lock…', `menu: ${l.join(' | ')}`);
  assert.ok(!l.includes('Lock again'));
  await ui.menu(N(A), 'Unlock…');
  assert.equal(await ui.modalTitle(), 'Unlock note?');
  assert.ok(/restarts/.test(await ui.text('#mText')), 'it says how long');
  await ui.modalOk(['1111']);
  assert.ok(await ui.modalOpen(), 'a wrong PIN: the pop-up stays');
  await ui.modalOk(['2468']);
  assert.ok(!(await ui.modalOpen()));
  assert.ok(/dear diary/.test(await ui.text(N(A))), 'the card shows its words');
  let n = await note(A);
  assert.ok(n.ownLock && n.forNow, 'still locked, unlocked for now');
  assert.equal(await page.getAttribute(`${N(A)} .ulk`, 'title'), 'Unlocked until CosmoNotes restarts', 'the card says so');
  l = await labels(N(A));
  assert.ok(l.includes('Lock again') && l.includes('Remove lock…') && !l.includes('Unlock…'), `then: ${l.join(' | ')}`);

  // ---- the padlock on the card: Lock again, then Unlock (asks for the PIN)
  assert.equal(await page.getAttribute(`${N(A)} .lockb`, 'title'), 'Lock again');
  await ui.click(`${N(A)} .lockb`);
  assert.ok(!(await ui.modalOpen()) && !/dear diary/.test(await page.content()), 'Lock again: hidden, no question');
  assert.ok((await note(A)).ownLock && !(await note(A)).forNow);
  assert.equal(await page.getAttribute(`${N(A)} .lockb`, 'title'), 'Unlock until CosmoNotes restarts…');
  await ui.click(`${N(A)} .lockb`);
  assert.equal(await ui.modalTitle(), 'Unlock note?', 'the padlock unlocks for now (not for good)');
  await ui.modalOk(['2468']);
  assert.ok((await note(A)).ownLock && (await note(A)).forNow);

  // ---- the Locked tab's "Lock again" also shows for it, and locks it
  await ui.tab('locks');
  assert.ok(await ui.visible('#btnLockAll'), 'Lock again shows');
  await ui.click('#btnLockAll');
  assert.ok(!(await note(A)).forNow && !/dear diary/.test(await page.content()));
  await ui.tab('notes');

  // ---- a locked group
  l = await labels(ui.groupKey(G));
  assert.ok(l.includes('Unlock…') && l[l.indexOf('Unlock…') + 1] === 'Remove lock…', `group menu: ${l.join(' | ')}`);
  await ui.menu(ui.groupKey(G), 'Unlock…');
  assert.equal(await ui.modalTitle(), 'Unlock group?');
  await ui.modalOk(['2468']);
  assert.ok((await grp(G)).open && (await grp(G)).forNow && (await grp(G)).locked, 'the group is unlocked for now');
  await ui.menu(ui.groupKey(G), 'Lock again');
  assert.ok(!(await grp(G)).open && !(await grp(G)).forNow);

  // ---- Remove lock… still removes it for good
  await ui.menu(N(A), 'Remove lock…');
  assert.equal(await ui.modalTitle(), 'Remove the lock?');
  await ui.modalOk(['2468']);
  assert.ok(!(await note(A)).ownLock, 'the lock is gone');
  l = await labels(N(A));
  assert.ok(l.includes('Lock note') && !l.includes('Unlock…') && !l.includes('Remove lock…'));
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
