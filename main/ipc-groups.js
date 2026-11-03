'use strict';
const { app, ipcMain } = require('electron');
const { checklistMarks, pictureWords, picturePlace, lineCount, FONTS } = require('../store');
const { PAPER } = require('./constants');
const { isLocked, viewOf } = require('./locks');
const { lockInfo } = require('./settings');
const crypt = require('./crypt');
const { notifyList } = require('./list-notify');
const { applyState } = require('./note-state');
const { groupOpenInList, hiddenInList, hideNewlyLocked, revealedNow, unlockedForNow } = require('./list-visibility');
const { showList } = require('./list-window');
const { S, wins } = require('./state');

function registerGroupIpc() {
  // list window
  ipcMain.handle('list:show', () => showList());
  ipcMain.handle('list:get', () => {
    const { lock, crypt: keys, ...settings } = S.store.settings;
    return {
      notes: S.store.all().map((n) => ({
        id: n.id,
        // 1.1.30: a locked card shows (and searches) its "title while locked"; the real title stays hidden like the words
        title: hiddenInList(n) ? n.coverTitle : n.title,
        cover: hiddenInList(n), // the title above is the cover title (the Edit sheet then changes that one)
        coverTitle: n.coverTitle,
        text: hiddenInList(n) ? '' : n.text.slice(0, 600),
        pics: hiddenInList(n) ? '' : pictureWords(n.html), // 1.1.23: picture descriptions, so the search finds them
        checks: hiddenInList(n) ? '' : checklistMarks(n.html, n.text.slice(0, 600)), // 1.1.22: which lines are checklist boxes (o) / ticked (x)
        firstImage: hiddenInList(n) ? null : n.firstImage,
        pic: hiddenInList(n) || !n.firstImage ? null : picturePlace(n), // 1.1.46: where the first picture is, and its size
        lines: hiddenInList(n) ? 0 : lineCount(n.text), // 1.1.46: the card's "+3 lines" (text above is cut at 600 letters)
        locked: hiddenInList(n), // shown as a locked card
        ownLock: n.locked, // the note's own lock (vs. a locked group)
        forNow: !!n.locked && unlockedForNow.has(n.id), // 1.1.47: its own lock is unlocked until CosmoNotes quits
        openUnlocked: isLocked(n) && revealedNow(n), // locked, but unlocked for now in its open window
        color: n.color,
        font: n.font,
        pinned: n.pinned,
        favorite: n.favorite,
        fx: n.fx, // 1.1.16: the card shows the note's effect too
        opacity: n.opacity, // 1.1.20: for the Edit design sheet's see-through slider
        fxPaused: n.fxPaused,
        fxPlay: n.fxPlay,
        groupId: n.groupId,
        open: wins.has(n.id),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
        restoredFrom: n.restoredFrom,
      })),
      groups: [...S.store.groups.values()].map((g) => ({ ...g, open: groupOpenInList(g.id), forNow: !!g.locked && unlockedForNow.has(g.id) })),
      settings: { ...settings, ...lockInfo(), hasPassword: !!lock, dataPath: S.store.root, version: app.getVersion(), unlockedAll: S.listUnlockedAll, crypt: crypt.status() },
    };
  });

  // ---------- groups: a folder tree made by dragging in the list
  ipcMain.handle('groups:make', (e, dragId, targetId) => {
    if (!dragId || dragId === targetId) return null;
    const dragGroup = S.store.groups.get(dragId);
    const target = S.store.get(targetId);
    const targetGroup = S.store.groups.get(targetId);
    if (dragGroup) {
      // a group can be dropped into another group (never into itself or its own sub-groups)
      if (!targetGroup || !S.store.setParent(dragId, targetId)) return null;
    } else {
      const note = S.store.get(dragId);
      if (!note) return null;
      if (targetGroup) S.store.setGroup(dragId, targetId);
      else if (target) {
        if (target.groupId && target.groupId !== note.groupId) S.store.setGroup(dragId, target.groupId);
        else S.store.createGroup([targetId, dragId], { parentId: target.groupId }); // new group, inside the current one
      } else return null;
    }
    S.store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    // where the dragged note/group ended up
    return dragGroup ? S.store.groups.get(dragId)?.parentId || null : S.store.get(dragId)?.groupId || null;
  });
  // one level up: a note leaves its group, a group leaves its parent
  const moveUp = (id) => {
    const g = S.store.groups.get(id);
    if (g) S.store.setParent(id, g.parentId ? S.store.groups.get(g.parentId)?.parentId : null);
    else {
      const n = S.store.get(id);
      if (n && n.groupId) S.store.setGroup(id, S.store.groups.get(n.groupId)?.parentId || null);
    }
    S.store.cleanupGroups();
    notifyList();
  };
  ipcMain.handle('groups:move-up', (e, id) => moveUp(id));
  // move a note or group straight into a group (or to the top level with null)
  ipcMain.handle('groups:move-to', (e, id, groupId) => {
    groupId = groupId && S.store.groups.has(groupId) ? groupId : null;
    if (S.store.groups.has(id)) { if (!S.store.setParent(id, groupId)) return false; } else if (S.store.get(id)) S.store.setGroup(id, groupId);
    else return false;
    S.store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    return true;
  });
  ipcMain.handle('groups:ungroup', (e, noteId) => moveUp(noteId));
  ipcMain.handle('groups:dissolve', (e, groupId) => { S.store.dissolveGroup(groupId); notifyList(); });
  ipcMain.handle('groups:rename', (e, groupId, name) => { S.store.renameGroup(groupId, name); notifyList(); });
  ipcMain.handle('groups:update', (e, groupId, patch = {}) => {
    const clean = {};
    for (const k of ['name', 'style', 'color']) if (k in patch) clean[k] = patch[k];
    S.store.updateGroup(groupId, clean);
    notifyList();
  });
  // change colour / font of every note in a group (and the groups inside it)
  ipcMain.handle('groups:apply', (e, groupId, patch = {}, includeInner = true) => {
    const clean = {};
    if (PAPER[patch.color]) clean.color = patch.color;
    if (FONTS.includes(patch.font)) clean.font = patch.font;
    if (!Object.keys(clean).length || !S.store.groups.has(groupId)) return 0;
    const notes = includeInner ? S.store.notesInTree(groupId) : S.store.all().filter((n) => n.groupId === groupId && !n.deletedAt);
    for (const n of notes) {
      S.store.update(n.id, clean);
      const win = wins.get(n.id);
      if (win && !win.isDestroyed()) {
        applyState(win, n);
        win.webContents.send('note:look', viewOf(n, win));
      }
    }
    notifyList();
    return notes.length;
  });
  ipcMain.handle('groups:trash', (e, groupId) => {
    const notes = S.store.notesInTree(groupId);
    // the group or something in it is locked: nothing is moved (remove the lock first)
    if (notes.some((n) => isLocked(n))) return { error: 'locked' };
    for (const n of notes) {
      const win = wins.get(n.id);
      S.store.trash(n.id);
      if (win && !win.isDestroyed()) win.close();
    }
    notifyList();
    return notes.length;
  });
}

module.exports = { registerGroupIpc };
