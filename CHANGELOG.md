# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.8 back to 1.0.0) are in the archive. When a new
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

## 1.4.10 – 17 November 2026

Tags: give notes and groups tags (#work, #home…), and filter the notes list by them, one or several at once (the owner's wish).

- **Adding them:** right-click a note or group → **Tags…**, **Tags** in the selection bar for several (a tag only some of
  them have is faded: click it to give it to all, its × takes it off all), or the note's **⋯ menu → Tags**. Type a tag and
  press Enter, space or comma; suggestions are the tags already in use. Each change saves at once (main `list:tags`,
  `note:tags`: add / remove, never the whole list) and is not an edit. A tag is lower case, letters, numbers, - and _, at most
  30 letters; at most 20 on one note or group (`src/tags.js`, shared by both windows, main and store.js).
- **Filtering:** a row of every tag in use under the search box (`#tagRow`, `list/cards.js paintTagRow`); click to pick, click
  again to drop. With two or more picked, **All** (has every one) or **Any** (has one of them), remembered (`settings.tagAny`).
  Typing `#wo` in the search picks every tag starting with it, with words too (`#work milk`). A card's own tags show under
  its words; clicking one filters by it. Works in Notes (one flat list, inside the open group only), Favourites, Locked and
  the reminders filter. Escape, the row's ×, or opening a group forgets the picked tags.
- **Groups:** a group's tags count for everything inside it (its notes and its groups). Filtering shows the outermost
  group that matches, and its notes.
- **Locked notes (the owner's pick):** a note's tags are secret like its words: in `SECRET` / `SECRET_FIELDS`, sealed with a
  locked note, `[]` on its card, to its hidden window and among the suggestions, and they can't change while its lock hides
  it. A group's tags are not secret (like its name).
- New data: `note.tags`, `group.tags`, `settings.tagAny`. Duplicate copies the tags. The note window has a new part,
  `src/note/tags.js` (15 parts now).
- Tests: `tags.test.js` (the rules; main: notes, groups, several, not an edit, the ⋯ menu, Duplicate, locked and sealed, a
  restart), `list-ui-tags.test.js` (the row, All / Any, groups, #typing, card tags, tabs, the Tags pop-up, the bar),
  `note-ui-tags.test.js` (the ⋯ menu's row).

## 1.4.9 – 16 November 2026

In the notes list: change the look of several groups at once, move picked cards out of a group, cut or copy them and
paste in another, and undo or redo moves with Ctrl+Z / Ctrl+Y (the owner's wishes, after importing his Evernote notes).

- **Look of several groups:** pick groups (Ctrl+click), then **Look** in the bar (or right-click → Group look…): the four
  looks and the eight colours of the group panel, for all of them (`#lookPop` in `src/list/picking.js`, `openLook`,
  `setLook`; main `groups:update-many`). The look or colour they share is lit.
- **Move out:** inside a group, **Move out** in the bar (or right-click → Move out of this group) puts the picked notes
  and groups one level up, next to the group (`bulkOut`).
- **Cut / Paste:** Ctrl+X (or **Cut** in the bar, or right-click → Cut on any card) marks the picked cards (`V.cut`,
  `.card.cut`: faded with a dashed edge). Open another group, or the top level, and press Ctrl+V or **Paste here** in the
  bar. Right-click a group card → Paste into this group (N). Esc or the bar's × forgets the cut. A group never goes
  inside itself. Locked ones are never cut.
- **Copy / Paste:** Ctrl+C (or **Copy** in the bar or the right-click menus) and then Ctrl+V put copies there; the bar
  says "N copied", the cards don't fade, and the same copies can be pasted again (`V.cutMode`: 'cut' | 'copy'). Main
  `groups:copy-many`: a note's copy keeps its title (it is somewhere else, so no "(copy)"), look, words, pictures and lock,
  through store.js `duplicate` (no reminders, pin or window place); a copied group comes whole, with its name, look,
  colour, lock and sub-groups. Nothing a lock hides is copied; never into itself.
- **Undo / Redo of moves** (`main/move-history.js`): every change of where notes and groups sit is one step: a drag
  (one card or several), up a level, Move out, Paste, a new group from several, Ungroup. Ctrl+Z puts things back,
  Ctrl+Y (or Ctrl+Shift+Z) does it again; a toast says what was undone. A group a move emptied (it goes away) or that was
  ungrouped comes back with its own id, look and lock (store.js `restoreGroup`). Notes deleted for good, and things a
  lock hides, stay where they are. A paste of copies is a step too (`recordCopy`): Undo moves the copies to the Bin
  (never deletes them; a locked copy stays), Redo brings them back. The last 50 steps are kept in memory: the history
  starts empty with each start.
- One IPC for several at once, `groups:move-many` (`how`: 'Move' | 'Paste'): dragging several cards is now one call and
  one Undo step (was one `groups:move-to` per card).
- The toast sits above the bar while the bar shows (`body.selecting .toast`); the bar's labels hide below 860 px (was
  700: it has more buttons).
- Tests: `groups.test.js` (move-many, update-many, undo / redo of moves, new groups and Ungroup, things gone for good),
  `list-ui-groups.test.js` (Ctrl+Z / Ctrl+Y, Look for two groups, Move out, Cut / Paste by keys and menus, Copy / Paste
  twice and Ctrl+Z, not inside itself, a drag of several is one step). `groups.test.js` also copies a note and a group
  with a sub-group, undoes it to the Bin and redoes it.
