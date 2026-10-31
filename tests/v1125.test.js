// 1.1.25: the Ghost ripple mouse follower threw an error the moment it was switched on: the Layer draws once before
// the first step, and its dots had no brightness (`near`) yet. In a note that stopped the effects setup half-way
// (pause and rolled-up were not applied); in the notes list it stopped the effects of every card after that note.
// Now every background and every follower must survive being switched on and drawn before anything has moved.
const assert = require('assert'); const vm = require('vm');
assert.equal(require('../package.json').version, '1.1.25');

let now = 1000;
const bad = [];
const ctx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => { for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)}(${a.join(', ')})`); return String(k).startsWith('create') ? { addColorStop() {} } : undefined; }),
  set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
});
const sandbox = { window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: ctx }) },
  performance: { now: () => now }, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: () => {}, Math, Object, Array, JSON, Number, Map, Set, Float32Array };
vm.runInNewContext(require('./fx-source')(), sandbox);
const FX = sandbox.window.COSMO_FX;

const canvas = (w, h) => ({ clientWidth: w, clientHeight: h, width: 0, height: 0, getContext: ctx });
const check = (effect, follower) => {
  for (const [w, h, dark] of [[340, 300, false], [150, 110, true]]) {
    const L = FX.Layer(canvas(w, h)); L.resize();
    assert.doesNotThrow(() => L.set({ effect, follower, dark, paper: dark ? 'night' : 'yellow' }), `${effect} / ${follower} (${w}×${h}): switching it on draws without an error`);
    assert.doesNotThrow(() => { L.setPaused(false); L.setVisible(true); now += 33; L.tick(1 / 30); }, `${effect} / ${follower}: and keeps going`);
    L.destroy();
  }
};
for (const f of FX.FOLLOWER_IDS) check('none', f);
for (const e of FX.EFFECT_IDS) check(e, 'none');
check('ghost', 'ghost');
assert.deepEqual(bad, [], 'nothing is drawn at NaN or Infinity');
console.log('v1125 ok');
