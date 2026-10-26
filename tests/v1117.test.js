// 1.1.17: opacity for the background effect and the mouse follower (for all notes in Settings, or a note's own).
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const { cleanFx, cleanFxOpacity } = require(path.join(__dirname, '..', 'store.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const noteWins = () => E.__all.filter((x) => x.file && x.file.endsWith('note.html') && !x.destroyed);

// A canvas context that behaves like the real one for globalAlpha (a getter/setter on its prototype, clamped
// to 0–1) and records the alpha of everything drawn, so the opacity multiplier can be checked.
class Ctx2D {
  constructor() { this._a = 1; this.drawn = []; this._stack = []; }
  get globalAlpha() { return this._a; }
  set globalAlpha(v) { if (Number.isFinite(v)) this._a = Math.min(1, Math.max(0, v)); }
  save() { this._stack.push(this._a); } restore() { this._a = this._stack.pop() ?? 1; }
  fill() { this.drawn.push(this._a); } stroke() { this.drawn.push(this._a); } fillText() { this.drawn.push(this._a); } fillRect() { this.drawn.push(this._a); } drawImage() { this.drawn.push(this._a); }
  createRadialGradient() { return { addColorStop() {} }; } createConicGradient() { return { addColorStop() {} }; } createLinearGradient() { return { addColorStop() {} }; }
}
for (const k of ['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'translate', 'rotate', 'scale']) Ctx2D.prototype[k] = function () {};
const canvas = (w, h) => { const ctx = new Ctx2D(); return { width: 0, height: 0, clientWidth: w, clientHeight: h, ctx, getContext: () => ctx }; };
const sandbox = { window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => canvas(10, 10) }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;

(async () => {
  await tick(150);
  const H = E.__handlers;
  const get = async () => H['list:get']();
  const noteOf = async (id) => (await get()).notes.find((n) => n.id === id);

  // ---- cleaning: 10 % – 100 %, 5 % steps, nonsense = not set; fx.js and store.js agree
  for (const [v, want] of [[0.5, 0.5], [0.42, 0.4], [0.03, 0.1], [0, 0.1], [7, 1], ['0.6', 0.6], [null, null], [undefined, null], ['', null], ['x', null], [true, null], [NaN, null]]) {
    assert.equal(cleanFxOpacity(v), want, `store: ${v}`);
    assert.equal(FX.opacityOf(v), want, `fx.js: ${v}`);
  }
  assert.deepEqual(cleanFx({ e: 'snow', eo: 0.5, fo: 'loads' }), { e: 'snow', f: null, ea: null, fa: null, eo: 0.5, fo: null, mi: null });
  assert.deepEqual(cleanFx(null), { e: null, f: null, ea: null, fa: null, eo: null, fo: null, mi: null }, 'old notes: same as all notes');

  // ---- which opacity a note shows
  const all = { fxEffect: 'snow', fxFollower: 'stardust' };
  let r = FX.resolve({}, all);
  assert.equal(r.effectOpacity, 1, 'fully visible by default'); assert.equal(r.followerOpacity, 1);
  r = FX.resolve({}, { ...all, fxEffectOpacity: 0.4, fxFollowerOpacity: 0.7 });
  assert.equal(r.effectOpacity, 0.4, 'all notes’ opacity'); assert.equal(r.followerOpacity, 0.7);
  r = FX.resolve({ eo: 0.2, fo: null }, { ...all, fxEffectOpacity: 0.4, fxFollowerOpacity: 0.7 });
  assert.equal(r.effectOpacity, 0.2, 'a note’s own opacity wins'); assert.equal(r.followerOpacity, 0.7, 'null = same as all notes');
  r = FX.resolve({ eo: 0.2 }, { ...all, fxEffectOpacity: 0.4, fxForceAll: true });
  assert.equal(r.effectOpacity, 0.4, 'use on every note: all notes’ opacity');

  // ---- the layer draws everything with the opacity multiplied in, and changing it restarts nothing
  const cv = canvas(340, 280);
  const L = FX.Layer(cv);
  L.resize();
  L.set({ effect: 'snow', follower: 'none' });
  cv.ctx.drawn = []; L.tick(.03);
  const full = Math.max(...cv.ctx.drawn);
  assert.ok(full > 0.5, 'snow is drawn at its own strength');
  L.set({ effect: 'snow', follower: 'none', effectOpacity: 0.5 });
  cv.ctx.drawn = []; L.tick(.03);
  assert.ok(Math.abs(Math.max(...cv.ctx.drawn) - full * 0.5) < 1e-9, 'at 50 % everything is half as strong');
  assert.equal(cv.ctx.globalAlpha, 1, 'the canvas is left at 1 after drawing');
  // the follower has its own opacity
  L.set({ effect: 'none', follower: 'stardust', effectOpacity: 0.5, followerOpacity: 0.3 });
  for (let i = 0; i < 10; i++) L.move(20 + i * 10, 100);
  cv.ctx.drawn = []; L.tick(.03);
  assert.ok(cv.ctx.drawn.length && Math.max(...cv.ctx.drawn) <= 0.3 + 1e-9, 'follower at 30 %');
  L.destroy();

  // ---- settings for all notes
  let s = (await get()).settings;
  assert.equal(s.fxEffectOpacity, 1); assert.equal(s.fxFollowerOpacity, 1);
  await H['list:new']();
  const w = noteWins().pop();
  const id = (await H['note:get'](ev(w))).id;
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { fxEffectOpacity: 0.35, fxFollowerOpacity: 0.62 });
  s = (await get()).settings;
  assert.equal(s.fxEffectOpacity, 0.35); assert.equal(s.fxFollowerOpacity, 0.6, 'rounded to 5 %');
  const sent = w.webContents.sentArgs.filter((x) => x[0] === 'settings:changed').pop();
  assert.ok(sent && sent[1].fxEffectOpacity === 0.35 && sent[1].fxFollowerOpacity === 0.6, 'open notes are told');
  await H['settings:set'](null, { fxEffectOpacity: 'lots', fxFollowerOpacity: null });
  s = (await get()).settings;
  assert.equal(s.fxEffectOpacity, 0.35, 'nonsense ignored'); assert.equal(s.fxFollowerOpacity, 0.6);
  assert.equal((await H['note:get'](ev(w))).settings.fxEffectOpacity, 0.35, 'a note window gets it when it opens');

  // ---- a note's own opacity: kept, not an edit, copied by Duplicate
  const before = (await noteOf(id)).updatedAt;
  await tick(20);
  await H['note:update'](ev(w), { fx: { e: 'rain', f: null, eo: 0.45, fo: 2 } });
  const n = await noteOf(id);
  assert.equal(n.fx.eo, 0.45); assert.equal(n.fx.fo, 1, 'capped at 100 %');
  assert.equal(n.updatedAt, before, 'changing the opacity is not an edit');
  const copyId = await H['list:duplicate'](null, id);
  assert.equal((await noteOf(copyId)).fx.eo, 0.45, 'a copy keeps it');

  console.log('v1117 ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
