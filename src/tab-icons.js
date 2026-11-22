'use strict';
// The 40 icons a tab of the notes list can wear (the owner's set, 1.4.33): Favourites is always the star, Locked the lock,
// the Bin the trash can; a group can have any one of them, or none (then its tab shows only its name). The list window
// (window.COSMO_TAB_ICONS) draws them; store.js requires it to check a group's `icon`. Each: [name, the svg's inside]
// on a 24×24 box, drawn as lines (fill none, stroke currentColor: the list's CSS for svg). Order = the picker's order.
(function (root) {
  const ICONS = {
    star: ['Star', '<path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9L3.4 9.4l6-.7z"/>'],
    lock: ['Lock', '<path d="M8 11V7a4 4 0 0 1 8 0v4"/><rect x="4" y="11" width="16" height="10" rx="2.5"/>'],
    trash: ['Bin', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'],
    note: ['Note', '<path d="M5 3h14a2 2 0 0 1 2 2v9l-7 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 21v-5a2 2 0 0 1 2-2h5"/>'],
    folder: ['Folder', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
    home: ['Home', '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'],
    work: ['Work', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'],
    uni: ['School', '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>'],
    book: ['Book', '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>'],
    cart: ['Shopping', '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.2a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>'],
    heart: ['Heart', '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>'],
    calendar: ['Calendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
    clock: ['Clock', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    bell: ['Bell', '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'],
    idea: ['Idea', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
    code: ['Code', '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'],
    travel: ['Travel', '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V4h6v3M8 7v13M16 7v13"/>'],
    food: ['Food', '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 3.5-3 7v3h3"/>'],
    coffee: ['Coffee', '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>'],
    gym: ['Fitness', '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'],
    music: ['Music', '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
    camera: ['Photos', '<path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'],
    gift: ['Gift', '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3 8 4s1 4 4 4zM12 8s1.5-5 4-4-1 4-4 4z"/>'],
    money: ['Money', '<path d="M3 7a2 2 0 0 1 2-2h12v2"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>'],
    person: ['Person', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
    family: ['Family', '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14a7 7 0 0 1 4 6"/>'],
    phone: ['Phone', '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'],
    mail: ['Mail', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'],
    place: ['Place', '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'],
    flag: ['Flag', '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'],
    todo: ['To-do', '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>'],
    pencil: ['Pencil', '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'],
    pet: ['Pets', '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.8" r="1.8"/><circle cx="14" cy="5.8" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M12 12c-2.5 0-5 3.5-5 6 0 1.5 1 2.5 2.5 2.5 1 0 1.8-.5 2.5-.5s1.5.5 2.5.5c1.5 0 2.5-1 2.5-2.5 0-2.5-2.5-6-5-6z"/>'],
    plant: ['Plant', '<path d="M4 20C4 10 9 4 20 4c0 11-6 16-16 16z"/><path d="M4 20c4-5 8-8 12-10"/>'],
    game: ['Games', '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="18" cy="13.5" r=".9"/>'],
    car: ['Car', '<path d="M5 17H3v-4l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v4h-2"/><path d="M3 13h18M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>'],
    health: ['Health', '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'],
    film: ['Films', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'],
    sun: ['Sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
    moon: ['Moon', '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'],
  };
  const IDS = Object.keys(ICONS);
  // the built-in tabs' icons, fixed
  const FIXED = { favs: 'star', locks: 'lock', bin: 'trash' };
  const clean = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(ICONS, id) ? id : null);
  const svg = (id) => (clean(id) ? `<svg viewBox="0 0 24 24">${ICONS[id][1]}</svg>` : '');
  const name = (id) => (clean(id) ? ICONS[id][0] : '');
  const api = { IDS, FIXED, clean, svg, name };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COSMO_TAB_ICONS = api;
})(typeof window !== 'undefined' ? window : globalThis);
