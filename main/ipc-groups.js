'use strict';
const { app, ipcMain } = require('electron');
const { checklistMarks, cardRuns, pictureWords, picturePlace, lineCount, FONTS, overrideCounts } = require('../store');
const { eveOnFor, evePhase } = require('./evening');
const { shortcutError } = require('./panic');
const { PAPER } = require('./constants');
const { isLocked, viewOf } = require('./locks');
const { lockInfo } = require('./settings');
const crypt = require('./crypt');
const { notifyList } = require('./list-notify');
const { applyState } = require('./note-state');
const { groupOpenInList, groupShut, hiddenInList, hideNewlyLocked, revealedNow, unlockedForNow } = require('./list-visibility');
const { showList } = require('./list-window');
const { recorded, recordCopy, undoMove, redoMove, moveHistory } = require('./move-history');
const REMIND = require('../src/reminders');
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
        coverTitle: n.coverTitle,
        text: hiddenInList(n) ? '' : n.text.slice(0, 600),
        pics: hiddenInList(n) ? '' : pictureWords(n.html), // 1.1.23: picture descriptions, so the search finds them
        checks: hiddenInList(n) ? '' : checklistMarks(n.html, n.text.slice(0, 600)), // 1.1.22: which lines are checklist boxes (o) / ticked (x)
        runs: hiddenInList(n) ? null : cardRuns(n.html, n.text.slice(0, 600), n.font), // 1.3.11: the look of each line (font, colour, bold…), null = plain
        firstImage: hiddenInList(n) ? null : n.firstImage,
        pic: hiddenInList(n) || !n.firstImage ? null : picturePlace(n), // 1.1.46: where the first picture is, and its size
        lines: hiddenInList(n) ? 0 : lineCount(n.text), // 1.1.46: the card's "+3 lines" (text above is cut at 600 letters)
        locked: hiddenInList(n), // shown as a locked card
        ownLock: n.locked, // the note's own lock (vs. a locked group)
        forNow: !!n.locked && unlockedForNow.has(n.id), // 1.1.47: its own lock is unlocked until CosmoNotes quits
        openUnlocked: isLocked(n) && revealedNow(n), // locked, but unlocked for now in its open window
        color: n.color,
        font: n.font,
        zoom: n.zoom, // 1.3.13: a zoomed-out note's card shows its words smaller too
        titleFont: n.titleFont, // 1.3.3: not secret (only the look of the title)
        pinned: n.pinned,
        clickThrough: n.clickThrough, // 1.3.34: right-click → Turn off click-through
        // 1.4.5: the apps it is pinned over (the card says "Over …"); not of a note its lock hides (only that it has some)
        pinApps: hiddenInList(n) ? [] : n.pinApps,
        appPinned: n.pinApps.length > 0,
        favorite: n.favorite,
        tags: hiddenInList(n) ? [] : n.tags, // 1.4.10: secret like its words (src/tags.js)
        fx: n.fx, // 1.1.16: the card shows the note's effect too
        opacity: n.opacity, // 1.1.20: for the Edit design sheet's see-through slider
        fxPaused: n.fxPaused,
        fxPlay: n.fxPlay,
        eve: eveOnFor(n), // 1.3.27: its card takes the evening colours too
        evening: n.evening, // and the note's own choice (null = as in Settings)
        panic: n.panic, // 1.3.27: false = the panic button leaves it open
        // 1.4.1: its reminders (times only: their messages come with list:remind-get, main/reminders.js), and whether one
        // hides it from the list (src/list/base.js live)
        reminders: n.reminders,
        remHidden: REMIND.hiddenNow(n.reminders),
        groupId: n.groupId,
        open: wins.has(n.id),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
        restoredFrom: n.restoredFrom,
      })),
      groups: [...S.store.groups.values()].map((g) => ({ ...g, open: groupOpenInList(g.id), forNow: !!g.locked && unlockedForNow.has(g.id) })),
      settings: { ...settings, ...lockInfo(), hasPassword: !!lock, dataPath: S.store.root, version: app.getVersion(), unlockedAll: S.listUnlockedAll, crypt: crypt.status(),
        // 1.3.27: how far into the evening it is; how many notes have their own value of each setting (Use on all notes);
        // what went wrong with the panic shortcut ('taken' by another app | 'bad' | null)
        evePhase: evePhase(), overrides: overrideCounts(S.store.all(), S.store.settings), panicKeyError: shortcutError(),
        // 1.4.9: what Undo / Redo of a move would do now (main/move-history.js)
        moves: moveHistory() },
    };
  });

  // ---------- groups: a folder tree made by dragging in the list
  // 1.3.28 (the owner's wish): nothing here changes a note or group its lock hides in the list (`hiddenInList`, `groupShut`),
  // nor puts anything into such a group: unlock it first
  const shut = (id) => (S.store.groups.has(id) ? groupShut(id) : !!S.store.get(id) && hiddenInList(S.store.get(id)));
  // 1.4.9: every change of where things sit goes through `recorded` (main/move-history.js), so Ctrl+Z in the list undoes it
  ipcMain.handle('groups:make', (e, dragId, targetId) => recorded('Move', () => {
    if (!dragId || dragId === targetId || shut(dragId) || shut(targetId)) return null;
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
  }));
  // one level up: a note leaves its group, a group leaves its parent
  const moveUp = (id) => {
    if (shut(id)) return;
    const g = S.store.groups.get(id);
    if (g) S.store.setParent(id, g.parentId ? S.store.groups.get(g.parentId)?.parentId : null);
    else {
      const n = S.store.get(id);
      if (n && n.groupId) S.store.setGroup(id, S.store.groups.get(n.groupId)?.parentId || null);
    }
    S.store.cleanupGroups();
    notifyList();
  };
  ipcMain.handle('groups:move-up', (e, id) => recorded('Move', () => moveUp(id)));
  // put one note or group straight into a group (or the top level with null); false = it can't go there
  const putIn = (id, groupId) => {
    if (shut(id)) return false;
    if (S.store.groups.has(id)) return S.store.setParent(id, groupId);
    if (!S.store.get(id)) return false;
    S.store.setGroup(id, groupId);
    return true;
  };
  // move a note or group straight into a group (or to the top level with null)
  ipcMain.handle('groups:move-to', (e, id, groupId) => recorded('Move', () => {
    groupId = groupId && S.store.groups.has(groupId) ? groupId : null;
    if (groupShut(groupId) || !putIn(id, groupId)) return false;
    S.store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    return true;
  }));
  // 1.4.9: several picked notes and groups into one group (or the top level) at once: one Undo step. Used by dragging
  // several cards, Move out and Paste (`how` names the step: 'Move' | 'Paste'). Returns how many moved and how many
  // couldn't (locked, or a group into itself).
  ipcMain.handle('groups:move-many', (e, ids = [], groupId = null, how = 'Move') => recorded(how === 'Paste' ? 'Paste' : 'Move', () => {
    groupId = groupId && S.store.groups.has(groupId) ? groupId : null;
    const list = [...new Set([].concat(ids))].filter((id) => S.store.groups.has(id) || S.store.get(id));
    if (groupShut(groupId)) return { moved: 0, kept: list.length };
    let moved = 0;
    let kept = 0;
    for (const id of list) {
      const was = S.store.groups.has(id) ? S.store.groups.get(id).parentId || null : S.store.get(id).groupId || null;
      if (was === groupId) continue; // already there
      if (putIn(id, groupId)) moved++; else kept++;
    }
    S.store.cleanupGroups();
    hideNewlyLocked();
    notifyList();
    return { moved, kept };
  }));
  // 1.4.9: Copy / Paste: copies of the picked notes and groups (with everything inside) in a group or the top level. A
  // copy keeps its title (it is somewhere else), look, words, pictures and lock; not its reminders, pin or window
  // place (store.js `duplicate`). A copied group gets the name, look, colour and lock of the original. Nothing a lock
  // hides is copied, and a group is never copied into itself. One Undo step (main/move-history.js recordCopy).
  ipcMain.handle('groups:copy-many', (e, ids = [], groupId = null) => {
    groupId = groupId && S.store.groups.has(groupId) ? groupId : null;
    const list = [...new Set([].concat(ids))].filter((id) => S.store.groups.has(id) || S.store.get(id));
    if (groupShut(groupId)) return { copied: 0, kept: list.length };
    const made = [];
    const copyNote = (id, gid) => {
      const n = S.store.get(id);
      if (!n || n.deletedAt || hiddenInList(n)) return false;
      const c = S.store.duplicate(id, { groupId: gid, open: false, ...(n.enc ? {} : { title: n.title }) });
      if (c) made.push(c.id);
      return !!c;
    };
    const copyGroup = (gid, parent) => {
      if (groupShut(gid) || (parent && (parent === gid || S.store.isInside(parent, gid)))) return false;
      const g = S.store.groups.get(gid);
      const notes = S.store.all().filter((n) => n.groupId === gid && !n.deletedAt); // what it holds now, before the copy
      const kids = [...S.store.groups.values()].filter((c) => c.parentId === gid);
      const copy = S.store.createGroup([], { name: g.name, parentId: parent });
      S.store.updateGroup(copy.id, { style: g.style, color: g.color, locked: g.locked });
      for (const n of notes) copyNote(n.id, copy.id);
      for (const c of kids) copyGroup(c.id, copy.id);
      return true;
    };
    let copied = 0;
    for (const id of list) if (S.store.groups.has(id) ? copyGroup(id, groupId) : copyNote(id, groupId)) copied++;
    S.store.cleanupGroups(); // a copied group with nothing in it goes, like any empty group
    hideNewlyLocked();
    notifyList();
    recordCopy('Copy', made);
    return { copied, kept: list.length - copied };
  });
  ipcMain.handle('groups:undo', () => undoMove());
  ipcMain.handle('groups:redo', () => redoMove());
  ipcMain.handle('groups:ungroup', (e, noteId) => recorded('Move', () => moveUp(noteId)));
  ipcMain.handle('groups:dissolve', (e, groupId) => recorded('Ungroup', () => { if (groupShut(groupId)) return; S.store.dissolveGroup(groupId); notifyList(); }));
  ipcMain.handle('groups:rename', (e, groupId, name) => { if (groupShut(groupId)) return; S.store.renameGroup(groupId, name); notifyList(); });
  ipcMain.handle('groups:update', (e, groupId, patch = {}) => {
    if (groupShut(groupId)) return;
    const clean = {};
    for (const k of ['name', 'style', 'color']) if (k in patch) clean[k] = patch[k];
    S.store.updateGroup(groupId, clean);
    notifyList();
  });
  // 1.4.9: the look (stack / folder / envelope / notebook) and colour of several picked groups at once
  ipcMain.handle('groups:update-many', (e, ids = [], patch = {}) => {
    const clean = {};
    for (const k of ['style', 'color']) if (k in patch) clean[k] = patch[k];
    let count = 0;
    for (const id of [].concat(ids)) {
      if (!S.store.groups.has(id) || groupShut(id)) continue;
      S.store.updateGroup(id, clean);
      count++;
    }
    if (count) notifyList();
    return count;
  });
  // change colour / font of every note in a group (and the groups inside it)
  ipcMain.handle('groups:apply', (e, groupId, patch = {}, includeInner = true) => {
    const clean = {};
    if (PAPER[patch.color]) clean.color = patch.color;
    if (FONTS.includes(patch.font)) clean.font = patch.font;
    if (!Object.keys(clean).length || !S.store.groups.has(groupId) || groupShut(groupId)) return 0;
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
