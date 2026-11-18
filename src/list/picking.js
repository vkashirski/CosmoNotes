'use strict';
// CosmoNotes "All notes" window, part 3 of 7: favourites, picking cards, the lock animation, the bar for the picked cards
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, ICON, GCOLORS, GNAMES, cardsTabNow, sel, h, when, plural, tilt, groupById,
    notesInTree, isInside, noteIsLocked, groupIsLocked, isShut, LOCKED_NO_DELETE, favourites, cardBody, markMore, emptyState,
    noteById } = K;
  // defined in a later part:
  const modal = K.later('modal'), toast = K.later('toast'), showCtx = K.later('showCtx'),
    paintFx = K.later('paintFx'), destroyNote = K.later('destroyNote'), ensurePassword = K.later('ensurePassword'),
    lockNote = K.later('lockNote'), lockGroup = K.later('lockGroup'), unlockNoteNow = K.later('unlockNoteNow'),
    relockNote = K.later('relockNote'), unlockGroupNow = K.later('unlockGroupNow'), relockGroup = K.later('relockGroup'),
    openEditMany = K.later('openEditMany'), openTagSheet = K.later('openTagSheet');
  // ================================================================ favourites, selecting, the lock animation (1.1.13)
  function itemOfKey(k) {
    const id = k.slice(2);
    return k[0] === 'g' ? { kind: 'group', id, group: groupById(id) } : { kind: 'note', id, note: ((n) => (n && !n.deletedAt ? n : undefined))(noteById(id)) };
  }
  const thingOf = (k) => { const it = itemOfKey(k); return it.group || it.note || null; };
  const shutKey = (k) => isShut(k[0] === 'g' ? 'group' : 'note', thingOf(k)); // 1.3.28: see isShut (base.js)
  const isFav = (k) => !!(thingOf(k) || {}).favorite;
  const selItems = () => [...sel].map(itemOfKey).filter((it) => it.group || it.note);

  // the star in a card's top-right corner: an outline while you point at the card, filled once it's a favourite
  // (1.3.28: on a shut card it only shows, filled or not at all: paintCards turns it off)
  function starBtn(key) {
    return h('button', {
      class: 'fav',
      html: ICON.star,
      onmousedown: (e) => e.stopPropagation(),
      onclick: (e) => { e.stopPropagation(); setFav([key], !isFav(key), e.currentTarget); },
    });
  }
  // 1.1.14: a lock / unlock button left of the star (shows while you point at the card), so locking doesn't
  // need the right-click menu. A note locked only by its group has none (its group is unlocked instead).
  // 1.1.47 (the owner's wish): on a locked one it unlocks only until CosmoNotes restarts ("Remove lock…" in the
  // right-click menu removes the lock for good); on one unlocked that way it locks it again.
  function lockBtn(kind, t) {
    if (kind === 'note' && t.locked && !t.ownLock) return null;
    const locked = kind === 'note' ? !!t.ownLock : !!t.locked;
    const what = kind === 'note' ? 'note' : 'group';
    const open = locked && unlockedNow(kind, t);
    return h('button', {
      class: 'lockb' + (locked ? ' on' : ''),
      title: !locked ? `Lock this ${what}` : open ? 'Lock again' : 'Unlock until CosmoNotes restarts…',
      html: locked && !open ? ICON.unlock : ICON.lock,
      onmousedown: (e) => e.stopPropagation(),
      onclick: (e) => {
        e.stopPropagation();
        if (!locked) (kind === 'note' ? lockNote(t) : lockGroup(t));
        else if (open) (kind === 'note' ? relockNote(t) : relockGroup(t));
        else (kind === 'note' ? unlockNoteNow(t) : unlockGroupNow(t));
      },
    });
  }
  // 1.1.47: a locked note or group that shows its contents right now (unlocked for now, in its open note window, or a
  // group opened in the list), not because of "Unlock all": its "Unlock" turns into "Lock again"
  function unlockedNow(kind, t) {
    if (kind === 'note') return !!(t.forNow || t.openUnlocked);
    return !!(t.forNow || (t.open && !V.state.settings.unlockedAll));
  }
  async function setFav(keys, on, btn) {
    const ids = [];
    for (const k of keys) { const t = thingOf(k); if (t && !shutKey(k)) { t.favorite = on; ids.push(t.id); } }
    if (!ids.length) return;
    paintCards();
    const btns = btn ? [btn] : keys.map((k) => $(`#cards [data-key="${k}"] > .fav`)).filter(Boolean);
    if (on) btns.forEach((b) => {
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 700);
      starDust(b);
    });
    if (V.tab !== 'favs' || on) $('#cFavs').textContent = favourites().notes.length + favourites().groups.length;
    await S.list.favorite(ids, on);
    if (keys.length > 1) toast(on ? `${plural(ids.length, 'favourite')} added ⭐` : 'Removed from favourites');
  }

  // Ctrl+click picks a card (again: un-picks it); Shift+click picks everything between the last pick and this one.
  // A plain click opens the card as before and forgets the picks.
  const visibleKeys = () => [...$('#cards').children].map((c) => c.dataset.key).filter(Boolean);
  function pickCard(e, key) {
    if (e.ctrlKey || e.metaKey) {
      if (sel.has(key)) sel.delete(key); else sel.add(key);
      V.selAnchor = key;
      paintCards();
      return true;
    }
    if (e.shiftKey && V.selAnchor) {
      const keys = visibleKeys();
      const a = keys.indexOf(V.selAnchor);
      const b = keys.indexOf(key);
      if (a < 0 || b < 0) sel.add(key);
      else for (let i = Math.min(a, b); i <= Math.max(a, b); i++) sel.add(keys[i]);
      paintCards();
      return true;
    }
    if (sel.size) clearSel();
    return false;
  }
  function clearSel() {
    sel.clear();
    V.selAnchor = null;
    paintCards();
  }
  // star, selection outline and lock animation for the cards on screen; forgets picks that aren't shown any more
  function lockStateOf(k) {
    const t = thingOf(k);
    if (!t) return 0;
    if (shutKey(k)) return 2; // shut
    return k[0] === 'g' && t.locked ? 1 : 0; // 1 = a locked group opened in the list
  }
  function paintCards(freshFx = null) { // freshFx (1.2.3): the cards a background refresh built again (see paintFx)
    const box = $('#cards');
    const shown = new Set();
    const seen = new Map();
    for (const c of box.children) {
      const k = c.dataset.key;
      if (!k) continue;
      shown.add(k);
      const fav = isFav(k);
      c.classList.toggle('is-fav', fav);
      const b = c.querySelector(':scope > .fav');
      if (b) {
        b.classList.toggle('on', fav);
        b.disabled = shutKey(k);
        b.title = b.disabled ? '' : fav ? 'Remove from favourites' : 'Add to favourites';
      }
      c.classList.toggle('sel', sel.has(k));
      c.classList.toggle('cut', V.cutMode === 'cut' && V.cut.has(k)); // 1.4.9: cut, waiting for Paste
      const ls = lockStateOf(k);
      seen.set(k, ls);
      const before = V.lockSeen.get(k);
      if (before !== undefined && before !== ls) snapLock(c, ls > before ? 'lock' : 'unlock', lockPos.get(k));
      const at = ls ? lockCentre(c) : null;
      if (at) lockPos.set(k, at); else if (!ls) lockPos.delete(k);
    }
    V.lockSeen = seen;
    for (const k of [...sel]) if (!shown.has(k)) sel.delete(k);
    paintBulk();
    paintFx(freshFx);
  }
  // "Snap shut" (1.1.14; 1.1.13 had "stardust"): locking drops the padlock in with a little bounce and its shackle
  // snaps shut; unlocking pops the shackle open and the padlock floats up as the card's contents fade in.
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lockPos = new Map(); // card key → where its padlock was last time { x, y, size } (for the unlock animation)
  // the middle of a card's padlock, measured in the card's own layout (so the card's little tilt doesn't matter)
  function lockCentre(card) {
    const mark = card.querySelector('.lockmark, .glock');
    const svg = mark && mark.querySelector('svg');
    if (!svg) return null;
    const cs = getComputedStyle(mark); // the padlock sits in the middle of the box without its padding
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    let x = mark.offsetWidth / 2;
    let y = pt + (mark.offsetHeight - pt - pb) / 2;
    for (let el = mark; el && el !== card; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    return { x, y, size: parseFloat(getComputedStyle(svg).width) || 30 };
  }
  function snapLock(card, kind, was) {
    if (calm()) return;
    card.classList.remove('lock-anim', 'unlock-anim');
    void card.offsetWidth;
    card.classList.add(kind === 'lock' ? 'lock-anim' : 'unlock-anim');
    let fly = null;
    if (kind === 'unlock' && was) {
      // a copy of the padlock, where it was, opens and floats away
      fly = h('div', { class: 'lockfly', html: ICON.lockA, style: `left:${was.x - was.size / 2}px; top:${was.y - was.size / 2}px; width:${was.size}px; height:${was.size}px` });
      card.append(fly);
    }
    setTimeout(() => { if (fly) fly.remove(); card.classList.remove('lock-anim', 'unlock-anim'); }, 900);
  }

  // the stardust burst from a star that was just switched on (1.1.14, a little quicker than the lock's)
  function starDust(btn) {
    if (calm()) return;
    const r = btn.getBoundingClientRect();
    const dust = h('div', { class: 'stardust fixed fast', style: `left:${r.left + r.width / 2}px; top:${r.top + r.height / 2}px` }, ...Array.from({ length: 8 }, () => h('i')));
    document.body.append(dust);
    setTimeout(() => dust.remove(), 850);
  }

  // ---- the bar for the selected cards (bottom of the window)
  const bulk = h('div', { class: 'bulkbar', id: 'bulk', hidden: true });
  const bb = (id, icon, label, title, cls = '') => h('button', { class: `bb ${cls}`, id, title, html: `${icon}<span>${label}</span>` });
  bulk.append(
    h('span', { class: 'bcount', id: 'bulkCount' }),
    bb('bOpen', ICON.open, 'Open', 'Open the selected notes on the desktop'),
    bb('bClose', ICON.hide, 'Close', 'Close the selected notes (they stay here)'),
    bb('bFav', ICON.star, 'Favourite', ''),
    bb('bEdit', ICON.edit, 'Note design', ''), // 1.4.15: was Edit design; the title says which notes (paintBulk)
    bb('bTags', ICON.tag, 'Tags', 'Add or remove tags on the selected notes and groups'), // 1.4.10
    bb('bGroup', ICON.folder, 'Group', 'Put the selected notes and groups together in a new group'),
    bb('bLook', ICON.palette, 'Group look', 'The selected groups themselves: look, colour, name font'), // 1.4.15: was Look
    bb('bOut', ICON.out, 'Move out', 'Move the selected ones out of this group'),
    bb('bCut', ICON.cut, 'Cut', 'Cut, then paste them in another group (Ctrl+X)'),
    bb('bCopy', ICON.copy, 'Copy', 'Copy, then paste copies in a group (Ctrl+C)'),
    bb('bPaste', ICON.paste, 'Paste here', 'Move the cut ones here (Ctrl+V)'),
    bb('bLock', ICON.lock, 'Lock', 'Lock the selected notes and groups'),
    bb('bBin', ICON.trash, 'Bin', 'Move the selected notes to the Bin (Delete key)', 'danger'),
    h('button', { class: 'bb x', id: 'bX', title: 'Clear the selection (Esc)', html: ICON.x }));
  document.body.append(bulk);
  // 1.4.9: the selected groups' look and colour (the same looks as the group panel's, list.html #gStyles)
  // 1.4.15: and their name font; headed with what it changes (the groups, not the notes in them: that is Note design)
  const lookPop = h('div', { class: 'bulkpop lookpop', id: 'lookPop', hidden: true },
    h('p', { class: 'pophead', id: 'lookHead' }),
    h('h4', {}, 'Look'),
    h('div', { class: 'styles', id: 'lookStyles', html: $('#gStyles').innerHTML }),
    h('h4', {}, 'Colour'),
    h('div', { class: 'swatches small', id: 'lookColors' }),
    h('h4', {}, 'Name font'),
    h('div', { class: 'seg', id: 'lookFonts', html: $('#gNameFont').innerHTML }));
  bulk.append(lookPop);
  for (const [k, v] of Object.entries(GCOLORS)) {
    $('#lookColors').append(h('button', { class: 'sw', 'data-gc': k, title: GNAMES[k], style: `background:${v}`, onclick: () => setLook({ color: k }) }));
  }
  $$('#lookStyles button').forEach((b) => b.addEventListener('click', () => setLook({ style: b.dataset.style })));
  $$('#lookFonts button').forEach((b) => b.addEventListener('click', () => setLook({ titleFont: b.dataset.font })));
  document.addEventListener('mousedown', (e) => { if (!lookPop.hidden && !e.target.closest('#lookPop, #bLook')) openLook(false); });
  // the picked notes and groups. 1.3.28: shut ones (isShut) only count, and only locking and the Bin (which keeps
  // locked ones) look at them: `all`. Everything else in the bar and its menu works on the others.
  function bulkParts(all = false) {
    const items = selItems().filter((it) => all || !isShut(it.kind, it.note || it.group));
    const notes = items.filter((it) => it.note).map((it) => it.note);
    const groups = items.filter((it) => it.group).map((it) => it.group);
    return { items, notes, groups };
  }
  // 1.2.2: the notes Edit design changes: the picked notes and the notes in picked groups that are open
  function designNotes() {
    const { notes, groups } = bulkParts();
    const out = new Map(notes.map((n) => [n.id, n]));
    for (const g of groups) for (const n of notesInTree(g.id)) if (!isShut('note', n)) out.set(n.id, n);
    return [...out.values()];
  }
  const bulkEdit = () => openEditMany(designNotes());
  const bulkTags = () => openTagSheet(bulkParts().items); // 1.4.10

  // ---- 1.4.9: the look of several groups; Move out, Cut / Paste and Undo / Redo of moves (main/move-history.js)
  const pickedGroups = () => bulkParts().groups;
  function paintLook() {
    const gs = pickedGroups();
    const one = (k, d) => (gs.length && gs.every((g) => (g[k] || d) === (gs[0][k] || d)) ? gs[0][k] || d : null);
    const style = one('style', 'stack');
    const color = one('color', 'kraft');
    const font = one('titleFont', 'hand');
    $('#lookHead').textContent = `${plural(gs.length, 'group')} · their cards, not the notes inside`;
    $$('#lookFonts button').forEach((b) => b.classList.toggle('on', b.dataset.font === font));
    $('#lookStyles').style.setProperty('--gc', GCOLORS[color] || GCOLORS.kraft);
    $$('#lookStyles button').forEach((b) => b.classList.toggle('on', b.dataset.style === style));
    $$('#lookColors .sw').forEach((b) => b.classList.toggle('on', b.dataset.gc === color));
  }
  function openLook(show = lookPop.hidden) {
    lookPop.hidden = !show || !pickedGroups().length;
    $('#bLook').classList.toggle('on', !lookPop.hidden);
    if (!lookPop.hidden) paintLook();
  }
  async function setLook(patch) {
    const gs = pickedGroups();
    if (!gs.length) return;
    for (const g of gs) Object.assign(g, patch); // shows at once; the list's refresh confirms it
    paintLook();
    await S.groups.updateMany(gs.map((g) => g.id), patch);
  }
  // where Move out puts things: the level above the open group
  const upFromHere = () => (V.openGroup ? groupById(V.openGroup)?.parentId || null : null);
  const movedToast = (r, what = 'Moved') => {
    if (!r || !r.moved) { toast(r && r.kept ? 'Those can’t go there' : 'Nothing to move'); return; }
    toast(`${what} ${plural(r.moved, 'item')}${r.kept ? ` · ${r.kept} stayed` : ''} · Ctrl+Z undoes it`);
  };
  async function bulkOut() {
    const { items } = bulkParts();
    if (!V.openGroup || V.tab !== 'notes' || !items.length) return;
    const r = await S.groups.moveMany(items.map((it) => it.id), upFromHere());
    clearSel();
    movedToast(r);
  }
  // Cut / Copy keep the picked cards (shut ones are left out); Paste moves them, or puts copies of them, into the group
  // that is open (or the top level). Copies can be pasted again; what was cut is pasted once.
  function bulkCut(keys = [...sel], mode = 'cut') {
    const ok = keys.filter((k) => thingOf(k) && !shutKey(k));
    if (!ok.length) return;
    V.cut = new Set(ok);
    V.cutMode = mode;
    clearSel();
    toast(`${mode === 'copy' ? 'Copied' : 'Cut'} ${plural(ok.length, 'item')} · open a group and paste (Ctrl+V)`);
  }
  const bulkCopy = (keys = [...sel]) => bulkCut(keys, 'copy');
  function cancelCut() {
    if (!V.cut.size) return false;
    V.cut = new Set();
    paintCards();
    return true;
  }
  async function pasteCut(groupId = V.openGroup || null) {
    const ids = [...V.cut].filter((k) => thingOf(k)).map((k) => k.slice(2));
    if (!ids.length) { cancelCut(); return; }
    if (V.tab !== 'notes' && groupId === (V.openGroup || null)) { toast('Paste in All notes, inside a group'); return; }
    if (groupId && ids.some((id) => id === groupId || isInside(groupId, id))) { toast('A group can’t go inside itself'); return; }
    if (V.cutMode === 'copy') {
      const r = await S.groups.copyMany(ids, groupId);
      if (!r || !r.copied) { toast('Those can’t be copied'); return; }
      toast(`Pasted ${r.copied} ${r.copied === 1 ? 'copy' : 'copies'}${r.kept ? ` · ${r.kept} skipped` : ''} · Ctrl+Z undoes it`);
      return;
    }
    V.cut = new Set();
    const r = await S.groups.moveMany(ids, groupId, 'Paste');
    paintCards();
    movedToast(r);
  }
  async function undoMove(again = false) {
    const r = await (again ? S.groups.redo() : S.groups.undo());
    if (!r) { toast(again ? 'Nothing to redo' : 'Nothing to undo'); return; }
    const binned = r.label === 'Copy' && !again && r.moved ? ' · the copies are in the Bin' : '';
    toast(`${r.label} ${again ? 'redone' : 'undone'}${binned}${r.kept ? ` · ${r.kept} couldn’t move` : ''}`);
  }
  function paintBulk() {
    const every = bulkParts(true);
    const { items, notes } = bulkParts();
    const pasting = V.cut.size > 0 && V.tab === 'notes'; // 1.4.9: something cut is waiting: the bar offers Paste here
    const show = (every.items.length > 0 || pasting) && cardsTabNow();
    bulk.hidden = !show;
    document.body.classList.toggle('selecting', show);
    if (!show) { lookPop.hidden = true; return; }
    bulk.classList.toggle('pasteonly', !every.items.length);
    $('#bPaste').hidden = !pasting;
    const pasted = V.cutMode === 'copy' ? 'Put copies of the copied ones' : 'Move the cut ones';
    $('#bPaste').title = `${pasted} ${V.openGroup ? 'into this group' : 'here, to the top level'} (Ctrl+V)`;
    $('#bX').title = every.items.length ? 'Clear the selection (Esc)' : `Forget what was ${V.cutMode === 'copy' ? 'copied' : 'cut'} (Esc)`;
    $('#bLook').hidden = !pickedGroups().length;
    if (lookPop.hidden === false) { if (!pickedGroups().length) openLook(false); else paintLook(); }
    $('#bBin').hidden = !every.items.length;
    $('#bOut').hidden = !(V.tab === 'notes' && V.openGroup && items.length);
    $('#bCut').hidden = !items.length;
    $('#bCopy').hidden = !items.length;
    $('#bulkCount').textContent = every.items.length ? `${every.items.length} selected` : `${V.cut.size} ${V.cutMode === 'copy' ? 'copied' : 'cut'}`;
    $('#bOpen').hidden = !notes.some((n) => !n.open);
    $('#bClose').hidden = !notes.some((n) => n.open);
    const allFav = items.every((it) => (it.note || it.group).favorite);
    $('#bFav').hidden = !items.length;
    $('#bFav').classList.toggle('on', allFav);
    $('#bFav').querySelector('span').textContent = allFav ? 'Unfavourite' : 'Favourite';
    $('#bFav').title = allFav ? 'Remove the selected ones from your favourites' : 'Add the selected ones to your favourites';
    const design = designNotes();
    $('#bEdit').hidden = !design.length;
    $('#bEdit').title = `Colour, see-through and effects of ${plural(design.length, 'note')}${pickedGroups().length ? ': the selected ones and the notes inside the selected groups' : ''}`;
    $('#bTags').hidden = !items.length;
    $('#bGroup').hidden = items.length < 2;
    $('#bLock').hidden = !every.notes.some((n) => !n.ownLock) && !every.groups.some((g) => !g.locked);
    const canBin = every.notes.some((n) => !noteIsLocked(n)) || every.groups.some((g) => !groupIsLocked(g));
    $('#bBin').disabled = !canBin;
    $('#bBin').title = canBin ? 'Move the selected notes to the Bin (Delete key)' : LOCKED_NO_DELETE;
  }
  // right-click on one of several selected cards: the same actions as the bar
  function bulkMenu(e, key) {
    if (sel.size > 1 && sel.has(key)) {
      const { items, notes } = bulkParts();
      const every = bulkParts(true);
      const allFav = items.every((it) => (it.note || it.group).favorite);
      showCtx(e, [
        notes.some((n) => !n.open) ? { label: 'Open on desktop', icon: ICON.open, run: bulkOpen } : null,
        notes.some((n) => n.open) ? { label: 'Close notes', icon: ICON.hide, run: bulkClose } : null,
        items.length ? { label: allFav ? 'Remove from favourites' : 'Add to favourites', icon: ICON.star, run: () => setFav([...sel], !allFav) } : null,
        designNotes().length ? { label: 'Note design…', icon: ICON.edit, run: bulkEdit } : null,
        items.length ? { label: 'Tags…', icon: ICON.tag, run: bulkTags } : null, // 1.4.10
        '-',
        items.length >= 2 ? { label: 'Put together in a new group', icon: ICON.folder, run: bulkGroup } : null,
        pickedGroups().length ? { label: 'Group look…', icon: ICON.palette, run: () => openLook(true) } : null,
        V.tab === 'notes' && V.openGroup && items.length ? { label: 'Move out of this group', icon: ICON.out, run: bulkOut } : null,
        items.length ? { label: 'Cut (Ctrl+X)', icon: ICON.cut, run: () => bulkCut() } : null,
        items.length ? { label: 'Copy (Ctrl+C)', icon: ICON.copy, run: () => bulkCopy() } : null,
        every.notes.some((n) => !n.ownLock) || every.groups.some((g) => !g.locked) ? { label: 'Lock', icon: ICON.lock, run: bulkLock } : null,
        '-',
        { label: `Move to Bin (${every.items.length})`, icon: ICON.trash, danger: true, run: () => bulkTrash(false), disabled: $('#bBin').disabled },
        { label: 'Clear selection', icon: ICON.x, run: clearSel },
      ]);
      return true;
    }
    if (sel.size && !sel.has(key)) clearSel();
    return false;
  }
  async function bulkOpen() { for (const n of bulkParts().notes) if (!n.open) await S.list.openNote(n.id); }
  async function bulkClose() { for (const n of bulkParts().notes) if (n.open) await S.list.closeNote(n.id); }
  async function bulkGroup() {
    const { items } = bulkParts();
    if (items.length < 2) return;
    const id = await S.groups.makeFrom(items.map((it) => it.id), V.tab === 'notes' ? V.openGroup || null : null);
    clearSel();
    toast(id ? 'Put together in a new group' : 'Could not make a group');
  }
  async function bulkLock() {
    const { notes, groups } = bulkParts(true);
    if (!(await ensurePassword())) return;
    for (const n of notes) if (!n.ownLock) await S.list.setLocked(n.id, true);
    for (const g of groups) if (!g.locked) await S.groups.setLocked(g.id, true);
    if (V.openGroup && groups.some((g) => V.openGroup === g.id || isInside(V.openGroup, g.id))) V.openGroup = null;
    clearSel();
    toast('Locked 🔒');
  }
  async function bulkTrash(skipAsk) {
    const { notes, groups } = bulkParts(true);
    const okNotes = notes.filter((n) => !noteIsLocked(n));
    const okGroups = groups.filter((g) => !groupIsLocked(g));
    const kept = notes.length + groups.length - okNotes.length - okGroups.length;
    if (!okNotes.length && !okGroups.length) { toast(LOCKED_NO_DELETE); return; }
    const inGroups = new Set();
    for (const g of okGroups) for (const n of notesInTree(g.id)) inGroups.add(n.id);
    const count = new Set([...okNotes.map((n) => n.id), ...inGroups]).size;
    if (!skipAsk) {
      const ok = await modal({
        title: `Move ${plural(count, 'note')} to the Bin?`,
        text: `They can be restored from the Bin any time.${kept ? ` ${plural(kept, 'locked one')} ${kept === 1 ? 'stays' : 'stay'} where ${kept === 1 ? 'it is' : 'they are'}.` : ''}`,
        tip: 'Tip: Shift+Delete skips this question.',
        okLabel: 'Move to Bin',
        danger: true,
      });
      if (!ok) return;
    }
    for (const g of okGroups) await S.groups.trash(g.id);
    for (const n of okNotes) if (!inGroups.has(n.id)) await S.list.trash(n.id);
    clearSel();
    toast(kept ? `Moved to the Bin · ${plural(kept, 'locked one')} kept` : 'Moved to the Bin');
  }
  $('#bOpen').addEventListener('click', bulkOpen);
  $('#bClose').addEventListener('click', bulkClose);
  $('#bFav').addEventListener('click', () => setFav([...sel], !$('#bFav').classList.contains('on')));
  $('#bEdit').addEventListener('click', bulkEdit);
  $('#bTags').addEventListener('click', bulkTags);
  $('#bGroup').addEventListener('click', bulkGroup);
  $('#bLock').addEventListener('click', bulkLock);
  $('#bBin').addEventListener('click', (e) => bulkTrash(e.shiftKey));
  $('#bLook').addEventListener('click', () => openLook());
  $('#bOut').addEventListener('click', bulkOut);
  $('#bCut').addEventListener('click', () => bulkCut());
  $('#bCopy').addEventListener('click', () => bulkCopy());
  $('#bPaste').addEventListener('click', () => pasteCut());
  $('#bX').addEventListener('click', () => { if (sel.size) clearSel(); else cancelCut(); });


  function renderBin(binned) {
    const box = $('#binCards');
    box.innerHTML = '';
    $('#btnEmpty').disabled = !binned.length;
    if (!binned.length) {
      box.append(emptyState('The bin is empty', 'Deleted notes show up here.'));
      return;
    }
    const q = V.binQuery.trim().toLowerCase();
    const shown = q ? binned.filter((n) => `${n.title || ''}\n${n.text || ''}\n${n.pics || ''}`.toLowerCase().includes(q)) : binned;
    if (!shown.length) {
      box.append(emptyState('Nothing found', `No deleted note contains “${V.binQuery.trim()}”.`));
      return;
    }
    shown.sort((a, b) => b.deletedAt - a.deletedAt).forEach((n) => {
      const foot = h('div', { class: 'foot' },
        h('span', { class: 'when' }, 'Deleted ' + when(n.deletedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())));
      const acts = h('div', { class: 'foot', style: 'padding-top:0' },
        h('button', { class: 'pill', onclick: () => S.list.restore(n.id) }, 'Restore'),
        h('button', { class: 'pill danger', disabled: noteIsLocked(n) || null, title: noteIsLocked(n) ? LOCKED_NO_DELETE : 'Delete forever (Shift+click: no question)', onclick: (e) => destroyNote(n, e.shiftKey) }, 'Delete'));
      box.append(h('div', {
        class: 'card binned', 'data-color': n.color, 'data-font': n.font, style: `--r:${tilt(n.id)}deg`,
        oncontextmenu: (e) => { e.preventDefault(); showCtx(e, [
          { label: 'Restore', icon: ICON.restore, run: () => S.list.restore(n.id) },
          '-',
          noteIsLocked(n)
            ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
            : { label: 'Delete forever…', icon: ICON.trash, danger: true, run: () => destroyNote(n) },
        ]); },
      }, h('div', { class: 'strip' }), cardBody(n), foot, acts));
    });
    markMore(box.querySelectorAll('.card > .body'));
  }

  Object.assign(K, { selItems, starBtn, lockBtn, unlockedNow, setFav, visibleKeys, pickCard, clearSel, paintCards, paintBulk,
    bulkMenu, bulkTrash, renderBin, bulkCut, bulkCopy, cancelCut, pasteCut, undoMove, openLook });
})();
