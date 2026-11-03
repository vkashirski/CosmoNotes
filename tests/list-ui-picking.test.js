'use strict';
// Picking several cards in the notes list, in a real browser (tests/helpers/list-ui.js): Ctrl+click, Shift+click, Ctrl+A, Escape,
// clicking empty space; the bar at the bottom (favourite, Edit design, group, lock, close / open, Bin) and the same actions
// in the right-click menu; the Delete key; dragging several picked cards at once; locked ones are never binned.
const assert = require('assert');

(async () => {
  let A, B, C, D, L, G;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    A = await s.note({ title: 'Alpha' }); B = await s.note({ title: 'Beta' }); C = await s.note({ title: 'Gamma' }); D = await s.note({ title: 'Delta' });
    L = await s.note({ title: 'Locked one' }); await s.lock(L);
    const x = await s.note({ title: 'In group' }); G = await s.group([x], { name: 'Box' });
  });
  const { page } = ui;
  const picked = () => page.$$eval('#cards > .card.sel', (cs) => cs.map((c) => c.dataset.key.slice(2)));
  const count = () => ui.text('#bulkCount');
  const N = ui.noteKey;
  const note = async (id) => (await ui.get()).notes.find((n) => n.id === id);
  // sort oldest first, groups last, so the order on screen is known: A B C D L (welcome note first) … G
  await ui.click('#btnSort'); await ui.click('#sortPop [data-key="dir"] button[data-v="asc"]'); await ui.click('#sortPop [data-key="groups"] button[data-v="last"]'); await ui.key('Escape');

  // ---- picking
  assert.ok(!(await ui.visible('#bulk')), 'no bar while nothing is picked');
  await ui.click(N(A), { ctrlKey: true });
  assert.deepEqual(await picked(), [A]); assert.equal(await count(), '1 selected'); assert.ok(await ui.visible('#bulk'), 'Ctrl+click picks: the bar shows');
  assert.ok(!(await ui.get()).notes.find((n) => n.id === A).open, 'and doesn’t open the note');
  await ui.click(N(C), { shiftKey: true });
  assert.deepEqual((await picked()).sort(), [A, B, C].sort(), 'Shift+click: everything between');
  await ui.click(N(B), { ctrlKey: true });
  assert.deepEqual((await picked()).sort(), [A, C].sort(), 'Ctrl+click again: un-picked');
  assert.ok(await ui.visible('#bGroup'), 'two picked: Group shows');
  await ui.click(N(D));
  assert.deepEqual(await picked(), [], 'a plain click on another card forgets the picks');
  await ui.click(N(A), { ctrlKey: true });
  await ui.down('#viewNotes');
  assert.deepEqual(await picked(), [], 'a click on empty space forgets them');
  await page.locator('body').dispatchEvent('mousedown'); await ui.key('Control+a');
  assert.equal((await picked()).length, await ui.count('#cards > .card'), 'Ctrl+A picks every card shown');
  await ui.key('Escape');
  assert.deepEqual(await picked(), [], 'Escape forgets them');

  // ---- the bar: favourite, colour, font
  await ui.click(N(A), { ctrlKey: true }); await ui.click(N(B), { ctrlKey: true });
  await ui.click('#bFav');
  assert.ok((await note(A)).favorite && (await note(B)).favorite, 'Favourite: both');
  assert.equal(await page.textContent('#bFav span'), 'Unfavourite', 'the button turns into Unfavourite');
  await ui.click('#bFav');
  assert.ok(!(await note(A)).favorite && !(await note(B)).favorite, 'Unfavourite: both');
  // Edit design (1.2.2, was Colour): the right-click sheet, for all the picked notes
  await ui.H['list:edit']({}, A, { color: 'pink', fx: { e: 'none' } });
  await ui.H['list:edit']({}, B, { color: 'blue', fx: { f: 'none' } });
  await ui.settle(); await ui.settle();
  assert.equal(await ui.count('#bColor'), 0, 'no Colour button any more');
  await ui.click('#bEdit');
  assert.ok(await ui.visible('#editSheet'), 'Edit design opens the sheet');
  assert.equal(await ui.text('#editBox h3'), 'Edit design · 2 notes');
  assert.ok(await page.$eval('#editTitle', (t) => t.readOnly), 'no title to type for several notes');
  assert.equal(await ui.text('#editColorName'), 'Mixed', 'different colours show as Mixed');
  await ui.click('#editColors [data-color="mint"]');
  assert.equal((await note(A)).color, 'mint'); assert.equal((await note(B)).color, 'mint', 'Colour: both');
  await ui.type('#editOpacity', '70');
  assert.equal((await note(A)).opacity, 0.7); assert.equal((await note(B)).opacity, 0.7, 'see-through: both');
  assert.ok(await ui.visible('#editFontRow'), 'a Font row for several notes');
  await ui.click('#editFonts [data-font="medieval"]');
  assert.equal((await note(A)).font, 'medieval'); assert.equal((await note(B)).font, 'medieval', 'Font: both');
  await ui.click('#editTabs [data-tab="f"]');
  await ui.click('#editFxFAmt button[data-a="high"]');
  const fa = await note(A); const fb = await note(B);
  assert.ok(fa.fx.fa === 'high' && fb.fx.fa === 'high', 'an effect setting: both');
  assert.ok(fa.fx.e === 'none' && fb.fx.f === 'none' && fb.fx.e === null, 'each keeps its other effect picks');
  assert.equal((await note(A)).title, 'Alpha', 'the titles are left alone');
  await ui.click('#editTabs [data-tab="look"]');
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#editSheet')), 'Escape closes it');
  assert.deepEqual((await picked()).sort(), [A, B].sort(), 'the picks stay after a change');

  // ---- right-click on a picked card: the same actions
  await ui.rclick(N(A));
  const labels = await ui.menuLabels();
  assert.ok(labels.includes('Put together in a new group') && labels.includes('Move to Bin (2)') && labels.includes('Clear selection'), 'the menu for the picked cards');
  await ui.key('Escape');

  // ---- Group: the picked ones go into a new group
  await ui.click('#bGroup');
  const d = await ui.get();
  const gid = d.notes.find((n) => n.id === A).groupId;
  assert.ok(gid && d.notes.find((n) => n.id === B).groupId === gid, 'Group: both in one new group');
  assert.deepEqual(await picked(), [], 'and the picks are cleared');
  await ui.menu(ui.groupKey(gid), 'Ungroup…'); await ui.modalOk();

  // ---- Bin: asks, says how many; Shift+Delete doesn't ask; locked ones stay
  await ui.click(N(C), { ctrlKey: true }); await ui.click(N(L), { ctrlKey: true });
  await ui.click('#bBin');
  assert.ok(/Move 1 note to the Bin\?/.test(await ui.modalTitle()) && /1 locked one stays/.test(await ui.text('#mText')), 'asks, and says the locked one stays');
  await ui.modalCancel();
  assert.ok(!(await note(C)).deletedAt, 'cancelled: nothing binned');
  await ui.key('Delete');
  assert.ok(await ui.modalOpen(), 'the Delete key asks too');
  await ui.modalOk();
  assert.ok((await note(C)).deletedAt, 'binned'); assert.ok(!(await note(L)).deletedAt, 'the locked one is not');
  await ui.click(N(L), { ctrlKey: true });
  assert.ok(await page.isDisabled('#bBin'), 'only locked ones picked: the Bin button is off');
  await ui.key('Escape');
  await ui.click(N(D), { ctrlKey: true }); await ui.key('Shift+Delete');
  assert.ok(!(await ui.modalOpen()) && (await note(D)).deletedAt, 'Shift+Delete: binned without a question');

  // ---- Lock from the bar; Close / Open
  await ui.click(N(B), { ctrlKey: true });
  await ui.click('#bOpen');
  assert.ok((await note(B)).open, 'Open: on the desktop');
  await ui.click(N(B), { ctrlKey: true }); // picked again (a change redraws)
  if (!(await picked()).includes(B)) await ui.click(N(B), { ctrlKey: true });
  await ui.click('#bClose');
  assert.ok(!(await note(B)).open, 'Close: closed');
  if (!(await picked()).includes(B)) await ui.click(N(B), { ctrlKey: true });
  await ui.click('#bLock');
  assert.ok((await note(B)).ownLock, 'Lock: locked (the password was set already, so no question)');

  // ---- dragging several picked cards at once
  await ui.click(N(A), { ctrlKey: true });
  const loose = (await ui.keys()).filter((k) => k.startsWith('n:') && k !== `n:${A}`).map((k) => k.slice(2));
  const other = loose.find((id) => id !== L && id !== B);
  await ui.click(N(other), { ctrlKey: true });
  await ui.drag(N(A), ui.groupKey(G));
  assert.equal((await note(A)).groupId, G); assert.equal((await note(other)).groupId, G, 'both picked cards moved into the group');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
