'use strict';
// CosmoNotes effects, part 2 of 8 (src/fx/effects-classic.js):
// backgrounds: the first eleven (1.1.16): Snow … Rainbow.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const {
    EFFECTS, R, RAINBOW_HUES, TAU, bucketDots, bucketSegs, clamp, codeCells, count, cull, dot, drawStream, every,
    flake, glowDot, glyph, heart, leaf, mirror, near, pick, shove, soft, stamp, star4
  } = window.COSMO_FX_KIT;
  // ---------------------------------------------------------------- effects (the background of a note)
  // make(w, h, P, dark, k) → { step(dt, t), draw(ctx, t) }
  Object.assign(EFFECTS, {
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
  });
})();
