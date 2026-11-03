'use strict';
// How each background effect behaves, as the owner picked it (src/fx/ in a vm through tests/helpers/fx.js): how often
// things happen, Fish's few fills, what the pointer does (bubbles pop, rain splashes, Analog monitor's lines part, Ghost
// jellyfish lights up and leaves a mirage, snow shatters, fireflies come over, lightning strikes it, Warp speed's
// hyperdrive in the middle), Fel fire stays low, Network stays spread out. (That every effect draws without NaN:
// effects-draw.test.js; the rules: effects-rules.test.js.)
const assert = require('assert');
const fx = require('./helpers/fx');

const { FX, recorder, seeded, PAL, ptr } = fx;

// ---- how often things happen: night sky's shooting stars, Warp speed's light speed (1.1.18)
const countShooting = (id, w, h, k, test) => { const fx = FX.EFFECTS[id].make(w, h, FX.PALETTES.dark, true, k); let n = 0; let was = false; for (let i = 0; i < 600 * 10; i++) { fx.step(.1, i * .1); const { ctx } = recorder({ log: false }); let drew = false; const spy = new Proxy(ctx, { get: (t, key) => (key === 'createLinearGradient' ? (...a) => { drew = true; return t[key](...a); } : t[key]) }); fx.draw(spy, i * .1); if (test(drew) && !was) n++; was = test(drew); } return n; };
for (const k of [1, 9]) {
  const stars = countShooting('nightsky', 900, 700, k, (d) => d); assert.ok(stars >= 40 && stars <= 60, `night sky: a shooting star about every 12 s (got ${stars} in 10 min, k=${k})`);
}
// Warp speed: about 30 s of cruising, then 3 s of light speed
{
  const fx = FX.EFFECTS.warp.make(340, 280, FX.PALETTES.dark, true, 1); let fast = 0; let slow = 0;
  for (let i = 0; i < 354 * 4; i++) { fx.step(.025, i * .025); const { ctx } = recorder({ log: false }); let blue = false; const spy = new Proxy(ctx, { set: (t, key, v) => { if (key === 'strokeStyle' && v === FX.PALETTES.dark.warp) blue = true; t[key] = v; return true; } }); fx.draw(spy, 0); if (blue) fast++; else slow++; }
  const fastS = fast * .025; assert.ok(fastS > 3 && fastS < 6.5, `warp: about 3 s fast a cycle (+ speeding up / slowing down), got ${fastS.toFixed(1)} s`);
}

// ---- Fish: still drawn in a handful of fills however many fish there are (fins + bodies for each of 3 colours, then the eyes)
{
  const fx = FX.EFFECTS.fish.make(900, 700, FX.PALETTES.dark, true, 9); const r = recorder();
  for (let i = 0; i < 30; i++) fx.step(1 / 30, i / 30);
  fx.draw(r.ctx, 1);
  assert.ok(r.fills() <= 7, `Fish uses at most 7 fills a frame (got ${r.fills()})`);
}

// ---- the pointer: bubbles pop, rain splashes, Ghost ripple's dots part (1.1.21)
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

