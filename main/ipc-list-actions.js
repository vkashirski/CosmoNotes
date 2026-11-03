'use strict';
const { ipcMain } = require('electron');
const { cleanFx, FONTS } = require('../store');
const { PAPER } = require('./constants');
const { checkPassword, isLocked, viewOf, wait } = require('./locks');
const { notifyList } = require('./list-notify');
const { applyState, setWinTitle } = require('./note-state');
const { groupOpenInList, hiddenInList, hideNewlyLocked, listOpenGroups, openForNow, pushLook, unlockedForNow } = require('./list-visibility');
const { bringToFront, createNote, openNoteWindow } = require('./note-window');
const { S, wins } = require('./state');

// 1.1.47: a note just unlocked for now: its open window shows it without the password
function showForNow(n) {
  const win = wins.get(n.id);
  if (!win || win.isDestroyed() || !isLocked(n) || !openForNow(n) || (win.revealed && !win.lockPending)) return;
  win.revealed = true;
  win.lockPending = false;
  setWinTitle(win, n);
  win.webContents.send('note:look', viewOf(n, win));
}
// ... and locked again: its open window saves what was typed, then hides itself (like locking from the list)
function hideAgain(n) {
  const win = wins.get(n.id);
  if (!win || win.isDestroyed() || !isLocked(n) || !win.revealed || win.lockPending || openForNow(n)) return;
  win.lockPending = true;
  win.webContents.send('note:lock-now');
}

