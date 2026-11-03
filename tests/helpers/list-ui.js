'use strict';
// Opens the real "All notes" window in Chromium, backed by the real main process, for tests of how the list behaves.
// main.js runs under tests/fake-electron in this process (through ./app.js: cheap PIN hashing, no pause after a wrong
// PIN); the page's window.sticky forwards every call through the real preload.js to main's handlers, and main's messages
// to the list window (notes:changed…) are passed on to the page. So a click in the page changes the real notes and
// groups, and a test can check both what the window shows and what main saved.
// Needs Playwright (the cloud workspace has it). Without it a test exits with 77 and tests/run.js shows it as SKIP.
//   const ui = await require('./helpers/list-ui')(async (seed) => { const a = await seed.note({ title: 'A' }); … });
//   await ui.click('#btnNew'); const data = await ui.get(); … await ui.done();
// Every action waits until the window is quiet again (see settle()). Events are sent straight to the elements (cards
// wobble, so Playwright's mouse would wait for them to stand still), and CSS animations are switched off.
const path = require('path');

let playwright;
try { playwright = require('playwright'); } catch { console.log('SKIP: Playwright is not installed (these tests run in the cloud workspace)'); process.exit(77); }
const app = require('./app');
const ROOT = app.ROOT;

// Main's own short timers (its 120 ms "something changed" for the list, …) run 10 times sooner and are counted, so
// settle() can wait for them instead of always waiting long enough. Only timers set up by main/*.js, of at most 400 ms
// (Playwright shares this process's timers: they are left alone).
const mainTimers = new Set();
{
  const st = global.setTimeout; const ct = global.clearTimeout;
  const MAIN = path.join(ROOT, 'main') + path.sep;
  global.setTimeout = (fn, ms, ...a) => {
    if (!(ms > 0 && ms <= 400) || !(new Error().stack || '').includes(MAIN)) return st(fn, ms, ...a);
    const t = st((...x) => { mainTimers.delete(t); fn(...x); }, ms / 10, ...a);
    mainTimers.add(t);
    return t;
  };
  global.clearTimeout = (t) => { mainTimers.delete(t); return ct(t); };
}

