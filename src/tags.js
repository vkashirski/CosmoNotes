'use strict';
/*
 * CosmoNotes - tags (1.4.10, the owner's wish): notes and groups can have tags (#work, #home…), and the notes list
 * filters by them: click tags under the search box (several at once: All of them or Any of them), or type #work in the
 * search (with words too: "#work milk"). A group's tags count for everything inside it: its notes and its groups.
 * The rules live here, once: store.js cleans what is saved, main and both windows use the same ones (window.COSMO_TAGS).
 * The editor (the chips and a box to type a new one) is the list's Tags pop-up. 1.4.30 (the owner's wish, like GitHub
 * labels): the note's ⋯ menu row is the picker (every tag, this note's ticked) and Manage tags (manager: rename, colour or
 * delete a tag in every note; main/ipc-tags.js). Each tag can have a colour (COLORS, settings.tagColors).
 * A note's tags are secret like its words (main/constants.js SECRET, main/crypt.js SECRET_FIELDS): sealed with a locked
 * note, [] while it is sealed or its lock hides it. A group's are not (like its name).
 *
 * A tag: lower case, letters / numbers / marks, - and _; spaces become -; no # (it is only shown); at most LEN letters.
 */
((root) => {
  const MAX = 20; // tags on one note or group
  const LEN = 30; // letters in one tag

  function clean(t) {
    if (typeof t !== 'string') return null;
    const s = t.normalize('NFC').toLowerCase().replace(/^[\s#]+/, '').trim().replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{M}\p{N}_-]/gu, '').replace(/^-+|-+$/g, '');
    const cut = Array.from(s).slice(0, LEN).join('').replace(/-+$/, '');
    return cut || null;
  }
  // a saved list: clean, each once, at most MAX (anything else = none)
  function cleanAll(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const t of list) {
      const c = clean(t);
      if (c && !out.includes(c)) out.push(c);
      if (out.length >= MAX) break;
    }
    return out;
  }
  // the search box: "#work milk #ho" = tags ['work', 'ho'] (each the start of a tag) and the words "milk"
  function parse(q) {
    const tags = [];
    const words = [];
    for (const w of String(q || '').split(/\s+/)) {
      if (!w || w === '#') continue;
      const t = w.startsWith('#') ? clean(w) : null;
      if (t) { if (!tags.includes(t)) tags.push(t); } else words.push(w);
    }
    return { tags, text: words.join(' ').toLowerCase() };
  }
  // `have`: everything an item counts as tagged with (its own and its groups'). Picked tags must be there as they are,
  // typed ones only start one. any = one of them is enough (else all of them).
  function match(have, picked = [], typed = [], any = false) {
    const conds = [...picked.map((t) => (x) => x === t), ...typed.map((t) => (x) => x.startsWith(t))];
    if (!conds.length) return true;
    const ok = (c) => have.some(c);
    return any ? conds.some(ok) : conds.every(ok);
  }
  const sorted = (list) => [...list].sort((a, b) => a.localeCompare(b));

  // ---- the editor. tags: the ones it has; some: (several notes) ones only some of them have, faded; known: every tag
  // used anywhere, for the suggestions. add(tag) / remove(tag) save it (they may return a promise).
  function editor({ tags = [], some = [], known = [], colors = {}, add, remove, doc }) {
    const D = doc || root.document;
    const mk = (tag, cls, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    let have = cleanAll(tags);
    let part = cleanAll(some).filter((t) => !have.includes(t));
    const all = [...new Set(known.map(clean).filter(Boolean))];
    const el = mk('div', 'tagedit');
    const chips = mk('div', 'tchips');
    const input = mk('input', 'tinput');
    input.maxLength = LEN + 1;
    input.autocomplete = 'off';
    input.spellcheck = false;
    const sugg = mk('div', 'tsugg');
    el.append(chips, input, sugg);
    function paint() {
      chips.replaceChildren();
      for (const t of have) chips.append(chip(t, false));
      for (const t of part) chips.append(chip(t, true));
      chips.hidden = !have.length && !part.length;
      const full = have.length >= MAX;
      input.disabled = full;
      input.placeholder = full ? `At most ${MAX} tags` : have.length || part.length ? 'Add another tag' : 'Add a tag';
      paintSugg();
    }
    function chip(t, partly) {
      const c = mk('span', 'tchip' + (partly ? ' part' : ''));
      if (!partly) paintChip(c, t, colors); // 1.4.30: its colour
      const name = mk(partly ? 'button' : 'span', 'tname', `#${t}`);
      if (partly) {
        name.type = 'button';
        name.title = 'Only some have it. Click to add it to all';
        name.addEventListener('click', () => put(t));
      }
      const x = mk('button', 'tx', '×');
      x.type = 'button';
      x.title = partly ? 'Remove it from all' : 'Remove';
      x.addEventListener('click', () => take(t));
      c.append(name, x);
      return c;
    }
    function paintSugg() {
      const typed = clean(input.value) || '';
      const list = sorted([...new Set(all)].filter((t) => !have.includes(t) && t.startsWith(typed) && t !== typed)).slice(0, 8);
      sugg.replaceChildren(...list.map((t) => {
        const b = paintChip(mk('button', 'tsg', `#${t}`), t, colors); // 1.4.30: its colour
        b.type = 'button';
        b.title = 'Add this tag';
        b.addEventListener('mousedown', (e) => e.preventDefault()); // the box keeps the focus
        b.addEventListener('click', () => { input.value = ''; put(t); });
        return b;
      }));
      sugg.hidden = !list.length || have.length >= MAX;
    }
    async function put(t) {
      t = clean(t);
      if (!t || have.includes(t) || have.length >= MAX) return;
      have = [...have, t];
      part = part.filter((x) => x !== t);
      if (!all.includes(t)) all.push(t);
      paint();
      if (add) await add(t);
    }
    async function take(t) {
      have = have.filter((x) => x !== t);
      part = part.filter((x) => x !== t);
      paint();
      if (remove) await remove(t);
    }
    function commit() {
      const t = clean(input.value);
      input.value = '';
      if (t) put(t); else paintSugg();
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        if (e.key !== 'Enter' || input.value.trim()) e.preventDefault();
        if (input.value.trim()) { e.stopPropagation(); commit(); }
      }
    });
    // pasted "work, home urgent": every piece but the last becomes a tag; the last stays in the box
    input.addEventListener('input', () => {
      if (/[,\s]/.test(input.value)) {
        const pieces = input.value.split(/[,\s]+/);
        input.value = pieces.pop();
        for (const p of pieces) put(p);
      }
      paintSugg();
    });
    input.addEventListener('blur', () => { if (input.value.trim()) commit(); });
    paint();
    return {
      el,
      focus: () => input.focus(),
      // from outside (the note changed elsewhere): show these, unless a tag is being typed
      set(next, nextSome = []) {
        have = cleanAll(next);
        part = cleanAll(nextSome).filter((t) => !have.includes(t));
        paint();
      },
      busy: () => D.activeElement === input && !!input.value,
    };
  }

  // ---- 1.4.30: a colour for each tag (the owner's wish, like GitHub labels). settings.tagColors = { tag: colour id };
  // a tag without one is the dark pill it always was. A tag in tagColors exists even on no note (made in Manage tags).
  // Its name is in settings.json in plain text: it is not secret like the tags on a note.
  const COLORS = [
    { id: 'dark', name: 'Dark', bg: '', fg: '' }, // the default: each window's own dark pill
    { id: 'yellow', name: 'Yellow', bg: '#FFEC85', fg: '#5E4700' },
    { id: 'orange', name: 'Peach', bg: '#FFDFBF', fg: '#7A3D08' },
    { id: 'pink', name: 'Pink', bg: '#FFD6E6', fg: '#85234D' },
    { id: 'purple', name: 'Lilac', bg: '#E8DDFF', fg: '#4E3093' },
    { id: 'blue', name: 'Sky', bg: '#D2ECFF', fg: '#1A5283' },
    { id: 'mint', name: 'Mint', bg: '#CDF3E8', fg: '#17604E' },
    { id: 'green', name: 'Lime', bg: '#D8F5C4', fg: '#2F6413' },
  ];
  const COLOR_IDS = COLORS.map((c) => c.id);
  const KNOWN_MAX = 500; // tags in tagColors
  const cleanColor = (c) => (COLOR_IDS.includes(c) ? c : null);
  function cleanColors(map) {
    const out = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
    for (const [k, v] of Object.entries(map)) {
      const t = clean(k);
      const c = cleanColor(v);
      if (t && c && !(t in out)) out[t] = c;
      if (Object.keys(out).length >= KNOWN_MAX) break;
    }
    return out;
  }
  // a chip's colours as CSS ('' = the window's own dark pill)
  function colorStyle(id) {
    const c = COLORS.find((x) => x.id === id);
    return c && c.bg ? `background:${c.bg};color:${c.fg}` : '';
  }
  const chipStyle = (tag, colors) => colorStyle(colors && colors[tag]);
  function paintColor(el, id) {
    const st = colorStyle(id);
    el.style.cssText = st;
    el.classList.toggle('tc', !!st);
    return el;
  }
  const paintChip = (el, tag, colors) => paintColor(el, colors && colors[tag]);
  const mkIn = (D) => (tag, cls, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (mk, cls, text, title, onClick) => {
    const b = mk('button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };

  // ---- 1.4.30: the note's ⋯ menu (the owner's pick): every tag to press, this note's lit and the rest greyed; a press adds
  // or removes it. all: [{ tag }] (main tags:all). add(tag) / remove(tag) save it; + Add calls manage() (Manage tags).
  function picker({ tags = [], all = [], colors = {}, add, remove, manage, doc }) {
    const D = doc || root.document;
    const mk = mkIn(D);
    let have = cleanAll(tags);
    let list = [];
    let cols = colors || {};
    const el = mk('div', 'tagpick');
    const setAll = (next) => { list = [...new Set((next || []).map((x) => clean(x && x.tag)).filter(Boolean))]; };
    setAll(all);
    function paint() {
      const every = sorted([...new Set([...list, ...have])]);
      const full = have.length >= MAX;
      el.replaceChildren(...every.map((t) => {
        const on = have.includes(t);
        const b = button(mk, 'tq' + (on ? ' on' : ''), `#${t}`, on ? 'Click to take it off this note' : full ? `At most ${MAX} tags` : 'Click to add it to this note',
          () => (have.includes(t) ? take(t) : put(t)));
        b.dataset.tag = t;
        b.setAttribute('aria-pressed', String(on));
        b.disabled = !on && full;
        return paintChip(b, t, cols);
      }), button(mk, 'tqadd', '+ Add', 'Make, rename, colour or delete tags', () => manage && manage()));
    }
    async function put(t) {
      t = clean(t);
      if (!t || have.includes(t) || have.length >= MAX) return;
      have = [...have, t];
      paint();
      if (add) await add(t);
    }
    async function take(t) {
      have = have.filter((x) => x !== t);
      paint();
      if (remove) await remove(t);
    }
    paint();
    return {
      el,
      // from outside: this note's tags changed, or the tags in use, or their colours
      set(next, nextAll = null, nextColors = null) {
        have = cleanAll(next);
        if (nextAll) setAll(nextAll);
        if (nextColors) cols = nextColors;
        paint();
      },
      busy: () => false,
    };
  }

  // ---- 1.4.30: Manage tags: every tag, rename / colour / delete it in every note and group, or make a new one.
  // all: [{ tag, count, locked }] (locked = a note or group whose lock hides it may have it: renaming or deleting it then
  // needs the PIN). act.color(tag, colour), act.rename(from, to, pw), act.remove(tag, pw) return main's answer
  // ({ ok } or { error: 'pin' | 'wrong' | … }); act.create(tag, colour) makes one (else act.color). After each, the caller
  // calls set() with the new list.
  function manager({ all = [], colors = {}, pinWord = 'PIN', act = {}, doc }) {
    const D = doc || root.document;
    const mk = mkIn(D);
    let list = [];
    let cols = colors || {};
    let open = null; // { kind: 'edit' | 'new' | 'delete', tag }
    const el = mk('div', 'tagman');
    const find = mk('input', 'tinput');
    find.placeholder = 'Find a tag';
    find.setAttribute('aria-label', 'Find a tag');
    find.spellcheck = false;
    const head = mk('div', 'tmhead');
    head.append(find, button(mk, 'tmadd', '+ New tag', 'Make a new tag', () => { open = { kind: 'new', tag: '' }; paint(); }));
    const rows = mk('div', 'tmlist');
    const note = mk('p', 'tmnote', 'Changes apply to every note.');
    el.append(head, rows, note);
    const setAll = (next) => { list = (next || []).map((x) => ({ tag: clean(x.tag), count: Number(x.count) || 0, locked: !!x.locked })).filter((x) => x.tag); };
    setAll(all);
    const notes = (n) => (n === 1 ? '1 note' : `${n} notes`);
    function pinField() {
      const p = mk('input', 'tinput tpin');
      p.type = 'password';
      p.autocomplete = 'off';
      p.setAttribute('aria-label', pinWord);
      p.placeholder = pinWord;
      if (pinWord === 'PIN') p.inputMode = 'numeric';
      return p;
    }
    function swatches(pick, onPick) {
      const box = mk('div', 'tswatch');
      box.setAttribute('role', 'radiogroup');
      box.setAttribute('aria-label', 'Colour');
      for (const c of COLORS) {
        const s = button(mk, 'tsw' + (c.id === pick ? ' on' : ''), '', c.name, () => onPick(c.id));
        s.dataset.c = c.id;
        s.setAttribute('role', 'radio');
        s.setAttribute('aria-checked', String(c.id === pick));
        if (c.bg) s.style.background = c.bg;
        box.append(s);
      }
      return box;
    }
    function editBox(item) {
      const isNew = !item;
      const from = isNew ? '' : item.tag;
      let color = (cols[from]) || 'dark';
      const box = mk('div', 'tmedit');
      const name = mk('input', 'tinput');
      name.value = from;
      name.maxLength = LEN + 1;
      name.spellcheck = false;
      name.placeholder = 'Tag name';
      name.setAttribute('aria-label', 'Tag name');
      const preview = mk('span', 'tchip');
      const msg = mk('p', 'tmmsg');
      const pin = pinField();
      pin.hidden = true;
      const save = button(mk, 'tmsave', isNew ? 'Make' : 'Save');
      const cancel = button(mk, 'tmcancel', 'Cancel', null, () => { open = null; paint(); });
      const sw = mk('div');
      const paintBox = () => {
        const to = clean(name.value) || '';
        preview.textContent = `#${to || '…'}`;
        paintColor(preview, color);
        sw.replaceChildren(swatches(color, (c) => { color = c; paintBox(); }));
        const taken = to && to !== from && list.some((x) => x.tag === to);
        if (!to) msg.textContent = '';
        else if (isNew) msg.textContent = taken ? `#${to} already exists.` : '';
        else if (taken) msg.textContent = `#${to} already exists. Save joins them into one.`;
        else if (to !== from) msg.textContent = item.count ? `Renames it on ${notes(item.count)}.` : '';
        else msg.textContent = '';
        if (!pin.hidden) msg.textContent = `Locked notes may have #${from}. Type your ${pinWord} to change them too.`;
        save.disabled = !to || (isNew && taken);
      };
      name.addEventListener('input', paintBox);
      async function go() {
        const to = clean(name.value);
        if (!to) return;
        if (isNew || to === from) {
          const r = await (isNew && act.create ? act.create(to, color) : act.color(to, color));
          if (!r || !r.ok) { msg.textContent = 'Could not save it.'; return; }
          open = null;
          paint();
          return;
        }
        if (item.locked && pin.hidden) { pin.hidden = false; paintBox(); pin.focus(); return; }
        if (!pin.hidden && !pin.value) { pin.focus(); return; }
        save.disabled = true;
        const r = await act.rename(from, to, pin.hidden ? null : pin.value);
        save.disabled = false;
        if (r && r.error === 'pin') { pin.hidden = false; paintBox(); pin.focus(); return; }
        if (r && r.error === 'wrong') { msg.textContent = `Wrong ${pinWord}.`; pin.value = ''; pin.focus(); return; }
        if (!r || !r.ok) { msg.textContent = 'Could not rename it.'; return; }
        if ((cols[from] || 'dark') !== color) await act.color(to, color);
        open = null;
        paint();
      }
      save.addEventListener('click', go);
      for (const f of [name, pin]) f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } if (e.key === 'Escape') { e.stopPropagation(); open = null; paint(); } });
      const btns = mk('div', 'tmbtns');
      btns.append(cancel, save);
      box.append(preview, name, sw, msg, pin, btns);
      paintBox();
      setTimeout(() => name.focus(), 0);
      return box;
    }
    function deleteBox(item) {
      const box = mk('div', 'tmedit tmdel');
      const q = mk('b', 'tmq', item.count ? `Remove #${item.tag} from ${notes(item.count)}?` : `Delete #${item.tag}?`);
      const msg = mk('p', 'tmmsg', 'The notes stay. Only the tag goes.');
      const pin = pinField();
      pin.hidden = !item.locked;
      if (item.locked) msg.textContent = `Locked notes may have it. Type your ${pinWord} to remove it there too.`;
      const yes = button(mk, 'tmsave tmremove', 'Remove');
      const no = button(mk, 'tmcancel', 'Cancel', null, () => { open = null; paint(); });
      async function go() {
        if (!pin.hidden && !pin.value) { pin.focus(); return; }
        yes.disabled = true;
        const r = await act.remove(item.tag, pin.hidden ? null : pin.value);
        yes.disabled = false;
        if (r && r.error === 'pin') { pin.hidden = false; msg.textContent = `Locked notes may have it. Type your ${pinWord} to remove it there too.`; pin.focus(); return; }
        if (r && r.error === 'wrong') { msg.textContent = `Wrong ${pinWord}.`; pin.value = ''; pin.focus(); return; }
        if (!r || !r.ok) { msg.textContent = 'Could not remove it.'; return; }
        open = null;
        paint();
      }
      yes.addEventListener('click', go);
      pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } });
      const btns = mk('div', 'tmbtns');
      btns.append(no, yes);
      box.append(q, msg, pin, btns);
      if (item.locked) setTimeout(() => pin.focus(), 0);
      return box;
    }
    function paint() {
      const typed = clean(find.value) || '';
      const shown = list.filter((x) => !typed || x.tag.includes(typed)).sort((a, b) => a.tag.localeCompare(b.tag));
      const out = [];
      if (open && open.kind === 'new') out.push(editBox(null));
      for (const it of shown) {
        if (open && open.tag === it.tag && open.kind === 'edit') { out.push(editBox(it)); continue; }
        const r = mk('div', 'tmrow');
        r.dataset.tag = it.tag;
        r.append(paintChip(mk('span', 'tchip', `#${it.tag}`), it.tag, cols), mk('small', 'tcount', notes(it.count)),
          button(mk, 'tmedit-b', '✎', `Rename or colour #${it.tag}`, () => { open = { kind: 'edit', tag: it.tag }; paint(); }),
          button(mk, 'tmdel-b', '×', `Delete #${it.tag}`, () => { open = { kind: 'delete', tag: it.tag }; paint(); }));
        out.push(r);
        if (open && open.tag === it.tag && open.kind === 'delete') out.push(deleteBox(it));
      }
      if (!out.length) out.push(mk('p', 'tmempty', typed ? 'No tag like that.' : 'No tags yet.'));
      rows.replaceChildren(...out);
    }
    find.addEventListener('input', paint);
    paint();
    return {
      el,
      // the tags again after a change (here or elsewhere): an open edit stays open while its tag is still there
      set(next, nextColors = null) {
        setAll(next);
        if (nextColors) cols = nextColors;
        if (open && open.kind !== 'new' && !list.some((x) => x.tag === open.tag)) open = null;
        if (D.activeElement && el.contains(D.activeElement) && D.activeElement !== find && open) return; // typing in an open row
        paint();
      },
      busy: () => !!open || (D.activeElement === find && !!find.value),
    };
  }

  const api = { MAX, LEN, clean, cleanAll, parse, match, sorted, editor, COLORS, COLOR_IDS, cleanColor, cleanColors, chipStyle, paintColor, paintChip, picker, manager };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COSMO_TAGS = api;
})(typeof window !== 'undefined' ? window : globalThis);
