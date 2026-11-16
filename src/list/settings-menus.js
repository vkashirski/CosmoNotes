'use strict';
// CosmoNotes "All notes" window, part 4 of 7: Settings (new-note colours, About, backups), app-styled pop-ups, the right-click menu
// (src/list.js until 1.1.28; the parts load in order from list.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_LIST_KIT;
  const { V, S, $, $$, COLORS, DARK_COLORS, COLOR_NAMES, SWATCH, THEMES, themeNow, ICON, sel, h, plural, noteIsLocked,
    groupIsLocked, isShut, render, setFav, paintCards, unlockedNow } = K;
  // defined in a later part:
  const fxSummary = K.later('fxSummary'), openEdit = K.later('openEdit'), trashNote = K.later('trashNote'),
    dissolveGroup = K.later('dissolveGroup'), trashGroup = K.later('trashGroup'), lockNote = K.later('lockNote'),
    unlockNote = K.later('unlockNote'), lockGroup = K.later('lockGroup'), unlockGroup = K.later('unlockGroup'),
    unlockNoteNow = K.later('unlockNoteNow'), relockNote = K.later('relockNote'), unlockGroupNow = K.later('unlockGroupNow'),
    relockGroup = K.later('relockGroup'),
    openGroupView = K.later('openGroupView'), openPanel = K.later('openPanel'), paintCrypt = K.later('paintCrypt'),
    openRemindSheet = K.later('openRemindSheet');
  // ---- Settings → For new notes → Colour (1.1.15): pick one or more colours; each new note gets one of them at random
  const newColors = () => {
    const s = V.state.settings || {};
    const list = Array.isArray(s.defaultColors) ? s.defaultColors.filter((c) => COLORS.includes(c)) : [];
    if (list.length) return list;
    if (s.defaultColor === 'random') return COLORS.slice(0, 7);
    return [COLORS.includes(s.defaultColor) ? s.defaultColor : 'yellow'];
  };
  function setNewColors(list) {
    const set = new Set(list);
    const clean = COLORS.filter((c) => set.has(c));
    if (!clean.length) return;
    V.state.settings.defaultColors = clean; // paint straight away; main sends the list a refresh too
    V.state.settings.defaultColor = clean[0];
    paintNewColors();
    S.settings.set({ defaultColors: clean });
  }
  function paintNewColors() {
    const sc = $('#sColors');
    const picked = newColors();
    if (!sc.childElementCount) {
      for (const c of COLORS) {
        sc.append(h('button', {
          class: 'sw pick' + (DARK_COLORS.includes(c) ? ' darkp' : ''),
          'data-color': c,
          style: `background:${SWATCH[c]}`,
          title: COLOR_NAMES[c],
          html: '<svg class="tick" viewBox="0 0 24 24"><path d="m5.5 12.5 4.5 4.5 8.5-10"/></svg>',
          onclick: () => {
            const now = newColors();
            if (now.includes(c)) {
              if (now.length === 1) { toast('Keep at least one colour for new notes'); return; }
              setNewColors(now.filter((x) => x !== c));
            } else setNewColors([...now, c]);
          },
        }));
      }
    }
    for (const b of sc.children) {
      const on = picked.includes(b.dataset.color);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    $('#sColorsCount').textContent = picked.length === 1 ? COLOR_NAMES[picked[0]] : `${picked.length} picked`;
    $('#sColorsHint').textContent = picked.length === 1
      ? 'New notes get this colour. Pick more for a random mix.'
      : 'Each new note gets one of these at random.';
  }
  $('#sPickAll').addEventListener('click', () => setNewColors(COLORS));
  $('#sPickLight').addEventListener('click', () => setNewColors(COLORS.filter((c) => !DARK_COLORS.includes(c))));
  $('#sPickDark').addEventListener('click', () => setNewColors(DARK_COLORS));
  $('#sPickOne').addEventListener('click', () => setNewColors([newColors()[0]]));

  async function renderSettings() {
    const s = V.state.settings;
    $('#sStartup').checked = !!s.startWithWindows;
    $('#sSpell').checked = !!s.spellCheck;
    $('#sCyr').checked = !!s.spellCyrillic;
    $('#sCheckDrag').checked = !!s.checkDrag; // 1.3.19: Settings → Checklists
    $('#sCheckSink').checked = !!s.checkSink;
    $('#sCheckFixed').checked = !!s.checkFixed;
    paintNewColors();
    $$('#sFont button').forEach((b) => b.classList.toggle('on', b.dataset.font === s.defaultFont));
    const op = Math.round((Number(s.defaultOpacity) || 1) * 100);
    if (document.activeElement !== $('#sOpacity')) $('#sOpacity').value = op; // not while it's being dragged
    $('#sOpVal').textContent = `${$('#sOpacity').value}%`;
    $('#sSolidHover').checked = s.defaultSolidOnHover !== false;
    $('#sNoRepeat').checked = s.newColorNoRepeat !== false;
    if (K.FX) { $('#sFxNow').textContent = fxSummary(); $('#sFxPause').checked = !!s.fxPaused; }
    const th = $('#sTheme');
    th.innerHTML = '';
    for (const t of THEMES) {
      th.append(h('button', {
        class: 'theme' + (themeNow() === t.id ? ' on' : ''),
        style: `--tb:${t.bg}; --td:${t.dot}`,
        title: t.name,
        onclick: () => {
          if (themeNow() === t.id) return;
          V.state.settings.listTheme = t.id;
          render();
          S.settings.set({ listTheme: t.id });
        },
      }, h('i'), h('span', {}, t.name)));
    }
    const pinNow = s.lockKind === 'pin';
    $('#lockInfo').textContent = s.hasPassword
      ? `Your ${pinNow ? 'PIN' : 'password'} unlocks every locked note and group. To lock one, right-click it or use its ⋯ menu.`
      : 'No password or PIN yet. Set one here, or when you first lock something.';
    $('#pwSave').innerHTML = ICON.lock + (s.hasPassword ? `Change ${pinNow ? 'PIN' : 'password'}` : 'Set password or PIN');
    paintCrypt();
    $('#dataPath').textContent = s.dataPath || '';
    $('#version').textContent = `CosmoNotes ${s.version || ''} - Made with love.`;
    renderAbout(s.version);
    paintEve();
    paintPanic();
    $('#sClickThrough').checked = !!s.clickThroughOn; // 1.3.34
    $('#sUpdateCheck').checked = s.updateCheck !== false; // 1.4.0
    paintRemindSettings(); // 1.4.1
    paintReapply();
    paintVoice(await S.stt.status());
    paintUpdate(await S.updates.status());
    renderBackups(await S.backups.list());
  }

  // ---- 1.4.1: Settings → Reminders: the sound (src/reminders.js SOUNDS, or none), how loud, hidden notes shown or not
  function paintRemindSettings() {
    const s = V.state.settings;
    const R = window.COSMO_REMIND;
    const pick = $('#sRemSound');
    if (R && !pick.options.length) {
      for (const x of R.SOUNDS) pick.append(h('option', { value: x.id }, x.name));
      pick.append(h('option', { value: 'none' }, 'No sound'));
    }
    pick.value = s.remindSound || (R ? R.DEFAULT_SOUND : 'drops');
    const vol = Math.round((s.remindVolume ?? 0.6) * 100);
    if (document.activeElement !== $('#sRemVol')) $('#sRemVol').value = vol; // not while it's being dragged
    $('#sRemVolVal').textContent = `${$('#sRemVol').value}%`;
    $('#sRemShow').checked = !!s.remindShowHidden;
  }

  // ---- 1.3.27: "Use on all notes". Settings a note can change for itself (store.js OVERRIDES says what each puts back):
  // under each one, how many notes have their own and a button; "Reset notes…" (General) does several at once.
  const OWN = {
    font: ['Font', 'font'], opacity: ['See-through', 'see-through'], solidOnHover: ['Turn solid on hover', '“turn solid” choice'],
    effect: ['Background effect', 'background effect'], follower: ['Mouse follower', 'mouse follower'],
    fxPause: ['Paused effects', 'choice to pause or play effects'], spell: ['Spelling', 'spelling choice'],
    checkDrag: ['Reorder by dragging', 'choice for dragging boxes'], checkSink: ['Ticked items to the bottom', 'choice for ticked items'],
    checkFixed: ['Boxes the same size', 'choice for box sizes'], evening: ['Evening colours', 'evening colours choice'],
    panic: ['Panic button', 'panic button choice'],
  };
  const FOR_NEW = ['font', 'opacity', 'solidOnHover']; // "for new notes": Settings' value is copied in (the rest follow Settings again)
  const ownCount = (k) => Number((V.state.settings.overrides || {})[k]) || 0;
  const ownLine = (k, n) => (k === 'panic' ? `${plural(n, 'note')} stay${n === 1 ? 's' : ''} open.` : `${plural(n, 'note')} use${n === 1 ? 's' : ''} ${n === 1 ? 'its' : 'their'} own.`);
  function paintReapply() {
    for (const row of $$('.reapply')) {
      const k = row.dataset.o;
      const n = ownCount(k);
      row.hidden = !n;
      row.innerHTML = '';
      if (n) row.append(h('span', {}, ownLine(k, n)), h('button', { class: 'pill ghost small', onclick: () => reapply(k) }, 'Use on all notes'));
    }
    const keys = Object.keys(OWN).filter(ownCount);
    $('#sOwnNow').textContent = keys.length ? `${plural(keys.length, 'setting')} differ${keys.length === 1 ? 's' : ''} on some notes.` : 'Every note uses Settings.';
    $('#sResetNotes').disabled = !keys.length;
  }
  const done = (count) => toast(count ? `Done. ${plural(count, 'note')} changed.` : 'Nothing to change.');
  async function reapply(k) {
    const n = ownCount(k);
    const text = k === 'panic' ? `${plural(n, 'note')} stay${n === 1 ? 's' : ''} open on panic. They will close with it again.`
      : `${plural(n, 'note')} ${n === 1 ? 'has its' : 'have their'} own ${OWN[k][1]}. ${FOR_NEW.includes(k) ? 'They get the one set here.' : 'They follow Settings again.'}`;
    if (!(await modal({ title: 'Use this on all notes?', text, okLabel: 'Use on all notes' }))) return;
    done(await S.settings.reapply([k]));
  }
  $('#sResetNotes').addEventListener('click', async () => {
    const keys = Object.keys(OWN).filter(ownCount);
    if (!keys.length) { toast('Every note uses Settings.'); return; }
    const box = h('div', { class: 'resetlist' }, ...keys.map((k) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: true, 'data-o': k }), h('span', {}, OWN[k][0]), h('em', {}, plural(ownCount(k), 'note')))));
    const ok = await modal({ title: 'Reset notes to Settings', text: 'Notes with their own choice get the one set here. Pick which.', content: box, okLabel: 'Reset', icon: ICON.info });
    if (!ok) return;
    const picked = [...box.querySelectorAll('input:checked')].map((x) => x.dataset.o);
    if (picked.length) done(await S.settings.reapply(picked));
  });

  // ---- 1.3.27: Settings → Evening colours (times are minutes after midnight; main keeps the clock: main/evening.js)
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  function paintEve() {
    const s = V.state.settings;
    const EVE = window.COSMO_EVENING;
    $('#sEve').checked = !!s.eveOn;
    if (document.activeElement !== $('#sEveFrom')) $('#sEveFrom').value = hhmm(Number.isInteger(s.eveFrom) ? s.eveFrom : 1140);
    if (document.activeElement !== $('#sEveTo')) $('#sEveTo').value = hhmm(Number.isInteger(s.eveTo) ? s.eveTo : 420);
    const strip = $('#sEveStrip');
    // each light paper: its day colour, and the evening shade it turns into
    if (EVE && !strip.childElementCount) for (const p of Object.values(EVE.PALETTE)) strip.append(h('i', { style: `--a:${p.day}; --b:${p.paper}`, title: p.name }));
  }

  // ---- 1.3.27: Settings → Panic button → Shortcut. "Set a shortcut…", then press the keys (Esc stops). Meanwhile main lets
  // go of the old shortcut (capturePanicKey), so pressing it here doesn't hide everything. A letter, digit or sign needs Ctrl
  // or Alt with it (main checks the same: main/panic.js validKey); an F key may be on its own. No shortcut until one is set.
  const KEYS = { Space: 'Space', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[',
    BracketRight: ']', Backslash: '\\', Backquote: '`', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home',
    End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace' };
  function shortcutOf(e) {
    const m = /^(?:Key([A-Z])|Digit(\d))$/.exec(e.code);
    const key = m ? m[1] || m[2] : /^F([1-9]|1\d|2[0-4])$/.test(e.code) ? e.code : KEYS[e.code];
    if (!key) return null; // a modifier on its own (or a key a shortcut can't use): keep waiting
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
    if (!/^F\d/.test(key) && !mods.some((x) => x !== 'Shift')) return { error: 'Hold Ctrl or Alt with it, or use an F key.' };
    return { key: [...mods, key].join('+') };
  }
  let capturing = false;
  let captureHint = '';
  function setPanicKey(key) {
    V.state.settings.panicKey = key;
    V.state.settings.panicKeyError = null; // main says again after it tried (the list reloads)
    S.settings.set({ panicKey: key });
    paintPanic();
  }
  function onCaptureKey(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { stopCapture(); return; }
    const r = shortcutOf(e);
    if (!r) return;
    if (r.error) { captureHint = r.error; paintPanic(); return; }
    setPanicKey(r.key);
    stopCapture();
  }
  function startCapture() {
    if (capturing) return;
    capturing = true;
    captureHint = '';
    window.addEventListener('keydown', onCaptureKey, true);
    window.addEventListener('blur', stopCapture);
    S.settings.capturePanicKey(true);
    paintPanic();
  }
  function stopCapture() {
    if (!capturing) return;
    capturing = false;
    window.removeEventListener('keydown', onCaptureKey, true);
    window.removeEventListener('blur', stopCapture);
    S.settings.capturePanicKey(false);
    paintPanic();
  }
  function paintPanic() {
    const s = V.state.settings;
    $('#sPanic').checked = !!s.panicOn;
    $('#sPanicKeyRow').hidden = !s.panicOn;
    $('#sPanicKeyNow').textContent = s.panicKey || 'None';
    const b = $('#sPanicKey');
    b.classList.toggle('on', capturing);
    b.textContent = capturing ? 'Press the keys… (Esc: stop)' : s.panicKey ? 'Change…' : 'Set a shortcut…';
    $$('#sPanicKeyRow [data-key]').forEach((x) => x.classList.toggle('on', x.dataset.key === s.panicKey));
    $('#sPanicClear').disabled = !s.panicKey;
    const bad = !capturing && s.panicKeyError;
    $('#sPanicHint').classList.toggle('warn', !!bad || (capturing && !!captureHint));
    $('#sPanicHint').textContent = capturing ? (captureHint || 'Hold Ctrl or Alt and press a letter, or press an F key.')
      : s.panicKeyError === 'taken' ? `Another app already uses ${s.panicKey}. Pick another.`
        : s.panicKeyError === 'bad' ? 'That shortcut can’t be used. Pick another.'
          : s.panicKey ? 'Works in every app, even when CosmoNotes is hidden.' : 'No shortcut yet. Alt+Z or F8 are good picks.';
  }
  $('#sPanicKey').addEventListener('click', () => (capturing ? stopCapture() : startCapture()));
  $$('#sPanicKeyRow [data-key]').forEach((x) => x.addEventListener('click', () => { stopCapture(); setPanicKey(x.dataset.key); }));
  $('#sPanicClear').addEventListener('click', () => { stopCapture(); setPanicKey(''); });

  // ---- Settings → Voice to text (1.3.1; main/ipc-stt.js): the model it uses and its download (1.3.4: one model, no
  // choice and no Test my computer)
  function paintVoice(st) {
    if (!st || !st.model) return;
    const m = st.model;
    const box = $('#sttModels');
    box.innerHTML = '';
    const size = m.mbMax ? `${m.mb}–${m.mbMax} MB` : `${m.mb} MB`;
    const where = m.device === 'gpu' ? 'graphics card' : 'processor';
    const bits = [];
    let btn = null;
    if (m.state === 'ready') {
      bits.push('Ready', size, `Runs on the ${where}`);
      btn = h('button', { class: 'pill ghost small', onclick: () => removeModel(m) }, 'Remove');
    } else if (m.state === 'downloading') {
      bits.push(`Downloading ${m.pct || 0}%`);
      btn = h('button', { class: 'pill ghost small', onclick: async () => paintVoice(await S.stt.cancelDownload(m.id)) }, 'Cancel');
    } else if (m.state === 'failed') {
      bits.push(size, 'The download stopped');
      btn = h('button', { class: 'pill small', onclick: async () => paintVoice(await S.stt.download(m.id)) }, 'Try again');
    } else {
      bits.push('Not downloaded', size);
      btn = h('button', { class: 'pill small', onclick: async () => paintVoice(await S.stt.download(m.id)) }, 'Download');
    }
    const err = st.startError && m.state === 'ready' ? h('small', { class: 'err' }, "Didn't start last time.") : null;
    box.append(h('div', { class: 'row sttm', 'data-id': m.id },
      h('span', {}, h('b', {}, `Uses ${m.name}`), h('small', {}, bits.join(' · ')), err),
      btn,
      m.state === 'downloading' ? h('div', { class: 'sttbar' }, h('i', { style: `width:${m.pct || 0}%` })) : null));
    // where it comes from: the model's page, opened in the browser
    const src = $('#sttSource');
    src.textContent = '';
    src.append('It downloads from ', h('a', { href: m.url, onclick: (e) => { e.preventDefault(); S.openExternal(m.url); } }, m.url), '. Your voice never leaves this device.');
    for (const b of document.querySelectorAll('#sttWhen button')) b.classList.toggle('on', b.dataset.v === st.when);
    $('#sttWhenInfo').textContent = st.when === 'live' && m.device === 'cpu' ? 'On the processor, the words can lag behind.'
      : st.when === 'stop' ? 'The words appear when you press Stop.' : 'The words appear as you speak.';
  }
  for (const b of document.querySelectorAll('#sttWhen button')) {
    b.addEventListener('click', async () => paintVoice(await S.stt.when(b.dataset.v)));
  }
  async function removeModel(m) {
    const ok = await modal({ title: `Remove ${m.name}?`, text: 'Voice to text stops working until you download it again.', okLabel: 'Remove', danger: true });
    if (!ok) return;
    const st = await S.stt.remove(m.id);
    if (st && st.error === 'busy') toast('Voice to text is busy. Try again in a moment.');
    paintVoice(st);
  }
  S.stt.onChanged((st) => { if (V.tab === 'settings') paintVoice(st); });

  const niceDate = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };
  let aboutDone = false;
  function renderAbout(version) {
    const A = window.COSMO_ABOUT;
    if (!A) return;
    $('#aboutLine').textContent = `${version ? `Version ${version} · ` : ''}Last updated ${niceDate(A.LAST_UPDATED)}`;
    if (aboutDone) return;
    aboutDone = true;
    $('#features').append(...A.FEATURES.map((f) => h('div', { class: 'fgroup' },
      h('h5', {}, f.title),
      h('ul', {}, f.items.map((it) => h('li', {}, it))))));
  }

  // ---- Settings → About → updates (1.4.0; main/ipc-update.js, main/updater.js). A newer version that is ready (or whose
  // download or start failed) also puts a dot on the Settings tab and on About's heading, wherever the list is.
  const UPD_LINE = {
    idle: () => '', checking: () => 'Checking…', none: () => 'You have the newest version.',
    checkfailed: () => 'Couldn’t check for updates.', available: (u) => `Version ${u.latest} is ready.`,
    downloading: (u) => `Downloading… ${u.pct || 0}%`, installing: () => 'Installing. CosmoNotes will open again.',
    failed: (u) => (u.failure === 'start' ? 'Couldn’t start the update.' : 'Couldn’t download the update.'),
  };
  function paintUpdate(u) {
    if (!u || !UPD_LINE[u.state]) return;
    const ready = u.state === 'available' || u.state === 'failed';
    $('.tab[data-tab="settings"]').classList.toggle('hasupd', ready);
    $('.abouthead h3').classList.toggle('hasupd', ready);
    const line = $('#updLine');
    line.textContent = UPD_LINE[u.state](u);
    line.classList.toggle('err', u.state === 'failed' || u.state === 'checkfailed');
    $('#updBar').hidden = u.state !== 'downloading';
    $('#updBar i').style.width = `${u.pct || 0}%`;
    const btn = (label, run, ghost) => h('button', { class: `pill small${ghost ? ' ghost' : ''}`, onclick: run }, label);
    const box = $('#updBtns');
    box.innerHTML = '';
    if (u.state === 'available') box.append(btn('Install', installUpdate));
    else if (u.state === 'downloading') box.append(btn('Cancel', async () => paintUpdate(await S.updates.cancel()), true));
    else if (u.state === 'failed') box.append(btn('Open the download page', () => S.updates.openPage(), true), btn('Try again', installUpdate));
    else if (u.state !== 'installing') {
      const b = btn(u.state === 'checkfailed' ? 'Try again' : 'Check for updates', async () => paintUpdate(await S.updates.check()), true);
      b.disabled = u.state === 'checking';
      box.append(b);
    }
  }
  async function installUpdate() {
    const ok = await modal({ title: 'Install the update?', text: 'CosmoNotes saves your notes, closes and opens again.', okLabel: 'Install' });
    if (!ok) return;
    const u = await S.updates.install();
    if (u && u.error === 'busy') toast('Wait for the voice recording or voice to text to finish.');
    else if (u && u.error === 'notinstalled') toast('Updates work in the installed app.');
    paintUpdate(u);
  }
  S.updates.onChanged(paintUpdate);
  (async () => paintUpdate(await S.updates.status()))(); // the dot, as soon as the list opens

  // Backups aren't listed in Settings any more: just the newest one, and a button that opens a
  // pop-up to pick the day to restore.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function backupLabel(name) {
    const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})-(\d{2}))?/);
    if (!m) return { day: name, time: '' };
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return { day: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, time: m[4] ? `${m[4]}:${m[5]}` : '' };
  }
  function renderBackups(list) {
    const box = $('#backups');
    if (!list.length) { box.textContent = 'The first backup is made today.'; return; }
    const l = backupLabel(list[0].name);
    box.textContent = `Newest backup: ${l.day}${l.time ? `, ${l.time}` : ''}${list[0].count != null ? ` · ${plural(list[0].count, 'note')}` : ''}`;
  }
  async function pickBackup() {
    const list = await S.backups.list();
    if (!list.length) {
      await modal({ title: 'No backups yet', text: 'The first backup is made today. You can also press “Back up now”.', okLabel: 'OK', noCancel: true, icon: ICON.restore });
      return;
    }
    let chosen = null;
    const rows = list.map((b) => {
      const l = backupLabel(b.name);
      const row = h('button', {
        type: 'button', class: 'bkpick',
        onclick: () => { chosen = b.name; $$('.bkpick').forEach((x) => x.classList.toggle('on', x === row)); $('#mErr').textContent = ''; },
        ondblclick: () => { chosen = b.name; $('#mbox').requestSubmit(); },
      }, h('i'), h('span', {}, h('b', {}, l.day), h('small', {}, [l.time, b.count != null ? plural(b.count, 'note') : ''].filter(Boolean).join(' · '))));
      return row;
    });
    const ok = await modal({
      title: 'Restore from a backup',
      text: 'Pick a day. Its notes come back in a new group. Nothing is replaced.',
      content: h('div', { class: 'bklist' }, rows),
      okLabel: 'Restore',
      icon: ICON.restore,
      check: async () => (chosen ? null : 'Pick a day first.'),
    });
    if (!ok || !chosen) return;
    const count = await S.backups.restore(chosen);
    await modal({
      title: count ? `Brought back ${plural(count, 'note')}` : 'Nothing to bring back',
      text: count ? `They are in the group “Restored Notes from ${backupLabel(chosen).day}”.` : 'Every note in that backup matches what you already have.',
      okLabel: 'OK',
      noCancel: true,
    });
  }

  // ================================================================ app-styled pop-ups
  V.modalDone = null;
  // modal({ title, text, tip, icon, okLabel, cancelLabel, danger, inputs, check, noCancel, kindPick, pinLen })
  // inputs: [{ placeholder, pin, kinded: { password: '…', pin: '…' } }]. pin = digits only.
  // kindPick ('password' | 'pin'): shows a Password | PIN switch; inputs with `kinded` follow it.
  // pinLen: submit by itself as soon as the first input has that many digits (opening with a PIN).
  // check(values, kind) returns an error text or null.
  // → resolves with the input values (or true) when confirmed, null when cancelled.
  const digitsOnly = (el) => { const v = el.value.replace(/\D/g, ''); if (v !== el.value) el.value = v; };
  function modal(o) {
    if (V.modalDone) V.modalDone(null);
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
    let kind = o.kindPick || null;
    const els = [];
    const isPin = (inp) => inp.pin || (inp.kinded && kind === 'pin');
    const paintKind = () => {
      (o.inputs || []).forEach((inp, i) => {
        const el = els[i];
        const pin = isPin(inp);
        if (inp.kinded) el.placeholder = inp.kinded[kind] || '';
        el.inputMode = pin ? 'numeric' : 'text';
        el.maxLength = pin ? (o.pinLen && i === 0 ? o.pinLen : 12) : 200;
        if (pin) digitsOnly(el);
      });
      $$('#mKind button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    };
    if (kind) {
      inputs.append(h('div', { class: 'seg mkind', id: 'mKind' },
        ...[['password', 'Password'], ['pin', 'PIN (numbers)']].map(([k, label]) => h('button', {
          type: 'button', 'data-k': k,
          onclick: () => { kind = k; $('#mErr').textContent = ''; paintKind(); (els.find((x, i) => o.inputs[i].kinded) || els[0]).focus(); },
        }, label))));
    }
    if (o.content) inputs.append(o.content); // any extra content (e.g. the list of backups)
    let busy = false;
    (o.inputs || []).forEach((inp, i) => {
      const el = h('input', { type: inp.type || 'password', placeholder: inp.placeholder || '', class: 'minput' });
      el.addEventListener('input', () => {
        if (isPin(inp)) digitsOnly(el);
        if (i === 0 && o.pinLen && isPin(inp) && el.value.length === o.pinLen && !busy) $('#mbox').requestSubmit();
      });
      els.push(el);
      inputs.append(el);
    });
    paintKind();
    $('#modal').hidden = false;
    requestAnimationFrame(() => { (inputs.querySelector('input') || ok).focus(); });
    return new Promise((resolve) => {
      V.modalDone = (v) => { V.modalDone = null; $('#modal').hidden = true; resolve(v); };
      $('#mbox').onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = els.map((x) => x.value);
        if (o.check) {
          ok.disabled = true;
          busy = true;
          const err = await o.check(values, kind);
          busy = false;
          ok.disabled = false;
          if (err) {
            $('#mErr').textContent = err;
            const box = $('#mbox');
            box.classList.remove('shake');
            void box.offsetWidth;
            box.classList.add('shake');
            const first = els[0];
            // a wrong PIN is cleared so it can simply be typed again; a password is selected
            if (first && o.pinLen && isPin((o.inputs || [])[0])) first.value = '';
            else if (first) first.select();
            return;
          }
        }
        V.modalDone(values.length ? values : true);
      };
    });
  }
  $('#mCancel').addEventListener('click', () => V.modalDone && V.modalDone(null));
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && V.modalDone) V.modalDone(null); });

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- right-click menu
  // the card that was right-clicked gets a faint outline while its menu is open (1.1.16)
  V.ctxCard = null;
  function hideCtx() { $('#ctx').hidden = true; document.querySelectorAll('.card.ctxon').forEach((c) => c.classList.remove('ctxon')); }
  function showCtx(e, items) {
    const ctx = $('#ctx');
    document.querySelectorAll('.card.ctxon').forEach((c) => c.classList.remove('ctxon'));
    const card = e.target && e.target.closest ? e.target.closest('.card') : null;
    if (card) card.classList.add('ctxon');
    V.ctxCard = card; // 1.1.22: Edit design opens next to it (the menu item runs after hideCtx)
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

  // "Select" in both menus (and nothing else but the lock options on a shut card: isShut, 1.3.28)
  const pickItem = (key) => ({ label: 'Select (Ctrl+click)', icon: ICON.check, run: () => { sel.add(key); V.selAnchor = key; paintCards(); } });
  function noteMenu(n, e) {
    // 1.1.47 (the owner's wish): "Unlock…" lasts until CosmoNotes restarts; "Remove lock…" under it is for good
    const locks = [
      !n.ownLock ? { label: 'Lock note', icon: ICON.lock, run: () => lockNote(n), disabled: false }
        : unlockedNow('note', n) ? { label: 'Lock again', icon: ICON.lock, run: () => relockNote(n) }
          : { label: 'Unlock…', icon: ICON.unlock, run: () => unlockNoteNow(n) },
      n.ownLock ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockNote(n) } : null,
    ];
    if (isShut('note', n)) { showCtx(e, [pickItem(`n:${n.id}`), '-', ...locks]); return; }
    showCtx(e, [
      // 1.1.22 (sixth round, the owner's order): favourites first, then Edit design; "Open on desktop" / "Bring to front"
      // is gone (clicking the card opens it)
      n.favorite
        ? { label: 'Remove from favourites', icon: ICON.star, run: () => setFav([`n:${n.id}`], false) }
        : { label: 'Add to favourites', icon: ICON.star, run: () => setFav([`n:${n.id}`], true) },
      { label: 'Edit design…', icon: ICON.edit, run: () => openEdit(n) },
      { label: 'Reminders…', icon: ICON.clock, run: () => openRemindSheet(n) }, // 1.4.1
      n.open ? { label: 'Close note', icon: ICON.hide, run: () => S.list.closeNote(n.id) } : null,
      // 1.3.34: the one way back besides the note's own button (only while Settings → Click-through is on: else it's off anyway)
      n.clickThrough && V.state.settings.clickThroughOn ? { label: 'Turn off click-through', icon: ICON.through, run: () => S.list.clickThroughOff(n.id) } : null,
      { label: 'Duplicate note', icon: ICON.copy, run: async () => { await S.list.duplicate(n.id); toast('Note duplicated'); } },
      pickItem(`n:${n.id}`),
      '-',
      ...locks,
      n.groupId ? { label: 'Take out of group', icon: ICON.out, run: () => S.groups.moveUp(n.id) } : null,
      '-',
      noteIsLocked(n)
        ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
        : { label: 'Move to Bin', icon: ICON.trash, danger: true, run: () => trashNote(n, false) },
    ]);
  }
  function groupMenu(g, e) {
    const locks = [
      !g.locked ? { label: 'Lock group', icon: ICON.lock, run: () => lockGroup(g) }
        : unlockedNow('group', g) ? { label: 'Lock again', icon: ICON.lock, run: () => relockGroup(g) }
          : { label: 'Unlock…', icon: ICON.unlock, run: () => unlockGroupNow(g) },
      g.locked ? { label: 'Remove lock…', icon: ICON.unlock, run: () => unlockGroup(g) } : null,
    ];
    if (isShut('group', g)) { showCtx(e, [pickItem(`g:${g.id}`), '-', ...locks]); return; }
    showCtx(e, [
      { label: 'Open group', icon: ICON.folder, run: () => openGroupView(g) },
      { label: 'Group settings…', icon: ICON.palette, run: async () => { await openGroupView(g); openPanel(); } },
      g.favorite
        ? { label: 'Remove from favourites', icon: ICON.star, run: () => setFav([`g:${g.id}`], false) }
        : { label: 'Add to favourites', icon: ICON.star, run: () => setFav([`g:${g.id}`], true) },
      pickItem(`g:${g.id}`),
      '-',
      ...locks,
      g.parentId ? { label: 'Move up one level', icon: ICON.out, run: () => S.groups.moveUp(g.id) } : null,
      { label: 'Ungroup…', icon: ICON.ungroup, run: () => dissolveGroup(g) },
      '-',
      groupIsLocked(g)
        ? { label: 'Locked: can’t be deleted', icon: ICON.trash, disabled: true, run: () => {} }
        : { label: 'Move its notes to Bin…', icon: ICON.trash, danger: true, run: () => trashGroup(g) },
    ]);
  }

  Object.assign(K, { renderSettings, renderBackups, pickBackup, modal, toast, hideCtx, showCtx, noteMenu, groupMenu });
})();