function registerListActionIpc() {
  // ---------- locking from the list (right-click / group settings)
  ipcMain.handle('list:set-locked', async (e, noteId, locked, pw) => {
    const n = S.store.get(noteId);
    if (!n) return { error: 'missing' };
    if (locked) {
      if (!S.store.settings.lock) return { error: 'no-password' };
      n.locked = true;
      unlockedForNow.delete(n.id); // locked again: no longer unlocked for now
      S.store.writeNow(n.id);
      hideNewlyLocked();
    } else {
      if (!(await checkPassword(pw))) { await wait(450); return { error: 'wrong' }; }
      n.locked = false;
      unlockedForNow.delete(n.id);
      S.store.writeNow(n.id);
      pushLook(n.id);
    }
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('groups:set-locked', async (e, groupId, locked, pw) => {
    const g = S.store.groups.get(groupId);
    if (!g) return { error: 'missing' };
    if (locked) {
      if (!S.store.settings.lock) return { error: 'no-password' };
      S.store.updateGroup(groupId, { locked: true });
      for (const id of S.store.subtree(groupId)) { listOpenGroups.delete(id); unlockedForNow.delete(id); }
      hideNewlyLocked();
    } else {
      if (!(await checkPassword(pw))) { await wait(450); return { error: 'wrong' }; }
      S.store.updateGroup(groupId, { locked: false });
      unlockedForNow.delete(groupId);
      for (const n of S.store.notesInTree(groupId)) pushLook(n.id);
    }
    notifyList();
    return { ok: true };
  });
  // open a locked group in the list (until the list is closed or "Lock again")
  ipcMain.handle('groups:reveal', async (e, groupId, pw) => {
    if (!S.store.groups.has(groupId)) return { error: 'missing' };
    if (!(await checkPassword(pw))) { await wait(450); return { error: 'wrong' }; }
    listOpenGroups.add(groupId);
    notifyList();
    return { ok: true };
  });
  // 1.1.47 (the owner's wish): right-click → "Unlock…" in the list unlocks a note or a group (with the password) until
  // CosmoNotes quits. The lock stays: after a restart it is locked again. "Remove lock…" removes it for good.
  ipcMain.handle('list:unlock-now', async (e, id, pw) => {
    const g = S.store.groups.get(id);
    const n = g ? null : S.store.get(id);
    if (!g && !n) return { error: 'missing' };
    if (!(await checkPassword(pw))) { await wait(450); return { error: 'wrong' }; }
    unlockedForNow.add(id);
    for (const m of g ? S.store.notesInTree(id) : [n]) showForNow(m);
    notifyList();
    return { ok: true };
  });
  // ... and "Lock again" (no password needed); a group also closes in the list
  ipcMain.handle('list:relock', (e, id) => {
    const g = S.store.groups.get(id);
    const n = g ? null : S.store.get(id);
    if (!g && !n) return { error: 'missing' };
    if (g) for (const x of S.store.subtree(id)) { unlockedForNow.delete(x); listOpenGroups.delete(x); }
    else unlockedForNow.delete(id);
    for (const m of g ? S.store.notesInTree(id) : [n]) hideAgain(m);
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('groups:hide', (e, groupId) => {
    for (const id of S.store.subtree(groupId)) listOpenGroups.delete(id);
    notifyList();
  });
  ipcMain.handle('list:new', (e, groupId) => { createNote({ groupId }); });
  // 1.1.15: the Locked tab. "Unlock all" (with the password) uncovers every locked note and group in the list;
  // "Lock again" covers them again, also in open note windows that were unlocked.
  ipcMain.handle('list:unlock-all', async (e, pw) => {
    if (!(await checkPassword(pw))) { await wait(450); return { ok: false }; }
    S.listUnlockedAll = true;
    notifyList();
    return { ok: true };
  });
  ipcMain.handle('list:lock-all', () => {
    S.listUnlockedAll = false;
    listOpenGroups.clear();
    unlockedForNow.clear(); // 1.1.47: also what was unlocked for now
    for (const [id, win] of wins) {
      const n = S.store.get(id);
      if (!n || win.isDestroyed()) continue;
      // the window saves what was typed, then hides itself (like locking from the list)
      if (isLocked(n) && win.revealed) { win.lockPending = true; win.webContents.send('note:lock-now'); }
    }
    notifyList();
    return true;
  });
  ipcMain.handle('list:open-note', (e, id) => {
    const n = S.store.get(id);
    if (!n || n.deletedAt) return;
    n.open = true;
    S.store.save(n.id);
    const fresh = !wins.has(n.id);
    const win = openNoteWindow(n, { focus: true });
    // Its locked group was just opened with the password in the list (or everything was, with "Unlock all"),
    // so don't ask again. 1.1.47: also a note unlocked for now (openNoteWindow already shows it; this is for "Unlock all").
    if (fresh && isLocked(n) && (S.listUnlockedAll || openForNow(n))) { win.revealed = true; setWinTitle(win, n); }
    notifyList();
  });
  ipcMain.handle('list:close-note', (e, id) => {
    const n = S.store.get(id);
    if (!n) return;
    n.open = false;
    S.store.writeNow(n.id);
    const win = wins.get(id);
    if (win && !win.isDestroyed()) win.close();
    notifyList();
  });
  // 1.1.13: a locked note (its own lock or a locked group around it) can't be deleted: remove the lock first
  ipcMain.handle('list:trash', (e, id) => {
    const n = S.store.get(id);
    if (n && isLocked(n)) return { error: 'locked' };
    const win = wins.get(id);
    S.store.trash(id);
    if (win && !win.isDestroyed()) win.close();
    notifyList();
  });
  ipcMain.handle('list:restore', (e, id) => { S.store.restore(id); notifyList(); });
  // ---------- favourites and things done to several selected cards at once (1.1.13)
  // star or un-star notes and groups (not an edit: "last edited" stays the same)
  ipcMain.handle('list:favorite', (e, ids = [], on = true) => {
    let count = 0;
    for (const id of [].concat(ids)) {
      if (S.store.groups.has(id)) { S.store.updateGroup(id, { favorite: !!on }); count++; }
      else if (S.store.get(id)) { S.store.update(id, { favorite: !!on }); count++; }
    }
    notifyList();
    return count;
  });
  // paper colour / font for several notes
  // 1.1.15: right-click → Edit… in the list: a note's title and colour. An open window of the note gets the
  // change straight away ('note:look'), so both stay the same. A new title counts as an edit; a colour doesn't.
  ipcMain.handle('list:edit', (e, id, patch = {}) => {
    const n = S.store.get(id);
    if (!n || n.deletedAt || !patch || typeof patch !== 'object') return null;
    const clean = {};
    // 1.1.30: on a locked card the title field is the "title while locked" (the real one is hidden and sealed)
    if (typeof patch.title === 'string') { if (hiddenInList(n)) clean.coverTitle = patch.title; else clean.title = patch.title; }
    if (typeof patch.coverTitle === 'string') clean.coverTitle = patch.coverTitle;
    if (PAPER[patch.color]) clean.color = patch.color;
    // 1.1.20 (Edit design): see-through and the note's own effects; neither counts as an edit
    if (Number.isFinite(Number(patch.opacity)) && patch.opacity !== null && patch.opacity !== '' && typeof patch.opacity !== 'boolean') clean.opacity = Math.min(1, Math.max(0.25, Math.round(Number(patch.opacity) * 20) / 20));
    if (patch.fx && typeof patch.fx === 'object') clean.fx = cleanFx(patch.fx);
    // 1.2.2 (Edit design for several notes): only the effect settings that were changed, the rest stays as each note has it
    else if (patch.fxKeys && typeof patch.fxKeys === 'object') clean.fx = cleanFx({ ...(n.fx || {}), ...patch.fxKeys });
    if (!Object.keys(clean).length) return null;
    const oldTitle = n.title;
    S.store.update(n.id, clean, { content: false });
    const m = S.store.get(n.id);
    if (m.title !== oldTitle) S.store.update(n.id, {}, { content: true }); // counts as an edit (updatedAt)
    const win = wins.get(n.id);
    if (win && !win.isDestroyed()) {
      if ('color' in clean || 'opacity' in clean) applyState(win, m);
      else setWinTitle(win, m);
      win.webContents.send('note:look', viewOf(m, win));
    }
    notifyList();
    return { updatedAt: m.updatedAt, title: hiddenInList(m) ? m.coverTitle : m.title, coverTitle: m.coverTitle, color: m.color, opacity: m.opacity, fx: m.fx };
  });

  ipcMain.handle('list:apply', (e, ids = [], patch = {}) => {
    const clean = {};
    if (PAPER[patch.color]) clean.color = patch.color;
    if (FONTS.includes(patch.font)) clean.font = patch.font;
    if (!Object.keys(clean).length) return 0;
    let count = 0;
    for (const id of [].concat(ids)) {
      const n = S.store.get(id);
      if (!n || n.deletedAt) continue;
      S.store.update(n.id, clean);
      pushLook(n.id);
      count++;
    }
    notifyList();
    return count;
  });
  // put several notes and groups together in a new group, made inside `parentId` (null = top level).
  // Things hidden by a locked group that isn't open in the list are left where they are.
  ipcMain.handle('groups:make-from', (e, ids = [], parentId = null) => {
    parentId = parentId && S.store.groups.has(parentId) ? parentId : null;
    const noteIds = [];
    const groupIds = [];
    for (const id of [].concat(ids)) {
      if (S.store.groups.has(id)) {
        const g = S.store.groups.get(id);
        if (!groupOpenInList(g.parentId)) continue;
        if (parentId && (parentId === id || S.store.isInside(parentId, id))) continue; // never inside itself
        groupIds.push(id);
      } else {
        const n = S.store.get(id);
        if (n && !n.deletedAt && groupOpenInList(n.groupId)) noteIds.push(id);
      }
    }
    if (noteIds.length + groupIds.length < 1) return null;
    const g = S.store.createGroup(noteIds, { parentId });
    for (const id of groupIds) S.store.setParent(id, g.id);
    S.store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    return g.id;
  });
  // (the list window asks "are you sure?" in its own style before calling these)
  ipcMain.handle('list:destroy', async (e, id) => {
    const n = S.store.get(id);
    if (n && isLocked(n)) return { error: 'locked' };
    S.store.destroy(id);
    notifyList();
    return true;
  });
  ipcMain.handle('list:empty-bin', async () => {
    const binned = S.store.all().filter((n) => n.deletedAt);
    if (!binned.length) return false;
    // locked notes stay in the Bin (they can't be deleted while locked)
    const kept = binned.filter((n) => isLocked(n)).length;
    for (const n of binned) if (!isLocked(n)) S.store.destroy(n.id);
    notifyList();
    return { removed: binned.length - kept, kept };
  });
  ipcMain.handle('list:bring-front', () => bringToFront({ unroll: true }));
}

module.exports = { registerListActionIpc };
