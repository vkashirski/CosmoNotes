// 1.1.4: duplicating a note copies its content, look, drawing, group and lock; photos stay shared and safe.
const assert = require('assert'); const path = require('path'); const fs = require('fs');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
(async () => {
  await tick(150);
  const H = E.__handlers;
  await H['list:new']();
  const w = E.__all.find((x) => x.file.endsWith('note.html') && !x.destroyed);
  const orig0 = await H['note:get'](ev(w));
  const att = await H['att:save'](ev(w), new Uint8Array([137, 80, 78, 71]), 'png');
  const ink = { s: [{ t: 'pen', c: '#E5484D', w: 4, l: 'a', p: [1, 2, 30, 40] }] };
  await H['note:update'](ev(w), { title: 'Shopping', html: `<p>milk</p><img class="att-img" src="${att}">`, text: 'milk', firstImage: att, ink, wrapWidth: 300, color: 'pink', font: 'round', size: 'l' });

  // from the notes list
  const id2 = await H['list:duplicate'](null, orig0.id);
  let list = await H['list:get']();
  const a = list.notes.find((n) => n.id === orig0.id);
  const b = list.notes.find((n) => n.id === id2);
  assert.ok(b && b.id !== a.id, 'a new note was made');
  assert.equal(b.title, 'Shopping (copy)');
  assert.equal(b.text, 'milk');
  for (const k of ['color', 'font', 'size']) assert.equal(b[k], a[k], k);
  assert.equal(b.open, true, 'the copy opens on the desktop');
  const w2 = E.__all.filter((x) => x.file.endsWith('note.html') && !x.destroyed).pop();
  const full = await H['note:get'](ev(w2));
  assert.ok(full.html.includes(att), 'the copy shows the same photo');
  assert.equal(full.ink.s.length, 1); assert.equal(full.wrapWidth, 300);

  // editing the copy doesn't touch the original
  await H['note:update'](ev(w2), { html: '<p>bread</p>', text: 'bread', firstImage: null });
  list = await H['list:get']();
  assert.equal(list.notes.find((n) => n.id === orig0.id).text, 'milk');

  // from inside the note window (⋯ menu), and an untitled note stays untitled
  await H['note:update'](ev(w2), { title: '' });
  const id3 = await H['note:duplicate'](ev(w2));
  list = await H['list:get']();
  assert.equal(list.notes.find((n) => n.id === id3).title, '');
  assert.equal(list.notes.find((n) => n.id === id3).text, 'bread');

  // the photo file survives deleting the original forever, because a copy still uses it
  const id4 = await H['list:duplicate'](null, orig0.id);
  await H['list:trash'](null, orig0.id);
  await H['list:destroy'](null, orig0.id).catch(() => {});
  const attDir = path.join(process.env.FAKE_DATA, 'attachments');
  const name = decodeURIComponent(att.split('/').pop());
  assert.ok(fs.existsSync(path.join(attDir, name)), 'photo still there for the copy');
  list = await H['list:get']();
  assert.ok(!list.notes.find((n) => n.id === orig0.id) && !(list.bin || []).find((n) => n.id === orig0.id), 'original deleted forever');
  assert.ok(list.notes.find((n) => n.id === id4), 'copy kept');

  // a locked note's copy is locked too, and its window doesn't show the content
  await H['lock:set'](null, { current: '', next: '1234' });
  await H['list:set-locked'](null, id4, true, '1234');
  // the open window hides itself when told to lock (the renderer calls note:relock)
  for (const x of E.__all.filter((y) => y.file.endsWith('note.html') && !y.destroyed)) {
    const v = await H['note:get'](ev(x));
    if (v && v.id === id4) await H['note:relock'](ev(x));
  }
  const id5 = await H['list:duplicate'](null, id4);
  list = await H['list:get']();
  const c5 = list.notes.find((n) => n.id === id5);
  assert.equal(c5.locked, true, 'copy of a locked note is locked');
  const w5 = E.__all.filter((x) => x.file.endsWith('note.html') && !x.destroyed).pop();
  const v5 = await H['note:get'](ev(w5));
  assert.equal(v5.html, '', 'locked copy opens hidden');

  // a binned note can't be duplicated
  assert.equal(await H['list:duplicate'](null, orig0.id), null);
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
