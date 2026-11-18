'use strict';
// store.js on its own (no main process): saving and loading notes, crash recovery from the .bak copy, backups (once a
// day, restore into a "Restored Notes from …" group, pruning), attachments that a backup still uses, and the small
// helpers that clean or read a note: normalize (1.3.19: its checklist options), normalizeInk, checklistMarks, cardRuns (1.3.11: the look of a card's lines, and
// that it knows every kind of formatting the editor keeps), pictureWords, picturePlace, lineCount, dropDeadSizes (1.3.18:
// old sizes that showed nothing come off once, `sizes`). 1.3.27: a note's evening / panic choice and the settings for them,
// cleaned on load; which settings a note has its own value of (overrideCounts) and the patch that puts Settings back (resetPatch).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const store = require('../store.js');
const { Store } = store;

const dir = process.env.FAKE_DATA || fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-store-'));

// ---- saving and loading
let s = new Store(dir);
const a = s.create({ html: '<b>hello</b>', text: 'hello', open: true, bounds: { x: 10, y: 20, width: 300, height: 280 } });
const att = s.saveAttachment(Buffer.from('PNGDATA'), 'png');
const b = s.create({ html: `<img src="${att}">`, text: '', open: false });
s.update(a.id, { html: '<b>hello world</b>', text: 'hello world', opacity: 0.1, color: 'nope' }, { content: true });
s.flush();
s = new Store(dir);
const a2 = s.get(a.id);
assert.equal(a2.html, '<b>hello world</b>');
assert.equal(a2.opacity, 0.25, 'opacity clamped');
assert.equal(a2.color, 'yellow', 'bad colour falls back');
assert.deepEqual(a2.bounds, { x: 10, y: 20, width: 300, height: 280 });
assert.ok(fs.existsSync(s.attachmentPathFromUrl(att)));
assert.equal(s.attachmentPathFromUrl('stickyfile://att/../../etc/passwd'), null, 'no path tricks');

// ---- a broken file: the previous version comes back from .bak
fs.writeFileSync(path.join(dir, 'notes', a.id + '.json'), '{broken');
s = new Store(dir);
assert.equal(s.get(a.id).html, '<b>hello</b>', 'recovered previous version from .bak');

// ---- backups and restoring one
s.update(a.id, { html: 'v3', text: 'v3' }, { content: true }); s.flush();
s.groups.set('g1', { id: 'g1', name: 'Work', parentId: null }); s.saveGroups();
s.backupIfNeeded();
assert.equal(s.listBackups().length, 1);
assert.ok(fs.existsSync(path.join(dir, 'backups', s.listBackups()[0].name, 'groups.json')), 'a backup has the groups too');
s.backupIfNeeded();
assert.equal(s.listBackups().length, 1, 'only one automatic backup per day');
s.update(a.id, { html: 'v4' }, { content: true }); s.flush();
const restored = s.restoreBackup(s.listBackups()[0].name);
assert.equal(restored, 1, 'a changed note comes back as an extra copy');
assert.equal(s.all().length, 3);
// 1.1.10: what comes back sits in a group named after the backup's day (the backup's own groups.json is not restored)
const rg = [...s.groups.values()].find((g) => /^Restored Notes from \w+day, \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(g.name));
assert.ok(rg, 'restored notes are grouped: ' + [...s.groups.values()].map((g) => g.name).join(' | '));
assert.equal(s.all().filter((n) => n.groupId === rg.id).length, 1);
assert.equal(store.backupDayName('2026-10-22_14-30-00'), 'Thursday, 22 Oct 2026');

// ---- the Bin and attachments: a photo stays while a backup uses it
s.trash(b.id); assert.ok(s.get(b.id).deletedAt);
s.destroy(b.id);
assert.ok(fs.existsSync(s.attachmentPathFromUrl(att)), 'attachment kept while a backup uses it');

// ---- pruning: 30 backups are kept
for (let i = 1; i <= 35; i++) fs.mkdirSync(path.join(dir, 'backups', `2020-01-${String(i).padStart(2, '0')}`), { recursive: true });
s.pruneBackups();
assert.equal(s.listBackups().length, 30);

