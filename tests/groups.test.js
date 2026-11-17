'use strict';
// Groups, in the main process: groups inside groups (dropping a note on a note, a group on a group; never a group into
// its own sub-group), moving up / to a group / to the top, making a group from several picked items, ungrouping and
// dissolving, a group's look and colour, recolouring everything in a group, a new note made inside an open group,
// groups and the Bin, locking a group (its notes and sub-groups hide), groups.json on disk, and the "make a group" tip.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, ev } = await app.start();
  const get = () => app.list();
  const noteIn = async (id) => (await app.card(id)).groupId;
  const parentOf = async (gid) => (await app.group(gid)).parentId;
  const [a, b, c, d, e] = [await app.newNote(), await app.newNote(), await app.newNote(), await app.newNote(), await app.newNote()];
  assert.equal((await get()).settings.madeGroup, false, 'the "make a group" tip shows until a group is made');

  // ---- dropping a note on a note makes a group; on a note in a group, it joins that group
  const G = await H['groups:make'](null, a, b);
  assert.ok(G && (await noteIn(a)) === G && (await noteIn(b)) === G);
  assert.equal((await get()).settings.madeGroup, true);
  await H['groups:make'](null, c, G);
  assert.equal(await noteIn(c), G, 'dropped on the group: in it');
  // inside G: a onto b makes a sub-group S inside G
  await H['groups:make'](null, a, b);
  const S = await noteIn(a);
  assert.notEqual(S, G);
  assert.equal(await parentOf(S), G, 'sub-group lives inside G');
  assert.equal(await noteIn(c), G);
  assert.equal(await H['groups:make'](null, G, S), null, 'a group can’t go inside its own sub-group');
  // a note dropped on a note that is in a group joins that group
  const x = await app.newNote();
  await H['groups:make'](null, x, c);
  assert.equal(await noteIn(x), G, 'joins the group of the note it was dropped on');
  await H['groups:ungroup'](null, x);
  assert.equal(await noteIn(x), null, 'Ungroup: back to the top');

  // ---- groups in groups: drag, move up, move to
  const T = await H['groups:make'](null, d, e);
  await H['groups:make'](null, T, G);
  assert.equal(await parentOf(T), G, 'group dragged into group');
  await H['groups:move-up'](null, T);
  assert.equal(await parentOf(T), null);
  await H['groups:move-to'](null, T, S);
  assert.equal(await parentOf(T), S, 'moved straight into S (two levels down)');
  await H['groups:move-to'](null, d, null);
  assert.equal(await noteIn(d), null, 'note moved to the top');

  // ---- several picked items into a new group (1.1.13); a favourite group stays one when it moves
  const p1 = await app.newNote(); const p2 = await app.newNote(); const p3 = await app.newNote();
  const g1 = await H['groups:make-from'](null, [p1, p2], null);
  assert.ok(g1 && (await noteIn(p1)) === g1);
  await H['list:favorite'](null, [g1], true);
  assert.equal((await app.group(g1)).favorite, true, 'groups can be favourites');
  const g2 = await H['groups:make-from'](null, [p3, g1], null);
  assert.equal(await parentOf(g1), g2, 'the group went inside the new one');
  assert.equal(await noteIn(p3), g2);
  assert.equal((await app.group(g1)).favorite, true, 'still a favourite after moving');
  const g3 = await H['groups:make-from'](null, [g2, x], g1);
  assert.notEqual(await parentOf(g2), g3, 'a group is never put inside its own sub-group');

  // ---- look and colour; recolouring everything in a group (open windows follow)
  await H['groups:update'](null, G, { style: 'folder', color: 'lilac', bogus: 1 });
  await H['groups:update'](null, S, { style: 'nope' });
  const gl = await app.group(G);
  assert.equal(gl.style, 'folder'); assert.equal(gl.color, 'lilac'); assert.equal(gl.bogus, undefined);
  assert.equal((await app.group(S)).style, 'stack', 'unknown look falls back');
  const wa = app.winOf(a);
  let n = await H['groups:apply'](null, G, { color: 'mint', font: 'round' }, true);
  assert.equal(n, 4, 'a, b, c and e (e is in T inside S inside G)');
  for (const k of [a, b, c, e]) assert.equal((await app.card(k)).color, 'mint');
  assert.equal((await app.card(d)).color, 'yellow', 'note outside not touched');
  assert.ok(wa.webContents.sent.includes('note:look'));
  assert.equal(wa.bg, '#CDF3E8');
  n = await H['groups:apply'](null, G, { color: 'pink' }, false);
  assert.equal(n, 1, 'without sub-groups: only c sits directly in G');

  // ---- locking a group: needs a password first; its notes and sub-groups hide
  let r = await H['groups:set-locked'](null, G, true); assert.equal(r.error, 'no-password');
  await H['lock:set'](null, { next: '2468' });
  r = await H['groups:set-locked'](null, G, true); assert.ok(r.ok);
  assert.ok(wa.webContents.sent.includes('note:lock-now'), 'an open note inside is asked to hide');
  const la = await app.card(a);
  assert.equal(la.locked, true); assert.equal(la.text, ''); assert.equal(la.ownLock, false);
  assert.equal((await app.group(S)).open, false, 'sub-group closed too');
  // in the window: hidden after relock, can't wipe its words, the group's lock can't be removed from the note
  await H['note:relock'](ev(wa));
  let v = await H['note:get'](ev(wa));
  assert.equal(v.hidden, true); assert.equal(v.lockedBy, 'group');
  await H['note:update'](ev(wa), { html: '', text: '' });
  r = await H['note:unlock'](ev(wa), '2468'); assert.equal(r.hidden, false);
  r = await H['note:set-locked'](ev(wa), false); assert.equal(r.lockedBy, 'group', 'still locked by its group');
  // opened in the list: its notes show; a note opened from it doesn't ask again
  r = await H['groups:reveal'](null, G, 'nope'); assert.equal(r.error, 'wrong');
  r = await H['groups:reveal'](null, G, '2468'); assert.ok(r.ok);
  assert.equal((await app.card(a)).locked, false, 'visible in the list once opened');
  await H['list:open-note'](null, c);
  v = await H['note:get'](ev(app.winOf(c))); assert.equal(v.hidden, false);
  await H['groups:hide'](null, G);
  assert.equal((await app.card(b)).locked, true);
  // 1.1.14: a, unlocked in its own window, stays shown until that window is locked again (or closed)
  assert.equal((await app.card(a)).locked, false);
  await H['note:relock'](ev(wa));
  assert.equal((await app.card(a)).locked, true);
  r = await H['groups:set-locked'](null, G, false, 'bad'); assert.equal(r.error, 'wrong');
  r = await H['groups:set-locked'](null, G, false, '2468'); assert.ok(r.ok, 'removing a group’s lock needs the password');

  // ---- dissolving S: its notes and group T move up into G
  await H['groups:dissolve'](null, S);
  assert.equal(await noteIn(a), G);
  assert.equal(await parentOf(T), G);

  // ---- a new note made while a group is open goes into it (1.0.3)
  const made = await app.newNote({ group: T });
  assert.equal(await noteIn(made), T, 'new note created inside the open group');

  // ---- groups and the Bin
  await H['list:trash'](null, made);
  n = await H['groups:trash'](null, T);
  assert.equal(n, 1, 'the whole group to the Bin');
  assert.ok((await app.card(e)).deletedAt);
  assert.ok(await app.group(T), 'group kept while its notes are in the Bin');
  await H['list:restore'](null, e);
  assert.equal(await noteIn(e), T, 'a restored note goes back into its group');
  // groups.json on disk has the tree
  const saved = app.readJSON('groups.json');
  assert.equal(saved.groups.find((y) => y.id === T).parentId, G);
  await H['list:trash'](null, e);
  await H['list:destroy'](null, e); await H['list:destroy'](null, made);
  assert.equal(await app.group(T), undefined, 'a group goes once its notes are gone for good');
  // ---- 1.4.9: several at once, the look of several groups, Undo / Redo of moves (main/move-history.js)
  const m1 = await app.newNote(); const m2 = await app.newNote(); const m3 = await app.newNote();
  const A = await H['groups:make-from'](null, [m1, m2], null);
  const B = await H['groups:make-from'](null, [m3], null);
  assert.equal((await get()).settings.moves.undo, 'New group', 'the list knows what Undo would do');
  let mm = await H['groups:move-many'](null, [m1, m2, B], A, 'Paste');
  assert.deepEqual(mm, { moved: 1, kept: 0 }, 'm1 and m2 are already in A: only B moves');
  assert.equal(await parentOf(B), A);
  assert.equal((await get()).settings.moves.undo, 'Paste');
  mm = await H['groups:move-many'](null, [m1, m2, B], null);
  assert.deepEqual(mm, { moved: 3, kept: 0 }, 'all out to the top level');
  assert.equal(await app.group(A), undefined, 'A was emptied, so it went away');
  let u = await H['groups:undo']();
  assert.equal(u.label, 'Move'); assert.equal(u.moved, 3);
  assert.ok(await app.group(A), 'Undo brings A back, with its own id');
  assert.equal(await noteIn(m1), A); assert.equal(await noteIn(m2), A); assert.equal(await parentOf(B), A);
  assert.equal((await get()).settings.moves.redo, 'Move');
  u = await H['groups:redo']();
  assert.equal(u.moved, 3);
  assert.equal(await app.group(A), undefined, 'Redo moves them out again');
  await H['groups:undo'](); await H['groups:undo'](); // back before the paste: B at the top, m1 and m2 in A
  assert.equal(await parentOf(B), null); assert.equal(await noteIn(m1), A);
  await H['groups:undo'](); // B's "New group": m3 back at the top, B goes away
  assert.equal(await noteIn(m3), null); assert.equal(await app.group(B), undefined);
  await H['groups:redo'](); // and B comes back with m3 in it
  assert.ok(await app.group(B)); assert.equal(await noteIn(m3), B);
  // a new move forgets what Redo had
  await H['groups:undo']();
  assert.ok((await get()).settings.moves.redo);
  await H['groups:move-to'](null, m1, null);
  assert.equal((await get()).settings.moves.redo, null, 'a new move clears Redo');
  await H['groups:undo']();
  assert.equal(await noteIn(m1), A, 'single drags undo too');
  // Ungroup can be undone (the group comes back with its look)
  await H['groups:update'](null, A, { style: 'envelope', color: 'sky' });
  await H['groups:dissolve'](null, A);
  assert.equal(await app.group(A), undefined);
  u = await H['groups:undo']();
  assert.equal(u.label, 'Ungroup');
  assert.equal((await app.group(A)).style, 'envelope', 'its look came back too');
  assert.equal(await noteIn(m1), A); assert.equal(await noteIn(m2), A);
  // a group never goes into its own sub-group, also several at once
  const inner = await H['groups:make-from'](null, [m2], A);
  mm = await H['groups:move-many'](null, [A, m3], inner);
  assert.deepEqual(mm, { moved: 1, kept: 1 }, 'm3 moves, A stays');
  assert.equal(await parentOf(A), null);
  // the look of several groups at once (unknown keys and looks ignored)
  const C = await H['groups:make-from'](null, [m3], null);
  assert.equal(await H['groups:update-many'](null, [A, C, 'nope'], { style: 'notebook', color: 'mint', name: 'x' }), 2);
  for (const gid of [A, C]) { const gg = await app.group(gid); assert.equal(gg.style, 'notebook'); assert.equal(gg.color, 'mint'); assert.notEqual(gg.name, 'x'); }
  // things gone for good stay gone: Undo leaves them out
  await H['groups:move-many'](null, [m3], A);
  await H['list:trash'](null, m3); await H['list:destroy'](null, m3);
  u = await H['groups:undo']();
  assert.equal(u.moved, 0); assert.equal(u.kept, 1, 'the deleted note is skipped');
  // Copy / Paste: copies keep their title; a copied group comes whole (name, look, sub-groups); one Undo step moves the
  // copies to the Bin, Redo brings them back; never into itself
  const k1 = await app.newNote({ html: '<p>kitten</p>' });
  await H['list:edit'](null, k1, { title: 'Kitten', color: 'pink' });
  const box = await H['groups:make-from'](null, [k1], null);
  await H['groups:rename'](null, box, 'Box'); await H['groups:update'](null, box, { style: 'folder' });
  const sub = await H['groups:make-from'](null, [m2], box);
  const target = await H['groups:make-from'](null, [m1], null);
  let cp = await H['groups:copy-many'](null, [k1, box], target);
  assert.deepEqual(cp, { copied: 2, kept: 0 });
  let all = await get();
  const boxCopy = all.groups.find((g) => g.parentId === target && g.id !== box);
  assert.ok(boxCopy && boxCopy.name === 'Box' && boxCopy.style === 'folder', 'the group copy has its name and look');
  assert.ok(all.groups.some((g) => g.parentId === boxCopy.id), 'and its sub-group');
  const k1src = all.notes.find((n) => n.id === k1);
  assert.equal(k1src.title, 'Kitten');
  const copies = all.notes.filter((n) => n.id !== k1 && n.text === k1src.text);
  assert.equal(copies.length, 2, 'the note, and the note inside the copied group');
  assert.ok(copies.every((n) => n.title === k1src.title && !n.title.includes('(copy)')), 'copies keep their title');
  assert.ok(copies.some((n) => n.groupId === target) && copies.some((n) => n.groupId === boxCopy.id));
  assert.equal(await noteIn(k1), box, 'the original stays put');
  assert.equal((await get()).settings.moves.undo, 'Copy');
  u = await H['groups:undo']();
  assert.equal(u.label, 'Copy'); assert.equal(u.moved, 3, 'the three copies');
  all = await get();
  assert.ok(all.notes.filter((n) => copies.some((c) => c.id === n.id) || (n.groupId && n.text === k1src.text && n.id !== k1)).every((n) => n.deletedAt), 'Undo: the copies are in the Bin, not deleted');
  assert.ok(!all.notes.find((n) => n.id === k1).deletedAt, 'the original is not');
  u = await H['groups:redo']();
  assert.equal(u.moved, 3);
  all = await get();
  assert.ok(copies.every((c) => !all.notes.find((n) => n.id === c.id).deletedAt), 'Redo: back from the Bin');
  cp = await H['groups:copy-many'](null, [box], sub);
  assert.deepEqual(cp, { copied: 0, kept: 1 }, 'never into itself');
  for (const n of (await get()).notes.filter((x) => x.text === k1src.text)) { await H['list:trash'](null, n.id); await H['list:destroy'](null, n.id); }
  // nothing left to undo: null (and the history is gone after a restart: memory only)
  while (await H['groups:undo']()) { /* empty it */ }
  assert.equal(await H['groups:undo'](), null);
  assert.equal((await get()).settings.moves.undo, null);
  for (const id of [m1, m2]) { await H['list:trash'](null, id); await H['list:destroy'](null, id); }

  // a group with one note stays; dissolving it, and the tip stays off with no groups left
  const one = await H['groups:make-from'](null, [d], null);
  assert.ok(await app.group(one), 'a group with one note stays');
  for (const gid of (await get()).groups.map((y) => y.id)) await H['groups:dissolve'](null, gid);
  assert.equal((await get()).groups.length, 0, 'dissolved');
  assert.equal((await get()).settings.madeGroup, true, 'the tip stays off, even with no groups left');
  assert.equal(app.readJSON('settings.json').madeGroup, true);
  console.log('ok');
  process.exit(0);
})();
