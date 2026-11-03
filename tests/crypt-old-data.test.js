'use strict';
// Encryption meets older data (1.1.31). Each part is its own start of the app, on a data folder of its own:
// - backups: notes locked before the update wait for the PIN (the list asks for it at start); once typed, the notes and
//   the locked copies inside old backups are sealed (also a note locked later, and backups made while it was off);
//   restoring brings them back with their words; the plain temp copies of opened photos go when the app quits.
// - fails: a crypto library that can't do the big scrypt: setting up changes nothing and the list says why; PINs work.
// - v1: a note sealed by 1.1.30 (version 1: HKDF) still opens.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, [{ name: 'backups', fresh: true }, { name: 'fails', fresh: true }, { name: 'v1', fresh: true }]);

const SECRET = /bank pin is 1234|Bank stuff secret title|diary entry/;
const E = app.E;
const DATA = app.DATA;
const read = app.read;
const write = (f, o) => { fs.mkdirSync(path.dirname(path.join(DATA, f)), { recursive: true }); fs.writeFileSync(path.join(DATA, f), JSON.stringify(o)); };
const note = (id, extra) => ({ id, title: 'Bank stuff secret title', html: '<div>bank pin is 1234</div>', text: 'bank pin is 1234', ...extra });
const oldLock = (pw) => { const salt = 'abcdef0123456789'; return `${salt}:${crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`; };

// ---- data from before 1.1.30 (or from 1.1.30 before the PIN was typed): plain locked notes, plain backups
write('settings.json', { firstRunDone: true, lock: oldLock('2468'), lockKind: 'pin', lockLen: 4 });
if (app.phase === 'backups' || app.phase === 'fails') {
  write('notes/own.json', note('own', { locked: true }));
  write('notes/ingroup.json', note('ingroup', { groupId: 'g1', title: 'diary entry' }));
  write('notes/plain.json', { id: 'plain', title: 'shopping', html: '<div>milk</div>', text: 'milk' });
  write('notes/later.json', note('later', { title: 'later' }));
  write('groups.json', { groups: [{ id: 'g1', name: 'Box', locked: true }] });
  // an old backup: "own" locked, "ingroup" in a group that was locked then, "plain" and "later" not locked
  write('backups/2026-10-20/own.json', note('own', { locked: true }));
  write('backups/2026-10-20/ingroup.json', note('ingroup', { groupId: 'g1', title: 'diary entry' }));
  write('backups/2026-10-20/plain.json', { id: 'plain', title: 'shopping', html: '<div>milk</div>', text: 'milk' });
  write('backups/2026-10-20/later.json', note('later', { title: 'later' }));
  write('backups/2026-10-20/groups.json', { groups: [{ id: 'g1', name: 'Box', locked: true }] });
  write('backups/2026-10-20/meta.json', { created: 1, count: 4 });
}
if (app.phase === 'fails') { // a crypto library that can't do scrypt this big: setting up must change nothing
  const real = crypto.scrypt;
  crypto.scrypt = (pw, salt, len, opts, cb) => (opts && opts.N > 16384 ? cb(new Error('Invalid scrypt params')) : real(pw, salt, len, opts, cb));
}

