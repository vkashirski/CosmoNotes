'use strict';
// Settings and Edit design in the notes list, in a real browser (tests/helpers/list-ui.js): sections fold, the window colour,
// new notes' colours (several = one at random, never none), font, see-through and switches, effects for all notes and the
// pause button, changing the password; right-click → Edit design… (title as you type, colour, see-through, its own
// effect; three tabs), Enter / Escape / outside click close it, and a change made elsewhere shows in it. About: the version
// and date, the feature list, no version history (1.1.41). Settings scrolls smoothly: a solid background that moves with
// the page, nothing reacts to the mouse while it scrolls, and Ctrl + wheel only changes card sizes outside it (1.1.43).
const assert = require('assert');

(async () => {
  let A;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password('pw1234');
    A = await s.note({ title: 'Plan', html: '<div>the plan</div>', color: 'yellow' });
  });
  const { page } = ui;
  const settings = async () => (await ui.get()).settings;
  const note = async (id) => (await ui.get()).notes.find((n) => n.id === id);

  // ---- Settings: every section starts closed and opens by its title
  await ui.tab('settings');
  const heads = await ui.count('#viewSettings .phead');
  assert.ok(heads >= 5, 'several sections');
  assert.equal(await ui.count('#viewSettings .panel.open'), 0, 'all closed at first');
  for (let k = 0; k < heads; k++) await ui.click(`#viewSettings .phead >> nth=${k}`);
  assert.equal(await ui.count('#viewSettings .panel.open'), heads, 'a click on the title opens each');
  await page.locator('#viewSettings .phead >> nth=0').dispatchEvent('keydown', { key: 'Enter' }); await ui.settle();
  assert.equal(await page.getAttribute('#viewSettings .phead >> nth=0', 'aria-expanded'), 'false', 'Enter closes it again (keyboard)');

  // ---- the window's colour
  await ui.click('#sTheme [data-theme="night"], #sTheme button:has-text("Night")');
  assert.equal((await settings()).listTheme, 'night', 'saved');
  assert.equal(await page.getAttribute('body', 'data-theme'), 'night', 'and the window changes colour');

  // ---- new notes' colours
  await ui.click('#sPickOne');
  const first = (await settings()).defaultColors;
  assert.equal(first.length, 1);
  await ui.click('#sColors .sw.on');
  assert.deepEqual((await settings()).defaultColors, first, 'the last colour can’t be taken away');
  assert.ok(/at least one colour/.test(await ui.text('#toast')), 'it says so');
  await ui.click('#sColors [data-color="sage"]');
  assert.deepEqual([...(await settings()).defaultColors].sort(), [...first, 'sage'].sort(), 'a click adds a colour');
  assert.equal(await ui.text('#sColorsCount'), '2 picked');
  await ui.click('#sColors [data-color="sage"]');
  assert.deepEqual((await settings()).defaultColors, first, 'and a second click takes it away');
  await ui.click('#sPickDark');
  assert.deepEqual([...(await settings()).defaultColors].sort(), ['charcoal', 'forest', 'midnight', 'night', 'plum'], 'Dark ones');
  await ui.click('#sPickAll'); assert.equal((await settings()).defaultColors.length, 17, 'All 17');
  await ui.click('#sPickLight'); assert.equal((await settings()).defaultColors.length, 12, 'Light ones: 12');
  await ui.click('#sPickOne'); assert.equal((await settings()).defaultColors.length, 1, 'Just one');
  // a new note gets it
  const only = (await settings()).defaultColors[0];
  const before = new Set((await ui.get()).notes.map((n) => n.id));
  await ui.key('Control+n');
  const made = (await ui.get()).notes.find((n) => !before.has(n.id));
  assert.equal(made.color, only, 'a new note gets the colour picked for new notes');
  assert.ok(await ui.visible('#viewSettings'), 'Ctrl+N doesn’t leave Settings');

  // ---- font, see-through, switches
  await ui.click('#sFont button[data-font="medieval"]');
  assert.equal((await settings()).defaultFont, 'medieval', 'the Medieval font for new notes');
  const had = new Set((await ui.get()).notes.map((n) => n.id));
  await ui.key('Control+n');
  assert.equal((await ui.get()).notes.find((n) => !had.has(n.id)).font, 'medieval', 'a new note gets it');
  await ui.click('#sFont button[data-font="hand"]');
  assert.equal((await settings()).defaultFont, 'hand');
  assert.ok(await page.isVisible('#sFont button[data-font="hand"].on'), 'the picked font is marked');
  await ui.type('#sOpacity', '70');
  assert.equal((await settings()).defaultOpacity, 0.7, 'see-through for new notes');
  assert.equal(await ui.text('#sOpVal'), '70%');
  for (const [id, key] of [['#sStartup', 'startWithWindows'], ['#sSolidHover', 'defaultSolidOnHover'], ['#sNoRepeat', 'newColorNoRepeat'], ['#sSpell', 'spellCheck']]) {
    const was = !!(await settings())[key];
    await ui.check(id);
    assert.equal(!!(await settings())[key], !was, `${id} switches ${key}`);
  }

  // ---- effects for all notes, and the pause button
  await ui.click('#sFxChoose');
  assert.ok(await ui.visible('#fxSheet'));
  const fx = await page.getAttribute('#fxAllEffects button >> nth=2', 'data-v');
  await ui.click(`#fxAllEffects button[data-v="${fx}"]`);
  assert.equal((await settings()).fxEffect, fx, 'a background for all notes');
  await ui.click('#fxAllEAmt button[data-a="high"], #fxAllEAmt button >> nth=2');
  assert.ok((await settings()).fxEffectAmount, 'how much of it');
  await ui.check('#fxForceAll');
  assert.equal((await settings()).fxForceAll, true, '“use on every note”');
  await ui.key('Escape');
  assert.ok(!(await ui.visible('#fxSheet')), 'Escape closes the effects pop-up');
  assert.ok((await ui.text('#sFxNow')).length > 0, 'Settings shows what is chosen');
  await ui.click('#btnFxPause');
  assert.equal((await settings()).fxPaused, true, 'the pause button pauses every effect');
  assert.equal(await page.getAttribute('#btnFxPause', 'aria-pressed'), 'true');
  await ui.click('#btnFxPause');
  assert.equal((await settings()).fxPaused, false, 'and plays them again');

  // ---- changing the password: the current one first, the rules, then saved
  await ui.click('#pwSave');
  assert.equal(await ui.modalTitle(), 'Change your password');
  assert.equal(await ui.count('#mInputs input'), 3, 'current, new, new again');
  await ui.modalOk(['wrong!', 'newpass', 'newpass']);
  assert.ok(await ui.modalOpen() && (await ui.text('#mErr')).length > 0, 'a wrong current password: refused');
  await ui.modalOk(['pw1234', 'newpass', 'newpasX']);
  assert.equal(await ui.text('#mErr'), "The two don't match.");
  await ui.modalOk(['pw1234', 'newpass', 'newpass']);
  assert.ok(!(await ui.modalOpen()) && /Password saved/.test(await ui.text('#toast')), 'saved');
  assert.equal((await ui.H['list:unlock-all']({}, 'newpass')).ok, true, 'main takes the new password');
  await ui.H['list:lock-all']({});

  // ---- Edit design
  await ui.tab('notes');
  await ui.menu(ui.noteKey(A), 'Edit design…');
  assert.ok(await ui.visible('#editSheet'), 'right-click → Edit design… opens the pop-up');
  assert.deepEqual(await page.$$eval('#editTabs [data-tab]', (x) => [...new Set(x.map((b) => b.dataset.tab))]), ['look', 'e', 'f'], 'three tabs: Colour, Background, Mouse (1.1.22)');
  assert.equal(await page.inputValue('#editTitle'), 'Plan');
  assert.ok(!(await ui.visible('#editFontRow')), 'no Font row for one note (1.2.2: only for several)');
  await ui.type('#editTitle', 'Big plan');
  assert.equal((await note(A)).title, 'Big plan', 'the title saves as you type');
  await ui.click('#editColors [data-color="lavender"]');
  assert.equal((await note(A)).color, 'lavender', 'the colour at once');
  assert.ok(await page.isVisible('#editColors [data-color="lavender"].on'));
  await ui.type('#editOpacity', '60');
  assert.equal((await note(A)).opacity, 0.6, 'see-through');
  assert.equal(await ui.text('#editOpVal'), '60%');
  await ui.click('#editTabs [data-tab="e"]');
  const own = await page.getAttribute('#editFxEffects button >> nth=3', 'data-v');
  await ui.click(`#editFxEffects button[data-v="${own}"]`);
  assert.equal((await note(A)).fx.e, own, 'its own background');
  // a change made elsewhere (here: main, like the note's own window would) shows in the open pop-up
  await ui.H['list:edit']({}, A, { color: 'mint' }); await ui.settle(); await ui.settle();
  await ui.click('#editTabs [data-tab="look"]');
  assert.ok(await page.isVisible('#editColors [data-color="mint"].on'), 'a colour changed elsewhere shows here');
  await page.locator('#editTitle').dispatchEvent('keydown', { key: 'Enter' }); await ui.settle();
  assert.ok(!(await ui.visible('#editSheet')), 'Enter in the title closes it');
  await ui.menu(ui.noteKey(A), 'Edit design…'); await ui.key('Escape');
  assert.ok(!(await ui.visible('#editSheet')), 'Escape closes it');
  await ui.menu(ui.noteKey(A), 'Edit design…'); await ui.down('#editSheet');
  assert.ok(!(await ui.visible('#editSheet')), 'a click outside closes it');
  await ui.menu(ui.noteKey(A), 'Edit design…'); await ui.click('#editOpen');
  assert.ok((await note(A)).open && !(await ui.visible('#editSheet')), '“Open note” opens it on the desktop');
  // ---- About: the version and the date, the feature list, no version history (1.1.41)
  await ui.tab('settings');
  const line = await ui.text('#aboutLine');
  assert.ok(/^Version [\d.]+ · Last updated /.test(line), `About says the version and the date (${line})`);
  assert.equal(await ui.count('#foldVersions'), 0, 'no Version history fold');
  assert.ok(await ui.count('#features .fgroup') >= 8, 'the feature list is there');
  await ui.tab('notes');

  // ---- smooth scrolling in Settings (1.1.43)
  await ui.tab('settings');
  const bg = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#viewSettings')); return [s.backgroundColor, s.backgroundAttachment]; });
  assert.ok(/^rgb\(/.test(bg[0]), `Settings has a solid background colour (${bg[0]})`);
  assert.equal(bg[1], 'local, local', 'which scrolls with the page');
  // open every section and the feature list, then scroll
  await page.evaluate(() => { document.querySelectorAll('#viewSettings .phead[aria-expanded="false"]').forEach((h) => h.click()); document.querySelector('#foldFeatures').open = true; });
  await ui.settle();
  const seen = await page.evaluate(() => new Promise((res) => {
    const v = document.querySelector('#viewSettings');
    v.addEventListener('scroll', () => requestAnimationFrame(() => {
      const during = v.classList.contains('scrolling');
      const hit = document.elementFromPoint(v.getBoundingClientRect().left + 40, v.getBoundingClientRect().top + 60);
      setTimeout(() => res({ during, hitView: hit === v, after: v.classList.contains('scrolling') }), 400);
    }), { once: true });
    v.scrollTop = 600;
    setTimeout(() => res({ timedOut: true }), 3000);
  }));
  assert.ok(!seen.timedOut, 'Settings scrolls (open sections make it long enough)');
  assert.ok(seen.during, 'Settings gets .scrolling while it scrolls');
  assert.ok(seen.hitView, 'and the mouse then reaches the view, not what is in it');
  assert.ok(!seen.after, '.scrolling goes away once it stops');
  // Ctrl + wheel over Settings changes nothing (and no page zoom: Electron never zooms by itself)
  const size = (await ui.get()).settings.listSize;
  await page.mouse.move(200, 400); await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await ui.settle(300);
  assert.equal((await ui.get()).settings.listSize, size, 'Ctrl + wheel in Settings leaves the card size alone');
  // Ctrl + wheel over the tabs still changes the card size (back in Notes)
  await ui.tab('notes');
  const box = await page.locator('.tabs').boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await ui.settle(300);
  assert.notEqual((await ui.get()).settings.listSize, size, 'Ctrl + wheel over the tabs still changes the card size');
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
