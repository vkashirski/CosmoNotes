'use strict';
/*
 * CosmoNotes - local storage.
 *
 * Every note is its own small JSON file in <data>/notes. Writes are "atomic":
 * the new version is written to a temp file, flushed to disk, and only then
 * swapped in, with the previous version kept as <id>.json.bak. A crash or power
 * cut mid-save can never leave a note half-written.
 *
 * Photos, drawings and voice recordings live in <data>/attachments and are
 * referenced from note HTML as stickyfile://att/<name>.
 *
 * Once a day every note is copied into <data>/backups/<date>. The last 30
 * backups are kept.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EVENING = require('./src/evening'); // 1.3.27: the evening colours' times (the same file the windows load)
const REMIND = require('./src/reminders'); // 1.4.1: reminders (the same rules as main and the windows)
const TAGS = require('./src/tags'); // 1.4.10: tags on notes and groups (the same rules as main and the windows)

// Paper colours. 1.1.15 added the colours of the list themes (cream, rose, sage = the Mint theme, mist = Sky,
// lavender = Lilac, and the dark night, midnight, forest, plum). In this order everywhere colours are shown:
// each colour next to its light version, the dark ones last.
const COLORS = ['yellow', 'cream', 'orange', 'pink', 'rose', 'purple', 'lavender', 'blue', 'mist', 'mint', 'sage', 'green',
  'charcoal', 'night', 'plum', 'midnight', 'forest'];
const DARK_COLORS = ['charcoal', 'night', 'midnight', 'forest', 'plum'];
// 1.1.16: note effects and mouse followers (the same ids as src/fx.js: keep both lists the same)
const FX_EFFECTS = ['snow', 'rain', 'lightning', 'rainbow', 'leaves', 'blossom', 'fireworks', 'confetti', 'hearts', 'bubbles', 'nightsky', 'embers', 'stardust', 'shards', 'plankton', 'fish', 'fireflies', 'dust', 'ocean', 'silk', 'jelly', 'network', 'ghost', 'warp', 'glitch', 'matrix', 'heal', 'cauldron', 'fel'];
// 1.1.22, fifth round: the order is by theme (weather, leaves and blossom, glowing things, sky, sea life, water and network, screens,
// magic, party), the owner's pick "Option A"; the ids did not change. Keep it the same as ORDER in src/fx.js.
// (history: 1.1.18 added the Effect Lab picks and the Spell Lab picks; 1.1.20 removed Fairy dust, XP orbs, Neon tunnel and Synthwave;
// 1.1.22 removed Solar system and Aquarium: a note that had one goes back to "same as all notes")
// 1.1.20: a follower for every background (the same order, with 'frost' = Snow and 'ripples' = Rain), then the pencil line
const FX_FOLLOWERS = ['frost', 'ripples', 'lightning', 'rainbow', 'leaves', 'blossom', 'fireworks', 'confetti', 'hearts', 'bubbles', 'nightsky', 'embers', 'stardust', 'shards', 'plankton', 'fish', 'fireflies', 'dust', 'ocean', 'silk', 'jelly', 'network', 'ghost', 'warp', 'glitch', 'matrix', 'heal', 'cauldron', 'fel', 'pencil'];
// a note's own choice: null = same as all notes (Settings), 'none' = nothing on this note, or an id
const cleanFxId = (v, ids) => { if (v === 'comet') v = 'rainbow'; return v === 'none' || ids.includes(v) ? v : null; }; // 'comet' (Rainbow line) was folded into Rainbow
const FX_AMOUNTS = ['low', 'mid', 'high']; // how much: less, normal, more
const cleanFxAmount = (v) => (FX_AMOUNTS.includes(v) ? v : null);
// 1.1.17: how see-through an effect / follower is: 0.1 – 1 in 5 % steps (null = not set; same rule as opacityOf in fx.js)
const cleanFxOpacity = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0.1, Math.round(n * 20) / 20)) : null;
};
function cleanFx(fx) {
  const o = fx && typeof fx === 'object' ? fx : {};
  // ea / fa: how much of the effect / follower on this note, eo / fo: its opacity (1.1.17) (null = same as all notes)
  // mi (1.1.21): the mouse plays with this note's background (true / false; null = same as all notes)
  return { e: cleanFxId(o.e, FX_EFFECTS), f: cleanFxId(o.f, FX_FOLLOWERS), ea: cleanFxAmount(o.ea), fa: cleanFxAmount(o.fa), eo: cleanFxOpacity(o.eo), fo: cleanFxOpacity(o.fo), mi: typeof o.mi === 'boolean' ? o.mi : null };
}
// what "random" meant before 1.1.15: one of the 7 original pastel papers
const OLD_RANDOM = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange', 'mint'];
// The colours new notes may get (Settings → For new notes). One = always that colour; several = a random one of them.
// Anything unknown is dropped, the order follows COLORS, and there is always at least one.
function cleanColors(list, fallback = 'yellow') {
  const set = new Set(Array.isArray(list) ? list : []);
  const out = COLORS.filter((c) => set.has(c));
  return out.length ? out : [COLORS.includes(fallback) ? fallback : 'yellow'];
}
const GROUP_STYLES = ['stack', 'folder', 'envelope', 'notebook'];
const GROUP_COLORS = ['kraft', 'sun', 'rose', 'coral', 'lilac', 'sky', 'mint', 'graphite'];
const DEFAULT_SETTINGS = {
  startWithWindows: true,
  defaultColor: 'yellow', // kept for older versions: the first of defaultColors
  defaultColors: null, // 1.1.15: the colours new notes pick from at random (null = work it out from defaultColor)
  defaultFont: 'hand',
  firstRunDone: false,
  listBounds: null,
  spellCheck: false, // spelling is ignored unless turned on
  spellCyrillic: false, // Cyrillic words are never underlined unless turned on
  listSort: { by: 'updated', dir: 'desc', groups: 'mixed' },
  listSize: 'm', // card size in the notes list: s | m | l | xl | xxl
  lock: null, // "salt:hash" of the one password/PIN for locked notes
  lockKind: null, // 'pin' (digits only, opens as soon as it's typed) | 'password' (null = password, set before 1.1.6)
  lockLen: 0, // length of the PIN, so a note opens by itself once that many digits are typed
  defaultOpacity: 1, // see-through for new notes (0.25 – 1)
  defaultSolidOnHover: true, // new notes turn solid while the mouse is over them
  newColorNoRepeat: true, // 1.1.15: with several colours picked, a new note never gets the colour of the one made just before it
  lastNewColor: null, // the colour the last new note got (for newColorNoRepeat)
  fxEffect: 'none', // 1.1.16: the effect behind the writing of every note that hasn't chosen its own
  fxFollower: 'none', // the mouse follower for every note that hasn't chosen its own
  fxEffectAmount: 'mid', // how much of it: low (less) | mid (normal) | high (more)
  fxFollowerAmount: 'mid',
  fxEffectOpacity: 1, // 1.1.17: how see-through the background effect is (0.1 – 1; 1 = as drawn)
  fxFollowerOpacity: 1, // and the mouse follower
  fxInteract: true, // 1.1.21: the mouse plays with the background effect (bubbles pop, rain hits it, fish dart away…)
  fxForceAll: false, // true: every note shows fxEffect / fxFollower, even ones with their own choice (kept for later)
  fxPaused: false, // pause every effect and follower
  listTheme: 'cream', // colours of the notes list window (see THEMES in list.js; night, midnight, forest, plum are dark)
  madeGroup: false, // true once a group was ever made: the "drag to make a group" tip stops for good
  // 1.3.19: checklists in every note that hasn't chosen its own (note.checklist; Settings → Checklists)
  checkDrag: true, // drag a box to move its line (a click still ticks it)
  checkSink: false, // a ticked line moves down, below the unticked ones
  checkFixed: false, // every box is the note's own size, whatever the size of the words after it
  // 1.3.27: evening colours (src/evening.js): light papers turn into a softer shade from eveFrom until eveTo (minutes after
  // midnight; each change fades over 30 minutes). Each note can choose its own (note.evening)
  eveOn: false,
  eveFrom: EVENING.DEFAULT_FROM, // 19:00
  eveTo: EVENING.DEFAULT_TO, // 07:00
  // 1.3.27: the panic button (main/panic.js): in each note's top bar and the tray, and a shortcut for all of Windows.
  // It closes every open note (except those with note.panic === false), locks everything again and hides the list.
  panicOn: false,
  panicKey: '', // the shortcut, as an Electron accelerator ('Alt+Z', 'F8'…); '' = none (the owner: no shortcut until one is set)
  panicClosed: [], // the notes the last panic closed: they come back when CosmoNotes is opened again (main/panic.js reopen)
  // 1.3.34: the click-through button, left of the pin in each note's top bar (note.clickThrough). Off: no note is click-through
  clickThroughOn: false,
  // 1.4.0: check GitHub for a newer version when CosmoNotes starts and once a day (main/ipc-update.js). The button in
  // Settings → About works either way
  updateCheck: true,
  // 1.4.1: reminders (main/reminders.js): the sound a reminder plays unless it has its own (src/reminders.js SOUNDS, or
  // 'none'), how loud (0 – 1), and whether notes a reminder hides still show in the notes list
  remindSound: REMIND.DEFAULT_SOUND,
  remindVolume: 0.6,
  remindShowHidden: false,
  // 1.4.10: the notes list's tag filter with several tags picked: false = notes with all of them, true = with any of them
  tagAny: false,
};
// 1.4.1: the reminders' sound in Settings (an id of src/reminders.js SOUNDS or 'none') and how loud (0 – 1, steps of 0.05)
const cleanRemindSound = (v) => (v === 'none' || REMIND.SOUND_IDS.includes(v) ? v : REMIND.DEFAULT_SOUND);
function cleanVolume(v) {
  const x = Number(v);
  return v === null || v === '' || !Number.isFinite(x) ? 0.6 : Math.min(1, Math.max(0, Math.round(x * 20) / 20));
}
// 1.3.19: a note's own checklist options ({ drag, sink, fixed }: true / false; null = as in Settings)
const CHECK_OPTS = { drag: 'checkDrag', sink: 'checkSink', fixed: 'checkFixed' };
function cleanChecklist(c) {
  const o = c && typeof c === 'object' ? c : {};
  const out = {};
  for (const k of Object.keys(CHECK_OPTS)) out[k] = typeof o[k] === 'boolean' ? o[k] : null;
  return out;
}
// 1.4.5: the apps a note is pinned over (main/app-pin.js): [{ app, part }], part null = any window of the app, else only
// one whose title has that workspace / file. A rule for a whole app covers its parts (they are dropped); at most 40
function cleanPinApps(list) {
  const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const rules = [];
  const seen = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    const app = str(r && r.app, 80);
    if (!app) continue;
    const part = str(r.part, 120) || null;
    const k = `${app.toLowerCase()}\n${(part || '').toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    rules.push({ app, part });
  }
  const whole = new Set(rules.filter((r) => !r.part).map((r) => r.app.toLowerCase()));
  return rules.filter((r) => !r.part || !whole.has(r.app.toLowerCase())).slice(0, 40);
}

// 1.3.27: the settings a note can have its own value of, and how Settings → "Use on all notes" puts Settings back on it.
// own(n, s): the note differs from Settings; reset(n, s): the patch that makes it the same as Settings.
// Font, see-through and turn solid are "for new notes" (the owner's pick): every note has a value of its own, so "own" is
// a value that differs from Settings, and reset copies the Settings value in (later Settings changes don't touch it).
// The rest follow Settings while they are null; reset makes them null again. A note's paper colour has no reset (the owner:
// it would recolour every note at random), nor its title font (no setting for it).
const newFont = (s) => (FONTS.includes(s.defaultFont) ? s.defaultFont : 'hand');
const newOpacity = (s) => clamp(Math.round((Number(s.defaultOpacity) || 1) * 20) / 20, 0.25, 1);
const FX_OF = { effect: ['e', 'ea', 'eo', 'mi'], follower: ['f', 'fa', 'fo'] };
const OVERRIDES = {
  font: { own: (n, s) => n.font !== newFont(s), reset: (n, s) => ({ font: newFont(s) }) },
  opacity: { own: (n, s) => Math.abs(n.opacity - newOpacity(s)) > 0.001, reset: (n, s) => ({ opacity: newOpacity(s) }) },
  solidOnHover: { own: (n, s) => n.solidOnHover !== (s.defaultSolidOnHover !== false), reset: (n, s) => ({ solidOnHover: s.defaultSolidOnHover !== false }) },
  ...Object.fromEntries(Object.entries(FX_OF).map(([k, parts]) => [k, {
    own: (n) => parts.some((p) => n.fx[p] !== null),
    reset: (n) => ({ fx: { ...n.fx, ...Object.fromEntries(parts.map((p) => [p, null])) } }),
  }])),
  // "Pause effects on this note" and "play here while all are paused" (both against Settings → Pause all effects)
  fxPause: { own: (n) => n.fxPaused || n.fxPlay, reset: () => ({ fxPaused: false, fxPlay: false }) },
  spell: { own: (n) => n.spell !== null, reset: () => ({ spell: null }) },
  ...Object.fromEntries(Object.entries(CHECK_OPTS).map(([k, key]) => [key, {
    own: (n) => n.checklist[k] !== null,
    reset: (n) => ({ checklist: { ...n.checklist, [k]: null } }),
  }])),
  evening: { own: (n) => n.evening !== null, reset: () => ({ evening: null }) },
  panic: { own: (n) => n.panic !== null, reset: () => ({ panic: null }) },
};
const OVERRIDE_KEYS = Object.keys(OVERRIDES);
// how many notes (not in the Bin) have their own value, per key
function overrideCounts(notes, s) {
  const out = Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, 0]));
  for (const n of notes) if (!n.deletedAt) for (const k of OVERRIDE_KEYS) if (OVERRIDES[k].own(n, s)) out[k]++;
  return out;
}
// the one patch that puts Settings back on a note for these keys ({} = nothing to change)
function resetPatch(n, s, keys) {
  let cur = n;
  const patch = {};
  for (const k of keys) {
    const o = OVERRIDES[k];
    if (!o || !o.own(cur, s)) continue;
    const p = o.reset(cur, s);
    Object.assign(patch, p);
    cur = { ...cur, ...p };
  }
  return patch;
}

const KEEP_BACKUPS = 30;
const ATT_PREFIX = 'stickyfile://att/';
const ATT_NAME = /^[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp|bmp|webm|ogg|mp3|m4a|wav)$/i;
const ATT_REF = /stickyfile:\/\/att\/([A-Za-z0-9_.-]+)/g;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeFileSafe(file, text) {
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) {
    try { fs.copyFileSync(file, file + '.bak'); } catch { /* keep going */ }
  }
  // Antivirus or file indexers sometimes hold a file for a moment on Windows.
  for (let i = 0; i < 4; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (i === 3) {
        fs.writeFileSync(file, text);
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        return;
      }
      sleepSync(40);
    }
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function normalizeBounds(b) {
  if (!b || typeof b !== 'object') return null;
  const nums = ['x', 'y', 'width', 'height'].map((k) => Number(b[k]));
  if (!nums.every(Number.isFinite)) return null;
  const [x, y, width, height] = nums.map(Math.round);
  return { x, y, width: Math.max(180, width), height: Math.max(120, height) };
}

