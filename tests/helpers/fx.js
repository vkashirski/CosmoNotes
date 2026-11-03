'use strict';
// The effects (src/fx/ parts, as note.html loads them) running in a Node `vm`, with just enough of a browser around them.
//   const fx = require('./helpers/fx');  const { FX } = fx;     FX = window.COSMO_FX (EFFECTS, FOLLOWERS, Layer, resolve…)
//   fx.clock.t = 5000                       what performance.now() says (the Layer measures pointer speed with it)
//   const { ctx, bad, calls } = fx.recorder()   a 2D context that logs every call; `bad` lists any NaN / Infinity drawn
//                                           (recorder({ log: false }): only `bad`, for long runs)
//   fx.canvas(w, h)                         a canvas for FX.Layer (its context is a recorder too: canvas.rec)
//   fx.allBad()                             every NaN / Infinity drawn on any canvas so far (also the effects' own)
//   fx.seeded(7) → undo()                   Math.random gives the same numbers every run (call undo() to stop)
//   fx.ptr(x, y, vx, vy)                    the pointer an effect's step() gets;  fx.PAL(dark) → the light / dark palette
//   fx.SIZES                                a small list card at "Rarely", a note, a big note at "Often": [w, h, k]
const vm = require('vm');
const src = require('./sources');

function recorder({ log = true } = {}) { // log: false = only look for NaN (faster, for long runs)
  const bad = []; const calls = []; let fills = 0;
  const check = (name, args) => { if (log) calls.push([name, args]); for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); if (k === 'fill') fills++; return String(k).startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad, calls, fills: () => fills, count: (name) => calls.filter((c) => c[0] === name).length };
}
const made = []; // every canvas made, by the tests or by the effects themselves (document.createElement)
const canvas = (w = 10, h = 10) => { const rec = recorder(); made.push(rec); return { width: 0, height: 0, clientWidth: w, clientHeight: h, rec, getContext: () => rec.ctx }; };
// NaN / Infinity drawn on any canvas so far
const allBad = () => made.flatMap((r) => r.bad);

const clock = { t: 1000 };
const sandbox = {
  window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => canvas() },
  performance: { now: () => clock.t }, requestAnimationFrame: () => 0, setTimeout, clearTimeout,
  Math, Object, Array, JSON, Number, Map, Set, Float32Array,
};
vm.runInNewContext(src.fx(), sandbox);
const FX = sandbox.window.COSMO_FX;

const seeded = (n = 7) => { let s = n; const old = Math.random; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; return () => { Math.random = old; }; };

module.exports = {
  FX, sandbox, clock, recorder, canvas, seeded, allBad,
  PAL: (dark) => (dark ? FX.PALETTES.dark : FX.PALETTES.light),
  ptr: (x, y, vx = 0, vy = 0) => ({ x, y, vx, vy, sp: Math.hypot(vx, vy) }),
  SIZES: [[150, 110, 0.054], [340, 280, 1], [900, 700, 9]],
};
