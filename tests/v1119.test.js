// 1.1.19: the Aquarium background (picked from the "Fish Picks" preview) and a nicer-looking Fish.
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const { FX_EFFECTS, cleanFx } = require(path.join(__dirname, '..', 'store.js'));

const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;

// a fake 2D context that records any number that isn't a real number, and counts the fills
function recorder() {
  const bad = []; let fills = 0;
  const check = (name, args) => { for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); if (k === 'fill') fills++; return String(k).startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad, fills: () => fills };
}

// (1.1.22: Aquarium was taken out again at the owner's request; a note that had it goes back to "same as all notes")
assert.deepEqual([...FX.EFFECT_IDS], FX_EFFECTS, 'fx.js and store.js agree');
assert.ok(!FX.EFFECTS.aquarium && !FX_EFFECTS.includes('aquarium'), 'Aquarium is gone');
assert.equal(cleanFx({ e: 'aquarium', f: 'solar' }).e, null, 'a note that had Aquarium goes back to the setting');
assert.equal(cleanFx({ f: 'aquarium' }).f, null);
assert.equal(FX.EFFECTS.fish.name, 'Fish', 'Fish keeps its name and id');

for (const id of ['fish']) {
  const e = FX.EFFECTS[id];
  // a small list card at "Rarely", a normal note, a big note at "Often"; light and dark paper
  for (const [w, h, k] of [[150, 110, .3 * .18], [340, 280, 1], [900, 700, 2.5 * 3.6]]) {
    for (const dark of [false, true]) {
      const fx = e.make(w, h, dark ? FX.PALETTES.dark : FX.PALETTES.light, dark, k);
      const { ctx, bad } = recorder();
      for (let i = 0; i < 150; i++) { fx.step(1 / 30, 3 + i / 30); if (i % 15 === 0) fx.draw(ctx, 3 + i / 30); }
      assert.deepEqual(bad, [], `${id} ${w}×${h} k=${k} ${dark ? 'dark' : 'light'}: no NaN / Infinity drawn`);
    }
  }
  // every colour it asks for exists on both papers
  for (const m of e.make.toString().matchAll(/P\.(\w+)/g)) {
    assert.ok(FX.PALETTES.light[m[1]] !== undefined && FX.PALETTES.dark[m[1]] !== undefined, `${id}: both papers have ${m[1]}`);
  }
  // a long run with big time steps (a sleepy computer) doesn't break it
  const fx = e.make(340, 280, FX.PALETTES.light, false, 1); const { ctx, bad } = recorder();
  for (let i = 0; i < 600; i++) fx.step(.1, i * .1);
  fx.draw(ctx, 60);
  assert.deepEqual(bad, [], `${id}: still fine after a minute of big steps`);
}

// the new Fish is still drawn in a handful of fills (fins + bodies for each of the 3 colours, then the eyes),
// however many fish there are, so it stays as light as before
{
  const fx = FX.EFFECTS.fish.make(900, 700, FX.PALETTES.dark, true, 9); const r = recorder();
  for (let i = 0; i < 30; i++) fx.step(1 / 30, i / 30);
  fx.draw(r.ctx, 1);
  assert.ok(r.fills() <= 7, `Fish uses at most 7 fills a frame (got ${r.fills()})`);
}
console.log('v1119 ok');
