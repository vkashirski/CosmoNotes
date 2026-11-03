'use strict';
// store.js on its own (no main process): saving and loading notes, crash recovery from the .bak copy, backups (once a
// day, restore into a "Restored Notes from …" group, pruning), attachments that a backup still uses, and the small
// helpers that clean or read a note: normalize, normalizeInk, checklistMarks, pictureWords, picturePlace, lineCount.
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
for (const f of ['hand', 'round', 'medieval']) assert.equal(store.normalize({ id: 'a', font: f }).font, f, `the ${f} font is kept`);
assert.equal(store.normalize({ id: 'a', font: 'comic' }).font, 'hand', 'an unknown font: Handwritten');

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

// ---- pictureWords: picture descriptions, for the list's search
assert.equal(store.pictureWords('<div>x<img class="att-img" src="a" alt="Plumber &amp; receipt" title="t"><img src="b"><img alt="" src="c"></div>'), 'Plumber & receipt');
assert.equal(store.pictureWords('<p>none</p>'), ''); assert.equal(store.pictureWords(null), '');

// ---- picturePlace / lineCount: where a card shows the first picture, and how many lines a note has
const ph = '<ul class="checklist"><li class="done">one</li><li class="done">two &amp; three</li></ul><div><img class="att-img" width="110" src="stickyfile://att/a.png"></div><div>after</div>';
assert.deepEqual(store.picturePlace({ html: ph, text: 'one\ntwo & three\n\nafter', font: 'hand', size: 'm', bounds: { width: 400 } }),
  { at: 2, px: 110, pct: null, d: false, fs: 23, tw: 368 }, 'two lines before it, 110 px wide, big hand text');
assert.equal(store.lineCount('one\ntwo & three\n\nafter'), 3, 'empty lines are not counted');
assert.equal(store.picturePlace({ html: '<img class="att-img w-s" src=x><div>a</div>', text: 'a' }).pct, 45, 'Small = 45 %');
assert.equal(store.picturePlace({ html: '<div>a</div><img class="att-drawing" src=x>', text: 'a' }).d, true, 'a drawing');
assert.equal(store.picturePlace({ html: '<div>a</div><table><tr><td>x</td><td>y</td></tr></table><div>b</div><img src=x>', text: 'a\nx\ty\nb' }).at, 3,
  'a table counts as one line (the last line before the picture decides)');
assert.equal(store.picturePlace({ html: '<div>no pictures</div>', text: 'no pictures' }), null);
console.log('ok');
