'use strict';
// CosmoNotes effects, part 7 of 8 (src/fx/followers-magic.js):
// mouse followers for the Spell Lab backgrounds, Pencil line and Matrix.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const {
    FOLLOWERS, R, TAU, bucketDots, clamp, cull, dot, glow2, glyph, mirror, presence, room, soft, spacer, stamp, star4
  } = window.COSMO_FX_KIT;
  Object.assign(FOLLOWERS, {
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
  });
})();
