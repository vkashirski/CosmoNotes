// 1.1.0: draw-over ink and the locked text layout are saved with the note, cleaned up, and hidden for locked notes.
const assert = require('assert'); const path = require('path');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
const { normalizeInk } = require(path.join(__dirname, '..', 'store.js'));
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
(async () => {
  // cleaning bad data
  assert.equal(normalizeInk(null), null);
  assert.equal(normalizeInk({ s: [] }), null);
  const clean = normalizeInk({ s: [
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', p: [1.234, 2, 3, 4] },
    { t: 'rect', c: 'red', w: 99, l: 'zz', p: [0, 0, 10, 10] },
    { t: 'nope', p: [0, 0] },
    { t: 'pen', p: [1, 2, 3] },
    { t: 'line', p: [0, 0, NaN, 1] },
  ] });
  assert.equal(clean.s.length, 2);
  assert.deepEqual(clean.s[0].p, [1.2, 2, 3, 4]);
  assert.equal(clean.s[1].c, '#2B2B2B'); assert.equal(clean.s[1].w, 40); assert.equal(clean.s[1].l, 'a');

  await tick(150);
  const H = E.__handlers; const L = E.__listeners;
  await H['list:new']();
  const w = E.__all.find((x) => x.file.endsWith('note.html') && !x.destroyed && !x.noteIdSeen);
  let n = await H['note:get'](ev(w));
  const before = n.updatedAt;
  await tick(20);
  const ink = { s: [{ t: 'ellipse', c: '#3E7BFA', w: 4, l: 'a', p: [10, 10, 80, 40] }, { t: 'hl', c: '#FFC800', w: 4, l: 'b', p: [0, 20, 90, 20] }] };
  n = await H['note:update'](ev(w), { ink, wrapWidth: 312 });
  assert.equal(n.ink.s.length, 2); assert.equal(n.wrapWidth, 312);
  assert.ok(n.updatedAt > before, 'drawing counts as an edit');
  n = await H['note:update'](ev(w), { wrapWidth: 20 });
  assert.equal(n.wrapWidth, null, 'silly widths are ignored');
  await H['note:update'](ev(w), { wrapWidth: 312 });
  // locked note: drawing hidden from the window and can't be wiped while hidden
  await H['lock:set'](null, { next: '1111' });
  n = await H['note:set-locked'](ev(w), true);
  assert.equal(n.hidden, true); assert.equal(n.ink, null, 'drawing hidden while locked');
  await H['note:update'](ev(w), { ink: null });
  L['note:update-sync'](ev(w), { ink: null });
  n = await H['note:unlock'](ev(w), '1111');
  assert.equal(n.ink.s.length, 2, 'drawing survived');
  assert.equal(n.wrapWidth, 312);
  // removing the drawing works when visible
  n = await H['note:update'](ev(w), { ink: null });
  assert.equal(n.ink, null);
  console.log('ink test passed');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
