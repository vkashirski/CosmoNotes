'use strict';
// 1.3.1: voice to text. The jobs (Speak to text, Transcribe) and Settings → Voice to text. The engine itself is
// main/stt-engine.js, the model list main/stt-models.js, the Best download main/stt-download.js.
// Rules (ai-context/architecture.md → "Voice to text"):
// - A job belongs to one note window and never outlives it: closing the window ends it, and so does the window being
//   hidden (locked): nothing more goes to it (mayShow is checked for every message), and its audio is refused.
// - Main never writes the text into a note: the window inserts what it gets (the usual guards stay: a hidden window
//   gets nothing and never saves).
// - One Speak to text at a time (another note gets "busy"); Transcribe jobs wait for each other. The model runs one
//   piece at a time (the engine), so a Transcribe can run during a Speak to text.
// - The model (1.3.4): one, Whisper small.en, downloaded in Settings. Not downloaded: Speak to text and Transcribe say so
//   and start nothing ('nomodel'). It doesn't start: the job fails (the recording is kept) and Settings says so.
// - Live text or "after you stop" (1.3.4): Settings → "Words appear" (settings.sttWhen: 'live' | 'stop'). Not set =
//   by the PC: live on the graphics card, after you stop on the processor (Whisper's live pieces are padded to 30 s,
//   too slow there: prototype, Step 1). The engine's safety net (more than 5 s behind: no more live drafts) stays.
const crypto = require('crypto');
const fs = require('fs');
const { ipcMain } = require('electron');
const { attachmentBytes } = require('./crypt');
const { senderNote } = require('./ipc-common');
const { isLocked } = require('./locks');
const engine = require('./stt-engine');
const dl = require('./stt-download');
const { HF, MODEL, bytesOf, findModel, installed, runOf, userDir } = require('./stt-models');
const { S } = require('./state');

const jobs = new Map(); // jobId -> { id, kind: 'live' | 'transcribe', win, ready, ended, queue }
const downloads = new Map(); // model id -> { ctl, pct }
const failed = new Map(); // model id -> true: the last download failed (Try again)
let startError = null; // the model didn't start on this PC last time (Settings says so)
const watched = new WeakSet();
const newId = () => crypto.randomBytes(6).toString('hex');
const MB = 1048576;

const mayShow = (win) => {
  if (!win || win.isDestroyed()) return false;
  const n = S.store.get(win.noteId);
  return !!n && !n.deletedAt && (!isLocked(n) || !!win.revealed);
};
const settings = () => S.store.settings;
const theModel = () => findModel(MODEL);
const ready = () => !!installed(theModel());

// ------------------------------------------------------------------ the model for a job
let chain = Promise.resolve();
const serial = (fn) => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
const loadedJobs = () => [...jobs.values()].filter((j) => j.loaded && !j.ended);

function noteWebgpu(info) {
  if (info && typeof info.webgpu === 'boolean' && settings().sttWebgpu !== info.webgpu) { settings().sttWebgpu = info.webgpu; S.store.saveSettings(); }
}

function ensureModel() {
  return serial(async () => {
    const cur = engine.current();
    if (cur && loadedJobs().length) {
      const [id, rn] = cur.split('/');
      const m = findModel(id);
      return { m, run: runOf(m, rn) };
    }
    const m = theModel();
    const run = installed(m);
    if (!run) throw new Error('nomodel');
    try {
      const r = await engine.load(m, run);
      noteWebgpu(r.info);
      if (startError) { startError = null; notifyStt(); }
    } catch (e) {
      console.error('voice to text: the model did not start', e);
      startError = String(e.message || e).slice(0, 200);
      notifyStt();
      throw e;
    }
    return { m, run };
  });
}
const WHEN = ['live', 'stop'];
const whenSet = () => (WHEN.includes(settings().sttWhen) ? settings().sttWhen : null);
const autoWhen = (device) => (device === 'webgpu' ? 'live' : 'stop');
const modeOf = (p) => ((whenSet() || autoWhen(p.run.device)) === 'live' ? 'live' : 'after');

// ------------------------------------------------------------------ jobs
function toWin(job, e) {
  if (job.ended) return;
  if (!mayShow(job.win)) { end(job, true); return; }
  job.win.webContents.send('stt:event', { ...e, jobId: job.id });
}
function end(job, cancel) {
  if (job.ended) return;
  job.ended = true;
  jobs.delete(job.id);
  if (cancel) engine.post(job.kind === 'live' ? 'live-cancel' : 'cancel', { jobId: job.id });
  if (job.readyWait) job.readyWait(false);
  if (engine.isOpen()) engine.touch();
}
function watch(win) {
  if (watched.has(win)) return;
  watched.add(win);
  const gone = () => { for (const j of [...jobs.values()]) if (j.win === win) end(j, true); };
  win.once('closed', gone);
  if (win.webContents) win.webContents.on('render-process-gone', gone);
}