module.exports = async function openList(seedFn) {
  const E = app.E;
  const rendererOn = {}; let api = null; let listWin = null;
  E.contextBridge.exposeInMainWorld = (name, x) => { api = x; };
  const ev = () => ({ sender: listWin.webContents, returnValue: undefined });
  E.ipcRenderer.invoke = async (ch, ...a) => { const f = E.__handlers[ch]; if (!f) throw new Error('no handler for ' + ch); return f(ev(), ...a); };
  E.ipcRenderer.send = (ch, ...a) => { const f = E.__listeners[ch]; if (f) f(ev(), ...a); };
  E.ipcRenderer.sendSync = (ch, ...a) => { const e = ev(); const f = E.__listeners[ch]; if (f) f(e, ...a); return e.returnValue; };
  E.ipcRenderer.on = (ch, fn) => { (rendererOn[ch] = rendererOn[ch] || []).push(fn); };
  await app.start({ realTime: true }); // (real time: Playwright shares this process's timers)
  require(path.join(ROOT, 'preload.js'));
  const H = E.__handlers;
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- making test data through main (before the window opens)
  const ids = async () => new Set((await H['list:get']()).notes.map((n) => n.id));
  const gids = async () => new Set((await H['list:get']()).groups.map((g) => g.id));
  const fresh = async (before, now) => [...(await now())].find((x) => !before.has(x));
  const seed = {
    H, E,
    // a note: { title, html, color, font, group, favorite, open }  →  its id
    async note(o = {}) {
      const before = await ids();
      await H['list:new']({}, o.group || null);
      const id = await fresh(before, ids);
      const w = E.__all.find((x) => x.noteId === id && !x.destroyed);
      if (o.html !== undefined) await H['note:update']({ sender: w.webContents }, { html: o.html, text: o.text ?? o.html.replace(/<\/(li|div|p)>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n+$/, '') }); // text: one line per line, like the editor saves it
      const patch = {}; if (o.title) patch.title = o.title; if (o.color) patch.color = o.color;
      if (Object.keys(patch).length) await H['list:edit']({}, id, patch);
      if (o.font) await H['list:apply']({}, [id], { font: o.font });
      if (o.favorite) await H['list:favorite']({}, [id], true);
      if (!o.open) await H['list:close-note']({}, id);
      return id;
    },
    // a group made from notes (and groups): { name, parent, style, color, favorite }  →  its id
    async group(members, o = {}) {
      const before = await gids();
      await H['groups:make-from']({}, members, o.parent || null);
      const id = await fresh(before, gids);
      if (o.name) await H['groups:rename']({}, id, o.name);
      if (o.style || o.color) await H['groups:update']({}, id, { ...(o.style ? { style: o.style } : {}), ...(o.color ? { color: o.color } : {}) });
      if (o.favorite) await H['list:favorite']({}, [id], true);
      return id;
    },
    // (1.1.30: the first password sets up encryption and the list would show the recovery key; seeding skips that pop-up)
    password: async (pw = 'pw1234', kind = 'password') => { const r = await H['lock:set']({}, { current: '', next: pw, kind }); await H['crypt:key-saved'](); return r; },
    // lock a note or a group (a password must be set first: seed.password())
    lock: async (id, pw = 'pw1234') => ((await gids()).has(id) ? H['groups:set-locked']({}, id, true, pw) : H['list:set-locked']({}, id, true, pw)),
    bin: (id) => H['list:trash']({}, id),
    settings: (patch) => H['settings:set']({}, patch),
  };
  if (seedFn) await seedFn(seed);
  await H['list:show']();
  await tick(5);
  listWin = E.__all.find((w) => w.file && w.file.endsWith('list.html') && !w.destroyed);
  const queued = [];
  listWin.webContents.send = (ch, ...a) => { queued.push([ch, a]); };

  // ---- the page
  let browser;
  try { browser = await playwright.chromium.launch(); } catch (e) { console.log('SKIP: Chromium does not start here: ' + String(e.message).split('\n')[0]); process.exit(77); }
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, bypassCSP: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let inflight = 0;
  const calls = [];
  await page.exposeBinding('__call', async (src, p, args) => {
    inflight++;
    try {
      let o = api; for (const k of p.split('.')) o = o[k];
      const a = args.map((x) => (x && x.__cb !== undefined ? ((...v) => page.evaluate(([id, v2]) => window.__fire(id, v2), [x.__cb, v]).catch(() => {})) : x));
      calls.push(p);
      const r = await o(...a);
      return r === undefined ? { __undef: 1 } : r;
    } finally { inflight--; }
  });
  await page.addInitScript(() => {
    // the page's short timers (debounced saves, renames…) count as "still busy" until they have run
    const pend = new Set(); const st = window.setTimeout; const ct = window.clearTimeout;
    window.setTimeout = (fn, ms, ...a) => {
      if (!(ms <= 400) || typeof fn !== 'function') return st(fn, ms, ...a);
      const t = st((...x) => { pend.delete(t); fn(...x); }, ms, ...a); pend.add(t); return t;
    };
    window.clearTimeout = (t) => { pend.delete(t); return ct(t); };
    window.__pending = () => pend.size + (window.__busy || 0);
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.append(st); });
    const cbs = []; window.__fire = (id, v) => cbs[id](...v);
    const mk = (p) => new Proxy(function () {}, {
      get: (t, k) => (typeof k === 'string' && k !== 'then' ? mk(p ? `${p}.${k}` : k) : undefined),
      apply: (t, self, args) => {
        window.__busy = (window.__busy || 0) + 1;
        const done = () => { const ch = new MessageChannel(); ch.port1.onmessage = () => { window.__busy--; }; ch.port2.postMessage(0); };
        const a = args.map((x) => (typeof x === 'function' ? (cbs.push(x), { __cb: cbs.length - 1 }) : x));
        return window.__call(p, a).then((r) => { done(); return r && r.__undef === 1 ? undefined : r; }, (e) => { done(); throw e; });
      },
    });
    window.sticky = mk('');
  });
  await page.goto('file://' + path.join(ROOT, 'src', 'list.html'));

  const el = (sel) => page.locator(sel).first();
  const ui = {
    page, H, E, errors, calls,
    // main's data right now
    get: () => H['list:get'](),
    // Wait until the window has done what the last action started: no call to main still answering, no short timer
    // waiting in the page or in main, main's messages passed on, and still so one frame later. `extra` ms: wait that
    // long as well (pictures loading…), then settle again.
    async settle(extra = 0) {
      const t0 = Date.now(); let quiet = 0;
      while (quiet < 2 && Date.now() - t0 < 8000) {
        if (queued.length && inflight === 0) { for (const [ch, a] of queued.splice(0)) for (const fn of rendererOn[ch] || []) fn({}, ...a); quiet = 0; continue; }
        const busy = inflight || mainTimers.size || queued.length || (await page.evaluate(() => window.__pending()));
        if (busy) { quiet = 0; await tick(4); } else { quiet++; await tick(quiet === 1 ? 20 : 0); }
      }
      if (extra) { await tick(extra); await ui.settle(); }
    },
    // ---- actions (each waits for the window to settle afterwards)
    async click(sel, init = {}) { await el(sel).dispatchEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); await ui.settle(); },
    async down(sel, init = {}) { await el(sel).dispatchEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...init }); await ui.settle(); },
    async check(sel) { await el(sel).evaluate((x) => x.click()); await ui.settle(); },
    async type(sel, v) { await el(sel).evaluate((x, val) => { x.value = val; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }, v); await ui.settle(); },
    async key(k) { await page.keyboard.press(k); await ui.settle(); },
    async rclick(sel) {
      await el(sel).evaluate((x) => { const o = { bubbles: true, cancelable: true, button: 2, clientX: 300, clientY: 300 }; x.dispatchEvent(new MouseEvent('mousedown', o)); x.dispatchEvent(new MouseEvent('contextmenu', o)); });
      await ui.settle();
    },
    // the labels of the right-click menu that is open ('-' for a line)
    menuLabels: () => page.$$eval('#ctx > *', (xs) => xs.map((x) => (x.tagName === 'BUTTON' ? x.textContent.trim() : '-'))),
    async menu(sel, label) {
      await ui.rclick(sel);
      const item = page.locator('#ctx:not([hidden]) button', { hasText: label });
      if (!(await item.count())) throw new Error(`no menu item "${label}" (menu: ${(await ui.menuLabels()).join(' | ')})`);
      await item.first().dispatchEvent('click'); await ui.settle();
    },
    modalOpen: () => page.isVisible('#modal'),
    modalTitle: () => page.textContent('#mTitle'),
    async modalOk(values = []) {
      if (!(await ui.modalOpen())) throw new Error('no pop-up open');
      const ins = await page.$$('#mInputs input');
      for (let k = 0; k < values.length && k < ins.length; k++) await ins[k].evaluate((x, v) => { x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); }, values[k]);
      await ui.settle();
      // a PIN of the saved length goes in by itself (closed if right, cleared if wrong): then there is no OK to press.
      // Never press OK on a closed pop-up either (its form would reload the page).
      const went = values.length && ins.length && (await ins[0].inputValue()) !== values[0];
      if (!went && (await ui.modalOpen())) await ui.click('#mOk');
    },
    async modalCancel() { if (!(await ui.modalOpen())) throw new Error('no pop-up open'); await ui.click('#mCancel'); },
    async drag(from, to) {
      const a = await el(from).elementHandle(); const b = await el(to).elementHandle();
      await page.evaluate(([src, dst]) => {
        const dt = new DataTransfer(); const r = dst.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 10 };
        src.dispatchEvent(new DragEvent('dragstart', o));
        dst.dispatchEvent(new DragEvent('dragenter', o)); dst.dispatchEvent(new DragEvent('dragover', o)); dst.dispatchEvent(new DragEvent('drop', o));
        src.dispatchEvent(new DragEvent('dragend', o));
      }, [a, b]);
      await ui.settle(); await ui.settle();
    },
    // ---- reading the window
    text: (sel) => page.textContent(sel),
    visible: (sel) => page.isVisible(sel),
    count: (sel) => page.locator(sel).count(),
    // the cards shown, in order: "n:<id>" / "g:<id>"
    keys: (where = '#cards') => page.$$eval(`${where} > .card`, (cs) => cs.map((c) => c.dataset.key)),
    noteKey: (id) => `#cards [data-key="n:${id}"]`,
    groupKey: (id) => `#cards [data-key="g:${id}"]`,
    tab: (t) => ui.click(`.tab[data-tab="${t}"]`),
    async done() {
      await ui.settle();
      if (errors.length) throw new Error('errors in the page:\n' + errors.join('\n'));
      await browser.close();
    },
  };
  await ui.settle();
  return ui;
};
