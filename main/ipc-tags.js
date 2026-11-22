'use strict';
// 1.4.30 (the owner's wish, like GitHub labels): every tag from any note. The note's ⋯ menu lists every tag (tags:all) and
// its Manage tags renames, colours or deletes one in every note and group (src/tags.js picker / manager).
// - A colour (settings.tagColors) changes no note, so it needs nothing. A tag there exists even on no note.
// - Renaming or deleting a tag changes notes. A note or group whose lock hides it (hiddenInList / groupShut) may have it,
//   and nothing of those changes without the PIN (architecture.md → "Locks and hidden notes"). So when one of them has it
//   (or a note is still sealed: its tags can't be read until the PIN), the change needs the PIN (the owner's rule), and
//   with the right one it reaches them too. Notes in the Bin change as well (they can come back).
// - Not for a window its lock hides (tags are secret).
const { ipcMain } = require('electron');
const { checkPassword, isLocked, wait } = require('./locks');
const { broadcastSettings } = require('./settings');
const { notifyList } = require('./list-notify');
const { senderNote } = require('./ipc-common');
const { groupShut, hiddenInList, pushLook } = require('./list-visibility');
const TAGS = require('../src/tags');
const { S } = require('./state');

// a window that may see tags: the list, or a note window that shows its note
function mayAsk(e) {
  const { win, note } = senderNote(e);
  return !note || !isLocked(note) || !!win.revealed;
}
const colorsNow = () => S.store.settings.tagColors || {};
// may a note or group the list hides have this tag?
function lockedHas(tag) {
  for (const n of S.store.all()) if (n.enc || (hiddenInList(n) && n.tags.includes(tag))) return true;
  for (const g of S.store.groups.values()) if (groupShut(g.id) && g.tags.includes(tag)) return true;
  return false;
}
// every tag the windows may see: on notes not in the Bin and not hidden, on groups not shut, and those in tagColors
function allTags() {
  const count = new Map();
  const add = (t, n) => count.set(t, (count.get(t) || 0) + n);
  for (const t of Object.keys(colorsNow())) add(t, 0);
  for (const g of S.store.groups.values()) if (!groupShut(g.id)) for (const t of g.tags) add(t, 1);
  for (const n of S.store.all()) if (!n.deletedAt && !hiddenInList(n)) for (const t of n.tags) add(t, 1);
  return [...count].map(([tag, c]) => ({ tag, count: c, locked: lockedHas(tag) })).sort((a, b) => a.tag.localeCompare(b.tag));
}
function saveColors(next) {
  S.store.settings.tagColors = TAGS.cleanColors(next);
  S.store.saveSettings();
  broadcastSettings();
}
// the PIN, when the change would reach a hidden note or group: { error } to send back, or null = go on
async function pinCheck(tag, pw) {
  if (!lockedHas(tag)) return null;
  if (typeof pw !== 'string' || !pw) return { ok: false, error: 'pin' };
  if (!(await checkPassword(pw))) { await wait(450); return { ok: false, error: 'wrong' }; }
  if (S.store.all().some((n) => n.enc)) return { ok: false, error: 'sealed' }; // the key opened none of them: change nothing
  return null;
}
// every note (Bin too) and group: `next(tags)` = its new tags. Returns how many changed.
function changeEverywhere(next) {
  let count = 0;
  for (const n of S.store.all()) {
    const after = TAGS.cleanAll(next(n.tags));
    if (after.join('\n') === n.tags.join('\n')) continue;
    S.store.update(n.id, { tags: after });
    pushLook(n.id);
    count++;
  }
  for (const g of S.store.groups.values()) {
    const after = TAGS.cleanAll(next(g.tags));
    if (after.join('\n') === g.tags.join('\n')) continue;
    S.store.updateGroup(g.id, { tags: after });
    count++;
  }
  return count;
}

function registerTagIpc() {
  ipcMain.handle('tags:all', (e) => (mayAsk(e) ? { tags: allTags(), colors: { ...colorsNow() } } : null));
  // a tag's colour; a tag that isn't there yet is made (on no note)
  ipcMain.handle('tags:color', (e, tag, color) => {
    const t = TAGS.clean(tag);
    const c = TAGS.cleanColor(color);
    if (!mayAsk(e) || !t || !c) return { ok: false };
    saveColors({ ...colorsNow(), [t]: c });
    notifyList();
    return { ok: true };
  });
  // a new name everywhere. A name already there joins the two (each note keeps it once); the colour goes along, unless
  // the other name has its own
  ipcMain.handle('tags:rename', async (e, from, to, pw = null) => {
    const a = TAGS.clean(from);
    const b = TAGS.clean(to);
    if (!mayAsk(e) || !a || !b) return { ok: false };
    if (a === b) return { ok: true, count: 0 };
    const stop = await pinCheck(a, pw);
    if (stop) return stop;
    const count = changeEverywhere((list) => list.map((t) => (t === a ? b : t)));
    const cols = { ...colorsNow() };
    if (a in cols) { if (!(b in cols)) cols[b] = cols[a]; delete cols[a]; saveColors(cols); }
    notifyList();
    return { ok: true, count };
  });
  // gone from every note and group (the notes stay), and its colour
  ipcMain.handle('tags:delete', async (e, tag, pw = null) => {
    const t = TAGS.clean(tag);
    if (!mayAsk(e) || !t) return { ok: false };
    const stop = await pinCheck(t, pw);
    if (stop) return stop;
    const count = changeEverywhere((list) => list.filter((x) => x !== t));
    const cols = { ...colorsNow() };
    if (t in cols) { delete cols[t]; saveColors(cols); }
    notifyList();
    return { ok: true, count };
  });
}

module.exports = { registerTagIpc };
