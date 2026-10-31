'use strict';
// CosmoNotes effects, part 4 of 8 (src/fx/effects-magic.js):
// backgrounds from the Spell Lab: Healing aura … Fel fire.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const {
    EFFECTS, R, SPR, TAU, bucketDots, bucketFade, capped, clamp, cull, every, glow2, glowSprite, near, nudge, pick,
    soft, stamp, star4, strokeSegs, zig
  } = window.COSMO_FX_KIT;
  Object.assign(EFFECTS, {
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
  });
})();
