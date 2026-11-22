# Splitting code into parts

Open this before adding a new part to a window that is already split, or before splitting a big file. Every big file is
split now: `src/fx.js` → `src/fx/`, the CSS → `src/css/`, `main.js` → `main/`, `src/list.js` → `src/list/`, `src/note.js` →
`src/note/`. The day-to-day rules for code in parts are in `CLAUDE.md` → "Rules for every code change"; this file is the
why, the method, and the traps.

## Adding a part to a split window

- **A new part goes where the names it takes are already given.** `speech` sits after `menus-voice-ink` (it takes `rec`,
  `voiceChip`, `keepClip`); `checklists` after `editing` (it takes `decorate`, `textUndo` / `textRedo`, `setProp`).
- **In the note window, every new part goes before `eraser-start`, which stays last.** Its start-up (`init`) awaits
  `api.getNote()`, and the browser runs that promise's continuation between two `<script>`s, so a part loaded after
  eraser-start isn't there yet when `init` goes on (putting `remind` last once gave "K[n] is not a function"). A part
  `init` uses goes before it, and `init` takes its names in its `const {…} = K;` line.
- **The HTML is the one list of parts.** Add the `<script>` (or `<link>`) in its place; the tests read the list from the
  html (`tests/helpers/sources.js`). An `src/fx/` part goes into both `note.html` and `list.html` in the same place
  (`code-structure.test.js` checks). When the parts' headers number them ("part N of M"), the later ones move up.
- **`K.later` stubs:** a later part's function reached as `K.later('name')` is a different function from the real one.
  That is fine for calling it and for `addEventListener` (`relock` and `toggleLock` are wired up that way in panels.js), but
  a `removeEventListener` with such a stub would remove nothing. No code compares functions or uses `this` through a stub.
- **A new `main/` file** only `require()`s files below it; files one folder down need `path.join(__dirname, '..', …)` for
  `assets/`, `preload.js`, `src/`. `package.json` → `build.files` lists `main/**/*`, or the installer builds an app that
  cannot start (only a real build shows it, so `code-structure.test.js` checks).
- **A new CSS part** in `src/css/` works only because no rule uses a relative `url()` (only data URIs; fonts are linked from
  the html). A relative `url()` there would need `../`.

## Splitting a big file: the method

The rule: the app behaves exactly as before, so a split changes where code lives, never what it does. Keep it a pure move;
a bug found on the way gets its own version afterwards (that is how the Ghost ripple error, found while recording fx.js,
was fixed).

1. **Each window script is one closed block** (`(() => { … })()`). Keep that wrapper: top-level names of plain `<script>`
   files on one page share one scope, so two files defining the same name (`R`, `clamp`, `$`…) would stop the page. Each
   part stays its own block and shares names through one kit object on `window` (`COSMO_FX_KIT`, `COSMO_LIST_KIT`,
   `COSMO_NOTE_KIT`): the first part makes it, every part takes what it needs on its first line (`const { … } = K;`) and
   adds what later parts need at its end (`Object.assign(K, { … })`).
