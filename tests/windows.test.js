'use strict';
// Note windows, in the main process: the welcome note of a first start, what a window shows (see-through, solid while
// the mouse is over it, pinned on top, paper colour, rolled up), where a new note opens and that a moved note is
// remembered, minimise / maximise, the window title, "Bring notes to front" and a second start, the mouse's back button
// in the list, and closing (X) vs quitting (notes reopen where they were).
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
