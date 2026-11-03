# Splitting a big file into smaller ones

Learned splitting `src/fx.js` (180 KB) into `src/fx/` in 1.1.24. Open this before splitting a big file or a CSS file (all the
big ones are split now: fx, the CSS, main.js, list.js, and note.js in 1.1.44; a window script goes the "list.js" / "note.js" way).
Versions in this file before the note.js section are the old numbers (renumbered in 1.1.41; table in `CHANGELOG.md`). The rule: the app must behave exactly as before, so the split
changes where code lives, never what it does. Keep it a pure move; a bug found on the way gets its own version (that is how Ghost ripple was fixed in 1.1.25).

## How the fx.js split was done

1. **Each window script is one closed block** (`(() => { … })()`). Don't drop that wrapper to share names between files:
   top-level names of plain `<script>` files on one page share one scope, so two files defining the same name (`R`,
   `clamp`, `$`…) would stop the page. Each part stays its own block and shares names through one object on `window`
   (`window.COSMO_FX_KIT`): the first part makes it, every part takes what it needs on its first line
   (`const { … } = window.COSMO_FX_KIT;`) and adds what later parts need at its end.
2. **Let a parser decide where to cut, not the eye.** Parse the file (`espree` + `eslint-scope`; they were already
   installed in the cloud workspace under `/opt/node-tools/node_modules`, npm itself couldn't reach the registry), list
   the block's top-level names and every place each one is used, then check the planned parts. Two things make a cut
   unsafe:
   - **a shared `let` that one part reassigns** while another reads it: each part's copy taken at load time never sees
     the change. fx.js had none (only `const` and functions). **`note.js` has 28 top-level `let`s and `list.js` 25**,
     so splitting them needs more: keep each `let` with all the code that writes it, or move that state into one shared
     object (`state.x = …`), which changes code lines and needs more checking;
   - **a part using a name that a later part defines**: it is `undefined` when the part loads.
   A missing name only fails when that code runs, so every code path has to run in the checks.
3. **Cut on whole entries and copy every line unchanged.** For fx.js only the four lines that open and close the
   `EFFECTS` / `FOLLOWERS` objects changed (to `Object.assign(LIST, {` … `});`, which keeps the key order). Check by
   script that the parts, joined, are exactly the original lines.
4. **Prove it behaves the same by recording, not by looking.** fx.js: every background and follower ran through the
   real Layer with seeded `Math.random`, a fake clock and a recording canvas (every call and property set), before and
   after: 177 runs, 7,234,430 calls, identical. Run the old code twice first: the recording must match itself.
   **Browser screenshots don't match themselves** (the old page vs the old page differed by a few pixels even with
   Playwright's fake clock), so use the browser only to see that both windows load with the same messages.
   For `note.js` / `list.js` a canvas recording won't do; record instead what the page does: run the real `main.js`
   under `tests/fake-electron` to get real `note:get` / `list:get` data (call `require('electron').__handlers[…]`, save
   the JSON), give it to the page as a fake `window.sticky` in a Playwright init script, do the same clicks and typing in
   the old and the new page, and compare the DOM (`outerHTML`) and the list of `window.sticky` calls.
5. **The HTML is the one list of parts.** Both windows load the parts in order with `<script>` tags; the tests read that
   list from `note.html` (`tests/helpers/sources.js`), and a test checks both HTML files load the same parts in the same order.
6. **Tests that read source text** need a loader that joins the parts. Watch for checks that slice between two names:
   `editor-code.test.js` does `nj.slice(nj.indexOf('function alignChecks()'), nj.indexOf('function paintStrikes()'))` on
   note.js; if those two functions end up in different files the slice breaks.
7. **The folder bridge can't delete files.** The old file became a two-line "moved to …" note that nothing loads; the
   owner deletes it.
8. **The recording finds real bugs** (the Ghost ripple error showed up as an exception in the recording). Record errors
   as part of it, so old and new must fail the same way, and fix them afterwards.

## CSS files (done in 1.1.26: `note.css` → `src/css/note-*.css`, `list.css` → `src/css/list-*.css`)

The easy case, because CSS has no shared names: the order of the `<link>` tags is the order of the rules, so cutting between
two top-level rules and linking the parts in the same order changes nothing.
1. Cut only where a top-level comment starts (brace depth 0, not inside a comment or string) and copy bytes unchanged
   (keep each file's line endings: `note.*` CRLF, `list.*` LF).
2. Proof: the parts joined are byte-for-byte the old file (compare SHA-256), then load old and new page in Chromium
   and compare `getComputedStyle` of every element, property by property. Run the old page against itself first
   (it must show 0 differences), or timing noise looks like a real difference. Skip the `<link>` elements themselves.
3. The parts live in `src/css/`, which only works because no rule uses a relative `url()` (only data URIs); fonts are
   linked from the html. A future relative `url()` would need `../`.
4. Tests that read CSS text use `src.css('note')` from `tests/helpers/sources.js`, which joins the parts as the html lists them.
5. The old files became notes (the bridge can't delete); the owner deletes them.

## main.js (done in 1.1.27: `main.js` is the entry, the rest is in `main/`)

A Node module, not a page script: split with `require()`. The tests load the real `main.js` through `tests/fake-electron` and
reach its IPC handlers, so `main.js` stays the entry point and keeps the three start-up calls (custom protocol, app id,
spell-checker switch) that must run before the app is ready.
1. **Map first, with a parser** (`espree` + `eslint-scope`): for every top-level piece, who uses it. Only one circle existed
   (`setFxPaused` ↔ `setStartup` ↔ `buildTray`): those three went into one file, `tray.js`. Then give every file only
   `require()`s of files below it.
2. **Shared `let`s become one object.** `store`, `listWin`, `quitting`, `listUnlockedAll` were reassigned from several
   functions; a `require()`d copy would never see the change. They are `S.store` etc. (`main/state.js`). The parser found
   every reference, so the rewrite is mechanical (no shorthand uses existed; the script stops if it meets one). `tray` and
   `notifyTimer` were only used by one function each and stayed private to their file. `wins` (a `Map` that is never
   reassigned) is exported as it was.
3. **Paths:** files one folder down need `path.join(__dirname, '..', …)` for `assets/`, `preload.js`, `src/`.
4. **`registerIpc` was one 560-line function** that was just a flat list of `ipcMain.handle/on` calls (plus one local,
   `moveUp`), so it was cut by channel into six `register…Ipc()` functions, called in the old order from `ipc.js`.
5. **`package.json` → `build.files` must list `main/**/*`**, or the installer builds an app that cannot start. Only a real
   build shows it, so `code-structure.test.js` checks it.
6. **Proof by recording** (`tests/record/record-main.js`, see `testing.md`): three runs (first start with every handler, migration
   from "Sticky Pins", restart with notes open and `--startup`), 1,025 + 36 + 72 lines identical before and after. Check the
   recorder first: the old code twice must give identical logs, and deliberate small mistakes (a changed constant, a skipped
   password check, a flipped condition) must make the log differ. Things the recorder cannot reach under the fake Electron:
   `setLoginItemSettings` (packaged Windows only).
7. **Tests that read `main.js` as text** use `src.main()` from `tests/helpers/sources.js` (joins `main.js` and `main/*.js`; works before and after).

## list.js (done in 1.1.28: `src/list.js` → `src/list/*.js`, seven parts)

The first window script with shared `let`s. Done by `tools/split/split-page.js` with the plan `tools/split/plan-list.json`
(cut lines + file names), so `note.js` can follow the same way with its own plan.
1. **Cut at section headers into contiguous parts, in the old order** (base · cards · picking · settings-menus · effects-design ·
   actions-locks · events, 11–25 KB). Keeping the order keeps everything that runs at load (event wiring, `h()` calls, the first
   `load`) in the same sequence. The script stops if a top-level statement would cross a cut.
2. **One kit object per window:** `window.COSMO_LIST_KIT` (`K`). Each part opens with `const { … } = K;` (names of earlier
   parts) and ends with `Object.assign(K, { … })` (its names other parts use). A **function of a later part** is a stub,
   `const render = K.later('render')`, that looks the real one up when called: the big circle (`load` → `render` →
   `noteCard` → `noteMenu` → … → `load`) is spread over several parts without any line changing. This only works because no
   part calls a later part's function while it loads (the script reports that case) and no code compares functions or uses
   `this`. A later part's **value** (only `FX`, twice) is read as `K.FX`.
3. **Shared `let`s → `V.x`:** a top-level `let` that is reassigned and used in more than one part (16 of them: `state`, `tab`,
   `openGroup`, `query`, `drag`, `selAnchor`, `modalDone`, `ctxCard`…) lives on `K.V`; every reference became `V.name` and the
   declaration `let tab = 'notes';` became `V.tab = 'notes';` on the same line, so it is still set up at the same moment.
   `let`s used by one part only (`cardCache`, `toastTimer`, `navAt`, `wheelSum`…) stayed private. `navBack` is a `let` that is
   never reassigned, so it is shared like a `const`.
4. **Proof:** (a) by script: the parts' bodies, joined, are the old lines; 1,995 identical, the 179 others turn back into the
   old line when the `V.` / `K.` prefixes are taken out. (b) each part parsed alone uses no name it doesn't have (only browser
   globals besides its own and the kit's). (c) `code-structure.test.js` loads all seven parts in a `vm` with a stand-in DOM and checks
   every shared name exists. (d) the recording below.
5. **Recording the window** (`tests/record/record-list.js`, scenario in `tests/record/record-list-scenario.js`; needs Playwright, which the
   cloud workspace has): the real `main.js` under the fake Electron answers the page through the real `preload.js` (the page's
   `window.sticky` forwards every call to it), so clicks change real notes and groups. Fixed clock, seeded random numbers and
   counted ids on both sides (Playwright's `page.clock`, paused, in the page; CSS animations off, since no code waits on one).
   285 steps, 295 calls + 109 messages from main: old twice identical, new identical to old; three planted mistakes (a forgotten
   line, a delay 100 ms shorter, a stale copy of a shared variable) each changed the log. Coverage (V8, `[coverage.json]`):
   474 of 508 functions ran, including every function reached through `K.later` or the kit.
   Traps found on the way, all in the recorder, not the app: faking `Date` / `crypto` for the whole Node process also fakes
   them for Playwright (its ids collide and its timeouts never fire): fake them only for calls coming from the app's
   folder; a handler that waits on main's own timer (the wrong-password delay) needs main's clock stepped in fixed steps
   while the page waits; pressing the hidden pop-up's OK button submits its form and reloads the page; Playwright's mouse
   actions wait for the cards to stop wobbling (they don't), so the scenario sends events straight to the elements and
   right-clicks at a fixed point.
6. **Tests that read the list's source** use `src.list()` from `tests/helpers/sources.js` (joins the parts as `list.html`
   lists them).

## note.js (done in 1.1.44: `src/note.js` → `src/note/*.js`, ten parts)

The same way as list.js, with `tools/split/plan-note.json` (`node split-page.js plan-note.json`, CRLF).
1. **Ten contiguous parts, cut at section headers, in the old order** (base · fx-format · panels · content · editing ·
   menus-voice-ink · lock-zoom · draw-over · ink-out · eraser-start, 13–24 KB). No top-level statement crosses a cut.
2. **Shared `let`s → `V.x`:** 9 (`note`, `hidden`, `settings`, `dirty`, `saveTimer`, `savedRange`, `plainPaste`, `resizing`,
   `askResolve`). Later values read as `K.x`: `CB_VARS`, `inkState`, `textOut`, `textMove`, `inkOut` (all `const`s, read only
   inside functions). Two later-part functions are wired up while the window loads: `relock` and `toggleLock` are passed to
   `addEventListener` in panels.js as `K.later` stubs. That is safe because the stub calls the real one (same arguments) and
   neither uses `this`, and nothing removes those listeners. Check for that (`removeEventListener` with a later part's function
   would break: the stub is a different function) before the next split.
3. **Proof:** (a) `tools/split/check-parts.js plan-note.json <old note.js>`: 3,109 lines identical, 199 differ only by `V.` / `K.`;
   each part parsed alone uses only its own names, the kit's and browser globals. (b) `code-structure.test.js` loads the ten parts in a
   `vm` with a stand-in DOM and checks every shared name. (c) the recording below.
4. **Recording the note window** (`tests/record/record-note.js`, scenario `tests/record/record-note-scenario.js`), built from record-list.js:
   three windows one after the other: C, a new empty note (typing, Add panel, paste and drop, voice with a stand-in microphone,
   the sketch, setting the password), then A, a full note (formatting, the text panel, checklists, links, table menus, the picture
   and its handle and menu, the voice chip, Ctrl+F, ⋯ menu, colour row, Effects, header buttons, settings from main, zoom, word
   wrap, draw-over with every tool, both erasers, toolbars out) and B, a locked note (wrong / right password, relock, lock all,
   cover title, remove / add the lock, PIN). 284 steps; old three times identical, new twice identical to old; three planted
   mistakes (a forgotten `changed()`, a stale copy of `V.settings`, the toast's delay 3.2 s → 1.2 s) each changed the log.
   Coverage (V8): 498 of 546 functions of the old note.js ran (509 of 557 in the parts, the extra 11 are the kit's stubs).
   Not reached: dragging a toolbar out of the window (`grab` / `dragTo`), the photo handle drag, clicks in the side margin
   (`besideLine`), Enter in the description box, and small callbacks (`.catch(() => {})`, loops over empty lists).
   Traps found on the way, all in the recorder, not the app:
   - waiting for a missing element hangs while the page's clock stands still: the scenario checks `count()` first;
   - scrypt (checking a password) takes real time: while a call waits on it, main's clock must not move; it moves only for
     timers that call started itself (else a fast and a slow run differ);
   - attachment names end in random bytes, and the number main draws for locked notes' encryption varies: one counter per size;
   - the toolbars' windows copy the page's styles with absolute paths (the tree's folder) and set attributes in an order that
     depends on when those styles loaded: the log writes the folder as `<TREE>` and attributes in name order;
   - Chromium sends mouseenter / mouseleave whenever the page moves under a still mouse: `hover()` is logged only in the steps
     that do it on purpose;
   - "Failed to load resource" (fonts, as `node_modules` isn't in the workspace copy; the `stickyfile:` scheme) comes at
     random moments: left out;
   - a timer change shows only when it crosses a step (each step moves the page's clock 1.2 s or more).
5. **Tests that read the note's source** use `src.note()` from `tests/helpers/sources.js` (joins the parts as `note.html`
   lists them): `editor-code.test.js` (its two slices still work: `collect` … `changed` are both in base.js, `alignChecks` …
   `paintStrikes` both in editing.js; two of its patterns also accept `K.CB_VARS` and `V.savedRange`).

## Helper scripts (`tools/split/`, added after 1.1.27)

Small Node scripts that did the mapping and cutting. They need `espree` and `eslint-scope` (the cloud workspace has them in
`/opt/node-tools/node_modules`; on a PC `npm i --no-save espree eslint-scope`, or set `NODE_TOOLS`). They are not part of the app and
`package.json` does not pack them. LF line endings.
- `outline.js <file> [iife]`: the top-level statements (lines, kind, names). `iife` looks inside note.js / list.js's wrapper.
- `scope.js <file> <out.json> [iife]`: which top-level variables are **written from another statement** (the ones that need the
  shared-object treatment) and which names come from outside. `graph.js <out.json>`: who uses what, and the **circles** that must
  stay in one file. First results on `list.js`: 13 shared variables are written from several functions (`state`, `tab`,
  `query`, `openGroup`, `drag`, `selAnchor`…), and one big circle joins `load`, `render`, `renderNotes`, `noteCard`, `groupCard`,
  `renderSettings`, the menus… (they call each other), so that circle has to stay together or be cut with the shared state in
  one object; `note.js` will be similar.
- `css-cuts.js` / `css-split.js` / `page-styles.js`: the CSS split of 1.1.26 (safe cut lines; cut + prove the bytes are the same;
  compare computed styles of two versions of a page, with the old page against itself first).
- `split-page.js <plan.json> [--dry]`: cuts a window script wrapped in `(() => { … })();` into parts by a plan (1.1.28, list.js;
  `plan-list.json` and `plan-note.json` (1.1.44) are the two plans). `--dry` only reports: the shared variables, what each part
  takes and gives, and any name a part would need at load time from a later part.
- `split-main.example.js`: the one-off script that cut `main.js` in 1.1.27. It does not run on today's `main.js` (its plan table
  lists statement numbers); keep it as the pattern: plan table → bodies → `S.x` rewrite from the parser's references →
  generated `require()` headers → circle check → CRLF output.
- `check-parts.js <plan.json> <old file>` (1.1.44): the parts' lines joined are the old lines (apart from `V.` / `K.`), and each
  part alone uses only names it has.
Not saved: the loop that mutated the new code to prove the recorder notices (change a constant, skip a check, flip a condition,
re-record, the log must differ) — do it by hand, it takes minutes.
