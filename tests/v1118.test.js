// 1.1.18: the 22 new background effects picked in the Effect Lab.
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const { FX_EFFECTS } = require(path.join(__dirname, '..', 'store.js'));

const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;

const NEW = ['plankton', 'fairy', 'warp', 'network', 'embers', 'lorenz', 'blossom', 'nightsky', 'glitch', 'blackhole', 'ocean', 'silk',
  'shards', 'xp', 'morph', 'ghost', 'fish', 'solar', 'topo', 'tunnel', 'synthwave', 'dust'];

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

// the old ones stay first and in the same order (saved choices keep their place); the new ones follow
assert.deepEqual(FX_EFFECTS.slice(0, 11), ['snow', 'fireworks', 'stardust', 'fireflies', 'bubbles', 'leaves', 'hearts', 'rain', 'confetti', 'matrix', 'rainbow']);
assert.deepEqual(FX_EFFECTS.slice(11), NEW, 'the new ids, in the picker order');
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

console.log('v1118 ok');
