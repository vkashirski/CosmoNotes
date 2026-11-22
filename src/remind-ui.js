'use strict';
/*
 * CosmoNotes - the reminders panel and the reminder sounds (1.4.1), the same in both windows (window.COSMO_REMIND_UI):
 * the note window opens it from Add → Reminder and the chip with the next one (src/note/remind.js), the notes list from
 * right-click → Reminders… and a card's clock (src/list/actions-locks.js). It shows the note's reminders and makes or
 * changes one; Set / Save (or the bin) saves through `save` (main/reminders.js setReminders checks it). 1.4.19: rebuilt to
 * the owner's design: one fixed-size panel; In / At and a time box; a calendar of its own. The rules and words are src/reminders.js
 * (window.COSMO_REMIND); its styles are below, in each window's own pop-up colours (--pop-* in a note, the theme's in the
 * list). The sounds are made here with Web Audio: soft and calm, from nature, a few seconds each, no files.
 */
(function (root) {
  const R = root.COSMO_REMIND;
  const doc = root.document;

  // ---------------------------------------------------------------- the sounds
  let ctx = null;
  let noise = null;
  function audio() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // one soft tone: frequency (or [from, to] for a glide), start, length, loudness, type
  function tone(c, out, f, t, len, gain, type = 'sine', attack = 0.01) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + Math.min(len, f[2] || len)); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  }
  // filtered noise that swells in and out (rain, a stream, waves, wind)
  function hiss(c, out, t, len, gain, type, freq, q = 1, swell = 0.4, sweep = null) {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) for (const [at, v] of sweep) f.frequency.linearRampToValueAtTime(v, t + at);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + len * swell);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + len + 0.05);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const MAKE = {
    drops: (c, o, t) => { [0, 0.42, 0.7, 1.25, 1.6].forEach((d, i) => tone(c, o, [1400 - i * 90, 520, 0.09], t + d, 0.35, 0.5)); },
    chime: (c, o, t) => {
      [0, 0.35, 0.8, 1.15, 1.7].forEach((d) => { const f = pick(PENTA) * 2; tone(c, o, f, t + d, 2.4, 0.22, 'sine', 0.005); tone(c, o, f * 2.76, t + d, 0.9, 0.05, 'sine', 0.005); });
    },
    birds: (c, o, t) => {
      const chirp = (d, a, b) => tone(c, o, [a, b, 0.07], t + d, 0.11, 0.18, 'sine', 0.01);
      [0, 0.14, 0.28].forEach((d) => chirp(d, 2600, 4200));
      [0.9, 1.0].forEach((d) => chirp(d, 3800, 2400));
      [1.7, 1.82, 1.94, 2.06].forEach((d) => chirp(d, 3000, 4600));
    },
    stream: (c, o, t) => {
      hiss(c, o, t, 3.6, 0.35, 'bandpass', 900, 0.8, 0.35, [[1.2, 1400], [2.4, 800], [3.6, 1200]]);
      [0.5, 1.3, 2.1, 2.7].forEach((d) => tone(c, o, [1100 + Math.random() * 500, 600, 0.06], t + d, 0.2, 0.18));
    },
    rain: (c, o, t) => {
      hiss(c, o, t, 3.6, 0.28, 'highpass', 1800, 0.5, 0.3);
      for (let i = 0; i < 14; i++) tone(c, o, [2400 + Math.random() * 1600, 1200, 0.02], t + 0.2 + Math.random() * 3, 0.05, 0.08);
    },
    waves: (c, o, t) => { hiss(c, o, t, 4.2, 0.5, 'lowpass', 500, 0.7, 0.45, [[1.8, 1100], [4.2, 350]]); },
    bowl: (c, o, t) => {
      tone(c, o, 220, t, 4.5, 0.32, 'sine', 0.08);
      tone(c, o, 221.6, t, 4.5, 0.2, 'sine', 0.08); // a slow beat, like a real bowl
      tone(c, o, 594, t, 2.6, 0.08, 'sine', 0.05);
    },
    bamboo: (c, o, t) => {
      [[0, 620], [0.22, 760], [0.55, 540], [0.9, 700]].forEach(([d, f]) => { tone(c, o, [f * 1.2, f, 0.02], t + d, 0.28, 0.42, 'triangle', 0.003); hiss(c, o, t + d, 0.04, 0.12, 'bandpass', 2500, 2, 0.1); });
    },
    crickets: (c, o, t) => {
      for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) tone(c, o, 4300, t + k * 0.85 + i * 0.045, 0.03, 0.06, 'sine', 0.004);
    },
    breeze: (c, o, t) => {
      hiss(c, o, t, 4, 0.4, 'bandpass', 400, 1.4, 0.5, [[2, 900], [4, 500]]);
      tone(c, o, PENTA[4] * 2, t + 2.4, 1.8, 0.08, 'sine', 0.005);
    },
  };
  // play a sound (an id of R.SOUNDS) at a loudness 0 – 1; 'none' or nothing plays nothing
  function play(id, volume = 0.6) {
    if (!id || id === 'none' || !MAKE[id] || !(volume > 0)) return;
    const c = audio();
    if (!c) return;
    const out = c.createGain();
    out.gain.value = Math.min(1, volume) * 0.9;
    const comp = c.createDynamicsCompressor();
    out.connect(comp).connect(c.destination);
    MAKE[id](c, out, c.currentTime + 0.05);
  }
  // the sound a reminder plays: its own, else the one in Settings
  const soundOf = (r, settings) => (r && r.sound ? r.sound : (settings && settings.remindSound) || R.DEFAULT_SOUND);

  // ---------------------------------------------------------------- styles (both windows)
  // 1.4.19 (the owner's design, like Windows Clock's "Edit alarm"): one panel of a fixed size, so nothing moves while you
  // set a reminder. In / At, a big time box, a message, Repeat (the week days) or the day, a sound, hiding. The day is a
  // calendar of its own (days → months → years) in the same box. Every view has the same rows in the same places.
  const CSS = `
.rmd { --rm-bg: var(--pop-bg, var(--card2)); --rm-ink: var(--pop-ink, var(--ink)); --rm-ink2: var(--pop-ink2, var(--ink2)); --rm-soft: var(--pop-soft, var(--soft));
  --rm-soft2: var(--pop-soft2, var(--soft2)); --rm-mute: var(--pop-mute, var(--mute)); --rm-card: var(--pop-card, var(--card)); --rm-pick: var(--pop-pick, var(--ink));
  --rm-pickfg: var(--pop-pickfg, var(--pillfg)); --rm-danger: var(--pop-danger, var(--danger)); --rm-hover: color-mix(in oklab, var(--rm-ink) 6%, transparent);
  --rm-ease: cubic-bezier(0.23, 1, 0.32, 1);
  height: 100%; overflow-y: auto; display: flex; flex-direction: column; padding: 12px 12px 10px;
  color: var(--rm-ink); font: 700 13.5px var(--ui); text-align: left; }
.rmd::-webkit-scrollbar { width: 6px; } .rmd::-webkit-scrollbar-thumb { background: var(--rm-soft2); border-radius: 6px; }
.rmd [hidden] { display: none !important; }
.rmd svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rmd button { font-family: var(--ui); }
.rmd .rm-view { flex: 1 0 auto; display: flex; flex-direction: column; }
.rmd .rm-view.anim { animation: rmfade 140ms ease-out; }
@keyframes rmfade { from { opacity: 0; } }
.rmd .rm-hd { flex: none; display: flex; align-items: center; gap: 4px; height: 26px; margin: 0 0 8px; }
.rmd .rm-hd b { flex: 1 1 auto; min-width: 0; font-size: 17px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmd .rm-hd b small { margin-left: 6px; font-size: 13px; font-weight: 700; color: var(--rm-mute); }
.rmd .rm-ib { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--rm-ink2); cursor: pointer;
  transition: background-color 110ms ease, transform 140ms var(--rm-ease); }
.rmd .rm-ib:hover { background: var(--rm-soft); }
.rmd .rm-ib:active { transform: scale(.94); }
.rmd .rm-ib.bin { color: var(--rm-danger); }
.rmd .rm-ib svg { width: 15px; height: 15px; }
/* in / at */
.rmd .rm-mode { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; margin-bottom: 4px; border-radius: 10px; background: var(--rm-soft); }
.rmd .rm-mode button { height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--rm-ink2); font-weight: 800; font-size: 13px; cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
.rmd .rm-mode button.on { background: var(--rm-card); color: var(--rm-ink); box-shadow: 0 1px 2px rgba(60,40,10,.15); }
/* the time box */
.rmd .rm-arrows, .rmd .rm-time { flex: none; display: flex; justify-content: center; align-items: center; }
.rmd .rm-arrows button { width: 64px; height: 20px; border: 0; border-radius: 7px; background: transparent; color: var(--rm-mute); display: grid; place-items: center; cursor: pointer;
  transition: background-color 110ms ease, color 110ms ease, transform 140ms var(--rm-ease); }
.rmd .rm-arrows button:hover { background: var(--rm-soft); color: var(--rm-ink); }
.rmd .rm-arrows button:active { transform: scale(.94); }
.rmd .rm-arrows button svg { width: 16px; height: 16px; stroke-width: 2.6; }
.rmd .rm-arrows i { width: 14px; }
.rmd .rm-frame { display: flex; align-items: center; padding: 4px; border-radius: 12px; background: var(--rm-soft); box-shadow: inset 0 0 0 1px var(--rm-soft2); }
.rmd .rm-frame input { width: 64px; height: 58px; padding: 0; border: 0; border-radius: 9px; background: transparent; color: var(--rm-ink); font: 800 34px var(--ui); text-align: center;
  font-variant-numeric: tabular-nums; outline: none; transition: background-color 120ms ease; }
.rmd .rm-frame input:hover { background: color-mix(in oklab, var(--rm-card) 60%, transparent); }
.rmd .rm-frame input:focus { background: var(--rm-card); box-shadow: 0 1px 3px rgba(60,40,10,.18); }
.rmd .rm-frame input::selection { background: color-mix(in oklab, var(--rm-pick) 22%, transparent); color: var(--rm-ink); }
.rmd .rm-frame .c { width: 14px; text-align: center; font: 800 26px var(--ui); color: var(--rm-mute); }
.rmd .rm-when { flex: none; height: 20px; margin: 2px 0 6px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: var(--rm-ink2); font-variant-numeric: tabular-nums; }
.rmd .rm-when b { color: var(--rm-ink); font-weight: 800; }
.rmd .rm-when.bad { color: var(--rm-danger); }
.rmd .rm-when.wait { color: var(--rm-mute); }
.rmd .rm-back { flex: 1 1 auto; display: flex; align-items: center; gap: 4px; height: 26px; margin-left: -4px; padding: 0 8px 0 2px; border: 0; border-radius: 8px; background: transparent;
  color: var(--rm-ink); font-size: 17px; font-weight: 800; cursor: pointer; text-align: left; transition: background-color 110ms ease; }
.rmd .rm-back:hover { background: var(--rm-soft); }
.rmd .rm-back svg { width: 18px; height: 18px; stroke-width: 2.4; }
.rmd .rm-back small { margin-left: 6px; font-size: 13px; font-weight: 700; color: var(--rm-mute); }
/* rows with an icon */
.rmd .rm-row { flex: none; display: flex; align-items: center; gap: 10px; min-height: 40px; }
.rmd .rm-row + .rm-row, .rmd .rm-chk + .rm-row, .rmd .rm-row + .rm-chk, .rmd .rm-chk + .rm-chk { margin-top: 6px; }
.rmd .rm-row > svg { flex: none; width: 18px; height: 18px; color: var(--rm-ink2); }
.rmd .rm-row textarea, .rmd .rm-row select, .rmd .rm-field { flex: 1 1 auto; min-width: 0; height: 36px; border: 1.5px solid var(--rm-soft2); border-radius: 10px; background: var(--rm-card);
  color: var(--rm-ink); font: 700 13.5px var(--ui); outline: none; }
.rmd .rm-row textarea { padding: 8px 11px; resize: none; line-height: 1.3; overflow: hidden; white-space: nowrap; }
.rmd .rm-row textarea:focus, .rmd .rm-row select:focus { border-color: var(--rm-ink2); }
.rmd .rm-row textarea::placeholder { color: var(--rm-mute); font-weight: 600; }
.rmd .rm-row select { padding: 0 8px; }
.rmd .rm-field { display: flex; align-items: center; gap: 8px; padding: 0 11px; cursor: pointer; text-align: left; transition: border-color 110ms ease; }
.rmd .rm-field:hover { border-color: var(--rm-ink2); }
.rmd .rm-field span { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmd .rm-field svg { flex: none; width: 15px; height: 15px; color: var(--rm-mute); }
.rmd .rm-other { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; color: var(--rm-ink2); }
.rmd .rm-other span { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmd .rm-link { flex: none; height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: var(--rm-soft); color: var(--rm-ink); font-weight: 800; font-size: 12.5px; cursor: pointer; }
.rmd .rm-link:hover { background: var(--rm-soft2); }
.rmd .rm-off { opacity: .38; pointer-events: none; }
/* tick boxes */
.rmd .rm-chk { flex: none; display: flex; align-items: center; gap: 10px; min-height: 36px; cursor: pointer; user-select: none; }
.rmd .rm-chk .box { flex: none; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--rm-soft2); background: var(--rm-card); display: grid; place-items: center;
  transition: background-color 120ms ease, border-color 120ms ease; }
.rmd .rm-chk .box svg { width: 12px; height: 12px; stroke: var(--rm-pickfg); stroke-width: 3.2; opacity: 0; transform: scale(.6); transition: opacity 120ms ease, transform 160ms var(--rm-ease); }
.rmd .rm-chk.on .box { background: var(--rm-pick); border-color: var(--rm-pick); }
.rmd .rm-chk.on .box svg { opacity: 1; transform: none; }
.rmd .rm-chk .t { min-width: 0; }
.rmd .rm-chk .t b { display: block; font-weight: 700; font-size: 13.5px; }
.rmd .rm-chk .t small { display: block; color: var(--rm-mute); font-weight: 600; font-size: 12px; }
.rmd .rm-days { flex: 1 1 auto; display: flex; justify-content: space-between; gap: 3px; }
.rmd .rm-days button { width: 32px; height: 32px; padding: 0; border-radius: 50%; border: 0; background: var(--rm-soft); color: var(--rm-ink2); font-weight: 800; font-size: 12px; cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, transform 140ms var(--rm-ease); }
.rmd .rm-days button:hover { background: var(--rm-soft2); }
.rmd .rm-days button:active { transform: scale(.93); }
.rmd .rm-days button.on { background: var(--rm-pick); color: var(--rm-pickfg); }
/* the buttons at the bottom */
.rmd .rm-btns { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; padding-top: 8px; }
.rmd .rm-btns button { height: 38px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer;
  transition: transform 140ms var(--rm-ease), background-color 110ms ease, opacity 120ms ease; }
.rmd .rm-btns button:active { transform: scale(.97); }
.rmd .rm-btns button svg { width: 16px; height: 16px; }
.rmd .rm-save { background: var(--rm-pick); color: var(--rm-pickfg); }
.rmd .rm-save:disabled { opacity: .4; pointer-events: none; }
.rmd .rm-cancel { background: var(--rm-soft); color: var(--rm-ink); }
.rmd .rm-cancel:hover { background: var(--rm-soft2); }
/* the note's reminders */
.rmd .rm-item { flex: none; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 8px; border: 0; border-radius: 11px; background: transparent;
  color: var(--rm-ink); font: inherit; text-align: left; cursor: pointer; transition: background-color 110ms ease; }
.rmd .rm-item:hover { background: var(--rm-hover); }
.rmd .rm-item > svg { flex: none; width: 18px; height: 18px; color: var(--rm-ink2); }
.rmd .rm-item.ring > svg, .rmd .rm-item.ring b { color: var(--rm-danger); }
.rmd .rm-item .rm-txt { flex: 1 1 auto; min-width: 0; }
.rmd .rm-item b { display: block; font-weight: 800; font-size: 14px; font-variant-numeric: tabular-nums; }
.rmd .rm-item small { display: block; color: var(--rm-mute); font-weight: 600; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmd .rm-item .go { width: 15px; height: 15px; color: var(--rm-mute); }
.rmd .rm-new { flex: none; display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; height: 38px; margin-top: 8px; border: 1.5px dashed var(--rm-soft2); border-radius: 10px;
  background: transparent; color: var(--rm-ink2); font-weight: 800; font-size: 13.5px; cursor: pointer; }
.rmd .rm-new:hover { background: var(--rm-soft); }
.rmd .rm-new:disabled { opacity: .45; pointer-events: none; }
.rmd .rm-new svg { width: 16px; height: 16px; }
/* the calendar: days → months → years */
.rmd .rm-dphd { flex: none; display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.rmd .rm-dphd .rm-ib { width: 32px; height: 32px; }
.rmd .rm-ttl { flex: 1 1 auto; height: 32px; border: 0; border-radius: 9px; background: transparent; color: var(--rm-ink); font-weight: 800; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 4px; }
.rmd .rm-ttl:hover { background: var(--rm-soft); }
.rmd .rm-ttl:disabled { cursor: default; background: transparent; color: var(--rm-ink); }
.rmd .rm-ttl svg { width: 13px; height: 13px; color: var(--rm-mute); stroke-width: 2.6; }
.rmd .rm-grid { flex: none; display: grid; gap: 2px; height: 276px; }
.rmd .rm-grid.anim { animation: rmzoom 160ms var(--rm-ease); }
@keyframes rmzoom { from { opacity: 0; transform: scale(.96); } }
.rmd .rm-grid.d { grid-template-columns: repeat(7, 1fr); grid-template-rows: 22px repeat(6, 1fr); }
.rmd .rm-grid.m, .rmd .rm-grid.y { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(4, 1fr); gap: 6px; }
.rmd .rm-grid i { font: 800 10.5px var(--ui); font-style: normal; color: var(--rm-mute); text-align: center; padding-top: 3px; text-transform: uppercase; }
.rmd .rm-grid button { border: 0; border-radius: 9px; background: transparent; color: var(--rm-ink); font-weight: 700; font-size: 13.5px; cursor: pointer; font-variant-numeric: tabular-nums;
  transition: background-color 110ms ease, transform 140ms var(--rm-ease); }
.rmd .rm-grid button:hover { background: var(--rm-soft); }
.rmd .rm-grid button:active { transform: scale(.94); }
.rmd .rm-grid button.other { color: var(--rm-mute); opacity: .5; }
.rmd .rm-grid button.past { color: var(--rm-mute); opacity: .3; pointer-events: none; }
.rmd .rm-grid button.now { box-shadow: inset 0 0 0 1.5px var(--rm-soft2); }
.rmd .rm-grid button.sel { background: var(--rm-pick); color: var(--rm-pickfg); opacity: 1; }
.rmd .rm-dpfoot { flex: none; display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 10px; }
.rmd .rm-dpfoot .rm-chk { flex: 1 1 auto; }
.rmd .rm-dpfoot .rm-link { background: transparent; color: var(--rm-ink2); }
.rmd .rm-dpfoot .rm-link:hover { background: var(--rm-soft); }
.rmd .rm-dpfoot .rm-done { height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--rm-pick); color: var(--rm-pickfg); font-weight: 800; font-size: 13px; cursor: pointer; visibility: hidden; }
.rmd .rm-dpfoot .rm-done.show { visibility: visible; }
@media (prefers-reduced-motion: reduce) { .rmd .rm-view.anim, .rmd .rm-grid.anim { animation: none; } }
`;
  let styled = false;
  function addStyles() {
    if (styled || !doc || !doc.head) return;
    styled = true;
    const s = doc.createElement('style');
    s.textContent = CSS;
    doc.head.append(s);
  }

  // ---------------------------------------------------------------- the panel
  const ICON = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2 6M19 3l3 3"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    rep: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  };
  function el(tag, attrs = {}, ...kids) {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k in e && typeof v !== 'string') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : doc.createTextNode(String(k)));
    return e;
  }
  const ico = (name, cls) => { const t = doc.createElement('template'); t.innerHTML = ICON[name]; const s = t.content.firstElementChild; if (cls) s.setAttribute('class', cls); return s; };
  const pad = (x) => String(x).padStart(2, '0');
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // days as numbers (local calendar days), so a picked day stays that day
  const dayNo = (t) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; };
  const ymd = (n) => { const d = new Date(n * 864e5); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
  const atDay = (n, h, m, s) => { const [y, mo, d] = ymd(n); return new Date(y, mo, d, h, m, s).getTime(); };
  const weekDayOf = (n) => new Date(n * 864e5).getUTCDay();
  // a repeat as week days (the panel's Repeat), or null when it is something else (every month, every 2 weeks, an end)
  function weekDays(rep) {
    if (!rep || rep.until || rep.times) return null;
    if (rep.k === 'day') return [0, 1, 2, 3, 4, 5, 6];
    if (rep.k === 'weekdays') return [1, 2, 3, 4, 5];
    if (rep.k === 'week') return [...rep.days];
    return null;
  }
  // how long until: "2 h 15 min", "under a minute", "3 days"
  function span(ms, secs) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const x = s % 60;
    if (h >= 48) return `${Math.round(h / 24)} days`;
    const out = [h && `${h} h`, m && `${m} min`, secs && !h && x && `${x} s`].filter(Boolean).join(' ');
    return out || (secs ? `${x} s` : 'under a minute');
  }
  const clockOf = (t, secs) => R.clock(t) + (secs ? `:${pad(new Date(t).getSeconds())}` : '');
  // a day as a date: "Fri 20 Nov" (the year too when it isn't this one)
  function dateWord(n) {
    const [y, mo, d] = ymd(n);
    return `${R.DAY_NAMES[weekDayOf(n)]} ${d} ${R.MONTHS[mo]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
  }
  // how many days away: "Today", "Tomorrow", "in 26 days", "in 1y 30d"
  function howFar(g) {
    if (g <= 0) return 'Today';
    if (g === 1) return 'Tomorrow';
    if (g < 365) return `in ${g} days`;
    const y = Math.floor(g / 365); const d = g % 365;
    return `in ${y}y${d ? ` ${d}d` : ''}`;
  }
  const sameDays = (a, b) => a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);

  // the time box remembers what was used last (both windows; a note's words never go in it)
  const LAST = 'remindLast';
  const int = (v, hi, def) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : def);
  function loadLast() {
    let v = null;
    try { v = JSON.parse(root.localStorage.getItem(LAST) || 'null'); } catch { /* fine */ }
    v = v && typeof v === 'object' ? v : {};
    return {
      mode: v.mode === 'in' ? 'in' : 'at', inH: int(v.inH, 99, 0), inM: int(v.inM, 59, 10), inS: int(v.inS, 59, 0),
      atH: int(v.atH, 23, 9), atM: int(v.atM, 59, 0), atS: int(v.atS, 59, 0),
      sound: v.sound === 'none' || R.SOUND_IDS.includes(v.sound) ? v.sound : '',
      days: Array.isArray(v.days) ? v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
    };
  }
  function saveLast(F) {
    const keep = { mode: F.mode, inH: F.inH, inM: F.inM, inS: F.inS, atH: F.atH, atM: F.atM, atS: F.atS, sound: F.sound, days: F.repeat ? F.days : loadLast().days };
    try { root.localStorage.setItem(LAST, JSON.stringify(keep)); } catch { /* fine */ }
  }

  // the panel's height, measured (note-ui.test.js checks that the form fits it exactly): the form without the optional rows,
  // and one tick-box row with its hint (Hide the note until then; Unlock to dismiss)
  const H_BASE = 448;
  const H_ROW = 42;

  // opts: { reminders, msgs, locked, name (the list's: whose reminders), start: 'new' | 'mine',
  //         settings: { remindSound, remindVolume, remindSeconds }, save(list, msgs) → Promise of { reminders, msgs } or null,
  //         close() (the panel goes), done(text) (a short word after a save) }
  function editor(opts) {
    addStyles();
    let list = (opts.reminders || []).map((r) => ({ ...r }));
    let msgs = { ...(opts.msgs || {}) };
    const settings = opts.settings || {};
    const secs = () => !!settings.remindSeconds;
    const autoNext = () => settings.remindAutoNext !== false; // 1.4.20: Settings → Jump to the next box (on)
    // 1.4.20: "Hide the note until then" shows when Settings → Let reminders hide notes is on (off), or when one of the note's
    // reminders already hides it (so it can be turned off). Decided once: the panel keeps its size while open
    const showHide = !!settings.remindHide || list.some((r) => r.hide);
    const box = el('div', { class: 'rmd' });
    let view = 'list'; // list | form | date
    let F = null; // the reminder being made or changed
    const DP = { level: 'd', y: 0, m: 0, zoom: false }; // the calendar
    let busy = false;
    const close = () => { if (opts.close) opts.close(); };

    async function commit(nextList, nextMsgs) {
      if (busy) return false;
      busy = true;
      try {
        const r = await opts.save(nextList, nextMsgs);
        if (!r) return false;
        list = (r.reminders || []).map((x) => ({ ...x }));
        msgs = { ...(r.msgs || {}) };
        return true;
      } finally { busy = false; }
    }
    let fresh = false;
    function show(v, anim = true) {
      view = v;
      fresh = anim;
      const keep = box.scrollTop;
      const page = el('div', { class: 'rm-view' + (anim ? ' anim' : '') });
      box.replaceChildren(page);
      ({ list: paintList, form: paintForm, date: paintDate })[v](page);
      box.scrollTop = anim ? 0 : keep;
    }
    const head = (title, btns = [], onX = close) => el('div', { class: 'rm-hd' },
      el('b', {}, title, opts.name ? el('small', {}, opts.name) : null), ...btns,
      el('button', { type: 'button', class: 'rm-ib rm-close', title: onX === close ? 'Close (Esc)' : 'Back', html: ICON.x, onclick: () => onX() }));

    // ---- the note's reminders
    function paintList(page) {
      const now = Date.now();
      page.append(head('Reminders'));
      for (const r of [...list].sort((a, b) => R.dueAt(a) - R.dueAt(b))) {
        const sub = [R.repeatText(r.repeat, r.start), msgs[r.id] ? `“${msgs[r.id].split('\n')[0]}”` : '', r.hide ? 'Hidden until then' : ''].filter(Boolean).join(' · ');
        page.append(el('button', { type: 'button', class: 'rm-item' + (r.firing ? ' ring' : ''), 'data-id': r.id, onclick: () => openForm(r, true) },
          ico(r.repeat ? 'rep' : 'bell'), el('span', { class: 'rm-txt' }, el('b', {}, R.status(r, now)), sub ? el('small', {}, sub) : null), ico('fwd', 'go')));
      }
      page.append(el('button', { type: 'button', class: 'rm-new', disabled: list.length >= R.MAX, html: `${ICON.plus}New reminder`, onclick: () => openForm(null, true) }));
    }

    // ---- making one, or changing one
    function openForm(r, fromList) {
      const last = loadLast();
      const now = Date.now();
      if (!r) {
        F = { id: null, fromList, ...last, dates: [], multi: false, msg: '', repeat: false, days: last.days.length ? last.days : [new Date(now).getDay()], other: null, orig: null,
          hide: false, unlock: false, start: null };
      } else {
        const t = r.firing || !r.at ? r.start : r.repeat ? r.start : r.at;
        const d = new Date(t);
        const wd = weekDays(r.repeat);
        F = { id: r.id, fromList, ...last, mode: 'at', atH: d.getHours(), atM: d.getMinutes(), atS: d.getSeconds(),
          dates: !r.repeat && t > now ? [dayNo(t)] : [], multi: false, msg: msgs[r.id] || '',
          repeat: !!r.repeat, days: wd || [d.getDay()], other: r.repeat && !wd ? r.repeat : null, orig: r.repeat || null,
          sound: r.sound || '', hide: !!r.hide, unlock: !!r.unlock, start: r.start, next: r.at, t0: [d.getHours(), d.getMinutes(), d.getSeconds()], days0: wd };
      }
      show('form');
    }
    // the times it would go off (several days: one each); [] = it can't. F.keep: a repeat that is as it was (same time,
    // same days) keeps its start, so main keeps how often it went off; it shows its next time
    function plan() {
      const now = Date.now();
      const s = secs() ? 1 : 0;
      F.keep = false;
      if (F.mode === 'in') return [now + ((F.inH * 60 + F.inM) * 60 + F.inS * s) * 1000];
      const H = F.atH; const M = F.atM; const S = F.atS * s;
      if (F.repeat) {
        const rep = repeatNow();
        // the time is as it was and so is the repeat: it stays as it is (main keeps how often it went off)
        if (F.id && F.start && F.t0 && F.t0[0] === H && F.t0[1] === M && F.t0[2] === F.atS && rep === F.orig) { F.keep = true; return F.next ? [F.next] : []; }
        // a repeat starts at its first time from now (every month / every 2 weeks keep their own day)
        const from = F.other && F.start ? atDay(dayNo(F.start), H, M, S) : atDay(dayNo(now), H, M, S);
        const t = R.nextFrom({ start: from, repeat: R.cleanRepeat(rep), count: 0 }, now + 1000, 0);
        return t ? [t] : [];
      }
      if (!F.dates.length) { // today, or tomorrow when that time has passed
        const t = atDay(dayNo(now), H, M, S);
        return [t > now + 1000 ? t : atDay(dayNo(now) + 1, H, M, S)];
      }
      return F.dates.map((n) => atDay(n, H, M, S)).sort((a, b) => a - b);
    }
    // the repeat to save: what it had (unchanged), or the week days
    function repeatNow() {
      if (F.other) return F.other;
      if (F.orig && F.days0 && sameDays(F.days, F.days0)) return F.orig;
      return { k: 'week', days: [...F.days].sort() };
    }
    function paintForm(page) {
      const editing = !!F.id;
      page.append(head(editing ? 'Edit reminder' : 'New reminder',
        editing ? [el('button', { type: 'button', class: 'rm-ib bin', title: 'Delete', html: ICON.del, onclick: remove })] : []));
      const mode = el('div', { class: 'rm-mode' },
        el('button', { type: 'button', class: F.mode === 'in' ? 'on' : '', 'data-mode': 'in', onclick: () => { if (F.mode !== 'in') { F.mode = 'in'; show('form', false); } } }, 'In…'),
        el('button', { type: 'button', class: F.mode === 'at' ? 'on' : '', 'data-mode': 'at', onclick: () => { if (F.mode !== 'at') { F.mode = 'at'; show('form', false); } } }, 'At…'));
      page.append(mode);
      // the time box: hours and minutes (seconds too when Settings says so)
      const keys = (F.mode === 'in' ? ['inH', 'inM', 'inS'] : ['atH', 'atM', 'atS']).slice(0, secs() ? 3 : 2);
      const max = [F.mode === 'in' ? 99 : 23, 59, 59];
      const names = ['Hours', 'Minutes', 'Seconds'];
      const ups = el('div', { class: 'rm-arrows' }); const downs = el('div', { class: 'rm-arrows' });
      const frame = el('div', { class: 'rm-frame' });
      const when = el('div', { class: 'rm-when' });
      const inputs = [];
      keys.forEach((k, i) => {
        if (i) { ups.append(el('i')); downs.append(el('i')); frame.append(el('span', { class: 'c' }, ':')); }
        const inp = el('input', { type: 'text', inputmode: 'numeric', maxlength: '2', value: pad(F[k]), 'aria-label': names[i], 'data-k': k });
        const step = (d) => { F[k] = (F[k] + d + max[i] + 1) % (max[i] + 1); inp.value = pad(F[k]); paintWhen(); };
        ups.append(el('button', { type: 'button', tabindex: '-1', title: `${names[i]} up`, html: ICON.up, onclick: () => step(1) }));
        downs.append(el('button', { type: 'button', tabindex: '-1', title: `${names[i]} down`, html: ICON.down, onclick: () => step(-1) }));
        inp.addEventListener('wheel', (e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
        // 1.4.20: a click anywhere on the number (between its digits too) picks all of it, so what you type replaces it
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('mouseup', (e) => { e.preventDefault(); inp.select(); });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          // a digit into a full box with nothing picked starts the number again (it never just stops)
          if (/^\d$/.test(e.key) && !e.ctrlKey && !e.altKey && inp.value.length >= 2 && inp.selectionStart === inp.selectionEnd) {
            e.preventDefault();
            inp.value = e.key;
            F[k] = Math.min(max[i], Number(e.key));
            paintWhen();
          }
        });
        inp.addEventListener('input', () => {
          F[k] = Math.min(max[i], parseInt(inp.value.replace(/\D/g, ''), 10) || 0);
          paintWhen();
          // on to the next box: after two digits, or after one that can't start a two-digit number (7 for the hours: 07)
          const full = inp.value.length === 2 || (inp.value.length === 1 && Number(inp.value) * 10 > max[i]);
          if (autoNext() && full && inputs[i + 1]) { inp.value = pad(F[k]); inputs[i + 1].focus(); }
        });
        inp.addEventListener('blur', () => { if (F) inp.value = pad(F[k]); }); // (after Set the panel is gone and so is F)
        inputs.push(inp);
        frame.append(inp);
      });
      page.append(ups, el('div', { class: 'rm-time' }, frame), downs, when);
      // the message (optional)
      const msg = el('textarea', { rows: '1', maxlength: String(R.MSG_MAX), placeholder: 'Message (optional)', 'aria-label': 'Message' });
      msg.value = F.msg;
      msg.addEventListener('input', () => { F.msg = msg.value; });
      msg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
      page.append(el('div', { class: 'rm-row' }, ico('pen'), msg));
      // Repeat, then one row: the week days, or the day (In fades both; nothing moves)
      const atOnly = F.mode === 'in' ? ' rm-off' : '';
      page.append(check('Repeat', null, F.repeat, (on) => {
        F.repeat = on;
        if (!on) F.other = null;
        show('form', false);
      }, 'rm-repeat' + atOnly));
      if (F.repeat && F.other) {
        page.append(el('div', { class: 'rm-row' + atOnly }, ico('rep'),
          el('div', { class: 'rm-other' }, el('span', {}, R.repeatText(F.other, F.start)),
            el('button', { type: 'button', class: 'rm-link', onclick: () => { F.other = null; show('form', false); } }, 'Week days'))));
      } else if (F.repeat) {
        const days = el('div', { class: 'rm-days' });
        for (const d of DAY_ORDER) {
          days.append(el('button', { type: 'button', class: F.days.includes(d) ? 'on' : '', title: R.DAY_NAMES[d], 'data-d': String(d), onclick: () => {
            const s = new Set(F.days);
            if (s.has(d)) { if (s.size > 1) s.delete(d); } else s.add(d);
            F.days = [...s];
            show('form', false);
          } }, R.DAY_NAMES[d].slice(0, 2)));
        }
        page.append(el('div', { class: 'rm-row' + atOnly }, ico('rep'), days));
      } else {
        const day = el('button', { type: 'button', class: 'rm-field rm-day', onclick: () => {
          const [y, m] = ymd(F.dates[0] ?? dayNo(Date.now()));
          Object.assign(DP, { level: 'd', y, m, zoom: false });
          show('date');
        } }, el('span', {}), ico('down'));
        page.append(el('div', { class: 'rm-row' + atOnly }, ico('cal'), day));
      }
      // the sound
      const defName = (R.SOUNDS.find((x) => x.id === (settings.remindSound || R.DEFAULT_SOUND)) || { name: 'No sound' }).name;
      const sound = el('select', { 'aria-label': 'Sound' }, el('option', { value: '' }, `${settings.remindSound === 'none' ? 'No sound' : defName} (from Settings)`),
        ...R.SOUNDS.map((x) => el('option', { value: x.id, selected: F.sound === x.id }, x.name)), el('option', { value: 'none', selected: F.sound === 'none' }, 'No sound'));
      sound.addEventListener('change', () => { F.sound = sound.value; });
      page.append(el('div', { class: 'rm-row' }, ico('music'), sound,
        el('button', { type: 'button', class: 'rm-ib', title: 'Play', html: ICON.play, onclick: () => play(sound.value || settings.remindSound || R.DEFAULT_SOUND, settings.remindVolume ?? 0.6) })));
      // hiding, and (a locked note) the PIN to dismiss
      if (showHide) page.append(check('Hide the note until then', 'The list’s clock button shows it.', F.hide, (on) => { F.hide = on; }, 'rm-hide'));
      if (opts.locked) page.append(check('Unlock to dismiss', 'Snooze and Done need your PIN.', F.unlock, (on) => { F.unlock = on; }, 'rm-unlock'));
      // Set / Save, Cancel
      const save = el('button', { type: 'button', class: 'rm-save', html: editing ? `${ICON.save}Save` : `${ICON.bell}Set reminder`, onclick: submit });
      page.append(el('div', { class: 'rm-btns' }, save,
        el('button', { type: 'button', class: 'rm-cancel', html: `${ICON.x}Cancel`, onclick: () => (F.fromList && list.length ? show('list') : close()) })));
      paintWhen();
      if (fresh) setTimeout(() => { if (inputs[0] && inputs[0].isConnected && !box.contains(doc.activeElement)) inputs[0].focus({ preventScroll: true }); }, 30);

      function paintWhen() {
        const now = Date.now();
        const ts = plan();
        const bad = !ts.length || ts.some((t) => t <= now);
        const sec = secs() && (F.mode === 'in' ? F.inS : F.atS) > 0;
        const zero = bad && F.mode === 'in'; // nothing set yet: a hint, not an error
        when.classList.toggle('bad', bad && !zero);
        when.classList.toggle('wait', zero);
        save.disabled = bad;
        if (bad) when.textContent = zero ? 'Choose how long.' : F.repeat ? 'This repeat has ended.' : 'That time has passed.';
        else if (ts.length > 1) when.innerHTML = `First one <b>${R.dayWord(ts[0], now)} ${clockOf(ts[0], sec)}</b> · ${ts.length} days`;
        else when.innerHTML = `<b>${R.dayWord(ts[0], now)} ${clockOf(ts[0], sec)}</b> · in ${span(ts[0] - now, secs())}`;
        const day = page.querySelector('.rm-day span');
        if (day) {
          const ds = [...F.dates].sort((a, b) => a - b);
          // 1.4.20: the date, and how far it is: "Fri 20 Nov (Today)", "Tue 15 Dec (in 26 days)", "Sat 20 Nov 2027 (in 1y 1d)"
          const one = (n) => `${dateWord(n)} (${howFar(n - dayNo(now))})`;
          day.textContent = F.mode === 'in' || !ds.length ? one(dayNo(ts[0] || now))
            : ds.length === 1 ? one(ds[0])
              : `${ds.length} days: ${ds.map((n) => { const [, mo, d] = ymd(n); return `${d} ${R.MONTHS[mo]}`; }).join(', ')}`;
        }
      }
    }
    function check(label, hint, on, set, cls) {
      const c = el('label', { class: `rm-chk ${cls || ''}${on ? ' on' : ''}`, role: 'checkbox', 'aria-checked': on ? 'true' : 'false', tabindex: '0' },
        el('span', { class: 'box', html: ICON.tick }), el('span', { class: 't' }, el('b', {}, label), hint ? el('small', {}, hint) : null));
      const flip = (e) => { e.preventDefault(); const v = !c.classList.contains('on'); c.classList.toggle('on', v); c.setAttribute('aria-checked', String(v)); set(v); };
      c.addEventListener('click', flip);
      c.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') flip(e); });
      return c;
    }
    async function submit() {
      const now = Date.now();
      const ts = plan();
      if (!ts.length || ts.some((t) => t <= now) || busy) return;
      const repeat = F.mode === 'at' && F.repeat ? repeatNow() : null;
      const base = { repeat, sound: F.sound || null, hide: F.hide, unlock: opts.locked ? F.unlock : false };
      let nextList;
      let ids;
      if (F.id) {
        ids = [F.id];
        nextList = list.map((x) => (x.id === F.id ? { ...x, ...base, start: F.keep ? F.start : ts[0] } : x));
      } else {
        if (list.length + ts.length > R.MAX) { opts.done && opts.done(`A note can have up to ${R.MAX} reminders.`); return; }
        const made = ts.map((t, i) => ({ id: R.newId() + i, start: t, ...base }));
        ids = made.map((x) => x.id);
        nextList = [...list, ...made];
      }
      const m = { ...msgs };
      const text = F.msg.trim();
      for (const id of ids) { if (text) m[id] = text; else delete m[id]; }
      saveLast(F);
      if (!(await commit(nextList, m))) { opts.done && opts.done('Couldn’t save the reminder.'); return; }
      const sec = secs() && (F.mode === 'in' ? F.inS : F.atS) > 0;
      if (opts.done) opts.done(ts.length > 1 ? `${ts.length} reminders set.` : `Set for ${R.dayWord(ts[0]).replace(/^(Today|Tomorrow)$/, (x) => x.toLowerCase())} ${clockOf(ts[0], sec)}.`);
      F = null;
      close();
    }
    async function remove() {
      const id = F && F.id;
      if (!id) return;
      const m = { ...msgs }; delete m[id];
      if (!(await commit(list.filter((x) => x.id !== id), m))) { opts.done && opts.done('Couldn’t delete the reminder.'); return; }
      if (opts.done) opts.done('Reminder deleted.');
      F = null;
      if (list.length) show('list'); else close();
    }

    // ---- the calendar: days → months → years, in the same box
    function paintDate(page) {
      // 1.4.20: its header is Back (the arrow and the word are one button) to the reminder
      page.append(el('div', { class: 'rm-hd' }, el('button', { type: 'button', class: 'rm-back', title: 'Back to the reminder', onclick: () => show('form') },
        ico('back'), 'Back', opts.name ? el('small', {}, opts.name) : null)));
      const now = new Date();
      const today = dayNo(now.getTime());
      const nav = el('div', { class: 'rm-dphd' });
      const prev = el('button', { type: 'button', class: 'rm-ib', title: 'Back', html: ICON.back });
      const ttl = el('button', { type: 'button', class: 'rm-ttl' });
      const next = el('button', { type: 'button', class: 'rm-ib', title: 'Next', html: ICON.fwd });
      nav.append(prev, ttl, next);
      const grid = el('div', { class: `rm-grid ${DP.level}${DP.zoom ? ' anim' : ''}` });
      // the day it is on now (none picked yet: today, or tomorrow when that time has passed)
      const picked = F.dates.length || F.multi ? F.dates : plan().slice(0, 1).map(dayNo);
      DP.zoom = false; // the next redraw (a ticked day, an arrow) doesn't animate
      const redraw = () => show('date', false);
      const level = (l) => { DP.level = l; DP.zoom = true; redraw(); };
      if (DP.level === 'd') {
        ttl.innerHTML = `${MONTH_NAMES[DP.m]} ${DP.y}${ICON.down}`;
        ttl.onclick = () => level('m');
        prev.onclick = () => { DP.m--; if (DP.m < 0) { DP.m = 11; DP.y--; } redraw(); };
        next.onclick = () => { DP.m++; if (DP.m > 11) { DP.m = 0; DP.y++; } redraw(); };
        for (const d of DAY_ORDER) grid.append(el('i', {}, R.DAY_NAMES[d].slice(0, 2)));
        const first = (new Date(DP.y, DP.m, 1).getDay() + 6) % 7;
        for (let i = 0; i < 42; i++) { // always six weeks: the box never changes height
          const d = new Date(DP.y, DP.m, 1 - first + i);
          const n = dayNo(d.getTime());
          const cls = [d.getMonth() !== DP.m && 'other', n < today && 'past', n === today && 'now', picked.includes(n) && 'sel'].filter(Boolean).join(' ');
          grid.append(el('button', { type: 'button', class: cls, 'data-day': String(n), onclick: () => {
            if (F.multi) {
              F.dates = F.dates.includes(n) ? F.dates.filter((x) => x !== n) : [...F.dates, n];
              if (d.getMonth() !== DP.m) { DP.m = d.getMonth(); DP.y = d.getFullYear(); }
              redraw();
            } else { F.dates = n === today ? [] : [n]; show('form'); }
          } }, String(d.getDate())));
        }
      } else if (DP.level === 'm') {
        ttl.innerHTML = `${DP.y}${ICON.down}`;
        ttl.onclick = () => level('y');
        prev.onclick = () => { DP.y--; redraw(); };
        next.onclick = () => { DP.y++; redraw(); };
        R.MONTHS.forEach((name, m) => {
          const past = DP.y < now.getFullYear() || (DP.y === now.getFullYear() && m < now.getMonth());
          const sel = picked.some((n) => { const [y, mo] = ymd(n); return y === DP.y && mo === m; });
          const cls = [past && 'past', DP.y === now.getFullYear() && m === now.getMonth() && 'now', sel && 'sel'].filter(Boolean).join(' ');
          grid.append(el('button', { type: 'button', class: cls, onclick: () => { DP.m = m; level('d'); } }, name));
        });
      } else {
        const y0 = now.getFullYear() + Math.floor((DP.y - now.getFullYear()) / 12) * 12; // twelve years, from this one
        ttl.textContent = `${y0} – ${y0 + 11}`;
        ttl.disabled = true;
        prev.onclick = () => { DP.y -= 12; redraw(); };
        next.onclick = () => { DP.y += 12; redraw(); };
        for (let y = y0; y < y0 + 12; y++) {
          const cls = [y < now.getFullYear() && 'past', y === now.getFullYear() && 'now', picked.some((n) => ymd(n)[0] === y) && 'sel'].filter(Boolean).join(' ');
          grid.append(el('button', { type: 'button', class: cls, onclick: () => { DP.y = y; level('m'); } }, String(y)));
        }
      }
      const foot = el('div', { class: 'rm-dpfoot' });
      // several days: only for a new one (each day becomes a reminder of its own)
      if (!F.id) {
        foot.append(check('Several days', null, F.multi, (on) => {
          F.multi = on;
          if (!on && F.dates.length > 1) F.dates = [Math.min(...F.dates)];
          redraw();
        }, 'rm-multi'));
      } else foot.append(el('span', { style: 'flex:1' }));
      foot.append(el('button', { type: 'button', class: 'rm-link', onclick: () => {
        if (F.multi) { const [y, m] = ymd(today); Object.assign(DP, { level: 'd', y, m, zoom: DP.level !== 'd' }); redraw(); } else { F.dates = []; show('form'); }
      } }, 'Today'), el('button', { type: 'button', class: 'rm-done' + (F.multi ? ' show' : ''), onclick: () => show('form') }, 'Done'));
      page.append(nav, grid, foot);
    }

    if (opts.start === 'new' || !list.length) openForm(null, false);
    else if (opts.start === 'mine' && list.length === 1) openForm(list[0], false);
    else show('list');
    return {
      el: box,
      // 1.4.20: how tall its window keeps it (px): the form's rows, with hiding and Unlock to dismiss when they show
      height: H_BASE + (showHide ? H_ROW : 0) + (opts.locked ? H_ROW : 0),
      // new data from outside (the note changed, a reminder went off): the list shows it; a form being filled in stays
      refresh(data) {
        if (data) { list = (data.reminders || []).map((x) => ({ ...x })); msgs = { ...(data.msgs || {}) }; }
        if (view === 'list') show('list', false);
      },
      formOpen: () => view !== 'list',
      view: () => view,
    };
  }

  root.COSMO_REMIND_UI = { play, soundOf, editor, ICON };
})(window);
