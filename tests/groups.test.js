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