2. **Let a parser decide where to cut, not the eye.** Parse the file (`espree` + `eslint-scope`; in the cloud workspace
   they are under `/opt/node-tools/node_modules`, because npm couldn't reach the registry), list the block's top-level
   names and every place each one is used, then check the planned parts (`tools/split/`, below). Two things make a cut
   unsafe:
   - **a shared `let` that one part reassigns** while another reads it: each part's copy taken at load time never sees the
     change. Such a `let` moves onto one shared object: `V.x` in a window (`V` is `K.V`) (`let tab = 'notes';` became `V.tab = 'notes';` on
     the same line, so it is still set up at the same moment), `S.x` in main. A `let` used by one part only stays private.
   - **a part using a name that a later part defines**: it is `undefined` when the part loads. A later part's function
     becomes a stub, `const render = K.later('render')`, that looks the real one up when called; a later part's value is
     read as `K.x` inside functions. This only works because no part calls a later part's function while it loads
     (`split-page.js` reports that case).
   A missing name only fails when that code runs, so every code path has to run in the checks.
3. **Cut at section headers into contiguous parts, in the old order, and copy every line unchanged.** Keeping the order
   keeps everything that runs at load (event wiring, `h()` calls, the first `load`) in the same sequence. No top-level
   statement may cross a cut (the script stops if one would). Check by script that the parts, joined, are the old lines,
   apart from the `V.` / `K.` prefixes (`check-parts.js`); and that each part parsed alone uses only its own names, the
   kit's and browser globals.
4. **Tests that read source text** need a loader that joins the parts: `src.fx()`, `src.note()`, `src.list()`,
   `src.css('note')`, `src.main()` in `tests/helpers/sources.js` (each joins the parts as the html, or `main/`, lists them).
   Watch for checks that slice between two names: `editor-code.test.js` slices `collect` … `changed` (both in base.js) and
   `alignChecks` … `paintStrikes` (both in editing.js); if two such functions end up in different files the slice breaks.
   Two of its patterns also accept `K.CB_VARS` and `V.savedRange`.
5. **The folder bridge can't delete files.** The old file becomes a two-line "moved to …" note that nothing loads; the
   owner deletes it.
6. **Prove it by recording** (below), then fix anything the recording found, as its own change.

## Proving it behaves the same

- **Record, don't look.** Record the old code twice first: the logs must match each other, or the recorder is noisy.
  Then record the new code and compare. Then plant a few small mistakes in the new code (a changed constant, a skipped
  password check, a flipped condition, a forgotten line or `changed()`, a delay 100 ms shorter, a stale copy of a shared
  variable): each must change the log. This mutation step isn't scripted: do it by hand, it takes minutes. Collect V8
  coverage (`[coverage.json]`) to see which functions ran, including those reached through `K.later` or the kit.
- **Record errors as part of the log,** so old and new must fail the same way (that is how the Ghost ripple error showed
  up).
- **Browser screenshots don't match themselves** (the old page against the old page differed by a few pixels even with
  Playwright's fake clock): use the browser only to see that both windows load with the same messages.
- **A quick check of a window without the recorder:** get real `note:get` / `list:get` data from main under
  `tests/fake-electron` (`require('electron').__handlers[…]`, save the JSON), give it to the page as a fake `window.sticky`
  in a Playwright init script, do the same clicks and typing in the old and the new page, and compare the DOM
  (`outerHTML`) and the list of `window.sticky` calls.
- **fx:** every background and follower ran through the real Layer with seeded `Math.random`, a fake clock and a
  recording canvas (every call and property set), before and after.
- **CSS:** the parts joined are byte-for-byte the old file (compare SHA-256); then load old and new page in Chromium and
  compare `getComputedStyle` of every element, property by property (old against itself first, or timing noise looks like
  a real difference; skip the `<link>` elements themselves).
- **main:** `tests/record/record-main.js` drives every IPC handler, window event, tray item and permission under the fake
  Electron (first start, migration from "Sticky Pins", restart with notes open and `--startup`). It can't reach
  `setLoginItemSettings` (packaged Windows only).
- **The list and a note window:** `tests/record/record-list.js` and `record-note.js` (commands in `testing.md`) run the
  real `main.js` under the fake Electron answering the page through the real `preload.js` (the page's `window.sticky`
  forwards every call), so clicks change real notes and groups. Fixed clock, seeded random numbers and counted ids on both
  sides (Playwright's `page.clock`, paused, in the page; CSS animations off, since no code waits on one). The note
  scenario uses three windows: C, a new empty note (typing, Add panel, paste and drop, voice with a stand-in microphone,
  the sketch, setting the password); A, a full note (formatting, the text panel, checklists, links, table menus, the
  picture and its handle and menu, the voice chip, Ctrl+F, ⋯ menu, colour row, Effects, header buttons, settings from main,
  zoom, word wrap, draw-over with every tool, both erasers, toolbars out); B, a locked note (wrong / right password,
  relock, lock all, cover title, remove / add the lock, PIN). It doesn't reach: dragging a toolbar out of the window
  (`grab` / `dragTo`), the photo handle drag, clicks in the side margin (`besideLine`), Enter in the description box, and
  small callbacks (`.catch(() => {})`, loops over empty lists).

**Traps in the recorders** (all in the recorder, not the app):
- Faking `Date` / `crypto` for the whole Node process also fakes them for Playwright (its ids collide and its timeouts
  never fire): fake them only for calls coming from the app's folder.
- A handler that waits on main's own timer (the wrong-password delay) needs main's clock stepped in fixed steps while the
  page waits. scrypt (checking a password) takes real time: while a call waits on it, main's clock must not move; it moves
  only for timers that call started itself (else a fast and a slow run differ).
- Pressing the hidden pop-up's OK button submits its form and reloads the page.
- Playwright's mouse actions wait for the cards to stop wobbling (they don't), so the scenario sends events straight to
  the elements and right-clicks at a fixed point.
- Waiting for a missing element hangs while the page's clock stands still: the scenario checks `count()` first.
- Attachment names end in random bytes, and the number main draws for locked notes' encryption varies: one counter per
  size.
- The toolbars' windows copy the page's styles with absolute paths (the tree's folder) and set attributes in an order
  that depends on when those styles loaded: the log writes the folder as `<TREE>` and attributes in name order.
- Chromium sends mouseenter / mouseleave whenever the page moves under a still mouse: `hover()` is logged only in the
  steps that do it on purpose.
- "Failed to load resource" (fonts, as `node_modules` isn't in the workspace copy; the `stickyfile:` scheme) comes at
  random moments: left out.
- A timer change shows only when it crosses a step (each step moves the page's clock 1.2 s or more).

## What is particular to each split

- **fx.js** had no shared `let`s (only `const` and functions). Only the four lines that open and close the `EFFECTS` /
  `FOLLOWERS` objects changed (to `Object.assign(LIST, {` … `});`, which keeps the key order).
- **The CSS** is the easy case: CSS has no shared names, and the order of the `<link>` tags is the order of the rules.
  Cut only where a top-level comment starts (brace depth 0, not inside a comment or string) and copy bytes unchanged
  (keeping each file's line endings).
- **main.js** is a Node module, split with `require()`. The tests load the real `main.js` and reach its IPC handlers, so
  it stays the entry point and keeps the three start-up calls (custom protocol, app id, spell-checker switch) that must
  run before the app is ready. The only circle (`setFxPaused` ↔ `setStartup` ↔ `buildTray`) is one file, `tray.js`.
  `store`, `listWin`, `quitting`, `listUnlockedAll` became `S.x` (the parser found every reference, so the rewrite was
  mechanical; the script stops at a shorthand use). `tray` and `notifyTimer` stayed private to their file; `wins` (a `Map`
  that is never reassigned) is exported as it was. `registerIpc` was one flat list of `ipcMain.handle/on` calls, cut by
  channel into `register…Ipc()` functions, called in the old order from `ipc.js`.
- **list.js** (seven parts: base · cards · picking · settings-menus · effects-design · actions-locks · events): one big
  circle (`load` → `render` → `noteCard` → `noteMenu` → … → `load`) is spread over several parts through `K.later`. Shared
  `let`s on `V`: `state`, `tab`, `openGroup`, `query`, `drag`, `selAnchor`, `modalDone`, `ctxCard`…; private ones:
  `cardCache`, `toastTimer`, `navAt`, `wheelSum`…; `navBack` is a `let` that is never reassigned, so it is shared like a
  `const`. The only later value is `FX`, read as `K.FX`.
- **note.js** (`CONTEXT.md` lists its parts): shared `let`s on `V`: `note`, `hidden`, `settings`, `dirty`, `saveTimer`,
  `savedRange`, `plainPaste`, `resizing`, `askResolve`. Later values read as `K.x`: `CB_VARS`, `inkState`, `textOut`,
  `textMove`, `inkOut` (all `const`s, read only inside functions). `relock` and `toggleLock` are passed to
  `addEventListener` in panels.js as `K.later` stubs (safe: the stub calls the real one with the same arguments, neither
  uses `this`, and nothing removes those listeners).

## Helper scripts (`tools/split/`)

Small Node scripts that did the mapping and cutting. They need `espree` and `eslint-scope` (the cloud workspace has them in
`/opt/node-tools/node_modules`; on a PC `npm i --no-save espree eslint-scope`, or set `NODE_TOOLS`). They are not part of
the app and `package.json` does not pack them. LF line endings.
- `outline.js <file> [iife]`: the top-level statements (lines, kind, names). `iife` looks inside a window script's wrapper.
- `scope.js <file> <out.json> [iife]`: which top-level variables are **written from another statement** (the ones that
  need the shared-object treatment) and which names come from outside. `graph.js <out.json>`: who uses what, and the
  **circles** that must stay in one file or be cut with the shared state in one object.
- `css-cuts.js` / `css-split.js` / `page-styles.js`: the CSS split (safe cut lines; cut + prove the bytes are the same;
  compare computed styles of two versions of a page, with the old page against itself first).
- `split-page.js <plan.json> [--dry]`: cuts a window script wrapped in `(() => { … })();` into parts by a plan (cut lines +
  file names; `plan-list.json` and `plan-note.json`, the latter with CRLF output). `--dry` only reports: the shared
  variables, what each part takes and gives, and any name a part would need at load time from a later part.
- `split-main.example.js`: the one-off script that cut `main.js`. It does not run on today's `main.js` (its plan table lists
  statement numbers); keep it as the pattern: plan table → bodies → `S.x` rewrite from the parser's references → generated
  `require()` headers → circle check → CRLF output.
- `check-parts.js <plan.json> <old file>`: the parts' lines joined are the old lines (apart from `V.` / `K.`), and each part
  alone uses only names it has.
