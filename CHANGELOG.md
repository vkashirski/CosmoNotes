# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.4.31 back to 1.0.0) are in the archive. When a new
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

## 1.4.33 – 23 November 2026

Tabs can wear icons, and each tab can show its icon, its name, or both (the owner's wishes and picks).

- **40 icons** (`src/tab-icons.js`, the owner's set): Favourites is always the star, Locked the lock, the Bin the trash can.
- **A group's icon is optional.** Right-click its card or its tab → Icon… and pick one of the 40, or No icon. It shows on
  its tab and on its bar in the list (not on its card). With no icon, its tab shows only its name: the colour dot of
  1.4.32 is gone.
- **Icon / Icon + name / Name** for each tab with an icon: in the same pop-up, or right-click → Show icon only / Show icon
  and name. Shown as its icon only, a tab hides its count; its name is in its tooltip.
- A hidden group's icon can't be changed (main's `groups:update` leaves a shut group as it is).
- Saved: the group's `icon` (store.js `normalizeGroup`: one of the 40 or null), the tab's `show` in `settings.listTabs`.
- **Tests:** `list-ui-tabs.test.js` (icons), `code-structure.test.js` (the new shared file, list only).

## 1.4.32 – 22 November 2026

A group can be a tab of its own in the notes list, and the tabs can be moved (the owner's wish).

- **Pin a group as a tab:** right-click a group card → Pin as tab, drag its card onto the tab bar, or use + Group while
  editing the tabs. The tab shows the group's colour, name and number of notes (a hidden group's tab shows a lock and no
  number; a hidden group can't be pinned). Renaming the group renames the tab; the tab goes when the group does.
- **A group tab is its own place:** it opens at the group, its path starts there, Back and Esc stop there, and a new note
  goes into it. Notes starts at the top again. Clicking Settings again goes back to the group tab.
- **Edit tabs (the pencil):** drag tabs to move them, × removes a group's tab, the eye hides or shows Locked, + Group pins
  one. Notes stays first and Settings last. Right-click a tab: Move left / Move right / Remove from tabs.
- Tabs that don't fit go into » (the last ones first, never the open one).
- Saved in `settings.listTabs` (store.js `cleanListTabs`): unknown tabs dropped, missing built-in ones added, only Locked
  can be hidden, pinned groups that are gone dropped at start.
- **Code:** `list/events.js` "the tab bar" (`paintTabs`, `fitTabs`, `setTab`, `pinTab`, `unpinTab`, `moveTab`); `V.tabRoot`
  (the group tab open: `V.tab` stays `'notes'`), `tabsNow` / `pinnedTab` / `tabKey` in `list/base.js`; `render()` lets go of
  `V.tabRoot` once the view is outside that group; `openGroupView(g, { root })`.
- **Tests:** `list-ui-tabs.test.js` (new).
