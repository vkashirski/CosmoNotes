'use strict';
// CosmoNotes effects, part 5 of 8 (src/fx/followers-classic.js):
// mouse followers: shared rules (ALONG, room) + the first ones: Stardust … Autumn leaves.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const { FOLLOWERS, R, TAU, cull, dot, flake, glowDot, heart, leaf, pick, spacer, star4 } = window.COSMO_FX_KIT;

  // ---------------------------------------------------------------- mouse followers
  // make(w, h, P, dark, k) → { move(x, y, dist), step(dt, t), draw(ctx, t) }   (k = frequency: .35 rarely, 1 normal, 2.6 often)
  // the followers that spawn particles by distance moved (the Layer feeds them a fast jump in small steps, see move())
  const ALONG = new Set(['stardust', 'hearts', 'bubbles', 'ripples', 'frost', 'confetti', 'leaves', 'plankton', 'network', 'embers', 'blossom', 'nightsky', 'shards', 'dust', 'fireworks', 'warp', 'glitch', 'fel']);
  // add a particle; when the list is full the oldest goes, so a long fast stroke keeps making them (it used to stop)
  const room = (list, max) => { if (list.length >= max) list.shift(); };
  Object.assign(FOLLOWERS, {
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
  });
  Object.assign(window.COSMO_FX_KIT, { ALONG, room });
})();
