'use strict';
// The effects' rules (src/fx/, run in a vm through tests/helpers/fx.js), without drawing much:
// - the lists: the same ids and order in src/fx/ and store.js (themed order, 1.1.22), a follower for every background
//   with its name and icon, every effect named and with an icon, the removed ones gone everywhere;
// - which effect a note shows (resolve: own choice, all notes', use on every note, pause, amounts, opacity, interact);
// - cleaning (store.js cleanFx / cleanFxOpacity agree with fx.js);
// - the Layer: opacity multiplied into everything drawn, the pointer handed to the background only while "mouse can
//   interact" is on, fast mouse strokes cut into small steps, every effect can be switched on and drawn at once;
// - each paper tints the effects a little; the speed rules (few gradients, 30 steps a second, no blur every frame).
// How each effect looks and behaves: effects-backgrounds.test.js and effects-followers.test.js.
const assert = require('assert');
const store = require('../store.js');
const fx = require('./helpers/fx');
const src = require('./helpers/sources');

const { FX, clock } = fx;
const { FX_EFFECTS, FX_FOLLOWERS, cleanFx, cleanFxOpacity } = store;

// ---- the lists
const ORDER = ['snow', 'rain', 'lightning', 'rainbow', 'leaves', 'blossom', 'fireworks', 'confetti', 'hearts', 'bubbles', 'nightsky', 'embers', 'stardust', 'shards', 'plankton', 'fish', 'fireflies', 'dust', 'ocean', 'silk', 'jelly', 'network', 'ghost', 'warp', 'glitch', 'matrix', 'heal', 'cauldron', 'fel'];
assert.deepEqual([...FX.EFFECT_IDS], ORDER, 'backgrounds in the themed order (the owner’s "Option A", 1.1.22)');
assert.deepEqual(FX_EFFECTS, ORDER, 'store.js has the same ids in the same order');
assert.deepEqual([...FX.FOLLOWER_IDS], ORDER.map((e) => (e === 'snow' ? 'frost' : e === 'rain' ? 'ripples' : e)).concat('pencil'), 'followers in the same order (old ids kept for saved choices), Pencil line last, mouse only');
assert.deepEqual(FX_FOLLOWERS, [...FX.FOLLOWER_IDS], 'store.js followers agree');
FX.EFFECT_IDS.forEach((e, i) => {
  const f = FX.FOLLOWER_IDS[i];
  assert.equal(FX.PAIRS[f], e, `${f} goes with ${e}`);
  assert.equal(FX.FOLLOWERS[f].name, FX.EFFECTS[e].name, `${f}: same name as the background`);
  assert.equal(FX.ICONS.follower[f], FX.ICONS.effect[e], `${f}: same icon`);
});
for (const id of FX.EFFECT_IDS) {
  const e = FX.EFFECTS[id];
  assert.ok(e.make && typeof e.name === 'string' && e.name.length > 1 && e.name.length <= 16, `${id} has a short name`);
  const icon = FX.ICONS.effect[id];
  assert.ok(Array.isArray(icon) && /^#[0-9A-F]{6}$/i.test(icon[0]) && icon[1].includes('<'), `${id} has an icon with a colour`);
}
for (const id of FX.FOLLOWER_IDS) assert.ok(FX.FOLLOWERS[id].make && FX.ICONS.follower[id], `${id} (mouse): made and has an icon`);
assert.ok(FX.EFFECTS.matrix && FX.FOLLOWERS.matrix && FX.PALETTES.dark.code === '#00FF41', 'Matrix: a background and a follower, in the film’s green on dark paper');
assert.equal(FX.EFFECTS.glitch.name, 'Analog monitor', 'Glitch is called Analog monitor');
assert.equal(FX.EFFECTS.fish.name, 'Fish');
assert.ok(!('PICK' in FX), 'nothing is waiting for one of the owner’s picks');
// removed at the owner's request: gone everywhere; a note that still has one falls back to "same as all notes"
const GONE = ['shooting', 'lorenz', 'morph', 'topo', 'blackhole', 'aquarium', 'solar', 'fairy', 'xp', 'tunnel', 'synthwave'];
for (const id of GONE) {
  assert.ok(!FX.EFFECTS[id] && !FX_EFFECTS.includes(id) && !FX.ICONS.effect[id], `${id} is gone`);
  assert.equal(cleanFx({ e: id }).e, null, `a note that had ${id} goes back to "same as all notes"`);
  assert.equal(FX.resolve({ e: id }, { fxEffect: 'snow' }).effect, 'snow');
  assert.equal(FX.resolve({}, { fxEffect: id }).effect, 'none', `${id} for all notes: none`);
}
assert.equal(cleanFx({ f: 'aquarium' }).f, null);
for (const k of ['fairy', 'fairyCore', 'xp', 'xpText', 'tunnel', 'tunnel2', 'sunTop', 'horizon']) assert.ok(!(k in FX.PALETTES.light) && !(k in FX.PALETTES.dark), `colour ${k} is gone`);

// ---- which effect a note shows
const all = { fxEffect: 'snow', fxFollower: 'stardust', fxForceAll: false, fxPaused: false };
let r = FX.resolve({ e: null, f: null }, all, false);
assert.equal(r.effect, 'snow'); assert.equal(r.follower, 'stardust'); assert.equal(r.paused, false);
r = FX.resolve({ e: 'rain', f: 'none' }, all, false);
assert.equal(r.effect, 'rain', 'a note’s own choice wins'); assert.equal(r.follower, 'none', '“none” on a note means nothing');
r = FX.resolve({ e: 'rain', f: 'none' }, { ...all, fxForceAll: true }, false);
assert.equal(r.effect, 'snow', 'use on every note'); assert.equal(r.follower, 'stardust');
assert.equal(FX.resolve({ e: 'bogus' }, all).effect, 'snow', 'unknown ids fall back to all notes’ choice');
// pause: a note's own play wins over "pause all"; its own pause always pauses
assert.equal(FX.resolve({}, { ...all, fxPaused: true }, false).paused, true, 'paused for all');
assert.equal(FX.resolve({}, all, true).paused, true, 'paused on this note');
assert.equal(FX.resolve(null, { fxPaused: true }, false, true).paused, false, 'plays while all are paused');
assert.equal(FX.resolve(null, { fxPaused: false }, true, false).paused, true);
// how much (Less / Normal / More)
r = FX.resolve({}, all);
assert.equal(r.effectAmount, 'mid', 'normal by default'); assert.equal(r.followerAmount, 'mid');
r = FX.resolve({ ea: 'high', fa: 'low' }, { ...all, fxEffectAmount: 'low' });
assert.equal(r.effectAmount, 'high', 'a note’s own amount wins'); assert.equal(r.followerAmount, 'low');
assert.equal(FX.resolve({}, { ...all, fxEffectAmount: 'low' }).effectAmount, 'low', 'all notes’ amount');
assert.equal(FX.resolve({ ea: 'high' }, { ...all, fxEffectAmount: 'low', fxForceAll: true }).effectAmount, 'low', 'use on every note: all notes’ amount');
assert.ok(FX.AMOUNTS.low < FX.AMOUNTS.mid && FX.AMOUNTS.mid < FX.AMOUNTS.high);
assert.ok(FX.EFFECT_AMOUNTS.high / FX.EFFECT_AMOUNTS.low > 15, 'background frequency: a big difference');
// opacity (1.1.17)
r = FX.resolve({}, all);
assert.equal(r.effectOpacity, 1, 'fully visible by default'); assert.equal(r.followerOpacity, 1);
r = FX.resolve({ eo: 0.2, fo: null }, { ...all, fxEffectOpacity: 0.4, fxFollowerOpacity: 0.7 });
assert.equal(r.effectOpacity, 0.2, 'a note’s own opacity wins'); assert.equal(r.followerOpacity, 0.7, 'null = same as all notes');
assert.equal(FX.resolve({ eo: 0.2 }, { ...all, fxEffectOpacity: 0.4, fxForceAll: true }).effectOpacity, 0.4, 'use on every note: all notes’ opacity');
// mouse can interact (1.1.21)
assert.equal(FX.resolve({}, {}).interact, true, 'on by default');
assert.equal(FX.resolve({}, { fxInteract: false }).interact, false, 'off for all notes');
assert.equal(FX.resolve({ mi: true }, { fxInteract: false }).interact, true, 'a note can switch it on for itself');
assert.equal(FX.resolve({ mi: false }, { fxInteract: true }).interact, false, '…or off');
assert.equal(FX.resolve({ mi: false }, { fxInteract: true, fxForceAll: true }).interact, true, '"use on every note" uses the setting');

// ---- cleaning: store.js and fx.js agree
for (const [v, want] of [[0.5, 0.5], [0.42, 0.4], [0.03, 0.1], [0, 0.1], [7, 1], ['0.6', 0.6], [null, null], [undefined, null], ['', null], ['x', null], [true, null], [NaN, null]]) {
  assert.equal(cleanFxOpacity(v), want, `store: ${v}`);
  assert.equal(FX.opacityOf(v), want, `fx.js: ${v}`);
}
assert.deepEqual(cleanFx({ e: 'snow', eo: 0.5, fo: 'loads' }), { e: 'snow', f: null, ea: null, fa: null, eo: 0.5, fo: null, mi: null });
assert.deepEqual(cleanFx(null), { e: null, f: null, ea: null, fa: null, eo: null, fo: null, mi: null }, 'old notes: same as all notes');
assert.equal(cleanFx({ mi: true }).mi, true); assert.equal(cleanFx({ mi: 'yes' }).mi, null); assert.equal(cleanFx({}).mi, null);

// ---- the Layer multiplies its opacity into everything it draws (a context with a real globalAlpha, clamped 0–1)
class Ctx2D {
  constructor() { this._a = 1; this.drawn = []; this._stack = []; }
  get globalAlpha() { return this._a; }
  set globalAlpha(v) { if (Number.isFinite(v)) this._a = Math.min(1, Math.max(0, v)); }
  save() { this._stack.push(this._a); } restore() { this._a = this._stack.pop() ?? 1; }
  fill() { this.drawn.push(this._a); } stroke() { this.drawn.push(this._a); } fillText() { this.drawn.push(this._a); } fillRect() { this.drawn.push(this._a); } drawImage() { this.drawn.push(this._a); }
  createRadialGradient() { return { addColorStop() {} }; } createConicGradient() { return { addColorStop() {} }; } createLinearGradient() { return { addColorStop() {} }; }
}
for (const k of ['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'translate', 'rotate', 'scale', 'rect', 'ellipse', 'closePath', 'clip', 'setLineDash']) Ctx2D.prototype[k] = function () {};
{
  const ctx = new Ctx2D(); const cv = { width: 0, height: 0, clientWidth: 340, clientHeight: 280, getContext: () => ctx };
  const L = FX.Layer(cv); L.resize();
  L.set({ effect: 'snow', follower: 'none' });
  ctx.drawn = []; L.tick(0.03);
  const full = Math.max(...ctx.drawn);
  assert.ok(full > 0.5, 'snow is drawn at its own strength');
  L.set({ effect: 'snow', follower: 'none', effectOpacity: 0.5 });
  ctx.drawn = []; L.tick(0.03);
  assert.ok(Math.abs(Math.max(...ctx.drawn) - full * 0.5) < 1e-9, 'at 50 % everything is half as strong');
  assert.equal(ctx.globalAlpha, 1, 'the canvas is left at 1 after drawing');
  L.set({ effect: 'none', follower: 'stardust', effectOpacity: 0.5, followerOpacity: 0.3 });
  for (let i = 0; i < 10; i++) L.move(20 + i * 10, 100);
  ctx.drawn = []; L.tick(0.03);
  assert.ok(ctx.drawn.length && Math.max(...ctx.drawn) <= 0.3 + 1e-9, 'the follower has its own opacity (30 %)');
  L.destroy();
}

// ---- the Layer hands the pointer (with its speed) to the background only while "mouse can interact" is on
{
  let got = [];
  FX.EFFECTS.__probe = { name: 'probe', make: () => ({ step: (dt, t, m) => got.push(m ? { ...m } : null), draw() {} }) };
  const L = FX.Layer(fx.canvas(300, 200)); L.resize();
  L.set({ effect: '__probe', interact: true }); got = [];
  clock.t += 100; L.move(100, 50); clock.t += 30; L.move(130, 50); L.tick(1 / 30);
  const m = got.pop(); assert.ok(m && m.x === 130 && m.y === 50, 'gets where the pointer is');
  assert.ok(m.vx > 300 && Math.abs(m.vy) < 1 && m.sp > 300, `and how fast it goes (${Math.round(m.vx)} px/s)`);
  clock.t += 2000; L.tick(1); assert.ok(got.pop().sp < m.sp * 0.1, 'a resting mouse slows down');
  L.leave(); L.tick(1 / 30); assert.equal(got.pop(), null, 'nothing once the mouse has left');
  L.set({ effect: '__probe', interact: false }); clock.t += 30; L.move(50, 50); L.tick(1 / 30);
  assert.equal(got.pop(), null, 'switched off: no pointer');
  L.destroy(); delete FX.EFFECTS.__probe;
}

// ---- fast mouse strokes: followers that spawn by distance get the path in small steps (1.1.22)
{
  const real = FX.FOLLOWERS.shards; const got = [];
  FX.FOLLOWERS.shards = { name: 'probe', make: () => ({ move: (x, y, d) => got.push([x, y, d]), step() {}, draw() {} }) };
  const L = FX.Layer(fx.canvas(600, 300)); L.resize(); L.set({ follower: 'shards', followerAmount: 'mid' });
  clock.t += 100; L.move(20, 100);
  for (let i = 1; i <= 8; i++) { clock.t += 16; L.move(20 + i * 50, 100); } // 50 px per event = 3000 px/s
  FX.FOLLOWERS.shards = real; L.destroy();
  const steps = got.slice(1); // the first call is the mouse coming in
  assert.ok(steps.length >= 8 * 5, `a 50 px jump comes as small steps (${steps.length} calls for 8 jumps)`);
  assert.ok(steps.every(([, , d]) => d <= 10.5), 'no step longer than ~10 px');
  assert.ok(Math.abs(steps.reduce((a, [, , d]) => a + d, 0) - 400) < 1, 'together they cover exactly the distance moved');
  assert.deepEqual(steps[steps.length - 1].slice(0, 2), [420, 100], 'and end where the mouse is');
}

// ---- every background and follower can be switched on and drawn before anything has moved (1.1.25: Ghost ripple threw)
{
  const check = (effect, follower) => {
    for (const [w, h, dark] of [[340, 300, false], [150, 110, true]]) {
      const cv = fx.canvas(w, h); const L = FX.Layer(cv); L.resize();
      assert.doesNotThrow(() => L.set({ effect, follower, dark, paper: dark ? 'night' : 'yellow' }), `${effect} / ${follower} (${w}×${h}): switching it on draws without an error`);
      assert.doesNotThrow(() => { L.setPaused(false); L.setVisible(true); clock.t += 33; L.tick(1 / 30); }, `${effect} / ${follower}: and keeps going`);
      L.destroy();
    }
  };
  for (const f of FX.FOLLOWER_IDS) check('none', f);
  for (const e of FX.EFFECT_IDS) check(e, 'none');
  check('ghost', 'ghost');
  assert.deepEqual(fx.allBad(), [], 'nothing is drawn at NaN or Infinity (on the layer or the pictures it stamps from)');
}

// ---- each paper tints its effects a little (1.1.23)
{
  const light = FX.PALETTES.light; const blue = FX.paperPalette(false, 'blue'); const yellow = FX.paperPalette(false, 'yellow');
  assert.equal(FX.paperPalette(false, 'charcoal'), light, 'charcoal has no hue: no tint');
  assert.equal(FX.paperPalette(false, null), light, 'no paper: no tint');
  assert.equal(FX.paperPalette(false, 'blue'), blue, 'cached');
  const hue = (hex) => { const x = hex.slice(1); const [rr, g, b2] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); const mx = Math.max(rr, g, b2); const mn = Math.min(rr, g, b2); const d = mx - mn; if (!d) return null; let h = mx === rr ? ((g - b2) / d) % 6 : mx === g ? (b2 - rr) / d + 2 : (rr - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const turn = (a, b2) => { const d = Math.abs(a - b2) % 360; return d > 180 ? 360 - d : d; };
  let n = 0;
  for (const k of Object.keys(light)) {
    const v = light[k]; if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) continue;
    const h0 = hue(v); const h1 = hue(blue[k]); if (h0 === null || h1 === null) continue;
    n++; assert.ok(turn(h0, h1) <= 22, `${k}: only a little different (${turn(h0, h1).toFixed(1)}°)`);
  }
  assert.ok(n > 20, 'many inks checked');
  assert.notEqual(blue.heart, light.heart, 'a coloured ink does change'); assert.notEqual(blue.heart, yellow.heart, 'differently per paper');
  assert.equal(blue.brewHi, light.brewHi, 'white stays white');
}

// ---- speed rules (effects draw on one shared canvas loop: effects.md)
{
  const code = src.fx();
  const glowDot = code.slice(code.indexOf('function glowDot('), code.indexOf('function flake('));
  assert.ok(!/createRadialGradient/.test(glowDot) && /stamp\(c, halo\(col\)/.test(glowDot), 'glows are stamped from a ready picture');
  assert.equal((code.match(/createRadialGradient/g) || []).length, 4, 'gradients left: the glow picture itself, the warp flash, the healing pointer glow and the cauldron brew (one each a frame at most)');
  assert.ok(!/Path2D/.test(code), 'no Path2D');
  const rb = FX.EFFECTS.rainbow.make.toString();
  assert.ok(!/c\.filter = 'blur/.test(rb) && /cur\.key/.test(rb) && /solidBow/.test(rb), 'rainbow: bands drawn and blurred once, not every frame');
  assert.equal(FX.loopPace(), 30, 'effects step 30 times a second on a normal machine');
  assert.ok(/const PACE = \[1 \/ 30, 1 \/ 20, 1 \/ 15\]/.test(code), '…and 20 or 15 on one that can’t keep up');
}
console.log('ok');
