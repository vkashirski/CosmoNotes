'use strict';
// Settings, in the main process (Settings in the list → settings:set): only known values are kept and saved; open notes
// are told. The list's colour theme (and the notes' pop-ups follow it), card size and sort, see-through and "solid
// while the mouse is over it" for new notes, spelling (Cyrillic off by default), checklists (1.3.19), "Use on all notes"
// (1.3.27: each setting a note can have its own value of, put back on every note; the Bin left alone; open windows told; not
// an edit). Effects settings: effects-settings.test.js. Evening colours: evening.test.js. The panic button: panic.test.js.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, E, ev } = await app.start();
  const s = async () => (await app.list()).settings;
  const w = app.noteWins()[0];

  // ---- the list's colour theme: only known ones; the notes' pop-ups follow it
  assert.equal((await s()).listTheme, 'cream', 'cream to begin with');
  await H['settings:set'](null, { listTheme: 'night' });
  assert.equal((await s()).listTheme, 'night');
  await H['settings:set'](null, { listTheme: 'midnight' });
  assert.equal((await s()).listTheme, 'midnight', 'the dark themes are allowed');
  await H['settings:set'](null, { listTheme: 'night' });
  await H['settings:set'](null, { listTheme: 'neon-green' });
  assert.equal((await s()).listTheme, 'night', 'unknown themes are ignored');
  assert.equal(app.readJSON('settings.json').listTheme, 'night', 'saved to disk');
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { listTheme: 'forest' });
  assert.ok(app.sent(w, 'settings:changed').some((x) => x.appTheme === 'forest'), 'notes get the theme');

  // ---- card size and sorting
  await H['settings:set'](null, { listSize: 'l' });
  assert.equal((await s()).listSize, 'l');
  await H['settings:set'](null, { listSize: 'huge' });
  assert.equal((await s()).listSize, 'l', 'unknown size ignored');
  await H['settings:set'](null, { listSort: { by: 'created', dir: 'asc', groups: 'first', junk: 1 } });
  assert.deepEqual((await s()).listSort, { by: 'created', dir: 'asc', groups: 'first' }, 'only the known parts of the sort are kept');

  // ---- see-through for new notes: 5 % steps, at least 25 %
  assert.equal((await s()).defaultOpacity, 1);
  await H['settings:set'](null, { defaultOpacity: 0.62 });
  assert.equal((await s()).defaultOpacity, 0.6, 'rounded to 5% steps');
  await H['settings:set'](null, { defaultOpacity: 0.05 });
  assert.equal((await s()).defaultOpacity, 0.25, 'never less than 25%');
  await H['settings:set'](null, { defaultOpacity: 0.7 });
  let id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).opacity, 0.7, 'a new note starts see-through as set');
  await H['settings:set'](null, { defaultOpacity: 1 });

  // ---- "turn solid when my mouse is over it" for new notes (1.1.12)
  assert.equal((await s()).defaultSolidOnHover, true, 'on by default');
  await H['settings:set'](null, { defaultSolidOnHover: false });
  assert.equal((await s()).defaultSolidOnHover, false);
  id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).solidOnHover, false, 'a new note follows the setting');
  await H['settings:set'](null, { defaultSolidOnHover: true });
  id = await app.newNote();
  assert.equal((await H['note:get'](ev(app.winOf(id)))).solidOnHover, true);

  // ---- spelling: English only to begin with; Cyrillic only when asked for
  assert.deepEqual(E.__langs, ['en-US'], 'Cyrillic ignored by default');
  assert.equal((await H['note:get'](ev(w))).settings.spellCheck, false);
  await H['settings:set'](null, { spellCheck: true, spellCyrillic: true });
  assert.deepEqual(E.__langs, ['en-US', 'sr', 'bg', 'ru', 'uk']);

  // ---- checklists (1.3.19): drag on, the other two off to begin with; open notes are told; a note keeps its own choice
  let ns = (await H['note:get'](ev(w))).settings;
  assert.deepEqual([ns.checkDrag, ns.checkSink, ns.checkFixed], [true, false, false], 'drag on, the others off');
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { checkSink: true, checkFixed: 1, checkDrag: false });
  assert.deepEqual([(await s()).checkDrag, (await s()).checkSink, (await s()).checkFixed], [false, true, true], 'saved as true / false');
  assert.equal(app.readJSON('settings.json').checkSink, true, 'saved to disk');
  assert.ok(app.sent(w, 'settings:changed').some((x) => x.checkSink === true && x.checkFixed === true && x.checkDrag === false), 'open notes are told');
  await H['note:update'](ev(w), { checklist: { sink: false, drag: 'no' } });
  ns = await H['note:get'](ev(w));
  assert.deepEqual(ns.checklist, { drag: null, sink: false, fixed: null }, "the note's own choice (true / false only)");
  require('../main/state').S.store.flush();
  assert.deepEqual(app.readJSON(`notes/${ns.id}.json`).checklist, { drag: null, sink: false, fixed: null }, 'saved with the note');
  await H['settings:set'](null, { checkSink: false, checkFixed: false, checkDrag: true });

  // ---- 1.3.27: "Use on all notes" / "Reset notes…": notes with their own value of a setting get the one in Settings
  const { S } = require('../main/state');
  const got = (id) => S.store.get(id);
  const own = async () => (await s()).overrides;
  // start from notes that all match Settings (earlier parts of this test gave some their own)
  assert.equal(await H['settings:reapply'](null, ['no-such-setting']), 0, 'unknown settings: nothing');
  await H['settings:reapply'](null, Object.keys(await own()));
  assert.ok(Object.values(await own()).every((n) => n === 0), `every note uses Settings (${JSON.stringify(await own())})`);
  const x = await app.newNote({ title: 'x' });
  const y = await app.newNote({ title: 'y' });
  const binned = await app.newNote({ title: 'binned', close: true });
  const mine = { font: 'round', opacity: 0.5, solidOnHover: false, spell: true, checklist: { drag: false, sink: true, fixed: null },
    fx: { e: 'snow', ea: 'high', f: 'hearts' }, fxPaused: true, evening: true, panic: false };
  await H['note:update'](ev(app.winOf(x)), mine);
  await H['note:update'](ev(app.winOf(y)), { font: 'medieval', spell: false });
  S.store.update(binned, mine);
  await H['list:trash']({}, binned);
  let o = await own();
  assert.deepEqual(o, { font: 2, opacity: 1, solidOnHover: 1, effect: 1, follower: 1, fxPause: 1, spell: 2, checkDrag: 1, checkSink: 1, checkFixed: 0, evening: 1, panic: 1 },
    'the list gets how many notes have their own, per setting (not counting the Bin)');
  const editedAt = got(x).updatedAt;
  // one setting: only it changes, on every note that had its own; the open window gets it at once
  app.winOf(x).webContents.sentArgs = [];
  assert.equal(await H['settings:reapply'](null, ['font']), 2, 'two notes changed');
  assert.deepEqual([got(x).font, got(y).font], ['hand', 'hand'], 'the font set for new notes');
  assert.equal(app.lastLook(app.winOf(x)).font, 'hand', 'the open window is told');
  assert.equal(got(x).spell, true, 'nothing else changes');
  assert.equal(got(binned).font, 'round', 'a note in the Bin is left alone');
  // "for new notes" settings copy the value now set: a later change to Settings doesn't touch the notes
  await H['settings:set'](null, { defaultFont: 'round' });
  const liveCount = (await app.list()).notes.filter((m) => !m.deletedAt).length;
  assert.equal((await own()).font, liveCount, 'after Settings changes, every note on the old font counts as its own');
  await H['settings:reapply'](null, ['font']);
  assert.ok((await app.list()).notes.filter((n) => !n.deletedAt).every((n) => n.font === 'round'), 'all on the new font');
  await H['settings:set'](null, { defaultFont: 'hand' });
  assert.equal(got(x).font, 'round', 'and they keep it when Settings changes again');
  await H['settings:reapply'](null, ['font']);
  // background effect and mouse follower are separate
  await H['settings:reapply'](null, ['effect']);
  assert.deepEqual([got(x).fx.e, got(x).fx.ea, got(x).fx.f], [null, null, 'hearts'], 'the background follows Settings again, the follower is kept');
  // several at once (Reset notes…)
  await H['settings:reapply'](null, ['opacity', 'solidOnHover', 'follower', 'fxPause', 'spell', 'checkDrag', 'checkSink', 'evening', 'panic']);
  const n = got(x);
  assert.deepEqual([n.opacity, n.solidOnHover, n.fx.f, n.fxPaused, n.fxPlay, n.spell, n.evening, n.panic], [1, true, null, false, false, null, null, null], 'all back to Settings');
  assert.deepEqual(n.checklist, { drag: null, sink: null, fixed: null });
  assert.equal(got(y).spell, null, 'a note whose own choice was "off" too');
  assert.ok(Object.values(await own()).every((k) => k === 0), 'nothing left');
  assert.equal(got(x).updatedAt, editedAt, 'not an edit: "last edited" stays');
  assert.equal(got(binned).spell, true, 'the Bin still left alone');
  assert.equal(await H['settings:reapply'](null, ['spell']), 0, 'nothing to change: 0');
  console.log('ok');
  process.exit(0);
})();
