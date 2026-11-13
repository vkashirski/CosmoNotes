'use strict';
// Evening colours (1.3.27): the times and the 30-minute fade (src/evening.js under Node), every light paper's evening shade
// (dimmer, dark text still reads, its day colour = main's PAPER), the dark papers left alone, the styles; in main: off by
// default, only times of day kept, what the note windows are told (settings, the phase), their background colour, a note's
// own choice (on or off whatever Settings says), the list's cards, Duplicate copies the choice.
const assert = require('assert');
const EV = require('../src/evening');
const { PAPER } = require('../main/constants');
const { COLORS, DARK_COLORS } = require('../store');
const app = require('./helpers/app');

// ---- the fade: evening from 19:00, day from 07:00, 30 minutes each way
const at = (h, m = 0, s = 0) => new Date(2026, 10, 8, h, m, s);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg} (${a} ≈ ${b})`);
assert.equal(EV.phase(at(12), 1140, 420), 0, 'midday: day colours');
assert.equal(EV.phase(at(19), 1140, 420), 0, 'it starts to change at the evening time');
near(EV.phase(at(19, 15), 1140, 420), 0.5, 'half way 15 minutes later');
assert.equal(EV.phase(at(19, 30), 1140, 420), 1, 'all evening after 30 minutes');
assert.equal(EV.phase(at(2), 1140, 420), 1, 'all night, across midnight');
assert.equal(EV.phase(at(7), 1140, 420), 1, 'the day starts at the day time…');
near(EV.phase(at(7, 10), 1140, 420), 2 / 3, '… fading back…');
assert.equal(EV.phase(at(7, 30), 1140, 420), 0, '… and is all day 30 minutes later');
assert.equal(EV.phase(at(14, 30), 13 * 60, 16 * 60), 1, 'an evening that does not cross midnight');
assert.equal(EV.phase(at(12), 13 * 60, 16 * 60), 0);
assert.equal(EV.phase(at(20), 600, 600), 0, 'the same time twice: never evening');
assert.equal(EV.phase(at(20), 'x', null), 1, 'bad times: 19:00 and 07:00');
assert.equal(EV.phase(at(12)), 0, 'no times: 19:00 and 07:00');
assert.equal(EV.cleanTime(1439, 5), 1439); assert.equal(EV.cleanTime(1440, 5), 5); assert.equal(EV.cleanTime(-1, 5), 5);
assert.equal(EV.cleanTime(1.5, 5), 5); assert.equal(EV.cleanTime('60', 5), 60); assert.equal(EV.cleanTime(true, 5), 5); assert.equal(EV.cleanTime('', 5), 5);

// ---- each light paper has its own evening shade (not just a darker tint: a name and colours of its own); dark ones none
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const names = new Set();
for (const c of COLORS) {
  const p = EV.PALETTE[c];
  if (DARK_COLORS.includes(c)) { assert.ok(!p, `${c} stays as it is in the evening`); continue; }
  assert.ok(p, `${c} has an evening shade`);
  assert.equal(p.day, PAPER[c], `${c}: its day colour is main's`);
  for (const k of EV.KEYS) assert.ok(typeof p[k] === 'string' && p[k], `${c}: ${k}`);
  assert.ok(p.name && !names.has(p.name), `${c}: a name of its own (${p.name})`); names.add(p.name);
  assert.ok(lum(p.paper) < lum(p.day) * 0.7, `${c}: clearly dimmer in the evening`);
  const contrast = (lum(p.paper) + 0.05) / (lum(p.ink) + 0.05);
  assert.ok(contrast >= 7, `${c}: dark text reads on it (contrast ${contrast.toFixed(1)})`);
}
assert.deepEqual(Object.keys(EV.PALETTE).sort(), COLORS.filter((c) => !DARK_COLORS.includes(c)).sort(), 'only paper colours');
const css = EV.css('body');
assert.ok(css.includes('body[data-color="yellow"]{--e-paper:#E0C674;') && css.includes('--e-cink:'), 'the styles give each paper its evening parts');
assert.ok(!css.includes('charcoal') && !css.includes('--e-day') && !css.includes('--e-name'), 'nothing for the dark papers, only colours');
assert.equal(EV.mixHex('#000000', '#FFFFFF', 0.5), '#808080'); assert.equal(EV.mixHex('#102030', '#FFFFFF', 0), '#102030'); assert.equal(EV.mixHex('#102030', '#405060', 3), '#405060');

