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
  LAST_UPDATED: '2026-10-22',

  FEATURES: [
    {
      title: 'Notes that never get lost',
      items: [
        'Everything is saved on this computer the moment you type, with nothing in the cloud and no account.',
        'Saving is crash-safe: a power cut can never leave a note half-written, and the last good version is always kept.',
        'A backup of all your notes is made automatically every day, and the last 30 days are kept.',
        'Deleted notes go to the Bin first, so you can restore them.',
        'Uninstalling the app does not delete your notes.',
      ],
    },
    {
      title: 'Sticky notes on your desktop',
      items: [
        'Pin a note to keep it above every other window.',
        'See-through slider, with an option to turn solid while your mouse is over the note.',
        'Roll a note up to just its top bar, and roll it down again.',
        'Notes reopen exactly where you left them, also after restarting the laptop.',
        'Starts with Windows (can be turned off).',
        '8 paper colours (or a random one for each new note), a handwritten or rounded font, and 3 text sizes per note.',
        'Optional title for each note, shown on the top bar.',
        'Shows when the note was last edited, plus created and edited dates in the ⋯ menu.',
      ],
    },
    {
      title: 'Writing',
      items: [
        'Bold, italic, underline, strikethrough, bullet lists and tickable checklists.',
        'Text colour, highlight, text size and clear formatting (the A button).',
        'Spelling check that you can turn on or off for each note. Off by default, and Cyrillic words are not underlined.',
        'Lock the text layout of a note, so the text keeps its width. A narrower note then shows a sideways scrollbar instead of re-wrapping. Pictures still shrink to fit, unless you right-click one and choose “Keep size”.',
        'Links become clickable as you type them.',
      ],
    },
    {
      title: 'Draw over your notes',
      items: [
        'The squiggle button (next to Add) lets you draw right on top of a note: circle words, underline, point arrows at photos.',
        'Tools: pen, highlighter, straight line, arrow, square, circle and eraser, in 8 colours and 3 thicknesses, with undo.',
        'Two erasers: “Rub out” erases only what is under the eraser circle (3 sizes), “Whole line” removes a whole line or shape with one touch.',
        'Hold Shift for straight lines, perfect squares and perfect circles.',
        'Draw “Over” the text and pictures, or “Behind” them like marker on paper.',
        'Drawings stay exactly where you put them: drawing locks the text layout, and you get a warning before anything could move away from a drawing.',
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
        'A locked group asks for the password when you open it. Its notes open without asking again until you close the list or press “lock again”.',
        'The lock is a privacy screen, not encryption. The note file itself stays readable on this computer, so a forgotten password can never lose a note.',
      ],
    },
    {
      title: 'Notes list',
      items: [
        'See every note at a glance, with its colour and the date it was created. Real titles are bold; notes without a title show their first line semi-bold.',
        'Search across titles and text, with a button to clear the search. Inside a group, search only looks in that group.',
        'Three card sizes: small, medium or large.',
        'Right-click any note or group for quick actions: open, close, duplicate, lock, move, ungroup and Bin.',
        'Moving a note to the Bin asks first. Shift+click the bin button to skip the question.',
        'All questions and messages use the app’s own cute pop-ups.',
        'Sort by last edited or date created, newest or oldest first, and with groups first, notes first or mixed in.',
      ],
    },
    {
      title: 'Groups',
      items: [
        'Drag a note onto another note to make a group. Drop notes (or whole groups) onto a group to put them inside.',
        'Groups can sit inside groups, like folders. A path at the top shows where you are, and you can drop things on it to move them up.',
        'Four looks for each group (paper stack, folder, envelope or notebook) in 8 colours.',
        'Name groups, lock them, ungroup them (it asks first), or move all their notes to the Bin.',
        'While a group is open, “New note” makes the note right inside it.',
        'Change the paper colour or font of every note in a group at once, optionally including the groups inside it.',
        'Settings for start-up, default colour and font, spelling, the password, backups and where notes are stored.',
      ],
    },
  ],

  VERSIONS: [
    {
      version: '1.1.4',
      date: '2026-10-22',
      changes: [
        'Duplicate note: right-click a note in the notes list, or use the ⋯ menu in an open note. The copy has the same text, photos, drawing, colour, font and size, stays in the same group, and opens next to the original. A titled note’s copy is called “… (copy)”.',
        'A copy of a locked note is locked too. Photos and voice notes are shared safely, so deleting either note never breaks the other.',
      ],
    },
    {
      version: '1.1.3',
      date: '2026-10-22',
      changes: [
        'Two erasers in draw-over: “Rub out” erases only what is under the eraser circle and leaves the rest of a line or shape, and “Whole line” removes a whole line or shape with one touch, like before.',
        'Pick the eraser and the colour row turns into the choice between the two. For Rub out, the dot buttons set the eraser size (small, medium, big), and a circle shows where it will erase. Undo brings erased parts back.',
      ],
    },
    {
      version: '1.1.2',
      date: '2026-10-22',
      changes: [
        'Fixed: pictures no longer shrank with the note when the text layout was locked, so “Keep size when the note gets narrower” did nothing. Now, with the layout locked, the text keeps its width but pictures still shrink to fit the note, unless you chose “Keep size”.',
        'In a note with a drawing and a locked layout, pictures always keep their size so the drawing stays lined up, and the right-click menu says so.',
      ],
    },
    {
      version: '1.1.1',
      date: '2026-10-22',
      changes: [
        'Fixed: Windows Smart App Control blocked CosmoNotes from starting after installing 1.1.0. CosmoNotes.exe is now Electron’s original program file, which Windows trusts, and nothing is stamped into it any more. The shortcuts still get the CosmoNotes icon.',
        'build.bat now checks after each build that the program file is untouched.',
      ],
    },
    {
      version: '1.1.0',
      date: '2026-10-22',
      changes: [
        'Draw over notes: the new squiggle button next to Add opens a toolbar with pen, highlighter, line, arrow, square, circle, eraser, 8 colours, 3 thicknesses, Over/Behind and undo. Hold Shift for straight lines and perfect shapes.',
        'Drawings are saved with the note, hidden when the note is locked, and kept in backups.',
        'New “lock text layout” button: text and pictures keep their width, and a narrower note scrolls sideways instead of re-wrapping. Drawing turns it on by itself.',
        'Warnings before resizing a picture or unlocking the layout when a note has a drawing.',
        'Photos: right-click lets you choose whether a photo keeps its size or shrinks when the note gets narrower.',
        'The spelling button moved to the left group. On normal-width notes Add becomes a round + so every button fits. The Add-menu drawing pad is now called “Sketch”.',
        'New notes are a little wider (340px).',
      ],
    },
    {
      version: '1.0.4',
      date: '2026-10-22',
      changes: [
        'More reliable installer building: if Windows Security briefly blocks the last build step, build.bat waits and tries again, and explains how to allow it if needed. (1.0.3 was never built because of this; 1.0.4 includes all of its changes.)',
      ],
    },
    {
      version: '1.0.3',
      date: '2026-10-22',
      changes: [
        'Search box: a clear (×) button. Inside a group, search only looks in that group (“Search your notes inside this group”).',
        'While a group is open, New note makes the note inside that group.',
        'New card-size button next to sort: small, medium or large cards.',
        'Group settings now show which paper colour and font the notes inside share.',
        '“New note” button moved next to the CosmoNotes name, in a lighter colour.',
        'Settings: About moved to the end, the password is set or changed with a button, and a random-colour option for new notes.',
        'Notes list: real titles are bold and a bit bigger, and untitled notes show their first line semi-bold, so you can tell them apart.',
      ],
    },
    {
      version: '1.0.2',
      date: '2026-10-22',
      changes: [
        'Fixed: the notes list refreshed twice when changing the sort order (and flickered while typing in a note).',
        'Groups inside groups (a folder tree): drag notes or groups onto a group, and move things up via the back button or the path.',
        'Group settings: four looks (stack, folder, envelope, notebook) and 8 group colours.',
        'Change the colour or font of every note in a group at once.',
        'Lock whole groups with the same password.',
        'Right-click menus in the notes list to lock or unlock notes and groups without opening them, and more.',
        'Moving a note to the Bin asks first. Shift+click the bin button skips the question.',
        'Ungrouping asks first.',
        'All pop-ups (questions, passwords, messages) are now in the app’s own style instead of Windows boxes.',
        'Versioning rule: every update raises the version number.',
      ],
    },
    {
      version: '1.0.1',
      date: '2026-10-21',
      changes: [
        'Renamed from Sticky Pins to CosmoNotes. Existing notes are copied over automatically.',
        'Top bar: an All notes button, and roll-up moved onto the bar next to the pin.',
        'Optional note titles, shown on the top bar.',
        'Lock notes with one password or PIN.',
        'Spelling on/off button on each note. Spelling is ignored by default and Cyrillic is never underlined.',
        'New A button for text colour, highlight and size, moved out of Add.',
        'Resize photos by dragging their corner.',
        'Last-edited stamp on notes, and created and edited dates in the ⋯ menu.',
        'Notes list: groups made by drag and drop, with names.',
        'Notes list: sorting options, and cards show the date each note was created.',
        'About section with everything the app can do, plus this version history.',
      ],
    },
    {
      version: '1.0.0',
      date: '2026-10-21',
      changes: [
        'First version, released as “Sticky Pins”.',
        'Local-only, crash-safe saving, daily backups and a Bin for deleted notes.',
        'Pin on top, see-through slider and roll-up. Notes reopen in the same spot.',
        '8 colours, 2 fonts, 3 text sizes, formatting and checklists.',
        'Add menu: photos, voice notes, drawings, links, tables, numbers, divider and date.',
        'Notes list with search and Settings. Starts with Windows. Windows installer.',
      ],
    },
  ],
};
