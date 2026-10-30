# Testing

Open this when writing or running tests, or checking the UI.

- `npm test` runs `tests/run.js`: each `*.test.js` in a separate process with its own temporary data
  folder. `tests/fake-electron` stands in for Electron (windows, ipcMain, session, dialogs…), so the real
  `main.js` and `store.js` run under plain Node.
  - `store.test.js`: saving, crash recovery from .bak, backups, once-a-day rule, restore (into a "Restored Notes
    from …" group, `backupDayName`), pruning.
  - `main.test.js`: windows, opacity/pin/roll, new note placement, attachments and the protocol, blocked
    links, permissions, close vs quit, reopening in place.
  - `upgrade.test.js`: Sticky Pins → CosmoNotes migration, titles, dates, locking and passwords,
    spelling languages, groups, sorting, backups with groups.
  - `duplicate.test.js`: copying content/look/ink/group, "(copy)" title, independence, shared photo survives
    deleting the original, locked copy stays hidden, binned notes can't be duplicated.
  - `ink.test.js`: ink cleanup, saving with wrapWidth, counting as an edit, hidden + protected while locked.
  - `speed.test.js`: typing saves keep the drawing untouched and don't re-apply always-on-top/opacity/colour; the
    window title follows the text; page title can't rename a note window; group recolour keeps drawings; "Bring
    notes to front" unrolls (second launch doesn't); mouse back/forward app-commands reach the list (`list:nav`).
  - `pin-theme.test.js`: PIN rules (digits, 4–12, length kept), PIN↔password change, list theme kept/validated,
    see-through for new notes (`defaultOpacity`, 5 % steps, ≥ 25 %), `madeGroup` stays true after the last group is gone.
  - `lock-refresh.test.js`: removing a note's or group's lock from the list sends the open window its contents
    (`hidden:false`); still locked by its group = still hidden.
  - `v1113.test.js`: favourites (not an edit, not duplicated, groups too), several notes' colour/font, new group from a
    selection (never inside itself), locked things can't be binned/deleted, Empty bin keeps locked ones, dashed/dotted
    ink kept, minimise (pinned stays down) and maximise (unrolls first).
  - `v1115.test.js`: the new colours, `defaultColors` (random from the list, never empty, old "random"/single colour), the
    list's Edit (`list:edit`: title and colour only, `note:look` to the open window), Unlock all / Lock again, the drawing
    toolbar's window (only that window, only for notes; sticking to each side, following the note, screen edges, rolled,
    pinned, dropped back inside).
  - `v1116.test.js`: effects: ids match in fx.js and store.js, `resolve` rules (own choice, none, use on every note,
    paused), every effect and follower runs, settings + `settings:changed`, a note's choice is not an edit and is copied by
    Duplicate, pause from Settings and the tray (fx.js is run in a `vm` sandbox).
  - `v1120.test.js`: the four removed effects, a follower for every background (order, names, icons), every follower
    on three sizes / frequencies / papers, companions fade, Edit design's `list:edit` (opacity, fx), the 12 px snap.
  - `v1121.test.js`: "mouse plays with the background": `resolve` rules, `fxInteract` saved and sent, `fx.mi` not an
    edit and duplicated, the Layer passes the pointer (with its speed) only while on, every background with a moving
    pointer, bubbles pop, rain splashes.
  - `v1118.test.js`: the 23 new backgrounds (fewer since 1.1.20): each has a name and an icon, runs on light and dark paper, on a small card and a
    big note at "Often", and never draws at NaN.
  - `v1117.test.js`: effect / follower opacity: cleaning (store.js and fx.js agree), `resolve` rules, the layer multiplies
    every alpha it draws (fake 2D context with a real `globalAlpha` getter/setter), settings + `settings:changed`, a note's
    own opacity (not an edit, copied by Duplicate).
  - `groups.test.js`: nested groups and drag rules, no loops, move-up/move-to, looks and colours, mass
    edit (with and without sub-groups) pushed to open windows, locking groups (windows hide, list blanks,
    reveal/hide, open-from-list), lock/unlock notes from the list, ungroup moving things up, bin a group.
  - `v1119.test.js`: the 1.1.19 Fish redraw (still drawn in a handful of fills however many fish there are, no NaN) and that the removed Aquarium stays gone (a note that had it goes back to "same as all notes").
  - `v1122.test.js`: menus dock only within 12 px of the edge, and the owner's 1.1.22 effect changes (his picks, Analog monitor, Silk waves, Dust in light, Healing aura, Lightning, Cauldron, Ghost jellyfish, Fel fire, Embers, Digital ocean follower, the renamed switch).
  - `v1123.test.js`: the owner's notes after 1.1.22 (28–30 Oct 2026): checklist boxes, Backspace / Delete fixes, Copy image, struck-through ticked pictures, uniform effect choices, small card pictures, card menu order, Analog monitor, Cauldron, Ctrl+F, Warp speed hyperdrive, paper tint, picture descriptions, and speed.
- **One test file per version.** A change that alters behaviour usually adds `tests/v<version>.test.js`; `tests/run.js` picks up every `*.test.js` by itself. **Only the newest file asserts `package.json`'s version** (now `v1123.test.js`, line 6): when you raise the version, move that check into the new version's test, as `v1122.test.js` did, or the old one fails. Don't grow old test files, and open one only when it fails: they are 3–24 KB each.
- **UI checks** (done during development): load `src/note.html` / `src/list.html` in Chromium (e.g.
  Playwright) with a mock `window.sticky` object injected before load, then click through and screenshot.
  The mock must implement every `window.sticky.*` method from preload.js. Playwright hides scrollbars by default
  (launch with `ignoreDefaultArgs: ['--hide-scrollbars']` to check them). The fonts live in
  `node_modules/@fontsource/*/files` (latin woff2).
- Things only a real Windows machine can confirm: the installer, always-on-top behaviour, the tray,
  start with Windows, the microphone, and the spellchecker download.
