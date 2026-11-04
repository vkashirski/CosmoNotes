// CosmoNotes voice to text (1.3.1): the engine page. A hidden window owned by main (main/stt-engine.js) runs
// Transformers.js here. It has no UI and no network: its page, the library, ONNX Runtime and the models all come from
// cosmomodel://engine/ (main serves only a fixed list of files), and main blocks every http(s)/ws request it makes.
// It talks only through window.engineBridge (src/engine/preload.js). Main sends one job at a time per kind; the model
// itself runs one piece at a time (asrLock), so a Transcribe can wait behind a live session's next piece.
// From the prototype (tools/stt-prototype/engine/engine.js, Step 1).
import { RATE, LiveSession, cleanText, joinTexts, splitAtPauses } from './engine-core.mjs';

const bridge = window.engineBridge;
const send = (m) => bridge.send(m);
const errText = (e) => String((e && (e.stack || e.message)) || e);
const log = (text, level = 'info') => send({ type: 'log', level, text });

addEventListener('securitypolicyviolation', (e) => log(`CSP ${e.disposition}: ${e.effectiveDirective || e.violatedDirective} ${e.blockedURI}`, 'error'));
addEventListener('error', (e) => log(`page error: ${e.message} (${e.filename}:${e.lineno})`, 'error'));
addEventListener('unhandledrejection', (e) => log(`unhandled: ${errText(e.reason)}`, 'error'));

// Audio arrives through two IPC hops and the context bridge: accept any array view.
const toF32 = (a) => (a instanceof Float32Array ? a : ArrayBuffer.isView(a) ? new Float32Array(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)) : Float32Array.from(a || []));

let T = null; // the Transformers.js module
let pipe = null;
let model = null; // { modelId, family, device }
const cancelled = new Set();
const lives = new Map(); // jobId -> LiveSession

// ------------------------------------------------------------------ start-up
async function probe() {
  const out = { isolated: self.crossOriginIsolated === true, cores: navigator.hardwareConcurrency, webgpu: false };
  if (navigator.gpu) {
    try {
      const a = await navigator.gpu.requestAdapter();
      if (a) { out.webgpu = true; const i = a.info || {}; out.adapter = [i.vendor, i.architecture].filter(Boolean).join(' '); }
    } catch (e) { out.webgpuError = errText(e); }
  }
  return out;
}

async function importLib() {
  if (T) return;
  T = await import('@huggingface/transformers');
  const env = T.env;
  env.allowRemoteModels = false; // never Hugging Face from here
  env.allowLocalModels = true;
  env.localModelPath = '/models/'; // -> cosmomodel://engine/models/<id>/...
  env.useBrowserCache = false;
  if ('useWasmCache' in env) env.useWasmCache = false;
  if ('useFSCache' in env) env.useFSCache = false;
  if ('useCustomCache' in env) env.useCustomCache = false;
  // belt and braces: anything Transformers.js fetches must be ours
  if ('fetch' in env) {
    env.fetch = (url, opts) => {
      const u = new URL(String(url), location.href);
      if (u.origin !== location.origin) { log(`refused fetch: ${u.href}`, 'error'); return Promise.reject(new Error(`Blocked: ${u.href}`)); }
      return fetch(u.href, opts);
    };
  }
  const onnx = env.backends && env.backends.onnx;
  if (onnx && onnx.wasm) {
    onnx.wasm.wasmPaths = `${location.origin}/lib/`; // not the jsDelivr CDN
    onnx.wasm.proxy = false;
  }
  if (T.LogLevel && 'logLevel' in env) env.logLevel = T.LogLevel.ERROR;
}

// ------------------------------------------------------------------ the model
let asrChain = Promise.resolve();
// one piece at a time through the model (a live session and a Transcribe share it)
function asrLock(fn) {
  const run = asrChain.then(fn, fn);
  asrChain = run.catch(() => {});
  return run;
}

async function load({ modelId, family, device, dtype }) {
  await importLib();
  if (model && model.modelId === modelId && model.device === device && pipe) return { loadMs: 0, same: true };
  if (device === 'webgpu' && !navigator.gpu) throw new Error('WebGPU is not available here.');
  if (pipe) { try { await pipe.dispose(); } catch { /* ignore */ } pipe = null; model = null; }
  const t0 = performance.now();
  pipe = await T.pipeline('automatic-speech-recognition', modelId, { device, dtype });
  model = { modelId, family, device };
  const w = T.env.backends && T.env.backends.onnx && T.env.backends.onnx.wasm;
  return { loadMs: Math.round(performance.now() - t0), threads: w ? w.numThreads ?? null : null };
}

