'use strict';
// CosmoNotes effects, part 8 of 8 (src/fx/engine.js):
// order, choosing rules, the shared loop, the Layer, paper tint, icons, window.COSMO_FX.
// Load order (note.html, list.html): kit, effects-classic, effects-lab, effects-magic,
//   followers-classic, followers-lab, followers-magic, engine.
// Shared names come from window.COSMO_FX_KIT (made by kit.js). Map: ai-context/effects.md.
(() => {
  const { ALONG, DARK, EFFECTS, FOLLOWERS, LIGHT, clamp } = window.COSMO_FX_KIT;
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
