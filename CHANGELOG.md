# CosmoNotes – version history

The same list is shown in the app: notes list → Settings → About CosmoNotes → Version history
(source: `src/about.js`). Keep both in sync.

## 1.0.4 – 22 October 2026

- Build fix: building 1.0.3 failed at the very end with `spawn UNKNOWN`. To make the uninstaller, electron-builder runs a small helper exe it just wrote to `dist\<Setup>.exe` (`NsisTarget.computeScriptAndSignUninstaller` → `WineVmManager.exec`; on Windows that's a direct run). Windows refused to start it, most likely Windows Security scanning or holding the brand-new unsigned file. `build.bat` now waits 15 s and retries once. If it fails again, it explains how to allow it (Protection history → Allow, or a folder exclusion), and asks to report a Smart App Control message, which needs a different fix.
- No app changes. 1.0.3 was never built, and 1.0.4 contains all of 1.0.3.

## 1.0.3 – 22 October 2026

- Search: a clear (×) button at the end of the box (Esc also clears). When a group is open, search only looks inside that group (and its sub-groups), and the box says "Search your notes inside this group".
- New note while a group is open creates it inside that group (`list:new(groupId)`). If the group is locked but opened in the list, the new note opens without asking for the password.
- Card size button (after sort): small / medium / large, saved as `settings.listSize` (s|m|l).
- Group settings: the paper colour and font that all notes inside share are shown as selected (this used to show nothing), with a note when they're mixed. It follows the "also groups inside" checkbox.
- Header: "New note" sits right after the CosmoNotes name, about 15% lighter.
- Settings: About moved to the end. Locked notes now has a single Set/Change password button that opens an app pop-up (no open form fields). Colour for new notes has a **random** option first (`defaultColor: 'random'` picks one of the 7 pastel papers, never charcoal), the same size as the other swatches.
- Notes list: a real title is bold (800) and slightly bigger. An untitled note's first line is semi-bold (600), between a title and normal text.

## 1.0.2 – 22 October 2026

- **Fixed:** the notes list redrew twice when changing the sort order (the list applied it, then the app told it to reload). Sort changes no longer trigger a reload, the list skips redraws when nothing changed, and cards only animate when the view changes. This also stops the flicker while typing in a note with the list open.
- **Groups inside groups** (a folder tree): drag a note onto a note inside a group to make a sub-group; drop notes or groups onto group cards; move things up with the back button, the path (crumbs) or the drop strip. A group can't go inside itself.
- **Group settings** (palette button inside a group): 4 looks (paper stack, folder, envelope, notebook), 8 group colours, and changing the paper colour or font of every note inside, optionally including sub-groups.
- **Lock groups** with the same password. A locked group asks for it when opened in the list. Notes opened from it don't ask again until the list closes or "lock again". Open note windows inside a group that gets locked save and hide themselves.
- **Right-click menus** in the list (notes, groups, Bin) to open, close, lock, unlock (asks for the password), move up, ungroup or move to the Bin, without opening the note.
- **Confirmations:** moving a note to the Bin asks first (Shift+click the bin button skips it, and the pop-up says so). Ungrouping asks first.
- **App-styled pop-ups** replace all Windows message boxes (delete forever, empty bin, restore backup, passwords). Only the photo file picker is still Windows' own.
- **Versioning rule:** every update raises the version (third digit) unless the owner says otherwise.
- Tests: `tests/groups.test.js`.

## 1.0.1 – 21 October 2026

- Renamed from **Sticky Pins** to **CosmoNotes**. On first start, notes, photos, backups and settings are copied from `%APPDATA%\Sticky Pins` to `%APPDATA%\CosmoNotes`, and the old folder is left as a safety copy. The installer replaces the old app.
- Top bar: **All notes** button (left of +), and **roll-up** moved onto the bar next to the pin.
- Optional **note titles** (set in the ⋯ menu), shown on the top bar.
- **Lock notes** with one password/PIN for all notes (⋯ menu). Contents are hidden in the note and in the list. This is a privacy screen, not encryption.
- **Spelling** on/off button on each note. Ignored by default, Cyrillic is never underlined unless turned on, and both are controllable in Settings.
- New **A** button (after Checklist) for text colour, highlight, size and clear formatting, moved out of Add.
- **Resize photos** by dragging the handle at their corner (min ~60px, max the note's width), with Small/Medium/Full-width presets on right-click.
- **Dates**: a last-edited stamp at the bottom of each note, and created/edited dates in the ⋯ menu. List cards show the created date.
- Notes list: **groups** made by dragging a note onto another, with optional **names**, opening, ungrouping and dragging notes back out.
- Notes list: **sorting** by last edited or date created, newest or oldest first, and groups first, notes first or mixed in.
- Settings: **About CosmoNotes** (everything the app can do, plus this version history), **Spelling** and **Locked notes** sections.
- Project: `ai-context/CONTEXT.md` for future development, this changelog, and `npm test`.

## 1.0.0 – 21 October 2026

First version, released as **Sticky Pins**.

- Local-only, crash-safe saving (one JSON file per note, atomic writes plus `.bak`), daily backups with 30 kept, and a Bin.
- Frameless sticky-note windows: pin on top, see-through slider (solid on hover), roll up, and reopening in the same place.
- 8 paper colours, handwritten (Caveat) or rounded (Nunito) font, and 3 text sizes.
- Bold / italic / underline / strikethrough, bullets and checklists.
- Add menu: photos, voice notes, drawings, links, tables, numbered lists, divider and date. Text colour, highlight and size.
- Notes list window with search, Bin and Settings (start with Windows, default colour/font, backups, data folder).
- Tray icon, single instance, and a Windows installer built with `build.bat`.
