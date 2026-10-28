// 1.1.18: the 22 new background effects picked in the Effect Lab (fewer since 1.1.20).
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const { FX_EFFECTS } = require(path.join(__dirname, '..', 'store.js'));

const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;

// (second and third rounds, same version: Lorenz, Shape shifter, Contour map and Black hole were taken out again; five magic effects were added)
// (1.1.20: Fairy dust, XP orbs, Neon tunnel and Synthwave were taken out at the owner's request; v1120.test.js checks that)
const NEW = ['plankton', 'warp', 'network', 'embers', 'blossom', 'nightsky', 'glitch', 'ocean', 'silk',
  'shards', 'ghost', 'fish', 'dust', // (1.1.22: Solar system taken out at the owner's request)
  // third round: the Spell Lab picks
  'heal', 'lightning', 'cauldron', 'jelly', 'fel'];

// a fake 2D context that records every number it's given (and every alpha that's set)
function recorder() {
  const bad = [];
  const check = (name, args) => { for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); return k.startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad };
}

// 1.1.22 (fifth round): the order is by theme now; check the same ids are all there (v1122.test.js checks the order itself)
assert.deepEqual([...FX_EFFECTS].sort(), ['snow', 'fireworks', 'stardust', 'fireflies', 'bubbles', 'leaves', 'hearts', 'rain', 'confetti', 'matrix', 'rainbow', ...NEW].sort(), 'the same effects as before, whatever the order');
assert.deepEqual([...FX.EFFECT_IDS], FX_EFFECTS, 'fx.js and store.js agree');

for (const id of NEW) {
  const e = FX.EFFECTS[id];
  assert.ok(e && typeof e.name === 'string' && e.name.length > 1 && e.name.length <= 16, `${id} has a short name`);
  const icon = FX.ICONS.effect[id];
  assert.ok(Array.isArray(icon) && /^#[0-9A-F]{6}$/i.test(icon[0]) && icon[1].includes('<'), `${id} has an icon with a colour`);
  // a small list card at "Rarely", a normal note, a big note at "Often"; light and dark paper
  for (const [w, h, k] of [[150, 110, .3 * .18], [340, 280, 1], [900, 700, 2.5 * 3.6]]) {
    for (const dark of [false, true]) {
      const P = dark ? FX.PALETTES.dark : FX.PALETTES.light;
      const fx = e.make(w, h, P, dark, k);
      const { ctx, bad } = recorder();
      for (let i = 0; i < 120; i++) { fx.step(1 / 30, 3 + i / 30); if (i % 20 === 0) fx.draw(ctx, 3 + i / 30); }
      fx.draw(ctx, 7);
      assert.deepEqual(bad, [], `${id} ${w}×${h} k=${k} ${dark ? 'dark' : 'light'}: no NaN / Infinity drawn`);
    }
  }
  // every colour it asks for exists on both papers
  const src = e.make.toString();
  for (const m of src.matchAll(/P\.(\w+)/g)) {
    assert.ok(FX.PALETTES.light[m[1]] !== undefined, `${id}: light paper has ${m[1]}`);
    assert.ok(FX.PALETTES.dark[m[1]] !== undefined, `${id}: dark paper has ${m[1]}`);
  }
}

// a long run with big time steps (a sleepy computer) doesn't break any of them
for (const id of NEW) {
  const fx = FX.EFFECTS[id].make(340, 280, FX.PALETTES.light, false, 1);
  const { ctx, bad } = recorder();
  for (let i = 0; i < 600; i++) fx.step(.1, i * .1);
  fx.draw(ctx, 60);
  assert.deepEqual(bad, [], `${id}: still fine after a minute of big steps`);
}

// second round (owner's changes, still 1.1.18)
assert.ok(!FX.EFFECTS.lorenz && !FX.EFFECTS.morph && !FX.EFFECTS.topo && !FX.EFFECTS.blackhole, 'Lorenz, Shape shifter, Contour map and Black hole are gone');
assert.equal(FX.EFFECTS.glitch.name, 'Analog monitor', 'Glitch is now Analog monitor');
// a note that still has a removed effect saved just falls back to the one for all notes, or none
assert.equal(FX.resolve({ e: 'lorenz' }, { fxEffect: 'snow' }).effect, 'snow');
assert.equal(FX.resolve({}, { fxEffect: 'morph' }).effect, 'none');
// Analog monitor never draws the colour-split glitch bands any more: only the ink colour
{
  const fx = FX.EFFECTS.glitch.make(340, 280, FX.PALETTES.dark, true, 3.6); const { ctx } = recorder(); const used = new Set();
  const spy = new Proxy(ctx, { set: (t, k, v) => { if (k === 'fillStyle' && typeof v === 'string') used.add(v); t[k] = v; return true; } });
  for (let i = 0; i < 300; i++) { fx.step(1 / 30, i / 30); fx.draw(spy, i / 30); }
  assert.deepEqual([...used], [FX.PALETTES.dark.scan], 'only scanlines and the rolling bar');
}
// how often things happen: count the events over 10 simulated minutes, even on a big note at "Often"
const countShooting = (id, w, h, k, test) => { const fx = FX.EFFECTS[id].make(w, h, FX.PALETTES.dark, true, k); let n = 0; let was = false; for (let i = 0; i < 600 * 10; i++) { fx.step(.1, i * .1); const { ctx } = recorder(); let drew = false; const spy = new Proxy(ctx, { get: (t, key) => (key === 'createLinearGradient' ? (...a) => { drew = true; return t[key](...a); } : t[key]) }); fx.draw(spy, i * .1); if (test(drew) && !was) n++; was = test(drew); } return n; };
for (const k of [1, 9]) {
  const stars = countShooting('nightsky', 900, 700, k, (d) => d); assert.ok(stars >= 40 && stars <= 60, `night sky: a shooting star about every 12 s (got ${stars} in 10 min, k=${k})`);
}
// Warp speed: about 30 s of cruising, then 3 s of light speed
{
  const fx = FX.EFFECTS.warp.make(340, 280, FX.PALETTES.dark, true, 1); let fast = 0; let slow = 0;
  for (let i = 0; i < 354 * 4; i++) { fx.step(.025, i * .025); const { ctx } = recorder(); let blue = false; const spy = new Proxy(ctx, { set: (t, key, v) => { if (key === 'strokeStyle' && v === FX.PALETTES.dark.warp) blue = true; t[key] = v; return true; } }); fx.draw(spy, 0); if (blue) fast++; else slow++; }
  const fastS = fast * .025; assert.ok(fastS > 3 && fastS < 6.5, `warp: about 3 s fast a cycle (+ speeding up / slowing down), got ${fastS.toFixed(1)} s`);
}
console.log('v1118 ok');
