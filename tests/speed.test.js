// 1.1.11: speed-ups that must not change behaviour.
// - A save without a drawing change keeps the (already clean) drawing as it is; a drawing change is still cleaned.
// - Typing only updates the window title; it no longer re-applies "always on top", opacity and colour.
const assert = require('assert'); const path = require('path');
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
  // a big drawing
  const s = [];
  for (let k = 0; k < 300; k++) { const p = []; for (let i = 0; i < 200; i++) p.push(i * 1.234567, k + i * 0.5); s.push({ t: 'pen', c: '#E5484D', w: 4, l: 'a', p }); }
  let n = await H['note:update'](ev(w), { ink: { s }, title: '' }); // no title: the window is named after the first line
  assert.equal(n.ink.s.length, 300);
  assert.equal(n.ink.s[0].p[2], 1.2, 'a drawing change is still cleaned (rounded)');
  // typing: the drawing stays exactly the same, and it's quick
  let calls = { top: 0, opacity: 0, bg: 0, title: 0 };
  const wrap = (name, key) => { const f = w[name].bind(w); w[name] = (...a) => { calls[key]++; return f(...a); }; };
  wrap('setAlwaysOnTop', 'top'); wrap('setOpacity', 'opacity'); wrap('setBackgroundColor', 'bg'); wrap('setTitle', 'title');
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 50; i++) n = await H['note:update'](ev(w), { html: `<div>Typing ${i}</div>`, text: `Typing ${i}` });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(n.ink.s.length, 300, 'drawing kept');
  assert.deepEqual(n.ink.s[5].p.slice(0, 4), [0, 5, 1.2, 5.5], 'drawing unchanged');
  assert.equal(calls.top, 0, 'typing does not re-apply always-on-top');
  assert.equal(calls.opacity + calls.bg, 0, 'typing does not re-apply opacity/colour');
  assert.ok(calls.title >= 1 && calls.title <= 50, 'the window title follows the text');
  assert.equal(w.title, 'Typing 49');
  // same title again: not set again
  const before = calls.title;
  await H['note:update'](ev(w), { html: '<div>Typing 49</div>', text: 'Typing 49' });
  assert.equal(calls.title, before, 'unchanged title is not set again');
  // a real look change still applies everything
  await H['note:update'](ev(w), { pinned: true });
  assert.equal(calls.top, 1); assert.equal(w.top, true);
  await H['note:update'](ev(w), { opacity: 0.5 });
  assert.equal(w.opacity, 0.5);
  // the page can't rename the window
  let prevented = false;
  w.emit('page-title-updated', { preventDefault() { prevented = true; } }, 'CosmoNotes');
  assert.ok(prevented, 'page title does not replace the note title');
  // groups:apply (recolour every note in a group) keeps drawings too
  const ids = (await H['list:get']()).notes.map((x) => x.id);
  await H['list:new']();
  const ids2 = (await H['list:get']()).notes.map((x) => x.id);
  await H['groups:make'](null, ids2[0], ids2[1]);
  const g = (await H['list:get']()).groups[0];
  await H['groups:apply'](null, g.id, { color: 'blue' }, true);
  const withInk = (await H['list:get']()).notes.find((x) => x.id === ids[0]);
  assert.equal(withInk.color, 'blue');
  n = await H['note:get'](ev(w));
  assert.equal(n.ink.s.length, 300, 'drawing kept after a group recolour');
  console.log(`speed test passed (50 typing saves on a note with a 60 000-number drawing: ${ms.toFixed(1)} ms)`);
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
