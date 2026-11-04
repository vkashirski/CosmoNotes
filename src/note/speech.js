'use strict';
// CosmoNotes note window, part 7 of 11: voice to text (1.3.1): + Add → Speak to text, and right-click a voice note → Transcribe
// (the parts load in order from note.html. How they share names: ai-context/splitting-code.md)
// The engine runs in main (main/ipc-stt.js, main/stt-engine.js); this window only sends audio and puts the text in.
// - Speak to text is the voice recorder of part 6 (rec.stt): the recording goes to disk as always (the safety net), and
//   the AudioWorklet (src/mic-worklet.js) sends 16 kHz pieces to main. Where the words go there is a marker,
//   <span class="stt-pending">: empty, its grey draft and its label ("Finishing…") are only attributes shown by CSS, and
//   it is never saved (collect drops it). Each settled piece is typed in before it (insertText: one Undo step each).
//   Stop = finish what was heard, then the clip is deleted. Cancel, a failure, closing or locking the note = the
//   recording stays as a voice note, where the text was (rec 'kept' / keepClip).
// - Transcribe: the clip's text goes on the line after its chip, in <span class="stt-text" data-of="<clip>"> (no look of
//   its own; doing it again offers to replace it). One Undo step. Closing or locking the note: nothing is added.
(() => {
  const K = window.COSMO_NOTE_KIT;
  const { V, api, $, editor, esc, changed, saveSel, voiceChip, rec, startRecording, stopRecording, keepClip, dropClip, insertNodes } = K;
  // defined in a later part:
  const toast = K.later('toast'), ask = K.later('ask');

  const say = {
    slow: 'This PC is slow for live text. The words appear when you stop.',
    missing: "This model isn't downloaded yet.",
    kept: 'Stopped. Your recording is saved as a voice note.',
    failed: "Couldn't write it down. Your recording is saved.",
    busy: 'Voice to text is busy in another note.',
    noText: "Couldn't write it down.",
    nothing: 'No words found in this recording.',
  };
  const newId = () => Math.random().toString(36).slice(2, 10);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ================================================================ the marker (where the words go)
  function makeMarker(id, label) {
    const m = document.createElement('span');
    m.className = 'stt-pending';
    m.contentEditable = 'false';
    m.dataset.job = id;
    if (label) m.dataset.label = label;
    return m;
  }
  const markerOf = (id) => editor.querySelector(`.stt-pending[data-job="${id}"]`);
  function setLabel(m, label) { if (!m) return; if (label) m.dataset.label = label; else delete m.dataset.label; }
  // a draft after a word gets a space in front, like the text it becomes
  function setDraft(m, text) { if (!m) return; if (text) m.dataset.draft = (needsSpace(m) ? ' ' : '') + text; else delete m.dataset.draft; }
  function needsSpace(m) {
    const before = m.previousSibling;
    const prev = before && before.nodeType === 3 ? before.data : before ? (before.textContent || '') : '';
    return !!prev && !/\s$/.test(prev);
  }
  // the caret goes where the marker is (a chip or more text is put there next)
  function caretAtMarker(m) {
    if (!m || !editor.contains(m)) return;
    const r = document.createRange();
    r.setStartBefore(m);
    r.collapse(true);
    V.savedRange = r;
  }

  // Types text in just before the marker, as one Undo step, and puts the caret back where the person had it.
  function typeBefore(m, text) {
    if (!m || !editor.contains(m) || !text) return;
    const s = getSelection();
    const had = s.rangeCount && editor.contains(s.getRangeAt(0).startContainer) ? s.getRangeAt(0).cloneRange() : null;
    const lead = needsSpace(m) ? ' ' : '';
    const r = document.createRange();
    r.setStartBefore(m);
    r.collapse(true);
    // the person's caret right at the marker moves on with the text; anywhere else it stays where it was
    const atMarker = !had || (had.collapsed && had.compareBoundaryPoints(Range.START_TO_START, r) === 0);
    editor.focus({ preventScroll: true });
    s.removeAllRanges();
    s.addRange(r);
    document.execCommand('insertText', false, lead + text);
    if (!atMarker) { try { s.removeAllRanges(); s.addRange(had); } catch { /* the place is gone */ } }
    changed();
  }

  // ================================================================ Speak to text
  // stt.busy: a Speak to text is on (listening or finishing); stt.job: its id from main (null until main answers);
  // stt.marker: where its words go; stt.listening: the microphone's pieces go to main
  const stt = { busy: false, job: null, marker: null, mode: 'live', mic: null, listening: false, stopping: false, failing: false, clip: null, starting: null };

  async function speakToText() {
    if (rec.mr || rec.starting || stt.busy || V.hidden) return;
    stt.busy = true;
    saveSel();
    const id = 'live-' + newId();
    // the marker goes at the caret (after a selection, never replacing it)
    const r = V.savedRange && editor.contains(V.savedRange.startContainer) ? V.savedRange.cloneRange() : null;
    const m = makeMarker(id, '');
    if (r) { r.collapse(false); r.insertNode(m); } else editor.append(m);
    stt.marker = m;
    stt.mode = 'live';
    stt.stopping = false;
    stt.clip = null;
    stt.job = null;
    stt.starting = api.sttStart().catch(() => null).then((res) => {
      if (!res || res.error) {
        if (res && res.error === 'busy') toast(say.busy);
        return null;
      }
      stt.job = res.jobId;
      return res.jobId;
    });
    const ok = await startRecording({ stt: true });
    if (!ok) { // no microphone (startRecording said so)
      const job = await stt.starting;
      if (job) api.sttCancel(job).catch(() => {});
      endLive();
      return;
    }
    if (!(await stt.starting)) { // main said no (busy in another note): nothing was said yet
      stopRecording(false);
      endLive();
    }
  }

  // the microphone's second path: 16 kHz pieces for the engine (part 6 calls this once the recorder runs)
  async function sttMic(stream) {
    let ctx;
    try { ctx = new AudioContext({ sampleRate: 16000 }); } catch { ctx = new AudioContext(); }
    const mic = { ctx, node: null, src: null };
    stt.mic = mic;
    try {
      await ctx.audioWorklet.addModule('mic-worklet.js');
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'mic16k', { processorOptions: { inRate: ctx.sampleRate } });
      const sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);
      src.connect(node);
      node.connect(sink);
      Object.assign(mic, { node, src });
      const job = await stt.starting;
      stt.listening = true;
      node.port.onmessage = (e) => { if (job && stt.job === job && stt.listening) api.sttAudio(job, e.data.pcm, e.data.rms); };
    } catch (e) {
      console.error('voice to text: microphone', e);
      failLive();
    }
  }
  function closeMic() {
    stt.listening = false;
    const mic = stt.mic;
    stt.mic = null;
    if (!mic) return;
    try { if (mic.src) mic.src.disconnect(); if (mic.node) mic.node.disconnect(); } catch { /* ignore */ }
    mic.ctx.close().catch(() => {});
  }
  function endLive() {
    closeMic();
    if (stt.marker) { stt.marker.remove(); changed(); }
    stt.marker = null;
    stt.job = null;
    stt.starting = null;
    stt.clip = null;
    stt.stopping = false;
    stt.busy = false;
  }

  // Stop: the microphone goes off, then only what was heard is written down
  async function sttStop() {
    if (!stt.busy || stt.stopping) return;
    stt.stopping = true;
    const m = stt.marker;
    setDraft(m, '');
    setLabel(m, 'Finishing…');
    if (stt.mic && stt.mic.node) stt.mic.node.port.postMessage('flush');
    const job = await stt.starting;
    await wait(80); // the last piece reaches main
    closeMic();
    const clip = rec.mr ? await new Promise((resolve) => { rec.onSttStop = resolve; stopRecording('stt'); }) : null;
    if (!stt.busy || stt.marker !== m) return; // closed or locked meanwhile (sttAbortNow kept the recording)
    stt.clip = clip;
    const res = job ? await api.sttStop(job).catch(() => ({ ok: false })) : { ok: false };
    if (!stt.busy || stt.marker !== m) return;
    stt.clip = null;
    if (res && res.ok) { if (clip) dropClip(clip); endLive(); return; }
    caretAtMarker(m);
    endLive();
    if (clip) await keepClip(clip);
    toast(say.failed);
  }

  // Cancel: the words so far stay, and so does the recording (as a voice note where the text was)
  async function sttCancel() {
    if (!stt.busy || stt.stopping) return;
    stt.stopping = true;
    const job = await stt.starting;
    if (job) api.sttCancel(job).catch(() => {});
    closeMic();
    const m = stt.marker;
    caretAtMarker(m);
    endLive();
    if (rec.mr) stopRecording(true); // part 6 puts the chip at the caret
    toast(say.kept);
  }

  // something went wrong while listening: the same as Cancel, with its own words
  async function failLive() {
    if (!stt.busy || stt.failing || stt.stopping) return; // while stopping, sttStop hears it from main
    stt.failing = true;
    const job = stt.job;
    if (job) api.sttCancel(job).catch(() => {});
    closeMic();
    const m = stt.marker;
    caretAtMarker(m);
    const clip = stt.clip;
    endLive();
    stt.failing = false;
    if (rec.mr && !rec.chunks.length) { stopRecording(false); toast(say.noText); return; } // nothing recorded yet
    if (rec.mr) stopRecording(true);
    else if (clip) await keepClip(clip);
    toast(say.failed);
  }

  // The note closes or gets locked now (part 6's stopRecordingNow, before the last save): no more text; the caret goes
  // to the marker, so the recording's chip goes there. If the microphone was already off (Finishing…), the chip goes
  // in here and main finishes the file ('kept').
  function sttAbortNow() {
    if (!stt.busy) return;
    const job = stt.job;
    if (job) api.sttCancel(job).catch(() => {});
    const m = stt.marker;
    caretAtMarker(m);
    const clip = stt.clip;
    closeMic();
    rec.onSttStop = null;
    endLive();
    if (clip && clip.id) { insertNodes(voiceChip(clip.url, clip.dur)); api.recEnd(clip.id, 'kept').catch(() => {}); }
    else if (clip) keepClip(clip);
  }

  // ================================================================ Transcribe (right-click a voice note)
  const jobs = new Map(); // job id -> { marker, old, url }
  async function transcribe(chip) {
    if (V.hidden || !chip || !editor.contains(chip)) return;
    const url = chip.dataset.src;
    if (!url) return;
    const old = [...editor.querySelectorAll('.stt-text')].find((s) => s.dataset.of === url) || null;
    if (old && !(await ask('Replace the text from last time?', 'Changes you made to it will be lost.', 'Replace'))) return;
    if (V.hidden || !editor.contains(chip)) return;
    const id = 'tr-' + newId();
    const m = makeMarker(id, 'Writing it down…');
    if (old && editor.contains(old)) old.after(m);
    else {
      // the line after the chip's line (a chip on its own at the top: after the space that follows it)
      let block = chip;
      while (block.parentNode && block.parentNode !== editor) block = block.parentNode;
      const line = document.createElement('div');
      line.append(m);
      let after = block;
      if (block === chip) {
        const next = chip.nextSibling;
        if (next && next.nodeType === 3 && !next.data.trim()) after = next;
      }
      after.after(line);
    }
    jobs.set(id, { marker: m, old: old && editor.contains(old) ? old : null, url });
    const res = await api.sttTranscribe(url, id).catch(() => ({ error: 'failed' }));
    const j = jobs.get(id);
    jobs.delete(id);
    if (!j || V.hidden || !editor.contains(m)) return; // closed or locked meanwhile: nothing is added
    if (!res || res.cancelled) { removeMarker(m); return; }
    if (res.error) { removeMarker(m); toast(res.error === 'busy' ? say.busy : say.noText); return; }
    if (res.fallback === 'missing') toast(say.missing);
    const text = String(res.text || '').trim();
    if (!text) { removeMarker(m); toast(say.nothing); return; }
    putText(j, text);
  }
  function removeMarker(m) {
    const line = m.parentNode;
    m.remove();
    if (line && line !== editor && line.nodeName === 'DIV' && !line.childNodes.length) line.remove();
    changed();
  }
  // The text in its span, as one Undo step. The marker goes first (outside the Undo list), so Undo never brings it back:
  // Undo leaves an empty line. Again on the same chip: the old span is replaced (Undo gives the old words back).
  function putText(j, text) {
    const m = j.marker;
    const line = m.parentNode;
    const html = `<span class="stt-text" data-of="${esc(j.url)}">${esc(text)}</span>`;
    const s = getSelection();
    const r = document.createRange();
    if (j.old && editor.contains(j.old)) {
      m.remove();
      if (line && line !== editor && line.nodeName === 'DIV' && !line.childNodes.length) line.remove();
      r.selectNode(j.old);
    } else {
      const br = document.createElement('br');
      m.replaceWith(br);
      r.setStartBefore(br);
      r.collapse(true);
    }
    editor.focus({ preventScroll: true });
    s.removeAllRanges();
    s.addRange(r);
    document.execCommand('insertHTML', false, html);
    changed();
  }
  // locking the note: every Transcribe ends, nothing is added (the editor is emptied anyway)
  function sttHide() {
    for (const [id, j] of jobs) { api.sttCancel(id).catch(() => {}); j.marker.remove(); }
    jobs.clear();
    sttAbortNow();
  }

  // ================================================================ what main says about a job
  api.onStt((e) => {
    if (!e) return;
    if (jobs.has(e.jobId)) {
      if (e.type === 'progress' && e.pct < 100) setLabel(jobs.get(e.jobId).marker, `Writing it down… ${e.pct}%`);
      return;
    }
    if (!stt.busy || e.jobId !== stt.job) return;
    const m = stt.marker;
    if (e.type === 'ready') {
      stt.mode = e.mode;
      if (e.fallback === 'missing') toast(say.missing);
      if (e.mode === 'after') { setLabel(m, 'Writing it down when you stop'); if (e.fallback !== 'missing') toast(say.slow); }
    } else if (e.type === 'draft') {
      if (!stt.stopping) setDraft(m, e.text || '');
    } else if (e.type === 'final') {
      setDraft(m, '');
      typeBefore(m, String(e.text || '').trim());
    } else if (e.type === 'status') {
      if (e.state === 'behind' && !stt.stopping) { setDraft(m, ''); setLabel(m, 'Writing it down when you stop'); }
      if (e.state === 'finishing') setLabel(m, 'Finishing…');
    } else if (e.type === 'error') {
      failLive();
    }
  });

  Object.assign(K, { speakToText, sttMic, sttStop, sttCancel, sttAbortNow, sttHide, transcribe });
})();