(async () => {
  const { H, ev } = await app.start();
  const s = async () => (await app.list()).settings;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const from = (d) => (((mins + d) % 1440) + 1440) % 1440; // a time `d` minutes from now
  const w = app.noteWins()[0]; // the welcome note (yellow)
  const id = w.noteId;

  // ---- off by default, 19:00 to 07:00; only times of day are kept
  let st = await s();
  assert.equal(st.eveOn, false, 'off by default');
  assert.deepEqual([st.eveFrom, st.eveTo], [1140, 420], '19:00 and 07:00');
  await H['settings:set'](null, { eveFrom: 2000, eveTo: 'x' });
  st = await s();
  assert.deepEqual([st.eveFrom, st.eveTo], [1140, 420], 'not a time of day: ignored');
  assert.equal((await app.card(id)).eve, false, 'a card has no evening colours while it is off');

  // ---- on, and now is in the evening (from an hour ago until in two hours)
  w.webContents.sentArgs = [];
  await H['settings:set'](null, { eveOn: true, eveFrom: from(-60), eveTo: from(120) });
  assert.equal(app.readJSON('settings.json').eveOn, true, 'saved');
  const told = app.sent(w, 'settings:changed').pop();
  assert.ok(told && told.eveOn === true && told.evePhase === 1, 'open notes are told: on, all evening');
  assert.equal(app.sent(w, 'note:evening').pop(), 1, 'and the phase straight away');
  assert.equal(w.bg, EV.PALETTE.yellow.paper, 'its window background is the evening shade');
  assert.equal((await app.card(id)).eve, true, 'its card takes the evening colours');
  assert.equal((await s()).evePhase, 1, 'the list knows the phase');
  assert.equal((await H['note:get'](ev(w))).settings.evePhase, 1, 'a window opening now gets it too');

  // ---- a note's own choice: off on this note
  await H['note:update'](ev(w), { evening: false });
  assert.equal((await H['note:get'](ev(w))).evening, false, 'saved on the note');
  assert.equal((await app.card(id)).eve, false, 'its card stays in day colours');
  assert.equal(w.bg, PAPER.yellow, 'and its window');
  // Settings off, the note's own on
  await H['note:update'](ev(w), { evening: true });
  await H['settings:set'](null, { eveOn: false });
  assert.equal((await app.card(id)).eve, true, 'a note can have evening colours while Settings has them off');
  assert.equal(w.bg, EV.PALETTE.yellow.paper);
  await H['note:update'](ev(w), { evening: null });
  assert.equal((await app.card(id)).eve, false, 'null: as in Settings again');
  assert.equal(app.readJSON(`notes/${id}.json`).evening, null);
  await H['settings:set'](null, { eveOn: true });

  // ---- 15 minutes into the evening: half way; before the evening: day
  await H['settings:set'](null, { eveFrom: from(-15), eveTo: from(120) });
  const half = (await s()).evePhase;
  assert.ok(half >= 0.45 && half <= 0.55, `half way (${half})`);
  assert.ok(w.bg !== PAPER.yellow && w.bg !== EV.PALETTE.yellow.paper, `the background is in between (${w.bg})`);
  await H['settings:set'](null, { eveFrom: from(60), eveTo: from(120) });
  assert.equal((await s()).evePhase, 0, 'before the evening: day');
  assert.equal(w.bg, PAPER.yellow);

  // ---- a dark paper keeps its colour
  await H['settings:set'](null, { eveFrom: from(-60), eveTo: from(120) });
  await H['note:update'](ev(w), { color: 'charcoal' });
  assert.equal(w.bg, PAPER.charcoal, 'charcoal stays charcoal in the evening');

  // ---- Duplicate copies the note's own choice
  await H['note:update'](ev(w), { color: 'mint', evening: false });
  const before = new Set((await app.list()).notes.map((n) => n.id));
  await H['note:duplicate'](ev(w));
  const copy = (await app.list()).notes.find((n) => !before.has(n.id));
  assert.equal(copy.evening, false, 'the copy keeps evening colours off');
  await app.quit();
})();
