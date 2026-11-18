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
  // the owner's pick (1.4.14): every look wears the same label (name + number of notes) in the same spot, nothing under
  // the card; its ink is fixed (the label is always cream), whatever the theme
  for (const id of [HOME, SAFE]) {
    assert.equal(await ui.count(`${ui.groupKey(id)} .glabel`), 1, 'one label on each look');
    assert.equal(await ui.text(`${ui.groupKey(id)} .glabel small`), id === HOME ? '3 notes' : '1 note', 'it says how many notes');
  }
  assert.equal(await ui.text(`${ui.groupKey(HOME)} .glabel b`), 'Home', 'with the name');
  assert.equal(await ui.count(`${ui.groupKey(HOME)} .f-front .glabel`), 1, 'the folder’s label rides on its front');
  assert.equal(await ui.count('#cards .gfoot, #cards .f-count, #cards .nb-label'), 0, 'no name or count anywhere else');
  const theme = await page.evaluate(() => { const t = document.body.dataset.theme; document.body.dataset.theme = 'night'; return t; });
  assert.equal(await page.$eval(`${ui.groupKey(HOME)} .glabel b`, (b) => getComputedStyle(b).color), 'rgb(59, 50, 38)', 'dark ink on a dark theme too');
  await page.evaluate((t) => { document.body.dataset.theme = t; }, theme);

  // ---- open a group, then its sub-group; crumbs; back up
  await ui.click(ui.groupKey(HOME));
  assert.ok(await ui.visible('#groupHead'), 'the group header shows');
  assert.equal(await page.inputValue('#groupName'), 'Home');
  assert.deepEqual((await shown()).sort(), [A, B, KITCHEN].sort(), 'inside: its notes and its sub-group');
  // 1.4.12 (the owner's wish): the group's bar (Back, name, settings) stays in sight under the search row while the cards scroll
  {
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: 300 });
    await page.evaluate(() => { const v = document.getElementById('viewNotes'); v.scrollTop = v.scrollHeight; });
    await page.waitForTimeout(60); // the scroll event comes with the next frame
    await page.waitForFunction(() => !document.getElementById('viewNotes').classList.contains('scrolling')); // no mouse while it scrolls
    const st = await page.evaluate(() => {
      const v = document.getElementById('viewNotes'); const b = document.getElementById('btnBack').getBoundingClientRect();
      const row = v.querySelector('.searchrow').getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { scrolled: v.scrollTop > 0, stuck: v.classList.contains('gstuck'), under: Math.abs(document.getElementById('gStick').getBoundingClientRect().top - row.bottom) < 1.5, back: !!(hit && hit.closest('#btnBack')) };
    });
    assert.deepEqual(st, { scrolled: true, stuck: true, under: true, back: true }, 'scrolled down: the bar sticks under the search row, Back still clickable: ' + JSON.stringify(st));
    await ui.click('#btnGroupSettings');
    assert.ok(await page.evaluate(() => document.getElementById('viewNotes').scrollTop === 0 && !document.getElementById('groupPanel').hidden), 'its settings open where they are: at the top');
    await ui.click('#btnGroupSettings');
    await page.waitForTimeout(150);
    assert.ok(!(await page.evaluate(() => document.getElementById('viewNotes').classList.contains('gstuck'))), 'at the top: not stuck');
    await page.setViewportSize(vp);
  }
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
  // 1.4.15: two parts, This group (its card) and Notes inside (with how many)
  assert.deepEqual(await page.$$eval('#groupPanel .gsech', (x) => x.map((e) => e.firstChild.nextSibling.textContent)), ['This group', 'Notes inside']);
  assert.ok(await page.$eval('#groupPanel .gself', (x) => !!x.querySelector('#gStyles') && !!x.querySelector('#gColors') && !!x.querySelector('#gNameFont') && !x.querySelector('#gFont')), 'the card’s settings in This group');
  assert.ok(await page.$eval('#groupPanel .gnotes', (x) => !!x.querySelector('#gNoteColors') && !!x.querySelector('#gFont') && !!x.querySelector('#gNoteDesign')), 'the notes’ in Notes inside');
  // the name's own font (1.4.14): on the card's label and in the group's bar; one size for every font
  assert.equal(g.titleFont, 'hand', 'Handwritten until changed');
  await ui.click('#gNameFont button[data-font="medieval"]');
  g = (await ui.get()).groups.find((x) => x.id === HOME);
  assert.equal(g.titleFont, 'medieval', 'the name font is saved');
  assert.ok(await page.$eval('#gNameFont button[data-font="medieval"]', (b) => b.classList.contains('on')), 'and shown as picked');
  assert.equal(await page.$eval('#groupName', (i) => i.dataset.font), 'medieval', 'the group’s bar uses it');
  await ui.click('#gNameFont button[data-font="round"]');
  assert.equal(await page.$eval('#groupName', (i) => getComputedStyle(i).fontSize), '20px', 'the same size in every font');
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
  // Notes inside → Note design…: the notes' pop-up, for the notes in this part (the box unticked: this group's own)
  const inside = d.notes.filter((n) => n.groupId === HOME && !n.deletedAt).length;
  assert.equal(await ui.text('#gNotesCount'), `${inside} notes`, 'Notes inside says how many');
  await ui.click('#gNoteDesign');
  assert.ok(await ui.visible('#editSheet'), 'Note design… opens the notes’ pop-up');
  assert.equal(await ui.text('#editBox h3'), `Note design · ${inside} notes`);
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#editSheet')));
  if (await ui.visible('#groupPanel')) await ui.key('Escape');
  assert.ok(!(await ui.visible('#groupPanel')), 'Escape closes the panel');
  await ui.click('#btnBack');

  // ---- drag & drop
  // 1.3.11: while a note is dragged over another note or a group, that card has the faint outline of a right-clicked card
  const overLook = (from, to) => page.evaluate(([fs, ts]) => {
    const src = document.querySelector(fs); const dst = document.querySelector(ts);
    const dt = new DataTransfer(); const o = { bubbles: true, cancelable: true, dataTransfer: dt };
    src.dispatchEvent(new DragEvent('dragstart', o)); dst.dispatchEvent(new DragEvent('dragenter', o));
    const cs = getComputedStyle(dst); const over = [dst.classList.contains('drop-on'), cs.outlineStyle, cs.outlineWidth, cs.outlineColor];
    src.dispatchEvent(new DragEvent('dragend', o));
    dst.classList.add('ctxon'); const c2 = getComputedStyle(dst); const ctx = [true, c2.outlineStyle, c2.outlineWidth, c2.outlineColor]; dst.classList.remove('ctxon');
    return { over, ctx, left: dst.classList.contains('drop-on') };
  }, [from, to]);
  for (const to of [ui.noteKey(E1), ui.groupKey(HOME)]) {
    const r = await overLook(ui.noteKey(D), to);
    assert.deepEqual(r.over, r.ctx, `dragged over ${to}: the right-click outline`);
    assert.ok(!r.left, 'gone when the drag ends');
  }
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

  // ---- 1.4.9: Undo / Redo of moves (Ctrl+Z / Ctrl+Y), the look of several groups, Move out, Cut / Paste
  await ui.key('Control+z');
  d = await ui.get();
  assert.ok(d.groups.some((x) => x.id === HOME), 'Ctrl+Z: the ungrouped group is back');
  assert.equal(d.notes.find((n) => n.id === B).groupId, HOME); assert.equal(d.groups.find((x) => x.id === KITCHEN).parentId, HOME);
  assert.ok(/Ungroup undone/.test(await ui.text('#toast')), 'and it says so');
  await ui.key('Control+y');
  assert.ok(!(await ui.get()).groups.some((x) => x.id === HOME), 'Ctrl+Y: ungrouped again');
  // the look of several picked groups at once
  await ui.click(ui.groupKey(KITCHEN), { ctrlKey: true }); await ui.click(ui.groupKey(pair), { ctrlKey: true });
  assert.ok(await ui.visible('#bLook'), 'groups picked: a Group look button');
  // 1.4.15 (the owner's wish): the two buttons say what they change: Group look = the groups' cards, Note design = notes
  assert.equal((await ui.text('#bLook')).trim(), 'Group look');
  assert.equal((await ui.text('#bEdit')).trim(), 'Note design');
  assert.ok(/notes inside the selected groups/.test(await page.getAttribute('#bEdit', 'title')), 'Note design says it is for the notes inside');
  await ui.click('#bLook');
  assert.ok(await ui.visible('#lookPop'), 'it opens the looks');
  assert.equal(await ui.text('#lookHead'), '2 groups · their cards, not the notes inside', 'headed with what it changes');
  await ui.click('#lookStyles button[data-style="notebook"]');
  await ui.click('#lookColors [data-gc="mint"]');
  await ui.click('#lookFonts button[data-font="round"]');
  d = await ui.get();
  for (const id of [KITCHEN, pair]) { const gg = d.groups.find((x) => x.id === id); assert.equal(gg.style, 'notebook', 'both got the look'); assert.equal(gg.color, 'mint', 'and the colour'); assert.equal(gg.titleFont, 'round', 'and the name font'); }
  assert.ok(await page.$eval('#lookStyles button[data-style="notebook"]', (b) => b.classList.contains('on')), 'the shared look is lit');
  assert.ok(await page.$eval('#lookFonts button[data-font="round"]', (b) => b.classList.contains('on')), 'the shared name font is lit');
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#lookPop')), 'Escape closes the looks');
  await ui.key('Escape');
  // Move out: the picked ones leave the open group (which then goes away, being empty); Ctrl+Z brings it all back
  await ui.click(ui.groupKey(KITCHEN));
  assert.ok(!(await ui.visible('#bOut')), 'nothing picked: no Move out');
  await ui.click(ui.noteKey(C), { ctrlKey: true }); await ui.click(ui.noteKey(made.id), { ctrlKey: true });
  assert.ok(await ui.visible('#bOut'), 'inside a group: Move out');
  await ui.click('#bOut');
  d = await ui.get();
  assert.equal(d.notes.find((n) => n.id === C).groupId, null); assert.equal(d.notes.find((n) => n.id === made.id).groupId, null, 'both moved out');
  assert.ok(!d.groups.some((x) => x.id === KITCHEN), 'the emptied group went away');
  await ui.key('Control+z');
  d = await ui.get();
  assert.ok(d.groups.some((x) => x.id === KITCHEN && x.style === 'notebook'), 'Ctrl+Z: the group is back, with its look');
  assert.equal(d.notes.find((n) => n.id === C).groupId, KITCHEN); assert.equal(d.notes.find((n) => n.id === made.id).groupId, KITCHEN, 'both back inside');
  if (await ui.visible('#groupHead')) await ui.click('#crumbs button.crumb');
  // Cut and Paste: Ctrl+X, open a group, Ctrl+V; one Ctrl+Z puts both back
  await ui.click(ui.noteKey(A), { ctrlKey: true }); await ui.click(ui.groupKey(pair), { ctrlKey: true });
  await ui.key('Control+x');
  assert.equal(await ui.count('#cards > .card.cut'), 2, 'the cut cards look cut');
  assert.ok(await ui.visible('#bPaste') && (await ui.text('#bulkCount')) === '2 cut', 'the bar offers Paste here');
  await ui.click(ui.groupKey(KITCHEN));
  await ui.key('Control+v');
  d = await ui.get();
  assert.equal(d.notes.find((n) => n.id === A).groupId, KITCHEN); assert.equal(d.groups.find((x) => x.id === pair).parentId, KITCHEN, 'pasted into the open group');
  assert.ok(!(await ui.visible('#bulk')), 'nothing cut any more: the bar goes');
  await ui.key('Control+z');
  d = await ui.get();
  assert.equal(d.notes.find((n) => n.id === A).groupId, null); assert.equal(d.groups.find((x) => x.id === pair).parentId, null, 'one Ctrl+Z: both back');
  await ui.click('#crumbs button.crumb');
  // from the right-click menus: Cut on a card, Paste into a group card
  await ui.menu(ui.noteKey(A), 'Cut (Ctrl+X)');
  await ui.menu(ui.groupKey(KITCHEN), 'Paste into this group (1)');
  assert.equal((await ui.get()).notes.find((n) => n.id === A).groupId, KITCHEN, 'Paste into this group');
  await ui.key('Control+z');
  // Copy: Ctrl+C, then Ctrl+V puts copies in the open group (and again); the originals stay; Ctrl+Z bins the last copies
  const notesNow = async () => (await ui.get()).notes.filter((n) => !n.deletedAt).length;
  const before2 = await notesNow();
  await ui.click(ui.noteKey(A), { ctrlKey: true });
  await ui.key('Control+c');
  assert.equal(await ui.count('#cards > .card.cut'), 0, 'copied cards don’t look cut');
  assert.equal(await ui.text('#bulkCount'), '1 copied');
  await ui.click(ui.groupKey(KITCHEN));
  await ui.key('Control+v');
  d = await ui.get();
  const aCopy = d.notes.find((n) => n.groupId === KITCHEN && n.title === 'Milk' && n.id !== A);
  assert.ok(aCopy, 'a copy of Milk inside Kitchen'); assert.equal(d.notes.find((n) => n.id === A).groupId, null, 'the original stays');
  assert.ok(/Pasted 1 copy/.test(await ui.text('#toast')));
  await ui.key('Control+v');
  assert.equal(await notesNow(), before2 + 2, 'copies can be pasted again');
  await ui.key('Control+z');
  assert.equal(await notesNow(), before2 + 1, 'Ctrl+Z: the last copy goes to the Bin');
  assert.ok(/in the Bin/.test(await ui.text('#toast')));
  await ui.key('Escape');
  await ui.click('#crumbs button.crumb');
  await ui.H['list:trash']({}, aCopy.id); await ui.H['list:destroy']({}, aCopy.id);
  for (const n of (await ui.get()).notes.filter((x) => x.deletedAt && x.title === 'Milk')) await ui.H['list:destroy']({}, n.id);
  await ui.settle();
  // a group can't be pasted inside itself; Escape forgets what was cut
  await ui.menu(ui.groupKey(KITCHEN), 'Cut (Ctrl+X)');
  await ui.click(ui.groupKey(KITCHEN));
  await ui.key('Control+v');
  assert.ok(/inside itself/.test(await ui.text('#toast')), 'not inside itself');
  assert.equal((await ui.get()).groups.find((x) => x.id === KITCHEN).parentId, null);
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#bulk')), 'Escape forgets the cut');
  if (await ui.visible('#groupHead')) await ui.click('#crumbs button.crumb');
  // several cards dragged at once are one Undo step
  await ui.click(ui.noteKey(A), { ctrlKey: true }); await ui.click(ui.noteKey(B), { ctrlKey: true });
  await ui.drag(ui.noteKey(A), ui.groupKey(pair));
  d = await ui.get();
  assert.ok(d.notes.find((n) => n.id === A).groupId === pair && d.notes.find((n) => n.id === B).groupId === pair, 'both dragged in');
  await ui.key('Control+z');
  d = await ui.get();
  assert.ok(d.notes.find((n) => n.id === A).groupId === null && d.notes.find((n) => n.id === B).groupId === null, 'one Ctrl+Z: both back');

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
