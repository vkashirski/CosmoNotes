'use strict';
/*
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

  // ---------------------------------------------------------------- effects (the background of a note)
  // make(w, h, P, dark, k) → { step(dt, t), draw(ctx, t) }
  const EFFECTS = {
    snow: { name: 'Snow', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(26, k) }, () => ({ x: R(0, w), y: R(0, h), s: R(2.4, 4.6), vy: R(11, 21), rot: R(0, TAU), vr: R(-.7, .7), ph: R(0, TAU), sw: R(.5, 1) }));
      // 1.1.22: a flake the pointer touches shatters: its six arms break off and tumble away the way the pointer was
      // going, with a puff of powder, then fade; a new flake starts falling from the top
      const bits = [];
      const shatter = (p, x, m) => {
        for (let i = 0; i < 6; i++) {
          const a = p.rot + i * Math.PI / 3; const v = R(18, 45);
          if (bits.length < 140) bits.push({ x: x + Math.cos(a) * p.s * .5, y: p.y + Math.sin(a) * p.s * .5, vx: Math.cos(a) * v + m.vx * R(.15, .3), vy: Math.sin(a) * v + m.vy * R(.15, .3) - 8, a, va: R(-6, 6), len: p.s * R(.45, .7), age: 0, life: R(.9, 1.5) });
        }
        for (let i = 0; i < 5; i++) if (bits.length < 140) bits.push({ x, y: p.y, vx: R(-25, 25) + m.vx * .2, vy: R(-25, 15) + m.vy * .2, dust: true, age: 0, life: R(.5, 1) });
        p.y = -6; p.x = R(0, w);
      };
      return {
        step(dt, t, m) {
          for (const p of f) {
            p.y += p.vy * dt; p.rot += p.vr * dt;
            if (m) { const x = p.x + Math.sin(t * p.sw + p.ph) * 8; if (Math.abs(x - m.x) < p.s + 7 && Math.abs(p.y - m.y) < p.s + 7) shatter(p, x, m); }
            if (p.y > h + 6) { p.y = -6; p.x = R(0, w); } if (p.x < -10) p.x += w + 20; else if (p.x > w + 10) p.x -= w + 20;
          }
          const dr = Math.pow(.35, dt); for (const b of bits) { b.vx *= dr; b.vy = b.vy * dr + 30 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (!b.dust) b.a += b.va * dt; } cull(bits, dt);
        },
        draw(c, t) {
          c.strokeStyle = P.snow; c.lineCap = 'round'; c.lineWidth = 1.1; c.globalAlpha = .75; for (const p of f) flake(c, p.x + Math.sin(t * p.sw + p.ph) * 8, p.y, p.s, p.rot);
          if (bits.length) {
            bucketSegs(c, bits.filter((b) => !b.dust).map((b) => { const dx = Math.cos(b.a) * b.len / 2; const dy = Math.sin(b.a) * b.len / 2; return [b.x - dx, b.y - dy, b.x + dx, b.y + dy, 1 - b.age / b.life]; }), P.snow, 3, .8);
            bucketDots(c, bits.filter((b) => b.dust).map((b) => [b.x, b.y, .8, 1 - b.age / b.life]), P.snow, 3, .7);
          }
        },
      };
    } },
    fireworks: { name: 'Fireworks', make(w, h, P, dark, k) {
      // 1.1.16 (second round): no perfect circles and nothing that sets off smaller bursts. Rockets lean a little and
      // slow down as they climb; every burst is uneven (each spark its own speed and a slightly bent angle), sparks
      // fall and slow in the air, and they fade slowly. Four kinds, never the same twice in a row.
      const rockets = []; const sparks = []; const go = every(.45, 1.3, k); let lastKind = null;
      const KINDS = ['peony', 'willow', 'glitter', 'palm'];
      const scale = Math.max(.6, Math.min(1.8, h / 280)); // a taller note gets bigger bursts
      const spark = (r, a, sp, o) => sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp * scale + r.vx * .3, vy: Math.sin(a) * sp * scale + r.vy * .3, age: 0, ...o });
      function burst(r) {
        const col = r.col; const col2 = pick(P.fire);
        if (r.kind === 'peony') { // uneven, full burst in one or two colours
          const n = Math.round(R(26, 36));
          for (let i = 0; i < n; i++) spark(r, i * TAU / n + R(-.25, .25), 62 * R(.18, 1), { life: R(1.6, 2.4), col: Math.random() < .25 ? col2 : col, g: 34, r: R(1.2, 1.8) });
        }
        if (r.kind === 'willow') { // gold sparks with trails that droop and hang for a long time
          const n = Math.round(R(24, 32));
          for (let i = 0; i < n; i++) spark(r, R(0, TAU), R(16, 44), { life: R(2.4, 3.3), col: P.willow, g: 22, r: 1.1, trail: true });
        }
        if (r.kind === 'glitter') { // a soft cloud of twinkling sparks
          const n = Math.round(R(30, 40));
          for (let i = 0; i < n; i++) spark(r, R(0, TAU), 50 * Math.sqrt(R(.05, 1)), { life: R(1.8, 2.6), col: Math.random() < .5 ? col : P.crackle, g: 18, r: R(.9, 1.4), twinkle: R(9, 16), ph: R(0, TAU) });
        }
        if (r.kind === 'palm') { // a few thick, uneven arms
          const arms = Math.round(R(5, 8)); const turn = R(0, TAU);
          for (let i = 0; i < arms; i++) {
            const a = turn + i * TAU / arms + R(-.35, .35); const len = R(.7, 1.05);
            for (let j = 0; j < 5; j++) spark(r, a + R(-.07, .07), 58 * len * (1 - j * .13), { life: R(1.7, 2.3), col, g: 30, r: 1.9 - j * .2, trail: j === 0 });
          }
        }
      }
      return {
        step(dt, t, m) {
          if (go(dt)) {
            const n = Math.random() < .3 ? (Math.random() < .4 ? 3 : 2) : 1;
            for (let i = 0; i < n; i++) {
              let kind = pick(KINDS); while (kind === lastKind) kind = pick(KINDS); lastKind = kind;
              const x = R(w * .15, w * .85);
              // 1.1.16: each rocket gets just the speed it needs to reach its bursting height (anywhere from near the
              // top to the middle of the note), so on a tall note they go all the way up instead of stopping low
              const y0 = h + 4 + i * 18; const top = R(h * .08, h * .55);
              const vy = -Math.sqrt(2 * 70 * scale * (y0 - top)) * R(1.04, 1.12);
              rockets.push({ x, y: y0, vx: R(-22, 22) - (x - w / 2) * .08, vy, top, col: pick(P.fire), kind, tr: [] });
            }
          }
          for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.tr.push({ x: r.x, y: r.y }); if (r.tr.length > 5) r.tr.shift();
            r.vy += 70 * scale * dt; r.x += r.vx * dt; r.y += r.vy * dt; // leans and slows as it climbs
            if (r.y <= r.top || r.vy > -12 || (m && near(r, m, 16))) { burst(r); rockets.splice(i, 1); }
          }
          const drag = Math.pow(.55, dt);
          for (let i = sparks.length - 1; i >= 0; i--) {
            const q = sparks[i]; if (m) shove(q, m, 50, 260, dt, .8); q.age += dt; q.vx *= drag; q.vy = q.vy * drag + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
            if (q.age > q.life) sparks.splice(i, 1);
          }
        },
        draw(c, t) {
          for (const r of rockets) {
            c.fillStyle = r.col;
            r.tr.forEach((p, j) => { c.globalAlpha = .1 + j * .07; dot(c, p.x, p.y, .7 + j * .12); });
            c.globalAlpha = .9; dot(c, r.x, r.y, 1.5);
          }
          for (const q of sparks) {
            const v = q.age / q.life;
            let a = Math.pow(1 - v, 1.3) * .9; // bright for a while, then a slow fade
            if (q.twinkle) a *= .55 + .45 * Math.sin(t * q.twinkle + q.ph);
            if (q.trail) { c.globalAlpha = a * .5; c.strokeStyle = q.col; c.lineWidth = 1; c.beginPath(); c.moveTo(q.x - q.vx * .16, q.y - q.vy * .16); c.lineTo(q.x, q.y); c.stroke(); }
            c.globalAlpha = a; c.fillStyle = q.col; dot(c, q.x, q.y, q.r * (1 - v * .35));
          }
        },
      };
    } },
    stardust: { name: 'Stardust', make(w, h, P, dark, k) {
      const s = Array.from({ length: count(14, k) }, () => ({ x: R(6, w - 6), y: R(6, h - 6), t: R(0, 1), sp: R(.35, .65), r: R(3, 5.5) }));
      return {
        step(dt, t, m) { for (const q of s) { q.t += q.sp * dt; if (q.t >= 1) { q.t = 0; q.x = R(6, w - 6); q.y = R(6, h - 6); } q.g = Math.max(m ? near(q, m, 70) : 0, (q.g || 0) - dt * 1.5); } },
        draw(c) {
          for (const q of s) {
            const v = Math.min(1, Math.sin(q.t * Math.PI) + (q.g || 0) * .8) * (1 + (q.g || 0) * .45); if (v <= 0) continue;
            c.globalAlpha = v * (dark ? .45 : .35); stamp(c, soft(P.gold), q.x, q.y, q.r * 2.6);
            c.globalAlpha = v * .6; c.strokeStyle = P.gold; c.lineWidth = .8; c.beginPath();
            const L = q.r * 2 * v; c.moveTo(q.x - L, q.y); c.lineTo(q.x + L, q.y); c.moveTo(q.x, q.y - L); c.lineTo(q.x, q.y + L); c.stroke();
            c.globalAlpha = Math.min(1, v * 1.15); c.fillStyle = P.gold; star4(c, q.x, q.y, q.r * v);
            if (dark) { c.fillStyle = '#FFFFFF'; c.globalAlpha = v * .8; dot(c, q.x, q.y, q.r * .18 * v); }
          }
        },
      };
    } },
    fireflies: { name: 'Fireflies', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(9, k) }, () => ({ x: R(0, w), y: R(0, h), a: R(0, TAU), sp: R(8, 15), ph: R(0, TAU) }));
      return {
        // 1.1.22: fireflies near the pointer get curious and follow it for a few seconds (hovering round it, like the
        // Fireflies mouse effect), then lose interest and wander off again for a while. Third round (the magnet was too
        // strong): only fireflies close to the pointer (70 px) get interested, the pull is gentle (they drift over instead
        // of snapping to it, weaker the further away they are) and one lets go once the pointer is over ~110 px away
        step(dt, t, m) {
          for (const q of f) {
            q.a += R(-1.6, 1.6) * dt; q.cool = Math.max(0, (q.cool || 0) - dt);
            if (m && !q.fol && !q.cool && near(q, m, 70)) { q.fol = R(1.6, 3); q.ox = R(-26, 26); q.oy = R(-20, 20); q.k = R(.5, 1.1); }
            if (q.fol && m && !near(q, m, 110)) { q.fol = 0; q.cool = R(4, 8); q.a = Math.atan2(q.y - m.y, q.x - m.x) + R(-.7, .7); } // the pointer got away: the pull doesn't reach that far
            if (q.fol && m) {
              q.fol = Math.max(0, q.fol - dt); const tx = m.x + q.ox + Math.sin(t * 2 + q.ph) * 6; const ty = m.y + q.oy + Math.cos(t * 1.7 + q.ph) * 6;
              const pull = Math.min(1, q.k * (.4 + .6 * near(q, m, 110)) * dt); const nx = q.x + (tx - q.x) * pull; const ny = q.y + (ty - q.y) * pull;
              if (Math.hypot(nx - q.x, ny - q.y) > .05) q.a = Math.atan2(ny - q.y, nx - q.x); q.x = nx; q.y = ny;
              if (!q.fol) { q.cool = R(10, 16); q.a = Math.atan2(q.y - m.y, q.x - m.x) + R(-.7, .7); } // bored: off it goes, away from the pointer
            } else {
              if (q.fol) { q.fol = 0; q.cool = R(1, 2); }
              q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt;
            }
            if (q.x < 0 || q.x > w) q.a = Math.PI - q.a; if (q.y < 0 || q.y > h) q.a = -q.a; q.x = Math.max(0, Math.min(w, q.x)); q.y = Math.max(0, Math.min(h, q.y));
          }
        },
        draw(c, t) { for (const q of f) glowDot(c, q.x, q.y, 3.4, P.glow, .45 + .45 * Math.sin(t * 1.6 + q.ph)); },
      };
    } },
    bubbles: { name: 'Bubbles', make(w, h, P, dark, k) {
      const b = []; const pops = []; const go = every(.35, .7, k);
      return {
        step(dt, t, m) {
          if (go(dt)) b.push({ x: R(8, w - 8), y: h + 8, r: R(4, 8), vy: R(18, 30), at: R(h * .1, h * .7), ph: R(0, TAU) });
          for (let i = b.length - 1; i >= 0; i--) { const q = b[i]; q.y -= q.vy * dt; if (q.y <= q.at || (m && Math.hypot(q.x - m.x, q.y - m.y) < q.r + 5)) { pops.push({ x: q.x, y: q.y, r: q.r, age: 0, life: .3 }); b.splice(i, 1); } }
          cull(pops, dt);
        },
        draw(c, t) {
          c.strokeStyle = P.bubble; c.lineWidth = 1.2; c.lineCap = 'round';
          for (const q of b) { c.globalAlpha = .65; c.beginPath(); c.arc(q.x + Math.sin(t * 2 + q.ph) * 3, q.y, q.r, 0, TAU); c.stroke(); }
          for (const p of pops) { const v = p.age / .3; c.globalAlpha = 1 - v; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const r1 = p.r * (.6 + v); const r2 = p.r * (1 + v * 1.2); c.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); c.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2); } c.stroke(); }
        },
      };
    } },
    leaves: { name: 'Autumn leaves', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(8, k) }, () => ({ x: R(0, w), y: R(0, h), vy: R(12, 20), ph: R(0, TAU), s: R(5, 7.5), col: pick(P.leaf), gx: 0, gy: 0 }));
      return {
        step(dt, t, m) { const dr = Math.pow(.25, dt); for (const q of f) { if (m) { const o = { x: q.x, y: q.y, vx: q.gx, vy: q.gy }; if (shove(o, m, 55, 220, dt, 1.2)) { q.gx = o.vx; q.gy = o.vy; q.ph += dt * 4; } } q.gx *= dr; q.gy *= dr; q.x += q.gx * dt; q.y += q.gy * dt; if (q.x < -14) q.x += w + 28; else if (q.x > w + 14) q.x -= w + 28; q.y += q.vy * dt; if (q.y > h + 10) { q.y = -10; q.x = R(0, w); q.col = pick(P.leaf); } } },
        draw(c, t) {
          for (const q of f) {
            const sw = Math.sin(t * 1.4 + q.ph); c.save(); c.translate(q.x + sw * 14, q.y); c.rotate(sw * .8);
            c.globalAlpha = .82; c.fillStyle = q.col; leaf(c, q.s);
            c.globalAlpha = .5; c.strokeStyle = q.col; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -q.s * .8); c.lineTo(0, q.s * 1.35); c.stroke(); c.restore();
          }
        },
      };
    } },
    hearts: { name: 'Hearts', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(9, k) }, () => ({ x: R(0, w), y: R(0, h), vy: R(13, 22), s: R(4, 7.5), ph: R(0, TAU) }));
      return {
        step(dt, t, m) { for (const q of f) { q.big = Math.max(m ? near(q, m, 60) : 0, (q.big || 0) - dt * 1.2); q.y -= q.vy * (1 + (q.big || 0) * 1.5) * dt; if (q.y < -10) { q.y = h + 10; q.x = R(0, w); } } },
        draw(c, t) { c.fillStyle = P.heart; for (const q of f) { const b = q.big || 0; c.globalAlpha = Math.min(1, q.y / (h * .5)) * (.75 + b * .25); heart(c, q.x + Math.sin(t * 1.6 + q.ph) * 5, q.y, q.s * (1 + b * (.45 + .15 * Math.sin(t * 14)))); } },
      };
    } },
    rain: { name: 'Rain', make(w, h, P, dark, k) {
      const d = Array.from({ length: count(30, k) }, () => ({ x: R(0, w), y: R(0, h), len: R(6, 11), sp: R(190, 250) }));
      const splash = []; const UMB = 15; // 1.1.21: drops that hit the pointer splash off it
      return {
        step(dt, t, m) {
          for (const q of d) {
            const y0 = q.y; q.y += q.sp * dt; q.x += q.sp * .14 * dt;
            if (m && Math.abs(q.x - m.x) < UMB && y0 <= m.y - 3 && q.y > m.y - 3 - (UMB - Math.abs(q.x - m.x)) * .5 - 8) {
              const sy = m.y - 3 - Math.sqrt(Math.max(0, UMB * UMB - (q.x - m.x) ** 2)) * .45;
              if (splash.length < 60) for (let i = 0; i < 3; i++) splash.push({ x: q.x, y: sy, vx: (q.x - m.x) * R(2, 4) + R(-25, 25), vy: -R(30, 60), age: 0, life: R(.25, .4) });
              q.y = -12 - R(0, 30); q.x = R(-20, w);
            }
            if (q.y > h + 12) { q.y = -12; q.x = R(-20, w); }
          }
          for (const s of splash) { s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } cull(splash, dt);
        },
        draw(c) {
          c.strokeStyle = P.rain; c.lineWidth = 1.1; c.lineCap = 'round'; c.globalAlpha = .5; c.beginPath(); for (const q of d) { c.moveTo(q.x, q.y); c.lineTo(q.x - q.len * .14, q.y - q.len); } c.stroke();
          if (splash.length) { c.fillStyle = P.rain; c.globalAlpha = .7; c.beginPath(); for (const s of splash) { const r = 1.1 * (1 - s.age / s.life * .5); c.moveTo(s.x + r, s.y); c.arc(s.x, s.y, r, 0, TAU); } c.fill(); }
        },
      };
    } },
    confetti: { name: 'Confetti', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(22, k) }, () => ({ x: R(0, w), y: R(0, h), vy: R(20, 36), rot: R(0, TAU), vr: R(-3, 3), ph: R(0, TAU), col: pick(P.confetti), gx: 0, gy: 0 }));
      return {
        step(dt, t, m) { const dr = Math.pow(.3, dt); for (const q of f) { if (m) { const o = { x: q.x, y: q.y, vx: q.gx, vy: q.gy }; if (shove(o, m, 50, 300, dt, 1.4)) { q.gx = o.vx; q.gy = o.vy; q.rot += dt * 10; } } q.gx *= dr; q.gy *= dr; q.x += q.gx * dt; q.y += (q.vy + q.gy) * dt; q.rot += q.vr * dt; if (q.x < -8) q.x += w + 16; else if (q.x > w + 8) q.x -= w + 16; if (q.y > h + 6) { q.y = -6; q.x = R(0, w); } } },
        draw(c, t) { for (const q of f) { c.save(); c.translate(q.x + Math.sin(t + q.ph) * 6, q.y); c.rotate(q.rot); c.scale(1, Math.cos(t * 3 + q.ph)); c.globalAlpha = .82; c.fillStyle = q.col; c.fillRect(-2, -3.5, 4, 7); c.restore(); } },
      };
    } },    // "The film": columns of code at different speeds, bright heads, long fading trails
    matrix: { name: 'Matrix', make(w, h, P, dark, k) {
      const size = 14; const rows = Math.ceil(h / size);
      const dens = Math.min(.95, Math.max(.3, .75 * Math.pow(k, .6))); // how many of the columns have a stream
      const fresh = (col) => { col.head = R(-8, 0); col.sp = R(6, 16); col.len = Math.round(R(8, 22)); col.wait = R(0, 2.5); };
      const cols = [];
      for (let x = size / 2; x < w; x += size) if (Math.random() < dens) { const col = { x, cells: codeCells(rows + 2) }; fresh(col); col.head = R(-rows, rows); cols.push(col); }
      return {
        step(dt, t, m) {
          if (m) {
            const mx = w - m.x; const row = Math.floor(m.y / size);
            for (const col of cols) {
              if (Math.abs(col.x - mx) > size * .6) continue;
              if (row >= 0 && row < col.cells.length) col.cells[row] = glyph();
              const idle = col.wait > 0 || col.head - col.len > row + 2 || col.head < row - 6;
              if (idle && m.sp > 25 && Math.random() < dt * 5) { col.wait = 0; col.head = m.y / size; col.sp = R(10, 16); col.len = Math.round(R(8, 18)); }
            }
          }
          for (const col of cols) {
            if (col.wait > 0) { col.wait -= dt; continue; }
            col.head += col.sp * dt;
            if (Math.random() < .5) col.cells[Math.floor(Math.random() * col.cells.length)] = glyph();
            if (col.head - col.len > rows) fresh(col);
          }
        },
        draw(c) { mirror(c, w, size); for (const col of cols) if (col.wait <= 0) drawStream(c, P, col.x, 0, col.head, col.len, col.cells, size, .9); },
      };
    } },
    // Rainbow ("Anywhere, slowly", picked by the owner): a slice of a huge arc that draws itself in from one end,
    // like a progress bar along the arc, stays a while, then fades away as a whole. It comes from any side or
    // corner (never hangs from the top), high or low, steep or flat; its ends always melt away. Now and then
    // (1 in 20) it's a double rainbow: a fainter second arc above, colours the other way round.
    rainbow: { name: 'Rainbow', make(w, h, P, dark, k) {
      const OW = Math.max(1, Math.round(w)); const OH = Math.max(1, Math.round(h)); // the bands are drawn at note size first
      const band = Math.max(4, w / 71); // about 20% wider than the preview
      const N = 120;
      const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
      const ease = (x) => { x = Math.max(0, Math.min(1, x)); return .5 - .5 * Math.cos(Math.PI * x); }; // starts and stops gently
      const edge = () => {
        const side = Math.floor(Math.random() * 3); // left, bottom, right
        if (side === 0) return { x: -w * .06, y: h * R(.35, 1.05) };
        if (side === 1) return { x: w * R(-.05, 1.05), y: h * 1.06 };
        return { x: w * 1.06, y: h * R(.35, 1.05) };
      };
      // a circle through S and E, bulging upwards by `sag`
      function path() {
        const S = edge(); let E = edge(); let tries = 0;
        while (Math.hypot(E.x - S.x, E.y - S.y) < w * .8 && tries++ < 20) E = edge();
        const dx = E.x - S.x; const dy = E.y - S.y; const L = Math.hypot(dx, dy); const sag = L * R(.1, .32);
        let nx = -dy / L; let ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
        const r = (L * L / 4 + sag * sag) / (2 * sag);
        const cx = (S.x + E.x) / 2 - nx * (r - sag); const cy = (S.y + E.y) / 2 - ny * (r - sag);
        const aS = Math.atan2(S.y - cy, S.x - cx); let d = Math.atan2(E.y - cy, E.x - cx) - aS;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        return { cx, cy, r, aS, d, double: Math.random() < .05 };
      }
      // One whole rainbow is painted solid first (bands slightly overlapping, so there are no seams or gaps), then
      // its strength along the arc is applied in one go with a soft mask: the ends fade in slowly and stay faint,
      // and the front of the part drawn so far is a long soft edge. `strength` is the see-through-ness of the whole bow.
      const FRONT = .2;
      const sc = document.createElement('canvas'); sc.width = OW; sc.height = OH;
      const s2 = sc.getContext('2d');
      // 1.1.23 (speed): the bands never change while a rainbow is up, so they are drawn and blurred ONCE per rainbow, at
      // screen resolution (`solid`); each frame only the soft mask that draws it in is laid over them, and once it has
      // fully drawn in, the finished picture is simply reused (only its see-through-ness changes as it fades). It used
      // to repaint all the bands, rebuild the mask and blur the whole note every frame: ~44 ms a frame on a big note
      // without a graphics card, more than a frame has. Same picture (the bows never overlap, so blurring each bow
      // before masking it is the same as blurring both after).
      // the part of the note a bow covers (note px), with room for its blur; all the work below stays inside it
      function bowBox(g, rOuter) {
        const lo = Math.min(g.aS, g.aS + g.d); const hi = Math.max(g.aS, g.aS + g.d); const rIn = rOuter - 6.5 * band; const rOut = rOuter + band;
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (let k = 0; k <= 64; k++) { const a = lo + (hi - lo) * k / 64; for (const r of [rIn, rOut]) { const x = g.cx + Math.cos(a) * r; const y = g.cy + Math.sin(a) * r; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
        const pad = band + 6; x0 = clamp(x0 - pad, 0, w); y0 = clamp(y0 - pad, 0, h); x1 = clamp(x1 + pad, 0, w); y1 = clamp(y1 + pad, 0, h);
        return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
      }
      const devBox = ([x, y, bw, bh], sx) => { const X = Math.max(0, Math.floor(x * sx)); const Y = Math.max(0, Math.floor(y * sx)); return [X, Y, Math.ceil((x + bw) * sx) - X, Math.ceil((y + bh) * sx) - Y]; };
      function solidBow(g, rOuter, reverse, sx, W, H) {
        const list = reverse ? [...RAINBOW_HUES].reverse() : RAINBOW_HUES;
        const lo = Math.min(g.aS, g.aS + g.d); const hi = Math.max(g.aS, g.aS + g.d);
        s2.clearRect(0, 0, sc.width, sc.height);
        s2.lineCap = 'butt'; s2.lineWidth = band + 1.2;
        list.forEach((hue, i) => {
          s2.strokeStyle = `hsl(${hue}, ${dark ? 92 : 85}%, ${dark ? 66 : 57}%)`;
          s2.beginPath(); s2.arc(g.cx, g.cy, rOuter - i * band, lo, hi); s2.stroke();
        });
        const box = bowBox(g, rOuter); const [bx, by, bw, bh] = box; const dev = devBox(box, sx);
        // only as big as the bow's box (a full-screen canvas per bow would take a lot of memory on a big note)
        const cv = document.createElement('canvas'); cv.width = Math.max(1, dev[2]); cv.height = Math.max(1, dev[3]); const x = cv.getContext('2d');
        x.setTransform(sx, 0, 0, sx, -dev[0], -dev[1]); x.filter = 'blur(1.6px)';
        x.drawImage(sc, bx, by, bw, bh, bx, by, bw, bh);
        return { cv, box, dev };
      }
      // lay the drawing-in mask over a blurred bow (into `into`, at screen resolution, only inside the bow's box)
      function maskBow(into, bow, g, prog, strength, sx, add) {
        const [X, Y, BW, BH] = bow.dev;
        if (add && (!spare || spare.width !== into.width || spare.height !== into.height)) { spare = document.createElement('canvas'); spare.width = into.width; spare.height = into.height; } // only a double rainbow needs it
        const tmp = add ? spare : into; const y = tmp.getContext('2d');
        y.setTransform(1, 0, 0, 1, 0, 0); y.globalCompositeOperation = 'source-over';
        if (add) y.clearRect(X, Y, BW, BH);
        y.drawImage(bow.cv, X, Y);
        const lo = Math.min(g.aS, g.aS + g.d); const start = lo - .05;
        const at = (u) => Math.pow(smooth(Math.min(u, 1 - u) / .38), 1.6) * smooth((prog - u) / FRONT) * strength;
        y.setTransform(sx, 0, 0, sx, 0, 0);
        const grad = y.createConicGradient(start, g.cx, g.cy);
        const stops = [];
        for (let j = 0; j <= N; j++) { const u = j / N; stops.push([(g.aS + g.d * u - start) / TAU, at(u)]); }
        stops.sort((p1, p2) => p1[0] - p2[0]);
        for (const [of, a] of stops) grad.addColorStop(Math.max(0, Math.min(1, of)), `rgba(0,0,0,${a.toFixed(4)})`);
        y.globalCompositeOperation = 'destination-in'; y.fillStyle = grad; y.fillRect(X / sx, Y / sx, BW / sx, BH / sx);
        y.globalCompositeOperation = 'source-over'; y.setTransform(1, 0, 0, 1, 0, 0);
        if (add) into.getContext('2d').drawImage(tmp, X, Y, BW, BH, X, Y, BW, BH);
      }
      let pic = null; let spare = null; // the picture shown (screen resolution) and a spare for the second bow
      const GROW = 4.8; const STAY = 3; const FADE = 2.6; const WAIT = 1.6 / Math.max(.15, k); // "Often" comes back sooner
      let cur = null; let first = true; const glints = [];
      return {
        step(dt, t, m) {
          if (!cur) { cur = { g: path(), age: first ? GROW * .5 : 0 }; first = false; }
          cur.age += dt;
          // 1.1.21: where the pointer touches the drawn part of the bow, it glitters in the bow's colours
          if (m && glints.length < 40 && cur.age < GROW + STAY + FADE * .5) {
            const g = cur.g; const dr = Math.hypot(m.x - g.cx, m.y - g.cy); const depth = g.r - dr;
            if (depth > -band && depth < band * 8) {
              let a = Math.atan2(m.y - g.cy, m.x - g.cx) - g.aS; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU;
              const u = a / g.d; const prog = ease(cur.age / GROW);
              if (u > .03 && u < Math.min(.97, prog) && Math.random() < dt * (8 + m.sp * .05)) glints.push({ x: m.x + R(-6, 6), y: m.y + R(-6, 6), hue: RAINBOW_HUES[clamp(Math.floor(depth / band), 0, 6)], age: 0, life: R(.5, .9), vy: R(-14, -4) });
            }
          }
          for (const q of glints) q.y += q.vy * dt; cull(glints, dt);
          if (cur.age > GROW + STAY + FADE + WAIT) cur = null;
        },
        draw(c) {
          if (!cur) return;
          const t = cur.age; const prog = ease(t / GROW) * (1 + FRONT);
          const alpha = (dark ? .62 : .78) * (t < GROW + STAY ? 1 : 1 - smooth((t - GROW - STAY) / FADE));
          if (alpha <= .01 || prog <= 0) return;
          const T = typeof c.getTransform === 'function' ? c.getTransform() : null; const sx = T && T.a > 0 ? T.a : 1;
          const W = Math.max(1, Math.round(w * sx)); const H = Math.max(1, Math.round(h * sx));
          if (!cur.solid || cur.sx !== sx) { // a new rainbow (or the note moved to a screen with another scale)
            cur.sx = sx; cur.solid = [solidBow(cur.g, cur.g.r, false, sx, W, H)];
            // a double rainbow: the second bow is just as wide and solid, a little fainter, colours the other way round
            if (cur.g.double) cur.solid.push(solidBow(cur.g, cur.g.r + band * 9, true, sx, W, H));
            cur.key = '';
            if (!pic || pic.width !== W || pic.height !== H) { pic = document.createElement('canvas'); pic.width = W; pic.height = H; }
            else pic.getContext('2d').clearRect(0, 0, W, H);
          }
          const prog2 = cur.g.double ? ease((t - GROW * .3) / GROW) * (1 + FRONT) : 0;
          const key = `${prog.toFixed(5)}|${prog2.toFixed(5)}`;
          if (key !== cur.key) { // still drawing in: lay the mask again (once it's fully in, nothing to do)
            cur.key = key;
            const px = pic.getContext('2d'); px.setTransform(1, 0, 0, 1, 0, 0);
            for (const bw of cur.solid) px.clearRect(...bw.dev);
            maskBow(pic, cur.solid[0], cur.g, prog, 1, sx, false);
            if (cur.g.double) maskBow(pic, cur.solid[1], cur.g, prog2, .62, sx, true);
          }
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha;
          let [X, Y, BW, BH] = cur.solid[0].dev; if (cur.solid[1]) { const [X2, Y2, BW2, BH2] = cur.solid[1].dev; const R2 = Math.max(X + BW, X2 + BW2); const B2 = Math.max(Y + BH, Y2 + BH2); X = Math.min(X, X2); Y = Math.min(Y, Y2); BW = R2 - X; BH = B2 - Y; }
          c.drawImage(pic, X, Y, BW, BH, X, Y, BW, BH); c.restore();
          for (const q of glints) { const v = q.age / q.life; c.globalAlpha = Math.sin(Math.PI * v) * .95; c.fillStyle = `hsl(${q.hue} ${dark ? 95 : 85}% ${dark ? 78 : 62}%)`; star4(c, q.x, q.y, 3.2 * (1 - v * .4)); }
        },
      };
    } },
    // ================================================================ 1.1.18: the owner's picks from the Effect Lab
    // Plankton ("Breaking wave"): specks rest almost dark; every few seconds an invisible wave rolls across and
    // lights them up as it passes, nudging them along, then the glow slowly dies away
    plankton: { name: 'Plankton', make(w, h, P, dark, k) {
      const f = Array.from({ length: capped(60, k, 150) }, () => ({ x: R(0, w), y: R(0, h), vx: 0, vy: 0, ph: R(0, TAU), r: R(1.3, 2.4), lit: 0 }));
      let wave = null; let wait = R(.2, .8); const go = every(1.5, 4, k);
      return {
        step(dt, t, m) {
          if (m) for (const q of f) { const u = shove(q, m, 42, 120, dt, .5); if (u) q.lit = Math.max(q.lit, Math.min(1, u * 2.2)); }
          if (!wave) {
            wait -= dt;
            if (wait <= 0) {
              const a = R(-.5, .5) + (Math.random() < .5 ? 0 : Math.PI); const ca = Math.cos(a); const sa = Math.sin(a);
              const proj = [0, w].flatMap((x) => [0, h].map((y) => x * ca + y * sa));
              wave = { ca, sa, pos: Math.min(...proj) - 30, end: Math.max(...proj) + 30, sp: R(70, 115) * Math.max(1, w / 340), ph: R(0, TAU) };
            }
          } else { wave.pos += wave.sp * dt; if (wave.pos > wave.end) { wave = null; wait = R(1.2, 3.5) / clamp(k, .4, 3); } }
          const dr = Math.pow(.25, dt);
          for (const q of f) {
            if (wave) {
              const along = q.x * wave.ca + q.y * wave.sa; const across = -q.x * wave.sa + q.y * wave.ca;
              const front = wave.pos + Math.sin(across * .035 + wave.ph) * 16 + Math.sin(across * .09) * 5; const d = front - along;
              if (d > 0 && d < 14) { q.lit = 1; q.vx += wave.ca * 5; q.vy += wave.sa * 5; }
            }
            const a = flow(q.x, q.y, t * .6); q.vx += Math.cos(a) * 4 * dt; q.vy += Math.sin(a) * 4 * dt; q.vx *= dr; q.vy *= dr;
            q.x += q.vx * dt; q.y += q.vy * dt; wrap(q, w, h, 6); q.lit = Math.max(0, q.lit - dt * .55);
          }
          if (go(dt)) { const q = pick(f); q.lit = Math.max(q.lit, .9); }
        },
        draw(c, t) { for (const q of f) glow2(c, q.x, q.y, q.r * (1 + q.lit * .6), P.tide, q.lit > .6 ? P.tideHi : P.tide, .12 + .06 * Math.sin(t * 1.7 + q.ph) + q.lit * .85, dark ? .4 : .3); },
      };
    } },
    // Warp speed ("Warp jump"): cruises slowly among the stars for about half a minute, then they stretch into long
    // blue streaks at light speed for 3 seconds, with a soft flash, and it drops back to calm (the owner's timing)
    warp: { name: 'Warp speed', make(w, h, P, dark, k) {
      const sf = starfield(w, h, capped(80, k, 220));
      const CRUISE = 30; const SPOOL = 1.2; const WARP = 3; const DROP = 1.2; const CYCLE = CRUISE + SPOOL + WARP + DROP;
      const ease = (x) => .5 - .5 * Math.cos(Math.PI * clamp(x, 0, 1));
      let tm = R(0, CRUISE); let speed = .1; let flash = 0;
      const speedAt = (x) => (x < CRUISE ? .1 : x < CRUISE + SPOOL ? .1 + 1.5 * ease((x - CRUISE) / SPOOL) : x < CRUISE + SPOOL + WARP ? 1.6 : 1.6 - 1.5 * ease((x - CRUISE - SPOOL - WARP) / DROP));
      // 1.1.22 (ninth round, the owner): the pointer no longer steers where the stars come from. Instead, while it is in
      // the middle of the note (a box round the centre that is 10 % of the note: 31.6 % of its width and height), it's
      // hyperdrive the whole time, almost twice as fast as the normal jump (3 instead of 1.6), spooling up in about a
      // second with a flash; leaving the middle drops back to the normal cycle
      const HYPER = 3; const BOX = .12; let hyper = 0; // (10th round: a little closer to the centre: 24 % of the width / height, was 31.6 %)
      return {
        step(dt, t, m) {
          const mid = !!m && Math.abs(m.x - w / 2) < w * BOX && Math.abs(m.y - h / 2) < h * BOX;
          const was = hyper; hyper = clamp(hyper + (mid ? dt * 1.1 : -dt * .8), 0, 1);
          if (was < .5 && hyper >= .5) flash = 1;
          const before = tm; tm = (tm + dt) % CYCLE; const e = ease(hyper); speed = speedAt(tm) * (1 - e) + HYPER * e;
          if (before < CRUISE + SPOOL && tm >= CRUISE + SPOOL && hyper < .5) flash = 1;
          flash = Math.max(0, flash - dt * 1.6);
          sf.move(dt, speed);
        },
        draw(c) {
          const fast = clamp((speed - .1) / 1.5, 0, 1); const len = speed > 1.6 ? .22 * 1.6 / speed * (1 + (speed - 1.6) * .25) : .22; // hyperdrive: faster, the streaks only a little longer
          if (fast > .05) sf.draw(c, P.warp, speed, len, 1 + fast * .8);
          sf.draw(c, P.star, speed, len * (1 - fast * .4), .7);
          if (flash > 0) {
            const r = Math.max(w, h) * (.2 + (1 - flash) * .5); const g = c.createRadialGradient(sf.vp.x, sf.vp.y, 0, sf.vp.x, sf.vp.y, r);
            g.addColorStop(0, P.warp); g.addColorStop(1, 'transparent'); c.globalAlpha = flash * (dark ? .45 : .3); c.fillStyle = g; c.fillRect(0, 0, w, h);
          }
        },
      };
    } },
    // Network ("Living web"): points wander and thin lines join any two that come close
    // 1.1.22, fifth round (the owner: "after a while all the nodes end up scrunched into a single piece"): they all used to
    // drift on the same "wind" (flow) with nothing keeping them apart, and that wind has spots where it gathers, so over
    // minutes to hours they piled up there (and the pointer pulled the ones near it into one dot); measured after an hour:
    // 30 nodes in 4–5 of 36 cells, ~2–12 px apart. Now each node also has its own slowly turning heading, nodes closer
    // than ~half a link push each other apart, the edges push softly inwards instead of piling nodes against them, and a
    // node never quite stops. The pointer still draws the near ones in, but they gather round it instead of on it.
    network: { name: 'Network', make(w, h, P, dark, k) {
      const N = capped(30, k, 70); const D = clamp(Math.sqrt(w * h / N) * 1.25, 60, 95); const SEP = D * .55; const EDGE = 18;
      const p = Array.from({ length: N }, () => ({ x: R(0, w), y: R(0, h), vx: R(-9, 9), vy: R(-9, 9), ph: R(0, TAU), hd: R(0, TAU), tw: R(.15, .45) * (Math.random() < .5 ? -1 : 1) }));
      const B = 5; let M = null;
      return {
        step(dt, t, m) {
          M = m;
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { // keep a little room between them
            const a = p[i]; const b = p[j]; const dx = a.x - b.x; const dy = a.y - b.y; if (dx > SEP || dx < -SEP || dy > SEP || dy < -SEP) continue;
            const d = Math.hypot(dx, dy); if (d >= SEP) continue;
            const u = d > .01 ? 1 / d : 0; const ux = u ? dx * u : Math.cos(a.ph); const uy = u ? dy * u : Math.sin(a.ph); const f = (1 - d / SEP) ** 2 * 26 * dt;
            a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
          }
          for (const q of p) {
            q.hd += (q.tw + Math.sin(t * .21 + q.ph) * .35) * dt; // its own wandering
            const a = flow(q.x, q.y, t * .5); q.vx += (Math.cos(a) * 1.2 + Math.cos(q.hd) * 3.2) * dt; q.vy += (Math.sin(a) * 1.2 + Math.sin(q.hd) * 3.2) * dt;
            if (m) { const u = near(q, m, D * 1.3); if (u > .25) { q.vx += (m.x - q.x) * u * .9 * dt; q.vy += (m.y - q.y) * u * .9 * dt; } }
            if (q.x < EDGE) q.vx += (1 - q.x / EDGE) * 14 * dt; else if (q.x > w - EDGE) q.vx -= (1 - (w - q.x) / EDGE) * 14 * dt;
            if (q.y < EDGE) q.vy += (1 - q.y / EDGE) * 14 * dt; else if (q.y > h - EDGE) q.vy -= (1 - (h - q.y) / EDGE) * 14 * dt;
            const sp = Math.hypot(q.vx, q.vy); if (sp > 12) { q.vx *= 12 / sp; q.vy *= 12 / sp; } else if (sp < 3) { const g = sp > .01 ? 3 / sp : 0; q.vx = g ? q.vx * g : Math.cos(q.hd) * 3; q.vy = g ? q.vy * g : Math.sin(q.hd) * 3; }
            q.x += q.vx * dt; q.y += q.vy * dt;
            if (q.x < 0) { q.x = 0; q.vx = Math.abs(q.vx); } if (q.x > w) { q.x = w; q.vx = -Math.abs(q.vx); }
            if (q.y < 0) { q.y = 0; q.vy = Math.abs(q.vy); } if (q.y > h) { q.y = h; q.vy = -Math.abs(q.vy); }
          }
        },
        draw(c, t) {
          const segs = Array.from({ length: B }, () => []);
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
            const a = p[i]; const b = p[j]; const dx = a.x - b.x; const dy = a.y - b.y; if (Math.abs(dx) > D || Math.abs(dy) > D) continue;
            const d = Math.hypot(dx, dy); if (d >= D) continue;
            segs[Math.min(B - 1, Math.floor(Math.pow(1 - d / D, 1.2) * B))].push(a.x, a.y, b.x, b.y);
          }
          if (M) for (const a of p) { const dx = a.x - M.x; const dy = a.y - M.y; if (Math.abs(dx) > D * 1.2 || Math.abs(dy) > D * 1.2) continue; const d = Math.hypot(dx, dy); if (d < D * 1.2) segs[Math.min(B - 1, Math.floor((1 - d / (D * 1.2)) * B))].push(a.x, a.y, M.x, M.y); }
          c.strokeStyle = P.net; c.lineWidth = .9;
          segs.forEach((s, i) => { c.globalAlpha = (i + 1) / B * (dark ? .55 : .5); strokeSegs(c, s); });
          if (M) { c.globalAlpha = .85; c.fillStyle = P.netNode; dot(c, M.x, M.y, 2.2); }
          c.fillStyle = P.netNode;
          for (const q of p) { c.globalAlpha = .8; dot(c, q.x, q.y, 1.7 + .5 * Math.sin(t * 1.3 + q.ph)); }
        },
      };
    } },
    // Embers ("Campfire"): sparks rise from a warm glow, wobbling on the hot air, cooling yellow → orange → red;
    // now and then one pops into a few tiny sparks
    embers: { name: 'Embers', make(w, h, P, dark, k) {
      const e = []; let acc = 0; const lift = Math.max(.8, h / 280);
      const add = (o) => { if (e.length < 170) e.push(o); };
      return {
        step(dt, t, m) {
          acc += dt * 9 * clamp(k, .2, 3.5);
          if (m && m.y > h * .45 && m.sp > 40) { acc += dt * Math.min(30, m.sp * .04); if (Math.random() < dt * Math.min(12, m.sp * .02)) add({ x: m.x + R(-8, 8), y: m.y + R(-4, 4), vx: m.vx * .15 + R(-10, 10), vy: -R(30, 60) * lift, age: 0, life: R(1, 2), r: R(.9, 1.8), fl: R(8, 18), ph: R(0, TAU) }); }
          if (m) for (const q of e) shove(q, m, 48, 160, dt, .7);
          while (acc >= 1) { acc -= 1; add({ x: w / 2 + (R(-1, 1) + R(-1, 1)) * w * .32, y: h + R(0, 8), vx: R(-6, 6), vy: -R(22, 46) * lift, age: 0, life: R(2.2, 4.2), r: R(.9, 2.1), fl: R(8, 18), ph: R(0, TAU) }); }
          const dr = Math.pow(.5, dt);
          for (const q of e) {
            const a = flow(q.x, q.y * 1.3, t * 1.4, .02); q.vx += Math.cos(a) * 26 * dt; q.vx *= dr; q.vy -= 4 * dt;
            q.x += q.vx * dt; q.y += q.vy * dt;
            if (!q.spark && q.r > 1.4 && Math.random() < dt * .12) {
              q.age = q.life;
              for (let i = 0; i < 6; i++) add({ x: q.x, y: q.y, vx: R(-32, 32), vy: R(-42, 4), age: 0, life: R(.4, .8), r: .8, fl: 20, ph: 0, spark: true });
            }
          }
          cull(e, dt);
        },
        draw(c, t) {
          const ga = (dark ? .2 : .13) + .05 * Math.sin(t * 2.3) + .03 * Math.sin(t * 5.1);
          const g = c.createLinearGradient(0, h, 0, h * .62); g.addColorStop(0, P.fireGlow); g.addColorStop(1, 'transparent');
          c.globalAlpha = ga; c.fillStyle = g; c.fillRect(0, h * .62, w, h * .38);
          for (const q of e) {
            const v = q.age / q.life; const col = q.spark || v < .25 ? P.ember[2] : v < .6 ? P.ember[1] : P.ember[0];
            const a = Math.pow(1 - v, .7) * (.55 + .45 * Math.sin(t * q.fl + q.ph));
            glow2(c, q.x, q.y, q.r * 1.6, P.ember[1], col, a, dark ? .4 : .25);
          }
        },
      };
    } },
    // Cherry blossom ("Gust whirls"): petals flutter down, flipping over; every few seconds a little whirlwind
    // lifts the nearby petals into a spiral and lets them go again
    blossom: { name: 'Cherry blossom', make(w, h, P, dark, k) {
      const f = Array.from({ length: capped(22, k, 70) }, () => ({ x: R(-20, w), y: R(-10, h), vx: R(5, 15), vy: R(10, 20), rot: R(0, TAU), vr: R(-1.4, 1.4), fp: R(0, TAU), fs: R(1.6, 3.4), s: R(3.5, 6), m: R(.6, 1.3), col: pick(P.blossom) }));
      const whirls = []; const go = every(4.5, 8, k); const S = Math.min(w, h) / 280;
      return {
        step(dt, t, m) {
          const wind = 9 + 6 * Math.sin(t * .35);
          if (m && m.sp > 380 && whirls.length < 2 && Math.random() < dt * 2.5) whirls.push({ x: m.x, y: m.y, age: 0, life: R(2.2, 3), r: R(35, 55) * S, dir: m.vx >= 0 ? 1 : -1 });
          if (m) for (const q of f) if (shove(q, m, 50, 140, dt, 1.1)) q.fs += dt * 6;
          if (go(dt) && whirls.length < 2) whirls.push({ x: R(w * .2, w * .8), y: R(h * .3, h * .8), age: 0, life: R(3.2, 4.2), r: R(45, 75) * S, dir: Math.random() < .5 ? 1 : -1 });
          for (const wh of whirls) wh.x += wind * .8 * dt;
          for (const q of f) {
            let tvx = wind * q.m; let tvy = 12 + Math.sin(q.fp) * 7; let pull = 2;
            for (const wh of whirls) {
              const dx = q.x - wh.x; const dy = q.y - wh.y; const d = Math.hypot(dx, dy) || 1; const R0 = wh.r * 1.7;
              if (d < R0) { const f0 = Math.sin(Math.PI * wh.age / wh.life) * (1 - d / R0); tvx += (-dy / d * 85 * wh.dir) * f0; tvy += (dx / d * 85 * wh.dir - 30) * f0; pull += f0 * 4; q.rot += wh.dir * f0 * 4 * dt; }
            }
            q.vx += (tvx - q.vx) * Math.min(1, pull * dt); q.vy += (tvy - q.vy) * Math.min(1, pull * dt);
            q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.fp += q.fs * dt; if (q.fs > 3.4) q.fs = Math.max(3.4, q.fs - dt * 4);
            if (q.y > h + 10) { q.y = -10; q.x = R(-w * .25, w); } if (q.x > w + 12) { q.x = -12; q.y = R(-10, h * .7); } if (q.x < -40) q.x = w + 10; if (q.y < -40) q.y = h + 10;
          }
          cull(whirls, dt);
        },
        draw(c) {
          for (const q of f) {
            const cf = Math.cos(q.fp);
            c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(1, cf * .9 + (cf < 0 ? -.1 : .1));
            c.globalAlpha = .85; c.fillStyle = q.col; petal(c, q.s); c.restore();
          }
        },
      };
    } },
    // Night sky ("Twinkle & shooting stars"): stars twinkle at their own pace, the bright ones with little cross
    // sparkles, and about every 12 seconds a shooting star streaks past (the same on any note size or frequency;
    // the frequency only changes how many stars there are)
    nightsky: { name: 'Night sky', make(w, h, P, dark, k) {
      const s = Array.from({ length: capped(70, k, 180) }, () => ({ x: R(0, w), y: R(0, h), r: .35 + Math.pow(Math.random(), 3) * 1.3, f: R(.6, 3.5), ph: R(0, TAU), base: R(.3, .85) }));
      const sh = []; const go = every(10, 14); let cool = 0;
      const shooter = () => { const L = Math.random() < .5; const a = (L ? 0 : Math.PI) + (L ? 1 : -1) * R(.3, .7); const sp = R(260, 380); return { x: L ? R(-10, w * .5) : R(w * .5, w + 10), y: R(-10, h * .35), vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, age: 0, life: R(.7, 1.1), len: R(55, 90) }; };
      return {
        step(dt, t, mp) {
          if (go(dt)) sh.push(shooter());
          if (mp) {
            for (const q of s) q.g = Math.max(near(q, mp, 55), (q.g || 0) - dt * 1.2);
            cool -= dt; if (mp.sp > 650 && cool <= 0 && sh.length < 3) { cool = 1.2; const sp = R(300, 400); sh.push({ x: mp.x, y: mp.y, vx: mp.vx / mp.sp * sp, vy: mp.vy / mp.sp * sp, age: 0, life: R(.6, .9), len: R(55, 90) }); }
          } else for (const q of s) if (q.g) q.g = Math.max(0, q.g - dt * 1.2);
          for (const m of sh) { m.x += m.vx * dt; m.y += m.vy * dt; } cull(sh, dt);
        },
        draw(c, t) {
          c.fillStyle = P.skyStar;
          for (const q of s) {
            const g = q.g || 0; const a = Math.min(1, q.base * (.55 + .45 * Math.sin(t * q.f + q.ph)) + g * .6); c.globalAlpha = a; dot(c, q.x, q.y, q.r * (1 + g * .7));
            if (q.r > 1.2 || g > .5) { c.globalAlpha = a * .5; c.fillRect(q.x - q.r * 3, q.y - .35, q.r * 6, .7); c.fillRect(q.x - .35, q.y - q.r * 3, .7, q.r * 6); }
          }
          for (const m of sh) {
            const v = m.age / m.life; const a = Math.sin(Math.PI * Math.min(1, v * 1.4)); const sp = Math.hypot(m.vx, m.vy);
            const tx = m.x - m.vx / sp * m.len; const ty = m.y - m.vy / sp * m.len;
            const g = c.createLinearGradient(m.x, m.y, tx, ty); g.addColorStop(0, P.shoot); g.addColorStop(1, 'transparent');
            c.globalAlpha = a * .9; c.strokeStyle = g; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(tx, ty); c.stroke();
            c.globalAlpha = a; c.fillStyle = P.skyStar; dot(c, m.x, m.y, 1.3);
          }
        },
      };
    } },
    // Analog monitor (id 'glitch', kept so saved choices still work; it was "Glitch" before the owner asked for just
    // the calm part): faint scanlines that crawl slowly, and now and then one soft scan line sweeps slowly down.
    // 1.1.22, seventh round (the owner: the lines moved too fast, there were too many, and "where the mouse is, it should
    // just make a gap between the horizontal lines"): lines every 6 px (was 4) crawling at 3 px/s (was 8); the scan line
    // takes 8 s to cross and no longer shakes the lines (the springy Ghost-ripple lines are gone). The pointer opens a
    // smooth gap in the lines where it is (also when it rests); the lines bend round it and close again when it leaves.
    // Frequency = how often the scan line comes: every clamp(24 s / k, 12 s, 75 s) from start to start.
    glitch: { name: 'Analog monitor', make(w, h, P, dark, k) {
      const S = clamp(Math.min(w, h) / 280, .8, 1.5);
      const GAP = 6; const SPD = 3; const G = 9 * S; const RX = 44 * S; const RY = 24 * S; // gap: half height, reach sideways / up-down
      const f = clamp(k || 1, .2, 6); const cycle = clamp(24 / f, 12, 75); const DUR = 8;
      let sy = -40; let moving = false; let wait = R(1, 4); let gx = 0; let gy = 0; let ga = 0; let off = 0;
      const bend = (x, y) => { const dy = y - gy; if (dy > RY * 2.6 || dy < -RY * 2.6) return 0; const dx = (x - gx) / RX; return (dy < 0 ? -1 : 1) * G * ga * Math.exp(-dx * dx) * Math.exp(-((dy / RY) ** 2)); };
      return {
        step(dt, t, m) {
          off = (off + dt * SPD) % GAP;
          if (moving) { sy += (h + 80) / DUR * dt; if (sy > h + 40) { moving = false; wait = Math.max(1, cycle - DUR) * R(.85, 1.15); } }
          else { wait -= dt; if (wait <= 0) { moving = true; sy = -40; } }
          if (m) { if (ga < .01) { gx = m.x; gy = m.y; } const e = Math.min(1, dt * 12); gx += (m.x - gx) * e; gy += (m.y - gy) * e; }
          ga = clamp(ga + (m ? dt * 5 : -dt * 3), 0, 1); // opens in ~0.2 s, closes in ~0.3 s
        },
        draw(c) {
          const A = dark ? .05 : .045; const segs = [];
          c.fillStyle = P.scan; c.globalAlpha = A; c.beginPath();
          const x0 = Math.max(0, Math.floor((gx - RX * 2.2) / 8) * 8); const x1 = Math.min(w, gx + RX * 2.2);
          for (let y = off - GAP; y < h; y += GAP) {
            if (ga > .01 && Math.abs(y - gy) < RY * 2.6 && x1 > x0) { // this line bends round the gap
              if (x0 > 0) c.rect(0, y, x0, 1); if (x1 < w) c.rect(x1, y, w - x1, 1);
              let px = x0; let py = y + .5 + bend(x0, y);
              for (let x = x0 + 8; x <= x1 + 7.99; x += 8) { const xx = Math.min(x, x1); const ny = y + .5 + bend(xx, y); segs.push(px, py, xx, ny); px = xx; py = ny; }
            } else c.rect(0, y, w, 1);
          }
          c.fill();
          if (segs.length) { c.strokeStyle = P.scan; c.lineWidth = 1; strokeSegs(c, segs); }
          if (moving) { // the scan line, with a soft glow trailing it
            const gb = c.createLinearGradient(0, sy - 36, 0, sy); gb.addColorStop(0, 'transparent'); gb.addColorStop(1, P.scan);
            c.globalAlpha = dark ? .07 : .055; c.fillStyle = gb; c.fillRect(0, sy - 36, w, 36);
            c.globalAlpha = dark ? .16 : .13; c.fillStyle = P.scan; c.fillRect(0, sy - .75, w, 1.5);
          }
        },
      };
    } },
    // Digital ocean: a grid of dots seen in perspective, rolling like the sea; the crests catch the light
    ocean: { name: 'Digital ocean', make(w, h, P, dark, k) {
      const cols = clamp(Math.round(24 * Math.sqrt(k)), 16, 42); const rows = clamp(Math.round(14 * Math.pow(k, .3)), 10, 22); const hor = h * .2;
      let M = null; let lift = 0;
      return {
        step(dt, t, m) { if (m) M = { x: m.x, y: m.y }; lift = clamp(lift + (m ? 1 : -1) * dt * 2.5, 0, 1); },
        draw(c, t) {
          const lo = []; const hi = [];
          for (let j = 0; j < rows; j++) {
            const z = 2.4 - j / (rows - 1) * 2.05; // far → near
            for (let i = 0; i < cols; i++) {
              const u = i / (cols - 1) * 2 - 1; const x = u * z;
              const y = .16 * (Math.sin(x * 2.6 + t * 1.1) + .7 * Math.sin(z * 4.2 - t * 1.6) + .45 * Math.sin((x + z) * 2.1 + t * .7));
              const sx = w / 2 + u * w * .56; let sy = hor + (.55 - y) / z * h * .42; if (sy > h + 4) continue;
              let bump = 0; if (M && lift > 0) { const dx = sx - M.x; const dy = sy - M.y; const d2 = dx * dx + dy * dy; if (d2 < 3600) { bump = Math.exp(-d2 / 900) * lift; sy -= bump * 14; } }
              const near = 1 - (z - .35) / 2.05; const crest = clamp((y + .2) / .5 + bump, 0, 1);
              (crest > .75 ? hi : lo).push([sx, sy, (.5 + near * 1.6), .25 + near * .6 + crest * .2]);
            }
          }
          bucketDots(c, lo, P.wave, 5, dark ? .9 : .8); bucketDots(c, hi, P.waveHi, 3, dark ? .95 : .85);
        },
      };
    } },
    // Silk waves ("Flowing silk"): ribbons of glittering dots ripple across the middle, weaving over and under
    silk: { name: 'Silk waves', make(w, h, P, dark, k) {
      const RIB = 7; const N = clamp(Math.round(60 * Math.sqrt(k)), 40, 110); let M = null; let pull = 0; let mvy = 0; const sz = clamp(Math.min(w, h) / 280, .8, 1.5);
      // 1.1.22: gentler. The ribbons used to be yanked onto the pointer; now they part softly round it, sway a little
      // the way it moves and shine where it touches, like running a finger through silk
      return {
        step(dt, t, m) {
          if (m) { if (!M) M = { x: m.x, y: m.y }; const f = Math.min(1, dt * 5); M.x += (m.x - M.x) * f; M.y += (m.y - M.y) * f; mvy += (clamp(m.vy, -400, 400) - mvy) * Math.min(1, dt * 3); } else mvy *= Math.pow(.2, dt);
          pull = clamp(pull + (m ? 1 : -1) * dt * 1.2, 0, 1);
        },
        draw(c, t) {
          const groups = [[], [], []];
          for (let j = 0; j < RIB; j++) {
            const amp = h * (.14 + .06 * Math.sin(t * .3 + j * .5)); const grp = j < 2 ? 0 : j < 5 ? 1 : 2;
            for (let i = 0; i < N; i++) {
              const x = i / (N - 1) * (w + 20) - 10; const u = x / w * TAU;
              let y = h / 2 + amp * Math.sin(u * 1.1 + t * .8 + j * .38) + h * .06 * Math.sin(u * 2.3 - t * .6 + j * .2);
              let lit = 0;
              if (M && pull > 0) { const g = Math.exp(-(((x - M.x) / 70) ** 2)) * pull; if (g > .01) { const dy = y - M.y; y += dy / Math.sqrt(dy * dy + 120) * 13 * sz * Math.exp(-((dy / 50) ** 2)) * g + mvy * .025 * g; lit = g * Math.exp(-((dy / 60) ** 2)); } }
              const sh = Math.min(1, .5 + .5 * Math.sin(u * 3 + t * 1.5 + j) + lit * .5); groups[grp].push([x, y, .7 + sh * .9, .2 + sh * .8]);
            }
          }
          groups.forEach((g, i) => bucketDots(c, g, P.silk[i], 4, dark ? .9 : .8));
        },
      };
    } },
    // Glass shards ("Glass drift"): coloured glass floats and turns in 3D; colours shift as it turns, and the edge
    // flashes white when a shard faces you
    shards: { name: 'Glass shards', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280;
      const f = Array.from({ length: capped(10, k, 28) }, () => ({ x: R(0, w), y: R(0, h), vx: R(-6, 6), vy: R(-8, -2), rot: R(0, TAU), vr: R(-.3, .3), th: R(0, TAU), vt: R(.5, 1.3) * (Math.random() < .5 ? -1 : 1), hue: R(0, 360), pts: shard(S) }));
      for (const q of f) { q.bvx = q.vx; q.bvy = q.vy; q.bvt = q.vt; }
      return {
        step(dt, t, m) {
          const back = Math.min(1, dt * .8);
          for (const q of f) {
            if (m) { const u = shove(q, m, 44 * Math.max(1, S), 260, dt, .9); if (u) { q.vt += Math.sign(q.vt || 1) * u * 14 * dt; q.vr += (m.vx > 0 ? 1 : -1) * u * 3 * dt; } }
            q.vx += (q.bvx - q.vx) * back; q.vy += (q.bvy - q.vy) * back; q.vt += (q.bvt - q.vt) * back * .6; q.vr *= 1 - back * .5;
            q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.th += q.vt * dt; wrap(q, w, h, 20);
          }
        },
        draw(c, t) {
          for (const q of f) {
            const cs = Math.cos(q.th); const face = Math.abs(cs);
            c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(cs, 1);
            c.beginPath(); q.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
            const hue = q.hue + q.th * 50 + t * 12; const r = q.pts.reduce((m, [x, y]) => Math.max(m, Math.hypot(x, y)), 1);
            const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, hsla(hue, P.shardS, P.shardL, 1)); g.addColorStop(.5, hsla(hue + 70, P.shardS, P.shardL, 1)); g.addColorStop(1, hsla(hue + 150, P.shardS, P.shardL, 1));
            c.globalAlpha = (dark ? .3 : .34) * (.5 + face * .5); c.fillStyle = g; c.fill();
            c.globalAlpha = .55; c.strokeStyle = P.shardEdge; c.lineWidth = .8 / Math.max(.2, face); c.stroke();
            if (face > .92) { c.globalAlpha = (face - .92) / .08 * .9; c.strokeStyle = P.shardGlint; c.lineWidth = 1.4 / Math.max(.2, face); c.beginPath(); c.moveTo(q.pts[0][0], q.pts[0][1]); c.lineTo(q.pts[1][0], q.pts[1][1]); c.stroke(); }
            c.restore();
          }
        },
      };
    } },
    // Ghost ripple ("Passing ghost"): an invisible something glides around a field of dots; they part to let it
    // through, then wobble back into place behind it, leaving a shimmering wake
    ghost: { name: 'Ghost ripple', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const d = dotLattice(w, h, clamp(16 / Math.sqrt(Math.max(.4, k)), 11, 24) * Math.max(1, S * .9)); const RG = 46 * S; const ph = R(0, 50);
      const pos = (t) => [w / 2 + Math.sin(t * .23 + ph) * w * .42, h / 2 + Math.sin(t * .37 + ph * 1.3) * h * .38];
      return {
        step(dt, t, m) {
          const [gx, gy] = pos(t); const damp = Math.exp(-2.2 * dt);
          for (const q of d) {
            const dx = q.x - gx; const dy = q.y - gy; const dd = Math.hypot(dx, dy) || 1;
            if (dd < RG) { const f = (1 - dd / RG) ** 2 * 1100 * S; q.vx += dx / dd * f * dt; q.vy += dy / dd * f * dt; }
            if (m) { const mx = q.x - m.x; const my = q.y - m.y; if (mx < RG && mx > -RG && my < RG && my > -RG) { const md = Math.hypot(mx, my) || 1; if (md < RG) { const f = (1 - md / RG) ** 2 * 1100 * S; q.vx += mx / md * f * dt; q.vy += my / md * f * dt; } } }
            q.vx += (q.bx - q.x) * 7 * dt; q.vy += (q.by - q.y) * 7 * dt; q.vx *= damp; q.vy *= damp; q.x += q.vx * dt; q.y += q.vy * dt;
            q.b = clamp(Math.hypot(q.x - q.bx, q.y - q.by) / (9 * S), 0, 1);
          }
        },
        draw(c) {
          const lo = []; const hi = [];
          for (const q of d) (q.b > .45 ? hi : lo).push([q.x, q.y, 1.05 + q.b * .9, .42 + q.b * .58]);
          bucketDots(c, lo, P.ripple, 4, dark ? .75 : .7); bucketDots(c, hi, P.rippleHi, 3, dark ? .95 : .85);
        },
      };
    } },
    // Fish ("School of fish", boids): little fish swim in a loose school, split up and join again; now and then
    // something startles them and they scatter. 1.1.19: each fish is drawn along a short bending spine, so its body
    // curves when it turns and a swimming wave runs down it to a forked tail that trails and flexes behind (it beats
    // faster when the fish hurries); two little side fins paddle, and a soft sheen runs along its back
    fish: { name: 'Fish', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280;
      const b = Array.from({ length: capped(30, k, 70) }, (_, i) => fishNew(R(30, w - 30), R(30, h - 30), R(0, TAU), R(11.5, 14.5) * S, i % 3));
      let scare = null; const go = every(7, 13, k); let T = 0; let M = null;
      const extra = (q) => {
        const a = flow(q.x, q.y, T * .5, .01); let ex = Math.cos(a) * 6; let ey = Math.sin(a) * 6;
        if (M) { const u = near(q, M, 70 * S); if (u) { const dx = q.x - M.x; const dy = q.y - M.y; const d = Math.hypot(dx, dy) || 1; ex += dx / d * u * 700; ey += dy / d * u * 700; } }
        if (scare) { const dx = q.x - scare.x; const dy = q.y - scare.y; const d = Math.hypot(dx, dy) || 1; if (d < 80 * S) { const f = (1 - d / (80 * S)) * 900 * (1 - scare.age / scare.life); ex += dx / d * f; ey += dy / d * f; } }
        return [ex, ey];
      };
      return {
        step(dt, t, m) {
          T = t; M = m; if (!scare && go(dt)) { const q = pick(b); scare = { x: q.x + R(-10, 10), y: q.y + R(-10, 10), age: 0, life: .6 }; }
          if (scare) { scare.age += dt; if (scare.age > scare.life) scare = null; }
          flockStep(b, dt, { w, h, see: 42 * S, apart: 13 * S, cohere: .8, align: 1.6, sep: 9, minS: 18 * S, maxS: (scare || (m && m.sp > 30) ? 95 : 44) * S, edge: 26 * S, extra });
          for (const q of b) fishBend(q, dt, S);
        },
        draw(c) { fishDraw(c, b, P, dark, S); },
      };
    } },
    // Dust in light ("Light shafts", volumetric dust): soft beams slant across the note, breathing brighter and
    // dimmer; dust floats everywhere but only sparkles when it drifts into a beam
    dust: { name: 'Dust in light', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const ang = R(1.15, 1.35);
      const shafts = Array.from({ length: Math.round(R(2, 3.4)) }, (_, i) => ({ x: w * (.15 + i * .3) + R(-15, 15), wd: R(16, 30) * S, ph: R(0, TAU) }));
      const m = Array.from({ length: capped(55, k, 150) }, () => ({ x: R(0, w), y: R(0, h), vx: R(-3, 3), vy: R(-2, 3), z: Math.random(), ph: R(0, TAU) }));
      const ca = Math.cos(ang); const sa = Math.sin(ang);
      const inShaft = (x, y, t) => { let b = 0; for (const s of shafts) { const across = Math.abs((x - s.x) * sa - y * ca); b = Math.max(b, clamp(1 - across / s.wd, 0, 1) * (.7 + .3 * Math.sin(t * .35 + s.ph))); } return b; };
      // 1.1.22: while the mouse plays with it, the dust in the light shows more and the dust outside it a little less;
      // and the pointer is like a finger in the sunbeam: it casts a soft shadow down the beam, and the dust in it dims
      let M = null; let hand = 0; const SR = 9 * clamp(S, .8, 1.5);
      return {
        step(dt, t, mp) {
          if (mp) { M = { x: mp.x, y: mp.y }; hand = Math.min(1, hand + dt * 3); } else hand = Math.max(0, hand - dt * 1.5);
          const damp = Math.exp(-.6 * dt);
          for (const q of m) {
            q.vx = (q.vx + R(-1, 1) * 10 * dt) * damp; q.vy = (q.vy + (R(-1, 1) * 10 + 1.2) * dt) * damp;
            if (mp) { const u = shove(q, mp, 60, 40, dt, .5); if (u) { const dx = q.x - mp.x; const dy = q.y - mp.y; const d = Math.hypot(dx, dy) || 1; q.vx += -dy / d * u * 60 * dt; q.vy += dx / d * u * 60 * dt; } q.lit = Math.max(u, (q.lit || 0) - dt); } else if (q.lit) q.lit = Math.max(0, q.lit - dt);
            const sp = Math.hypot(q.vx, q.vy); if (sp > 60) { q.vx *= 60 / sp; q.vy *= 60 / sp; }
            q.x += q.vx * (.5 + q.z) * dt; q.y += q.vy * (.5 + q.z) * dt; wrap(q, w, h, 6);
          }
        },
        draw(c, t) {
          for (const s of shafts) {
            c.save(); c.translate(s.x, 0); c.rotate(ang - Math.PI / 2);
            const g = c.createLinearGradient(-s.wd, 0, s.wd, 0); g.addColorStop(0, 'transparent'); g.addColorStop(.5, P.shaft); g.addColorStop(1, 'transparent');
            c.globalAlpha = (dark ? .07 : .3) * (.7 + .3 * Math.sin(t * .35 + s.ph)) * (1 + hand * (dark ? .6 : .25)); c.fillStyle = g; c.fillRect(-s.wd, -20, s.wd * 2, Math.hypot(w, h) * 1.3);
            if (M && hand > 0) { // the pointer's shadow: a soft strip down the beam from where it is
              const lx = (M.x - s.x) * sa - M.y * ca; const ly = (M.x - s.x) * ca + M.y * sa; const inB = clamp(1 - Math.abs(lx) / s.wd, 0, 1);
              if (inB > 0) {
                const sg = c.createLinearGradient(lx - SR, 0, lx + SR, 0); sg.addColorStop(0, 'transparent'); sg.addColorStop(.5, '#000'); sg.addColorStop(1, 'transparent');
                c.globalCompositeOperation = 'destination-out'; c.globalAlpha = inB * hand * .75; c.fillStyle = sg; c.fillRect(lx - SR, ly, SR * 2, Math.hypot(w, h) * 1.3); c.globalCompositeOperation = 'source-over';
              }
            }
            c.restore();
          }
          c.fillStyle = P.dust;
          for (const q of m) {
            let b = inShaft(q.x, q.y, t); const lit = q.lit || 0;
            if (M && hand > 0 && b > 0) { const dx = q.x - M.x; const dy = q.y - M.y; if (dx * ca + dy * sa > 0) { const perp = Math.abs(dx * sa - dy * ca); if (perp < SR) b *= 1 - .8 * hand * (1 - perp / SR); } }
            const tw = .7 + .3 * Math.sin(t * 2 + q.ph);
            const a = Math.min(1, .07 * (1 - .45 * hand) + lit * .06 + b * tw * (.85 + hand * .5 + lit * .9)) * (dark ? 1 : .9); const r = (.5 + q.z * 1.5) * (1 + b * hand * .35);
            if (q.z > .75) { c.globalAlpha = a * .35; dot(c, q.x, q.y, r * 2.2); } else { c.globalAlpha = a; dot(c, q.x, q.y, r); }
          }
        },
      };
    } },
    // ---- 1.1.18, third round: the owner's picks from the "Spell Lab" page (magic effects)
    // Healing aura: green and gold motes and little crosses float up through a soft healing light at the bottom.
    // 1.1.22: the bottom no longer has rings swirling out; it slowly breathes: a soft glow swells up and settles back
    // (the owner picked "Breathing" from five versions). The pointer gathers the motes and glows softly where it is.
    heal: { name: 'Healing aura', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const sz = clamp(S, .8, 1.5); let M = null; let hand = 0;
      const mk = (any) => ({ x: R(w * .1, w * .9), y: any ? R(h * .2, h) : h + 6, vy: -R(14, 28), ph: R(0, TAU), c: Math.random() < .55 ? 0 : 1, cross: Math.random() < .25, s: R(.9, 1.8) * sz, top: R(0, h * .4) });
      const f = Array.from({ length: capped(26, k, 70) }, () => mk(true));
      const glowUp = (c, col, a, top) => { const g = c.createLinearGradient(0, h, 0, top); g.addColorStop(0, col); g.addColorStop(1, 'transparent'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, top, w, h - top); };
      return {
        step(dt, t, m) {
          if (m) { M = { x: m.x, y: m.y }; hand = Math.min(1, hand + dt * 3); } else hand = Math.max(0, hand - dt * 1.5);
          for (let i = 0; i < f.length; i++) {
            const q = f[i]; q.y += q.vy * dt; q.x += Math.sin(t * 1.3 + q.ph) * 6 * dt;
            if (m) { const u = near(q, m, 90); if (u) { q.x += (m.x - q.x) * u * 1.6 * dt; q.y += (m.y - q.y) * u * 1.2 * dt; } }
            if (q.y < q.top) f[i] = mk(false);
          }
        },
        draw(c, t) {
          const A = dark ? 1 : .65;
          const b = .5 - .5 * Math.cos(t * TAU / 3.6); // breathing in and out, about every 3.6 s
          glowUp(c, P.heal[0], ((dark ? .14 : .1) + .12 * b) * (dark ? 1 : .9), h * (.62 - .22 * b));
          glowUp(c, P.heal[1], (.06 + .12 * b) * A, h * (.88 - .1 * b));
          c.globalAlpha = (.25 + .35 * b) * A; c.fillStyle = P.healHi; c.fillRect(0, h - 1.5, w, 1.5);
          if (M && hand > 0) { // a soft healing glow where the pointer is
            const r = (16 + 4 * Math.sin(t * 3)) * sz; const g = c.createRadialGradient(M.x, M.y, 0, M.x, M.y, r); g.addColorStop(0, P.heal[0]); g.addColorStop(1, 'transparent');
            c.globalAlpha = hand * (dark ? .3 : .25); c.fillStyle = g; c.beginPath(); c.arc(M.x, M.y, r, 0, TAU); c.fill();
          }
          const dots = [[], []];
          for (const q of f) {
            const a = clamp((q.y - q.top) / (h * .25), 0, 1) * (.6 + .4 * Math.sin(t * 3 + q.ph));
            if (q.cross) { const s = q.s * 2.2; c.globalAlpha = a; c.fillStyle = P.healHi; c.fillRect(q.x - s, q.y - s * .3, s * 2, s * .6); c.fillRect(q.x - s * .3, q.y - s, s * .6, s * 2); } else dots[q.c].push([q.x, q.y, q.s, a]);
          }
          dots.forEach((d, i) => bucketDots(c, d, P.heal[i], 3, dark ? .95 : .85));
        },
      };
    } },
    // Lightning spell: now and then a forked bolt cracks across the note with a flash, flickers and fades; a few static
    // sparks drift in between
    lightning: { name: 'Lightning', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; let bolt = null; const go = every(2.2, 4.5, k); let flash = 0;
      const sparks = Array.from({ length: capped(12, k, 36) }, () => ({ x: R(0, w), y: R(0, h), ph: R(0, TAU), f: R(2, 6) }));
      let M = null; const zaps = [];
      // 1.1.22: every bolt picks where it strikes first; only if the pointer is close to that path does it bend
      // to hit the pointer (a bolt on the far side of the note misses it). Second round: it hits more often (bolts
      // like to start above the pointer, and they bend to it from further away), and a hit is a little show: a white
      // flash at the pointer, a shock ring, three tiny crackling arcs and a few sparks. Third round (the owner wanted more
      // hits): the zone round the pointer that a bolt bends into is wider, and seven bolts in ten come down near the
      // pointer, so about three in four now hit it (it was about one in two); the rest start anywhere, so the side bolts stay
      const reach = Math.max(70, Math.min(w, h) * .32);
      const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax; const vy = by - ay; const u = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1); return Math.hypot(px - ax - vx * u, py - ay - vy * u); };
      const make = () => {
        const x0 = M && Math.random() < .7 ? clamp(M.x + R(-w * .2, w * .2), w * .05, w * .95) : R(w * .1, w * .9); let x1 = clamp(x0 + R(-w * .35, w * .35), 0, w); let y1 = R(h * .65, h); let hit = null;
        if (M && segDist(M.x, M.y, x0, -5, x1, y1) < reach) { x1 = M.x; y1 = M.y; hit = { x: M.x, y: M.y }; }
        const main = []; zig(x0, -5, x1, y1, Math.min(w * .18, Math.max(12, y1 * .3)), 5, main);
        const branches = []; for (let i = 0; i < 2; i++) { const j = Math.floor(R(4, main.length / 4 - 4)) * 4; const bx = main[j]; const by = main[j + 1]; zig(bx, by, bx + R(-60, 60) * S, by + R(30, 80) * S, 18 * S, 3, branches); }
        if (hit) for (let i = 0; i < 5; i++) { const a = R(0, TAU); const v = R(50, 120) * S; zaps.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: R(.25, .5) }); }
        return { main, branches, age: 0, life: .7, hit };
      };
      return {
        step(dt, t, m) {
          M = m; if (!bolt && go(dt)) { bolt = make(); flash = bolt.hit ? 1.4 : 1; } if (bolt) { bolt.age += dt; if (bolt.age > bolt.life) bolt = null; } flash = Math.max(0, flash - dt * 5);
          const dr = Math.pow(.1, dt); for (const z of zaps) { z.vx *= dr; z.vy *= dr; z.x += z.vx * dt; z.y += z.vy * dt; } cull(zaps, dt);
        },
        draw(c, t) {
          bucketDots(c, sparks.map((s) => [s.x + Math.sin(t * s.f + s.ph) * 2, s.y, .9, Math.max(0, Math.sin(t * s.f * 1.7 + s.ph))]), P.lightning, 3, dark ? .6 : .45);
          const cg = c.createLinearGradient(0, 0, 0, h * .35); cg.addColorStop(0, P.lightning); cg.addColorStop(1, 'transparent'); // a stormy glow at the top
          c.globalAlpha = (dark ? .1 : .06) * (.7 + .3 * Math.sin(t * 1.1) * Math.sin(t * 2.7)); c.fillStyle = cg; c.fillRect(0, 0, w, h * .35);
          if (flash > 0) { c.globalAlpha = Math.min(1, flash) * (dark ? .1 : .06); c.fillStyle = P.lightning; c.fillRect(0, 0, w, h); }
          if (zaps.length) bucketDots(c, zaps.map((z) => [z.x, z.y, 1.1, 1 - z.age / z.life]), P.lightningHi, 3, .95);
          if (!bolt) return;
          const u = bolt.age / bolt.life; const fl = u < .3 ? (Math.random() < .5 ? 1 : .45) : 1 - (u - .3) / .7;
          c.lineCap = 'round'; c.lineJoin = 'round';
          c.strokeStyle = P.lightning; c.lineWidth = 5 * clamp(S, .8, 1.5); c.globalAlpha = fl * (dark ? .25 : .16); strokeSegs(c, bolt.main);
          c.lineWidth = 1.6 * clamp(S, .8, 1.5); c.globalAlpha = fl * .95; c.strokeStyle = P.lightningHi; strokeSegs(c, bolt.main);
          c.lineWidth = 1; c.globalAlpha = fl * .7; strokeSegs(c, bolt.branches);
          if (bolt.hit) { // the hit: a white flash, a shock ring and three tiny crackling arcs round the pointer
            const H = bolt.hit; const sz = clamp(S, .8, 1.5);
            glow2(c, H.x, H.y, (11 - u * 6) * sz, P.lightning, P.lightningHi, Math.min(1, fl * 1.2), dark ? .9 : .6);
            c.strokeStyle = P.lightningHi; c.lineWidth = 1.4 * (1 - u); c.globalAlpha = (1 - u) * .85; c.beginPath(); c.arc(H.x, H.y, (5 + Math.sqrt(u) * 30) * sz, 0, TAU); c.stroke();
            if (u < .45) { const arcs = []; for (let i = 0; i < 3; i++) { const a = R(0, TAU); const L = R(12, 22) * sz; zig(H.x, H.y, H.x + Math.cos(a) * L, H.y + Math.sin(a) * L, 5, 2, arcs); } c.lineWidth = 1; c.globalAlpha = fl * .9; strokeSegs(c, arcs); }
          }
        },
        bolt: () => bolt, // for the tests
      };
    } },
    // Cauldron: a glowing potion surface wobbles near the bottom; bubbles swell up out of it as glowing domes and
    // burst with a splash of droplets and a puff of coloured steam; steam curls up and drifts away the whole time; now and
    // then a bubble breaks free and floats up as a glowing orb, shimmering, until it pops into tiny stars
    cauldron: { name: 'Cauldron', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const sz = clamp(S, .8, 1.5); const SY = h * .86; const COL = Math.floor(R(0, 2));
      // 1.1.22: the pointer stirs the potion. Seventh round (the owner found the quick sideways wave too wobbly and picked
      // the "smushy" dip of pick B, without its whirlpool): near the surface the pointer presses a smooth, soft dip into it
      // that drifts after the pointer with a little lag, stays while it rests there and fades out when it leaves
      const stir = { x: w / 2, a: 0 };
      const surf = (x, t) => {
        let y = SY + Math.sin(x * .045 + t * 2.1) * 2.2 * sz + Math.sin(x * .021 - t * 1.3) * 1.6 * sz;
        if (stir.a > .01) { const dx = x - stir.x; if (dx > -130 && dx < 130) y += stir.a * sz * 4.5 * Math.exp(-((dx / (30 * sz)) ** 2)); }
        return y;
      };
      const domes = []; const drops = []; const steam = []; const orbs = []; const stars = [];
      const goDome = every(.35, .9, k); const goSteam = every(.12, .25); const vents = [R(.15, .35), R(.4, .6), R(.65, .85)].map((f) => f * w); const goOrb = every(4, 7, k);
      const puff = (x, y, big) => { if (steam.length < 30) steam.push({ x, y, vx: R(-6, 6) * S, vy: -R(20, 32) * S, r: (big ? R(10, 16) : R(6, 10)) * sz, grow: R(7, 12) * sz, age: 0, life: R(3, 4.5), ph: R(0, TAU), c: big ? 0 : 1 }); };
      return {
        step(dt, t, m) {
          if (m && m.y > SY - 40 * sz) { if (stir.a < .01) stir.x = m.x; stir.a = Math.min(1, stir.a + dt * 1.4); stir.x += (m.x - stir.x) * Math.min(1, dt * 2.2); }
          else stir.a = Math.max(0, stir.a - dt * .8);
          if (m) for (const o of orbs) if (o.mode !== 'pop' && Math.hypot(o.x - m.x, o.y - m.y) < o.r + 7) o.mode = 'pop';
          if (goDome(dt) && domes.length < 7) domes.push({ x: R(w * .08, w * .92), r: R(5, 11) * sz, age: 0, life: R(.6, 1.1), c: Math.random() < .7 ? COL : 1 - COL });
          if (goSteam(dt)) puff(pick(vents) + R(-14, 14) * sz, SY - 2, false);
          if (goOrb(dt) && orbs.length < 3) orbs.push({ x: R(w * .2, w * .8), y: SY - 4, vy: -R(18, 28) * S, r: R(4, 6.5) * sz, ph: R(0, TAU), top: R(h * .15, h * .5), sink: Math.random() < .2, mode: 'up', t: 0 });
          for (let i = domes.length - 1; i >= 0; i--) {
            const d = domes[i]; d.age += dt;
            if (d.age > d.life) { // burst: droplets and a puff of steam
              for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + R(-1.1, 1.1); const v = R(40, 85) * S; drops.push({ x: d.x, y: surf(d.x, t) - d.r * .6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 1.4, c: d.c }); }
              puff(d.x, surf(d.x, t) - d.r, true); domes.splice(i, 1);
            }
          }
          for (const q of drops) { q.vy += 220 * S * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.y > surf(q.x, t) + 2) q.age = q.life; } cull(drops, dt);
          for (const s of steam) { s.age += dt; s.x += (s.vx + Math.sin(t * 1.2 + s.ph + s.age) * 10 * S) * dt; s.y += s.vy * dt; s.r += s.grow * dt; }
          for (let i = steam.length - 1; i >= 0; i--) if (steam[i].age > steam[i].life) steam.splice(i, 1);
          for (let i = orbs.length - 1; i >= 0; i--) {
            const o = orbs[i]; o.t += dt; o.x += Math.sin(t * 2 + o.ph) * 10 * dt;
            if (o.mode === 'up') { o.y += o.vy * dt; if (o.y < o.top) { o.mode = o.sink ? 'stall' : 'pop'; o.t = 0; } }
            else if (o.mode === 'pop') { /* touched by the pointer (1.1.21): pops below */ }
            else if (o.mode === 'stall') { if (o.t > .8) { o.mode = 'down'; } }
            else if (o.mode === 'down') { o.y += 30 * S * dt; if (o.y > SY) { puff(o.x, SY - 3, true); orbs.splice(i, 1); continue; } }
            if (o.mode === 'pop') { for (let j = 0; j < 8; j++) { const a = j * TAU / 8; stars.push({ x: o.x, y: o.y, vx: Math.cos(a) * 45 * S, vy: Math.sin(a) * 45 * S, age: 0, life: .8 }); } orbs.splice(i, 1); }
          }
          const dr = Math.pow(.15, dt); for (const s of stars) { s.vx *= dr; s.vy *= dr; s.x += s.vx * dt; s.y += s.vy * dt; } cull(stars, dt);
        },
        draw(c, t) {
          // the glow of the brew below the surface
          const g = c.createLinearGradient(0, h, 0, SY - 30 * S); g.addColorStop(0, P.brew[COL]); g.addColorStop(1, 'transparent');
          c.globalAlpha = (dark ? .26 : .16) + .04 * Math.sin(t * 1.8); c.fillStyle = g; c.fillRect(0, SY - 30 * S, w, h - SY + 30 * S);
          // steam: soft puffs that rise, swell, sway and thin out
          for (const s of steam) {
            const u = s.age / s.life; const a = Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - u * .8) * (dark ? .42 : .3);
            c.globalAlpha = a; stamp(c, soft(s.c ? P.steam : P.brew[COL]), s.x, s.y, s.r);
          }
          // the potion surface
          c.strokeStyle = P.brew[COL]; c.lineWidth = 1.6 * sz; c.globalAlpha = dark ? .7 : .6; c.beginPath();
          for (let x = 0; x <= w + 6; x += 6) { const y = surf(x, t); if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
          // domes swelling out of the surface: filled, glowing, with a bright crescent on top
          for (const d of domes) {
            const u = d.age / d.life; const r = d.r * (.3 + .7 * Math.sin(Math.PI / 2 * u)); const y = surf(d.x, t);
            c.globalAlpha = .55; c.fillStyle = P.brew[d.c]; c.beginPath(); c.arc(d.x, y, r, Math.PI, TAU); c.fill();
            c.globalAlpha = .9; c.strokeStyle = P.brewHi; c.lineWidth = 1.1 * sz; c.beginPath(); c.arc(d.x, y, r * .75, Math.PI * 1.15, Math.PI * 1.55); c.stroke();
          }
          bucketDots(c, drops.map((q) => [q.x, q.y, 1.5 * sz, 1 - q.age / q.life * .5]), P.brew[COL], 3, .95);
          // orbs that broke free: a glowing core with a swirl of colour round it
          for (const o of orbs) {
            glow2(c, o.x, o.y, o.r, P.brew[COL], P.brewHi, .95, dark ? .6 : .45);
            c.strokeStyle = P.brew[1 - COL]; c.lineWidth = 1.2 * sz; c.globalAlpha = .8; c.beginPath(); c.arc(o.x, o.y, o.r * 1.15, t * 4 + o.ph, t * 4 + o.ph + 2.2); c.stroke();
          }
          c.fillStyle = P.brewHi; for (const s of stars) { c.globalAlpha = 1 - s.age / s.life; star4(c, s.x, s.y, 2.4 * sz); }
        },
      };
    } },
    // Ghost jellyfish: faint sea-glow motes drift; every so often a ghostly jellyfish
    // made of dots swims slowly across, its bell pulsing and tendrils trailing, leaving glowing dots behind, then dissolves
    jelly: { name: 'Ghost jellyfish', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const sz = clamp(S, .8, 1.5); const J = Math.min(w, h) * .22;
      const motes = Array.from({ length: capped(28, k, 70) }, () => ({ x: R(0, w), y: R(0, h), ph: R(0, TAU), vy: -R(1, 4) }));
      const trail = []; let jelly = null; const go = every(5, 9);
      const spawn = () => { const L = Math.random() < .5; return { x: L ? -J : w + J, y: R(h * .45, h * .75), vx: (L ? 1 : -1) * R(14, 22) * S, vy: -R(2, 6) * S, age: 0, life: (w + 2 * J) / (R(14, 22) * S), ph: R(0, TAU), drop: 0, hist: [] }; };
      jelly = spawn(); jelly.age = jelly.life * .3; jelly.x += jelly.vx * jelly.life * .3; jelly.y += jelly.vy * jelly.life * .3;
      // 1.1.22: touching the jellyfish no longer chases it away (the owner picked "Slingshot ghost" from three versions).
      // It shines: from where it's first touched a wave of violet light spreads over all of it, then it all glows and
      // slowly calms down. And the moment the pointer goes in, a violet mirage of it is left behind, once: a still copy
      // that stays exactly where it appeared (no swimming, pulsing or swaying like the real one) and fades smoothly away
      // from its first moment to its last. It never follows the pointer; moving round inside the jellyfish does nothing
      // more until the pointer leaves and comes back in
      const ALT = dark ? '#E3A6FF' : '#8A3FB8'; let M = null; let lit = 0; let away = 0;
      let inside = false; let lastFling = -9; const twins = [];
      // the shine starts where it's first touched and spreads over the whole jellyfish (src: that spot, from the jellyfish's middle; wave: how far it has spread)
      let src = null; let wave = 0;
      return {
        step(dt, t, mp) {
          for (const m of motes) { m.y += m.vy * dt; m.x += Math.sin(t * .5 + m.ph) * 3 * dt; if (mp) nudge(m, mp, 40, 90, dt, .3); if (m.y < -4) { m.y = h + 4; m.x = R(0, w); } }
          let on = false; if (mp) { M = { x: mp.x, y: mp.y }; if (jelly) { const dx = mp.x - jelly.x; const dy = mp.y - jelly.y; on = Math.abs(dx) < J * .65 && dy > -J * .55 && dy < J * 1.25; } }
          if (on && !src) { src = { x: mp.x - jelly.x, y: mp.y - jelly.y }; wave = 0; }
          away = on ? 0 : away + dt; // the shine stays a moment after the pointer leaves (.35 s), then fades in under a second
          lit = on ? Math.min(1, lit + dt * 4) : away < .35 ? lit : Math.max(0, lit - dt * 1.3);
          if (src) { wave += dt * J * 2.6; if (lit <= 0) src = null; }
          {
            if (on && !inside && t - lastFling > .6 && twins.length < 3) { twins.push({ age: 0, life: 1.6, snap: null }); lastFling = t; } // just came in: leave a mirage behind, once (its shape is copied the first time it's drawn)
            inside = on;
            cull(twins, dt);
          }
          if (!jelly && go(dt)) jelly = spawn();
          if (jelly) {
            const q = jelly; q.age += dt; const sw = .6 + .4 * Math.max(0, Math.sin(t * 2.2 + q.ph)); // it swims in pushes
            q.x += q.vx * sw * dt * 1.4; q.y += q.vy * sw * dt; q.hist.unshift([q.x, q.y]); if (q.hist.length > 40) q.hist.pop();
            q.drop += dt; if (q.drop > .12) { q.drop = 0; trail.push({ x: q.x + R(-J * .3, J * .3), y: q.y + R(0, J * .2), age: 0, life: R(1.5, 2.8) }); }
            if (q.age > q.life || q.y < -J * 2) jelly = null;
          }
          cull(trail, dt);
        },
        draw(c, t) {
          const lo = []; const hi = [];
          for (const m of motes) lo.push([m.x, m.y, .9 * sz, .25 + .2 * Math.sin(t + m.ph)]);
          for (const d of trail) lo.push([d.x, d.y, 1.1 * sz, (1 - d.age / d.life) * .8]);
          const alt = [];
          if (jelly) {
            const q = jelly; const fade = clamp(q.age / 1.5, 0, 1) * clamp((q.life - q.age) / 1.5, 0, 1); const pu = Math.sin(t * 2.2 + q.ph);
            const bw = J * (.5 + .08 * pu); const bh = J * (.42 - .06 * pu);
            const body = []; // [x, y, r, a, along (0 bell top … 1 tendril ends)]
            for (let i = 0; i <= 22; i++) { const a = Math.PI + i / 22 * Math.PI; body.push([q.x + Math.cos(a) * bw, q.y + Math.sin(a) * bh, 1.4 * sz, fade * (.6 + .3 * Math.sin(t * 3 + i)), (1 + Math.sin(a)) * .15]); }
            for (let i = 0; i < 9; i++) { const a = Math.PI * (1.15 + i * .08); body.push([q.x + Math.cos(a) * bw * .55, q.y + Math.sin(a) * bh * .55, 1 * sz, fade * .35, .1]); }
            for (let tdl = 0; tdl < 5; tdl++) {
              const off = (tdl / 4 - .5) * bw * 1.3;
              for (let s = 1; s <= 9; s++) { const hp = q.hist[Math.min(q.hist.length - 1, s * 3)] || [q.x, q.y]; const lag = [hp[0] - q.x, hp[1] - q.y]; body.push([q.x + off * (1 - s * .05) + lag[0] * .6 + Math.sin(t * 2.2 - s * .6 + tdl * 1.3) * (1.5 + s * .9) * sz, q.y + s * J * .12 + lag[1] * .3, (1.1 - s * .06) * sz, fade * (.75 - s * .07), .3 + s * .078]); }
            }
            if (lit > .01) { // it shines: from where it was first touched, a wave of violet light spreads over every dot (a bright edge as it goes), then all of it glows, with a soft shimmer running down it
              const sx = q.x + (src ? src.x : 0); const sy = q.y + (src ? src.y : 0); const W = src ? wave : J * 9; const spread = clamp(W / (J * 1.6), 0, 1);
              c.globalAlpha = lit * fade * spread * (dark ? .24 : .15); stamp(c, soft(ALT), q.x, q.y, J * 1.1);
              for (const d of body) {
                const dd = Math.hypot(d[0] - sx, d[1] - sy); const got = clamp((W - dd) / (J * .35), 0, 1); const edge = Math.exp(-(((dd - W) / (J * .14)) ** 2));
                const sh = .85 + .15 * Math.sin(d[4] * 9 - t * 6); const b = lit * got;
                const it = [d[0], d[1], d[2] * (1 + .4 * b + .5 * edge * lit), Math.min(1, (d[3] * (1 + .7 * b) + edge * .5 * lit * fade) * (b > .5 ? sh : 1))]; (b > .4 || edge * lit > .5 ? alt : hi).push(it);
              }
            } else for (const d of body) hi.push(d);
            for (const tw of twins) if (!tw.snap) tw.snap = body.map((d) => [d[0], d[1], d[2] * .9, d[3]]); // the mirage is a still copy of how the jellyfish looks right now
          }
          bucketDots(c, lo, P.sea[1], 4, dark ? .7 : .6); bucketDots(c, hi, P.sea[0], 4, dark ? .95 : .85); if (alt.length) bucketDots(c, alt, ALT, 4, dark ? .95 : .85);
          for (const tw of twins) { // the mirage stays exactly where it appeared and fades smoothly, from its first moment to its last
            if (!tw.snap) continue; const v = tw.age / tw.life;
            bucketFade(c, tw.snap, ALT, 4, dark ? .95 : .85, .6 * Math.min(1, v * 10) * Math.pow(Math.max(0, 1 - v), 1.5));
          }
        },
        where: () => (jelly ? { x: jelly.x, y: jelly.y, lit, twins: twins.length } : null), // for the tests
      };
    } },
    // Fel fire (inspired by the green fel magic of MMO games): eerie green flames burn along the bottom of the note,
    // now and then flaring up, throwing a few sparks. 1.1.22: the flames stay low (up to the lower middle at most, a
    // flare included) and each one slows down as it rises, with flickering flame tongues under them, so it burns like a
    // fire instead of fizzing up to the top like soda
    fel: { name: 'Fel fire', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const sz = clamp(S, .8, 1.5); const p = []; let acc = 0; const NT = clamp(Math.round(w / (45 * S)), 4, 12);
      const tongues = Array.from({ length: NT }, (_, i) => ({ x: (i + .5) / NT * w + R(-8, 8), ph: R(0, TAU), flare: 0 })); const go = every(3, 6, k);
      const tall = (tg, t) => h * (.13 + .035 * Math.sin(t * 7 + tg.ph) + .025 * Math.sin(t * 12.7 + tg.ph * 2)) * (1 + tg.flare * .9);
      return {
        step(dt, t, m) {
          if (go(dt)) pick(tongues).flare = 1;
          if (m && m.y > h * .45) { let best = null; let bd = 1e9; for (const tg of tongues) { const d = Math.abs(tg.x - m.x); if (d < bd) { bd = d; best = tg; } } if (best && bd < 40 * sz) best.flare = Math.max(best.flare, clamp(1.2 - (m.y - h * .45) / (h * .55) * .2, .6, 1)); }
          if (m) for (const q of p) { const u = near(q, m, 34 * sz); if (u) q.vx += (q.x - m.x > 0 ? 1 : -1) * u * 260 * dt + m.vx * u * .8 * dt; }
          acc += dt * 95 * clamp(Math.sqrt(k), .5, 1.6);
          while (acc >= 1) {
            acc -= 1; if (p.length > 200) break; const tg = pick(tongues); const spark = Math.random() < .05;
            const H = Math.min(h * .55, (spark ? R(1.3, 2) : R(.55, 1.05)) * tall(tg, t)); const life = R(.7, 1.1) * (1 + tg.flare * .3);
            p.push({ x: tg.x + R(-10, 10) * sz, y: h + 2, vy: -2 * H / life, dec: 2 * H / (life * life), vx: 0, age: 0, life, tx: tg.x, spark });
          }
          for (const tg of tongues) tg.flare = Math.max(0, tg.flare - dt * .7);
          for (const q of p) { q.vx += ((q.tx - q.x) * 3 + Math.sin(t * 9 + q.y * .05) * 16) * dt; if (q.spark) q.vx += R(-60, 60) * dt; q.vy = Math.min(0, q.vy + q.dec * dt); q.x += q.vx * dt; q.y += q.vy * dt; }
          cull(p, dt);
        },
        draw(c, t) {
          const g = c.createLinearGradient(0, h, 0, h * .7); g.addColorStop(0, P.fel[0]); g.addColorStop(1, 'transparent');
          c.globalAlpha = (dark ? .22 : .12) + .05 * Math.sin(t * 5) * Math.sin(t * 2.3); c.fillStyle = g; c.fillRect(0, h * .7, w, h * .3);
          // the flames' glow: a soft, tall glow under each tongue that flickers with it (no hard edges)
          for (const tg of tongues) {
            const th = tall(tg, t) * 1.1; const tw = 20 * sz * (1 + tg.flare * .3);
            c.save(); c.translate(tg.x + Math.sin(t * 5 + tg.ph) * 3, h); c.scale(1, th / tw);
            c.globalAlpha = (dark ? .34 : .24) * (.8 + .2 * Math.sin(t * 11 + tg.ph));
            c.drawImage(glowSprite([[0, P.fel[1]], [.45, P.fel[0]], [1, 'transparent']]), 0, 0, SPR, SPR / 2, -tw, -tw, tw * 2, tw); c.restore(); // its top half
          }
          const core = []; const mid = []; const out = [];
          for (const q of p) { const v = q.age / q.life; const r = (q.spark ? 1 : 3.2 * (1 - v * .8)) * sz; (v < .3 ? core : v < .65 ? mid : out).push([q.x, q.y, r, q.spark ? 1 - v * .5 : Math.sqrt(1 - v) * .85]); }
          bucketDots(c, out, P.fel[0], 3, dark ? .7 : .6); bucketDots(c, mid, P.fel[1], 3, dark ? .85 : .75); bucketDots(c, core, P.felHi, 3, .9);
        },
      };
    } },
  };

  // ---------------------------------------------------------------- mouse followers
  // make(w, h, P, dark, k) → { move(x, y, dist), step(dt, t), draw(ctx, t) }   (k = frequency: .35 rarely, 1 normal, 2.6 often)
  // the followers that spawn particles by distance moved (the Layer feeds them a fast jump in small steps, see move())
  const ALONG = new Set(['stardust', 'hearts', 'bubbles', 'ripples', 'frost', 'confetti', 'leaves', 'plankton', 'network', 'embers', 'blossom', 'nightsky', 'shards', 'dust', 'fireworks', 'warp', 'glitch', 'fel']);
  // add a particle; when the list is full the oldest goes, so a long fast stroke keeps making them (it used to stop)
  const room = (list, max) => { if (list.length >= max) list.shift(); };
  const FOLLOWERS = {
    stardust: { name: 'Stardust', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(9 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x: x + R(-4, 4), y: y + R(-4, 4), vx: R(-10, 10), vy: R(8, 24), age: 0, life: R(.6, 1), r: R(2.2, 3.8) }); },
        step(dt) { for (const q of s) { q.x += q.vx * dt; q.y += q.vy * dt; } cull(s, dt); },
        draw(c) { c.fillStyle = P.gold; for (const q of s) { const v = q.age / q.life; c.globalAlpha = (1 - v) * .95; star4(c, q.x, q.y, q.r * (1 - v * .5)); } },
        busy: () => s.length > 0,
      };
    } },
    // Rainbow: the thin line that changes colour as it goes (the original one, back in the Rainbow place since 1.1.16)
    rainbow: { name: 'Rainbow', make(w, h, P, dark, k = 1) {
      const pts = []; let hue = 0;
      return {
        move(x, y, d) { hue = (hue + d * 1.2) % 360; pts.push({ x, y, age: 0, life: .55 * (.6 + .4 * k), hue }); if (pts.length > 50) pts.shift(); },
        step(dt) { cull(pts, dt); },
        draw(c) {
          c.lineCap = 'round';
          for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]; const b = pts[i]; const v = 1 - b.age / b.life; c.globalAlpha = v * .8; c.lineWidth = 2 + v * 6; c.strokeStyle = `hsl(${b.hue} ${dark ? 90 : 70}% ${dark ? 70 : 55}%)`; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
        },
        busy: () => pts.length > 0,
      };
    } },
    hearts: { name: 'Hearts', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(20 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x: x + R(-5, 5), y, vy: R(14, 26), age: 0, life: R(.8, 1.2), s: R(3.5, 6), ph: R(0, TAU), col: Math.random() < .7 ? P.heart : P.pink }); },
        step(dt) { for (const q of s) q.y -= q.vy * dt; cull(s, dt); },
        draw(c, t) { for (const q of s) { const v = q.age / q.life; c.globalAlpha = (1 - v) * .9; c.fillStyle = q.col; heart(c, q.x + Math.sin(t * 4 + q.ph) * 3, q.y, q.s * (.6 + Math.min(1, v * 4) * .4)); } },
        busy: () => s.length > 0,
      };
    } },
    bubbles: { name: 'Bubbles', make(w, h, P, dark, k = 1) {
      const s = []; const pops = []; const sp = spacer(16 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x, y, r: R(2.5, 6), vy: R(10, 20), age: 0, life: R(.5, 1), ph: R(0, TAU) }); },
        step(dt, t) {
          for (let i = s.length - 1; i >= 0; i--) { const q = s[i]; q.y -= q.vy * dt; q.age += dt; if (q.age > q.life) { pops.push({ x: q.x + Math.sin(t * 2 + q.ph) * 3, y: q.y, r: q.r, age: 0, life: .3 }); s.splice(i, 1); } }
          cull(pops, dt);
        },
        draw(c, t) {
          c.strokeStyle = P.bubble; c.lineWidth = 1.1; c.lineCap = 'round';
          for (const q of s) { c.globalAlpha = .8; c.beginPath(); c.arc(q.x + Math.sin(t * 2 + q.ph) * 3, q.y, q.r, 0, TAU); c.stroke(); }
          for (const p of pops) { const v = p.age / p.life; c.globalAlpha = 1 - v; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.moveTo(p.x + Math.cos(a) * p.r * (.6 + v), p.y + Math.sin(a) * p.r * (.6 + v)); c.lineTo(p.x + Math.cos(a) * p.r * (1 + v * 1.2), p.y + Math.sin(a) * p.r * (1 + v * 1.2)); } c.stroke(); }
        },
        busy: () => s.length + pops.length > 0,
      };
    } },
    fireflies: { name: 'Fireflies', make(w, h, P, dark, k = 1) {
      let tx = w / 2; let ty = h / 2; let still = 0;
      const f = Array.from({ length: Math.max(3, Math.round(6 * k)) }, () => ({ x: R(0, w), y: R(0, h), k: R(1.2, 3), ox: R(-16, 16), oy: R(-12, 12), ph: R(0, TAU) }));
      return {
        move(x, y) { tx = x; ty = y; still = 0; },
        step(dt, t) { still += dt; for (const q of f) { q.x += (tx + q.ox + Math.sin(t * 2 + q.ph) * 6 - q.x) * q.k * dt; q.y += (ty + q.oy + Math.cos(t * 1.7 + q.ph) * 6 - q.y) * q.k * dt; } },
        draw(c, t) { for (const q of f) glowDot(c, q.x, q.y, 3, P.glow, .55 + .35 * Math.sin(t * 2.4 + q.ph)); },
        busy: () => still < 3, // they keep floating for a moment after the mouse stops
      };
    } },
    ripples: { name: 'Rain', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(28 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x, y, age: 0, life: .9 }); },
        step(dt) { cull(s, dt); },
        draw(c) { c.strokeStyle = P.blue; c.lineWidth = 1.3; for (const q of s) { const v = q.age / q.life; c.globalAlpha = (1 - v) * .7; c.beginPath(); c.arc(q.x, q.y, 3 + v * 22, 0, TAU); c.stroke(); } },
        busy: () => s.length > 0,
      };
    } },
    // little uneven bursts popping behind the pointer, in firework colours; the sparks fall and fade slowly
    fireworks: { name: 'Fireworks', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(34 / k);
      return {
        move(x, y, d) {
          for (let n = sp(d); n > 0; n--) {
            const col = pick(P.fire); const m = Math.round(R(8, 13)); const turn = R(0, TAU);
            for (let i = 0; i < m; i++) { const a = turn + i * TAU / m + R(-.3, .3); const v = 34 * Math.pow(R(.3, 1), .6); s.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: R(.9, 1.4), col, r: R(1.1, 1.7) }); }
          }
        },
        step(dt) { const drag = Math.pow(.5, dt); for (const q of s) { q.vx *= drag; q.vy = q.vy * drag + 26 * dt; q.x += q.vx * dt; q.y += q.vy * dt; } cull(s, dt); },
        draw(c) { for (const q of s) { const v = q.age / q.life; c.globalAlpha = Math.pow(1 - v, 1.3) * .95; c.fillStyle = q.col; dot(c, q.x, q.y, q.r * (1 - v * .35)); } },
        busy: () => s.length > 0,
      };
    } },
    frost: { name: 'Snow', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(18 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x: x + R(-6, 6), y: y + R(-6, 6), s: R(3, 5.5), rot: R(0, TAU), age: 0, life: R(.8, 1.2) }); },
        step(dt) { cull(s, dt); },
        draw(c) { c.strokeStyle = P.snow; c.lineCap = 'round'; c.lineWidth = 1.1; for (const q of s) { const v = q.age / q.life; c.globalAlpha = (1 - v) * .9; flake(c, q.x, q.y, q.s * Math.min(1, v * 4), q.rot + v); } },
        busy: () => s.length > 0,
      };
    } },
    confetti: { name: 'Confetti', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(10 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x, y, vx: R(-25, 25), vy: R(-30, 0), rot: R(0, TAU), vr: R(-8, 8), age: 0, life: R(.8, 1.2), col: pick(P.confetti) }); },
        step(dt) { for (const q of s) { q.vy += 90 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; } cull(s, dt); },
        draw(c) { for (const q of s) { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.globalAlpha = (1 - q.age / q.life) * .9; c.fillStyle = q.col; c.fillRect(-1.6, -3, 3.2, 6); c.restore(); } },
        busy: () => s.length > 0,
      };
    } },
    leaves: { name: 'Autumn leaves', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(26 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) s.push({ x, y, vy: R(14, 22), age: 0, life: R(1.2, 1.7), s: R(3.5, 5.5), ph: R(0, TAU), col: pick(P.leaf) }); },
        step(dt) { for (const q of s) q.y += q.vy * dt; cull(s, dt); },
        draw(c, t) { for (const q of s) { const sw = Math.sin(t * 2.2 + q.ph); c.save(); c.translate(q.x + sw * 8, q.y); c.rotate(sw * .8); c.globalAlpha = (1 - q.age / q.life) * .9; c.fillStyle = q.col; leaf(c, q.s); c.restore(); } },
        busy: () => s.length > 0,
      };
    } },
    // ================================================================ 1.1.20: a follower for every background
    // (the owner's wish: the Mouse tab lists exactly what the Background tab does, with the same names and icons, in
    // the same order; only Pencil line is mouse-only). Each one is a small cousin of its background, made where the
    // pointer goes. Fish, Solar system, Ghost jellyfish and Aquarium are companions: they swim or orbit along with
    // the pointer and fade away a couple of seconds after the mouse stops (fade()).
    plankton: { name: 'Plankton', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(7 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) room(s, 120), s.push({ x: x + R(-9, 9), y: y + R(-9, 9), vx: R(-8, 8), vy: R(-8, 8), age: 0, life: R(1.2, 2), r: R(1.2, 2.3), ph: R(0, TAU) }); },
        step(dt, t) { const dr = Math.pow(.3, dt); for (const q of s) { const a = flow(q.x, q.y, t * .6); q.vx = (q.vx + Math.cos(a) * 8 * dt) * dr; q.vy = (q.vy + Math.sin(a) * 8 * dt) * dr; q.x += q.vx * dt; q.y += q.vy * dt; } cull(s, dt); },
        draw(c, t) {
          const lo = []; const hi = []; const halo = [];
          for (const q of s) { const v = q.age / q.life; const a = (1 - v) * (.75 + .25 * Math.sin(t * 6 + q.ph)); (v < .3 ? hi : lo).push([q.x, q.y, q.r * (1.5 - v * .5), a]); halo.push([q.x, q.y, q.r * 3.2, a]); }
          bucketDots(c, halo, P.tide, 3, dark ? .22 : .14); bucketDots(c, lo, P.tide, 4, .9); bucketDots(c, hi, P.tideHi, 3, .95);
        },
        busy: () => s.length > 0,
      };
    } },
    // stars streak away behind the pointer, as if it jumped to light speed
    warp: { name: 'Warp speed', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(6 / k); let last = null;
      return {
        move(x, y, d) {
          const dx = last ? x - last.x : 0; const dy = last ? y - last.y : 0; last = { x, y };
          const back = Math.atan2(-dy, -dx);
          for (let n = sp(d); n > 0; n--) { room(s, 110); const a = back + R(-.55, .55); const v = R(70, 160); s.push({ x: x + R(-4, 4), y: y + R(-4, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: R(.35, .6), blue: Math.random() < .55 }); }
        },
        step(dt) { const f = 1 + dt * 2.5; for (const q of s) { q.vx *= f; q.vy *= f; q.x += q.vx * dt; q.y += q.vy * dt; } cull(s, dt); },
        draw(c) {
          const blue = []; const white = [];
          for (const q of s) { const v = q.age / q.life; (q.blue ? blue : white).push([q.x, q.y, q.x - q.vx * .07, q.y - q.vy * .07, 1 - v]); }
          c.lineCap = 'round'; c.lineWidth = 1.6; bucketSegs(c, blue, P.warp, 3, .9); c.lineWidth = 1.1; bucketSegs(c, white, P.star, 3, .85);
        },
        busy: () => s.length > 0,
      };
    } },
    // points are dropped along the way and joined by thin lines, to each other and to the pointer
    network: { name: 'Network', make(w, h, P, dark, k = 1) {
      const p = []; const sp = spacer(24 / k); const D = 72; let cur = null; let curA = 0;
      return {
        move(x, y, d) { cur = { x, y }; curA = 1; for (let n = sp(d); n > 0; n--) { p.push({ x: x + R(-14, 14), y: y + R(-14, 14), vx: R(-6, 6), vy: R(-6, 6), age: 0, life: R(1.4, 2.1) }); if (p.length > 26) p.shift(); } },
        step(dt) { curA = Math.max(0, curA - dt * 1.5); for (const q of p) { q.x += q.vx * dt; q.y += q.vy * dt; } cull(p, dt); },
        draw(c) {
          const segs = []; const life = (q) => Math.min(1, (1 - q.age / q.life) * 2);
          const pts = cur && curA > 0 ? p.concat([{ x: cur.x, y: cur.y, age: 0, life: 1, me: true }]) : p;
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
            const a = pts[i]; const b = pts[j]; const dx = a.x - b.x; const dy = a.y - b.y; if (Math.abs(dx) > D || Math.abs(dy) > D) continue;
            const dd = Math.hypot(dx, dy); if (dd >= D) continue;
            segs.push([a.x, a.y, b.x, b.y, (1 - dd / D) * Math.min(a.me ? curA : life(a), b.me ? curA : life(b))]);
          }
          c.lineWidth = .9; bucketSegs(c, segs, P.net, 4, dark ? .75 : .65);
          bucketDots(c, p.map((q) => [q.x, q.y, 1.8, life(q)]), P.netNode, 3, .9);
        },
        busy: () => p.length > 0 || curA > 0,
      };
    } },
    // sparks fly up from the pointer, wobbling on the hot air and cooling from yellow to red
    // 1.1.22: it keeps glowing while the pointer rests on the note (a little campfire at the pointer), not only while it moves
    embers: { name: 'Embers', make(w, h, P, dark, k = 1) {
      const e = []; const sp = spacer(8 / k); let px = 0; let py = 0; let inside = false; let acc = 0;
      const add = (x, y) => { room(e, 110); e.push({ x: x + R(-4, 4), y: y + R(-3, 3), vx: R(-10, 10), vy: -R(22, 46), age: 0, life: R(.9, 1.6), r: R(.9, 2), fl: R(8, 18), ph: R(0, TAU) }); };
      return {
        move(x, y, d) { px = x; py = y; inside = true; for (let n = sp(d); n > 0; n--) add(x, y); },
        leave() { inside = false; },
        step(dt, t) {
          if (inside) { acc += dt * 7 * clamp(k, .5, 2.6); while (acc >= 1) { acc -= 1; add(px, py); } }
          const dr = Math.pow(.5, dt); for (const q of e) { const a = flow(q.x, q.y * 1.3, t * 1.4, .02); q.vx = (q.vx + Math.cos(a) * 30 * dt) * dr; q.vy -= 6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; } cull(e, dt); },
        draw(c, t) {
          const cols = [[], [], []]; const halo = [];
          for (const q of e) { const v = q.age / q.life; const a = Math.pow(1 - v, .7) * (.6 + .4 * Math.sin(t * q.fl + q.ph)); cols[v < .25 ? 2 : v < .6 ? 1 : 0].push([q.x, q.y, q.r, a]); halo.push([q.x, q.y, q.r * 3, a]); }
          bucketDots(c, halo, P.ember[1], 3, dark ? .3 : .2);
          cols.forEach((g, i) => bucketDots(c, g, P.ember[i], 3, .95));
        },
        busy: () => inside || e.length > 0,
      };
    } },
    // petals drop from the pointer and flutter down, flipping over
    blossom: { name: 'Cherry blossom', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(20 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) room(s, 60), s.push({ x: x + R(-5, 5), y: y + R(-4, 4), vx: R(-10, 14), vy: R(10, 20), rot: R(0, TAU), vr: R(-2, 2), fp: R(0, TAU), fs: R(2, 4), s: R(3.5, 5.5), age: 0, life: R(1.5, 2.1), col: pick(P.blossom) }); },
        step(dt, t) { for (const q of s) { q.x += (q.vx + Math.sin(t * 2 + q.fp) * 8) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.fp += q.fs * dt; } cull(s, dt); },
        draw(c) {
          for (const q of s) {
            const cf = Math.cos(q.fp); const v = q.age / q.life;
            c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(1, cf * .9 + (cf < 0 ? -.1 : .1));
            c.globalAlpha = .9 * Math.min(1, (1 - v) * 2.5); c.fillStyle = q.col; petal(c, q.s * Math.min(1, .5 + v * 5)); c.restore();
          }
        },
        busy: () => s.length > 0,
      };
    } },
    // the pointer is a shooting star: a bright head with a fading tail, leaving little stars that twinkle out
    nightsky: { name: 'Night sky', make(w, h, P, dark, k = 1) {
      const s = []; const tail = []; const sp = spacer(13 / k);
      return {
        move(x, y, d) {
          tail.push({ x, y, age: 0, life: .32 }); if (tail.length > 40) tail.shift();
          for (let n = sp(d); n > 0; n--) room(s, 70), s.push({ x: x + R(-10, 10), y: y + R(-10, 10), r: .5 + Math.pow(Math.random(), 2.5) * 1.4, f: R(4, 9), ph: R(0, TAU), age: 0, life: R(1, 1.9) });
        },
        step(dt) { cull(s, dt); cull(tail, dt); },
        draw(c, t) {
          c.fillStyle = P.skyStar;
          for (const q of s) {
            const v = q.age / q.life; const a = Math.sin(Math.PI * Math.min(1, v * 1.6 + .1)) * (.6 + .4 * Math.sin(t * q.f + q.ph)) * .9;
            c.globalAlpha = a; dot(c, q.x, q.y, q.r);
            if (q.r > 1.1) { c.globalAlpha = a * .5; c.fillRect(q.x - q.r * 3, q.y - .35, q.r * 6, .7); c.fillRect(q.x - .35, q.y - q.r * 3, .7, q.r * 6); }
          }
          if (tail.length > 1) {
            const hd = tail[tail.length - 1]; const tl = tail[0];
            if (Math.hypot(hd.x - tl.x, hd.y - tl.y) > 3) {
              const g = c.createLinearGradient(hd.x, hd.y, tl.x, tl.y); g.addColorStop(0, P.shoot); g.addColorStop(1, 'transparent');
              c.globalAlpha = .9 * (1 - hd.age / hd.life); c.strokeStyle = g; c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
              c.beginPath(); c.moveTo(tl.x, tl.y); for (const q of tail) c.lineTo(q.x, q.y); c.stroke();
              c.globalAlpha = 1 - hd.age / hd.life; c.fillStyle = P.skyStar; dot(c, hd.x, hd.y, 1.5);
            }
          }
        },
        busy: () => s.length + tail.length > 0,
      };
    } },
    // 1.1.22 (the owner picked "Phosphor pixels" from three versions; the old afterimage scanlines are gone): where the
    // pointer passes, the screen's tiny red, green and blue phosphor stripes light up, flicker and fade, as if you'd put
    // a magnifying glass on an old TV
    glitch: { name: 'Analog monitor', make(w, h, P, dark, k = 1) {
      const G = 6; const cells = new Map(); const sp = spacer(3 / k);
      const COLS = dark ? ['#FF4A55', '#4AFF7A', '#4A8AFF'] : ['#D8202E', '#1A9A3A', '#1E50D8'];
      return {
        move(x, y, d) {
          for (let n = Math.max(1, sp(d)); n > 0; n--) for (let i = 0; i < 3; i++) {
            const cx = Math.floor((x + R(-10, 10)) / G); const cy = Math.floor((y + R(-10, 10)) / (G * 1.4)); const key = cx * 10000 + cy;
            if (cells.size >= 260 && !cells.has(key)) cells.delete(cells.keys().next().value); cells.set(key, { cx, cy, age: 0, life: R(.7, 1.2), ph: R(0, TAU) });
          }
        },
        step(dt) { for (const [key, q] of cells) { q.age += dt; if (q.age > q.life) cells.delete(key); } },
        draw(c, t) {
          const B = 3; const groups = COLS.map(() => Array.from({ length: B }, () => []));
          for (const q of cells.values()) {
            const v = q.age / q.life; const a = (1 - v) * (.75 + .25 * Math.sin(t * 30 + q.ph)); const bin = Math.min(B - 1, Math.floor(clamp(a, 0, .999) * B));
            for (let j = 0; j < 3; j++) groups[j][bin].push([q.cx * G + j * 2, q.cy * G * 1.4]);
          }
          COLS.forEach((col, j) => { c.fillStyle = col; groups[j].forEach((g, i) => { if (!g.length) return; c.globalAlpha = (i + .5) / B * (dark ? .9 : .8); c.beginPath(); for (const [x, y] of g) c.rect(x, y, 1.5, G * 1.1); c.fill(); }); });
        },
        busy: () => cells.size > 0,
      };
    } },
    // 1.1.22 (the owner picked "Surf" from three versions): a wave of dots rises behind the pointer, curls over and
    // breaks into foam, throwing spray. (1.1.22, second round: it used to keep only the last 36 slices, so at a normal
    // mouse speed the wave was cut off before it could curl and break; and its curl direction flickered with every tiny
    // wobble of the mouse. Now it keeps up to 140 slices (spaced a bit wider when the mouse is fast) and takes the
    // direction from the last 14 px of the path.)
    ocean: { name: 'Digital ocean', make(w, h, P, dark, k = 1) {
      const rows = []; const spray = []; let acc = 0; let anchor = null; let dir = 1;
      return {
        move(x, y, d) {
          if (!anchor) anchor = { x, y };
          const ax = x - anchor.x; if (Math.hypot(ax, y - anchor.y) > 14) { if (Math.abs(ax) > 5) dir = ax > 0 ? 1 : -1; anchor = { x, y }; }
          const gap = (rows.length > 100 ? 11 : 7) / k; acc += d;
          let n = 0; while (acc >= gap && n < 8) { acc -= gap; n++; } if (n === 8) acc = 0;
          for (; n > 0; n--) { rows.push({ x, y: y + 6, s: dir, age: 0, life: R(1, 1.3), ph: R(0, TAU) }); if (rows.length > 140) rows.shift(); if (spray.length < 60 && Math.random() < .45) spray.push({ x, y: y - 6, vx: dir * R(15, 45) + R(-10, 10), vy: -R(30, 70), age: 0, life: R(.5, .8) }); }
        },
        step(dt) { cull(rows, dt); for (const q of spray) { q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt; } cull(spray, dt); },
        draw(c) {
          const lo = []; const hi = [];
          for (const r of rows) {
            const v = r.age / r.life; const Hh = 18 * Math.sin(Math.PI * Math.min(1, v * 1.5)); const curl = clamp((v - .2) / .45, 0, 1) * 2.8; const fall = clamp((v - .7) / .3, 0, 1);
            for (let j = 0; j <= 4; j++) {
              const f = j / 4; const rr = f * Hh; const th = curl * Math.pow(f, 1.4); const fo = fall * (j + 1) * 3;
              const x = r.x + Math.sin(th) * rr * r.s + Math.sin(r.ph + j * 2.1) * fo; const y = r.y - Math.cos(th) * rr + fo * .6;
              (j >= 3 && fall < .5 ? hi : lo).push([x, y, 1 + (1 - f) * .4, (1 - v * .7) * (.5 + .5 * f)]);
            }
          }
          for (const q of spray) hi.push([q.x, q.y, .9, 1 - q.age / q.life]);
          bucketDots(c, lo, P.wave, 4, dark ? .9 : .8); bucketDots(c, hi, P.waveHi, 3, .95);
        },
        busy: () => rows.length + spray.length > 0,
      };
    } },
    // three ribbons of glittering dots weave along behind the pointer
    silk: { name: 'Silk waves', make(w, h, P, dark, k = 1) {
      const pts = []; let last = null; const life = .7 + .35 * clamp(k, .35, 2.6);
      return {
        move(x, y) {
          if (last) { const n = Math.min(8, Math.floor(Math.hypot(x - last.x, y - last.y) / 4)); for (let i = 1; i < n; i++) pts.push({ x: last.x + (x - last.x) * i / n, y: last.y + (y - last.y) * i / n, age: 0, life }); }
          pts.push({ x, y, age: 0, life }); last = { x, y }; while (pts.length > 90) pts.shift();
        },
        step(dt) { cull(pts, dt); if (!pts.length) last = null; },
        draw(c, t) {
          const groups = [[], [], []];
          for (let i = 1; i < pts.length - 1; i++) {
            const a = pts[i - 1]; const b = pts[i + 1]; const q = pts[i]; let nx = -(b.y - a.y); let ny = b.x - a.x; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
            const v = q.age / q.life;
            for (let j = 0; j < 3; j++) {
              const off = Math.sin(i * .35 - t * 5 + j * 2.1) * 7 * (1 - v * .5); const sh = .5 + .5 * Math.sin(i * .6 + t * 4 + j);
              groups[j].push([q.x + nx * off, q.y + ny * off, .7 + sh * .9, (1 - v) * (.25 + .75 * sh)]);
            }
          }
          groups.forEach((g, i) => bucketDots(c, g, P.silk[i], 4, dark ? .9 : .8));
        },
        busy: () => pts.length > 0,
      };
    } },
    // little pieces of coloured glass fall from the pointer, turning in 3D and flashing when they face you
    shards: { name: 'Glass shards', make(w, h, P, dark, k = 1) {
      const s = []; const sp = spacer(26 / k);
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) room(s, 28), s.push({ x, y, vx: R(-18, 18), vy: R(-14, 4), rot: R(0, TAU), vr: R(-2, 2), th: R(0, TAU), vt: R(2.5, 5) * (Math.random() < .5 ? -1 : 1), hue: R(0, 360), pts: shard(.65), age: 0, life: R(1.1, 1.7) }); },
        step(dt) { for (const q of s) { q.vy += 40 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.th += q.vt * dt; } cull(s, dt); },
        draw(c, t) {
          for (const q of s) {
            const cs = Math.cos(q.th); const face = Math.abs(cs); const fade = Math.min(1, (1 - q.age / q.life) * 2.5);
            c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.scale(cs || .01, 1);
            c.beginPath(); q.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
            const hue = q.hue + q.th * 50 + t * 12; const r = 9;
            const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, hsla(hue, P.shardS, P.shardL, 1)); g.addColorStop(1, hsla(hue + 150, P.shardS, P.shardL, 1));
            c.globalAlpha = (dark ? .45 : .5) * (.5 + face * .5) * fade; c.fillStyle = g; c.fill();
            c.globalAlpha = .7 * fade; c.strokeStyle = face > .9 ? P.shardGlint : P.shardEdge; c.lineWidth = .8 / Math.max(.2, face); c.stroke();
            c.restore();
          }
        },
        busy: () => s.length > 0,
      };
    } },
    // the pointer is the invisible something: a field of dots shows up around it, parts to let it through and
    // wobbles back into place behind it
    ghost: { name: 'Ghost ripple', make(w, h, P, dark, k = 1) {
      const d = dotLattice(w, h, clamp(15 / Math.sqrt(Math.max(.35, k)), 10, 22)); const RG = 30; const SEE = 95;
      let gx = -999; let gy = -999; let heat = 0; let live = 0;
      return {
        move(x, y) { gx = x; gy = y; heat = 1; },
        step(dt) {
          heat = Math.max(0, heat - dt * .8); const damp = Math.exp(-2.4 * dt); live = 0;
          for (const q of d) {
            const dx = q.x - gx; const dy = q.y - gy; const dd = Math.hypot(dx, dy) || 1; q.near = dd < SEE ? (1 - dd / SEE) * heat : 0;
            if (dd < RG && heat > .5) { const f = (1 - dd / RG) ** 2 * 1100; q.vx += dx / dd * f * dt; q.vy += dy / dd * f * dt; }
            if (q.b > .01 || q.vx || q.vy) { q.vx += (q.bx - q.x) * 7 * dt; q.vy += (q.by - q.y) * 7 * dt; q.vx *= damp; q.vy *= damp; q.x += q.vx * dt; q.y += q.vy * dt; if (Math.abs(q.vx) + Math.abs(q.vy) < .02 && Math.abs(q.x - q.bx) + Math.abs(q.y - q.by) < .05) { q.vx = 0; q.vy = 0; q.x = q.bx; q.y = q.by; } }
            q.b = clamp(Math.hypot(q.x - q.bx, q.y - q.by) / 9, 0, 1); if (q.b > .02) live++;
          }
        },
        draw(c) {
          const lo = []; const hi = [];
          for (const q of d) { const a = Math.min(1, q.near * .8 + q.b); if (a < .03) continue; (q.b > .45 ? hi : lo).push([q.x, q.y, 1.05 + q.b * .9, a]); }
          bucketDots(c, lo, P.ripple, 4, dark ? .8 : .75); bucketDots(c, hi, P.rippleHi, 3, dark ? .95 : .9);
        },
        busy: () => heat > 0 || live > 0,
      };
    } },
    // a little school swims along with the pointer, circling it, and drifts away when the mouse rests
    fish: { name: 'Fish', make(w, h, P, dark, k = 1) {
      const pr = presence(); let tx = w / 2; let ty = h / 2;
      const b = Array.from({ length: clamp(Math.round(4 * k), 2, 9) }, (_, i) => Object.assign(fishNew(tx, ty, R(0, TAU), R(10, 12.5), i % 3), { or: R(14, 34), oa: R(0, TAU), od: Math.random() < .5 ? 1 : -1 }));
      return {
        move(x, y) {
          tx = x; ty = y;
          if (pr.moved()) for (const q of b) { const a = R(0, TAU); const r = R(25, 45); Object.assign(q, fishNew(x + Math.cos(a) * r, y + Math.sin(a) * r, a + Math.PI / 2 * q.od, q.BL, q.g)); }
        },
        step(dt) {
          pr.step(dt);
          for (const q of b) {
            q.oa += q.od * dt * .9;
            const gx = tx + Math.cos(q.oa) * q.or; const gy = ty + Math.sin(q.oa) * q.or * .7;
            let ax = (gx - q.x) * 4 - q.vx * 1.6; let ay = (gy - q.y) * 4 - q.vy * 1.6;
            for (const r of b) { if (r === q) continue; const dx = q.x - r.x; const dy = q.y - r.y; const d2 = dx * dx + dy * dy; if (d2 < 144 && d2 > 0) { const dd = Math.sqrt(d2); ax += dx / dd * (12 - dd) * 25; ay += dy / dd * (12 - dd) * 25; } }
            q.vx += ax * dt; q.vy += ay * dt;
            const sp = Math.hypot(q.vx, q.vy); if (sp > 160) { q.vx *= 160 / sp; q.vy *= 160 / sp; }
            q.x += q.vx * dt; q.y += q.vy * dt; fishBend(q, dt, 1);
          }
        },
        draw(c) { if (pr.vis > 0) fishDraw(c, b, P, dark, 1); },
        fade: () => pr.vis,
        busy: pr.busy,
      };
    } },
    // a soft beam of light follows the pointer; dust it stirs up floats about and sparkles when it's in the beam
    dust: { name: 'Dust in light', make(w, h, P, dark, k = 1) {
      // 1.1.22: only the dust now (no beam of light): specks swirl up off the pointer, drift and twinkle out
      // 1.1.22, fifth round (the owner: "less frequency, the Rarely should be the Often"): the whole scale moved down, so the old
      // "Rarely" amount (k .35) is now "Often", "Normal" is about 1/7 of what it was and "Rarely" about 1/21
      const m = []; const sp = spacer(6 / (k * (.35 / 2.6) * 1.2)); // (sixth round: 20 % more at every setting)
      return {
        move(x, y, d) { for (let n = sp(d); n > 0; n--) room(m, 110), m.push({ x: x + R(-12, 12), y: y + R(-12, 12), vx: R(-8, 8), vy: R(-8, 6), z: Math.random(), ph: R(0, TAU), age: 0, life: R(1.5, 2.6) }); },
        step(dt) { const damp = Math.exp(-1.2 * dt); for (const q of m) { q.vx = (q.vx + R(-1, 1) * 12 * dt) * damp; q.vy = (q.vy + (R(-1, 1) * 12 - 3) * dt) * damp; q.x += q.vx * dt; q.y += q.vy * dt; } cull(m, dt); },
        draw(c, t) {
          c.fillStyle = P.dust;
          for (const q of m) {
            const v = q.age / q.life; const tw = .6 + .4 * Math.sin(t * 3 + q.ph); const a = Math.min(1, (1 - v) * 2) * (dark ? .75 : .7) * tw; const r = .6 + q.z * 1.4;
            if (q.z > .8) { c.globalAlpha = a * .35; dot(c, q.x, q.y, r * 2.2); } c.globalAlpha = a; dot(c, q.x, q.y, r);
          }
        },
        busy: () => m.length > 0,
      };
    } },
    // 1.1.22: just floating heals: little green and gold crosses drift up from the pointer, sway, softly glow and fade
    // (second round: a steady stream by time while the mouse moves, not by distance with a cap, which came in bursts and gaps)
    heal: { name: 'Healing aura', make(w, h, P, dark, k = 1) {
      const f = []; let px = 0; let py = 0; let still = 9; let acc = 0;
      return {
        move(x, y, d) { px = x; py = y; if (d > 0) still = 0; },
        step(dt, t) {
          still += dt;
          if (still < .25) { acc += dt * 9 * clamp(k, .35, 2.6); while (acc >= 1) { acc -= 1; if (f.length < 60) f.push({ x: px + R(-8, 8), y: py + R(-5, 5), vy: R(16, 30), ph: R(0, TAU), c: Math.random() < .6 ? 0 : 1, s: R(2.2, 3.6), age: 0, life: R(1.1, 1.7) }); } } else acc = 0;
          for (const q of f) { q.y -= q.vy * dt; q.x += Math.sin(t * 2 + q.ph) * 9 * dt; } cull(f, dt);
        },
        draw(c, t) {
          for (const q of f) {
            const v = q.age / q.life; const a = Math.min(1, v * 6, (1 - v) * 2.2) * (.75 + .25 * Math.sin(t * 3 + q.ph)); const s = q.s * (.7 + .3 * Math.min(1, v * 4)); const col = P.heal[q.c];
            c.globalAlpha = a * (dark ? .3 : .22); c.fillStyle = col; const g = s * 1.9; c.fillRect(q.x - g, q.y - g * .38, g * 2, g * .76); c.fillRect(q.x - g * .38, q.y - g, g * .76, g * 2);
            c.globalAlpha = a; c.fillRect(q.x - s, q.y - s * .3, s * 2, s * .6); c.fillRect(q.x - s * .3, q.y - s, s * .6, s * 2);
            c.globalAlpha = a * .8; c.fillStyle = P.healHi; c.fillRect(q.x - s * .55, q.y - s * .1, s * 1.1, s * .2); c.fillRect(q.x - s * .1, q.y - s * .55, s * .2, s * 1.1);
          }
        },
        busy: () => still < .25 || f.length > 0,
      };
    } },
    // 1.1.22: the pointer builds a lightning bolt as it goes. A faint, flickering, jagged "leader" (one single line, as
    // long as the path, no forks) grows along behind it, and the pointer's tip glows brighter as it charges; 1.5 seconds
    // after it started, the bolt strikes: a bright stroke races back along it from the far end to the pointer, flashes,
    // flickers and goes out. Half a second later (it was a second) the next one can start building.
    lightning: { name: 'Lightning', make(w, h, P, dark, k = 1) {
      const CHARGE = 1.5; const GAP = 7; const MAXP = 2000; const REST = .5; // MAXP: only a safety net, so the line is as long as the path
      let lead = null; let strike = null; let rest = 0; const sparks = []; const ss = spacer(12 / k); let tip = null;
      const toStrike = (L) => {
        const pts = []; for (let i = 0; i < L.pts.length; i++) { const q = L.pts[i]; pts.push([q.x, q.y]); const z = L.pts[i + 1]; if (z) { const mx = (q.x + z.x) / 2; const my = (q.y + z.y) / 2; const dx = z.x - q.x; const dy = z.y - q.y; const d = Math.hypot(dx, dy) || 1; const o = R(-3, 3); pts.push([mx - dy / d * o, my + dx / d * o]); } }
        let len = 0; const cum = [0]; for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(len); }
        return { pts, cum, len, age: 0, life: .8 };
      };
      const leadLen = (L) => { let n = 0; for (let i = 1; i < L.pts.length; i++) n += Math.hypot(L.pts[i].x - L.pts[i - 1].x, L.pts[i].y - L.pts[i - 1].y); return n; };
      const poly = (c, pts, upto) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < upto; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); };
      return {
        move(x, y, d) {
          tip = { x, y };
          if (rest > 0) return; // resting after a strike
          if (!lead) lead = { pts: [{ x, y }], age: 0 };
          const L = lead.pts; const last = L[L.length - 1]; const dx = x - last.x; const dy = y - last.y; const dd = Math.hypot(dx, dy);
          if (dd >= GAP) {
            const n = Math.min(8, Math.floor(dd / GAP)); const nx = -dy / dd; const ny = dx / dd;
            for (let i = 1; i <= n; i++) { const j = i === n ? 0 : R(-4.5, 4.5); L.push({ x: last.x + dx * i / n + nx * j, y: last.y + dy * i / n + ny * j }); }
            while (L.length > MAXP) L.shift();
          }
          for (let m = ss(d); m > 0; m--) if (sparks.length < 24) sparks.push({ x: x + R(-12, 12), y: y + R(-12, 12), age: 0, life: R(.2, .45) });
        },
        step(dt) {
          if (lead) {
            lead.age += dt;
            if (lead.age > CHARGE) { if (lead.pts.length > 3 && leadLen(lead) > 40) { strike = toStrike(lead); lead = null; rest = REST + strike.life; } else if (lead.age > CHARGE + 1.5) lead = null; }
          }
          if (strike) { strike.age += dt; if (strike.age > strike.life) strike = null; }
          rest = Math.max(0, rest - dt);
          cull(sparks, dt);
        },
        draw(c) {
          c.lineCap = 'round'; c.lineJoin = 'round';
          bucketDots(c, sparks.map((s) => [s.x, s.y, .9, (1 - s.age / s.life) * (Math.random() < .5 ? 1 : .4)]), P.lightningHi, 3, .9);
          if (lead && lead.pts.length > 1) { // the leader: faint and restless
            const ch = clamp(lead.age / CHARGE, 0, 1); const fl = .22 + Math.random() * .25 + ch * .15;
            const pts = lead.pts.map((q) => [q.x + R(-.8, .8), q.y + R(-.8, .8)]);
            c.strokeStyle = P.lightning; c.lineWidth = 3; c.globalAlpha = fl * (dark ? .3 : .2); poly(c, pts, pts.length);
            c.strokeStyle = P.lightningHi; c.lineWidth = 1; c.globalAlpha = fl; poly(c, pts, pts.length);
            if (tip) glow2(c, tip.x, tip.y, 2.5 + ch * 3, P.lightning, P.lightningHi, .35 + ch * .6, dark ? .6 : .45); // the tip charges up
          }
          if (strike) {
            const u = strike.age; const RUN = .11; // the stroke races from the far end to the pointer, then flashes and flickers out
            const reach = clamp(u / RUN, 0, 1) * strike.len; let upto = 1; while (upto < strike.pts.length && strike.cum[upto] <= reach) upto++;
            const fl = u < RUN ? 1 : u < .4 ? (Math.random() < .55 ? 1 : .4) : 1 - (u - .4) / (strike.life - .4);
            c.strokeStyle = P.lightning; c.lineWidth = 6; c.globalAlpha = fl * (dark ? .3 : .2); poly(c, strike.pts, upto);
            c.strokeStyle = P.lightningHi; c.lineWidth = 1.8; c.globalAlpha = fl; poly(c, strike.pts, upto);
            if (u >= RUN) {
              const e = strike.pts[strike.pts.length - 1]; glow2(c, e[0], e[1], 7, P.lightning, P.lightningHi, fl, dark ? .7 : .5);
            } else { const e = strike.pts[upto - 1]; glow2(c, e[0], e[1], 4, P.lightning, P.lightningHi, 1, .6); }
          }
        },
        busy: () => !!lead || !!strike || rest > 0 || sparks.length > 0,
      };
    } },
    // potion bubbles rise from the pointer and burst into droplets and little stars, with a puff of coloured steam.
    // 1.1.22: a steady stream (by time, not by distance, so it never comes in bursts and gaps), a little potion glow at
    // the pointer, and it bubbles on for a moment after the mouse stops, then calms down
    cauldron: { name: 'Cauldron', make(w, h, P, dark, k = 1) {
      const COL = Math.floor(R(0, 2)); const bub = []; const drops = []; const stars = []; const steam = [];
      let px = 0; let py = 0; let still = 9; let act = 0; let acc = 0; let moved = 0; let spd = 0;
      return {
        move(x, y, d) { px = x; py = y; if (d > 0) { still = 0; moved += d; } },
        step(dt, t) {
          still += dt; spd += (moved / Math.max(dt, .001) - spd) * Math.min(1, dt * 5); moved = 0;
          act = still < .3 ? Math.min(1, act + dt * 4) : Math.max(0, act - dt * .9);
          acc += dt * act * (5 + Math.min(7, spd / 70)) * clamp(k, .35, 2.6);
          while (acc >= 1) { acc -= 1; if (bub.length < 36) bub.push({ x: px + R(-6, 6), y: py + R(-3, 3), r: R(2.4, 5), vy: R(14, 26), ph: R(0, TAU), age: 0, life: R(.7, 1.2), c: Math.random() < .7 ? COL : 1 - COL }); }
          for (let i = bub.length - 1; i >= 0; i--) {
            const q = bub[i]; q.age += dt; q.y -= q.vy * dt; q.x += Math.sin(t * 4 + q.ph) * 8 * dt;
            if (q.age > q.life) {
              for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + R(-1.3, 1.3); const v = R(25, 55); if (drops.length < 60) drops.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: R(.4, .7), c: q.c }); }
              if (Math.random() < .45 && stars.length < 30) for (let j = 0; j < 4; j++) { const a = j * TAU / 4 + R(-.3, .3); stars.push({ x: q.x, y: q.y, vx: Math.cos(a) * 32, vy: Math.sin(a) * 32, age: 0, life: .6 }); }
              if (steam.length < 8 && Math.random() < .35) steam.push({ x: q.x, y: q.y, r: R(5, 8), age: 0, life: R(.8, 1.2) });
              bub.splice(i, 1);
            }
          }
          for (const q of drops) { q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt; } cull(drops, dt);
          const dr = Math.pow(.15, dt); for (const s of stars) { s.vx *= dr; s.vy *= dr; s.x += s.vx * dt; s.y += s.vy * dt; } cull(stars, dt);
          for (const s of steam) { s.y -= 18 * dt; s.r += 9 * dt; } cull(steam, dt);
        },
        draw(c, t) {
          if (act > 0) glow2(c, px, py + 3, 5, P.brew[COL], P.brewHi, act * (.35 + .1 * Math.sin(t * 6)), dark ? .7 : .5);
          for (const s of steam) {
            const u = s.age / s.life;
            c.globalAlpha = Math.sin(Math.PI * u) * (dark ? .4 : .3); stamp(c, soft(P.brew[COL]), s.x, s.y, s.r);
          }
          for (const q of bub) {
            const u = q.age / q.life; const r = q.r * (.4 + .6 * Math.min(1, u * 2.5)); const a = Math.min(1, u * 6);
            c.globalAlpha = .5 * a; c.fillStyle = P.brew[q.c]; dot(c, q.x, q.y, r);
            c.globalAlpha = .9 * a; c.strokeStyle = P.brewHi; c.lineWidth = 1; c.beginPath(); c.arc(q.x, q.y, r * .7, Math.PI * 1.15, Math.PI * 1.6); c.stroke();
          }
          bucketDots(c, drops.map((q) => [q.x, q.y, 1.3, 1 - q.age / q.life]), P.brew[COL], 3, .95);
          c.fillStyle = P.brewHi; for (const s of stars) { c.globalAlpha = 1 - s.age / s.life; star4(c, s.x, s.y, 2.2); }
        },
        busy: () => act > 0 || bub.length + drops.length + stars.length + steam.length > 0,
      };
    } },
    // a little ghost jellyfish made of dots follows the pointer in pushes, tendrils trailing, leaving glowing dots
    jelly: { name: 'Ghost jellyfish', make(w, h, P, dark, k = 1) {
      const pr = presence(); const J = 24; let tx = w / 2; let ty = h / 2; const q = { x: tx, y: ty, hist: [] }; const trail = []; let drop = 0; const ph = R(0, TAU);
      return {
        move(x, y) { tx = x; ty = y + J * .2; if (pr.moved()) { q.x = tx; q.y = ty + 20; q.hist = []; } },
        step(dt, t) {
          pr.step(dt);
          const push = .45 + .55 * Math.max(0, Math.sin(t * 3 + ph)); const f = Math.min(1, dt * 3.5 * push);
          const ox = q.x; const oy = q.y; q.x += (tx - q.x) * f; q.y += (ty - q.y) * f;
          q.hist.unshift([q.x, q.y]); if (q.hist.length > 30) q.hist.pop();
          drop += Math.hypot(q.x - ox, q.y - oy) * clamp(k, .35, 2.6); if (drop > 9 && trail.length < 50) { drop = 0; trail.push({ x: q.x + R(-J * .3, J * .3), y: q.y + R(0, J * .2), age: 0, life: R(1, 1.8) }); }
          cull(trail, dt);
        },
        draw(c, t) {
          const lo = []; const hi = [];
          for (const d of trail) lo.push([d.x, d.y, 1.1, (1 - d.age / d.life) * .8]);
          if (pr.vis > 0) {
            const pu = Math.sin(t * 3 + ph); const bw = J * (.5 + .08 * pu); const bh = J * (.42 - .06 * pu);
            for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; hi.push([q.x + Math.cos(a) * bw, q.y + Math.sin(a) * bh, 1.3, .65 + .3 * Math.sin(t * 3 + i)]); }
            for (let i = 0; i < 6; i++) { const a = Math.PI * (1.18 + i * .11); hi.push([q.x + Math.cos(a) * bw * .55, q.y + Math.sin(a) * bh * .55, .9, .35]); }
            for (let tdl = 0; tdl < 4; tdl++) {
              const off = (tdl / 3 - .5) * bw * 1.2;
              for (let s = 1; s <= 7; s++) { const hp = q.hist[Math.min(q.hist.length - 1, s * 3)] || [q.x, q.y]; hi.push([q.x + off * (1 - s * .05) + (hp[0] - q.x) * .6 + Math.sin(t * 3 - s * .6 + tdl * 1.3) * (1.2 + s * .7), q.y + s * J * .13 + (hp[1] - q.y) * .3, 1.05 - s * .06, .75 - s * .08]); }
            }
          }
          bucketDots(c, lo, P.sea[1], 4, dark ? .75 : .65); bucketDots(c, hi, P.sea[0], 4, dark ? .95 : .85);
        },
        fade: () => pr.vis,
        busy: pr.busy,
      };
    } },
    // eerie green flames lick up from the pointer, throwing a few sparks. 1.1.22: it burns the whole time the pointer is
    // on the note, also while it rests (a little green flame at the pointer); moving it trails more flames
    fel: { name: 'Fel fire', make(w, h, P, dark, k = 1) {
      const p = []; const sp = spacer(3.5 / k); let px = 0; let py = 0; let inside = false; let acc = 0;
      const add = (x, y, still) => { room(p, 170); p.push({ x: x + R(-5, 5), y: y + R(-2, 4), vx: 0, vy: -R(40, 70) * (still ? .7 : 1), tx: x, age: 0, life: R(.4, .8) * (still ? .85 : 1), spark: Math.random() < .07 }); };
      return {
        move(x, y, d) { px = x; py = y; inside = true; for (let n = sp(d); n > 0; n--) add(x, y, false); },
        leave() { inside = false; },
        step(dt, t) {
          if (inside) { acc += dt * 40 * clamp(k, .5, 2); while (acc >= 1) { acc -= 1; add(px, py, true); } }
          for (const q of p) { q.vx += ((q.tx - q.x) * 2.2 + Math.sin(t * 9 + q.y * .05) * 18) * dt; if (q.spark) q.vx += R(-60, 60) * dt; q.x += q.vx * dt; q.y += q.vy * dt; } cull(p, dt);
        },
        draw(c) {
          const core = []; const mid = []; const out = [];
          for (const q of p) { const v = q.age / q.life; const r = q.spark ? .9 : 3 * (1 - v * .75); (v < .3 ? core : v < .65 ? mid : out).push([q.x, q.y, r, q.spark ? 1 : Math.sqrt(1 - v) * .9]); }
          bucketDots(c, out, P.fel[0], 3, dark ? .75 : .65); bucketDots(c, mid, P.fel[1], 3, dark ? .9 : .8); bucketDots(c, core, P.felHi, 3, .92);
        },
        busy: () => inside || p.length > 0,
      };
    } },
    pencil: { name: 'Pencil line', make(w, h, P, dark, k = 1) {
      const pts = [];
      return {
        move(x, y) { pts.push({ x: x + R(-.6, .6), y: y + R(-.6, .6), age: 0, life: 1.2 * (.6 + .4 * k) }); if (pts.length > 90) pts.shift(); },
        step(dt) { cull(pts, dt); },
        draw(c) { c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = 1.2; for (let i = 1; i < pts.length; i++) { const v = pts[i].age / pts[i].life; c.globalAlpha = (1 - v) * .75; c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke(); } },
        busy: () => pts.length > 0,
      };
    } },
    // Matrix: characters appear just where the pointer went (on the same grid as the background), flicker a
    // little, and fade from a pale head to green, like the background's trails
    matrix: { name: 'Matrix', make(w, h, P, dark, k = 1) {
      const size = 13; const cells = new Map(); const sp = spacer(7 / k); let last = null;
      const add = (x, y) => {
        const cx = Math.round(x / size); const cy = Math.round(y / size);
        const id = cx * 10000 + cy; const old = cells.get(id);
        if (old && old.age < .25) return;
        cells.set(id, { x: w - cx * size, y: cy * size + size * .35, ch: glyph(), age: 0, life: R(1.1, 1.7) });
      };
      return {
        move(x, y, d) {
          const n = sp(d);
          if (n && last) for (let i = 1; i <= n; i++) add(last.x + (x - last.x) * i / n, last.y + (y - last.y) * i / n);
          else if (n) add(x, y);
          last = { x, y };
        },
        step(dt) {
          for (const [id, q] of cells) { q.age += dt; if (Math.random() < dt * 3) q.ch = glyph(); if (q.age > q.life) cells.delete(id); }
        },
        draw(c) {
          mirror(c, w, size);
          for (const q of cells.values()) {
            const v = q.age / q.life;
            if (v < .12) { c.globalAlpha = .95; c.fillStyle = P.codeHead; }
            else { c.globalAlpha = .95 * Math.pow(1 - v, 1.2); c.fillStyle = v < .4 ? P.code : P.codeDim; }
            c.fillText(q.ch, q.x, q.y);
          }
        },
        busy: () => cells.size > 0,
      };
    } },
  };
  // 1.1.22, fifth round (the owner picked "Option A", then moved a few): the pickers list the effects grouped by theme, so alike
  // ones sit next to each other (weather with Rainbow after Rain; leaves and blossom; party; bubbles and fish; glass shards;
  // plankton; glowing things; sky; water, network and ghost ripple; screens; magic).
  // Only the order changed: the ids are the same, so saved choices stay. Keep store.js (FX_EFFECTS / FX_FOLLOWERS) in the same order.
  const ORDER = ['snow', 'rain', 'lightning', 'rainbow', 'leaves', 'blossom', 'fireworks', 'confetti', 'hearts', 'bubbles', 'nightsky', 'embers', 'stardust', 'shards', 'plankton', 'fish', 'fireflies', 'dust', 'ocean', 'silk', 'jelly', 'network', 'ghost', 'warp', 'glitch', 'matrix', 'heal', 'cauldron', 'fel'];
  const EFFECT_IDS = [...ORDER.filter((id) => EFFECTS[id]), ...Object.keys(EFFECTS).filter((id) => !ORDER.includes(id))]; // an effect missing from ORDER still shows, at the end
  // the order in the pickers: each follower in the same place as its background effect, with the same name and
  // icon (snow = 'frost', rain = 'ripples': older ids, kept so saved choices stay); the pencil line last (the old 'comet' = Rainbow line is the Rainbow follower again)
  // 1.1.20: every background has its follower now (the owner's wish: both tabs list the same things), so the order
  // is simply the backgrounds' order, then the pencil line
  const FOLLOWER_OF = { snow: 'frost', rain: 'ripples' };
  const FOLLOWER_IDS = [...EFFECT_IDS.map((e) => FOLLOWER_OF[e] || e), 'pencil'];

  // Which effect and follower a note shows now, and how much of it. Settings: fxEffect / fxFollower = the choice
  // for all notes, fxEffectAmount / fxFollowerAmount = how much ('low' | 'mid' | 'high'), fxForceAll = use them on
  // every note (each note's own choice is kept for when it's switched off), fxPaused = pause every effect.
  // noteFx = { e, f, ea, fa, eo, fo, mi } (null = same as all notes; e / f may be 'none' = nothing on this note).
  // 1.1.21: fxInteract (settings) / mi (a note: true, false or null) = the mouse plays with the background.
  // 1.1.17: fxEffectOpacity / fxFollowerOpacity (settings) and eo / fo (a note) = how see-through: 0.1 – 1.
  const AMOUNTS = { low: .35, mid: 1, high: 2.6 }; // Frequency: Rarely / Normal / Often, for mouse followers
  // backgrounds get a bigger spread: Rarely = a few flakes, Often = lots (1.1.16, second round)
  const EFFECT_AMOUNTS = { low: .18, mid: 1, high: 3.6 };
  const amountOf = (a) => (AMOUNTS[a] ? a : 'mid');
  // opacity (1.1.17): 10 % – 100 % in 5 % steps; anything else = null (not set)
  const opacityOf = (v) => { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(.1, Math.round(n * 20) / 20)) : null; };
  // notePlay (1.1.16): this note plays even while all effects are paused
  const OLD_IDS = { comet: 'rainbow' }; // 'comet' (Rainbow line) was folded back into Rainbow
  function resolve(noteFx, settings, notePaused, notePlay) {
    const s = Object.assign({}, settings || {}); const n = Object.assign({}, noteFx || {});
    if (OLD_IDS[s.fxFollower]) s.fxFollower = OLD_IDS[s.fxFollower];
    if (OLD_IDS[n.f]) n.f = OLD_IDS[n.f];
    let effect = EFFECTS[s.fxEffect] ? s.fxEffect : 'none';
    let follower = FOLLOWERS[s.fxFollower] ? s.fxFollower : 'none';
    let effectAmount = amountOf(s.fxEffectAmount);
    let followerAmount = amountOf(s.fxFollowerAmount);
    let effectOpacity = opacityOf(s.fxEffectOpacity) ?? 1;
    let followerOpacity = opacityOf(s.fxFollowerOpacity) ?? 1;
    let interact = s.fxInteract !== false; // 1.1.21: the mouse plays with the background (on unless switched off)
    if (!s.fxForceAll) {
      if (typeof n.mi === 'boolean') interact = n.mi;
      if (n.e === 'none' || EFFECTS[n.e]) effect = n.e;
      if (n.f === 'none' || FOLLOWERS[n.f]) follower = n.f;
      if (AMOUNTS[n.ea]) effectAmount = n.ea;
      if (AMOUNTS[n.fa]) followerAmount = n.fa;
      if (opacityOf(n.eo) !== null) effectOpacity = opacityOf(n.eo);
      if (opacityOf(n.fo) !== null) followerOpacity = opacityOf(n.fo);
    }
    return { effect, follower, effectAmount, followerAmount, effectOpacity, followerOpacity, interact, paused: !!notePaused || (!!s.fxPaused && !notePlay) };
  }

  // ---------------------------------------------------------------- one shared loop (30 frames a second, sleeps when idle)
  // 1.1.23 (speed): on a machine that can't keep up (no graphics card, an older work laptop…), the effects step a little
  // less often instead of eating the time typing needs: it watches how long the effects take per step (a running
  // average) and goes from 30 steps a second to 20, or 15 if it's very slow, and back up when there's room again.
  // Movement stays the same speed (each step moves further); on an ordinary computer it simply stays at 30.
  const PACE = [1 / 30, 1 / 20, 1 / 15]; const SLOWER = [11, 18]; const FASTER = [6, 9]; // ms per step
  const loop = (() => {
    const layers = new Set();
    let running = false;
    let last = 0;
    let acc = 0;
    let cost = 0; let level = 0;
    function frame(now) {
      const dt = Math.min(.1, (now - last) / 1000);
      last = now;
      let any = false;
      if (!document.hidden) {
        acc += dt;
        const go = acc >= PACE[level] - .002;
        const t0 = go ? performance.now() : 0; let ticked = false;
        for (const L of layers) {
          if (!L.wants(now)) continue;
          any = true;
          if (go) { L.tick(Math.min(acc, .1)); ticked = true; }
        }
        if (go) {
          acc = 0;
          if (ticked) {
            cost += ((performance.now() - t0) - cost) * .1;
            if (level < 2 && cost > SLOWER[level]) { level++; cost *= .7; } else if (level > 0 && cost < FASTER[level - 1]) level--;
          }
        }
      } else any = true; // hidden: check again when it shows (the browser hardly runs frames meanwhile)
      if (any) requestAnimationFrame(frame); else running = false;
    }
    return {
      add(L) { layers.add(L); this.wake(); },
      get pace() { return 1 / PACE[level]; }, // steps a second right now (for the tests)
      remove(L) { layers.delete(L); },
      wake() { if (running) return; running = true; last = performance.now(); acc = 0; requestAnimationFrame(frame); },
    };
  })();

  // ---------------------------------------------------------------- a canvas showing one effect and/or one follower
  const BASE_AREA = 340 * 280; // a normal note
  // 1.1.17: every effect sets its own globalAlpha, so a layer's opacity is a multiplier on the canvas: whatever
  // an effect sets is multiplied by `mul` (no extra canvas, no extra drawing; the effects don't need to know)
  function fadeable(ctx) {
    let mul = 1;
    let d = null;
    for (let o = ctx; o && !d; o = Object.getPrototypeOf(o)) d = Object.getOwnPropertyDescriptor(o, 'globalAlpha');
    if (!d || !d.set || !d.get) return (m) => { mul = m; }; // not a real canvas (tests): nothing to do
    Object.defineProperty(ctx, 'globalAlpha', {
      configurable: true,
      get() { return mul ? d.get.call(this) / mul : 0; },
      set(v) { d.set.call(this, v * mul); },
    });
    return (m) => { mul = m; };
  }

  // 1.1.23: each note's effects take a little of its paper's colour. Every coloured ink in the palette turns 12 % of the way
  // round the colour wheel towards the paper's hue (lightness and strength stay, so it reads the same; greys and whites
  // don't change; charcoal has no hue, so nothing changes there). Cached per paper.
  const PAPER_HUE = { yellow: 50, cream: 40, orange: 28, pink: 335, rose: 345, purple: 265, lavender: 255, blue: 210, mist: 212, mint: 165, sage: 145, green: 100, night: 252, plum: 290, midnight: 225, forest: 150 };
  const TINT = .12;
  function hexHsl(hex) {
    let x = hex.slice(1); if (x.length === 3) x = [...x].map((c) => c + c).join('');
    const r = parseInt(x.slice(0, 2), 16) / 255; const g = parseInt(x.slice(2, 4), 16) / 255; const b = parseInt(x.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn;
    if (!d) return [0, 0, l];
    const sat = d / (1 - Math.abs(2 * l - 1)); let hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hu *= 60; if (hu < 0) hu += 360; return [hu, sat, l];
  }
  function hslHex(hu, sat, l) {
    const c = (1 - Math.abs(2 * l - 1)) * sat; const x = c * (1 - Math.abs(((hu / 60) % 2) - 1)); const m = l - c / 2;
    const [r, g, b] = hu < 60 ? [c, x, 0] : hu < 120 ? [x, c, 0] : hu < 180 ? [0, c, x] : hu < 240 ? [0, x, c] : hu < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round(clamp(v + m, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function tintInk(v, hue) {
    if (typeof v === 'string') {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
      const [hu, sat, l] = hexHsl(v); if (sat < .12 || l > .96 || l < .04) return v;
      const diff = ((hue - hu + 540) % 360) - 180; return hslHex((hu + diff * TINT + 360) % 360, sat, l);
    }
    return Array.isArray(v) ? v.map((x) => tintInk(x, hue)) : v;
  }
  const paperCache = new Map();
  function paperPalette(dark, paper) {
    const base = dark ? DARK : LIGHT; const hue = PAPER_HUE[paper];
    if (hue === undefined) return base;
    const key = `${dark ? 1 : 0}|${paper}`;
    if (!paperCache.has(key)) paperCache.set(key, Object.fromEntries(Object.entries(base).map(([k, v]) => [k, tintInk(v, hue)])));
    return paperCache.get(key);
  }
  function Layer(canvas) {
    const ctx = canvas.getContext('2d');
    const setMul = fadeable(ctx);
    let w = 0; let h = 0; let dpr = 1;
    let eId = 'none'; let fId = 'none'; let dark = false; let eAmt = 'mid'; let fAmt = 'mid'; let paper = null; // the note's colour (1.1.23 tint)
    let eOp = 1; let fOp = 1; // 1.1.17: how see-through the background / the follower is
    let eff = null; let fol = null;
    let t = Math.random() * 5;
    let mouse = null; let lastMove = -1e9;
    // 1.1.21: where the pointer is and how fast it goes, for a background that plays with the mouse (interact)
    let interact = true; const ptr = { x: 0, y: 0, vx: 0, vy: 0, sp: 0, on: false, t: 0 };
    let paused = false; let visible = true;
    let bw = 0; let bh = 0; let rebuildTimer = null; // the size the effect was made for
    // 1.1.16: the background and the follower are made separately, so picking another mouse follower (or its
    // frequency) doesn't restart the background, and the other way round
    function makeEffect() {
      const P = paperPalette(dark, paper);
      const k = Math.min(2.5, Math.max(.3, (w * h) / BASE_AREA)) * EFFECT_AMOUNTS[eAmt]; // bigger notes and "Often" get more
      eff = w && h && EFFECTS[eId] ? EFFECTS[eId].make(w, h, P, dark, k) : null;
      if (eff) for (let i = 0; i < 40; i++) { t += .05; eff.step(.05, t); } // start mid-way, never from an empty note
    }
    function makeFollower() {
      fol = w && h && FOLLOWERS[fId] ? FOLLOWERS[fId].make(w, h, paperPalette(dark, paper), dark, AMOUNTS[fAmt]) : null;
      mouse = null;
    }
    function build() {
      clearTimeout(rebuildTimer); bw = w; bh = h;
      makeEffect(); makeFollower();
      draw();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!visible) return;
      if (eff) { setMul(eOp); ctx.globalAlpha = 1; ctx.save(); eff.draw(ctx, t); ctx.restore(); }
      if (fol) { setMul(fOp * (fol.fade ? clamp(fol.fade(), 0, 1) : 1)); ctx.globalAlpha = 1; ctx.save(); fol.draw(ctx, t); ctx.restore(); } // 1.1.20: companions fade out (fade())
      setMul(1); ctx.globalAlpha = 1;
    }
    const L = {
      set({ paper: pp = null, effect = 'none', follower = 'none', dark: dk = false, effectAmount = 'mid', followerAmount = 'mid', effectOpacity = 1, followerOpacity = 1, interact: mi = true } = {}) {
        interact = mi !== false; if (!interact) ptr.on = false;
        const ea = amountOf(effectAmount); const fa = amountOf(followerAmount);
        // opacity only changes how it's drawn: nothing is made again, so moving the slider never restarts anything
        const eo = opacityOf(effectOpacity) ?? 1; const fo = opacityOf(followerOpacity) ?? 1;
        const opChanged = eo !== eOp || fo !== fOp;
        eOp = eo; fOp = fo;
        const pc = (pp || null) !== paper;
        const effChanged = effect !== eId || dk !== dark || ea !== eAmt || pc;
        const folChanged = follower !== fId || dk !== dark || fa !== fAmt || pc;
        eId = effect; fId = follower; dark = dk; eAmt = ea; fAmt = fa; paper = pp || null;
        if (effChanged && folChanged) build();
        else if (effChanged) { makeEffect(); draw(); }
        else if (folChanged) { makeFollower(); draw(); }
        else if (opChanged) draw();
        loop.wake();
      },
      resize() {
        // its own layout size (a tilted card's on-screen box is a little bigger)
        const nw = canvas.clientWidth; const nh = canvas.clientHeight;
        const nd = Math.min(2, window.devicePixelRatio || 1);
        if (nw === w && nh === h && nd === dpr) return;
        w = nw; h = nh; dpr = nd;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        // While the note is being resized this runs many times a second. Making the effect again each time
        // made it restart over and over, so the snow, stars etc. just carry on (clipped or with a bit of room)
        // and the effect is only made again for the new size once the resizing stops.
        if (!bw || !bh || !(eff || fol)) build();
        else {
          draw();
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => { if (w !== bw || h !== bh) build(); }, 300);
        }
        loop.wake();
      },
      // the mouse moved, at x, y inside the canvas
      move(x, y) {
        if (paused || !visible) return;
        if (eff && interact) {
          const now = performance.now();
          if (ptr.on) { const s = Math.max(.012, (now - ptr.t) / 1000); const k = Math.min(1, s * 12); ptr.vx += ((x - ptr.x) / s - ptr.vx) * k; ptr.vy += ((y - ptr.y) / s - ptr.vy) * k; }
          else { ptr.vx = 0; ptr.vy = 0; }
          ptr.x = x; ptr.y = y; ptr.t = now; ptr.on = true; ptr.sp = Math.hypot(ptr.vx, ptr.vy);
        }
        if (!fol) return;
        const d = mouse ? Math.hypot(x - mouse.x, y - mouse.y) : 0;
        const from = mouse; mouse = { x, y };
        // 1.1.22: a fast mouse jumps 30–60 px between two events, so a follower that spawns by distance dropped its
        // particles in clumps at the end of each jump. Those followers now get the jump in small steps along the path.
        const parts = ALONG.has(fId) && from && d > 10 && d < 500 ? Math.min(40, Math.ceil(d / 10)) : 1;
        if (parts > 1) { for (let i = 1; i <= parts; i++) fol.move(from.x + (x - from.x) * i / parts, from.y + (y - from.y) * i / parts, d / parts); }
        else fol.move(x, y, d);
        lastMove = performance.now();
        loop.wake();
      },
      leave() { mouse = null; ptr.on = false; if (fol && fol.leave) fol.leave(); }, // 1.1.22: a follower that burns while the pointer rests (fel, embers) goes out
      setPaused(p) { paused = !!p; draw(); loop.wake(); },
      setVisible(v) { visible = !!v; draw(); loop.wake(); },
      // does it need frames right now?
      wants(now) {
        if (paused || !visible || !w || !h) return false;
        if (eff) return true;
        return !!fol && (now - lastMove < 400 || (fol.busy ? fol.busy() : now - lastMove < 2500));
      },
      tick(dt) {
        t += dt;
        if (ptr.on && performance.now() - ptr.t > 50) { const f = Math.pow(.02, dt); ptr.vx *= f; ptr.vy *= f; ptr.sp = Math.hypot(ptr.vx, ptr.vy); } // the mouse rests: it slows down
        if (eff) eff.step(dt, t, interact && ptr.on ? ptr : null);
        if (fol) fol.step(dt, t); draw();
      },
      active: () => !!(eff || fol),
      destroy() { clearTimeout(rebuildTimer); loop.remove(L); },
    };
    loop.add(L);
    return L;
  }

  // ---------------------------------------------------------------- icons for the pickers ([colour, svg inside a 24×24 viewBox])
  const ICONS = {
    none: ['', '<circle cx="12" cy="12" r="8"/><path d="m6.5 17.5 11-11"/>'],
    all: ['', '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'],
    effect: {
      snow: ['#5B8DC9', '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4M3.9 10.9l3.3.9-.9 3.3M20.1 13.1l-3.3-.9.9-3.3"/>'],
      fireworks: ['#E5484D', '<circle cx="12" cy="12" r="1.6" class="f"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/>'],
      stardust: ['#D49A00', '<path class="f" d="M10 3c.5 3.5 2 5 5.5 5.5-3.5.5-5 2-5.5 5.5-.5-3.5-2-5-5.5-5.5C8 8 9.5 6.5 10 3zM17.5 14c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z"/>'],
      fireflies: ['#E0A100', '<circle cx="8" cy="9" r="2.2" class="f"/><circle cx="16.5" cy="15.5" r="2.6" class="f"/><circle cx="17" cy="6" r="1.3" class="f"/><circle cx="8" cy="9" r="4.6" stroke-dasharray="1.5 2.4"/><circle cx="16.5" cy="15.5" r="5.2" stroke-dasharray="1.5 2.4"/>'],
      bubbles: ['#4F86C6', '<circle cx="9" cy="14.5" r="5"/><circle cx="16.5" cy="6.5" r="3"/><circle cx="18.5" cy="16" r="1.8"/><path d="M6.8 12.6a2.6 2.6 0 0 1 2-1.5"/>'],
      leaves: ['#D9622B', '<path class="f" d="M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14z"/><path d="M5 19 13 11" stroke="#fff" stroke-opacity=".75"/>'],
      hearts: ['#E5484D', '<path class="f" d="M12 20.5C6 16.6 3 13.4 3 9.6 3 6.9 5 5 7.5 5c1.9 0 3.5 1.1 4.5 2.7C13 6.1 14.6 5 16.5 5 19 5 21 6.9 21 9.6c0 3.8-3 7-9 10.9z"/>'],
      rain: ['#5F7FA2', '<path d="M7 14a4 4 0 1 1 .9-7.9A5.2 5.2 0 0 1 17.6 7.6 3.3 3.3 0 0 1 17 14z"/><path d="M8.5 17.5 7.5 20.5M12.5 17.5l-1 3M16.5 17.5l-1 3"/>'],
      rainbow: ['#8E5BD8', '<path d="M3 17a9 9 0 0 1 18 0" stroke="#E5484D"/><path d="M6 17a6 6 0 0 1 12 0" stroke="#E0A100"/><path d="M9 17a3 3 0 0 1 6 0" stroke="#3A8DDE"/>'],
      matrix: ['#0B9A3C', '<path d="M5 3v6M5 12v2M10 3v3M10 9v9M15 3v11M15 17v2M20 3v5M20 11v4"/><circle cx="10" cy="20.5" r="1.3" class="f"/><circle cx="20" cy="17.5" r="1.3" class="f"/>'],
      confetti: ['#8E5BD8', '<path d="M4 20 8.2 8.6l7.2 7.2z"/><path d="M14 3.5l.8 2M20.5 10l-2 .8M17.6 2.8l-.6 2.6M21.2 6.5l-2.6.6M12.5 8.5c1-1.5 1-3-.5-4.5"/>'],

      // 1.1.18
      plankton: ['#0E9C98', '<circle cx="5" cy="14" r="1.4" class="f"/><circle cx="9.5" cy="10" r="2" class="f"/><circle cx="15" cy="12.5" r="1.6" class="f"/><circle cx="19.5" cy="8" r="1.2" class="f"/><path d="M3 19c3-2 6-2 9 0s6 2 9 0" stroke-opacity=".6"/>'],
      warp: ['#3A6FD8', '<path d="M9.2 9.6 4.5 5.8M14.8 9.6l4.7-3.8M9.2 14.4l-4.7 3.8M14.8 14.4l4.7 3.8M12 8.2V3M12 15.8V21M8.2 12H3M15.8 12H21"/>'],
      network: ['#4A6290', '<path d="M5 7l7-3 7 5-4 9-8-1zM12 4l3 14M5 7l10 11" stroke-opacity=".6" stroke-width="1.4"/><circle cx="5" cy="7" r="1.7" class="f"/><circle cx="12" cy="4" r="1.7" class="f"/><circle cx="19" cy="9" r="1.7" class="f"/><circle cx="15" cy="18" r="1.7" class="f"/><circle cx="7" cy="17" r="1.7" class="f"/>'],
      embers: ['#E0700A', '<circle cx="8" cy="16.5" r="1.7" class="f"/><circle cx="14.5" cy="12" r="1.4" class="f"/><circle cx="10" cy="7.5" r="1.1" class="f"/><circle cx="17" cy="5" r=".9" class="f"/><path d="M4 21c4-1.6 12-1.6 16 0"/>'],
      blossom: ['#E0608E', '<circle cx="12" cy="6.8" r="3" class="f"/><circle cx="16.9" cy="10.4" r="3" class="f"/><circle cx="15" cy="16.2" r="3" class="f"/><circle cx="9" cy="16.2" r="3" class="f"/><circle cx="7.1" cy="10.4" r="3" class="f"/><circle cx="12" cy="12" r="1.7" fill="#FFF3B0" stroke="none"/>'],
      nightsky: ['#4A5A8C', '<path class="f" d="M15 4a7.5 7.5 0 1 0 5.5 12.6A6.5 6.5 0 0 1 15 4z"/><path class="f" d="M6 3.5l.6 1.7 1.7.6-1.7.6L6 8.1l-.6-1.7-1.7-.6 1.7-.6z"/><path d="M3 15.5 7.5 13"/>'],
      glitch: ['#5A6A95', '<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M9 21h6M12 17v4"/><path d="M6.5 8h11M6.5 11h11" stroke-opacity=".4"/><path d="M6.5 14h11"/>'],
      ocean: ['#2C63B8', '<path d="M3 9c3-3 6 3 9 0s6-3 9 0M3 15c3-3 6 3 9 0s6-3 9 0" stroke-dasharray=".1 3" stroke-width="2.4"/>'],
      silk: ['#8E5BD8', '<path d="M2 12c4-6 8 6 12 0s6-4 8-2M2 9c4 6 8-6 12 0s6 5 8 2" />'],
      shards: ['#3A8DDE', '<path d="M4 9l6-5 3 7zM13 14l7-2-3 8zM5 16l4 1-2 4z"/>'],
      ghost: ['#3A6FD8', '<path d="M4 4h.01M9 4h.01M15 4h.01M20 4h.01M4 9.5h.01M20 9.5h.01M4 14.5h.01M20 14.5h.01M4 20h.01M9 20h.01M15 20h.01M20 20h.01" stroke-width="2.6"/><circle cx="12" cy="12" r="4.5" stroke-dasharray="1.5 2"/>'],
      fish: ['#2A7FD0', '<path class="f" d="M2.5 12c3-4 8-5 12-2l5.5-3.5v11L14.5 14c-4 3-9 2-12-2z"/><circle cx="7" cy="11.2" r="1" fill="#fff" stroke="none"/>'],
      heal: ['#1F9A50', '<path d="M12 7v10M7 12h10" stroke-width="2.2"/><ellipse cx="12" cy="19.5" rx="8" ry="2" stroke-opacity=".55"/><circle cx="5" cy="6" r="1" class="f"/><circle cx="19" cy="8" r="1.2" class="f"/>'],
      lightning: ['#3A5FD0', '<path d="M13.5 2.5 7 13h4.5L9.5 21.5 17 10h-4.5z" class="f"/>'],
      cauldron: ['#0E8A86', '<path d="M4 11h16c0 5-3.5 8.5-8 8.5S4 16 4 11z" class="f"/><path d="M3 11h18"/><path d="M9 7.5c-1-1.2 0-2.4-.5-3.5M14.5 7.5c-1-1.2 0-2.4-.5-3.5" stroke-opacity=".6"/>'],
      jelly: ['#0E8A86', '<path d="M5 11a7 6 0 0 1 14 0z" class="f"/><path d="M7.5 11c0 3-1 5-.5 9M10.5 11c0 3 1 5 .5 9M13.5 11c0 3-1 5-.5 9M16.5 11c0 3 1 5 .5 9" stroke-dasharray=".1 2.4" stroke-width="2"/>'],
      fel: ['#4E9A06', '<path d="M8 21c-3-2-3-6 0-9 0 2 1 3 2 3-1-4 1-8 4-10-1 3 0 5 2 7 2 2 2 6-1 9z" class="f"/>'],
      dust: ['#B08A30', '<path d="M5 3l5.5 18M11 3l7 18" stroke-opacity=".45"/><circle cx="9" cy="10" r="1.1" class="f"/><circle cx="12.5" cy="15" r="1.4" class="f"/><circle cx="14" cy="7.5" r=".8" class="f"/><circle cx="18.5" cy="13.5" r=".8" class="f"/><circle cx="5.5" cy="16" r=".7" class="f"/>'],
    },
    follower: {
      stardust: ['#D49A00', '<path d="M4 3.5 9.6 18l2-5.9 5.9-2z"/><path class="f" d="M18 14.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z"/>'],
      hearts: ['#E0608E', '<path class="f" d="M8 15.5C4.4 13.2 2.5 11.2 2.5 8.9 2.5 7.2 3.8 6 5.4 6c1.1 0 2 .6 2.6 1.6.6-1 1.5-1.6 2.6-1.6 1.6 0 2.9 1.2 2.9 2.9 0 2.3-1.9 4.3-5.5 6.6zM17 21c-2.7-1.7-4-3.2-4-4.9 0-1.3 1-2.2 2.2-2.2.8 0 1.4.4 1.8 1.1.4-.7 1-1.1 1.8-1.1 1.2 0 2.2.9 2.2 2.2 0 1.7-1.3 3.2-4 4.9z"/>'],
      bubbles: ['#4F86C6', '<circle cx="5.5" cy="18.5" r="1.6"/><circle cx="10" cy="13.5" r="2.6"/><circle cx="16.5" cy="7.5" r="4.2"/>'],
      fireflies: ['#E0A100', '<circle cx="7" cy="16" r="1.8" class="f"/><circle cx="12.5" cy="10.5" r="2.2" class="f"/><circle cx="17.5" cy="15" r="1.5" class="f"/><circle cx="16" cy="5.5" r="1.2" class="f"/><circle cx="12.5" cy="10.5" r="5" stroke-dasharray="1.5 2.4"/>'],
      ripples: ['#4F86C6', '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5" stroke-opacity=".7"/><circle cx="12" cy="12" r="9" stroke-opacity=".4"/>'],
      frost: ['#7FA6D6', '<path d="M8 4v10M3.7 6.5l8.6 5M3.7 11.5l8.6-5M16.5 13v8M13 15l7 4M13 19l7-4"/>'],
      confetti: ['#E08A00', '<rect x="4" y="4" width="3" height="6" rx="1" class="f" transform="rotate(-20 5.5 7)"/><rect x="14" y="3" width="3" height="6" rx="1" class="f" transform="rotate(25 15.5 6)"/><rect x="9" y="12" width="3" height="6" rx="1" class="f" transform="rotate(-35 10.5 15)"/><rect x="17" y="14" width="3" height="6" rx="1" class="f" transform="rotate(15 18.5 17)"/>'],
      leaves: ['#C9452E', '<path class="f" d="M3 13c0-5 3.3-8.3 8.3-8.3C11.3 9.7 8 13 3 13zM11 21c0-4.4 2.9-7.3 7.3-7.3C18.3 18.1 15.4 21 11 21z"/>'],
      matrix: ['#0B9A3C', '<path d="M4 3.5 8.6 15.5l1.7-4.9 4.9-1.7z"/><path d="M14 13v3M18 11v6M18 19.5v1M14 18.5v2.5M10.5 17v4"/>'],
      pencil: ['#7A6A4E', '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'],
    },
  };

  // a follower that goes with a background has the same icon (and the same name, above)
  const PAIRS = Object.fromEntries(EFFECT_IDS.map((e) => [FOLLOWER_OF[e] || e, e])); // follower id → background id (all of them since 1.1.20)
  for (const [f, e] of Object.entries(PAIRS)) if (ICONS.effect[e]) ICONS.follower[f] = ICONS.effect[e];
  window.COSMO_FX = { EFFECTS, FOLLOWERS, EFFECT_IDS, FOLLOWER_IDS, resolve, Layer, ICONS, AMOUNTS, EFFECT_AMOUNTS, PAIRS, opacityOf, paperPalette, loopPace: () => loop.pace, PALETTES: { light: LIGHT, dark: DARK } };
})();