async function startLive(job) {
  try {
    const p = await ensureModel();
    if (job.ended) return;
    job.loaded = true;
    const mode = modeOf(p);
    await engine.call('live-start', { jobId: job.id, live: mode === 'live' }, 30e3);
    if (job.ended) { engine.post('live-cancel', { jobId: job.id }); return; }
    job.ready = true;
    for (const a of job.queue) engine.post('audio', { jobId: job.id, pcm: a.pcm, rms: a.rms });
    job.queue = [];
    toWin(job, { type: 'ready', mode, auto: !whenSet() }); // auto: the window says why it waits
    if (job.readyWait) job.readyWait(true);
  } catch (e) {
    if (job.ended) return;
    console.error('voice to text: could not start', e);
    toWin(job, { type: 'error', message: e.message === 'nomodel' ? 'nomodel' : 'failed' });
    end(job, false);
  }
}

function registerSttIpc() {
  try { dl.cleanParts(userDir()); } catch (e) { console.error(e); }
  // 1.3.4: the model choice and Test my computer's results are gone (the choice, Standard's, is gone too)
  if ('sttModel' in settings() || 'sttTests' in settings()) { delete settings().sttModel; delete settings().sttTests; S.store.saveSettings(); }
  engine.wire({ isBusy: () => jobs.size > 0 });
  engine.onEvent((m) => { const job = jobs.get(m.jobId); if (job && m.e) toWin(job, m.e); });
  engine.onGone(() => { for (const j of [...jobs.values()]) { toWin(j, { type: 'error', message: 'failed' }); end(j, false); } });

  // ---- Speak to text (the note window)
  ipcMain.handle('stt:start', (e) => {
    const { win, note } = senderNote(e);
    if (!note || !mayShow(win)) return { error: 'locked' };
    if (!ready()) return { error: 'nomodel' };
    for (const j of [...jobs.values()]) if (j.kind === 'live') { if (j.win === win) end(j, true); else return { error: 'busy' }; }
    const job = { id: newId(), kind: 'live', win, noteId: note.id, queue: [], ready: false, ended: false };
    jobs.set(job.id, job);
    watch(win);
    startLive(job);
    return { jobId: job.id };
  });
  ipcMain.on('stt:audio', (e, jobId, pcm, rms) => {
    const job = jobs.get(String(jobId));
    const { win } = senderNote(e);
    if (!job || job.kind !== 'live' || job.win !== win) return;
    if (!mayShow(win)) { end(job, true); return; }
    if (!pcm || typeof pcm.length !== 'number' || pcm.length > 48000) return;
    if (job.ready) engine.post('audio', { jobId: job.id, pcm, rms: Number(rms) || 0 });
    else if (job.queue.length < 4800) job.queue.push({ pcm, rms: Number(rms) || 0 }); // up to 20 min while the model loads
  });
  // Stop: finish only what was heard. Resolves when all its text was sent (the 'final' events come first).
  ipcMain.handle('stt:stop', async (e, jobId) => {
    const job = jobs.get(String(jobId));
    const { win } = senderNote(e);
    if (!job || job.kind !== 'live' || job.win !== win) return { ok: false };
    if (!job.ready && !(await new Promise((r) => { job.readyWait = r; }))) return { ok: false };
    try {
      const sum = await engine.call('live-stop', { jobId: job.id });
      return { ok: !!sum && !sum.failed && !job.ended };
    } catch (err) {
      console.error('voice to text: stop failed', err);
      return { ok: false };
    } finally { end(job, false); }
  });
  ipcMain.handle('stt:cancel', (e, jobId) => {
    const job = jobs.get(String(jobId));
    const { win } = senderNote(e);
    if (job && job.win === win) end(job, true);
    return true;
  });

  // ---- Transcribe (right-click a voice note): the clip of this note, read here (a sealed one through attachmentBytes)
  let tchain = Promise.resolve();
  ipcMain.handle('stt:transcribe', (e, url, jobId) => {
    const { win, note } = senderNote(e);
    if (!note || !mayShow(win)) return { error: 'locked' };
    if (typeof url !== 'string' || !String(note.html || '').includes(url)) return { error: 'gone' };
    const p = S.store.attachmentPathFromUrl(url);
    if (!p || !/\.(webm|ogg|mp3|m4a|wav)$/i.test(p) || !fs.existsSync(p)) return { error: 'gone' };
    if (!ready()) return { error: 'nomodel' };
    const id = typeof jobId === 'string' && /^[\w-]{1,40}$/.test(jobId) && !jobs.has(jobId) ? jobId : newId();
    const job = { id, kind: 'transcribe', win, noteId: note.id, ended: false };
    jobs.set(id, job);
    watch(win);
    const run = async () => {
      if (job.ended) return { cancelled: true };
      try {
        let bytes = attachmentBytes(p);
        if (bytes === false) return { error: 'locked' };
        if (!bytes) bytes = await fs.promises.readFile(p);
        await ensureModel();
        if (job.ended) return { cancelled: true };
        job.loaded = true;
        const r = await engine.call('transcribe', { jobId: id, bytes: new Uint8Array(bytes) });
        if (job.ended || !mayShow(win)) return { cancelled: true };
        return { text: String((r && r.text) || '') };
      } catch (err) {
        if (job.ended) return { cancelled: true };
        console.error('voice to text: transcribe failed', err);
        return { error: err.message === 'nomodel' ? 'nomodel' : 'failed' };
      } finally { end(job, false); }
    };
    const r = tchain.then(run, run);
    tchain = r.catch(() => {});
    return r;
  });

  // ---- Settings → Voice to text (the list)
  ipcMain.handle('stt:status', () => status());
  // "Words appear": while you talk / when you stop (the next Speak to text uses it)
  ipcMain.handle('stt:when', (e, v) => {
    if (WHEN.includes(v)) { settings().sttWhen = v; S.store.saveSettings(); }
    return status();
  });
  ipcMain.handle('stt:download', (e, id) => {
    const m = findModel(id);
    if (!m || installed(m) || downloads.has(m.id)) return status();
    const ctl = new AbortController();
    const d = { ctl, pct: 0, last: 0 };
    downloads.set(m.id, d);
    failed.delete(m.id);
    notifyStt();
    (async () => {
      // which set: the graphics card's if WebGPU works here (the engine page asks the GPU), else the processor's
      let webgpu = settings().sttWebgpu;
      try { const info = await engine.open(); noteWebgpu(info); webgpu = !!info.webgpu; } catch { webgpu = !!webgpu; }
      if (!jobs.size) engine.close(); // it was opened only to ask
      const run = runFor(m, webgpu);
      await dl.download(m, run, {
        signal: ctl.signal,
        onProgress: (done, total) => {
          d.pct = Math.floor((done / total) * 100);
          if (Date.now() - d.last > 250) { d.last = Date.now(); notifyStt(); }
        },
      });
    })().then(() => {
      downloads.delete(m.id);
      notifyStt();
    }, (err) => {
      downloads.delete(m.id);
      if (ctl.signal.aborted) { try { dl.remove(m); } catch { /* ignore */ } } // Cancel: nothing left behind
      else { console.error('voice to text: download failed', err); failed.set(m.id, true); }
      notifyStt();
    });
    return status();
  });
  ipcMain.handle('stt:download-cancel', (e, id) => {
    const d = downloads.get(String(id));
    if (d) d.ctl.abort();
    return status();
  });
  ipcMain.handle('stt:remove', (e, id) => {
    const m = findModel(id);
    if (!m) return status();
    if (jobs.size || downloads.has(m.id)) return { ...status(), error: 'busy' };
    if (String(engine.current() || '').startsWith(m.id + '/')) engine.close();
    dl.remove(m);
    failed.delete(m.id);
    startError = null;
    return status();
  });
}