const cleanTitle = (t) => (typeof t === 'string' ? t.replace(/[\r\n\t]+/g, ' ').slice(0, 120) : '');
// 1.1.30: a locked note's sealed contents (main/crypt.js makes and opens them; the store only keeps them)
function cleanEnc(e) {
  if (!e || typeof e !== 'object' || (e.v !== 1 && e.v !== 2)) return null; // 2 since 1.1.31
  if (!['k', 'n', 't', 'c'].every((k) => typeof e[k] === 'string' && e[k].length < 50e6)) return null;
  return { v: e.v, k: e.k, n: e.n, t: e.t, c: e.c };
}
const cleanEncAtt = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,120}$/.test(x)).slice(0, 2000) : null);

// Draw-over ink: { s: [stroke, ...] } in the note's own coordinates (px from the top-left of the text area).
// stroke = { t: pen|hl|line|arrow|rect|ellipse, c: '#rrggbb', w: 1-40, l: 'a' (above text) | 'b' (behind),
//            d: 'dash' | 'dot' (1.1.13, left out = a solid line), p: [x, y, x, y, ...] }  (pen/hl: the path; shapes: start and end corner)
const INK_TOOLS = ['pen', 'hl', 'line', 'arrow', 'rect', 'ellipse'];
const MAX_STROKES = 4000;
function normalizeInk(ink) {
  if (!ink || !Array.isArray(ink.s)) return null;
  const out = [];
  for (const st of ink.s.slice(0, MAX_STROKES)) {
    if (!st || !INK_TOOLS.includes(st.t) || !Array.isArray(st.p)) continue;
    const p = st.p.slice(0, 20000).map(Number);
    if (p.length < 2 || p.length % 2 || !p.every((v) => Number.isFinite(v) && v > -10000 && v < 100000)) continue;
    const clean = {
      t: st.t,
      c: /^#[0-9a-fA-F]{6}$/.test(st.c) ? st.c : '#2B2B2B',
      w: Math.min(40, Math.max(1, Number(st.w) || 3)),
      l: st.l === 'b' ? 'b' : 'a',
      p: p.map((v) => Math.round(v * 10) / 10),
    };
    if (st.d === 'dash' || st.d === 'dot') {
      clean.d = st.d;
      // where the dash pattern carries on from (px along the line it was erased out of), so dots don't move (1.1.14)
      const o = Number(st.o);
      if (Number.isFinite(o) && o > 0 && o < 1e6) clean.o = Math.round(o * 10) / 10;
    }
    out.push(clean);
  }
  return out.length ? { s: out } : null;
}

