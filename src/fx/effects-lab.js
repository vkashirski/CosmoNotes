'use strict';
// CosmoNotes effects, part 3 of 8 (src/fx/effects-lab.js):
// backgrounds from the Effect Lab (1.1.18): Plankton … Dust in light.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const {
    EFFECTS, R, TAU, bucketDots, capped, clamp, cull, dot, dotLattice, every, fishBend, fishDraw, fishNew, flockStep,
    flow, glow2, hsla, near, petal, pick, shard, shove, starfield, strokeSegs, wrap
  } = window.COSMO_FX_KIT;
  Object.assign(EFFECTS, {
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
  });
})();
