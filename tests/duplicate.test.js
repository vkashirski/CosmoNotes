'use strict';
// Duplicate (from the list and from the note's ⋯ menu): the copy has the same words, look, drawing, layout, effects
// and word wrap, "(copy)" after the title, is not a favourite, and is a note of its own; a photo stays while any copy
// uses it; a locked note's copy is locked and opens hidden; a note in the Bin can't be duplicated.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

(async () => {
  const { H, ev } = await app.start();
  const id = await app.newNote();
  const w = app.winOf(id);
  const att = await H['att:save'](ev(w), new Uint8Array([137, 80, 78, 71]), 'png');
  const ink = { s: [{ t: 'pen', c: '#E5484D', w: 4, l: 'a', p: [1, 2, 30, 40] }] };
  const fx = { e: 'rain', f: 'none', ea: 'high', fa: null, eo: 0.45, fo: null, mi: true };
  await H['note:update'](ev(w), { title: 'Shopping', html: `<p>milk</p><img class="att-img" src="${att}">`, text: 'milk', firstImage: att, ink, wrapWidth: 300, nowrap: true, color: 'pink', font: 'round', size: 'l', fx });
  await H['list:favorite'](null, [id], true);

  // ---- from the notes list
  const id2 = await H['list:duplicate'](null, id);
  const a = await app.card(id); const b = await app.card(id2);
  assert.ok(b && b.id !== a.id, 'a new note was made');
  assert.equal(b.title, 'Shopping (copy)');
  assert.equal(b.text, 'milk');
  for (const k of ['color', 'font', 'size']) assert.equal(b[k], a[k], k);
  assert.deepEqual(b.fx, fx, 'the effects too');
  assert.equal(b.favorite, false, 'a copy is not a favourite');
  assert.equal(b.open, true, 'the copy opens on the desktop');
  const w2 = app.winOf(id2);
  const full = await H['note:get'](ev(w2));
  assert.ok(full.html.includes(att), 'the copy shows the same photo');
  assert.equal(full.ink.s.length, 1); assert.equal(full.wrapWidth, 300); assert.equal(full.nowrap, true);

  // ---- editing the copy doesn't touch the original
  await H['note:update'](ev(w2), { html: '<p>bread</p>', text: 'bread', firstImage: null });
  assert.equal((await app.card(id)).text, 'milk');

  // ---- from inside the note window (⋯ menu); an untitled note stays untitled
  await H['note:update'](ev(w2), { title: '' });
  const id3 = await H['note:duplicate'](ev(w2));
  assert.equal((await app.card(id3)).title, '');
  assert.equal((await app.card(id3)).text, 'bread');

  // ---- the photo survives deleting the original for good, because a copy still uses it
  const id4 = await H['list:duplicate'](null, id);
  await H['list:trash'](null, id);
  assert.equal(await H['list:duplicate'](null, id), null, 'a note in the Bin can’t be duplicated');
  await H['list:destroy'](null, id);
  const name = decodeURIComponent(att.split('/').pop());
  assert.ok(fs.existsSync(path.join(app.DATA, 'attachments', name)), 'photo still there for the copy');
  const list = await app.list();
  assert.ok(!list.notes.find((n) => n.id === id) && !(list.bin || []).find((n) => n.id === id), 'original deleted for good');
  assert.ok(list.notes.find((n) => n.id === id4), 'copy kept');

  // ---- a locked note's copy is locked too, and its window doesn't show the content
  await H['lock:set'](null, { current: '', next: '1234' });
  await H['list:set-locked'](null, id4, true, '1234');
  await H['note:relock'](ev(app.winOf(id4))); // (the open window hides itself when told to lock)
  const id5 = await H['list:duplicate'](null, id4);
  assert.equal((await app.card(id5)).locked, true, 'copy of a locked note is locked');
  assert.equal((await H['note:get'](ev(app.winOf(id5)))).html, '', 'locked copy opens hidden');
  console.log('ok');
  process.exit(0);
})();
