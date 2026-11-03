'use strict';
// Records what the "All notes" window does, to prove a refactor of its code (src/list/) changed nothing. Not a test (npm test
// does not run it); needs Playwright (the cloud workspace has it; on a PC: npm i --no-save playwright && npx playwright install chromium).
// The real main.js (under tests/fake-electron, with a fixed clock, seeded random numbers and counted ids) answers the page
// through the real preload.js; the page runs in Chromium with Playwright's clock paused (only runFor moves it) and a seeded
// Math.random. The steps are in record-list-scenario.js (285: tabs, search, sort, sizes, groups and their panel, picking
// and the bar, right-click menus, Edit design, Settings, Effects, passwords, the Locked tab, drag & drop, the Bin, keys).
// After every step the log gets the DOM, every window.sticky call with its answer, messages from main, and page errors.
// Usage:  node tests/record/record-list.js <tree with src/list.html> <tree with main.js> <out.log> [coverage.json]
//         node tests/record/record-list.js compare <a.log> <b.log>   (ignores the page's own <script> tags; prints the first differences)
// Do this: record the old code twice (the two logs must be identical: if not, the recorder has a timing leak to fix first),
// then the new code (same main tree; use the old src/about.js too, or its new version entry shows up), and compare. Then
// break the new code on purpose a few times (forget a line, change a delay, keep a stale copy of a shared variable): each
// must change the log. ~5 minutes a run; several can run side by side.
// Traps found building it: faking Date / crypto / timers for the whole process also fakes them for Playwright (its ids collide,
// its timeouts never fire), so only calls from the app's folder get the fakes; Playwright's installed clock keeps flowing with
// real time unless paused; a handler that waits on main's own timer needs main's clock stepped while the page waits.
const fs = require('fs'); const os = require('os'); const path = require('path'); const realCrypto = require('crypto'); const Module = require('module');
if (process.argv[2] === 'compare') { compare(process.argv[3], process.argv[4]); process.exit(0); }
function compare(a, b) {
  const norm = (f) => require('fs').readFileSync(f, 'utf8').replace(/<!-- this window's own code[^>]*-->\\n/g, '').replace(/<script src=\\"list(\/[a-z-]+)?\.js\\"><\/script>(\\n)?/g, '').split('\n');
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

// ---- deterministic main process
let vnow = 0; const BASE = Date.UTC(2026, 9, 31, 8, 0, 0);
// only the app's own code (main.js, main/, store.js) sees the fake clock, random numbers and ids, not Playwright
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
realCrypto.randomBytes = (n, cb) => { if (!app() || cb) return realRB(n, cb); idc++; return Buffer.alloc(n, idc & 255); };
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmolist-'));
const appData = path.join(tmp, 'appdata'); fs.mkdirSync(appData, { recursive: true });
process.env.FAKE_APPDATA = appData; process.env.FAKE_DATA = path.join(appData, 'CosmoNotes');

// ---- log
const LOG = [];
const clean = (v) => JSON.stringify(v, (k, x) => (x === undefined ? '[undef]' : typeof x === 'string' ? x.split(tmp).join('<T>').split(pageTree).join('<TREE>').split(mainTree).join('<TREE>') : x));
const log = (tag, ...a) => LOG.push(`${tag}|${clean(a)}`);

// ---- fake electron + the real main.js and preload.js
const FAKE = path.join(mainTree, 'tests', 'fake-electron', 'index.js');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return FAKE; return origResolve.call(this, req, ...a); };
const E = require(FAKE);
global.Response = class { constructor(b, o) { this.status = o && o.status; } };
const rendererOn = {}; // channel -> [fn]
let exposed = null;
E.contextBridge.exposeInMainWorld = (name, api) => { exposed = api; };
let listWin = null;
E.ipcRenderer.invoke = async (ch, ...a) => { const f = E.__handlers[ch]; if (!f) throw new Error('no handler ' + ch); return f({ sender: listWin.webContents }, ...a); };
E.ipcRenderer.send = (ch, ...a) => { const f = E.__listeners[ch]; if (f) f({ sender: listWin.webContents }, ...a); };
E.ipcRenderer.sendSync = (ch, ...a) => { const ev = { sender: listWin.webContents, returnValue: undefined }; const f = E.__listeners[ch]; if (f) f(ev, ...a); return ev.returnValue; };
E.ipcRenderer.on = (ch, fn) => { (rendererOn[ch] = rendererOn[ch] || []).push(fn); };
E.dialog.showOpenDialog = async () => ({ canceled: true });
require(path.join(mainTree, 'main.js'));
require(path.join(mainTree, 'preload.js'));

(async () => {
  const D = (...a) => { if (process.env.DBG) console.log('setup', ...a); };
  D('start'); await advance(500);
  const H = E.__handlers; D('handlers', Object.keys(H).length);
  // ---- data: notes, groups (nested), favourites, colours, fonts, effects, checklist, a picture, locks, the Bin
  const ids = [];
  for (let i = 0; i < 14; i++) { const p = H['list:new']({}, null); await advance(50); await p; D('new', i); }
  let L0 = await H['list:get']();
  for (const n of L0.notes) ids.push(n.id);
  const texts = ['Shopping list', 'Call the plumber', 'Ideas for the garden', 'Birthday gifts', 'Book club', 'Recipes', 'Work todo', 'Passwords hint', 'Travel plans', 'Movies', 'Dentist Tuesday', 'Old note', 'Bin me', 'Bin me too'];
  const colors = ['yellow', 'pink', 'mint', 'blue', 'charcoal', 'lavender', 'night', 'orange', 'green', 'plum', 'cream', 'sage', 'rose', 'mist'];
  for (let i = 0; i < ids.length; i++) {
    const html = i === 0 ? '<ul class="checklist"><li class="done">milk</li><li>bread</li><li>eggs</li></ul>' : i === 3 ? `<div>${texts[i]} <img class="att-img" src="stickyfile://x/a.png" alt="A red bike"></div>` : `<div>${texts[i]}</div><div>line two of ${i}</div>`;
    await H['list:edit']({}, ids[i], { title: i % 3 === 0 ? texts[i] : '', color: colors[i] });
    const w = E.__all.find((x) => x.noteId === ids[i] && !x.destroyed);
    if (w && E.__handlers['note:update']) await E.__handlers['note:update']({ sender: w.webContents }, { html, text: html.replace(/<[^>]+>/g, ' ').trim(), font: i % 2 ? 'hand' : 'round' });
    await advance(30);
  }
  await H['groups:make']({}, ids[1], ids[2]); await advance(20);
  L0 = await H['list:get'](); const G1 = L0.notes.find((n) => n.id === ids[1]).groupId;
  await H['groups:make']({}, ids[4], G1); await H['groups:make']({}, ids[5], ids[6]); await advance(20);
  L0 = await H['list:get'](); const G2 = L0.notes.find((n) => n.id === ids[5]).groupId;
  await H['groups:move-to']({}, G2, G1); await H['groups:make']({}, ids[8], ids[9]); await advance(20);
  L0 = await H['list:get'](); const G3 = L0.notes.find((n) => n.id === ids[8]).groupId;
  await H['groups:rename']({}, G1, 'Home'); await H['groups:rename']({}, G2, 'Kitchen'); await H['groups:rename']({}, G3, 'Fun');
  await H['groups:update']({}, G1, { style: 'folder', color: 'lilac' }); await H['groups:update']({}, G3, { style: 'notebook', color: 'sky' });
  await H['list:favorite']({}, [ids[0], ids[3]], true); await H['list:favorite']({}, [G3], true);
  await H['list:apply']({}, [ids[0]], { fx: { e: 'snow' } }); await H['list:apply']({}, [ids[3]], { fx: { e: 'bubbles', f: 'sparkles' } });
  await H['lock:set']({}, { current: '', next: 'pw1234', kind: 'password' });
  await H['list:set-locked']({}, ids[7], true, 'pw1234');
  await H['list:set-locked']({}, ids[10], true, 'pw1234');
  await H['list:trash']({}, ids[12]); await H['list:trash']({}, ids[13]);
  await H['list:close-note']({}, ids[11]);
  await advance(3000);
  await H['list:show'](); await advance(100);
  listWin = E.__all.find((w) => w.file && w.file.endsWith('list.html') && !w.destroyed);
  const queued = [];
  listWin.webContents.send = (ch, ...a) => { queued.push([ch, a]); };
  log('data', { notes: (await H['list:get']()).notes.length });

  // ---- the page
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`CONSOLE ${m.type()} ${m.text()}`); });
  let calls = []; const cbs = []; let inflight = 0;
  await page.exposeBinding('__call', async (src, p, args) => {
    inflight++;
    try {
      let o = exposed; for (const k of p.split('.')) o = o[k];
      const a = args.map((x) => (x && x.__cb !== undefined ? ((...v) => { calls.push(`cb#${x.__cb}(${clean(v)})`); return page.evaluate(([id, v2]) => window.__fire(id, v2), [x.__cb, v]); }) : x));
      // the main process answers on its own fake clock: while it waits on a timer (the password delay…), step that
      // clock in small fixed steps, so the answer never depends on how fast this computer is
      let done = false; let r; let err;
      const pr = Promise.resolve().then(() => o(...a)).then((v) => { done = true; r = v; }, (e) => { done = true; err = e; });
      await flush();
      for (let k = 0; !done && k < 3000; k++) await advance(10);
      await pr; if (err) throw err;
      await flush();
      calls.push(`${p}(${clean(args)}) -> ${clean(r)}`);
      return r === undefined ? { __undef: 1 } : r;
    } catch (e) { calls.push(`${p}(${clean(args)}) THREW ${e.message}`); return { __undef: 1 }; } finally { inflight--; }
  });
  // CSS animations run on real time (a card wobbling in moves what is measured next to it): switch them off. No code of the
  // window waits on an animation or transition event, so this changes no code path.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.append(st); });
  });
  await page.addInitScript(() => {
    let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const cbs = []; window.__fire = (id, v) => cbs[id](...v);
    const mkApi = (p) => new Proxy(function () {}, {
      get: (t, k) => (typeof k === 'string' && k !== 'then' ? mkApi(p ? `${p}.${k}` : k) : undefined),
      apply: (t, self, args) => {
        const a = args.map((x) => (typeof x === 'function' ? (cbs.push(x), { __cb: cbs.length - 1 }) : x));
        window.__busy = (window.__busy || 0) + 1;
        const done = () => { const ch = new MessageChannel(); ch.port1.onmessage = () => { window.__busy--; }; ch.port2.postMessage(0); };
        return window.__call(p, a).then((r) => { done(); return r && r.__undef === 1 ? undefined : r; }, (e) => { done(); throw e; });
      },
    });
    window.sticky = mkApi('');
  });
  // the page's clock stands still (Playwright's installed clock otherwise keeps flowing with real time): only runFor moves it
  await page.clock.install({ time: BASE }); await page.clock.pauseAt(BASE + 1000);
  if (covFile) await page.coverage.startJSCoverage({ reportAnonymousFunctions: true, resetOnNavigation: false });
  await page.goto('file://' + path.join(pageTree, 'src', 'list.html'));

  // wait until no call to the app is running in the page, nor its answer still being handled
  const quiet = async () => { for (let k = 0; k < 2000; k++) { if (inflight === 0 && (await page.evaluate(() => window.__busy || 0)) === 0) return; await new Promise((r) => realSetTimeout(r, 3)); } calls.push('NOT QUIET'); };
  const settle = async () => {
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 12; i++) {
        await quiet();
        await page.clock.runFor(100);
      }
      await advance(1500);
      if (!queued.length) break;
      const q = queued.splice(0);
      for (const [ch, a] of q) { calls.push(`MAIN->LIST ${ch} ${clean(a)}`); for (const fn of rendererOn[ch] || []) fn({}, ...a); }
    }
    await quiet();
    // size and visibility observers report on real frames: give them two before looking
    await new Promise((r) => realSetTimeout(r, 80)); await page.clock.runFor(50); await quiet(); await new Promise((r) => realSetTimeout(r, 80));
  };
  let stepNo = 0;
  const snap = async (name) => {
    const dom = await page.evaluate(() => {
      const c = document.documentElement.cloneNode(true);
      return c.outerHTML;
    });
    const active = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}#${a.id}.${a.className}` : ''; });
    LOG.push(`STEP ${++stepNo} ${name}`);
    for (const c of calls) LOG.push('  CALL ' + c);
    for (const e of errors) LOG.push('  ' + e);
    LOG.push('  FOCUS ' + active);
    LOG.push('  DOM ' + JSON.stringify(dom.split(tmp).join('<T>')));
    calls = []; errors.length = 0;
  };
  const step = async (name, fn) => {
    if (process.env.DBG) console.log(new RealDate(realNow()).toISOString().slice(14, 23), 'step', name);
    try { await fn(); } catch (e) { errors.push('STEP-ERROR ' + String(e.message).split('\n')[0]); }
    await settle(); await snap(name);
  };
  const S = require(path.join(__dirname, 'record-list-scenario.js'));
  if (process.env.DBG) console.log('page loaded');
  await settle(); await snap('loaded');
  await S({ page, step, H, advance, ids, E });

  if (covFile) {
    const cov = await page.coverage.stopJSCoverage();
    fs.writeFileSync(covFile, JSON.stringify(cov.filter((c) => /src\/list(\/|\.js)/.test(c.url)).map((c) => ({ url: c.url, functions: c.functions, source: c.source }))));
  }
  await browser.close();
  fs.writeFileSync(outFile, LOG.join('\n') + '\n');
  console.log(`steps ${stepNo}, lines ${LOG.length}, page errors ${LOG.filter((l) => /^  (PAGEERROR|STEP-ERROR|CONSOLE)/.test(l)).length}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
