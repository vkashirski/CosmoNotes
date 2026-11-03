'use strict';
// Groups in the notes list, in a real browser (tests/helpers/list-ui.js): opening a group and its sub-groups, the crumbs and the
// back button, a new note made inside the open group, renaming from the header, the group settings panel (look, colour,
// every note's colour, ungroup, bin), drag & drop (note onto note, into a group, up a level; never a group inside itself),
// the mouse's back / forward buttons, and a locked group asking for the password.
const assert = require('assert');

(async () => {
  let A, B, C, D, E1, F, HOME, KITCHEN, SAFE;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    A = await s.note({ title: 'Milk', color: 'yellow' });
    B = await s.note({ title: 'Bread', color: 'mint' });
    C = await s.note({ title: 'Spoons' });
    D = await s.note({ title: 'Loose one' });
    E1 = await s.note({ title: 'Loose two' });
    F = await s.note({ title: 'Diary' });
    KITCHEN = await s.group([C], { name: 'Kitchen' });
    HOME = await s.group([A, B, KITCHEN], { name: 'Home', style: 'folder', color: 'lilac' });
    SAFE = await s.group([F], { name: 'Safe' });
    await s.lock(SAFE);
  });
  const { page } = ui;
  const shown = async () => (await ui.keys()).map((k) => k.slice(2));
  const where = async (id) => { const d = await ui.get(); const n = d.notes.find((x) => x.id === id); return n ? n.groupId || null : d.groups.find((g) => g.id === id).parentId || null; };
  const crumbs = () => page.$$eval('#crumbs .crumb', (c) => c.map((x) => x.textContent.trim()));

  // ---- the top level: groups and loose notes
  let top = await shown();
  assert.ok(top.includes(HOME) && top.includes(SAFE) && top.includes(D) && !top.includes(A) && !top.includes(KITCHEN), 'top level: groups and loose notes only');
  assert.ok(!(await ui.visible('#groupHead')), 'no group header at the top');
  const home = await page.$eval(ui.groupKey(HOME), (c) => ({ cls: c.className, t: c.title }));
  assert.ok(/look-folder/.test(home.cls) && /Home · 3 notes · 1 group inside/.test(home.t), 'the group card: its look, and what it holds');

  // ---- open a group, then its sub-group; crumbs; back up
  await ui.click(ui.groupKey(HOME));
  assert.ok(await ui.visible('#groupHead'), 'the group header shows');
  assert.equal(await page.inputValue('#groupName'), 'Home');
  assert.deepEqual((await shown()).sort(), [A, B, KITCHEN].sort(), 'inside: its notes and its sub-group');
  await ui.click(ui.groupKey(KITCHEN));
  assert.deepEqual(await crumbs(), ['All notes', 'Home', 'Kitchen'], 'crumbs: the way down');
  assert.deepEqual(await shown(), [C]);
  // a new note is made inside the group that is open
  const before = new Set((await ui.get()).notes.map((n) => n.id));
  await ui.click('#btnNew');
  const made = (await ui.get()).notes.find((n) => !before.has(n.id));
  assert.equal(made.groupId, KITCHEN, 'New note inside a group lands in that group');
  await ui.click('#crumbs button.crumb >> nth=1');
  assert.equal(await page.inputValue('#groupName'), 'Home', 'a crumb goes back to that level');
  await ui.click('#btnBack');
  assert.ok(!(await ui.visible('#groupHead')), 'the back button goes up to the top');

  // ---- the mouse's back / forward buttons step through the levels you visited
  await ui.click(ui.groupKey(HOME)); await ui.click(ui.groupKey(KITCHEN));
  const mouse = (b) => page.evaluate((btn) => { window.dispatchEvent(new MouseEvent('mouseup', { button: btn, bubbles: true, cancelable: true })); }, b);
  await page.waitForTimeout(300); await mouse(3); await ui.settle(); // (300 ms: one click can arrive twice, so a second one within 250 ms is ignored)
  assert.equal(await page.inputValue('#groupName'), 'Home', 'mouse back: one level back');
  await page.waitForTimeout(300); await mouse(4); await ui.settle();
  assert.deepEqual(await crumbs(), ['All notes', 'Home', 'Kitchen'], 'mouse forward: forward again');
  await ui.click('#crumbs button.crumb');

  // ---- rename from the header (saved after a short pause in typing)
  await ui.click(ui.groupKey(HOME));
  await ui.type('#groupName', 'Home sweet home');
  assert.equal((await ui.get()).groups.find((g) => g.id === HOME).name, 'Home sweet home', 'the new name is saved');

  // ---- the group settings panel
  await ui.click('#btnGroupSettings');
  assert.ok(await ui.visible('#groupPanel'));
  await ui.click('#gStyles button[data-style="envelope"]');
  await ui.click('#gColors [data-color="sky"], #gColors button >> nth=5');
  let g = (await ui.get()).groups.find((x) => x.id === HOME);
  assert.equal(g.style, 'envelope', 'its look is saved');
  assert.notEqual(g.color, 'lilac', 'its colour is saved');
  // every note's paper colour: with "notes in its groups too" ticked, the sub-group's notes change as well
  if (!(await page.isChecked('#gInner'))) await ui.check('#gInner');
  await ui.click('#gNoteColors .sw[data-color="pink"]');
  let d = await ui.get();
  for (const id of [A, B, C, made.id]) assert.equal(d.notes.find((n) => n.id === id).color, 'pink', 'every note inside turned pink');
  assert.ok(/Changed 4 notes/.test(await ui.text('#toast')), 'and it says how many');
  await ui.check('#gInner');
  await ui.click('#gNoteColors .sw[data-color="mint"]');
  d = await ui.get();
  assert.equal(d.notes.find((n) => n.id === C).color, 'pink', 'unticked: the sub-group’s notes keep theirs');
  assert.equal(d.notes.find((n) => n.id === A).color, 'mint');
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#groupPanel')), 'Escape closes the panel');
  await ui.click('#btnBack');

  // ---- drag & drop
  await ui.drag(ui.noteKey(D), ui.noteKey(E1));
  const pair = await where(D);
  assert.ok(pair && pair === await where(E1), 'a note dropped on a note: the two make a new group');
  await ui.drag(ui.groupKey(pair), ui.groupKey(HOME));
  assert.equal(await where(pair), HOME, 'a group dropped on a group goes inside it');
  await ui.click(ui.groupKey(HOME));
  await ui.drag(ui.groupKey(KITCHEN), ui.groupKey(KITCHEN));
  assert.equal(await where(KITCHEN), HOME, 'a group dropped on itself: nothing happens');
  await ui.drag(ui.noteKey(A), '#btnBack');
  assert.equal(await where(A), null, 'dropped on the back button: up one level');
  await ui.click('#btnBack');
  await ui.drag(ui.groupKey(HOME), ui.groupKey(HOME));
  assert.equal(await where(HOME), null);

  // ---- a locked group asks for the password before it opens
  assert.ok(/locked/.test(await page.$eval(ui.groupKey(SAFE), (c) => c.className)), 'the locked group looks locked');
  await ui.click(ui.groupKey(SAFE));
  assert.ok(await ui.modalOpen(), 'it asks for the password');
  await ui.modalOk(['wrong']);
  assert.ok(await ui.modalOpen() && (await ui.text('#mErr')).length > 0, 'a wrong password: the pop-up stays, with a message');
  await ui.modalOk(['pw1234']);
  assert.ok(!(await ui.modalOpen()) && (await shown()).includes(F), 'the right one: the group opens');
  await ui.click('#btnBack');

  // ---- ungroup and bin a group, both ask first
  await ui.menu(ui.groupKey(HOME), 'Ungroup…');
  assert.ok(/Ungroup/.test(await ui.modalTitle()));
  await ui.modalCancel();
  assert.ok((await ui.get()).groups.some((x) => x.id === HOME), 'cancelled: still a group');
  await ui.menu(ui.groupKey(HOME), 'Ungroup…');
  await ui.modalOk();
  d = await ui.get();
  assert.ok(!d.groups.some((x) => x.id === HOME), 'ungrouped');
  assert.equal(d.notes.find((n) => n.id === B).groupId, null, 'its notes moved up a level');
  assert.equal(d.groups.find((x) => x.id === KITCHEN).parentId, null, 'its sub-groups too');
  assert.ok(!d.notes.some((n) => n.deletedAt && [A, B].includes(n.id)), 'no note was deleted');
  await ui.menu(ui.groupKey(KITCHEN), 'Move its notes to Bin…');
  assert.ok(/Move all 2 notes in “Kitchen” to the Bin\?/.test(await ui.modalTitle()), 'it says how many notes');
  await ui.modalOk();
  d = await ui.get();
  assert.ok(d.notes.find((n) => n.id === C).deletedAt && d.notes.find((n) => n.id === made.id).deletedAt, 'its notes are in the Bin');
  await ui.menu(ui.groupKey(SAFE), 'Locked');
  assert.ok(!(await ui.get()).notes.find((n) => n.id === F).deletedAt, 'a locked group can’t be binned');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
