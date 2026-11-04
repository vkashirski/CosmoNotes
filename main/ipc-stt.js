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
// - The model: the one picked in Settings if it is on this PC, else Standard ("fallback"). While a job runs, the next
//   one uses the model already loaded. Best on the graphics card that fails to start falls back to Standard too.
// - Live text or "after you stop": Test my computer's verdict for that model and set, or the first time a quiet
//   2-second check while it warms up (settings.sttTests).
const crypto = require('crypto');
const fs = require('fs');
const { ipcMain } = require('electron');
const { attachmentBytes } = require('./crypt');
const { senderNote } = require('./ipc-common');
const { isLocked } = require('./locks');
const engine = require('./stt-engine');
const dl = require('./stt-download');
const { MODELS, STANDARD, bytesOf, findModel, installed, runOf, userDir } = require('./stt-models');
const { S } = require('./state');

const jobs = new Map(); // jobId -> { id, kind: 'live' | 'transcribe', win, ready, ended, queue }
const downloads = new Map(); // model id -> { ctl, pct }
const failed = new Map(); // model id -> true: the last download failed (Try again)
let testing = false;
let startError = null; // Best didn't start on this PC last time (Settings says so)
const watched = new WeakSet();
const newId = () => crypto.randomBytes(6).toString('hex');
const MB = 1048576;

const mayShow = (win) => {
  if (!win || win.isDestroyed()) return false;
  const n = S.store.get(win.noteId);
  return !!n && !n.deletedAt && (!isLocked(n) || !!win.revealed);
};
const settings = () => S.store.settings;
const tests = () => (settings().sttTests && typeof settings().sttTests === 'object' ? settings().sttTests : {});
const keyOf = (m, run) => `${m.id}/${run.name}`;
const verdictOf = (speed) => (!(speed > 0) ? null : speed >= 2 ? 'live' : speed >= 0.5 ? 'after' : 'slow');
function saveTest(m, run, speed, quick) {
  settings().sttTests = { ...tests(), [keyOf(m, run)]: { speed: Math.round(speed * 100) / 100, verdict: verdictOf(speed), quick: !!quick, at: Date.now() } };
  S.store.saveSettings();
}

// ------------------------------------------------------------------ the model for a job
let chain = Promise.resolve();
const serial = (fn) => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
const loadedJobs = () => [...jobs.values()].filter((j) => j.loaded && !j.ended);

function pick() {
  const want = findModel(settings().sttModel) || findModel(STANDARD);
  const run = installed(want);
  if (run) return { m: want, run, fallback: null };
  const std = findModel(STANDARD);
  const r = installed(std);
  return r ? { m: std, run: r, fallback: want.id === STANDARD ? null : 'missing' } : null;
}
function noteWebgpu(info) {
  if (info && typeof info.webgpu === 'boolean' && settings().sttWebgpu !== info.webgpu) { settings().sttWebgpu = info.webgpu; S.store.saveSettings(); }
}

