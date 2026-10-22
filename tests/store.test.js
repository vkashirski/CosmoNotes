const assert = require('assert');
const fs = require('fs'); const path = require('path');
// Storage: saving, crash recovery, backups, restore, pruning.
const { Store } = require('../store.js');
const dir = process.env.FAKE_DATA;
let s = new Store(dir);
const a = s.create({ html: '<b>hello</b>', text: 'hello', open: true, bounds: { x: 10, y: 20, width: 300, height: 280 } });
const att = s.saveAttachment(Buffer.from('PNGDATA'), 'png');
const b = s.create({ html: `<img src="${att}">`, text: '', open: false });
s.update(a.id, { html: '<b>hello world</b>', text: 'hello world', opacity: 0.1, color: 'nope' }, { content: true });
s.flush();
// reload from disk
s = new Store(dir);
const a2 = s.get(a.id);
assert.equal(a2.html, '<b>hello world</b>');
assert.equal(a2.opacity, 0.25, 'opacity clamped');
assert.equal(a2.color, 'yellow', 'bad colour falls back');
assert.deepEqual(a2.bounds, { x: 10, y: 20, width: 300, height: 280 });
assert.ok(fs.existsSync(s.attachmentPathFromUrl(att)));
assert.equal(s.attachmentPathFromUrl('stickyfile://att/../../etc/passwd'), null);
// corrupt main file -> falls back to .bak
fs.writeFileSync(path.join(dir, 'notes', a.id + '.json'), '{broken');
s = new Store(dir);
assert.equal(s.get(a.id).html, '<b>hello</b>', 'recovered previous version from .bak');
// backups + restore
s.update(a.id, { html: 'v3', text: 'v3' }, { content: true }); s.flush();
s.backupIfNeeded();
assert.equal(s.listBackups().length, 1);
s.backupIfNeeded();
assert.equal(s.listBackups().length, 1, 'only one automatic backup per day');
s.update(a.id, { html: 'v4' }, { content: true }); s.flush();
const restored = s.restoreBackup(s.listBackups()[0].name);
assert.equal(restored, 1, 'changed note comes back as an extra copy');
assert.equal(s.all().length, 3);
// 1.1.10: what comes back sits in a group named after the backup's day
const rg = [...s.groups.values()].find((g) => /^Restored Notes from \w+day, \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(g.name));
assert.ok(rg, 'restored notes are grouped: ' + [...s.groups.values()].map((g) => g.name).join(' | '));
assert.equal(s.all().filter((n) => n.groupId === rg.id).length, 1);
assert.equal(require('../store.js').backupDayName('2026-10-22_14-30-00'), 'Thursday, 22 Oct 2026');
// trash / destroy keeps attachment that a backup still references
s.trash(b.id); assert.ok(s.get(b.id).deletedAt);
s.destroy(b.id);
assert.ok(fs.existsSync(s.attachmentPathFromUrl(att)), 'attachment kept while a backup uses it');
// prune: make 35 fake backups
for (let i = 1; i <= 35; i++) fs.mkdirSync(path.join(dir, 'backups', `2020-01-${String(i).padStart(2,'0')}`), { recursive: true });
s.pruneBackups();
assert.equal(s.listBackups().length, 30);
console.log('store tests passed', fs.readdirSync(path.join(dir,'notes')));