// ---- Analog monitor: only the ink colour (no colour-split bands); the lines part round the pointer and one slow scan line
// sweeps, as often as Frequency says (1.1.22 – 1.1.23)
{
  const fx = FX.EFFECTS.glitch.make(340, 280, FX.PALETTES.dark, true, 3.6); const { ctx } = recorder(); const used = new Set();
  const spy = new Proxy(ctx, { set: (t, k, v) => { if (k === 'fillStyle' && typeof v === 'string') used.add(v); t[k] = v; return true; } });
  for (let i = 0; i < 300; i++) { fx.step(1 / 30, i / 30); fx.draw(spy, i / 30); }
  assert.deepEqual([...used], [FX.PALETTES.dark.scan], 'only scanlines and the rolling bar');
}
{
  // seventh round: the pointer opens a gap in the lines where it is (also at rest) and it closes when it leaves; no springs
  const src = FX.EFFECTS.glitch.make.toString();
  assert.ok(!/fringe|blobs|RED|CYAN|Float32Array/.test(src), 'analog monitor: no blobs, fringe or springy lines');
  // the y of every drawn line near x = 170 (straight lines are rect(), bent ones line segments)
  const linesAt = (e, X) => {
    const ys = []; let last = null;
    const spy = new Proxy({}, { get: (t, k) => (k === 'rect' ? (x, y, w2) => { if (x <= X && x + w2 >= X) ys.push(y); } : k === 'moveTo' ? (x, y) => { last = [x, y]; } : k === 'lineTo' ? (x, y) => { if (last && last[0] <= X && x >= X) ys.push(last[1] + (y - last[1]) * ((X - last[0]) / ((x - last[0]) || 1)) - .5); last = [x, y]; } : k in t ? t[k] : (String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    e.draw(spy, 0); return ys.sort((p1, p2) => p1 - p2);
  };
  const gapAround = (ys, y) => { const above = ys.filter((v) => v < y).pop(); const below = ys.find((v) => v >= y); return below - above; };
  const e = FX.EFFECTS.glitch.make(340, 280, PAL(true), true, .0001); // the scan line stays away
  for (let i = 0; i < 30; i++) e.step(1 / 30, i / 30, null);
  const calm = gapAround(linesAt(e, 170), 140);
  for (let i = 0; i < 30; i++) e.step(1 / 30, 1 + i / 30, ptr(170, 140)); // the pointer rests there
  const open = gapAround(linesAt(e, 170), 140); const far = gapAround(linesAt(e, 20), 140);
  assert.ok(calm <= 6.01, `lines every 6 px (${calm.toFixed(1)})`);
  assert.ok(open >= 20, `a resting pointer opens a gap (${open.toFixed(1)} px between the lines round it)`);
  assert.ok(far <= 6.6, `far to the side the lines stay as they are (${far.toFixed(1)})`);
  for (let i = 0; i < 15; i++) e.step(1 / 30, 2 + i / 30, null);
  assert.ok(gapAround(linesAt(e, 170), 140) <= 6.01, 'and it closes again within half a second of leaving');
  // the lines crawl slowly (3 px a second)
  const y0 = linesAt(e, 300)[2]; e.step(1, 4, null); const y1 = linesAt(e, 300).find((v) => v > y0 - .01);
  assert.ok(Math.abs((y1 - y0) - 3) < .2, `lines crawl 3 px/s (${(y1 - y0).toFixed(2)})`);
}
{
  // ONE scan line, slow (8 s to cross), and Frequency = how often it comes
  const sweeps = (k) => {
    const e = FX.EFFECTS.glitch.make(340, 280, PAL(true), true, k); let n = 0; let was = false; let most = 0; let g = 0;
    const spy = new Proxy({}, { get: (t, key) => (key === 'createLinearGradient' ? () => { g++; return { addColorStop() {} }; } : key in t ? t[key] : () => {}), set: (t, key, v) => { t[key] = v; return true; } });
    for (let i = 0; i < 2 * 300; i++) { e.step(.5, i * .5, null); g = 0; e.draw(spy, i * .5); most = Math.max(most, g); if (g && !was) n++; was = g > 0; }
    return { n, most };
  };
  const rarely = sweeps(.18); const normal = sweeps(1); const often = sweeps(3.6);
  assert.equal(Math.max(rarely.most, normal.most, often.most), 1, 'only one scan line at a time');
  assert.ok(rarely.n >= 3 && rarely.n <= 6, `rarely: about every 75 s (${rarely.n} in 5 min)`);
  assert.ok(normal.n >= 10 && normal.n <= 15, `normal: about every 24 s (${normal.n} in 5 min)`);
  assert.ok(often.n >= 20 && often.n <= 28, `often: about every 12 s (${often.n} in 5 min)`);
}

// ---- Healing aura: no rings at the bottom; Cauldron (mouse interacts): a soft dip, no whirlpool or wave
assert.ok(!/ellipse/.test(FX.EFFECTS.heal.make.toString()), 'healing aura: no rings at the bottom');
{
  // Cauldron (mouse interacts): a soft dip under the pointer, no quick sideways wave and no swirl
  const src = FX.EFFECTS.cauldron.make.toString();
  assert.ok(!/ellipse|stir\.ph|stir\.dir/.test(src), 'cauldron: no whirlpool, no wave');
}

// ---- Ghost jellyfish (1.1.22)
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

// Fel fire (background): the flames stay low (up to the lower middle at most)
{
  const e = FX.EFFECTS.fel.make(340, 280, PAL(true), true, 1); const { ctx, calls } = recorder();
  for (let i = 0; i < 30 * 20; i++) { e.step(1 / 30, i / 30, null); if (i % 15 === 0) e.draw(ctx, i / 30); }
  const ys = calls.filter(([n, a]) => n === 'arc' && !(a[0] === 0 && a[1] === 0)).map(([, a]) => a[1]);
  assert.ok(ys.length > 100 && Math.min(...ys) > 280 * .4, `flames below the middle (highest at ${Math.min(...ys).toFixed(0)} of 280)`);
}

// ---- Warp speed: hyperdrive while the pointer is in the middle (a box 24 % of the note round the centre), cruising outside
{
  const src = FX.EFFECTS.warp.make.toString();
  assert.ok(!/sf\.vp\.x \+=/.test(src), 'warp: the pointer no longer steers where the stars come from');
  const blueAt = (e, t) => { let blue = false; const spy = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (o, k, v) => { if (k === 'strokeStyle' && v === FX.PALETTES.dark.warp) blue = true; o[k] = v; return true; } }); e.draw(spy, t); return blue; };
  let hits = 0; let tries = 0;
  for (let seed = 1; seed <= 12; seed++) {
    // a twin with no pointer at all tells when the warp's own jump (every ~35 s) would come anyway
    let undo = seeded(seed); const twin = FX.EFFECTS.warp.make(340, 280, PAL(true), true, 1); undo();
    let own = false; for (let i = 0; i < 140; i++) { twin.step(.05, i * .05, null); if (blueAt(twin, i * .05)) own = true; }
    if (own) continue; tries++; // its own jump would get in the way of the check
    undo = seeded(seed); const e = FX.EFFECTS.warp.make(340, 280, PAL(true), true, 1); undo();
    for (let i = 0; i < 40; i++) e.step(.05, i * .05, null);
    for (let i = 0; i < 30; i++) e.step(.05, 2 + i * .05, ptr(170, 140)); // 1.5 s in the middle
    const inMid = blueAt(e, 4);
    for (let i = 0; i < 60; i++) e.step(.05, 4 + i * .05, ptr(20, 20)); // then 3 s near a corner
    if (inMid && !blueAt(e, 7)) hits++;
  }
  assert.ok(tries >= 3 && hits === tries, `warp: hyperdrive while the pointer is in the middle, back to cruising outside it (${hits}/${tries})`);
}
assert.ok(/const BOX = \.12;/.test(FX.EFFECTS.warp.make.toString()), 'warp: the smaller middle (the owner’s tenth round)');

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
console.log('ok');
