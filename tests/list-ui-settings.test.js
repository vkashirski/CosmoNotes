'use strict';
// Settings and Edit design in the notes list, in a real browser (tests/helpers/list-ui.js): 1.4.25: the sidebar of sections
// (one at a time, wide / slim, Up / Down), search across them, the window colour,
// new notes' colours (several = one at random, never none), font, see-through and switches, effects for all notes and the
// pause button, changing the password; right-click → Edit design… (title as you type, colour, see-through, its own
// effect; three tabs), Enter / Escape / outside click close it, and a change made elsewhere shows in it. About: the version
// and date, the feature list, no version history (1.1.41). Settings scrolls smoothly: a solid background that moves with
// the page, nothing reacts to the mouse while it scrolls, and Ctrl + wheel only changes card sizes outside it (1.1.43).
// 1.3.27: Evening colours (switch, times, the shades), the panic button and its shortcut (press keys: a letter alone is
// refused; quick picks; another app has it; none), "Use on all notes" under a setting and "Reset notes…" (General).
// 1.3.34: the click-through switch, and right-click → Turn off click-through on a card.
// 1.4.0: About → updates: Check, the dot, Install asks first, the switch, the tray's line opens it.
// 1.4.34: Feedback ("Ground control" in the code, above About): the two choices first, then a locked form (Cancel asks), the draft kept, a pasted picture, Send's words and its countdown.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