(async () => {
  const { H } = await app.start();
  const crypt = require('../main/crypt');
  const { S } = require('../main/state');
  const backup = (id) => read(`backups/2026-10-20/${id}.json`);
  if (app.phase === 'backups') {
    // before the PIN: the list is asked to get it straight away
    let st = (await H['list:get']()).settings.crypt;
    assert.ok(st.needPin && !st.setUp, 'notes locked before the update: the list asks for the PIN');
    assert.ok(SECRET.test(backup('own')), '(the old backup is plain to begin with)');
    // the PIN, typed once: notes and the old backup's locked copies are sealed
    assert.ok((await H['crypt:start'](null, '2468')).ok);
    st = (await H['list:get']()).settings.crypt;
    assert.ok(st.setUp && !st.needPin && !st.error);
    assert.equal(JSON.parse(read('settings.json')).crypt.v, 2);
    assert.equal(JSON.parse(read('notes/own.json')).enc.v, 2, 'notes are sealed with version 2');
    for (const id of ['own', 'ingroup']) {
      assert.ok(!SECRET.test(backup(id)) && JSON.parse(backup(id)).enc, `backup copy of "${id}" is sealed`);
      assert.ok(!fs.existsSync(path.join(DATA, 'backups/2026-10-20', `${id}.json.bak`)) && !fs.existsSync(path.join(DATA, 'backups/2026-10-20', `${id}.json.tmp`)), 'no plain copy left beside it');
    }
    assert.ok(/milk/.test(backup('plain')), 'a note that was never locked stays as it was');
    assert.ok(SECRET.test(backup('later')), '"later" isn’t locked yet: its copy stays');
    assert.equal(JSON.parse(read('settings.json')).crypt.backupsSealed, true, 'the full pass ran once');
    // locking "later" now seals its old backup copy too
    assert.ok((await H['list:set-locked'](null, 'later', true)).ok);
    assert.ok(!SECRET.test(backup('later')) && JSON.parse(backup('later')).enc, 'locking a note seals its copies in old backups');
    // nothing lost: restoring the backup brings the sealed copies back, opened (the PIN was typed)
    S.store.notes.get('own').html = '<div>changed since</div>'; // so the backup's copy differs and comes back
    S.store.restoreBackup('2026-10-20');
    const back = S.store.all().filter((n) => n.restoredFrom === '2026-10-20');
    assert.ok(back.some((n) => n.html === '<div>bank pin is 1234</div>' && n.locked), 'a sealed backup copy restores with its words, locked');
    // turning encryption off and on again: backups made while off are sealed again on the way back on
    assert.ok((await H['crypt:set-off'](null, '2468', true)).ok);
    S.store.backupNow('2026-10-21');
    assert.ok(SECRET.test(read('backups/2026-10-21/own.json')), 'off: a new backup is plain');
    assert.ok((await H['crypt:set-off'](null, '2468', false)).ok);
    assert.ok(!SECRET.test(read('backups/2026-10-21/own.json')), 'back on: that backup’s locked copies are sealed again');
    assert.ok(!SECRET.test(backup('own')), 'the older one stays sealed');
    // the temp copies of opened photos go when the app quits
    const tmp = path.join(require('os').tmpdir(), 'CosmoNotes-open');
    fs.mkdirSync(tmp, { recursive: true }); fs.writeFileSync(path.join(tmp, 'x.png'), 'photo');
    E.app.emit('will-quit');
    assert.ok(!fs.existsSync(tmp), 'quitting deletes the plain photo copies');
    await app.quit();
  }

  if (app.phase === 'fails') {
    // the right PIN still works, nothing is changed, and the list hears why
    assert.ok((await H['crypt:start'](null, '2468')).ok, 'the PIN works');
    const st = (await H['list:get']()).settings.crypt;
    assert.ok(!st.setUp && /Invalid scrypt params/.test(st.error), 'the list is told what went wrong');
    const settings = JSON.parse(read('settings.json'));
    assert.ok(!settings.crypt && settings.lock === oldLock('2468'), 'settings.json is as it was');
    assert.equal(S.store.get('own').html, '<div>bank pin is 1234</div>', 'the note is as it was');
    assert.ok(!JSON.parse(read('notes/own.json')).enc, 'its file too');
    assert.ok((await H['list:unlock-all'](null, '2468')).ok && !(await H['list:unlock-all'](null, '1111')).ok, 'PIN checks keep working');
    // a brand-new PIN on such a PC: saved the old way, so locking still works
    S.store.settings.lock = null;
    assert.ok((await H['lock:set'](null, { next: '97531', kind: 'pin' })).ok);
    assert.ok(/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(JSON.parse(read('settings.json')).lock), 'the PIN is saved as before');
    assert.ok((await H['list:unlock-all'](null, '97531')).ok);
    await app.quit();
  }

  if (app.phase === 'v1') {
    // a note sealed by 1.1.30 (version 1: HKDF, CNSEAL1 files) still opens
    assert.ok((await H['crypt:start'](null, '2468')).ok);
    const pubRaw = Buffer.from(S.store.settings.crypt.pub, 'base64');
    const SPKI = Buffer.from('302a300506032b656e032100', 'hex');
    const eph = crypto.generateKeyPairSync('x25519');
    const ephRaw = eph.publicKey.export({ type: 'spki', format: 'der' }).subarray(12);
    const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: crypto.createPublicKey({ key: Buffer.concat([SPKI, pubRaw]), format: 'der', type: 'spki' }) });
    const key = Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([ephRaw, pubRaw]), 'cosmonotes', 32));
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from('cosmonotes-note-v1'));
    const ct = Buffer.concat([c.update(JSON.stringify({ title: 'old one', html: '<div>sealed by 1.1.30</div>', text: 'x', firstImage: null, ink: null })), c.final()]);
    const raw = { id: 'v1note', locked: true, title: '', html: '', enc: { v: 1, k: ephRaw.toString('base64'), n: iv.toString('base64'), t: c.getAuthTag().toString('base64'), c: ct.toString('base64') } };
    const opened = S.store.opener(raw);
    assert.ok(opened && opened.html === '<div>sealed by 1.1.30</div>' && opened.title === 'old one', 'a version 1 note opens');
    await app.quit();
  }
})();