// ---- normalize: a note's fields as saved
assert.equal(store.normalize({ id: 'a', wrapWidth: 300, nowrap: true }).nowrap, true, '1.1.45: word wrap off is kept');
assert.equal(store.normalize({ id: 'a', wrapWidth: 300 }).nowrap, false, 'older notes: false');
// 1.3.29: word wrap's locked width (wrapFixed) is saved, not worked out from the drawing
{
  const INK = { s: [{ t: 'pen', c: '#000000', w: 3, p: [1, 1, 9, 9] }] };
  const N = (x) => store.normalize({ id: 'a', ...x }).wrapFixed;
  assert.equal(N({ wrapWidth: 300, ink: INK }), true, 'a note from before with a drawing: locked, as it showed');
  assert.equal(N({ wrapWidth: 300 }), false, 'a note from before without one: no limit, as it showed');
  assert.equal(N({ wrapWidth: 300, nowrap: true, ink: INK }), false, 'no limit with a drawing stays no limit');
  assert.equal(N({ wrapWidth: 300, wrapFixed: true }), true, 'the drawing erased: still locked (it used to un-wrap everything)');
  assert.equal(N({ wrapWidth: 300, wrapFixed: false, ink: INK }), false, 'saved, so the drawing decides nothing');
  assert.equal(N({ wrapFixed: true }), false, 'word wrap on: nothing locked');
  const sealedOld = store.normalize({ id: 's', wrapWidth: 300, html: '', enc: { v: 2, k: 'a', n: 'b', t: 'c', c: 'd' } });
  assert.equal(sealedOld.wrapFixed, null, 'a sealed note from before: decided when it is opened');
  assert.ok(/S\.store\.openedLayout\(n\)/.test(fs.readFileSync(path.join(__dirname, '..', 'main', 'crypt.js'), 'utf8')), 'openAll decides it');
  const opened = { ...sealedOld, ink: INK };
  Store.prototype.openedLayout.call(null, opened);
  assert.equal(opened.wrapFixed, true, 'openedLayout: with a drawing, locked');
  // a save that leaves the drawing out (typing) keeps it
  const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-wrap-'));
  const s3 = new Store(d3);
  const n3 = s3.create({ html: '<p>a</p>', ink: INK });
  s3.update(n3.id, { wrapWidth: 300, wrapFixed: true });
  s3.update(n3.id, { ink: null });
  s3.update(n3.id, { html: '<p>ab</p>' }, { content: true });
  assert.equal(s3.get(n3.id).wrapFixed, true, 'the drawing removed and typing after: still locked');
  assert.equal(s3.duplicate(n3.id).wrapFixed, true, 'Duplicate keeps it');
  s3.flush();
}
for (const f of ['hand', 'round', 'medieval']) assert.equal(store.normalize({ id: 'a', font: f }).font, f, `the ${f} font is kept`);
assert.equal(store.normalize({ id: 'a', font: 'comic' }).font, 'hand', 'an unknown font: Handwritten');
assert.equal(store.normalize({ id: 'a', titleFont: 'medieval' }).titleFont, 'medieval', '1.3.3: the title font is kept');
// 1.3.19: a note's own checklist options: true / false kept, anything else = as in Settings (null)
assert.deepEqual(store.normalize({ id: 'a' }).checklist, { drag: null, sink: null, fixed: null }, 'older notes follow Settings');
assert.deepEqual(store.normalize({ id: 'a', checklist: { drag: false, sink: true, fixed: 'yes', junk: 1 } }).checklist, { drag: false, sink: true, fixed: null }, 'only true / false are kept');
assert.deepEqual(store.normalize({ id: 'a', checklist: 'x' }).checklist, { drag: null, sink: null, fixed: null });
assert.equal(store.normalize({ id: 'a', titleFont: 'comic' }).titleFont, null, 'no or an unknown title font: the note\'s font');

// ---- normalizeInk: drawings are cleaned, never thinned out
assert.equal(store.normalizeInk(null), null);
assert.equal(store.normalizeInk({ s: [] }), null);
const clean = store.normalizeInk({ s: [
  { t: 'pen', c: '#E5484D', w: 4, l: 'a', p: [1.234, 2, 3, 4] },
  { t: 'rect', c: 'red', w: 99, l: 'zz', p: [0, 0, 10, 10] },
  { t: 'nope', p: [0, 0] },
  { t: 'pen', p: [1, 2, 3] },
  { t: 'line', p: [0, 0, NaN, 1] },
] });
assert.equal(clean.s.length, 2, 'unknown tools, odd point lists and NaN are dropped');
assert.deepEqual(clean.s[0].p, [1.2, 2, 3, 4], 'points rounded to 0.1');
assert.equal(clean.s[1].c, '#2B2B2B'); assert.equal(clean.s[1].w, 40); assert.equal(clean.s[1].l, 'a', 'bad colour, width and layer fall back');

