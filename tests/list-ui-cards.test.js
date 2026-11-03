'use strict';
// The notes list in a real browser (tests/helpers/list-ui.js): the tabs and their counts, what a card shows (and what a locked
// note's card never shows), a card's menu, search (title, text, picture descriptions), sorting and card sizes, opening a note.
const assert = require('assert');

(async () => {
  let A, B, C, D, E1, G;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    A = await s.note({ title: 'Shopping', html: '<ul class="checklist"><li class="done">milk</li><li>bread</li></ul>', color: 'pink', favorite: true });
    B = await s.note({ html: '<div>Call the plumber</div><div>tomorrow</div>' });
    C = await s.note({ title: 'Secret', html: '<div>my diary text</div>' });
    await s.lock(C);
    D = await s.note({ title: 'Bike', html: '<div>x <img class="att-img" src="stickyfile://x/a.png" alt="A red bike"></div>' });
    G = await s.group([D], { name: 'Garage' });
    E1 = await s.note({ title: 'Old stuff' }); await s.bin(E1);
  });
  const { page } = ui;
  const cardText = (sel) => page.$eval(sel, (c) => c.innerText.replace(/\s+/g, ' ').trim());
  const shown = async () => (await ui.keys()).map((k) => k.slice(2));

  // ---- tabs and counts (the welcome note of a first start is there too)
  const tabs = await page.$$eval('.tab', (t) => t.map((x) => x.textContent.trim().replace(/\s+/g, ' ')));
  assert.deepEqual(tabs, ['Notes 5', 'Favourites 1', 'Locked 1', 'Bin 1', 'Settings'], 'every tab with its count (Notes counts the ones inside groups too, not the binned one)');
  assert.ok((await shown()).includes(G) && !(await shown()).includes(D), 'a note in a group is inside the group card, not loose');

  // ---- what a card shows
  assert.ok(/Shopping/.test(await cardText(ui.noteKey(A))) && /milk/.test(await cardText(ui.noteKey(A))), 'title and text');
  assert.equal(await page.$$eval(`${ui.noteKey(A)} .cb`, (x) => x.length), 2, 'a checklist shows its boxes');
  assert.ok(/plumber/.test(await cardText(ui.noteKey(B))), 'a note without a title shows its text');
  // golden rule: a locked note's text never reaches the list (main doesn't send it, the card doesn't show it)
  const locked = (await ui.get()).notes.find((n) => n.id === C);
  assert.equal(locked.text, '', 'main sends no text for a locked note'); assert.ok(!locked.html, 'and no html');
  // 1.1.30: the title is hidden (and encrypted) too: the card says "Locked note" (or its title while locked)
  assert.ok(/Locked note/.test(await cardText(ui.noteKey(C))) && !/diary|Secret/.test(await page.content()), 'its card shows “Locked note”, the title and text are nowhere in the window');
  assert.ok(await ui.count(`${ui.noteKey(C)} .lockb.on`), 'a locked note has the unlock button');
  assert.equal(await ui.count(`${ui.noteKey(C)} button[title^="Move to Bin"]`), 0, 'and no bin button (locked notes can’t be deleted)');

  // ---- a card's right-click menu: favourites first, then Edit design…; no "Open on desktop" (1.1.23)
  await ui.rclick(ui.noteKey(B));
  const menu = await ui.menuLabels(); await ui.key('Escape');
  assert.ok(!menu.includes('Open on desktop') && !menu.includes('Bring to front'), `no Open on desktop (${menu.join(' | ')})`);
  assert.ok(menu.indexOf('Add to favourites') >= 0 && menu.indexOf('Add to favourites') < menu.indexOf('Edit design…') && menu.indexOf('Edit design…') < menu.indexOf('Duplicate note'), `menu order: ${menu.join(' | ')}`);

  // ---- search: title, text, picture words; only notes; nothing found; clear
  await ui.type('#q', 'plumb');
  assert.deepEqual(await shown(), [B], 'search finds the text');
  await ui.type('#q', 'SHOPPING');
  assert.deepEqual(await shown(), [A], 'search finds the title, any case');
  await ui.type('#q', 'red bike');
  assert.deepEqual(await shown(), [D], 'search finds a picture’s description, also inside a group');
  await ui.type('#q', 'diary');
  assert.deepEqual(await shown(), [], 'a locked note is not found by its hidden text');
  assert.ok(/Nothing found/.test(await ui.text('#cards')), 'says nothing was found');
  await ui.click('#qClear');
  assert.equal(await page.inputValue('#q'), ''); assert.ok((await shown()).includes(A), 'the clear button shows everything again');
  await ui.type('#q', 'milk'); await ui.key('Escape');
  assert.equal(await page.inputValue('#q'), '', 'Escape clears the search');

  // ---- the other tabs
  await ui.tab('favs');
  assert.deepEqual(await shown(), [A], 'Favourites: only the favourite');
  await ui.tab('locks');
  assert.deepEqual(await shown(), [C], 'Locked: the locked note');
  assert.ok(await ui.visible('#btnUnlockAll'), 'with Unlock all');
  await ui.tab('bin');
  assert.ok(await ui.visible('#viewBin') && !(await ui.visible('#viewNotes')), 'the Bin has its own view');
  assert.ok(/Old stuff/.test(await ui.text('#binCards')), 'the binned note is in the Bin');
  await ui.tab('settings'); assert.ok(await ui.visible('#viewSettings'));
  await ui.tab('settings');
  assert.ok(await ui.visible('#binCards'), 'Settings again goes back to the tab before (the Bin)');
  await ui.tab('notes');

  // ---- sorting (saved in the settings)
  await ui.click('#btnSort');
  assert.ok(await ui.visible('#sortPop'));
  await ui.click('#sortPop [data-key="by"] button[data-v="created"]');
  await ui.click('#sortPop [data-key="dir"] button[data-v="asc"]');
  await ui.click('#sortPop [data-key="groups"] button[data-v="last"]');
  const data = await ui.get();
  assert.deepEqual(data.settings.listSort, { by: 'created', dir: 'asc', groups: 'last' }, 'the sort is saved');
  const order = await shown();
  assert.equal(order[order.length - 1], G, 'groups last');
  const made = (id) => data.notes.find((n) => n.id === id).createdAt;
  const noteOrder = order.filter((id) => id !== G);
  assert.deepEqual(noteOrder, [...noteOrder].sort((x, y) => made(x) - made(y)), 'notes oldest first');
  await ui.down('body');
  assert.ok(!(await ui.visible('#sortPop')), 'a click elsewhere closes the sort menu');

  // ---- card sizes: the menu, then Ctrl + mouse wheel
  await ui.click('#btnSize');
  await ui.click('#sizeSeg button[data-v="l"]');
  assert.equal((await ui.get()).settings.listSize, 'l', 'the size is saved');
  await ui.key('Escape');
  await page.mouse.move(500, 400); await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await ui.settle(300);
  assert.equal((await ui.get()).settings.listSize, 'xl', 'Ctrl + wheel up: one size bigger');
  assert.ok(/Extra large/.test(await ui.text('#toast')), 'and says which');

  // ---- clicking a card opens the note; the card's button closes it again (it stays in the list)
  assert.ok(!(await ui.get()).notes.find((n) => n.id === B).open);
  await ui.click(ui.noteKey(B));
  assert.ok((await ui.get()).notes.find((n) => n.id === B).open, 'click: the note opens on the desktop');
  await ui.click(`${ui.noteKey(B)} button[title^="Close this note"]`);
  const b = (await ui.get()).notes.find((n) => n.id === B);
  assert.ok(!b.open && !b.deletedAt, 'closed, still there');
  // ---- a background refresh (a note was edited) builds only that note's card again (1.2.3: speed); the other cards
  // stay the same elements, keep their effect, and the new card is measured and gets its effect too
  await ui.H['settings:set']({}, { fxEffect: 'snow' }); await ui.settle(200);
  await ui.H['list:open-note']({}, B); await ui.settle();
  const keepA = await page.$(ui.noteKey(A)); const oldB = await page.$(ui.noteKey(B));
  const win = ui.E.__all.find((x) => x.noteId === B && !x.destroyed);
  await ui.H['note:update']({ sender: win.webContents }, { html: '<div>Call the plumber</div><div>on Friday</div>', text: 'Call the plumber\non Friday' });
  await ui.settle(200);
  assert.ok(await keepA.evaluate((el) => el.isConnected), 'an unchanged card is kept as it was');
  assert.ok(!(await oldB.evaluate((el) => el.isConnected)), 'the edited note’s card is built again');
  assert.ok(/Friday/.test(await cardText(ui.noteKey(B))), 'showing the new words');
  assert.equal(await page.$eval(`${ui.noteKey(B)} > .body`, (b) => b.dataset.m), '1', 'the new card is measured (fade at the bottom)');
  assert.ok(await ui.count(`${ui.noteKey(B)} > canvas.fxc`) && await keepA.evaluate((el) => !!el.querySelector(':scope > canvas.fxc')), 'both have their effect');
  await ui.H['settings:set']({}, { fxEffect: 'none' }); await ui.settle(200);
  assert.equal(await ui.count('#cards canvas.fxc'), 0, 'an effect setting changed: every card is looked at again');
  await ui.H['list:close-note']({}, B); await ui.settle();
  // Ctrl+N makes a new note
  const before = (await ui.get()).notes.length;
  await ui.key('Control+n');
  assert.equal((await ui.get()).notes.length, before + 1, 'Ctrl+N: a new note');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
