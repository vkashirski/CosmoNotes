'use strict';
/*
 * CosmoNotes - tags (1.4.10, the owner's wish): notes and groups can have tags (#work, #home…), and the notes list
 * filters by them: click tags under the search box (several at once: All of them or Any of them), or type #work in the
 * search (with words too: "#work milk"). A group's tags count for everything inside it: its notes and its groups.
 * The rules live here, once: store.js cleans what is saved, main and both windows use the same ones (window.COSMO_TAGS).
 * The editor (the chips and a box to type a new one) is the list's Tags pop-up and the note's ⋯ menu row.
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
  function editor({ tags = [], some = [], known = [], add, remove, doc }) {
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
        const b = mk('button', 'tsg', `#${t}`);
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

  const api = { MAX, LEN, clean, cleanAll, parse, match, sorted, editor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COSMO_TAGS = api;
})(typeof window !== 'undefined' ? window : globalThis);
