'use strict';
// Voice recordings are written to disk while they are made (1.2.4, main/recordings.js): Save, the X, closing the note or
// locking it mid-recording, a page crash, quitting, a real crash (a process that just stops) and the next start, a crash
// whose note was deleted, a crash on a locked note (sealed at once, its chip after the PIN), the sweep keeping files that
// are being recorded, and a hidden locked window that can't record. Each part is its own start of the app.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./helpers/app');

if (app.phase === 'main') app.phases(__filename, ['first', 'crash', 'after', 'sealed', 'sealed-after']);

const DATA = app.DATA;
const ATT = () => path.join(DATA, 'attachments');
const att = (f) => path.join(ATT(), f);
const has = (f) => fs.existsSync(att(f));
const piece = (n, fill) => new Uint8Array(n).fill(fill);
const stem = (name) => name.split('.')[0];
const chips = (html, name) => (String(html).match(new RegExp(`stickyfile://att/${name.replace(/[.-]/g, '\\$&')}`, 'g')) || []).length;
const noteFile = (id) => app.readJSON(`notes/${id}.json`);

(async () => {
  const { H, L, E, ev, tick } = await app.start();
  const { S } = require('../main/state');
  const rec = (w) => ({
    start: () => H['rec:start'](ev(w)),
    send: (id, bytes) => L['rec:chunk'](ev(w), id, bytes),
    end: (id, mode) => H['rec:end'](ev(w), id, mode),
    done: (id) => H['rec:done'](ev(w), id),
  });

  if (app.phase === 'first') {
    // ---- Save: the pieces are on disk as they come; Save makes the file; the note gets the chip; then it is tidy
    const a = await app.newNote({ html: '<div>shopping</div>' });
    const wa = app.winOf(a);
    const R = rec(wa);
    const r = await R.start();
    assert.match(r.id, /^[A-Za-z0-9_-]+\.webm$/);
    assert.equal(r.url, `stickyfile://att/${r.id}`);
    assert.ok(has(`${r.id}.part`) && has(`${stem(r.id)}.rec.json`), 'the file and whose it is are there from the start');
    assert.equal(JSON.parse(fs.readFileSync(att(`${stem(r.id)}.rec.json`), 'utf8')).noteId, a);
    R.send(r.id, piece(1000, 1)); R.send(r.id, piece(500, 2));
    assert.equal(fs.statSync(att(`${r.id}.part`)).size, 1500, 'each piece is written as it arrives (a crash keeps it)');
    assert.equal(await H['att:open'](ev(wa), r.url), undefined);
    // the unfinished file can't be served or opened (only finished attachment names are)
    assert.equal(S.store.attachmentPath(`${r.id}.part`), null);
    const url = await R.end(r.id, 'save');
    assert.equal(url, r.url);
    assert.ok(!has(`${r.id}.part`) && has(r.id), 'Save makes the real file');
    assert.deepEqual([...fs.readFileSync(att(r.id))], [...piece(1000, 1), ...piece(500, 2)], 'every byte, in order');
    assert.ok(has(`${stem(r.id)}.rec.json`), 'kept until the note points at it');
    await H['note:update'](ev(wa), { html: `<div>shopping</div><span class="voice" data-src="${url}"></span>` });
    assert.equal(await R.done(r.id), true);
    assert.ok(!has(`${stem(r.id)}.rec.json`), 'then it goes');
    assert.equal(chips((await H['note:get'](ev(wa))).html, r.id), 1, 'one chip: main did not add another');
    R.send(r.id, piece(10, 3));
    assert.equal(fs.statSync(att(r.id)).size, 1500, 'nothing more is written to a finished recording');
    assert.ok(!has(`${r.id}.part`));

    // ---- the X: thrown away, nothing left behind
    const d = await R.start();
    R.send(d.id, piece(300, 4));
    assert.equal(await R.end(d.id, 'discard'), null);
    assert.ok(!has(d.id) && !has(`${d.id}.part`) && !has(`${stem(d.id)}.rec.json`), 'nothing left');
    // nothing recorded at all: no empty file, no chip
    const e0 = await R.start();
    assert.equal(await R.end(e0.id, 'save'), null);
    assert.ok(!has(e0.id) && !has(`${e0.id}.part`) && !has(`${stem(e0.id)}.rec.json`));

    // ---- another window can't write into it or end it
    const b = await app.newNote({ html: '<div>other</div>' });
    const wb = app.winOf(b);
    const x = await R.start();
    R.send(x.id, piece(200, 5));
    rec(wb).send(x.id, piece(50, 6));
    assert.equal(await rec(wb).end(x.id, 'discard'), null, 'nor end it');
    assert.equal(await rec(wb).done(x.id), false);
    assert.equal(fs.statSync(att(`${x.id}.part`)).size, 200, 'another window can’t add to it');

    // ---- closed mid-recording, the window saved its chip (beforeunload): one chip, file finished
    await H['note:update'](ev(wa), { html: `<div>shopping</div><span class="voice" data-src="${url}"></span><span class="voice" data-src="${x.url}"></span>` });
    assert.equal(await R.end(x.id, 'kept'), x.url);
    wa.close();
    let n = S.store.get(a);
    assert.equal(chips(n.html, x.id), 1, 'closing keeps the recording, with one chip');
    assert.ok(has(x.id) && !has(`${x.id}.part`) && !has(`${stem(x.id)}.rec.json`));

    // ---- the page crashed (or closed) before it could say anything: main finishes the file and adds the chip
    const y = await rec(wb).start();
    rec(wb).send(y.id, piece(700, 7));
    wb.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    n = S.store.get(b);
    assert.equal(chips(n.html, y.id), 1, 'a chip at the end of the note');
    assert.ok(n.html.startsWith('<div>other</div>'), 'what was there stays');
    assert.ok(has(y.id) && fs.statSync(att(y.id)).size === 700 && !has(`${stem(y.id)}.rec.json`));
    assert.ok(chips(noteFile(b).html, y.id) === 1, 'and it is saved');
    wb.close();

    // ---- locked mid-recording: the window can't save any more, main adds the chip (once)
    await H['lock:set'](null, { next: '1357', kind: 'pin' });
    const c = await app.newNote({ html: '<div>diary</div>' });
    const wc = app.winOf(c);
    const z = await rec(wc).start();
    rec(wc).send(z.id, piece(400, 8));
    await H['note:set-locked'](ev(wc), true);
    assert.equal(await rec(wc).start(), null, 'a hidden locked window can’t start a recording');
    assert.equal(await rec(wc).end(z.id, 'kept'), z.url);
    assert.equal(chips(S.store.get(c).html, z.id), 1, 'the locked note keeps the recording');
    await H['note:update'](ev(wc), { html: '' });
    assert.equal(chips(S.store.get(c).html, z.id), 1, 'its hidden window can’t overwrite it');
    assert.ok(fs.readFileSync(att(z.id)).subarray(0, 8).toString() === 'CNSEAL2\n', 'and the clip is sealed with the note');

    // ---- the sweep keeps a recording in progress, even an old-looking one; it tidies up the rest as before
    const w2 = app.winOf(await app.newNote());
    const s = await rec(w2).start();
    rec(w2).send(s.id, piece(100, 9));
    fs.writeFileSync(att('zz-old.webm'), 'nobody uses me');
    const old = new Date(Date.now() - 5 * 24 * 3600e3);
    for (const f of [`${s.id}.part`, `${stem(s.id)}.rec.json`, 'zz-old.webm']) fs.utimesSync(att(f), old, old);
    S.store.sweepAttachments(0);
    assert.ok(has(`${s.id}.part`) && has(`${stem(s.id)}.rec.json`), 'a recording in progress is never swept');
    assert.ok(!has('zz-old.webm'), 'an unused old file still is');
    assert.ok(has(r.id) && has(x.id) && has(y.id) && has(z.id), 'recordings in notes stay');

    // ---- quitting mid-recording: finished and in its note
    app.hand({ quitNote: w2.noteId, quitRec: s.id });
    E.app.emit('will-quit');
    assert.equal(chips(noteFile(w2.noteId).html, s.id), 1, 'quitting keeps it');
    assert.ok(has(s.id) && !has(`${s.id}.part`) && !has(`${stem(s.id)}.rec.json`));
    await app.quit();
  }

  if (app.phase === 'crash') {
    const { quitNote, quitRec } = app.hand();
    assert.equal(chips(S.store.get(quitNote).html, quitRec), 1, 'the quit recording is still there after a restart');
    const a = await app.newNote({ html: '<div>meeting</div>' });
    const R = rec(app.winOf(a));
    const r = await R.start();
    R.send(r.id, piece(2000, 1)); R.send(r.id, piece(2000, 2));
    // a recording whose note was deleted, left by an older crash
    fs.writeFileSync(att('lost-abc123.webm.part'), piece(300, 3));
    fs.writeFileSync(att('lost-abc123.rec.json'), JSON.stringify({ noteId: 'no-such-note', file: 'lost-abc123.webm', startedAt: Date.now() - 65000 }));
    // and an empty one (crashed before the first piece)
    fs.writeFileSync(att('empty-000000.webm.part'), '');
    fs.writeFileSync(att('empty-000000.rec.json'), JSON.stringify({ noteId: a, file: 'empty-000000.webm', startedAt: Date.now() }));
    app.hand({ crashNote: a, crashRec: r.id });
    S.store.flush(); // the note's words were saved (typing saves within 350 ms); only the recording was running
    process.exit(0); // a crash: no quit, nothing finished
  }

  if (app.phase === 'after') {
    const { crashNote, crashRec } = app.hand();
    const n = S.store.get(crashNote);
    assert.equal(chips(n.html, crashRec), 1, 'after a crash the recording is back in its note');
    assert.ok(n.html.startsWith('<div>meeting</div>'), `at the end: ${n.html.slice(0, 80)}`);
    assert.equal(fs.statSync(att(crashRec)).size, 4000, 'with everything that was written');
    assert.ok(!has(`${crashRec}.part`) && !has(`${stem(crashRec)}.rec.json`));
    const found = S.store.all().find((m) => m.title === 'Recovered recording');
    assert.ok(found && chips(found.html, 'lost-abc123.webm') === 1, 'a recording whose note is gone gets a new note');
    assert.match(found.html, /data-dur="65"/, 'with its length');
    assert.equal(found.open, false, 'closed, in the list');
    assert.ok(!has('lost-abc123.rec.json') && has('lost-abc123.webm'));
    assert.ok(!has('empty-000000.webm') && !has('empty-000000.webm.part') && !has('empty-000000.rec.json'), 'an empty one is just tidied away');
    assert.ok(!S.store.all().some((m) => chips(m.html, 'empty-000000.webm')), 'no chip for it');

    // ---- a locked note, recording while unlocked in its window, then a crash
    const a = await app.newNote({ html: '<div>secret plans</div>' });
    const w = app.winOf(a);
    await H['note:set-locked'](ev(w), true);
    assert.ok(await H['note:unlock'](ev(w), '1357'), 'unlocked in its window (the PIN from the first part)');
    const r = await rec(w).start();
    assert.ok(r, 'an unlocked window may record');
    rec(w).send(r.id, piece(900, 4));
    app.hand({ lockedNote: a, lockedRec: r.id });
    process.exit(0);
  }

  if (app.phase === 'sealed') {
    const { lockedNote, lockedRec } = app.hand();
    const n = S.store.get(lockedNote);
    assert.ok(n.enc, 'the note is still sealed (no PIN yet)');
    assert.ok(has(lockedRec) && !has(`${lockedRec}.part`), 'the recording is finished');
    assert.equal(fs.readFileSync(att(lockedRec)).subarray(0, 8).toString(), 'CNSEAL2\n', 'and sealed right away: never plain on disk after the restart');
    assert.ok(has(`${stem(lockedRec)}.rec.json`), 'it waits for the PIN (and the sweep keeps it)');
    S.store.sweepAttachments(0);
    assert.ok(has(lockedRec));
    await app.quit(); // still no PIN: it must wait across restarts too
  }

  if (app.phase === 'sealed-after') {
    const { lockedNote, lockedRec } = app.hand();
    assert.ok(S.store.get(lockedNote).enc && has(`${stem(lockedRec)}.rec.json`), 'still waiting');
    const w = app.winOf(lockedNote) || (await H['list:open-note']({}, lockedNote), app.winOf(lockedNote));
    assert.ok(await H['note:unlock'](ev(w), '1357'), 'the PIN');
    await tick(5);
    const n = S.store.get(lockedNote);
    assert.equal(chips(n.html, lockedRec), 1, 'the chip arrives with the PIN');
    assert.ok(n.html.startsWith('<div>secret plans</div>'));
    assert.ok(!has(`${stem(lockedRec)}.rec.json`), 'tidied up');
    const f = app.read(`notes/${lockedNote}.json`);
    assert.ok(!f.includes('secret plans') && !f.includes('class=\\"voice'), 'the note on disk is still sealed, chip and all');
    assert.ok(JSON.parse(f).encAtt.includes(lockedRec), 'its file listed by name (encAtt), so the sweep keeps it');
    assert.equal(fs.readFileSync(att(lockedRec)).subarray(0, 8).toString(), 'CNSEAL2\n');
    await app.quit();
  }
})();
