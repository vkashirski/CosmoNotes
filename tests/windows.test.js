'use strict';
// Note windows, in the main process: the welcome note of a first start, what a window shows (see-through, solid while
// the mouse is over it, pinned on top, paper colour, rolled up), where a new note opens and that a moved note is
// remembered, click-through (1.3.34), minimise / maximise, the window title, "Bring notes to front" and a second start,
// the mouse's back button in the list, closing (X) vs quitting (notes reopen where they were), reopening a closed note (1.3.30),
// quick clicks on + while slow windows load (1.4.6), and the text's right-click Add ▸ and a small note's » menu (1.4.11).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

(async () => {
  const { H, L, E, ev, tick } = await app.start();

  // ---- the first start opens a welcome note
  assert.equal(app.noteWins().length, 1, 'welcome note opens on first run');
  const w = app.noteWins()[0];
  const n = await H['note:get'](ev(w));
  assert.ok(n.html.includes('checklist'));

  // ---- what the window shows
  await H['note:update'](ev(w), { html: '<b>x</b>', text: 'x', opacity: 0.5, pinned: true, color: 'mint', evil: 1 });
  assert.equal(w.opacity, 0.5); assert.equal(w.top, true); assert.equal(w.bg, '#CDF3E8');
  L['note:hover'](ev(w), true); assert.equal(w.opacity, 1, 'solid while the mouse is over it');
  L['note:hover'](ev(w), false); assert.equal(w.opacity, 0.5);
  await H['note:update'](ev(w), { rolled: true }); assert.equal(w.bounds.height, 34, 'rolled up');
  await H['note:update'](ev(w), { rolled: false }); assert.equal(w.bounds.height, 300);

  // ---- typing only saves: it doesn't re-apply on top / see-through / colour; the window title follows the first line
  await H['note:update'](ev(w), { title: '' });
  const calls = { top: 0, opacity: 0, bg: 0, title: 0 };
  const spy = (name, key) => { const f = w[name].bind(w); w[name] = (...a) => { calls[key]++; return f(...a); }; };
  spy('setAlwaysOnTop', 'top'); spy('setOpacity', 'opacity'); spy('setBackgroundColor', 'bg'); spy('setTitle', 'title');
  for (let i = 0; i < 20; i++) await H['note:update'](ev(w), { html: `<div>Typing ${i}</div>`, text: `Typing ${i}` });
  assert.equal(calls.top, 0, 'typing does not re-apply always-on-top');
  assert.equal(calls.opacity + calls.bg, 0, 'typing does not re-apply opacity / colour');
  assert.ok(calls.title >= 1 && calls.title <= 20, 'the window title follows the text');
  assert.equal(w.title, 'Typing 19');
  const titles = calls.title;
  await H['note:update'](ev(w), { html: '<div>Typing 19</div>', text: 'Typing 19' });
  assert.equal(calls.title, titles, 'an unchanged title is not set again');
  await H['note:update'](ev(w), { pinned: false }); await H['note:update'](ev(w), { pinned: true });
  assert.equal(calls.top, 2, 'a real change still applies'); assert.equal(w.top, true);

  // ---- click-through (1.3.34): only with Settings → Click-through on; turning it on pins the note; only the button wakes it
  const ST = require('../main/state').S;
  await H['note:update'](ev(w), { pinned: false });
  let v = await H['note:update'](ev(w), { clickThrough: true });
  assert.ok(v.clickThrough && v.pinned && w.top, 'turning it on pins the note');
  assert.ok(!w.ignoreMouse, 'Settings → Click-through is off: the note takes the mouse');
  await H['settings:set'](null, { clickThroughOn: true });
  assert.deepEqual(w.ignoreMouse, { forward: true }, 'on: the mouse goes through, its moves still come (forward)');
  assert.ok(w.webContents.sentArgs.some(([ch, s]) => ch === 'settings:changed' && s.clickThroughOn === true), 'the notes are told (they show the button)');
  L['note:hover'](ev(w), true); assert.equal(w.opacity, 0.5, 'it stays see-through under the mouse'); L['note:hover'](ev(w), false);
  L['note:ct-awake'](ev(w), true); assert.equal(w.ignoreMouse, false, 'the mouse on its button: it takes clicks');
  await H['note:update'](ev(w), { color: 'mint' }); assert.equal(w.ignoreMouse, false, 'other changes don’t put it back to sleep');
  L['note:ct-awake'](ev(w), false); assert.deepEqual(w.ignoreMouse, { forward: true }, 'the mouse left the button: through again');
  v = await H['note:update'](ev(w), { pinned: false });
  assert.ok(!v.clickThrough && !w.ignoreMouse && !w.top, 'unpinning ends it');
  L['note:ct-awake'](ev(w), true); L['note:ct-awake'](ev(w), false); assert.equal(w.ignoreMouse, false, 'not click-through: the button changes nothing');
  await H['note:update'](ev(w), { clickThrough: true });
  assert.ok((await H['list:get']()).notes.find((x) => x.id === w.noteId).clickThrough, 'the list knows (right-click → Turn off)');
  await H['settings:set'](null, { clickThroughOn: false });
  assert.ok(!w.ignoreMouse && ST.store.get(w.noteId).clickThrough, 'Settings off: the mouse is back, the note keeps its choice');
  await H['settings:set'](null, { clickThroughOn: true });
  assert.deepEqual(w.ignoreMouse, { forward: true }, 'and on again');
  await H['list:click-through-off'](null, w.noteId);
  assert.ok(!ST.store.get(w.noteId).clickThrough && !w.ignoreMouse && w.top, 'right-click → Turn off click-through: it stays pinned');
  assert.ok(w.webContents.sentArgs.some(([ch, x]) => ch === 'note:look' && x.clickThrough === false), 'its window is told');
  await H['note:update'](ev(w), { color: 'mint' });
  await H['settings:set'](null, { clickThroughOn: false });

  // ---- 1.4.11: right-click in the text → Add ▸ the note's Add items (only in its text, only while its words show); a small
  // note's » menu: the lines it sends, a tick for the pin, the line picked goes back to it
  const menuOf = (e) => { E.__popups.length = 0; w.webContents.emit('context-menu', { preventDefault() {} }, { misspelledWord: '', dictionarySuggestions: [], isEditable: true, formControlType: 'none', selectionText: '', editFlags: { canCut: false, canCopy: false, canPaste: true }, ...e }); return E.__popups.length ? E.__popups[0].t : null; };
  const addOf = (t) => t && t.find((x) => x.label === 'Add');
  assert.ok(!addOf(menuOf()), 'no Add before the note has sent its items');
  L['note:add-items'](ev(w), [{ act: 'photo', label: 'Photo' }, { act: 'date', label: 'Today’s date' }, { act: 'bad act!', label: 'x' }, { act: 'link', label: '' }, null]);
  let add = addOf(menuOf());
  assert.deepEqual(add.submenu.map((x) => x.label), ['Photo', 'Today’s date'], 'Add ▸ its items (the odd ones dropped)');
  assert.ok(menuOf().some((x) => x.role === 'paste'), 'with Cut / Copy / Paste still there');
  w.webContents.sentArgs.length = 0;
  add.submenu[1].click();
  assert.deepEqual(w.webContents.sentArgs.pop(), ['note:add', 'date'], 'picked: the note is told');
  assert.ok(!addOf(menuOf({ formControlType: 'input-text' })), 'not in a box (the title, a password)');
  assert.ok(!addOf(menuOf({ isEditable: false, selectionText: 'x' })), 'not on words that can’t be edited');
  const wasRevealed = w.revealed;
  ST.store.update(w.noteId, { locked: true }); w.revealed = false; // (as a lock leaves its window)
  assert.ok(!addOf(menuOf()), 'a hidden locked note: no Add');
  ST.store.update(w.noteId, { locked: false }); w.revealed = wasRevealed;
  assert.ok(addOf(menuOf()), 'shown again: Add is back');
  E.__popups.length = 0;
  L['note:bar-menu'](ev(w), [{ id: 'btnList', label: 'All notes' }, { id: 'btnPin', label: 'Pin on top', checked: true }, { id: 'x y', label: 'bad' }], 30.4, 32);
  const bar = E.__popups.pop();
  assert.deepEqual(bar.t.map((x) => [x.label, x.type || 'normal', !!x.checked]), [['All notes', 'normal', false], ['Pin on top', 'checkbox', true]], '» : its lines, the pin as a tick');
  assert.ok(bar.o.window === w && bar.o.x === 30 && bar.o.y === 32, 'under the » button, in its window');
  bar.t[1].click();
  assert.deepEqual(w.webContents.sentArgs.pop(), ['note:bar-act', 'btnPin'], 'the line picked goes back to the note');
  E.__popups.length = 0;
  L['note:bar-menu'](ev(w), 'nothing', 0, 0);
  assert.equal(E.__popups.length, 0, 'nothing to show: no menu');

  let prevented = false;
  w.emit('page-title-updated', { preventDefault() { prevented = true; } }, 'CosmoNotes');
  assert.ok(prevented, 'the page title never replaces the note title');

  // ---- a moved note is remembered; a new note opens beside it
  w.setPosition(500, 400); await tick(800);
  await H['note:new'](ev(w));
  assert.equal(app.noteWins().length, 2);
  assert.equal(app.noteWins()[1].bounds.x, 500 + 340 + 14, 'new note placed beside');

  // ---- minimise / maximise
  const w2 = app.noteWins()[1];
  await H['note:update'](ev(w2), { pinned: true });
  await H['note:minimize'](ev(w2));
  assert.equal(w2.isMinimized(), true);
  await tick(60);
  assert.equal(w2.isMinimized(), true, 'a pinned note stays down when its own button minimised it');
  w2.restore();
  assert.equal(w2.userMin, false); assert.equal(w2.minimizable, false, 'the system minimise stays off again');
  assert.equal(await H['note:maximize'](ev(w2)), true);
  assert.equal(w2.isMaximized(), true);
  assert.equal(await H['note:maximize'](ev(w2)), false, 'again: back to normal');
  await H['note:update'](ev(w2), { rolled: true });
  await H['note:maximize'](ev(w2));
  assert.equal((await H['note:get'](ev(w2))).rolled, false, 'a rolled-up note unrolls before maximising');
  await H['note:maximize'](ev(w2));

  // ---- 1.4.2: pinned notes over each other: the one pinned or clicked last stays on top (enforcePinned, every 2.5 s,
  // calls setAlwaysOnTop oldest first: Windows puts each call above the others, so the last call is on top)
  const { enforcePinned } = require('../main/note-window');
  const stack = () => { E.__onTopCalls.length = 0; enforcePinned(); return E.__onTopCalls.filter((x) => x === w || x === w2).map((x) => (x === w ? 'w' : 'w2')); };
  assert.deepEqual(stack(), ['w', 'w2'], 'w2 was pinned last: it ends on top');
  w.emit('focus');
  assert.deepEqual(stack(), ['w2', 'w'], 'clicked: w comes up, and stays up');
  await H['note:update'](ev(w2), { pinned: false }); await H['note:update'](ev(w2), { pinned: true });
  assert.deepEqual(stack(), ['w', 'w2'], 'pinned again: on top again');
  E.__onTopCalls.length = 0;
  await H['note:update'](ev(w), { color: 'pink', opacity: 0.9 }); await H['note:update'](ev(w), { pinned: true });
  assert.equal(E.__onTopCalls.length, 0, 'a new colour, or pinning a pinned note, does not bring it up');
  await H['note:update'](ev(w), { color: 'mint', opacity: 0.5 });

  // ---- "Bring notes to front" unrolls rolled-up notes; starting CosmoNotes again only brings them up
  await H['note:update'](ev(w), { rolled: true });
  E.app.emit('second-instance');
  assert.equal((await H['note:get'](ev(w))).rolled, true, 'starting again only brings notes up');
  w.webContents.sent.length = 0;
  await H['list:bring-front']();
  assert.equal((await H['note:get'](ev(w))).rolled, false, 'unrolled');
  assert.ok(w.getBounds().height > 100, 'back to its full height');
  assert.ok(w.webContents.sent.includes('note:look'), 'the note window is told');

  // ---- the mouse's back / forward buttons (Windows sends them as commands) reach the notes list
  await H['list:show']();
  const lw = app.listWin();
  lw.emit('app-command', {}, 'browser-backward');
  lw.emit('app-command', {}, 'media-play-pause');
  assert.deepEqual(lw.webContents.sent.filter((c) => c === 'list:nav'), ['list:nav'], 'back button → list:nav; other commands ignored');

  // ---- closing with X: still in the list, closed
  await H['note:close'](ev(w2));
  let list = await app.list();
  assert.equal(list.notes.length, 2);
  assert.equal(list.notes.filter((x) => x.open).length, 1);
  const firstId = list.notes.find((x) => x.open).id;
  // closed some other way (Alt+F4) while the app keeps running: a moment later it is saved as closed (won't reopen)
  const other = list.notes.find((x) => !x.open).id;
  await H['list:open-note'](null, other);
  const { S } = require('../main/state');
  assert.equal(S.store.get(other).open, true);
  app.winOf(other).close();
  assert.equal(S.store.get(other).open, true, 'not at once (it may be Windows shutting down)');
  await tick(2700);
  assert.equal(S.store.get(other).open, false, 'Alt+F4: remembered as closed');

  // ---- 1.3.30: reopen closed note (Ctrl+Shift+T in the list, the tray), newest first, like a browser's closed tabs
  const reopenItem = () => E.__tray.menu.t.find((x) => x.label === 'Reopen closed note');
  assert.equal(reopenItem().enabled, true, 'the tray offers the note closed with Alt+F4');
  assert.equal(await H['list:reopen-closed'](), other, 'Alt+F4 counts');
  assert.equal(S.store.get(other).open, true); assert.ok(app.winOf(other), 'its window is open again');
  assert.equal(reopenItem().enabled, false, 'nothing left: the tray item is grey');
  assert.equal(await H['list:reopen-closed'](), null, 'nothing to reopen: nothing happens');
  // closed with its X, then from the list: the list's one comes back first
  await H['list:close-note'](null, other);
  await H['note:close'](ev(app.winOf(firstId)));
  assert.equal(reopenItem().enabled, true, 'the item counts a window only once it is gone');
  await H['list:close-note'](null, other); // already closed: not counted twice
  assert.equal(await H['list:reopen-closed'](), firstId, 'newest first');
  assert.equal(await H['list:reopen-closed'](), other);
  // opened again by hand, or binned: skipped
  await H['list:close-note'](null, other);
  await H['list:open-note'](null, other);
  assert.equal(reopenItem().enabled, false, 'opened again from the list: nothing to reopen');
  assert.equal(await H['list:reopen-closed'](), null);
  await H['list:close-note'](null, other);
  await H['list:trash'](null, other);
  assert.equal(await H['list:reopen-closed'](), null, 'a note in the Bin stays there');
  await H['list:restore'](null, other);
  // quitting, Windows shutting down and the panic button don't count (panic.test.js: it has "Reopen notes")

  // ---- 1.4.6: a new note's window can take seconds to show (slow PC): every click still makes a note (the owner's wish),
  // and each click's answer waits until its note has shown (the + spins until then)
  {
    const load0 = E.BrowserWindow.prototype.loadFile;
    const showNow = [];
    E.BrowserWindow.prototype.loadFile = function (f) { this.file = f; showNow.push(() => this.emit('ready-to-show')); };
    const from = app.winOf(firstId);
    const before = app.noteWins().length;
    const asks = [H['note:new'](ev(from)), H['note:new'](ev(from)), H['list:new'](null, null), H['note:new'](ev(from))];
    await tick(30);
    assert.equal(app.noteWins().length, before + 4, 'four quick clicks: four notes');
    let done = 0; asks.forEach((p) => p.then(() => { done++; }));
    await tick(30); assert.equal(done, 0, 'none answered while their windows load');
    showNow.shift()(); await tick(10);
    assert.equal(done, 1, 'a click is answered once its own note shows');
    // a window that closes before it ever shows still answers
    app.noteWins().find((x) => !x.isVisible()).close(); await tick(10);
    assert.equal(done, 2);
    showNow.splice(0).forEach((f) => f());
    const ids = await Promise.all(asks);
    assert.equal(new Set(ids).size, 4, 'each click gets its own note');
    E.BrowserWindow.prototype.loadFile = load0;
    for (const id of ids) await H['list:close-note'](null, id);
  }

  // ---- the last save when a window goes away, then quitting: open notes stay open for next time
  const e3 = ev(app.winOf(firstId)); L['note:update-sync'](e3, { html: 'final words', text: 'final words' }); assert.equal(e3.returnValue, true);
  E.app.quit(); E.__all.forEach((x) => x.close()); await tick(2700);
  const dir = path.join(app.DATA, 'notes');
  const saved = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f))));
  const openOne = saved.find((x) => x.id === firstId);
  assert.equal(openOne.open, true, 'still marked open after quit -> reopens next launch');
  assert.equal(openOne.html, 'final words');
  assert.deepEqual([openOne.bounds.x, openOne.bounds.y], [500, 400], 'position remembered');
  assert.ok(fs.readdirSync(path.join(app.DATA, 'backups')).length >= 1, 'daily backup made');
  console.log('ok');
  process.exit(0);
})();
