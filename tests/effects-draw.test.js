'use strict';
// Every effect draws without breaking (src/fx/ in a vm through tests/helpers/fx.js): each background and each mouse
// follower on a small list card at "Rarely", a note and a big note at "Often", on light and dark paper (backgrounds also
// on four tinted papers), with the pointer playing, resting and gone, and a minute of big time steps (a sleepy computer):
// nothing is ever drawn at NaN / Infinity, every colour asked for exists on both papers, and a follower goes quiet
// (so the loop can sleep) once the mouse stops. How each one behaves: effects-backgrounds / effects-followers.test.js.
const assert = require('assert');
const fx = require('./helpers/fx');

const { FX, recorder, PAL, ptr } = fx;

// ---- every background
for (const id of FX.EFFECT_IDS) {
  for (const [W, Hh, k] of fx.SIZES) for (const dark of [false, true]) {
    const e = FX.EFFECTS[id].make(W, Hh, PAL(dark), dark, k); const { ctx, bad } = recorder({ log: false });
    for (let i = 0; i < 240; i++) {
      const t = i / 30; const fast = i % 9 === 0 ? 4 : 1;
      const m = i % 80 < 60 ? { x: W / 2 + Math.sin(t * 2) * W * .45, y: Hh / 2 + Math.cos(t * 1.3) * Hh * .45, vx: Math.cos(t * 2) * W * .9 * fast, vy: -Math.sin(t * 1.3) * Hh * .6 * fast } : null;
      if (m) m.sp = Math.hypot(m.vx, m.vy);
      e.step(i % 40 === 0 ? .1 : 1 / 30, t, m); if (i % 12 === 0) e.draw(ctx, t);
    }
    assert.deepEqual(bad, [], `${id} ${W}×${Hh} k=${k} ${dark ? 'dark' : 'light'}: no NaN with the mouse playing`);
  }
  for (const paper of ['yellow', 'blue', 'plum', 'forest']) {
    const dark = ['plum', 'forest'].includes(paper); const e = FX.EFFECTS[id].make(220, 180, FX.paperPalette(dark, paper), dark, 1); const { ctx, bad } = recorder({ log: false });
    for (let i = 0; i < 20; i++) e.step(.05, i * .05, null); e.draw(ctx, 1); assert.deepEqual(bad, [], `${id} on ${paper}`);
  }
  const e = FX.EFFECTS[id].make(340, 280, PAL(false), false, 1); const { ctx, bad } = recorder({ log: false });
  for (let i = 0; i < 600; i++) e.step(.1, i * .1);
  e.draw(ctx, 60);
  assert.deepEqual(bad, [], `${id}: still fine after a minute of big steps`);
  for (const m of FX.EFFECTS[id].make.toString().matchAll(/P\.(\w+)/g)) assert.ok(FX.PALETTES.light[m[1]] !== undefined && FX.PALETTES.dark[m[1]] !== undefined, `${id}: colour ${m[1]} on both papers`);
}
// strong, fast strokes low down (where Analog monitor, Silk waves, Dust in light and the Cauldron react most)
for (const id of ['glitch', 'silk', 'dust', 'cauldron']) for (const [w, h] of [[150, 110], [340, 280], [900, 700]]) {
  const e = FX.EFFECTS[id].make(w, h, PAL(true), true, 1); const { ctx, bad } = recorder();
  for (let i = 0; i < 120; i++) { const m = i < 80 ? ptr(w / 2 + Math.sin(i / 3) * w / 3, h * .85, Math.cos(i / 3) * 1500, 0) : null; e.step(1 / 30, i / 30, m); if (i % 8 === 0) e.draw(ctx, i / 30); }
  assert.deepEqual(bad, [], `${id} ${w}×${h}: nothing at NaN`);
}

// ---- every follower: no NaN, and it goes quiet when the mouse rests
for (const id of FX.FOLLOWER_IDS) {
  for (const [w, h, k] of [[150, 110, .35], [340, 280, 1], [900, 700, 2.6]]) for (const dark of [false, true]) {
    const f = FX.FOLLOWERS[id].make(w, h, dark ? FX.PALETTES.dark : FX.PALETTES.light, dark, k); const { ctx, bad } = recorder({ log: false });
    let x = 20; let y = 30;
    for (let i = 0; i < 150; i++) {
      if (i < 90) { const nx = 20 + (i * 9) % (w - 40); const ny = h / 2 + Math.sin(i / 6) * h / 3; f.move(nx, ny, Math.hypot(nx - x, ny - y)); x = nx; y = ny; }
      f.step(i % 30 === 0 ? .1 : 1 / 30, i / 30); if (i % 10 === 0) f.draw(ctx, i / 30);
      if (f.fade) { const v = f.fade(); assert.ok(v >= 0 && v <= 1, `${id}: fade between 0 and 1`); }
    }
    if (f.leave) f.leave(); // 1.1.22: fel / embers burn while the pointer is on the note; it has left now
    for (let i = 0; i < 240; i++) f.step(1 / 30, 5 + i / 30);
    f.draw(ctx, 13);
    assert.deepEqual(bad, [], `${id} ${w}×${h} k=${k} ${dark ? 'dark' : 'light'}: nothing drawn at NaN`);
    assert.ok(!f.busy || !f.busy(), `${id}: quiet 8 s after the mouse stops (the loop can sleep)`);
    if (f.fade) assert.equal(f.fade(), 0, `${id}: faded away`);
  }
  for (const m of FX.FOLLOWERS[id].make.toString().matchAll(/P\.(\w+)/g)) assert.ok(FX.PALETTES.light[m[1]] !== undefined && FX.PALETTES.dark[m[1]] !== undefined, `${id}: colour ${m[1]} on both papers`);
}
console.log('ok');
