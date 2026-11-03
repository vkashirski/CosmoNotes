'use strict';
// How each mouse follower behaves (src/fx/ in a vm through tests/helpers/fx.js): trails need a moving mouse, companions
// show while it moves, Dust in light's amounts, Analog monitor's phosphor stripes, Fel fire and Embers burn while the
// pointer rests on the note, the Cauldron's steady stream, Lightning builds again half a second after a strike, and a
// long fast stroke keeps them going. (That every follower draws without NaN and goes quiet: effects-draw.test.js.)
const assert = require('assert');
const fx = require('./helpers/fx');

const { FX, recorder, seeded, PAL } = fx;

// a still mouse makes nothing (followers that leave a trail)
for (const id of ['plankton', 'blossom', 'heal', 'cauldron']) { // (embers and fel burn on a resting pointer: below)
  const f = FX.FOLLOWERS[id].make(340, 280, FX.PALETTES.light, false, 1);
  for (let i = 0; i < 30; i++) { f.move(100, 100, 0); f.step(1 / 30, i / 30); }
  assert.ok(!f.busy(), `${id}: nothing from a mouse that doesn't move`);
}
// companions (Fish, Ghost jellyfish) show while the mouse moves
for (const id of ['fish', 'jelly']) {
  const f = FX.FOLLOWERS[id].make(600, 400, FX.PALETTES.light, false, 1);
  for (let i = 0; i < 60; i++) { f.move(300 + (i % 2), 200, 1); f.step(1 / 30, i / 30); }
  assert.ok(f.fade() > .9 && f.busy(), `${id}: shown while the mouse moves`);
}


// ---- Dust in light: "Rarely" is the old "Often" (1.1.22); Analog monitor: phosphor stripes, quiet once the mouse stops
{
  // Dust in light (mouse): "Rarely" was the old "Often" amount; the whole scale moved down
  const specks = (k) => { const f = FX.FOLLOWERS.dust.make(900, 400, PAL(true), true, k); for (let i = 0; i < 100; i++) f.move(20 + i * 8, 200, 8); const rec = recorder(); f.draw(rec.ctx, 0); return rec.calls.filter(([n]) => n === 'arc').length; };
  const rare = specks(.35); const norm = specks(1); const oft = specks(2.6);
  assert.ok(rare < norm && norm < oft, `dust: rarely < normal < often (${rare}, ${norm}, ${oft})`);
  assert.ok(oft >= 50 && oft <= 85, `dust "Often" now makes about one speck every 17 px, which "Rarely" used to (${oft} circles over 800 px)`);
  assert.ok(norm <= 36, `dust "Normal" is much sparser (${norm})`);
}
for (const dark of [false, true]) {
  const { ctx, bad } = recorder();
  const f = FX.FOLLOWERS.glitch.make(340, 280, PAL(dark), dark, 1); let x = 20;
  for (let i = 0; i < 120; i++) { if (i < 60) { f.move(x, 140 + Math.sin(i / 5) * 60, 9); x += 5; } f.step(1 / 30, i / 30); if (i % 10 === 0) f.draw(ctx, i / 30); }
  assert.ok(ctx.fillStyle !== undefined, 'phosphor stripes drawn');
  for (let i = 0; i < 150; i++) f.step(1 / 30, 4 + i / 30);
  assert.ok(!f.busy(), 'analog monitor mouse: quiet after the mouse stops');
  assert.deepEqual(bad, []);
}

// Lightning (mouse): half a second after a strike has gone out, the next bolt starts building behind the pointer again
{
  const undo = seeded(2); const f = FX.FOLLOWERS.lightning.make(340, 280, PAL(true), true, 1); let t = 0;
  const widths = () => { const w = []; const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'stroke' ? () => w.push(o.lineWidth) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => { o[k] = v; return true; } }); f.draw(ctx, t); return w; };
  let lastStrike = -1; let nextLeader = -1;
  for (let i = 0; i < 30 * 8; i++) {
    f.move(30 + (i * 4) % 280, 140 + Math.sin(i / 9) * 50, 4); f.step(1 / 30, t += 1 / 30);
    const ws = widths(); // the strike is stroked 6 and 1.8 wide, the leader 3 and 1
    if (nextLeader < 0 && ws.some((x) => x === 6 || x === 1.8)) lastStrike = t; else if (lastStrike > 0 && nextLeader < 0 && ws.some((x) => x === 3 || x === 1)) nextLeader = t; // (only the first strike and the bolt after it)
  }
  undo();
  assert.ok(lastStrike > 0 && nextLeader > 0, 'a strike happens, and then a new bolt starts building');
  assert.ok(nextLeader - lastStrike > .4 && nextLeader - lastStrike < .8, `about half a second in between (${(nextLeader - lastStrike).toFixed(2)} s)`);
}

// Fel fire and Embers (mouse): they burn while the pointer rests on the note, and go out when it leaves
for (const id of ['fel', 'embers']) {
  const f = FX.FOLLOWERS[id].make(340, 280, PAL(true), true, 1); f.move(100, 100, 0);
  for (let i = 0; i < 150; i++) f.step(1 / 30, i / 30);
  const { ctx, calls } = recorder(); f.draw(ctx, 5);
  assert.ok(f.busy() && calls.some(([n]) => n === 'arc'), `${id}: still burning 5 s after the mouse stopped`);
  f.leave(); for (let i = 0; i < 90; i++) f.step(1 / 30, 5 + i / 30);
  assert.ok(!f.busy(), `${id}: goes out when the pointer leaves`);
}

// Cauldron (mouse): a steady stream while the mouse moves, no gaps
{
  const f = FX.FOLLOWERS.cauldron.make(340, 280, PAL(true), true, 1); let gaps = 0;
  for (let i = 0; i < 30 * 8; i++) {
    f.move(60 + (i * 3) % 220, 140, 3); f.step(1 / 30, i / 30);
    if (i > 30 && i % 5 === 0) { const { ctx, calls } = recorder(); f.draw(ctx, i / 30); if (!calls.some(([n]) => n === 'arc')) gaps++; }
  }
  assert.equal(gaps, 0, 'bubbles all the way through');
}

// Dust in light and Healing aura (mouse): only the dust; only floating heals (no light beam, no rings)
const fsrc = (id) => FX.FOLLOWERS[id].make.toString();
assert.ok(!/shaft|createLinearGradient/.test(fsrc('dust')), 'dust follower: no beam of light');
assert.ok(!/ellipse|rings/.test(fsrc('heal')), 'heal follower: no rings');

// ---- a long fast stroke keeps them going (glass shards used to stop once 16 were alive), the newest right at the pointer
for (const id of ['shards', 'plankton', 'dust', 'blossom', 'warp', 'nightsky', 'embers', 'fel']) {
  const f = FX.FOLLOWERS[id].make(900, 400, PAL(true), true, 1); let x = 20; const seen = [];
  for (let i = 0; i < 90; i++) { // 1.5 s at 2400 px/s, wrapping back and forth
    for (let j = 0; j < 4; j++) { x += 10 * (Math.floor(i / 20) % 2 ? -1 : 1); f.move(x, 200, 10); }
    f.step(1 / 60, i / 60);
  }
  const { ctx } = recorder(); const tr = []; const spy = new Proxy(ctx, { get: (t, k) => (k === 'translate' ? (px, py) => tr.push(px) : t[k]) });
  f.draw(spy, 2);
  if (id === 'shards') assert.ok(tr.some((px) => Math.abs(px - x) < 60), `${id}: the newest ones are still right at the pointer`);
  assert.ok(f.busy(), `${id}: still going after a long fast stroke`);
}
console.log('ok');
