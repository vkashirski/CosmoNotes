// 1.1.20: Fairy dust, XP orbs, Neon tunnel and Synthwave removed; a mouse follower for every background (same order,
// names and icons; only Pencil line is mouse-only); Edit design in the list (see-through + the note's effects);
// toolbars and menus dragged out of a note stick to its side only when really close.
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const vm = require('vm');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const { FX_EFFECTS, FX_FOLLOWERS, cleanFx } = require(path.join(__dirname, '..', 'store.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) }, performance: { now: () => Date.now() }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(require('./fx-source')(), sandbox); // 1.1.24: the parts in src/fx/, as note.html loads them
const FX = sandbox.window.COSMO_FX;
function recorder() {
  const bad = [];
  const check = (name, args) => { for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); return String(k).startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad };
}

(async () => {
  await tick(150);
  const H = E.__handlers;
  // ---- removed, everywhere
  for (const id of ['fairy', 'xp', 'tunnel', 'synthwave']) {
    assert.ok(!FX.EFFECTS[id] && !FX_EFFECTS.includes(id) && !FX.ICONS.effect[id], `${id} is gone`);
    assert.equal(cleanFx({ e: id }).e, null, `a note that had ${id} falls back to "same as all notes"`);
    assert.equal(FX.resolve({ e: id }, { fxEffect: 'snow' }).effect, 'snow');
  }
  for (const k of ['fairy', 'fairyCore', 'xp', 'xpText', 'tunnel', 'tunnel2', 'sunTop', 'horizon']) assert.ok(!(k in FX.PALETTES.light) && !(k in FX.PALETTES.dark), `colour ${k} is gone`);

  // ---- a follower for every background: same order, same name, same icon; then the pencil line
  assert.deepEqual([...FX.FOLLOWER_IDS], FX_FOLLOWERS, 'fx.js and store.js agree on the followers');
  assert.equal(FX.FOLLOWER_IDS.length, FX.EFFECT_IDS.length + 1);
  FX.EFFECT_IDS.forEach((e, i) => {
    const f = FX.FOLLOWER_IDS[i];
    assert.equal(FX.PAIRS[f], e, `${f} goes with ${e}`);
    assert.equal(FX.FOLLOWERS[f].name, FX.EFFECTS[e].name, `${f}: same name as the background`);
    assert.equal(FX.ICONS.follower[f], FX.ICONS.effect[e], `${f}: same icon`);
  });
  assert.equal(FX.FOLLOWER_IDS[FX.FOLLOWER_IDS.length - 1], 'pencil', 'Pencil line last, mouse only');
  assert.ok(FX.FOLLOWER_IDS.includes('frost') && FX.FOLLOWER_IDS.includes('ripples'), 'old ids kept (saved choices)'); // (1.1.22: no longer first and eighth, the order is by theme)

  // every follower: small card / note / big note, Rarely … Often, light and dark: no NaN, and it goes quiet when the mouse rests
  for (const id of FX.FOLLOWER_IDS) {
    for (const [w, h, k] of [[150, 110, .35], [340, 280, 1], [900, 700, 2.6]]) for (const dark of [false, true]) {
      const f = FX.FOLLOWERS[id].make(w, h, dark ? FX.PALETTES.dark : FX.PALETTES.light, dark, k); const { ctx, bad } = recorder();
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
  // a still mouse makes nothing (followers that leave a trail)
  for (const id of ['plankton', 'blossom', 'heal', 'cauldron']) { // (1.1.22: embers and fel burn on a resting pointer, see v1122)
    const f = FX.FOLLOWERS[id].make(340, 280, FX.PALETTES.light, false, 1);
    for (let i = 0; i < 30; i++) { f.move(100, 100, 0); f.step(1 / 30, i / 30); }
    assert.ok(!f.busy(), `${id}: nothing from a mouse that doesn't move`);
  }
  // companions (Fish, Solar system, Ghost jellyfish, Aquarium) show while the mouse moves
  for (const id of ['fish', 'jelly']) { // (1.1.22: Solar system and Aquarium were taken out)
    const f = FX.FOLLOWERS[id].make(600, 400, FX.PALETTES.light, false, 1);
    for (let i = 0; i < 60; i++) { f.move(300 + (i % 2), 200, 1); f.step(1 / 30, i / 30); }
    assert.ok(f.fade() > .9 && f.busy(), `${id}: shown while the mouse moves`);
  }

  // ---- Edit design (list): see-through and the note's effects, not an edit; the open window follows
  const before = (await H['list:get']()).notes;
  const id = before[0].id;
  assert.ok('opacity' in before[0], 'the list gets each note\'s see-through');
  await H['list:open-note']({}, id); await tick(60);
  const win = E.__all.find((x) => x.noteId === id && !x.destroyed);
  const upd = before[0].updatedAt;
  let r = await H['list:edit']({}, id, { opacity: .55, fx: { e: 'ghost', f: 'fish', eo: .4, bogus: 1 } });
  assert.equal(r.opacity, .55); assert.deepEqual(r.fx, { e: 'ghost', f: 'fish', ea: null, fa: null, eo: .4, fo: null, mi: null });
  let n = (await H['list:get']()).notes.find((x) => x.id === id);
  assert.equal(n.opacity, .55); assert.equal(n.fx.e, 'ghost'); assert.equal(n.updatedAt, upd, 'not an edit');
  assert.equal(win.opacity, .55, 'the open window turns see-through at once');
  const look = win.webContents.sentArgs.filter((a) => a[0] === 'note:look').pop();
  assert.ok(look && look[1].fx.e === 'ghost' && look[1].opacity === .55, 'and gets the new effects');
  r = await H['list:edit']({}, id, { opacity: 3, fx: { e: 'fairy' } });
  assert.equal(r.opacity, 1, 'see-through: at most solid'); assert.equal(r.fx.e, null, 'a removed effect is not kept');
  r = await H['list:edit']({}, id, { opacity: .01 });
  assert.equal(r.opacity, .25, 'and never below 25 %');
  assert.equal(await H['list:edit']({}, id, { opacity: true }), null, 'nothing valid: nothing changes');

  // ---- toolbars / menus outside the note: stick only within 12 px (was 40)
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/const INK_SNAP = 12;/.test(src), 'snap distance 12 px');
  const listSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.js'), 'utf8');
  assert.ok(listSrc.includes("label: 'Edit design…'"), 'the right-click item is called Edit design…');
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8');
  assert.ok(!noteHtml.includes('id="fxColors"') && !noteHtml.includes('id="fxOpacity"') && noteHtml.includes('id="btnCloseAll"'), '(1.1.22: colour and see-through taken out of Effects again) a close-all button');
  console.log('v1120 ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
