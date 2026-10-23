// 1.1.13: favourites, several notes at once (colour, new group), locked things can't be deleted,
// dashed/dotted drawing lines, minimise/maximise.
const assert = require('assert'); const path = require('path');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return require.resolve(path.join(__dirname, 'fake-electron', 'index.js')); return orig.call(this, req, ...a); };
const E = require('electron');
global.Response = class { constructor(b, o) { this.status = o?.status; } };
require(path.join(__dirname, '..', 'main.js'));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
const noteWins = () => E.__all.filter((x) => x.file.endsWith('note.html') && !x.destroyed);
(async () => {
  await tick(150);
  const H = E.__handlers;
  const ids = [];
  const winOf = {};
  for (let i = 0; i < 4; i++) {
    await H['list:new']();
    const w = noteWins().pop();
    const id = (await H['note:get'](ev(w))).id;
    ids.push(id); winOf[id] = w;
  }
  const [a, b, c, d] = ids;
  const get = async () => H['list:get']();
  const noteOf = async (id) => (await get()).notes.find((n) => n.id === id);

  // ---- favourites: notes and groups; not an edit
  const before = (await noteOf(a)).updatedAt;
  await tick(20);
  assert.equal(await H['list:favorite'](null, [a, b], true), 2);
  assert.equal((await noteOf(a)).favorite, true);
  assert.equal((await noteOf(b)).favorite, true);
  assert.equal((await noteOf(c)).favorite, false);
  assert.equal((await noteOf(a)).updatedAt, before, 'starring is not an edit');
  await H['list:favorite'](null, [b], false);
  assert.equal((await noteOf(b)).favorite, false);
  // a duplicate is not a favourite
  const dup = await H['list:duplicate'](null, a);
  assert.equal((await noteOf(dup)).favorite, false);
  await H['list:trash'](null, dup);

  // ---- several notes: colour + font, pushed to open windows
  assert.equal(await H['list:apply'](null, [a, c], { color: 'pink', font: 'round', junk: 1 }), 2);
  assert.equal((await noteOf(a)).color, 'pink'); assert.equal((await noteOf(c)).font, 'round');
  assert.equal((await noteOf(b)).color, 'yellow');
  assert.ok(winOf[a].webContents.sent.includes('note:look'), 'open window told about the new colour');
  assert.equal(await H['list:apply'](null, [a], { color: 'neon' }), 0, 'unknown colours are ignored');

  // ---- several notes and a group into a new group
  const g1 = await H['groups:make-from'](null, [a, b], null);
  assert.ok(g1);
  assert.equal((await noteOf(a)).groupId, g1);
  await H['list:favorite'](null, [g1], true);
  assert.equal((await get()).groups.find((g) => g.id === g1).favorite, true, 'groups can be favourites');
  const g2 = await H['groups:make-from'](null, [c, g1], null);
  let list = await get();
  assert.equal(list.groups.find((g) => g.id === g1).parentId, g2, 'the group went inside the new one');
  assert.equal((await noteOf(c)).groupId, g2);
  assert.equal(list.groups.find((g) => g.id === g1).favorite, true, 'still a favourite after moving');
  // never into itself
  const g3 = await H['groups:make-from'](null, [g2, d], g1);
  list = await get();
  assert.notEqual(list.groups.find((g) => g.id === g2).parentId, g3, 'a group is never put inside its own sub-group');

  // ---- locked notes and groups can't be deleted
  assert.ok((await H['lock:set'](null, { next: '2580', kind: 'pin' })).ok);
  await H['list:set-locked'](null, d, true);
  assert.equal((await H['list:trash'](null, d)).error, 'locked');
  assert.equal((await noteOf(d)).deletedAt, null);
  assert.equal((await H['note:trash'](ev(winOf[d]))).error, 'locked', 'not from its own window either');
  await H['groups:set-locked'](null, g2, true);
  assert.equal((await H['groups:trash'](null, g2)).error, 'locked');
  assert.equal((await H['list:trash'](null, a)).error, 'locked', 'a note inside a locked group');
  assert.equal((await noteOf(a)).deletedAt, null);
  // a group with a locked note inside can't be binned as a whole
  await H['groups:set-locked'](null, g2, false, '2580');
  await H['list:set-locked'](null, c, true);
  assert.equal((await H['groups:trash'](null, g2)).error, 'locked');
  await H['list:set-locked'](null, c, false, '2580');
  // Empty bin keeps a note that became locked while in the Bin (its group got locked)
  await H['list:trash'](null, b);
  await H['groups:set-locked'](null, g1, true);
  const r = await H['list:empty-bin']();
  assert.deepEqual(r, { removed: 1, kept: 1 }, 'the duplicate is deleted, the locked one stays');
  assert.ok((await noteOf(b)).deletedAt, 'still in the bin');
  assert.equal((await H['list:destroy'](null, b)).error, 'locked');
  await H['groups:set-locked'](null, g1, false, '2580');
  assert.equal(await H['list:destroy'](null, b), true, 'deletable once the lock is gone');

  // ---- dashed / dotted drawing lines are kept; anything else is a solid line
  await H['note:update'](ev(winOf[c]), { ink: { s: [
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dot', p: [1, 1, 20, 20] },
    { t: 'arrow', c: '#2B2B2B', w: 2, l: 'a', d: 'dash', p: [1, 1, 30, 30] },
    { t: 'rect', c: '#2B2B2B', w: 2, l: 'b', d: 'wavy', o: 5, p: [1, 1, 30, 30] },
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dot', o: 12.34, p: [1, 1, 20, 20] },
    { t: 'pen', c: '#E5484D', w: 4, l: 'a', d: 'dash', o: -3, p: [1, 1, 20, 20] },
  ] } });
  const ink = (await H['note:get'](ev(winOf[c]))).ink.s;
  assert.equal(ink[0].d, 'dot'); assert.equal(ink[1].d, 'dash'); assert.equal(ink[2].d, undefined);
  // 1.1.14: an erased piece remembers where its dash pattern carries on from
  assert.equal(ink[2].o, undefined, 'no offset on a solid line');
  assert.equal(ink[3].o, 12.3);
  assert.equal(ink[4].o, undefined, 'nonsense offsets are dropped');

  // ---- zoom inside a note: kept per note, 50–300 %, not an edit
  const ed = (await H['note:get'](ev(winOf[c]))).updatedAt;
  await tick(20);
  await H['note:update'](ev(winOf[c]), { zoom: 1.5 });
  let zn = await H['note:get'](ev(winOf[c]));
  assert.equal(zn.zoom, 1.5); assert.equal(zn.updatedAt, ed, 'zooming is not an edit');
  await H['note:update'](ev(winOf[c]), { zoom: 9 });
  assert.equal((await H['note:get'](ev(winOf[c]))).zoom, 3, 'at most 300 %');
  await H['note:update'](ev(winOf[c]), { zoom: 'x' });
  assert.equal((await H['note:get'](ev(winOf[c]))).zoom, 1, 'nonsense = 100 %');

  // ---- minimise / maximise
  const w = winOf[c];
  await H['note:update'](ev(w), { pinned: true });
  await H['note:minimize'](ev(w));
  assert.equal(w.isMinimized(), true);
  await tick(60);
  assert.equal(w.isMinimized(), true, 'a pinned note stays down when its own button minimised it');
  w.restore();
  assert.equal(w.userMin, false); assert.equal(w.minimizable, false, 'the system minimise stays off again');
  assert.equal(await H['note:maximize'](ev(w)), true);
  assert.equal(w.isMaximized(), true);
  assert.equal(await H['note:maximize'](ev(w)), false, 'again: back to normal');
  // a rolled-up note unrolls before maximising
  await H['note:update'](ev(w), { rolled: true });
  await H['note:maximize'](ev(w));
  assert.equal((await H['note:get'](ev(w))).rolled, false);
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
