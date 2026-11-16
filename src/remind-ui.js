'use strict';
/*
 * CosmoNotes - the reminders panel and the reminder sounds (1.4.1), the same in both windows (window.COSMO_REMIND_UI):
 * the note window opens it from Add → Reminder (src/note/remind.js), the notes list from right-click → Reminders… and a
 * card's clock (src/list/actions-locks.js). It shows the note's reminders and adds or changes one; every change is saved
 * at once through `save` (main/reminders.js setReminders checks it). The rules and words are src/reminders.js
 * (window.COSMO_REMIND); its styles are below, in each window's own pop-up colours (--pop-* in a note, the theme's in the
 * list). The sounds are made here with Web Audio: soft and calm, from nature, a few seconds each, no files.
 */
(function (root) {
  const R = root.COSMO_REMIND;
  const doc = root.document;

  // ---------------------------------------------------------------- the sounds
  let ctx = null;
  let noise = null;
  function audio() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // one soft tone: frequency (or [from, to] for a glide), start, length, loudness, type
  function tone(c, out, f, t, len, gain, type = 'sine', attack = 0.01) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + Math.min(len, f[2] || len)); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  }
  // filtered noise that swells in and out (rain, a stream, waves, wind)
  function hiss(c, out, t, len, gain, type, freq, q = 1, swell = 0.4, sweep = null) {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) for (const [at, v] of sweep) f.frequency.linearRampToValueAtTime(v, t + at);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + len * swell);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + len + 0.05);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const MAKE = {
    drops: (c, o, t) => { [0, 0.42, 0.7, 1.25, 1.6].forEach((d, i) => tone(c, o, [1400 - i * 90, 520, 0.09], t + d, 0.35, 0.5)); },
    chime: (c, o, t) => {
      [0, 0.35, 0.8, 1.15, 1.7].forEach((d) => { const f = pick(PENTA) * 2; tone(c, o, f, t + d, 2.4, 0.22, 'sine', 0.005); tone(c, o, f * 2.76, t + d, 0.9, 0.05, 'sine', 0.005); });
    },
    birds: (c, o, t) => {
      const chirp = (d, a, b) => tone(c, o, [a, b, 0.07], t + d, 0.11, 0.18, 'sine', 0.01);
      [0, 0.14, 0.28].forEach((d) => chirp(d, 2600, 4200));
      [0.9, 1.0].forEach((d) => chirp(d, 3800, 2400));
      [1.7, 1.82, 1.94, 2.06].forEach((d) => chirp(d, 3000, 4600));
    },
    stream: (c, o, t) => {
      hiss(c, o, t, 3.6, 0.35, 'bandpass', 900, 0.8, 0.35, [[1.2, 1400], [2.4, 800], [3.6, 1200]]);
      [0.5, 1.3, 2.1, 2.7].forEach((d) => tone(c, o, [1100 + Math.random() * 500, 600, 0.06], t + d, 0.2, 0.18));
    },
    rain: (c, o, t) => {
      hiss(c, o, t, 3.6, 0.28, 'highpass', 1800, 0.5, 0.3);
      for (let i = 0; i < 14; i++) tone(c, o, [2400 + Math.random() * 1600, 1200, 0.02], t + 0.2 + Math.random() * 3, 0.05, 0.08);
    },
    waves: (c, o, t) => { hiss(c, o, t, 4.2, 0.5, 'lowpass', 500, 0.7, 0.45, [[1.8, 1100], [4.2, 350]]); },
    bowl: (c, o, t) => {
      tone(c, o, 220, t, 4.5, 0.32, 'sine', 0.08);
      tone(c, o, 221.6, t, 4.5, 0.2, 'sine', 0.08); // a slow beat, like a real bowl
      tone(c, o, 594, t, 2.6, 0.08, 'sine', 0.05);
    },
    bamboo: (c, o, t) => {
      [[0, 620], [0.22, 760], [0.55, 540], [0.9, 700]].forEach(([d, f]) => { tone(c, o, [f * 1.2, f, 0.02], t + d, 0.28, 0.42, 'triangle', 0.003); hiss(c, o, t + d, 0.04, 0.12, 'bandpass', 2500, 2, 0.1); });
    },
    crickets: (c, o, t) => {
      for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) tone(c, o, 4300, t + k * 0.85 + i * 0.045, 0.03, 0.06, 'sine', 0.004);
    },
    breeze: (c, o, t) => {
      hiss(c, o, t, 4, 0.4, 'bandpass', 400, 1.4, 0.5, [[2, 900], [4, 500]]);
      tone(c, o, PENTA[4] * 2, t + 2.4, 1.8, 0.08, 'sine', 0.005);
    },
  };
  // play a sound (an id of R.SOUNDS) at a loudness 0 – 1; 'none' or nothing plays nothing
  function play(id, volume = 0.6) {
    if (!id || id === 'none' || !MAKE[id] || !(volume > 0)) return;
    const c = audio();
    if (!c) return;
    const out = c.createGain();
    out.gain.value = Math.min(1, volume) * 0.9;
    const comp = c.createDynamicsCompressor();
    out.connect(comp).connect(c.destination);
    MAKE[id](c, out, c.currentTime + 0.05);
  }
  // the sound a reminder plays: its own, else the one in Settings
  const soundOf = (r, settings) => (r && r.sound ? r.sound : (settings && settings.remindSound) || R.DEFAULT_SOUND);

  // ---------------------------------------------------------------- styles (both windows)
  const CSS = `
.rmd { --rm-bg: var(--pop-bg, var(--card2)); --rm-ink: var(--pop-ink, var(--ink)); --rm-ink2: var(--pop-ink2, var(--ink2)); --rm-soft: var(--pop-soft, var(--soft));
  --rm-soft2: var(--pop-soft2, var(--soft2)); --rm-mute: var(--pop-mute, var(--mute)); --rm-card: var(--pop-card, var(--card)); --rm-pick: var(--pop-pick, var(--ink));
  --rm-pickfg: var(--pop-pickfg, var(--pillfg)); --rm-danger: var(--pop-danger, var(--danger));
  color: var(--rm-ink); font: 700 13px var(--ui); text-align: left; }
.rmd [hidden] { display: none !important; }
.rmd .rm-list { display: flex; flex-direction: column; gap: 6px; margin: 2px 0 8px; }
.rmd .rm-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 11px; background: var(--rm-soft); }
.rmd .rm-item.ring { box-shadow: inset 0 0 0 1.5px var(--rm-danger); }
.rmd .rm-item .rm-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rmd .rm-item b { font-weight: 800; }
.rmd .rm-item small { color: var(--rm-mute); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmd .rm-ib { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--rm-ink2); cursor: pointer; }
.rmd .rm-ib:hover { background: var(--rm-soft2); }
.rmd .rm-ib.del:hover { color: var(--rm-danger); }
.rmd .rm-ib svg, .rmd .rm-ic svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rmd .rm-ic { color: var(--rm-mute); display: grid; }
.rmd .rm-none { margin: 2px 2px 8px; color: var(--rm-mute); }
.rmd .rm-add, .rmd .rm-btn { border: 0; border-radius: 999px; padding: 6px 14px; font: 800 12.5px var(--ui); cursor: pointer; background: var(--rm-pick); color: var(--rm-pickfg); }
.rmd .rm-btn.ghost { background: transparent; color: var(--rm-ink2); }
.rmd .rm-btn.ghost:hover { background: var(--rm-soft); }
.rmd .rm-form { display: flex; flex-direction: column; gap: 8px; padding: 9px; border-radius: 12px; background: var(--rm-soft); }
.rmd .rm-form[hidden] { display: none; }
.rmd .rm-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.rmd .rm-chip { border: 1.5px solid var(--rm-soft2); border-radius: 999px; padding: 4px 9px; background: var(--rm-card); color: var(--rm-ink); font: 800 12px var(--ui); cursor: pointer; }
.rmd .rm-chip.on { background: var(--rm-pick); border-color: var(--rm-pick); color: var(--rm-pickfg); }
.rmd .rm-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rmd .rm-row.snd { flex-wrap: nowrap; }
.rmd .rm-row.snd select { flex: 1 1 auto; min-width: 0; }
.rmd .rm-row > span { min-width: 54px; color: var(--rm-ink2); }
.rmd input[type=date], .rmd input[type=time], .rmd input[type=number], .rmd select, .rmd textarea {
  border: 1.5px solid var(--rm-soft2); border-radius: 9px; padding: 4px 7px; background: var(--rm-card); color: var(--rm-ink); font: 700 12.5px var(--ui); outline: none; }
.rmd input[type=number] { width: 64px; }
.rmd textarea { width: 100%; min-height: 46px; resize: vertical; }
.rmd .rm-days { display: flex; gap: 3px; }
.rmd .rm-days button { width: 30px; height: 26px; border: 1.5px solid var(--rm-soft2); border-radius: 8px; background: var(--rm-card); color: var(--rm-ink); font: 800 11px var(--ui); cursor: pointer; }
.rmd .rm-days button.on { background: var(--rm-pick); border-color: var(--rm-pick); color: var(--rm-pickfg); }
.rmd .rm-picked { color: var(--rm-ink2); }
.rmd .rm-check { display: flex; align-items: flex-start; gap: 7px; cursor: pointer; }
.rmd .rm-check input { margin: 2px 0 0; accent-color: var(--rm-pick); }
.rmd .rm-check small { display: block; color: var(--rm-mute); font-weight: 700; }
.rmd .rm-err { color: var(--rm-danger); min-height: 0; }
.rmd .rm-err:empty { display: none; }
.rmd .rm-btns { display: flex; justify-content: flex-end; gap: 6px; }
`;
  let styled = false;
  function addStyles() {
    if (styled || !doc || !doc.head) return;
    styled = true;
    const s = doc.createElement('style');
    s.textContent = CSS;
    doc.head.append(s);
  }

  // ---------------------------------------------------------------- the panel
  const ICON = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2 6M19 3l3 3"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  };
  function el(tag, attrs = {}, ...kids) {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k in e && typeof v !== 'string') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : doc.createTextNode(String(k)));
    return e;
  }
  const pad = (x) => String(x).padStart(2, '0');
  const dateVal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const timeVal = (t) => R.clock(t);
  const fromVals = (date, tm) => {
    const [y, mo, d] = String(date).split('-').map(Number);
    const [h, mi] = String(tm || '09:00').split(':').map(Number);
    const t = new Date(y, mo - 1, d, h || 0, mi || 0).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const endOfDay = (date) => { const t = fromVals(date, '23:59'); return t === null ? null : t + 59999; };
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  // opts: { reminders, msgs, locked, settings: { remindSound, remindVolume }, save(list, msgs) → Promise of { reminders, msgs } or null }
  function editor(opts) {
    addStyles();
    let list = (opts.reminders || []).map((r) => ({ ...r }));
    let msgs = { ...(opts.msgs || {}) };
    const settings = opts.settings || {};
    const box = el('div', { class: 'rmd' });
    const listBox = el('div', { class: 'rm-list' });
    const addBtn = el('button', { type: 'button', class: 'rm-add', onclick: () => openForm(null) }, '+ Add reminder');
    const form = el('div', { class: 'rm-form', hidden: true });
    box.append(listBox, addBtn, form);
    let busy = false;

    async function commit(nextList, nextMsgs) {
      if (busy) return false;
      busy = true;
      try {
        const r = await opts.save(nextList, nextMsgs);
        if (!r) return false;
        list = (r.reminders || []).map((x) => ({ ...x }));
        msgs = { ...(r.msgs || {}) };
        paint();
        return true;
      } finally { busy = false; }
    }
    function paint() {
      listBox.innerHTML = '';
      if (!list.length) listBox.append(el('p', { class: 'rm-none' }, 'No reminders yet.'));
      const now = Date.now();
      for (const r of list) {
        const extra = [msgs[r.id] ? `“${msgs[r.id].split('\n')[0]}”` : '', r.hide ? 'Hidden until then' : ''].filter(Boolean).join(' · ');
        listBox.append(el('div', { class: 'rm-item' + (r.firing ? ' ring' : ''), 'data-id': r.id },
          el('span', { class: 'rm-ic', html: ICON.clock }),
          el('span', { class: 'rm-txt' }, el('b', {}, R.line(r, now)), extra ? el('small', {}, extra) : null),
          el('button', { type: 'button', class: 'rm-ib edit', title: 'Change', html: ICON.edit, onclick: () => openForm(r) }),
          el('button', { type: 'button', class: 'rm-ib del', title: 'Delete', html: ICON.del, onclick: () => {
            const m = { ...msgs }; delete m[r.id];
            commit(list.filter((x) => x.id !== r.id), m);
          } })));
      }
      addBtn.hidden = !form.hidden || list.length >= R.MAX;
    }

    // ---- adding or changing one
    function openForm(r) {
      const now = Date.now();
      const pre = R.presets(now);
      const st = {
        id: r ? r.id : R.newId(),
        at: r ? (r.firing || !r.at ? r.start : r.repeat ? r.start : r.at) : null,
        preset: null,
        repeat: r && r.repeat ? JSON.parse(JSON.stringify(r.repeat)) : null,
        sound: r ? r.sound : null,
        hide: r ? r.hide : false,
        unlock: r ? r.unlock : false,
      };
      form.innerHTML = '';
      form.hidden = false;
      addBtn.hidden = true;
      const err = el('div', { class: 'rm-err' });
      const picked = el('div', { class: 'rm-picked' });
      const date = el('input', { type: 'date', value: dateVal(st.at || pre[pre.length - 2].at) });
      const tm = el('input', { type: 'time', value: timeVal(st.at || pre[pre.length - 2].at) });
      const custom = el('div', { class: 'rm-row', hidden: true }, el('span', {}, 'When'), date, tm);
      const chips = el('div', { class: 'rm-chips' });
      const paintPicked = () => { picked.textContent = st.at ? R.when(st.at, Date.now()) : 'Pick a time.'; };
      for (const p of pre) {
        chips.append(el('button', { type: 'button', class: 'rm-chip', 'data-p': p.id, onclick: (e) => {
          st.at = p.at; st.preset = p.id; custom.hidden = true;
          chips.querySelectorAll('.rm-chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
          date.value = dateVal(p.at); tm.value = timeVal(p.at); paintPicked(); err.textContent = '';
        } }, p.label));
      }
      const customChip = el('button', { type: 'button', class: 'rm-chip' + (r ? ' on' : ''), 'data-p': 'custom', onclick: (e) => {
        custom.hidden = false; st.preset = 'custom';
        chips.querySelectorAll('.rm-chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        st.at = fromVals(date.value, tm.value); paintPicked();
      } }, 'Custom…');
      chips.append(customChip);
      if (r) custom.hidden = false;
      const onCustom = () => { st.at = fromVals(date.value, tm.value); paintPicked(); err.textContent = ''; };
      date.addEventListener('input', onCustom);
      tm.addEventListener('input', onCustom);

      // repeat
      const kind = st.repeat ? st.repeat.k : '';
      const rep = el('select', {}, ...[['', 'Does not repeat'], ['day', 'Every day'], ['weekdays', 'Weekdays'], ['week', 'Every week'], ['month', 'Every month'], ['every', 'Every…']]
        .map(([v, t]) => el('option', { value: v, selected: v === kind }, t)));
      const days = el('div', { class: 'rm-days' }, ...DAY_ORDER.map((d) => el('button', { type: 'button', 'data-d': String(d),
        class: st.repeat && st.repeat.days && st.repeat.days.includes(d) ? 'on' : '', onclick: (e) => e.currentTarget.classList.toggle('on') }, R.DAY_NAMES[d].slice(0, 2))));
      const everyN = el('input', { type: 'number', min: '1', max: '999', value: String(st.repeat && st.repeat.n ? st.repeat.n : 1) });
      const everyU = el('select', {}, ...Object.keys(R.UNITS).map((u) => el('option', { value: u, selected: (st.repeat && st.repeat.u ? st.repeat.u : 'day') === u }, R.UNIT_NAMES[u][1])));
      const endKind = el('select', {}, el('option', { value: '' }, 'Never ends'), el('option', { value: 'until', selected: !!(st.repeat && st.repeat.until) }, 'Ends on'),
        el('option', { value: 'times', selected: !!(st.repeat && st.repeat.times) }, 'Ends after'));
      const endDate = el('input', { type: 'date', value: dateVal(st.repeat && st.repeat.until ? st.repeat.until : now + 30 * 864e5) });
      const endTimes = el('input', { type: 'number', min: '1', max: '9999', value: String(st.repeat && st.repeat.times ? st.repeat.times : 5) });
      const timesWord = el('span', {}, 'times');
      const daysRow = el('div', { class: 'rm-row' }, el('span', {}, 'On'), days);
      const everyRow = el('div', { class: 'rm-row' }, el('span', {}, 'Every'), everyN, everyU);
      const endRow = el('div', { class: 'rm-row' }, el('span', {}, 'Ends'), endKind, endDate, endTimes, timesWord);
      const paintRepeat = () => {
        const k = rep.value;
        daysRow.hidden = k !== 'week';
        everyRow.hidden = k !== 'every';
        endRow.hidden = !k;
        endDate.hidden = endKind.value !== 'until';
        endTimes.hidden = endKind.value !== 'times';
        timesWord.hidden = endKind.value !== 'times';
        if (k === 'week' && !days.querySelector('.on')) {
          const d = new Date(st.at || Date.now()).getDay();
          const b = days.querySelector(`[data-d="${d}"]`); if (b) b.classList.add('on');
        }
      };
      rep.addEventListener('change', paintRepeat);
      endKind.addEventListener('change', paintRepeat);

      // message, sound, hide, unlock
      const msg = el('textarea', { maxlength: String(R.MSG_MAX), placeholder: 'Message (optional)' });
      msg.value = (r && msgs[r.id]) || '';
      const defName = (R.SOUNDS.find((s) => s.id === (settings.remindSound || R.DEFAULT_SOUND)) || { name: 'No sound' }).name;
      const sound = el('select', {}, el('option', { value: '' }, `As in Settings (${settings.remindSound === 'none' ? 'no sound' : defName})`),
        ...R.SOUNDS.map((s) => el('option', { value: s.id, selected: st.sound === s.id }, s.name)), el('option', { value: 'none', selected: st.sound === 'none' }, 'No sound'));
      const playBtn = el('button', { type: 'button', class: 'rm-ib', title: 'Play', html: ICON.play, onclick: () => play(sound.value || settings.remindSound || R.DEFAULT_SOUND, settings.remindVolume ?? 0.6) });
      const hide = el('input', { type: 'checkbox', checked: !!st.hide });
      const unlock = el('input', { type: 'checkbox', checked: !!st.unlock });
      const cancel = el('button', { type: 'button', class: 'rm-btn ghost', onclick: () => { form.hidden = true; paint(); } }, 'Cancel');
      const save = el('button', { type: 'button', class: 'rm-btn rm-save', onclick: async () => {
        if (st.preset === 'custom' || (!st.preset && r)) st.at = fromVals(date.value, tm.value);
        if (!st.at) { err.textContent = 'Pick a time.'; return; }
        const k = rep.value;
        let repeat = null;
        if (k) {
          repeat = { k };
          if (k === 'week') repeat.days = [...days.querySelectorAll('.on')].map((b) => Number(b.dataset.d));
          if (k === 'every') { repeat.u = everyU.value; repeat.n = Math.max(R.MIN_EVERY[everyU.value], Number(everyN.value) || 1); }
          if (endKind.value === 'until') repeat.until = endOfDay(endDate.value);
          if (endKind.value === 'times') repeat.times = Math.max(1, Number(endTimes.value) || 1);
          repeat = R.cleanRepeat(repeat);
          if (!repeat) { err.textContent = 'Pick at least one day.'; return; }
        }
        if (!repeat && st.at <= Date.now() - 1000) { err.textContent = 'That time has passed.'; return; }
        const one = { id: st.id, start: st.at, repeat, sound: sound.value || null, hide: hide.checked, unlock: opts.locked ? unlock.checked : false };
        const nextList = r ? list.map((x) => (x.id === r.id ? { ...x, ...one } : x)) : [...list, one];
        const m = { ...msgs };
        const text = msg.value.trim();
        if (text) m[st.id] = text; else delete m[st.id];
        if (await commit(nextList, m)) { form.hidden = true; paint(); } else err.textContent = 'Couldn’t save it.';
      } }, r ? 'Save' : 'Add');
      form.append(...[
        chips, custom, picked,
        el('div', { class: 'rm-row' }, el('span', {}, 'Repeat'), rep), daysRow, everyRow, endRow,
        msg,
        el('div', { class: 'rm-row snd' }, el('span', {}, 'Sound'), sound, playBtn),
        el('label', { class: 'rm-check' }, hide, el('span', {}, 'Hide until it goes off', el('small', {}, 'It hides from All notes too, unless Settings shows them.'))),
        opts.locked ? el('label', { class: 'rm-check' }, unlock, el('span', {}, 'Unlock to dismiss', el('small', {}, 'Snooze and Done need your PIN.'))) : null,
        err,
        el('div', { class: 'rm-btns' }, cancel, save)].filter(Boolean));
      paintRepeat();
      paintPicked();
      paint();
    }
    paint();
    return {
      el: box,
      // new data from outside (the note changed, a reminder went off): the list again; a form being filled in stays
      refresh(data) {
        if (data) { list = (data.reminders || []).map((x) => ({ ...x })); msgs = { ...(data.msgs || {}) }; }
        paint();
      },
      formOpen: () => !form.hidden,
    };
  }

  root.COSMO_REMIND_UI = { play, soundOf, editor, ICON };
})(window);
