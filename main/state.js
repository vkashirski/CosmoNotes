'use strict';
// Shared state of the main process. These used to be `let`s at the top of main.js; they are properties of one object
// now so that every file sees the same value (`S.store`, `S.listWin`, `S.quitting`, `S.listUnlockedAll`).
const S = {
  store: null,
  listWin: null,
  quitting: false,
  // 1.1.15: "Unlock all" in the list's Locked tab: every locked note and group shows (and can be searched) in the
  // list until "Lock again" or the list closes. The notes stay locked; this only uncovers them in the list.
  listUnlockedAll: false,
};
const wins = new Map(); // note id -> BrowserWindow

module.exports = { S, wins };
