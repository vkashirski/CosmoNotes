'use strict';
/*
 * CosmoNotes - what the app can do.
 * Shown in the notes list -> Settings -> About CosmoNotes.
 *
 * Since 1.1.41 the app shows no version history: it is only in CHANGELOG.md (and CHANGELOG-archive.md).
 * On every update set LAST_UPDATED, and keep FEATURES in step with what you added or changed.
 * Keep each item short: one or two plain sentences.
 */
window.COSMO_ABOUT = {
  LAST_UPDATED: '2026-11-14',

  FEATURES: [
    {
      title: 'Notes that never get lost',
      items: [
        'Everything saves on this device as you type. No cloud, no account.',
        'Saving is crash-safe. A power cut can’t leave a note half-written.',
        'All notes are backed up every day, and 30 days are kept. Restore a day from Settings: its notes come back in their own group.',
        'Deleted notes go to the Bin first, so you can bring them back.',
        'Locked notes and groups can’t be deleted until you remove the lock.',
        'Uninstalling the app keeps your notes.',
      ],
    },
    {
      title: 'Sticky notes on your desktop',
      items: [
        'Pin a note to keep it above every other window.',
        'Click-through: read a pinned note over a video or game, and click what’s under it. Turn it on in Settings.',
        'Make a note see-through. It can turn solid while your mouse is over it.',
        'Roll a note up to just its top bar.',
        'Minimise and maximise buttons next to the X. Double-click the top bar to maximise.',
        'Notes reopen where you left them, also after a restart.',
        'Starts with Windows (you can turn this off).',
        '17 paper colours, light and dark. The colour row in the ⋯ menu scrolls sideways.',
        'Evening colours: light notes turn a softer shade in the evening, so they don’t glare. Pick the times in Settings.',
        'Three fonts for each note: Handwritten, Rounded or Medieval.',
        'An optional title on the top bar, in the note’s font or its own.',
        'Ctrl + mouse wheel zooms a note. Ctrl + 0 goes back to 100%.',
        'Shows when a note was last edited. The ⋯ menu shows when it was made.',
      ],
    },
    {
      title: 'Writing',
      items: [
        'Bold, italic, underline, strikethrough, bullet lists and checklists.',
        'Drag a checkbox to move its item. Ticked items can move to the bottom. Turning that on in a note tidies its lists.',
        'Checkboxes can keep one size. Change these in Settings, or for one note in its ⋯ menu.',
        'Copy and paste keeps checklist boxes, fonts, sizes and colours.',
        'Ctrl+F finds words in a note.',
        'The A button opens a text toolbar: font, colour, highlight and size. It changes the selected text, or what you type next.',
        'Spelling check, on or off for each note. Cyrillic words can be skipped.',
        'Word wrap on or off for each note. With it off, a line only ends where you press Enter.',
        'Links become clickable as you type them.',
      ],
    },
    {
      title: 'Draw over your notes',
      items: [
        'The squiggle button lets you draw on top of a note: circle words, underline, add arrows.',
        'Pen, highlighter, line, arrow, square, circle and eraser. 8 colours, 3 thicknesses.',
        'Solid, dashed or dotted lines.',
        'Two erasers: “Partial” erases under the circle, “Whole line” removes a whole line.',
        'Hold Shift for straight lines, squares and circles.',
        'Draw “Over” the text, or “Behind” it like marker on paper.',
        'Toolbars and menus can be dragged anywhere, also out of the note. Near its side they stick to it.',
        'Undo and Redo (Ctrl+Z, Ctrl+Y) work on drawing and text.',
        'Pause drawing to type, or “Clear all” to start over.',
        'Drawings stay where you put them. You get a warning before anything could move.',
      ],
    },
    {
      title: 'Effects',
      items: [
        'Moving pictures behind a note: snow, rain, fireworks, fish, a night sky, magic and many more.',
        'Mouse followers: a trail behind your pointer, one for every background.',
        'The mouse can play with the background: bubbles pop, rain splashes, fish dart away.',
        'Pick them for all notes in Settings → Effects, or for one note in its ⋯ menu. Set how often and how faint.',
        'Pause one note’s effects with the sparkle button, or all of them in the notes list.',
        'Cards in the notes list show their note’s effect too.',
        'Effects are kept light. They stop while a note is paused, rolled up or hidden.',
      ],
    },
    {
      title: 'The Add button',
      items: [
        'Photos: from a file, pasted or dragged in. Drag a corner to resize.',
        'Right-click a photo to add a description. Search finds the photo by it.',
        'Voice recordings you can play inside the note. They save while you talk, so closing the note or a crash keeps them.',
        'Voice to text: talk, and the words appear in your note. It all stays on this device.',
        'Transcribe: right-click a voice note to turn it into text.',
        'Voice to text needs a one-time download in Settings. Then it works offline.',
        'Pick in Settings if the words appear while you talk or when you stop.',
        'Sketches: a small drawing pad that becomes a picture.',
        'Links, tables, numbered lists, dividers and today’s date.',
      ],
    },
    {
      title: 'Privacy',
      items: [
        'Lock a note or group with one password or PIN. Its title and words are hidden.',
        'Locked notes are encrypted on this device, backups too. Nobody can read them from the files.',
        'A “Title while locked” tells you which note it is. You can change it only while the note is unlocked.',
        'A locked note can’t be changed until you unlock it. You can only select it or use its lock options.',
        'Forgot your PIN? A recovery key opens everything (Settings → Locked notes).',
        'A PIN opens as soon as you type the last digit.',
        'Right-click a locked note or group → Unlock. It stays unlocked until CosmoNotes restarts.',
        '“Remove lock” takes the lock off for good.',
        'A locked group asks once. Its notes then open until you close the list.',
        'Locking plays a short padlock animation.',
        'Panic button: one click closes your notes, locks them and hides CosmoNotes. Turn it on in Settings.',
        'The panic button can have a shortcut that works in every app, like Alt+Z or F8.',
        'A note can stay open on panic. Opening CosmoNotes again brings the other notes back.',
      ],
    },
    {
      title: 'Notes list',
      items: [
        'Every note at a glance, with its colour and date.',
        'A card shows a note’s picture where it is in the note, at its size.',
        'A card fades out at the bottom when the note has more.',
        'A card shows the words as the note does: fonts, colours, sizes, bold and more.',
        'Search titles and text. Inside a group, search looks only there. The Bin has its own search.',
        'Settings has a search too. Type a word to see only the sections with it. It knows other names too, like “dark mode”.',
        'Five card sizes, also with Ctrl + mouse wheel.',
        'Nine colour themes for this window, light and dark.',
        'Right-click a note or group for quick actions.',
        'Right-click → Edit design… changes a note’s title, title font, colour and effects right in the list.',
        'The Locked tab shows every locked note. “Unlock all” lets you read and search them.',
        'Favourites: click the star on a card. The Favourites tab shows them all.',
        'Ctrl+click picks several cards. A bar then opens, stars, groups, locks or bins them at once.',
        'Edit design in that bar changes the colour, see-through, fonts and effects of them all.',
        'Moving to the Bin asks first. Shift+click skips the question.',
        'Closed a note by mistake? Ctrl+Shift+T here, or the tray’s “Reopen closed note”, opens it again.',
        'Sort by last edited or date made, newest or oldest first.',
        'A setting a note changed for itself shows in Settings. “Use on all notes” puts the Settings one back.',
      ],
    },
    {
      title: 'Groups',
      items: [
        'Drag a note onto another to make a group. The card it goes into is outlined.',
        'Groups can hold groups, like folders. The mouse’s back and forward buttons move between levels.',
        'Four looks for a group (paper stack, folder, envelope, notebook) in 8 colours.',
        'Name, lock or ungroup a group, or bin all its notes.',
        '“New note” inside an open group puts the note there.',
        'Change the colour or font of every note in a group at once.',
        'New notes can get one colour, or a random one from several.',
      ],
    },
    {
      title: 'Updates',
      items: [
        'CosmoNotes looks for a new version on GitHub when it starts and once a day. Turn it off in Settings → About.',
        'A new version shows a dot on Settings and a line in the tray menu.',
        'Install saves your notes, updates, and opens CosmoNotes again with your notes where they were.',
        'The download is checked before it runs. A wrong or broken file is never started.',
      ],
    },
  ],
};
