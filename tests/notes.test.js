'use strict';
// Editing and saving a note, in the main process: the title (and what counts as an edit), the drawing (cleaned, kept
// exactly as it is when only the words change, dashed / dotted lines), zoom, word wrap off, favourites, Edit… from the
// list (title only, never the words), and the Bin (trash, restore, delete for good).
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, L, ev, tick } = await app.start();
  const id = await app.newNote();
  const w = app.winOf(id);

  // ---- the title: the window's title, an edit; the created date never changes
  let n = await H['note:get'](ev(w));
  const created = n.createdAt;
  await tick(5);
  n = await H['note:update'](ev(w), { title: 'Shopping\nlist' });
  assert.equal(n.title, 'Shopping list', 'one line'); assert.equal(w.title, 'Shopping list');
  assert.ok(n.updatedAt > created, 'a title change updates "last edited"');
  assert.equal(n.createdAt, created, 'the created date never changes');
  // typing in the window shows in the list
  await H['note:update'](ev(w), { html: '<div>typed in the note</div>', text: 'typed in the note' });
  assert.equal((await app.card(id)).text, 'typed in the note');

  // ---- Edit… in the list: the title (an edit, the open window follows), never the words or the font
  w.webContents.sentArgs = [];
  const n0 = await app.card(id);
  await tick(5);
  const r = await H['list:edit'](null, id, { title: 'From the list', html: '<div>not taken</div>', text: 'not taken', font: 'round' });
  assert.ok(r.updatedAt > n0.updatedAt, 'a new title counts as an edit');
  n = await app.card(id);
  assert.equal(n.title, 'From the list');
  assert.equal(n.text, 'typed in the note', 'the words can’t be changed from the list');
  assert.equal(n.font, n0.font, 'nor the font');
  assert.ok(app.sent(w, 'note:look').some((x) => x.title === 'From the list'), 'the open window gets the new title');
  assert.equal(w.title, 'From the list', 'window title follows');

  // ---- the drawing: cleaned when it changes, an edit; silly widths ignored
  const before = (await H['note:get'](ev(w))).updatedAt;
  await tick(5);
  const big = [];
  for (let k = 0; k < 300; k++) { const p = []; for (let i = 0; i < 200; i++) p.push(i * 1.234567, k + i * 0.5); big.push({ t: 'pen', c: '#E5484D', w: 4, l: 'a', p }); }
  n = await H['note:update'](ev(w), { ink: { s: big }, wrapWidth: 312 });
  assert.equal(n.ink.s.length, 300); assert.equal(n.wrapWidth, 312);
  assert.equal(n.ink.s[0].p[2], 1.2, 'a drawing change is cleaned (rounded)');
  assert.ok(n.updatedAt > before, 'drawing counts as an edit');
  n = await H['note:update'](ev(w), { wrapWidth: 20 });
  assert.equal(n.wrapWidth, null, 'silly widths are ignored');
  await H['note:update'](ev(w), { wrapWidth: 312 });
  // typing keeps the drawing exactly as it is (it is not cleaned again: points never drift)
  for (let i = 0; i < 20; i++) n = await H['note:update'](ev(w), { html: `<div>Typing ${i}</div>`, text: `Typing ${i}` });
  assert.equal(n.ink.s.length, 300, 'drawing kept');
  assert.deepEqual(n.ink.s[5].p.slice(0, 4), [0, 5, 1.2, 5.5], 'drawing unchanged');
  // a group recolour keeps it too
  const other = await app.newNote();
  const g = await H['groups:make'](null, id, other);
  await H['groups:apply'](null, g, { color: 'blue' }, true);
  assert.equal((await app.card(id)).color, 'blue');
  assert.equal((await H['note:get'](ev(w))).ink.s.length, 300, 'drawing kept after a group recolour');
  await H['groups:dissolve'](null, g);
  // dashed / dotted lines are kept (with where an erased piece's pattern carries on, 1.1.14); anything else is solid
  await H['note:update'](ev(w), { ink: { s: [
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dot', p: [1, 1, 20, 20] },
    { t: 'arrow', c: '#2B2B2B', w: 2, l: 'a', d: 'dash', p: [1, 1, 30, 30] },
    { t: 'rect', c: '#2B2B2B', w: 2, l: 'b', d: 'wavy', o: 5, p: [1, 1, 30, 30] },
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dot', o: 12.34, p: [1, 1, 20, 20] },
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dash', o: -3, p: [1, 1, 20, 20] },
  ] } });
  const ink = (await H['note:get'](ev(w))).ink.s;
  assert.equal(ink[0].d, 'dot'); assert.equal(ink[1].d, 'dash'); assert.equal(ink[2].d, undefined);
  assert.equal(ink[2].o, undefined, 'no offset on a solid line');
  assert.equal(ink[3].o, 12.3);
  assert.equal(ink[4].o, undefined, 'nonsense offsets are dropped');
  // removing the drawing works
  assert.equal((await H['note:update'](ev(w), { ink: null })).ink, null);

  // ---- zoom inside a note: kept per note, 50–300 %, not an edit
  const ed = (await H['note:get'](ev(w))).updatedAt;
  await tick(5);
  await H['note:update'](ev(w), { zoom: 1.5 });
  const zn = await H['note:get'](ev(w));
  assert.equal(zn.zoom, 1.5); assert.equal(zn.updatedAt, ed, 'zooming is not an edit');
  await H['note:update'](ev(w), { zoom: 9 });
  assert.equal((await H['note:get'](ev(w))).zoom, 3, 'at most 300 %');
  await H['note:update'](ev(w), { zoom: 'x' });
  assert.equal((await H['note:get'](ev(w))).zoom, 1, 'nonsense = 100 %');

  // ---- word wrap off (1.1.45): the window may change it, and it is kept
  assert.equal((await H['note:update'](ev(w), { nowrap: true, wrapWidth: 300 })).nowrap, true);
  assert.equal((await H['note:get'](ev(w))).nowrap, true);

  // ---- favourites: notes and groups; not an edit; a copy is not a favourite
  const a = id; const b = other;
  const fb = (await app.card(a)).updatedAt;
  await tick(5);
  assert.equal(await H['list:favorite'](null, [a, b], true), 2);
  assert.equal((await app.card(a)).favorite, true);
  assert.equal((await app.card(b)).favorite, true);
  assert.equal((await app.card(a)).updatedAt, fb, 'starring is not an edit');
  await H['list:favorite'](null, [b], false);
  assert.equal((await app.card(b)).favorite, false);

  // ---- the Bin: trash, restore, delete for good
  await H['list:trash'](null, b);
  assert.ok((await app.card(b)).deletedAt);
  await H['list:restore'](null, b);
  assert.equal((await app.card(b)).deletedAt, null, 'restored');
  await H['list:trash'](null, b);
  assert.equal(await H['list:destroy'](null, b), true);
  assert.equal(await app.card(b), undefined, 'deleted for good');
  // the last save of a closing window still lands
  const e = ev(w); L['note:update-sync'](e, { html: 'last words', text: 'last words' });
  assert.equal(e.returnValue, true); assert.equal((await app.card(a)).text, 'last words');
  console.log('ok');
  process.exit(0);
})();
