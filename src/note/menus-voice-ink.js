'use strict';
// CosmoNotes note window, part 6 of 11: right-click menus, voice notes, drawing, photo resizing
// (src/note.js until 1.1.44; the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, $$, editor, body, esc, fmt, changed, saveNow, saveSel, insertNodes, closePops, openLinkForm, openDesc,
    tableOp, copyPhoto, openPhoto } = K;
  // defined in a later part:
  const zoomNow = K.later('zoomNow'), hasInk = K.later('hasInk'), needsResizeWarning = K.later('needsResizeWarning'),
    resizeWarning = K.later('resizeWarning'), toast = K.later('toast'), textWidth = K.later('textWidth'),
    transcribe = K.later('transcribe'), sttStop = K.later('sttStop'), sttCancel = K.later('sttCancel'), sttMic = K.later('sttMic'),
    sttAbortNow = K.later('sttAbortNow');
  // ================================================================ right-click menus
  const ctx = $('#ctx');
  function hideCtx() { ctx.hidden = true; }
  function showCtx(x, y, items) {
    ctx.innerHTML = '';
    for (const it of items) {
      if (it === '-') { const s = document.createElement('div'); s.className = 'sep'; ctx.appendChild(s); continue; }
      const b = document.createElement('button');
      b.className = 'mi' + (it.danger ? ' danger' : '');
      b.textContent = it.label;
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => { hideCtx(); it.run(); });
      ctx.appendChild(b);
    }
    ctx.hidden = false;
    const w = ctx.offsetWidth;
    const h = ctx.offsetHeight;
    ctx.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px';
    ctx.style.top = Math.max(4, Math.min(y, innerHeight - h - 4)) + 'px';
  }
  editor.addEventListener('contextmenu', (e) => {
    const img = e.target.closest('img');
    const voice = e.target.closest('.voice');
    const a = e.target.closest('a[href]');
    const cell = e.target.closest('td,th');
    let items = null;
    if (img) {
      const drawing = img.classList.contains('att-drawing');
      const guarded = (fn) => () => (needsResizeWarning() ? resizeWarning(fn) : fn());
      const fixed = img.classList.contains('fixed');
      // A locked layout with a drawing keeps every picture at its size, so the drawing stays on
      // what it marked. The option would do nothing there, so the menu says why instead.
      const pinnedByInk = hasInk() && !!V.note.wrapWidth;
      const keep = pinnedByInk ? {
        label: '✓ Keep size (on while there’s a drawing)',
        run: () => toast('Pictures keep their size to match your drawing. Turn word wrap on to shrink them.'),
      } : {
        label: (fixed ? '✓ ' : '') + 'Keep size when the note gets narrower',
        run: () => {
          if (fixed) img.classList.remove('fixed');
          else {
            // remember the size it has with the note at full width (not a squeezed size)
            if (!img.getAttribute('width')) img.setAttribute('width', String(Math.round(Math.min(img.naturalWidth || Infinity, textWidth()))));
            img.classList.add('fixed');
          }
          changed();
          toast(fixed ? 'This picture now shrinks with the note' : 'This picture keeps its size; scroll sideways if the note gets narrower');
        },
      };
      // 1.1.23: words you can find the picture by (Ctrl+F and the notes list's search); shown when you point at it
      const desc = { label: img.getAttribute('alt') ? 'Edit description…' : 'Add description…', run: () => openDesc(img) };
      items = drawing
        ? [{ label: 'Edit sketch', run: () => openDraw(img) }, desc, '-', keep]
        : [
          { label: 'Copy image', run: () => copyPhoto(img) }, // 1.1.22 (sixth round)
          { label: 'Open in photo viewer', run: () => openPhoto(img) }, // was "Open full size"
          desc,
          '-',
          { label: 'Small', run: guarded(() => setImgWidth(img, textWidth() * 0.4)) },
          { label: 'Medium', run: guarded(() => setImgWidth(img, textWidth() * 0.7)) },
          { label: 'Full width', run: guarded(() => { img.classList.remove('w-s', 'w-m', 'fixed'); img.removeAttribute('width'); changed(); placeHandle(); }) },
          '-',
          keep,
        ];
      items.push('-', { label: drawing ? 'Remove drawing' : 'Remove photo', danger: true, run: () => { img.remove(); changed(); } });
    } else if (voice) {
      items = [
        { label: playingChip === voice ? 'Pause' : 'Play', run: () => togglePlay(voice) },
        { label: 'Transcribe', run: () => transcribe(voice) }, // 1.3.1: the text goes on the line after it (src/note/speech.js)
        '-',
        { label: 'Remove recording', danger: true, run: () => { if (playingChip === voice) stopPlay(); voice.remove(); changed(); } },
      ];
    } else if (a) {
      items = [
        { label: 'Open link', run: () => api.openExternal(a.getAttribute('href')) },
        { label: 'Edit link', run: () => openLinkForm(a) },
        { label: 'Copy link address', run: () => navigator.clipboard.writeText(a.getAttribute('href')).catch(() => {}) },
        '-',
        { label: 'Remove link (keep text)', run: () => { a.replaceWith(...a.childNodes); changed(); } },
      ];
    } else if (cell) {
      items = [
        { label: 'Add row above', run: () => tableOp(cell, 'rowAbove') },
        { label: 'Add row below', run: () => tableOp(cell, 'rowBelow') },
        { label: 'Add column left', run: () => tableOp(cell, 'colLeft') },
        { label: 'Add column right', run: () => tableOp(cell, 'colRight') },
        '-',
        { label: 'Delete row', danger: true, run: () => tableOp(cell, 'delRow') },
        { label: 'Delete column', danger: true, run: () => tableOp(cell, 'delCol') },
        { label: 'Delete table', danger: true, run: () => tableOp(cell, 'delTable') },
      ];
    }
    if (!items) return; // regular text: the normal Cut/Copy/Paste + spelling menu
    e.preventDefault();
    closePops();
    showCtx(e.clientX, e.clientY, items);
  });

  // ================================================================ voice notes
  let player = null;
  let playingChip = null;
  function togglePlay(chip) {
    if (playingChip === chip) { stopPlay(); return; }
    stopPlay();
    const audio = new Audio(chip.dataset.src);
    player = audio;
    playingChip = chip;
    chip.classList.add('playing');
    const bars = [...chip.querySelectorAll('.v-bars i')];
    const dur = +chip.dataset.dur || 0;
    audio.ontimeupdate = () => {
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dur;
      const k = d ? Math.round((audio.currentTime / d) * bars.length) : 0;
      bars.forEach((b, i) => b.classList.toggle('on', i < k));
      chip.querySelector('.v-time').textContent = fmt(audio.currentTime);
    };
    audio.onended = stopPlay;
    audio.onerror = () => { toast("Couldn't play this recording"); stopPlay(); };
    audio.play().catch(() => {});
  }
  function stopPlay() {
    if (player) { player.pause(); player = null; }
    if (playingChip) {
      playingChip.classList.remove('playing');
      playingChip.querySelectorAll('i.on').forEach((i) => i.classList.remove('on'));
      const t = playingChip.querySelector('.v-time');
      if (t) t.textContent = fmt(+playingChip.dataset.dur);
      playingChip = null;
    }
  }
  function voiceChip(url, dur) {
    let x = [...url].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    let bars = '';
    for (let i = 0; i < 18; i++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      bars += `<i class="h${1 + ((x >>> 16) % 5)}"></i>`;
    }
    return `<span class="voice" contenteditable="false" data-src="${esc(url)}" data-dur="${dur}"><span class="v-play"></span><span class="v-bars">${bars}</span><span class="v-time">${fmt(dur)}</span></span>&nbsp;`;
  }

  // 1.2.4: the recording goes to disk while you talk (main/recordings.js: rec.id names the file), so closing the note,
  // locking it, quitting or a crash keeps what was said. The pieces stay here too, in case the file can't be written.
  // rec.keep: true = Save, false = thrown away, 'kept' = closed or locked mid-recording (stopRecordingNow),
  // 'stt' = Speak to text stopped: the clip is on disk, and src/note/speech.js decides (rec.onSttStop) whether it stays.
  // 1.3.1: rec.stt = this recording is Speak to text: the same recorder (the file is the safety net), plus the 16 kHz
  // audio for the engine (sttMic); the bar says "Listening…" with Stop and Cancel.
  const rec = { mr: null, stream: null, chunks: [], start: 0, timer: null, keep: true, ctx: null, raf: 0, id: null, url: null, q: null, starting: false,
    stt: false, onSttStop: null };
  async function startRecording({ stt = false } = {}) {
    if (rec.mr || rec.starting) return false;
    rec.starting = true;
    saveSel();
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      rec.starting = false;
      toast('No microphone found, or Windows blocked it (Settings → Privacy → Microphone)');
      return false;
    }
    rec.id = null;
    rec.url = null;
    rec.q = Promise.resolve();
    try {
      const r = await api.recStart();
      if (r && r.id) { rec.id = r.id; rec.url = r.url; }
    } catch { /* kept in memory only, as before 1.2.4 */ }
    rec.starting = false;
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    rec.mr = new MediaRecorder(rec.stream, { mimeType: mime });
    rec.chunks = [];
    rec.keep = true;
    rec.mr.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      rec.chunks.push(e.data);
      const id = rec.id;
      const blob = e.data;
      // in order: each piece is appended to the file only after the one before it
      if (id) rec.q = rec.q.then(() => blob.arrayBuffer()).then((b) => api.recChunk(id, new Uint8Array(b))).catch(() => {});
    };
    rec.mr.onstop = finishRecording;
    rec.mr.start(250);
    rec.start = Date.now();
    rec.stt = stt;
    $('#recbar').classList.toggle('stt', stt);
    $('#recStop').lastChild.textContent = stt ? 'Stop' : 'Save';
    $('#recStop').title = stt ? 'Stop and write it down' : 'Stop and save';
    $('#recCancel').title = stt ? 'Cancel' : 'Throw away';
    $('#recbar').hidden = false;
    $('#recTime').textContent = stt ? 'Listening…' : '0:00';
    if (!stt) rec.timer = setInterval(() => { $('#recTime').textContent = fmt((Date.now() - rec.start) / 1000); }, 250);
    startMeter();
    if (stt) sttMic(rec.stream);
    return true;
  }
  function startMeter() {
    const meter = $('#meter');
    meter.innerHTML = '<i></i>'.repeat(40);
    const bars = [...meter.children];
    try {
      rec.ctx = new AudioContext();
      const src = rec.ctx.createMediaStreamSource(rec.stream);
      const an = rec.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const levels = new Array(bars.length).fill(3);
      let last = 0;
      const tick = (t) => {
        rec.raf = requestAnimationFrame(tick);
        if (t - last < 70) return;
        last = t;
        an.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        levels.shift();
        levels.push(3 + Math.min(19, peak / 2.2));
        bars.forEach((b, i) => { b.style.height = levels[i] + 'px'; });
      };
      rec.raf = requestAnimationFrame(tick);
    } catch { /* meter is just decoration */ }
  }
  function stopRecording(keep) {
    if (!rec.mr || rec.keep === 'kept') return;
    rec.keep = keep;
    try { rec.mr.stop(); } catch { finishRecording(); }
  }
  // 1.2.4: the note closes or gets locked mid-recording. The chip goes in right away, so the save that follows
  // (beforeunload, relock, lockNow) has it; main finishes the file with what arrived (and adds the chip if this window
  // can't save any more). Returns false when there is no file to keep (the slower Save path is used then).
  function stopRecordingNow() {
    if (rec.stt || !rec.mr) sttAbortNow(); // 1.3.1: Speak to text stops at once; the chip goes where its text was
    if (!rec.mr || rec.keep === 'kept' || !rec.id) return false;
    rec.keep = 'kept';
    insertNodes(voiceChip(rec.url, Math.max(1, Math.round((Date.now() - rec.start) / 1000))));
    api.recEnd(rec.id, 'kept').catch(() => {});
    try { rec.mr.stop(); } catch { finishRecording(); }
    return true;
  }
  async function finishRecording() {
    clearInterval(rec.timer);
    cancelAnimationFrame(rec.raf);
    if (rec.ctx) { rec.ctx.close().catch(() => {}); rec.ctx = null; }
    if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
    $('#recbar').hidden = true;
    const dur = Math.max(1, Math.round((Date.now() - rec.start) / 1000));
    const chunks = rec.chunks;
    const keep = rec.keep;
    const { id, url } = rec;
    rec.mr = null;
    rec.stream = null;
    rec.chunks = [];
    rec.id = null;
    rec.url = null;
    rec.keep = true;
    rec.stt = false;
    if (keep === 'kept') return; // done already (stopRecordingNow)
    await rec.q; // every piece is in the file
    const clip = { id, url, chunks, dur };
    if (keep === 'stt') { const r = rec.onSttStop; rec.onSttStop = null; if (r) r(clip); else keepClip(clip); return; }
    if (!keep || !chunks.length) { dropClip(clip); return; }
    await keepClip(clip);
  }
  // a finished recording becomes a voice note (its chip where the caret is), or is thrown away
  async function keepClip({ id, url, chunks, dur }) {
    if (!chunks.length) { dropClip({ id }); return false; }
    try {
      let got = id ? await api.recEnd(id, 'save').catch(() => null) : null;
      // the file couldn't be written: save the pieces kept here, as before 1.2.4
      if (!got) got = await api.saveAttachment(new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer()), 'webm');
      insertNodes(voiceChip(got, dur));
      if (id && got === url) { await saveNow(); api.recDone(id).catch(() => {}); } // the note has it: main tidies up
      return true;
    } catch {
      toast('Could not save the recording');
      return false;
    }
  }
  function dropClip({ id }) { if (id) api.recEnd(id, 'discard').catch(() => {}); }
  $('#recStop').addEventListener('click', () => (rec.stt ? sttStop() : stopRecording(true)));
  $('#recCancel').addEventListener('click', () => (rec.stt ? sttCancel() : stopRecording(false)));

  // ================================================================ drawing
  const cv = $('#cv');
  const g = cv.getContext('2d');
  const draw = { strokes: [], color: '#2B2B2B', size: 4, erase: false, bg: null, target: null, cur: null, dpr: 1, w: 0, h: 0 };

  function openDraw(target) {
    closePops();
    hideCtx();
    if (!target) saveSel();
    draw.target = target;
    draw.strokes = [];
    draw.bg = null;
    draw.cur = null;
    $('#draw').hidden = false;
    sizeCanvas();
    if (target) {
      const im = new Image();
      im.onload = () => {
        const w = Number(target.getAttribute('width')) || im.naturalWidth;
        const scale = Math.min(1, draw.w / w);
        draw.bg = { img: im, w: w * scale, h: (im.naturalHeight * (w / im.naturalWidth)) * scale };
        redraw();
      };
      im.src = target.getAttribute('src');
    }
  }
  function closeDraw() {
    $('#draw').hidden = true;
    draw.cur = null;
  }
  function sizeCanvas() {
    const r = cv.getBoundingClientRect();
    draw.dpr = window.devicePixelRatio || 1;
    draw.w = r.width;
    draw.h = r.height;
    cv.width = Math.max(1, Math.round(r.width * draw.dpr));
    cv.height = Math.max(1, Math.round(r.height * draw.dpr));
    g.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    redraw();
  }
  window.addEventListener('resize', () => { if (!$('#draw').hidden) sizeCanvas(); });

  function strokeWidth(s, p) { return s.erase ? s.size * 4 : s.size * (0.45 + p * 1.1); }
  function paintStroke(s) {
    const pts = s.pts;
    g.save();
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    g.strokeStyle = s.color;
    g.fillStyle = s.color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (pts.length === 1) {
      g.beginPath();
      g.arc(pts[0].x, pts[0].y, strokeWidth(s, pts[0].p) / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      let from = pts[0];
      for (let i = 1; i < pts.length; i++) {
        const to = i === pts.length - 1 ? pts[i] : mid(pts[i], pts[i + 1]);
        g.lineWidth = strokeWidth(s, pts[i].p);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.quadraticCurveTo(pts[i].x, pts[i].y, to.x, to.y);
        g.stroke();
        from = to;
      }
    }
    g.restore();
  }
  function redraw() {
    g.clearRect(0, 0, draw.w, draw.h);
    if (draw.bg) g.drawImage(draw.bg.img, 0, 0, draw.bg.w, draw.bg.h);
    draw.strokes.forEach(paintStroke);
    $('#dHint').hidden = draw.strokes.length > 0 || !!draw.bg;
  }
  const ptOf = (e) => ({ x: e.offsetX, y: e.offsetY, p: e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5 });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    draw.cur = { color: draw.color, size: draw.size, erase: draw.erase, pts: [ptOf(e)] };
    draw.strokes.push(draw.cur);
    redraw();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!draw.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) draw.cur.pts.push(ptOf(ev));
    redraw();
  });
  const endStroke = () => { draw.cur = null; };
  cv.addEventListener('pointerup', endStroke);
  cv.addEventListener('pointercancel', endStroke);

  function drawUndo() { draw.strokes.pop(); redraw(); }
  $('#dUndo').addEventListener('click', drawUndo);
  $('#dClear').addEventListener('click', () => { draw.strokes = []; draw.bg = null; redraw(); });
  $('#dCancel').addEventListener('click', closeDraw);
  $$('#pens .pen').forEach((b) => b.addEventListener('click', () => {
    draw.color = b.dataset.pen;
    draw.erase = false;
    body.classList.remove('erasing');
    $('#eraser').classList.remove('on');
    $$('#pens .pen').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $$('#sizes .size').forEach((b) => b.addEventListener('click', () => {
    draw.size = Number(b.dataset.w);
    $$('#sizes .size').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#eraser').addEventListener('click', () => {
    draw.erase = !draw.erase;
    body.classList.toggle('erasing', draw.erase);
    $('#eraser').classList.toggle('on', draw.erase);
  });

  function contentBox() {
    const { width, height } = cv;
    const px = g.getImageData(0, 0, width, height).data;
    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (px[(y * width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = Math.round(6 * draw.dpr);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  $('#dDone').addEventListener('click', async () => {
    const target = draw.target;
    if (!draw.strokes.length && (target ? draw.bg : true)) { closeDraw(); return; }
    redraw();
    const box = contentBox();
    if (!box) {
      if (target) { target.remove(); changed(); }
      closeDraw();
      return;
    }
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    try {
      const url = await api.saveAttachment(new Uint8Array(await blob.arrayBuffer()), 'png');
      const cssW = Math.round(box.w / draw.dpr);
      closeDraw();
      if (target && editor.contains(target)) {
        target.setAttribute('src', url);
        target.setAttribute('width', String(cssW));
        changed();
      } else {
        insertNodes(`<img class="att-drawing" src="${esc(url)}" width="${cssW}">`);
      }
    } catch {
      toast('Could not save the drawing');
    }
  });

  // ================================================================ photo resizing
  const handle = $('#imgHandle');
  V.resizing = false;
  const MIN_IMG = 60;
  function selectedImage() {
    const img = editor.querySelector('img.sel-img');
    return img && editor.contains(img) ? img : null;
  }
  function selectImage(img) {
    $$('#editor .sel-img').forEach((i) => i !== img && i.classList.remove('sel-img'));
    const r = document.createRange();
    r.selectNode(img);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    img.classList.add('sel-img');
    placeHandle();
  }
  function placeHandle() {
    const img = selectedImage();
    if (!img || V.hidden || V.note?.rolled) { handle.hidden = true; return; }
    const r = img.getBoundingClientRect();
    const box = $('#scroller').getBoundingClientRect();
    if (r.bottom < box.top + 4 || r.bottom > box.bottom - 2) { handle.hidden = true; return; }
    handle.hidden = false;
    handle.style.left = `${Math.min(r.right, box.right - 10)}px`;
    handle.style.top = `${r.bottom}px`;
  }
  function setImgWidth(img, w) {
    const max = textWidth();
    w = Math.round(Math.max(Math.min(MIN_IMG, max), Math.min(max, w)));
    img.classList.remove('w-s', 'w-m');
    img.setAttribute('width', String(w));
    changed();
    placeHandle();
  }
  handle.addEventListener('pointerdown', (e) => {
    const img = selectedImage();
    if (!img) return;
    e.preventDefault();
    if (needsResizeWarning()) { resizeWarning(); return; }
    handle.setPointerCapture(e.pointerId);
    V.resizing = true;
    body.classList.add('resizing');
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const max = textWidth();
    const min = Math.min(MIN_IMG, max);
    const move = (ev) => {
      const w = Math.round(Math.max(min, Math.min(max, (startW + ev.clientX - startX) / zoomNow())));
      img.classList.remove('w-s', 'w-m');
      img.setAttribute('width', String(w));
      placeHandle();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      V.resizing = false;
      body.classList.remove('resizing');
      changed();
      placeHandle();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  $('#scroller').addEventListener('scroll', placeHandle, { passive: true });
  window.addEventListener('resize', placeHandle);
  editor.addEventListener('load', placeHandle, true);

  Object.assign(K, { hideCtx, togglePlay, stopPlay, voiceChip, rec, startRecording, stopRecording, stopRecordingNow, keepClip, dropClip,
    openDraw, closeDraw, drawUndo,
    handle, selectImage, placeHandle });
})();
