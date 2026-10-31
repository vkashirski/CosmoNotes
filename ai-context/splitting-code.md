# Splitting a big file into smaller ones

Learned splitting `src/fx.js` (180 KB) into `src/fx/` in 1.1.24. Open this before splitting `src/note.js`, `src/list.js`,
`main.js` or a CSS file. The rule: the app must behave exactly as before, so the split changes where code lives, never
what it does. Keep it a pure move; a bug found on the way gets its own version (that is how Ghost ripple was fixed in 1.1.25).

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
   list from `note.html` (`tests/fx-source.js`), and a test checks both HTML files load the same parts in the same order.
6. **Tests that read source text** need a loader that joins the parts. Watch for checks that slice between two names:
   `v1123.test.js` does `nj.slice(nj.indexOf('function alignChecks()'), nj.indexOf('function paintStrikes()'))` on
   note.js; if those two functions end up in different files the slice breaks.
7. **The folder bridge can't delete files.** The old file became a two-line "moved to …" note that nothing loads; the
   owner deletes it.
8. **The recording finds real bugs** (the Ghost ripple error showed up as an exception in the recording). Record errors
   as part of it, so old and new must fail the same way, and fix them afterwards.

## main.js is different

It is a Node module, not a page script: split it with `require()` into modules. The tests load the real `main.js` through
`tests/fake-electron` and reach its IPC handlers, so `main.js` must stay the entry point and keep registering them.
