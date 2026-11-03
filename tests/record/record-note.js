'use strict';
// Records what a note window does, to prove a refactor of its code (src/note/) changed nothing. Not a test (npm test does
// not run it); needs Playwright (the cloud workspace has it; on a PC: npm i --no-save playwright && npx playwright install chromium).
// Built in 1.1.44 from record-list.js (same idea): the real main.js (under tests/fake-electron, with a fixed clock, seeded
// random numbers and counted ids) answers the page through the real preload.js; the page runs in Chromium with Playwright's
// clock paused (only runFor moves it), a seeded Math.random and a stand-in microphone / audio player. The steps are in
// record-note-scenario.js: three windows one after the other (a new empty note that also sets the password, a full note,
// a locked note).
// After every step the log gets the DOM of the note and of its toolbar windows, every window.sticky call with its answer,
// messages from main, and page errors.
// Usage:  node tests/record/record-note.js <tree with src/note.html> <tree with main.js> <out.log> [coverage.json]
//         node tests/record/record-note.js compare <a.log> <b.log>   (ignores the page's own <script> tags; prints the first differences)
// Do this: record the old code twice (the two logs must be identical), then the new code (same main tree), and compare. Then
// break the new code on purpose a few times: each must change the log.
const fs = require('fs'); const os = require('os'); const path = require('path'); const realCrypto = require('crypto'); const Module = require('module');
const zlib = require('zlib');
if (process.argv[2] === 'compare') { compare(process.argv[3], process.argv[4]); process.exit(0); }
function compare(a, b) {
  // the page's own script tags (old: note.js; new: the parts) are the last thing before </body>: left out
  const norm = (f) => fs.readFileSync(f, 'utf8').replace(/(<script src=\\"fx\/engine\.js\\"><\/script>).*?(<\/body>)/g, '$1$2').split('\n');
  const A = norm(a); const B = norm(b); let step = '?'; let shown = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] && A[i].startsWith('STEP')) step = A[i];
    if (A[i] === B[i]) continue;
    if (++shown > 5) break;
    let k = 0; const x = A[i] || ''; const y = B[i] || ''; while (k < x.length && x[k] === y[k]) k++;
    console.log(`line ${i + 1} in ${step}\n  A: ${x.slice(Math.max(0, k - 120), k + 120)}\n  B: ${y.slice(Math.max(0, k - 120), k + 120)}`);
  }
  console.log(shown ? 'DIFFERENT' : `IDENTICAL (${A.length} lines)`);
}
const [pageTree, mainTree, outFile, covFile] = process.argv.slice(2).map((x) => x && path.resolve(x));
const realSI = setImmediate; const realSetTimeout = setTimeout;

