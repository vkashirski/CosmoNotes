'use strict';
// Voice to text (1.3.1): main's side with a stub engine (the test answers the engine window's messages), and the
// engine's plain logic (src/engine/engine-core.mjs) under Node. Speak to text: audio waits while the model loads, the
// text goes only to its own window, Stop finishes, one at a time, closing or locking ends it (nothing more is sent);
// Transcribe: only a clip of this note, closing ends it; one model (1.3.4): not downloaded = nothing starts, live on the
// graphics card, after Stop on the processor, a model that doesn't start = an error (no other model); the old model
// choice and Test my computer's results leave settings.json; cosmomodel:// serves only its fixed list (no "..", no
// unknown names) with COOP/COEP and a strict CSP, the engine's session allows nothing and blocks the internet; the
// download checks every hash against a local server, leaves no .part, Cancel leaves nothing, Remove; .part files left
// at start go.
// Recording side (clip kept or deleted, the marker, Undo, the Replace pop-up): note-ui.test.js.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const app = require('./helpers/app');

const ROOT = app.ROOT;
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cosmo-stt-'));

// ---- the stub engine: whatever window loads cosmomodel://engine/ gets these answers
const eng = { msgs: [], webgpu: false, failLoad: null, text: 'Hello there.', finals: ['Hello there.'], hold: null, wins: [] };
const E0 = app.E;
const load0 = E0.BrowserWindow.prototype.loadURL;
E0.BrowserWindow.prototype.loadURL = function (u) {
  load0.call(this, u);
  if (!String(u).startsWith('cosmomodel://engine/')) return;
  const win = this;
  eng.wins.push(win);
  const wc = win.webContents;
  const reply = (m) => setImmediate(() => { if (!win.destroyed) E0.__listeners['engine:msg']({ sender: wc }, m); });
  const send0 = wc.send.bind(wc);
  wc.send = (ch, m) => {
    send0(ch, m);
    if (ch !== 'engine:msg') return;
    eng.msgs.push(m);
    const ok = (data) => reply({ type: 'reply', reqId: m.reqId, data });
    const fail = (message) => reply({ type: 'fail', reqId: m.reqId, message });
    const event = (e) => reply({ type: 'event', jobId: m.jobId, e });
    if (m.type === 'probe') ok({ isolated: true, webgpu: eng.webgpu });
    else if (m.type === 'load') { if (eng.failLoad && m.modelId === eng.failLoad) fail('WebGPU broke'); else ok({ loadMs: 1 }); }
    else if (m.type === 'live-start') ok(true);
    else if (m.type === 'live-stop') { for (const t of eng.finals) event({ type: 'final', text: t }); event({ type: 'done' }); setTimeout(() => ok({ failed: false }), 5); }
    else if (m.type === 'transcribe') {
      event({ type: 'progress', pct: 50 });
      const go = () => ok({ text: eng.text });
      if (eng.hold) eng.hold = go; else setTimeout(go, 5);
    }
  };
  reply({ type: 'ready' });
};
const sent = (type) => eng.msgs.filter((m) => m.type === type);
const until = async (fn, what) => { for (let i = 0; i < 400; i++) { if (fn()) return; await app.tick(5); } throw new Error('waited too long for ' + what); };

// ---- the model "on this PC": files of the right sizes (only sizes are checked when it loads) and its ready.json
const models = require('../main/stt-models');
const BEST = models.findModel(models.MODEL);
assert.equal(BEST.id, 'whisper-small-en', 'one model: Whisper small.en');
assert.equal(models.MODELS.length, 1, 'no Standard (Moonshine) any more');
function fakeInstall(runName) {
  const dir = path.join(app.DATA, 'models', BEST.id);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const x of models.filesOf(BEST, models.runOf(BEST, runName))) {
    const p = path.join(dir, ...x.path.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '');
    fs.truncateSync(p, x.size); // sparse
  }
  fs.writeFileSync(path.join(dir, 'ready.json'), JSON.stringify({ run: runName }));
}
// settings from 1.3.1–1.3.3: the model choice and Test my computer's results
fs.mkdirSync(app.DATA, { recursive: true });
fs.writeFileSync(path.join(app.DATA, 'settings.json'), JSON.stringify({ sttModel: 'moonshine-base', sttTests: { 'moonshine-base/cpu': { speed: 3, verdict: 'live' } } }));

