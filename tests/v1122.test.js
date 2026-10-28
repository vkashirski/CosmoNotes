// 1.1.22: menus only dock within 12 px of the note's edge; effect changes the owner asked for (Analog monitor
// "touching an old TV", gentler Silk waves, Dust in light, Healing aura, Lightning, Cauldron, Ghost jellyfish, Fel fire,
// Embers, a new Digital ocean follower) and the switch renamed "Mouse can interact with the background".
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert.ok(/const near = \(d\) => d > -INK_SNAP && d < INK_SNAP;/.test(src), 'docks only within 12 px of the edge');
assert.ok(!/near\(d[RLTB], v\.[wh]\)/.test(src), 'no more half-size overlap');
assert.equal(require('../package.json').version, '1.1.22');

// ---- the switch's new name
for (const f of ['note.html', 'list.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  assert.ok(html.includes('Mouse can interact with the background'), `${f}: new name`);
  assert.ok(!html.includes('Mouse plays with the background'), `${f}: old name gone`);
}

// ---- the effects
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const sandbox = { window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: fakeCtx }) }, performance: { now: () => 0 }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
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
const seeded = (n = 7) => { let s = n; const old = Math.random; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; return () => { Math.random = old; }; };
const PAL = (dark) => (dark ? FX.PALETTES.dark : FX.PALETTES.light);
const ptr = (x, y, vx = 0, vy = 0) => ({ x, y, vx, vy, sp: Math.hypot(vx, vy) });