function normalizeGroup(x) {
  return {
    id: String(x.id),
    name: cleanTitle(x.name),
    createdAt: Number(x.createdAt) || Date.now(),
    parentId: typeof x.parentId === 'string' && x.parentId ? x.parentId : null,
    style: GROUP_STYLES.includes(x.style) ? x.style : 'stack',
    color: GROUP_COLORS.includes(x.color) ? x.color : 'kraft',
    titleFont: FONTS.includes(x.titleFont) ? x.titleFont : 'hand', // 1.4.14: the font of its name (card label, group bar)
    locked: !!x.locked,
    favorite: !!x.favorite, // starred in the notes list (1.1.13)
    tags: TAGS.cleanAll(x.tags), // 1.4.10: its tags count for everything inside it (src/tags.js); not secret, like its name
  };
}

// 1.1.22 (fifth round): the notes list only gets a note's plain text, so its checklist boxes didn't show on the cards.
// This reads the note's html (no browser needed) and says, for each non-empty line of `text` (the same lines the card
// shows: split on new lines, trimmed, empty ones left out), whether it is a checklist item: 'o' = a box, 'x' = a ticked
// box, '.' = an ordinary line. Returns '' when there are none. Any <li> inside a <ul class="checklist"> has a box (the
// same rule as the note's CSS); its box sits on its first line. The items are matched to the lines by their words, in
// order, so a line that doesn't match simply gets no box (nothing can go wrong, it just looks like before).
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decodeEnt = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
  return ENT[e.toLowerCase()] ?? m;
});
const normLine = (t) => t.replace(/[ \s]+/g, ' ').trim();
function checklistMarks(html, text) {
  if (typeof html !== 'string' || typeof text !== 'string' || !/checklist/.test(html)) return '';
  const items = []; const lis = []; const uls = []; let checkDepth = 0; let m;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { const it = lis[lis.length - 1]; if (it && it.open) it.t += decodeEnt(m[4]); continue; }
    const close = m[1] === '/'; const tag = m[2].toLowerCase(); const attrs = m[3] || '';
    const cls = (/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs) || [])[2] || (/\bclass\s*=\s*'([^']*)'/i.exec(attrs) || [])[1] || '';
    if (tag === 'ul' || tag === 'ol') {
      if (close) { const was = uls.pop(); if (was) checkDepth--; } else if (!/\/\s*$/.test(attrs)) { const ck = tag === 'ul' && /(^|\s)checklist(\s|$)/.test(cls); uls.push(ck); if (ck) checkDepth++; }
    } else if (tag === 'li') {
      if (close) lis.pop();
      else { const up = lis[lis.length - 1]; if (up) up.open = false; const it = checkDepth > 0 ? { t: '', done: /(^|\s)done(\s|$)/.test(cls), open: true } : { t: '', open: false, plain: true }; if (!it.plain) items.push(it); lis.push(it); }
    } else if (!close && (tag === 'br' || tag === 'div' || tag === 'p')) { const it = lis[lis.length - 1]; if (it && it.open && (tag === 'br' || normLine(it.t))) it.open = false; }
  }
  const want = items.map((it) => ({ t: normLine(it.t), done: it.done })).filter((it) => it.t);
  if (!want.length) return '';
  const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
  let j = 0; let any = false; let out = '';
  for (const line of lines) {
    const l = normLine(line); let hit = -1;
    for (let k = j; k < Math.min(want.length, j + 4); k++) if (want[k].t === l) { hit = k; break; }
    if (hit < 0) { out += '.'; continue; }
    out += want[hit].done ? 'x' : 'o'; any = true; j = hit + 1;
  }
  return any ? out : '';
}

