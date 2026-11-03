'use strict';
// The clicks, typing, keys and drags the recorder runs on the "All notes" window (the same for old and new code).
// Events are sent straight to the elements: Playwright's mouse actions wait for an element to stand still and be
// uncovered, and the cards wobble. A step that finds nothing to click logs that as a STEP-ERROR (the same in both runs).
module.exports = async ({ page, step }) => {
  page.setDefaultTimeout(1500);
  const note = (k) => `#cards .card:not(.group) >> nth=${k}`;
  const group = (k = 0) => `#cards .card.group:not(.locked) >> nth=${k}`; // a locked group asks for the password first
  const el = (sel) => page.locator(sel).first();
  const click = (sel, init = {}) => el(sel).dispatchEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  const dbl = (sel) => el(sel).dispatchEvent('dblclick', { bubbles: true, cancelable: true });
  const down = (sel, init = {}) => el(sel).dispatchEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...init });
  const press = (sel, key) => el(sel).dispatchEvent('keydown', { bubbles: true, cancelable: true, key });
  const check = (sel) => el(sel).evaluate((x) => x.click()); // checkboxes: a real click flips them and fires change
  // right-click at a fixed point (a card's own position still moves while it wobbles in)
  const rclick = (sel) => el(sel).evaluate((x) => {
    const o = { bubbles: true, cancelable: true, button: 2, clientX: 300, clientY: 320 };
    x.dispatchEvent(new MouseEvent('mousedown', o)); x.dispatchEvent(new MouseEvent('contextmenu', o));
  });
  const setVal = (sel, v) => el(sel).evaluate((x, val) => { x.value = val; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const menu = async (sel, label) => {
    await rclick(sel);
    const item = page.locator('#ctx:not([hidden]) button', { hasText: label });
    if (!(await item.count())) throw new Error(`no menu item ${label}`);
    await item.first().dispatchEvent('click');
  };
  // the pop-up's buttons are pressed only while it is open (its OK button submits a form: pressed while hidden, the page reloads)
  const open = () => page.isVisible('#modal');
  const mclick = async (sel) => { if (!(await open())) throw new Error('no pop-up open'); await click(sel); };
  const modalOk = async (values = []) => {
    if (!(await open())) throw new Error('no pop-up open');
    const ins = await page.$$('#mInputs input');
    for (let k = 0; k < values.length && k < ins.length; k++) await ins[k].evaluate((x, v) => { x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); }, values[k]);
    await click('#mOk');
  };
  const drag = async (from, to) => {
    const a = await el(from).elementHandle(); const b = await el(to).elementHandle();
    await page.evaluate(([src, dst]) => {
      const dt = new DataTransfer(); const r = dst.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 10 };
      src.dispatchEvent(new DragEvent('dragstart', o));
      dst.dispatchEvent(new DragEvent('dragenter', o)); dst.dispatchEvent(new DragEvent('dragover', o));
      dst.dispatchEvent(new DragEvent('dragleave', { ...o, relatedTarget: document.body }));
      dst.dispatchEvent(new DragEvent('dragenter', o)); dst.dispatchEvent(new DragEvent('drop', o));
      src.dispatchEvent(new DragEvent('dragend', o));
    }, [a, b]);
  };
  const mouseBtn = (b) => page.evaluate((btn) => { window.dispatchEvent(new MouseEvent('mousedown', { button: btn, bubbles: true, cancelable: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: btn, bubbles: true, cancelable: true })); }, b);
  const key = (k) => page.keyboard.press(k);
  const body = () => page.locator('body').dispatchEvent('mousedown', { bubbles: true });
  const tab = (t) => click(`.tab[data-tab="${t}"]`);
  const home = async () => { await tab('notes'); for (let k = 0; k < 4 && (await page.isVisible('#btnBack')); k++) await click('#btnBack'); };

  // ---- tabs, search, sort, sizes, wheel
  for (const t of ['favs', 'locks', 'bin', 'settings', 'settings', 'notes']) await step(`tab ${t}`, () => tab(t));
  await step('search plumb', () => setVal('#q', 'plumb'));
  await step('search bike (picture words)', () => setVal('#q', 'bike'));
  await step('search nothing', () => setVal('#q', 'zzzz'));
  await step('search clear', () => click('#qClear'));
  await step('sort open', () => click('#btnSort'));
  for (let b = 0; b < 7; b++) await step(`sort button ${b}`, () => click(`#sortPop .seg button >> nth=${b}`));
  await step('size open', () => click('#btnSize'));
  for (let b = 0; b < 5; b++) await step(`size button ${b}`, () => click(`#sizeSeg button >> nth=${b}`));
  await step('size back to m', () => click('#sizeSeg button[data-v="m"]'));
  await step('click outside closes pops', body);
  await step('ctrl+wheel up', async () => { await page.mouse.move(500, 400); await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.clock.runFor(500); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); });
  await step('ctrl+wheel down', async () => { await page.keyboard.down('Control'); await page.mouse.wheel(0, 120); await page.clock.runFor(500); await page.mouse.wheel(0, 120); await page.keyboard.up('Control'); });
  await step('pointer over an effect card', () => el('#cards .fxc').evaluate((cv) => { const x = cv.parentElement; const r = x.getBoundingClientRect(); for (let k = 0; k < 5; k++) x.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 10 + k * 8, clientY: r.top + 20 })); x.dispatchEvent(new PointerEvent('pointerleave', {})); }));
  await step('colour row arrows', async () => { await tab('settings'); await click('#viewSettings .phead >> nth=1'); await down('.swarr.r'); await click('.swarr.r'); await click('.swarr.l'); });
  await step('colour row wheel + drag', () => el('.swarr.r').evaluate((a) => {
    const v = a.parentElement.querySelector('.sws, .swview') || a.parentElement;
    v.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 }));
    const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: 200, clientY: 10 };
    v.dispatchEvent(new PointerEvent('pointerdown', o)); v.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: 150 })); v.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 150 }));
  }));
  await step('back to notes', () => tab('notes'));

  // ---- a card's own buttons
  await step('star a note', () => click(`${note(1)} >> .fav`));
  await step('unstar it', () => click(`${note(1)} >> .fav`));
  await step('open a note', () => click(note(0)));
  await step('close a note (card button)', () => click('#cards .card button[title^="Close this note"]'));
  await step('open on desktop (card button)', () => click('#cards .card button[title="Open on desktop"]'));
  await step('bin a note asks', () => click('#cards .card button[title^="Move to Bin"]'));
  await step('bin cancel', () => mclick('#mCancel'));
  await step('lock a note (card button)', () => click(`${note(2)} >> .lockb`));
  await step('lock pop-up ok', () => modalOk(['pw1234']));

  // ---- groups: open, header, panel, back
  await step('open group', () => click(group(0)));
  await step('rename group', async () => { await setVal('#groupName', 'Home sweet'); await press('#groupName', 'Enter'); await page.clock.runFor(400); });
  await step('take a note out (card button)', () => click('#cards .card button[title^="Take out of the group"]'));
  await step('group settings', () => click('#btnGroupSettings'));
  for (const s of ['#gStyles button', '#gColors button', '#gNoteColors button', '#gFont button']) {
    for (let k = 0; k < 3; k++) await step(`panel ${s} ${k}`, () => click(`${s} >> nth=${k}`));
  }
  await step('panel inner', () => check('#gInner'));
  await step('panel lock', () => click('#gLock'));
  await step('panel lock ok', () => modalOk(['pw1234']));
  await step('relock group button', () => click('#btnRelockGroup'));
  await step('panel close', () => click('#btnGroupSettings'));
  await step('open subgroup', () => click(group(0)));
  await step('crumb back', () => click('#crumbs button.crumb'));
  await step('open group again', () => click(group(0)));
  await step('new note inside group', () => click('#btnNew'));
  await step('empty-state new note', () => click('#cards .pill'));
  await step('mouse back', () => mouseBtn(3));
  await step('mouse forward', async () => { await page.clock.runFor(400); await mouseBtn(4); });
  await step('search inside group', () => setVal('#q', 'line'));
  await step('escape clears search', () => key('Escape'));
  await step('escape goes up', async () => { await body(); await key('Escape'); });
  await step('back button', () => click('#btnBack'));

  // ---- drag & drop
  await home();
  await step('three new notes', async () => { for (let k = 0; k < 3; k++) { await click('#btnNew'); await page.clock.runFor(200); } });
  await step('drag note onto note', () => drag(note(1), note(2)));
  await step('drag note onto group', () => drag(note(1), group(0)));
  await step('drag group into group', () => drag('#cards .card.group:not(.locked) >> nth=1', '#cards .card.group:not(.locked)'));
  await step('drag a note onto the open group\'s crumb', async () => { await click('#cards .card.group:not(.locked)'); await click('#cards .card.group:not(.locked)'); if (await page.isVisible('#crumbs button.crumb')) await drag(note(0), '#crumbs button.crumb'); await home(); });
  await step('drag group onto itself (refused)', () => drag(group(0), group(0)));
  await step('open group, drag out to back button', async () => { await click(group(0)); await drag('#cards .card', '#btnBack'); });
  await step('drag onto a crumb', async () => { if (await page.isVisible('#crumbs button.crumb')) await drag('#cards .card', '#crumbs button.crumb'); });
  await step('back home', home);

  // ---- picking cards and the bar
  await home();
  await step('ctrl+click pick', () => click(note(0), { ctrlKey: true }));
  await step('shift+click range', () => click(note(3), { shiftKey: true }));
  await step('ctrl+click unpick', () => click(note(3), { ctrlKey: true }));
  await step('ctrl+click group', () => click(group(0), { ctrlKey: true }));
  for (const b of ['#bFav', '#bFav', '#bColor']) await step(`bar ${b}`, () => click(b));
  await step('bar colour swatch', () => click('#bulkSws button >> nth=3'));
  await step('bar colour again', () => click('#bColor'));
  await step('bar font hand', () => click('#bulkColors .bfonts button >> nth=0'));
  await step('bar colour again 2', () => click('#bColor'));
  await step('bar font round', () => click('#bulkColors .bfonts button >> nth=1'));
  for (const lab of ['Open on desktop', 'Close notes', 'Clear selection']) {
    await step(`pick 2 + menu ${lab}`, async () => { await click(note(0), { ctrlKey: true }); await click(note(1), { ctrlKey: true }); await menu(note(0), lab); });
  }
  await step('bar close', async () => { await click(note(0), { ctrlKey: true }); await click('#bClose'); });
  await step('bar open', () => click('#bOpen'));
  await step('bar lock', () => click('#bLock'));
  await step('bar lock ok', () => modalOk(['pw1234']));
  await step('ctrl+a', async () => { await body(); await key('Control+a'); });
  await step('escape clears picks', () => key('Escape'));
  await step('pick 2, menu: lock', async () => { await click(note(1), { ctrlKey: true }); await click(note(2), { ctrlKey: true }); await menu(note(1), 'Lock'); });
  await step('lock ok', () => modalOk(['pw1234']));
  await step('pick 2, group them', async () => { await key('Escape'); await click(note(0), { ctrlKey: true }); await click(note(1), { ctrlKey: true }); await click('#bGroup'); });
  await step('pick 2, menu: new group', async () => { await click(note(0), { ctrlKey: true }); await click(note(1), { ctrlKey: true }); await menu(note(0), 'Put together in a new group'); });
  await step('pick, bin (asks)', async () => { await key('Escape'); await click(note(1), { ctrlKey: true }); await click('#bBin'); });
  await step('bin pop-up cancel', () => mclick('#mCancel'));
  await step('delete key asks', () => key('Delete'));
  await step('delete pop-up ok', () => mclick('#mOk'));
  await step('pick, shift+delete', async () => { await click(note(1), { ctrlKey: true }); await key('Shift+Delete'); });
  await step('pick 2, drag together onto a group', async () => { await click(note(0), { ctrlKey: true }); await click(note(1), { ctrlKey: true }); await drag(note(0), group(0)); });
  await step('pick and clear with x', async () => { await click(note(0), { ctrlKey: true }); await click('#bX'); });
  await step('click empty space clears', async () => { await click(note(0), { ctrlKey: true }); await down('#viewNotes'); });

  // ---- right-click menus (on fresh notes: by now the earlier ones are in groups)
  await home();
  await step('four new notes', async () => { for (let k = 0; k < 4; k++) { await click('#btnNew'); await page.clock.runFor(200); } });
  await step('lock a fresh note (card button)', () => click(`${note(3)} >> .lockb`));
  await step('lock ok', () => modalOk(['pw1234']));
  for (const lab of ['Add to favourites', 'Remove from favourites', 'Duplicate note', 'Select (Ctrl+click)', 'Close note', 'Edit design…']) await step(`note menu: ${lab}`, async () => { await key('Escape'); await key('Escape'); await menu(note(0), lab); });
  await step('edit escape', () => key('Escape'));
  await step('note menu: Lock note', () => menu(note(1), 'Lock note'));
  await step('lock ok', () => modalOk(['pw1234']));
  await step('note menu: locked can’t be deleted', () => menu('#cards .card:not(.group):has(.lockb.on)', 'Locked'));
  await step('note menu: Remove lock…', () => menu('#cards .card:not(.group):has(.lockb.on)', 'Remove lock…'));
  await step('remove lock wrong', () => modalOk(['nope']));
  await step('remove lock right', () => modalOk(['pw1234']));
  await step('remove lock cancel', async () => { if (await open()) await mclick('#mCancel'); });
  await step('note menu: Move to Bin', () => menu(note(2), 'Move to Bin'));
  await step('bin ok', () => modalOk());
  await step('group menu: Add to favourites', () => menu(group(0), 'Add to favourites'));
  await step('group menu: Remove from favourites', () => menu(group(0), 'Remove from favourites'));
  await step('group menu: Select', () => menu(group(0), 'Select (Ctrl+click)'));
  await step('group menu: Lock group', async () => { await key('Escape'); await menu('#cards .card.group:not(.locked)', 'Lock group'); });
  await step('lock ok', () => modalOk(['pw1234']));
  await step('group menu: Remove lock…', () => menu('#cards .card.group.locked, #cards .card.group:has(.lockb.on)', 'Remove lock…'));
  await step('remove lock ok', () => modalOk(['pw1234']));
  await step('group menu: Group settings…', () => menu(group(0), 'Group settings…'));
  await step('panel ungroup asks', () => click('#gUngroup'));
  await step('ungroup cancel', () => mclick('#mCancel'));
  await step('panel bin asks', () => click('#gTrash'));
  await step('panel bin cancel', () => mclick('#mCancel'));
  await step('group menu inside: Move up one level', () => menu(group(0), 'Move up one level'));
  await step('note menu inside: Take out of group', () => menu(note(0), 'Take out of group'));
  await step('home', home);
  await step('group menu: Open group', () => menu(group(0), 'Open group'));
  await step('home again', home);
  await step('group menu: Ungroup…', () => menu(group(0), 'Ungroup…'));
  await step('ungroup ok', () => modalOk());
  await step('group menu: Move its notes to Bin…', () => menu(group(0), 'Move its notes to Bin…'));
  await step('group bin ok', () => modalOk());

  // ---- Edit design
  await step('edit design open', () => menu(note(0), 'Edit design…'));
  await step('edit title', () => setVal('#editTitle', 'Gifts!'));
  await step('edit title enter', () => press('#editTitle', 'Enter'));
  await step('edit design again', () => menu(note(0), 'Edit design…'));
  await step('edit colour', () => click('#editColors button >> nth=5'));
  await step('edit opacity', () => setVal('#editOpacity', '70'));
  for (const t of ['e', 'f', 'look', 'e']) await step(`edit tab ${t}`, () => click(`#editTabs [data-tab="${t}"]`));
  await step('edit pick effect', () => click('#editFxEffects button >> nth=4'));
  await step('edit effect amount', () => click('#editFxEAmt button >> nth=2'));
  await step('edit effect opacity', () => setVal('#editFxEOp input, input#editFxEOp', '60'));
  await step('edit interact', () => check('#editFxInteract'));
  await step('edit preview pointer', () => el('#editFxCanvas').evaluate((x) => { x.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 20, clientY: 20 })); x.dispatchEvent(new PointerEvent('pointerleave', {})); }));
  await step('edit tab f', () => click('#editTabs [data-tab="f"]'));
  await step('edit pick follower', () => click('#editFxFollowers button >> nth=3'));
  await step('edit follower amount', () => click('#editFxFAmt button >> nth=1'));
  await step('edit follower opacity', () => setVal('#editFxFOp input, input#editFxFOp', '40'));
  await step('edit open note', () => click('#editOpen'));
  await step('edit done', () => click('#editDone'));
  await step('edit click outside', () => down('#editSheet'));
  await step('edit design again, x', async () => { await menu(note(1), 'Edit design…'); await click('#editX'); });
  await step('window resize while editing', async () => { await menu(note(1), 'Edit design…'); await page.setViewportSize({ width: 1000, height: 760 }); await page.setViewportSize({ width: 1100, height: 800 }); await key('Escape'); });

  // ---- Settings
  await step('settings', () => tab('settings'));
  for (let s = 0; s < 8; s++) await step(`fold ${s}`, () => click(`#viewSettings .phead >> nth=${s}`));
  await step('fold by key', () => press('#viewSettings .phead >> nth=0', 'Enter'));
  await step('fold mousedown', () => down('#viewSettings .phead >> nth=0'));
  for (const s of ['#sTheme button', '#sColors button', '#sFont button']) {
    for (let k = 0; k < 3; k++) await step(`settings ${s} ${k}`, () => click(`${s} >> nth=${k}`));
  }
  await step('settings colour again (un-pick)', () => click('#sColors button >> nth=1'));
  for (const b of ['#sPickAll', '#sPickLight', '#sPickDark', '#sPickOne']) await step(`settings ${b}`, () => click(b));
  for (const b of ['#sNoRepeat', '#sStartup', '#sSpell', '#sCyr', '#sSolidHover', '#sFxPause', '#sFxPause']) await step(`settings ${b}`, () => check(b));
  await step('settings opacity', () => setVal('#sOpacity', '80'));
  await step('fx choose', () => click('#sFxChoose'));
  for (const s of ['#fxAllEffects button', '#fxAllEAmt button', '#fxAllFollowers button', '#fxAllFAmt button']) await step(`fx sheet ${s}`, () => click(`${s} >> nth=2`));
  await step('fx sheet opacity', () => setVal('#fxAllEOp input, input#fxAllEOp', '50'));
  await step('fx sheet f opacity', () => setVal('#fxAllFOp input, input#fxAllFOp', '50'));
  await step('fx interact all', () => check('#fxInteractAll'));
  await step('fx force all', () => check('#fxForceAll'));
  await step('fx force all off', () => check('#fxForceAll'));
  await step('fx sheet close', () => click('#fxSheetX'));
  await step('fx choose, escape', async () => { await click('#sFxChoose'); await key('Escape'); });
  await step('fx choose, click outside', async () => { await click('#sFxChoose'); await down('#fxSheet'); });
  await step('fx pause button', () => click('#btnFxPause'));
  await step('fx pause button again', () => click('#btnFxPause'));
  await step('password change', () => click('#pwSave'));
  await step('password change: no match', () => modalOk(['pw1234', 'pw5678', 'pw9999']));
  await step('password change: PIN kind', async () => { if (await open()) await click('#mInputs .seg button >> nth=1'); });
  await step('password change: PIN digits', async () => { if (await open()) await setVal('#mInputs input >> nth=1', '12ab34'); });
  await step('password change: cancel', async () => { if (await open()) await mclick('#mCancel'); });
  await step('password change again', () => click('#pwSave'));
  await step('password pop-up: click outside', () => el('#modal').evaluate((m) => m.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))));
  await step('password change ok', async () => { if (!(await open())) await click('#pwSave'); await modalOk(['pw1234', 'pw5678', 'pw5678']); });
  await step('restore pick', () => click('#btnRestorePick'));
  await step('restore: pick a day', () => click('.bkpick'));
  await step('restore: ok', () => modalOk());
  await step('restore: confirm cancel', async () => { if (await open()) await mclick('#mCancel'); });
  await step('restore pick, double-click a day', async () => { await click('#btnRestorePick'); await dbl('.bkpick'); });
  await step('restore: confirm', async () => { if (await open()) await mclick('#mOk'); });
  await step('backup now', () => click('#btnBackupNow'));
  await step('backup folder', () => click('#btnBackupFolder'));
  await step('data folder', () => click('#btnDataFolder'));
  await step('about features', () => click('#foldFeatures'));
  await step('about versions', () => click('#foldVersions'));
  await step('ctrl+wheel in settings does nothing', async () => { await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); });
  await step('settings tab again (back)', () => tab('settings'));

  // ---- Locked tab
  await step('locked tab', () => tab('locks'));
  await step('unlock all', () => click('#btnUnlockAll'));
  await step('unlock all wrong', () => modalOk(['nope']));
  await step('unlock all right', () => modalOk(['pw5678']));
  await step('locked tab search', () => setVal('#q', 'o'));
  await step('lock all', () => click('#btnLockAll'));
  await step('unlock a note (card button)', async () => { await tab('notes'); await click('#cards .card .lockb.on'); });
  await step('unlock pop-up ok', () => modalOk(['pw5678']));
  await step('unlock a group (card button)', () => click('#cards .card.group .lockb.on'));
  await step('unlock group ok', () => modalOk(['pw5678']));

  // ---- Bin
  await step('bin tab', () => tab('bin'));
  await step('bin search', () => setVal('#bq', 'bin'));
  await step('bin search escape', () => key('Escape'));
  await step('bin search again, clear button', async () => { await setVal('#bq', 'me'); await click('#bqClear'); });
  await step('bin menu: Restore', () => menu('#binCards .card', 'Restore'));
  await step('bin menu: Delete forever', () => menu('#binCards .card', 'Delete forever…'));
  await step('delete cancel', () => mclick('#mCancel'));
  await step('bin restore button', () => click('#binCards button.pill:not(.danger)'));
  await step('bin delete forever asks', () => click('#binCards button.pill.danger'));
  await step('bin delete ok', () => mclick('#mOk'));
  await step('bin delete forever, shift', () => click('#binCards button.pill.danger', { shiftKey: true }));
  await step('empty bin', () => click('#btnEmpty'));
  await step('empty bin ok', () => mclick('#mOk'));

  // ---- keys, focus
  await step('notes tab', () => tab('notes'));
  await step('ctrl+n', () => key('Control+n'));
  await step('ctrl+f', () => key('Control+f'));
  await step('type in search', () => setVal('#q', 'gift'));
  await step('escape', () => key('Escape'));
  await step('ctrl+f from settings', async () => { await tab('settings'); await key('Control+f'); });
  await step('escape closes size pop', async () => { await tab('notes'); await click('#btnSize'); await key('Escape'); });
  await step('escape closes sort pop', async () => { await click('#btnSort'); await key('Escape'); });
  await step('escape closes bar colours', async () => { await click(note(0), { ctrlKey: true }); await click('#bColor'); await key('Escape'); await key('Escape'); });
  await step('escape closes the panel', async () => { await click(group(0)); await click('#btnGroupSettings'); await key('Escape'); await home(); });
  await step('bring to front', () => click('#btnFront'));
  await step('new note', () => click('#btnNew'));
  await step('window focus reload', () => page.evaluate(() => window.dispatchEvent(new Event('focus'))));
};