function ensureModel() {
  return serial(async () => {
    const cur = engine.current();
    if (cur && loadedJobs().length) {
      const [id, rn] = cur.split('/');
      const m = findModel(id);
      return { m, run: runOf(m, rn), fallback: null };
    }
    let p = pick();
    if (!p) throw new Error('nomodel');
    try {
      const r = await engine.load(p.m, p.run);
      noteWebgpu(r.info);
      if (p.m.id !== STANDARD && startError) { startError = null; notifyStt(); }
    } catch (e) {
      if (p.m.id === STANDARD) throw e;
      console.error('voice to text: Best did not start', e);
      startError = String(e.message || e).slice(0, 200);
      notifyStt();
      const std = findModel(STANDARD);
      const run = installed(std);
      if (!run) throw e;
      await engine.load(std, run);
      p = { m: std, run, fallback: 'failed' };
    }
    // never measured on this PC: a quiet 2-second check now (it warms the model up too)
    if (!tests()[keyOf(p.m, p.run)]) {
      try { const s = await engine.call('speed', { seconds: 2 }, 120e3); if (s && s.speed) saveTest(p.m, p.run, s.speed, true); } catch (e) { console.error(e); }
    }
    return p;
  });
}
const modeOf = (p) => { const t = tests()[keyOf(p.m, p.run)]; return t && t.verdict && t.verdict !== 'live' ? 'after' : 'live'; };

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
    toWin(job, { type: 'ready', mode, fallback: p.fallback });
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
  engine.wire({ isBusy: () => jobs.size > 0 || testing });
  engine.onEvent((m) => { const job = jobs.get(m.jobId); if (job && m.e) toWin(job, m.e); });
  engine.onGone(() => { for (const j of [...jobs.values()]) { toWin(j, { type: 'error', message: 'failed' }); end(j, false); } });

  // ---- Speak to text (the note window)
  ipcMain.handle('stt:start', (e) => {
    const { win, note } = senderNote(e);
    if (!note || !mayShow(win)) return { error: 'locked' };
    if (testing) return { error: 'busy' };
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
    if (testing) return { error: 'busy' };
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
        const pm = await ensureModel();
        if (job.ended) return { cancelled: true };
        job.loaded = true;
        const r = await engine.call('transcribe', { jobId: id, bytes: new Uint8Array(bytes) });
        if (job.ended || !mayShow(win)) return { cancelled: true };
        return { text: String((r && r.text) || ''), fallback: pm.fallback };
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
  ipcMain.handle('stt:use', (e, id) => {
    if (findModel(id)) { settings().sttModel = id; S.store.saveSettings(); }
    return status();
  });
  ipcMain.handle('stt:download', (e, id) => {
    const m = findModel(id);
    if (!m || m.builtIn || installed(m) || downloads.has(m.id)) return status();
    const ctl = new AbortController();
    const d = { ctl, pct: 0, last: 0 };
    downloads.set(m.id, d);
    failed.delete(m.id);
    notifyStt();
    (async () => {
      // which set: the graphics card's if WebGPU works here (the engine page asks the GPU), else the processor's
      let webgpu = settings().sttWebgpu;
      try { const info = await engine.open(); noteWebgpu(info); webgpu = !!info.webgpu; } catch { webgpu = !!webgpu; }
      if (!jobs.size && !testing) engine.close(); // it was opened only to ask
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
    if (!m || m.builtIn) return status();
    if (jobs.size || testing || downloads.has(m.id)) return { ...status(), error: 'busy' };
    if (String(engine.current() || '').startsWith(m.id + '/')) engine.close();
    dl.remove(m);
    failed.delete(m.id);
    if (settings().sttModel === m.id) { settings().sttModel = STANDARD; S.store.saveSettings(); }
    for (const r of m.runs) delete tests()[keyOf(m, r)];
    S.store.saveSettings();
    return status();
  });
  // Test my computer: the bundled clip through every model on this PC
  ipcMain.handle('stt:test', async () => {
    if (testing || jobs.size) return { ...status(), error: 'busy' };
    testing = true;
    notifyStt();
    try {
      await serial(async () => {
        for (const m of MODELS) {
          const run = installed(m);
          if (!run) continue;
          try {
            const r = await engine.load(m, run);
            noteWebgpu(r.info);
            const s = await engine.call('speed', { seconds: 0 }, 5 * 60e3);
            if (s && s.speed) saveTest(m, run, s.speed, false);
          } catch (err) {
            console.error('voice to text: test failed', m.id, err);
            settings().sttTests = { ...tests(), [keyOf(m, run)]: { speed: 0, verdict: 'failed', at: Date.now() } };
            S.store.saveSettings();
            if (m.id !== STANDARD) startError = String(err.message || err).slice(0, 200);
          }
        }
      });
    } finally {
      testing = false;
      engine.touch();
      notifyStt();
    }
    return status();
  });
}

// ------------------------------------------------------------------ what Settings shows
function runFor(m, webgpu) { return m.runs.find((r) => !r.needs || (r.needs === 'webgpu' && webgpu)) || m.runs[m.runs.length - 1]; }
function status() {
  const s = settings();
  const webgpu = typeof s.sttWebgpu === 'boolean' ? s.sttWebgpu : null;
  return {
    selected: findModel(s.sttModel) ? s.sttModel : STANDARD,
    testing,
    startError,
    models: MODELS.map((m) => {
      const run = installed(m);
      const d = downloads.get(m.id);
      const next = run || runFor(m, !!webgpu);
      const t = run ? tests()[keyOf(m, run)] : null;
      return {
        id: m.id, level: m.level, name: m.name, builtIn: m.builtIn,
        state: run ? 'ready' : d ? 'downloading' : failed.has(m.id) ? 'failed' : m.builtIn ? 'missing' : 'none',
        pct: d ? d.pct : null,
        mb: Math.round(bytesOf(m, next) / MB),
        // not downloaded and WebGPU not known yet: the size is one of two
        mbMax: !run && webgpu === null && m.runs.length > 1 ? Math.round(Math.max(...m.runs.map((r) => bytesOf(m, r))) / MB) : null,
        device: next.device === 'webgpu' ? 'gpu' : 'cpu',
        test: t ? { verdict: t.verdict, speed: t.speed } : null,
      };
    }),
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
