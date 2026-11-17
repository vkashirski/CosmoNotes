'use strict';
// 1.4.9 (the owner's wish): Undo / Redo for moves in the notes list (Ctrl+Z / Ctrl+Y there).
// A move is anything that changes where notes and groups sit: dragging into a group or up a level, Move out, Paste,
// making a group from several, Ungroup. `recorded(label, fn)` runs the change and keeps what moved: for each note
// ('n:id') and group ('g:id') whose place changed, where it was and where it went (a group id or null = top level),
// plus a copy of every group on those paths, so a group the move emptied (and cleanupGroups took away) or Ungroup
// removed can come back with its own id, look and lock (store.js `restoreGroup`).
// Undo puts everything back where it was, Redo where it went. Things that are gone (deleted for good), or hidden by
// a lock that isn't open in the list, stay where they are (1.3.28: a locked one is never changed). The history lives
// in memory only: it starts empty each time CosmoNotes starts.
// Paste of copies (`recordCopy`) is a step too, so Ctrl+Z after it never undoes an older move instead: Undo moves the
// copies to the Bin (never deleted: the Bin keeps them; a locked copy stays, since locked notes can't be binned) and
// Redo brings them back from the Bin.
const { notifyList } = require('./list-notify');
const { groupShut, hiddenInList, hideNewlyLocked } = require('./list-visibility');
const { S, wins } = require('./state');

const LIMIT = 50;
const undos = [];
const redos = [];

// where every note and group sits now: 'n:id' / 'g:id' → group id or null (notes in the Bin too: they keep their group)
function places() {
  const m = new Map();
  for (const n of S.store.all()) m.set(`n:${n.id}`, n.groupId || null);
  for (const g of S.store.groups.values()) m.set(`g:${g.id}`, g.parentId || null);
  return m;
}
// copies of group `id` and the groups around it, from `groups` (a Map of id → group), into `out`
function copyChain(id, groups, out) {
  for (let cur = id; cur && groups.has(cur) && !out[cur]; cur = groups.get(cur).parentId) out[cur] = { ...groups.get(cur) };
}

function push(step) {
  undos.push(step);
  if (undos.length > LIMIT) undos.shift();
  redos.length = 0;
}
// the notes a paste of copies made (ids)
function recordCopy(label, made) {
  if (made.length) push({ label, copies: [...made] });
}

function recorded(label, fn) {
  const before = places();
  const groupsBefore = new Map([...S.store.groups].map(([id, g]) => [id, { ...g }]));
  const result = fn();
  const after = places();
  const moves = [];
  for (const [k, to] of after) if (before.has(k) && before.get(k) !== to) moves.push({ k, from: before.get(k), to });
  if (moves.length) {
    const groups = {};
    for (const m of moves) {
      copyChain(m.from, groupsBefore, groups);
      copyChain(m.to, S.store.groups, groups);
      if (m.k[0] === 'g') copyChain(m.k.slice(2), groupsBefore, groups);
    }
    push({ label, moves, groups });
  }
  return result;
}

// bring back group `id` (and the ones around it) if a move took it away; false = it can't be there
function ensureGroup(id, step) {
  if (!id) return true;
  if (S.store.groups.has(id)) return true;
  const copy = step.groups[id];
  if (!copy) return false;
  if (copy.parentId) ensureGroup(copy.parentId, step);
  return !!S.store.restoreGroup(copy);
}

// copies: to the Bin (back = true) or back from it
function replayCopies(step, back) {
  let moved = 0;
  let kept = 0;
  for (const id of step.copies) {
    const n = S.store.get(id);
    if (!n || hiddenInList(n) || n.locked || !!n.deletedAt === back) { kept++; continue; }
    if (back) {
      const win = wins.get(id);
      S.store.trash(id);
      if (win && !win.isDestroyed()) win.close();
    } else S.store.restore(id);
    moved++;
  }
  notifyList();
  return { label: step.label, moved, kept };
}

// put everything of `step` where it was (back = true) or where it went
function replay(step, back) {
  if (step.copies) return replayCopies(step, back);
  let moved = 0;
  let kept = 0;
  for (const m of step.moves) {
    const id = m.k.slice(2);
    const want = back ? m.from : m.to;
    const isGroup = m.k[0] === 'g';
    const thing = isGroup ? (S.store.groups.has(id) || step.groups[id]) : S.store.get(id);
    if (!thing || (isGroup ? (S.store.groups.has(id) && groupShut(id)) : hiddenInList(thing))) { kept++; continue; }
    if (!ensureGroup(want, step) || groupShut(want)) { kept++; continue; }
    if (isGroup) {
      if (!ensureGroup(id, step) || !S.store.setParent(id, want)) { kept++; continue; }
    } else if ((S.store.get(id).groupId || null) !== want) S.store.setGroup(id, want);
    moved++;
  }
  S.store.cleanupGroups();
  hideNewlyLocked();
  notifyList();
  return { label: step.label, moved, kept };
}

function undoMove() {
  const step = undos.pop();
  if (!step) return null;
  redos.push(step);
  return replay(step, true);
}
function redoMove() {
  const step = redos.pop();
  if (!step) return null;
  undos.push(step);
  return replay(step, false);
}
// what Undo / Redo would do now (the list shows it), null = nothing
const moveHistory = () => ({ undo: undos.length ? undos[undos.length - 1].label : null, redo: redos.length ? redos[redos.length - 1].label : null });

module.exports = { recorded, recordCopy, undoMove, redoMove, moveHistory };