function asr(pcm) {
  return asrLock(async () => {
    if (!pipe) throw new Error('No model loaded.');
    const opts = {};
    if (model.family === 'whisper' && pcm.length > 30 * RATE) { opts.chunk_length_s = 30; opts.stride_length_s = 5; }
    const out = await pipe(pcm, opts);
    return cleanText(Array.isArray(out) ? out.map((o) => o.text).join(' ') : out && out.text);
  });
}

// ------------------------------------------------------------------ audio files
async function decode(bytes) {
  const b = bytes;
  const buf = b instanceof ArrayBuffer ? b : ArrayBuffer.isView(b) ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : new Uint8Array(b || []).buffer;
  const ctx = new OfflineAudioContext(1, RATE, RATE); // decodeAudioData resamples to 16 kHz
  const ab = await ctx.decodeAudioData(buf);
  if (ab.numberOfChannels === 1) return ab.getChannelData(0);
  const out = new Float32Array(ab.length);
  for (let c = 0; c < ab.numberOfChannels; c++) {
    const d = ab.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / ab.numberOfChannels;
  }
  return out;
}
async function clip() {
  const r = await fetch('/test-clip.wav');
  if (!r.ok) throw new Error(`test clip: ${r.status}`);
  return decode(await r.arrayBuffer());
}

// Transcribe: the whole clip. Moonshine: pieces of at most 20 s cut at pauses (its cost grows with length).
// Whisper: one call; Transformers.js windows it (chunk_length_s / stride_length_s).
async function transcribe({ jobId, bytes }) {
  const pcm = await decode(bytes);
  const pieces = model.family === 'whisper' ? [{ start: 0, end: pcm.length }] : splitAtPauses(pcm, { maxSec: 20 });
  const texts = [];
  for (let i = 0; i < pieces.length; i++) {
    if (cancelled.has(jobId)) throw new Error('Cancelled');
    texts.push(await asr(pcm.subarray(pieces[i].start, pieces[i].end)));
    send({ type: 'event', jobId, e: { type: 'progress', pct: Math.round(((i + 1) / pieces.length) * 100) } });
  }
  return { text: joinTexts(texts), audioSec: pcm.length / RATE };
}

// How fast this model is on this PC (× real time): seconds of the bundled clip (all of it: Test my computer;
// 2 s: the quiet check the first time a model is used).
async function speed({ seconds }) {
  const pcm = await clip();
  const part = seconds ? pcm.subarray(0, Math.min(pcm.length, Math.round(seconds * RATE))) : pcm;
  await asr(part.subarray(0, Math.min(part.length, RATE))); // the first call is always slow (warm-up)
  const t0 = performance.now();
  await asr(part);
  const workSec = (performance.now() - t0) / 1000;
  return { audioSec: part.length / RATE, workSec, speed: workSec > 0 ? part.length / RATE / workSec : null };
}

// ------------------------------------------------------------------ messages from main
const handlers = {
  probe: () => probe(),
  load: (m) => load(m),
  speed: (m) => speed(m),
  async transcribe(m) { try { return await transcribe(m); } finally { cancelled.delete(m.jobId); } },
  cancel(m) { cancelled.add(m.jobId); return true; },
  'live-start'(m) {
    if (!pipe) throw new Error('No model loaded.');
    const job = m.jobId;
    lives.set(job, new LiveSession({ asr, emit: (e) => send({ type: 'event', jobId: job, e }), live: m.live !== false, now: () => performance.now() }));
    return true;
  },
  audio(m) {
    const s = lives.get(m.jobId);
    if (s) s.push(toF32(m.pcm), m.rms);
  },
  async 'live-stop'(m) {
    const s = lives.get(m.jobId);
    if (!s) return null;
    try { return await s.stop(); } finally { lives.delete(m.jobId); }
  },
  'live-cancel'(m) { const s = lives.get(m.jobId); if (s) { s.cancel(); lives.delete(m.jobId); } return true; },
};

bridge.onMessage(async (m) => {
  const h = m && handlers[m.type];
  if (!h) return;
  try {
    const data = await h(m);
    if (m.reqId) send({ type: 'reply', reqId: m.reqId, data });
  } catch (e) {
    if (m.reqId) send({ type: 'fail', reqId: m.reqId, message: errText(e) });
    else log(errText(e), 'error');
  }
});

send({ type: 'ready' });