// ---- checklistMarks: the boxes a card draws, one letter per shown line (. no box, o open, x ticked)
const html = '<div>Shopping</div><ul class="checklist"><li>Milk &amp; eggs</li><li class="done"><b>Bread</b> rolls</li><li>Fruit<ul><li class="done">apples</li><li>pears<br>green</li></ul></li></ul><ul><li>plain</li></ul><div><br></div><div>end</div>';
assert.equal(store.checklistMarks(html, 'Shopping\nMilk & eggs\nBread rolls\nFruit\napples\npears\ngreen\nplain\n\nend'), '.oxoxo...');
assert.equal(store.checklistMarks('<p>no lists</p>', 'no lists'), '');
assert.equal(store.checklistMarks('<ul class="checklist"><li><br></li></ul>', ''), '');
assert.equal(store.checklistMarks('<ul class="checklist"><li>a&nbsp; b</li></ul>', 'a  b'), 'o');
assert.equal(store.checklistMarks(null, 'x'), '');

// ---- cardRuns (1.3.11): each shown line's look, so a card shows the words as the note does (null = plain)
{
  const R = store.cardRuns;
  const h1 = '<div><font face="Nunito">Rounded <b>bold</b> line</font></div><div>plain</div><div><br></div>'
    + '<div><span style="background-color: rgb(255, 231, 76);">lit</span> &amp; <font color="#D93B3B" size="5">red</font></div>'
    + '<ul class="checklist"><li class="done"><i>milk</i></li></ul><div><font face="Augusta" color="#010203">reset colour</font></div>'
    + '<div><span class="voice" contenteditable="false" data-src="stickyfile://att/r.webm"><span class="v-play"></span><span class="v-bars"><i class="h1"></i></span><span class="v-time">0:03</span></span>&nbsp;<u>after</u></div>';
  const t1 = 'Rounded bold line\nplain\n\nlit & red\nmilk\nreset colour\n0:03 after';
  assert.deepEqual(R(h1, t1), [
    [{ t: 'Rounded ', f: 'round' }, { t: 'bold', f: 'round', b: 1 }, { t: ' line', f: 'round' }],
    null,
    [{ t: 'lit', bg: 'rgb(255, 231, 76)' }, { t: ' & ' }, { t: 'red', c: '#D93B3B', k: 1.45 }],
    [{ t: 'milk', i: 1 }],
    [{ t: 'reset colour', f: 'medieval' }],
    [{ t: '0:03 ' }, { t: 'after', u: 1 }],
  ], 'fonts, bold, highlight, colour, size, italic; "Normal" colour = none; a voice note line');
  assert.equal(R('<div>just words</div><div>more</div>', 'just words\nmore'), null, 'no formatting: null (the card shows plain text, as before)');
  assert.equal(R('<div><b>a</b></div>', 'something else'), null, 'a line that doesn\'t match: plain');
  assert.deepEqual(R('<table><tr><th>Day</th><td><s>gym</s></td></tr></table><h2>Head</h2><pre>x=1</pre><p><a href="https://x.y">link</a> <sup>2</sup></p>', 'Day\tgym\nHead\nx=1\nlink 2'),
    [[{ t: 'Day', b: 1 }, { t: ' ' }, { t: 'gym', s: 1 }], [{ t: 'Head', h: 1, k: 1.2 }], [{ t: 'x=1', code: 1, k: 0.8 }], [{ t: 'link', a: 1 }, { t: ' ' }, { t: '2', sup: 1, k: 0.833 }]], 'tables, headings, code, links, sup');
  assert.deepEqual(R('<div><font color="red" face="Comic Sans" size="9"><span style="color: expression(x); background-color: url(x)">x</span></font><b>y</b></div>', 'xy'), [[{ t: 'x' }, { t: 'y', b: 1 }]], 'only the app\'s fonts, #hex / rgb() colours and sizes 1–7');
  assert.equal(R(null, 'x'), null);
  // every tag the editor keeps (src/note/content.js ALLOWED and RICH) is known to cardRuns: a look, a line or nothing to show.
  // A new kind of formatting in the note fails here until the cards know it (the owner: "so similar bugs don't show up").
  const src = (f) => fs.readFileSync(path.join(__dirname, '..', ...f.split('/')), 'utf8');
  const content = src('src/note/content.js');
  const tagsOf = (name) => Object.keys(new Function(`return ${new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`).exec(content)[1]}`)());
  for (const tag of [...tagsOf('ALLOWED'), ...tagsOf('RICH')]) assert.ok(store.CARD_TAGS[tag], `cardRuns knows <${tag.toLowerCase()}> (store.js CARD_TAGS)`);
  assert.deepEqual(tagsOf('RICH').sort(), ['FONT', 'LI', 'SPAN', 'UL'], 'RICH changed: teach cardLook (store.js) the new attributes, then update this list');
  // the card draws every look cardRuns makes (src/list/cards.js runCss), with the note's sizes and fonts
  const cards = src('src/list/cards.js');
  const css = /const runCss = \{([\s\S]*?)\n  \};/.exec(cards)[1];
  for (const k of store.CARD_RUN_KEYS) assert.ok(new RegExp(`\\n\\s*${k}: `).test(css), `the card draws "${k}" (cards.js runCss)`);
  const sizes = Object.fromEntries([...src('src/css/note-text.css').matchAll(/font\[size="(\d)"\] \{ font-size: ([.\d]+)em; \}/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(Object.fromEntries(Object.entries(store.CARD_SIZE).map(([k, v]) => [k, v])), sizes, 'store.js CARD_SIZE = the note\'s (note-text.css font[size])');
  const face = /const FACE = (\{[^}]*\})/.exec(src('src/note/panels.js'))[1];
  // 1.4.12: a font changes no size, in the note (font-size-adjust) or on its card: the card's text matches the letters too
  assert.ok(!('CARD_FACE_SIZE' in store), 'no per-font resize on the cards any more');
  const cardCss = src('src/css/list-cards.css') + src('src/css/list-base.css');
  for (const f of ['hand', 'round', 'medieval']) {
    assert.ok(new RegExp(`\\.card\\[data-font="${f}"\\] \\.txt \\{ font: 400 12\\.5px/1\\.4 var\\(--\\w+\\); font-size-adjust: \\.484; \\}`).test(cardCss), `${f} cards: one size, the letters matched`);
    assert.ok(new RegExp(`\\.sheet\\[data-font="${f}"\\] \\.txt \\{ font: 400 11\\.5px/1\\.35 var\\(--\\w+\\); font-size-adjust: \\.484; \\}`).test(cardCss), `${f} stack sheets: one size, the letters matched`);
  }
  assert.ok(!/\.cards\.size-\w+ \.(card|sheet)\[data-font/.test(src('src/css/list-groups-menus.css')), 'card sizes: one text size per card size, every font');
  assert.deepEqual(store.FONT_PX, Object.fromEntries([...src('src/css/note-base.css').matchAll(/body\[data-size="(\w)"\] \{ --fs: ([.\d]+)px; \}/g)].map((m) => [m[1], Number(m[2])])), 'store.js FONT_PX = note-base.css --fs');
  assert.ok(/#editor h1, #editor h2, #editor h3, #editor h4 \{ font-size: 1\.2em;/.test(src('src/css/note-text.css')) && /#editor code, #editor pre \{[^}]*font-size: \.8em;/.test(src('src/css/note-text.css')), 'headings 1.2, code .8 (store.js CARD_TAG_SIZE)');
  for (const [id, name] of Object.entries(new Function(`return ${face}`)())) assert.deepEqual(R(`<div><font face="${name}">x</font></div>`, 'x'), [[{ t: 'x', f: id }]], `the note font ${name} on a card: no resize`);
  // sizes as the note's CSS works them out: sizes multiply, a font changes none (1.4.12)
  assert.deepEqual(R('<div><font face="Nunito"><font face="Caveat">x</font></font></div>', 'x'), [[{ t: 'x', f: 'hand' }]], 'a font inside another: the innermost, no size');
  assert.deepEqual(R('<div><font face="Nunito" size="5">x</font></div>', 'x'), [[{ t: 'x', f: 'round', k: 1.45 }]], 'size and font on one tag: the size only');
  assert.deepEqual(R('<div><font size="4"><font face="Augusta">x</font></font></div>', 'x'), [[{ t: 'x', f: 'medieval', k: 1.2 }]], 'size 4 around a face: 1.2');
  assert.deepEqual(R('<div><font face="Augusta"><font size="4">x</font></font></div>', 'x'), [[{ t: 'x', f: 'medieval', k: 1.2 }]], 'and inside it: the same');
}

// ---- 1.3.18: sizes that showed nothing before (on the tag of an app font other than the note's) come off once
{
  const D = store.dropDeadSizes;
  assert.equal(D('<font face="Nunito" size="5">a</font><font size="5">b</font><font face="Augusta" size="5">c</font><font size="4" face="Caveat" color="#fff">d</font>', 'medieval'),
    '<font face="Nunito">a</font><font size="5">b</font><font face="Augusta" size="5">c</font><font face="Caveat" color="#fff">d</font>', 'only on other app fonts\' tags');
  assert.equal(D('<font face="Arial" size="5">x</font>', 'hand'), '<font face="Arial" size="5">x</font>', 'not an app font: its size showed');
  const old = { id: 'o', font: 'medieval', html: '<font face="Nunito" size="5">a</font>' };
  const n1 = store.normalize(old);
  assert.ok(n1.html === '<font face="Nunito">a</font>' && n1.sizes === 2, 'an old note is cleaned when read, and marked');
  assert.equal(store.normalize({ ...n1, html: '<font face="Nunito" size="5">a</font>' }).html, '<font face="Nunito" size="5">a</font>', 'once marked, a size picked later stays');
  const sealedOld = store.normalize({ id: 's', font: 'medieval', html: '', enc: { v: 2, k: 'a', n: 'b', t: 'c', c: 'd' } });
  assert.equal(sealedOld.sizes, null, 'a sealed old note: cleaned when it is opened (crypt.js openAll → openedSizes)');
  assert.equal(store.normalize({ id: 'new', font: 'hand' }).sizes, 2, 'a new note reads the new way');
  assert.ok(/S\.store\.openedSizes\(n\)/.test(fs.readFileSync(path.join(__dirname, '..', 'main', 'crypt.js'), 'utf8')), 'openAll cleans what it opens');
  const opened = { font: 'medieval', html: '<font face="Nunito" size="5">a</font>' };
  Store.prototype.openedSizes.call(null, opened);
  assert.ok(opened.html === '<font face="Nunito">a</font>' && opened.sizes === 2, 'openedSizes');
  // a backup from before: the same note with its old size is not "changed" (no extra copy when restoring)
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-sizes-'));
  const s2 = new Store(d2);
  const n2 = s2.create({ font: 'medieval', html: '<font face="Nunito">a</font>', text: 'a' }); s2.flush(); s2.backupIfNeeded();
  const bf = path.join(d2, 'backups', s2.listBackups()[0].name, n2.id + '.json');
  const bk = JSON.parse(fs.readFileSync(bf, 'utf8')); delete bk.sizes; bk.html = '<font face="Nunito" size="5">a</font>';
  fs.writeFileSync(bf, JSON.stringify(bk));
  assert.equal(s2.restoreBackup(s2.listBackups()[0].name), 0, 'an old backup of the same note: nothing to restore');
  fs.rmSync(d2, { recursive: true, force: true });
}

// ---- pictureWords: picture descriptions, for the list's search
assert.equal(store.pictureWords('<div>x<img class="att-img" src="a" alt="Plumber &amp; receipt" title="t"><img src="b"><img alt="" src="c"></div>'), 'Plumber & receipt');
assert.equal(store.pictureWords('<p>none</p>'), ''); assert.equal(store.pictureWords(null), '');

// ---- picturePlace / lineCount: where a card shows the first picture, and how many lines a note has
const ph = '<ul class="checklist"><li class="done">one</li><li class="done">two &amp; three</li></ul><div><img class="att-img" width="110" src="stickyfile://att/a.png"></div><div>after</div>';
assert.deepEqual(store.picturePlace({ html: ph, text: 'one\ntwo & three\n\nafter', font: 'hand', size: 'm', bounds: { width: 400 } }),
  { at: 2, px: 110, pct: null, d: false, fs: 15.5, tw: 368 }, 'two lines before it, 110 px wide, the text size (one for every font, 1.4.12)');
assert.equal(store.lineCount('one\ntwo & three\n\nafter'), 3, 'empty lines are not counted');
assert.equal(store.picturePlace({ html: '<img class="att-img w-s" src=x><div>a</div>', text: 'a' }).pct, 45, 'Small = 45 %');
assert.equal(store.picturePlace({ html: '<div>a</div><img class="att-drawing" src=x>', text: 'a' }).d, true, 'a drawing');
assert.equal(store.picturePlace({ html: '<div>a</div><table><tr><td>x</td><td>y</td></tr></table><div>b</div><img src=x>', text: 'a\nx\ty\nb' }).at, 3,
  'a table counts as one line (the last line before the picture decides)');
assert.equal(store.picturePlace({ html: '<div>no pictures</div>', text: 'no pictures' }), null);

// ---- 1.3.27: evening colours and the panic button: a note's own choice and the settings, cleaned
assert.deepEqual([store.normalize({ id: 'e' }).evening, store.normalize({ id: 'e' }).panic], [null, null], 'as in Settings to begin with');
assert.equal(store.normalize({ id: 'e', evening: false }).evening, false);
assert.equal(store.normalize({ id: 'e', evening: 'yes' }).evening, null, 'only true / false');
assert.equal(store.normalize({ id: 'e', panic: true }).panic, null, 'panic: only false (stays open) is a choice');
assert.equal(store.normalize({ id: 'e', panic: false }).panic, false);
{
  const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-store-eve-'));
  fs.writeFileSync(path.join(d3, 'settings.json'), JSON.stringify({ eveFrom: 99999, eveTo: '7', panicKey: 42, panicClosed: ['a', 5, null, 'b'] }));
  const s3 = new Store(d3);
  assert.deepEqual([s3.settings.eveOn, s3.settings.eveFrom, s3.settings.eveTo], [false, 1140, 7], 'off; a bad time → 19:00; a time is kept');
  assert.deepEqual([s3.settings.panicOn, s3.settings.panicKey, s3.settings.panicClosed], [false, '', ['a', 'b']], 'panic off; no shortcut; only note ids');
  // which settings notes have their own value of, and the one patch that puts Settings back
  const set = { defaultFont: 'hand', defaultOpacity: 1, defaultSolidOnHover: true };
  const plain = store.normalize({ id: 'p', font: 'hand' });
  const mine = store.normalize({ id: 'm', font: 'round', opacity: 0.5, solidOnHover: false, fx: { e: 'snow', fo: 0.5 }, fxPlay: true, spell: false,
    checklist: { fixed: true }, evening: true, panic: false });
  const binned = store.normalize({ ...mine, id: 'b', deletedAt: 5 });
  assert.deepEqual(store.overrideCounts([plain, mine, binned], set), { font: 1, opacity: 1, solidOnHover: 1, effect: 1, follower: 1, fxPause: 1, spell: 1,
    checkDrag: 0, checkSink: 0, checkFixed: 1, evening: 1, panic: 1 }, 'counted per setting, the Bin left out');
  assert.deepEqual(store.resetPatch(plain, set, store.OVERRIDE_KEYS), {}, 'a note like Settings: nothing to change');
  assert.deepEqual(store.resetPatch(mine, set, ['effect', 'follower']).fx, { e: null, f: null, ea: null, fa: null, eo: null, fo: null, mi: null }, 'background and follower together');
  assert.deepEqual(store.resetPatch(mine, set, ['effect']).fx.fo, 0.5, 'the background alone keeps the follower');
  assert.deepEqual(store.resetPatch(mine, set, ['font', 'opacity', 'solidOnHover', 'fxPause', 'spell', 'checkFixed', 'evening', 'panic']),
    { font: 'hand', opacity: 1, solidOnHover: true, fxPaused: false, fxPlay: false, spell: null, checklist: { drag: null, sink: null, fixed: null }, evening: null, panic: null });
  assert.deepEqual(store.resetPatch(mine, { ...set, defaultFont: 'round', defaultOpacity: 0.62 }, ['font', 'opacity']), { opacity: 0.6 },
    'for new notes: the value set now (see-through in 5 % steps); a note already on it is left alone');
}
console.log('ok');
