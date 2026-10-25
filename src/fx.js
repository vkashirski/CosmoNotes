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
 *   resolve(noteFx, settings) → { effect, follower, effectAmount, followerAmount, effectOpacity, followerOpacity, paused }
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
    tide: '#1E6FC0', tideHi: '#0A3F7A', fairy: ['#E0608E', '#8E5BD8', '#3A8DDE', '#2FA36B', '#D49A00'], fairyCore: '#C98A00', fairyHead: '#B07800',
    star: '#38446A', warp: '#3A6FD8', net: '#4A5D80', netNode: '#33456A', ember: ['#B3261E', '#D2560A', '#C27C00'], fireGlow: '#E0700A',
    attr: ['#8E5BD8', '#D9622B', '#1F8FA0'], blossom: ['#EE88AE', '#F29BBB', '#E2709C', '#F5B3CB'], skyStar: '#38446A', shoot: '#3A6FD8',
    glitch: ['#E5484D', '#2FA36B', '#3A6FD8'], glitchInk: '#3A3A48', disk: ['#C9302C', '#E0700A', '#D99A00'], hole: '#1E1A26', ring: '#E08A00', jet: '#3A6FD8',
    wave: '#2C63B8', waveHi: '#0E3A80', silk: ['#8E5BD8', '#3A8DDE', '#D9622B'], shardS: 72, shardL: 55, shardEdge: '#5A6A95', shardGlint: '#FFFFFF',
    xp: ['#1F9A50', '#2A7FD0'], xpText: '#1F7A40', morph: ['#8E5BD8', '#E0608E', '#3A8DDE'], ripple: '#3A6FD8', rippleHi: '#0E3A80',
    fish: ['#2A7FD0', '#1F9A8A', '#4F6FD0'], sun: '#E08A00', planet: ['#3A8DDE', '#C9452E', '#2FA36B', '#8E5BD8'], orbit: '#5A6A95',
    topo: '#7A6440', topoHi: '#4A3A1E', tunnel: '#8E3AD8', tunnel2: '#1F8FC0', sunTop: '#E0507E', sunBot: '#E09A00', horizon: '#E0507E',
    dust: '#8A6A30', shaft: '#FFFFFF',
  };
  const DARK = {
    snow: '#FFFFFF', gold: '#FFD86B', glow: '#FFE27A', blue: '#9FC4FF', bubble: '#A9CBFF', rain: '#A9C4E4',
    pink: '#FF9EC4', petal: '#FFB3CC', heart: '#FF7A90', ink: '#E4E8F2',
    fire: ['#FF8A8A', '#FFC46B', '#8EC8FF', '#C9A4FF', '#7FE0AE'], willow: '#FFD27A', crackle: '#FFFFFF',
    leaf: ['#FF9A5C', '#FF7A5C', '#FFD15C', '#E89A55'],
    confetti: ['#FF8A8A', '#FFC46B', '#8EC8FF', '#C9A4FF', '#7FE0AE', '#FF9EC4'],
    code: '#00FF41', codeDim: '#00B82E', codeHead: '#D8FFE2', // Matrix on dark paper: the film's phosphor green
    // 1.1.18 (the Effect Lab picks)
    tide: '#4FC2FF', tideHi: '#E0F6FF', fairy: ['#FFB3D9', '#D9B8FF', '#A8D8FF', '#A8F0CF', '#FFE08A'], fairyCore: '#FFF1C2', fairyHead: '#FFFFFF',
    star: '#FFFFFF', warp: '#9CC4FF', net: '#AFC3F0', netNode: '#E1E9FF', ember: ['#FF4A2E', '#FF8F2A', '#FFD45C'], fireGlow: '#FF6A1E',
    attr: ['#C9A4FF', '#FFB36B', '#6FE3E0'], blossom: ['#FFB3CC', '#FFC4D8', '#FF9EBE', '#FFD6E4'], skyStar: '#FFFFFF', shoot: '#CFE4FF',
    glitch: ['#FF4D5E', '#3DFF9A', '#4D8DFF'], glitchInk: '#E8ECF8', disk: ['#FF4A2E', '#FF9A3D', '#FFE08A'], hole: '#05040A', ring: '#FFC46B', jet: '#8EC8FF',
    wave: '#7FB8FF', waveHi: '#E4F2FF', silk: ['#C9A4FF', '#7FC8FF', '#FFB36B'], shardS: 90, shardL: 72, shardEdge: '#E4ECFF', shardGlint: '#FFFFFF',
    xp: ['#7DFF7A', '#7FE0FF'], xpText: '#B8FFB0', morph: ['#C9A4FF', '#FF9EC4', '#8EC8FF'], ripple: '#7FB8FF', rippleHi: '#E4F2FF',
    fish: ['#6FC0FF', '#5FE3D0', '#9FA8FF'], sun: '#FFD36B', planet: ['#7FC8FF', '#FF8A6B', '#7FE0AE', '#C9A4FF'], orbit: '#9FB4E8',
    topo: '#C9B48A', topoHi: '#F2E6C8', tunnel: '#D96BFF', tunnel2: '#5CE1FF', sunTop: '#FF5FA8', sunBot: '#FFC24D', horizon: '#FF5FA8',
    dust: '#FFE7B0', shaft: '#FFF2CC',
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
  function glowDot(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, col); g.addColorStop(.35, col); g.addColorStop(1, 'transparent');
    c.globalAlpha = a * .35; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill();
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
  function glow2(c, x, y, r, halo, core, a, haloK = .35) {
    a = clamp(a, 0, 1); if (a <= .01) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, halo); g.addColorStop(.35, halo); g.addColorStop(1, 'transparent');
    c.globalAlpha = a * haloK; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill();
    c.globalAlpha = a; c.fillStyle = core; dot(c, x, y, r * .55);
  }
  // a smooth, slowly changing "wind direction" at x, y (a cheap stand-in for a noise field)
  const flow = (x, y, t, s = .011) => Math.sin(x * s + t * .31) * 1.7 + Math.cos(y * s * 1.27 - t * .23) * 1.7 + Math.sin((x - y) * s * .61 + t * .19) * 1.3;
  function wrap(q, w, h, m) { if (q.x < -m) q.x += w + 2 * m; else if (q.x > w + m) q.x -= w + 2 * m; if (q.y < -m) q.y += h + 2 * m; else if (q.y > h + m) q.y -= h + 2 * m; }
  const hsla = (hu, s, l, a) => `hsla(${hu % 360}, ${s}%, ${l}%, ${a})`;
  function mixHex(a, b, u) { const p = (s, i) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16); return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * u)).join(',')})`; }
  // many lines / dots in one go: [x1, y1, x2, y2, …] → one stroke; [[x, y, r, a], …] → a few fills grouped by strength
  function strokeSegs(c, s) { if (!s.length) return; c.beginPath(); for (let i = 0; i < s.length; i += 4) { c.moveTo(s[i], s[i + 1]); c.lineTo(s[i + 2], s[i + 3]); } c.stroke(); }
  function bucketDots(c, items, col, B, maxA) {
    const groups = Array.from({ length: B }, () => []);
    for (const it of items) groups[Math.min(B - 1, Math.floor(clamp(it[3], 0, .999) * B))].push(it);
    c.fillStyle = col;
    groups.forEach((g, i) => { if (!g.length) return; c.globalAlpha = (i + .5) / B * maxA; c.beginPath(); for (const [x, y, r] of g) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } c.fill(); });
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
  // Shape shifter: outlines, each fitted into -1..1
  const MORPH_SHAPES = {
    heart: (u) => { const t = u * TAU; return [16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - .1]; },
    star: (u) => { const n = 10; const f = u * n; const i = Math.floor(f) % n; const j = (i + 1) % n; const r = (k) => (k % 2 ? .42 : 1); const a = (k) => -Math.PI / 2 + k * TAU / n; const s = f - Math.floor(f); return [Math.cos(a(i)) * r(i) * (1 - s) + Math.cos(a(j)) * r(j) * s, Math.sin(a(i)) * r(i) * (1 - s) + Math.sin(a(j)) * r(j) * s + .08]; },
    moon: (u) => { if (u < .6) { const a = .62 + u / .6 * (TAU - 1.24); return [Math.cos(a) * .95, Math.sin(a) * .95]; } const a = 2.05 - (u - .6) / .4 * 4.1; return [.42 + Math.cos(a + Math.PI) * .7, Math.sin(a + Math.PI) * .7]; },
    infinity: (u) => { const t = u * TAU; const d = 1 + Math.sin(t) ** 2; return [Math.cos(t) / d * 1.05, Math.sin(t) * Math.cos(t) / d * 1.2]; },
    flower: (u) => { const t = u * TAU; const r = .62 + .36 * Math.cos(5 * t); return [Math.cos(t) * r, Math.sin(t) * r]; },
  };
  // an even field of dots (Ghost ripple)
  function dotLattice(w, h, sp) { const d = []; let row = 0; for (let y = sp / 2; y < h + sp; y += sp * .87, row++) for (let x = (row % 2 ? sp / 2 : 0); x < w + sp; x += sp) d.push({ bx: x, by: y, x, y, vx: 0, vy: 0, b: 0 }); return d; }
  // Contour map: an imaginary landscape, and its contour lines by marching squares (every 4th level is a darker
  // "index" line, like on real maps): { lines: [x1, y1, x2, y2, …], index: […] }
  const terrain = (x, y, t) => Math.sin(x * .018 + t * .05) + Math.sin(y * .022 - t * .04) * .8 + Math.sin((x + y) * .011 + t * .03) * 1.1 + Math.sin(Math.hypot(x - 200, y - 110) * .03 - t * .08) * .6;
  function contours(w, h, t, g, step) {
    const cols = Math.ceil(w / g) + 1; const rows = Math.ceil(h / g) + 1; const v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = terrain(i * g, j * g, t);
    const lines = []; const index = [];
    for (let L = -3.2, n = 0; L <= 3.2; L += step, n++) {
      const out = n % 4 === 0 ? index : lines;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i]; const b = v[j * cols + i + 1]; const c = v[(j + 1) * cols + i + 1]; const d = v[(j + 1) * cols + i];
        const m = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0); if (m === 0 || m === 15) continue;
        const x = i * g; const y = j * g; const f = (p, q) => (L - p) / (q - p);
        const T = [x + g * f(a, b), y]; const Rr = [x + g, y + g * f(b, c)]; const B = [x + g * f(d, c), y + g]; const Lf = [x, y + g * f(a, d)];
        const seg = (p1, p2) => out.push(p1[0], p1[1], p2[0], p2[1]);
        switch (m) {
          case 1: case 14: seg(Lf, B); break; case 2: case 13: seg(B, Rr); break; case 3: case 12: seg(Lf, Rr); break;
          case 4: case 11: seg(T, Rr); break; case 6: case 9: seg(T, B); break; case 7: case 8: seg(Lf, T); break;
          case 5: seg(Lf, T); seg(B, Rr); break; case 10: seg(T, Rr); seg(Lf, B); break; default: break;
        }
      }
    }
    return { lines, index };
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
      return {
        step(dt) { for (const p of f) { p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y > h + 6) { p.y = -6; p.x = R(0, w); } } },
        draw(c, t) { c.strokeStyle = P.snow; c.lineCap = 'round'; c.lineWidth = 1.1; c.globalAlpha = .75; for (const p of f) flake(c, p.x + Math.sin(t * p.sw + p.ph) * 8, p.y, p.s, p.rot); },
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
        step(dt) {
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
            if (r.y <= r.top || r.vy > -12) { burst(r); rockets.splice(i, 1); }
          }
          const drag = Math.pow(.55, dt);
          for (let i = sparks.length - 1; i >= 0; i--) {
            const q = sparks[i]; q.age += dt; q.vx *= drag; q.vy = q.vy * drag + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
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
        step(dt) { for (const q of s) { q.t += q.sp * dt; if (q.t >= 1) { q.t = 0; q.x = R(6, w - 6); q.y = R(6, h - 6); } } },
        draw(c) {
          for (const q of s) {
            const v = Math.sin(q.t * Math.PI); if (v <= 0) continue;
            const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 2.6);
            g.addColorStop(0, P.gold); g.addColorStop(1, 'transparent');
            c.globalAlpha = v * (dark ? .45 : .35); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.r * 2.6, 0, TAU); c.fill();
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
        step(dt) { for (const q of f) { q.a += R(-1.6, 1.6) * dt; q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt; if (q.x < 0 || q.x > w) q.a = Math.PI - q.a; if (q.y < 0 || q.y > h) q.a = -q.a; q.x = Math.max(0, Math.min(w, q.x)); q.y = Math.max(0, Math.min(h, q.y)); } },
        draw(c, t) { for (const q of f) glowDot(c, q.x, q.y, 3.4, P.glow, .45 + .45 * Math.sin(t * 1.6 + q.ph)); },
      };
    } },
    bubbles: { name: 'Bubbles', make(w, h, P, dark, k) {
      const b = []; const pops = []; const go = every(.35, .7, k);
      return {
        step(dt) {
          if (go(dt)) b.push({ x: R(8, w - 8), y: h + 8, r: R(4, 8), vy: R(18, 30), at: R(h * .1, h * .7), ph: R(0, TAU) });
          for (let i = b.length - 1; i >= 0; i--) { const q = b[i]; q.y -= q.vy * dt; if (q.y <= q.at) { pops.push({ x: q.x, y: q.y, r: q.r, age: 0, life: .3 }); b.splice(i, 1); } }
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
      const f = Array.from({ length: count(8, k) }, () => ({ x: R(0, w), y: R(0, h), vy: R(12, 20), ph: R(0, TAU), s: R(5, 7.5), col: pick(P.leaf) }));
      return {
        step(dt) { for (const q of f) { q.y += q.vy * dt; if (q.y > h + 10) { q.y = -10; q.x = R(0, w); q.col = pick(P.leaf); } } },
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
        step(dt) { for (const q of f) { q.y -= q.vy * dt; if (q.y < -10) { q.y = h + 10; q.x = R(0, w); } } },
        draw(c, t) { c.fillStyle = P.heart; for (const q of f) { c.globalAlpha = Math.min(1, q.y / (h * .5)) * .75; heart(c, q.x + Math.sin(t * 1.6 + q.ph) * 5, q.y, q.s); } },
      };
    } },
    rain: { name: 'Rain', make(w, h, P, dark, k) {
      const d = Array.from({ length: count(30, k) }, () => ({ x: R(0, w), y: R(0, h), len: R(6, 11), sp: R(190, 250) }));
      return {
        step(dt) { for (const q of d) { q.y += q.sp * dt; q.x += q.sp * .14 * dt; if (q.y > h + 12) { q.y = -12; q.x = R(-20, w); } } },
        draw(c) { c.strokeStyle = P.rain; c.lineWidth = 1.1; c.lineCap = 'round'; c.globalAlpha = .5; c.beginPath(); for (const q of d) { c.moveTo(q.x, q.y); c.lineTo(q.x - q.len * .14, q.y - q.len); } c.stroke(); },
      };
    } },
    confetti: { name: 'Confetti', make(w, h, P, dark, k) {
      const f = Array.from({ length: count(22, k) }, () => ({ x: R(0, w), y: R(0, h), vy: R(20, 36), rot: R(0, TAU), vr: R(-3, 3), ph: R(0, TAU), col: pick(P.confetti) }));
      return {
        step(dt) { for (const q of f) { q.y += q.vy * dt; q.rot += q.vr * dt; if (q.y > h + 6) { q.y = -6; q.x = R(0, w); } } },
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
        step(dt) {
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
      const off = document.createElement('canvas'); off.width = Math.max(1, Math.round(w)); off.height = Math.max(1, Math.round(h));
      const o = off.getContext('2d');
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
      const sc = document.createElement('canvas'); sc.width = off.width; sc.height = off.height;
      const s2 = sc.getContext('2d');
      function bow(g, rOuter, reverse, prog, strength) {
        const list = reverse ? [...RAINBOW_HUES].reverse() : RAINBOW_HUES;
        const lo = Math.min(g.aS, g.aS + g.d); const hi = Math.max(g.aS, g.aS + g.d); const start = lo - .05;
        const at = (u) => Math.pow(smooth(Math.min(u, 1 - u) / .38), 1.6) * smooth((prog - u) / FRONT) * strength;
        s2.clearRect(0, 0, sc.width, sc.height);
        s2.lineCap = 'butt'; s2.lineWidth = band + 1.2;
        list.forEach((hue, i) => {
          s2.strokeStyle = `hsl(${hue}, ${dark ? 92 : 85}%, ${dark ? 66 : 57}%)`;
          s2.beginPath(); s2.arc(g.cx, g.cy, rOuter - i * band, lo, hi); s2.stroke();
        });
        const grad = s2.createConicGradient(start, g.cx, g.cy);
        const stops = [];
        for (let j = 0; j <= N; j++) { const u = j / N; stops.push([(g.aS + g.d * u - start) / TAU, at(u)]); }
        stops.sort((x, y) => x[0] - y[0]);
        for (const [of, a] of stops) grad.addColorStop(Math.max(0, Math.min(1, of)), `rgba(0,0,0,${a.toFixed(4)})`);
        s2.globalCompositeOperation = 'destination-in'; s2.fillStyle = grad; s2.fillRect(0, 0, sc.width, sc.height);
        s2.globalCompositeOperation = 'source-over';
        o.drawImage(sc, 0, 0);
      }
      const GROW = 4.8; const STAY = 3; const FADE = 2.6; const WAIT = 1.6 / Math.max(.15, k); // "Often" comes back sooner
      let cur = null; let first = true;
      return {
        step(dt) {
          if (!cur) { cur = { g: path(), age: first ? GROW * .5 : 0 }; first = false; }
          cur.age += dt;
          if (cur.age > GROW + STAY + FADE + WAIT) cur = null;
        },
        draw(c) {
          if (!cur) return;
          const t = cur.age; const prog = ease(t / GROW) * (1 + FRONT);
          const alpha = (dark ? .62 : .78) * (t < GROW + STAY ? 1 : 1 - smooth((t - GROW - STAY) / FADE));
          if (alpha <= .01 || prog <= 0) return;
          o.clearRect(0, 0, off.width, off.height);
          bow(cur.g, cur.g.r, false, prog, 1);
          // a double rainbow: the second bow is just as wide and solid, a little fainter, colours the other way round
          if (cur.g.double) bow(cur.g, cur.g.r + band * 9, true, ease((t - GROW * .3) / GROW) * (1 + FRONT), .62);
          c.save(); c.filter = 'blur(1.6px)'; c.globalAlpha = alpha; c.drawImage(off, 0, 0, w, h); c.restore();
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
        step(dt, t) {
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
    // Fairy dust: a tiny bright fairy loops around, leaving pastel sparkles that twinkle and drift down
    fairy: { name: 'Fairy dust', make(w, h, P, dark, k) {
      const dust = []; let acc = 0; const ph = R(0, 100);
      const pos = (t) => [w / 2 + Math.sin(t * .41 + ph) * w * .36 + Math.sin(t * 1.07 + ph * 2) * w * .08, h / 2 + Math.sin(t * .57 + ph * 1.7) * h * .32 + Math.cos(t * 1.31 + ph) * h * .1];
      let [fx, fy] = pos(0);
      const tw = Array.from({ length: capped(10, k, 30) }, () => ({ x: R(0, w), y: R(0, h), t: R(0, 1), sp: R(.3, .6) }));
      return {
        step(dt, t) {
          const [nx, ny] = pos(t); const d = Math.hypot(nx - fx, ny - fy); fx = nx; fy = ny;
          acc += Math.min(d, 40) * .22 * clamp(k, .3, 3);
          while (acc >= 1) { acc -= 1; if (dust.length < 220) dust.push({ x: fx + R(-3, 3), y: fy + R(-3, 3), vx: R(-8, 8), vy: R(2, 14), age: 0, life: R(1.4, 2.6), col: pick(P.fairy), s: R(1.2, 2.6), ph: R(0, TAU) }); }
          const dr = Math.pow(.6, dt);
          for (const q of dust) { q.vx *= dr; q.x += q.vx * dt; q.y += q.vy * dt; }
          cull(dust, dt);
          for (const q of tw) { q.t += q.sp * dt; if (q.t >= 1) { q.t = 0; q.x = R(0, w); q.y = R(0, h); } }
        },
        draw(c, t) {
          c.fillStyle = P.fairyCore;
          for (const q of tw) { const v = Math.sin(q.t * Math.PI); c.globalAlpha = v * .5; star4(c, q.x, q.y, 2.2 * v); }
          for (const q of dust) {
            const v = q.age / q.life; c.globalAlpha = (1 - v) * (.6 + .4 * Math.sin(t * 9 + q.ph)) * .9; c.fillStyle = q.col;
            if (q.s > 2.1) star4(c, q.x, q.y, q.s * 1.5 * (1 - v * .5)); else dot(c, q.x, q.y, q.s * .6);
          }
          glow2(c, fx, fy, 4.5, P.fairyCore, P.fairyHead, .95, dark ? .45 : .35);
        },
      };
    } },
    // Warp speed ("Warp jump"): cruises among the stars, then they stretch into long blue streaks at light speed,
    // with a soft flash, and it drops back to calm
    warp: { name: 'Warp speed', make(w, h, P, dark, k) {
      const sf = starfield(w, h, capped(80, k, 220));
      const CRUISE = 3.6; const SPOOL = 1.4; const WARP = 2.2; const DROP = 1.3; const CYCLE = CRUISE + SPOOL + WARP + DROP;
      const ease = (x) => .5 - .5 * Math.cos(Math.PI * clamp(x, 0, 1));
      let tm = R(0, CRUISE); let speed = .1; let flash = 0;
      const speedAt = (x) => (x < CRUISE ? .1 : x < CRUISE + SPOOL ? .1 + 1.5 * ease((x - CRUISE) / SPOOL) : x < CRUISE + SPOOL + WARP ? 1.6 : 1.6 - 1.5 * ease((x - CRUISE - SPOOL - WARP) / DROP));
      return {
        step(dt) {
          const before = tm; tm = (tm + dt) % CYCLE; speed = speedAt(tm);
          if (before < CRUISE + SPOOL && tm >= CRUISE + SPOOL) flash = 1;
          flash = Math.max(0, flash - dt * 1.6);
          sf.move(dt, speed);
        },
        draw(c) {
          const fast = clamp((speed - .1) / 1.5, 0, 1);
          if (fast > .05) sf.draw(c, P.warp, speed, .22, 1 + fast * .8);
          sf.draw(c, P.star, speed, .22 * (1 - fast * .4), .7);
          if (flash > 0) {
            const r = Math.max(w, h) * (.2 + (1 - flash) * .5); const g = c.createRadialGradient(sf.vp.x, sf.vp.y, 0, sf.vp.x, sf.vp.y, r);
            g.addColorStop(0, P.warp); g.addColorStop(1, 'transparent'); c.globalAlpha = flash * (dark ? .45 : .3); c.fillStyle = g; c.fillRect(0, 0, w, h);
          }
        },
      };
    } },
    // Network ("Living web"): points wander and thin lines join any two that come close
    network: { name: 'Network', make(w, h, P, dark, k) {
      const N = capped(30, k, 70); const D = clamp(Math.sqrt(w * h / N) * 1.25, 60, 95);
      const p = Array.from({ length: N }, () => ({ x: R(0, w), y: R(0, h), vx: R(-9, 9), vy: R(-9, 9), ph: R(0, TAU) }));
      const B = 5;
      return {
        step(dt, t) {
          for (const q of p) {
            const a = flow(q.x, q.y, t * .5); q.vx += Math.cos(a) * 3 * dt; q.vy += Math.sin(a) * 3 * dt;
            const sp = Math.hypot(q.vx, q.vy); if (sp > 12) { q.vx *= 12 / sp; q.vy *= 12 / sp; }
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
          c.strokeStyle = P.net; c.lineWidth = .9;
          segs.forEach((s, i) => { c.globalAlpha = (i + 1) / B * (dark ? .55 : .5); strokeSegs(c, s); });
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
        step(dt, t) {
          acc += dt * 9 * clamp(k, .2, 3.5);
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
    // Lorenz butterfly (a strange attractor): three tracers start almost together and soon go their own ways;
    // the whole shape turns slowly in 3D
    lorenz: { name: 'Lorenz', make(w, h, P, dark, k) {
      const NT = clamp(Math.round(3 * Math.sqrt(k)), 2, 6); const L = 600;
      const tr = Array.from({ length: NT }, (_, i) => ({ x: 1 + i * .25, y: 1, z: 20, c: 0, pts: [], col: P.attr[i % P.attr.length] }));
      const sub = (q, dt) => { const dx = 10 * (q.y - q.x); const dy = q.x * (28 - q.z) - q.y; const dz = q.x * q.y - 8 / 3 * q.z; q.x += dx * dt; q.y += dy * dt; q.z += dz * dt; };
      for (const q of tr) for (let i = 0; i < 600; i++) sub(q, .005);
      let rot = R(0, TAU);
      return {
        step(dt) {
          rot += dt * .12; const n = Math.max(1, Math.ceil(dt * .75 / .004)); const hS = dt * .75 / n;
          for (const q of tr) { for (let i = 0; i < n; i++) { sub(q, hS); if (++q.c % 3 === 0) q.pts.push(q.x, q.y, q.z); } if (q.pts.length > L * 3) q.pts.splice(0, q.pts.length - L * 3); }
        },
        draw(c) {
          const s = Math.min(w / 52, h / 56) * .95; const cs = Math.cos(rot); const sn = Math.sin(rot);
          const px = (x, y) => w / 2 + (x * cs - y * sn) * s; const py = (z) => h / 2 - (z - 25) * s;
          c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 1.2;
          for (const q of tr) {
            const pts = q.pts; const m = pts.length / 3; if (m < 2) continue; const CH = 12; c.strokeStyle = q.col;
            for (let s0 = 0; s0 < m - 1; s0 += CH) {
              const e = Math.min(m - 1, s0 + CH); c.globalAlpha = Math.pow(e / m, 1.4) * (dark ? .85 : .75); c.beginPath();
              for (let i = s0; i <= e; i++) { const x = px(pts[i * 3], pts[i * 3 + 1]); const y = py(pts[i * 3 + 2]); if (i === s0) c.moveTo(x, y); else c.lineTo(x, y); }
              c.stroke();
            }
            glow2(c, px(q.x, q.y), py(q.z), 2.6, q.col, q.col, 1, .5);
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
        step(dt, t) {
          const wind = 9 + 6 * Math.sin(t * .35);
          if (go(dt) && whirls.length < 2) whirls.push({ x: R(w * .2, w * .8), y: R(h * .3, h * .8), age: 0, life: R(3.2, 4.2), r: R(45, 75) * S, dir: Math.random() < .5 ? 1 : -1 });
          for (const wh of whirls) wh.x += wind * .8 * dt;
          for (const q of f) {
            let tvx = wind * q.m; let tvy = 12 + Math.sin(q.fp) * 7; let pull = 2;
            for (const wh of whirls) {
              const dx = q.x - wh.x; const dy = q.y - wh.y; const d = Math.hypot(dx, dy) || 1; const R0 = wh.r * 1.7;
              if (d < R0) { const f0 = Math.sin(Math.PI * wh.age / wh.life) * (1 - d / R0); tvx += (-dy / d * 85 * wh.dir) * f0; tvy += (dx / d * 85 * wh.dir - 30) * f0; pull += f0 * 4; q.rot += wh.dir * f0 * 4 * dt; }
            }
            q.vx += (tvx - q.vx) * Math.min(1, pull * dt); q.vy += (tvy - q.vy) * Math.min(1, pull * dt);
            q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.fp += q.fs * dt;
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
    // sparkles, and every few seconds a shooting star streaks past
    nightsky: { name: 'Night sky', make(w, h, P, dark, k) {
      const s = Array.from({ length: capped(70, k, 180) }, () => ({ x: R(0, w), y: R(0, h), r: .35 + Math.pow(Math.random(), 3) * 1.3, f: R(.6, 3.5), ph: R(0, TAU), base: R(.3, .85) }));
      const sh = []; const go = every(3.5, 8, k);
      const shooter = () => { const L = Math.random() < .5; const a = (L ? 0 : Math.PI) + (L ? 1 : -1) * R(.3, .7); const sp = R(260, 380); return { x: L ? R(-10, w * .5) : R(w * .5, w + 10), y: R(-10, h * .35), vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, age: 0, life: R(.7, 1.1), len: R(55, 90) }; };
      return {
        step(dt) { if (go(dt)) sh.push(shooter()); for (const m of sh) { m.x += m.vx * dt; m.y += m.vy * dt; } cull(sh, dt); },
        draw(c, t) {
          c.fillStyle = P.skyStar;
          for (const q of s) {
            const a = q.base * (.55 + .45 * Math.sin(t * q.f + q.ph)); c.globalAlpha = a; dot(c, q.x, q.y, q.r);
            if (q.r > 1.2) { c.globalAlpha = a * .5; c.fillRect(q.x - q.r * 3, q.y - .35, q.r * 6, .7); c.fillRect(q.x - .35, q.y - q.r * 3, .7, q.r * 6); }
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
    // Glitch ("Glitch storm"): faint scanlines and a slow refresh bar like an old screen; every few seconds the
    // picture "breaks" for half a second with torn, colour-split bands and noise
    glitch: { name: 'Glitch', make(w, h, P, dark, k) {
      let burst = 0; let bands = []; let reroll = 0; const go = every(2.8, 5.5, k); let bar = R(0, h);
      const roll = () => { bands = Array.from({ length: Math.round(R(3, 7)) }, () => ({ y: R(0, h), hh: R(3, 16), off: R(-18, 18), x: R(-w * .2, w * .6), wd: R(w * .25, w * .9), noise: Math.random() < .5 })); };
      return {
        step(dt) {
          bar = (bar + dt * 28) % (h + 40);
          if (burst <= 0 && go(dt)) { burst = R(.35, .75); roll(); }
          if (burst > 0) { burst -= dt; reroll -= dt; if (reroll <= 0) { reroll = .07; roll(); } }
        },
        draw(c, t) {
          c.fillStyle = P.glitchInk; c.globalAlpha = dark ? .05 : .045;
          const shift = (t * 8) % 4; for (let y = shift; y < h; y += 4) c.fillRect(0, y, w, 1);
          const gb = c.createLinearGradient(0, bar - 40, 0, bar); gb.addColorStop(0, 'transparent'); gb.addColorStop(1, P.glitchInk);
          c.globalAlpha = dark ? .06 : .05; c.fillStyle = gb; c.fillRect(0, bar - 40, w, 40);
          if (burst <= 0) return;
          for (const b of bands) {
            c.globalAlpha = .28; c.fillStyle = P.glitch[0]; c.fillRect(b.x + b.off - 3, b.y, b.wd, b.hh);
            c.fillStyle = P.glitch[2]; c.fillRect(b.x + b.off + 3, b.y + 1, b.wd, b.hh);
            c.globalAlpha = .18; c.fillStyle = P.glitch[1]; c.fillRect(b.x, b.y - 1, b.wd * .6, b.hh * .5);
            if (b.noise) { c.fillStyle = P.glitchInk; c.globalAlpha = .5; for (let i = 0; i < 26; i++) c.fillRect(Math.round(b.x + R(0, b.wd)), Math.round(b.y + R(0, b.hh)), R(1, 4), 1.5); }
          }
        },
      };
    } },
    // Black hole ("Accretion disk"): seen from the side, a tilted glowing disk spins around a black centre (the
    // inner part faster and hotter), with a bright ring and a bent arc of light over the top; sometimes a jet
    blackhole: { name: 'Black hole', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const cx = w / 2; const cy = h / 2; const rin = 16 * S; const rout = Math.min(w * .46, 120 * S); const tilt = .3;
      const spawn = (q, any) => { q.r = any ? R(rin * 1.3, rout) : R(rout * .8, rout); q.a = R(0, TAU); q.in = R(3, 7) * S; };
      const p = Array.from({ length: capped(110, k, 260) }, () => { const q = {}; spawn(q, true); return q; });
      const jets = []; const go = every(6, 12, k);
      const col = (r) => { const u = clamp((r - rin) / (rout - rin), 0, 1); return u < .5 ? mixHex(P.disk[2], P.disk[1], u * 2) : mixHex(P.disk[1], P.disk[0], (u - .5) * 2); };
      const half = (c, back) => {
        for (const q of p) {
          const s = Math.sin(q.a); if (back ? s > 0 : s <= 0) continue;
          const x = cx + Math.cos(q.a) * q.r; const y = cy + s * q.r * tilt; const dop = .65 + .35 * -Math.cos(q.a);
          c.globalAlpha = clamp(dop * (.4 + .6 * (1 - (q.r - rin) / (rout - rin))), 0, 1) * (dark ? 1 : .85); c.fillStyle = col(q.r); dot(c, x, y, .8 + (1 - q.r / rout) * 1.2);
        }
      };
      return {
        step(dt) {
          for (const q of p) { const om = 2.2 * Math.pow(rin * 2 / q.r, 1.5); q.a += om * dt; q.r -= q.in * dt * (rin * 3 / q.r); if (q.r < rin * 1.05) spawn(q, false); }
          if (go(dt)) { const dir = Math.random() < .5 ? -1 : 1; for (let i = 0; i < 24; i++) jets.push({ x: cx + R(-2, 2), y: cy, vx: R(-10, 10), vy: dir * R(70, 150), age: 0, life: R(.9, 1.5) }); }
          for (const j of jets) { j.x += j.vx * dt; j.y += j.vy * dt; }
          cull(jets, dt);
        },
        draw(c) {
          const halo = c.createRadialGradient(cx, cy, rin, cx, cy, rout * .9); halo.addColorStop(0, P.disk[1]); halo.addColorStop(1, 'transparent');
          c.globalAlpha = dark ? .14 : .08; c.fillStyle = halo; c.beginPath(); c.ellipse(cx, cy, rout, rout * .55, 0, 0, TAU); c.fill();
          half(c, true);
          c.globalAlpha = .55; c.strokeStyle = P.ring; c.lineWidth = 2.2 * S; c.beginPath(); c.ellipse(cx, cy, rin * 1.55, rin * 1.35, 0, Math.PI, TAU); c.stroke();
          c.globalAlpha = 1; c.fillStyle = P.hole; dot(c, cx, cy, rin);
          c.globalAlpha = .8; c.strokeStyle = P.ring; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, rin * 1.06, 0, TAU); c.stroke();
          half(c, false);
          c.fillStyle = P.jet; for (const j of jets) { c.globalAlpha = (1 - j.age / j.life) * .85; dot(c, j.x, j.y, 1.2); }
        },
      };
    } },
    // Digital ocean: a grid of dots seen in perspective, rolling like the sea; the crests catch the light
    ocean: { name: 'Digital ocean', make(w, h, P, dark, k) {
      const cols = clamp(Math.round(24 * Math.sqrt(k)), 16, 42); const rows = clamp(Math.round(14 * Math.pow(k, .3)), 10, 22); const hor = h * .2;
      return {
        step() {},
        draw(c, t) {
          const lo = []; const hi = [];
          for (let j = 0; j < rows; j++) {
            const z = 2.4 - j / (rows - 1) * 2.05; // far → near
            for (let i = 0; i < cols; i++) {
              const u = i / (cols - 1) * 2 - 1; const x = u * z;
              const y = .16 * (Math.sin(x * 2.6 + t * 1.1) + .7 * Math.sin(z * 4.2 - t * 1.6) + .45 * Math.sin((x + z) * 2.1 + t * .7));
              const sx = w / 2 + u * w * .56; const sy = hor + (.55 - y) / z * h * .42; if (sy > h + 4) continue;
              const near = 1 - (z - .35) / 2.05; const crest = clamp((y + .2) / .5, 0, 1);
              (crest > .75 ? hi : lo).push([sx, sy, (.5 + near * 1.6), .25 + near * .6 + crest * .2]);
            }
          }
          bucketDots(c, lo, P.wave, 5, dark ? .9 : .8); bucketDots(c, hi, P.waveHi, 3, dark ? .95 : .85);
        },
      };
    } },
    // Silk waves ("Flowing silk"): ribbons of glittering dots ripple across the middle, weaving over and under
    silk: { name: 'Silk waves', make(w, h, P, dark, k) {
      const RIB = 7; const N = clamp(Math.round(60 * Math.sqrt(k)), 40, 110);
      return {
        step() {},
        draw(c, t) {
          const groups = [[], [], []];
          for (let j = 0; j < RIB; j++) {
            const amp = h * (.14 + .06 * Math.sin(t * .3 + j * .5)); const grp = j < 2 ? 0 : j < 5 ? 1 : 2;
            for (let i = 0; i < N; i++) {
              const x = i / (N - 1) * (w + 20) - 10; const u = x / w * TAU;
              const y = h / 2 + amp * Math.sin(u * 1.1 + t * .8 + j * .38) + h * .06 * Math.sin(u * 2.3 - t * .6 + j * .2);
              const sh = .5 + .5 * Math.sin(u * 3 + t * 1.5 + j); groups[grp].push([x, y, .7 + sh * .9, .2 + sh * .8]);
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
      return {
        step(dt) { for (const q of f) { q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.th += q.vt * dt; wrap(q, w, h, 20); } },
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
    // XP orbs: glowing orbs float around; every few seconds a collector appears, a handful of nearby orbs zoom into
    // it one after another, and it pops with a little "+XP"
    xp: { name: 'XP orbs', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const N = capped(14, k, 40);
      const mk = (edge) => { const q = { x: R(0, w), y: R(0, h), c: Math.random() < .6 ? 0 : 1, r: R(2.2, 3.6) * S, ph: R(0, TAU), go: false, v: 0, wait: 0, born: 0 }; if (edge) { if (Math.random() < .5) q.x = Math.random() < .5 ? -6 : w + 6; else q.y = Math.random() < .5 ? -6 : h + 6; } return q; };
      const f = Array.from({ length: N }, () => mk(false)); let col = null; const texts = []; const go = every(4, 7, k);
      return {
        step(dt, t) {
          for (const q of f) {
            if (q.go && q.wait <= 0 && col) { const dx = col.x - q.x; const dy = col.y - q.y; const d = Math.hypot(dx, dy) || 1; q.v = Math.min(260, q.v + 420 * dt); q.x += dx / d * q.v * dt; q.y += dy / d * q.v * dt; if (d < 6) { q.dead = true; col.got++; col.fl = 1; } }
            else { q.wait -= dt; const a = flow(q.x, q.y, t * .5); q.x += Math.cos(a) * 9 * dt; q.y += Math.sin(a) * 9 * dt; wrap(q, w, h, 8); }
            q.born = Math.min(1, q.born + dt * 1.5);
          }
          for (let i = f.length - 1; i >= 0; i--) if (f[i].dead) f.splice(i, 1);
          if (!col && go(dt)) {
            col = { x: R(w * .2, w * .8), y: R(h * .25, h * .75), age: 0, got: 0, fl: 0, want: 0 };
            const near = [...f].sort((a, b) => Math.hypot(a.x - col.x, a.y - col.y) - Math.hypot(b.x - col.x, b.y - col.y)).slice(0, Math.round(R(4, 8)));
            near.forEach((q, i) => { q.go = true; q.wait = .4 + i * .18; q.v = 0; }); col.want = near.length;
          }
          if (col) {
            col.age += dt; col.fl = Math.max(0, col.fl - dt * 4);
            if (col.got >= col.want || col.age > 5) { texts.push({ x: col.x, y: col.y, n: col.got * 5, age: 0, life: 1.3 }); for (const q of f) q.go = false; col = null; }
          }
          while (f.length < N) f.push(mk(true));
          for (const tx of texts) tx.y -= 22 * dt;
          cull(texts, dt);
        },
        draw(c, t) {
          if (col) {
            const a = clamp(col.age * 3, 0, 1); c.globalAlpha = a * .6; c.strokeStyle = P.xp[0]; c.lineWidth = 1.4;
            c.beginPath(); c.arc(col.x, col.y, 9 * S + col.fl * 5 + Math.sin(t * 6) * 1.2, 0, TAU); c.stroke();
            glow2(c, col.x, col.y, 4 * S, P.xp[0], P.xp[1], a * .8, .5);
          }
          for (const q of f) glow2(c, q.x, q.y, q.r * q.born, P.xp[q.c], P.xp[q.c], (.55 + .3 * Math.sin(t * 2.2 + q.ph)) * q.born, dark ? .5 : .35);
          c.textAlign = 'center'; c.font = `800 ${Math.round(12 * S + 2)}px "Nunito", "Segoe UI", sans-serif`;
          for (const tx of texts) { c.globalAlpha = 1 - tx.age / tx.life; c.fillStyle = P.xpText; c.fillText(`+${tx.n} XP`, tx.x, tx.y); }
        },
      };
    } },
    // Shape shifter (particle morphing): a swarm of dots pulls together into a heart, bursts apart and reforms as a
    // star, a crescent moon, an infinity sign, a flower…
    morph: { name: 'Shape shifter', make(w, h, P, dark, k) {
      const N = capped(150, k, 260); const names = Object.keys(MORPH_SHAPES); let si = Math.floor(R(0, names.length));
      const S = Math.min(w, h) * .36; const cx = w / 2; const cy = h / 2;
      const p = Array.from({ length: N }, (_, i) => ({ x: R(0, w), y: R(0, h), vx: 0, vy: 0, tx: 0, ty: 0, j: R(-.035, .035), g: i % 3, ph: R(0, TAU) }));
      const target = () => { const fn = MORPH_SHAPES[names[si]]; const order = p.map((_, i) => i).sort(() => Math.random() - .5); order.forEach((pi, i) => { const [x, y] = fn(i / N); const q = p[pi]; q.tx = cx + (x + q.j) * S; q.ty = cy + (y + q.j) * S; }); };
      target(); let phase = 'form'; let pt = 0; const FORM = 1.9; const HOLD = 2.6; const BURST = 1;
      return {
        step(dt, t) {
          pt += dt;
          if (phase === 'form' && pt > FORM) { phase = 'hold'; pt = 0; }
          else if (phase === 'hold' && pt > HOLD) { phase = 'burst'; pt = 0; for (const q of p) { const a = Math.atan2(q.y - cy, q.x - cx) + R(-.5, .5); const sp = R(60, 170); q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; } }
          else if (phase === 'burst' && pt > BURST) { phase = 'form'; pt = 0; si = (si + 1 + Math.floor(R(0, names.length - 1))) % names.length; target(); }
          const damp = Math.exp(-(phase === 'burst' ? 2.2 : 6) * dt);
          for (const q of p) {
            if (phase !== 'burst') {
              const kk = phase === 'hold' ? 40 : 16 * clamp(pt / .6, .2, 1);
              const tx = q.tx + (phase === 'hold' ? Math.sin(t * 2 + q.ph) * 1.2 : 0); const ty = q.ty + (phase === 'hold' ? Math.cos(t * 1.7 + q.ph) * 1.2 : 0);
              q.vx += (tx - q.x) * kk * dt; q.vy += (ty - q.y) * kk * dt;
            }
            q.vx *= damp; q.vy *= damp; q.x += q.vx * dt; q.y += q.vy * dt;
          }
        },
        draw(c, t) {
          c.globalAlpha = dark ? .9 : .85;
          for (let g = 0; g < 3; g++) {
            c.fillStyle = P.morph[g]; c.beginPath();
            for (const q of p) { if (q.g !== g) continue; const r = 1.25 + .4 * Math.sin(t * 3 + q.ph); c.moveTo(q.x + r, q.y); c.arc(q.x, q.y, r, 0, TAU); }
            c.fill();
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
        step(dt, t) {
          const [gx, gy] = pos(t); const damp = Math.exp(-2.2 * dt);
          for (const q of d) {
            const dx = q.x - gx; const dy = q.y - gy; const dd = Math.hypot(dx, dy) || 1;
            if (dd < RG) { const f = (1 - dd / RG) ** 2 * 1100 * S; q.vx += dx / dd * f * dt; q.vy += dy / dd * f * dt; }
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
    // something startles them and they scatter
    fish: { name: 'Fish', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280;
      const b = Array.from({ length: capped(30, k, 70) }, (_, i) => { const a = R(0, TAU); return { x: R(30, w - 30), y: R(30, h - 30), vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, g: i % 3, ph: R(0, TAU) }; });
      let scare = null; const go = every(7, 13, k); let T = 0;
      const extra = (q) => {
        const a = flow(q.x, q.y, T * .5, .01); let ex = Math.cos(a) * 6; let ey = Math.sin(a) * 6;
        if (scare) { const dx = q.x - scare.x; const dy = q.y - scare.y; const d = Math.hypot(dx, dy) || 1; if (d < 80 * S) { const f = (1 - d / (80 * S)) * 900 * (1 - scare.age / scare.life); ex += dx / d * f; ey += dy / d * f; } }
        return [ex, ey];
      };
      return {
        step(dt, t) {
          T = t; if (!scare && go(dt)) { const q = pick(b); scare = { x: q.x + R(-10, 10), y: q.y + R(-10, 10), age: 0, life: .6 }; }
          if (scare) { scare.age += dt; if (scare.age > scare.life) scare = null; }
          flockStep(b, dt, { w, h, see: 42 * S, apart: 13 * S, cohere: .8, align: 1.6, sep: 9, minS: 18 * S, maxS: (scare ? 95 : 44) * S, edge: 26 * S, extra });
        },
        draw(c, t) {
          const L = 6.5 * S;
          for (const q of b) {
            const a = Math.atan2(q.vy, q.vx); const wig = Math.sin(t * 11 + q.ph) * .35;
            c.save(); c.translate(q.x, q.y); c.rotate(a); c.globalAlpha = .85; c.fillStyle = P.fish[q.g];
            c.beginPath(); c.ellipse(0, 0, L, L * .38, 0, 0, TAU); c.fill();
            c.rotate(wig); c.beginPath(); c.moveTo(-L * .8, 0); c.lineTo(-L * 1.55, -L * .42); c.lineTo(-L * 1.55, L * .42); c.closePath(); c.fill(); c.restore();
          }
        },
      };
    } },
    // Solar system: a glowing sun with four planets on tilted orbits (the inner ones faster, one with a moon);
    // now and then a comet swings in, whips round the sun and flies off
    solar: { name: 'Solar system', make(w, h, P, dark, k) {
      const S = Math.min(w, h) / 280; const cx = w / 2; const cy = h / 2; const tilt = .42; const big = Math.min(w * .46, h * .46 / tilt);
      const pl = [.2, .38, .6, .86].map((f, i) => ({ r: big * f, a: R(0, TAU), s: R(2, 3.6) * S, col: P.planet[i], moon: i === 1, ma: R(0, TAU) }));
      const comets = []; const go = every(8, 14, k); const GM = 1.6e5 * S * S * S;
      const pos = (q) => [cx + Math.cos(q.a) * q.r, cy + Math.sin(q.a) * q.r * tilt];
      const planet = (c, q) => { const [x, y] = pos(q); c.globalAlpha = .95; c.fillStyle = q.col; dot(c, x, y, q.s); if (q.moon) { c.fillStyle = P.orbit; dot(c, x + Math.cos(q.ma) * 9 * S, y + Math.sin(q.ma) * 9 * S * tilt, 1.1); } };
      return {
        step(dt) {
          for (const q of pl) { q.a += dt * 1.1 * Math.pow(big * .2 / q.r, 1.5); q.ma += dt * 3; }
          if (go(dt) && comets.length < 2) { const a = R(0, TAU); const r = Math.hypot(w, h) * .55; const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r; const toward = Math.atan2(cy - y, cx - x) + R(.18, .32) * (Math.random() < .5 ? 1 : -1); const sp = R(55, 75) * S; comets.push({ x, y, vx: Math.cos(toward) * sp, vy: Math.sin(toward) * sp, age: 0 }); }
          for (let i = comets.length - 1; i >= 0; i--) {
            const m = comets[i]; m.age += dt; const n = 4; const hS = dt / n;
            for (let j = 0; j < n; j++) { const dx = cx - m.x; const dy = cy - m.y; const r2 = dx * dx + dy * dy + 120 * S; const r = Math.sqrt(r2); const f = GM / r2; m.vx += dx / r * f * hS; m.vy += dy / r * f * hS; m.x += m.vx * hS; m.y += m.vy * hS; }
            if ((m.age > 3 && (m.x < -60 || m.x > w + 60 || m.y < -60 || m.y > h + 60)) || m.age > 25) comets.splice(i, 1);
          }
        },
        draw(c, t) {
          c.strokeStyle = P.orbit; c.lineWidth = .8; c.globalAlpha = dark ? .22 : .25;
          for (const q of pl) { c.beginPath(); c.ellipse(cx, cy, q.r, q.r * tilt, 0, 0, TAU); c.stroke(); }
          for (const q of pl) if (Math.sin(q.a) < 0) planet(c, q);
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, 26 * S); g.addColorStop(0, P.sun); g.addColorStop(1, 'transparent');
          c.globalAlpha = (dark ? .5 : .35) + .05 * Math.sin(t * 2); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 26 * S, 0, TAU); c.fill();
          c.globalAlpha = 1; c.fillStyle = P.sun; dot(c, cx, cy, 6.5 * S);
          for (const q of pl) if (Math.sin(q.a) >= 0) planet(c, q);
          for (const m of comets) {
            const dx = m.x - cx; const dy = m.y - cy; const d = Math.hypot(dx, dy) || 1; const L = clamp(2600 * S / d, 8, 46) * S;
            const tx = m.x + dx / d * L; const ty = m.y + dy / d * L; const gg = c.createLinearGradient(m.x, m.y, tx, ty); gg.addColorStop(0, P.planet[0]); gg.addColorStop(1, 'transparent');
            c.globalAlpha = .8; c.strokeStyle = gg; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(tx, ty); c.stroke();
            glow2(c, m.x, m.y, 2.2, P.planet[0], P.planet[0], 1, .5);
          }
        },
      };
    } },
    // Contour map ("Living map", topographic flow): contour lines of an imaginary landscape, every fourth darker
    // like on a hiking map; the hills and valleys slowly shift
    topo: { name: 'Contour map', make(w, h, P, dark, k) {
      const g = clamp(13 / Math.sqrt(Math.max(.5, k)), 9, 16); const step = .38;
      let cache = null; let cacheT = -1;
      return {
        step() {},
        draw(c, t) {
          // the land moves slowly, so the lines are worked out at most 15 times a second
          if (!cache || Math.abs(t - cacheT) > 1 / 15) { cache = contours(w, h, t * 3, g, step); cacheT = t; }
          c.lineJoin = 'round'; c.strokeStyle = P.topo; c.lineWidth = .9; c.globalAlpha = .4; strokeSegs(c, cache.lines);
          c.strokeStyle = P.topoHi; c.lineWidth = 1.4; c.globalAlpha = dark ? .55 : .5; strokeSegs(c, cache.index);
        },
      };
    } },
    // Neon tunnel ("Wireframe tunnel"): an endless neon wireframe tunnel; square rings rush toward you, it slowly
    // bends left and right, and streaks of light zip along the walls
    tunnel: { name: 'Neon tunnel', make(w, h, P, dark, k) {
      const N = 12; const f = Math.min(w, h) * .55; const SP = 1.6; const HW = 1.35; const HH = 1;
      const rings = Array.from({ length: N }, (_, i) => ({ z: .4 + i * (9 / N) }));
      const sparks = Array.from({ length: capped(16, k, 50) }, () => ({ z: R(.5, 9), side: Math.floor(R(0, 4)), u: R(-1, 1), sp: R(2.4, 4) }));
      let T = 0;
      const off = (z) => [Math.sin(T * .35) * z * z * .03, Math.cos(T * .27) * z * z * .02];
      const proj = (X, Y, z) => { const [ox, oy] = off(z); return [w / 2 + (X + ox) / z * f, h / 2 + (Y + oy) / z * f]; };
      const wallPt = (side, u, z) => (side === 0 ? proj(u * HW, -HH, z) : side === 1 ? proj(HW, u * HH, z) : side === 2 ? proj(u * HW, HH, z) : proj(-HW, u * HH, z));
      return {
        step(dt, t) {
          T = t;
          for (const r of rings) { r.z -= SP * dt; if (r.z < .4) r.z += 9; }
          for (const s of sparks) { s.z -= s.sp * dt; if (s.z < .45) { s.z = R(7, 9); s.side = Math.floor(R(0, 4)); s.u = R(-1, 1); } }
        },
        draw(c) {
          const rs = [...rings].sort((a, b) => b.z - a.z); c.lineJoin = 'round';
          for (const r of rs) {
            const a = clamp((9 - r.z) / 6, 0, 1) * clamp((r.z - .4) / .6, 0, 1); c.globalAlpha = a * (dark ? .7 : .65); c.strokeStyle = P.tunnel; c.lineWidth = .8 + 1.2 / r.z;
            const p0 = proj(-HW, -HH, r.z); const p1 = proj(HW, -HH, r.z); const p2 = proj(HW, HH, r.z); const p3 = proj(-HW, HH, r.z);
            c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.closePath(); c.stroke();
          }
          c.strokeStyle = P.tunnel; c.lineWidth = .8; c.globalAlpha = .35;
          for (const [X, Y] of [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH], [0, -HH], [HW, 0], [0, HH], [-HW, 0]]) {
            c.beginPath(); for (let z = 9; z >= .45; z -= .5) { const p = proj(X, Y, z); if (z === 9) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); } c.stroke();
          }
          c.strokeStyle = P.tunnel2; c.lineCap = 'round';
          for (const s of sparks) { const a = clamp((9 - s.z) / 4, 0, 1); const p = wallPt(s.side, s.u, s.z); const q = wallPt(s.side, s.u, s.z + .7); c.globalAlpha = a * .9; c.lineWidth = 1 + 1.4 / s.z; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(p[0], p[1]); c.stroke(); }
        },
      };
    } },
    // Synthwave ("Synthwave road"): a neon grid floor rolls toward you under a striped sunset sun, with wireframe
    // mountains on the horizon and stars above
    synthwave: { name: 'Synthwave', make(w, h, P, dark, k) {
      const hor = h * .52; const camH = 1; const f = h * .55; let scroll = 0;
      const stars = Array.from({ length: capped(30, k, 80) }, () => ({ x: R(0, w), y: R(0, hor * .85), ph: R(0, TAU), f: R(1, 3) }));
      const mts = Array.from({ length: 14 }, (_, i) => [i / 13 * w, hor - R(6, 30) * Math.min(1, h / 280) * (i === 0 || i === 13 ? .2 : 1)]);
      return {
        step(dt) { scroll = (scroll + dt * 1.4) % 1; },
        draw(c, t) {
          c.fillStyle = P.tunnel2; for (const s of stars) { c.globalAlpha = .35 + .3 * Math.sin(t * s.f + s.ph); dot(c, s.x, s.y, .9); }
          // the sun, with its stripes cut out (they slowly slide down)
          const sr = Math.min(w, h) * .2; const sx = w / 2; const sy = hor;
          const sg = c.createLinearGradient(0, sy - sr, 0, sy); sg.addColorStop(0, P.sunBot); sg.addColorStop(1, P.sunTop);
          c.save(); c.beginPath(); c.arc(sx, sy, sr, Math.PI, TAU); c.closePath(); c.clip();
          c.globalAlpha = dark ? .85 : .75; c.fillStyle = sg; c.beginPath();
          let y0 = sy - sr;
          for (let i = 0; i < 6; i++) { const yy = sy - sr * .55 + i * sr * .1 + ((t * 6) % (sr * .1)); if (yy > y0) c.rect(sx - sr, y0, sr * 2, yy - y0); y0 = Math.min(sy, yy + 1 + i * .7); }
          if (y0 < sy) c.rect(sx - sr, y0, sr * 2, sy - y0);
          c.fill(); c.restore();
          c.globalAlpha = dark ? .7 : .6; c.strokeStyle = P.tunnel; c.lineWidth = 1; c.lineJoin = 'round'; c.beginPath(); mts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
          const hg = c.createLinearGradient(0, hor - 12, 0, hor + 6); hg.addColorStop(0, 'transparent'); hg.addColorStop(.7, P.horizon); hg.addColorStop(1, 'transparent');
          c.globalAlpha = dark ? .35 : .3; c.fillStyle = hg; c.fillRect(0, hor - 12, w, 18);
          c.strokeStyle = P.tunnel; c.lineWidth = 1;
          for (let i = 0; i < 16; i++) { const z = 16 - i - scroll; if (z < .3) continue; const y = hor + camH / z * f; if (y > h + 2) continue; c.globalAlpha = clamp(1.2 - z / 14, .08, .85) * (dark ? 1 : .9); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
          c.globalAlpha = dark ? .55 : .5; c.beginPath();
          for (let X = -12; X <= 12; X++) { c.moveTo(w / 2 + X / 16 * f, hor + camH / 16 * f); c.lineTo(w / 2 + X / .3 * f, hor + camH / .3 * f); }
          c.stroke();
        },
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
      return {
        step(dt) { const damp = Math.exp(-.6 * dt); for (const q of m) { q.vx = (q.vx + R(-1, 1) * 10 * dt) * damp; q.vy = (q.vy + (R(-1, 1) * 10 + 1.2) * dt) * damp; q.x += q.vx * (.5 + q.z) * dt; q.y += q.vy * (.5 + q.z) * dt; wrap(q, w, h, 6); } },
        draw(c, t) {
          for (const s of shafts) {
            c.save(); c.translate(s.x, 0); c.rotate(ang - Math.PI / 2);
            const g = c.createLinearGradient(-s.wd, 0, s.wd, 0); g.addColorStop(0, 'transparent'); g.addColorStop(.5, P.shaft); g.addColorStop(1, 'transparent');
            c.globalAlpha = (dark ? .07 : .3) * (.7 + .3 * Math.sin(t * .35 + s.ph)); c.fillStyle = g; c.fillRect(-s.wd, -20, s.wd * 2, Math.hypot(w, h) * 1.3); c.restore();
          }
          c.fillStyle = P.dust;
          for (const q of m) {
            const b = inShaft(q.x, q.y, t); const tw = .7 + .3 * Math.sin(t * 2 + q.ph); const a = (.07 + b * .85 * tw) * (dark ? 1 : .9); const r = .5 + q.z * 1.5;
            if (q.z > .75) { c.globalAlpha = a * .35; dot(c, q.x, q.y, r * 2.2); } else { c.globalAlpha = a; dot(c, q.x, q.y, r); }
          }
        },
      };
    } },
  };

  // ---------------------------------------------------------------- mouse followers
  // make(w, h, P, dark, k) → { move(x, y, dist), step(dt, t), draw(ctx, t) }   (k = frequency: .35 rarely, 1 normal, 2.6 often)
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
  const EFFECT_IDS = Object.keys(EFFECTS);
  // the order in the pickers: each follower in the same place as its background effect, with the same name and
  // icon (snow = 'frost', rain = 'ripples': older ids, kept so saved choices stay); the pencil line last (the old 'comet' = Rainbow line is the Rainbow follower again)
  const FOLLOWER_IDS = ['frost', 'fireworks', 'stardust', 'fireflies', 'bubbles', 'leaves', 'hearts', 'ripples', 'confetti', 'matrix', 'rainbow', 'pencil'];

  // Which effect and follower a note shows now, and how much of it. Settings: fxEffect / fxFollower = the choice
  // for all notes, fxEffectAmount / fxFollowerAmount = how much ('low' | 'mid' | 'high'), fxForceAll = use them on
  // every note (each note's own choice is kept for when it's switched off), fxPaused = pause every effect.
  // noteFx = { e, f, ea, fa, eo, fo } (null = same as all notes; e / f may be 'none' = nothing on this note).
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
    if (!s.fxForceAll) {
      if (n.e === 'none' || EFFECTS[n.e]) effect = n.e;
      if (n.f === 'none' || FOLLOWERS[n.f]) follower = n.f;
      if (AMOUNTS[n.ea]) effectAmount = n.ea;
      if (AMOUNTS[n.fa]) followerAmount = n.fa;
      if (opacityOf(n.eo) !== null) effectOpacity = opacityOf(n.eo);
      if (opacityOf(n.fo) !== null) followerOpacity = opacityOf(n.fo);
    }
    return { effect, follower, effectAmount, followerAmount, effectOpacity, followerOpacity, paused: !!notePaused || (!!s.fxPaused && !notePlay) };
  }

  // ---------------------------------------------------------------- one shared loop (30 frames a second, sleeps when idle)
  const loop = (() => {
    const layers = new Set();
    let running = false;
    let last = 0;
    let acc = 0;
    function frame(now) {
      const dt = Math.min(.1, (now - last) / 1000);
      last = now;
      let any = false;
      if (!document.hidden) {
        acc += dt;
        const go = acc >= 1 / 30;
        for (const L of layers) {
          if (!L.wants(now)) continue;
          any = true;
          if (go) L.tick(Math.min(acc, .1));
        }
        if (go) acc = 0;
      } else any = true; // hidden: check again when it shows (the browser hardly runs frames meanwhile)
      if (any) requestAnimationFrame(frame); else running = false;
    }
    return {
      add(L) { layers.add(L); this.wake(); },
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
  function Layer(canvas) {
    const ctx = canvas.getContext('2d');
    const setMul = fadeable(ctx);
    let w = 0; let h = 0; let dpr = 1;
    let eId = 'none'; let fId = 'none'; let dark = false; let eAmt = 'mid'; let fAmt = 'mid';
    let eOp = 1; let fOp = 1; // 1.1.17: how see-through the background / the follower is
    let eff = null; let fol = null;
    let t = Math.random() * 5;
    let mouse = null; let lastMove = -1e9;
    let paused = false; let visible = true;
    let bw = 0; let bh = 0; let rebuildTimer = null; // the size the effect was made for
    // 1.1.16: the background and the follower are made separately, so picking another mouse follower (or its
    // frequency) doesn't restart the background, and the other way round
    function makeEffect() {
      const P = dark ? DARK : LIGHT;
      const k = Math.min(2.5, Math.max(.3, (w * h) / BASE_AREA)) * EFFECT_AMOUNTS[eAmt]; // bigger notes and "Often" get more
      eff = w && h && EFFECTS[eId] ? EFFECTS[eId].make(w, h, P, dark, k) : null;
      if (eff) for (let i = 0; i < 40; i++) { t += .05; eff.step(.05, t); } // start mid-way, never from an empty note
    }
    function makeFollower() {
      fol = w && h && FOLLOWERS[fId] ? FOLLOWERS[fId].make(w, h, dark ? DARK : LIGHT, dark, AMOUNTS[fAmt]) : null;
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
      if (fol) { setMul(fOp); ctx.globalAlpha = 1; ctx.save(); fol.draw(ctx, t); ctx.restore(); }
      setMul(1); ctx.globalAlpha = 1;
    }
    const L = {
      set({ effect = 'none', follower = 'none', dark: dk = false, effectAmount = 'mid', followerAmount = 'mid', effectOpacity = 1, followerOpacity = 1 } = {}) {
        const ea = amountOf(effectAmount); const fa = amountOf(followerAmount);
        // opacity only changes how it's drawn: nothing is made again, so moving the slider never restarts anything
        const eo = opacityOf(effectOpacity) ?? 1; const fo = opacityOf(followerOpacity) ?? 1;
        const opChanged = eo !== eOp || fo !== fOp;
        eOp = eo; fOp = fo;
        const effChanged = effect !== eId || dk !== dark || ea !== eAmt;
        const folChanged = follower !== fId || dk !== dark || fa !== fAmt;
        eId = effect; fId = follower; dark = dk; eAmt = ea; fAmt = fa;
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
        if (!fol || paused || !visible) return;
        const d = mouse ? Math.hypot(x - mouse.x, y - mouse.y) : 0;
        mouse = { x, y };
        fol.move(x, y, d);
        lastMove = performance.now();
        loop.wake();
      },
      leave() { mouse = null; },
      setPaused(p) { paused = !!p; draw(); loop.wake(); },
      setVisible(v) { visible = !!v; draw(); loop.wake(); },
      // does it need frames right now?
      wants(now) {
        if (paused || !visible || !w || !h) return false;
        if (eff) return true;
        return !!fol && (now - lastMove < 400 || (fol.busy ? fol.busy() : now - lastMove < 2500));
      },
      tick(dt) { t += dt; if (eff) eff.step(dt, t); if (fol) fol.step(dt, t); draw(); },
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
      fairy: ['#E0608E', '<path class="f" d="M17 3c.4 2.3 1.4 3.3 3.7 3.7-2.3.4-3.3 1.4-3.7 3.7-.4-2.3-1.4-3.3-3.7-3.7 2.3-.4 3.3-1.4 3.7-3.7z"/><path d="M13 11.5c-3 1-5 3-6.2 6" stroke-dasharray="1.5 2.5"/><circle cx="5.5" cy="19.5" r="1.2" class="f"/><circle cx="9.5" cy="18" r=".9" class="f"/>'],
      warp: ['#3A6FD8', '<path d="M9.2 9.6 4.5 5.8M14.8 9.6l4.7-3.8M9.2 14.4l-4.7 3.8M14.8 14.4l4.7 3.8M12 8.2V3M12 15.8V21M8.2 12H3M15.8 12H21"/>'],
      network: ['#4A6290', '<path d="M5 7l7-3 7 5-4 9-8-1zM12 4l3 14M5 7l10 11" stroke-opacity=".6" stroke-width="1.4"/><circle cx="5" cy="7" r="1.7" class="f"/><circle cx="12" cy="4" r="1.7" class="f"/><circle cx="19" cy="9" r="1.7" class="f"/><circle cx="15" cy="18" r="1.7" class="f"/><circle cx="7" cy="17" r="1.7" class="f"/>'],
      embers: ['#E0700A', '<circle cx="8" cy="16.5" r="1.7" class="f"/><circle cx="14.5" cy="12" r="1.4" class="f"/><circle cx="10" cy="7.5" r="1.1" class="f"/><circle cx="17" cy="5" r=".9" class="f"/><path d="M4 21c4-1.6 12-1.6 16 0"/>'],
      lorenz: ['#8E5BD8', '<path d="M12 12C10 7.5 3.5 6.5 3.5 11s6.5 4.5 8.5 1c2-3.5 8.5-3.5 8.5 1s-6.5 4-8.5-1z"/><circle cx="20.5" cy="13" r="1.4" class="f"/>'],
      blossom: ['#E0608E', '<circle cx="12" cy="6.8" r="3" class="f"/><circle cx="16.9" cy="10.4" r="3" class="f"/><circle cx="15" cy="16.2" r="3" class="f"/><circle cx="9" cy="16.2" r="3" class="f"/><circle cx="7.1" cy="10.4" r="3" class="f"/><circle cx="12" cy="12" r="1.7" fill="#FFF3B0" stroke="none"/>'],
      nightsky: ['#4A5A8C', '<path class="f" d="M15 4a7.5 7.5 0 1 0 5.5 12.6A6.5 6.5 0 0 1 15 4z"/><path class="f" d="M6 3.5l.6 1.7 1.7.6-1.7.6L6 8.1l-.6-1.7-1.7-.6 1.7-.6z"/><path d="M3 15.5 7.5 13"/>'],
      glitch: ['#E5484D', '<path d="M4 6h10M8 10h12M3 14h9M10 18h10"/><path d="M4 10h2M15 14h5M3 18h4" stroke="#3A8DDE"/>'],
      blackhole: ['#E0700A', '<ellipse cx="12" cy="12" rx="9.5" ry="3.6"/><circle cx="12" cy="12" r="3.9" fill="#221E2A"/>'],
      ocean: ['#2C63B8', '<path d="M3 9c3-3 6 3 9 0s6-3 9 0M3 15c3-3 6 3 9 0s6-3 9 0" stroke-dasharray=".1 3" stroke-width="2.4"/>'],
      silk: ['#8E5BD8', '<path d="M2 12c4-6 8 6 12 0s6-4 8-2M2 9c4 6 8-6 12 0s6 5 8 2" />'],
      shards: ['#3A8DDE', '<path d="M4 9l6-5 3 7zM13 14l7-2-3 8zM5 16l4 1-2 4z"/>'],
      xp: ['#1F9A50', '<circle cx="10" cy="13.5" r="6"/><circle cx="10" cy="13.5" r="2.5" class="f"/><path d="M18 3v5M15.5 5.5h5"/>'],
      morph: ['#E0608E', '<path d="M12 20C6 16.4 3 13.3 3 9.6 3 7 5 5 7.5 5c1.9 0 3.5 1.1 4.5 2.7C13 6.1 14.6 5 16.5 5 19 5 21 7 21 9.6c0 3.7-3 6.8-9 10.4z" stroke-dasharray=".1 2.7" stroke-width="2.4"/>'],
      ghost: ['#3A6FD8', '<path d="M4 4h.01M9 4h.01M15 4h.01M20 4h.01M4 9.5h.01M20 9.5h.01M4 14.5h.01M20 14.5h.01M4 20h.01M9 20h.01M15 20h.01M20 20h.01" stroke-width="2.6"/><circle cx="12" cy="12" r="4.5" stroke-dasharray="1.5 2"/>'],
      fish: ['#2A7FD0', '<path class="f" d="M2.5 12c3-4 8-5 12-2l5.5-3.5v11L14.5 14c-4 3-9 2-12-2z"/><circle cx="7" cy="11.2" r="1" fill="#fff" stroke="none"/>'],
      solar: ['#E08A00', '<circle cx="12" cy="12" r="3" class="f"/><ellipse cx="12" cy="12" rx="9.5" ry="4.5"/><circle cx="19.6" cy="9.3" r="1.7" class="f"/>'],
      topo: ['#8A7040', '<path d="M12 3.5c5 0 8.5 3.5 8.5 7.5s-4 9.5-9 9.5-8-4-8-8 3.5-9 8.5-9z"/><path d="M12 8c3 0 4.5 1.5 4.5 3.5S14 16 11.5 16 8 14 8 12s1.5-4 4-4z"/><circle cx="12" cy="12" r="1" class="f"/>'],
      tunnel: ['#8E3AD8', '<rect x="3" y="4" width="18" height="16"/><rect x="8" y="8.5" width="8" height="7"/><path d="M3 4l5 4.5M21 4l-5 4.5M3 20l5-4.5M21 20l-5-4.5"/>'],
      synthwave: ['#E0507E', '<path class="f" d="M6.5 11a5.5 5.5 0 0 1 11 0z"/><path d="M2 13.5h20M3 17h18M1.5 21h21M12 13.5V21M8 13.5 5 21M16 13.5l3 7.5"/>'],
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
  const PAIRS = { frost: 'snow', fireworks: 'fireworks', stardust: 'stardust', fireflies: 'fireflies', bubbles: 'bubbles', leaves: 'leaves', hearts: 'hearts', ripples: 'rain', confetti: 'confetti', matrix: 'matrix', rainbow: 'rainbow' };
  for (const [f, e] of Object.entries(PAIRS)) if (ICONS.effect[e]) ICONS.follower[f] = ICONS.effect[e];
  window.COSMO_FX = { EFFECTS, FOLLOWERS, EFFECT_IDS, FOLLOWER_IDS, resolve, Layer, ICONS, AMOUNTS, EFFECT_AMOUNTS, PAIRS, opacityOf, PALETTES: { light: LIGHT, dark: DARK } };
})();
