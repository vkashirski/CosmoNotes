'use strict';
// Paper colours (main process): every colour a note can have, unknown ones fall back to yellow; changing the colour of
// one or several notes from the list (not an edit, open windows recolour, locked notes too), and their font; and the colour a new note
// gets: a random one of the picked colours (Settings), never the same twice in a row unless switched off, the old
// "random" and single-colour settings still read.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, ev, tick } = await app.start();
  const get = () => app.list();
  const id = await app.newNote();
  const w = app.winOf(id);

  // ---- the colours
  for (const c of ['cream', 'rose', 'sage', 'mist', 'lavender', 'night', 'midnight', 'forest', 'plum']) {
    await H['note:update'](ev(w), { color: c });
    assert.equal((await app.card(id)).color, c, `${c} is kept`);
  }
  assert.ok(w.bg && w.bg.startsWith('#'), 'the window gets the paper colour');
  await H['note:update'](ev(w), { color: 'neon' });
  assert.equal((await app.card(id)).color, 'yellow', 'unknown colour falls back to yellow');

  // ---- several notes at once (colour and font), pushed to their open windows
  const b = await app.newNote(); const c = await app.newNote();
  assert.equal(await H['list:apply'](null, [id, c], { color: 'pink', font: 'round', junk: 1 }), 2);
  assert.equal((await app.card(id)).color, 'pink'); assert.equal((await app.card(c)).font, 'round');
  assert.equal((await app.card(b)).color, 'yellow', 'the others are not touched');
  assert.ok(w.webContents.sent.includes('note:look'), 'open window told about the new colour');
  assert.equal(await H['list:apply'](null, [id], { color: 'neon' }), 0, 'unknown colours are ignored');
  assert.equal(await H['list:apply'](null, [c], { font: 'medieval' }), 1); assert.equal((await app.card(c)).font, 'medieval', 'the Medieval font');
  assert.equal(await H['list:apply'](null, [c], { font: 'comic' }), 0, 'unknown fonts are ignored');

  // ---- Edit… in the list: the colour is not an edit, the window recolours
  w.webContents.sentArgs = [];
  const t1 = (await app.card(id)).updatedAt;
  await tick(5);
  await H['list:edit'](null, id, { color: 'night' });
  assert.equal((await app.card(id)).color, 'night'); assert.equal((await app.card(id)).updatedAt, t1, 'colour is not an edit');
  assert.ok(app.sent(w, 'note:look').some((x) => x.color === 'night'));
  assert.equal(w.bg, '#2F2D35', 'window background follows');
  assert.equal(await H['list:edit'](null, id, { color: 'neon' }), null, 'nothing valid: nothing changes');
  // a locked note: its colour can still change (and its title while locked: crypt.test.js)
  await H['lock:set'](null, { current: '', next: '2468', kind: 'pin' });
  await H['list:set-locked'](null, id, true);
  await H['list:edit'](null, id, { color: 'plum', title: 'Still mine' });
  assert.equal((await app.card(id)).color, 'plum'); assert.equal((await app.card(id)).title, 'Still mine');
  await H['list:set-locked'](null, id, false, '2468');

  // ---- new notes: a random one of the picked colours
  const newColour = async () => (await app.card(await app.newNote())).color;
  await H['settings:set'](null, { defaultColors: ['midnight', 'rose', 'nope', 'sage'] });
  const s = (await get()).settings;
  assert.deepEqual(s.defaultColors, ['rose', 'sage', 'midnight'], 'unknown ones dropped, in the usual order');
  assert.equal(s.defaultColor, 'rose', 'defaultColor (for older versions) is the first one');
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(await newColour());
  assert.ok([...seen].every((x) => ['rose', 'sage', 'midnight'].includes(x)), 'only picked colours');
  assert.ok(seen.size >= 2, 'more than one of them comes up');
  // never the same colour twice in a row (on by default), unless only one colour is picked
  assert.equal(s.newColorNoRepeat, true, 'on by default');
  await H['settings:set'](null, { defaultColors: ['pink', 'mint'] });
  let prev = await newColour();
  for (let i = 0; i < 20; i++) { const x = await newColour(); assert.notEqual(x, prev, 'never the same colour twice in a row'); prev = x; }
  const dupOf = (await get()).notes.find((x) => x.color === prev && !x.deletedAt);
  await H['list:duplicate'](null, dupOf.id);
  assert.notEqual(await newColour(), prev, 'a copy (same colour) doesn’t change what came last');
  await H['settings:set'](null, { newColorNoRepeat: false });
  assert.equal((await get()).settings.newColorNoRepeat, false);
  let repeats = 0;
  prev = await newColour();
  for (let i = 0; i < 30; i++) { const x = await newColour(); if (x === prev) repeats++; prev = x; }
  assert.ok(repeats > 0, 'switched off: the same colour can come twice');
  await H['settings:set'](null, { newColorNoRepeat: true, defaultColors: ['plum'] });
  assert.equal(await newColour(), 'plum'); assert.equal(await newColour(), 'plum', 'one colour picked: always that one');
  await H['settings:set'](null, { defaultColors: [] });
  assert.deepEqual((await get()).settings.defaultColors, ['plum'], 'never empty: keeps a colour');
  await H['settings:set'](null, { defaultColor: 'plum' });
  assert.deepEqual((await get()).settings.defaultColors, ['plum'], 'the old single colour still works');
  // the old "random" becomes the 7 original pastel papers (never the dark one)
  await H['settings:set'](null, { defaultColor: 'random' });
  assert.deepEqual([...(await get()).settings.defaultColors].sort(), ['blue', 'green', 'mint', 'orange', 'pink', 'purple', 'yellow']);
  const rnd = new Set();
  for (let i = 0; i < 25; i++) rnd.add(await newColour());
  assert.ok(rnd.size >= 3, 'random gives different colours');
  assert.ok(!rnd.has('charcoal'), 'random never picks the dark paper');
  console.log('ok');
  process.exit(0);
})();
