'use strict';
// CosmoNotes effects, part 6 of 8 (src/fx/followers-lab.js):
// mouse followers for the Effect Lab backgrounds: Plankton … Dust in light.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const {
    FOLLOWERS, R, TAU, bucketDots, bucketSegs, clamp, cull, dot, dotLattice, fishBend, fishDraw, fishNew, flow, hsla,
    petal, pick, presence, room, shard, spacer
  } = window.COSMO_FX_KIT;
  Object.assign(FOLLOWERS, {
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
          // 1.1.25: `near` is only set by step(), and the Layer draws once before the first step: treat it as 0 (it threw before)
          for (const q of d) { const a = Math.min(1, (q.near || 0) * .8 + q.b); if (a < .03) continue; (q.b > .45 ? hi : lo).push([q.x, q.y, 1.05 + q.b * .9, a]); }
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
  });
})();
