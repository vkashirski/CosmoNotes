'use strict';
// Locks and the Bin in the notes list, in a real browser (tests/helpers/list-ui.js): the first lock asks to choose a password or
// PIN (with its rules), a locked note can't be binned, removing a lock needs the PIN, the Locked tab's "Unlock all" /
// "Lock again"; moving to the Bin asks (Shift+click doesn't), the Bin's search, Restore (back into its group),
// Delete forever and Empty bin ask first.
const assert = require('assert');

(async () => {
  let A, B, C, D, G;
  const ui = await require('./helpers/list-ui')(async (s) => {
    A = await s.note({ title: 'Diary', html: '<div>dear diary</div>' });
    B = await s.note({ title: 'Groceries', html: '<div>eggs</div>' });
    C = await s.note({ title: 'Old list', html: '<div>nothing</div>' });
    D = await s.note({ title: 'Inside', html: '<div>in a group</div>' });
    G = await s.group([D], { name: 'Box' });
  });
  const { page } = ui;
  const note = async (id) => (await ui.get()).notes.find((n) => n.id === id);
  const N = ui.noteKey;
  const err = () => ui.text('#mErr');

  // ---- the first lock: choose a password or PIN
  await ui.menu(N(A), 'Lock note');
  assert.equal(await ui.modalTitle(), 'Choose a password or PIN', 'no password yet: it asks for one first');
  assert.ok(await page.isVisible('#mKind button[data-k="pin"].on'), 'PIN is picked at first');
  await page.locator('#mInputs input').first().evaluate((x) => { x.value = '12ab3'; x.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.inputValue('#mInputs input >> nth=0'), '123', 'a PIN field takes digits only');
  await ui.modalOk(['123', '123']);
  assert.equal(await err(), 'A PIN is 4 to 12 digits.', 'too short');
  await ui.modalOk(['4321', '4320']);
  assert.equal(await err(), "The two don't match.");
  assert.ok(!(await note(A)).ownLock && !(await ui.get()).settings.hasPassword, 'nothing saved yet');
  await ui.modalOk(['4321', '4321']);
  // 1.1.30: the first PIN sets up encryption, and the recovery key is shown once (more in crypt.test.js and list-ui-crypt.test.js)
  assert.equal(await ui.modalTitle(), 'Your recovery key', 'then the recovery key pop-up');
  await page.locator('.rkeyok input').evaluate((x) => x.click()); await ui.click('#mOk');
  assert.ok(!(await ui.modalOpen()), 'saved: the pop-up closes');
  let s = (await ui.get()).settings;
  assert.ok(s.hasPassword && s.lockKind === 'pin', 'a PIN is set');
  assert.ok((await note(A)).ownLock, 'and the note is locked');
  assert.ok(!/dear diary/.test(await page.content()), 'its words left the window');

  // ---- a locked note: no bin button, the menu says why, the Delete key refuses
  assert.equal(await ui.count(`${N(A)} button[title^="Move to Bin"]`), 0);
  await ui.rclick(N(A));
  assert.ok((await ui.menuLabels()).includes('Locked: can’t be deleted'), 'the menu says it can’t be deleted');
  assert.ok(await page.isDisabled('#ctx button:has-text("Locked")'), '(greyed out)');
  await ui.key('Escape');
  await ui.click(N(A), { ctrlKey: true }); await ui.key('Delete');
  assert.ok(!(await ui.modalOpen()) && !(await note(A)).deletedAt, 'Delete on a locked note: nothing happens');
  assert.ok(/can’t be deleted/.test(await ui.text('#toast')), 'it says why');
  await ui.key('Escape');

  // ---- the second lock needs no question; removing a lock needs the PIN
  await ui.click(`${N(B)} .lockb`);
  assert.ok(!(await ui.modalOpen()) && (await note(B)).ownLock, 'locking again: no question');
  await ui.menu(N(B), 'Remove lock…');
  assert.equal(await page.getAttribute('#mInputs input', 'placeholder'), 'PIN', 'it asks for the PIN (not “password”)');
  await ui.modalOk(['9999']);
  assert.ok(await ui.modalOpen() && (await err()) === 'Wrong PIN', 'a wrong PIN: the pop-up stays');
  assert.equal(await page.inputValue('#mInputs input'), '', 'and the field is cleared for the next try');
  assert.ok((await note(B)).ownLock);
  await ui.modalOk(['4321']);
  assert.ok(!(await ui.modalOpen()) && !(await note(B)).ownLock, 'the right PIN (typed in full, no OK needed): the lock is gone');

  // ---- the Locked tab: Unlock all shows the words in the list, Lock again hides them
  await ui.tab('locks');
  assert.deepEqual((await ui.keys()).map((k) => k.slice(2)), [A], 'the locked note');
  await ui.click('#btnUnlockAll');
  await ui.modalOk(['1111']);
  assert.equal(await err(), 'Wrong PIN');
  await ui.modalOk(['4321']);
  assert.ok(/dear diary/.test(await ui.text(N(A))), 'Unlock all: the card shows its words');
  await ui.type('#q', 'dear');
  assert.deepEqual((await ui.keys()).map((k) => k.slice(2)), [A], 'and search looks inside it');
  await ui.key('Escape');
  assert.ok(await ui.visible('#btnLockAll'));
  await ui.click('#btnLockAll');
  assert.ok(!/dear diary/.test(await page.content()), 'Lock again: the words are gone again');
  assert.ok((await note(A)).ownLock, 'it was locked all the time');
  await ui.tab('notes');

  // ---- moving to the Bin
  await ui.click(`${N(C)} button[title^="Move to Bin"]`);
  assert.equal(await ui.modalTitle(), 'Move this note to the Bin?');
  assert.ok(/“Old list” can be restored/.test(await ui.text('#mText')), 'it names the note');
  await ui.modalCancel();
  assert.ok(!(await note(C)).deletedAt, 'cancelled');
  await ui.click(`${N(C)} button[title^="Move to Bin"]`); await ui.modalOk();
  assert.ok((await note(C)).deletedAt, 'binned'); assert.equal(await ui.text('#cBin'), '1');
  await ui.click(`${N(B)} button[title^="Move to Bin"]`, { shiftKey: true });
  assert.ok(!(await ui.modalOpen()) && (await note(B)).deletedAt, 'Shift+click: no question');
  // a note binned from inside a group goes back into it when restored
  await ui.click(ui.groupKey(G));
  await ui.click(`${N(D)} button[title^="Move to Bin"]`, { shiftKey: true });
  await ui.click('#btnBack');

  // ---- the Bin
  await ui.tab('bin');
  const binTitles = () => page.$$eval('#binCards > .card', (cs) => cs.map((c) => c.innerText.split('\n')[0].trim()));
  assert.equal((await binTitles()).length, 3);
  await ui.type('#bq', 'grocer');
  assert.deepEqual(await binTitles(), ['Groceries'], 'the Bin has its own search');
  await ui.click('#bqClear');
  await ui.menu('#binCards > .card:has-text("Inside")', 'Restore');
  let n = await note(D);
  assert.ok(!n.deletedAt && n.groupId === G, 'Restore: back, into its group');
  await ui.click('#binCards > .card:has-text("Groceries") button.pill.danger');
  assert.equal(await ui.modalTitle(), 'Delete this note forever?', 'Delete forever asks');
  await ui.modalOk();
  assert.ok(!(await note(B)), 'deleted: gone for good');
  await ui.click('#btnEmpty');
  assert.equal(await ui.modalTitle(), 'Delete 1 note forever?', 'Empty bin asks, with the count');
  await ui.modalCancel();
  assert.ok(await note(C), 'cancelled: still in the Bin');
  await ui.click('#btnEmpty'); await ui.modalOk();
  assert.ok(!(await note(C)), 'emptied');
  assert.ok(/The bin is empty/.test(await ui.text('#binCards')) && await page.isDisabled('#btnEmpty'), 'an empty Bin says so');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
