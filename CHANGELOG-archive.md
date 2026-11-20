# CosmoNotes – version history (archive)

Older versions, moved out of [`CHANGELOG.md`](CHANGELOG.md) so that file stays small. Newest first. Nothing in the app reads this
file (`tests/release.test.js` checks that every version is in one of the two files, once).

Renumbered in 1.1.41: each heading says its old number (the table is at the top of `CHANGELOG.md`). Version numbers inside
the entries are the old ones.

## 1.4.21 – 20 November 2026

Right-click in a note opens its menu at once, Add ▸ is first in it with the Add panel's pictures, the Add panel is a row
of pictures over the bottom bar (no more Today's date), and a ticked checklist line's strike goes through the middle of
big words too.

- **The cause (slow right-click):** since 1.4.18 the note's menu (`#ctx`, `showMenu`) opens in a see-through window of
  its own, and every right-click (and every ») made a new one (`window.open`, then copying and loading the styles, then
  showing it) and closed it again. Now that window is made once and kept: shutting the menu only hides it (`barOut`'s
  new `keep`, `src/note/ink-out.js`; the menu's `menuOut`, `src/note/menus-voice-ink.js`). It is also made ahead of time,
  so the first right-click is quick too: only while the note doesn't have the focus (it opens in the background, or you
  leave it), because making a window takes the page's focus for a moment (a stroke being drawn ended in the tests).
- **The text's right-click menu** (`main/web.js`): Add ▸ first, then a line, then the spelling and Cut / Copy / Paste (the
  owner's wish). Its lines have the Add panel's pictures in their colours (main sends each item's act as `pic`; the note
  clones the tile's picture, `addPic`).
- **The Add panel** (`#insert`, `src/note.html`, `note-toolbars.css`): one row of pictures over the bottom bar, at its
  right by +; each name shows on hover (`title`, also the name in Add ▸). Too narrow a note: the row wraps. **Today's
  date** is gone (the owner's wish: `doInsert`'s `date`).
- **The cause (strike not in the middle):** a ticked line's strike was the line's `text-decoration`. Chromium draws a
  decoration set on a parent at the parent's size, so on bigger words it ran near their top (and under smaller ones).
  Now each run of words draws its own strike in its own size and font: in a note the highlight `cn-done` over the ticked
  lines (`paintDone`, `src/note/editing.js`; nothing goes into the note, so nothing saved changes; an editor
  MutationObserver keeps it in step with ticks), on a card each run's own decoration (`runSpan(r, done)`,
  `src/list/cards.js`). The boxes were fine.
- **Tests:** `note-ui-bar.test.js` (one window for the menu all along, made ahead of time only without the focus, Add ▸
  first with its pictures, no Today's date), `windows.test.js` (main's order and `pic`), `note-ui.test.js` (the strike
  follows ticks, not a line decoration), `list-ui-cards.test.js` (a ticked card line's runs).

## 1.4.20 – 20 November 2026

The reminder panel's time box takes typing the way you'd expect, the calendar has a Back button, the day says how far
it is, and hiding a note is a setting (off).

- **Typing the time** (`src/remind-ui.js`): a click anywhere on a number (between its digits too) picks all of it,
  and the pick shows, so what you type replaces it. The cause: `maxlength="2"`, a caret between two digits, and a
  see-through `::selection`, so a click left nothing to type into and showed nothing. A digit into a full box with nothing
  picked now starts the number again. A first digit that can't start a two-digit number (3–9 for At's hours, 6–9 for
  minutes) counts as one (7 → 07) and goes on, so 7 then 5 is 07:05, not 23 (75, cut down to the highest hour).
- **Settings → Reminders → Jump to the next box** (`remindAutoNext`, on: as before): after the hours, on to the minutes.
- **Settings → Reminders → Hiding notes** (`remindHide`, off): the panel offers "Hide the note until then" only when it's on.
  A note whose reminder already hides it still shows the row, so it can be turned off; nothing that hides is changed.
- **"Choose how long."** (grey, a hint) when In is at 0, in place of "Set a little time first." (red).
- **The calendar's header is Back** with an arrow (one button: both go back), in place of "Pick a day" and an X.
- **The day** says its date and how far: "Fri 20 Nov (Today)", "Tue 15 Dec (in 25 days)", "Sat 20 Nov 2027 (in 1y 1d)".
- **The panel's height** comes from the editor now (`height`: `H_BASE` 448 + `H_ROW` 42 for each of Hide the note and
  Unlock to dismiss that shows), set as `--rm-h` on `#remPop` / `.rbox` when it opens; `.locked` is gone. Two tick boxes
  in a row now have the same 6 px gap as the other rows, so every such row is 42 px.