// 1.1.46: where the note's first picture sits and how big it is there, so its card in the list shows it in the same
// place and at the same size next to the words (the owner: a small picture far down took half the card). Returns
// { at, px, pct, d, fs, tw } or null: at = how many lines of the text come before it (lines as the list counts them:
// trimmed, empty ones left out); px = its width in the note (its width attribute), pct = Small / Medium (45 / 72 % of
// the text's width), neither = full width (no wider than the picture itself); d = a drawing; fs = the note's text size
// (px), tw = the text's width (px), so the card can turn px into "this many letters wide".
// the note's text size by its size (note-base.css --fs: one for every font since 1.4.12)
const FONT_PX = { s: 13.5, m: 15.5, l: 18.5 };
// the note fonts: Handwritten (Caveat), Rounded (Nunito), Medieval (Augusta, src/fonts/, 1.2.1)
const FONTS = ['hand', 'round', 'medieval'];
function picturePlace(n) {
  const html = n && typeof n.html === 'string' ? n.html : '';
  const m = /<img\b([^>]*)>/i.exec(html);
  if (!m) return null;
  // the words before the picture, broken into lines the way the note's innerText does (blocks and <br> end a line)
  const before = decodeEnt(html.slice(0, m.index)
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/?(div|p|li|ul|ol|h[1-6]|blockquote|pre|tr|table|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ''));
  const prev = before.split('\n').map(normLine).filter(Boolean);
  const lines = (typeof n.text === 'string' ? n.text : '').split('\n').map(normLine).filter(Boolean);
  let at = Math.min(prev.length, lines.length);
  // counting can be off by a line (tables, voice notes): if the last line before it is known, trust where that one is
  const last = prev[prev.length - 1];
  if (last && lines[at - 1] !== last) {
    let best = -1;
    lines.forEach((l, i) => { if (l === last && (best < 0 || Math.abs(i + 1 - at) < Math.abs(best + 1 - at))) best = i; });
    if (best >= 0) at = best + 1;
  }
  const attrs = m[1];
  const cls = (/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs) || [])[2] || '';
  const w = Number((/\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)/i.exec(attrs) || [])[1]);
  const fs = FONT_PX[n.size] || FONT_PX.m;
  const tw = Math.max(80, Number(n.wrapWidth) || ((n.bounds && n.bounds.width) || 340) - 32);
  return {
    at,
    px: w > 0 ? Math.round(w) : null,
    pct: w > 0 ? null : /(^|\s)w-s(\s|$)/.test(cls) ? 45 : /(^|\s)w-m(\s|$)/.test(cls) ? 72 : null,
    d: /(^|\s)att-drawing(\s|$)/.test(cls),
    fs,
    tw,
  };
}
// 1.1.46: how many lines of words a note has (as the list counts them), for the card's "+3 lines"
const lineCount = (text) => (typeof text === 'string' ? text.split('\n').filter((l) => l.trim()).length : 0);

