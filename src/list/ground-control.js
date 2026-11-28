'use strict';
// CosmoNotes "All notes" window, part 7 of 8: Settings → Feedback (1.4.34; "Ground control" in the code): request a feature or
// report a bug. First the two choices; picking one opens its form (no switching inside it: the owner wants the choice to be a
// real step). ← Back (by the title) or Feedback in the sidebar again goes back to the choices and keeps what was typed: each
// kind has its own draft, and its card says "Draft". Cancel (by Submit) throws the draft away, after asking. After a report
// went out, the choices show again. main/feedback.js makes pictures smaller, keeps the drafts on disk, solves the relay's puzzle and sends it; this part is
// the form. What is sent is what the form shows. After a report went out, Submit counts down before it works again.
(() => {
  const K = window.COSMO_LIST_KIT;
  const { S, $, $$, h, toast, modal } = K;

  const LINE = {
    sending: 'Sending…',
    empty: 'Add a title and a few words.',
    email: 'Check the email.',
    closed: 'Feedback is closed for now.',
    limit: 'That’s all for today. Try again tomorrow.',
    busy: 'Lots of reports today. Try again tomorrow.',
    offline: 'Couldn’t send. Your text is kept. Try again later.',
    failed: 'Couldn’t send. Your text is kept. Try again later.',
    wait: 'Wait a moment, then send again.',
  };
  const NAMES = {
    feature: { head: 'Request a feature', text: 'Your idea', title: 'A short name for it', body: 'What would help you?' },
    bug: { head: 'Report a bug', text: 'What happened?', title: 'A short name for the bug', body: 'What did you do, and what went wrong?' },
  };
  let kind = null; // null = the two choices show
  let drafts = { feature: null, bug: null }; // what main keeps on disk, mirrored
  let pics = []; // { type, data (base64), w, h }: already made smaller by main
  let limits = { images: 3 };
  let restUntil = 0;
  let restTimer = 0;
  let busy = false;
  let saveTimer = 0;

  const draftNow = () => ({ kind, title: $('#gcTitle').value, text: $('#gcText').value, expected: $('#gcExpect').value,
    email: $('#gcEmail').value, withDetails: $('#gcWithDetails').checked, images: pics });
  const hasWords = (d) => !!d && !!((d.title || '').trim() || (d.text || '').trim() || (d.expected || '').trim() || (d.images || []).length);
  // the open form → its kind's draft (here and on disk)
  function keep() {
    clearTimeout(saveTimer);
    if (!kind) return;
    const d = draftNow();
    drafts[kind] = hasWords(d) ? d : null;
    S.gc.draft(kind, drafts[kind]);
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(keep, 500); }

  function say(key, extra) {
    const line = $('#gcLine');
    line.textContent = key ? LINE[key] + (extra ? ` ${extra}` : '') : '';
    line.classList.toggle('err', !!key && key !== 'sending');
  }

  // a counter shows once a box is nearly full
  function paintLeft() {
    for (const [box, em] of [['#gcTitle', '#gcTitleLeft'], ['#gcText', '#gcTextLeft'], ['#gcExpect', '#gcExpectLeft']]) {
      const el = $(box);
      const max = Number(el.getAttribute('maxlength'));
      $(em).textContent = el.value.length >= max * 0.9 ? `${el.value.length} / ${max}` : '';
    }
  }

  function paintKind() {
    $('#gcPick').hidden = !!kind;
    $('#gcForm').hidden = !kind;
    $('#gcBack').hidden = !kind;
    $$('#gcPick .gcchoice').forEach((b) => { b.querySelector('.gcdraft').hidden = !hasWords(drafts[b.dataset.kind]); });
    if (!kind) return;
    $('#gcDone').hidden = true;
    $('#gcKindName').textContent = NAMES[kind].head;
    $('#gcExpectRow').hidden = kind !== 'bug';
    $('#gcTextName').textContent = NAMES[kind].text;
    $('#gcTitle').placeholder = NAMES[kind].title;
    $('#gcText').placeholder = NAMES[kind].body;
  }
  const top = () => { $('#viewSettings').scrollTop = 0; }; // choices or a form: from the top
  // shows a form's words (the email and the details switch carry over to an empty one)
  function fill(d) {
    $('#gcTitle').value = (d && d.title) || '';
    $('#gcText').value = (d && d.text) || '';
    $('#gcExpect').value = (d && d.expected) || '';
    if (d && d.email) $('#gcEmail').value = d.email;
    if (d) $('#gcWithDetails').checked = d.withDetails !== false;
    pics = d && Array.isArray(d.images) ? d.images.slice(0, limits.images) : [];
    paintPics();
    paintLeft();
    say('');
  }
  function open(k) {
    kind = k;
    fill(drafts[k]);
    paintKind();
    top();
    $('#gcTitle').focus();
  }
  // back to the choices; what was typed stays as its kind's draft
  function back() {
    if (!kind || busy) return;
    keep();
    kind = null;
    fill(null);
    paintKind();
    top();
  }
  // throw the draft away (asks once something is typed)
  async function cancel() {
    if (!kind || busy) return;
    if (hasWords(draftNow()) && !(await modal({ title: 'Discard this report?', text: 'What you wrote will be lost.', okLabel: 'Discard', danger: true }))) return;
    clearTimeout(saveTimer);
    drafts[kind] = null;
    S.gc.draft(kind, null);
    kind = null;
    fill(null);
    paintKind();
    top();
  }

  function paintPics() {
    const box = $('#gcPics');
    box.innerHTML = '';
    pics.forEach((p, i) => box.append(h('span', { class: 'gcpic' },
      h('img', { src: `data:image/${p.type};base64,${p.data}`, alt: `Picture ${i + 1}` }),
      h('button', { type: 'button', class: 'gcx', title: 'Remove', onclick: () => { pics.splice(i, 1); paintPics(); saveSoon(); } }, '×'))));
    box.hidden = !pics.length;
    $('#gcAddPic').disabled = pics.length >= limits.images;
  }
  function addPics(list) {
    const room = limits.images - pics.length;
    const got = list.filter(Boolean);
    if (got.length > room) toast(`Up to ${limits.images} pictures.`);
    pics.push(...got.slice(0, Math.max(0, room)));
    paintPics();
    saveSoon();
  }
  async function addFiles(files) {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return false;
    const out = [];
    for (const f of imgs.slice(0, Math.max(0, limits.images - pics.length) || 1)) {
      const im = await S.gc.image(new Uint8Array(await f.arrayBuffer()));
      if (im) out.push(im); else toast('That picture couldn’t be read.');
    }
    addPics(out);
    return true;
  }

  // Submit spins while it sends ("Sending…" beside it) and counts down while it rests
  const clock = (s) => (s >= 3600 ? `${Math.ceil(s / 3600)} h` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  function paintSend() {
    const left = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
    const b = $('#gcSend');
    b.disabled = busy || left > 0;
    b.classList.toggle('busy', busy);
    b.textContent = left > 0 && !busy ? `Submit (${clock(left)})` : 'Submit';
    $('#gcCancel').disabled = busy;
    $('#gcBack').disabled = busy;
    if (!left && restTimer) { clearInterval(restTimer); restTimer = 0; }
  }
  function rest(secs) {
    restUntil = Date.now() + Math.max(0, secs || 0) * 1000;
    if (secs > 0 && !restTimer) restTimer = setInterval(paintSend, 1000);
    paintSend();
  }

  async function send() {
    const d = draftNow();
    if (!d.title.trim() || !d.text.trim()) { say('empty'); return; }
    if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { say('email'); $('#gcEmail').focus(); return; }
    clearTimeout(saveTimer);
    busy = true;
    say('sending'); // the button only spins
    paintSend();
    let r;
    try { r = await S.gc.send(d); } catch { r = { error: 'failed' }; }
    busy = false;
    if (r && r.ok) {
      drafts[kind] = null;
      kind = null;
      fill(null);
      paintKind();
      top();
      $('#gcDone').hidden = false; // "Sent. Thank you!" under the choices
    } else say((r && LINE[r.error]) ? r.error : 'failed');
    rest(r && r.wait);
  }

  $$('#gcPick .gcchoice').forEach((b) => b.addEventListener('click', () => open(b.dataset.kind)));
  $('#gcCancel').addEventListener('click', cancel);
  $('#gcBack').addEventListener('click', back);
  // Feedback in the sidebar while it already shows: back to the choices too (a capture listener runs before showSection)
  const nav = $('#setNav [data-sec="ground"]');
  nav.addEventListener('click', () => { if (nav.classList.contains('on')) back(); }, true);
  for (const id of ['#gcTitle', '#gcText', '#gcExpect', '#gcEmail']) $(id).addEventListener('input', () => { paintLeft(); say(''); saveSoon(); });
  $('#gcWithDetails').addEventListener('change', saveSoon);
  $('#gcAddPic').addEventListener('click', async () => addPics(await S.gc.pick()));
  $('#gcSend').addEventListener('click', send);
  // pictures pasted anywhere while Feedback shows, or dropped on its panel
  const shown = () => !!kind && !!$('.setsec[data-sec="ground"].on') && !$('#viewSettings').hidden;
  document.addEventListener('paste', (e) => {
    if (!shown() || !e.clipboardData) return;
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); addFiles(files); }
  });
  const panel = $('#gcPanel');
  panel.addEventListener('dragover', (e) => { if (kind && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); panel.classList.add('drop-on'); } });
  panel.addEventListener('dragleave', (e) => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('drop-on'); });
  panel.addEventListener('drop', (e) => {
    panel.classList.remove('drop-on');
    if (!kind || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    e.stopPropagation();
    addFiles(e.dataTransfer.files);
  });

  // first paint: the details that would go, and the drafts kept from before (their cards say "Draft")
  (async () => {
    const info = await S.gc.info();
    if (!info) return;
    limits = info.limits || limits;
    $('#gcDetails').textContent = info.details || '';
    drafts = { feature: null, bug: null, ...(info.drafts || {}) };
    paintKind();
    rest(info.wait);
  })();
  paintKind();
})();
