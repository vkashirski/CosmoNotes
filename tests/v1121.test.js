// 1.1.21: "Mouse plays with the background": a switch for all notes (Settings fxInteract, on by default) and for one
// note (fx.mi: true / false / null = same as all notes). The layer hands the background the pointer (step's third
// argument) only while it's on; every background reacts to it in its own way.
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const { cleanFx } = require(path.join(__dirname, '..', 'store.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });

let now = 1000;
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const sandbox = { window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: fakeCtx }) }, performance: { now: () => now }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;
function recorder() {
  const bad = []; const calls = [];
  const check = (name, args) => { calls.push([name, args]); for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); return String(k).startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad, calls };
}

(async () => {
  await tick(150);
  const H = E.__handlers;
  // ---- choosing rules
  assert.equal(FX.resolve({}, {}).interact, true, 'on by default');
  assert.equal(FX.resolve({}, { fxInteract: false }).interact, false, 'off for all notes');
  assert.equal(FX.resolve({ mi: true }, { fxInteract: false }).interact, true, 'a note can switch it on for itself');
  assert.equal(FX.resolve({ mi: false }, { fxInteract: true }).interact, false, '…or off');
  assert.equal(FX.resolve({ mi: false }, { fxInteract: true, fxForceAll: true }).interact, true, '"use on every note" uses the setting');
  assert.equal(cleanFx({ mi: true }).mi, true); assert.equal(cleanFx({ mi: 'yes' }).mi, null); assert.equal(cleanFx({}).mi, null);

  // ---- settings: saved, cleaned, sent to the notes
  await H['list:new']({}, null); await tick(80);
  const w = E.__all.find((x) => x.file && x.file.endsWith('note.html') && !x.destroyed);
  assert.equal((await H['note:get'](ev(w))).settings.fxInteract, true, 'note windows get it (on)');
  await H['settings:set']({}, { fxInteract: 0 });
  assert.equal((await H['list:get']()).settings.fxInteract, false);
  const sent = w.webContents.sentArgs.filter((a) => a[0] === 'settings:changed').pop();
  assert.ok(sent && sent[1].fxInteract === false, 'open notes are told');
  // a note's own switch is not an edit and is copied by Duplicate
  const before = (await H['note:get'](ev(w))).updatedAt;
  await H['note:update'](ev(w), { fx: { e: 'bubbles', mi: true } });
  const n = await H['note:get'](ev(w));
  assert.equal(n.fx.mi, true); assert.equal(n.updatedAt, before, 'not an edit');
  const copy = await H['list:duplicate']({}, n.id); await tick(50);
  const c = (await H['list:get']()).notes.find((x) => x.id !== n.id && x.fx && x.fx.mi === true);
  assert.ok(copy && c, 'a copy keeps it');

  // ---- the layer hands the pointer to the background only while the switch is on
  {
    let got = [];
    FX.EFFECTS.__probe = { name: 'probe', make: () => ({ step: (dt, t, m) => got.push(m ? { ...m } : null), draw() {} }) };
    const canvas = { clientWidth: 300, clientHeight: 200, width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } }) };
    const L = FX.Layer(canvas); L.resize();
    L.set({ effect: '__probe', interact: true }); got = [];
    now += 100; L.move(100, 50); now += 30; L.move(130, 50); L.tick(1 / 30);
    const m = got.pop(); assert.ok(m && m.x === 130 && m.y === 50, 'gets where the pointer is');
    assert.ok(m.vx > 300 && Math.abs(m.vy) < 1 && m.sp > 300, `and how fast it goes (${Math.round(m.vx)} px/s)`);
    now += 2000; L.tick(1); assert.ok(got.pop().sp < m.sp * .1, 'a resting mouse slows down');
    L.leave(); L.tick(1 / 30); assert.equal(got.pop(), null, 'nothing once the mouse has left');
    L.set({ effect: '__probe', interact: false }); now += 30; L.move(50, 50); L.tick(1 / 30);
    assert.equal(got.pop(), null, 'switched off: no pointer');
    L.destroy(); delete FX.EFFECTS.__probe;
  }

  // ---- every background takes the pointer without breaking: small card, normal note, big note at "Often"
  for (const id of FX.EFFECT_IDS) {
    for (const [W, Hh, k] of [[150, 110, .054], [340, 280, 1], [900, 700, 9]]) for (const dark of [false, true]) {
      const e = FX.EFFECTS[id].make(W, Hh, dark ? FX.PALETTES.dark : FX.PALETTES.light, dark, k); const { ctx, bad } = recorder();
      for (let i = 0; i < 240; i++) {
        const t = i / 30; const fast = i % 9 === 0 ? 4 : 1;
        const m = i % 80 < 60 ? { x: W / 2 + Math.sin(t * 2) * W * .45, y: Hh / 2 + Math.cos(t * 1.3) * Hh * .45, vx: Math.cos(t * 2) * W * .9 * fast, vy: -Math.sin(t * 1.3) * Hh * .6 * fast } : null;
        if (m) m.sp = Math.hypot(m.vx, m.vy);
        e.step(i % 40 === 0 ? .1 : 1 / 30, t, m); if (i % 12 === 0) e.draw(ctx, t);
      }
      assert.deepEqual(bad, [], `${id} ${W}×${Hh} k=${k}: no NaN with the mouse playing`);
    }
  }

  // ---- a few of the reactions, checked
  const P = FX.PALETTES.light;
  { // bubbles: touching one pops it (a pop is drawn as little lines; count the bubbles drawn as arcs)
    const e = FX.EFFECTS.bubbles.make(340, 280, P, false, 3.6);
    for (let i = 0; i < 90; i++) e.step(1 / 30, i / 30);
    const arcs = () => { const { ctx, calls } = recorder(); e.draw(ctx, 3); return calls.filter((x) => x[0] === 'arc').length; };
    const a0 = arcs();
    for (let x = 0; x <= 340; x += 4) for (let y = 0; y <= 280; y += 12) e.step(0, 3, { x, y, vx: 0, vy: 0, sp: 0 });
    assert.ok(arcs() < a0 * .2, `sweeping the pointer over them pops the bubbles (${a0} → ${arcs()})`);
  }
  { // rain: drops splash off the pointer
    const e = FX.EFFECTS.rain.make(340, 280, P, false, 3.6); let fills = 0;
    for (let i = 0; i < 150; i++) { e.step(1 / 30, i / 30, { x: 170, y: 150, vx: 0, vy: 0, sp: 0 }); const { ctx, calls } = recorder(); e.draw(ctx, i / 30); fills += calls.filter((x) => x[0] === 'fill').length; }
    assert.ok(fills > 10, 'splashes are drawn');
  }
  { // ghost ripple: the dots part around the pointer too (drawn as more, brighter dots than without it)
    const run = (m) => { const e = FX.EFFECTS.ghost.make(340, 280, P, false, 1); for (let i = 0; i < 20; i++) e.step(1 / 30, 50 + i / 30, m); const { ctx, calls } = recorder(); e.draw(ctx, 51); return calls.filter((x) => x[0] === 'arc').length; };
    assert.ok(run({ x: 20, y: 260, vx: 0, vy: 0, sp: 0 }) >= run(null), 'more dots stirred with the pointer');
  }
  console.log('v1121 ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
