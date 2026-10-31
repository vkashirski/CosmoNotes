'use strict';
/*
 * Split into src/fx/*.js in 1.1.24 (the code itself did not change). The parts load in this order (note.html,
 * list.html): kit, effects-classic, effects-lab, effects-magic,
 *   followers-classic, followers-lab, followers-magic, engine.
 * They share names through window.COSMO_FX_KIT (made here); engine.js puts the finished API on window.COSMO_FX.
 * Map of the parts: ai-context/effects.md.
 *
 * CosmoNotes – note effects (1.1.16; 22 more backgrounds in 1.1.18, picked by the owner in the Effect Lab): little
 * particle effects that play behind a note's writing, and mouse
 * followers that trail the pointer. Used by note.js (the note window) and list.js (the cards in the list).
 *
 * Kept light on purpose: a handful of shapes per effect, drawn at most 30 times a second, by ONE shared loop
 * that sleeps when nothing needs drawing (no effect, paused, rolled up, hidden, or a follower with a still mouse).
 *
 * window.COSMO_FX = { EFFECTS, FOLLOWERS, EFFECT_IDS, FOLLOWER_IDS, resolve, Layer, ICONS }
 *   EFFECTS / FOLLOWERS: id → { name, make(w, h, P, dark, k) }   (k = size factor: 1 for a normal note)
 *   resolve(noteFx, settings) → { effect, follower, effectAmount, followerAmount, effectOpacity, followerOpacity, interact, paused }
 *   An effect's step(dt, t, m) gets the pointer m = { x, y, vx, vy, sp } (1.1.21, "Mouse plays with the background", called "Mouse can interact with the background" since 1.1.22) or null.
 *   Layer(canvas) → one canvas showing one effect and/or one follower
 *   ICONS: little pictures for the pickers (ICONS.effect[id], ICONS.follower[id], ICONS.none, ICONS.all), with a colour each
 * The ids are also listed in store.js (FX_EFFECTS, FX_FOLLOWERS): keep both lists the same.
 */
