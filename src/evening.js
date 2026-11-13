'use strict';
/*
 * CosmoNotes - evening colours (1.3.27, the owner's wish).
 * In the evening a light paper turns into a softer, dimmer shade of its own (Lemon -> Honey, Sky -> Dusk blue...), so a
 * bright note doesn't glare. Dark text stays dark, so the text colours picked in a note still read. The dark papers
 * (charcoal, night, midnight, forest, plum) have no evening shade: they stay as they are.
 * Used by both windows (window.COSMO_EVENING: css() for the styles, the phase comes from main) and by main
 * (require: phase() for the clock, mixHex() for the window's background colour). One list, so they never differ.
 */
(function (root) {
  // the evening shade of each light paper: the same parts as a paper in src/css/note-base.css (paper = top of the note,
  // paper2 = its bottom, bar = the top bar, accent = buttons, ink = text, sel = selection, line = lines and borders).
  // day = the paper it comes from (= PAPER in main/constants.js; a test checks), name = what Settings calls the shade
  const PALETTE = {
    yellow: { day: '#FFF4A3', name: 'Honey', paper: '#E0C674', paper2: '#D8BC69', bar: '#CFB25E', accent: '#4A3600', ink: '#2A2010', sel: 'rgba(122,82,0,.32)', line: 'rgba(74,54,0,.32)' },
    cream: { day: '#F5EDD9', name: 'Oat', paper: '#D3C4A4', paper2: '#CBBC9A', bar: '#C3B390', accent: '#46392A', ink: '#28211A', sel: 'rgba(110,84,40,.3)', line: 'rgba(70,57,42,.32)' },
    orange: { day: '#FFDFBF', name: 'Apricot', paper: '#E0AF86', paper2: '#D8A57C', bar: '#CF9B71', accent: '#55290A', ink: '#2D1C10', sel: 'rgba(130,60,10,.3)', line: 'rgba(85,41,10,.32)' },
    pink: { day: '#FFD6E6', name: 'Dusky pink', paper: '#D5A1B5', paper2: '#CE97AC', bar: '#C58DA2', accent: '#5A1636', ink: '#2D1922', sel: 'rgba(130,30,80,.28)', line: 'rgba(90,22,54,.32)' },
    rose: { day: '#FBE1E8', name: 'Mauve', paper: '#CDACB4', paper2: '#C6A3AC', bar: '#BD99A3', accent: '#50343D', ink: '#2B1D21', sel: 'rgba(110,50,70,.28)', line: 'rgba(80,52,61,.32)' },
    purple: { day: '#E8DDFF', name: 'Twilight', paper: '#B4A4D5', paper2: '#AB9BCE', bar: '#A192C5', accent: '#2F1F5C', ink: '#211A33', sel: 'rgba(70,40,150,.28)', line: 'rgba(47,31,92,.32)' },
    lavender: { day: '#E7E0F9', name: 'Heather', paper: '#B4ACCA', paper2: '#ADA3C3', bar: '#A49ABB', accent: '#362F50', ink: '#231E30', sel: 'rgba(70,55,120,.28)', line: 'rgba(54,47,80,.32)' },
    blue: { day: '#D2ECFF', name: 'Dusk blue', paper: '#9BBBD4', paper2: '#93B3CD', bar: '#8AAAC4', accent: '#0F3554', ink: '#15202B', sel: 'rgba(20,70,130,.28)', line: 'rgba(15,53,84,.32)' },
    mist: { day: '#DCEAF8', name: 'Slate', paper: '#A9BACD', paper2: '#A1B2C6', bar: '#98A9BD', accent: '#2B3B4E', ink: '#1B242F', sel: 'rgba(40,70,110,.28)', line: 'rgba(43,59,78,.32)' },
    mint: { day: '#CDF3E8', name: 'Sea glass', paper: '#96C5B6', paper2: '#8EBDAE', bar: '#85B4A5', accent: '#0C4738', ink: '#132720', sel: 'rgba(10,100,80,.28)', line: 'rgba(12,71,56,.32)' },
    sage: { day: '#DCEFE4', name: 'Eucalyptus', paper: '#A8C0B1', paper2: '#A0B8A9', bar: '#97AFA0', accent: '#2C4235', ink: '#1B2820', sel: 'rgba(40,90,65,.28)', line: 'rgba(44,66,53,.32)' },
    green: { day: '#D8F5C4', name: 'Moss', paper: '#AAC891', paper2: '#A2C089', bar: '#98B77F', accent: '#254C0C', ink: '#1B2813', sel: 'rgba(50,100,20,.3)', line: 'rgba(37,76,12,.32)' },
  };
  const KEYS = ['paper', 'paper2', 'bar', 'accent', 'ink', 'sel', 'line'];
  const DAY = 1440; // minutes
  const FADE = 30; // minutes from the day colour to the evening one (and back in the morning)
  const DEFAULT_FROM = 19 * 60; // the evening starts at 19:00
  const DEFAULT_TO = 7 * 60; // the day at 07:00
  const ahead = (a, b) => (((b - a) % DAY) + DAY) % DAY; // minutes from a to b, going forward round the clock

  // a time of day in minutes (0 – 1439); anything else -> fallback
  function cleanTime(v, fallback) {
    const n = Number(v);
    return v !== null && v !== '' && typeof v !== 'boolean' && Number.isInteger(n) && n >= 0 && n < DAY ? n : fallback;
  }
  // how far into the evening look it is at `now` (a Date): 0 = day colours, 1 = evening colours.
  // It starts to change at `from` and is fully evening FADE minutes later; at `to` it starts back, fully day FADE later.
  function phase(now, from = DEFAULT_FROM, to = DEFAULT_TO, fade = FADE) {
    from = cleanTime(from, DEFAULT_FROM);
    to = cleanTime(to, DEFAULT_TO);
    if (from === to) return 0;
    const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const long = ahead(from, to); // how long the evening lasts
    const since = ahead(from, m);
    if (since < long) return Math.min(1, since / fade);
    return Math.max(0, 1 - ahead(to, m) / fade);
  }
  // the styles: `sel` = the element that has data-color (the note's body, a card in the list).
  // They only give each paper its evening parts (--e-*); the window's own CSS mixes them in by --eve (0 – 1).
  function css(sel) {
    return Object.entries(PALETTE).map(([c, p]) => `${sel}[data-color="${c}"]{${KEYS.map((k) => `--e-${k}:${p[k]}`).join(';')};--e-cink:${p.ink}}`).join('\n');
  }
  // main's window background (shown for a moment while a note resizes): #rrggbb between day and evening
  function mixHex(a, b, t) {
    const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = n(a), y = n(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  const api = { PALETTE, KEYS, FADE, DEFAULT_FROM, DEFAULT_TO, cleanTime, phase, css, mixHex };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COSMO_EVENING = api;
})(typeof window !== 'undefined' ? window : globalThis);
