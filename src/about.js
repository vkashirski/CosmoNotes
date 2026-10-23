'use strict';
/*
 * CosmoNotes - what the app can do + version history.
 * Shown in the notes list -> Settings -> About CosmoNotes.
 *
 * EVERY update raises the version (third digit: 1.0.2 → 1.0.3) unless the owner
 * says not to; the owner decides when the first or second digit goes up.
 * Update together:
 *   1. package.json "version"
 *   2. VERSIONS below (newest first) and LAST_UPDATED
 *   3. CHANGELOG.md
 *   4. "Last updated" + version in ai-context/CONTEXT.md
 */
window.COSMO_ABOUT = {
  LAST_UPDATED: '2026-10-23',

  FEATURES: [
    {
      title: 'Notes that never get lost',
      items: [
        'Everything is saved on this computer the moment you type, with nothing in the cloud and no account.',
        'Saving is crash-safe: a power cut can never leave a note half-written, and the last good version is always kept.',
        'A backup of all your notes is made automatically every day, and the last 30 days are kept. Restore a day from Settings: its notes come back in their own group, never replacing anything.',
        'Deleted notes go to the Bin first, so you can restore them.',
        'Locked notes and groups can’t be deleted (not even from the Bin) until you remove the lock.',
        'Uninstalling the app does not delete your notes.',
      ],
    },
    {
      title: 'Sticky notes on your desktop',
      items: [
        'Pin a note to keep it above every other window.',
        'See-through slider, with an option to turn solid while your mouse is over the note.',
        'Roll a note up to just its top bar, and roll it down again.',
        'Minimise and maximise buttons next to the X (double-clicking the top bar maximises too). A pinned note only minimises with its own button.',
        'Notes reopen exactly where you left them, also after restarting the laptop.',
        'Starts with Windows (can be turned off).',
        '8 paper colours (or a random one for each new note), a handwritten or rounded font, and 3 text sizes per note.',
        'Optional title for each note, shown on the top bar.',
        'Ctrl + mouse wheel zooms a note’s writing, pictures and drawing in or out (Ctrl + 0 goes back to 100%). Each note remembers its zoom.',
        'Shows when the note was last edited, plus created and edited dates in the ⋯ menu.',
      ],
    },
    {
      title: 'Writing',
      items: [
        'Bold, italic, underline, strikethrough, bullet lists and tickable checklists.',
        'The A button opens a small text toolbar: font, colour, highlight, size and clear formatting, with undo. It changes the selected text, or the whole note when nothing is selected (it says which). It stays open while you select text, and you can drag it anywhere.',
        'Spelling check that you can turn on or off for each note. Off by default, and Cyrillic words are not underlined.',
        'Word wrap on or off for each note (the button next to spelling). With word wrap off, lines keep their width and a narrower note scrolls sideways. Pictures still shrink to fit, unless you right-click one and choose “Keep size”.',
        'Links become clickable as you type them.',
      ],
    },
    {
      title: 'Draw over your notes',
      items: [
        'The squiggle button (next to Add) lets you draw right on top of a note: circle words, underline, point arrows at photos.',
        'Tools: pen, highlighter, straight line, arrow, square, circle and eraser, in 8 colours and 3 thicknesses, with undo.',
        'Solid, dashed or dotted lines, for every drawing tool.',
        'Two erasers: “Partial” erases only what is under the eraser circle (3 sizes), “Whole line” removes a whole line or shape with one touch.',
        'Hold Shift for straight lines, perfect squares and perfect circles. Lines and arrows snap to 12 directions, like a clock.',
        'Drag the drawing toolbar by any empty spot to anywhere in the note (double-click the grip at the top to put it back). Close it with its X.',
        'Scrollbars only show while you’re using the note, like the bottom bar.',
        'Switch between drawing and typing just by using them: the bottom bar or the text toolbar switches to typing, a drawing tool switches back. The one you’re not using fades, so nothing disappears.',
        'The mouse pointer looks like a pencil or a marker in the colour you picked.',
        'Undo and Redo buttons in the bottom bar, left of Draw, at full strength while your mouse is on the note: they work on your drawing while you draw (last 50 steps, also after closing drawing) and on your text otherwise. Ctrl+Z undoes, Ctrl+Y redoes.',
        'The round pause button just left of the drawing toolbar puts drawing on hold so you can type; press play to carry on. You can also drag the toolbar by it.',
        'Rolling a note up only hides the drawing and text toolbars; they come back as they were when you unroll it.',
        'Draw “Over” the text and pictures, or “Behind” them like marker on paper.',
        'Drawings stay exactly where you put them: drawing turns word wrap off, and you get a warning before anything could move away from a drawing.',
      ],
    },
    {
      title: 'The Add button',
      items: [
        'Photos from a file, pasted, or dragged in, and resizable by dragging their corner. Right-click for Small, Medium or Full width, and to choose whether a photo keeps its size or shrinks when the note gets narrower.',
        'Voice recordings you can play back inside the note.',
        'Sketches: a small drawing pad in 6 colours that becomes a picture in the note.',
        'Links, tables, numbered lists, dividers and today’s date.',
      ],
    },
    {
      title: 'Privacy',
      items: [
        'Lock any note or whole group with one password or PIN, from the note’s ⋯ menu or by right-clicking it in the list. Contents are hidden in the note and in the list.',
        'Choose a PIN (numbers only) or a password. A PIN opens the note as soon as you type the last digit, no Enter needed. A wrong one says so.',
        'Unlock a note in its window and the notes list shows it too (with a small open padlock), until you close the note or lock it again.',
        'A locked group asks for the password when you open it. Its notes open without asking again until you close the list or press “lock again”.',
        'Locking and unlocking play a short padlock animation (“snap shut”), in the note and on its card in the list.',
        'The lock is a privacy screen, not encryption. The note file itself stays readable on this computer, so a forgotten password can never lose a note.',
      ],
    },
    {
      title: 'Notes list',
      items: [
        'See every note at a glance, with its colour and the date it was created. Real titles are bold; notes without a title show their first line semi-bold.',
        'Search across titles and text, with a button to clear the search. Inside a group, search only looks in that group. The Bin has its own search too.',
        'Five card sizes (S, M, L, XL, XXL), also with Ctrl + mouse wheel. Cards keep the size you chose, however wide the window is.',
        'Nine colour themes for this window in Settings: Cream, Rose, Mint, Sky and Lilac, and the dark Night, Midnight, Forest and Plum.',
        'Click Settings again to go back to Notes or the Bin, wherever you were.',
        'Right-click any note or group for quick actions: open, close, duplicate, favourite, lock, move, ungroup and Bin.',
        'Favourites: point at a note or group and click the star in its corner. The Favourites tab shows all of them, wherever they are. The lock button next to the star locks or unlocks it.',
        'Pick several notes and groups with Ctrl+click (Shift+click for a whole row, Ctrl+A for all). A bar at the bottom opens, closes, stars, recolours, groups, locks or bins them all at once, and dragging one of them moves them all.',
        'Moving a note to the Bin, or deleting it from the Bin for good, asks first. Shift+click the button to skip the question.',
        'All questions and messages use the app’s own cute pop-ups.',
        'Sort by last edited or date created, newest or oldest first, and with groups first, notes first or mixed in.',
      ],
    },
    {
      title: 'Groups',
      items: [
        'Drag a note onto another note to make a group. Drop notes (or whole groups) onto a group to put them inside.',
        'Groups can sit inside groups, like folders. A path at the top shows where you are, and you can drop things on it to move them up. The mouse’s back and forward buttons move between the levels you visited.',
        'Four looks for each group (paper stack, folder, envelope or notebook) in 8 colours.',
        'Name groups, lock them, ungroup them (it asks first), or move all their notes to the Bin.',
        'While a group is open, “New note” makes the note right inside it.',
        'Change the paper colour or font of every note in a group at once, optionally including the groups inside it.',
        'Settings for start-up and the window colours (General), colour, font, see-through and “turn solid when my mouse is over it” for new notes (For new notes), spelling, the password, backups and where notes are stored.',
      ],
    },
  ],

  // Short, plain-language highlights for the in-app history (the full details are in CHANGELOG.md)
  VERSIONS: [
    {
      version: '1.1.14',
      date: '2026-10-23',
      changes: [
        'A Redo button right after Undo, for text and drawing (also Ctrl+Y).',
        'Lock or unlock a note or group from the notes list with the new lock button next to its star. The star is a bit bigger and bursts into stardust when you click it, and it no longer squeezes the picture on the card.',
        'Fixed: erasing part of a dashed or dotted line no longer makes the dots and dashes slide.',
        'A new lock animation: the padlock drops in and snaps shut, and pops open when you unlock (the note just fades back in).',
        'The text toolbar opens at full strength.',
        'Unlocking a note in its window unlocks it in the notes list too, until you close the note or lock it again.',
      ],
    },
    {
      version: '1.1.13',
      date: '2026-10-23',
      changes: [
        'Favourites: click the star on a note or group in the list; the new Favourites tab shows them all.',
        'Select several notes with Ctrl+click and open, star, recolour, group, lock or bin them together.',
        'Locked notes and groups can’t be deleted until you remove the lock.',
        'A “stardust” animation when you lock and unlock.',
        'Dashed and dotted lines for drawing.',
        'Ctrl + mouse wheel zooms in and out inside a note.',
        'Minimise and maximise buttons on notes (double-click the top bar to maximise).',
        'New word wrap and spelling icons, a calmer bottom bar, and the ••• menu now opens in the top-right corner.',
        'Fixed: removing a lock in the list now opens the note if it’s already on your desktop.',
      ],
    },
    {
      version: '1.1.12',
      date: '2026-10-23',
      changes: [
        'No more sideways scrolling into empty space when word wrap is off.',
        'Easier to put the text cursor next to photos.',
        'Option to stop new notes turning solid when your mouse is over them.',
      ],
    },
    {
      version: '1.1.11',
      date: '2026-10-23',
      changes: [
        'Undo is always at full strength while your mouse is on the note.',
        'The mouse’s back and forward buttons move between group levels in the list.',
        'See-through setting for new notes.',
        'The notes list and saving are much faster.',
      ],
    },
    {
      version: '1.1.10',
      date: '2026-10-22',
      changes: [
        'Settings sections fold open and closed.',
        'Restore a backup by picking a day; its notes come back in their own group.',
        'One Undo button for both text and drawing.',
      ],
    },
    {
      version: '1.1.9',
      date: '2026-10-22',
      changes: [
        'The A button opens a small text toolbar you can move anywhere.',
      ],
    },
    {
      version: '1.1.8',
      date: '2026-10-22',
      changes: [
        'Fixed: the “Partial” eraser made drawings shift.',
        'Three more dark themes for the notes list.',
        'Move the drawing toolbar anywhere; lines snap to 12 directions with Shift.',
      ],
    },
    {
      version: '1.1.7',
      date: '2026-10-22',
      changes: [
        'XL and XXL card sizes, also with Ctrl + mouse wheel.',
        'Drawing undo remembers your last 50 steps.',
      ],
    },
    {
      version: '1.1.6',
      date: '2026-10-22',
      changes: [
        'Colour themes for the notes list.',
        'Choose a PIN or a password.',
        'The Bin has its own search.',
      ],
    },
    {
      version: '1.1.5',
      date: '2026-10-22',
      changes: [
        'Building the installer works even without Node.js installed.',
      ],
    },
    {
      version: '1.1.4',
      date: '2026-10-22',
      changes: [
        'Duplicate a note.',
      ],
    },
    {
      version: '1.1.3',
      date: '2026-10-22',
      changes: [
        'Two erasers: erase part of a line, or the whole line.',
      ],
    },
    {
      version: '1.1.2',
      date: '2026-10-22',
      changes: [
        'Fixed: pictures shrink with the note again.',
      ],
    },
    {
      version: '1.1.1',
      date: '2026-10-22',
      changes: [
        'Fixed: Windows Smart App Control no longer blocks CosmoNotes.',
      ],
    },
    {
      version: '1.1.0',
      date: '2026-10-22',
      changes: [
        'Draw over your notes: pen, highlighter, shapes and eraser.',
        'Word wrap on or off for each note.',
      ],
    },
    {
      version: '1.0.4',
      date: '2026-10-22',
      changes: [
        'More reliable installer building.',
      ],
    },
    {
      version: '1.0.3',
      date: '2026-10-22',
      changes: [
        'Clear button for search, and search inside a group.',
        'Card sizes for the notes list.',
      ],
    },
    {
      version: '1.0.2',
      date: '2026-10-22',
      changes: [
        'Groups inside groups, with four looks and eight colours.',
        'Lock whole groups.',
        'Right-click menus in the notes list.',
      ],
    },
    {
      version: '1.0.1',
      date: '2026-10-21',
      changes: [
        'Renamed from Sticky Pins to CosmoNotes.',
        'Note titles, locking, spelling check and photo resizing.',
      ],
    },
    {
      version: '1.0.0',
      date: '2026-10-21',
      changes: [
        'First version, released as “Sticky Pins”.',
      ],
    },
  ],
};
