'use strict';
// Locked notes are encrypted on disk (1.1.30, main/crypt.js). Each part below is its own start of the app (a process of
// its own on the same data folder, like quitting and starting again), and the files themselves are checked: no title,
// words, drawing or picture of a locked note can be read from them, and nothing is ever lost: the first PIN sets it up,
// the recovery key (shown once, saved to a file), sealed in memory until the PIN, Duplicate, the attachment sweep,
// restoring a backup, forgot the PIN, turning it off and on, a new recovery key, removing a lock, a locked group, and a
// note locked before 1.1.30. (Old data and backups from before encryption: crypt-old-data.test.js; the list window's
// side: list-ui-crypt.test.js.)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, ['first', 'second', 'third', { name: 'older', fresh: true }]);

const DATA = app.DATA;
const E = app.E;
const read = app.read;
const noteFile = (id) => app.readJSON(`notes/${id}.json`);
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('PICTURE-OF-MY-PASSPORT'.repeat(20))]);
const SECRET_WORDS = /bank pin is 1234|Bank stuff secret title|PICTURE-OF-MY-PASSPORT|"t":"pen"/;
let saveTo = null; E.dialog.showSaveDialog = async () => ({ canceled: false, filePath: saveTo });
if (app.phase === 'older') { // a note locked with a version before 1.1.30 (a "salt:hash" PIN), before main.js starts
  fs.mkdirSync(path.join(DATA, 'notes'), { recursive: true });
  const salt = 'abcdef0123456789';
  const hash = require('crypto').scryptSync('2468', salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  fs.writeFileSync(path.join(DATA, 'settings.json'), JSON.stringify({ firstRunDone: true, lock: `${salt}:${hash}`, lockKind: 'pin', lockLen: 4 }));
  fs.writeFileSync(path.join(DATA, 'notes', 'old-1.json'), JSON.stringify({ id: 'old-1', title: 'Bank stuff secret title', html: '<div>bank pin is 1234</div>', text: 'bank pin is 1234', locked: true }));
}

(async () => {
  const { H, ev } = await app.start();
  const crypt = require('../main/crypt');
  const { S } = require('../main/state');
  const winOf = app.winOf;
  const card = app.card;
  const proto = (name) => E.__proto({ url: `stickyfile://att/${name}` });
  if (app.phase === 'first') {
    // ---- the first PIN sets up encryption
    assert.ok((await H['lock:set'](null, { next: '258025', kind: 'pin' })).ok);
    const st = JSON.parse(read('settings.json'));
    assert.equal(st.lock, 'encrypted', 'no fast "salt:hash" next to the keys (it would be the weak spot)');
    assert.ok(st.crypt && st.crypt.pub && st.crypt.byPw && st.crypt.byRec, 'the keys are saved');
    assert.equal(st.crypt.byPw.N, 131072, 'every PIN guess costs scrypt N=2^17');
    assert.ok(!JSON.stringify(st).includes('258025'), 'the PIN itself is nowhere');
    const code = await H['crypt:take-key']();
    assert.match(code, /^([0-9A-HJKMNP-TV-Z]{5}-){4}[0-9A-HJKMNP-TV-Z]{5}$/, 'a recovery key of 25 letters and digits');
    assert.ok(!JSON.stringify(st).includes(code.replace(/-/g, '')), 'the recovery key isn’t saved either');
    assert.equal((await H['list:get']()).settings.crypt.pending, true, 'the list is told to show it');
    assert.equal((await H['list:get']()).settings.crypt.pub, undefined, 'the list never gets the keys');
    saveTo = path.join(DATA, '..', 'key.txt');
    assert.equal(await H['crypt:save-key'](null, 'WRONG-KEY'), false, 'Save to a file only saves the key on show');
    assert.equal(await H['crypt:save-key'](null, code), true);
    assert.ok(fs.readFileSync(saveTo, 'utf8').includes(code), 'saved to the file the owner picked');
    await H['crypt:key-saved']();
    assert.equal(await H['crypt:take-key'](), null);
    assert.equal(JSON.parse(read('settings.json')).crypt.keyShown, true);

    // ---- a note with a title, words, a drawing and a photo; then locked
    await H['list:new']();
    const w = E.__all.filter((x) => x.noteId).pop();
    const id = w.noteId;
    const url = await H['att:save'](null, PNG, 'png');
    const name = url.split('/').pop();
    const html = `<div>bank pin is 1234</div><img src="${url}">`;
    await H['note:update'](ev(w), { title: 'Bank stuff secret title', html, text: 'bank pin is 1234', firstImage: url, ink: { s: [{ t: 'pen', c: '#ff0000', w: 3, l: 'a', p: [1, 2, 3, 4] }] } });
    S.store.flush();
    assert.ok(SECRET_WORDS.test(read(`notes/${id}.json`)), 'an unlocked note is plain, as before');
    await H['note:set-locked'](ev(w), true);
    let f = read(`notes/${id}.json`);
    assert.ok(!SECRET_WORDS.test(f), 'locked: its title, words and drawing are not in its file');
    assert.ok(!SECRET_WORDS.test(fs.readFileSync(path.join(DATA, 'notes', `${id}.json.bak`), 'utf8')), 'and not in its .bak safety copy either');
    const nf = noteFile(id);
    assert.ok(nf.enc && nf.enc.v === 2 && nf.enc.c, 'they are sealed in "enc"');
    assert.deepEqual(nf.encAtt, [name], 'the photo’s file name is kept, for the attachment sweep');
    const att = fs.readFileSync(path.join(DATA, 'attachments', name));
    assert.equal(att.subarray(0, 8).toString(), 'CNSEAL2\n', 'the photo is encrypted too (CNSEAL1 in 1.1.30: crypt-old-data.test.js)');
    assert.ok(!att.includes(Buffer.from('PICTURE-OF-MY-PASSPORT')), '… nothing of it can be read');
    assert.ok(!fs.existsSync(path.join(DATA, 'attachments', name + '.bak')), 'no plain copy left next to it');
    // the app itself still shows it (the PIN was typed this session)
    const served = await proto(name);
    assert.ok(Buffer.from(served.body).equals(PNG), 'the photo still shows in the app');
    // a cover title, typed in the note's menu
    await H['note:update'](ev(w), { coverTitle: 'Bank' });
    // typing in the unlocked window of a locked note: sealed again on every save
    await H['note:update'](ev(w), { html: html + '<div>more</div>', text: 'bank pin is 1234\nmore' });
    S.store.flush();
    assert.ok(!SECRET_WORDS.test(read(`notes/${id}.json`)), 'still sealed after more typing');
    // backups carry the sealed version
    const bdir = S.store.backupNow();
    assert.ok(!SECRET_WORDS.test(fs.readFileSync(path.join(DATA, 'backups', bdir, `${id}.json`), 'utf8')), 'the backup is sealed too');
    // a second note, locked from the list without the PIN (only the public key is needed)
    await H['list:new']();
    const w2 = E.__all.filter((x) => x.noteId).pop();
    await H['note:update'](ev(w2), { title: 'Bank stuff secret title', html: '<div>bank pin is 1234</div>', text: 'bank pin is 1234' });
    assert.ok((await H['list:set-locked'](null, w2.noteId, true)).ok);
    app.hand({ id, id2: w2.noteId, name, code, backup: bdir });
    await app.quit();
  }

  if (app.phase === 'second') {
    const { id, id2, name, code, backup } = app.hand();
    // ---- after a restart: sealed in memory too, until the PIN
    const n = S.store.get(id);
    assert.ok(n.enc && n.title === '' && n.html === '' && n.ink === null, 'nothing readable in memory before the PIN');
    const c = await card(id);
    assert.equal(c.title, 'Bank', 'the card shows the title while locked');
    assert.ok(c.cover && c.text === '' && c.firstImage === null);
    assert.equal((await proto(name)).status, 403, 'the photo can’t be fetched before the PIN');
    // a duplicate of a sealed note keeps the sealed contents (and is locked)
    const dupId = await H['list:duplicate'](null, id);
    assert.ok(S.store.get(dupId).enc && S.store.get(dupId).locked, 'Duplicate keeps it sealed');
    // the sweep keeps the photo of a sealed note
    S.store.sweepAttachments(0);
    assert.ok(fs.existsSync(path.join(DATA, 'attachments', name)), 'the attachment sweep keeps a sealed note’s photo');
    // the Edit sheet on a locked card changes the cover title, never the (sealed) title
    await H['list:edit'](null, id, { title: 'Bank (2026)' });
    assert.equal(S.store.get(id).coverTitle, 'Bank (2026)');
    assert.ok(S.store.get(id).enc, 'still sealed');
    // restoring the backup before the PIN: comes back sealed, nothing lost
    const before = S.store.all().length;
    S.store.restoreBackup(backup);
    const back = S.store.all().filter((x) => x.restoredFrom === backup);
    assert.ok(back.length >= 1 && back.every((x) => x.enc && x.locked), 'restored notes stay sealed and locked');
    assert.ok(S.store.all().length >= before);
    // opening the note's window: hidden, wrong PIN, right PIN
    await H['list:open-note'](null, id);
    const w = winOf(id);
    const v = await H['note:get'](ev(w));
    assert.ok(v.hidden && v.title === '' && v.html === '' && v.enc === undefined, 'the window gets nothing');
    assert.equal(w.title, 'Bank (2026)', 'the window title is the title while locked');
    assert.equal(await H['note:unlock'](ev(w), '000000'), null, 'wrong PIN');
    const open = await H['note:unlock'](ev(w), '258025');
    assert.ok(open && open.html.includes('bank pin is 1234') && open.title === 'Bank stuff secret title', 'the right PIN opens it');
    assert.equal(open.ink.s[0].t, 'pen', 'with its drawing');
    assert.equal(w.title, 'Bank stuff secret title', 'the window shows its real title again');
    assert.ok(Buffer.from((await proto(name)).body).equals(PNG), 'and the photo');
    assert.ok(S.store.get(dupId).html.includes('bank pin is 1234'), 'the copy opened too');
    assert.ok(back.every((x) => x.html.includes('bank pin is 1234')), 'and the restored ones');
    // ---- forgot the PIN: the recovery key and a new PIN
    assert.equal((await H['crypt:recover'](null, { code: 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', next: '97531', kind: 'pin' })).error, 'That recovery key is not right.');
    assert.ok((await H['crypt:recover'](null, { code: code.toLowerCase().replace(/-/g, ' '), next: '97531', kind: 'pin' })).ok, 'the recovery key (typed loosely) sets a new PIN');
    assert.equal(JSON.parse(read('settings.json')).lockLen, 5);
    S.store.flush();
    await app.quit();
  }

  if (app.phase === 'third') {
    const { id, id2, name } = app.hand();
    assert.equal(await H['list:unlock-all'](null, '258025').then((r) => r.ok), false, 'the old PIN no longer works');
    assert.ok((await H['list:unlock-all'](null, '97531')).ok, 'the new one does');
    assert.ok(S.store.get(id).html.includes('bank pin is 1234'), 'opened');
    // ---- turn encryption off: plain files again; then back on
    assert.ok((await H['crypt:set-off'](null, '97531', true)).ok);
    assert.ok(SECRET_WORDS.test(read(`notes/${id}.json`)) && !noteFile(id).enc, 'off: the note is plain again');
    assert.ok(fs.readFileSync(path.join(DATA, 'attachments', name)).equals(PNG), 'and its photo');
    assert.ok(JSON.parse(read('settings.json')).crypt.off && JSON.parse(read('settings.json')).crypt.byPw, 'the keys stay (old backups can still be opened)');
    assert.equal((await H['list:get']()).settings.crypt.on, false);
    assert.ok((await H['crypt:set-off'](null, '97531', false)).ok);
    assert.ok(!SECRET_WORDS.test(read(`notes/${id}.json`)) && noteFile(id).enc, 'on again: sealed again');
    assert.equal(fs.readFileSync(path.join(DATA, 'attachments', name)).subarray(0, 8).toString(), 'CNSEAL2\n');
    // ---- a new recovery key: the old one stops working
    assert.ok((await H['crypt:new-key'](null, '97531')).ok);
    const code2 = await H['crypt:take-key']();
    assert.ok(code2 && code2 !== app.hand().code);
    assert.equal(JSON.parse(read('settings.json')).crypt.keyShown, false, 'not saved yet');
    // ---- removing a lock: the note and its photo are plain again
    assert.ok((await H['list:set-locked'](null, id, false, '97531')).ok);
    assert.ok(SECRET_WORDS.test(read(`notes/${id}.json`)) && !noteFile(id).enc, 'unlocked: plain');
    assert.ok(fs.readFileSync(path.join(DATA, 'attachments', name)).equals(PNG), 'its photo too');
    assert.ok(noteFile(id2).enc, 'the other locked note stays sealed');
    // ---- a group's lock seals the notes inside it
    await H['list:new']();
    const w3 = E.__all.filter((x) => x.noteId).pop();
    await H['note:update'](ev(w3), { html: '<div>bank pin is 1234</div>', text: 'bank pin is 1234' });
    await H['groups:make-from'](null, [w3.noteId], null);
    const gid = S.store.get(w3.noteId).groupId;
    assert.ok((await H['groups:set-locked'](null, gid, true)).ok);
    S.store.flush();
    assert.ok(noteFile(w3.noteId).enc && !SECRET_WORDS.test(read(`notes/${w3.noteId}.json`)), 'a note in a locked group is sealed');
    await app.quit();
  }

  if (app.phase === 'older') {
    // ---- a note locked before 1.1.30: plain until the PIN is typed once, then sealed (and the recovery key shows)
    assert.ok(SECRET_WORDS.test(read('notes/old-1.json')));
    assert.equal(crypt.isSetUp(), false);
    assert.equal((await card('old-1')).title, '', 'its title is hidden in the list already');
    assert.equal((await H['list:unlock-all'](null, '1111')).ok, false);
    assert.ok((await H['list:unlock-all'](null, '2468')).ok, 'the old PIN works');
    assert.ok(crypt.isSetUp(), 'and set up encryption');
    assert.ok(!SECRET_WORDS.test(read('notes/old-1.json')) && noteFile('old-1').enc, 'the old locked note is sealed now');
    assert.equal(JSON.parse(read('settings.json')).lock, 'encrypted', 'the old fast hash is gone');
    assert.ok(await H['crypt:take-key'](), 'its recovery key waits to be shown');
    assert.equal(S.store.get('old-1').html, '<div>bank pin is 1234</div>', 'nothing lost');
    assert.ok((await H['list:unlock-all'](null, '2468')).ok, 'the same PIN keeps working');
    await app.quit();
  }
})();