(async () => {
  let A;
  const ui = await require('./helpers/list-ui')(async (s) => {
    await s.password('pw1234');
    A = await s.note({ title: 'Plan', html: '<div>the plan</div>', color: 'yellow' });
  });
  const { page } = ui;
  const settings = async () => (await ui.get()).settings;
  const note = async (id) => (await ui.get()).notes.find((n) => n.id === id);

  // ---- Settings (1.4.25, the owner's pick): a sidebar of sections, one shown at a time; General first
  await ui.tab('settings');
  const navs = await page.$$eval('#setNav [data-sec]', (bs) => bs.map((b) => b.dataset.sec));
  assert.deepEqual(navs, ['general', 'notes', 'look', 'writing', 'reminders', 'privacy', 'yournotes', 'ground', 'about'], `the sections (${navs})`);
  const secs = await page.$$eval('#viewSettings .setsec', (xs) => xs.map((x) => x.dataset.sec));
  assert.deepEqual(secs, navs, 'one section for each sidebar button, in the same order');
  assert.equal(await ui.count('#viewSettings .panel:not(.setsec > .panel)'), 0, 'every panel is in a section');
  const secShown = () => page.$$eval('#viewSettings .setsec', (xs) => xs.filter((x) => getComputedStyle(x).display !== 'none').map((x) => x.dataset.sec));
  assert.deepEqual(await secShown(), ['general'], 'General shows first, alone');
  assert.equal(await page.getAttribute('#setNav [data-sec="general"]', 'aria-current'), 'true', 'and is the current one');
  assert.ok(await ui.visible('#sStartup') && !(await ui.visible('#sSpell')), 'its rows only');
  await ui.section('writing');
  assert.deepEqual(await secShown(), ['writing'], 'a click shows that section instead');
  assert.ok(await ui.visible('#sSpell') && !(await ui.visible('#sStartup')), 'with its rows');
  // 1.4.28 ("make toggles more clear"): a row's picked button is filled with ink, never the panel's own colour (Voice
  // to text's "Words appear" read as the other one picked), and an off switch has a rim
  const look = await page.evaluate(() => {
    const on = document.querySelector('#sttWhen button.on') || document.querySelector('#sttWhen button');
    on.classList.add('on');
    const bg = (x) => getComputedStyle(x).backgroundColor;
    const i = document.querySelector('#sSpell + i');
    return { on: bg(on), panel: bg(on.closest('.panel')), rim: getComputedStyle(i).boxShadow };
  });
  assert.notEqual(look.on, look.panel, `the picked button stands out from its panel (${look.on})`);
  assert.ok(/inset/.test(look.rim) || (await page.isChecked('#sSpell')), `an off switch has a rim (${look.rim})`);
  assert.equal(await ui.count('#setNav [aria-current]'), 1, 'one current section');
  // 1.4.28 (the owner's wish): the version line sits at the bottom of the sidebar, under the sections, on every one
  assert.ok(await ui.visible('#setNav > .version:last-child') && /Made with love/.test(await ui.text('#version')), 'the version line under the sections');
  assert.equal(await ui.count('.setsec #version'), 0, 'not in About any more');
  // 1.4.28: "New notes" is "Notes", and click-through moved there from General
  assert.equal((await ui.text('#setNav [data-sec="notes"] .lw')).trim(), 'Notes', 'the section is called Notes');
  assert.equal(await ui.count('.setsec[data-sec="notes"] #sClickThrough'), 1, 'click-through is under Notes');
  assert.equal(await ui.count('.setsec[data-sec="general"] #sClickThrough'), 0, 'not under General');
  await page.focus('#setNav [data-sec="writing"]'); await ui.key('ArrowDown');
  assert.deepEqual(await secShown(), ['reminders'], 'Down in the sidebar: the next section');
  await ui.key('ArrowUp'); await ui.key('ArrowUp');
  assert.deepEqual(await secShown(), ['look'], 'Up: the one above');
  await ui.tab('notes'); await ui.tab('settings');
  assert.deepEqual(await secShown(), ['look'], 'coming back to Settings keeps the section');
  // wide window: the names, the search above them; narrow (under 560 px): a slim rail with short names
  const navW = () => page.$eval('#setNav', (n) => n.getBoundingClientRect().width);
  assert.ok(await navW() > 150, 'wide: the sidebar has room for the names');
  assert.ok(await ui.visible('#setNav [data-sec="look"] .lw') && !(await ui.visible('#setNav [data-sec="look"] .ls')), 'the long name');
  const above = await page.evaluate(() => document.querySelector('.setsearch').getBoundingClientRect().bottom <= document.querySelector('#setNav').getBoundingClientRect().top + 1);
  assert.ok(above, 'the search is above the sidebar');
  await page.setViewportSize({ width: 420, height: 640 }); await ui.settle();
  assert.ok(await navW() < 80, `narrow: a slim rail (${await navW()} px)`);
  assert.ok(await ui.visible('#setNav [data-sec="look"] .ls') && !(await ui.visible('#setNav [data-sec="look"] .lw')), 'with short names');
  const beside = await page.evaluate(() => document.querySelector('.setsearch').getBoundingClientRect().left >= document.querySelector('#setNav').getBoundingClientRect().right);
  assert.ok(beside, 'and the search beside it, over the section');
  const fits = await page.evaluate(() => document.querySelector('#viewSettings').scrollWidth <= document.querySelector('#viewSettings').clientWidth);
  assert.ok(fits, 'nothing runs over sideways at 420 px');
  await page.setViewportSize({ width: 1100, height: 800 }); await ui.settle();

  // ---- search in Settings (1.3.35): the matching panels of every section, under their section's name
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#viewSettings .panel:not(.unfound) h3')].filter((h) => h.offsetParent).map((h) => h.textContent.trim()));
  await ui.type('#sq', 'evening');
  assert.deepEqual(await shown(), ['Evening colours'], '“evening” shows only Evening colours');
  assert.ok(await ui.visible('#sEve'), 'its rows show');
  assert.ok(await ui.visible('#sqClear') && !(await ui.visible('#sqNone')), 'a clear button, no “nothing found”');
  assert.deepEqual(await secShown(), ['look'], 'with its section’s name');
  assert.equal(await ui.count('#viewSettings.finding'), 1, 'no section is the current one while searching');
  await ui.type('#sq', 'EVENING  Colours');
  assert.deepEqual(await shown(), ['Evening colours'], 'any case, every word must match');
  await ui.type('#sq', 'ever');
  assert.ok(!(await shown()).includes('Colour'), 'a word must start with it (“never” is no match)');
  await ui.type('#sq', 'spell');
  assert.deepEqual(await shown(), ['Spelling'], 'the start of a word is enough');
  // 1.3.36: other names for a panel find it too (data-find), and every panel has some
  assert.equal(await ui.count('#viewSettings .panel:not([data-find])'), 0, 'every panel has search words');
  for (const [q, want] of [['dark mode', 'Start and theme'], ['startup', 'Start and theme'], ['dictation', 'Voice to text'], ['boss key', 'Panic button'],
    ['password', 'Locked notes'], ['todo', 'Checklists'], ['grammar', 'Spelling'], ['appdata', 'Where your notes live'], ['version', 'CosmoNotes'],
    ['volume', 'Sound'], ['snooze', 'Setting a reminder'], ['reset', 'Notes’ own settings']]) {
    await ui.type('#sq', q);
    assert.deepEqual(await shown(), [want], `“${q}” finds ${want}`);
  }
  await ui.type('#sq', 'transparent');
  assert.deepEqual(await shown(), ['Font and see-through', 'Click-through'], 'both under Notes (1.4.28: click-through moved there from General)');
  assert.deepEqual(await secShown(), ['notes'], 'under Notes');
  await ui.type('#sq', 'color');
  assert.deepEqual(await shown(), ['Start and theme', 'Colour', 'Evening colours'], 'a word can find panels in more than one section');
  assert.deepEqual(await secShown(), ['general', 'notes', 'look'], 'each under its section');
  await ui.type('#sq', 'everything');
  assert.deepEqual(await shown(), [], 'About’s feature list is not searched');
  assert.ok(await ui.visible('#sqNone'), '“No settings match.”');
  assert.deepEqual(await secShown(), [], 'and no section shows');
  await ui.click('#sqClear');
  assert.equal(await page.inputValue('#sq'), '', 'the clear button empties it');
  assert.equal(await ui.count('#viewSettings .panel.unfound, #viewSettings.finding'), 0, 'the search is gone');
  assert.deepEqual(await secShown(), ['look'], 'and the section shows again');
  await ui.type('#sq', 'backups');
  assert.deepEqual(await shown(), ['Backups'], 'Backups');
  await page.keyboard.press('Escape'); await ui.settle();
  assert.equal(await page.inputValue('#sq'), '', 'Escape clears it');
  assert.deepEqual(await secShown(), ['look'], 'and puts the section back');
  await ui.type('#sq', 'backups');
  await ui.section('privacy');
  assert.equal(await page.inputValue('#sq'), '', 'a click in the sidebar ends the search');
  assert.deepEqual(await secShown(), ['privacy'], 'and shows that section');
  await page.keyboard.press('Control+f'); await ui.settle();
  assert.ok(await page.evaluate(() => document.activeElement.id === 'sq' && !document.getElementById('viewSettings').hidden), 'Ctrl+F in Settings goes to its search');

  // ---- Voice to text (1.3.4): one model, named, with its download; no choice, no Test my computer
  await ui.section('writing');
  const vt = await ui.text('#sttModels');
  assert.ok(vt.includes('Uses Whisper small.en') && vt.includes('Not downloaded'), `says which model and that it isn't here (${vt})`);
  assert.equal(await ui.count('#sttModels button:has-text("Download")'), 1, 'a Download button');
  assert.equal(await ui.count('#sttUse, #sttTest, #sttTestInfo, #sttUsing'), 0, 'no model choice, no Test my computer');
  assert.ok(!/Standard|Best/.test(await ui.text('#sttPanel')), 'no Standard / Best');
  // "Words appear": while you talk / when you stop (not set: by the PC; no WebGPU here = when you stop)
  assert.equal(await ui.text('#sttWhen button.on'), 'When you stop', 'not set: the PC\'s pick shows');
  await ui.click('#sttWhen [data-v="live"]');
  assert.equal((await settings()).sttWhen, 'live', 'saved');
  assert.equal(await ui.text('#sttWhen button.on'), 'While you talk');
  assert.ok((await ui.text('#sttWhenInfo')).includes('lag'), 'on the processor: it can lag');
  // the hints
  assert.equal(await ui.text('#sttIntro'), 'In a note, open + Add and pick Voice to text, or right-click a voice recording and pick Transcribe.', 'one name everywhere, Transcribe in the same sentence');
  assert.ok(!/Speak to text/.test(await ui.text('#sttPanel')), 'no "Speak to text"');
  const src = await ui.text('#sttSource');
  assert.ok(src.includes('https://huggingface.co/onnx-community/whisper-small.en') && src.includes('never leaves this device'), `the model's page and "this device" (${src})`);
  assert.equal(await page.getAttribute('#sttSource a', 'href'), 'https://huggingface.co/onnx-community/whisper-small.en', 'a link to it');
  assert.ok((await ui.text('#sttTipWindows')).includes('Win + H'), 'Windows 11 voice typing and its keys');
  // the order (1.3.7): how to use it (and Transcribe) at the top, where it comes from under the model, Windows 11 last
  const order = await page.evaluate(() => [...document.querySelectorAll('#sttPanel > *')].map((e) => e.id || e.className));
  assert.deepEqual(order.slice(order.indexOf('sttIntro')), ['sttIntro', 'sttModels', 'sttSource', 'row col', 'sttTipWindows'], `the order (${order})`);

  // ---- the window's colour
  await ui.section('general');
  await ui.click('#sTheme [data-theme="night"], #sTheme button:has-text("Night")');
  assert.equal((await settings()).listTheme, 'night', 'saved');
  assert.equal(await page.getAttribute('body', 'data-theme'), 'night', 'and the window changes colour');

  // ---- new notes' colours
  await ui.section('notes');
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
  for (const [id, key] of [['#sStartup', 'startWithWindows'], ['#sSolidHover', 'defaultSolidOnHover'], ['#sNoRepeat', 'newColorNoRepeat'], ['#sSpell', 'spellCheck'],
    ['#sCheckDrag', 'checkDrag'], ['#sCheckSink', 'checkSink'], ['#sCheckFixed', 'checkFixed']]) { // 1.3.19: Checklists
    assert.equal(await page.isChecked(id), !!(await settings())[key], `${id} shows ${key}`);
    const was = !!(await settings())[key];
    await ui.check(id);
    assert.equal(!!(await settings())[key], !was, `${id} switches ${key}`);
  }

  // ---- effects for all notes, and the pause button
  await ui.section('look');
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
  await ui.section('privacy');
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
  await ui.menu(ui.noteKey(A), 'Note design…');
  assert.ok(await ui.visible('#editSheet'), 'right-click → Note design… opens the pop-up');
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
  await ui.menu(ui.noteKey(A), 'Note design…'); await ui.key('Escape');
  assert.ok(!(await ui.visible('#editSheet')), 'Escape closes it');
  await ui.menu(ui.noteKey(A), 'Note design…'); await ui.down('#editSheet');
  assert.ok(!(await ui.visible('#editSheet')), 'a click outside closes it');
  await ui.menu(ui.noteKey(A), 'Note design…'); await ui.click('#editOpen');
  assert.ok((await note(A)).open && !(await ui.visible('#editSheet')), '“Open note” opens it on the desktop');
  // ---- About: the version and the date, the feature list, no version history (1.1.41)
  await ui.section('about');
  await ui.tab('settings');
  const line = await ui.text('#aboutLine');
  assert.ok(/^Version [\d.]+ · Last updated /.test(line), `About says the version and the date (${line})`);
  assert.equal(await ui.count('#foldVersions'), 0, 'no Version history fold');
  assert.ok(await ui.count('#features .fgroup') >= 8, 'the feature list is there');
  // ---- 1.4.0: About → updates, against a local server playing GitHub Releases (main's side: updates.test.js)
  const U = require('../main/updater');
  const exe = require('crypto').randomBytes(1100000);
  const sha = require('crypto').createHash('sha512').update(exe).digest('base64');
  const yml = `version: 9.9.9\nfiles:\n  - url: CosmoNotes-Setup-9.9.9.exe\n    sha512: ${sha}\n    size: ${exe.length}\npath: CosmoNotes-Setup-9.9.9.exe\nsha512: ${sha}\n`;
  const server = require('http').createServer((req, res) => { res.writeHead(200); res.end(req.url.endsWith('.yml') ? yml : exe); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  U.setPlace({ base: `http://127.0.0.1:${server.address().port}`, dir: require('path').join(require('os').tmpdir(), `cosmo-upd-${process.pid}`) });
  assert.equal(await ui.text('#updBtns'), 'Check for updates', 'nothing known yet: a Check button');
  assert.equal(await ui.count('.tab.hasupd'), 0, 'no dot');
  assert.ok(await page.isChecked('#sUpdateCheck'), 'Check for updates (by itself): on');
  await ui.check('#sUpdateCheck');
  assert.equal((await settings()).updateCheck, false, 'the switch turns it off');
  await ui.check('#sUpdateCheck');
  await ui.click('#updBtns button');
  await ui.settle(200);
  assert.equal(await ui.text('#updLine'), 'Version 9.9.9 is ready.');
  assert.equal(await ui.text('#updBtns'), 'Install');
  assert.equal(await ui.count('.tab[data-tab="settings"].hasupd'), 1, 'a dot on the Settings tab');
  assert.equal(await ui.count('.abouthead h3.hasupd'), 1, 'and on About');
  assert.equal(await ui.count('#setNav [data-sec="about"].hasupd'), 1, 'and on About in the sidebar (1.4.25)');
  await ui.click('#updBtns button');
  assert.equal(await ui.modalTitle(), 'Install the update?', 'Install asks first');
  await ui.modalCancel();
  assert.equal(await ui.text('#updLine'), 'Version 9.9.9 is ready.', 'Cancel: nothing happens');
  await ui.click('#updBtns button'); await ui.modalOk();
  assert.match(await ui.text('#toast'), /installed app/, 'npm start: it says updates are for the installed app');
  // the tray's "Update to …": the list goes to Settings, at the updates
  await ui.section('general');
  await ui.type('#sq', 'spell');
  await ui.tab('notes');
  require('../main/ipc-update').showUpdate();
  await ui.settle(100);
  assert.ok(await ui.visible('#updRow'), 'Settings is open at About’s updates');
  assert.equal(await page.getAttribute('#setNav [data-sec="about"]', 'aria-current'), 'true', 'About is the section shown (1.4.25)');
  assert.equal(await page.inputValue('#sq'), '', 'a search left in Settings is cleared');
  server.close();
  await ui.tab('notes');

  // ---- 1.3.27: Evening colours
  await ui.section('look');
  assert.deepEqual([await page.inputValue('#sEveFrom'), await page.inputValue('#sEveTo')], ['19:00', '07:00'], '19:00 to 07:00');
  await ui.check('#sEve');
  assert.equal((await settings()).eveOn, true, 'turned on');
  await ui.type('#sEveFrom', '20:30');
  assert.equal((await settings()).eveFrom, 20 * 60 + 30, 'a new evening time');
  assert.equal(await ui.count('#sEveStrip i'), 12, 'each light paper, by day and by evening');
  await ui.check('#sEve');

  // ---- 1.3.27: the panic button and its shortcut (no shortcut until one is set)
  await ui.section('privacy');
  const GS = ui.E.globalShortcut;
  assert.ok(!(await ui.visible('#sPanicKeyRow')), 'no shortcut row while it is off');
  await ui.check('#sPanic');
  assert.equal((await settings()).panicOn, true);
  assert.equal(await ui.text('#sPanicKeyNow'), 'None', 'no shortcut yet');
  assert.ok((await ui.text('#sPanicHint')).includes('Alt+Z or F8'), 'it suggests Alt+Z and F8');
  await ui.click('#sPanicKey');
  assert.ok((await ui.text('#sPanicKey')).includes('Press the keys'), 'waiting for keys');
  await page.keyboard.press('KeyZ'); await ui.settle();
  assert.ok((await ui.text('#sPanicHint')).includes('Ctrl or Alt'), 'a letter alone is refused');
  assert.equal((await settings()).panicKey, '');
  await page.keyboard.press('Alt+KeyZ'); await ui.settle();
  assert.equal((await settings()).panicKey, 'Alt+Z', 'Alt+Z is taken as the shortcut');
  assert.ok(GS.reg['Alt+Z'], 'and registered once Settings stops waiting');
  assert.equal(await ui.text('#sPanicKeyNow'), 'Alt+Z');
  await ui.click('#sPanicKeyRow [data-key="F8"]');
  assert.equal((await settings()).panicKey, 'F8', 'a quick pick');
  GS.taken.add('Alt+Z');
  await ui.click('#sPanicKeyRow [data-key="Alt+Z"]');
  assert.ok((await ui.text('#sPanicHint')).includes('Another app'), 'it says when another app has it');
  GS.taken.clear();
  await ui.click('#sPanicClear');
  assert.equal((await settings()).panicKey, '', 'no shortcut');
  assert.deepEqual(Object.keys(GS.reg), []);

  // ---- 1.3.34: click-through: the switch, and right-click → Turn off click-through on a card (only while it is on)
  await ui.section('general');
  const { S } = require('../main/state');
  assert.ok(!(await page.isChecked('#sClickThrough')), 'click-through starts off');
  await ui.check('#sClickThrough');
  assert.equal((await settings()).clickThroughOn, true);
  S.store.update(A, { pinned: true, clickThrough: true });
  await ui.H['list:apply']({}, [A], { color: 'yellow' }); // (tells the list)
  await ui.tab('notes');
  await ui.rclick(ui.noteKey(A));
  assert.ok((await ui.menuLabels()).includes('Turn off click-through'), 'right-click offers to turn it off');
  await ui.key('Escape');
  await ui.menu(ui.noteKey(A), 'Turn off click-through');
  assert.ok(!(await note(A)).clickThrough && (await note(A)).pinned, 'off, still pinned');
  await ui.rclick(ui.noteKey(A));
  assert.ok(!(await ui.menuLabels()).includes('Turn off click-through'), 'not offered when it is off');
  await ui.key('Escape');
  await ui.tab('settings');
  await ui.check('#sClickThrough');
  assert.equal((await settings()).clickThroughOn, false);

  // ---- 1.3.27: "Use on all notes" and "Reset notes…"
  await ui.H['settings:reapply'](null, Object.keys((await settings()).overrides)); // (earlier parts gave notes their own looks)
  await ui.settle();
  assert.equal(await ui.count('.reapply:not([hidden])'), 0, 'nothing to put back yet');
  assert.ok(await page.isDisabled('#sResetNotes'), 'Reset notes… has nothing to do');
  await ui.H['list:apply']({}, [A], { font: 'medieval' });
  S.store.update(A, { spell: true, panic: false });
  await ui.H['list:apply']({}, [A], { color: 'yellow' }); // (tells the list)
  await ui.settle();
  assert.equal(await ui.text('.reapply[data-o="font"] span'), '1 note uses its own.', 'under Font: one note has its own');
  assert.equal(await ui.text('.reapply[data-o="panic"] span'), '1 note stays open.', 'under the panic button: one stays open');
  await ui.click('.reapply[data-o="font"] button');
  assert.equal(await ui.modalTitle(), 'Use this on all notes?', 'it asks first');
  await ui.modalOk();
  assert.equal((await note(A)).font, (await settings()).defaultFont, 'the note gets the font set here');
  assert.ok(!(await ui.visible('.reapply[data-o="font"]')), 'and the line goes');
  assert.ok((await ui.text('#sOwnNow')).includes('2 settings'), 'General: two settings differ on some notes');
  await ui.click('#sResetNotes');
  assert.equal(await ui.count('#mInputs .resetlist input:checked'), 2, 'Reset notes…: one tick per setting, all ticked');
  await page.locator('#mInputs .resetlist input[data-o="panic"]').evaluate((x) => x.click());
  await ui.modalOk();
  assert.deepEqual([S.store.get(A).spell, S.store.get(A).panic], [null, false], 'only the ticked one is put back');
  await ui.check('#sPanic');
  await page.evaluate(() => { document.querySelector('#viewSettings').scrollTop = 0; });
  await ui.tab('notes');

  // ---- smooth scrolling in Settings (1.1.43)
  await ui.tab('settings');
  const bg = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#viewSettings')); return [s.backgroundColor, s.backgroundAttachment]; });
  assert.ok(/^rgb\(/.test(bg[0]), `Settings has a solid background colour (${bg[0]})`);
  assert.equal(bg[1], 'local, local', 'which scrolls with the page');
  // About with its feature list open is long enough to scroll
  await ui.section('about');
  await page.evaluate(() => { document.querySelector('#foldFeatures').open = true; });
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
  assert.ok(!seen.timedOut, 'Settings scrolls (About with its feature list is long enough)');
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

  // ---- 1.4.34: Ground control, with a stand-in relay (bits 0: any nonce solves it). Main sends; this checks the form.
  let relayAnswer = 503;
  let relayDelay = 0;
  const posts = [];
  const relay = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    if (req.method === 'POST') posts.push(JSON.parse(raw));
    if (relayDelay) await new Promise((ok) => setTimeout(ok, relayDelay));
    res.writeHead(relayAnswer, { 'content-type': 'application/json' });
    res.end(JSON.stringify(relayAnswer !== 200 ? { error: 'closed' } : req.url === '/challenge' ? { challenge: 'c', bits: 0 } : { ok: true, number: 1 }));
  });
  await new Promise((ok) => relay.listen(0, '127.0.0.1', ok));
  require('../main/feedback').setRelay(`http://127.0.0.1:${relay.address().port}`);
  await ui.tab('settings');
  await ui.section('ground');
  assert.equal(await ui.text('#viewSettings .setsec.on .sectitle'), 'Feedback');
  assert.equal(await ui.text('#setNav [data-sec="ground"] .lw'), 'Feedback');
  // first only the two choices; picking one opens its form, with no way to switch inside it
  assert.equal(await ui.count('#gcPick .gcchoice'), 2);
  assert.ok(await ui.visible('#gcPick') && !(await ui.visible('#gcForm')), 'first only the two choices, no fields');
  await ui.click('#gcPick [data-kind="feature"]');
  assert.ok(!(await ui.visible('#gcPick')) && await ui.visible('#gcForm'), 'a choice opens its form');
  assert.equal(await ui.text('#gcKindName'), 'Request a feature');
  assert.equal(await ui.text('#gcTextName'), 'Your idea');
  assert.ok(!(await ui.visible('#gcExpectRow')), 'a feature request: no "What did you expect?"');
  assert.equal(await ui.count('#gcForm [data-kind]'), 0, 'no switching to the other kind inside the form');
  await ui.click('#gcCancel'); // nothing typed: straight back
  assert.ok(await ui.visible('#gcPick') && !(await ui.visible('#gcForm')), 'Cancel with nothing typed goes back');
  await ui.click('#gcPick [data-kind="bug"]');
  assert.equal(await ui.text('#gcKindName'), 'Report a bug');
  assert.ok(await ui.visible('#gcExpectRow'), 'a bug report asks what they expected');
  assert.equal(await ui.text('#gcTextName'), 'What happened?');
  await ui.type('#gcTitle', 'Throwaway');
  await ui.click('#gcCancel');
  assert.equal(await ui.modalTitle(), 'Discard this report?', 'Cancel asks once something is typed');
  await ui.modalCancel();
  assert.equal(await page.inputValue('#gcTitle'), 'Throwaway', 'kept when not discarded');
  await ui.click('#gcCancel');
  await ui.modalOk();
  assert.ok(await ui.visible('#gcPick'), 'discarded: back to the choices');
  await ui.click('#gcPick [data-kind="bug"]');
  assert.equal(await page.inputValue('#gcTitle'), '', 'the discarded words are gone');
  assert.match(await ui.text('#gcDetails'), /^CosmoNotes .+ · Windows /, 'the app details that would go');
  await ui.click('#gcSend');
  assert.equal(await ui.text('#gcLine'), 'Add a title and a few words.');
  await ui.type('#gcTitle', 'Pin falls off');
  await ui.type('#gcText', 'The pin falls off after sleep.');
  // a picture pasted while Ground control shows (a PNG's header: the fake Electron reads its size from it)
  await page.evaluate(() => {
    const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); b.set([0, 0, 1, 0x90, 0, 0, 1, 0x2c], 16); // 400 × 300
    const dt = new DataTransfer(); dt.items.add(new File([b], 'shot.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await ui.settle(300);
  assert.equal(await ui.count('#gcPics .gcpic img'), 1, 'a pasted picture shows');
  await ui.settle(800); // the draft is saved half a second after typing stops
  const draft = JSON.parse(fs.readFileSync(path.join(require('./helpers/app').DATA, 'feedback-draft.json'), 'utf8'));
  assert.deepEqual([draft.bug.title, draft.bug.images.length, draft.feature], ['Pin falls off', 1, null], 'the bug’s draft is on disk while it is typed');
  // ← Back by the title, or Feedback in the sidebar again: back to the choices, the words kept, the card says "Draft"
  assert.ok(await ui.visible('#gcBack'), 'Back shows next to the title while a form is open');
  await ui.click('#gcBack');
  assert.ok(await ui.visible('#gcPick') && !(await ui.visible('#gcBack')), 'Back: the two choices, no Back button');
  assert.ok(await ui.visible('#gcPick [data-kind="bug"] .gcdraft') && !(await ui.visible('#gcPick [data-kind="feature"] .gcdraft')), 'only the bug card says Draft');
  await ui.click('#gcPick [data-kind="feature"]');
  assert.equal(await page.inputValue('#gcTitle'), '', 'the other kind starts empty');
  await ui.type('#gcTitle', 'Dark paper');
  await ui.click('#setNav [data-sec="ground"]');
  assert.ok(await ui.visible('#gcPick'), 'Feedback in the sidebar again goes back too');
  assert.equal(await ui.count('#gcPick .gcdraft:not([hidden])'), 2, 'both kinds can have a draft');
  await ui.click('#gcPick [data-kind="bug"]');
  assert.equal(await page.inputValue('#gcTitle'), 'Pin falls off', 'the bug’s words are back');
  assert.equal(await ui.count('#gcPics .gcpic img'), 1, 'and its picture');
  await ui.click('#gcSend');
  await ui.settle(300);
  assert.equal(await ui.text('#gcLine'), 'Feedback is closed for now.');
  assert.equal(await page.inputValue('#gcTitle'), 'Pin falls off', 'the words stay');
  relayAnswer = 200;
  relayDelay = 800;
  await page.evaluate(() => document.querySelector('#gcSend').click()); // not ui.click: it would wait for the answer
  await page.waitForTimeout(200);
  assert.equal(await ui.text('#gcSend'), 'Submit', 'while it sends: Submit keeps its word');
  assert.ok(await page.$eval('#gcSend', (b) => b.classList.contains('busy') && b.disabled), 'spins, and can’t be pressed');
  assert.equal(await ui.text('#gcLine'), 'Sending…', '"Sending…" is beside it');
  await ui.settle(1200);
  relayDelay = 0;
  assert.equal(posts.length, 1);
  assert.equal(posts[0].report.title, 'Pin falls off');
  assert.equal(posts[0].images.length, 1, 'the picture went too');
  assert.ok(await ui.visible('#gcPick') && await ui.visible('#gcDone'), 'sent: back to the choices, with "Sent. Thank you!"');
  assert.ok(!(await ui.visible('#gcPick [data-kind="bug"] .gcdraft')), 'the sent report’s draft is gone');
  assert.ok(await ui.visible('#gcPick [data-kind="feature"] .gcdraft'), 'the other one stays');
  assert.equal(await ui.text('#gcDone'), 'Sent. Thank you!');
  await ui.click('#gcPick [data-kind="bug"]');
  assert.ok(!(await ui.visible('#gcDone')), 'the thank-you goes once a new report starts');
  assert.equal(await page.inputValue('#gcTitle'), '', 'the form is empty again');
  assert.equal(await ui.count('#gcPics .gcpic'), 0);
  assert.match(await ui.text('#gcSend'), /^Submit \((1:00|0:[45]\d)\)$/, 'Submit still counts down');
  assert.ok(!(await page.$eval('#gcSend', (b) => b.classList.contains('busy'))), 'no spinner once it is sent');
  assert.ok(await page.isDisabled('#gcSend'));
  relay.close();
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
