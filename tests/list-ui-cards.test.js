'use strict';
// The notes list in a real browser (tests/helpers/list-ui.js): the tabs and their counts, what a card shows (and what a locked
// note's card never shows; a title in its own font, 1.3.3), a card's menu, search (title, text, picture descriptions), sorting and card sizes, opening a note, reminders on cards (1.4.1), "Over …" on a note pinned over some apps (1.4.5).
const assert = require('assert');

(async () => {
  let A, B, C, D, E1, G;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password();
    A = await s.note({ title: 'Shopping', html: '<ul class="checklist"><li class="done">milk</li><li>bread</li></ul>', color: 'pink', favorite: true, titleFont: 'medieval' });
    B = await s.note({ font: 'round', html: '<div><font face="Augusta">Call the plumber</font></div><div><b>tomorrow</b> <font color="#D93B3B">early</font></div>' }); // 1.3.11: formatting
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
  assert.ok(/^"?Augusta/.test(await page.$eval(`${ui.noteKey(A)} .tt`, (t) => getComputedStyle(t).fontFamily)), '1.3.3: the title in its own font (Medieval)');
  assert.equal(await ui.count(`${ui.noteKey(C)} [data-tfont]`), 0, 'a card without a title font: none');
  assert.ok(/plumber/.test(await cardText(ui.noteKey(B))), 'a note without a title shows its text');
  // golden rule: a locked note's text never reaches the list (main doesn't send it, the card doesn't show it)
  const locked = (await ui.get()).notes.find((n) => n.id === C);
  assert.equal(locked.text, '', 'main sends no text for a locked note'); assert.ok(!locked.html, 'and no html');
  // 1.1.30: the title is hidden (and encrypted) too: the card says "Locked note" (or its title while locked)
  assert.ok(/Locked note/.test(await cardText(ui.noteKey(C))) && !/diary|Secret/.test(await page.content()), 'its card shows “Locked note”, the title and text are nowhere in the window');
  assert.ok(await ui.count(`${ui.noteKey(C)} .lockb.on`), 'a locked note has the unlock button');
  assert.equal(await ui.count(`${ui.noteKey(C)} button[title^="Move to Bin"]`), 0, 'and no bin button (locked notes can’t be deleted)');

  // ---- the words on a card look as in the note (1.3.11): a line in another font, bold, a colour (store.js cardRuns)
  const runs = await page.$$eval(`${ui.noteKey(B)} .ln .run`, (rs) => rs.map((r) => [r.textContent, getComputedStyle(r).fontFamily.split(',')[0].replace(/"/g, ''), getComputedStyle(r).fontWeight, getComputedStyle(r).color]));
  assert.deepEqual(runs.map((r) => r[0]), ['Call the plumber', 'tomorrow', 'early'], `runs: ${JSON.stringify(runs)}`);
  assert.equal(runs[0][1], 'Augusta', 'the line in Medieval shows in Medieval');
  assert.ok(Number(runs[1][2]) >= 700, 'bold'); assert.equal(runs[2][3], 'rgb(217, 59, 59)', 'its colour');
  assert.equal(await ui.text(`${ui.noteKey(B)} .ln:nth-child(2)`), 'tomorrow early', 'the words are the same');

  // 1.4.12: a font changes no size, as in the note: words in another font are the card's size, the letters matched
  // (font-size-adjust); every note font has the same card text size
  const px = (sel) => page.$eval(sel, (el) => parseFloat(getComputedStyle(el).fontSize));
  const medPx = await px(`${ui.noteKey(B)} .ln:nth-child(1) .run`); const basePx = await px(`${ui.noteKey(B)} .ln:nth-child(2)`);
  assert.ok(Math.abs(medPx - basePx) < 0.01, `Medieval words ${medPx}px in a ${basePx}px Rounded card`);
  assert.equal(await page.$eval(`${ui.noteKey(B)} .txt`, (el) => getComputedStyle(el).fontSizeAdjust), '0.484', 'the letters matched to Rounded\'s');
  assert.equal(await px(`${ui.noteKey(A)} .txt`), basePx, 'a Rounded and a Handwritten card: one text size');

  // ---- a card's right-click menu: favourites first, then Edit design…; no "Open on desktop" (1.1.23)
  await ui.rclick(ui.noteKey(B));
  const menu = await ui.menuLabels(); await ui.key('Escape');
  assert.ok(!menu.includes('Open on desktop') && !menu.includes('Bring to front'), `no Open on desktop (${menu.join(' | ')})`);
  assert.ok(menu.indexOf('Add to favourites') >= 0 && menu.indexOf('Add to favourites') < menu.indexOf('Note design…') && menu.indexOf('Note design…') < menu.indexOf('Duplicate note'), `menu order: ${menu.join(' | ')}`);

  // ---- Edit design's Title font (1.3.11): the one saved is lit, the preview's title uses it; a pick saves titleFont
  await ui.menu(ui.noteKey(A), 'Note design…');
  assert.ok(await ui.visible('#editTFonts [data-tfont="medieval"].on') && !(await ui.visible('#editFontRow')), 'one note: Title font, no Font row');
  assert.equal(await page.getAttribute('#editTitle', 'data-tfont'), 'medieval');
  assert.equal(await page.getAttribute('#editCover', 'data-tfont'), 'medieval', 'Title while locked in it too');
  const rowsOrder = await page.$$eval('#editPaper, #editCoverRow, #editTFontRow, #editTabs', (els) => els.map((e) => e.id));
  assert.deepEqual(rowsOrder, ['editPaper', 'editCoverRow', 'editTFontRow', 'editTabs'], 'the title, Title while locked, Title font, then the tabs');
  const tabsAt = () => page.$eval('#editTabs', (t) => t.getBoundingClientRect().top);
  const top0 = await tabsAt();
  await ui.click('#editTFonts [data-tfont="round"]');
  assert.equal(await tabsAt(), top0, '1.3.12: nothing below moves when the font changes');
  assert.equal((await ui.get()).notes.find((n) => n.id === A).titleFont, 'round', 'saved');
  assert.equal(await page.getAttribute(`${ui.noteKey(A)} .t1`, 'data-tfont'), 'round', 'the card shows it');
  await ui.click('#editTFonts [data-tfont="medieval"]'); await ui.key('Escape');

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
  // ---- a background refresh (a note was edited) changes only that note's card (1.2.3: speed); the other cards stay as
  // they were. 1.4.16: the edited card stays too (a new one made it blink): it is filled again, measured again, and keeps
  // its effect (the same canvas: the snow doesn't start over)
  await ui.H['settings:set']({}, { fxEffect: 'snow' }); await ui.settle(200);
  await ui.H['list:open-note']({}, B); await ui.settle();
  const keepA = await page.$(ui.noteKey(A)); const oldB = await page.$(ui.noteKey(B));
  await page.$eval(`${ui.noteKey(B)} > canvas.fxc`, (cv) => { window.__fxB = cv; });
  const win = ui.E.__all.find((x) => x.noteId === B && !x.destroyed);
  await ui.H['note:update']({ sender: win.webContents }, { html: '<div>Call the plumber</div><div>on Friday</div>', text: 'Call the plumber\non Friday' });
  await ui.settle(200);
  assert.ok(await keepA.evaluate((el) => el.isConnected), 'an unchanged card is kept as it was');
  assert.ok(await oldB.evaluate((el) => el.isConnected), 'the edited note’s card stays');
  assert.ok(/Friday/.test(await cardText(ui.noteKey(B))), 'showing the new words');
  assert.equal(await page.$eval(`${ui.noteKey(B)} > .body`, (b) => b.dataset.m), '1', 'its new words are measured (fade at the bottom)');
  assert.ok(await page.$eval(`${ui.noteKey(B)} > canvas.fxc`, (cv) => cv === window.__fxB && cv.parentElement.firstElementChild === cv), 'its effect carries on (the same canvas, still first)');
  assert.ok(await keepA.evaluate((el) => !!el.querySelector(':scope > canvas.fxc')), 'the other card keeps its effect');
  await ui.H['settings:set']({}, { fxEffect: 'none' }); await ui.settle(200);
  assert.equal(await ui.count('#cards canvas.fxc'), 0, 'an effect setting changed: every card is looked at again');
  await ui.H['list:close-note']({}, B); await ui.settle();
  // ---- 1.4.1: reminders (main's side: reminders.test.js). A card with a reminder has a clock (what it is on hover); a note a
  // reminder hides is left out, unless the reminders filter is on (faded there) or Settings shows them; the filter shows only
  // notes with reminders, the soonest first; right-click → Reminders… opens them with their messages (not on a locked card)
  {
    const now = Date.now();
    const had = new Set((await ui.get()).notes.map((n) => n.id));
    await ui.H['list:new']({}, null);
    const X = (await ui.get()).notes.map((n) => n.id).find((x) => !had.has(x));
    await ui.H['list:remind-set']({}, A, [{ id: 'shop1', start: now + 3600e3 }], { shop1: 'Before 6' });
    await ui.H['list:remind-set']({}, X, [{ id: 'hid01', start: now + 86400e3, hide: true }], {});
    await ui.settle();
    assert.ok(await ui.visible(`${ui.noteKey(A)} .rem`), 'a card with a reminder has a clock');
    assert.match(await page.getAttribute(`${ui.noteKey(A)} .rem`, 'title'), /^(Today|Tomorrow) \d\d:\d\d/, 'its time on hover');
    assert.ok(!(await shown()).includes(X), 'a note a reminder hides is not in the list');
    await ui.click('#btnRem');
    assert.deepEqual(await shown(), [A, X], 'the filter: notes with reminders only, the soonest first, hidden ones too');
    assert.ok(await page.$eval(ui.noteKey(X), (c) => c.classList.contains('remhid')), 'a hidden one is faded');
    await ui.click('#btnRem');
    await ui.H['settings:set']({}, { remindShowHidden: true }); await ui.settle();
    assert.ok((await shown()).includes(X), 'Settings → Show hidden notes');
    await ui.H['settings:set']({}, { remindShowHidden: false }); await ui.settle();
    await ui.menu(ui.noteKey(A), 'Reminders…');
    assert.ok(await ui.visible('#remSheet'), 'right-click → Reminders…');
    assert.match(await ui.text('#remSheet .rm-item small'), /Before 6/, 'with its message');
    await ui.click('#remSheet .rm-add');
    await ui.click('#remSheet .rm-chip[data-p="h1"]');
    await ui.click('#remSheet .rm-save');
    assert.equal((await ui.get()).notes.find((n) => n.id === A).reminders.length, 2, 'one more, saved');
    assert.equal(await ui.count('#remSheet .rm-item'), 2);
    await ui.key('Escape');
    assert.ok(!(await ui.visible('#remSheet')), 'Esc closes it');
    await ui.rclick(ui.noteKey(C));
    assert.ok(!(await ui.menuLabels()).includes('Reminders…'), 'not on a locked card');
    await ui.down('.searchrow');
  }
  // 1.4.5: pinned over some apps only (main/app-pin.js): the card says over which (the apps on hover)
  {
    await ui.H['list:open-note']({}, A);
    const wA = ui.E.__all.find((x) => x.noteId === A && !x.destroyed);
    await ui.H['note:update']({ sender: wA.webContents }, { pinApps: [{ app: 'Excel', part: null }, { app: 'Visual Studio Code', part: 'ShopWebsite' }] });
    await ui.settle();
    assert.equal(await ui.text(`${ui.noteKey(A)} .over`), 'Over Excel +1', 'the card says “Over …”');
    assert.match(await page.getAttribute(`${ui.noteKey(A)} .over`, 'title'), /Excel\nVisual Studio Code: ShopWebsite/);
    assert.equal(await page.getAttribute(`${ui.noteKey(A)} .pin`, 'title'), 'Pinned over some apps');
    await ui.H['note:update']({ sender: wA.webContents }, { pinned: false });
    await ui.settle();
    assert.equal(await ui.count(`${ui.noteKey(A)} .over`), 0, 'unpinned: gone');
  }
  // 1.4.16: a note that changes keeps its card (a new card swapped in made it blink), and only its new letters write
  // themselves in (Ink: .ink, one after the other)
  {
    const wA = ui.E.__all.find((x) => x.noteId === A && !x.destroyed);
    const inked = () => page.$$eval(`${ui.noteKey(A)} .ink`, (x) => x.map((s) => s.textContent).join(''));
    const write = async (lis) => { await ui.H['note:update']({ sender: wA.webContents }, { html: `<ul class="checklist">${lis.map((t, i) => `<li${i ? '' : ' class="done"'}>${t}</li>`).join('')}</ul>`, text: lis.join('\n') }); await ui.settle(); };
    await page.$eval(ui.noteKey(A), (c) => { window.__card = c; });
    await write(['milk', 'bread', 'eggs']);
    assert.ok(await page.$eval(ui.noteKey(A), (c) => c === window.__card), 'the same card, filled again');
    assert.equal(await inked(), 'eggs', 'only the new line writes itself in');
    assert.equal(await page.$$eval(`${ui.noteKey(A)} .ink`, (x) => x.map((s) => parseInt(s.style.animationDelay, 10)).join()), '0,22,44,66', 'letter after letter');
    await write(['milk', 'bread', 'eggs x6']);
    assert.equal(await inked(), ' x6', 'a line typed on: only its new letters');
    await write(['milk', 'butter', 'bread', 'eggs x6']);
    assert.equal(await inked(), 'butter', 'a line put in between: the lines after it don\'t write themselves in again');
    await write(['milk', 'bread', 'eggs x6']);
    assert.equal(await inked(), '', 'a line taken out: nothing writes itself in');
    assert.ok(await page.$eval(ui.noteKey(A), (c) => c === window.__card && c.classList.contains('is-fav') && /eggs x6/.test(c.innerText)), 'still the same card, still a favourite');
    await ui.rclick(ui.noteKey(A));
    assert.ok((await ui.menuLabels()).includes('Remove from favourites'), 'its menu is the note\'s as it is now');
    await ui.key('Escape');
  }
  // Ctrl+N makes a new note
  const before = (await ui.get()).notes.length;
  await ui.key('Control+n');
  assert.equal((await ui.get()).notes.length, before + 1, 'Ctrl+N: a new note');
  // Ctrl+Shift+T (1.3.30): the note closed last (B, closed above) opens again
  await ui.key('Control+Shift+t');
  assert.ok((await ui.get()).notes.find((x) => x.id === B).open, 'Ctrl+Shift+T: the closed note is open again');
  assert.ok(ui.E.__all.some((x) => x.noteId === B && !x.destroyed), 'in its own window');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