// ---- deterministic main process (only the app's own code sees the fakes, not Playwright)
let vnow = 0; const BASE = Date.UTC(2026, 9, 31, 8, 0, 0);
Error.stackTraceLimit = 50;
const app = () => new Error().stack.includes(mainTree + path.sep);
const RealDate = Date; const realNow = Date.now;
class FakeDate extends RealDate { constructor(...a) { if (a.length || !app()) super(...a); else super(BASE + vnow); } static now() { return app() ? BASE + vnow : realNow(); } }
global.Date = FakeDate;
const realRandom = Math.random;
let seed = 12345; Math.random = () => { if (!app()) return realRandom(); seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let idc = 0;
const realUUID = realCrypto.randomUUID; const realRB = realCrypto.randomBytes;
realCrypto.randomUUID = (...a) => { if (!app()) return realUUID(...a); idc++; return `00000000-0000-4000-8000-${String(idc).padStart(12, '0')}`; };
// one counter per size: attachment names (5 bytes) then follow the order the page saves them in, whatever else (locked
// notes' encryption, 12 / 16 bytes, on saves whose number can vary) drew in between
const rbc = {};
realCrypto.randomBytes = (n, cb) => { if (!app() || cb) return realRB(n, cb); rbc[n] = (rbc[n] || 0) + 1; return Buffer.alloc(n, rbc[n] & 255); };
const timers = new Map(); let tseq = 0;
const mk = (fn, ms, rep, a) => { const id = ++tseq; const t = { id, at: vnow + Math.max(1, Number(ms) || 1), fn, a, rep: rep ? Math.max(1, Number(ms) || 1) : 0, unref() { return t; }, ref() { return t; }, hasRef() { return true; }, [Symbol.toPrimitive]() { return id; } }; timers.set(id, t); return t; };
const realST = setTimeout; const realSI2 = setInterval; const realCT = clearTimeout; const realCI = clearInterval;
global.setTimeout = (fn, ms, ...a) => (app() ? mk(fn, ms, false, a) : realST(fn, ms, ...a));
global.setInterval = (fn, ms, ...a) => (app() ? mk(fn, ms, true, a) : realSI2(fn, ms, ...a));
global.clearTimeout = (t) => { if (t && t.id && timers.has(t.id) && t.fn) timers.delete(t.id); else realCT(t); };
global.clearInterval = (t) => { if (t && t.id && timers.has(t.id) && t.fn) timers.delete(t.id); else realCI(t); };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => realSI(r)); };
const advance = async (ms) => {
  const target = vnow + ms;
  for (;;) {
    let next = null; for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
    if (!next) break;
    vnow = Math.max(vnow, next.at);
    if (next.rep) next.at = vnow + next.rep; else timers.delete(next.id);
    try { next.fn(...next.a); } catch (e) { log('MAIN-TIMER-ERROR', String(e && e.message)); }
    await flush();
  }
  vnow = target; await flush();
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmonote-'));
const appData = path.join(tmp, 'appdata'); fs.mkdirSync(appData, { recursive: true });
process.env.FAKE_APPDATA = appData; process.env.FAKE_DATA = path.join(appData, 'CosmoNotes');

// ---- log
const LOG = [];
const clean = (v) => JSON.stringify(v, (k, x) => (x === undefined ? '[undef]' : x instanceof Uint8Array || (x && x.type === 'Buffer') ? `[bytes]` : typeof x === 'string' ? x.split(tmp).join('<T>').split(pageTree).join('<TREE>').split(mainTree).join('<TREE>') : x));
const log = (tag, ...a) => LOG.push(`${tag}|${clean(a)}`);

// ---- a small picture (data: URL, so it loads without the app's own file scheme)
function png(w, h) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 200; raw[o + 1] = (x * 5) & 255; raw[o + 2] = (y * 7) & 255; }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

// ---- fake electron + the real main.js and preload.js
const FAKE = path.join(mainTree, 'tests', 'fake-electron', 'index.js');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return FAKE; return origResolve.call(this, req, ...a); };
const E = require(FAKE);
global.Response = class { constructor(b, o) { this.status = o && o.status; } };
let rendererOn = {}; // channel -> [fn]
let exposed = null;
E.contextBridge.exposeInMainWorld = (name, api) => { exposed = api; };
let cur = null; // the note window being recorded
E.ipcRenderer.invoke = async (ch, ...a) => { const f = E.__handlers[ch]; if (!f) throw new Error('no handler ' + ch); return f({ sender: cur.webContents }, ...a); };
E.ipcRenderer.send = (ch, ...a) => { const f = E.__listeners[ch]; if (f) f({ sender: cur.webContents }, ...a); };
E.ipcRenderer.sendSync = (ch, ...a) => { const ev = { sender: cur.webContents, returnValue: undefined }; const f = E.__listeners[ch]; if (f) f(ev, ...a); return ev.returnValue; };
E.ipcRenderer.on = (ch, fn) => { (rendererOn[ch] = rendererOn[ch] || []).push(fn); };
E.dialog.showOpenDialog = async () => ({ canceled: true });
require(path.join(mainTree, 'main.js'));
require(path.join(mainTree, 'preload.js'));