(() => {
  // ---------------------------------------------------------------- colours (light papers / dark papers)
  const LIGHT = {
    snow: '#7F97B0', gold: '#D49A00', glow: '#E8A400', blue: '#4F86C6', bubble: '#5B87B5', rain: '#5F7FA2',
    pink: '#E0608E', petal: '#EE88AE', heart: '#E5484D', ink: '#5C4D35',
    fire: ['#E5484D', '#E08A00', '#3A8DDE', '#8E5BD8', '#2FA36B'], willow: '#C98A00', crackle: '#8C7A55',
    leaf: ['#D9622B', '#C9452E', '#D99A10', '#B5651D'],
    confetti: ['#E5484D', '#F0A020', '#3A8DDE', '#8E5BD8', '#2FA36B', '#E0608E'],
    code: '#0B7A33', codeDim: '#3E8F5A', codeHead: '#04361A', // Matrix on light paper: deep green, near-black head
    // 1.1.18 (the Effect Lab picks)
    tide: '#1E6FC0', tideHi: '#0A3F7A',
    star: '#38446A', warp: '#3A6FD8', net: '#4A5D80', netNode: '#33456A', ember: ['#B3261E', '#D2560A', '#C27C00'], fireGlow: '#E0700A',
    blossom: ['#EE88AE', '#F29BBB', '#E2709C', '#F5B3CB'], skyStar: '#38446A', shoot: '#3A6FD8',
    scan: '#3A3A48', 
    wave: '#2C63B8', waveHi: '#0E3A80', silk: ['#8E5BD8', '#3A8DDE', '#D9622B'], shardS: 72, shardL: 55, shardEdge: '#5A6A95', shardGlint: '#FFFFFF',
    ripple: '#3A6FD8', rippleHi: '#0E3A80',
    fishEye: '#0F2340', // 1.1.19
    fish: ['#2A7FD0', '#1F9A8A', '#4F6FD0'], sun: '#E08A00', planet: ['#3A8DDE', '#C9452E', '#2FA36B', '#8E5BD8'], orbit: '#5A6A95',
    dust: '#8A6A30', shaft: '#FFFFFF',
    // 1.1.18, third round (Spell Lab picks)
    heal: ['#1F9A50', '#C28A00'], healHi: '#1F7A40', lightning: '#3A5FD0', lightningHi: '#1E3A9C',
    brew: ['#0E8A86', '#4E9A06', '#7A4FC8'], brewHi: '#FFFFFF', steam: '#7A8A8A', sea: ['#0E8A86', '#2F6FB0'], fel: ['#3F8A00', '#5FA800'], felHi: '#1F5A00',
  };
  const DARK = {
    snow: '#FFFFFF', gold: '#FFD86B', glow: '#FFE27A', blue: '#9FC4FF', bubble: '#A9CBFF', rain: '#A9C4E4',
    pink: '#FF9EC4', petal: '#FFB3CC', heart: '#FF7A90', ink: '#E4E8F2',
    fire: ['#FF8A8A', '#FFC46B', '#8EC8FF', '#C9A4FF', '#7FE0AE'], willow: '#FFD27A', crackle: '#FFFFFF',
    leaf: ['#FF9A5C', '#FF7A5C', '#FFD15C', '#E89A55'],
    confetti: ['#FF8A8A', '#FFC46B', '#8EC8FF', '#C9A4FF', '#7FE0AE', '#FF9EC4'],
    code: '#00FF41', codeDim: '#00B82E', codeHead: '#D8FFE2', // Matrix on dark paper: the film's phosphor green
    // 1.1.18 (the Effect Lab picks)
    tide: '#4FC2FF', tideHi: '#E0F6FF',
    star: '#FFFFFF', warp: '#9CC4FF', net: '#AFC3F0', netNode: '#E1E9FF', ember: ['#FF4A2E', '#FF8F2A', '#FFD45C'], fireGlow: '#FF6A1E',
    blossom: ['#FFB3CC', '#FFC4D8', '#FF9EBE', '#FFD6E4'], skyStar: '#FFFFFF', shoot: '#CFE4FF',
    scan: '#E8ECF8', 
    wave: '#7FB8FF', waveHi: '#E4F2FF', silk: ['#C9A4FF', '#7FC8FF', '#FFB36B'], shardS: 90, shardL: 72, shardEdge: '#E4ECFF', shardGlint: '#FFFFFF',
    ripple: '#7FB8FF', rippleHi: '#E4F2FF',
    fishEye: '#0B1530', // 1.1.19
    fish: ['#6FC0FF', '#5FE3D0', '#9FA8FF'], sun: '#FFD36B', planet: ['#7FC8FF', '#FF8A6B', '#7FE0AE', '#C9A4FF'], orbit: '#9FB4E8',
    dust: '#FFE7B0', shaft: '#FFF2CC',
    // 1.1.18, third round (Spell Lab picks)
    heal: ['#7FE0AE', '#FFE08A'], healHi: '#E8FFF2', lightning: '#9FC0FF', lightningHi: '#F2F7FF',
    brew: ['#5FF2D6', '#B8FF5C', '#C9A4FF'], brewHi: '#FFFFFF', steam: '#E6F0EE', sea: ['#7FFFE0', '#7FB8FF'], fel: ['#4FD020', '#9DFF4A'], felHi: '#EAFFD0',
  };

  // ---------------------------------------------------------------- tiny helpers
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const TAU = Math.PI * 2;
  const RAINBOW_HUES = [0, 28, 52, 120, 200, 238, 275]; // outside → inside: red, orange, yellow, green, blue, indigo, violet
  const count = (n, k) => Math.max(2, Math.round(n * k)); // fewer shapes on small cards, more on big notes
  function star4(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * .55);
    c.bezierCurveTo(x - s * 1.1, y - s * .15, x - s * .55, y - s * .95, x, y - s * .35);
    c.bezierCurveTo(x + s * .55, y - s * .95, x + s * 1.1, y - s * .15, x, y + s * .55); c.fill();
  }
  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, TAU); c.fill(); }
  // 1.1.23 (speed): a soft round glow is made once per colour as a little picture and then just stamped, instead of
  // building a new gradient (and reading its colours again) for every glowing particle in every frame. Same look.
  const SPR = 128; const sprites = new Map();
  function glowSprite(stops) { // stops: [[offset, colour], …] from the middle to the edge
    const key = stops.map((s2) => s2.join(':')).join('|'); let cv = sprites.get(key);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = SPR; cv.height = SPR; const x = cv.getContext('2d');
      if (!x || typeof x.createRadialGradient !== 'function') return cv; // (a stand-in canvas in the tests)
      const g = x.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2); for (const [o, col] of stops) g.addColorStop(o, col);
      x.fillStyle = g; x.beginPath(); x.arc(SPR / 2, SPR / 2, SPR / 2, 0, TAU); x.fill();
      if (sprites.size > 300) sprites.clear(); sprites.set(key, cv);
    }
    return cv;
  }
  const halo = (col) => glowSprite([[0, col], [.35, col], [1, 'transparent']]); // a glow with a solid middle
  const soft = (col) => glowSprite([[0, col], [1, 'transparent']]); // a glow that fades from the very middle
  const stamp = (c, spr, x, y, r) => { if (r > 0) c.drawImage(spr, x - r, y - r, r * 2, r * 2); };
  function glowDot(c, x, y, r, col, a) {
    c.globalAlpha = a * .35; stamp(c, halo(col), x, y, r * 3);
    c.globalAlpha = a; c.fillStyle = col; dot(c, x, y, r * .55);
  }
  function flake(c, x, y, s, rot) {
    c.beginPath();
    for (let i = 0; i < 3; i++) { const a = rot + i * Math.PI / 3; c.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
    c.stroke();
  }
  function leaf(c, s) { c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * .75, 0, 0, s); c.quadraticCurveTo(-s * .75, 0, 0, -s); c.fill(); }
  // fires every a–b seconds (sooner on bigger notes)
  const every = (a, b, k = 1) => { const f = Math.min(4, Math.max(.2, k)); let t = R(0, a / f); return (dt) => { t -= dt; if (t <= 0) { t = R(a / f, b / f); return true; } return false; }; };
  const cull = (arr, dt) => { for (let i = arr.length - 1; i >= 0; i--) { arr[i].age += dt; if (arr[i].age > arr[i].life) arr.splice(i, 1); } };
  // followers spawn by distance moved, so a still mouse makes nothing
  const spacer = (gap) => { let acc = 0; return (d) => { acc += d; let n = 0; while (acc >= gap) { acc -= gap; n++; } return Math.min(n, 8); }; };

  // ---- 1.1.18 helpers (for the effects picked in the Effect Lab)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const capped = (n, k, max) => Math.min(max, count(n, k)); // never more than `max` shapes, however big the note or "Often"
  // a soft halo in one colour and a small bright core in another
  function glow2(c, x, y, r, haloCol, core, a, haloK = .35) {
    a = clamp(a, 0, 1); if (a <= .01) return;
    c.globalAlpha = a * haloK; stamp(c, halo(haloCol), x, y, r * 3);
    c.globalAlpha = a; c.fillStyle = core; dot(c, x, y, r * .55);
  }
  // a smooth, slowly changing "wind direction" at x, y (a cheap stand-in for a noise field)
  const flow = (x, y, t, s = .011) => Math.sin(x * s + t * .31) * 1.7 + Math.cos(y * s * 1.27 - t * .23) * 1.7 + Math.sin((x - y) * s * .61 + t * .19) * 1.3;
  function wrap(q, w, h, m) { if (q.x < -m) q.x += w + 2 * m; else if (q.x > w + m) q.x -= w + 2 * m; if (q.y < -m) q.y += h + 2 * m; else if (q.y > h + m) q.y -= h + 2 * m; }
  const hsla = (hu, s, l, a) => `hsla(${hu % 360}, ${s}%, ${l}%, ${a})`;
  // many lines / dots in one go: [x1, y1, x2, y2, …] → one stroke; [[x, y, r, a], …] → a few fills grouped by strength
  function strokeSegs(c, s) { if (!s.length) return; c.beginPath(); for (let i = 0; i < s.length; i += 4) { c.moveTo(s[i], s[i + 1]); c.lineTo(s[i + 2], s[i + 3]); } c.stroke(); }
  function bucketDots(c, items, col, B, maxA) {
    const groups = Array.from({ length: B }, () => []);
    for (const it of items) groups[Math.min(B - 1, Math.floor(clamp(it[3], 0, .999) * B))].push(it);
    c.fillStyle = col;
    groups.forEach((g, i) => { if (!g.length) return; c.globalAlpha = (i + .5) / B * maxA; c.beginPath(); for (const [x, y, r] of g) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } c.fill(); });
  }
  // 1.1.22: like bucketDots, but everything is also dimmed by one smooth `fade` (0…1), so a fade can run all the way to
  // nothing (bucketDots keeps its faintest group at about 12 %, so something fading through it vanished with a jump)
  function bucketFade(c, items, col, B, maxA, fade) {
    if (fade <= .003) return;
    const groups = Array.from({ length: B }, () => []);
    for (const it of items) groups[Math.min(B - 1, Math.floor(clamp(it[3], 0, .999) * B))].push(it);
    c.fillStyle = col;
    groups.forEach((g, i) => { if (!g.length) return; c.globalAlpha = (i + .5) / B * maxA * fade; c.beginPath(); for (const [x, y, r] of g) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } c.fill(); });
  }
  // 1.1.20 (mouse followers): [[x1, y1, x2, y2, a], …] → a few strokes grouped by strength
  function bucketSegs(c, items, col, B, maxA) {
    const groups = Array.from({ length: B }, () => []);
    for (const it of items) groups[Math.min(B - 1, Math.floor(clamp(it[4], 0, .999) * B))].push(it);
    c.strokeStyle = col;
    groups.forEach((g, i) => { if (!g.length) return; c.globalAlpha = (i + .5) / B * maxA; c.beginPath(); for (const [x1, y1, x2, y2] of g) { c.moveTo(x1, y1); c.lineTo(x2, y2); } c.stroke(); });
  }
  // a companion follower (fish, planets, jellyfish…) shows while the mouse moves and fades away `hold` seconds after
  // it stops; moved() says whether it was gone (so it can come back in next to the pointer)
  function presence(hold = 2.5) {
    let still = 1e9; let vis = 0;
    return {
      moved() { const gone = vis < .02; still = 0; return gone; },
      step(dt) { still += dt; vis = clamp(vis + (still < hold ? 1 : -1) * dt * 2.2, 0, 1); },
      get vis() { return vis; },
      busy: () => still < hold || vis > 0,
    };
  }
  // 1.1.21: "Mouse plays with the background". An effect's step gets m = { x, y, vx, vy, sp } (where the pointer is,
  // how fast it's going, px/s) while the mouse is over the note and the toggle is on, otherwise null.
  // near(q, m, r): 0 far away … 1 right at the pointer
  const near = (q, m, r) => { const dx = q.x - m.x; const dy = q.y - m.y; if (dx > r || dx < -r || dy > r || dy < -r) return 0; const d = Math.hypot(dx, dy); return d < r ? 1 - d / r : 0; };
  // shove(q, m, r, f, dt): pushes q's speed away from the pointer (closer = harder) and along the way it's moving
  function shove(q, m, r, f, dt, carry = .6) {
    const u = near(q, m, r); if (!u) return 0;
    const dx = q.x - m.x; const dy = q.y - m.y; const d = Math.hypot(dx, dy) || 1; const p = u * u * f * dt;
    q.vx += dx / d * p + m.vx * u * carry * dt; q.vy += dy / d * p + m.vy * u * carry * dt; return u;
  }
  // nudge(q, m, r, f, dt): the same for something without its own speed: moves q itself
  function nudge(q, m, r, f, dt, carry = .5) {
    const u = near(q, m, r); if (!u) return 0;
    const dx = q.x - m.x; const dy = q.y - m.y; const d = Math.hypot(dx, dy) || 1; const p = u * u * f * dt;
    q.x += dx / d * p + m.vx * u * carry * dt; q.y += dy / d * p + m.vy * u * carry * dt; return u;
  }
  // a field of stars flying out of a vanishing point (Warp speed)
  function starfield(w, h, N) {
    const FOV = .32;
    const spawn = (q, z) => { q.x = R(-w, w); q.y = R(-h, h); q.z = z; };
    const s = Array.from({ length: N }, () => { const q = {}; spawn(q, R(.05, 1)); return q; });
    const vp = { x: w / 2, y: h / 2 };
    const proj = (q, z) => [vp.x + q.x * FOV / z, vp.y + q.y * FOV / z];
    return {
      vp,
      move(dt, speed) {
        for (const q of s) {
          q.z -= speed * dt; if (q.z < .03) { spawn(q, R(.85, 1)); continue; }
          const [x, y] = proj(q, q.z); if (x < -30 || x > w + 30 || y < -30 || y > h + 30) spawn(q, R(.85, 1));
        }
      },
      draw(c, col, speed, len, widthK = 1) {
        c.strokeStyle = col; c.lineCap = 'round';
        for (const q of s) {
          const b = clamp((1 - q.z) * 1.3, 0, 1); if (b < .03) continue;
          const [x, y] = proj(q, q.z); const [x0, y0] = proj(q, Math.min(1.2, q.z + speed * len));
          c.globalAlpha = b * .9; c.lineWidth = (.5 + (1 - q.z) * 1.7) * widthK;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x + .01, y); c.stroke();
        }
      },
    };
  }
  // cherry blossom petals
  function petal(c, s) {
    c.beginPath(); c.moveTo(0, s);
    c.bezierCurveTo(s * .95, s * .45, s * .8, -s * .75, s * .2, -s * .85); c.lineTo(0, -s * .5); c.lineTo(-s * .2, -s * .85);
    c.bezierCurveTo(-s * .8, -s * .75, -s * .95, s * .45, 0, s); c.fill();
  }
  // glass shards: a few corners around the middle, drawn turning in 3D
  function shard(S) { const n = Math.round(R(3, 5)); const r = R(6, 14) * S; const a0 = R(0, TAU); return Array.from({ length: n }, (_, i) => { const a = a0 + i * TAU / n + R(-.4, .4); const rr = r * R(.55, 1); return [Math.cos(a) * rr, Math.sin(a) * rr]; }); }
  // the three flocking rules (stay apart, match heading, stay together) plus a soft push away from the edges
  function flockStep(b, dt, o) {
    const { w, h, see, apart, cohere, align, sep, minS, maxS, edge, extra } = o;
    for (const q of b) {
      let n = 0; let ax = 0; let ay = 0; let cx = 0; let cy = 0; let sx = 0; let sy = 0;
      for (const r of b) {
        if (r === q) continue; const dx = r.x - q.x; const dy = r.y - q.y; if (dx > see || dx < -see || dy > see || dy < -see) continue;
        const d2 = dx * dx + dy * dy; if (d2 > see * see) continue; n++; ax += r.vx; ay += r.vy; cx += r.x; cy += r.y;
        if (d2 < apart * apart) { const d = Math.sqrt(d2) || 1; sx -= dx / d * (apart - d); sy -= dy / d * (apart - d); }
      }
      let fx = sx * sep; let fy = sy * sep;
      if (n) { fx += (ax / n - q.vx) * align + (cx / n - q.x) * cohere; fy += (ay / n - q.vy) * align + (cy / n - q.y) * cohere; }
      if (q.x < edge) fx += (edge - q.x) * 3; if (q.x > w - edge) fx -= (q.x - w + edge) * 3; if (q.y < edge) fy += (edge - q.y) * 3; if (q.y > h - edge) fy -= (q.y - h + edge) * 3;
      if (extra) { const [ex, ey] = extra(q); fx += ex; fy += ey; }
      q.nvx = q.vx + fx * dt; q.nvy = q.vy + fy * dt;
    }
    for (const q of b) {
      q.vx = q.nvx; q.vy = q.nvy; const s = Math.hypot(q.vx, q.vy) || 1; const c = clamp(s, minS, maxS); q.vx *= c / s; q.vy *= c / s;
      q.x += q.vx * dt; q.y += q.vy * dt; q.x = clamp(q.x, -20, w + 20); q.y = clamp(q.y, -20, h + 20);
    }
  }
  // a jagged line from x0, y0 to x1, y1 (midpoint displacement) as segments for strokeSegs (Lightning)
  function zig(x0, y0, x1, y1, rough, depth, out) { if (depth === 0) { out.push(x0, y0, x1, y1); return; } const mx = (x0 + x1) / 2 + R(-rough, rough); const my = (y0 + y1) / 2 + R(-rough, rough) * .4; zig(x0, y0, mx, my, rough / 2, depth - 1, out); zig(mx, my, x1, y1, rough / 2, depth - 1, out); }
  // an even field of dots (Ghost ripple)
  function dotLattice(w, h, sp) { const d = []; let row = 0; for (let y = sp / 2; y < h + sp; y += sp * .87, row++) for (let x = (row % 2 ? sp / 2 : 0); x < w + sp; x += sp) d.push({ bx: x, by: y, x, y, vx: 0, vy: 0, b: 0 }); return d; }

  // 1.1.19 Fish, drawn along a short bending spine (shared with the Fish mouse follower since 1.1.20). A fish q has
  // sp (FISH_NS + 1 spine points), sw (swim phase), BL (body length) and ph
  const FISH_NS = 4;
  // half the body's width along it (u: 0 at the nose, 1 where the tail starts): round head, slim towards the tail
  const fishHw = (u, BL) => BL * .19 * (u < .3 ? .7 + .3 * Math.sin(u / .3 * Math.PI / 2) : 1 - .8 * Math.pow((u - .3) / .7, 1.1));
  // the spine with the swimming wave on it: [x, y, forward x, forward y, u]
  const fishSpine = (q) => { const NS = FISH_NS;
    const pts = [];
    for (let j = 0; j <= NS; j++) {
      const p = q.sp[j]; const a = q.sp[Math.max(0, j - 1)]; const z = q.sp[Math.min(NS, j + 1)];
      let tx = a.x - z.x; let ty = a.y - z.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const u = j / NS; const o = Math.sin(q.sw - u * 2.4) * q.BL * .07 * u * u;
      pts.push([p.x - ty * o, p.y + tx * o, tx, ty, u]);
    }
    return pts;
  };
  // the body: one smooth closed outline (nose, down one side, the tail end, back up the other side)
  function fishBody(c, q, pts) { const NS = FISH_NS;
    const n = pts[0]; const s0 = fishHw(0, q.BL); const ring = [[n[0] + n[2] * s0 * 1.25, n[1] + n[3] * s0 * 1.25]];
    for (const p of pts) { const s = fishHw(p[4], q.BL); ring.push([p[0] - p[3] * s, p[1] + p[2] * s]); }
    const e = pts[NS]; ring.push([e[0] - e[2] * q.BL * .04, e[1] - e[3] * q.BL * .04]);
    for (let j = NS; j >= 0; j--) { const p = pts[j]; const s = fishHw(p[4], q.BL); ring.push([p[0] + p[3] * s, p[1] - p[2] * s]); }
    const m = ring.length; const mid = (i) => { const a = ring[i % m]; const z = ring[(i + 1) % m]; return [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2]; };
    const st = mid(m - 1); c.moveTo(st[0], st[1]);
    for (let i = 0; i < m; i++) { const z = mid(i); c.quadraticCurveTo(ring[i][0], ring[i][1], z[0], z[1]); }
    c.closePath();
  }
  // the fins: a forked tail that swings a beat behind the body (its tips lag a little more), and two side fins
  function fishFins(c, q, pts) { const NS = FISH_NS;
    const e = pts[NS]; const wag = Math.sin(q.sw - 3.3) * .5; const ca = Math.cos(wag); const sa = Math.sin(wag);
    const bx = -(e[2] * ca - e[3] * sa); const by = -(e[2] * sa + e[3] * ca); const nx = -by; const ny = bx; const TL = q.BL * .42;
    const curl = Math.sin(q.sw - 4.2) * .16;
    const Pt = (a, s) => [e[0] + bx * a * TL + nx * s * TL, e[1] + by * a * TL + ny * s * TL];
    const p0 = Pt(-.12, -.13); const c1 = Pt(.35, -.22); const t1 = Pt(1, -.6 + curl); const c2 = Pt(.62, -.16); const nt = Pt(.52, curl * .5); const c3 = Pt(.62, .16); const t2 = Pt(1, .6 + curl); const c4 = Pt(.35, .22); const p1 = Pt(-.12, .13);
    c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(c1[0], c1[1], t1[0], t1[1]); c.quadraticCurveTo(c2[0], c2[1], nt[0], nt[1]);
    c.quadraticCurveTo(c3[0], c3[1], t2[0], t2[1]); c.quadraticCurveTo(c4[0], c4[1], p1[0], p1[1]); c.closePath();
    const p = pts[1]; const s = fishHw(p[4], q.BL); const L = q.BL;
    for (const side of [-1, 1]) {
      const fl = 1 + .35 * Math.sin(q.sw * .6 + q.ph + side * 1.4);
      const B = [p[0] - p[3] * side * s * .7, p[1] + p[2] * side * s * .7];
      const tip = [B[0] - p[2] * L * .2 - p[3] * side * L * .14 * fl, B[1] - p[3] * L * .2 + p[2] * side * L * .14 * fl];
      c.moveTo(B[0], B[1]); c.quadraticCurveTo(B[0] - p[3] * side * L * .13 * fl, B[1] + p[2] * side * L * .13 * fl, tip[0], tip[1]);
      c.quadraticCurveTo(B[0] - p[2] * L * .12, B[1] - p[3] * L * .12, B[0] - p[2] * L * .1, B[1] - p[3] * L * .1); c.closePath();
    }
  }

  // the spine follows the head (q.x, q.y), and the tail beats faster when it swims faster
  function fishBend(q, dt, S) {
    const p0 = q.sp[0]; p0.x = q.x; p0.y = q.y; const sl = q.BL / FISH_NS;
    for (let j = 1; j <= FISH_NS; j++) { const p = q.sp[j]; const r = q.sp[j - 1]; const dx = p.x - r.x; const dy = p.y - r.y; const d = Math.hypot(dx, dy) || 1; p.x = r.x + dx / d * sl; p.y = r.y + dy / d * sl; }
    q.sw += dt * (7 + Math.hypot(q.vx, q.vy) / S * .12);
  }
  // a new fish heading at angle a (g = which of the three colours)
  function fishNew(x, y, a, BL, g) { return { x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, g, ph: R(0, TAU), BL, sw: R(0, TAU), sp: Array.from({ length: FISH_NS + 1 }, (_, j) => ({ x: x - Math.cos(a) * j * BL / FISH_NS, y: y - Math.sin(a) * j * BL / FISH_NS })) }; }
  // draws a list of fish: one fill per colour for the fins, one for the bodies, then a sheen and the eyes (7 fills)
  function fishDraw(c, b, P, dark, S) {
    const all = b.map((q) => [q, fishSpine(q)]);
    // one fill per colour for the fins, one for the bodies: cheap however many fish there are
    for (let g = 0; g < 3; g++) {
      c.fillStyle = P.fish[g];
      c.globalAlpha = dark ? .6 : .55; c.beginPath(); for (const [q, pts] of all) if (q.g === g) fishFins(c, q, pts); c.fill();
      c.globalAlpha = .9; c.beginPath(); for (const [q, pts] of all) if (q.g === g) fishBody(c, q, pts); c.fill();
    }
    // a soft sheen along each back, and two tiny eyes
    c.strokeStyle = '#FFFFFF'; c.lineCap = 'round'; c.lineWidth = Math.max(.6, 1.1 * S); c.globalAlpha = dark ? .3 : .38; c.beginPath();
    for (const [, pts] of all) { const a = pts[0]; const m = pts[1]; const z = pts[2]; c.moveTo(a[0] + a[2] * 1.2, a[1] + a[3] * 1.2); c.quadraticCurveTo(m[0], m[1], z[0], z[1]); }
    c.stroke();
    c.fillStyle = P.fishEye; c.globalAlpha = .65; c.beginPath();
    for (const [q, pts] of all) {
      const a = pts[0]; const s = fishHw(.08, q.BL) * .58; const r = Math.max(.45, .55 * S); const x = a[0] + a[2] * q.BL * .02; const y = a[1] + a[3] * q.BL * .02;
      for (const side of [-1, 1]) { const ex = x - a[3] * s * side; const ey = y + a[2] * s * side; c.moveTo(ex + r, ey); c.arc(ex, ey, r, 0, TAU); }
    }
    c.fill();
  }

  // ---------------------------------------------------------------- Matrix: the film's digital rain
  // Half-width katakana, numbers and a few symbols, drawn mirrored like in the film. The film's own font can't be
  // shipped with the app (free for personal use only), so this uses Windows' Japanese fonts (MS Gothic etc.),
  // which have the same characters; if "Matrix Code NFI" is installed on the computer, it's used first.
  const KANA = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
  const GLYPHS = (KANA + KANA + '0123456789Z:.=*+-<>¦|"').split('');
  const CODE_FONT = '"Matrix Code NFI", "MS Gothic", "Yu Gothic UI", "Yu Gothic", "Meiryo", "Hiragino Sans", "Noto Sans JP", monospace';
  const glyph = () => pick(GLYPHS);
  // everything Matrix draws is mirrored: flip the canvas once, then x counts from the right
  function mirror(c, w, size) { c.translate(w, 0); c.scale(-1, 1); c.font = `500 ${size}px ${CODE_FONT}`; c.textAlign = 'center'; }
  // one stream: a bright head moving down a grid of cells, a fading trail behind it, characters changing now and then
  function codeCells(n) { return Array.from({ length: n }, glyph); }
  function drawStream(c, P, x, top, head, len, cells, size, alpha) {
    const hi = Math.floor(head);
    for (let j = 0; j < len; j++) {
      const r = hi - j; if (r < 0 || r >= cells.length) continue;
      const y = top + (r + 1) * size;
      if (j === 0) { c.globalAlpha = alpha; c.fillStyle = P.codeHead; c.fillText(cells[r], x, y); c.globalAlpha = alpha * .35; c.fillStyle = P.code; c.fillText(cells[r], x + .6, y + .6); }
      else { c.globalAlpha = alpha * (1 - j / len) * (j < 3 ? 1 : .85); c.fillStyle = j < 3 ? P.code : P.codeDim; c.fillText(cells[r], x, y); }
    }
  }


  // share everything above with the other parts, plus the two lists the effects-* and followers-* parts fill in
  window.COSMO_FX_KIT = { EFFECTS: {}, FOLLOWERS: {},
    DARK, LIGHT, R, RAINBOW_HUES, SPR, TAU, bucketDots, bucketFade, bucketSegs, capped, clamp, codeCells, count, cull,
    dot, dotLattice, drawStream, every, fishBend, fishDraw, fishNew, flake, flockStep, flow, glow2, glowDot,
    glowSprite, glyph, heart, hsla, leaf, mirror, near, nudge, petal, pick, presence, shard, shove, soft, spacer,
    stamp, star4, starfield, strokeSegs, wrap, zig
  };
})();
