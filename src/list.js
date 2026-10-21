'use strict';
(() => {
  const S = window.sticky;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange', 'mint', 'charcoal'];
  const SWATCH = { yellow: '#FFE968', pink: '#FFB5D0', green: '#B9E79C', blue: '#A9D8FF', purple: '#D0BDFF', orange: '#FFC38C', mint: '#A4E5D1', charcoal: '#3A3940' };
  // group colours (for folders, envelopes, notebooks and the clip of a stack)
  const GCOLORS = { kraft: '#D9B77E', sun: '#FFD54F', rose: '#F4A6C0', coral: '#FF9F87', lilac: '#BFA9F2', sky: '#92C6F2', mint: '#93D8BF', graphite: '#6E6A78' };
  const GNAMES = { kraft: 'Kraft', sun: 'Sunshine', rose: 'Rose', coral: 'Coral', lilac: 'Lilac', sky: 'Sky', mint: 'Mint', graphite: 'Graphite' };
  const ICON = {
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
    warn: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  };

  let state = { notes: [], groups: [], settings: {} };
  let lastSig = '';
  let tab = 'notes';
  let query = '';
  let openGroup = null; // id of the group being looked at (null = top level)
  let showAllBackups = false;
  let drag = null; // { id, kind: 'note' | 'group', at } while dragging
  let renderLater = false;

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

  function when(ts) {
    const d = new Date(ts);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return `Today ${time}`;
    if (diff === 1) return `Yesterday ${time}`;
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  const full = (ts) => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function tilt(id) {
    let x = 0;
    for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return ((x % 7) - 3) * 0.45;
  }

  // ---------- data
  // Redraw only when something really changed, and only animate the cards when
  // the view itself changes (tab, group, search, sort). Fixes the "double refresh".
  async function load() {
    const next = await S.list.get();
    const sig = JSON.stringify(next);
    if (sig === lastSig) return;
    lastSig = sig;
    state = next;
    if (drag) { renderLater = true; return; }
    render();
  }
  S.list.onChanged(load);

  const live = () => state.notes.filter((n) => !n.deletedAt);
  const groupById = (id) => state.groups.find((g) => g.id === id);
  const childGroups = (pid) => state.groups.filter((g) => (g.parentId || null) === (pid || null));
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
      for (const g of state.groups) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; }
    }
    return ids;
  }
  const notesInTree = (id) => { const ids = subtreeIds(id); return live().filter((n) => n.groupId && ids.has(n.groupId)); };
  const isInside = (id, ancestorId) => chainOf(id).some((g) => g.id === ancestorId);

  function sortPrefs() {
    return { by: 'updated', dir: 'desc', groups: 'mixed', ...(state.settings.listSort || {}) };
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

  // ---------- rendering
  function render(animate = false) {
    const liveNotes = live();
    const binned = state.notes.filter((n) => n.deletedAt);
    if (openGroup && (!groupById(openGroup) || !groupById(openGroup).open || !notesInTree(openGroup).length)) {
      // the group went away (emptied, ungrouped or locked again): go to the nearest level that still exists
      const up = chainOf(openGroup).find((g) => g.id !== openGroup && g.open && notesInTree(g.id).length);
      openGroup = up ? up.id : null;
    }
    $('#cNotes').textContent = liveNotes.length;
    $('#cBin').textContent = binned.length;
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    $('#viewNotes').hidden = tab !== 'notes';
    $('#viewBin').hidden = tab !== 'bin';
    $('#viewSettings').hidden = tab !== 'settings';
    $('#cards').classList.toggle('anim', animate);
    $('#binCards').classList.toggle('anim', animate);
    const size = ['s', 'm', 'l'].includes(state.settings.listSize) ? state.settings.listSize : 'm';
    for (const box of [$('#cards'), $('#binCards')]) {
      box.classList.remove('size-s', 'size-m', 'size-l');
      box.classList.add(`size-${size}`);
    }
    const inGroup = openGroup ? groupById(openGroup) : null;
    $('#q').placeholder = inGroup ? 'Search your notes inside this group' : 'Search your notes';
    $('#qClear').hidden = !query;
    $('#btnNew').title = inGroup ? `New note inside “${inGroup.name || 'this group'}”` : 'New note';
    if (tab === 'notes') renderNotes(liveNotes);
    if (tab === 'bin') renderBin(binned);
    if (tab === 'settings') renderSettings();
  }

  function cardBody(n) {
    const body = h('div', { class: 'body' });
    const title = (n.title || '').trim();
    if (n.locked) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1' }, title || 'Locked note')));
      body.append(h('div', { class: 'lockmark', html: ICON.lock }));
      return body;
    }
    const lines = (n.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (title) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1 tt' }, title), lines.length ? '\n' + lines.join('\n') : ''));
    } else if (lines.length) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1' }, lines[0]), lines.length > 1 ? '\n' + lines.slice(1).join('\n') : ''));
    } else if (!n.firstImage) {
      body.append(h('div', { class: 'txt empty' }, 'Empty note'));
    }
    if (n.firstImage) {
      body.append(h('img', { class: 'thumb' + (lines.length || title ? '' : ' only'), src: n.firstImage, alt: '', draggable: 'false', onerror: (e) => e.target.remove() }));
    }
    return body;
  }

  // ----- drag & drop: notes onto notes make a group, notes/groups onto groups go inside
  function startDrag(e, item, card) {
    e.stopPropagation();
    drag = item;
    hideCtx();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    requestAnimationFrame(() => { card.classList.add('dragging'); document.body.classList.add('is-dragging'); });
  }
  function endDrag() {
    drag = null;
    document.body.classList.remove('is-dragging');
    $$('.dragging, .drop-on').forEach((el) => el.classList.remove('dragging', 'drop-on'));
    if (renderLater) { renderLater = false; render(); }
  }
  function dropTarget(el, canDrop, onDrop, label) {
    const ok = () => drag && canDrop();
    el.addEventListener('dragenter', (e) => { if (ok()) { e.preventDefault(); el.classList.add('drop-on'); if (label) el.dataset.drop = label(); } });
    el.addEventListener('dragover', (e) => { if (ok()) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop-on'); } });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-on'); });
    el.addEventListener('drop', async (e) => {
      if (!ok()) return;
      e.preventDefault();
      const d = drag;
      el.classList.remove('drop-on');
      await onDrop(d);
    });
  }
  // where a dragged thing currently lives
  const locationOf = (d) => (d.kind === 'group' ? (groupById(d.id)?.parentId || null) : (state.notes.find((n) => n.id === d.id)?.groupId || null));
  // can the dragged thing move into group `gid` (null = top level)?
  function canMoveInto(d, gid) {
    if (locationOf(d) === (gid || null)) return false;
    if (d.kind === 'group' && gid && (gid === d.id || isInside(gid, d.id))) return false;
    return true;
  }
  const moveInto = (d, gid) => S.groups.moveTo(d.id, gid || null);

  function noteCard(n, i, { inGroup = false } = {}) {
    const acts = h('div', { class: 'acts' },
      n.open
        ? h('button', { class: 'act', title: 'Close this note (keeps it here)', html: ICON.hide, onclick: (e) => { e.stopPropagation(); S.list.closeNote(n.id); } })
        : h('button', { class: 'act', title: 'Open on desktop', html: ICON.open, onclick: (e) => { e.stopPropagation(); S.list.openNote(n.id); } }),
      inGroup ? h('button', { class: 'act', title: 'Take out of the group (up one level)', html: ICON.out, onclick: (e) => { e.stopPropagation(); S.groups.moveUp(n.id); } }) : null,
      h('button', { class: 'act', title: 'Move to Bin (Shift+click: no question)', html: ICON.trash, onclick: (e) => { e.stopPropagation(); trashNote(n, e.shiftKey); } }));
    const foot = h('div', { class: 'foot' },
      h('span', { class: 'when', title: `Created ${full(n.createdAt)}\nLast edited ${full(n.updatedAt)}` },
        h('span', { class: 'cal', html: ICON.cal }), n.restoredFrom ? 'Restored' : when(n.createdAt)),
      n.open ? h('span', { class: 'badge', title: 'Open on your desktop' }, h('i'), 'open') : null,
      acts);
    const card = h('div', {
      class: 'card',
      'data-color': n.color,
      'data-font': n.font,
      draggable: 'true',
      style: `--r:${tilt(n.id)}deg; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: n.open ? 'Click to bring to front · right-click for more' : 'Click to open · right-click for more',
      onclick: () => S.list.openNote(n.id),
      oncontextmenu: (e) => { e.preventDefault(); noteMenu(n, e); },
    }, h('div', { class: 'strip' }), n.pinned ? h('span', { class: 'pin', title: 'Pinned on top' }) : null, cardBody(n), foot);
    card.addEventListener('dragstart', (e) => startDrag(e, { id: n.id, kind: 'note' }, card));
    card.addEventListener('dragend', endDrag);
    dropTarget(card,
      () => drag.kind === 'note' && drag.id !== n.id,
      (d) => S.groups.make(d.id, n.id),
      () => {
        const from = state.notes.find((x) => x.id === drag.id);
        return n.groupId && from && from.groupId !== n.groupId ? 'Add to its group' : 'Make a group';
      });
    return card;
  }

  // the little picture of a group, in its chosen look
  function groupArt(g, notes) {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const hiddenG = !g.open;
    const paper = (n, cls) => h('div', { class: `paper ${cls}`, 'data-color': n ? n.color : 'yellow' });
    const top = sorted[0];
    const peek = [sorted[0], sorted[1], sorted[2]].filter(Boolean);
    const lockBadge = g.locked ? h('span', { class: 'glock', html: g.open ? ICON.unlock : ICON.lock }) : null;
    const style = g.style || 'stack';
    if (style === 'folder') {
      return h('div', { class: 'art folder' },
        h('div', { class: 'f-back' }),
        ...peek.slice(0, 3).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'f-front' }, h('span', { class: 'f-count' }, plural(notes.length, 'note'))),
        lockBadge);
    }
    if (style === 'envelope') {
      return h('div', { class: 'art envelope' },
        h('div', { class: 'e-back' }),
        ...peek.slice(0, 2).map((n, k) => paper(n, `pk pk${k + 1}`)),
        h('div', { class: 'e-front' }),
        h('span', { class: 'e-seal', html: '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 16l-5.2 3 1.4-5.9-4.6-4 6-.5z"/></svg>' }),
        lockBadge);
    }
    if (style === 'notebook') {
      return h('div', { class: 'art notebook' },
        h('div', { class: 'nb-pages' }),
        h('div', { class: 'nb-cover' },
          h('div', { class: 'nb-label' }, h('b', {}, g.name || 'Notebook'), h('small', {}, plural(notes.length, 'note')))),
        h('div', { class: 'nb-rings' }, ...Array.from({ length: 6 }, () => h('i'))),
        h('div', { class: 'nb-band' }),
        lockBadge);
    }
    // stack (the original look)
    const back = sorted.slice(1, 3);
    const front = hiddenG || !top ? null : cardBody(top);
    return h('div', { class: 'art sheets' },
      back[1] ? h('div', { class: 'sheet s3', 'data-color': back[1].color }) : null,
      back[0] ? h('div', { class: 'sheet s2', 'data-color': back[0].color }) : null,
      h('div', { class: 'sheet s1', 'data-color': top ? top.color : 'yellow', 'data-font': top ? top.font : 'hand' },
        front || h('div', { class: 'body' }, h('div', { class: 'lockmark', html: ICON.lock }))),
      h('span', { class: 'clip' }),
      g.locked && g.open ? lockBadge : null);
  }

  function groupCard(g, i) {
    const notes = notesInTree(g.id);
    const subs = [...subtreeIds(g.id)].length - 1;
    const card = h('div', {
      class: `card group look-${g.style || 'stack'}${g.open ? '' : ' locked'}`,
      draggable: 'true',
      style: `--r:${tilt(g.id) * 0.5}deg; --gc:${GCOLORS[g.color] || GCOLORS.kraft}; animation-delay:${Math.min(i, 12) * 18}ms`,
      title: `${g.name || 'Group'} · ${plural(notes.length, 'note')}${subs ? ` · ${plural(subs, 'group')} inside` : ''}${g.locked ? ' · locked' : ''}\nClick to open · drop a note here to add it · right-click for more`,
      onclick: () => openGroupView(g),
      oncontextmenu: (e) => { e.preventDefault(); groupMenu(g, e); },
    }, groupArt(g, notes),
      h('div', { class: 'gfoot' },
        g.locked ? h('span', { class: 'gl', html: g.open ? ICON.unlock : ICON.lock }) : null,
        h('span', { class: 'gname-l' + (g.name ? '' : ' unnamed') }, g.name || 'Group'),
        subs ? h('span', { class: 'gsub', title: plural(subs, 'group') + ' inside', html: ICON.folder + subs }) : null,
        h('span', { class: 'gcount' }, String(notes.length))));
    card.addEventListener('dragstart', (e) => startDrag(e, { id: g.id, kind: 'group' }, card));
    card.addEventListener('dragend', endDrag);
    dropTarget(card, () => canMoveInto(drag, g.id), (d) => S.groups.make(d.id, g.id), () => 'Put inside');
    return card;
  }

  function emptyState(title, text, withButton) {
    return h('div', { class: 'emptystate' },
      withButton ? h('div', { class: 'stack' }, h('i'), h('i'), h('i')) : null,
      h('h2', {}, title),
      h('p', {}, text),
      withButton ? h('button', { class: 'pill', onclick: () => S.list.newNote(openGroup || null) }, '+ New note') : null);
  }

  function renderGroupHeader(g) {
    const chain = chainOf(g.id).reverse(); // outermost first
    const crumbs = $('#crumbs');
    crumbs.innerHTML = '';
    const crumb = (label, gid, current) => {
      const el = h(current ? 'span' : 'button', { class: 'crumb' + (current ? ' cur' : ''), onclick: current ? null : () => { openGroup = gid; clearSearch(); closePanel(); render(true); } }, label);
      if (!current) dropTarget(el, () => canMoveInto(drag, gid), (d) => moveInto(d, gid), () => 'Move here');
      return el;
    };
    crumbs.append(crumb('All notes', null, false));
    chain.forEach((c) => crumbs.append(h('span', { class: 'sep' }, '›'), crumb(c.name || 'Group', c.id, c.id === g.id)));
    const parent = groupById(g.parentId);
    $('#backLabel').textContent = parent ? (parent.name || 'Group') : 'All notes';
    const input = $('#groupName');
    if (document.activeElement !== input) input.value = g.name || '';
    $('#gIcon').innerHTML = $(`#gStyles [data-style="${g.style || 'stack'}"] svg`).outerHTML;
    $('#groupHead').style.setProperty('--gc', GCOLORS[g.color] || GCOLORS.kraft);
    $('#btnRelockGroup').hidden = !chain.some((c) => c.locked);
    paintPanel(g);
  }

  function renderNotes(liveNotes) {
    const box = $('#cards');
    const scroll = $('#viewNotes').scrollTop;
    box.innerHTML = '';
    const q = query.trim().toLowerCase();
    const g = openGroup ? groupById(openGroup) : null;
    $('#groupHead').hidden = !g;
    $('#dropOut').classList.toggle('show', !!g);
    $('#tip').textContent = '';
    if (g) renderGroupHeader(g); else closePanel();

    if (!liveNotes.length) {
      box.append(emptyState('No notes yet', 'Your first sticky note is one click away.', true));
      return;
    }

    // search: one flat list of every matching note (only inside the open group, when one is open)
    if (q) {
      const pool = g ? notesInTree(g.id) : liveNotes;
      const found = pool.filter((n) => `${n.title || ''}\n${n.text || ''}`.toLowerCase().includes(q));
      const items = sortItems(found.map((n) => ({ kind: 'note', note: n })));
      if (!items.length) box.append(emptyState('Nothing found', `No note${g ? ' in this group' : ''} contains “${query.trim()}”.`));
      items.forEach((it, i) => box.append(noteCard(it.note, i, { inGroup: !!it.note.groupId })));
      return;
    }

    const here = g ? g.id : null;
    const items = [];
    for (const cg of childGroups(here)) {
      const ns = notesInTree(cg.id);
      if (ns.length) items.push({ kind: 'group', group: cg, notes: ns });
    }
    const known = new Set(state.groups.map((x) => x.id));
    for (const n of liveNotes) {
      const at = n.groupId && known.has(n.groupId) ? n.groupId : null;
      if (at === here) items.push({ kind: 'note', note: n });
    }
    sortItems(items).forEach((it, i) => box.append(it.kind === 'group' ? groupCard(it.group, i) : noteCard(it.note, i, { inGroup: !!g })));
    if (g) $('#tip').textContent = 'Drag a note onto another to make a group inside this one. To move something up, drop it on the back button or the path above.';
    else if (liveNotes.length >= 2 && !state.groups.length) $('#tip').textContent = 'Tip: drag a note onto another one to put them in a group.';
    $('#viewNotes').scrollTop = scroll;
  }

  function renderBin(binned) {
    const box = $('#binCards');
    box.innerHTML = '';
    $('#btnEmpty').disabled = !binned.length;
    if (!binned.length) {
      box.append(emptyState('The bin is empty', 'Notes you delete will wait here.'));
      return;
    }
    binned.sort((a, b) => b.deletedAt - a.deletedAt).forEach((n) => {
      const foot = h('div', { class: 'foot' },
        h('span', { class: 'when' }, 'Deleted ' + when(n.deletedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())));
      const acts = h('div', { class: 'foot', style: 'padding-top:0' },
        h('button', { class: 'pill', onclick: () => S.list.restore(n.id) }, 'Restore'),
        h('button', { class: 'pill danger', title: 'Delete forever', onclick: () => destroyNote(n) }, 'Delete'));
      box.append(h('div', {
        class: 'card binned', 'data-color': n.color, 'data-font': n.font, style: `--r:${tilt(n.id)}deg`,
        oncontextmenu: (e) => { e.preventDefault(); showCtx(e, [
          { label: 'Restore', icon: ICON.restore, run: () => S.list.restore(n.id) },
          '-',
          { label: 'Delete forever…', icon: ICON.trash, danger: true, run: () => destroyNote(n) },
        ]); },
      }, h('div', { class: 'strip' }), cardBody(n), foot, acts));
    });
  }

  async function renderSettings() {
    const s = state.settings;
    $('#sStartup').checked = !!s.startWithWindows;
    $('#sSpell').checked = !!s.spellCheck;
    $('#sCyr').checked = !!s.spellCyrillic;
    const sc = $('#sColors');
    sc.innerHTML = '';
    sc.append(h('button', {
      class: 'sw random' + (s.defaultColor === 'random' ? ' on' : ''),
      title: 'Random: every new note gets a surprise colour',
      html: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
      onclick: () => S.settings.set({ defaultColor: 'random' }),
    }));
    for (const c of COLORS) {
      sc.append(h('button', {
        class: 'sw' + (s.defaultColor === c ? ' on' : ''),
        style: `background:${SWATCH[c]}`,
        title: c,
        onclick: () => S.settings.set({ defaultColor: c }),
      }));
    }
    $$('#sFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === s.defaultFont));
    $('#lockInfo').textContent = s.hasPassword
      ? 'One password or PIN unlocks every locked note and group. Lock things from a note’s ⋯ menu, or right-click a note or group in this list.'
      : 'No password yet. Choose one here, or the first time you lock a note or group.';
    $('#pwSave').innerHTML = ICON.lock + (s.hasPassword ? 'Change password' : 'Set password');
    $('#dataPath').textContent = s.dataPath || '';
    $('#version').textContent = `CosmoNotes ${s.version || ''}`;
    renderAbout(s.version);
    renderBackups(await S.backups.list());
  }

  const niceDate = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };
  let aboutDone = false;
  function renderAbout(version) {
    const A = window.COSMO_ABOUT;
    if (!A) return;
    $('#aboutLine').textContent = `Version ${version || A.VERSIONS[0].version} · Last updated ${niceDate(A.LAST_UPDATED)}`;
    if (aboutDone) return;
    aboutDone = true;
    $('#features').append(...A.FEATURES.map((f) => h('div', { class: 'fgroup' },
      h('h5', {}, f.title),
      h('ul', {}, f.items.map((it) => h('li', {}, it))))));
    $('#versions').append(...A.VERSIONS.map((v) => h('div', { class: 'vblock' },
      h('div', { class: 'vhead' },
        h('span', { class: 'vtag' }, v.version),
        h('span', { class: 'vdate' }, niceDate(v.date)),
        v.version === version ? h('span', { class: 'vnow' }, '· you have this one') : null),
      h('ul', { class: 'vchanges' }, v.changes.map((c) => h('li', {}, c))))));
  }

  function renderBackups(list) {
    const box = $('#backups');
    box.innerHTML = '';
    if (!list.length) {
      box.append(h('p', { class: 'muted', style: 'margin:6px 0 0' }, 'The first backup is made today.'));
      return;
    }
    const shown = showAllBackups ? list : list.slice(0, 5);
    for (const b of shown) {
      const m = b.name.match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})-(\d{2}))?/);
      const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
      const label = d ? d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + (m[4] ? `, ${m[4]}:${m[5]}` : '') : b.name;
      box.append(h('div', { class: 'bk' },
        h('span', {}, h('b', {}, label), h('small', {}, b.count != null ? plural(b.count, 'note') : '')),
        h('button', { class: 'pill ghost', onclick: () => restoreBackup(b.name, label) }, 'Restore')));
    }
    if (list.length > 5 && !showAllBackups) {
      box.append(h('button', { class: 'pill ghost bk-more', onclick: () => { showAllBackups = true; renderBackups(list); } }, `Show all ${list.length}`));
    }
  }

  // ================================================================ app-styled pop-ups
  let modalDone = null;
  // modal({ title, text, tip, icon, okLabel, cancelLabel, danger, inputs: [{ placeholder }], check, noCancel })
  // → resolves with the input values (or true) when confirmed, null when cancelled.
  function modal(o) {
    if (modalDone) modalDone(null);
    hideCtx();
    $('#mTitle').textContent = o.title || '';
    $('#mText').textContent = o.text || '';
    $('#mText').hidden = !o.text;
    $('#mTip').textContent = o.tip || '';
    $('#mTip').hidden = !o.tip;
    $('#mErr').textContent = '';
    $('#mIcon').innerHTML = o.icon || (o.danger ? ICON.warn : ICON.info);
    $('#mIcon').className = 'micon' + (o.danger ? ' danger' : '');
    const ok = $('#mOk');
    ok.textContent = o.okLabel || 'OK';
    ok.className = 'pill' + (o.danger ? ' red' : '');
    $('#mCancel').textContent = o.cancelLabel || 'Cancel';
    $('#mCancel').hidden = !!o.noCancel;
    const inputs = $('#mInputs');
    inputs.innerHTML = '';
    for (const inp of o.inputs || []) inputs.append(h('input', { type: inp.type || 'password', placeholder: inp.placeholder || '', class: 'minput' }));
    $('#modal').hidden = false;
    requestAnimationFrame(() => { (inputs.querySelector('input') || ok).focus(); });
    return new Promise((resolve) => {
      modalDone = (v) => { modalDone = null; $('#modal').hidden = true; resolve(v); };
      $('#mbox').onsubmit = async (e) => {
        e.preventDefault();
        const values = [...inputs.querySelectorAll('input')].map((x) => x.value);
        if (o.check) {
          ok.disabled = true;
          const err = await o.check(values);
          ok.disabled = false;
          if (err) {
            $('#mErr').textContent = err;
            const box = $('#mbox');
            box.classList.remove('shake');
            void box.offsetWidth;
            box.classList.add('shake');
            const first = inputs.querySelector('input');
            if (first) first.select();
            return;
          }
        }
        modalDone(values.length ? values : true);
      };
    });
  }
  $('#mCancel').addEventListener('click', () => modalDone && modalDone(null));
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && modalDone) modalDone(null); });

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- right-click menu
  function hideCtx() { $('#ctx').hidden = true; }
  function showCtx(e, items) {
    const ctx = $('#ctx');
    ctx.innerHTML = '';
    for (const it of items) {
      if (!it) continue;
      if (it === '-') { ctx.append(h('div', { class: 'sep' })); continue; }
      ctx.append(h('button', {
        class: 'mi' + (it.danger ? ' danger' : ''),
        disabled: it.disabled || null,
        onclick: () => { hideCtx(); it.run(); },
      }, h('span', { class: 'mic', html: it.icon || '' }), h('span', {}, it.label)));
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth;
    const hgt = ctx.offsetHeight;
    ctx.style.left = `${Math.max(6, Math.min(e.clientX, innerWidth - w - 6))}px`;
    ctx.style.top = `${Math.max(6, Math.min(e.clientY, innerHeight - hgt - 6))}px`;
  }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#ctx')) hideCtx(); });
  window.addEventListener('blur', hideCtx);
  $('#viewNotes').addEventListener('scroll', hideCtx, { passive: true });

  function noteMenu(n, e) {
    showCtx(e, [
      { label: n.open ? 'Bring to front' : 'Open on desktop', icon: ICON.open, run: () => S.list.openNote(n.id) },
      n.open ? { label: 'Close note', icon: ICON.hide, run: () => S.list.closeNote(n.id) } : null,
      { label: 'Duplicate note', icon: ICON.copy, run: async () => { await S.list.duplicate(n.id); toast('Note duplicated'); } },
      '-',
      n.ownLock
        ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockNote(n) }
        : { label: 'Lock note', icon: ICON.lock, run: () => lockNote(n), disabled: false },
      n.groupId ? { label: 'Take out of group', icon: ICON.out, run: () => S.groups.moveUp(n.id) } : null,
      '-',
      { label: 'Move to Bin', icon: ICON.trash, danger: true, run: () => trashNote(n, false) },
    ]);
  }
  function groupMenu(g, e) {
    showCtx(e, [
      { label: 'Open group', icon: ICON.folder, run: () => openGroupView(g) },
      g.open ? { label: 'Group settings…', icon: ICON.palette, run: async () => { await openGroupView(g); openPanel(); } } : null,
      '-',
      g.locked
        ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockGroup(g) }
        : { label: 'Lock group', icon: ICON.lock, run: () => lockGroup(g) },
      g.parentId ? { label: 'Move up one level', icon: ICON.out, run: () => S.groups.moveUp(g.id) } : null,
      { label: 'Ungroup…', icon: ICON.ungroup, run: () => dissolveGroup(g) },
      '-',
      { label: 'Move its notes to Bin…', icon: ICON.trash, danger: true, run: () => trashGroup(g) },
    ]);
  }

  // ================================================================ actions (with confirmations)
  async function trashNote(n, skipAsk) {
    if (!skipAsk) {
      const ok = await modal({
        title: 'Move this note to the Bin?',
        text: `“${(n.title || (n.locked ? 'Locked note' : (n.text || '').split('\n')[0]) || 'Empty note').slice(0, 60)}” can be restored from the Bin any time.`,
        tip: 'Tip: Shift+click the bin button to skip this question.',
        okLabel: 'Move to Bin',
        danger: true,
      });
      if (!ok) return;
    }
    await S.list.trash(n.id);
    toast('Moved to the Bin');
  }
  async function destroyNote(n) {
    const ok = await modal({ title: 'Delete this note forever?', text: 'You won’t be able to get it back from the Bin. (Daily backups still keep a copy for up to 30 days.)', okLabel: 'Delete forever', danger: true });
    if (ok) await S.list.destroy(n.id);
  }
  async function emptyBin() {
    const count = state.notes.filter((n) => n.deletedAt).length;
    if (!count) return;
    const ok = await modal({ title: `Delete ${plural(count, 'note')} forever?`, text: 'Your daily backups still keep a copy for up to 30 days.', okLabel: 'Empty bin', danger: true });
    if (ok) await S.list.emptyBin();
  }
  async function restoreBackup(name, label) {
    const ok = await modal({
      title: 'Bring back notes from this backup?',
      text: `Backup of ${label}. Nothing you have now is changed or removed: notes from the backup that differ from your current ones are added as extra notes.`,
      okLabel: 'Restore',
      icon: ICON.restore,
    });
    if (!ok) return;
    const count = await S.backups.restore(name);
    await modal({
      title: count ? `Brought back ${plural(count, 'note')}` : 'Nothing to bring back',
      text: count ? 'They are in your notes list, marked “Restored”.' : 'Every note in that backup matches what you already have.',
      okLabel: 'OK',
      noCancel: true,
    });
  }
  async function dissolveGroup(g) {
    const ok = await modal({
      title: `Ungroup “${g.name || 'Group'}”?`,
      text: 'Everything inside moves up one level. No notes are deleted.',
      okLabel: 'Ungroup',
      icon: ICON.ungroup,
    });
    if (!ok) return;
    if (openGroup && (openGroup === g.id || isInside(openGroup, g.id))) openGroup = g.parentId || null;
    closePanel();
    await S.groups.dissolve(g.id);
    toast('Ungrouped');
  }
  async function trashGroup(g) {
    const count = notesInTree(g.id).length;
    const ok = await modal({
      title: `Move all ${plural(count, 'note')} in “${g.name || 'Group'}” to the Bin?`,
      text: 'They can be restored from the Bin, and go back into this group when you do.',
      okLabel: 'Move to Bin',
      danger: true,
    });
    if (!ok) return;
    if (openGroup && (openGroup === g.id || isInside(openGroup, g.id))) openGroup = g.parentId || null;
    closePanel();
    await S.groups.trash(g.id);
    toast('Moved to the Bin');
  }

  // ---------- passwords & locking
  async function ensurePassword() {
    if (state.settings.hasPassword) return true;
    const r = await modal({
      title: 'Choose a password or PIN',
      text: 'One password for all your locked notes and groups. You can change it later in Settings.',
      inputs: [{ placeholder: 'Password or PIN' }, { placeholder: 'Type it again' }],
      okLabel: 'Save',
      icon: ICON.lock,
      check: async ([a, b]) => {
        if (a.length < 4) return 'Use at least 4 characters or digits.';
        if (a !== b) return "The two don't match.";
        const res = await S.setPassword('', a);
        return res && res.ok ? null : (res && res.error) || 'Could not save it.';
      },
    });
    if (!r) return false;
    state.settings.hasPassword = true;
    return true;
  }
  const askPassword = (title, text, okLabel, fn) => modal({
    title, text, okLabel, icon: ICON.lock,
    inputs: [{ placeholder: 'Password or PIN' }],
    check: async ([pw]) => {
      if (!pw) return 'Type your password or PIN.';
      const res = await fn(pw);
      return res && res.ok ? null : 'Wrong password';
    },
  });
  async function lockNote(n) {
    if (!(await ensurePassword())) return;
    await S.list.setLocked(n.id, true);
    toast('Note locked 🔒');
  }
  async function unlockNote(n) {
    const r = await askPassword('Remove the lock?', 'Type your password to remove the lock from this note.', 'Remove lock', (pw) => S.list.setLocked(n.id, false, pw));
    if (r) toast('Lock removed');
  }
  async function lockGroup(g) {
    if (!(await ensurePassword())) return;
    await S.groups.setLocked(g.id, true);
    if (openGroup && (openGroup === g.id || isInside(openGroup, g.id))) openGroup = g.parentId || null;
    closePanel();
    toast('Group locked 🔒');
  }
  async function unlockGroup(g) {
    const r = await askPassword('Remove the lock?', `Type your password to remove the lock from “${g.name || 'Group'}”.`, 'Remove lock', (pw) => S.groups.setLocked(g.id, false, pw));
    if (r) toast('Lock removed');
  }
  async function openGroupView(g) {
    if (!g.open) {
      const r = await askPassword('This group is locked', `Type your password to open “${g.name || 'Group'}”.`, 'Open', (pw) => S.groups.reveal(g.id, pw));
      if (!r) return;
      await load();
    }
    openGroup = g.id;
    closePanel();
    query = '';
    $('#q').value = '';
    render(true);
    $('#viewNotes').scrollTop = 0;
  }

  // ================================================================ group settings panel
  function openPanel() { $('#groupPanel').hidden = false; $('#btnGroupSettings').classList.add('on'); }
  function closePanel() { $('#groupPanel').hidden = true; $('#btnGroupSettings').classList.remove('on'); }
  // which paper colour / font the notes in the group share (shown as selected), given the "inside too" box
  function panelScope(g) {
    return $('#gInner').checked ? notesInTree(g.id) : live().filter((n) => n.groupId === g.id);
  }
  function shared(notes, key) {
    const vals = new Set(notes.map((n) => n[key]));
    return vals.size === 1 ? [...vals][0] : null;
  }
  function paintPanel(g) {
    const scope = panelScope(g);
    const font = shared(scope, 'font');
    const color = shared(scope, 'color');
    $$('#gFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === font));
    $$('#gNoteColors .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === color));
    $('#gMixed').textContent = scope.length && (!font || !color) ? 'Notes inside use different ' + [!color && 'colours', !font && 'fonts'].filter(Boolean).join(' and ') + '.' : '';
    $$('#gStyles button').forEach((b) => b.classList.toggle('on', b.dataset.style === (g.style || 'stack')));
    $('#gStyles').style.setProperty('--gc', GCOLORS[g.color] || GCOLORS.kraft);
    $$('#gColors .sw').forEach((b) => b.classList.toggle('on', b.dataset.gc === (g.color || 'kraft')));
    $('#gLock').innerHTML = (g.locked ? ICON.unlock + 'Remove lock…' : ICON.lock + 'Lock group');
  }
  (function buildPanel() {
    for (const [k, v] of Object.entries(GCOLORS)) {
      $('#gColors').append(h('button', { class: 'sw', 'data-gc': k, title: GNAMES[k], style: `background:${v}`, onclick: () => S.groups.update(openGroup, { color: k }) }));
    }
    for (const c of COLORS) {
      $('#gNoteColors').append(h('button', { class: 'sw', 'data-color': c, title: `Make every note ${c}`, style: `background:${SWATCH[c]}`, onclick: () => massEdit({ color: c }) }));
    }
  })();
  async function massEdit(patch) {
    const count = await S.groups.apply(openGroup, patch, $('#gInner').checked);
    toast(count ? `Changed ${plural(count, 'note')}` : 'No notes to change');
  }
  $$('#gStyles button').forEach((b) => b.addEventListener('click', () => S.groups.update(openGroup, { style: b.dataset.style })));
  $('#gInner').addEventListener('change', () => { const g = groupById(openGroup); if (g) paintPanel(g); });
  $$('#gFont button').forEach((b) => b.addEventListener('click', () => massEdit({ font: b.dataset.font })));
  $('#gLock').addEventListener('click', () => { const g = groupById(openGroup); if (g) (g.locked ? unlockGroup(g) : lockGroup(g)); });
  $('#gUngroup').addEventListener('click', () => { const g = groupById(openGroup); if (g) dissolveGroup(g); });
  $('#gTrash').addEventListener('click', () => { const g = groupById(openGroup); if (g) trashGroup(g); });
  $('#btnGroupSettings').addEventListener('click', () => ($('#groupPanel').hidden ? openPanel() : closePanel()));
  $('#btnRelockGroup').addEventListener('click', async () => {
    const chain = chainOf(openGroup);
    const outer = [...chain].reverse().find((c) => c.locked);
    if (!outer) return;
    openGroup = outer.parentId || null;
    closePanel();
    await S.groups.hide(outer.id);
    toast('Locked again 🔒');
  });

  // ================================================================ events
  $$('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(true); }));
  // inside a group, a new note is made right there
  const newNote = () => S.list.newNote(openGroup || null);
  $('#btnNew').addEventListener('click', newNote);
  $('#btnFront').addEventListener('click', () => S.list.bringToFront());
  $('#q').addEventListener('input', (e) => { query = e.target.value; render(); });
  const clearSearch = () => { query = ''; $('#q').value = ''; };
  $('#qClear').addEventListener('click', () => { clearSearch(); render(); $('#q').focus(); });
  $('#btnEmpty').addEventListener('click', emptyBin);

  // inside a group: up one level / drop to move up
  const upLevel = () => (openGroup ? (groupById(openGroup)?.parentId || null) : null);
  $('#btnBack').addEventListener('click', () => { openGroup = upLevel(); clearSearch(); closePanel(); render(true); });
  dropTarget($('#btnBack'), () => !!openGroup && canMoveInto(drag, upLevel()), (d) => moveInto(d, upLevel()), () => 'Move up');
  dropTarget($('#dropOut'), () => !!openGroup && canMoveInto(drag, upLevel()), (d) => moveInto(d, upLevel()));
  let nameTimer = null;
  $('#groupName').addEventListener('input', (e) => {
    const id = openGroup;
    const name = e.target.value;
    const g = groupById(id);
    if (g) g.name = name;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => S.groups.rename(id, name), 300);
  });
  $('#groupName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  // card size menu
  $('#btnSize').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#sizePop');
    pop.hidden = !pop.hidden;
    $('#sortPop').hidden = true; $('#btnSort').classList.remove('on');
    $('#btnSize').classList.toggle('on', !pop.hidden);
    paintSize();
  });
  function paintSize() {
    const v = ['s', 'm', 'l'].includes(state.settings.listSize) ? state.settings.listSize : 'm';
    $$('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  }
  $$('#sizeSeg button').forEach((b) => b.addEventListener('click', () => {
    if (state.settings.listSize === b.dataset.v) return;
    state.settings.listSize = b.dataset.v;
    paintSize();
    render(true);
    S.settings.set({ listSize: b.dataset.v });
  }));

  // sort menu
  $('#btnSort').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('#sortPop');
    pop.hidden = !pop.hidden;
    $('#sizePop').hidden = true; $('#btnSize').classList.remove('on');
    $('#btnSort').classList.toggle('on', !pop.hidden);
    paintSort();
  });
  function paintSort() {
    const p = sortPrefs();
    $$('#sortPop .seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', p[seg.dataset.key] === b.dataset.v)));
  }
  $$('#sortPop .seg button').forEach((b) => b.addEventListener('click', () => {
    const key = b.parentElement.dataset.key;
    if (sortPrefs()[key] === b.dataset.v) return;
    state.settings.listSort = { ...sortPrefs(), [key]: b.dataset.v };
    paintSort();
    render(true);
    S.settings.set({ listSort: state.settings.listSort });
  }));
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#sortPop, #btnSort')) { $('#sortPop').hidden = true; $('#btnSort').classList.remove('on'); }
    if (!e.target.closest('#sizePop, #btnSize')) { $('#sizePop').hidden = true; $('#btnSize').classList.remove('on'); }
  });

  // settings
  $('#sStartup').addEventListener('change', (e) => S.settings.set({ startWithWindows: e.target.checked }));
  $('#sSpell').addEventListener('change', (e) => S.settings.set({ spellCheck: e.target.checked }));
  $('#sCyr').addEventListener('change', (e) => S.settings.set({ spellCyrillic: e.target.checked }));
  $$('#sFont button').forEach((b) => b.addEventListener('click', () => S.settings.set({ defaultFont: b.dataset.font })));
  // password: set / change in an app-styled pop-up
  $('#pwSave').addEventListener('click', async () => {
    const has = !!state.settings.hasPassword;
    const inputs = has
      ? [{ placeholder: 'Current password' }, { placeholder: 'New password or PIN' }, { placeholder: 'Type the new one again' }]
      : [{ placeholder: 'Password or PIN' }, { placeholder: 'Type it again' }];
    const r = await modal({
      title: has ? 'Change your password' : 'Set a password',
      text: 'One password or PIN for all your locked notes and groups.',
      inputs,
      icon: ICON.lock,
      okLabel: 'Save',
      check: async (v) => {
        const [cur, a, b] = has ? v : ['', v[0], v[1]];
        if (a.length < 4) return 'Use at least 4 characters or digits.';
        if (a !== b) return "The two new ones don't match.";
        const res = await S.setPassword(cur, a);
        return res && res.ok ? null : (res && res.error) || 'Could not save it.';
      },
    });
    if (r) { state.settings.hasPassword = true; toast('Password saved ✓'); renderSettings(); }
  });
  $('#btnBackupNow').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    renderBackups(await S.backups.now());
    btn.textContent = 'Backed up ✓';
    setTimeout(() => { btn.textContent = 'Back up now'; btn.disabled = false; }, 1800);
  });
  $('#btnBackupFolder').addEventListener('click', () => S.backups.openFolder());
  $('#btnDataFolder').addEventListener('click', () => S.openDataFolder());
  document.addEventListener('keydown', (e) => {
    if (!$('#modal').hidden) { if (e.key === 'Escape' && modalDone) modalDone(null); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); newNote(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); tab = 'notes'; render(true); $('#q').focus(); }
    if (e.key === 'Escape') {
      if (!$('#ctx').hidden) hideCtx();
      else if (!$('#sortPop').hidden) { $('#sortPop').hidden = true; $('#btnSort').classList.remove('on'); }
      else if (!$('#sizePop').hidden) { $('#sizePop').hidden = true; $('#btnSize').classList.remove('on'); }
      else if (query) { clearSearch(); render(); }
      else if (!$('#groupPanel').hidden) closePanel();
      else if (openGroup && document.activeElement !== $('#groupName')) { openGroup = upLevel(); render(true); }
    }
  });
  window.addEventListener('focus', load);

  (async () => { state = await S.list.get(); lastSig = JSON.stringify(state); render(true); })();
})();