// ------------------------------------------------------------------ what Settings shows
function runFor(m, webgpu) { return m.runs.find((r) => !r.needs || (r.needs === 'webgpu' && webgpu)) || m.runs[m.runs.length - 1]; }
function status() {
  const s = settings();
  const webgpu = typeof s.sttWebgpu === 'boolean' ? s.sttWebgpu : null;
  const m = theModel();
  const run = installed(m);
  const d = downloads.get(m.id);
  const next = run || runFor(m, !!webgpu);
  return {
    startError,
    when: whenSet() || autoWhen(next.device), // what Speak to text does now
    whenSet: !!whenSet(),
    model: {
      id: m.id, name: m.name,
      url: `${HF}/${m.repo}`, // the model's page (Settings links to it)
      state: run ? 'ready' : d ? 'downloading' : failed.has(m.id) ? 'failed' : 'none',
      pct: d ? d.pct : null,
      mb: Math.round(bytesOf(m, next) / MB),
      // not downloaded and WebGPU not known yet: the size is one of two
      mbMax: !run && webgpu === null && m.runs.length > 1 ? Math.round(Math.max(...m.runs.map((r) => bytesOf(m, r))) / MB) : null,
      device: next.device === 'webgpu' ? 'gpu' : 'cpu',
    },
  };
}
let notifyTimer = null;
function notifyStt() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (S.listWin && !S.listWin.isDestroyed()) S.listWin.webContents.send('stt:changed', status());
  }, 30);
}

module.exports = { registerSttIpc };