// 1.3.11: the look of the words on a note's card. A card is built from the note's plain text (n.text), so on its own it
// lost every look the note gives its words (the owner saw a line in Rounded in the note and in Medieval on its card).
// This is the one place that turns the note's html into that look: one walk makes the html's lines the way innerText
// does (blocks, <br> and table rows end a line; empty lines are left out), each line a list of runs
// { t, f, c, bg, k, b, i, u, s, mk, sub, sup, code, h, a } (CARD_RUN_KEYS; the card draws them: `runCss` in
// src/list/cards.js). Each line of the text then gets the runs of the html line with the same words, in order (like
// checklistMarks), or null: shown plain, as before (so a line that doesn't match can only look plain, never wrong).
// Every tag the editor keeps (ALLOWED / RICH in src/note/content.js) is in CARD_TAGS: a look, a line break, or nothing to
// show (list-logic.test.js checks this, so a new kind of formatting in the note can't be missed on the cards).
const CARD_FACE = { caveat: 'hand', nunito: 'round', augusta: 'medieval' }; // <font face> (src/note/panels.js FACE)
const CARD_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i;
const CARD_RESET = /^(#010203|rgb\(1,\s*2,\s*3\))$/i; // the editor's "Normal" colour marker (panels.js RESET_COLOR)
const CARD_TAGS = {
  // inline: the look they add (FONT and SPAN: from their attributes, see cardLook)
  B: { b: 1 }, STRONG: { b: 1 }, I: { i: 1 }, EM: { i: 1 }, U: { u: 1 }, S: { s: 1 }, STRIKE: { s: 1 }, DEL: { s: 1 },
  MARK: { mk: 1 }, SUB: { sub: 1 }, SUP: { sup: 1 }, CODE: { code: 1 }, A: { a: 1 }, FONT: {}, SPAN: {},
  // blocks: a new line (and their own look)
  PRE: { line: 1, code: 1 }, H1: { line: 1, h: 1 }, H2: { line: 1, h: 1 }, H3: { line: 1, h: 1 }, H4: { line: 1, h: 1 },
  P: { line: 1 }, DIV: { line: 1 }, LI: { line: 1 }, UL: { line: 1 }, OL: { line: 1 }, BLOCKQUOTE: { line: 1 },
  TABLE: { line: 1 }, TBODY: { line: 1 }, THEAD: { line: 1 }, TR: { line: 1 }, BR: { line: 1, empty: 1 }, HR: { line: 1, empty: 1 },
  TD: { cell: 1 }, TH: { cell: 1, b: 1 },
  // no words of their own
  IMG: { empty: 1 },
};
const CARD_RUN_KEYS = ['f', 'c', 'bg', 'k', 'b', 'i', 'u', 's', 'mk', 'sub', 'sup', 'code', 'h', 'a'];
// 1.3.13: the size of the words, k = times the note's text size, worked out exactly as the note's CSS does it: the size
// they're written at (`_n`: sizes multiply, nested ones add up: font[size] CARD_SIZE, headings 1.2, code .8, sub / sup
// the browser's 1/1.2). Their font changes no size (1.4.12: the card, like the note, matches the letters with
// font-size-adjust). store.test.js checks these against the CSS files.
const CARD_SIZE = { 1: 0.7, 2: 0.82, 3: 1, 4: 1.2, 5: 1.45, 6: 1.85, 7: 2.3 };
const CARD_TAG_SIZE = { H1: 1.2, H2: 1.2, H3: 1.2, H4: 1.2, CODE: 0.8, PRE: 0.8, SUB: 1 / 1.2, SUP: 1 / 1.2 };
const attrOf = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs);
  return m ? decodeEnt(m[1] ?? m[2] ?? m[3] ?? '').trim() : null;
};
// the look a tag adds to the words inside it (on top of `look`, the look around it)
function cardLook(look, tag, attrs) {
  const add = CARD_TAGS[tag];
  const out = { ...look };
  out._n = (look._n || 1) * (CARD_TAG_SIZE[tag] || 1);
  for (const k of CARD_RUN_KEYS) if (add && add[k]) out[k] = 1;
  if (tag === 'FONT') {
    const face = attrOf(attrs, 'face');
    if (face) { const f = CARD_FACE[face.split(',')[0].replace(/["']/g, '').trim().toLowerCase()]; if (f) out.f = f; }
    const c = attrOf(attrs, 'color');
    if (c && CARD_RESET.test(c)) delete out.c; else if (c && CARD_COLOR.test(c)) out.c = c;
    const sz = attrOf(attrs, 'size');
    if (sz && CARD_SIZE[sz]) out._n *= CARD_SIZE[sz];
  }
  if (tag === 'SPAN') {
    const style = attrOf(attrs, 'style') || '';
    for (const part of style.split(';')) {
      const i = part.indexOf(':'); if (i < 0) continue;
      const p = part.slice(0, i).trim().toLowerCase(); const v = part.slice(i + 1).trim();
      const key = p === 'color' ? 'c' : p === 'background-color' ? 'bg' : null;
      if (!key) continue;
      if (/^transparent$/i.test(v) || CARD_RESET.test(v)) delete out[key]; else if (CARD_COLOR.test(v)) out[key] = v;
    }
  }
  const k = Math.round(out._n * 1000) / 1000;
  if (k === 1) delete out.k; else out.k = k;
  return out;
}
// 1.3.18: until 1.3.17 a size on the tag of an app font other than the note's own did nothing (that font's resize beat
// it: the browser put both on one tag when a size or font was picked for words all in one tag, and pastes brought them).
// Now sizes always count, so a note's old ones are taken off once, when it is read (normalize, crypt.js openAll), and
// it looks as before. Only those: every other size still counts the same.
const FACE_IDS = { Caveat: 'hand', Nunito: 'round', Augusta: 'medieval' };
// a note's html read the new way (unchanged once its `sizes` is 2)
const sizedHtml = (n) => (n.sizes === 2 ? n.html : dropDeadSizes(n.html, FONTS.includes(n.font) ? n.font : 'hand'));
function dropDeadSizes(html, noteFont) {
  if (typeof html !== 'string' || !/<font\b[^>]*\bsize/i.test(html)) return html;
  return html.replace(/<font\b([^>]*)>/gi, (tag, attrs) => {
    const id = FACE_IDS[attrOf(attrs, 'face')];
    if (!id || id === noteFont || attrOf(attrs, 'size') === null) return tag;
    return '<font' + attrs.replace(/\s+size\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/i, '') + '>';
  });
}
const sameLook = (a, b) => CARD_RUN_KEYS.every((k) => a[k] === b[k]);
function cardRuns(html, text) {
  if (typeof html !== 'string' || typeof text !== 'string' || !/<(b|strong|i|em|u|s|strike|del|mark|sub|sup|code|pre|a|font|span|h[1-4]|th)\b/i.test(html)) return null;
  const lines = []; let cur = []; let chars = 0;
  const stack = []; let look = {};
  const endLine = () => { if (cur.length) lines.push(cur); cur = []; };
  const put = (t, l = look) => {
    if (!t) return;
    const last = cur[cur.length - 1];
    if (last && sameLook(last, l)) last.t += t;
    else { const run = { t }; for (const k of CARD_RUN_KEYS) if (l[k] !== undefined) run[k] = l[k]; cur.push(run); }
    chars += t.length;
  };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g; let m;
  while ((m = re.exec(html)) && chars < 3000) { // the list gets at most 600 letters of the text
    if (m[4] !== undefined) { put(decodeEnt(m[4]).replace(/\s+/g, ' ')); continue; }
    const close = m[1] === '/'; const tag = m[2].toUpperCase(); const attrs = m[3] || '';
    const kind = CARD_TAGS[tag] || {};
    if (kind.line) endLine();
    if (kind.cell && !close && cur.length) put(' ', {});
    if (kind.empty || /\/\s*$/.test(attrs)) continue;
    if (close) {
      const at = stack.map((x) => x.tag).lastIndexOf(tag);
      if (at >= 0) { look = stack[at].before; stack.length = at; }
    } else {
      stack.push({ tag, before: look });
      look = cardLook(look, tag, attrs);
    }
  }
  endLine();
  const html2 = lines.map((runs) => {
    const t = normLine(runs.map((r) => r.t).join(''));
    if (!t) return null;
    const out = runs.map((r) => ({ ...r }));
    out[0].t = out[0].t.replace(/^\s+/, ''); out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
    return { t, runs: out.filter((r) => r.t), styled: runs.some((r) => CARD_RUN_KEYS.some((k) => r[k] !== undefined)) };
  }).filter(Boolean);
  const want = text.split('\n').map((x) => x.trim()).filter(Boolean);
  let j = 0; let any = false;
  const out = want.map((line) => {
    const l = normLine(line);
    for (let k = j; k < Math.min(html2.length, j + 4); k++) {
      if (html2[k].t !== l) continue;
      j = k + 1;
      if (!html2[k].styled) return null;
      any = true;
      return html2[k].runs;
    }
    return null;
  });
  return any ? out : null;
}

// 1.1.23: the descriptions of a note's pictures (their alt text), one per line, for the notes list's search
function pictureWords(html) {
  if (typeof html !== 'string' || !/<img/i.test(html)) return '';
  const out = [];
  for (const m of html.matchAll(/<img\b[^>]*?\balt\s*=\s*("([^"]*)"|'([^']*)')/gi)) { const t = decodeEnt(m[2] ?? m[3] ?? '').trim(); if (t) out.push(t); }
  return out.join('\n').slice(0, 2000);
}
function normalize(n) {
  const now = Date.now();
  const font = FONTS.includes(n.font) ? n.font : 'hand';
  const html = typeof n.html === 'string' ? n.html : '';
  const sealed = !!(n.enc && !html); // its html is in enc: cleaned when it is opened (crypt.js openAll)
  const ink = normalizeInk(n.ink);
  const wrapWidth = Number.isFinite(Number(n.wrapWidth)) && Number(n.wrapWidth) >= 80 ? Math.min(4000, Math.round(Number(n.wrapWidth))) : null;
  const nowrap = n.nowrap === true;
  return {
    id: String(n.id),
    title: cleanTitle(n.title),
    coverTitle: cleanTitle(n.coverTitle), // 1.1.30: shown instead of the title while the note is locked
    html: sealed ? html : sizedHtml({ ...n, html, font }),
    text: typeof n.text === 'string' ? n.text : '',
    firstImage: typeof n.firstImage === 'string' ? n.firstImage : null,
    color: COLORS.includes(n.color) ? n.color : 'yellow',
    font,
    titleFont: FONTS.includes(n.titleFont) ? n.titleFont : null, // 1.3.3: the title's own font; null = the note's font
    size: ['s', 'm', 'l'].includes(n.size) ? n.size : 'm',
    opacity: clamp(Number(n.opacity) || 1, 0.25, 1),
    zoom: clamp(Math.round((Number(n.zoom) || 1) * 10) / 10, 0.5, 3), // Ctrl + mouse wheel in the note (1.1.13)
    solidOnHover: n.solidOnHover !== false,
    pinned: !!n.pinned,
    // 1.3.34: click-through (main/note-state.js applyClickThrough): the mouse goes through it to the window under it. Only a
    // pinned note: turning it on pins the note (ipc-common.js applyPatch), unpinning turns it off. Not copied by Duplicate.
    clickThrough: !!n.clickThrough && !!n.pinned,
    // 1.4.5: pinned only over these apps (empty = on top of everything); unpinning forgets them. Not an edit, not copied by
    // Duplicate (it isn't pinned)
    pinApps: n.pinned ? cleanPinApps(n.pinApps) : [],
    open: !!n.open,
    rolled: !!n.rolled,
    locked: !!n.locked,
    favorite: !!n.favorite, // starred in the notes list (1.1.13); not an edit, not copied by Duplicate
    fx: cleanFx(n.fx), // 1.1.16: this note's own effect / mouse follower ({ e, f }; null = same as all notes); not an edit
    fxPaused: !!n.fxPaused, // effects paused on this note; not an edit
    fxPlay: !!n.fxPlay, // 1.1.16: effects play on this note even while all effects are paused (Settings / tray); not an edit
    ink,
    // text layout locked at this width (px) so text and pictures don't re-wrap; null = wraps with the note
    wrapWidth,
    // 1.1.45: word wrap off with no limit, kept with a drawing too (then wrapWidth is only the pictures' width)
    nowrap,
    // 1.3.29: word wrap off with the text kept at wrapWidth (the first drawing on a note with word wrap on does that), so
    // the drawing stays on its words. Saved, never worked out from the drawing: erasing the last line used to turn the
    // note into "no limit" and every table cell and paragraph un-wrapped. A note saved before 1.3.29 (no wrapFixed yet):
    // it is what it showed then, locked when it had a drawing; a sealed one is decided when it is opened (openedLayout).
    wrapFixed: !wrapWidth || nowrap ? false : typeof n.wrapFixed === 'boolean' ? n.wrapFixed : sealed ? null : !!ink,
    spell: n.spell === true || n.spell === false ? n.spell : null,
    checklist: cleanChecklist(n.checklist), // 1.3.19: this note's own checklist options (null each = as in Settings); not an edit
    evening: typeof n.evening === 'boolean' ? n.evening : null, // 1.3.27: evening colours on / off for this note (null = as in Settings); not an edit
    panic: n.panic === false ? false : null, // 1.3.27: false = the panic button leaves this note open (null = it closes it); not an edit
    // 1.4.1: reminders (src/reminders.js says what each holds; main/reminders.js keeps the clock); not an edit. Their
    // messages are secret, like the note's words: sealed with a locked note (main/crypt.js), empty while it is sealed
    reminders: REMIND.cleanAll(n.reminders),
    remindMsg: REMIND.cleanMsgs(n.remindMsg, REMIND.cleanAll(n.reminders)),
    // 1.4.10: its tags (src/tags.js); not an edit; copied by Duplicate. Secret, like its words: sealed with a locked note
    // (main/crypt.js), [] while it is sealed, and never sent to a window or the list while its lock hides it
    tags: TAGS.cleanAll(n.tags),
    groupId: typeof n.groupId === 'string' && n.groupId ? n.groupId : null,
    bounds: normalizeBounds(n.bounds),
    createdAt: Number(n.createdAt) || now,
    updatedAt: Number(n.updatedAt) || now,
    deletedAt: n.deletedAt ? Number(n.deletedAt) : null,
    restoredFrom: n.restoredFrom || null,
    // 1.1.30: a locked note as it is on disk: title, html, text, firstImage and ink sealed together (empty above
    // until the PIN opens them), and the names of its sealed photo / drawing / voice files (for the attachment sweep)
    enc: cleanEnc(n.enc),
    encAtt: n.enc ? cleanEncAtt(n.encAtt) : null,
    // 1.3.18: 2 = its sizes are read the new way (old dead sizes taken off: dropDeadSizes); null = sealed, not yet
    sizes: n.sizes === 2 || !sealed ? 2 : null,
  };
}

function localDate(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

class Store {
  constructor(root) {
    this.root = root;
    this.notesDir = path.join(root, 'notes');
    this.attDir = path.join(root, 'attachments');
    this.backupDir = path.join(root, 'backups');
    this.settingsFile = path.join(root, 'settings.json');
    this.groupsFile = path.join(root, 'groups.json');
    for (const d of [root, this.notesDir, this.attDir, this.backupDir]) fs.mkdirSync(d, { recursive: true });
    this.notes = new Map();
    this.timers = new Map();
    // 1.1.30 (main/crypt.js): sealer(note) = what is written to disk for a note (a locked note sealed),
    // opener(note from a backup) = it opened, or null if it can't be opened now. Without them notes are written as they are.
    this.sealer = null;
    this.opener = null;
    this.sealedOnDisk = new Set(); // ids whose file on disk is sealed
    this.settings = { ...DEFAULT_SETTINGS, ...(readJson(this.settingsFile) || readJson(this.settingsFile + '.bak') || {}) };
    this.settings.listSort = { ...DEFAULT_SETTINGS.listSort, ...(this.settings.listSort || {}) };
    // 1.1.15: one colour for new notes became a list to pick from. "random" meant the 7 original pastels.
    if (!Array.isArray(this.settings.defaultColors)) {
      this.settings.defaultColors = this.settings.defaultColor === 'random' ? [...OLD_RANDOM] : cleanColors([this.settings.defaultColor]);
    }
    this.settings.defaultColors = cleanColors(this.settings.defaultColors);
    this.settings.defaultColor = this.settings.defaultColors[0];
    // 1.3.27: evening times and the panic button's shortcut / last closed notes, cleaned
    this.settings.eveFrom = EVENING.cleanTime(this.settings.eveFrom, EVENING.DEFAULT_FROM);
    this.settings.eveTo = EVENING.cleanTime(this.settings.eveTo, EVENING.DEFAULT_TO);
    this.settings.panicKey = typeof this.settings.panicKey === 'string' ? this.settings.panicKey.slice(0, 60) : '';
    this.settings.panicClosed = Array.isArray(this.settings.panicClosed) ? this.settings.panicClosed.filter((x) => typeof x === 'string').slice(0, 2000) : [];
    // 1.4.1: reminders' sound and volume, cleaned
    this.settings.remindSound = cleanRemindSound(this.settings.remindSound);
    this.settings.remindVolume = cleanVolume(this.settings.remindVolume);
    this.groups = new Map();
    const g = readJson(this.groupsFile) || readJson(this.groupsFile + '.bak') || {};
    for (const x of Array.isArray(g.groups) ? g.groups : []) {
      if (x && x.id) this.groups.set(String(x.id), normalizeGroup(x));
    }
    // A broken parent link (missing group or a loop) puts the group back at the top level.
    for (const grp of this.groups.values()) {
      if (grp.parentId && (!this.groups.has(grp.parentId) || this.isInside(grp.parentId, grp.id))) grp.parentId = null;
    }
    // groups made before 1.1.6 count too
    if (this.groups.size) this.settings.madeGroup = true;
    this.load();
  }

  // ---------- loading ----------
  load() {
    const files = fs.readdirSync(this.notesDir);
    const ids = new Set();
    for (const f of files) {
      const m = f.match(/^([A-Za-z0-9-]+)\.json(\.bak|\.tmp)?$/);
      if (m) ids.add(m[1]);
    }
    for (const id of ids) {
      const base = path.join(this.notesDir, id + '.json');
      // Prefer the main file; fall back to the last good version.
      const main = readJson(base);
      const data = main || readJson(base + '.tmp') || readJson(base + '.bak');
      if (data && data.id) {
        this.notes.set(String(data.id), normalize(data));
        if (main && main.enc) this.sealedOnDisk.add(String(data.id));
        // Repair a damaged or missing main file right away.
        if (!main) { try { writeFileSafe(base, JSON.stringify(this.notes.get(String(data.id)), null, 1)); } catch { /* ignore */ } }
      }
    }
  }

  all() {
    return [...this.notes.values()];
  }

  // 1.3.18: a sealed note just opened in memory (crypt.js openAll): its sizes read the new way, as normalize does for the rest
  openedSizes(n) {
    if (n.sizes === 2) return;
    n.html = sizedHtml(n);
    n.sizes = 2;
  }

  // 1.3.29: a sealed note from before 1.3.29 just opened in memory: its layout decided as normalize does for the rest
  openedLayout(n) {
    if (n.wrapFixed === null) n.wrapFixed = !!(n.wrapWidth && !n.nowrap && n.ink && n.ink.s && n.ink.s.length);
  }

  get(id) {
    return this.notes.get(id) || null;
  }

  // ---------- saving ----------
  fileOf(id) {
    return path.join(this.notesDir, id + '.json');
  }

  diskForm(n) {
    return this.sealer ? this.sealer(n) : n;
  }

  writeNow(id) {
    const t = this.timers.get(id);
    if (t) { clearTimeout(t); this.timers.delete(id); }
    const n = this.notes.get(id);
    if (!n) return;
    const out = this.diskForm(n);
    const text = JSON.stringify(out, null, 1);
    writeFileSafe(this.fileOf(id), text);
    // 1.1.30: the first sealed save of a note would leave its plain previous version in <id>.json.bak: that copy
    // gets the sealed version too (the .bak is there to repair a damaged file, which the same version does as well)
    if (out.enc && !this.sealedOnDisk.has(id)) { try { fs.writeFileSync(this.fileOf(id) + '.bak', text); } catch { /* ignore */ } }
    if (out.enc) this.sealedOnDisk.add(id); else this.sealedOnDisk.delete(id);
  }

  save(id, delay = 250) {
    if (!this.notes.has(id)) return;
    if (delay <= 0) return this.writeNow(id);
    const old = this.timers.get(id);
    if (old) clearTimeout(old);
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      try { this.writeNow(id); } catch (e) { console.error('save failed', id, e); }
    }, delay));
  }

  flush() {
    for (const id of [...this.timers.keys()]) {
      try { this.writeNow(id); } catch (e) { console.error('flush failed', id, e); }
    }
  }

  // a colour for a new note: one of the colours picked in Settings, at random. With "never the same colour twice
  // in a row" on (and more than one colour picked), not the colour the last new note got.
  newNoteColor() {
    let list = cleanColors(this.settings.defaultColors, this.settings.defaultColor);
    if (this.settings.newColorNoRepeat !== false && list.length > 1) list = list.filter((c) => c !== this.settings.lastNewColor);
    const color = list[Math.floor(Math.random() * list.length)];
    this.settings.lastNewColor = color;
    this.saveSettings();
    return color;
  }

  create(partial = {}) {
    // a copy (or the welcome note) brings its own colour; only a really new note picks one
    const color = COLORS.includes(partial.color) ? partial.color : this.newNoteColor();
    const n = normalize({
      color,
      font: this.settings.defaultFont,
      opacity: Math.min(1, Math.max(0.25, Number(this.settings.defaultOpacity) || 1)),
      solidOnHover: this.settings.defaultSolidOnHover !== false,
      ...partial,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.notes.set(n.id, n);
    this.writeNow(n.id);
    return n;
  }

  // A new note with the same content and look as an existing one (title gets "(copy)").
  // Photos, sketches and voice notes are shared files: the attachment sweep only deletes a
  // file once no note or backup refers to it, so both notes keep working on their own.
  duplicate(id, extra = {}) {
    const src = this.notes.get(id);
    if (!src || src.deletedAt) return null;
    const keys = ['html', 'text', 'firstImage', 'ink', 'wrapWidth', 'nowrap', 'wrapFixed', 'color', 'font', 'titleFont', 'size', 'opacity', 'solidOnHover', 'spell', 'checklist', 'evening', 'panic', 'locked', 'groupId', 'fx', 'coverTitle', 'tags'];
    const copy = {};
    for (const k of keys) copy[k] = src[k] && typeof src[k] === 'object' ? JSON.parse(JSON.stringify(src[k])) : src[k];
    copy.title = src.title ? `${src.title} (copy)` : '';
    // 1.1.30: a locked note not opened with the PIN yet: the copy gets the same sealed contents, and its own lock
    if (src.enc) Object.assign(copy, { enc: { ...src.enc }, encAtt: src.encAtt ? [...src.encAtt] : null, locked: true, title: '' });
    if (copy.groupId && !this.groups.has(copy.groupId)) copy.groupId = null;
    return this.create({ ...copy, ...extra });
  }

  update(id, patch, { content = false } = {}) {
    const n = this.notes.get(id);
    if (!n) return null;
    // The drawing is checked (normalizeInk) only when it's part of the change: it can be tens of
    // thousands of numbers, and it is already clean otherwise. Typing saves stay quick that way.
    const inkChanged = 'ink' in patch;
    const merged = normalize({ ...n, ...patch, bounds: patch.bounds || n.bounds, ...(inkChanged ? {} : { ink: null }) });
    if (!inkChanged) merged.ink = n.ink;
    if (content) merged.updatedAt = Date.now();
    Object.assign(n, merged);
    this.save(id);
    return n;
  }

  trash(id) {
    const n = this.notes.get(id);
    if (!n) return;
    n.deletedAt = Date.now();
    n.open = false;
    this.writeNow(id);
  }

  restore(id) {
    const n = this.notes.get(id);
    if (!n) return;
    n.deletedAt = null;
    this.writeNow(id);
  }

  destroy(id) {
    const t = this.timers.get(id);
    if (t) { clearTimeout(t); this.timers.delete(id); }
    this.notes.delete(id);
    for (const ext of ['', '.bak', '.tmp']) {
      try { fs.unlinkSync(this.fileOf(id) + ext); } catch { /* not there */ }
    }
    this.cleanupGroups();
    // Attachments still used by another note or a backup are kept.
    this.sweepAttachments(0);
  }

  saveSettings() {
    writeFileSafe(this.settingsFile, JSON.stringify(this.settings, null, 1));
  }

  // ---------- groups (a folder tree: a note has groupId, a group has parentId) ----------
  saveGroups() {
    writeFileSafe(this.groupsFile, JSON.stringify({ groups: [...this.groups.values()] }, null, 1));
  }

  // true when group `id` is `ancestorId` itself or somewhere inside it
  isInside(id, ancestorId) {
    const seen = new Set();
    for (let cur = id; cur && !seen.has(cur); cur = this.groups.get(cur)?.parentId) {
      if (cur === ancestorId) return true;
      seen.add(cur);
    }
    return false;
  }

  // the group and all the groups above it, innermost first
  chain(groupId) {
    const out = [];
    const seen = new Set();
    for (let cur = groupId; cur && this.groups.has(cur) && !seen.has(cur); cur = this.groups.get(cur).parentId) {
      seen.add(cur);
      out.push(this.groups.get(cur));
    }
    return out;
  }

  // ids of the group and every group inside it
  subtree(groupId) {
    const ids = new Set([groupId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of this.groups.values()) {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; }
      }
    }
    return ids;
  }

  notesInTree(groupId, { includeBin = false } = {}) {
    const ids = this.subtree(groupId);
    return this.all().filter((n) => n.groupId && ids.has(n.groupId) && (includeBin || !n.deletedAt));
  }

  // the locked groups a note sits inside (innermost first)
  lockedGroupsOf(note) {
    return this.chain(note.groupId).filter((g) => g.locked);
  }

  setGroup(noteId, groupId) {
    const n = this.notes.get(noteId);
    if (!n) return;
    n.groupId = groupId && this.groups.has(groupId) ? groupId : null;
    this.writeNow(noteId);
  }

  setParent(groupId, parentId) {
    const g = this.groups.get(groupId);
    if (!g) return false;
    parentId = parentId && this.groups.has(parentId) ? parentId : null;
    if (parentId && this.isInside(parentId, groupId)) return false; // can't put a group inside itself
    g.parentId = parentId;
    this.saveGroups();
    return true;
  }

  createGroup(noteIds, { name = '', parentId = null } = {}) {
    const g = normalizeGroup({ id: crypto.randomUUID(), name, createdAt: Date.now(), parentId: parentId && this.groups.has(parentId) ? parentId : null });
    this.groups.set(g.id, g);
    this.saveGroups();
    if (!this.settings.madeGroup) { this.settings.madeGroup = true; this.saveSettings(); }
    for (const id of noteIds) this.setGroup(id, g.id);
    return g;
  }

  updateGroup(id, patch = {}) {
    const g = this.groups.get(id);
    if (!g) return null;
    Object.assign(g, normalizeGroup({ ...g, ...patch, id: g.id, parentId: g.parentId, createdAt: g.createdAt }));
    this.saveGroups();
    return g;
  }

  renameGroup(id, name) {
    return this.updateGroup(id, { name });
  }

  // Ungroup: everything inside moves up one level, then the group is removed.
  dissolveGroup(id) {
    const g = this.groups.get(id);
    if (!g) return;
    for (const n of this.notes.values()) if (n.groupId === id) this.setGroup(n.id, g.parentId);
    for (const c of this.groups.values()) if (c.parentId === id) c.parentId = g.parentId;
    this.groups.delete(id);
    this.saveGroups();
    this.cleanupGroups();
  }

  // 1.4.9: a group a move took away (emptied: cleanupGroups, or Ungroup) comes back as it was, with its own id, so Undo
  // can put things back into it (main/move-history.js). Its parent must still exist, or it goes to the top level.
  restoreGroup(copy) {
    if (!copy || !copy.id || this.groups.has(String(copy.id))) return this.groups.get(String(copy.id)) || null;
    const g = normalizeGroup(copy);
    if (g.parentId && !this.groups.has(g.parentId)) g.parentId = null;
    this.groups.set(g.id, g);
    this.saveGroups();
    return g;
  }

  // A group disappears once nothing inside it (not even a note in the bin) is left.
  cleanupGroups() {
    const used = new Set();
    for (const n of this.notes.values()) {
      for (const g of this.chain(n.groupId)) used.add(g.id);
    }
    let changed = false;
    for (const id of [...this.groups.keys()]) {
      if (!used.has(id)) { this.groups.delete(id); changed = true; }
    }
    if (changed) this.saveGroups();
  }

  // ---------- attachments ----------
  newAttachmentName(ext) {
    ext = String(ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext === 'jpeg') ext = 'jpg';
    return `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  }

  saveAttachment(buffer, ext) {
    const name = this.newAttachmentName(ext);
    if (!ATT_NAME.test(name)) throw new Error('Unsupported file type');
    const file = path.join(this.attDir, name);
    writeFileSafe(file, buffer);
    try { fs.unlinkSync(file + '.bak'); } catch { /* none */ }
    return ATT_PREFIX + name;
  }

  importFile(src) {
    const ext = path.extname(src).slice(1);
    return this.saveAttachment(fs.readFileSync(src), ext);
  }

  attachmentPath(name) {
    name = path.basename(String(name || ''));
    if (!ATT_NAME.test(name)) return null;
    return path.join(this.attDir, name);
  }

  attachmentPathFromUrl(url) {
    if (typeof url !== 'string' || !url.startsWith(ATT_PREFIX)) return null;
    return this.attachmentPath(decodeURIComponent(url.slice(ATT_PREFIX.length)));
  }

  referencedAttachments() {
    const used = new Set();
    // a sealed (locked) note lists its files in encAtt (1.1.30): its html can't be read
    const scan = (n) => {
      if (!n) return;
      if (typeof n.html === 'string') for (const m of n.html.matchAll(ATT_REF)) used.add(m[1]);
      if (Array.isArray(n.encAtt)) for (const x of n.encAtt) if (typeof x === 'string') used.add(x);
    };
    for (const n of this.notes.values()) scan(n);
    for (const b of this.listBackups()) {
      const dir = path.join(this.backupDir, b.name);
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.json') && f !== 'meta.json' && f !== 'groups.json') scan(readJson(path.join(dir, f)));
      }
    }
    return used;
  }

  // Remove files nothing points at any more. Fresh files are left alone so an
  // image that was just added (and not yet saved into a note) is never lost.
  sweepAttachments(minAgeMs = 2 * 24 * 3600e3) {
    let used;
    try { used = this.referencedAttachments(); } catch { return; }
    const now = Date.now();
    const files = fs.readdirSync(this.attDir);
    // 1.2.4: a recording being made or not yet in its note (<stem>.rec.json next to it, main/recordings.js) is kept
    const recording = new Set(files.filter((f) => f.endsWith('.rec.json')).map((f) => f.split('.')[0]));
    for (const f of files) {
      if (used.has(f) || recording.has(f.split('.')[0])) continue;
      const p = path.join(this.attDir, f);
      try {
        const age = now - fs.statSync(p).mtimeMs;
        if (age > Math.max(minAgeMs, 60e3)) fs.unlinkSync(p);
      } catch { /* ignore */ }
    }
  }

  // ---------- backups ----------
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name))
      .map((d) => {
        const meta = readJson(path.join(this.backupDir, d.name, 'meta.json')) || {};
        return { name: d.name, created: meta.created || null, count: meta.count ?? null };
      })
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  }

  backupNow(name) {
    this.flush();
    let dirName = name || `${localDate()}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}`;
    if (fs.existsSync(path.join(this.backupDir, dirName))) dirName += '_' + Date.now().toString(36);
    const tmpDir = path.join(this.backupDir, '.partial-' + dirName);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    let count = 0;
    for (const n of this.notes.values()) {
      fs.writeFileSync(path.join(tmpDir, n.id + '.json'), JSON.stringify(this.diskForm(n)));
      count++;
    }
    fs.writeFileSync(path.join(tmpDir, 'groups.json'), JSON.stringify({ groups: [...this.groups.values()] }));
    fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify({ created: Date.now(), count }));
    fs.renameSync(tmpDir, path.join(this.backupDir, dirName));
    this.pruneBackups();
    return dirName;
  }

  backupIfNeeded() {
    try {
      const today = localDate();
      const exists = this.listBackups().some((b) => b.name.startsWith(today));
      if (!exists && this.notes.size > 0) this.backupNow(today);
    } catch (e) {
      console.error('backup failed', e);
    }
  }

  pruneBackups() {
    const all = this.listBackups();
    for (const b of all.slice(KEEP_BACKUPS)) {
      fs.rmSync(path.join(this.backupDir, b.name), { recursive: true, force: true });
    }
    for (const f of fs.readdirSync(this.backupDir)) {
      if (f.startsWith('.partial-')) fs.rmSync(path.join(this.backupDir, f), { recursive: true, force: true });
    }
    this.sweepAttachments();
  }

  // Never overwrites anything: notes from the backup that differ from what you
  // have now come back as extra (closed) notes.
  // Brings back the notes of one backup, never overwriting anything. Everything that comes back
  // goes into a new group "Restored Notes from Thursday, 22 Oct 2026" at the top level.
  restoreBackup(name) {
    const dir = path.join(this.backupDir, path.basename(name));
    if (!fs.existsSync(dir)) return 0;
    let restored = 0;
    const ids = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json') || f === 'meta.json' || f === 'groups.json') continue;
      const raw = readJson(path.join(dir, f));
      if (!raw || !raw.id) continue;
      // 1.1.30: a sealed (locked) note is opened if the PIN was typed; otherwise it comes back sealed
      const opened = raw.enc && this.opener ? this.opener(raw) : null;
      const b = opened || raw;
      const cur = this.notes.get(String(b.id));
      const same = cur && (b.enc ? !!cur.enc && cur.enc.c === b.enc.c : !cur.enc && cur.html === sizedHtml(b)); // 1.3.18: as it reads now
      if (same) {
        if (cur.deletedAt && !b.deletedAt) { this.restore(cur.id); ids.push(cur.id); restored++; }
        continue;
      }
      if (b.deletedAt) continue;
      // a note that was locked when backed up stays locked (its group's lock doesn't come along into "Restored Notes")
      // 1.4.1: without its reminders (the note itself still has them: they would go off twice)
      const copy = normalize({ ...b, id: crypto.randomUUID(), open: false, restoredFrom: name, deletedAt: null, reminders: [], ...(raw.enc ? { locked: true } : {}) });
      if (copy.groupId && !this.groups.has(copy.groupId)) copy.groupId = null;
      this.notes.set(copy.id, copy);
      this.writeNow(copy.id);
      ids.push(copy.id);
      restored++;
    }
    if (ids.length) {
      this.createGroup(ids, { name: `Restored Notes from ${backupDayName(name)}` });
      this.cleanupGroups();
    }
    return restored;
  }
}

// "2026-10-22" or "2026-10-22_14-30-00" → "Thursday, 22 Oct 2026"
function backupDayName(name) {
  const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(name);
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = { cleanPinApps, cleanRemindSound, cleanVolume, FONTS, CHECK_OPTS, OVERRIDE_KEYS, overrideCounts, resetPatch, cleanChecklist, checklistMarks, cardRuns, CARD_TAGS, CARD_RUN_KEYS, CARD_SIZE, FONT_PX, dropDeadSizes, pictureWords, picturePlace, lineCount, backupDayName, normalizeInk, Store, COLORS, DARK_COLORS, cleanColors, FX_EFFECTS, FX_FOLLOWERS, FX_AMOUNTS, cleanFx, cleanFxOpacity, GROUP_STYLES, GROUP_COLORS, normalize, localDate, ATT_PREFIX };
