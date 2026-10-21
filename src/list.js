'use strict';
(() => {
  const S = window.sticky;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange', 'mint', 'charcoal'];
  const SWATCH = { yellow: '#FFE968', pink: '#FFB5D0', green: '#B9E79C', blue: '#A9D8FF', purple: '#D0BDFF', orange: '#FFC38C', mint: '#A4E5D1', charcoal: '#3A3940' };
  const ICON = {
    open: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    hide: '<svg viewBox="0 0 24 24"><path d="M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.67 2.68M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  };

  let state = { notes: [], settings: {} };
  let tab = 'notes';
  let query = '';
  let showAllBackups = false;

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

  function tilt(id) {
    let x = 0;
    for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return ((x % 7) - 3) * 0.45;
  }

  // ---------- data
  async function load() {
    state = await S.list.get();
    render();
  }
  S.list.onChanged(load);

  // ---------- rendering
  function render() {
    const live = state.notes.filter((n) => !n.deletedAt);
    const binned = state.notes.filter((n) => n.deletedAt);
    $('#cNotes').textContent = live.length;
    $('#cBin').textContent = binned.length;
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    $('#viewNotes').hidden = tab !== 'notes';
    $('#viewBin').hidden = tab !== 'bin';
    $('#viewSettings').hidden = tab !== 'settings';
    if (tab === 'notes') renderNotes(live);
    if (tab === 'bin') renderBin(binned);
    if (tab === 'settings') renderSettings();
  }

  function cardBody(n) {
    const lines = (n.text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const body = h('div', { class: 'body' });
    if (lines.length) {
      body.append(h('div', { class: 'txt' }, h('span', { class: 't1' }, lines[0]), lines.length > 1 ? '\n' + lines.slice(1).join('\n') : ''));
    } else if (!n.firstImage) {
      body.append(h('div', { class: 'txt empty' }, 'Empty note'));
    }
    if (n.firstImage) {
      body.append(h('img', { class: 'thumb' + (lines.length ? '' : ' only'), src: n.firstImage, alt: '', onerror: (e) => e.target.remove() }));
    }
    return body;
  }

  function renderNotes(live) {
    const box = $('#cards');
    const scroll = $('#viewNotes').scrollTop;
    box.innerHTML = '';
    const q = query.trim().toLowerCase();
    const notes = live
      .filter((n) => !q || (n.text || '').toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (!live.length) {
      box.append(h('div', { class: 'emptystate' },
        h('div', { class: 'stack' }, h('i'), h('i'), h('i')),
        h('h2', {}, 'No notes yet'),
        h('p', {}, 'Your first sticky note is one click away.'),
        h('button', { class: 'pill', onclick: () => S.list.newNote() }, '+ New note')));
      return;
    }
    if (!notes.length) {
      box.append(h('div', { class: 'emptystate' }, h('h2', {}, 'Nothing found'), h('p', {}, `No note contains “${query.trim()}”.`)));
      return;
    }
    notes.forEach((n, i) => {
      const acts = h('div', { class: 'acts' },
        n.open
          ? h('button', { class: 'act', title: 'Close this note (keeps it here)', html: ICON.hide, onclick: (e) => { e.stopPropagation(); S.list.closeNote(n.id); } })
          : h('button', { class: 'act', title: 'Open on desktop', html: ICON.open, onclick: (e) => { e.stopPropagation(); S.list.openNote(n.id); } }),
        h('button', { class: 'act', title: 'Move to bin', html: ICON.trash, onclick: (e) => { e.stopPropagation(); S.list.trash(n.id); } }));
      const foot = h('div', { class: 'foot' },
        h('span', { class: 'when', title: new Date(n.updatedAt).toLocaleString() }, n.restoredFrom ? 'Restored' : when(n.updatedAt)),
        n.open ? h('span', { class: 'badge', title: 'Open on your desktop' }, h('i'), 'open') : null,
        acts);
      const card = h('div', {
        class: 'card',
        'data-color': n.color,
        'data-font': n.font,
        style: `--r:${tilt(n.id)}deg; animation-delay:${Math.min(i, 12) * 18}ms`,
        title: n.open ? 'Click to bring to front' : 'Click to open on your desktop',
        onclick: () => S.list.openNote(n.id),
      }, h('div', { class: 'strip' }), n.pinned ? h('span', { class: 'pin', title: 'Pinned on top' }) : null, cardBody(n), foot);
      box.append(card);
    });
    $('#viewNotes').scrollTop = scroll;
  }

  function renderBin(binned) {
    const box = $('#binCards');
    box.innerHTML = '';
    $('#btnEmpty').disabled = !binned.length;
    if (!binned.length) {
      box.append(h('div', { class: 'emptystate' }, h('h2', {}, 'The bin is empty'), h('p', {}, 'Notes you delete will wait here.')));
      return;
    }
    binned.sort((a, b) => b.deletedAt - a.deletedAt).forEach((n) => {
      const foot = h('div', { class: 'foot' },
        h('span', { class: 'when' }, 'Deleted ' + when(n.deletedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())),
      );
      const acts = h('div', { class: 'foot', style: 'padding-top:0' },
        h('button', { class: 'pill', onclick: () => S.list.restore(n.id) }, 'Restore'),
        h('button', { class: 'pill danger', title: 'Delete forever', onclick: () => S.list.destroy(n.id) }, 'Delete'));
      box.append(h('div', { class: 'card binned', 'data-color': n.color, 'data-font': n.font, style: `--r:${tilt(n.id)}deg` },
        h('div', { class: 'strip' }), cardBody(n), foot, acts));
    });
  }

  async function renderSettings() {
    const s = state.settings;
    $('#sStartup').checked = !!s.startWithWindows;
    const sc = $('#sColors');
    sc.innerHTML = '';
    for (const c of COLORS) {
      sc.append(h('button', {
        class: 'sw' + (s.defaultColor === c ? ' on' : ''),
        style: `background:${SWATCH[c]}`,
        title: c,
        onclick: () => S.settings.set({ defaultColor: c }),
      }));
    }
    $$('#sFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === s.defaultFont));
    $('#dataPath').textContent = s.dataPath || '';
    $('#version').textContent = `Sticky Pins ${s.version || ''}`;
    renderBackups(await S.backups.list());
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
        h('span', {}, h('b', {}, label), h('small', {}, b.count != null ? `${b.count} note${b.count === 1 ? '' : 's'}` : '')),
        h('button', { class: 'pill ghost', onclick: () => S.backups.restore(b.name) }, 'Restore')));
    }
    if (list.length > 5 && !showAllBackups) {
      box.append(h('button', { class: 'pill ghost bk-more', onclick: () => { showAllBackups = true; renderBackups(list); } }, `Show all ${list.length}`));
    }
  }

  // ---------- events
  $$('.tab').forEach((t) => t.addEventListener('click', () => { tab = t.dataset.tab; render(); }));
  $('#btnNew').addEventListener('click', () => S.list.newNote());
  $('#btnFront').addEventListener('click', () => S.list.bringToFront());
  $('#q').addEventListener('input', (e) => { query = e.target.value; render(); });
  $('#btnEmpty').addEventListener('click', () => S.list.emptyBin());
  $('#sStartup').addEventListener('change', (e) => S.settings.set({ startWithWindows: e.target.checked }));
  $$('#sFont button').forEach((b) => b.addEventListener('click', () => S.settings.set({ defaultFont: b.dataset.font })));
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); S.list.newNote(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); tab = 'notes'; render(); $('#q').focus(); }
  });
  window.addEventListener('focus', load);

  load();
})();
