'use strict';
// CosmoNotes "All notes" window, part 1 of 7: colours, themes, sizes, icons, the DOM helper, the colour row, data (load)
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  // K: the names the parts share. V: variables more than one part changes (V.tab etc.). K.later('f'): a function a later part
  // defines, looked up when it is called.
  const K = window.COSMO_LIST_KIT = { V: {}, later: (n) => (...a) => K[n](...a) };
  const { V } = K;
  // defined in a later part:
  const render = K.later('render'), editRefresh = K.later('editRefresh'), showKeyIfNeeded = K.later('showKeyIfNeeded');
  const S = window.sticky;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // paper colours (1.1.15: with the colours of this window's themes), in the order they're shown:
  // each colour next to its light version, the dark ones last (same as store.js)
  const COLORS = ['yellow', 'cream', 'orange', 'pink', 'rose', 'purple', 'lavender', 'blue', 'mist', 'mint', 'sage', 'green',
    'charcoal', 'night', 'plum', 'midnight', 'forest'];
  const DARK_COLORS = ['charcoal', 'night', 'midnight', 'forest', 'plum'];
  const COLOR_NAMES = {
    yellow: 'Lemon', pink: 'Bubblegum', green: 'Lime', blue: 'Sky', purple: 'Lilac', orange: 'Peach', mint: 'Mint', charcoal: 'Charcoal',
    cream: 'Cream', rose: 'Rose', sage: 'Sage', mist: 'Mist', lavender: 'Lavender', night: 'Night', midnight: 'Midnight', forest: 'Forest', plum: 'Plum',
  };
  // the dark theme colours are all nearly black: a small dot of each theme's own colour tells them apart
  const darkDot = (dot, paper) => `radial-gradient(circle, ${dot} 0 22%, ${paper} 25%)`;
  const SWATCH = {
    yellow: '#FFE968', pink: '#FFB5D0', green: '#B9E79C', blue: '#A9D8FF', purple: '#D0BDFF', orange: '#FFC38C', mint: '#A4E5D1', charcoal: '#3A3940',
    cream: '#E8DCC0', rose: '#F2CAD6', sage: '#C4E2D1', mist: '#C5DAF0', lavender: '#D5CAF2',
    night: darkDot('#8E7BEF', '#2F2D35'), midnight: darkDot('#6E8BFF', '#252B3D'), forest: darkDot('#5BBF8A', '#232E28'), plum: darkDot('#C77DDB', '#2D2432'),
  };
  // group colours (for folders, envelopes, notebooks and the clip of a stack)
  const GCOLORS = { kraft: '#D9B77E', sun: '#FFD54F', rose: '#F4A6C0', coral: '#FF9F87', lilac: '#BFA9F2', sky: '#92C6F2', mint: '#93D8BF', graphite: '#6E6A78' };
  const GNAMES = { kraft: 'Kraft', sun: 'Sunshine', rose: 'Rose', coral: 'Coral', lilac: 'Lilac', sky: 'Sky', mint: 'Mint', graphite: 'Graphite' };
  // colours of this window (Settings → General). The colours themselves live in list.css (body[data-theme]).
  const THEMES = [
    { id: 'cream', name: 'Cream', bg: '#FBF6EC', dot: '#FFE45C' },
    { id: 'rose', name: 'Rose', bg: '#FFF0F3', dot: '#F4A6C0' },
    { id: 'mint', name: 'Mint', bg: '#EDF8F2', dot: '#93D8BF' },
    { id: 'sky', name: 'Sky', bg: '#EDF5FD', dot: '#92C6F2' },
    { id: 'lilac', name: 'Lilac', bg: '#F4F0FD', dot: '#BFA9F2' },
    { id: 'night', name: 'Night', bg: '#25232A', dot: '#8E7BEF', dark: true },
    { id: 'midnight', name: 'Midnight', bg: '#1D2232', dot: '#6E8BFF', dark: true },
    { id: 'forest', name: 'Forest', bg: '#1C2520', dot: '#5BBF8A', dark: true },
    { id: 'plum', name: 'Plum', bg: '#251D29', dot: '#C77DDB', dark: true },
  ];
  // card sizes in the notes list (and the Bin), smallest first. Ctrl + mouse wheel steps through them.
  const SIZES = ['s', 'm', 'l', 'xl', 'xxl'];
  const SIZE_NAMES = { s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large', xxl: 'Biggest' };
  const sizeNow = () => (SIZES.includes(V.state.settings.listSize) ? V.state.settings.listSize : 'm');
  const themeNow = () => (THEMES.some((t) => t.id === V.state.settings.listTheme) ? V.state.settings.listTheme : 'cream');
  const ICON = {
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    hide: '<svg viewBox="0 0 24 24"><path d="M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.67 2.68M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    unlock: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3.5-4 3.5h-1.8a1.7 1.7 0 0 0-1.2 2.9c.7.8.3 2.6-1.4 3.4-.5.2-1 .2-1.6.2z"/><circle cx="7.5" cy="10.5" r="1.3"/><circle cx="11" cy="6.5" r="1.3"/><circle cx="16" cy="8" r="1.3"/></svg>',
    ungroup: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M14 7h3a2 2 0 0 1 2 2v1M10 17H7a2 2 0 0 1-2-2v-1"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    restore: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    // 1.1.14: the padlock that animates ("snap shut"): its shackle's long side reaches down inside the body (hidden by
    // the clip path #lockClip in list.html: nothing of the shackle below the middle of the body's top line, 1.1.15),
    // so it never comes loose when the shackle opens, and never shows inside the body
    lockA: '<svg viewBox="0 0 24 24"><g clip-path="url(#lockClip)"><path class="shackle" d="M8 16.5V7a4 4 0 0 1 8 0v4"/></g><rect x="4" y="11" width="16" height="10" rx="2.5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9L3.4 9.4l6-.7z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  };

  V.state = { notes: [], groups: [], settings: {} };
  V.lastSig = '';
  V.tab = 'notes';
  const cardsTabNow = () => V.tab === 'notes' || V.tab === 'favs' || V.tab === 'locks'; // tabs that show cards
  V.lastTab = 'notes'; // notes, favourites or bin: where clicking Settings again goes back to
  // group levels visited, for the mouse's back / forward buttons (null = all notes)
  let navBack = [];
  V.navFwd = [];
  V.shownGroup = null;
  V.navigating = false;
  V.query = '';
  V.binQuery = '';
  V.openGroup = null; // id of the group being looked at (null = top level)
  V.drag = null; // { id, kind: 'note' | 'group', at } while dragging
  V.renderLater = false;
  // 1.1.13: cards picked with Ctrl+click (keys "n:<id>" / "g:<id>"), the last one clicked (for Shift+click),
  // and how locked each card looked last time (for the lock / unlock animation)
  const sel = new Set();
  V.selAnchor = null;
  V.lockSeen = new Map();

  // ---------- tiny DOM helper
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  // Date formats, made once: the same output as toLocale…String(), but a new formatter for every card
  // was most of the time a notes-list redraw took.
  const FMT = {
    time: new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }),
    weekday: new Intl.DateTimeFormat([], { weekday: 'long' }),
    dayMonth: new Intl.DateTimeFormat([], { day: 'numeric', month: 'short' }),
    dayMonthYear: new Intl.DateTimeFormat([], { day: 'numeric', month: 'short', year: 'numeric' }),
    full: new Intl.DateTimeFormat([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };
  function when(ts) {
    const d = new Date(ts);
    const now = new Date();
    const time = FMT.time.format(d);
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return `Today ${time}`;
    if (diff === 1) return `Yesterday ${time}`;
    if (diff < 7) return FMT.weekday.format(d);
    return (d.getFullYear() === now.getFullYear() ? FMT.dayMonth : FMT.dayMonthYear).format(d);
  }
  const full = (ts) => FMT.full.format(new Date(ts));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function tilt(id) {
    let x = 0;
    for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return ((x % 7) - 3) * 0.45;
  }

  // ================================================================ colour row
  // A row of colour circles that scrolls sideways (1.1.15): drag it, use the mouse wheel, or the arrows that
  // show up on a side when there are more colours that way. A drag never counts as picking a colour.
  // (The same function is in note.js.)
  function swatchStrip(view) {
    const wrap = view.parentElement;
    const arrow = (side) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `swarr ${side}`;
      b.title = 'More colours';
      b.setAttribute('aria-label', side === 'l' ? 'More colours to the left' : 'More colours to the right');
      b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${side === 'l' ? 'm14.5 6-6 6 6 6' : 'm9.5 6 6 6-6 6'}"/></svg>`;
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keeps the focus where it was
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        view.scrollBy({ left: (side === 'l' ? -1 : 1) * Math.max(60, Math.round(view.clientWidth * 0.75)), behavior: 'smooth' });
      });
      wrap.append(b);
      return b;
    };
    const left = arrow('l');
    const right = arrow('r');
    const paint = () => {
      const max = view.scrollWidth - view.clientWidth;
      left.hidden = view.scrollLeft <= 1;
      right.hidden = max <= 1 || view.scrollLeft >= max - 1;
    };
    view.addEventListener('scroll', paint, { passive: true });
    new ResizeObserver(paint).observe(view);
    view.addEventListener('wheel', (e) => {
      if (view.scrollWidth <= view.clientWidth + 1) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      view.scrollLeft += d;
    }, { passive: false });
    let drag = null;
    view.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, left: view.scrollLeft, moved: false, id: e.pointerId };
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        view.classList.add('dragging');
        try { view.setPointerCapture(e.pointerId); } catch { /* fine */ }
      }
      view.scrollLeft = drag.left - dx;
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      view.classList.remove('dragging');
      if (moved) { view.dataset.dragged = '1'; setTimeout(() => { delete view.dataset.dragged; }, 0); }
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
    view.addEventListener('click', (e) => { if (view.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    paint();
    return {
      paint,
      // scroll so a colour (the chosen one) is in view
      reveal(el) {
        if (!el) { paint(); return; }
        const l = el.offsetLeft;
        const r = l + el.offsetWidth;
        if (l < view.scrollLeft + 6 || r > view.scrollLeft + view.clientWidth - 6) view.scrollLeft = Math.max(0, l - (view.clientWidth - el.offsetWidth) / 2);
        paint();
      },
    };
  }

  // ---------- data
  // Redraw only when something really changed, and only animate the cards when
  // the view itself changes (tab, group, search, sort). Fixes the "double refresh".
  async function load() {
    const next = await S.list.get();
    const sig = JSON.stringify(next);
    if (sig === V.lastSig) return;
    V.lastSig = sig;
    V.state = next;
    editRefresh();
    if (V.drag) { V.renderLater = true; return; }
    render();
    showKeyIfNeeded(); // 1.1.30: encryption was just set up (maybe from a note window): show the recovery key once
  }
  S.list.onChanged(load);

  const live = () => V.state.notes.filter((n) => !n.deletedAt);
  // 1.2.3 (speed): a note by its id without searching the whole list for every card. The index is made again whenever
  // V.state.notes is a new list (each load); nothing adds to or removes from that list in place.
  let idxOf = null; let idx = new Map();
  function noteById(id) {
    if (idxOf !== V.state.notes) { idxOf = V.state.notes; idx = new Map(V.state.notes.map((n) => [n.id, n])); }
    return idx.get(id);
  }
  const groupById = (id) => V.state.groups.find((g) => g.id === id);
  const childGroups = (pid) => V.state.groups.filter((g) => (g.parentId || null) === (pid || null));
  function chainOf(id) {
    const out = [];
    const seen = new Set();
    for (let g = groupById(id); g && !seen.has(g.id); g = groupById(g.parentId)) { seen.add(g.id); out.push(g); }
    return out; // innermost first
  }
  function subtreeIds(id) {
    const ids = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of V.state.groups) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; }
    }
    return ids;
  }
  const notesInTree = (id) => { const ids = subtreeIds(id); return live().filter((n) => n.groupId && ids.has(n.groupId)); };
  const isInside = (id, ancestorId) => chainOf(id).some((g) => g.id === ancestorId);
  // 1.1.13: locked = its own lock or a locked group around it. Locked notes and groups can't be deleted.
  const noteIsLocked = (n) => !!(n.ownLock || n.locked || chainOf(n.groupId).some((g) => g.locked));
  function groupIsLocked(g) {
    if (chainOf(g.id).some((x) => x.locked)) return true;
    const ids = subtreeIds(g.id);
    return V.state.groups.some((x) => ids.has(x.id) && x.locked) || notesInTree(g.id).some((n) => n.ownLock);
  }
  const LOCKED_NO_DELETE = 'Locked notes and groups can’t be deleted. Remove the lock first.';
  // shown in the list, i.e. not inside a locked group that hasn't been opened with the password
  const noteShown = (n) => !n.groupId || !groupById(n.groupId) || groupById(n.groupId).open;
  const groupShown = (g) => !g.parentId || !groupById(g.parentId) || groupById(g.parentId).open;
  // Locked (1.1.15): every note with its own lock and every locked group. Ones inside a locked group that
  // isn't open stay hidden (a line under the cards says how many) until "Unlock all".
  function lockedOnes() {
    const notes = live().filter((n) => n.ownLock);
    const groups = V.state.groups.filter((g) => g.locked && notesInTree(g.id).length);
    const sn = notes.filter(noteShown);
    const sg = groups.filter(groupShown);
    return { notes: sn, groups: sg, hidden: notes.length + groups.length - sn.length - sg.length };
  }
  function favourites() {
    const notes = live().filter((n) => n.favorite);
    const groups = V.state.groups.filter((g) => g.favorite && notesInTree(g.id).length);
    const sn = notes.filter(noteShown);
    const sg = groups.filter(groupShown);
    return { notes: sn, groups: sg, hidden: notes.length + groups.length - sn.length - sg.length };
  }

  function sortPrefs() {
    return { by: 'updated', dir: 'desc', groups: 'mixed', ...(V.state.settings.listSort || {}) };
  }
  function keyOf(item, by) {
    if (item.kind === 'group') {
      return by === 'created' ? item.group.createdAt : Math.max(item.group.createdAt, ...item.notes.map((n) => n.updatedAt));
    }
    return by === 'created' ? item.note.createdAt : item.note.updatedAt;
  }
  function sortItems(items) {
    const p = sortPrefs();
    const sign = p.dir === 'asc' ? 1 : -1;
    items.sort((a, b) => sign * (keyOf(a, p.by) - keyOf(b, p.by)));
    if (p.groups !== 'mixed') {
      const groups = items.filter((i) => i.kind === 'group');
      const notes = items.filter((i) => i.kind === 'note');
      return p.groups === 'first' ? [...groups, ...notes] : [...notes, ...groups];
    }
    return items;
  }

  Object.assign(K, { S, $, $$, COLORS, DARK_COLORS, COLOR_NAMES, SWATCH, GCOLORS, GNAMES, THEMES, SIZES, SIZE_NAMES,
    sizeNow, themeNow, ICON, cardsTabNow, navBack, sel, h, when, full, plural, tilt, swatchStrip, load, live, noteById,
    groupById, childGroups, chainOf, subtreeIds, notesInTree, isInside, noteIsLocked, groupIsLocked, LOCKED_NO_DELETE,
    lockedOnes, favourites, sortPrefs, sortItems });
})();