(async () => {
  await advance(500);
  const H = E.__handlers;
  const winOf = (id) => E.__all.find((x) => x.noteId === id && !x.destroyed);
  const as = (id) => ({ sender: winOf(id).webContents });
  const PIC = png(60, 40);
  // ---- data: three notes. A: everything in it; B: locked (after C has set the password); C: new and empty (focus on load)
  const ids = [];
  for (let i = 0; i < 2; i++) { const p = H['list:new']({}, null); await advance(50); await p; }
  for (const n of (await H['list:get']()).notes) ids.push(n.id);
  const [A, B] = ids;
  const htmlA = '<div>Shopping for the <b>weekend</b> and <i>more</i> words here</div>'
    + '<ul class="checklist"><li class="done">milk</li><li>bread</li><li>eggs and butter</li></ul>'
    + '<div>See <a href="https://example.com/">the shop</a> for prices.</div>'
    + `<div><img class="att-img" src="${PIC}" alt="A red bike"></div>`
    + '<table><tbody><tr><td>one</td><td>two</td></tr><tr><td>three</td><td>four</td></tr></tbody></table>'
    + '<div>Voice: <span class="voice" contenteditable="false" data-src="stickyfile://x/v.webm" data-dur="4"><span class="v-play"></span><span class="v-bars"><i class="h1"></i><i class="h3"></i><i class="h2"></i><i class="h5"></i></span><span class="v-time">0:04</span></span>&nbsp;</div>'
    + '<ol><li>first</li><li>second</li></ol><div>The end of the weekend list.</div>';
  await H['note:update'](as(A), { title: 'Weekend', html: htmlA, text: 'Shopping weekend milk bread eggs', font: 'hand', color: 'mint' });
  await H['note:update'](as(A), { ink: { s: [{ t: 'pen', c: '#E5484D', w: 4, l: 'a', p: [20, 20, 40, 30, 60, 25, 80, 40] }, { t: 'rect', c: '#3E7BFA', w: 2, l: 'b', d: 'dash', p: [30, 60, 120, 110] }] } });
  await H['list:apply']({}, [A], { fx: { e: 'snow', f: 'sparkles' } });
  await H['note:update'](as(B), { title: 'Secret', html: '<div>The secret words are here</div><div>and a second line</div>', text: 'The secret words', color: 'pink' });
  await advance(3000);
  log('data', { notes: (await H['list:get']()).notes.length });

  // ---- the browser
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const S = require(process.env.SCENARIO ? path.resolve(process.env.SCENARIO) : path.join(__dirname, 'record-note-scenario.js'));
  let stepNo = 0; const covs = [];

  async function session(name, win, run) {
    cur = win; rendererOn = {};
    const queued = [];
    const origSend = win.webContents.send.bind(win.webContents);
    win.webContents.send = (ch, ...a) => { origSend(ch, ...a); queued.push([ch, a]); };
    const b = win.getBounds();
    const ctx = await browser.newContext({ viewport: { width: b.width, height: b.height }, bypassCSP: true });
    const errors = [];
    const watch = (pg, tag) => {
      pg.on('pageerror', (e) => errors.push(`PAGEERROR ${tag} ${e.message}`));
      // "Failed to load resource": the fonts (node_modules is not in the workspace copy) and the app's own file scheme,
      // which Chromium doesn't know. They arrive whenever the browser gets to them, so they are left out of the log.
      pg.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/^Failed to load resource/.test(m.text())) errors.push(`CONSOLE ${tag} ${m.type()} ${m.text()}`); });
    };
    let page = null;
    ctx.on('page', (pg) => { if (page && pg !== page) watch(pg, 'popup'); });
    let calls = []; let inflight = 0; let curLabel = '';
    // CSS animations run on real time: off. No code of the window waits on an animation or transition event.
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.append(st); });
    });
    page = await ctx.newPage(); watch(page, 'note');
    await page.exposeBinding('__call', async (src, p, args) => {
      inflight++;
      try {
        let o = exposed; for (const k of p.split('.')) o = o[k];
        const a = args.map((x) => (x && x.__cb !== undefined ? ((...v) => { calls.push(`cb#${x.__cb}(${clean(v)})`); return page.evaluate(([id, v2]) => window.__fire(id, v2), [x.__cb, v]); }) : x && x.__bytes ? Uint8Array.from(x.__bytes) : x));
        // main answers on its own fake clock. While this call waits on a timer it started itself (the wrong-password
        // delay…), step that clock in fixed 10 ms steps; while it waits on real work (scrypt checking a password takes
        // real time), wait in real time. So the answer never depends on how fast this computer is.
        let done = false; let r; let err; const from = tseq;
        const pr = Promise.resolve().then(() => o(...a)).then((v) => { done = true; r = v; }, (e) => { done = true; err = e; });
        await flush();
        for (let k = 0; !done && k < 60000; k++) {
          if ([...timers.values()].some((t) => t.id > from && !t.rep)) await advance(10);
          else await new Promise((res) => realSetTimeout(res, 2));
        }
        await pr; if (err) throw err;
        await flush();
        // hover(true/false) comes from the mouse entering or leaving the page, and Chromium sends those whenever the page
        // moves under a still mouse (real time): logged only in the steps that do it on purpose
        if (p !== 'hover' || /^hover/.test(curLabel)) calls.push(`${p}(${clean(args)}) -> ${clean(r)}`);
        return r === undefined ? { __undef: 1 } : r;
      } catch (e) { calls.push(`${p}(${clean(args)}) THREW ${e.message}`); return { __undef: 1 }; } finally { inflight--; }
    });
    await page.addInitScript(() => {
      let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const cbs = []; window.__fire = (id, v) => cbs[id](...v);
      window.__syncCalls = [];
      const mkApi = (p) => new Proxy(function () {}, {
        get: (t, k) => (typeof k === 'string' && k !== 'then' ? mkApi(p ? `${p}.${k}` : k) : undefined),
        apply: (t, self, args) => {
          const a = args.map((x) => (typeof x === 'function' ? (cbs.push(x), { __cb: cbs.length - 1 }) : x instanceof Uint8Array ? { __bytes: [...x] } : x));
          if (p === 'updateSync') { window.__syncCalls.push(JSON.stringify(args[0])); } // answered by nothing (the page ignores it)
          window.__busy = (window.__busy || 0) + 1;
          const done = () => { const ch = new MessageChannel(); ch.port1.onmessage = () => { window.__busy--; }; ch.port2.postMessage(0); };
          const pr = window.__call(p, a).then((r) => { done(); return r && r.__undef === 1 ? undefined : r; }, (e) => { done(); throw e; });
          return p === 'updateSync' || p === 'hover' || p.startsWith('ink.') && p !== 'ink.drop' ? undefined : pr;
        },
      });
      window.sticky = mkApi('');
      // a stand-in microphone and audio player: the same every run
      navigator.mediaDevices && (navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] }));
      window.MediaRecorder = class { static isTypeSupported(t) { return t === 'audio/webm'; } constructor() { this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; setTimeout(() => { if (this.ondataavailable) this.ondataavailable({ data: new Blob(['voice']) }); if (this.onstop) this.onstop(); }, 0); } };
      window.Audio = class { constructor(src) { this.src = src; this.currentTime = 0; this.duration = 4; } play() { return Promise.resolve(); } pause() {} };
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {}, write: async () => {}, readText: async () => '' }, configurable: true }); } catch {}
    });
    await page.clock.install({ time: BASE }); await page.clock.pauseAt(BASE + 1000);
    if (covFile) await page.coverage.startJSCoverage({ reportAnonymousFunctions: true, resetOnNavigation: false });
    await page.goto('file://' + path.join(pageTree, 'src', 'note.html'));

    const quiet = async () => { for (let k = 0; k < 20000; k++) { if (inflight === 0 && (await page.evaluate(() => window.__busy || 0)) === 0) return; await new Promise((r) => realSetTimeout(r, 3)); } calls.push('NOT QUIET'); };
    const settle = async () => {
      for (let round = 0; round < 6; round++) {
        for (let i = 0; i < 12; i++) { await quiet(); await page.clock.runFor(100); }
        await advance(1500);
        if (!queued.length) break;
        const q = queued.splice(0);
        for (const [ch, a] of q) { calls.push(`MAIN->NOTE ${ch} ${clean(a)}`); for (const fn of rendererOn[ch] || []) fn({}, ...a); }
      }
      await quiet();
      await new Promise((r) => realSetTimeout(r, 80)); await page.clock.runFor(50); await quiet(); await new Promise((r) => realSetTimeout(r, 80));
    };
    const snap = async (label) => {
      const pages = ctx.pages();
      LOG.push(`STEP ${++stepNo} ${name}: ${label}`);
      for (const c of calls) LOG.push('  CALL ' + c);
      const sync = await page.evaluate(() => window.__syncCalls.splice(0)).catch(() => []);
      for (const s of sync) LOG.push('  SYNC ' + s);
      for (const e of errors) LOG.push('  ' + e);
      for (let k = 0; k < pages.length; k++) {
        const pg = pages[k];
        // attributes in name order: their order only says which was set first, and that can depend on when the
        // toolbar windows' styles finished loading (real time)
        const dom = await pg.evaluate(() => {
          const c = document.documentElement.cloneNode(true);
          for (const el of [c, ...c.querySelectorAll('*')]) {
            const at = [...el.attributes].map((x) => [x.name, x.value]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
            for (const [n] of at) el.removeAttribute(n);
            for (const [n, v] of at) el.setAttribute(n, v);
          }
          return c.outerHTML;
        }).catch((e) => 'CLOSED');
        const active = k ? '' : await pg.evaluate(() => { const a = document.activeElement; const s = getSelection(); return `${a ? `${a.tagName}#${a.id}.${a.className}` : ''} sel=${s.rangeCount ? `${s.anchorNode && s.anchorNode.nodeName}:${s.anchorOffset}/${s.focusNode && s.focusNode.nodeName}:${s.focusOffset}` : '-'}`; }).catch(() => '');
        if (!k) LOG.push('  FOCUS ' + active);
        LOG.push(`  DOM${k ? ' popup' + k : ''} ` + JSON.stringify(dom.split(tmp).join('<T>').split(pageTree).join('<TREE>')));
      }
      calls = []; errors.length = 0;
    };
    const step = async (label, fn) => {
      curLabel = label;
      if (process.env.DBG) console.log(new RealDate(realNow()).toISOString().slice(14, 23), 'step', name, label);
      try { await fn(); } catch (e) { errors.push('STEP-ERROR ' + String(e.message).split('\n')[0]); }
      if (process.env.DBG) console.log('  ran');
      await settle(); if (process.env.DBG) console.log('  settled'); await snap(label);
    };
    await settle(); await snap('loaded');
    await run({ page, step, H, advance, ids, E, win, ctx, as, PIC });
    await step('the window closes (beforeunload)', () => page.evaluate(() => window.dispatchEvent(new Event('beforeunload'))));
    if (covFile) covs.push(...(await page.coverage.stopJSCoverage()).filter((c) => /src\/note(\/|\.js)/.test(c.url)).map((c) => ({ url: c.url, functions: c.functions, source: c.source })));
    await ctx.close();
    win.webContents.send = origSend;
  }

  const only = process.env.ONLY || 'CAB'; // for trying out a scenario
  // C: a new note, opened with the focus in it; it sets the password (abc123)
  const before = new Set(E.__all.map((w) => w.id));
  const p = H['list:new']({}, null); await advance(50); await p; await advance(500);
  const wc = E.__all.find((w) => !before.has(w.id) && w.noteId && !w.destroyed);
  wc.focusOnLoad = true;
  if (only.includes('C')) await session('C', wc, S.fresh);
  else await H['lock:set']({}, { current: '', next: 'abc123', kind: 'password' });
  await H['list:set-locked']({}, B, true, 'abc123'); await advance(3000);
  if (only.includes('A')) await session('A', winOf(A), S.full);
  if (only.includes('B')) await session('B', winOf(B), S.locked);

  if (covFile) fs.writeFileSync(covFile, JSON.stringify(covs));
  await browser.close();
  // attachment names end in random bytes, and how many random numbers main has drawn by then can differ from run to
  // run (the fake only answers calls it can see came from the app, and after an await that isn't always visible):
  // number them in the order they first show up
  const seen = new Map();
  const text = (LOG.join('\n') + '\n').replace(/stickyfile:\/\/att\/([a-z0-9]+-[0-9a-f]+)\.(\w+)/g, (m, n, e) => { if (!seen.has(n)) seen.set(n, seen.size + 1); return `stickyfile://att/<att${seen.get(n)}>.${e}`; });
  fs.writeFileSync(outFile, text);
  console.log(`steps ${stepNo}, lines ${LOG.length}, page errors ${LOG.filter((l) => /^  (PAGEERROR|STEP-ERROR|CONSOLE)/.test(l)).length}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