(async () => {
  // ---------------------------------------------------------------- the engine's logic under plain Node
  const core = await import(pathToFileURL(path.join(ROOT, 'src', 'engine', 'engine-core.mjs')).href);
  assert.equal(core.cleanText('  [BLANK_AUDIO] Hello (music) <|en|> there.  '), 'Hello there.', 'tags dropped, spaces trimmed');
  {
    // a live session: voice, a pause, voice, Stop. Live: drafts + one final per piece. After Stop (live: false): no
    // drafts, all the text at the end.
    const tone = (sec, amp) => Float32Array.from({ length: sec * 16000 }, (_, i) => amp * Math.sin(i / 7));
    const chunks = (pcm) => { const out = []; for (let i = 0; i < pcm.length; i += 4000) out.push(pcm.subarray(i, i + 4000)); return out; };
    const audio = [...chunks(tone(2, 0.001)), ...chunks(tone(2, 0.2)), ...chunks(tone(1, 0.001)), ...chunks(tone(2, 0.2))];
    for (const live of [true, false]) {
      const ev = [];
      let n = 0;
      const s = new core.LiveSession({ live, asr: async (pcm) => `piece ${++n} ${(pcm.length / 16000).toFixed(1)}`, emit: (e) => ev.push(e) });
      for (const c of audio) { s.push(c); await new Promise((r) => setImmediate(r)); }
      const sum = await s.stop();
      const finals = ev.filter((e) => e.type === 'final').map((e) => e.text);
      assert.equal(ev[ev.length - 1].type, 'done', 'it ends with done');
      assert.ok(!sum.failed && sum.pieces === 2, 'two pieces (a pause between)');
      if (live) {
        assert.equal(finals.length, 2, 'live: each piece is written when it ends');
        assert.ok(ev.some((e) => e.type === 'draft'), 'live: grey drafts while talking');
      } else {
        assert.equal(finals.length, 1, 'after you stop: one final with all the text');
        assert.ok(/piece \d .* piece \d/.test(finals[0]), 'both pieces in it');
        assert.ok(!ev.some((e) => e.type === 'draft' || (e.type === 'status' && e.state === 'behind')), 'after you stop: no drafts, no "behind"');
      }
    }
    // a model that fails: the session says so, and Stop reports it
    const ev = [];
    const s = new core.LiveSession({ asr: async () => { throw new Error('boom'); }, emit: (e) => ev.push(e) });
    for (const c of audio) s.push(c);
    const sum = await s.stop();
    assert.ok(sum.failed && ev.some((e) => e.type === 'error'), 'an engine error is reported');
    const pieces = core.splitAtPauses(Float32Array.from([...tone(3, 0.001), ...tone(30, 0.2), ...tone(1, 0.001)]), { maxSec: 20 });
    assert.ok(pieces.length === 2 && pieces.every((p) => p.end - p.start <= 20 * 16000), 'long audio: pieces of at most 20 s, silence left out');
  }

  // ---------------------------------------------------------------- main
  const { H, L, E, ev } = await app.start();
  const { S } = require('../main/state');
  const engine = require('../main/stt-engine');
  const dl = require('../main/stt-download');
  const set0 = app.readJSON('settings.json');
  assert.ok(!('sttModel' in set0) && !('sttTests' in set0), 'the old model choice and test results are gone from settings.json');

  // ---- cosmomodel://engine/: a fixed list
  const R = (u) => engine.route(u);
  assert.ok(R('cosmomodel://engine/').page && R('cosmomodel://engine/index.html').page, 'the page');
  for (const f of ['engine.mjs', 'engine-core.mjs']) assert.ok(fs.existsSync(R(`cosmomodel://engine/${f}`).file), f);
  for (const f of engine.LIB_FILES) assert.ok(fs.existsSync(R(`cosmomodel://engine/lib/${f}`).file), `lib/${f}`);
  const libOnDisk = [];
  const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), pre + e.name + '/'); else libOnDisk.push(pre + e.name); } };
  walk(path.join(ROOT, 'src', 'engine', 'lib'), '');
  assert.deepEqual(libOnDisk.filter((f) => !/^(README|LICENSES)/.test(f)).sort(), [...engine.LIB_FILES].sort(), 'src/engine/lib/ holds exactly the served files (+ README, LICENSES)');
  assert.equal(R('cosmomodel://engine/models/whisper-small-en/config.json'), null, 'not downloaded: nothing to serve');
  fakeInstall('gpu');
  assert.ok(R('cosmomodel://engine/models/whisper-small-en/onnx/encoder_model.onnx').file, 'a file of the installed model');
  for (const bad of [
    'cosmomodel://engine/lib/../main.js', 'cosmomodel://engine/lib/%2e%2e/%2e%2e/main.js', 'cosmomodel://engine/lib/x.js',
    'cosmomodel://engine/models/whisper-small-en/../../../settings.json', 'cosmomodel://engine/models/whisper-small-en/%2e%2e%2fconfig.json',
    'cosmomodel://engine/models/whisper-small-en/onnx/encoder_model_int8.onnx', // a file of the model, but not of the installed set
    'cosmomodel://engine/models/moonshine-base/config.json', 'cosmomodel://engine/test-clip.wav', // gone in 1.3.4
    'cosmomodel://engine/models/nope/config.json', 'cosmomodel://other/engine.js', 'cosmomodel://engine/engine.mjs?x=1',
    'cosmomodel://engine/preload.js', 'cosmomodel://engine/lib\\transformers.web.js', 'stickyfile://att/x.png', 'cosmomodel://engine/models/whisper-small-en/config.json%00',
  ]) assert.equal(R(bad), null, `refused: ${bad}`);
  {
    const res = await engine.handle({ url: 'cosmomodel://engine/', method: 'GET' });
    const hd = res.headers;
    assert.equal(hd['cross-origin-opener-policy'], 'same-origin');
    assert.equal(hd['cross-origin-embedder-policy'], 'require-corp');
    const csp = hd['content-security-policy'];
    const map = JSON.stringify(models.IMPORT_MAP);
    assert.ok(csp.includes(`'sha256-${crypto.createHash('sha256').update(map).digest('base64')}'`) && String(res.body).includes(map), 'the CSP allows the import map by its hash');
    assert.ok(!/unsafe-eval'|unsafe-inline'|blob:|https?:/.test(csp.replace("'wasm-unsafe-eval'", '')), 'no eval, inline script, blob: or web addresses');
    assert.equal((await engine.handle({ url: 'cosmomodel://engine/lib/nope.js', method: 'GET' })).status, 404);
    assert.equal((await engine.handle({ url: 'cosmomodel://engine/engine.mjs', method: 'POST' })).status, 404);
    assert.deepEqual(Object.keys(models.IMPORT_MAP.imports).sort(), ['@huggingface/transformers', 'onnxruntime-common', 'onnxruntime-web/webgpu'], 'a fixed import map');
  }

  // ---- notes with windows
  const a = await app.newNote({ html: '<div>a</div>' });
  const b = await app.newNote({ html: '<div>b</div>' });
  const wa = app.winOf(a);
  const wb = app.winOf(b);
  const stt = (w) => app.sent(w, 'stt:event');
  const pcm = () => new Float32Array(4000).fill(0.1);

  // ---- Speak to text: the engine starts on first use; audio waits while the model loads
  assert.equal(eng.wins.length, 0, 'no engine before the first use');
  const s1 = await H['stt:start'](ev(wa));
  assert.ok(s1.jobId, 'a job');
  L['stt:audio'](ev(wa), s1.jobId, pcm(), 0.1);
  L['stt:audio'](ev(wa), s1.jobId, pcm(), 0.1);
  await until(() => stt(wa).some((e) => e.type === 'ready'), 'ready');
  const ew = eng.wins[0];
  assert.ok(ew && ew.o.show === false && ew.o.webPreferences.sandbox && ew.o.webPreferences.contextIsolation && !ew.o.webPreferences.nodeIntegration, 'a hidden, sandboxed engine window');
  assert.ok(ew.o.webPreferences.preload.endsWith(path.join('src', 'engine', 'preload.js')), 'with its own small preload');
  const ld = sent('load')[0];
  assert.deepEqual([ld.modelId, ld.device], ['whisper-small-en', 'webgpu'], 'Whisper small.en on the graphics card');
  assert.equal(sent('speed').length, 0, 'no speed check (Test my computer is gone)');
  assert.equal(sent('live-start')[0].live, true);
  await until(() => sent('audio').length === 2, 'queued audio');
  assert.ok(sent('audio').every((m) => m.jobId === s1.jobId), 'the audio that came while it loaded went on, in order');
  assert.equal(stt(wa).find((e) => e.type === 'ready').mode, 'live', 'graphics card: live text');
  // the engine's session: no permissions, no internet
  const P = E.__partitions['cosmonotes-stt'];
  assert.ok(P && P.protocols.cosmomodel, 'cosmomodel:// only on the engine\'s own session');
  let allowed = null; P.perm(null, 'media', (v) => { allowed = v; }); assert.equal(allowed, false, 'no microphone or anything else');
  for (const [u, cancel] of [['https://huggingface.co/x', true], ['http://example.com', true], ['ws://x', true], ['file:///c:/x', true], ['cosmomodel://engine/engine.mjs', false]]) {
    let r = null; P.before({ url: u }, (x) => { r = x; }); assert.equal(r.cancel, cancel, `${u}: ${cancel ? 'blocked' : 'allowed'}`);
  }

  // one Speak to text at a time; Transcribe of another note is fine
  assert.deepEqual(await H['stt:start'](ev(wb)), { error: 'busy' }, 'another note: busy');
  // text goes only to its own window
  const bBefore = stt(wb).length;
  const st = await H['stt:stop'](ev(wa), s1.jobId);
  assert.deepEqual(st, { ok: true }, 'Stop finishes');
  const finals = stt(wa).filter((e) => e.type === 'final');
  assert.deepEqual(finals.map((e) => e.text), ['Hello there.'], 'the final text came before Stop answered');
  assert.equal(stt(wb).length, bBefore, 'nothing for the other window');
  assert.deepEqual(await H['stt:stop'](ev(wa), s1.jobId), { ok: false }, 'a finished job is gone');

  // ---- closing the window ends the job: nothing more is sent, the engine is told
  const s2 = await H['stt:start'](ev(wb));
  await until(() => stt(wb).some((e) => e.type === 'ready' && e.jobId === s2.jobId), 'ready b');
  assert.equal(sent('load').length, 1, 'the model loaded once');
  const closedJob = s2.jobId;
  wb.close();
  await app.tick(5);
  assert.ok(sent('live-cancel').some((m) => m.jobId === closedJob), 'closing the note cancels its job');
  const s3 = await H['stt:start'](ev(wa));
  assert.ok(s3.jobId, 'and the next one can start');

  // ---- locking the note: its audio is refused, the job ends, nothing more goes to the window
  await until(() => stt(wa).some((e) => e.type === 'ready' && e.jobId === s3.jobId), 'ready 3');
  await H['lock:set']({}, { current: '', next: '1234', kind: 'pin' });
  await H['crypt:key-saved']();
  await H['note:set-locked'](ev(wa), true);
  await H['note:relock'](ev(wa));
  const nA = stt(wa).length;
  L['stt:audio'](ev(wa), s3.jobId, pcm(), 0.1);
  await app.tick(5);
  assert.ok(sent('live-cancel').some((m) => m.jobId === s3.jobId), 'locked: the job ends');
  assert.equal(stt(wa).length, nA, 'and the hidden window gets nothing');
  assert.deepEqual(await H['stt:start'](ev(wa)), { error: 'locked' }, 'a hidden window can\'t start one');
  assert.deepEqual(await H['stt:transcribe'](ev(wa), 'stickyfile://att/x.webm', 'tr-1'), { error: 'locked' }, 'or transcribe');

  // ---- Transcribe: only a clip of this note
  const clip = S.store.saveAttachment(Buffer.from('fake webm'), 'webm');
  const other = S.store.saveAttachment(Buffer.from('other'), 'webm');
  const c = await app.newNote({ html: `<div><span class="voice" data-src="${clip}"></span></div>` });
  const wc = app.winOf(c);
  const t1 = await H['stt:transcribe'](ev(wc), clip, 'tr-1');
  assert.deepEqual(t1, { text: 'Hello there.' }, 'the text comes back to the window (it puts it in)');
  const tm = sent('transcribe').pop();
  assert.equal(Buffer.from(tm.bytes).toString(), 'fake webm', 'main read the clip and sent its bytes');
  assert.ok(app.sent(wc, 'stt:event').some((e) => e.jobId === 'tr-1' && e.type === 'progress' && e.pct === 50), 'progress');
  assert.deepEqual(await H['stt:transcribe'](ev(wc), other, 'tr-2'), { error: 'gone' }, 'a clip of another note: refused');
  assert.deepEqual(await H['stt:transcribe'](ev(wc), 'stickyfile://att/../settings.json', 'tr-3'), { error: 'gone' });
  assert.equal(S.store.get(c).html, `<div><span class="voice" data-src="${clip}"></span></div>`, 'main never writes the text into the note');
  // closing the window mid-way: cancelled, nothing comes back
  eng.hold = true;
  const p4 = H['stt:transcribe'](ev(wc), clip, 'tr-4');
  await until(() => typeof eng.hold === 'function', 'transcribe 4 running');
  wc.close();
  const go = eng.hold; eng.hold = null; go();
  assert.deepEqual(await p4, { cancelled: true }, 'closed: cancelled');
  assert.ok(sent('cancel').some((m) => m.jobId === 'tr-4'), 'the engine was told');

  // ---- the processor's set: the words appear when you stop
  fakeInstall('cpu');
  const d = await app.newNote({ html: '<div>d</div>' });
  const wd = app.winOf(d);
  const s6 = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s6.jobId), 'ready 6');
  assert.equal(app.sent(wd, 'stt:event').find((e) => e.jobId === s6.jobId).mode, 'after', 'processor: the words appear when you stop');
  assert.deepEqual([sent('load').pop().device, sent('live-start').pop().live], ['wasm', false]);
  assert.equal(app.sent(wd, 'stt:event').find((e) => e.jobId === s6.jobId).auto, true, 'picked by the PC (the window says why)');
  await H['stt:cancel'](ev(wd), s6.jobId);
  // Settings → "Words appear": the person's pick wins over the PC's
  { const r0 = await H['stt:status'](); assert.deepEqual([r0.when, r0.whenSet], ['stop', false], 'not set: by the PC (processor = when you stop)'); }
  assert.equal((await H['stt:when']({}, 'live')).when, 'live');
  await H['stt:when']({}, 'nonsense');
  assert.equal(app.readJSON('settings.json').sttWhen, 'live', 'saved; a wrong value is ignored');
  const s6b = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s6b.jobId), 'ready 6b');
  const r6b = app.sent(wd, 'stt:event').find((e) => e.jobId === s6b.jobId);
  assert.deepEqual([r6b.mode, r6b.auto, sent('live-start').pop().live], ['live', false, true], 'While you talk, on the processor too');
  await H['stt:cancel'](ev(wd), s6b.jobId);
  await H['stt:when']({}, 'stop');
  const s6c = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s6c.jobId), 'ready 6c');
  assert.equal(sent('live-start').pop().live, false, 'When you stop');
  await H['stt:cancel'](ev(wd), s6c.jobId);
  delete S.store.settings.sttWhen;

  // ---- not downloaded: nothing starts, the window is told
  fs.rmSync(path.join(app.DATA, 'models', BEST.id), { recursive: true, force: true });
  const nJobs = sent('live-start').length;
  assert.deepEqual(await H['stt:start'](ev(wd)), { error: 'nomodel' }, 'Speak to text: "isn\'t downloaded yet"');
  const e0 = await app.newNote({ html: `<div><span class="voice" data-src="${clip}"></span></div>` });
  assert.deepEqual(await H['stt:transcribe'](ev(app.winOf(e0)), clip, 'tr-5'), { error: 'nomodel' }, 'Transcribe too');
  assert.equal(sent('live-start').length, nJobs, 'no job reached the engine');
  assert.equal((await H['stt:status']()).model.state, 'none');
  fakeInstall('cpu');

  // ---- the engine goes away mid-job: the window hears it
  const s7 = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s7.jobId), 'ready 7');
  const ew2 = eng.wins[eng.wins.length - 1];
  ew2.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  await app.tick(5);
  assert.ok(app.sent(wd, 'stt:event').some((e) => e.jobId === s7.jobId && e.type === 'error'), 'an engine crash: the window is told (it keeps the recording)');
  assert.ok(ew2.destroyed, 'the engine window is gone; the next use starts a new one');

  // ---------------------------------------------------------------- the download, against a local server
  // (a small stand-in model: the same code, files with known hashes)
  const files = { 'config.json': '{"a":1}', 'tok.json': '{"t":2}', 'onnx/enc_gpu.onnx': 'GPU-ENC'.repeat(1000), 'onnx/enc_cpu.onnx': 'CPU-ENC'.repeat(900) };
  const meta = (p) => ({ path: p, size: Buffer.byteLength(files[p]), sha256: crypto.createHash('sha256').update(files[p]).digest('hex') });
  BEST.common = [meta('config.json'), meta('tok.json')];
  BEST.runs[0].files = [meta('onnx/enc_gpu.onnx')];
  BEST.runs[1].files = [meta('onnx/enc_cpu.onnx')];
  const served = [];
  let breakFile = null;
  let slow = false;
  const server = http.createServer((req, res) => {
    served.push(req.url);
    const m = req.url.match(/^\/onnx-community\/whisper-small\.en\/resolve\/482fb8ba081b6e906f92efe103622316b2a0cc69\/(.+)$/);
    const f = m && decodeURIComponent(m[1]);
    if (!f || !(f in files)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200);
    if (slow) { res.write(files[f].slice(0, 10)); return; } // never finishes (Cancel)
    res.end(f === breakFile ? '#' + files[f].slice(1) : files[f]); // the same size, other bytes
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  dl.setEndpoint(`http://127.0.0.1:${server.address().port}`);
  if (engine.isOpen()) engine.close();
  fs.rmSync(path.join(app.DATA, 'models', BEST.id), { recursive: true, force: true });
  const bestDir = path.join(DATA(), 'models', BEST.id);
  const statusOf = async () => (await H['stt:status']()).model;
  const waitState = async (want) => { let s; for (let i = 0; i < 400; i++) { s = await statusOf(); if (s.state === want) return s; await app.tick(5); } throw new Error(`download never got to ${want}: ${JSON.stringify(s)} served ${served.join(" ")}`); };
  const parts = () => { const out = []; const w = (x) => { if (!fs.existsSync(x)) return; for (const e of fs.readdirSync(x, { withFileTypes: true })) { if (e.isDirectory()) w(path.join(x, e.name)); else if (/\.(part|tmp)$/.test(e.name)) out.push(e.name); } }; w(bestDir); return out; };

  assert.equal((await statusOf()).state, 'none');
  assert.equal((await statusOf()).url, 'https://huggingface.co/onnx-community/whisper-small.en', 'the model\'s page, for Settings');
  // a wrong file: the download stops, nothing half-written stays, the good files are kept for Try again
  breakFile = 'tok.json';
  await H['stt:download']({}, BEST.id);
  assert.equal((await waitState('failed')).state, 'failed', 'a file with the wrong hash: failed');
  assert.deepEqual(parts(), [], 'no .part left');
  assert.ok(fs.existsSync(path.join(bestDir, 'config.json')) && !fs.existsSync(path.join(bestDir, 'tok.json')) && !fs.existsSync(path.join(bestDir, 'ready.json')), 'the good file kept, the bad one not, not ready');
  // Try again: only what is missing is fetched; no WebGPU here: the processor's set
  breakFile = null;
  served.length = 0;
  await H['stt:download']({}, BEST.id);
  const ready = await waitState('ready');
  assert.ok(!served.some((u) => u.endsWith('/config.json')), 'Try again goes on from there');
  assert.equal(JSON.parse(fs.readFileSync(path.join(bestDir, 'ready.json'), 'utf8')).run, 'cpu', 'no WebGPU: the processor\'s set (int8)');
  assert.ok(fs.existsSync(path.join(bestDir, 'onnx', 'enc_cpu.onnx')) && !fs.existsSync(path.join(bestDir, 'onnx', 'enc_gpu.onnx')));
  assert.equal(ready.device, 'cpu');
  assert.ok(served.every((u) => u.includes('/resolve/482fb8ba081b6e906f92efe103622316b2a0cc69/')), 'always the fixed commit');
  assert.ok(R(`cosmomodel://engine/models/${BEST.id}/onnx/enc_cpu.onnx`).file && !R(`cosmomodel://engine/models/${BEST.id}/onnx/enc_gpu.onnx`), 'the engine may read the downloaded set only');
  // it is used now
  const s8 = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s8.jobId), 'ready 8');
  assert.equal(sent('load').pop().modelId, BEST.id, 'the downloaded model is used');
  await H['stt:cancel'](ev(wd), s8.jobId);
  // Remove: the folder goes, and voice to text says it isn't downloaded
  const rm = await H['stt:remove']({}, BEST.id);
  assert.equal(rm.model.state, 'none');
  assert.ok(!fs.existsSync(bestDir), 'removed');
  assert.deepEqual(await H['stt:start'](ev(wd)), { error: 'nomodel' }, 'removed: nothing starts');
  // with WebGPU: the graphics card's set; Cancel leaves nothing behind
  eng.webgpu = true;
  slow = true;
  await H['stt:download']({}, BEST.id);
  await waitState('downloading');
  await app.tick(20);
  await H['stt:download-cancel']({}, BEST.id);
  await waitState('none');
  assert.ok(!fs.existsSync(bestDir), 'Cancel: nothing left');
  slow = false;
  await H['stt:download']({}, BEST.id);
  await waitState('ready');
  assert.equal(JSON.parse(fs.readFileSync(path.join(bestDir, 'ready.json'), 'utf8')).run, 'gpu', 'WebGPU works: the graphics card\'s set');
  assert.equal((await statusOf()).device, 'gpu', '"Runs on the graphics card"');
  // a model that doesn't start: an error for the window (it keeps the recording), and Settings says so
  eng.failLoad = BEST.id;
  const s9 = await H['stt:start'](ev(wd));
  await until(() => app.sent(wd, 'stt:event').some((e) => e.type === 'error' && e.jobId === s9.jobId), 'error 9');
  assert.ok(!app.sent(wd, 'stt:event').some((e) => e.type === 'ready' && e.jobId === s9.jobId), 'no other model instead');
  assert.ok((await H['stt:status']()).startError, 'Settings says so');
  eng.failLoad = null;
  // a .part left by a quit mid-download goes at the next start
  fs.writeFileSync(path.join(bestDir, 'onnx', 'x.onnx.part'), 'half');
  dl.cleanParts(path.join(DATA(), 'models'));
  assert.deepEqual(parts(), [], '.part files cleaned at start');
  assert.ok(fs.existsSync(path.join(bestDir, 'ready.json')), 'the finished model stays');
  // models are not in backups
  const bk = S.store.backupNow();
  assert.ok(!fs.readdirSync(path.join(DATA(), 'backups', bk)).some((f) => /models|onnx/.test(f)), 'not in backups');
  server.close();

  console.log('ok');
  fs.rmSync(tmp, { recursive: true, force: true });
  await app.quit();
})();
function DATA() { return app.DATA; }