- **Tests:** `note-ui.test.js` (a click between digits, 7 5 → 07:05, a full box starts again, Jump off, the hint, Back,
  the day's words, Hiding notes on/off, the height), `list-ui-cards.test.js` and `reminders.test.js` (the two settings).

## 1.4.19 – 19 November 2026

Setting a reminder is one question at a time now, in one panel that never moves (the owner's design, like Windows
Clock's "Edit alarm"). A chip at the bottom of a note shows its next reminder.

- **Why:** the old panel showed everything at once (quick picks, date and time boxes, repeat kinds, ends, message,
  sound, hiding), so you had to read it all to find the time. The owner went through four previews before this one.
- **The panel** (`src/remind-ui.js`, the same in a note and in All notes): **In… / At…**, a big time box with arrows
  (hours and minutes; mouse wheel, ↑ ↓ and typing work too; two digits jump to the next box), a line saying when it goes
  off, then a message, **Repeat** (round Mo–Su buttons, like the Clock app) or the **day**, the sound, "Hide the note until
  then" ("Can be unhidden from Settings."), and on a locked note "Unlock to dismiss". **Set reminder / Cancel**, or **Save /
  Cancel** with a bin when changing one. Set closes the panel and says "Set for tomorrow 09:00.".
- **Nothing moves:** the panel has one fixed size (`#remPop`, `.mbox.rbox`; it scrolls inside on a small note). In fades
  Repeat and the day instead of removing them; Repeat puts the week days in the day's row; the calendar opens in the same
  box. A click only redraws the panel; it fades only when the view changes (a fade on every redraw made it look like it
  jumped).
- **The day:** its own calendar (no Windows date box): the month name shows the months, the year shows twelve years
  from this one. It always shows six weeks. **Several days** (a new reminder only) makes one reminder per day, with the same
  time and message.
- **It remembers** In / At, the times, the sound and the repeat days from the last one (`localStorage` `remindLast`, like
  the drawing tools'); the message starts empty.
- **Settings → Reminders → Show seconds** (`remindSeconds`, off): the time box gets seconds. `src/reminders.js`
  `nextFrom` now keeps a repeat's seconds (it dropped them).
- **The chip** (`#remChip`, `src/note/remind.js` `paintChip`): the next reminder that isn't ringing ("+2" for more); click
  it to change it (one) or see them (several). Never on a hidden locked note.
- **Repeat is week days now.** "Every month", "every few minutes/days/weeks" and end dates can't be made any more. Old
  reminders with them keep working: the panel shows them in words ("Every month on the 20th") and keeps them unless you
  click "Week days". A repeat whose time and days are as they were keeps its start, so main keeps it as it was.
- **Rules:** `src/reminders.js` has `dayWord` and `status` (the panel's and the chip's words); the quick picks
  (`presets`) are gone with the old panel.
- **Tests:** `note-ui.test.js` (the panel: nothing moves, the calendar, several days, seconds, a repeat kept as it was,
  a locked note), `list-ui-cards.test.js` (All notes' panel, Show seconds), `reminders.test.js` (seconds in a repeat,
  the words, the setting).

## 1.4.18 – 18 November 2026

The window you open or touch last is on top: a note, its toolbars and menus outside it, the notes list. Pinned notes
stay above the rest; of two pinned notes, the one touched last. A small note's » menu and the text's right-click menu are
now the app's own, in the app theme's colours, not Windows' menus.

- **The cause (window order):** Windows brings a window up only when a click gives it the focus. Most of a note's
  windows outside it (drawing and text toolbars, Effects, Checklists) never take the focus (the keyboard stays in the
  note), so a click on one left it under whatever covered it, and its note too; the order of pinned notes (`raisedAt`)
  was only stamped on a click in the note itself, so 2.5 s later `enforcePinned` could put a note whose toolbar you had
  just used back under another one. A window that already had the focus didn't come up either once another of ours had
  come up over it.
- **Now:** every window tells main when it is pressed (`win:touch`, preload `touch`): the note's page (`touch('')`,
  panels.js), each window outside a note (`touch(kind)`, `barOut`, also when one is shown) and the list (events.js).
  Main brings it up (`touchNote`, main/note-window.js: stamps `raisedAt`, `moveTop`, a peek for a note pinned over
  apps); a note's windows outside it then come up in the order they were opened or touched, the one touched on top
  (`liftBars`, main/ink-window.js, `c.liftedAt`). Nothing is saved and no window takes the focus.
- **» menu (src/note/top-bar.js):** it was main's `Menu` (Windows' look, no pictures). Now it is a menu like the
  right-click one (`#moreMenu`, `.ctx`, `--pop-*` colours), each line with its button's picture and a tick on the pin when
  it is on. It opens in a see-through window of its own just under » (a new outside kind, `'more'` / `cosmoMoreBar`,
  `barOut(...).showAt`), so it still shows whole on the smallest and on a rolled-up note (`SHOWS_ROLLED`; toolbars stay
  hidden while rolled up). Esc, a click in the note, » again, the note losing the focus, rolling up, or a wider note (no
  ») close it. `note:bar-menu` / `note:bar-act` and preload `barMenu` / `onBarAct` are gone.
- **One menu for the note (src/note/menus-voice-ink.js `showMenu`):** the » menu, the right-click menus of pictures,
  links, voice notes and tables (in the note before, cut off on a small note) and the text's Cut / Copy / Paste /
  spelling / Add ▸ (Windows' menu from main before) are now the same menu (`#ctx`) in its own window (kind `'more'`,
  made on first use with `K.barOut`). Lines can have a picture, a tick, or › for a sub-menu (Add ▸ shows its lines in the
  same menu, with a way back). The keyboard stays in the note: ↑ ↓, Enter, → / ←, Esc; any other key closes it. For the
  text's menu main still knows the spelling and does the line picked: it sends the lines by id (`note:ctx`, main/web.js)
  and runs the one that comes back (`note:ctx-act` → `runCtx`: Cut / Copy / Paste / Select all, fix a word, Add to
  dictionary, Add ▸); only an id of the last menu counts. The list and a note's windows outside it keep Windows' menu.
- Tests: windows.test.js (touch order, pinned notes, the list, the » window on a rolled-up note), safety.test.js (the
  sixth outside window), note-ui-bar.test.js (the menu in its window: lines, pictures, tick, theme colours, closing,
  rolled up; the text's menu: its lines, an off line, the keys, Add ▸ and back, picks), windows.test.js (`note:ctx`
  lines by id, Paste / a suggestion / Add ▸ done by main, an old id does nothing, Windows' menu outside the note),
  note-ui.test.js (the right-click menus are found in their window). Only a real Windows PC can confirm the order of the
  windows and the menu's window.

## 1.4.17 – 18 November 2026

Bullets, Checklist, Tab and Shift+Tab change only the lines you're on, keep every other line's tick, and Undo always
takes them back (the owner lost 45 ticks in the To Do note: Bullets, then Checklist, wiped the whole list's ticks).

- **The cause:** Bullets in a checklist (`toggleBullets`, note/fx-format.js) made the whole list, every level, bullets and
  took every tick off; Checklist on a bullet list then made the whole list a checklist again, with empty boxes. Both
  changed classes outside Undo (no `domStep`), so Ctrl+Z did nothing. Ctrl+Shift+L / Ctrl+Shift+C (VS Code's "select all
  occurrences", the browser's copy and inspect) or a miss on the two buttons side by side was enough.
- **Now (new "list lines" section in fx-format.js):** both work on the cursor's line or the selected lines (`selLines`),
  each one Undo step with Redo. Those lines go into a list of their own (`splitOff`; the rest of the list stays as it
  was, ticks too; touching lists are still saved as one). A line has a box when any list around it is a checklist, so
  Bullets in a nested line changes its top-level line with what is nested in it (`checkLine`). A line made bullets loses
  its tick (it has no box); Undo gives it back. Checklist on lines that all have boxes is still the editor's own
  command (they leave the list); on words outside a list or a numbered line, the editor makes the list first, and a list
  that only holds those lines becomes a checklist in the same step, as before.
- **Tab / Shift+Tab** (`indentLines` / `outdentLines`): the same line moves one level in (into the list nested in the line
  above, a new one if it has none; a list's first line stays) or out (right after the line it was in; the lines after it
  at its level stay below it, nested in it). The editor's indent / outdent built a new line, so a ticked line came back
  unticked, and Tab left a list right inside a list. A top-level line with Shift+Tab still leaves the list (the editor's
  outdent).
- **Backspace at a checklist line's start:** a nested line goes one level out and keeps its tick; a top-level one leaves
  the list as before. Its tick is no longer taken off first, outside Undo (Undo brought the line back unticked).
- **Enter at the start of a ticked line:** the new, empty line above it has no tick (it took the tick along). The line a
  cut leaves empty keeps its tick on purpose: it is the same line, and taking it off would again be outside Undo.
- **A drawing cleared and Done** goes as one Undo step (`domStep`; before, Undo couldn't bring it back).
- Tests: `note-ui-lists.test.js`, new (Bullets / Checklist on the cursor's line, selected lines, a nested line, a bullet line, words
  under a list; Tab / Shift+Tab / Backspace keep ticks; Enter at a ticked line's start; Undo and Redo of each; the
  drawing). They fail on 1.4.16 at the owner's case.

## 1.4.16 – 18 November 2026

A card no longer blinks while you type in its note: it stays, and the new words write themselves onto it (Ink, the
owner's pick from five ways shown in a preview).

- **The cause of the blink:** every save of a note made the list build a new card and swap it in (`cached()` in
  `list/cards.js`). The new card started its effect over (a new canvas and `FX.Layer`), and its picture stayed hidden
  (`.wait`) until its load event, a frame or more later. Now a note that changed keeps its card: `refreshCard` moves the
  new card's parts into the card on screen, keeps the effect's canvas (the snow carries on), and keeps the classes others
  set (selected, favourite, cut…). The card's own handlers read the note as it is now (`noteById`), not the one it was
  built from. Group cards are still built again.
- **Pictures:** a picture the window already has is shown at once (fitted then, not at its load event), on every card.
- **Ink:** only the new letters write themselves in, one after the other (22 ms apart, each fading in over 0.24 s; at
  most 160 letters, half a second; a longer paste fades in after them). A line typed on writes in only its new letters; a
  line put in between leaves the lines after it alone; lines taken out, ticked boxes or a new colour write nothing in. A
  locked card that is unlocked doesn't write itself in. Off with "Reduce animations" in Windows.
- Tests: `list-ui-cards.test.js` (the edited card stays, keeps its effect's canvas, is measured again; only new letters
  ink, in order; still a favourite; its menu is the note's as it is now), `list-ui-pictures.test.js` (a picture shows at
  once on a card filled again).

## 1.4.15 – 18 November 2026

Several groups' name fonts at once, and the settings for groups and for the notes in them are told apart (the owner's
wish: "Look" and "Edit design" were confusing).

- **The selection bar says what each button changes:** Look is now **Group look** (the picked groups' own cards: look,
  colour and, new, name font) and Edit design is now **Note design** (the picked notes and every note in the picked
  groups; its tooltip says how many). Group look's pop-up starts with "N groups · their cards, not the notes inside" and
  names its rows (Look, Colour, Name font). `groups:update-many` takes `titleFont`.
- **The group panel has two parts:** **This group** (its card: Look, Colour, Name font), tinted with the group's
  colour, and **Notes inside** (with how many: Paper, Font, "Also the notes in groups inside this one", and a new
  **Note design…** button for see-through, effects and the rest, in the same pop-up as for picked notes, for the notes
  the part covers), tinted like note paper.
- "Edit design" is called **Note design** everywhere in the window (the note's right-click menu, the pop-up's title, the
  feature list). The code keeps its names (`openEdit`, `#editSheet`, `bulkEdit`).
- Tests: `groups.test.js` (several groups' name font), `list-ui-groups.test.js` (the bar's names and Note design's
  tooltip, Group look's heading and name font, the panel's two parts, Notes inside → Note design…).

## 1.4.14 – 18 November 2026

Every group card wears the same label (its name and number of notes), and a group's name can have its own font (the owner's
pick from three designs; the To Do notebook's name could hardly be read on dark themes).

- **One label for every look:** the stack, the folder, the envelope and the notebook all wear the same cream label in the
  same spot, near the bottom: the name, and "N notes" under it. Nothing is under the card any more. The folder's label
  rides on its front and the notebook's on its cover, so they tip and turn with them. Before, each look did its own
  thing (the folder had its count on the front, the notebook its name on its label and an empty gap below, the stack and
  the envelope their name and a number pill below): `gfoot`, `.gname-l`, `.gcount`, `.f-count`, `.nb-label` are gone.
  The envelope's seal is a little smaller and higher, and a locked group's padlock sits above the label.
- **The cause of the unreadable name:** the notebook label is always cream, but its name used the theme's ink
  (`var(--ink)`), which is light on the dark themes. The label's ink is now fixed (`#3B3226`).
- **Name font:** Group settings → Name font: Handwritten (as before), Rounded or Medieval. It shows on the card's label and
  in the group's bar. A font never changes a size (like the note fonts): one size per card size (`--lf`), a fixed line,
  the letters matched by `font-size-adjust: .484`; the group bar's name is 20 px with it (it looks as before in
  Handwritten). New group field `titleFont` (store.js `normalizeGroup`: one of `FONTS`, default `hand`); `groups:update`
  takes it, copies keep it.
- Tests: `groups.test.js` (the name font: default, unknown, saved, copied), `list-ui-groups.test.js` (one label on every
  look with name and count, nothing else on the card, dark ink on a dark theme; the panel's Name font, the bar's font, the
  same size).

## 1.4.13 – 17 November 2026

Checklist boxes are static: a box goes by the size of its words, never their font (the owner's wish: switching words
to Handwritten still moved the box).

- `alignChecks` (note/editing.js) measures nothing from the letters any more. The box's size = the note's text size
  (`--fs`) × the sizes from the line's first words up to the line (`sizeOf`: `SIZE` = font size=, `TAG_SIZE` = headings,
  code, sub / sup; a span's own font-size, which the browser writes while typing). It sits in the middle of the line's
  first line, whose height is worked out from the same sizes (`LINE_H`: the line's 1.45, a font tag's 1.3). Before, the
  box was centred on the first letter's measure, and each font's letters sit a little higher or lower, so a font change
  moved it; its size came from the browser's font size of the words.
- Empty lines as before: their own font / size tags give the size; with none, the box they had with words, else the line
  above's. "Keep boxes the same size" as before.
- Tests: `editor-code.test.js` (the tables = note-text.css; `alignChecks` measures no letters, reads no font),
  `note-ui.test.js` (words in every font: the same box at the same place, the same line height).

## 1.4.12 – 17 November 2026

A group's bar stays at the top while you scroll, group cards show their name instead of counts, and a font change keeps
the size of the text and the boxes (the owner's wishes).

- **The group's bar stays in sight:** inside a group, the bar with Back, the name and the settings sticks right under the
  search row while the cards scroll (it used to scroll away, so going back meant scrolling up). `.groupview` is
  `display: contents`, so its parts sit straight in the scrolling view; the bar is `.gstick` (`#gStick`, list.html),
  `position: sticky` at `--stickTop` (the search row's height, from a ResizeObserver in list/events.js). Once the crumbs
  above it are under the search row it is stuck (`#viewNotes.gstuck`, an IntersectionObserver): it gets the window's
  background and the search row's shade. Back stays a drop target while stuck. The group's settings open where they are,
  at the top, so a stuck bar scrolls there first (actions-locks.js `openPanel`).
- **Group cards:** under the card only the name (no number of groups inside, no number of notes), so it has the room.
  The folder and the notebook show how many notes on themselves; the stack and the envelope, which don't, keep the number
  beside the name. The groups inside are in the card's tooltip, as before.
- **A font change keeps the size** (the owner chose Rounded's size for every note): one text size per size (S 13.5, M
  15.5, L 18.5 px), one line height (1.45) and one box (1em, indent 1.55em) for every note font. The letters are matched
  by their small-letter height: `font-size-adjust: .484` (Nunito's) on the editor. So switching a whole note's font, or
  some words' font in the text panel, keeps the text, its lines and its boxes the same size. Handwritten notes are smaller
  than before (they were 23 px at M), Medieval a little smaller; Rounded notes are as they were. This replaces the
  1.3.15–1.4.11 resize per font (`--kf` / `--k` / `--sm`, note-drawing.css; the box's ÷ `--kf`; `BOX` per font): it
  made words in another font, their line and their box grow. A font tag's `size=` is its only size, and its line height
  is under the line's (`#editor font { line-height: 1.3 }`), so a normal-size run in any font leaves its line as it is.
  Cards do the same: one text size per card size for every font, `font-size-adjust` too (store.js `CARD_FACE_SIZE` and
  `cardRuns`' note font are gone, `FONT_PX` is one table).
- Tests: `list-ui-groups.test.js` (the stuck bar, Back clickable, the settings scroll up; the group card's footer),
  `note-ui.test.js` (every note font: same size, line height and box; words in another font: same size and line height),
  `editor-code.test.js`, `store.test.js`, `list-ui-cards.test.js` (one card size, the letters matched).

## 1.4.11 – 17 November 2026

Right-click → Add, links on pictures, a top bar that keeps a small note's title, and click-through in the pin's menu (the owner's wishes).

- **Right-click → Add:** right-click in a note's text: the menu (spelling, Cut / Copy / Paste) ends with **Add ▸**, the same
  items as the + Add button, which stays. The note sends main its Add panel's items once (`addItems`, from the panel's tiles,
  so a new tile shows there too); main adds them only in the text itself (`formControlType` none: not in the title box or a
  password) and only while the note's words show (`main/web.js`, `note-window.js`); the one picked comes back (`note:add`)
  and runs as from the panel (`panels.js doInsert`).
- **A link on a picture:** right-click a photo → **Add link…** (then Open link, Edit link…, Copy link address, Remove link).
  It is `<a href><img></a>`, the usual HTML, so it stays a link when copied out (pasted linked pictures from the web already
  were). The link form has no "Text to show" for a picture, and editing a link never replaces a picture inside it (it did
  for such pasted links). A click on a linked picture opens the link (once for a double-click; Shift+click picks the picture
  to resize it); the caret beside it goes outside the link (`content.js picLink`, `caretAt`); Remove photo takes its link
  too. A little chain in the photo's white strip shows it has one (`note-text.css`).
- **A small note's top bar** (`src/note/top-bar.js`, a new part: 16 now): the title is what matters most. It gets its whole
  width (up to 220 px; on a small note all but » and Close); the buttons that don't fit go into one **»** button, the least
  needed first (Maximise, Minimise, +, All notes, effects, Lock again, close-all, panic, ⋯, the pin, Roll up). Close, and
  click-through's button while it is on, always stay. » shows a real menu from main (`note:bar-menu`: it shows outside the
  window, so it works on the smallest and on a rolled-up note); the pin is a tick there, with **Pin options…** (its
  right-click menu). The line picked presses the button itself (`note:bar-act`). This replaces the old rules that hid one
  button at a time at fixed widths (Effects < 280 px, + < 250 px, Maximise / Minimise with the panic and click-through
  buttons).
- **Click-through in the pin's right-click menu:** its first row (while Settings → Click-through is on). The top bar's
  click-through button now shows only while it is on, as the way back (it still is the one thing that works then); the
  list's right-click → Turn off click-through stays. Settings' text says where it is now.
- Tests: `note-ui-bar.test.js` (new: the top bar at 360 / 200 / 700 px, », its lines and picks; right-click → Add in the
  window), `note-ui.test.js` (a picture's link: the form, the menu, click / double-click / Shift+click, the caret, Undo / Redo
  of Add / Edit / Remove link and Remove photo; click-through from the pin's menu), `windows.test.js` (main: the text's menu
  with Add ▸, not in a box or a hidden note; the » menu), `code-structure.test.js` (the new part).

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

## 1.4.8 – 16 November 2026

The app pin's icon is a little window with the pin stuck into it, and a second right-click on the pin closes its list.

- **Icon** (the owner's pick): the "App letter" tile of 1.4.5 is gone. A note pinned over some apps shows the earlier
  little window again, now behind the pin (the pin on top, stuck into it): `.pinwin` in `src/note.html`, an svg of its
  own under the pin's (it doesn't tilt with the pin); the pin gets an edge in the top bar's colour (`note-base.css`).
- **Fix:** right-clicking the pin while "Pin over" was open opened it again. The note's mousedown closed it first
  (`panels.js`), then the right-click opened it. Now that mousedown leaves a right-click on the pin alone, and the pin's
  right-click opens the list or closes it (`src/note/pin-apps.js`).
- Tests: `note-ui-pins.test.js` (the window behind the pin; right-click opens, the next closes, the next opens).

## 1.4.7 – 16 November 2026

Moving a note no longer hitches twice a second while a note is pinned over an app.

- **Why:** the app pins' check (1.4.5, `main/app-pin.js`) reads every open window's title every 0.5 s. That read is costly
  enough that dragging any note stuttered on each check (the owner's PC).
- **The fix:** the check only runs while the focus is in another app. While a CosmoNotes window has the focus (moving a
  note, typing in it, the list), our app is the one in front and no other app can come in front, so there is nothing to
  read. When the focus leaves, a check runs at once (`focusMoved`, on the app's `browser-window-focus` / `-blur`), so a note
  also follows its app sooner than the next tick. Turning the watch on still checks once right away.
- Tests: `app-pins.test.js` (no clock while one of ours has the focus; a check at once when it leaves).

## 1.4.6 – 16 November 2026

A ring spins around + while a new note is on its way, so a slow PC shows that the click landed.

- **Why:** on a slow PC a new note's window takes a few seconds to show. Nothing showed that the click had landed, so
  the owner clicked again and got several notes at once.
- **The ring:** the + button in the note (and Ctrl+N there) and the list's New note button spin a ring until every note
  they asked for has shown (`.busy`, `newSpin`: only `transform` animates, so it stays cheap on a slow PC). Every click
  still makes a note: spamming + is allowed (the owner's wish).
- `createNote` (`main/note-window.js`) returns a promise of the note's id, settled when its window shows or closes first
  (`win.ready`); `note:new` and `list:new` return it.
- Tests: `windows.test.js` (quick clicks while windows load: one note each, each answered when its own note shows),
  `note-ui.test.js` (the ring spins until all have shown).

## 1.4.5 – 15 November 2026

Notes that stick to an app: right-click the pin and tick the apps a note belongs to. The note mirrors its app: on top
while it is in front, behind the other apps while it is open behind them, gone while it is minimised or closed.

- **App pins** (`main/app-pin.js`, `src/note/pin-apps.js`). Right-click a note's pin: "Pin over" lists Every app (the
  normal pin) and the apps open now, A to Z, each with its workspaces or files under it (a VS Code folder, an Excel
  file). Tick one or more. A ticked app covers its workspaces. An app the note is pinned over that isn't open stays in
  the list, ticked, with "not open". Nothing ticked = not pinned. A click on the pin still unpins, and forgets the apps.
  The pin gets a tile with the app's first letter (V for VS Code, + for several apps; the owner's pick of six designs)
  and lists the apps in its tooltip. The list's card says "Over Excel +1".
- **How main knows the app in front:** `desktopCapturer.getSources({ types: ['window'] })` lists the windows with their
  titles, front to back. Our own windows are skipped by their handle, and the first one left is the app in front. Its
  title gives the app (the last part: "… - Visual Studio Code") and the workspace (the part before it). Browsers get no
  workspaces (their title changes with each page). Nothing native, nothing for Smart App Control to block. The check runs
  every 0.5 s, only while an open note is pinned over apps. If the list can't be read, every note shows.
- **It drops in** (the owner's pick of three): coming, the note fades in while it drops 10 px into its place (0.18 s);
  going, it fades out rising (0.13 s), then hides and is put back. Only its opacity and place change for a moment
  (`animate`); its saved place never does (`rememberBounds` now also skips an unchanged place: no disk write per switch).
- **Mirrors its app** (the owner's wish): one of its apps in front = on top, like any pinned note. Its app open but another
  app in front = the note stays on screen, not on top but just above its app's window (`win.appBehind`: no always-on-top,
  `moveAbove` the app's window), so whatever covers the app covers the note. Its app minimised or closed (not in the list)
  = hidden, and back when the app (or that workspace) opens again.
- **Hidden, not closed:** the window hides (`win.appHidden`) and stays open, so nothing is lost. `enforcePinned` leaves a
  hidden one hidden and one behind its app behind. It shows anyway while its own window has the focus, while a reminder rings, and after you open it from the list,
  Bring notes to front, or Reopen closed note (until another window comes in front). A note that opens pinned over apps
  waits for the first check, so it doesn't flash.
- **Data:** `note.pinApps` (`[{ app, part }]`, part null = any window of the app), only while pinned (store.js
  `cleanPinApps`). Not an edit. A hidden locked note may change it (`WHILE_HIDDEN`, a kind of pin); its card gets no
  names. New IPC `pin:apps` (the open apps, for the list).
- Not confirmed on a real PC yet: that Windows gives the windows front to back, that minimised windows are left out of
  the list (WebRTC skips them; if not, a minimised app would count as open behind), and the check's cost. Also: an app whose
  title doesn't end with its name groups by the wrong part, and another app's always-on-top window counts as "in front".

## 1.4.4 – 15 November 2026

A list pasted from another app into a checklist line becomes lines of the checklist, not boxes inside a box.

- **Fix:** a list copied from a chat or a web page comes with a paragraph or wrappers around it. Chromium's
  `insertHTML` only merges a pasted list into the list you paste into when the piece starts with the list itself;
  otherwise the whole piece went inside the line, a list of its own, and in a checklist every one of its lines got a box
  inside the line's box. Now other apps' HTML pasted into a list line (`inListLine`) is turned into one flat list first
  (`asListLines` in `src/note/content.js`): every paragraph, heading and list line is a line, the list's own nesting and
  numbers go, and the lines join the list you paste into, at that level. One line pastes into the line itself. A copy
  from a note keeps its lists as they were. One Undo takes the paste back.

## 1.4.3 – 15 November 2026

Right-click a photo → Copy image works again: the picture pastes into chats, Paint, Word and other apps.

- **Fix:** Copy image always said "Couldn’t copy this picture". The note window is a `file://` page and read the photo
  with `fetch('stickyfile://…')`; that is another origin and the scheme has no CORS, so the fetch failed (and drawing
  the `<img>` itself on a canvas is refused for the same reason; a picture pasted from a web page, with its `https://`
  address, failed that way). Now main reads the picture (`att:image` in `main/ipc-files.js`: a saved photo, sealed ones
  only after the PIN, or a web picture through `net.fetch`; nothing for a hidden locked note's window), the note turns
  it into a PNG at full size (any format: PNG, JPEG, GIF, WebP, BMP), and main writes it with Electron's `clipboard`
  (`clip:image`), which needs no focus or clipboard permission.

## 1.4.2 – 15 November 2026

Pinned notes stack the way you'd expect, Note settings opens next to its note, and text sizes are numbers.

- **Pinned notes over each other:** the one you pinned or clicked last stays on top. Every 2.5 s `enforcePinned` called
  `setAlwaysOnTop(true)` on each pinned note (but not the one with the keyboard), and Windows puts a window above the
  other on-top windows at each call, so the notes ended up in the order their windows were opened, and a note you were
  typing in went under the others. Now main stamps `win.raisedAt` when a note goes on top, is clicked (`focus`) or is
  brought up (Bring notes to front, a reminder), and `enforcePinned` calls them oldest first. `applyState` calls
  `setAlwaysOnTop` only when on-top really changes (a new colour or see-through no longer brings a note up).
- **Note settings (and every pop-up or toolbar outside a note) opens next to its note.** A loose one's place was kept
  as a spot on the screen, in `localStorage`, which every note shares: Note settings opened at the same spot for any
  note, even on another monitor. Now it is kept from the note (`{ mode: 'free', dx, dy }`) and opens on that note's
  monitor (`nearNote`); places saved by older versions are dropped once (it opens inside the note). One stuck to a side
  stays on its note's monitor at the monitor's edge (it went onto the next monitor). Dragged, it can still go anywhere.
- **Text sizes in the A toolbar are numbers:** 0.7, 0.8, 1.0, 1.2, 1.5, 1.9 (times the note's text; they were Small,
  Normal, Big and Huge, font sizes 2, 3, 5, 6; now 1–6). The size at the cursor or the selection's start is lit; a size
  picked for what you type next stays lit until the cursor moves. Sizes themselves didn't change (0.82, 1.45 and 1.85
  show rounded).

## 1.4.1 – 14 November 2026

Reminders: a note can pop up when you need it. At its time it opens on the monitor you're using, stays on top, glows,
wobbles once and plays a calm sound, with Snooze and Done. Also a fix for 1.4.0: notes didn't save while you typed.

- **Fix (1.4.0):** `preload.js` had two `update` keys in `window.sticky`. The second (1.4.0's updates, for Settings →
  About) replaced the first, the note window's save (`api.update(patch)`), so typing, the title, colour and every other
  change in a note threw instead of saving; only closing the note (its unload's `updateSync`) saved. The updates are
  `window.sticky.updates` now, and `code-structure.test.js` fails on a name used twice in one object of `preload.js`.
- **Adding** (`src/remind-ui.js`, the same panel in both windows): Add → Reminder in a note, or right-click a note in
  All notes → Reminders…, or a card's clock. Quick picks (In 20 min, In 1 hour, Today 15:00 while it's ahead, Tomorrow
  09:00, Next Monday 09:00) or Custom (date + time); repeat: every day, weekdays, every week (pick days), every month, or
  every N minutes (5 or more) / hours / days / weeks, ending never, on a date or after N times; an optional message; a
  sound (10 calm nature sounds, made with Web Audio, no files; ▶ plays it); "Hide until it goes off"; on a locked note
  "Unlock to dismiss". A note can have several (up to 30); each change saves at once.
- **Going off** (`main/reminders.js`, `src/note/remind.js`): one timer in main for the next reminder (at most a minute
  ahead; waking the PC checks at once). The note's window opens (or comes up where it is, unrolled) without taking the
  keyboard, on top of other windows while it rings, and its taskbar button flashes. A window that wasn't open appears
  where it was if that's on the monitor with the mouse, else in that monitor's top-right corner. A strip under the top
  bar shows the message (or "Missed at 14:00"), Snooze 10 min (the arrow: 5 min, 30 min, 1 hour, tomorrow 09:00) and
  Done. The sound plays when it goes off and again after each snooze. Done ends a one-off; a repeat goes on to its next
  time. A snooze moves only that time.
- **Missed**: over a minute late (the PC was off or asleep, CosmoNotes closed) = "Missed at …"; a repeat that missed
  several times rings once, for the latest. One still ringing when CosmoNotes quit comes back at start, quietly.
- **Hiding**: while one of its reminders has "hide" on and none rings, the note's window is closed and All notes leaves
  it out (also from the counts, groups and search), unless Settings → Reminders → Show hidden notes is on or the new
  reminders button next to the search is. That button shows only notes with reminders, ringing ones first, then the
  soonest; hidden ones are faded. Every card with a reminder has a small clock (what they are on hover, red while one rings).
- **Locked notes**: the messages are secret like the note's words (`note.remindMsg`, in `SECRET` and crypt.js
  `SECRET_FIELDS`: sealed with the note, blank in a hidden window and never on a card); the times stay readable, so a
  reminder goes off before the PIN is typed. A hidden locked note can't have its reminders changed (1.3.28), except
  Snooze and Done when the reminder doesn't ask for the PIN.
- **Settings → Reminders**: the sound (each reminder can pick its own), the volume, and Show hidden notes
  (`remindSound`, `remindVolume`, `remindShowHidden`). Panic: notes the panic button closed stay closed while it keeps
  them; their reminder rings when they're opened again. A restored backup copy and a duplicate don't take the reminders.
- **Line endings**: `.gitattributes` gives `/preload.js` (the top folder's only) CRLF; the old `preload.js` rule also
  caught `src/engine/preload.js`, which is LF (CLAUDE.md). `tests/fake-electron/index.js` is LF again.
- The rules are one file, `src/reminders.js` (like `src/evening.js`: both windows, main and store.js). The note window
  has 13 parts (`src/note/remind.js` comes before `eraser-start.js`, whose start-up uses it).
- Tests: `reminders.test.js` (the rules, and main's side), the strip and the panel in `note-ui.test.js`, cards, the
  filter and the pop-up in `list-ui-cards.test.js`.

## 1.4.0 – 14 November 2026

Updates without building: CosmoNotes finds a newer version on GitHub and installs it with one click (Settings → About,
or the tray). Releases are built and published by GitHub Actions; `release.bat` sends one.

- **In the app** (`main/updater.js`, `main/ipc-update.js`): Settings → About has Updates (Check for updates; Version X
  is ready + Install; the download's progress and Cancel; Couldn't download / Couldn't start + Open the download page
  and Try again) and a "Check for updates" switch (`settings.updateCheck`, on): the installed app checks 30 s after it
  starts and once a day (an hourly tick, so a PC that slept still checks). A quiet check that fails shows nothing. A
  newer version puts a dot on the Settings tab and About's heading, and "Update to X…" in the tray menu (it opens
  Settings → About).
- **The feed**: `latest.yml` from the newest GitHub release (electron-builder writes it). Only main goes online, only to
  `github.com/vkashirski/CosmoNotes/releases`. The file name must be `CosmoNotes-Setup-<version>.exe`, with a size and
  a sha512.
- **Install** asks first, then downloads to `%TEMP%\CosmoNotes-update` as `.part`, checks size + sha512 (a wrong file
  is deleted, never started), and quits like Quit: every window saves on unload, will-quit finishes recordings and
  flushes the store, and only then the installer starts (`--updated /S --force-run`: silent, and it opens CosmoNotes
  again with the notes where they were). Not during a voice recording or voice to text ("busy"); one that starts
  during the download is waited for. If Windows refuses the installer (Smart App Control, antivirus), CosmoNotes opens
  again by itself (`--update-failed=<version>`) at Settings → About: "Couldn't start the update." Installers from
  earlier updates are deleted at start. `npm start` can check but not install.
- **Releases** (`.github/workflows/release.yml`): a pushed tag `v<version>` runs `npm test` with the browser tests on
  Linux, then builds on Windows (`npm ci`, `--publish never`), checks that `CosmoNotes.exe` is Electron's own
  `electron.exe`, and only then publishes the installer, its blockmap and `latest.yml` (`gh release create`) with this
  CHANGELOG entry as the notes (`build/release-notes.js`). `release.bat` checks you're on main with everything
  committed and the version not released yet, asks, pushes main and the tag, and opens the Actions page.
- **The installer is now `CosmoNotes-Setup-<version>.exe`** (dashes: GitHub renames spaces, which broke the name in
  `latest.yml`). `package.json` names the GitHub repo (`build.publish`); `build.bat` builds with `--publish never` and
  stays for local builds.
- **Line endings are fixed in git** (`.gitattributes`): a fresh clone, or GitHub's Windows machine, gets the CRLF / LF
  files CLAUDE.md lists. Before, git stored them all as LF and only the owner's working copy had the CRLF ones, so a
  fresh clone failed `code-structure.test.js`.
- Tests: `updates.test.js` (main's side, against a local server playing GitHub), About → updates in
  `list-ui-settings.test.js`, `release.test.js` for the 1.4 series (1.3 ends at 1.3.38).

## 1.3.38 – 12 November 2026

Only a checklist box itself ticks its line (the owner's wish): a click under the box, beside a long line's other rows,
or in the gap between the box and the words now just puts the caret there.

- Cause: `boxAt` (checklists.js) took any press left of the words (the line's whole `padding-left` strip, all the way
  down a wrapped line) as a press on the box. Now it hit-tests the box's own rectangle: the line's `::before` as
  `alignChecks` placed and sized it (`getComputedStyle(li, '::before')` left / top / width / height, in the note's px:
  `zoomOf`). The old check for lines nested in it is gone: their space is never inside the box.
- Dragging a box to move its line starts the same way, so it also needs a press on the box itself.

## 1.3.37 – 12 November 2026

The search rows (Notes, Bin, Settings) stay at the top while you scroll, and are now solid (the owner's report): what
scrolls under them no longer shows in a thin strip above the search box, at its corners or between its buttons.

- Cause: `.searchrow` (list-base.css) is `position: sticky` with no background, so its 2px top padding, the box's
  rounded corners and the gaps between the buttons were see-through. Fix: it gets the window's colour and dots
  (lined up with the view's at the top: `-12px -88px`) and a solid 8px edge below the box (`padding-bottom: 8px`;
  `margin-bottom` 12px → 4px, and Settings' `-8px` with its 12px gap, so the spacing at the top is unchanged).
- Once the view scrolls, a soft shadow appears under the row (`searchShade`: a scroll-driven animation,
  `animation-timeline: scroll(nearest)`, no JS; `--searchShade` is darker in dark themes).

## 1.3.36 – 12 November 2026

The search in Settings also knows other names for each section (the owner's wish): "dark mode" finds General (the
colour themes), "dictation" finds Voice to text, "boss key" finds Panic button, "password" finds Locked notes.

- Each section in `src/list.html` has a `data-find` attribute: a list of other words for what it does (dark mode,
  startup, todo, grammar, appdata, color/colors…). `findSettings` searches them along with the section's own text, with
  the same rule (every word typed must start one of them). A word may find more than one section ("transparent": For
  new notes and Click-through).
- A new Settings section needs its own `data-find`: `list-ui-settings.test.js` fails without one.

## 1.3.35 – 12 November 2026

Settings has a search box at the top (the owner's wish: Settings has many folded sections now). Type "evening" and only
Evening colours shows, already open.

- **Matching (`findSettings`, `src/list/actions-locks.js`, next to `foldPanels`):** a section matches when every word
  typed starts a word in it ("eve" finds "Evening", not "never"); any case; ’ counts as '. It looks at the section's title
  and the text it shows: not hidden parts (`hidden`, e.g. a `.reapply` row) and not About's feature list
  (`details.fold`), so "evening" doesn't also bring up About.
- **Folds:** the matching sections open; the rest get `.unfound` (not `hidden`, so search never clashes with code that
  hides things). Clearing the search (X, Escape, or deleting the text) puts every section back open or closed as it
  was before the search began (`foldsBefore`). `setFold` now opens and closes a section for both the title click and
  the search (keeps `aria-expanded` in step). Nothing matches: "No settings match."
- **Keys:** Ctrl+F in Settings goes to this search (it used to switch to Notes). Ctrl+F also selects what's already in
  a search box. Escape in Settings clears it.
- Tests: `list-ui-settings.test.js`.

## 1.3.34 – 12 November 2026

Click-through: a pinned note can let the mouse through, so you can read it over a video or a game and click what's
under it (the owner's wish). A button left of the pin turns it on and off; while it's on, that button is the only thing
on the note that works. Turn the button on in Settings → Click-through. The panic button moved to the left of the title,
away from it.

- **Why a button and not "hold Ctrl" (first plan):** Electron forwards the mouse's moves to an ignoring window with no
  keys in them (`wParam = 0`), and Chromium reads Ctrl with `GetKeyState`, which goes stale while another app has focus.
  So Ctrl would only have worked when CosmoNotes already had focus. A global key hook would need a native DLL (Smart
  App Control). The owner chose the button.
- **Main (`main/note-state.js`):** `applyClickThrough` (from `applyState`) calls `setIgnoreMouseEvents(true, { forward: true })`
  while `note.clickThrough` and `settings.clickThroughOn` are on. The note sends `note:ct-awake` while the mouse is on its
  button (`win.ctAwake`): the window takes clicks only until the mouse leaves the button. Settings on / off:
  `applyClickThroughAll`. A click-through note stays see-through under the mouse (`note:hover`).
- **The note:** `note.clickThrough` (store.js: only with `pinned`; turning it on pins the note, unpinning ends it; not
  copied by Duplicate). It's in `WHILE_HIDDEN`, so a locked note's window can still turn it off. `body.ct`
  (note-base.css): nothing but the button takes the mouse (no hover, no drag, no mouse follower); the other top-bar
  buttons fade.
- **The list:** right-click a click-through note → Turn off click-through (`list:click-through-off`, refused for a note
  hidden in the list). Settings → Click-through has the switch (`clickThroughOn`, off at first).
- **Top bar:** order is List, New, Panic, title … Effects, Click-through, Pin. With both Panic and Click-through, a note
  under 225 px also hides Minimise (Maximise already goes under 250 px).
- Tests: windows.test.js (ignoring with forward, waking on the button, unpinning, Settings off / on, the list's item),
  locks.test.js (a hidden locked window may change it; the list may not), note-ui.test.js (the order of the buttons,
  only the button takes the mouse, awake on and off, a 200 px note fits), list-ui-settings.test.js (the switch, the
  right-click item). `fake-electron` has `setIgnoreMouseEvents`.
- Needs a real Windows PC: that clicks really go through to a game or video while the mouse's moves still reach the note.

## 1.3.33 – 11 November 2026

In the notes list, a note card's star and lock get an outline while you point at the card, so they show over a dark or
busy photo (the owner's report).

- list-settings-fx.css: `.card:not(.group):hover > :is(.fav, .lockb) svg` gets a halo of the card's paper colour
  (`drop-shadow`). A group's star and lock already sit on a round badge, so they are unchanged.
- list-cards.css: the box of hover buttons at the bottom right (`.acts`: open, out of group, Bin) has a thin accent edge
  now, instead of a faint grey one.

## 1.3.32 – 11 November 2026

Ctrl+Z now undoes every change the note makes itself, not only typing (the owner's wish, after 1.3.31). Redo does each
again.

- **What couldn't be undone before:** the photo's right-click menu (Remove photo / drawing, Small, Medium, Full width,
  Keep size, the description), dragging a photo's size handle, Edit sketch (the new drawing over the old one), Remove
  recording, Edit link, Remove link, every table option and the row Tab adds in the last cell. A web address typed into
  a link (`autoLink`) was the worst: its link never went away, and Undo of the typing broke the text around it.
- **One way for all of them** (panels.js): `domStep(fn)` records what `fn` changes in the note as it happens (a
  `MutationObserver`: elements added and removed, attributes, texts) and makes it one step of ours (`ownStep`, 1.3.31).
  Undo plays the records backwards, putting back the same elements and text nodes, so the editor's own earlier steps
  still fit; Redo plays them forwards. The cursor goes back to where it was. `domRecord(keep)` … `.end()` does the same
  for a change spread over many events (the size handle: only that photo's width counts).
- `insertNodes` (photos, drawings and voice notes going in) is a `domStep` now: its own hand-made Undo from 1.3.31 is gone.
- Tests: note-ui.test.js (each of these: it changes the note, Undo puts it back, Redo does it again; a typed address:
  Undo takes the typing, the link, then the address, each as it was).

## 1.3.31 – 11 November 2026

Ctrl+Z takes back a pasted photo (the owner's report). The note's text has one Undo history again, with the note's own
steps in order among the editor's.

- **The cause.** Photos (pasted, dropped, + Add), drawings and voice notes go in through `insertNodes` (fx-format.js),
  which changes the page itself: the editor's own insert command breaks voice notes (it unwraps the chip or moves it
  onto a line of its own). The editor's Undo only knows its own commands, so it never saw them. The note's own steps
  (`textUndo`, 1.3.19: checklist ticks and moves) didn't help: any typing wiped them, and `insertNodes` never made one.
- **One history** (panels.js): `ownStep({ undo, redo, alive })` keeps a step of ours with how the note looked right
  after it (`after`, the saved form from `collect`). Undo takes it back once the note looks like that again (the
  editor's later steps are undone), or when the editor has nothing left. `textRedo` holds our steps and `NATIVE` (one
  editor step undone) in Undo's order, so Redo goes back the same way. Typing no longer wipes our steps; `nativeRedo`
  is gone. A step whose element left the note (`alive`) is skipped.
- **insertNodes is one step:** Undo takes the elements out; in the middle of a text it joins the two halves back into
  the first one, the text node the editor's earlier steps point at, so they keep working. Redo cuts it again and puts
  the same second half back. Selected words are deleted by the editor first (its own step).
- **Keys:** Ctrl+Z / Ctrl+Y always go through `undoText` / `redoText` now (editing.js), except in a text box (title,
  Find…), which keeps its own. Redo greys out when our list is empty: the editor's own Redo may still hold steps from
  before one of ours, which no longer fit.
- Tests: note-ui.test.js (a pasted photo among typing, Undo / Redo order, one text again; a tick stays undoable after typing).

## 1.3.30 – 11 November 2026

Reopen closed note, like a browser's closed tabs (the owner's wish): Ctrl+Shift+T in the notes list, or the tray's
"Reopen closed note", opens the note closed last again. Press again for the one before.

- **What counts** is a note the owner closed: its X, Alt+F4, or Close in the list (card button, right-click, the
  picked-cards bar). Not the panic button (it has "Reopen notes"), the Bin, locking, quitting or Windows shutting down.
- `main/closed-notes.js` keeps the ids, newest last (up to 25; closed again = back on top). A note that is binned,
  deleted or already open again is skipped. Only while CosmoNotes runs: after a restart the closed notes are still in
  the list.
- **Recorded when the window is gone** (its `closed` event, `win.byHand`, set by `note:close` and
  `closeNoteWindow(id, { byHand: true })`; Alt+F4 after its 2.5 s wait), not when `close()` is called: Electron closes a
  window a moment later, and the tray's item would still see it open.
- It opens where it was (`reopenClosed`, note-window.js). A locked note asks for its PIN, as when opened from the list.
- **Tray:** "Reopen closed note" under "Bring notes to front", grey when there is nothing to reopen
  (`onClosedChange` rebuilds the menu). IPC `list:reopen-closed`; the key is in list/events.js.
- Tests: `windows.test.js` (X, Alt+F4, the list's Close, newest first, not twice, skipped when open or binned, the tray
  item), `list-ui-cards.test.js` (Ctrl+Shift+T in the list).

## 1.3.29 – 11 November 2026

Erasing or undoing a drawing no longer changes the text under it (the owner's bug: a table behind a line un-wrapped).

- **The cause.** The first drawing on a note with word wrap on turns word wrap off and keeps the text at its width, so
  the drawing stays on its words (`#sheet.fixed`). Which kind of "off" a note was came from the drawing itself: with a
  drawing, the locked width; without one, "no limit" (1.1.45). So when the last line was erased or undone, the same note
  became "no limit": every line only ended at Enter, and a table's cells grew into one long line each. Undo and the
  eraser did their job; the layout changed under them. Undo then brought the line back over a different layout.
- **Now** the kind is saved with the note (`note.wrapFixed`, store.js `normalize`): set by that first drawing, `false`
  from the word wrap button. Erasing, undoing and Clear all leave the layout alone; only the word wrap button changes it.
  `applyLayout`'s "no limit" no longer looks at the drawing (`noLimit`, lock-zoom.js). Duplicate copies it.
- **Notes from before** get the kind they showed then: locked when they have a drawing, no limit when not (`normalize`;
  a locked, sealed note when it is opened: `openedLayout` in crypt.js `openAll`). Nothing changes how it looks. A note
  whose drawing was already erased before 1.3.29 stays "no limit": the word wrap button turns it back on.
- Tests: `note-ui.test.js` (a table on a word-wrapped note: drawn, undone, redone, erased; the table keeps its width and
  wrapping, and no layout change is saved), `store.test.js` (wrapFixed kept, older notes, sealed ones, typing after the
  drawing is gone, Duplicate). Fails on 1.3.28.

## 1.3.28 – 8 November 2026

A locked note or group can't be changed until it is unlocked (the owner's wish). While its lock hides it, you can only
select it and use its lock options.

- **Notes list.** A "shut" card (`isShut`, list/base.js: a note main sends as `locked`, a group that isn't `open`) has a
  right-click menu of just Select and the lock options (Unlock… / Lock again, Remove lock…). No buttons on the card, no
  dragging (nothing can be dropped onto it or into it either), and its star only shows a favourite. Picked with others,
  the bar and its menu leave it alone (`bulkParts(all)`: only Lock and Bin look at it). Edit design never opens for it,
  and closes if its note gets locked meanwhile; its old read-only-title mode (`ed.cover`, 1.3.11) is gone, and so is
  `cover` in `list:get` (it was the same as `locked`). Clicking the card still opens the note (its window asks for the PIN).
- **Note window.** While a locked note is hidden, there is no ⋯ menu and no effects button (note-text.css): the lock
  screen, Pin, Roll up and the window's own buttons stay. The read-only titles of 1.3.11 are gone with it.
- **Main refuses it too**, so it doesn't rest on the windows. `applyPatch` takes only `WHILE_HIDDEN` (pinned, rolled) from
  a hidden window (it used to drop only the contents and titles). Favourite, Edit design, colour/font, duplicate (also from
  the note's own window), close, move, drag into a group, a new group: refused for a note hidden in the list
  (`hiddenInList`) or a group that is shut (`groupShut`, main/list-visibility.js: locked and not open, or inside one).
  Rename, look, colour of its notes, Ungroup: refused for a shut group.
- Before, a locked card's colour, see-through, effects and favourite could change, and it could be copied, moved or put in
  a group. Tests: locks.test.js (main), list-ui-locks-bin (list), note-ui (window); colours, crypt, duplicate and unlock
  follow the new rule.

## 1.3.27 – 8 November 2026

Three new Settings, the owner's wish: evening colours, a panic button, and "Use on all notes" for every setting a note
can change for itself.

- **Evening colours** (Settings → Evening colours; off until turned on). From the evening time (19:00) until the day time
  (07:00) a light paper turns into a softer shade of its own: Lemon → Honey, Sky → Dusk blue, Bubblegum → Dusky pink…
  (`src/evening.js`, one list for both windows and main). Dark text stays dark, so text colours picked in a note still
  read (a test checks contrast ≥ 7 and that each shade is clearly dimmer). The dark papers stay as they are. Each change
  fades over 30 minutes. Main keeps the one clock (`main/evening.js`, every 30 s) and tells the windows the phase (0 – 1);
  each window mixes its colours by it in CSS (`--d-*` day, `--e-*` evening, `--eve`; note-base.css, list-cards.css), so
  the note, its card in the list and its window background always agree. A note can have it on or off for itself
  (⋯ menu, `note.evening`).
- **Panic button** (Settings → Panic button; off until turned on). A button in each note's top bar (an eye that shuts,
  red when pointed at), "Panic: hide all notes" in the tray, and a shortcut that works in every app (none until one is
  set; Settings suggests Alt+Z and F8; press keys to set it; a letter needs Ctrl or Alt). One press closes every open
  note, locks again everything that was unlocked, and closes the notes list. A note with "Close with the panic button"
  off (⋯ menu, `note.panic: false`) is left exactly as it is, unlocked too (the owner's pick). The closed notes come back,
  still locked, when CosmoNotes is opened again: the tray icon or its "Reopen notes", starting it again, or the next start
  (`settings.panicClosed`). Main: `main/panic.js`; the shortcut is let go while Settings waits for a new one, and on quit.
  A note narrower than 251 px hides its Maximise button while the panic button shows (double-click still maximises).
- **Use on all notes.** Under each setting a note can change for itself (font, see-through, turn solid, background
  effect, mouse follower, paused effects, spelling, the three checklist options, evening colours, panic button), Settings
  says how many notes have their own, with a button that puts Settings back on all of them (it asks first). General →
  "Reset notes…" does several at once, with a tick for each. Font, see-through and turn solid stay "for new notes" (the
  owner's pick): the button copies the value in. The rest follow Settings again. Paper colour has no button (it would
  recolour every note at random), nor title font. Notes in the Bin are left alone; it isn't an edit. One table says what
  each setting means (`store.js` `OVERRIDES`, `overrideCounts`, `resetPatch`); main: `settings:reapply`.
- Changed on the way: "Lock again" in the Locked tab and the panic button share `coverAll` (`main/list-visibility.js`);
  closing a note from the list and from the panic button share `closeNoteWindow` (`main/note-window.js`).
- Only a real Windows PC can confirm the shortcut while another app has the focus, and the tray.
- Tests: `evening.test.js` and `panic.test.js` (new areas; panic with a real restart), `settings.test.js` (Use on all
  notes), `store.test.js` (fields, settings, the table), `list-ui-settings.test.js` (the panels, pressing a shortcut,
  Use on all notes, Reset notes…), `note-ui.test.js` (the mix, the ⋯ switches, the button), `code-structure.test.js`
  (`src/evening.js` in both windows).

## 1.3.26 – 8 November 2026

An empty, invisible line between two checklists no longer keeps them apart.

- **The cause** (seen in the owner's To do note): the editor had left an empty `<div></div>` between two checklists.
  With nothing in it (no letters, no line break) it is zero lines high: a 1 px line that can't be seen or clicked. It
  counted as something between the lists, so they weren't one group (1.3.25), and the unticked lines of the lower list
  stayed below the ticked ones.
- **Now** (`src/note/content.js` `blank`): between two lists, a block with nothing in it at all counts as nothing, like
  spaces. While the note is open the lists are one group; when it opens or is saved, the empty block goes and the lists
  are one (`joinLists`). A real empty line (`<p><br></p>`) still keeps two lists apart.
- Tests: `note-ui.test.js` (an empty div between: opens as one list; while open, tidied as one group). Fails on 1.3.25.

## 1.3.25 – 8 November 2026

Two checklists that touch (the empty line between them deleted) now work as one list: ticking and the tidy-up move
lines across both, and the note is saved with one list. Redo also goes back in the right order.

- **The cause:** deleting the line between two lists leaves two lists side by side in the editor. They look like one,
  but ticking and the tidy-up (1.3.24) worked on each list alone.
- **Lists that touch are one group** (`src/note/content.js` `listGroup`, `touching`; `checklists.js` `sink`, `gather`):
  a ticked line goes below the last unticked line of the whole group; the tidy-up sorts the group as one. Same kind
  only: checklist with checklist, bullets with bullets.
- **Saved joined** (`joinLists`): `collect` (base.js) saves them as one list, a pasted piece is joined, and a note joins
  them when it opens. While the note is open the editor keeps its two lists, because the editor's own Undo / Redo
  remembers them that way (joining them live made Undo lose the deleted line, and Redo put lines in the wrong place).
- **Redo order** (`panels.js` `nativeRedo`): Redo brought back the note's own steps (ticks, moves) before the editor's
  steps that were undone after them. It now goes back in the order Undo went.
- Tests: `note-ui.test.js` (the deleted line: saved as one list, tidied as one, Undo brings the line back; a tick across
  both; Undo / Redo order; a saved note with two touching lists opens with one). Fails on 1.3.24.

## 1.3.24 – 8 November 2026

Turning "Move ticked items to the bottom" on in a note tidies its lists: the ticked items go below the unticked ones.

- **The note's Checklists pop-up** (`src/note/checklists.js` `setChecks`, `gather`): when the switch (or Use Settings)
  turns it on, every list in the note gets its ticked lines moved below its unticked ones, each kept in its order. Each
  list on its own: a list after other text, and a list nested in a line, are tidied apart; a line takes its nested lines
  with it. Lists with nothing out of place aren't touched (the note isn't saved if nothing moved). One Undo step.
- Settings → Checklists doesn't rearrange any note: there, only what is ticked from then on moves (it would change every
  note, locked ones too). Opening a note doesn't tidy it either (a line dragged up on purpose stays).
- Tests: `note-ui.test.js` (three lists, one nested; Undo; off and on again; nothing to move). Fails on 1.3.23.

## 1.3.23 – 8 November 2026

Undo and Redo are greyed out when there is nothing to take back or put back.

- **Bottom bar** (`src/note/panels.js` `paintUndo`): `#btnUndo` and `#btnRedo` are `disabled` by one rule (`canUndo` /
  `canRedo`). While drawing: the drawing lists (`inkState.undo` / `redo`). Otherwise: our own text steps (`textUndo` /
  `textRedo`), then the editor's own history (`queryCommandEnabled`). A locked note has nothing to undo.
  `paintUndo` now also runs after every edit (`input`), after a checklist step and its Undo / Redo, and when a note opens,
  locks or unlocks (`eraser-start.js`, `lock-zoom.js`, `checklists.js`). Drawing already called it on every change.
- **Drawing pop-up** (`menus-voice-ink.js` `redraw`): its Undo greys out when nothing is drawn.
- Style: `.tb:disabled` (`note-toolbars.css`) and `.dtool:disabled` (`note-drawing.css`): grey, no hover.
- Tests: `note-ui.test.js` (fresh note: both grey; typing, Undo, Redo; a stroke and undoing it). Fails on 1.3.22.

## 1.3.22 – 8 November 2026

Dragging a pop-up or toolbar no longer lags behind the mouse, and "close all" closes every menu, also one outside the note.

- **Dragging** (`src/note/draw-over.js` `movable`): every mouse move moved the toolbar or pop-up at once; outside the note
  that is a message to main and its window moved each time. A fast mouse sends several moves a frame, they queued up,
  and the Checklists pop-up (or any other) lagged behind. Now only the last move of each frame counts (after 100 ms
  without a frame, the move counts anyway); letting go uses the very last one. Not reproduced in the cloud (no real
  mouse or Windows windows there): to check on the owner's PC.
- **Close all** (`src/note/panels.js`): pressing the button counted as a click elsewhere in the note, which closes the
  menus inside the note. With one menu outside the note (the ⋯ menu dragged out) and one inside, that left one open,
  the button hid (it shows only for two or more), and its click never came. The button is now left out of that rule.
- Tests: `note-ui.test.js` (many moves in one frame move a pop-up once; pressing Close all closes nothing, its click
  closes all). Both fail on 1.3.21.

## 1.3.21 – 8 November 2026

The note's checklist options moved out of the ⋯ menu into a pop-up of their own: ⋯ → Checklists… (the owner's pick, A).

- **The ⋯ menu** has one row, "Checklists…", under "Effects…", instead of a heading and three switches. On its right:
  "As in Settings", or "1 changed" / "2 changed" / "3 changed" when the note has its own choice.
- **The pop-up** (`#ckPop`, "Checklists in this note") works like the Effects pop-up: the same place, its grip and X,
  and it can be dragged out of the note (kind `ck`, `cosmoCkBar` in `main/ink-geometry.js`). Each switch has a short hint
  under it; a switch that differs from Settings shows "this note". At the bottom: "Same as Settings." / "Different from
  Settings." and **Use Settings**, which sets all three back to Settings.
- Code: `src/note/checklists.js` (`applyChecks` paints the row and the pop-up), `note.html`, `panels.js` (`EDIT_POPS`),
  `ink-out.js`, `note-effects-lock.css`.
- Tests: `note-ui.test.js` (the menu row, the pop-up, "this note", Use Settings), `safety.test.js` (its window).

## 1.3.20 – 8 November 2026

"Move ticked items to the bottom" now moves a line only when it is ticked. Unticking leaves it where it is.

- **What the owner saw:** unticking a box moved its line down. 1.3.19 also moved an unticked line to just below the other
  unticked lines, which was never asked for.
- **Now** (`src/note/checklists.js` `tick`): only ticking calls `sink`. Undo of a tick still puts the line back where it was.
- Settings → Checklists hint: "A ticked item moves below the unticked ones. Unticking leaves it in place."
- Tests: `note-ui.test.js` (an unticked line stays in place).

## 1.3.19 – 8 November 2026

Checklists get three options in Settings → Checklists, and each note can choose its own in its ⋯ menu.

- **Reorder by dragging the box** (on by default): drag a checkbox to move its line. A bar shows where it will go; Esc
  while dragging cancels. A click still ticks the box (on release now, so a drag doesn't tick it). Lines can move in and
  out of nested lists and between checklists in the note; a nested list left empty goes too. Near the top or bottom
  edge the note scrolls.
- **Move ticked items to the bottom** (off by default): a ticked line goes right below the unticked lines of its list
  (the newest ticked one first); unticked, it goes back up under them (undone in 1.3.20). Only when a box is clicked: turning it on moves
  nothing in existing notes. The lines glide to their place (not with Windows' "reduce motion").
- **Keep boxes the same size** (off by default): every box is the note's own size, whatever the size of the words after
  it, still centred on them (`alignChecks` in `editing.js`). Off = as before (the box follows its words).
- **Per note:** `note.checklist` = `{ drag, sink, fixed }`, each true / false or null = as in Settings. The ⋯ menu shows
  three switches; setting one to what Settings says makes it follow Settings again (like spelling). Settings:
  `checkDrag`, `checkSink`, `checkFixed`.
- Ticking and moving lines are Undo / Redo steps now (they weren't the editor's own changes, so Ctrl+Z skipped them).
  `textUndo` / `textRedo` (panels.js) held only the old font changes from before 1.1.16, which nothing made any more:
  they are now these steps (`{ undo, redo }`).
- A click beside the lines nested in a checklist line no longer ticks that line; the box hit test divides by the zoom.
- Code: a new note part, `src/note/checklists.js` (part 6 of 12): the options, the box (click / drag), moving lines.
  The tick code moved there from `content.js`.
- Tests: `note-ui.test.js` (click, drag, Esc, nested lists, ticked to the bottom, drag off, one box size, the ⋯ menu
  switches, Undo / Redo), `settings.test.js`, `list-ui-settings.test.js`, `store.test.js`, `code-structure.test.js`.

## 1.3.18 – 8 November 2026

Sizes and fonts now work together in the CSS itself, so the 1.3.15–1.3.17 workarounds are gone. Notes look as before.

- **The cause** (the owner asked for proper fixes from now on): words in an app font other than the note's are drawn
  bigger or smaller to match the note's letters, and that rule set `font-size` on the font tag. So it beat any size on
  the same tag (1.3.17's bug), shrank a font inside the same font twice, and changed the size the checkbox measured
  (1.3.15). 1.3.15–1.3.17 worked around it in three places.
- **Now** (`note-drawing.css`, `note-text.css`): a font tag's size = the size around it × its own `size=` (`--sm`) × its
  font's resize (`--kf`) ÷ the resize of the font around it (`--k`). Size and font multiply once each, on one tag or two;
  a font inside the same font is resized once; the note's own font inside another is the note's size. Tried first:
  `font-size-adjust`, which Chromium measured 7.5% off for Augusta and sometimes sized wrong: not used.
- **Removed:** `withSizes` / `faceSized` / `splitSize` (panels.js), `keepSizes` (content.js), `FACE_SIZE` (editing.js:
  the checkbox now reads `--kf` from the CSS). Cards (`store.js` `cardLook`) work sizes out the same new way.
- **Old notes:** their sizes that showed nothing (on such font tags; every line of "To do (CosmoNotes)" had one) would
  now count, so `store.js` `dropDeadSizes` takes them off once when a note is read (`sizes: 2`; a sealed note when it
  is opened, `openedSizes`; restoring an old backup of the same note makes no extra copy). Checked on the owner's three
  readable notes: all 128 words and every checkbox the same size and place as before. What does change: text that was
  shrunk twice (a font inside the same font) now shows at its intended size.
- `CLAUDE.md`: new golden rule 5, "Fix the cause, not the symptom" (the owner's wish).
- Tests: `editor-code.test.js` (the CSS model), `store.test.js` (card sizes, `dropDeadSizes`, `sizes`, old backups),
  `note-ui.test.js` (size and font on one tag, a font inside a font, the note's font inside another, paste).

## 1.3.17 – 7 November 2026

Small / Normal / Big work on a whole line of words in another font, and picking a font no longer undoes a size.

- **What the owner saw:** a whole checklist sentence in his Medieval "To do" note (Rounded words) didn't change size. A
  font other than the note's own is resized to match the note's letters (`note-drawing.css` `font[face]`), and that
  rule beats `size=` on the same tag. When the words are all inside one font tag, the browser puts the new size on that
  same tag, so it did nothing; partly selected words got a tag of their own and worked. The same happened the other way:
  picking such a font for words all in one size tag put the font on it, and the words lost their size.
- **Now** (`panels.js` `withSizes`, around the Size and Font buttons): such a tag (`faceSized`) gets its size moved onto
  a new tag inside it (`splitSize`), and the selection is put back. A size that showed nothing (older pastes left
  `<font face="Nunito" size="5">` all over that note) is taken off first, so picking that same size works too. Nothing
  else is changed: the owner's notes look as before until he picks a size or font.
- Pasting from a note in another font (`content.js` `keepSizes`): words keep the size they showed there; a size that
  showed nothing there still shows nothing.
- Tests: `note-ui.test.js` (sizes on whole lines in the other fonts, in all three note fonts; a font picked for Big words;
  pasting from a Rounded note into a Medieval one).

## 1.3.16 – 7 November 2026

A checklist box no longer moves when the first letter is typed on a new or emptied line.

- **What the owner saw:** after 1.3.15 the size stayed, but the box still shifted down a little with the first letter.
  A line without its own font / size tags (Backspace took them, a new line; the browser keeps the look only for
  typing) was placed by the note's own font, and the words came in another font that sits lower on the line (Rounded
  in a Medieval note: 0.4 px; in Rounded or Handwritten notes with bigger words up to 5 px).
- **Now** (`alignChecks`, `src/note/editing.js`): such a line keeps the box it had when it last had words (`lastOwn`,
  not saved), else takes the box of the line above, same size and same place; only with neither is it measured in the
  note's own font. A new line under words of the same font and size (Enter) copies their box exactly instead of
  measuring its empty line. A line that starts with a line break and then a photo is measured like an empty line.
- Tests: `note-ui.test.js` (the box's place, not only its size: Backspace, typing again, Enter, in all three fonts).

## 1.3.15 – 7 November 2026

Checklist boxes keep one size: on an empty line, after a font change, and no more stray box from copying a whole line.

- **Empty line:** a new line's box was the note's plain size until you typed (e.g. 15.5 px, then 22.5 px for words at
  size 5). `alignChecks` now sizes an empty line from its own font / size tags; if Backspace emptied it (the browser drops
  the tags but keeps typing in that size), it keeps the size it had; else it takes the line above's.
- **Font change:** words in another font are drawn bigger or smaller to match the note's letters (`note-drawing.css`
  `font[face]`), and the box followed that, so changing only the font changed the box (Rounded words in a Medieval note:
  15.5 px, Medieval words: 18.5 px). The box now divides that out (`FACE_SIZE`, the same numbers): same size of words,
  same box. Medieval notes had Caveat's .78em box on an empty line: now .84em, the size of their Rounded words (`BOX`,
  `note-text.css`); the owner's Medieval notes, all in Rounded words, look as before.
- **Stray box** (the owner's "To do (CosmoNotes)" note, the line "utilise downloaded skills…"): copying a whole line
  (triple-click) picks up to the start of the next line, so the copy held an empty `<li>` that pasted as a line with
  nothing in it: no height, its box (ticked, here) drawn over the next line's. Copied and pasted HTML now loses empty list
  lines (`dropEmptyLines` in `sanitize`), and the note drops empty checklist lines after a paste and when it opens (they
  hold nothing; the line with the caret stays). The owner's note is mended the next time it is opened and edited.
- Tests: `note-ui.test.js` (box sizes in all three fonts, empty line, Backspace, whole-line copy, an old empty line),
  `editor-code.test.js` (`FACE_SIZE` and `BOX` against the CSS).

## 1.3.14 – 7 November 2026

A card's words are now always smaller than the note's (about 0.8×), however their sizes and fonts are nested.

- The owner still saw a note's words bigger on its card than in the note. The card (1.3.12–1.3.13) gave each run one
  size, but the note's CSS multiplies at every element: text pasted several times sits in `<font face>` inside
  `<font face>`, and each one shrinks it again; a face resize also beats `size=` on the same element. `store.js` now works
  out each run's size (`k`) the same way (`CARD_FACE_SIZE`, `CARD_SIZE`, `CARD_TAG_SIZE`, checked against the CSS files in
  `store.test.js`); `cards.js` just draws it.
- A note zoomed out (Ctrl + mouse wheel) shows its lines at that zoom on its card too (`list:get` `zoom`, `--nz`). Zooming
  in doesn't make the card bigger.
- Checked in Chromium: the real note window next to its card, six kinds of text (fonts inside fonts, sizes, three note
  fonts): the card is 0.78–0.83× the note every time.
- Tests: `store.test.js` (nested sizes, the face-beats-size rule, the tables against the CSS).

## 1.3.13 – 7 November 2026

Picking a title font no longer moves the menu; words in another font are no longer too big on their card.

- **Nothing jumps** (the owner's wish): the title fields in the ⋯ menu (`.titlefld`), its Title font buttons and Title while
  locked in Edit design (`.etrows .minput`) have a fixed height, so a font with taller letters doesn't push the rest down.
- **Card sizes:** the note draws words in another font a bit bigger or smaller, so they match the note's own font
  (`note-drawing.css`: e.g. Rounded words in a Handwritten note at 0.68×). Cards (1.3.12) drew them at full size, so a
  Handwritten note full of Rounded lines was far too big on its card. `cards.js` `RUN_FACE_SIZE` now does the same;
  `store.test.js` checks it matches the note's rules.
- Tests: `note-ui.test.js` and `list-ui-cards.test.js` (nothing moves), `list-ui-cards.test.js` and `store.test.js` (sizes).

## 1.3.12 – 7 November 2026

A card shows a note's words as the note does (fonts, colours, sizes, bold…); the title rows sit together under the title.

- **Cards in the note's look** (the owner saw a line in Rounded in the note but in Medieval on its card): a card was built
  from the note's plain text, so every look given to some of the words (a font, colour, highlight, size, bold, italic,
  underline, strike, heading, code, link) was lost. Now `store.js` `cardRuns` walks the note's html once, makes its lines
  the way the note's text has them and gives each line its runs; main sends them (`list:get` `runs`, nothing for a hidden
  locked note) and the card draws them (`cards.js` `runSpan` / `runCss`, the note's own sizes). A line whose words don't
  match stays plain, as before. So it can't happen again with a new kind of formatting: every tag the editor keeps must be
  known to `cardRuns`, and every look it makes must be drawn by the card (`store.test.js` checks both, and the sizes and
  font names against the note's).
- **Title rows together** (the owner's wish): in Edit design, Title while locked and Title font are right under the title,
  above the tabs (they were in the Colour tab). The note's ⋯ menu has the same order: Title, Title while locked, Title font.
  Title font is the font of both: both fields show in it.
- Tests: `store.test.js` (cardRuns, and the checks above), `list-ui-cards.test.js` (a card's runs; the order in Edit design),
  `note-ui.test.js` (the order in the ⋯ menu).

## 1.3.11 – 7 November 2026

Edit design picks the title font; a dragged note outlines the card it goes into; a locked note's titles change only while it's unlocked.

- **Title font in Edit design** (the owner's wish): a Title font row (Handwritten / Rounded / Medieval) under Colour, for one
  note (right-click → Edit design…) or several (the selection bar; "Mixed" until one is picked). Saved as the note's
  `titleFont` (1.3.3) through `list:apply`, like the font. The preview's title shows it; an open note follows (`note:look`
  now carries `titleFont` into the window, `lock-zoom.js`).
- **Dragging onto a card:** the note or group it goes into has the faint outline of a right-clicked card (`.ctxon`) instead
  of the solid ring (`.drop-on` in `list-base.css`). The label ("Make a group", "Put inside") stays.
- **A locked note's titles** (the owner's wish): while it is locked, its "Title while locked" (and its title) can't be
  changed from outside. Edit design on a hidden locked card shows the title read-only; the note's ⋯ menu makes both fields
  read-only while the note is locked. Main refuses them too: `list:edit` while `hiddenInList(n)`, `applyPatch` drops
  `coverTitle` from a hidden window. Unlocked (in its window or "Unlock…" in the list), both can be changed as before.
  Colour, fonts, see-through and effects of a locked note can still change.
- Tests: `list-ui-cards.test.js` (Title font, one note), `list-ui-picking.test.js` (Title font, several), `list-ui-groups.test.js`
  (the drop outline), `note-ui.test.js` and `list-ui-crypt.test.js` (titles read-only while locked), `crypt.test.js` and
  `colours.test.js` (main refuses them).

## 1.3.10 – 7 November 2026

"Device" instead of "computer" in every text: the app, `HOW TO INSTALL.txt` and `build.bat`.

- The owner's wish (after 1.3.9's "PC" and "laptop"). In the app: About (saves on this device; locked notes encrypted on
  this device), Settings → Backups ("Only on this device."), Locked notes (`actions-locks.js`: the info line and the
  recovery key tip; `main/ipc-crypt.js`: "Keep it safe, away from this device."), and the welcome note for new installs
  (`main/constants.js`; welcome notes already made keep their words).
- Tests: `list-ui-crypt.test.js` (the info line).

## 1.3.9 – 7 November 2026

"Device", not "PC" or "laptop": the voice-to-text toast and the owner's guides.

- The owner's wish. The note's toast is "On this device, the words appear when you stop." (`src/note/speech.js`).
  `HOW TO INSTALL.txt` ("Other devices", moving notes to another device) and `build.bat`'s messages say "device" too.
  Kept: "Windows protected your PC" in `HOW TO INSTALL.txt` (Windows' own words). "This computer" elsewhere is unchanged.
- Tests: `note-ui.test.js` (the toast).

## 1.3.8 – 7 November 2026

One name: the + Add item is **Voice to text** now (was "Speak to text"), like its Settings section. Settings links to the
model's page.

- The owner's wish. `note.html` tile `data-act="speak"`, About and `HOW TO INSTALL.txt` say "Voice to text". (Code
  comments still say "Speak to text" for the live feature; only the texts changed.)
- Settings → Voice to text: one top line, "In a note, open + Add and pick Voice to text, or right-click a voice recording
  and pick Transcribe." (`#sttIntro`). Under the model: "It downloads from https://huggingface.co/onnx-community/whisper-
  small.en. Your voice never leaves this device." The link comes from the model list (`status().model.url` = `HF` +
  `repo`) and opens in the browser (`S.openExternal`). About and `HOW TO INSTALL.txt` say "this device" too.
- Tests: `list-ui-settings.test.js` (the line, the link, the order), `note-ui.test.js` (the tile's name), `stt.test.js` (`url`).

## 1.3.7 – 7 November 2026

Settings → Voice to text reads better: how to use it at the top, where the model comes from under it, the Windows 11 tip last.

- The owner's wish. The top line is now "In a note, open + Add and pick Speak to text." Right after it: "Right-click a
  voice recording and pick Transcribe to turn it into text." (no "Tip:"). "It downloads from Hugging Face. Your voice
  never leaves this PC." (`#sttSource`) sits under the model's row. The Windows 11 Win + H line is the last line.
- `list.html` `#sttPanel` order; `.sttintro`, `.sttsub` in `list-cards.css`. Tests: `list-ui-settings.test.js` (the order).

## 1.3.6 – 7 November 2026

The title font row in the ⋯ menu has no "Same" button any more: just Handwritten, Rounded and Medieval.

- The owner's wish. Until a font is picked, the button of the note's own font is lit (`applyLook`: `titleFont || font`).
  A click always saves that font (`titleFont`), also when it is the note's own font; `null` now only means "never picked"
  (older notes, new notes), which still follows the note's font.
- Tests: `note-ui.test.js` (Title font).

## 1.3.5 – 7 November 2026

Settings → Voice to text: pick if the words appear **while you talk** or **when you stop**, plus two tips (Transcribe, and
Windows 11's own voice typing, Win + H).

- New setting `sttWhen` (`live` | `stop`; missing = by the PC as in 1.3.4: graphics card live, processor when you stop).
  Main: `stt:when` (`main/ipc-stt.js`, preload `S.stt.when`), `modeOf` reads it, `status()` sends `when` (what Speak to
  text does now) and `whenSet`. The `ready` event has `auto`: the note says "On this PC, the words appear when you stop."
  only when the PC picked it, not when the person did.
- The panel (`list.html` `#sttPanel`, `paintVoice`): a "Words appear" row (`#sttWhen`, While you talk / When you stop,
  with a short line under it: "On the processor, the words can lag behind." when live is picked there), the tip "right-
  click a voice recording and pick Transcribe", and "Windows 11 has voice typing too. Press Win + H in any app." The
  intro line is now only "For Speak to text, in + Add."
- About: one more feature line. Tests: `stt.test.js` (the setting, `auto`), `note-ui.test.js` (no toast when picked),
  `list-ui-settings.test.js` (the row and the tips).

## 1.3.4 – 6 November 2026

Voice to text has one model now: Whisper small.en, a download in Settings. The built-in Standard (Moonshine) and
**Test my computer** are gone (the owner's wish).

- `main/stt-models.js`: only Whisper small.en (`MODEL`); `builtIn`, `builtInDir`, `BUILD_DIR`, `setBuiltInDir` and
  `STANDARD` are gone. No model comes with the installer: `build.bat` has two steps again (no `fetch-model.js`), and
  `extraResources` no longer packs `build/models`. `build/fetch-model.js` is a no-op stub; it, `build/models/` and
  `src/engine/test-clip.wav` can be deleted by hand.
- Not downloaded: `stt:start` / `stt:transcribe` answer `nomodel` before anything starts; the note says "Voice to text
  isn't downloaded yet. Get it in Settings." (Speak to text records nothing). A model that fails to start: the job fails
  as any failure (the recording is kept), Settings says "Didn't start last time." No fallback.
- Live or after you stop: by where it runs (`modeOf`): graphics card = live, processor = after you stop ("On this PC, the
  words appear when you stop."). The engine's "more than 5 s behind" safety net stays. Gone: `stt:test`, `stt:use`, the
  engine's `speed` and the test clip route, `verdictOf`, the quick 2-second check. `settings.sttModel` and
  `settings.sttTests` are deleted at start.
- Settings → Voice to text: one row, "Uses Whisper small.en", with Ready / Not downloaded, the size, where it runs and
  Download / Cancel / Try again / Remove. No Use buttons, no Test row, no "Standard" / "Best".
- About and `HOW TO INSTALL.txt`: the new wording. Tests: `stt.test.js` (one model, nomodel, live/after by set, old
  settings cleaned), `note-ui.test.js` (the nomodel toast), `list-ui-settings.test.js` (the panel).

## 1.3.3 – 6 November 2026

A note's title can have its own font: ⋯ menu → under the title, **Same / Handwritten / Rounded / Medieval**.

- New note field `titleFont` (`hand` | `round` | `medieval`; `null` = the note's font, as before). `store.js`
  `normalize` (unknown → `null`), in `EDITABLE` (`main/constants.js`), copied by Duplicate. Not secret: it is only the
  look of the title, so a locked note's window can still change it (the title itself stays sealed).
- The note window: `body[data-tfont]` is `titleFont`, else the note's font (`applyLook`); the top bar's `#title` rules in
  `note-base.css` read it instead of `data-font`. The row is `#titleFontSeg` in the ⋯ menu, under the title box; its
  buttons size to their words, so "Handwritten" fits at the menu's narrowest (260 px).
- The list: a card's title shows in its own font when it differs from the note's (`.t1[data-tfont]`, `cards.js`
  `cardBody`, `list-cards.css`); main's `list:get` sends `titleFont`.
- Tests: `note-ui.test.js` (Title font), `store.test.js` (normalize), `list-ui-cards.test.js` (the card's title).

## 1.3.2 – 6 November 2026

Copying a checklist line and pasting it gives a checklist line again, with its font, size, colour and the rest.

- The note writes the clipboard itself now (`copy` / `cut` in `src/note/content.js`, "copy / cut"). Before, the browser
  copied the text with its computed styles and, for part of one line, without the list; the paste cleaning (`cleanTree`)
  then dropped every `<font>`, style and class, so a checklist line came back as a plain bullet in the note's font.
- What is copied: the selected words plus the formatting around them (`<font>` face / colour / size, bold…, a highlight
  span) and the nearest list line, so even part of one checklist line pastes as a checklist line, ticked or not. Pasting
  onto a checklist line adds a line to that list; into the middle of a normal line, the line splits around it.
- The note's own font goes with the words when the pasting note has another font (each bare piece of text gets a
  `<font face>`; the size matching between the app's fonts in `note-drawing.css` does the rest). The note-wide text size
  and normal ink colour are the pasting note's (they belong to the note, not to the words).
- CosmoNotes reads its own copy from the clipboard type `application/x-cosmonotes` (JSON: `html`, `font`); `text/html`
  carries the same, with the font on every word, for other apps (Word, mail). Pastes from other apps are cleaned as
  before. The CosmoNotes copy is cleaned too, a little less strictly (`RICH`): only the app's three font faces, colours,
  sizes 1–7, `color` / `background-color` styles, `checklist` and `done` classes.
- Ctrl+Shift+V still pastes plain text. Cut is the same, then deletes the selection (one Undo step).
- Tests: `note-ui.test.js` (copy / cut / paste).

## 1.3.1 – 4 November 2026

Voice to text, offline: + Add → **Speak to text**, right-click a voice note → **Transcribe**, and Settings → **Voice to text**.

- The owner's pick: there is no 1.3.0. Step 3 of `claude/voice-to-text-1.3.1-planning.md` (Project doc); the prototype
  (Step 1, `tools/stt-prototype/`) chose Moonshine Base q8 for **Standard** (comes with the app, ~64 MB) and Whisper
  small.en for **Best** (a download). Nothing ever goes to the cloud; CosmoNotes itself only goes online when you press
  Download for Best (and build.bat, for Standard).
- **The engine** (`main/stt-engine.js`): one hidden window, made on first use and closed after 3 idle minutes, runs
  Transformers.js 4.3.1 (vendored unchanged in `src/engine/lib/`, with a fixed import map: no scanning at run time).
  Its page, library and models come only from `cosmomodel://engine/` on its own in-memory session: a fixed list of
  files, COOP/COEP on every answer (multi-threaded WASM), a strict CSP (no `blob:`, the import map by its hash), no
  permissions, no navigation, and every other request blocked. The note windows' CSP is unchanged.
- **Speak to text** (`src/note/speech.js`, a new note part, 7 of 11) is the voice recorder with a second path: the same
  recording goes to disk as in 1.2.4 (the safety net), and an AudioWorklet (`src/mic-worklet.js`) sends 16 kHz pieces
  to main, then to the engine. The bar says "Listening…" with Stop and Cancel. Words go where the caret was: grey drafts
  while you talk, then the settled text (one Undo step per piece). The marker and the drafts are only attributes, never
  saved. **Stop** finishes what was heard ("Finishing…"), then the clip is deleted. **Cancel**, an error, closing or
  locking the note: the text so far stays, and the recording stays as a voice note where the text was. Esc = Stop.
  One Speak to text at a time ("Voice to text is busy in another note.").
- **Transcribe**: the text goes on the line after the chip, in `<span class="stt-text" data-of="<clip>">` (no look of
  its own), one Undo step. Again on the same chip: "Replace the text from last time? Changes you made to it will be
  lost." Closing or locking the note while it runs: nothing is added. Main reads the clip (a sealed one through
  `attachmentBytes`) and checks that it belongs to that note.
- **Live or after you stop**: Test my computer runs a bundled 12.8 s clip (`src/engine/test-clip.wav`) through each
  model on this PC: ≥ 2× Live, 0.5–2× After you stop, below Too slow. Never tested: a quiet 2-second check the first
  time. A slow PC: "This PC is slow for live text. The words appear when you stop." More than 5 s behind: the drafts
  stop and the words come at Stop.
- **Models** (`main/stt-models.js`, one fixed list: files at a fixed Hugging Face commit with size and sha256). Standard:
  `build.bat` fetches it into `build/models/` (`build/fetch-model.js`, every hash checked); the installer packs it into
  `resources/models/`. Best: Settings → Download puts it in `<data>/models/whisper-small-en/` (`.part` → hash → rename,
  `ready.json` last). Only the set this PC will use is downloaded (decided here, the plan left it open): the graphics
  card's (563 MB) when WebGPU works, else the processor's (int8, 242 MB). Cancel leaves nothing; a failed download keeps
  the good files for Try again; Remove deletes the folder. Not in backups; the uninstaller leaves it. Best picked but
  not there: "This model isn't downloaded yet." and Standard is used. Best on the graphics card that fails to start:
  Standard is used, and Settings says so.
- Memory trim tried (decision of the plan: keep it only if speed holds): ONNX Runtime's CPU memory arena off saved
  nothing and was slower here, so it is not used. The thread count stays ONNX Runtime's own choice.
- Checked in the cloud workspace with the real Moonshine Base model in Chromium (no graphics card there): the engine page
  loads under its CSP, Transcribe of the 37 s sample is word for word, live drafts and finals arrive, all through the
  real main process. Only a real Windows PC can confirm the microphone, the graphics card (Best) and the installer.
- New texts: "Speak to text", "Listening…", "Writing it down…", "Writing it down… 40%", "Finishing…", "Writing it down
  when you stop", "Transcribe", the toasts above, "Couldn't write it down.", "No words found in this recording.",
  Settings → Voice to text.
- Tests: `stt.test.js` (new area: a stub engine for the jobs, the queue, close / lock / crash, the model choice and
  fallback, live or after Stop, Test my computer, `cosmomodel://` refusing `..` and unknown names, the engine session,
  the download against a local server with hash checks, Cancel, Try again, Remove, `.part` cleanup; the live session
  logic under Node); `note-ui` (Speak to text and Transcribe in Chromium: marker, drafts never saved, Undo, Stop, Cancel,
  failure, busy, close, lock, Replace, paste). `code-structure` knows the new part and the engine's preload.
- `tools/stt-prototype/` can be deleted once Speak to text works on the owner's PC (its code now lives in the app).

## 1.2.4 – 3 November 2026

Voice recordings are saved while you talk. Closing the note, locking it, quitting or a crash keeps what was recorded.

- Before, the note window kept a recording in memory until Save. Closing the note, a crash or a power cut lost it, and
  locking the note threw it away. Now each 250 ms piece goes to main and is written to `attachments/<name>.part` at
  once, next to `<stem>.rec.json` (`{ noteId, file, startedAt, endedAt }`: whose recording it is). Save renames the
  `.part` file; the `.rec.json` goes once the note points at the file (`main/recordings.js`).
- Closed mid-recording: the chip goes into the note's last save (beforeunload), and main finishes the file. Locked
  mid-recording ("Lock again", the lock button, or locked from the list): the same, before the window hides. If the
  window can't save any more, or its page crashed, main adds the chip at the end of the note itself.
- Quitting finishes any recording still running (`will-quit`, before the last save of all notes).
- A crash: at the next start, every recording left behind gets its chip at the end of its note, before any window opens.
  A note that was deleted gets a new closed note, "Recovered recording". An empty one is just removed.
- A locked note that is still sealed at start (PIN not typed yet): its clip is sealed at once (`crypt.sealLoose`), and
  its chip arrives after the PIN (`retryPending`, run by `notifyList`). It waits across restarts if needed.
- The sweep never deletes a file that has a `.rec.json` next to it. The unfinished `.part` file can't be served or
  opened (only finished attachment names are).
- If main can't write the file, the window still keeps every piece in memory and saves it the old way at the end.
- **Esc now saves a recording** (before, it threw it away). Only the X throws a recording away.
- Docs: the owner is a programmer, so `CLAUDE.md` and `CONTEXT.md` no longer say otherwise. Technical detail is fine;
  texts inside the app stay short and plain.
- Tests: `recordings.test.js` (new: Save, the X, another window, close, page crash, lock, sweep, quit, a real crash
  and the next start, a deleted note, a locked note sealed until the PIN, across restarts); `note-ui` (the recorder
  in Chromium with a fake microphone: pieces sent while recording, Save, X, Esc, close, lock, the in-memory fallback).
- Only a real Windows PC can check the microphone itself.

## 1.2.3 – 3 November 2026

The notes list redraws less after a note changes: its own work on each refresh is 2–4 times faster. It looks the same.

- The owner asked whether the app redraws too much. Measured in Chromium first (60 and 200 notes, with and without
  an effect): typing in a note costs about 5 ms a key, fine. A list refresh (a note was edited) cost 3.6 ms of the
  list's code at 60 notes and 10.6 ms at 200. Now 1.5 ms and 2.8 ms.
- The list already kept every card whose note didn't change (`cards.js`, the card cache). But after each refresh it
  still measured every card (`markMore`, which forces a layout) and looked at every card's effect (`paintFx`:
  `resolve`, `resize`, `set`). Now only the cards built again get that. When the card size, the theme or the window's
  width changed, or an effect setting changed, every card is done again, as before.
- A card body is marked `data-m` once measured. A card that couldn't be measured yet is measured on the next refresh.
- `noteById` (`list/base.js`) finds a note by id from an index, instead of searching all notes once for each card
  (`itemOfKey` in `picking.js`, `paintFx`).
- What still costs the most: effects on the cards. Each card with an effect is its own small animation (24 on screen in
  a normal window). With an effect on every card, the list uses about 14 % of one processor core at rest (60 notes,
  in Chromium without a graphics card). Without effects, about 0 %. Nothing about the effects changed in this version.
- Tests: a refresh keeps the unchanged cards, builds and measures the edited one, and both keep their effect.

## 1.2.2 – 3 November 2026

The bar for several picked notes has **Edit design** instead of Colour: the same pop-up as right-click → Edit design.

- The owner's wish. It opens the Edit design pop-up for all the picked notes (and the notes in picked open groups),
  in the middle of the window. The right-click menu on a picked card has it too.
- Colour, see-through, Background and Mouse go to every note. A setting the notes don't share says **Mixed** until
  you pick one. The preview shows the first note.
- An effect change sends only that setting (`fxKeys` in main `list:edit`), so each note keeps its other effect picks.
- No title for several notes (the paper says "3 notes"). "Open note" becomes "Open notes".
- The old Colour pop-up also changed the font. So the pop-up has a **Font** row, only for several notes (one note's font
  is set in the note itself). It goes through `list:apply`, as before.
- The Colour pop-up (`#bColor`, `#bulkColors`, `bulkApply`) is gone. Its styles (`.bulkpop`, `.bsw`, `.bfonts`) are
  still in `list-picking-edit.css`, unused.
- Tests: `list-ui-picking` (Edit design for two notes: colour, see-through, font, an effect setting, titles left
  alone); `list-ui-settings` (no Font row for one note).

## 1.2.1 – 3 November 2026

A third note font: **Medieval**, an old book hand (Augusta by Dieter Steffmann, 100% free on dafont).

- The owner found it in a game screenshot ("The earth remembers.") and picked it from a shortlist of ten.
- Pick it like the other two: the A button's text panel (on the selected text, or what you type next), Settings →
  For new notes → Font, a group's panel (every note inside), and the bar for several picked notes.
- The font file is packed with the app (`src/fonts/Augusta.ttf`, 55 KB), so it works offline. Both windows load it
  with an `@font-face` in `note-base.css` / `list-base.css` and use it as `--med`.
- Sizes are set so it reads about as big as Rounded: 16 / 18.5 / 22 px in a note, 14.5 px on a medium card. Part of
  the text in another font keeps about the same size (`note-drawing.css`).
- Augusta has no Cyrillic and no č / ž. Those letters show in a book-style fallback (Palatino Linotype, then Georgia).
- Augusta has no bold. A card's plain first line stays plain; the title is still drawn bold.
- Checklist boxes in a Medieval note are sized like in a Rounded one.
- The note's font is checked against one list, `FONTS` in `store.js`, also in main (a group's font, several notes,
  the default font). An unknown font is still read as Handwritten.
- The version's middle number went up to 2 (the owner's pick: there is no 1.2.0). `release.test.js` knows that.
- Tests: a Medieval note loads the font file and is written in it, the text panel puts it on the selected text,
  Settings and the list accept it, and an unknown font is ignored.

## 1.1.49 – 2 November 2026

The tests are sorted by what they test instead of by version, with no repeats, and run about 7 times faster. The app itself is unchanged.

- **By area, not by version.** The 41 test files (26 of them named after versions, `v1113.test.js` … `v1148.test.js`)
  became 33 files named after what they check: `notes`, `colours`, `duplicate`, `groups`, `locks`, `unlock`,
  `crypt`, `windows`, `toolbars`, `safety`, `settings`, the effects (`effects-rules`, `-draw`, `-backgrounds`,
  `-followers`, `-settings`), `code-structure`, `release`, `texts`, `editor-code`, the browser tests (`list-ui-*`,
  `note-ui`) and more. `ai-context/testing.md` lists them in one line each. A new check goes into the file for its area.
- **Each thing is checked once.** For example, "every effect draws without NaN" was in six files and "fx.js and
  store.js have the same effects" in six. The same 10 lines of set-up were in every file: they are now `tests/helpers/`.
- **Better checks.** A few checks that only read the code now test what it does: toolbars stick within 12 px, a locked
  note's card gets no checklist boxes or picture words, Duplicate keeps "word wrap off", every message the windows send
  is answered. New checks: a wrong PIN still waits a moment, and a note closed with Alt+F4 is remembered as closed. One
  `release.test.js` checks that the version, changelog, About date and `CONTEXT.md` agree. No test has to be moved when
  the version goes up any more. Dropped checks only pinned a pixel size in the CSS, or tested the tests themselves.
- **Faster:** all tests took 224 s one after another; now ~30 s on a 2-core machine, less on more cores. The tests run
  side by side. A PIN is hashed with a cheap setting in tests only (the app still saves and uses 2^17). The pause after
  a wrong PIN is skipped. The list's browser tests wait only until the window is idle, instead of a fixed 200 ms after
  every click.
- `npm test` prints only failures and one summary line. `npm test -- locks` runs only the files whose name contains
  "locks"; `-v` lists every file with its time.
- The fake Electron in the tests no longer fires "ready-to-show" on a window that was already closed. Real Electron
  doesn't either.
- The recorders for refactors moved to `tests/record/`.
- 1.1.48's checks (no "+3 lines", the stronger fade) are in `list-ui-pictures.test.js` now, and they pass.
- The 45 old test files are removed by double-clicking `delete-old-tests.bat` once (the folder bridge can't delete
  files). It deletes only those files, then itself. Until then `npm test` also runs the old ones, and some fail.

## 1.1.48 – 2 November 2026

No "+3 lines" on cards; a stronger fade instead.

- The owner didn't like the "+3 lines" in a card's foot (1.1.46): it is gone (`.moretag` and its code in `markMore`).
- The fade at the bottom of a card with more (`.card .body.more`) was too faint on some paper colours. It now starts
  about two lines higher, is at 42 % halfway and gone just above the edge, so the last line or two clearly fade out.
- `tests/v1147.test.js` (1.1.47's, overwritten for a moment by this chat) was put back from that chat's history.
- Tests: `tests/v1148.test.js`; `tests/v1146.test.js` no longer checks the label. Not run yet (the owner: later).

## 1.1.47 – 2 November 2026

"Unlock" in the notes list now lasts only until CosmoNotes restarts. "Remove lock…" removes a lock for good.

- **The owner's wish:** the padlock on a locked card in All notes removed the lock for good. Now right-click a locked note
  or group → **Unlock…** (or click its padlock): with the PIN it shows the note (or the group's notes) in the list and opens
  them without asking, until CosmoNotes restarts. Then it is locked again. **Remove lock…** sits right under it and still
  removes the lock for good, as does "Remove lock" in the note's own menu and in the group's settings.
- Once unlocked, the menu item and the padlock say **Lock again** (no PIN needed). The card shows a small open padlock
  ("Unlocked until CosmoNotes restarts"). "Lock again" in the note itself or in the Locked tab locks it again too.
- Safe for the notes: the lock itself never changes, so a locked note stays locked and encrypted on disk and in backups.
  Only memory knows it is unlocked (`unlockedForNow` in `main/list-visibility.js`; new `list:unlock-now`, `list:relock`).
- Small change on the side: locking one note no longer hides another note that is open and unlocked for now (or in a
  group opened in the list).
- Made at the same time as 1.1.46 in another chat, then rebuilt on top of it. That chat's `tests/v1146.test.js` was
  overwritten for a moment and has been put back.
- Tests: `tests/v1147.test.js` (main's side, a real restart in a second process on the same data, and the list window in
  Chromium through `tests/v1147-list.js`).

## 1.1.46 – 2 November 2026

A note's picture shows on its card where it is in the note and at its size; cards say when there's more.

- **Pictures on cards** (the owner: a small picture far down a long note took half the card, so the card showed only two
  lines). Before, a card always put the first picture below two lines of text, cropped to the card's full width. Now
  `cardBody` (`src/list/cards.js`) puts it between the same lines as in the note, as wide as in the note measured in
  letters (a picture 5 letters wide in the note is 5 letters wide on the card; Small / Medium = 45 / 72 %; never wider
  than the card or the picture itself; a tall one is cropped at 55 % of the card). Further down than the card shows, it
  is simply not seen; further down than the 600 letters the list gets, it isn't put on the card at all. A note that is
  only a picture still shows it big, as before. Main works out the place and size: `picturePlace` (store.js) →
  `pic: { at, px, pct, d, fs, tw }` in `list:get`.
- **"There's more"**: no fixed number of lines any more (`-webkit-line-clamp` is gone from the cards). Each line is its
  own row (`.ln`) and `markMore` measures what fits after every render (and when a picture loads or the fonts are ready).
  A card with more fades out at the bottom (`.body.more`) and its foot says "+3 lines" (`.moretag`; "+ picture" when only
  a picture is left out). The count is of the whole note (`lines` in `list:get`). The Bin's cards do the same; the stacked
  sheets on group cards only fade.
- Tests: `tests/v1146.test.js` (main's picture place; in Chromium: order, size, the count on two card sizes).

## 1.1.45 – 1 November 2026

Text colour keeps the selection, word wrap off has no limit, shorter Settings texts.

- **"Normal" colour kept the text selected** (the owner: picking no colour deselected the text). `cleanResetColor`
  (`src/note/panels.js`) takes the stand-in colour's `<font>` off, which moves the text, and the browser then dropped the
  selection. It now notes where the selection was (in letters, `selOffsets`) and puts it back (`selectOffsets`).
- **Word wrap off = no limit** (the owner: "word wrap means the size of the note is the max limit; off means no limit").
  Before, off kept the text at the width the note had then, so a wider note still wrapped there. Now `#sheet.nowrap`: a
  line only ends where you pressed Enter, the sheet is as wide as the longest line, long lines scroll sideways. Pictures
  still fit the note (`--picW`). Older notes with word wrap off and no drawing work this way too.
  With a drawing: new field `note.nowrap` (store.js, `EDITABLE`, copied by Duplicate). The first stroke on a note with word
  wrap off sets it and sets `wrapWidth` to the visible width, so pictures keep their size under the drawing
  (`keepForInk`, `src/note/lock-zoom.js`). Older notes with a drawing and no `nowrap` keep the locked width (`#sheet.fixed`),
  as does the first drawing on a note with word wrap on. Turning word wrap off with a drawing now asks first.
- **Settings:** "Colours of this window" is now "Colour Theme"; it and "Start with Windows" have no text below.
  "Pause all effects" no longer says "by the clock".
- Tests: `tests/v1145.test.js` (in Chromium: the selection after Normal; word wrap off in wider / narrower notes, older
  notes, the first drawing).

## 1.1.44 – 1 November 2026

The note window's code split into smaller files (the owner: "we split most files, time to split note"). Nothing in the app
changes.

- `src/note.js` (~165 KB, the last big file) is now ten parts in `src/note/` (13–24 KB each), which `note.html` loads in
  order: base · fx-format · panels · content · editing · menus-voice-ink · lock-zoom · draw-over · ink-out · eraser-start
  (`ai-context/CONTEXT.md` says what each holds). They share names like the list's parts (1.1.37): `window.COSMO_NOTE_KIT`
  (`K`), with the variables several parts change on `K.V` (`V.note`, `V.settings`, `V.hidden`, `V.dirty`, `V.savedRange`…).
  Cut by `tools/split/split-page.js` with `tools/split/plan-note.json`; every line is the old line, apart from the `V.` / `K.`
  in front of a shared name (`tools/split/check-parts.js` checks it).
- `src/note.js` is now only a note saying where the code went (the folder bridge can't delete files): it can be deleted.
- Proof that it behaves the same: `tests/record-note.js` (new) records three note windows in Chromium against the real
  main process (284 steps: typing, formatting, lists, links, tables, pictures, voice, find, menus, effects, zoom, word wrap,
  drawing and both erasers, passwords and locks): the old code three times and the new code twice gave the same log; three
  small planted mistakes each changed it. How it works and what it can't see: `ai-context/splitting-code.md` → "note.js".
- Only a real Windows PC can confirm the installed app; a refactor like this one should look and work exactly as before.
- Tests: `tests/v1144.test.js` (the version; `note.html` loads the ten parts in order and nothing loads `note.js`; CRLF; each
  part's shared names; the ten parts load in a stand-in window and every shared name exists). `tests/note-source.js` joins the
  parts for the tests that read the note's code (`v1123`, `v1124`).

## 1.1.43 – 31 October 2026

Smooth scrolling in the notes list (the owner: scrolling Settings lags, most of all with "Everything CosmoNotes can do"
open, on a fast PC).

- **Why it lagged:** the views (`.view`: Notes, Bin, Settings) had a see-through background (the dots were on `body`). On
  Windows, Chromium won't scroll a see-through area on the graphics card (it would lose ClearType's sharp text), so it
  redrew the whole visible part (text, dots, shadows) on every frame. In a Chromium copy set up like Windows (ClearType
  text, 100 % scale), one scroll down Settings did 397 redraw jobs (153 ms); now 26 (16 ms).
- **Fix 1** (`list-base.css`): each `.view` carries the window colour and the dots itself, with `background-attachment:
  local` (so they move with the page). Offset `0 -88px`, so the dots line up with the window's above the views. Seen
  from still, the window looks the same.
- **Fix 2:** while a view scrolls it has `.scrolling` (`events.js`, removed 150 ms after the last step); what's inside then
  ignores the mouse (`body:not(.is-dragging) .view.scrolling > *`). Nothing under the mouse redraws its hover look on the
  way past (style work during that scroll: 117 → 2 times), and a colour row passing under the mouse no longer catches
  the wheel and turns it into a sideways scroll.
- **Fix 3:** the Ctrl + wheel card-size listener (`onSizeWheel`) is on the title bar, the tabs, Notes and the Bin, not on
  `window`. A wheel listener that can cancel scrolling makes Chromium wait for the page before scrolling; Settings now
  has none. Electron never zooms a page on Ctrl + wheel by itself, so nothing else changes.
- Only a real Windows PC can confirm how smooth it feels.
- Tests: `tests/v1143.test.js` (the version; the background, `.scrolling` and the mouse, Ctrl + wheel in Settings and over
  the tabs). `v1141.test.js` only asks the renumbered versions (1.1.13 – 1.1.40) to say what they were, now that 1.1.41 is
  in the archive.

## 1.1.42 – 31 October 2026

Shorter Bin texts (the owner: "deleted note wait here... fix that text too").

- The tip above the Bin (`.bintip` in list.html): "You can restore these notes, or delete them for good." (was "Deleted notes
  wait here until you delete them for good.").
- The empty Bin (`renderBin` in `src/list/picking.js`): "Deleted notes show up here." (was "Notes you delete will wait here.").
- Tests: `tests/v1142.test.js` (the version, the two texts). `v1141.test.js` now reads the newest version from `package.json`.

## 1.1.41 – 31 October 2026

The owner: too much text in places; the version history belongs in a file only; some versions were too big, and the
numbers ought to be about .10 higher once they are split.

- **No version history in the app.** `src/about.js` has no `VERSIONS` any more (only `LAST_UPDATED` and `FEATURES`).
  Settings → About shows "Version x · Last updated …" and "Everything CosmoNotes can do". Gone: the "Version history" fold
  (`#foldVersions`, `#versions` in list.html), its styles (`.vblock`, `.vhead`, `.vtag`, `.vdate`, `.vnow`, `.vchanges` in
  `list-groups-menus.css`) and the code that drew it (`renderAbout` in `src/list/settings-menus.js`).
- **History split and renumbered** (table above). Old 1.1.13, 1.1.15, 1.1.16, 1.1.20, 1.1.22 and 1.1.23 became two or three
  versions each, split by topic or by the owner's rounds of notes, each with a one-line summary. Nothing was dropped:
  every bullet is in one of the parts. Later versions moved up by 9 (old 1.1.31 is 1.1.40), so this one is 1.1.41.
- **Shorter texts, in short sentences:**
  - Locked notes: the info and the short-PIN warning in Settings → Locked notes, the recovery key pop-up and its file,
    "Encrypt your locked notes", "Could not be encrypted", Unlock all, Encrypt now, New recovery key, Forgot it?, Turn off
    encryption, and the PIN tips.
  - Settings: the hints under For new notes, Effects, Spelling, Backups, Where your notes live and the colour picker;
    the restore pop-ups; the Effects pop-up's switches and "Settings uses the same effects" hint (also in Edit design and
    in a note's Effects).
  - Notes list: Bin questions, the empty Favourites and Locked tabs, the "more in a locked group" tips, the Locked tab bar.
  - Note window: the choose-a-password hint, the picture description hint, the Ctrl+S toast, the picture-resize warning,
    the Minimise tooltip.
  - About → "Everything CosmoNotes can do": every item rewritten in one or two short sentences (no "since 1.1.x").
- Tests: `tests/v1141.test.js` (the version; no version history in about.js, list.html or the list's code; the
  changelog's top entry; long texts stay gone). The version check moved there from `v1131.test.js`.

## 1.1.40 – 31 October 2026 (was 1.1.31)

The owner found a locked note still readable in `notes/` after 1.1.30: his `settings.json` had no encryption keys, so
nothing had been encrypted. Notes locked before 1.1.30 wait for the PIN (the private key needs it), and nothing asked for
it. He also asked to encrypt the old backups and to leave no plain photo copies in the temp folder.

- **The list asks for the PIN at start** while notes locked before the update are still unencrypted (`status().needPin`:
  main opens the list 1.5 s after start; the list's "Encrypt your locked notes" pop-up). Settings → Locked notes now says
  plainly that they are NOT encrypted yet.
- **Setting up tries everything first** (`makeKeys` in `main/crypt.js`): seal and open a test note, lock the key with the
  PIN and the recovery key and open it again with both, and check that a wrong PIN doesn't. If anything fails, nothing is
  saved, the PIN keeps working as before (`lock:set` falls back to the old `salt:hash`), and the list shows what went wrong
  ("Locked notes could not be encrypted", also in Settings). This cloud workspace can't run Electron's own crypto library
  (BoringSSL), so this is how the owner's PC tells us if a crypto call doesn't work there.
- **Version 2 of the format:** the AES key is made with plain SHA-256 instead of HKDF (one crypto feature fewer). Notes say
  `enc.v: 2`, files start with `CNSEAL2`; 1.1.30's version 1 (`CNSEAL1`) is still read.
- **Old backups are encrypted too:** every copy in `backups/` of a note that is locked now, or was locked when that backup
  was made (its own lock, or a locked group in that backup's `groups.json`), is sealed in place, with its photos. One full
  pass (`settings.crypt.backupsSealed`; again after "Turn encryption back on", since backups made while it was off are
  plain), then only the copies of a note that just became locked. Nothing is removed; a sealed copy restores with its
  words after the PIN. With the key open, each sealed copy is opened again before the plain one is replaced.
- **Photo copies:** the plain copies made for "Open" on an encrypted photo are deleted when the app quits, as well as at start.
- `HOW TO INSTALL.txt`: updating from an older version (the PIN pop-up at start) and the encrypted backups.
- Tests: `tests/v1131.test.js` (old backups and their groups, a note locked later, off and on again, restore, the temp copies
  on quit, a crypto library that fails: nothing changes and the PIN still works, a version 1 note still opens, and the list
  window asking for the PIN at start and then showing the recovery key). `v1130.test.js` expects `CNSEAL2`.
- Only a real Windows PC can confirm that encryption sets up there: after installing, typing the PIN should show the
  recovery key (and `settings.json` gets a `"crypt"` part). If it says it could not encrypt, the message says why.

## 1.1.39 – 31 October 2026 (was 1.1.30)

**Locked notes are encrypted on this computer** (the owner's wish). Until now the lock was only a privacy screen: the note
file stayed readable in Notepad. The owner chose a recovery key for a forgotten PIN, PINs stay allowed with a warning,
and titles, photos and voice clips are encrypted too, with an optional "title while locked" to tell notes apart.

- **How it works** (`main/crypt.js`): one X25519 key pair for the app. The public half is stored as it is, so locking still
  needs no PIN. The private half is stored twice in `settings.json` → `crypt`, each copy AES-256-GCM-encrypted with a key
  made from the PIN / password (scrypt N=2^17, about 0.3 s and 128 MB per try, so every guess is slow) or from the
  **recovery key** (25 random letters and digits, scrypt N=2^15). Typing the PIN opens the private key for the session; it is
  never written down. `settings.lock` becomes the marker `'encrypted'`: the old quick `salt:hash` would have been the weak
  spot, so the PIN is now checked by opening the key.
- **What is sealed:** a locked note's (own lock or a locked group's) title, html, text, first picture and drawing go into
  `note.enc` together; its photos, drawings and voice clips are sealed in their own files (they start with `CNSEAL1`), and
  `note.encAtt` keeps their names so the attachment sweep never deletes them. Every save of a locked note seals it again; a
  note sealed on disk and not yet opened is written back as it was read. The first sealed save also seals the note's `.bak`
  (it would otherwise keep the plain previous version). Daily backups are written sealed too; **older backups (from before
  this update) are left as they were**. Opening a sealed photo with "Open" uses a plain copy in a temp folder that is emptied
  at every start. Speed: about 0.3 s once when the PIN is typed; saving and opening notes take well under a millisecond more.
- **Files follow the lock at once** (`syncSeals`, run at start and with every change the list hears about): locking a note or
  a group, or dragging a note into a locked group, seals it; removing a lock or taking it out writes it plain again (photos too).
- **Upgrading:** notes locked with an older version stay as they were until the PIN is typed once (anywhere); then
  encryption is set up, they are sealed and the list shows the recovery key. Settings also has "Encrypt now".
- **The recovery key** is shown once in the notes list (also when the PIN was typed in a note window: the list opens):
  Copy, Save to a file…, and "I have saved my recovery key" before Done. Closed without that tick, Settings offers it again.
- **Settings → Locked notes:** whether locked notes are encrypted; a warning while the PIN is shorter than 8 digits;
  "New recovery key" (the old one stops working), "Forgot it? Use the recovery key" (recovery key + a new PIN or password),
  "Turn off encryption" / "Turn encryption back on". Off writes every locked note and photo back in plain text (they stay
  locked in the app); the keys stay in `settings.json` so backups made while it was on can still be opened.
  The choose-a-PIN pop-ups have a tip about PIN length.
- **The title is hidden while locked** (it is in `SECRET` now): locked cards, the note's top bar and its window title show
  the new **`coverTitle`** ("Title while locked", in the note's ⋯ menu, and in Edit design in the list: on a locked card its
  title field edits this one) or "Locked note". Searching locked cards searches that title.
- **Never lose a note:** a note that is still sealed counts as locked whatever happened (it can't be emptied from its
  window or binned), Duplicate copies the sealed contents (the copy is locked), restoring a backup before the PIN brings
  sealed notes back sealed and locked, and a file that can't be opened is left as it is rather than overwritten.
- `HOW TO INSTALL.txt`: the reset by editing `settings.json` no longer works for encrypted notes; it explains the recovery key.
- Tests: `tests/v1130.test.js` starts the real main process four times over the same data (first PIN, after a restart,
  recovery key, turning off and on, removing a lock, a locked group, a note locked with 1.1.29) and checks the files
  themselves, plus the list window in Chromium (the recovery key pop-up, Settings, the title while locked, "Forgot it?").
  `list-ui-cards` / `list-ui-locks-bin` follow the new behaviour (a locked card hides its title; the first PIN shows the
  recovery key), `list-ui.js`'s `seed.password()` skips that pop-up, and `v1127.test.js` knows the seven `crypt:` messages.
- Only a real Windows PC can confirm the speed of typing the PIN and opening photos and voice clips from encrypted files.

## 1.1.38 – 31 October 2026 (was 1.1.29)

Behind the scenes only: nothing in the app looks or works differently. Many more automatic checks of how the notes list
works, written with what the 1.1.28 split taught about its code.

- **`tests/list-logic.test.js`** (runs anywhere, no browser): the list's own rules, loaded through `tests/list-kit.js`
  (the seven `src/list/` parts in a sandbox, with chosen data): groups inside groups (chains, sub-groups, a loop in broken
  data doesn't hang), what counts as locked (its own lock, a locked group around it, a group holding a locked note), the
  Locked and Favourites tabs (what shows, what is only counted), sorting (all six choices; a group counts its newest note),
  where a dragged card may go (never a group inside itself), the password / PIN rules, dates on cards, size and window
  colour fallbacks, and that the list's colours, group colours, window colours and sizes match `store.js` and main.
- **Five browser tests, `tests/list-ui-*.test.js`:** the real list window in Chromium, backed by the real main process
  through the real `preload.js` (`tests/list-ui.js`), so a click changes real notes and the test checks both the window
  and what main saved. `cards` (tabs and counts, what a card shows, a locked note's words never reach the window, search
  by title / text / picture description, sorting and sizes saved, Ctrl + wheel, open / close, Ctrl+N), `groups` (open,
  crumbs, back, mouse back / forward, new note inside, rename, the panel's look / colour / every note's colour, drag & drop,
  a locked group asks for the password, ungroup and bin ask first, a locked group can't be binned), `picking`
  (Ctrl / Shift-click, Ctrl+A, Escape, empty space, the bar's favourite / colour / font / group / open / close / lock / Bin,
  the right-click menu for picked cards, Delete and Shift+Delete, locked ones stay, dragging several), `locks-bin` (the
  first lock asks for a PIN with its rules, wrong PIN, Unlock all / Lock again, the Bin's questions, search, Restore into
  its group, Delete forever, Empty bin) and `settings` (sections fold, window colour, new notes' colours (never none; a new
  note gets them), font, see-through, switches, effects for all and the pause button, changing the password, Edit design).
- **Checked that they catch mistakes:** six small bugs planted in a copy of the code (a note in a locked group not counted
  as locked, Settings not going back, Move to Bin not asking, the last new-note colour removable, search skipping picture
  descriptions, Escape not clearing picked cards): each made the right test fail. All browser tests passed 15 runs in a row
  and with all five running at once.
- **`tests/run.js`:** a test that exits with 77 is shown as SKIP (the browser tests without Playwright, e.g. on a PC
  without it); the summary says how many were skipped. `npm test` now runs 31 files, about 2 minutes with the browser tests.
- `v1129.test.js` checks this set-up stays in place; the version check moved there.

## 1.1.37 – 31 October 2026 (was 1.1.28)

Behind the scenes only: nothing in the app looks or works differently.

- **The notes list's code (`src/list.js`, 2,177 lines, ~117 KB) is split into seven files in `src/list/`**, 11–25 KB each,
  loaded in this order by `list.html`: `base` (colours, themes, sizes, icons, the DOM helper, the colour row, loading the
  data), `cards` (drawing the list, drag & drop, note and group cards, the group header), `picking` (favourites, Ctrl/Shift-click,
  the lock animation, the bar for picked cards), `settings-menus` (Settings: new-note colours, About, backups; the app's
  pop-ups and toasts; the right-click menus), `effects-design` (effects on the cards, Settings → Effects, Edit design),
  `actions-locks` (Bin and delete, passwords and locks, the Locked tab, the group panel, folding sections, back / forward) and
  `events` (the window's buttons, search, keys, mouse, and the first load). `CONTEXT.md` lists what each holds.
- **How the parts share names:** each part is still its own closed block. They share through one object,
  `window.COSMO_LIST_KIT` (`K`): a part takes the names of earlier parts on its first lines, calls a function of a later part
  through `K.later('name')` (looked up when it is called), and hands its own names on at its end. The 16 variables that
  more than one part changes (`tab`, `openGroup`, `state`, `query`, `drag`…) are now properties of one object, `V`, so every
  reference reads `V.tab` etc. Every other line was copied unchanged: of the old file's 2,174 code lines, 1,995 are identical
  and the other 179 differ only by those `V.` / `K.` prefixes (checked by script).
- **How it was checked:** besides the line check above, each part on its own uses no name it doesn't have (only the
  browser's and the kit's), and a recording of the window: `tests/record-list.js` runs the real main process (fake
  Electron, fixed clock, counted ids) behind the real `preload.js`, opens the list in Chromium with a stopped clock and plays
  285 steps (tabs, search, sort, sizes, groups and their panel, drag & drop, picking and the bar, every right-click menu,
  Edit design, Settings, Effects, passwords, the Locked tab, the Bin, keys), logging after each step the whole page, every
  call to the app with its answer (295 calls, plus 109 messages from main) and any error. The old code recorded twice gives
  identical logs, and the new code gives the same log as the old. Three deliberate mistakes in the new code (a forgotten
  line in back / forward, a pop-up message that stays 0.1 s shorter, one part keeping a stale copy of a shared variable)
  each changed the log. 474 of the 508 functions in the list's code ran during the recording, among them every function
  one part calls in another. Not reachable here: everything that needs a real Windows PC.
- `src/list.js` is now only a note saying where the code went (the folder bridge can't delete files; it can be deleted).
- New helper: `tools/split/split-page.js` does such a split from a plan (`tools/split/plan-list.json`), ready for `note.js`.
  `tests/record-list.js` + `tests/record-list-scenario.js` record the window (not run by `npm test`; they need Playwright).
- Tests: `tests/list-source.js` joins the parts for the tests that check a line of the list's source (`v1120`, `v1122`,
  `v1123`, `v1124`); `v1128.test.js` checks that `list.html` loads every part in order, that each part is a closed block with
  LF line endings, that every name a part takes or calls is given by the right part, that each `V.x` is set up once, and it
  loads all seven parts together in a sandbox. The version check moved there.

## 1.1.36 – 31 October 2026 (was 1.1.27)

Behind the scenes only: nothing in the app looks or works differently.

- **`main.js` (1,400 lines) is split into modules.** `main.js` is now only the start-up (the custom file protocol, the app
  id, the single-instance rule, the app lifecycle); everything else is in a new `main/` folder, 23 files of 11–223 lines:
  `state`, `constants`, `locks`, `migrate`, `settings`, `display`, `web`, `ink-geometry`, `ink-window`, `list-notify`,
  `note-state`, `list-visibility`, `note-window`, `list-window`, `tray`, `ipc-common` and the IPC handlers in six files
  (`ipc-notes`, `ipc-ink`, `ipc-files`, `ipc-groups`, `ipc-list-actions`, `ipc-settings`, started by `ipc.js`). `CONTEXT.md`
  says what each holds. The code was copied unchanged except: the four variables the old file shared (`store`, `listWin`,
  `quitting`, `listUnlockedAll`) are now properties of one object, `S` (`main/state.js`), so every reference reads
  `S.store` etc.; the paths to `assets/`, `preload.js` and `src/` go one folder up; and the big `registerIpc` function is six
  smaller functions called in the old order.
- **`package.json`:** `build.files` now also packs `main/**/*` (without it the installer would build an app that cannot start).
- **How it was checked:** `tests/record-main.js` runs the real app code under the fake Electron with the clock, timers, random
  numbers and ids replaced, drives every one of the 60 IPC channels, the window events, the toolbar windows, the tray menu,
  permissions, the migration from "Sticky Pins" and a restart, and logs every window call, message, answer and file written.
  Before and after the split the three recordings (1,025 + 36 + 72 lines) are identical. The recorder was checked first:
  the old code recorded twice gives identical logs, and six deliberate small mistakes in the new code (a constant, a skipped
  password check, a flipped condition…) each made the recording differ. Not reachable in this check (needs a real Windows
  PC): "Start with Windows" (`setLoginItemSettings`) and everything about real windows, the tray and the installer.
- Tests: `tests/main-source.js` joins `main.js` and `main/*.js` for the tests that check a line of the source (`v1120`,
  `v1122`, `v1123`); `v1127.test.js` checks that every part is loaded and none needs another in a circle, that
  `main/**/*` is packaged, that the shared variables are only used as `S.…`, that the paths still find `assets/`,
  `preload.js` and `src/`, and that all 54 + 6 IPC channels are still registered. The version check moved there.
  `tests/record-main.js` is kept for the next change to the main process (it is not run by `npm test`).

## 1.1.35 – 31 October 2026 (was 1.1.26)

Behind the scenes only: nothing in the app looks or works differently.

- **The two big style files are split into smaller ones.** `src/note.css` (1,177 lines) is now six files in `src/css/`:
  `note-base.css` (colours, base, top bar), `note-text.css` (locked note, photo handle, writing area),
  `note-toolbars.css` (bottom bar, pop-overs), `note-drawing.css` (right-click menu, recording, drawing, toast and the
  1.1.0–1.1.10 additions), `note-effects-lock.css` (effects, lock animation, small notes) and `note-popups-find.css`
  (pop-ups in the app's colours, Ctrl+F). `src/list.css` (1,289 lines) is five: `list-base.css`, `list-cards.css`,
  `list-groups-menus.css`, `list-settings-fx.css`, `list-picking-edit.css`. `note.html` and `list.html` load them in that
  order, which is the order the rules had before, so later rules still win exactly as before. Every line was copied
  unchanged, and every cut is between two top-level rules (never inside one).
- **How it was checked:** joining the parts gives back the old files byte for byte (same SHA-256); then both windows were
  loaded in Chromium before and after and the computed style of every element was compared: no difference (and the
  old page compared with itself also showed none, so the check is not just noise).
- `src/note.css` and `src/list.css` are now only notes saying where the styles went; they are not loaded any more and
  can be deleted.
- Tests: `tests/css-source.js` joins the parts the way the pages load them (`v1122` and `v1123`, which read the CSS text,
  use it); `v1126.test.js` checks both windows load the parts in order, every file in `src/css/` is loaded, every part
  is complete on its own (braces balance) and the line endings are kept. The version check moved there.

## 1.1.34 – 31 October 2026 (was 1.1.25)

- **Fixed: Ghost ripple as a mouse effect.** Switching it on threw an error: the Layer draws once before the first step,
  and the follower's dots had no brightness (`near`) yet, so `bucketDots` got NaN. The error stopped whatever came
  after: in a note, the effects setup half-way (pause and rolled-up were not applied); in the notes list, the effects of
  every card after that note. Now `near` counts as 0 until the first step (`followers-lab.js`, the `ghost` follower).
  Checked with the drawing recording from 1.1.24: only the six Ghost ripple runs changed (three more drawing calls each,
  the first drawing now finishes); the other 171 runs are identical.
- Tests: `v1125.test.js` switches on every background and every follower, on light and dark paper, and draws before
  anything has moved: none may throw or draw at NaN.
- Docs: `ai-context/splitting-code.md`, what was learned splitting `src/fx.js`, for splitting other big files later.

## 1.1.33 – 30 October 2026 (was 1.1.24)

Behind the scenes only: nothing in the app looks or works differently.

- **The effects code is split into smaller files.** `src/fx.js` (about 180 KB, 2,350 lines) is now eight files in `src/fx/`:
  `kit.js` (colours and shared helpers), `effects-classic.js`, `effects-lab.js`, `effects-magic.js` (the backgrounds),
  `followers-classic.js`, `followers-lab.js`, `followers-magic.js` (the mouse followers) and `engine.js` (order, choosing
  rules, the shared loop, the Layer, icons). `note.html` and `list.html` load them in that order; they share their helpers
  through `window.COSMO_FX_KIT`. Every line of code was copied unchanged; only the lines that open and close the two
  lists of effects became `Object.assign(…)`. A change to one effect now needs only its own file (9–34 KB).
- **How it was checked:** every background and mouse follower was run through the real Layer before and after, with the
  same random numbers and clock, on light and dark paper, at three frequencies and two sizes, with a moving, resting and
  leaving mouse: all 177 runs made the same 7,234,430 drawing calls. Both windows also load in Chromium with the same
  messages as before, and the effects draw.
- `src/fx.js` is now only a note that says where the code went; it is not loaded any more and can be deleted.
- Tests: `tests/fx-source.js` loads the parts the way `note.html` lists them (the effects tests use it);
  `v1124.test.js` checks that both windows load the same parts in the same order, that every part is loaded, that each
  part keeps to itself, and that together they give the same effects as `store.js`. The version check moved there.
- Docs for AI assistants: a short `CLAUDE.md` plus one file per topic in `ai-context/`; older versions of this changelog
  moved to `CHANGELOG-archive.md`.
- Found while checking (not changed): the Ghost ripple mouse follower throws an error once when it is switched on, before
  the mouse has moved (its dots have no brightness yet on the first drawing). It works normally after that.

## 1.1.32 – 30 October 2026 (was part 3 of 3 of 1.1.23)

Picture descriptions, a touch of the paper’s colour on effects, and faster effects.

- **Picture descriptions.** Right-click a picture (or a drawing) → **Add description…** / **Edit description…**: a small form (`#descPop`, Enter saves, empty removes it). The words are stored as the picture's `alt` (and `title`, so they show as a tooltip); they never show in the note. **Ctrl+F** finds the picture by them (the picture gets an outline: `img.find-hit` / `find-cur`, stripped in `collect()`), and the **notes list's search** too: main.js sends `pics` (`pictureWords(html)` in store.js reads the `alt`s; empty for locked notes) and every list / Bin search looks in it. Pasting keeps a picture's `alt` / `title` (the paste allow-list had only `src`).
- **A touch of the paper's colour on effects.** `paperPalette(dark, paper)` in fx.js: every coloured ink of the palette turns 12 % of the way round the colour wheel towards the note's paper hue (`PAPER_HUE`), keeping its lightness and strength, so it reads the same; greys, whites and near-blacks don't change, and charcoal (no hue) is untouched. Cached per paper. `Layer.set({ paper })` (the note window, the list's cards and the Edit design preview pass the note's colour); changing the colour remakes the effect.
- **Faster effects, especially on weaker computers** (nothing looks different: each change was checked pixel by pixel against the old drawing, differences at most 2–10 / 255 on a few pixels where many soft glows overlap):
  - *Rainbow* was by far the heaviest: every frame it repainted all seven bands, rebuilt its 121-step mask and blurred the whole note (`c.filter = 'blur(…)'`), ~45 ms a frame on a 1100×750 note without a graphics card (more than a frame has, so it stuttered everywhere). Now the bands are drawn and blurred **once per rainbow**, at screen resolution and only in the box around the bow (`solidBow`, `bowBox`); while it draws in, only the mask is laid again (inside that box); once it's fully in, the finished picture is reused (`cur.key`) and only its see-through-ness changes. Measured: 45 → 13 ms a frame on a big note, 5.2 → 1.4 ms on a normal one; on a CPU slowed 6× it went from ~6 steps a second to ~24. The work canvases are only as big as the bow's box (a double rainbow's spare is made only when needed).
  - *Soft glows* (fireflies, embers, plankton, stardust, steam in the Cauldron, the jellyfish's shine, fel-fire tongues, `glowDot` / `glow2`): each glowing particle built a new radial gradient (and parsed its colours) every frame — up to 60 a frame. Now each glow is made once per colour as a small picture (`glowSprite`, 128 px, cached) and stamped (`stamp`). 15–50 % less time for those effects.
  - *Slower computers adapt* (`PACE` in the shared loop): it keeps a running average of how long the effects take per step; above 11 ms it steps 20 times a second instead of 30, above 18 ms 15 times, and goes back up when there's room (below 6 / 9 ms). Things move at the same speed (each step goes further); typing gets the time back. On an ordinary computer it stays at 30. `COSMO_FX.loopPace()` tells the current rate.
  - *Typing in long checklists:* the box alignment (`alignChecks`) measured a line, wrote its values, then measured the next, so the browser laid the note out again for every checklist line on every key press; now it measures all lines first, then writes (26 → 20 ms a key on a 120-line checklist with a 6× slower CPU).
- **Joining two lines keeps their look.** Delete at the end of a line (or Backspace at the start of the next) let the browser join them, and when the lines were formatted differently it re-styled the moved words (wrapping them in `font-size: 0.68em; font-family: …` styles, so the second line's text got smaller or changed font, or dropping their font). Now `joinLines` (note.js) puts the second line's words at the end of the first exactly as they were, in one `insertHTML` (one Ctrl+Z undoes it), with the caret at the join. Lines with lists or tables inside, empty first lines and table cells still use the browser's own join.
- **The text panel keeps your selection.** Opening it creates its small window, which could take the focus from the note for a moment and with it the selected text's highlight. Main now gives the focus straight back to the note when that window is made (if the note had it), and the note puts the selection back after the panel opens.
- **Edit design, Background tab:** it had a second scrollbar. The hidden checkbox of the "Mouse can interact with the background" switch is placed absolutely, and the tab area (`.epanes`) wasn't positioned, so the checkbox hung far below the pop-up and made the whole pop-up scroll too. `.epanes` is now `position: relative`.
- **Ctrl+S** in a note shows a toast: "Already saved. Your notes save by themselves as you type." (and saves at once, in case the 350 ms auto-save hadn't run yet).
- Tests: v1123.test.js (the version, everything above; the earlier rounds' tests moved here from v1122).

## 1.1.31 – 29 October 2026 (was part 2 of 3 of 1.1.23)

Ctrl+F in a note, Warp speed’s hyperdrive, and a calmer Analog monitor and Cauldron.

- **Analog monitor and Cauldron (29 October 2026):**
  - *Analog monitor* (background): the fifth round made it busy (springy lines shaken by the scan line, many brighter bent lines). Now calm again: scanlines every **6 px** (was 4) crawling at **3 px/s** (was 8); one soft scan line takes **8 s** to cross and doesn't move the lines; Frequency = how often it comes, `clamp(24 s / k, 12 s, 75 s)` start to start. **Mouse interacts: the pointer opens a gap in the lines where it is** (also while it rests): lines above and below bend smoothly away (half-gap 9 px, reaching ~44 px sideways and ~24 px up/down, never crossing), opening in ~0.2 s and closing in ~0.3 s after it leaves. No springs, no `Float32Array` rows.
  - *Cauldron* (background, mouse interacts): the owner picked the soft dip of **pick B** ("Cauldron Picks" page) without its whirlpool. Near the surface the pointer presses a smooth dip (4.5 px, ~30 px wide) that drifts after it with a lag, stays while it rests and fades out in about a second when it leaves. The quick sideways wave, the swirl and the extra bubbles from a moving pointer are gone; orbs still pop when touched.
  - Tests (v1123): the monitor's gap opens at rest, leaves far lines alone and closes again; 6 px lines crawling 3 px/s; scan line counts; no cauldron whirlpool.
- **Ctrl+F and Warp speed (29 October 2026):**
  - **Ctrl+F: find in a note.** A small find bar under the top bar (`#find`): type to find (not case-sensitive, also across bold / coloured bits of a word, never across lines; up to 2000 matches); "3 of 9"; **Enter / F3 / ↓** next, **Shift+Enter / Shift+F3 / ↑** previous (wraps round), and the note scrolls the match to the middle. Every match is highlighted and the current one stronger, using the browser's CSS Custom Highlight API (`::highlight(cn-find)`, `cn-find-cur`), so the note's HTML isn't touched and nothing is saved. **Marks beside the scrollbar** (`#findMarks`) show where all matches are in the whole note (the current one bigger and brighter; click one to jump to it). Text selected when you press Ctrl+F (one line) becomes the search. Typing in the note while it's open finds again and stays on the same match. **Esc** closes it and leaves the current match selected in the note. It pops up in 0.05 s (3 frames; was 0.14 s). Closes by itself if the note locks.
  - *Warp speed* (background, mouse interacts): the pointer no longer steers the vanishing point. While it's **in the middle of the note** (a centred box with 10 % of the note's area: 31.6 % of its width and height) it's **hyperdrive the whole time**, at speed 3 (the normal jump is 1.6, cruising 0.1), spooling up in about a second with a flash; streaks get only a little longer. Leaving the middle drops back to the normal 30 s cruise / 3 s jump cycle.
  - Tests (v1123): warp goes into hyperdrive in the middle and back out (checked against a twin with no pointer, so its own jump doesn't interfere); find's pieces are there and nothing of it is saved.
- *Warp speed:* the hyperdrive spot is a little closer to the centre: a box 24 % of the note's width and height (was 31.6 %).

## 1.1.30 – 29 October 2026 (was part 1 of 3 of 1.1.23)

Checklists, pictures, effect choices and the notes list.

- **Checklists, pictures, effect choices and the notes list (28–29 October 2026):**
  - **Checklist boxes centred at every text size.** The box was one size (0.78 em / 1 em of the note's size) at one height (0.3 em), so with bigger or smaller text, or the other font, on the line it sat up to 13–18 px too high or low and stayed small. Now `alignChecks()` (note.js) measures each checklist line's first words on screen and sets `--cb-s` (box size: that text's size, ×0.78 for Caveat), `--cb-t` (centred on those words) and, when the box grows, `--cb-p` (more room before the text) on the line; note.css uses them with the old values as fallback. Measured: every box now within 0.1 px of its words' centre (was −17.6 to +1.9 px). Runs on typing, resizing, the note's font / size changing, pictures loading and fonts loading. `collect()` strips these values, so they are never saved.
  - **Backspace at the start of a checklist line takes its box away** (the text stays as a normal line, via the browser's `outdent`, so Ctrl+Z works; a ticked line is unticked first so its text isn't left crossed out). Before, the browser glued the line onto the line above, except for a list's first line, which is why it "sometimes" worked. An empty checklist line still just goes away.
  - **Delete right before a photo** now deletes the photo (it did nothing: a photo is its own block, so the browser's "next character" was an empty step); **Backspace right after a photo** deletes the photo (it removed the line's wrapper and left the photo). Both use the browser's own delete, so Ctrl+Z brings them back; so does deleting a clicked (picked) photo now (it used `remove()`, which Ctrl+Z couldn't undo). New helpers `leafAfter` / `leafBefore` find the next / previous visible thing from the caret.
  - **Photos: right-click → Copy image** (new, first; copies a PNG to the clipboard, read from the photo's file, so it pastes anywhere) and **Open in photo viewer** (was "Open full size").
  - **Photos in a ticked checklist line are struck through** (a line across the middle, like the text, drawn by note.js in an overlay `#strikes` over the text), not only faded.
  - **Effect choices are all the same size** (note Effects pop-up, Edit design, Settings → Effects → Choose…): fixed row heights (30 px in the note, 36–38 px in the list), names on one line; "Same as all notes" is now **"Same as all"** (its full name in the tooltip), whose two lines made its row taller so None / Snow / Rain beside it had extra room. In Edit design the tick is gone (the dark ring shows what's picked) so long names fit.
  - *Dust in light* (mouse): 20 % more dust at every frequency.
  - **Effect order:** Snow, Rain, Lightning, Rainbow · Autumn leaves, Cherry blossom · Fireworks, Confetti, Hearts · Bubbles, Night sky, Embers, Stardust, Glass shards, Plankton · Fish, Fireflies, Dust in light · Digital ocean, Silk waves, Ghost jellyfish · Network, Ghost ripple, Warp speed · Analog monitor, Matrix · Healing aura, Cauldron, Fel fire.
  - **Notes list:** a small picture on a card is shown at its own size instead of being stretched (and cropped) to fill the picture box (`fitThumb`: if filling the box would enlarge it, it keeps its size, never taller than the box), and the card then shows more lines of text. The card's right-click menu: **Add to favourites** first, then **Edit design…**; "Open on desktop" / "Bring to front" removed (clicking the card opens it).
  - Tests (v1123): the order, dust, and checks for each change above.

## 1.1.29 – 28 October 2026 (was part 3 of 3 of 1.1.22)

The owner’s fifth and sixth rounds of notes.

- **Fifth round of the owner's notes (still 1.1.22, 28 October 2026; the owner said not to raise the version):**
  - *Dust in light* (mouse): less dust. The frequency scale moved down so the old "Rarely" amount is now "Often" (`k × 0.35 / 2.6`): one speck every ~17 px at Often (was every ~6 px), ~44 px at Normal, ~128 px at Rarely.
  - *Analog monitor* (background, mouse interacts): the Magnet is gone (no lumpy blobs, no tail, no red / cyan fringe). The owner liked the bending lines, so the lines stay and now work like Ghost ripple: each scanline is a row of springy points (one every 8 px, a line every 4 px; `dy`, `vy` per point, spring 7, damping 3). **One** bright scan line (with a soft glow trailing it) sweeps down the screen now and then; the lines part to let it through and wobble back into place behind it (up to ~8 px, calm again in ~2–3 s). The pointer does the same while it **moves** (faster than 25 px/s; a resting pointer leaves the lines alone, so there is no fixed lump or ellipse). Lines that are out of place shine a little brighter. The slowly crawling scanlines stay. The second, slower bar that "Often" used to add is gone.
  - **What Frequency means now** (there is only one line): how often it sweeps. Cycle (start to start) = `clamp(16 s / k, 5 s, 60 s)`: about once a minute at Rarely, every ~16 s at Normal, every ~5 s at Often (which also sweeps quicker: 4 s instead of 7 s; bigger notes count as "more often" too, like every other background). The push is scaled with the sweep speed so the lines part about the same at every frequency.
  - **Effects listed by theme** (the owner picked "Option A" of three): the Background and Mouse tabs (note Effects, Settings → Effects → Choose…, Edit design) now list alike effects together: Snow, Rain, Lightning · Autumn leaves, Cherry blossom · Fireflies, Dust in light, Embers · Night sky, Stardust, Warp speed · Plankton, Bubbles, Fish · Digital ocean, Silk waves, Network, Ghost ripple · Matrix, Analog monitor, Glass shards, Rainbow · Healing aura, Cauldron, Fel fire, Ghost jellyfish · Fireworks, Confetti, Hearts. Only the order changed, not any id, so saved choices stay. The order is now an explicit list (`ORDER` in fx.js, which builds `EFFECT_IDS` and so the followers' order; an effect missing from it is added at the end) and the same list is in store.js (`FX_EFFECTS` / `FX_FOLLOWERS`). Tests: v1118 / v1120 no longer expect the old positions; v1122 checks the new order and that fx.js and store.js agree.
  - Tests (v1122): no blobs / fringe in the code; a moving pointer parts the lines and they come back to straight, a resting one leaves them alone; only one scan line at a time even at Often; sweeps per 5 min at Rarely / Normal / Often (3–7, 14–23, 45–70); dust at Often makes about what Rarely used to. The old "bend gets bigger with speed" tests were removed.
- **Sixth round of the owner's notes (still 1.1.22, 28 October 2026, same version again):**
  - **Effect order** tweaked: Snow, Rain, **Rainbow**, Lightning · Autumn leaves, Cherry blossom · **Fireworks, Confetti, Hearts** · **Bubbles, Fish** · **Glass shards** · **Plankton** · Fireflies, Dust in light, Embers · Night sky, Stardust, Warp speed · Digital ocean, Silk waves, Network, Ghost ripple · Matrix, Analog monitor · Healing aura, Cauldron, Fel fire, Ghost jellyfish (`ORDER` in fx.js, `FX_EFFECTS` / `FX_FOLLOWERS` in store.js; ids unchanged).
  - **Checklists show their boxes in the notes list.** The list only got a note's plain text, so checklist items looked like ordinary lines. New `checklistMarks(html, text)` in store.js reads the note's html (no browser needed: a small tag reader) and gives one letter per line the card shows (`o` box, `x` ticked, `.` plain); any `<li>` inside a `ul.checklist` counts, its box on its first line, matched to the lines by their words in order (a line that doesn't match just has no box). main.js sends it as `checks` in `list:get` (empty for locked / hidden notes); `cardBody` (list.js) draws a small box in the card's accent colour, ticked ones filled with a tick and the line struck through and faded, like in the note (also on dark papers and in the Bin). Works for existing notes straight away. Checked against real browser `innerText` for the welcome note and nested / multi-line items.
  - **Network** (background): the nodes ended up **scrunched into one clump** after a while. They all drifted on the same "wind" (`flow`), which has spots where it gathers, and nothing kept them apart (the pointer also pulled near ones into one dot that never came apart). Measured over a simulated hour: 30 nodes ended in 4–5 of 36 grid cells, 2–12 px apart. Now: nodes closer than 0.55 × the link length push apart, each node has its own slowly turning heading (the shared wind is weaker), the edges push softly inwards (18 px) instead of piling nodes against them, and a node never drops below 3 px/s. After an hour: 21–24 of 36 cells, 35–64 px apart, with or without the pointer resting on it.
  - **Edit design** is now a **small pop-up next to the note** (352 px wide, right of the card if there's room, else left, always inside the window) instead of a sheet covering the whole list; nothing behind it is dimmed or blurred, and the note being edited gets a dark outline. **Tabs: Colour** (colours and see-through), **Background**, **Mouse**; the title and live preview strip stay on top; the tab area keeps one height (long effect lists scroll inside). **What's picked now stands out** like in Settings → window colours / backups: a white button with a 2 px dark ring (effects, Frequency), the open tab is a dark pill (was a slightly darker beige, hard to tell apart). The same picked style applies in Settings → Effects → Choose…. Fixed on the way: the right-click menu forgot which card was clicked before the item ran (`ctxCard`).
  - Tests (v1122): the new order; network nodes stay spread after 20 simulated minutes; `checklistMarks` cases and that the list sends / draws them; Edit design has the three tabs, no dimming, small width and the ring style.
- Tests: v1122 (versions, jelly doesn't flee, lightning hits only when near, fel stays low, fel / embers burn and go out, cauldron has no gaps, renamed switch); v1120 adjusted (fel / embers burn on a resting pointer).

## 1.1.28 – 27 October 2026 (was part 2 of 3 of 1.1.22)

The owner’s third and fourth rounds of notes, and the picks from the “1.1.22 Picks” page.

- **Third round of the owner's notes (still 1.1.22):**
  - **Removed:** Solar system and Aquarium, backgrounds and mouse effects (fx.js `EFFECTS` / `FOLLOWERS`, `aqKit`, the `aq` palette, icons; store.js `FX_EFFECTS` / `FX_FOLLOWERS`). A note that had one goes back to "same as all notes" (`cleanFx`), a setting that had one shows nothing (`resolve`). Tests v1118–v1120 updated.
  - **Effects pop-up (note):** the note's colour swatches and see-through slider (`.fxlook`, `#fxColors`, `#fxOpacity`, added in 1.1.20) were taken out again; see-through stays in the ⋯ menu. With "None", Frequency, Opacity and "Mouse can interact with the background" are greyed out and switched off (`.off`, `disabled`) instead of hidden; the same in Settings → Effects → Choose… and in Edit design.
  - *Ghost jellyfish:* the shine stays 0.35 s after the pointer leaves, then fades in under a second (was ~2 s); the twin fades in 1.2 s (was 2.2 s).
  - *Lightning* (mouse): a single line (no forks), strikes 1.5 s after it starts (was 2 s), no length limit (was the last 70 points; now 2000, a safety net only), and it rests 1 s after a strike before a new one can start. (Background, mouse interacts): hits the pointer more often: 60 % of bolts start above it and they bend to it from `max(50, 24 %)` px (about half to two-thirds of bolts hit, depending on where the pointer is); a hit has a white flash, a shock ring, three tiny crackling arcs and 5 sparks (was 9).
  - *Mouse effects that spawn by distance* (stardust, hearts, bubbles, rain, snow, confetti, leaves, plankton, network, embers, blossom, night sky, glass shards, dust, fireworks, warp speed, analog monitor, fel fire): a fast mouse jumps 30–60 px between two events, so the particles came out in clumps at the end of each jump with gaps between, and the ones with a small limit (glass shards 16, plankton 90, dust 80, blossom 40, ...) simply stopped making new ones while the old ones were still alive. Now `Layer.move` feeds these followers the jump in steps of at most ~10 px along the path (`ALONG` list in fx.js), and when a limit is reached the oldest particle goes instead of refusing the new one (`room()`); the limits were raised a little (shards 28, plankton 120, warp 110, blossom 60, night sky 70, dust 110, embers 110, fel 170, analog monitor cells 260).
  - *Healing aura* (mouse): crosses come by time (9 a second while moving), not by distance with a cap of 40, which came in bursts and gaps.
  - *Digital ocean* (mouse): it kept only the last 36 slices, so at a normal mouse speed the wave was cut off before it could curl over and break (the picks page's ghost pointer was slow, so it looked fine there); now up to 140 slices (wider apart once there are 100), and the curl direction comes from the last 14 px of the path instead of every tiny mouse wobble.
  - *Analog monitor* (mouse interacts): the old-TV break-up is gone; the owner picked **Magnet** from three tries (Magnet / Light pen / Vertical hold, now removed with `COSMO_FX.PICK`) and asked for it not to be a perfect circle: the scanlines bend away round the pointer in a lumpy smear that **grows and strengthens with the mouse's speed** (radius `40 + 0.055·speed` px, up to 1800 px/s) and stretches into a **fading tail along the path just taken** (up to 10 earlier bends, ~0.7 s), settling back when the mouse slows; a faint red / blue fringe shows where lines bend most.
- **The owner's picks (from the "CosmoNotes 1.1.22 Picks" page):** Analog monitor mouse = **Phosphor pixels** (`triad`), Healing aura bottom = **Breathing** (`breath`), Ghost jellyfish touch = **Slingshot ghost** (`sling`), Digital ocean mouse = **Surf**. The other versions were removed and `COSMO_FX.PICK` is gone. Last change to the slingshot (the owner: the ghost shouldn't follow the mouse): the twin is flung **once, the moment the pointer goes in**, in the direction the pointer was moving as it entered (from a standing start: away from where it came in), at 70–120 px/s slowing fast (`.08^t`, ~28–47 px) and fading in 2.2 s; it never follows the pointer, and moving round inside does nothing more until the pointer leaves and comes back (at most one every 0.6 s, 3 at a time).
- **Fourth round of the owner's notes (still 1.1.22, 27 October 2026):**
  - *Ghost jellyfish* (mouse interacts): the violet twin is now a **still mirage**. Before, it was flung out and drawn as a live copy of the jellyfish, so it pulsed, swayed and swam along with it. Now a **snapshot of the jellyfish's dots** is taken the first time it is drawn and stays exactly where it appeared (`twins[].snap`; no more `vx` / `vy`). It lasts 1.6 s (was 1.2) and its opacity is `0.6 · min(1, 10v) · (1 − v)^1.5` (v = age / life): a quick fade-in, then a smooth fade from the first moment to the very end. **Why the ending was abrupt:** it was drawn with `bucketDots` (4 opacity groups), whose faintest group is always drawn at about 12 % however faint a dot really is, so the twin went from about 12–30 % to nothing in one frame when it was removed. New helper `bucketFade(c, items, col, B, maxA, fade)` multiplies every group by one smooth fade value, so it reaches 0. The mirage is drawn outside the `if (jelly)` block, so it also finishes fading if the jellyfish has gone. (`bucketDots` is still used for everything else.)
  - *Lightning* (mouse): rests **0.5 s** after a strike (`REST`, was 1 s) before the next bolt starts building (about 0.6 s until its line shows).
  - *Lightning* (background, mouse interacts): hits the pointer more. Bolts bend into the pointer from `max(70, 32 %)` of the note's short side (was `max(50, 24 %)`), and 70 % of bolts start above the pointer (was 60 %; spread ±20 % of the width, was ±25 %). Measured over 240 s of bolts at three pointer positions on two note sizes: hits went from about 41–66 % of bolts to about 66–82 %. The rest still strike anywhere, so the side bolts stay.
  - *Fireflies* (background, mouse interacts): the magnet was too strong and reached too far. Only fireflies within **70 px** (was 150) of the pointer get interested; the pull is `0.5–1.1` a second (was 1–2.2) and weaker the further away (`0.4 + 0.6 · closeness` within 110 px); they follow for 1.6–3 s (was 2.5–4.5); and a firefly **lets go** once the pointer is over 110 px away (then ignores it for 4–8 s). Before, it chased the pointer wherever it went: when the pointer leapt 200 px away a following firefly flew about 217 px after it, and one 125 px away was pulled in to within ~28 px. Now the first just wanders (about 11 px) and the second ignores the pointer. The Fireflies mouse follower (all of them follow the pointer, by design) is unchanged.
  - Tests (v1122): the mirage never moves and only gets fainter (last visible frame under 3 % opacity and no step bigger than 5 % in a frame; the old code ended at 12 % with a 24 % step); the lightning mouse rests about half a second; fireflies: near ones come over, far ones ignore the pointer, and they let go when it leaps away; the lightning background hits more than 60 % of bolts but not every one.

## 1.1.27 – 26 October 2026 (was part 1 of 3 of 1.1.22)

The owner’s first and second rounds of notes on the effects. Menus no longer snap from far away.

- **Effects, the owner's notes** (src/fx.js):
  - *Analog monitor* (mouse interacts): "like touching an old TV". Around the pointer: snow (static specks, new every frame), shaky brighter scanlines with red / cyan fringes, a magnet-like rainbow smudge, torn lines that slip sideways (more when it moves fast), a flickering tube; a hard flick (> 1100 px/s) makes the picture lose its hold and roll once. Settles when the mouse leaves (`hot` fades).
  - *Silk waves* (mouse interacts): gentler. The ribbons used to be pulled onto the pointer (up to 80 % of the way); now they part softly round it (at most ~13 px), sway a little with its up/down movement and shine where it touches. The pointer is followed with a lag and the effect fades in/out over ~1 s.
  - *Dust in light*: the mouse follower is only the dust (no beam). Mouse interacts: dust in the light shows more (and a little bigger), dust outside it a little less, and the pointer casts a soft shadow down the beam it's in (`destination-out` strip) that dims the dust in it; beams brighten a bit (more on dark papers).
  - *Healing aura*: the bottom no longer has rings swirling out; it's a pulsing aura in one of three versions on the "CosmoNotes 1.1.22 Picks" page (`PICK.healBase`: `breath` default, `beat`, `veil`). The pointer's rings became a soft glow. The follower is only floating heals (green and gold crosses with a soft glow), no rings or dots.
  - *Lightning*: follower rewritten: a faint, flickering, jagged leader (with little forks) grows along the pointer's path and its tip charges up; ~2 s after it started a bright return stroke races back along it from the far end to the pointer (0.11 s), flashes, flickers and fades, then the next one starts. Background (mouse interacts): a bolt picks where it strikes first and only bends to hit the pointer when the pointer is within `max(32, 14 % of the note's short side)` px of its path (with sparks and a glow where it hits); a bolt on the other side misses. No more extra bolts just because the mouse is there.
  - *Cauldron* (mouse interacts): stirring. Moving sideways near the surface sends small waves the way the pointer goes, the surface dips under it and a faint swirl turns below; calms down in ~1–2 s. Bubbles still pop. Follower: bubbles come by time (5–12 a second while moving), not by distance with a cap of 24 (which filled up and then stopped, in bursts); a small potion glow at the pointer; it bubbles on briefly and calms after the mouse stops.
  - *Ghost jellyfish* (mouse interacts): it no longer swims away. Touching it lights it up, in one of two versions on the picks page (`PICK.jellyTouch`: `glow` default = brighter, bigger, violet with a shimmer running down it, calming over ~2 s; `cross` = a violet twin slides through with the pointer and light ripples out where they overlap).
  - *Fel fire*: the flames stay low (up to the lower middle at most, flares included): each particle slows down as it rises (`dec`), with a soft flickering glow under each flame tongue, instead of rising to the top like soda bubbles. Follower: burns the whole time the pointer is on the note, also while it rests.
  - *Embers* (follower): keeps glowing at a resting pointer (7 a second), like a tiny campfire.
  - *Digital ocean* (follower): new, in one of three versions on the picks page (`PICK.ocean`: `ripples` default, `patch` = a little window of the dot sea under the pointer, `surf` = a wave of dots that curls over and breaks into spray).
  - Followers can have `leave()` (the Layer calls it when the pointer leaves the note): fel and embers stop burning; `busy()` stays true while the pointer is on the note.
  - `COSMO_FX.PICK` holds the versions the owner is choosing between; the app uses the defaults until a pick is made.
- **Second round of the owner's notes (still 1.1.22):**
  - *Snow* (mouse interacts): a flake the pointer touches shatters: its six arms break off and tumble away the way the pointer went, with a puff of powder, and fade; a new flake starts at the top. (Replaces blowing flakes aside.)
  - *Fireflies* (mouse interacts): the ones within 150 px get curious and follow the pointer for 2.5–4.5 s, hovering round it like the Fireflies mouse effect, then lose interest, fly off away from it and ignore it for 10–16 s. (Replaces circling / fleeing.)
  - *Digital ocean* (follower): the owner picked **Surf**; Ripples and Little ocean removed, `PICK.ocean` gone.
  - *Analog monitor* (follower): the scanline afterimage removed; three new versions on the picks page (`PICK.glitchMouse`: `scope` default = an oscilloscope beam trace in phosphor green, `vhs` = a VHS tracking band of jumping noise lines with colour bleed, `triad` = red / green / blue phosphor stripes light up on a grid where the pointer passes).
  - *Healing aura*: Light columns (`veil`) now evenly spaced and overlapping (no random gaps), gold every third, with a slow wave running along; two new mixes of breathing and columns: `breathcols` (columns breathe together, spreading from the middle) and `breathrise` (breathing glow; soft light lifts off it with each breath in). Five versions on the picks page.
  - *Ghost jellyfish* shine (`glow`, and `sling`), third round: every dot lights up now, not only some (the old shimmer switched colour on half of them). The shine starts where the pointer first touches it and spreads over the whole jellyfish as a wave with a bright edge (`src`, `wave`, about half a second), then all of it glows with a soft shimmer. Slingshot made gentler: the twin stretches out only half as far as the pointer goes (at most 0.6 × the jellyfish's size), and once let go it starts at up to 110 px/s and slows fast (`.08^t`), so it travels at most ~45 px and fades in 2.2 s.
  - *Ghost jellyfish*: a third version, `sling`: it shines like `glow`, and a violet twin is pulled out of it from where the pointer first touched; when the pointer leaves the jellyfish the twin is let go (speed = 0.2 × the pointer's + 0.6 × how far it was pulled, at most 90 px/s), slows down and fades over 3 s.
- **Renamed** the switch "Mouse plays with the background" to **"Mouse can interact with the background"** (note Effects, Settings → Effects → Choose…, Edit design).
- **Menus no longer snap from far away** (the owner: moving a big menu 5 px made it clip to the note's side). `snapInk` (main.js): the old test `near(d, size)` accepted `-size/2 < d < INK_SNAP`, so a menu overlapping the note's edge by up to half its own width still docked. Now `near(d)` = `-INK_SNAP < d < INK_SNAP` (12 px each way): it only docks when its edge is within 12 px of the note's edge.

## 1.1.26 – 26 October 2026 (was 1.1.21)

- **"Mouse plays with the background"** (the owner's request: "make the mouse interact with the background… be creative for all the effects"), its own version as the owner asked. A new switch in the note's Effects pop-up (`#fxInteract`, next to "Pause effects on this note"), in Settings → Effects → Choose… for all notes (`#fxInteractAll`) and in the list's Edit design sheet (`#editFxInteract`). Settings `fxInteract` (default **on**; `settings:set`, `fxSettings()`), note `fx.mi` (true / false / null = same as all notes; `cleanFx`; not an edit, copied by Duplicate). `COSMO_FX.resolve` returns `interact` (a note's own wins, except with "use on every note").
- How: `Layer.move` now also tracks the pointer for the background (even without a follower): `ptr = { x, y, vx, vy, sp }` (speed in px/s, smoothed; it slows down when the mouse rests and is dropped when the mouse leaves). `Layer.tick` calls `eff.step(dt, t, m)` with `m = ptr` while the switch is on and the mouse is over the note, otherwise `null`. `Layer.set({ interact })` only changes that, never remakes the effect. New helpers `near`, `shove` (push a speed away from the pointer and along its way) and `nudge` (the same for a position).
- What each background does: **Snow** flakes are blown aside and carried along; **Fireworks** touching a rocket sets it off early, sparks are blown about; **Stardust** stars near the pointer shine out bigger; **Fireflies** drift over to a slow pointer and circle it, a quick move scatters them; **Bubbles** pop when touched; **Autumn leaves** and **Confetti** are tossed about and spin; **Hearts** swell, beat and hurry up; **Rain** drops hit the pointer like an umbrella and splash off it; **Matrix** a new stream starts where the pointer goes and the code under it scrambles; **Rainbow** glitters in its own colours where the pointer touches the drawn bow; **Plankton** lights up and is stirred where the pointer passes; **Warp speed** steers: the stars fly out from the pointer; **Network** the pointer is a node, nearby points lean towards it; **Embers** fanning the fire low on the note stirs up more sparks and blows them about; **Cherry blossom** petals are blown and flip, a quick swirl whips up a little whirlwind; **Night sky** stars near the pointer light up, a quick flick throws a shooting star; **Analog monitor** the refresh bar chases the pointer and the scanlines under it brighten; **Digital ocean** a swell rises under the pointer; **Silk waves** the ribbons are drawn towards it; **Glass shards** are knocked away and set spinning (then drift back to their calm pace); **Ghost ripple** the pointer is a second ghost; **Fish** dart away; **Solar system** the pointer pulls comets, a quick flick throws a new one; **Dust in light** the pointer stirs the dust into swirls and it sparkles there; **Healing aura** motes float over to the pointer and it sends out rings of its own; **Lightning** bolts strike at the pointer (and a little more often while it's over the note); **Cauldron** stirring near the potion makes it bubble there, touching an orb pops it; **Ghost jellyfish** shies away and the sea-glow parts; **Fel fire** the flame under the pointer flares up and the flames lean away as it sweeps past; **Aquarium** fish turn away when it comes in front of them, the tetras scatter, bubbles pop.
- Measured in Chromium with the pointer moving on a normal note at "Often": every background stays at what it cost before (most 0.02–0.45 ms a frame; Fish ~0.7 and Rainbow ~1.7 as before).
- Tests: `tests/v1121.test.js` (choosing rules, settings saved and sent to notes, a note's switch not an edit and duplicated, the layer passes the pointer with its speed only while on, every background with a moving pointer on three note sizes and both papers without NaN, bubbles pop, rain splashes, ghost ripple).

## 1.1.25 – 26 October 2026 (was part 2 of 2 of 1.1.20)

Colour and see-through in the Effects pop-up, menus that stay open, and Edit design in the list.

- **Colour and see-through in the note's Effects pop-up** ("to mix and match"): the same swatches (`#fxColors`, copied from `#colors` at start-up) and a See-through slider (`#fxOpacity`) at the top, in `.fxlook`; both stay in step with the ⋯ menu's. The pop-up can be 440 px tall (was 360).
- **Menus on a note no longer close each other** ("don't auto close menus just because another has opened"): opening the ⋯ menu, Effects or Add leaves the others open, the newest (or the one clicked) on top (`toFront`). Each closes with its own button / X (`closePop(id)`), Esc or a click in the note still closes them all, and a new **close-all** button in the top bar (`#btnCloseAll`, left of ⋯; shows when two or more of ⋯ / Effects / Add / the text toolbar are open) closes them all, text toolbar included. The small dialogs (password, link, questions) still replace each other. `openPopId` is gone; `syncPops()` keeps `body.pop-open` and the button right.
- **Weaker sticking** for toolbars and menus dragged out of a note: `INK_SNAP` 12 px (was 40), so they only stick to a side when really close.
- **Switches sit right after their text** (they were pushed to the far right): `.check.switch` (note) and `.row.toggle` (list) are now grids with the text column `fit-content(240px / 460px)`; switches one after another are wrapped in `.switches` at start-up (`groupSwitches`), a grid with CSS subgrid, so they still line up under each other.
- **Edit design** (notes list, right-click; was "Edit…"): besides title and colour, a See-through slider and the note's own effects (Background / Mouse tabs with "Same as all notes", None and every effect; frequency, opacity, "Mouse plays with the background" from 1.1.21). The paper at the top previews the colour and the effects live (`#editFxCanvas`, its own `Layer`; move the mouse over it for the follower). `list:edit` now also takes `opacity` (0.25–1, 5 % steps; the open window changes at once) and `fx` (`cleanFx`); neither counts as an edit. `list:get` sends each note's `opacity`.
- Tests: `tests/v1120.test.js` (removed ids everywhere, followers in the same order with the same names and icons, every follower on three sizes, three frequencies and both papers without NaN and quiet after the mouse stops, companions, Edit design's `list:edit`, the 12 px snap); `v1115`/`v1116`/`v1117`/`v1118` updated (closer drops for sticking, `mi` in a note's `fx`, the removed ids).

## 1.1.24 – 26 October 2026 (was part 1 of 2 of 1.1.20)

Four effects removed, and a mouse follower for every background.

- **Removed** at the owner's request: `fairy` (Fairy dust), `xp` (XP orbs), `tunnel` (Neon tunnel) and `synthwave` (Synthwave), with their colours (`fairy`, `fairyCore`, `fairyHead`, `xp`, `xpText`, `tunnel`, `tunnel2`, `sunTop`, `sunBot`, `horizon`) and icons. A note or Settings that still has one saved shows the effect for all notes, or none (`resolve` / `cleanFx` ignore unknown ids).
- **A mouse follower for every background** ("when I switch between the Background/Mouse tabs, they stay exactly the same, except for Pencil line"): 20 new followers, with the same id, name and icon as their background (`PAIRS` and `FOLLOWER_IDS` are now worked out from `EFFECT_IDS`; `frost` = Snow and `ripples` = Rain keep their old ids), Pencil line last. Each is a small cousin of its background: **Plankton** glowing specks stirred up behind the pointer; **Warp speed** stars streak away behind it; **Network** points dropped along the way, joined to each other and to the pointer; **Embers** sparks fly up, cooling yellow → red; **Cherry blossom** petals flutter down; **Night sky** the pointer is a shooting star leaving twinkling stars; **Analog monitor** short scanline afterimages; **Digital ocean** a bobbing wake of dots; **Silk waves** three glittering ribbons weave behind it; **Glass shards** pieces of glass fall, turning in 3D; **Ghost ripple** a field of dots shows up around the pointer and parts around it; **Fish** a little school circles the pointer; **Solar system** the pointer is a tiny sun with 2–4 planets; **Dust in light** a soft beam follows the pointer and the dust it stirs sparkles in it; **Healing aura** motes and crosses float up, with rings; **Lightning** little forked bolts crackle along; **Cauldron** potion bubbles rise and burst into droplets, stars and steam; **Ghost jellyfish** a dotted jellyfish follows in pushes; **Fel fire** green flames lick up; **Aquarium** a clownfish with neon tetras follows, bubbles rise. Fish, Solar system, Ghost jellyfish and Aquarium are companions (`presence()`): they show while the mouse moves and fade away 2.5 s after it stops (a follower may now have `fade()`; `Layer` multiplies its opacity by it), so the loop can still sleep. Every follower measured at 0.01–0.5 ms a frame (normal note, "Often").
- Shared drawing moved out of the effects so the followers can use it: `fishHw` / `fishSpine` / `fishBody` / `fishFins` / `fishBend` / `fishNew` / `fishDraw` (Fish), `aqKit` (the Aquarium's fish), `zig` (Lightning); new helpers `bucketSegs`, `presence`. The backgrounds look exactly the same.

## 1.1.23 – 25 October 2026 (was 1.1.19)

- The owner didn't like the look of Fish, so a "Fish Picks" preview page showed four new fish backgrounds on the real engine: Koi pond, Aquarium, Silver shoal and Doodle fish. The owner picked **Aquarium**, and asked for the current Fish to stay but look better ("the triangle should move better behind them; it's too obvious it's just a shape").
- **New background `aquarium` (Aquarium)**, added at the end of `EFFECTS` / store.js `FX_EFFECTS` (saved choices keep their place), with a picker icon and light/dark colours (`aq` in `LIGHT` / `DARK`): a tank seen from the side. 1–2 clownfish (more on big notes), an angelfish and (not on small list cards) a blue tang swim to and fro at their own depths and turn round now and then (the body squeezes edge-on through the turn: `scale(face, 1)`); a small group of neon tetras (6, at most 14) follows a hidden leader; tapered seaweed ribbons sway along the bottom; bubbles rise from a corner and fish now and then let out a "blub". About 0.15–0.17 ms a frame on a normal note.
- **Fish redrawn** (same id, name, colours and flocking): the oval + triangle is replaced by a fish drawn along a short spine (5 points that follow the head, so the body bends when it turns), with a swimming wave running down to the tail; a tapered body (round head, slim tail end); a forked tail that swings a beat behind the body, its tips lagging a little more; two paddling side fins; a soft sheen along the back; and two tiny eyes (new colour `fishEye`). The tail beats faster when the fish hurries (when startled). Still one fill per colour for the fins and one for the bodies (7 fills a frame however many fish), about 0.15–0.18 ms a frame (was ~0.11).
- Tests: `tests/v1119.test.js` (Aquarium is last in both lists, has a name and icon; Aquarium and Fish run on light and dark paper on a small card, a normal note and a big note at "Often" without NaN; every colour exists on both papers; Fish stays at 7 fills a frame). `v1118.test.js` now only checks that its own 23 ids come right after the first eleven.

## 1.1.22 – 25 October 2026 (was 1.1.18)

- **23 new background effects**: 18 from the Effect Lab (22 picked; Lorenz, Shape shifter, Contour map and Black hole were taken out again in the second round below) and 5 magic ones from the Spell Lab (third round below), chosen by the owner from three batches of previews (two versions of each idea, on note-sized canvases with the real engine) in the "CosmoNotes Effect Lab" page. New ids in `src/fx.js` `EFFECTS` and store.js `FX_EFFECTS`, after the old ones, each with a picker icon (`ICONS.effect`) and light/dark colours in `LIGHT` / `DARK`:
  - `plankton` **Plankton** (lab: Bioluminescent plankton B, "Breaking wave"): specks rest almost dark; an invisible wave rolls across every few seconds and lights them up, then the glow fades.
  - `fairy` **Fairy dust** (Magical spell particles B): a bright fairy loops around leaving pastel sparkles.
  - `warp` **Warp speed** (Hyperspace B, "Warp jump"): a slow cruise of about 30 s, then the stars stretch into blue streaks at light speed for 3 s with a soft flash, then calm again (`starfield()`).
  - `network` **Network** (Constellation network A, "Living web"): drifting points joined by fading lines.
  - `embers` **Embers** (Floating embers A, "Campfire"): sparks rise from a warm glow, cool from yellow to red, sometimes pop.
  - `blossom` **Cherry blossom** (B, "Gust whirls"): flipping petals; little whirlwinds lift them into spirals.
  - `nightsky` **Night sky** (A, "Twinkle & shooting stars"): a shooting star about every 12 s (10–14 s, whatever the note size or frequency; the frequency changes the number of stars).
  - `glitch` **Analog monitor** (Glitch fragments B, "Glitch storm", without the glitch): faint crawling scanlines and a soft refresh bar rolling down like an old screen; "Often" adds a second, slower bar. The id stays `glitch` so saved choices keep working; colour `scan` (was `glitchInk`), new monitor icon.
  - `ocean` **Digital ocean** and `silk` **Silk waves** (Particle wave field A and B, both kept).
  - `shards` **Glass shards** (Prismatic shards A, "Glass drift").
  - `xp` **XP orbs** (Floating loot B): orbs zoom into a collector that pops with "+XP".
  - `ghost` **Ghost ripple** (Invisible ripple field B, "Passing ghost"): a field of dots parts around something invisible and wobbles back.
  - `fish` **Fish** (Boids A, "School of fish"): flocking (`flockStep`: separation, alignment, cohesion), startled now and then.
  - `solar` **Solar system** (Orbital mechanics A): sun, four planets, a moon, a comet swinging by about every 20 s (17–23 s, any size or frequency).
  - `tunnel` **Neon tunnel** and `synthwave` **Synthwave** (Infinite retro tunnel A and B, both kept).
  - `dust` **Dust in light** (Volumetric dust A, "Light shafts").
- Left out (not picked): soap bubbles, magnetic field, pixel confetti, smoke wisps, circuit pulses, and the other version of each idea above.
- New fx.js helpers: `clamp`, `capped` (a count with a hard upper limit, so big notes or "Often" never get out of hand), `glow2`, `flow` (a cheap smooth wind field), `wrap`, `hsla`, `strokeSegs` / `bucketDots` (many lines or dots in a few draw calls, no `Path2D`, so the tests' fake canvas still works), `starfield`, `petal`, `shard`, `flockStep`, `dotLattice`.
- Some of the new effects use more shapes than the first eleven (up to ~150–260 dots, always capped), but each still costs well under a millisecond a frame in Chromium (measured), and the shared loop, pausing and opacity work exactly as before. No mouse followers were added.
- Tests: `tests/v1118.test.js` (every new effect has a name and an icon, runs on light and dark paper, on a small list card and a big note at "Often", and never puts NaN into what it draws).
- **Second round (same version, the owner's changes after trying them):**
  - **Removed:** `lorenz` (Lorenz), `morph` (Shape shifter) and `topo` (Contour map), with their colours (`attr`, `morph`, `topo`/`topoHi`), icons, `MORPH_SHAPES`, `terrain` and `contours`. A note or Settings that still has one of them saved simply shows the effect for all notes, or none (`resolve` and `cleanFx` already ignore unknown ids).
  - **Warp speed:** cruise 30 s (was 3.6), speed up 1.2 s, light speed 3 s (was 2.2), slow down 1.2 s.
  - **Night sky:** shooting stars `every(10, 14)` with no size/frequency factor (was `every(3.5, 8, k)`, which on big notes at "Often" was about one a second).
  - **Solar system:** comets `every(17, 23)` with no size/frequency factor (was `every(8, 14, k)`).
  - **Glitch → Analog monitor:** the glitch bursts are gone; only the scanlines and the rolling refresh bar are left (renamed, new icon).
  - **Contour map:** first made about 3–4× lighter (lines worked out 10×/s on a coarser grid, only the levels crossing each square), then removed at the owner's request: it was still the most processing-hungry kind of effect.
  - **Black hole removed:** an Interstellar-style particle version was tried (Gargantua, Doppler, Lensed stars; previews in "Black Hole Picks"), but the owner found it too heavy for the engine; after also seeing three simpler dotted options, the owner chose to drop the black hole altogether (`blackhole`, its colours `disk`/`hole`/`ring`/`jet`, its icon and the `mixHex` helper are gone).
  - Tests: `v1118.test.js` also checks the removals, the Analog monitor drawing only its scanlines, a shooting star about every 12 s even on a big note at "Often", and warp's ~3 s of light speed.
- **Third round (same version): five magic backgrounds**, picked by the owner from two rounds of previews in a new "Spell Lab" page (first ten spell ideas, then a second round with redone and new ones, some inspired by a brainstorm the owner shared about "magic with a mind of its own" and some by MMO spell looks). All dots and a few lines, 0.03–0.2 ms a frame:
  - `heal` **Healing aura**: soft rings of light ripple out from the bottom every ~2 s while green and gold motes and little crosses float up.
  - `lightning` **Lightning**: a stormy glow at the top; every few seconds a forked bolt (midpoint displacement, two branches) cracks down with a quick flash, flickers and fades; faint static sparks between.
  - `cauldron` **Cauldron**: a wobbling potion surface near the bottom (teal or acid green, picked each time it starts) with steam curling up in soft columns from three vents; bubbles swell out of the surface as glowing domes and burst with a splash of droplets and a puff of coloured steam; every few seconds one breaks free as a glowing orb with a turning swirl, then pops into tiny stars (now and then one stops and sinks back in). Deliberately unlike the Bubbles effect.
  - `jelly` **Ghost jellyfish**: faint sea-glow motes drift up; every few seconds a jellyfish made of dots swims across in little pushes, bell pulsing and tendrils trailing, leaving glowing dots behind, then dissolves.
  - `fel` **Fel fire**: eerie green flame tongues flicker along the bottom; now and then one flares up taller, throwing sparks.
  - New colours `heal`, `healHi`, `lightning`, `lightningHi`, `brew`, `brewHi`, `steam`, `sea`, `fel`, `felHi`; new icons. `v1118.test.js` covers them like the others and checks the black hole is gone.

## 1.1.21 – 25 October 2026 (was 1.1.17)

- **Opacity for effects and mouse followers:** an **Opacity** slider (10 % – 100 %, 5 % steps) under each Frequency row, in the note's Effects pop-up (`#fxEOp` / `#fxFOp`, one per tab) and in Settings → Effects → Choose… (`#fxAllEOp` / `#fxAllFOp`). Dragging shows the change straight away (on the note, or on the cards in the list); it's saved when the slider is let go, or 300 ms after it stops moving. In a note the sliders are greyed out while Settings uses the same effects on every note. The Settings summary shows it, e.g. "Snow (more, 40%)".
- Settings `fxEffectOpacity` / `fxFollowerOpacity` (default 1; `settings:set` takes them through `cleanFxOpacity` and broadcasts `settings:changed`; `fxSettings()` sends them to note windows). Note `fx.eo` / `fx.fo` (null = same as all notes; `cleanFx`; not an edit, copied by Duplicate). `COSMO_FX.resolve` returns `effectOpacity` / `followerOpacity` (a note's own wins, except with "use on every note"); `COSMO_FX.opacityOf` = the same cleaning as store.js.
- **How it's drawn:** `Layer.set({ effectOpacity, followerOpacity })`. `fadeable(ctx)` wraps the canvas context's `globalAlpha` so everything an effect or follower draws is multiplied by its opacity: no extra canvas or drawing pass, and the effects themselves are unchanged. Changing the opacity only redraws; it never restarts the effect. The note's Effects pop-up can be 360 px tall (was 330) for the extra row.
- Tests: `tests/v1117.test.js`; `v1116.test.js` expects `eo` / `fo` in a note's `fx`.

## 1.1.20 – 25 October 2026 (was part 3 of 3 of 1.1.16)

The owner’s third round of feedback, and small fixes.

- **Third round of changes (owner's feedback):**
  - **Fixed the text toolbar:** an old note.css rule (1.1.9 section) had lost its selector, so the browser also dropped the rule after it, `#textPop.tbar` (250 px wide, bottom-left, no max-height). The toolbar was as wide as the note, and outside the note `.pop`'s `max-height: calc(100vh - 48px)` squashed it to its grip. Leftover removed.
  - **Sliding past corners:** a toolbar stuck to a side can slide along it past the note's corners; `inkSpot` only keeps `INK_TOUCH` (16 px) of it next to the side (it used to clamp the offset between the corners). Further out it comes loose as before (`snapInk`).
  - **⋯ menu and Effects pop-up movable, also outside:** same top bar as the toolbars (`.igrip` + X). `movable(el, { handle: '.igrip', top: true })` (dragged only by the grip; placed from the top, `{ r, t }`), `barOut` kinds `menu` (`cosmoMenuBar`, its window is focusable for the title field; Esc there closes it) and `fx` (`cosmoFxBar`); `popOuts` in note.js; `openPop` starts them, `closePops()` stops them; a click in the note (`closePops(true)`) leaves one that's outside open. `barOut` keeps a pop-up's width when it goes out (it came from the note's size). main.js `BAR_FRAMES` / `BAR_KINDS` / `BAR_TITLES`; `barKind` accepts all four.
  - **A note's play wins over "pause all":** new note field `fxPlay` (`EDITABLE`, `list:get`, not an edit). `resolve(noteFx, settings, notePaused, notePlay)`: paused = own pause, or all paused and not `fxPlay`. note.js `setFxPlaying` (button and switch): playing while all are paused sets `fxPlay`; pausing sets `fxPaused` (or just clears `fxPlay`). The switch is never greyed out any more.
  - **Background frequency:** `EFFECT_AMOUNTS` .18 / 1 / 3.6 (followers keep `AMOUNTS` .35 / 1 / 2.6). Each tab of the Effects pop-up has its own Frequency (background / mouse); Settings → Effects has both.
  - **Same names and icons:** followers are called like their backgrounds (frost = Snow, ripples = Rain, comet = Rainbow, hearts = Hearts…; ids unchanged), `PAIRS` gives them the background's icon, and `FOLLOWER_IDS` puts each where its background is: frost, fireworks, stardust, fireflies, bubbles, leaves, hearts, ripples, confetti, matrix, comet, pencil. **New Fireworks follower** (`fireworks`): small uneven bursts behind the pointer. The rainbow background is coming (owner is choosing from 3 previews; `ICONS.effect.rainbow` is already there).
  - **Theme:** pop-ups, toolbars and the right-click menu use the notes list's theme (`appTheme` in the note settings, `body[data-apptheme]`, sent again when `listTheme` changes). New variables `--pop-ink2`, `--pop-card`, `--pop-pick`, `--pop-pickfg`, `--pop-danger`, `--pop-hover` replace fixed colours.
  - Tabs row of the Effects pop-up goes all the way to the right.
  - **Fireworks reach the top of tall notes:** each rocket gets just the speed it needs (`sqrt(2·a·distance)`) to reach its bursting height (8–55% from the top); before, they ran out of speed around 300 px up. Bursts on big notes may be bigger (`scale` up to 1.8). Peony sparks spread evenly (no ring look).
  - **Picking a mouse follower no longer restarts the background** (and the other way round): `Layer` makes them separately (`makeEffect` / `makeFollower`); `set()` only remakes the one that changed.
  - **Rainbow background** (`rainbow`, the owner's pick "Anywhere, slowly"): a slice of a huge arc (a circle through two points just outside the left, bottom or right edge, bulging upwards) draws itself in from one end over 4.8 s like a progress bar, stays 3 s, fades as a whole over 2.6 s, then a new path (`WAIT` shorter with "Often"). Seven bands (`RAINBOW_HUES`), each one stroke with a conic gradient for its strength along the arc (ends fade in slowly and stay faint: `pow(smooth(min(u, 1-u) / .38), 1.6)`), on a canvas of its own, blurred 1.4 px. Bands about 20% wider than the preview (`max(4, w / 71)`). 1 in 20 times a double rainbow.
  - **Rainbow background, smoother and no gaps (later):** each bow is now painted solid first (bands overlap 1.2 px, so no seams or see-through lines) and its strength along the arc is applied in one go with a `destination-in` conic mask (120 stops, was 40) on a second small canvas, instead of one translucent stroke per band. The drawing-in front is a longer soft edge (`FRONT` .2) and growth eases in and out (cosine) so it starts and stops gently, blur 1.6 px. The second bow of a double rainbow is the same width and spacing as the first (same band size, 9 bands further out), colours reversed, just fainter (62%) and starts a little later, so it looks like part of the same rainbow.
  - **Rainbow follower: the original thin colour-changing line is back** (owner: "i hate it, bring back the regular rainbow mouse"). The speed-based ribbon and the separate "Rainbow line" (`comet`) are gone: `rainbow` is that line again, in the Rainbow place (same icon as the background), so followers are: … matrix, rainbow, pencil. An old saved `comet` choice counts as `rainbow` (`OLD_IDS` in fx.js `resolve`, and `cleanFxId` in store.js). (The next line describes the speed-based version that was dropped.)
  - **Rainbow follower, dropped (was):** a ribbon as wide as the pointer is fast (smoothed speed → `widthFor`: ~60 px/s a thin line, 750 px/s and more 42 px wide), getting thinner as it fades. Every point keeps the position, direction and width it was laid down with (earlier tries re-smoothed the whole trail each frame, which made it "readjust", or followed on a spring, which lagged). Quick moves are filled in between, a jump starts a new piece. Picked by the owner as a mix of two previews (painted ribbon + light streak).
  - **New Rainbow follower** (`rainbow`, paired with the coming rainbow background): a wide, soft ribbon of seven bands that stay in place along the trail, drawn as quads between smoothed normals on a small canvas of its own, blurred a little, the tail fades and thins over ~1.5 s. The old colour-changing line (`comet`) is now **Rainbow line**, next to the pencil line, with its own icon again. Order: … matrix, rainbow, comet, pencil.
- **Right-clicked card outline:** the card whose right-click menu is open gets `.ctxon` (list.js `showCtx` / `hideCtx`): the Ctrl+click outline, thinner and fainter, without the tick.
- **X always visible in a small note:** a pop-up that scrolls (⋯ menu, Effects) keeps its X at the top right (note.js `pinX`: moved down by `scrollTop`, `.ix.pinned` gets a backing). The text and drawing toolbars never go past the note's top (`movable` → `fitIn`: moved down; taller than the note → `.fit-tall`, scrolls, X pinned too); re-placed when their size changes (`ResizeObserver`).
- Tests: `tests/v1116.test.js` (ids match between fx.js and store.js, the choosing rules, every effect and follower runs, settings + broadcast, a note's own choice is not an edit and is copied, use-on-every-note keeps it, pause from Settings and the tray). The fake Electron keeps the tray (`__tray`).

## 1.1.19 – 25 October 2026 (was part 2 of 3 of 1.1.16)

The owner’s second round of feedback on the effects.

- **Second round of changes (owner's feedback):**
  - Labels: "How much" → **Frequency**, Less / Normal / More → **Rarely / Normal / Often** (same values `low` / `mid` / `high`). `AMOUNTS` = .35 / 1 / 2.6 (was .5 / 1 / 1.8) so the difference shows; `every()` now allows ×0.2–×4 (was ×0.5–×2) and `spacer` up to 8 shapes per mouse move (was 4).
  - **Fireworks:** the round (perfect circle), ring and crackle (little second bursts) kinds are gone. Now peony (uneven: each spark its own speed and a slightly bent angle), willow (gold, drooping trails), glitter (twinkling cloud) and palm (a few uneven arms). Rockets lean (`vx`), slow as they climb and burst near the top; sparks slow in the air (`drag`) and fade more slowly (1.6–3.3 s).
  - **Follower order** = background order: `FOLLOWER_IDS` (and store.js `FX_FOLLOWERS`) frost, comet, stardust, fireflies, bubbles, leaves, hearts, ripples, confetti, matrix, pencil. Ids unchanged, so saved choices stay. "Sprinkles" is now called **Confetti**.
  - **Matrix follower:** only letters where the pointer went, on the background's grid, flickering and fading from a pale head to green (no more dripping streams).
  - **Effects pop-up smaller:** top-right like the ⋯ menu, at most 330 px tall, tabs Background / Mouse (`#fxTabs`, `.fxsec`, `fxTab()`), compact two-column rows, no tick (the picked row is shaded).
  - **Text toolbar with nothing selected changes only what you type next** (the browser's typing style, so several buttons add up; it ends when the cursor moves). `onText` no longer selects the whole note, and doesn't put the cursor back when it's already there (that would forget the typing style: `caretIsSaved`). The font buttons work the same way now (no more changing the note's own font from here). Normal colour = sentinel `#010203`, cleaned off right away for a selection and after typing (`cleanResetColor` on `input`). Clear formatting with nothing selected = plain from here on (bold/italic/underline/strike off, normal colour, no highlight, normal size, the note's font). `#tScope`: "selected text" / "what you type next". **Black** text colour (`#1B1B1B`); the colour dots are 23 px so 8 fit.

## 1.1.18 – 25 October 2026 (was part 1 of 3 of 1.1.16)

Effects in the background of a note, and mouse followers.

- **Note effects and mouse followers** (new `src/fx.js`, loaded by note.html and list.html before their own script; `window.COSMO_FX`). Effects behind the writing: snow (big flakes, more and smaller), fireworks (classic rockets with four kinds of burst, round / ring / willow / crackle, never the same kind twice in a row, more often and sometimes two or three at once), stardust (brighter twinkles with a glow and rays), fireflies, bubbles (pop), autumn leaves, hearts, rain (drizzle), confetti. Mouse followers: stardust (falling sparkles), comet (rainbow ribbon), hearts (puffs), bubbles (popping), fireflies (swarm), ripples (water rings), frost (crystals), confetti (sprinkles), leaves (autumn), pencil (line). Picked by the owner from a preview page; shooting stars were dropped.
- **Light by design:** a handful of shapes (counts scale with the note's area, `k`), drawn by ONE shared `requestAnimationFrame` loop at most 30 times a second, which stops itself when no layer `wants()` frames (no effect, paused, rolled up, off screen, or only a follower and the mouse is still). Canvases use at most 2× pixel ratio.
- **Choosing:** settings `fxEffect`, `fxFollower` (the choice for all notes), `fxForceAll` (use it on every note; each note's own choice is kept and comes back when switched off), `fxPaused` (pause all). Note fields `fx: { e, f }` (`cleanFx`: null = same as all notes, 'none' = nothing, or an id from `FX_EFFECTS` / `FX_FOLLOWERS` in store.js, which must match fx.js) and `fxPaused`; both in `EDITABLE`, not edits, `fx` copied by Duplicate. `COSMO_FX.resolve(note.fx, settings, note.fxPaused)` decides what shows. main.js `fxSettings()` is part of `noteSettings()`; `settings:set` takes the four keys and broadcasts `settings:changed` to note windows; tray menu **Pause effects** (`setFxPaused`, rebuilt with `buildTray`). `list:get` sends each note's `fx` / `fxPaused`.
- **Note window:** `#fxCanvas` (first in `<body>`, `position: fixed; z-index: -1`, so it's under everything but over the paper, which is the page background), hidden while rolled up. Follower fed from `pointermove` on the document. ⋯ menu → **Effects…** (`#miFx`, shows what's on) opens the pop-up `#fxPop`: tiles for "Same as all notes" (named), None and every effect / follower, each with a still picture on the note's own paper (`COSMO_FX.thumb`), a note when Settings uses the same on every note, and "Pause effects on this note". Top bar: sparkle button `#btnFx` (only when something is on; hidden below 280 px) pauses / plays this note.
- **Notes list:** cards show their note's effect (a canvas `.fxc` as the card's first child, z-index -1 inside `.card { isolation: isolate }`), the follower trails the mouse over the card; only cards on screen draw (`fxIO`). `paintFx()` runs after `paintCards()`. Settings → **Effects** panel: what's chosen for all notes, **Choose…** (pop-up `#fxSheet` with the tiles, on Lemon paper or Midnight in a dark theme, and "Use these on every note"), and **Pause all effects**.
- **Pickers are lists:** an icon (`COSMO_FX.ICONS`, coloured per effect) and the name for each choice (`.fxlist` / `.fxi`, names wrap), in both pop-ups; "Background of a note" instead of "Behind the writing". The still pictures (`thumb`) were dropped.
- **How much (Less / Normal / More):** `.fxamt` buttons under each list. Settings `fxEffectAmount` / `fxFollowerAmount`, note `fx.ea` / `fx.fa` ('low' | 'mid' | 'high', null = same as all notes; `FX_AMOUNTS`, `cleanFx`). `COSMO_FX.AMOUNTS` = .5 / 1 / 1.8: effects multiply their counts and how often things start by it (the `k` they already scale by); followers spawn that much more often (`spacer(gap / k)`), and the swarm / tails grow with it. `resolve` returns `effectAmount` / `followerAmount` (a note's own amount wins, except with "use on every note").
- **Pause button left of Settings** in the notes list (`#btnFxPause`, sparkle icon, crossed out while paused; `paintFxPause`).
- **Matrix** (effect and follower, id `matrix`, picked from a preview page: "The film" and "Code trail"): the digital rain, half-width katakana + digits + a few symbols (`GLYPHS`), drawn mirrored (`mirror()` flips the canvas once), phosphor green `#00FF41` with a pale head on dark paper, deep green on light paper (palette `code` / `codeDim` / `codeHead`). The film's font (Matrix Code NFI) is free for personal use only, so it isn't bundled: `CODE_FONT` uses it if installed, else Windows' Japanese fonts (MS Gothic, Yu Gothic, Meiryo). Effect: a stream in most 14 px columns (`.75 × k^.6`), speed / length random, characters change as they fall (`drawStream`). Follower: short streams that drip down from the pointer.
- **Resizing a note no longer restarts its effect over and over:** `Layer.resize()` resizes the canvas and keeps the running effect (clipped, or with some room) and only makes it again for the new size 300 ms after the resizing stops (`rebuildTimer`, `bw`/`bh` = the size it was made for).
- **Text toolbar outside the note**, like the drawing toolbar: note.js `inkOut` became `barOut({ el, kind, frame, title, key, mover })`, used for both (`inkOut`, `textOut`; window names `cosmoInkBar` / `cosmoTextBar`, remembered in `localStorage.inkBarOut` / `textBarOut`). The text toolbar's window is made when it opens and closed when it closes (A, its X, locking). `$`/`$$` search every outside window (`outDocs`). main.js keeps one window per kind (`win.inkWin/inkOut/inkState`, `win.textWin/textOut/textState`; `BAR_FRAMES`, `barKind`); `placeInk`, `inkSpot`, `inkBarOptions` take the kind, `showInk(win, on)` without a kind does both (rolled up, pinned). The `ink:*` messages carry `bar: 'text'` for the text toolbar (`ink:hide` takes it as its argument; preload `ink.hide(bar)`). note.css `body.inkbar-out #textPop.tbar`.

## 1.1.17 – 24 October 2026 (was part 2 of 2 of 1.1.15)

The Locked tab, the drawing toolbar outside the note, and small fixes.

- **Locked tab** (`tab = 'locks'`, after Favourites, padlock icon `.tlock`, count `#cLocks`): every note with its own lock and every locked group (`lockedOnes`, like `favourites`); ones inside an unopened locked group are counted in `#tip`. Bar `#lockBar`: **Unlock all…** asks the password once (IPC `list:unlock-all`) and sets `listUnlockedAll` in main: `hiddenInList` and `groupOpenInList` then treat everything as open, so the list shows (and searches) every locked note's words; notes opened from the list don't ask (`list:open-note`). **Lock again** (`list:lock-all`) clears it and `listOpenGroups`, and open note windows that are unlocked save and hide (`note:lock-now`). Closing the list also locks again. `list:get` sends `settings.unlockedAll`. Searching never looks inside locked notes otherwise (the list never gets their words). `cardsTabNow()` = notes, favs or locks.
- **Drawing toolbar outside the note:** dragged past the note's edge, `#inkBar` moves (the same element, so all its buttons keep working) into a small see-through window: note.js `inkOut` opens it with `window.open('about:blank', 'cosmoInkBar')` when drawing starts (hidden; it loads the note's stylesheets and copies the body's classes/data, `body.inkbar-out` in note.css) and closes it when drawing ends. `$`/`$$` also look in that window (`outDoc`). `movable()` captures the pointer on the page (not the button) so a drag carries on across windows, and works in screen coordinates. main.js only allows that exact window for note windows (`hardenContents(wc, { inkBarFor })`, `inkBarOptions`: frameless, transparent, not focusable, `parent` = the note), places it (`placeInk`, `inkSpot`, always on a screen) and snaps it: within 40 px of a side it sticks there (4 px gap) and follows the note on `move`/`resize` (`snapInk`, `watchInkBar`); further away it stays put. IPC `ink:show`, `ink:drag`, `ink:size`, `ink:drop` (pointer on the note = back inside, under the pointer), `ink:hide`. Hidden while rolled up (`setRolled` → `showInk`), on top with a pinned note (`applyState`). Remembered in `localStorage.inkBarOut` (`{mode:'dock', side, off}` / `{mode:'free', x, y}`), so it opens there next time; double-click its grip to bring it back into the corner.
- **Drawing toolbar layout:** the pause button (`#inkPz`, now a "Pause" / "Carry on" pill) and **Clear all** (`#inkClear`, `.iclear`) moved into a bottom row below the tip (`.ifoot`); nothing sticks out of the toolbar any more (its own window has only 12 px around it). `.iwidths` and `.idash` are the same width, so Partial/Whole line and Over/Behind are too (162 px).
- **⋯ menu:** an X at the top right (`#menuX`) instead of the "optional" label; the title field's placeholder says "(optional)".
- **Padlock fix:** a sliver of the shackle's long side showed just inside the body's top line (the clip `#lockClip` only hid the body's inside from y 12, but the line's inner edge is at 11.9 with 1.8 px strokes). Now the shackle is only drawn above y 11 (the middle of that line), so the body always covers its ends; also while it opens and closes (note.html, list.html).
- Tests: `tests/v1115.test.js` (colours, defaultColors, list edit (title/colour only) + sync, Unlock all / Lock again, the toolbar window: allowed only for notes, sticking to each side, following the note, screen edges, rolled/pinned, drop back inside). `groups.test.js` updated ("random" becomes the 7 pastels). The fake Electron got `setWindowOpenHandler` (kept), `hide`, `setParentWindow`, `destroy`, `screen.getDisplayNearestPoint`.

## 1.1.16 – 24 October 2026 (was part 1 of 2 of 1.1.15)

Nine new paper colours, several colours for new notes, and right-click → Edit… in the list.

- **9 new paper colours** from the list themes: `cream`, `rose`, `sage` (the Mint theme), `mist` (Sky), `lavender` (Lilac) and the dark `night`, `midnight`, `forest`, `plum` (store.js `COLORS`, now 17; `DARK_COLORS`; main.js `PAPER`; note.css `body[data-color]` variables and `.sw` swatches; list.css `.card` / `.epaper` / `.sheet` / `.paper` variables; list.js `COLORS`, `SWATCH`, `COLOR_NAMES`). Rules that were only for charcoal now apply to every dark paper (`:is([data-color="charcoal"],…night…midnight…forest…plum)`). The dark swatches get a small dot of their theme's colour so they can be told apart.
- **Colour order** everywhere (the order of `COLORS` in store.js and list.js, and the buttons in note.html): each colour next to its light version, dark ones last: yellow, cream, orange, pink, rose, purple, lavender, blue, mist, mint, sage, green, charcoal, night, plum, midnight, forest.
- **Colour rows scroll sideways** (`swatchStrip`, same function in note.js and list.js): the note's ⋯ menu still shows 8 circles of exactly the same size (`grid-auto-columns: calc((100% - 49px) / 8)`, measured: 23.4 px, same gap and menu size as 1.1.14); the group panel and the selection bar show 8 (24 px). Drag, mouse wheel, or the `.swarr` arrows that appear on a side with more colours; a drag never picks a colour. Settings → For new notes and the Edit sheet don't scroll: all 17 show at once (`.swstrip.wide`), and when the window is too narrow they carry on in a second line, like text (no `swatchStrip` there). The ⋯ menu scrolls the note's colour into view when it opens.
- **Several colours for new notes:** new setting `defaultColors` (list, always at least one, order of `COLORS`; `cleanColors` in store.js). `store.create` picks a random one (`newNoteColor`). `defaultColor` is kept as the first one, for older versions. Old settings move over on load: `"random"` → the 7 original pastels, a single colour → `[it]`. `settings:set` takes `defaultColors` (and still `defaultColor`, incl. `"random"`). Settings → For new notes: a multi-pick row (`.sw.pick`, tick on picked ones; the last one can't be unpicked) and Pick all / Light only / Dark only / Just one (`paintNewColors`, `setNewColors`). The old "random" swatch is gone. New switch **Never the same colour twice in a row** (`#sNoRepeat`, setting `newColorNoRepeat`, on by default): with more than one colour picked, `newNoteColor` leaves out `lastNewColor` (the colour the last new note got, kept in settings.json). Duplicates and the welcome note bring their own colour (`create` only picks one when `partial.color` isn't a real colour), so they don't count.
- **Right-click → Edit… in the list:** sheet `#editSheet` (list.html) with the title (in the note's paper colour) and the colour row. The title saves 350 ms after typing stops, the colour at once (`editQueue` / `editFlush`). IPC `list:edit(id, patch)` takes only `title` and `color` (a new title counts as an edit, a colour doesn't); an open window gets `note:look` and its window title/background follow. While the sheet is open, changes from the note's window show in it (`editRefresh`). `hiddenInList` / `revealedNow` moved out of `list:get` so other handlers can use them.

## 1.1.15 – 23 October 2026 (was 1.1.14)

- **Unlocked in its window = unlocked in the list:** `list:get` shows a locked note's text/picture while its open window is unlocked (`win.revealed`), until the window is closed or locked again; new card field `openUnlocked` → small open padlock (`.ulk`) next to "open". `note:unlock` / `note:relock` now `notifyList()`. When a note gets locked from outside, `hideNewlyLocked` sets `win.lockPending`, so the list hides it at once (before the window has saved and called `note:relock`). Tests: lock-refresh, groups and upgrade tests updated for the new rule.
- **Star is only an overlay:** removed `.card.is-fav .body { padding-right }`, which made pictures on starred cards narrower. Starring plays a stardust burst from the star (`starDust`: a `.stardust.fixed.fast` layer on the page, so the card's edge doesn't cut it off; 15 % quicker than the lock's).
- **Lock button on list cards** (`lockBtn` in list.js, `.lockb`): left of the star, shows on hover; locks / asks the password to unlock (`lockNote`/`unlockNote`/`lockGroup`/`unlockGroup`). A note locked only by its group has none. The star is 10 % bigger (button 33 px, icon 21.5 px).
- **Dashed/dotted lines stay put when erasing:** each piece left by the partial eraser gets `o` (stroke field, kept by `normalizeInk` only with `d`): how far along the original line it starts, used as `stroke-dashoffset` (`strokeEl`). `rubOut` measures it with `cumLengths` along the traced points (+ the stroke's own `o`). A square is now traced exactly like the browser draws it (starting after the top-left rounded corner, rx 4, round corners), and pieces of a dashed square/circle are split where the browser starts the shape (its dash pattern restarts there). An arrow's head pieces stay solid.
- **Lock animation is now "Snap shut"** (option 1 of "Lock animation options.html", replacing 1.1.13's stardust): the padlock drops in with a bounce and its shackle snaps shut (`lkDrop` + `lkSquash` on the svg, `lkSnap` on `.shackle`); unlocking: a copy of the padlock (`.lockfly`) pops its shackle open (`lkOpen`) and floats away (`lkAway`) while the note / card just fades in (`fadeInSoft`, no zoom). Like a real padlock the shackle's long left side always stays in the lock body: the path reaches down to y 16.5 inside the body and is clipped by `#lockClip` (evenodd: everything except the body's inside); it opens by lifting 4.5 px and swinging −16° around that side (`transform-box: fill-box; transform-origin: 0% 100%`). Note window: the lock-screen padlock in note.html, writing blurs away (`.lockghost`, `blurAway`). List: `ICON.lockA` on locked cards / groups, `snapLock()`, `lockCentre()` + `lockPos` remember where each card's padlock was for the unlock copy; `#lockClip` lives in list.html.
- **Text toolbar starts at full strength:** `body.text-fresh` (set by `openText`, cleared by a click in the note, typing, or going back to drawing) overrides the fade.
- **Redo** (`#btnRedo`, right after `#btnUndo`, outside `.tleft`; full strength on hover like Undo). `redoAny()`: while drawing `inkRedo()` (new `inkState.redo` list: `inkUndo` pushes the current drawing onto it, `snapshot()` clears it when something new is drawn or erased, keeping it aside in `redoKept` in case the eraser touched nothing; cleared on locking), otherwise `redoText()`: a font change taken back by Undo (`textRedo`), else the editor's own `execCommand('redo')`. Keys: Ctrl+Y and Ctrl+Shift+Z. `.tb` buttons are 20 px (was 22) below 430 px wide so the bar still fits a 340 px note.

## 1.1.14 – 23 October 2026 (was part 2 of 2 of 1.1.13)

Dashed and dotted drawing lines, minimise and maximise, zoom inside a note, and new icons.

- **Dashed / dotted drawing lines:** stroke field `d: 'dash' | 'dot'` (store `normalizeInk` keeps only those), `inkState.dash` (saved in `inkPrefs`), buttons `#inkDash` in the drawing toolbar's last row (greyed out for the eraser). `strokeEl` sets `stroke-dasharray` from the drawn width (dots = zero-length dashes with round caps); a dashed arrow is a `<g>` with a dashed shaft and a solid head. Partial erasing keeps `d` on the pieces.
- **Minimise / maximise:** top bar `.hsep` divider, `#btnMin`, `#btnMax` before `#btnClose`. Windows are `maximizable: true` (so double-clicking the top bar's drag area maximises); IPC `note:maximize` toggles, unrolling a rolled note first; the `maximize` event also unrolls; `note:win-state` → `body.maxed` swaps the icon. `note:minimize` sets `win.userMin` + `setMinimizable(true)` so even pinned notes stay down (the `minimize` handler and `enforcePinned` skip them) until `restore` clears it. Bounds aren't remembered while maximised/minimised. Rolling up a maximised note unmaximises it first.
- **••• menu:** sits in the top-right corner (`right: 4px`), normal size, `width: clamp(260px, 40vw, 100vw - 8px)` (at least 40% of the note).
- **Corner curl** (`.corner`) no longer covers the Add button: it hides at once whenever the bottom bar shows (also `body.pop-open` / `body.text-open`) and only fades back in after the bar has faded (`transition-delay`).
- **Zoom inside a note:** Ctrl + mouse wheel (steps of 10 %, touchpad steps added up), Ctrl+= / Ctrl+- / Ctrl+0. New note field `zoom` (0.5–3, `normalize`, in `EDITABLE`, not an edit). note.js applies it as CSS `zoom` on `#sheet` (`applyZoom` from `applyLook`), so text, pictures and the drawing scale together; screen-pixel → note-pixel conversions divide by `zoomNow()`: `inkPt`, picture resizing, `--viewW` (`updateViewWidth`), and `contentRight` multiplies the ink bounds. The wheel handler always `preventDefault`s, so Chromium's page zoom (shared by every window) never kicks in.
- **In-app version history shortened** (`src/about.js` `VERSIONS`): a few short lines per version.
- **No shaded boxes on the bottom bar:** `#tools .tb.on` has no background; only with the text toolbar open (`body.text-open`) do `[data-cmd]` buttons show their on-box and `#btnText` is shaded. Hover still tints.
- **Notebook group look:** the elastic band is `.nb-cover::after` (tilts with the cover on hover); `.nb-band` is hidden.
- **Settings split:** "General" (Start with Windows, window colours) and "For new notes" (Colour, Font, See-through, solid on hover) are two separate `.panel`s in list.html, so each folds on its own (`foldPanels`). The "For new notes" panel has a short `.muted` line; the `.subhead` heading and its CSS are gone.
- **Word wrap icon** (`#btnWrap`): return arrow (option 1 of "Wrap and spelling options.png") instead of the lines with a W cut out (`#wrapW` mask and `.lines` CSS removed).
- **Spelling icon** (`#btnSpell`): "abc" (SVG `<text class="fill">`, `#btnSpell text { font: 800 11px var(--ui) }`, Nunito 800) with a tick under it, instead of the A with a tick.
- **Slash gap on both:** each icon is drawn inside a `<g mask>` (`#wrapCut`, `#spellCut`) whose `.slashcut` cuts a 6-unit gap around the slash; `#btnWrap.on .slashcut, #btnSpell.on .slashcut { display: none }`. Spelling's "on" box (`.tb.on`) is unchanged.
- Tests: `tests/v1113.test.js` (favourites, apply, make-from, no deleting locked things, empty bin keeps locked, dashed ink, minimise/maximise); fake-electron windows can minimise/maximise and record send arguments (`sentArgs`).

## 1.1.13 – 23 October 2026 (was part 1 of 2 of 1.1.13)

Favourites, picking several cards at once, and locked notes that can’t be deleted.

- **Favourites:** new `favorite` flag on notes (store `normalize`, not an edit, not copied by `duplicate`) and groups (`normalizeGroup`); `list:get` sends it. IPC `list:favorite(ids, on)`. List: `.fav` star button top-right of every card (outline on hover, filled `#FFD54A` when on, `.pop` animation); its state and the selection are painted after placing cards (`paintCards`), and `favorite` is left out of the card cache signature (`sigOf`), so starring never rebuilds a card. New **Favourites** tab (`tab = 'favs'`, reuses `#viewNotes`, `#cFavs`): every starred note/group, sorted like Notes, searchable; ones inside a locked group that isn't open are hidden and counted in `#tip`. Opening a group from Favourites switches to Notes. Right-click menus have Add to / Remove from favourites.
- **Selecting several cards:** Ctrl+click toggles (`sel`, keys `n:<id>` / `g:<id>`, `data-key` on cards), Shift+click picks a run from the last pick (`selAnchor`), Ctrl+A all shown cards, Esc / clicking empty space clears, Delete = Bin (Shift+Delete: no question). Picks not on screen are dropped in `paintCards`. Bottom bar `#bulk` (built in list.js): Open, Close, Favourite/Unfavourite, Colour (pop-up with the 8 papers + font; IPC `list:apply(ids, patch)`, groups via `groups:apply`), Group (IPC `groups:make-from(ids, parentId)`: new group at the current level; skips things inside an unopened locked group and never puts a group inside itself), Lock, Bin (one question; locked ones are left). Right-click on one of several picked cards shows the same actions (`bulkMenu`). Dragging a picked card drags all of them (`drag.many`, `canMove`/`moveInto`; onto a note = new group with all of them, via `groups:make-from`).
- **Locked notes/groups can't be deleted:** main refuses `list:trash`, `note:trash`, `list:destroy` for `isLocked` notes and `groups:trash` when any note in the tree is locked (`{ error: 'locked' }`); `list:empty-bin` leaves locked notes and returns `{ removed, kept }`. List: `noteIsLocked` / `groupIsLocked` hide the card's bin button, grey out the menu item ("Locked: can't be deleted"), disable Delete in the Bin; note window ⋯ → Delete is disabled ("remove the lock first").
- **Lock removed from the list while the note is open:** note.js `onLook` now shows the content when a hidden window gets `hidden: false` (it only handled hiding); main `pushLook` sets `win.revealed` once the note isn't locked. Test `tests/lock-refresh.test.js`.
- **"Stardust" lock animation** (option 3 of "Lock animation options.html"): note window: `lockGhost()` clones `#scroller` into a picture-only `.lockghost` that shrinks/blurs away (removed after 0.6 s; the real editor is emptied at once), `.stardust` stars burst from the lock icon, `body.anim-lock` glows it in; unlocking bursts stars and grows `#scroller` back (`body.anim-unlock`). List: `paintCards` compares each card's lock state with the last render (`lockSeen`) and plays `stardust()` (`.lock-anim` / `.unlock-anim`). Off with "reduce motion".

## 1.1.12 – 23 October 2026

- **No sideways scroll into empty space:** with word wrap off (`note.wrapWidth`), `#sheet` keeps its old width, so a note made narrower could scroll sideways into nothing (e.g. a small photo and short lines). note.js `fitSideways()` measures how far the real content reaches (`contentRight()`: text line boxes via `Range.getClientRects`, plus `img, video, canvas, svg, table, .voice` and `inkBounds()`) and sets `#scroller` to `overflow-x: hidden` (and `scrollLeft = 0`) when it all fits in the visible width; otherwise `overflow-x` goes back to auto. The layout itself is unchanged, so nothing re-wraps and drawings stay lined up. Re-checked (once per frame) on `applyLayout`, edits (MutationObserver), `ResizeObserver` on `#scroller` and `#editor`, picture `load`, `paintInk` and when fonts are ready.
- **Dividers run the whole width:** `#editor hr { width: max(100%, var(--viewW)) }`, so with word wrap off and a note made wider than `wrapWidth` the line still reaches the right side (inside list items and table cells it stays `auto`).
- **Word wrap icon:** five lines with a W cut out of them (SVG `<mask id="wrapW">` in note.html; `#btnWrap .lines`). Off: the slash as before, plus `.slashcut` in the mask cuts a gap around it so the W stays readable. `#btnWrap` now comes before `#btnSpell`. On = just the icon without the slash: `#btnWrap.on` has no `.tb.on` background (hover tint only).
- **Note menu switch:** "Turn solid when my mouse is over it" (`#solidHover`) is a sliding switch (`label.check.switch` + `<i>`, note.css; same look as Settings' `.toggle`, a bit smaller).
- **Add panel:** "Date" → "Today’s date".
- **New setting `defaultSolidOnHover`** (default true): Settings → For new notes, toggle `#sSolidHover` under the see-through slider. main.js `settings:set` stores it; `store.create` gives new notes `solidOnHover` from it (existing notes unchanged; each note still has its own checkbox in the ••• menu). Test in `tests/pin-theme.test.js`.
- **Caret next to photos:** a tilted photo (`transform: rotate`) is painted over the caret beside it. note.js gives photos right before/after a collapsed caret the class `.caret-near` (`imgsByCaret()` on `selectionchange`) → note.css `position: relative; z-index: -1`, so the caret shows on the photo's edge. A layered-down photo inside a `<p>`/`<div>` can't be hit-tested, so the class is dropped as soon as the mouse is over the photo (`mousemove`, `overImg()`; its left `EDGE` px don't count) and isn't added while the mouse is on it. `collect()` strips the class; the MutationObserver doesn't watch attributes, so it's not an edit.
- **Clicking beside photos and lines:** clicks in `#scroller`'s side padding used to jump to the end of the note; now `besideLine()` puts the caret before/after a picture on that line, or at the start/end of the text line (`caretRangeFromPoint`). Below the text it's still the end. A left click on the first `EDGE` (7) px of a photo puts the caret in front of it instead of selecting it (`edgeDown` skips the click/dblclick that follows).
- **Picture-only cards:** list.js `cardBody` drops the stand-in text "🖼️ Photo" / "✏️ Drawing" (`PICTURE_ONLY`, must match `collect()` in note.js) when the card shows the picture. The stored `text` is unchanged, so search still finds "photo".

## 1.1.11 – 23 October 2026

- **Undo at full strength on the note:** the bottom bar's fading moved from `#tools` to its children (`#tools > *`); `#btnUndo` follows the same rules but gets `opacity: 1` whenever the mouse is on the note (`body:hover`), also while drawing fades the rest. It is never disabled either. `#stamp` is kept clear of it (max-width −150 px).
- **Pause button** `#inkPz`: a round button stuck to the left of `#inkBar`, outside it (`movable(..., roomLeft: 40, dragBtn: #inkPz)`, so it moves with the toolbar and can drag it; a drag isn't a click): `pauseInk()` / `resumeInk()`; it shows a play icon and stays at full opacity while paused. The capture listener that resumes drawing on any toolbar click skips it. The `.iside` drag tab (1.1.10) is removed; the toolbar is dragged by any empty spot.
- **Mouse back / forward buttons** in the notes list: every change of group level is remembered (`navBack`/`navFwd`, recorded in `render()` unless `navigating`); `navigate('back'|'forward')` skips levels that are gone or locked again. Triggered by `mouseup` with button 3/4 and by the window's `app-command` (`browser-backward`/`browser-forward` → `list:nav`, preload `list.onNav`); a second trigger within 250 ms is ignored, so one click never counts twice.
- **Settings → General reordered:** Start with Windows, then the window colours, then a "For new notes" heading (`.subhead`) with Colour, Font and a new **See-through** slider (`#sOpacity`, saved on release). New setting `defaultOpacity` (0.25–1, 5 % steps, main.js `settings:set`), used by `store.create`.
- **Bring to front unrolls:** `bringToFront({ unroll: true })` from the list button (`list:bring-front`) and the tray item also unrolls rolled-up notes (`store.update` + `setRolled` + `note:look`; note.js `onLook` now takes `rolled`). Starting CosmoNotes again (`second-instance`) only brings notes up, as before.
- **Rolling up keeps the toolbars:** the roll button no longer calls `exitInk()` / `closeText()`; it finishes a stroke and saves, and `body.rolled` hides `#inkBar` and `#textPop` until the note unrolls (they're placed again on the resize).
- **Speed-ups (behaviour unchanged):**
  - Notes list: date formats are made once (`FMT`, `Intl.DateTimeFormat`) instead of a new formatter for every card — that was most of a redraw. A background refresh reuses every card whose data didn't change (`cardCache`, keyed by note/group, compared by JSON of what the card shows) and only moves/replaces what changed (`placeCards`); view changes still rebuild everything with the animation, and the cache resets at midnight ("Today"/"Yesterday"). 400 notes: a refresh went from ~280 ms to ~17 ms. A check confirmed the reused list is identical to a freshly built one after edits, opening, pinning, renaming, moving, binning, adding and locking.
  - `store.update` re-checks the drawing (`normalizeInk`) only when the drawing itself changed; otherwise it keeps the already-clean one. 50 typing saves on a note with a 60 000-number drawing: ~357 ms → ~1.3 ms in the main process.
  - `applyPatch`: a text/title save only updates the window title (`setWinTitle`, only when it really changes) instead of re-applying always-on-top, opacity and colour on every save. Note windows ignore `page-title-updated`, so the page's own `<title>` can't rename them.
  - The text toolbar's "Changes:" line is only rewritten when it changes (it ran on every cursor move).
  - Looked at and left alone on purpose: backups and attachment clean-up (rare, and they keep notes safe), drawing a long pen line (~1 ms per mouse move even at 1 500 points), the 2.5 s pinned-note check (by design).
  - Tests: `tests/speed.test.js`.
- Settings section titles (1.1.10): hover tint `color-mix(#FFE45C 16%, card)` (dark themes: `--card2`), rounded corners kept when open, room before the text, no focus ring after a mouse click (`mousedown` preventDefault on `.phead`).

## 1.1.10 – 22 October 2026

- **Settings sections fold:** list.js `foldPanels()` wraps everything below each panel's title (`h3`, or `.abouthead` for About) in `.pbody > .pinner`; the title gets `.phead` (clickable, keyboard too, chevron). Opening animates `grid-template-rows: 0fr → 1fr` plus a fade. All start closed.
- **Backups:** the list in Settings is replaced by the newest backup's line (`#backups`) and a "Restore from a backup…" button (`pickBackup`): a `modal()` with a pickable list of days (`content` option, `.bkpick`), then a result message naming the group.
- **Restored notes go into a group:** `store.restoreBackup` puts every note it brings back (new copies and notes un-binned from it) into a new top-level group "Restored Notes from <Weekday>, <d> <Mon> <yyyy>" (`backupDayName`). Nothing is overwritten, as before. Cards no longer say "Restored": they show the note's own created date (kept from the backup).
- **Toolbars:** an X (`#inkX`, `#textX`) on each; `#inkDone`, `#inkUndo`, `#tUndo` and the switch button `#inkPause` are gone. A small drag tab (`.iside`) sits where the switch button was (`movable(..., roomLeft: 16)`).
- **Independent:** `#textPop` is no longer closed by `closePops()` (other pop-ups, outside clicks, Esc, entering drawing); `openText()`/`closeText()`, `body.text-open`. Only A or its X closes it (and rolling up / locking). Drawing likewise only closes by Draw, its X or Esc.
- **Fading:** `#textPop` is at 40 % while drawing or while the editor has focus (`body:has(#editor:focus)`), 100 % on hover. Using the text toolbar while drawing switches to typing (capture listener), like the bottom bar.
- **One Undo button** `#btnUndo` in the bottom bar, outside `.tleft` so it never scrolls away: drawing → `inkUndo`, otherwise the note font (`textUndo`, cleared on any typing) or the editor's own undo (then the selection is collapsed so the panel goes back to "whole note"). Ctrl+Z does the same. Below 430 px the formatting buttons are 22 px so everything still fits on a 340 px note.
- Tests: store.test.js checks the restore group and its name.

## 1.1.9 – 22 October 2026

- **Text panel as a toolbar:** `#textPop` (class `tbar`) is 250 px wide like `#inkBar`, opens bottom-left, with a grip, a "Changes: whole note / selected text" line with an undo button (`#tScope`, `#tUndo`), the font (`#fontSeg`), colour and highlight dots, size (`#fsizeSeg`) and clear formatting (`#miClearFmt`). Every button goes through `onText()`: the selection, or the whole note when nothing is selected (select all, apply, put the caret back). Font with a selection = `fontName` (Caveat/Nunito, size-matched in note.css); without = the note's font. Undo = `textUndo` (editor undo steps + note-font changes). The note-wide 3-size buttons (`note.size`) are gone from the UI; existing notes keep their size.
- **It stays open:** the outside-click handler skips closing when `openPopId === '#textPop'`; only the A button (toggle), Esc, opening another pop-up, or rolling up closes it. Clear formatting no longer closes it. The selection it acts on is the current one (`selectionchange` → `saveSel` already tracked it).
- **Shared drag code:** `movable(el, { key, roomLeft, dragBtn })` now handles both the drawing toolbar (`inkBarPos`, 40 px room for the switch button, `dragBtn` = `#inkPause`) and the text toolbar (`textBarPos`). Drag from any non-button spot; double-click the grip to reset.
- **Cursor:** `#inkBar` no longer has `cursor: grab`; only `.igrip` shows the hand.
- **Switch badge:** `#inkPause .swap`, a small purple ⇄ circle on the button.
- **Scrollbars:** `#scroller` thumb is transparent unless `body:hover`, `:focus-within` or `.pop-open`. (Checked with scrollbars switched on in the test browser: Playwright hides them by default.)

## 1.1.8 – 22 October 2026

- **Fixed: Partial eraser made drawings "dance".** 1.1.6 thinned out the points of every leftover piece (`simplify`), and each later pass traced the smoothed curve again and smoothed it once more, so lines crept by a few px per pass (measured: up to 4.2 px after 25 passes). `simplify` is gone; leftover pieces keep their 2 px points, and a line whose points are already that close (`isDense`, cached) is split as it is, never retraced. Drift is now a one-time ≤ 0.5 px when a line is first erased, and doesn't grow. Speed stays the same (busy-drawing scrub ≈ 3.8 s, slowest step < 0.1 s).
- **Three more dark list themes:** midnight, forest, plum (`THEMES` entries with `dark: true`; list.js puts `.dark` on the body so the dark-only fixes in list.css apply to all of them; main.js `LIST_THEMES` for the window buttons).
- **Settings toggles back:** clicking the Settings tab while it's open returns to the last of Notes/Bin (`setTab`, `lastTab`).
- **Movable drawing toolbar:** a grip (`#inkGrip`) at the top of `#inkBar`; dragging sets `right`/`bottom` (kept inside the note and below the top bar, also when the note is resized: `placeInkBar`). Saved in `localStorage.inkBarPos` (distance from the bottom-right corner); double-click resets it.
- **Drawing ⇄ typing switch:** `#inkPause`, a round button stuck to the left of `#inkBar` (moves with it; `placeInkBar` keeps 40 px for it), showing a T (typing) or a pen (back to drawing). `pauseInk()` finishes the current stroke, saves the ink, hides `#inkCatch` and makes the editor editable (`body.ink-paused`); `resumeInk()` undoes that. The Draw button (highlighted while typing) also resumes. Ctrl+Z is text undo while typing. Esc/Done end drawing as usual.
- **Nothing disappears:** while drawing, the bottom bar stays at 35 % opacity (70 % on hover) and clicking any of its buttons switches to typing first (capture listener on `#tools`). While typing, the drawing toolbar stays, faded (38 %), and clicking any tool in it switches back to drawing (capture listener on `#inkBar`). The toolbar now starts just above the bottom bar (`bottom: 42px`).
- **Drag the toolbar from anywhere:** pointerdown on any non-button spot of `#inkBar` (grip, gaps, tip line), or on the switch button, moves the whole toolbar; the switch button only starts dragging after 4 px, and a drag doesn't count as a click (`draggedSwitch`). Tool buttons are never dragged.
- **Font and note text size moved** from the ⋯ menu into the A (text) pop-up (`#fontSeg`, `#sizeSeg` now in `#textPop`, labelled "whole note"; colour/highlight/size are labelled "selected text").
- **12 directions** for Shift + line/arrow (`shapeEnd` step π/6 instead of π/4).
- **"Draw" label** on `#btnInk`; `#btnText` moved right after strikethrough. Below 440 px the formatting buttons are 24 px wide with tighter gaps so everything still fits on a 340 px note; below 280 px the Draw label hides.
- `#stamp` opacity .5 → .35.

## 1.1.7 – 22 October 2026

- **Five card sizes** in the notes list and Bin: s 124×128, m 156×168, l 208×222, **xl 260×278**, **xxl 320×340** (`SIZES` in list.js; main.js accepts `listSize` s|m|l|xl|xxl). The size menu shows S/M/L/XL/XXL with a tip. A card never gets wider than the window (`min(var(--cw), 100%)`), so XXL fits a 340 px window.
- **Ctrl + mouse wheel** changes the card size one step per notch (wheel up = bigger), with a toast. Wheel deltas are added up and steps are at least 140 ms apart, so a touchpad doesn't jump straight to the end. `preventDefault` stops page zoom. Not in Settings or while a pop-up is open.
- **Undo after Done:** `enterInk` no longer clears `inkState.undo`; the list keeps the last 50 snapshots (was 100, per drawing session). `hideContent` clears it, so a locked note keeps no copies of its drawing.
- **Eraser sizes stay put:** `#inkWidths` is always shown with the eraser; for "Whole line" it gets `.off` (faded, buttons disabled) instead of `hidden`.
- **Over / Behind icons:** two overlapping squares (`.pg` = the note, `.ik` = the drawing, red); the one in front shows the layer.
- **Tool pointers:** pen = pencil, highlighter = marker, 24 px SVG data-URL cursors with the tip in the chosen colour and a white outline (`CURSOR_SVG`, `toolCursor()`, set on `#inkCatch` in `paintInkBar`). Hotspot at the tip (3, 21). Shapes keep the cross; the erasers keep theirs.

## 1.1.6 – 22 October 2026

- **List themes.** `settings.listTheme` (cream | rose | mint | sky | lilac | night), picked in Settings → General ("Colours of this window", `#sTheme`, `THEMES` in list.js). list.css now uses variables for every surface (`--card`, `--card2`, `--ink2`, `--ink3`, `--pillfg`, `--dot`, `--danger…`), and `body[data-theme]` overrides them. main.js `LIST_THEMES` / `paintListFrame()` recolours the window background and the title-bar overlay (window buttons) to match.
- **Fixed card size.** `.cards` uses `repeat(auto-fill, var(--cw))` and `.card { height: var(--ch) }` (s 124×128, m 156×168, l 208×222; Bin cards +30 px for their buttons). Resizing only changes the number of columns. Line clamps were set to fit; with a picture the text clamps to 1–2 lines (`.body:has(.thumb)`).
- **Bin search** (`#bq`, `#bqClear`, `binQuery`), same as the notes search; Esc clears it, Ctrl+F focuses the search of the open tab. The Bin text sits under the search row; "Empty bin" moved into that row.
- **Shift+click Delete** in the Bin skips the question (`destroyNote(n, skipAsk)`); the question has the tip.
- **Password or PIN.** `lock:set` takes `kind` ('pin' | 'password'); a PIN must be 4–12 digits. Stored as `settings.lockKind` and `settings.lockLen` (PIN length). `lockInfo()` sends both to the list (`list:get`) and to notes (`noteSettings`). The list `modal()` got `kindPick` (Password | PIN switch), `pin` inputs (digits only) and `pinLen` (submits by itself at that length). The note lock screen does the same (`paintUnlock`, auto-submit at `lockLen`), and the note's own "choose a password" pop-up has the switch (`#pwKind`). A wrong PIN clears the box and says "Wrong PIN"; a wrong password says "Wrong password". Old passwords (no `lockKind`) count as passwords.
- **Move up inside a group:** the `#dropOut` strip is gone (it pushed the cards down). The back button (`#btnBack`, left of the group name) glows while dragging and is the drop target; the path above still works too.
- **Group tip** ("drag a note onto another…") only shows while `settings.madeGroup` is false. store.js sets it in `createGroup` and on load if any group exists.
- **Envelope seal** is gold (`.e-seal`, `.seal` in the look picker) instead of red, so it isn't confused with the pinned-note pin.
- **Word wrap** replaces "lock text layout" in the UI (same `note.wrapWidth`): `#btnWrap.on` = word wrap on (no wrapWidth); off shows a slash like spelling. Short tooltip, toasts and question.
- **Draw-over:** "Rub out" → "Partial". Tips are one short line (`.ihint` single line, fixed height) and every toolbar row has a fixed height, so the toolbar doesn't jump between tools. Rolling up while drawing calls `exitInk()` first (`body.rolled #inkBar` hidden as well).
- **Faster Partial eraser:** `tracePieces` now works out the curves in plain JS (same maths as `smoothPath`/`strokeEl`) instead of `getPointAtLength` on a hidden SVG; bounding boxes are cached (`boxOf`); erasing runs once per animation frame (`queueRub`/`flushRub`); leftover pieces are thinned with `simplify` (0.35 px); and redraws reuse each stroke's SVG element (`elCache`, `paintInk`), with the sheet size updated when the drag ends. On a busy test drawing (250 strokes) a scrub went from 42 s to 3.6 s, slowest step 2.4 s → 0.13 s.
- **Cursor:** `#scroller` has the normal arrow (so scrollbars show it); the text cursor is on `#sheet`.
- Tests: `tests/pin-theme.test.js`.

## 1.1.5 – 22 October 2026

- **Build fix for computers with an old Node.js.** On the work laptop the global Node was 14, and the build failed (`stream/promises` missing). The installed `@electron/rebuild` 4.2.1 needs Node ≥ 22.12.0. `build.bat` now checks the version (major.minor, not just the major). If Node is missing or too old, it downloads Node 22.14.0 (win-x64 zip from nodejs.org, via PowerShell) into `tools\node` and puts it first on `PATH` for that window only. A later run reuses `tools\node`. The system Node and other apps are untouched. If the download fails, it opens nodejs.org with instructions.
- `tools` added to `.gitignore`.
- The final message reads the version from package.json (`node -p`) instead of the hard-coded “Setup 1.1.1.exe”. `HOW TO INSTALL.txt` no longer names a version.
- Kept from before: the `fc /b` Smart App Control check, the 15 s retry and the Windows Security explanation (now also mentioning that IT may have locked those settings on a work laptop).
- No app changes.

## 1.1.4 – 22 October 2026

- **Duplicate note**: list right-click (`noteMenu` → `S.list.duplicate` → `list:duplicate`) and the note's ⋯ menu (`#miDuplicate`: `saveNow()` + `saveInk()` first, then `note:duplicate`). Both call `duplicateNote(id)` in main.js → `store.duplicate(id, extra)`.
- The copy takes html, text, firstImage, ink, wrapWidth, colour, font, size, opacity, solidOnHover, spell, locked and groupId (deep-copied). A title gets " (copy)". It isn't pinned or rolled up, and it opens next to the original's window (or 30 px offset from its saved spot). New id and dates, so it sorts as just edited.
- Attachments aren't copied: both notes refer to the same files, and `sweepAttachments` only removes files no note or backup uses. Sketch edits always save a new file, so editing one note's sketch doesn't change the other's.
- Locks: a locked note's copy is locked (`locked` copied; a group lock follows from `groupId`). The copy's window starts unlocked only if the original's window was unlocked on screen, or its locked group is open in the list.
- Tests: `tests/duplicate.test.js`.

## 1.1.3 – 22 October 2026

- **Two erasers in draw-over.** With the eraser selected, `#inkColors` is replaced by `#eraseMode` ("Rub out" | "Whole line"). `inkState.eraseMode` is `'part' | 'stroke'` (default `'part'`), and `inkState.ew` (2/4/8, radius = ew × 3 px) is the rub-out size, set with the thickness buttons, which hide for "Whole line". Both are remembered in `localStorage.inkPrefs`.
- **Rub out** (`rubOut(a, b)`, called with the previous and current pointer position so fast drags leave no gaps): strokes whose bounding box is near the eraser are hit-tested (`segDist` for pen/highlighter segments). A touched stroke is traced into 2 px points along its real SVG geometry (`tracePieces`, `getPointAtLength` in a hidden `<svg>`; an arrow's head is split off as its own piece). Points within eraser radius + half the line width are dropped, and every remaining run of ≥ 2 points becomes its own `pen` (or `hl`) stroke with the same colour, width and layer. Rectangles and ellipses start their loop at an erased spot, so what's left stays in one piece. It uses the existing ink format, so store.js is unchanged. It's capped at 4000 strokes, like `normalizeInk`.
- A circle (`#inkEraser`) shows the eraser size, and the mouse pointer is hidden over the drawing (`body.rubbing-ink`). "Whole line" is the old `eraseAt` with the `cell` cursor. Undo works for both (one snapshot per drag).

## 1.1.2 – 22 October 2026

- **Fixed: pictures didn't shrink with a locked text layout.** With `note.wrapWidth` set, `#sheet` has a fixed width, so `max-width: 100%` on pictures meant the locked width, not the visible note. Pictures never shrank, and right-click → "Keep size when the note gets narrower" (`img.fixed`) changed nothing.
- Now `applyLayout` / a `ResizeObserver` on `#scroller` set `--viewW` (the visible writing width) on `#sheet`. With `#sheet.fixed:not(.inked)`, pictures without `.fixed` get `max-width: min(<normal>, var(--viewW))` (photos minus their 10px frame padding). The text still keeps the locked width.
- With a drawing (`#sheet.inked`, toggled in `applyLayout`) and a locked layout, pictures keep their size as before, so ink stays lined up. The right-click item shows "✓ Keep size (always on while this note has a drawing)" and explains how to unlock.
- Turning on "Keep size" for a picture without a `width` now stores min(natural width, text width) instead of its current, possibly squeezed, on-screen width.

## 1.1.1 – 22 October 2026

- **Smart App Control fix.** Smart App Control on the owner's PC had switched from Evaluation to On. It blocked the *first launch* of the freshly installed `CosmoNotes.exe`; the installer itself ran fine. Cause: each build produced a new, unsigned exe, because (a) our `build/afterPack.js` stamped icon and version info into it with rcedit, and (b) electron-builder embedded the asar-integrity resource (`addWinAsarIntegrity` via resedit). Running `test-run.bat` (`npx electron .`) proved that Electron's own unmodified `electron.exe` is trusted.
- Fix: removed the `afterPack` stamping (and the `rcedit` dependency), set `build.disableAsarIntegrity: true`, and kept `win.signAndEditExecutable: false`. So `dist\win-unpacked\CosmoNotes.exe` is byte-identical to `node_modules\electron\dist\electron.exe`. `build.bat` checks this with `fc /b` after every build.
- Icon: the exe now carries Electron's icon, so `build/installer.nsh` (`customInstall`) re-creates the Start menu and desktop shortcuts pointing at `resources\icon.ico` (copied by `extraResources`), with the same AppUserModelID. Windows and the tray keep their icon from main.js.
- Added `test-run.bat`: runs CosmoNotes straight from the project folder with Electron's original exe. It's handy for testing, and it uses the real notes in `%APPDATA%\CosmoNotes`.

## 1.1.0 – 22 October 2026 (big update)

- **Draw-over.** A squiggle button (`#btnInk`, left of Add) enters draw mode. The text can't be edited while drawing; a transparent catcher (`#inkCatch`) takes the mouse. The toolbar (`#inkBar`, bottom-right) has pen, highlighter, line, arrow, square, circle and eraser; 8 colours; thin/medium/thick; **Over / Behind**; undo (Ctrl+Z), clear all, and Done (Esc). Shift: straight pen/highlighter line, snapping to 45° for line/arrow, perfect square/circle. Hints in the toolbar and tooltips say so. The last-used tool, colour, size and layer are remembered.
- **Ink storage:** `note.ink = { s: [{ t, c, w, l, p }] }` in sheet coordinates (px from the text area's top-left), drawn as SVG in two layers (`#inkBelow` z0 / editor z1 / `#inkAbove` z2). Highlighter uses multiply blending. It's cleaned by `normalizeInk` (store.js), counts as an edit, is part of `SECRET` (blanked for hidden locked notes, can't be overwritten while hidden), and is saved 300 ms after a stroke and on close/blur.
- **Lock text layout** (`note.wrapWidth`, new `#btnWrap` next to spelling). `#sheet` gets a fixed width, so text and pictures never re-wrap, and `#scroller` scrolls sideways (with a thin scrollbar like the vertical one). The first stroke turns it on by itself. Unlocking while there's a drawing asks first. The sheet also grows to fit drawings (min width/height from the ink bounds).
- **Pictures:** right-click → Small / Medium / Full width (each asks first if there's a drawing), plus "Keep size when the note gets narrower" (`img.fixed`, `max-width: none`). Dragging the resize handle on a note with a drawing asks first (once per window).
- Bottom bar: the spelling button moved into the left group, with the layout-lock button next to it. Below 390 px width, Add shows as a round "+" so all buttons fit. The Add menu's "Drawing" pad is renamed "Sketch" to avoid confusion with draw-over. New notes default to 340 px wide.
- App-styled "are you sure?" pop-up in notes (`ask()` / `#askPop`).
- Tests: `tests/ink.test.js`. `main.test.js` was updated for the 340 px default.

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
