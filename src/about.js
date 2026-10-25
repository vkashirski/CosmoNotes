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
  LAST_UPDATED: '2026-10-25',

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
        '17 paper colours: the original 8 plus the colours of the list themes (Cream, Rose, Sage, Mist, Lavender, and the dark Night, Midnight, Forest and Plum). Each colour sits next to its light version, with the dark ones at the end. The colour row in the ⋯ menu scrolls sideways: drag it, use the mouse wheel, or the arrows at its ends.',
        'A handwritten or rounded font for each note.',
        'Optional title for each note, shown on the top bar.',
        'Ctrl + mouse wheel zooms a note’s writing, pictures and drawing in or out (Ctrl + 0 goes back to 100%). Each note remembers its zoom.',
        'Shows when the note was last edited, plus created and edited dates in the ⋯ menu.',
      ],
    },
    {
      title: 'Writing',
      items: [
        'Bold, italic, underline, strikethrough, bullet lists and tickable checklists.',
        'The A button opens a small text toolbar: font, colour, highlight, size and clear formatting, with undo. It changes the selected text; with nothing selected, it changes what you type next and leaves the rest of the note as it is (it says which). Colours include black. It stays open while you select text, and you can drag it anywhere.',
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
        'You can also drag the drawing toolbar, the text toolbar, the ⋯ menu and the Effects pop-up out of the note (the menu and Effects by the grip at their top). Close to one of the note’s sides it sticks to it and moves along when you move the note; you can slide it along that side, also past the corners; further away it stays where you put it. Drag it back onto the note to bring it inside again. It opens there again next time.',
        'Scrollbars only show while you’re using the note, like the bottom bar.',
        'Switch between drawing and typing just by using them: the bottom bar or the text toolbar switches to typing, a drawing tool switches back. The one you’re not using fades, so nothing disappears.',
        'The mouse pointer looks like a pencil or a marker in the colour you picked.',
        'Undo and Redo buttons in the bottom bar, left of Draw, at full strength while your mouse is on the note: they work on your drawing while you draw (last 50 steps, also after closing drawing) and on your text otherwise. Ctrl+Z undoes, Ctrl+Y redoes.',
        'The Pause button at the bottom of the drawing toolbar puts drawing on hold so you can type; “Carry on” goes back to drawing. “Clear all” next to it removes the whole drawing.',
        'Rolling a note up only hides the drawing and text toolbars; they come back as they were when you unroll it.',
        'Draw “Over” the text and pictures, or “Behind” them like marker on paper.',
        'Drawings stay exactly where you put them: drawing turns word wrap off, and you get a warning before anything could move away from a drawing.',
      ],
    },
    {
      title: 'Effects',
      items: [
        'Little moving effects in the background of a note: snow, fireworks, stardust, fireflies, bubbles, autumn leaves, hearts, rain, confetti, the Matrix’s digital rain and a rainbow (it draws itself in across the note, from a different side each time, then fades; once in a while it’s a double rainbow).',
        'And since 1.1.18: plankton that lights up as a wave rolls by, fairy dust, warp speed, a network of dots, campfire embers, the Lorenz butterfly, cherry blossom whirls, a night sky with shooting stars, a glitch, a black hole, a digital ocean, silk waves, glass shards, XP orbs, a shape shifter, a ghost ripple, a school of fish, a solar system, a contour map, a neon tunnel, synthwave and dust in light.',
        'Mouse followers that trail your pointer over a note, with the same names and icons as the backgrounds, in the same order: snow, fireworks, stardust, fireflies, bubbles, autumn leaves, hearts, rain, confetti, Matrix and rainbow (the thin line that changes colour as you move), plus a pencil line.',
        'Pick them for all notes in Settings → Effects → Choose…, or for one note in its ⋯ menu → Effects…, each with a frequency (Rarely, Normal or Often) and an opacity (how see-through it is, 10 % to 100 %). A note’s own choice wins, unless Settings says to use the same on every note (each note’s own choice comes back when you switch that off).',
        'Pause a note’s effects with the sparkle button on its top bar, or all of them with the sparkle button left of Settings in the notes list, in Settings, or in the menu of the CosmoNotes icon by the clock. Playing a note’s effects while all are paused keeps that note playing.',
        'Pop-ups and toolbars on a note use the colours of the app’s theme (Settings → General).',
        'Cards in the notes list show their note’s effect too.',
        'They’re kept light: a limited number of shapes, at most 30 pictures a second, and nothing at all while a note is paused, rolled up or hidden.',
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
        'Right-click a note → Edit… to change its title and colour right in the list. An open note changes along with it (and what you type in a note shows in the list too).',
        'The Locked tab (next to Favourites) shows every locked note and group. Locked notes never show their words, and searching doesn’t look inside them; “Unlock all” (with your PIN or password) uncovers them all in the list so you can read and search them, and “Lock again” covers them again.',
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
        'Settings for start-up and the window colours (General), colours, font, see-through and “turn solid when my mouse is over it” for new notes (For new notes), spelling, the password, backups and where notes are stored.',
        'For new notes, pick one colour or several: with several, each new note gets one of them at random. A switch (on at first) makes sure a new note never gets the same colour as the one made just before it.',
      ],
    },
  ],

  // Short, plain-language highlights for the in-app history (the full details are in CHANGELOG.md)
  VERSIONS: [
    {
      version: '1.1.18',
      date: '2026-10-25',
      changes: [
        '22 new background effects, picked in the Effect Lab: Plankton, Fairy dust, Warp speed, Network, Embers, Lorenz, Cherry blossom, Night sky, Glitch, Black hole, Digital ocean, Silk waves, Glass shards, XP orbs, Shape shifter, Ghost ripple, Fish, Solar system, Contour map, Neon tunnel, Synthwave and Dust in light.',
      ],
    },
    {
      version: '1.1.17',
      date: '2026-10-25',
      changes: [
        'An Opacity slider for the background effect and for the mouse follower, so they can be made fainter (10 % to 100 %). For all notes in Settings → Effects → Choose…, or for one note in its ⋯ menu → Effects….',
      ],
    },
    {
      version: '1.1.16',
      date: '2026-10-25',
      changes: [
        'Effects in the background of a note (snow, fireworks, stardust, the Matrix’s digital rain, a rainbow and more) and mouse followers that trail your pointer.',
        'Choose them for all notes in Settings, or for one note in its ⋯ menu, with a frequency (Rarely, Normal or Often); a note’s own choice wins unless Settings uses the same on every note.',
        'Pause them on one note (sparkle button on its top bar) or on all notes (sparkle button left of Settings, Settings, or the tray icon).',
        'The text toolbar can go outside the note too, and sticks to its side like the drawing toolbar.',
        'With nothing selected, the text toolbar changes only what you type next (not the whole note). Black is one of the text colours.',
        'Fireworks look more natural: rockets lean a little, bursts are uneven and fade slowly.',
        'The Effects pop-up on a note is smaller, with Background and Mouse tabs, each with its own frequency. Rarely really means a few, Often really means lots.',
        'Mouse followers now have the same names and icons as the backgrounds, and there are new Fireworks and Rainbow mouse followers.',
        'The ⋯ menu and the Effects pop-up can be dragged by their grip, also out of the note, like the toolbars. A toolbar stuck to a side can slide past the note’s corners.',
        'Playing effects on one note while all are paused now works (that note keeps playing).',
        'Pop-ups and toolbars follow the app’s colour theme.',
        'Picking a mouse follower no longer restarts the background effect.',
        'Fireworks reach all the way up on big notes.',
        'Fixed: the text toolbar was as wide as the note, and squashed when dragged out of it.',
        'A right-clicked note in the list gets a faint outline while its menu is open.',
        'In a small note, the X of the ⋯ menu, the Effects pop-up and the text and drawing toolbars always stays visible.',
      ],
    },
    {
      version: '1.1.15',
      date: '2026-10-24',
      changes: [
        'Nine new note colours, from the list themes (also the dark ones), each next to its matching colour. The colour row scrolls sideways; the circles stay the same size.',
        'Right-click a note in the list → Edit… to change its title and colour there. An open note changes along with it.',
        'For new notes, pick several colours: each new note gets one of them at random, never the same colour twice in a row (a switch in Settings).',
        'Drag the drawing toolbar out of the note: near a side it sticks to the note and moves with it. Pause and Clear all are now inside the toolbar.',
        'A Locked tab with “Unlock all” and “Lock again”.',
        'The ⋯ menu has an X to close it.',
        'Fixed: a tiny bit of the padlock’s shackle showed inside the lock.',
      ],
    },
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