// the owner's picks are the only versions left: Analog monitor mouse = Phosphor pixels, Healing aura = Breathing,
// Ghost jellyfish = Slingshot ghost, Digital ocean mouse = Surf (no more PICK switch)
assert.ok(!('PICK' in FX), 'nothing is waiting for a pick any more');
// Analog monitor touch: first the Magnet (a lumpy smear); from the fifth round the lines part like Ghost ripple's dots and one scan line sweeps
for (const dark of [false, true]) for (const [w, h] of [[150, 110], [340, 280], [900, 700]]) {
  const e = FX.EFFECTS.glitch.make(w, h, PAL(dark), dark, 1); const { ctx, bad } = recorder();
  for (let i = 0; i < 150; i++) { const m = i > 20 && i < 110 ? ptr(w / 2 + Math.sin(i / 6) * w / 3, h / 2 + Math.sin(i / 4) * h / 3, Math.cos(i / 6) * 300, Math.cos(i / 4) * (i > 90 ? 1500 : 300)) : null; e.step(1 / 30, i / 30, m); if (i % 7 === 0) e.draw(ctx, i / 30); }
  assert.deepEqual(bad, [], `analog monitor touch ${w}×${h}: nothing at NaN`);
}
{
  // 1.1.22, fifth round: no lumpy blob or colour fringe any more; the lines behave like Ghost ripple's dots. A moving pointer
  // parts them and they wobble back until they're straight again; a resting pointer leaves them alone
  const src = FX.EFFECTS.glitch.make.toString();
  assert.ok(!/fringe|blobs|RED|CYAN/.test(src), 'analog monitor: no blobs, no red / cyan fringe');
  // every line segment drawn: the biggest up/down offset from a straight line
  const wobble = (e, W, H) => {
    let worst = 0; let last = null;
    const spy = new Proxy({}, { get: (t, k) => (k === 'moveTo' ? (x, y) => { last = y; } : k === 'lineTo' ? (x, y) => { if (last !== null) worst = Math.max(worst, Math.abs(y - last)); last = y; } : k in t ? t[k] : (k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    e.draw(spy, 0); return worst;
  };
  const run = (move) => {
    const W = 340; const H = 280; const e = FX.EFFECTS.glitch.make(W, H, PAL(true), true, .0001); // k tiny: the scan line stays away
    const log = []; let x = 40;
    for (let i = 0; i < 60 * 8; i++) { const on = move && i < 60; if (on) x += 6; e.step(1 / 60, i / 60, on ? ptr(x, 250, 360, 0) : null); if (i % 20 === 0) log.push(wobble(e, W, H)); }
    return { peak: Math.max(...log), end: log[log.length - 1] };
  };
  const moving = run(true); const resting = run(false);
  assert.ok(moving.peak > 1, `a moving pointer parts the lines (${moving.peak.toFixed(1)} px)`);
  assert.ok(moving.end < .5, 'and they wobble back until they are straight again');
  assert.ok(resting.peak < .3, 'a pointer that is not moving leaves the lines alone');
}
{
  // ONE scan line (never two bars), and Frequency = how often it sweeps
  const sweeps = (k) => {
    const e = FX.EFFECTS.glitch.make(340, 280, PAL(true), true, k); let n = 0; let was = false; let most = 0; let g = 0;
    const spy = new Proxy({}, { get: (t, key) => (key === 'createLinearGradient' ? () => { g++; return { addColorStop() {} }; } : key in t ? t[key] : () => {}), set: (t, key, v) => { t[key] = v; return true; } });
    for (let i = 0; i < 2 * 300; i++) {
      e.step(.5, i * .5, null); g = 0; e.draw(spy, i * .5); most = Math.max(most, g); if (g && !was) n++; was = g > 0; // a sweep lasts 4 s or more: looking every half second is plenty
    }
    return { n, most };
  };
  const rarely = sweeps(.18); const normal = sweeps(1); const often = sweeps(3.6);
  assert.equal(Math.max(rarely.most, normal.most, often.most), 1, 'only one scan line at a time, even at "Often"');
  assert.ok(rarely.n >= 3 && rarely.n <= 7, `rarely: about once a minute (${rarely.n} in 5 min)`);
  assert.ok(normal.n >= 14 && normal.n <= 23, `normal: about every 16 s (${normal.n} in 5 min)`);
  assert.ok(often.n >= 45 && often.n <= 70, `often: about every 5 s (${often.n} in 5 min)`);
}
{
  // Dust in light (mouse): "Rarely" was the old "Often" amount; the whole scale moved down
  const specks = (k) => { const f = FX.FOLLOWERS.dust.make(900, 400, PAL(true), true, k); for (let i = 0; i < 100; i++) f.move(20 + i * 8, 200, 8); const { calls } = recorder(); const rec = recorder(); f.draw(rec.ctx, 0); return rec.calls.filter(([n]) => n === 'arc').length; };
  const rare = specks(.35); const norm = specks(1); const oft = specks(2.6);
  assert.ok(rare < norm && norm < oft, `dust: rarely < normal < often (${rare}, ${norm}, ${oft})`);
  assert.ok(oft >= 40 && oft <= 70, `dust "Often" now makes about one speck every 17 px, which "Rarely" used to (${oft} circles over 800 px)`);
  assert.ok(norm <= 36, `dust "Normal" is much sparser (${norm})`);
}
for (const dark of [false, true]) {
  const { ctx, bad } = recorder();
  const f = FX.FOLLOWERS.glitch.make(340, 280, PAL(dark), dark, 1); let x = 20;
  for (let i = 0; i < 120; i++) { if (i < 60) { f.move(x, 140 + Math.sin(i / 5) * 60, 9); x += 5; } f.step(1 / 30, i / 30); if (i % 10 === 0) f.draw(ctx, i / 30); }
  assert.ok(ctx.fillStyle !== undefined, 'phosphor stripes drawn');
  for (let i = 0; i < 150; i++) f.step(1 / 30, 4 + i / 30);
  assert.ok(!f.busy(), 'analog monitor mouse: quiet after the mouse stops');
  for (const id of ['heal', 'jelly']) {
    const e = FX.EFFECTS[id].make(340, 280, PAL(dark), dark, 1);
    for (let i = 0; i < 150; i++) { const m = i > 50 && i < 110 ? ptr(170 + Math.sin(i / 4) * 40, 160, 120, 0) : null; e.step(1 / 30, i / 30, m); if (i % 10 === 0) e.draw(ctx, i / 30); }
  }
  assert.deepEqual(bad, [], `${dark ? 'dark' : 'light'}: nothing drawn at NaN`);
}
assert.ok(!/ellipse/.test(FX.EFFECTS.heal.make.toString()), 'healing aura: no rings at the bottom');

// Ghost jellyfish: touching it no longer chases it away; it lights up instead
{
  let undo = seeded(); const a = FX.EFFECTS.jelly.make(340, 280, PAL(true), true, 1); for (let i = 0; i < 45; i++) a.step(1 / 30, i / 30, null); undo();
  undo = seeded(); const b = FX.EFFECTS.jelly.make(340, 280, PAL(true), true, 1);
  for (let i = 0; i < 45; i++) { const j = b.where(); b.step(1 / 30, i / 30, j ? ptr(j.x, j.y + 10) : null); } undo();
  const ja = a.where(); const jb = b.where();
  assert.ok(Math.abs(ja.x - jb.x) < .01 && Math.abs(ja.y - jb.y) < .01, 'jelly: stays on its way when touched');
  assert.ok(jb.lit > .9, 'jelly: lights up');
}

// Ghost jellyfish (slingshot ghost): going through it leaves a mirage behind, and later it has faded away
{
  const undo = seeded(3); const e = FX.EFFECTS.jelly.make(340, 280, PAL(true), true, 1); const { ctx, bad, calls } = recorder();
  let t = 0; for (let i = 0; i < 20; i++) e.step(1 / 30, t += 1 / 30, null);
  const j0 = e.where(); for (let i = 0; i < 12; i++) { const j = e.where(); e.step(1 / 30, t += 1 / 30, ptr(j.x - 25 + i * 4, j.y + 10, 120, 0)); }
  e.step(1 / 30, t += 1 / 30, ptr(5, 5)); // left it
  e.draw(ctx, t); const violet = calls.filter(([n]) => n === 'arc').length;
  for (let i = 0; i < 120; i++) e.step(1 / 30, t += 1 / 30, null);
  const { ctx: ctx2, calls: calls2 } = recorder(); e.draw(ctx2, t);
  undo();
  assert.ok(j0 && violet > calls2.filter(([n]) => n === 'arc').length, 'a twin is let go, and later it has faded away');
  assert.deepEqual(bad, []);
}

// Ghost jellyfish: the twin is flung once when the pointer comes in; circling round inside makes no more and it never follows
{
  const undo = seeded(4); const e = FX.EFFECTS.jelly.make(340, 280, PAL(true), true, 1); let t = 0;
  for (let i = 0; i < 20; i++) e.step(1 / 30, t += 1 / 30, null);
  let most = 0; for (let i = 0; i < 120; i++) { const j = e.where(); e.step(1 / 30, t += 1 / 30, ptr(j.x + Math.cos(i / 4) * 12, j.y + 10 + Math.sin(i / 4) * 12, -Math.sin(i / 4) * 90, Math.cos(i / 4) * 90)); most = Math.max(most, e.where().twins); }
  const after = e.where().twins; undo();
  assert.equal(most, 1, 'one twin for one visit'); assert.equal(after, 0, 'and it has faded away while the pointer was still circling inside');
}

// Ghost jellyfish: the mirage stays exactly where it appeared (it doesn't swim or sway) and fades out smoothly, with no
// jump from a faint-but-visible state to nothing at the end
{
  const undo = seeded(3); const e = FX.EFFECTS.jelly.make(340, 280, PAL(true), true, 1); const ALT = '#E3A6FF'; let t = 0;
  const frame = () => { // what is drawn in the mirage's violet this frame: its strongest opacity and where its first dot is
    const fills = []; let arcs = [];
    const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'beginPath' ? () => { arcs = []; } : k === 'arc' ? (...a) => arcs.push(a) : k === 'fill' ? () => fills.push({ style: o.fillStyle, alpha: o.globalAlpha, first: arcs[0] }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
    e.draw(ctx, t); const v = fills.filter((f) => f.style === ALT);
    return { alpha: v.length ? Math.max(...v.map((f) => f.alpha)) : 0, at: v.length ? v[0].first.slice(0, 2).map((n) => Math.round(n * 100) / 100).join(',') : null };
  };
  for (let i = 0; i < 20; i++) { e.step(1 / 30, t += 1 / 30, null); frame(); }
  const j = e.where(); e.step(1 / 30, t += 1 / 30, ptr(j.x, j.y + 10)); frame(); // the pointer goes in for one frame
  const seen = [];
  for (let i = 0; i < 90; i++) { e.step(1 / 30, t += 1 / 30, null); const r = frame(); const w = e.where(); if (w.twins && w.lit === 0) seen.push(r); } // (once the shine has calmed down, only the mirage is violet)
  undo();
  const al = seen.map((x) => x.alpha);
  assert.ok(seen.length >= 12, `the mirage is on show for a good while (${seen.length} frames)`);
  assert.ok(al.every((a, i) => i === 0 || a <= al[i - 1] + 1e-9), 'it only ever gets fainter, to the very end');
  assert.equal(new Set(seen.filter((x) => x.at).map((x) => x.at)).size, 1, 'and it never moves: its first dot is in the same place in every frame');
  const shown = al.filter((a) => a > 0); const drops = shown.slice(1).map((a, i) => shown[i] - a);
  assert.ok(shown[shown.length - 1] < .03, `the last frame it's drawn is almost invisible (${shown[shown.length - 1].toFixed(3)}), so it doesn't pop out`);
  assert.ok(Math.max(...drops) < .05, `no big step down at any point (biggest ${Math.max(...drops).toFixed(3)} in one frame)`);
}

// Snow: a flake the pointer touches shatters into bits
{
  const e = FX.EFFECTS.snow.make(340, 280, PAL(true), true, 1); let t = 0;
  let hits = 0;
  for (let i = 0; i < 150; i++) { e.step(1 / 30, t += 1 / 30, ptr(20 + (i * 7) % 300, 30 + ((i * 7) / 300 | 0) * 50, 210, 0)); const { ctx, calls } = recorder(); e.draw(ctx, t); if (calls.some(([n]) => n === 'arc')) hits++; }
  assert.ok(hits > 10, `powder from shattered flakes (${hits} frames)`);
}

// Fireflies: only the ones close to the pointer are drawn in (gently), the others ignore it, and one lets go when the pointer gets away
{
  const mk = () => FX.EFFECTS.fireflies.make(340, 280, PAL(true), true, 1);
  const pos = (e, t) => { const { ctx, calls } = recorder(); e.draw(ctx, t); return calls.filter(([n]) => n === 'arc').map(([, a]) => [a[0], a[1]]).filter((_, i) => i % 2 === 0); }; // a firefly is a halo and a dot: every other arc
  const dist = (p, m) => Math.hypot(p[0] - m.x, p[1] - m.y);
  const start = () => { const e = mk(); e.step(1 / 30, 0, null); return [e, pos(e, 0)[0]]; };
  let undo = seeded(5); let [e, p0] = start(); let m = ptr(p0[0] + (p0[0] < 170 ? 60 : -60), p0[1]); let t = 0; let closest = 999;
  for (let i = 0; i < 90; i++) { e.step(1 / 30, t += 1 / 30, m); closest = Math.min(closest, dist(pos(e, t)[0], m)); } undo();
  assert.ok(closest < 50, `a firefly 60 px from the pointer drifts over to it (it gets within ${closest.toFixed(0)} px)`);
  undo = seeded(5); [e, p0] = start(); m = ptr(p0[0] + (p0[0] < 170 ? 125 : -125), p0[1]); t = 0; closest = 999;
  for (let i = 0; i < 30; i++) { e.step(1 / 30, t += 1 / 30, m); closest = Math.min(closest, dist(pos(e, t)[0], m)); } undo();
  assert.ok(closest > 100, `one 125 px away ignores the pointer (never closer than ${closest.toFixed(0)} px)`);
  undo = seeded(5); [e, p0] = start(); m = ptr(p0[0] + (p0[0] < 170 ? 50 : -50), p0[1]); t = 0;
  for (let i = 0; i < 30; i++) e.step(1 / 30, t += 1 / 30, m);
  const pa = pos(e, t)[0]; m = ptr(pa[0] + (pa[0] < 170 ? 200 : -200), pa[1] > 140 ? 20 : 260);
  for (let i = 0; i < 30; i++) e.step(1 / 30, t += 1 / 30, m);
  const pb = pos(e, t)[0]; undo();
  assert.ok(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 30, 'when the pointer leaps away the firefly lets go instead of chasing it');
}

// Lightning: a bolt only hits the pointer when the pointer is near where it was going to strike anyway
{
  const undo = seeded(11); const e = FX.EFFECTS.lightning.make(340, 280, PAL(true), true, 1); let bolts = 0; let hits = 0; let last = null;
  for (let i = 0; i < 30 * 240; i++) { e.step(1 / 30, i / 30, ptr(170, 160)); const b = e.bolt(); if (b && b !== last) { bolts++; if (b.hit) hits++; } last = b; }
  undo();
  assert.ok(bolts > 40, 'bolts keep coming'); assert.ok(hits > bolts * .6, `most hit the pointer now (${hits} of ${bolts}; it used to be about one in two)`); assert.ok(hits < bolts * .92, `but not every one: the side bolts stay (${hits} of ${bolts})`);
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

// Fel fire (background): the flames stay low (up to the lower middle at most)
{
  const e = FX.EFFECTS.fel.make(340, 280, PAL(true), true, 1); const { ctx, calls } = recorder();
  for (let i = 0; i < 30 * 20; i++) { e.step(1 / 30, i / 30, null); if (i % 15 === 0) e.draw(ctx, i / 30); }
  const ys = calls.filter(([n, a]) => n === 'arc' && !(a[0] === 0 && a[1] === 0)).map(([, a]) => a[1]);
  assert.ok(ys.length > 100 && Math.min(...ys) > 280 * .4, `flames below the middle (highest at ${Math.min(...ys).toFixed(0)} of 280)`);
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

// Analog monitor and Silk waves with the mouse: nothing at NaN, small or big, fast or slow
for (const id of ['glitch', 'silk', 'dust', 'cauldron']) for (const [w, h] of [[150, 110], [340, 280], [900, 700]]) {
  const e = FX.EFFECTS[id].make(w, h, PAL(true), true, 1); const { ctx, bad } = recorder();
  for (let i = 0; i < 120; i++) { const m = i < 80 ? ptr(w / 2 + Math.sin(i / 3) * w / 3, h * .85, Math.cos(i / 3) * 1500, 0) : null; e.step(1 / 30, i / 30, m); if (i % 8 === 0) e.draw(ctx, i / 30); }
  assert.deepEqual(bad, [], `${id} ${w}×${h}: nothing at NaN`);
}
// ---- fast mouse strokes: followers that spawn by distance get the path in small steps, and never stop when full
{
  let nowT = 5000; sandbox.performance.now = () => nowT;
  const canvas = { clientWidth: 600, clientHeight: 300, width: 0, height: 0, getContext: fakeCtx };
  const real = FX.FOLLOWERS.shards; const got = [];
  FX.FOLLOWERS.shards = { name: 'probe', make: () => ({ move: (x, y, d) => got.push([x, y, d]), step() {}, draw() {} }) };
  const L = FX.Layer(canvas); L.resize(); L.set({ follower: 'shards', followerAmount: 'mid' });
  nowT += 100; L.move(20, 100);
  for (let i = 1; i <= 8; i++) { nowT += 16; L.move(20 + i * 50, 100); } // 50 px per event = 3000 px/s
  FX.FOLLOWERS.shards = real; L.destroy();
  const steps = got.slice(1); // the first call is the mouse coming in
  assert.ok(steps.length >= 8 * 5, `a 50 px jump comes as small steps (${steps.length} calls for 8 jumps)`);
  assert.ok(steps.every(([, , d]) => d <= 10.5), 'no step longer than ~10 px');
  assert.ok(Math.abs(steps.reduce((a, [, , d]) => a + d, 0) - 400) < 1, 'together they cover exactly the distance moved');
  assert.deepEqual(steps[steps.length - 1].slice(0, 2), [420, 100], 'and end where the mouse is');
}
// a long fast stroke keeps making glass shards right at the pointer (it used to stop once 16 were alive)
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

// ---- fifth round: the pickers are ordered by theme (the owner's "Option A"); same ids, only the order changed
{
  const { FX_EFFECTS, FX_FOLLOWERS } = require('../store.js');
  const want = ['snow', 'rain', 'rainbow', 'lightning', 'leaves', 'blossom', 'fireworks', 'confetti', 'hearts', 'bubbles', 'fish', 'shards', 'plankton', 'fireflies', 'dust', 'embers', 'nightsky', 'stardust', 'warp', 'ocean', 'silk', 'network', 'ghost', 'matrix', 'glitch', 'heal', 'cauldron', 'fel', 'jelly'];
  assert.deepEqual([...FX.EFFECT_IDS], want, 'effects are in the themed order');
  assert.deepEqual(FX_EFFECTS, want, 'store.js has the same order');
  assert.deepEqual([...FX.FOLLOWER_IDS], want.map((e) => (e === 'snow' ? 'frost' : e === 'rain' ? 'ripples' : e)).concat('pencil'), 'followers follow the same order, pencil last');
  assert.deepEqual(FX_FOLLOWERS, [...FX.FOLLOWER_IDS], 'store.js followers agree');
  const at = (id) => want.indexOf(id);
  assert.ok(at('rain') === at('snow') + 1 && at('rainbow') === at('rain') + 1 && at('lightning') === at('rainbow') + 1, 'weather together, rainbow right after rain');
  assert.deepEqual(want.slice(at('blossom') + 1, at('plankton') + 1), ['fireworks', 'confetti', 'hearts', 'bubbles', 'fish', 'shards', 'plankton'], 'after cherry blossom: party, then bubbles and fish, glass shards, plankton');
  assert.ok(at('blossom') === at('leaves') + 1, 'leaves next to cherry blossom');
  assert.ok(at('glitch') === at('matrix') + 1, 'analog monitor next to matrix');
  assert.ok(Math.abs(at('cauldron') - at('fel')) === 1 && Math.abs(at('heal') - at('cauldron')) === 1, 'healing aura, cauldron and fel fire together');
  assert.ok(at('silk') === at('ocean') + 1, 'silk waves next to digital ocean');
}

// ---- sixth round (same version)
// Network: the nodes stay spread out (they used to pile into one clump after a while; after an hour 30 nodes sat in
// 4–5 of 36 cells, ~2 px apart)
{
  const e = FX.EFFECTS.network.make(340, 280, PAL(true), true, 1);
  for (let i = 0; i < 30 * 60 * 20; i++) e.step(1 / 30, i / 30, i % 1800 < 240 ? ptr(170, 140) : null); // 20 min, the pointer resting on it 8 s a minute
  const pts = []; const spy = new Proxy({}, { get: (t, k) => (k === 'arc' ? (x, y, r) => { if (r < 3) pts.push([x, y]); } : k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
  e.draw(spy, 0);
  const cells = new Set(pts.map(([x, y]) => `${Math.floor(x / 340 * 6)},${Math.floor(y / 280 * 6)}`));
  let nn = 0; for (const a of pts) { let m = 1e9; for (const b of pts) if (a !== b) m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1])); nn += m; }
  assert.ok(cells.size >= 14, `network: nodes spread over the note after 20 min (${cells.size}/36 cells)`);
  assert.ok(nn / pts.length > 20, `network: nodes keep some room (${(nn / pts.length).toFixed(1)} px to the nearest)`);
}
// the notes list shows checklist boxes (store.checklistMarks: one letter per shown line)
{
  const { checklistMarks } = require('../store.js');
  const html = '<div>Shopping</div><ul class="checklist"><li>Milk &amp; eggs</li><li class="done"><b>Bread</b> rolls</li><li>Fruit<ul><li class="done">apples</li><li>pears<br>green</li></ul></li></ul><ul><li>plain</li></ul><div><br></div><div>end</div>';
  assert.equal(checklistMarks(html, 'Shopping\nMilk & eggs\nBread rolls\nFruit\napples\npears\ngreen\nplain\n\nend'), '.oxoxo...');
  assert.equal(checklistMarks('<p>no lists</p>', 'no lists'), '');
  assert.equal(checklistMarks('<ul class="checklist"><li><br></li></ul>', ''), '');
  assert.equal(checklistMarks('<ul class="checklist"><li>a&nbsp; b</li></ul>', 'a  b'), 'o');
  assert.equal(checklistMarks(null, 'x'), '');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/checks: hiddenInList\(n\) \? '' : checklistMarks\(n\.html/.test(main), 'list:get sends the marks (not for hidden notes)');
  const lj = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.js'), 'utf8');
  assert.ok(/class: 'cb'/.test(lj) && /\.card \.txt \.cb/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'list.css'), 'utf8')), 'cards draw the boxes');
}
// Edit design: a small pop-up with tabs (Colour / Background / Mouse), beside the note, nothing dimmed behind it
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.html'), 'utf8');
  const box = html.slice(html.indexOf('id="editSheet"'), html.indexOf('id="toast"'));
  const tabs = [...box.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tabs)], ['look', 'e', 'f'], 'three tabs');
  assert.ok(!/editFxTabs|efxsec/.test(box), 'no more Background / Mouse tabs inside a long sheet');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.css'), 'utf8');
  assert.ok(/#editSheet \{[^}]*background: transparent/.test(css), 'the list behind is not dimmed');
  assert.ok(/#editSheet \.ebox \{[^}]*width: 352px/.test(css), 'a small pop-up');
  assert.ok(/\.esheet \.fxi\.on \{[^}]*box-shadow: 0 0 0 2px var\(--ink\)/.test(css), 'what is picked has a dark ring, like in Settings');
}
console.log('v1122 ok');
