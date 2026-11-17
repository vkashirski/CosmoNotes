'use strict';
const path = require('path');

const APP_NAME = 'CosmoNotes';
const OLD_DATA_DIR = 'Sticky Pins'; // where notes lived before the rename

const PAPER = {
  yellow: '#FFF4A3', pink: '#FFD6E6', green: '#D8F5C4', blue: '#D2ECFF',
  purple: '#E8DDFF', orange: '#FFDFBF', mint: '#CDF3E8', charcoal: '#3A3940',
  // 1.1.15: the list themes' colours
  cream: '#F5EDD9', rose: '#FBE1E8', sage: '#DCEFE4', mist: '#DCEAF8', lavender: '#E7E0F9',
  night: '#2F2D35', midnight: '#252B3D', forest: '#232E28', plum: '#2D2432',
};
const ROLLED_H = 34;
const MIN_W = 200;
const MIN_H = 120;
const DEFAULT_W = 340;
const DEFAULT_H = 300;
const BIG = 16384;
const ASSETS = path.join(__dirname, '..', 'assets');
const WIN_ICON = path.join(ASSETS, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const PRELOAD = path.join(__dirname, '..', 'preload.js');
const EDITABLE = ['title', 'coverTitle', 'html', 'text', 'firstImage', 'ink', 'wrapWidth', 'nowrap', 'color', 'font', 'titleFont', 'size', 'opacity', 'solidOnHover', 'pinned', 'pinApps', 'clickThrough', 'rolled', 'spell', 'checklist', 'evening', 'panic', 'zoom', 'fx', 'fxPaused', 'fxPlay'];
// 1.1.30: the title too (a locked note shows its coverTitle instead); these are what main/crypt.js seals
// 1.4.1: and the reminders' messages (note.remindMsg); 1.4.10: and its tags (note.tags, [] while hidden: locks.js viewOf)
const SECRET = ['title', 'html', 'text', 'firstImage', 'ink', 'remindMsg', 'tags'];
// 1.3.28 (the owner's wish): all that the window of a hidden locked note may change: where its window sits, not the note
// (1.3.34: and click-through, its window's mouse: the button stays the one thing that works on it; 1.4.5: and the apps
// it is pinned over, a kind of pin)
const WHILE_HIDDEN = ['pinned', 'pinApps', 'clickThrough', 'rolled'];
const ATT_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'webm', 'ogg', 'mp3', 'm4a', 'wav'];

const WELCOME_HTML =
  '<div>Welcome to CosmoNotes ✨</div>' +
  '<ul class="checklist">' +
  '<li class="done">Open the app</li>' +
  '<li>Click the pin at the top to keep a note above other windows</li>' +
  '<li>Click ⋯ for a title, colours, see-through and the lock</li>' +
  '<li>Click <b>Add</b> at the bottom for photos, voice, drawings and more</li>' +
  '</ul>' +
  '<div>Everything saves on this device, instantly.</div>';
module.exports = { APP_NAME, ASSETS, ATT_EXT, BIG, DEFAULT_H, DEFAULT_W, EDITABLE, MIN_H, MIN_W, OLD_DATA_DIR, PAPER, PRELOAD, ROLLED_H, SECRET, WELCOME_HTML, WHILE_HIDDEN, WIN_ICON };
