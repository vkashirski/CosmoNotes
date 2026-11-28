# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.33 back to 1.0.0) are in the archive. When a new
version is added at the top, move the oldest one here to the top of the archive.

**Renumbered in 1.1.41.** Six big versions were split into smaller ones, so the numbers from 1.1.13 on moved up. Each
heading says what it was. Version numbers written before 1.1.41 (in code comments, test file names such as
`tests/v1131.test.js`, `ai-context/`, and the text of older entries) are the old ones (tests are named by area since 1.1.49):

| Old number | New number |
|---|---|
| 1.0.0 – 1.1.12 | the same |
| 1.1.13 | 1.1.13 and 1.1.14 |
| 1.1.14 | 1.1.15 |
| 1.1.15 | 1.1.16 and 1.1.17 |
| 1.1.16 | 1.1.18, 1.1.19 and 1.1.20 |
| 1.1.17 – 1.1.19 | 1.1.21 – 1.1.23 |
| 1.1.20 | 1.1.24 and 1.1.25 |
| 1.1.21 | 1.1.26 |
| 1.1.22 | 1.1.27, 1.1.28 and 1.1.29 |
| 1.1.23 | 1.1.30, 1.1.31 and 1.1.32 |
| 1.1.24 – 1.1.31 | 1.1.33 – 1.1.40 (old + 9) |

## 1.4.35 – 28 November 2026

Tabs: moving a tab now shows where it goes as you drag it, and one Edit title… sets a tab's name, icon and look (the
owner's wishes).

- **Moving tabs (edit mode, the pencil):** the dragged tab lifts and follows the mouse, and the other tabs slide aside at
  once, so its new place is always in sight; it is saved when let go (Esc puts it back). It used the browser's own drag
  and drop before: in the app's window that often only started working after the window was resized, and nothing showed
  where the tab would land until the drop. Now it runs on pointer events (`list/events.js` `followTab`, `slide`,
  `endTabDrag`; the bar holds the pointer, since the tab moves in the page). A press without a move is still a click.
- **Edit title…** (right-click a tab; right-click a group card): one pop-up with the name, the 40 icons and Show: Icon /
  Icon + name / Name. It replaces Icon… / Show… / Show icon only / Show icon and name. The name shows on the tab as it is
  typed and is saved 300 ms after (or on Enter / closing). Favourites, Locked and the Bin: their name and icon are greyed
  out, only how they show changes (they can now be shown as their name only from the menu too). A group with no icon:
  only Name can be picked. A hidden group: its name and icon greyed out (main leaves it alone anyway).

## 1.4.34 – 28 November 2026

Feedback: request a feature or report a bug from Settings, with pictures, and no account (the owner's wish and picks:
a short puzzle against spam, a text limit, pictures made smaller instead of refused, a timer on Submit). In the code it
is "Ground control" (`gc:*`, `ground-control.js`); the owner first picked that name, then renamed it Feedback.

- **Settings → Feedback** (above About, a speech-bubble icon; `list/ground-control.js`, a new list part): first only two
  choices, Request a feature and Report a bug. Picking one opens its form, with no switching inside it (the owner's wish:
  the choice is a real step). **← Back** next to the title, or Feedback in the sidebar again, goes back to the choices and
  keeps what was typed: each kind has its own draft, and its card says **Draft**. **Cancel** (next to Submit) throws the
  draft away, after asking "Discard this report?". After a Send the choices show again with "Sent. Thank you!". The
  form: a title, the words (4,000 at most; a bug also asks "What did you expect?"), up to 3 pictures (paste anywhere in
  the section, drop on it, or Add a picture…), the app details (version, Windows, Electron; shown, can be turned off),
  an email only for a reply. "Only this form is sent. Your notes stay on your PC." Submit spins while it sends, with
  "Sending…" under it.
- **Where it lands:** the owner's relay, `feedback-worker/worker.mjs` (a Cloudflare Worker, free plan; setup in its
  `README.md`), opens an issue in the private repo `vkashirski/CosmoNotesFeedback` (label `bug` or `enhancement`) with
  the pictures in the repo. The GitHub token lives only in Cloudflare. `@names` and `#numbers` are tamed.
- **Against spam, in the relay:** an off switch (`OPEN`), a signed challenge good for 15 minutes and used once, the
  puzzle (main hashes until the hash starts with `BITS` zero bits, ~0.5 s; the relay checks one hash), the fields'
  limits, 5 reports a day per IP and 50 a day in all (changeable in Cloudflare, no new app version).
- **In the app** (`main/feedback.js`): only the list window may use `gc:*`; only main goes online, only on Send, only to
  `RELAY`. Pictures are made smaller with `nativeImage` (longest side 1600 px, then smaller until 600 KB; PNG first,
  JPEG when that is too big), never refused. The drafts (one per kind) are on disk while typed (store.js `feedbackDraft`,
  `feedback-draft.json`) and stay after a failed Send; a Send that worked removes its kind's draft. Submit then counts down a minute (or
  until the relay's limit ends).
- **Before the first release with it:** set up the relay (`feedback-worker/README.md`) and check that `RELAY` in
  `main/feedback.js` is the Worker's address.
- **Tests:** `ground-control.test.js` (new: the relay under Node, main against it), `list-ui-settings.test.js` (the
  form), `code-structure.test.js` (the new part); the fake Electron's `nativeImage` reads a PNG's size and resizes.

