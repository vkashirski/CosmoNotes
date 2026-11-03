'use strict';
// Records what main.js does under the fake Electron. Not a test (npm test does not run it): used to prove a refactor of the
// main process changed nothing. Run it on the folder before and after and compare the two files (they must be identical).
// Usage:  node tests/record/record-main.js <folder with main.js> <mode> <out.log> [data folder to reuse for 'restart']
// Do this: `fresh` on the old code, copy its data folder (path in <out.log>.data.json) somewhere, run `migrate`, and
// `restart <that copy>`; repeat on the new code with the same copy; `cmp` the three pairs. Run the old code twice first.
// modes: fresh (full scenario), migrate (old "Sticky Pins" folder), restart (open notes from a previous run, --startup)
// Everything non-deterministic is replaced: clock, timers, Math.random, crypto ids. Old and new must give the same file.
const fs = require('fs'); const os = require('os'); const path = require('path'); const realCrypto = require('crypto'); const Module = require('module');
const tree = path.resolve(process.argv[2]); const mode = process.argv[3]; const outFile = process.argv[4]; const reuse = process.argv[5];
const realSI = setImmediate; const realSetTimeout = setTimeout;

// ---- deterministic world
let vnow = 0; const BASE = Date.UTC(2026, 9, 31, 8, 0, 0);
const RealDate = Date;
class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(BASE + vnow); } static now() { return BASE + vnow; } }
global.Date = FakeDate;
let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let idc = 0;
realCrypto.randomUUID = () => { idc++; return `00000000-0000-4000-8000-${String(idc).padStart(12, '0')}`; };
const rb = realCrypto.randomBytes; realCrypto.randomBytes = (n) => { idc++; return Buffer.alloc(n, idc & 255); };
const timers = new Map(); let tseq = 0;
const mk = (fn, ms, rep, a) => { const id = ++tseq; const t = { id, at: vnow + Math.max(1, Number(ms) || 1), fn, a, rep: rep ? Math.max(1, Number(ms) || 1) : 0, unref() { return t; }, ref() { return t; }, hasRef() { return true; }, [Symbol.toPrimitive]() { return id; } }; timers.set(id, t); return t; };
global.setTimeout = (fn, ms, ...a) => mk(fn, ms, false, a);
global.setInterval = (fn, ms, ...a) => mk(fn, ms, true, a);
global.clearTimeout = global.clearInterval = (t) => { if (t && t.id) timers.delete(t.id); };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => realSI(r)); };
const advance = async (ms) => {
  const target = vnow + ms;
  for (;;) {
    let next = null; for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
    if (!next) break;
    vnow = Math.max(vnow, next.at);
    if (next.rep) next.at = vnow + next.rep; else timers.delete(next.id);
    try { next.fn(...next.a); } catch (e) { log('TIMER-ERROR', String(e && e.message)); }
    await flush();
  }
  vnow = target; await flush();
};

// ---- data folder
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmorec-'));
const appData = path.join(tmp, 'appdata'); fs.mkdirSync(appData, { recursive: true });
const dataDir = path.join(appData, 'CosmoNotes');
process.env.FAKE_APPDATA = appData; process.env.FAKE_DATA = dataDir;
if (reuse) fs.cpSync(reuse, dataDir, { recursive: true });
if (mode === 'migrate') {
  const old = path.join(appData, 'Sticky Pins'); fs.mkdirSync(path.join(old, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(old, 'notes', 'old1.json'), JSON.stringify({ id: 'old1', title: 'Old note', html: '<div>old</div>', text: 'old', color: 'pink', open: true, createdAt: BASE - 5000, updatedAt: BASE - 4000, bounds: { x: 40, y: 50, width: 300, height: 260 } }));
  fs.writeFileSync(path.join(old, 'settings.json'), JSON.stringify({ firstRunDone: true, listTheme: 'night' }));
}

// ---- log
const L = [];
const clean = (v, depth = 0) => {
  if (v === undefined) return '[undef]';
  if (typeof v === 'function') return `[fn ${v.name || ''}]`;
  if (typeof v === 'string') return v.split(tmp).join('<T>').split(tree).join('<TREE>');
  if (v === null || typeof v !== 'object') return v;
  if (v && v.__rid) return `win#${v.__rid}`;
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) return `[bytes ${v.length}]`;
  if (depth > 6) return '[deep]';
  if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
  if (v instanceof Set) return { set: [...v].map((x) => clean(x, depth + 1)) };
  if (v instanceof Map) return { map: [...v].map(([k, x]) => [clean(k, depth + 1), clean(x, depth + 1)]) };
  if (v instanceof RealDate) return `[date ${v.getTime()}]`;
  const o = {}; for (const k of Object.keys(v).sort()) o[k] = clean(v[k], depth + 1); return o;
};
const log = (tag, ...a) => L.push(`${vnow}|${tag}|${JSON.stringify(clean(a))}`);

// ---- recording electron (wraps the fake one)
const FAKE = path.join(tree, 'tests', 'fake-electron', 'index.js');
const real = require(FAKE);
let rid = 0;
const READS = /^(is[A-Z]|get[A-Z]|emit|on|once|off|addListener|removeListener|constructor)/;
class RW extends real.BrowserWindow {
  constructor(o) {
    super(o); this.__rid = ++rid; log('new BrowserWindow', this.__rid, { ...o, webPreferences: o.webPreferences, parent: o.parent });
    const proto = real.BrowserWindow.prototype;
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (typeof proto[k] !== 'function' || READS.test(k)) continue;
      const orig = proto[k]; this[k] = (...a) => { log(`win${this.__rid}.${k}`, ...a); return orig.apply(this, a); };
    }
    const wc = this.webContents; const send = wc.send.bind(wc);
    wc.send = (ch, ...a) => { log(`win${this.__rid}.send`, ch, ...a); return send(ch, ...a); };
    const sw = wc.setWindowOpenHandler.bind(wc); wc.setWindowOpenHandler = (f) => { log(`win${this.__rid}.setWindowOpenHandler`); this.__openHandler = f; return sw(f); };
    for (const m of ['focus', 'replaceMisspelling']) if (!wc[m]) wc[m] = (...a) => log(`win${this.__rid}.wc.${m}`, ...a);
  }
}
for (const k of Object.getOwnPropertyNames(real.BrowserWindow)) if (!['length', 'name', 'prototype'].includes(k)) RW[k] = real.BrowserWindow[k];
const wrapObj = (name, obj) => new Proxy(obj, { get(t, k) { const v = t[k]; if (typeof v !== 'function' || typeof k !== 'string') return v; return (...a) => { log(`${name}.${k}`, ...a); return v.apply(t, a); }; } });
const E = {
  ...real, BrowserWindow: RW,
  shell: wrapObj('shell', real.shell), dialog: wrapObj('dialog', real.dialog), protocol: wrapObj('protocol', real.protocol),
  Menu: { buildFromTemplate: (t) => { log('Menu.buildFromTemplate', t); const m = real.Menu.buildFromTemplate(t); return { ...m, popup: (o) => log('Menu.popup', o) }; }, setApplicationMenu: (m) => log('Menu.setApplicationMenu', m) },
  nativeImage: wrapObj('nativeImage', real.nativeImage),
  app: new Proxy(real.app, { get(t, k) { const v = t[k]; if (['setLoginItemSettings', 'setAppUserModelId'].includes(k)) return (...a) => { log(`app.${k}`, ...a); }; if (k === 'quit') return () => { log('app.quit'); return v.apply(t); }; if (k === 'commandLine') return { appendSwitch: (...a) => log('appendSwitch', ...a) }; return typeof v === 'function' ? v.bind(t) : v; } }),
  session: { defaultSession: { ...real.session.defaultSession, setSpellCheckerLanguages: (l) => { log('setSpellCheckerLanguages', l); }, setPermissionRequestHandler: (f) => { E.__perm = f; log('setPermissionRequestHandler'); }, setPermissionCheckHandler: (f) => { E.__permCheck = f; log('setPermissionCheckHandler'); } } },
};
Object.defineProperty(E, '__handlers', { get: () => real.__handlers });
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'electron') return '/__electron__'; return orig.call(this, req, ...a); };
require.cache['/__electron__'] = { id: '/__electron__', filename: '/__electron__', loaded: true, exports: E };
Module._cache['/__electron__'] = require.cache['/__electron__'];
global.Response = class { constructor(b, o) { this.status = o && o.status; } };
const origConsoleError = console.error; console.error = (...a) => log('console.error', ...a.map((x) => (x && x.message) || x));
if (mode === 'restart') process.argv.push('--startup');

// ---- go
(async () => {
  require(path.join(tree, 'main.js'));
  await advance(10);
  const H = real.__handlers; const Ls = real.__listeners;
  const ev = (w) => ({ sender: w.webContents, returnValue: undefined });
  const live = () => real.__all.filter((w) => !w.destroyed);
  const notesW = () => live().filter((w) => w.file && w.file.endsWith('note.html'));
  const settle = async (p) => { let done = false, val, err; p.then((v) => { done = true; val = v; }, (e) => { done = true; err = e; }); for (let i = 0; i < 40 && !done; i++) { await flush(); if (!done) await advance(50); } if (!done) throw new Error('handler never finished'); if (err) throw err; return val; };
  const call = async (ch, e, ...a) => { let r; try { r = H[ch] ? await settle(Promise.resolve().then(() => H[ch](e, ...a))) : '[no handler]'; } catch (err) { r = `[threw ${err && err.message}]`; } log(`H ${ch}`, ...a, '=>', r); await advance(5); return r; };
  const on = async (ch, e, ...a) => { let r; try { Ls[ch](e, ...a); r = e && e.returnValue; } catch (err) { r = `[threw ${err && err.message}]`; } log(`L ${ch}`, ...a, '=>', r); await advance(5); };
  const snap = (tag) => { log('SNAP ' + tag, { wins: live().map((w) => ({ id: w.__rid, file: w.file && path.basename(w.file), bounds: w.bounds, op: w.opacity, top: w.top, bg: w.bg, title: w.title, vis: w.visible, min: w.minimized, max: w.maximized, noteId: w.noteId, revealed: w.revealed, lockPending: w.lockPending, userMin: w.userMin, inkOut: w.inkOut, inkState: w.inkState, textOut: w.textOut, textState: w.textState, menuState: w.menuState, fxState: w.fxState })) }); };

  if (mode === 'fresh') {
    snap('start'); const first = notesW()[0]; const fid = first.noteId;
    const lst = (await call('list:get', null)); 
    await call('note:get', ev(first));
    // lock setup
    await call('lock:set', ev(first), { next: 'abc', kind: 'password' });
    await call('lock:set', ev(first), { next: '123', kind: 'pin' });
    await call('lock:set', ev(first), { next: '1234', kind: 'pin' });
    await call('lock:set', ev(first), { current: 'zzzz', next: '4321', kind: 'pin' });
    await call('lock:set', ev(first), { current: '1234', next: 'secret1', kind: 'password' });
    // note edits
    await call('note:update', ev(first), { html: '<b>x</b>', text: 'x', opacity: 0.5, pinned: true, color: 'mint', evil: 1, title: 'First' });
    await call('note:update', ev(first), { text: 'typed more', title: 'First!' });
    await call('note:update', ev(first), { rolled: true }); snap('rolled');
    await call('note:update', ev(first), { rolled: false });
    await call('note:update', ev(first), { ink: [{ p: [1, 2, 3] }], wrapWidth: 300, zoom: 1.2, fx: { effect: 'stars' }, fxPaused: true });
    await call('note:update', ev(first), null);
    await call('note:dates', ev(first));
    await on('note:update-sync', ev(first), { html: 'sync', text: 'sync' });
    await on('note:hover', ev(first), true); await on('note:hover', ev(first), false);
    // window events
    first.setPosition(500, 400); first.emit('move'); await advance(400); first.setSize(360, 320); first.emit('resize'); await advance(400);
    snap('moved');
    // new notes
    await call('note:new', ev(first)); await call('note:new', ev(first));
    let ws = notesW(); snap('three notes');
    const second = ws[1], third = ws[2];
    await call('note:update', ev(second), { title: 'Second', text: 'second text', color: 'pink', html: '<div>second</div>' });
    await call('note:update', ev(third), { title: 'Third', text: 'third text', color: 'blue', html: '<div>third</div>' });
    await call('note:duplicate', ev(second)); await call('list:duplicate', null, third.noteId);
    await call('list:duplicate', null, 'nope');
    await call('note:set-locked', ev(third), true); snap('third locked');
    await call('note:unlock', ev(third), 'wrong'); await call('note:unlock', ev(third), 'secret1');
    await call('note:relock', ev(third)); await call('note:unlock', ev(third), 'secret1');
    await call('note:set-locked', ev(third), false); await call('note:set-locked', ev(third), true);
    await call('note:set-locked', ev(third), false);
    // minimize/maximize
    await call('note:minimize', ev(second)); snap('minimized'); second.restore(); await advance(50);
    first.minimized = false;
    await call('note:minimize', ev(first)); first.restore(); await advance(60);
    await call('note:maximize', ev(second)); await call('note:maximize', ev(second));
    await call('note:update', ev(second), { rolled: true }); await call('note:maximize', ev(second)); await advance(10); second.maximized && second.unmaximize();
    // pinned minimize bounce (not userMin)
    first.minimize(); await advance(100);
    await advance(5000); // enforcePinned ticks, showIt fallbacks
    // ink / text toolbar windows
    const child = (name) => { const ch = new real.BrowserWindow({ width: 100, height: 100 }); ch.webContents.session = ch.webContents.session; log('child created', name); return ch; };
    const openBar = (w, frameName) => { const hd = w.__openHandler({ url: 'about:blank', frameName }); log('openHandler', frameName, hd); const ch = new E.BrowserWindow(hd.overrideBrowserWindowOptions || { width: 10, height: 10 }); w.webContents.emit('did-create-window', ch, { frameName }); return ch; };
    const bars = {};
    for (const f of ['cosmoInkBar', 'cosmoTextBar', 'cosmoMenuBar', 'cosmoFxBar']) bars[f] = openBar(first, f);
    log('openHandler external', first.__openHandler({ url: 'https://example.com/x', frameName: '' }));
    log('openHandler bad', first.__openHandler({ url: 'javascript:1', frameName: 'cosmoInkBar' }));
    await on('ink:show', ev(first), { bar: 'ink', mode: 'dock', side: 'right', off: 20, w: 200, h: 100, inset: { l: 3, t: 3, r: 3, b: 3 } });
    await on('ink:show', ev(first), { bar: 'text', mode: 'free', x: 50, y: 60, w: 220, h: 80 });
    await on('ink:show', ev(first), { bar: 'menu', mode: 'dock', side: 'top', off: 5, w: 150, h: 150 });
    await on('ink:show', ev(first), { bar: 'fx', mode: 'dock', side: 'bottom', off: -10, w: 180, h: 160 });
    await on('ink:show', ev(first), { bar: 'bogus', mode: 'dock', side: 'left', off: 'x' });
    await on('ink:drag', ev(first), { bar: 'ink', x: 820, y: 300, px: 900, py: 320, w: 200, h: 100 });
    await on('ink:drag', ev(first), { bar: 'text', x: 10, y: 10, px: 20, py: 20 });
    { const bb = first.getBounds(); for (const d of [-30, -13, -12, -11, -5, 0, 5, 11, 12, 13, 30]) for (const [dx, dy] of [[bb.width + d, 10], [-200 - d, 10], [10, bb.height + d], [10, -100 - d]]) { await on('ink:drag', ev(first), { bar: 'ink', x: bb.x + dx, y: bb.y + dy, px: bb.x + dx + 5, py: bb.y + dy + 5, w: 200, h: 100 }); log('drag state', first.inkState, first.inkOut); } }
    await on('ink:size', ev(first), { bar: 'ink', w: 240, h: 120, inset: { l: 4, t: 4, r: 4, b: 4 } });
    first.setPosition(520, 420); first.emit('move'); await advance(10);
    first.setSize(380, 340); first.emit('resize'); await advance(10);
    await call('ink:drop', ev(first), { bar: 'ink', px: 600, py: 500 });
    await call('ink:drop', ev(first), { bar: 'text', px: 5000, py: 5000 });
    await call('ink:drop', ev(first), { bar: 'fx', px: 5000, py: 5000 });
    await on('ink:hide', ev(first), 'ink'); await on('ink:hide', ev(first), 'text');
    bars.cosmoMenuBar.close(); await advance(10); snap('bars');
    const dupBar = openBar(first, 'cosmoFxBar'); log('dup bar destroyed', dupBar.destroyed);
    // context menu
    first.webContents.emit('context-menu', { preventDefault() {} }, { misspelledWord: 'teh', dictionarySuggestions: ['the', 'ten', 'tea', 'tee', 'tel', 'tex'], isEditable: true, selectionText: '', editFlags: { canCut: true, canCopy: true, canPaste: true } });
    first.webContents.emit('context-menu', { preventDefault() {} }, { misspelledWord: '', dictionarySuggestions: [], isEditable: false, selectionText: '', editFlags: {} });
    first.webContents.emit('context-menu', { preventDefault() {} }, { misspelledWord: 'zzz', dictionarySuggestions: [], isEditable: false, selectionText: 'sel', editFlags: { canCut: false, canCopy: true, canPaste: false } });
    first.webContents.emit('will-navigate', { preventDefault() { log('preventDefault') } });
    first.emit('page-title-updated', { preventDefault() { log('title prevented') } });
    // attachments, links, permissions
    const url = await call('att:save', ev(first), new Uint8Array([1, 2, 3]), 'png'); await call('att:save', ev(first), new Uint8Array([1]), 'exe'); await call('att:save', ev(first), new Uint8Array([9, 9]), 'MP3');
    const resp = await real.__proto({ url }); log('proto', resp); log('proto bad', await real.__proto({ url: 'stickyfile://att/..%2F..%2Fsettings.json' }));
    await call('att:pick-images', ev(first)); await call('att:open', ev(first), url); await call('att:open', ev(first), 'stickyfile://att/none.png');
    await call('open-external', ev(first), 'javascript:alert(1)'); await call('open-external', ev(first), 'https://example.com'); await call('open-external', ev(first), 'mailto:a@b.c'); await call('open-external', ev(first), 'garbage');
    for (const [p, d] of [['media', { mediaTypes: ['audio'] }], ['media', { mediaTypes: ['video'] }], ['media', undefined], ['geolocation', {}], ['clipboard-sanitized-write', {}]]) { let r; E.__perm(null, p, (v) => { r = v; }, d); log('perm', p, d, r); }
    log('permCheck', E.__permCheck(null, 'media'), E.__permCheck(null, 'geolocation'));
    // list window
    await call('list:show', null); await advance(10); const lw = live().find((w) => w.file && w.file.endsWith('list.html')); snap('list shown');
    lw.setPosition(100, 120); lw.emit('move'); lw.setSize(500, 700); lw.emit('resize'); lw.emit('app-command', {}, 'browser-backward'); lw.emit('app-command', {}, 'browser-forward'); lw.emit('app-command', {}, 'other');
    await call('list:show', null);
    let L1 = await call('list:get', null);
    const ids = L1.notes.map((n) => n.id);
    // groups
    const g1 = await call('groups:make', null, ids[0], ids[1]); await call('groups:make', null, ids[2], ids[0]);
    let L2 = await call('list:get', null); const gid = (L2.groups[0] || {}).id; const gid2 = (L2.groups[1] || {}).id;
    await call('groups:make', null, ids[3], gid); await call('groups:make', null, gid, gid); await call('groups:make', null, 'nope', ids[0]);
    if (gid2) await call('groups:make', null, gid2, gid);
    await call('groups:rename', null, gid, 'Folder A'); await call('groups:update', null, gid, { name: 'Folder B', style: 'folder', color: 'sky', evil: 1 });
    await call('groups:make-from', null, [ids[4]], gid); await call('groups:apply', null, gid, { color: 'rose', font: 'round' }, true); await call('groups:apply', null, gid, { color: 'nope' }, false); await call('groups:apply', null, gid, { color: 'plum' }, false);
    await call('groups:move-to', null, ids[3], null); await call('groups:move-to', null, ids[3], gid); await call('groups:move-up', null, ids[3]); await call('groups:ungroup', null, ids[0]); await call('groups:move-to', null, 'zzz', gid);
    const gm = await call('groups:make-from', null, [ids[0], ids[1], ids[2]], null); await call('groups:make-from', null, [], null); await call('groups:make-from', null, [gid], gid);
    await call('groups:set-locked', null, gm, true, undefined); await call('list:get', null);
    await call('groups:reveal', null, gm, 'bad'); await call('groups:reveal', null, gm, 'secret1'); await call('list:get', null);
    await call('groups:hide', null, gm); await call('list:get', null);
    await call('groups:trash', null, gm); await call('groups:set-locked', null, gm, false, 'bad'); await call('groups:set-locked', null, gm, false, 'secret1'); await call('groups:trash', null, gm);
    const gm2 = await call('groups:make-from', null, [ids[3]], null); await call('groups:update', null, gm2, { name: 'Second', style: 'envelope', color: 'coral' }); await call('groups:dissolve', null, gm2); const gm3 = await call('groups:make-from', null, [ids[4]], null); await call('groups:trash', null, gm3); await call('list:get', null);
    // list locks
    await call('list:set-locked', null, ids[0], true); await call('list:set-locked', null, ids[0], false, 'x'); await call('list:set-locked', null, ids[0], false, 'secret1'); await call('list:set-locked', null, 'nope', true);
    await call('list:set-locked', null, ids[1], true);
    await call('list:close-note', null, ids[1]); await call('list:get', null); await call('list:unlock-all', null, 'bad'); await call('list:unlock-all', null, 'secret1'); await call('list:get', null);
    await call('list:open-note', null, ids[1]); await call('list:lock-all', null); await call('list:get', null);
    await call('list:set-locked', null, ids[1], false, 'secret1');
    await call('list:trash', null, ids[2]); await call('list:restore', null, ids[2]); await call('list:close-note', null, ids[2]); await call('list:open-note', null, ids[2]); await call('list:open-note', null, 'zzz');
    await call('list:favorite', null, [ids[0], gid2, 'nope'], true); await call('list:favorite', null, ids[0], false);
    await call('list:edit', null, ids[0], { title: 'Renamed', color: 'sage', opacity: 0.6, fx: { effect: 'rain' } }); await call('list:edit', null, ids[0], { opacity: true }); await call('list:edit', null, 'zz', { title: 'x' });
    await call('list:apply', null, [ids[0], ids[1]], { color: 'orange', font: 'hand' }); await call('list:apply', null, [ids[0]], {});
    await call('list:new', null, null);
    await call('list:bring-front', null);
    await call('list:trash', null, ids[1]); await call('list:destroy', null, ids[1]); await call('list:empty-bin', null);
    await call('list:empty-bin', null);
    // settings
    const S = async (p) => call('settings:set', null, p);
    await S({ startWithWindows: true }); await S({ startWithWindows: false });
    await S({ defaultColors: ['blue', 'pink', 'nope'] }); await S({ defaultColor: 'random' }); await S({ defaultColor: 'mint' });
    await S({ listSize: 'xl' }); await S({ listTheme: 'night' }); await S({ listTheme: 'nope' }); await S({ defaultFont: 'round' }); await S({ defaultOpacity: 0.7 }); await S({ defaultOpacity: '' });
    await S({ defaultSolidOnHover: true, newColorNoRepeat: true }); await S({ fxEffect: 'none', fxFollower: 'none' }); await S({ fxEffect: 'stars', fxFollower: 'nope', fxEffectAmount: 'often', fxFollowerAmount: 'bad' });
    await S({ fxEffectOpacity: 0.5, fxFollowerOpacity: 2 }); await S({ fxForceAll: true, fxInteract: true }); await S({ fxPaused: true }); await S({ fxPaused: false });
    await S({ spellCheck: false }); await S({ spellCyrillic: true }); await S({ spellCyrillic: false }); await S({ listSort: { by: 'created', dir: 'asc', groups: 'first' } }); await S({ listSort: { by: 'x' } }); await S(null);
    await call('backups:list', null); await call('backups:now', null); const bl = await call('backups:list', null); await call('backups:restore', null, bl && bl[0] && bl[0].name); await call('backups:open-folder', null); await call('data:open-folder', null);
    await call('note:close', ev(second)); await call('note:trash', ev(third));
    // tray
    const trayMenu = () => real.__tray.menu.t;
    log('tray menu', trayMenu());
    for (const it of trayMenu()) if (it.click && !/Quit/.test(it.label)) { try { it.click({ checked: true }); } catch (e) { log('tray click error', it.label, e.message); } await advance(10); }
    for (const it of real.__tray.menu.t) if (it.type === 'checkbox') { try { it.click({ checked: false }); } catch (e) { log('tray click error', it.label, e.message); } await advance(10); }
    real.__tray.emit('click'); await advance(10);
    real.app.emit('second-instance'); await advance(10);
    // display events
    real.screen.emit('display-removed'); await advance(900); real.screen.emit('display-metrics-changed'); await advance(900);
    first.setPosition(-5000, -5000); real.screen.emit('display-removed'); await advance(900);
    // close paths: alt-f4 style (closed without note:close), then the list closing
    const w4 = notesW()[0]; if (w4) { w4.close(); await advance(3000); }
    lw.emit('close'); lw.close(); await advance(100);
    await call('list:get', null);
    snap('before quit');
    // session end, quit
    const w5 = notesW()[0]; if (w5) w5.emit('session-end'); await advance(10);
    for (const it of real.__tray.menu.t) if (/Quit/.test(it.label || '')) it.click();
    live().forEach((w) => w.close()); await advance(3000);
  } else if (mode === 'migrate' || mode === 'restart') {
    snap('start'); await call('list:get', null);
    for (const w of notesW()) { await call('note:get', ev(w)); }
    await advance(3000); snap('after 3s');
    await call('list:show', null); snap('list');
    real.app.emit('second-instance'); await advance(10);
    real.app.quit(); notesW().forEach((w) => w.close()); await advance(3000);
  }
  log('TIMERS LEFT', timers.size);
  // ---- final disk state
  const files = {};
  const walk = (d) => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else files[path.relative(appData, p)] = realCrypto.createHash('sha256').update(fs.readFileSync(p).toString('latin1').split(tmp).join('<T>')).digest('hex').slice(0, 16) + ':' + (p.endsWith('.txt') ? 0 : st.size); } };
  walk(appData);
  log('DISK', files);
  fs.writeFileSync(outFile, L.join('\n') + '\n');
  fs.writeFileSync(outFile + '.data.json', JSON.stringify({ dataDir }));
  origConsoleError('recorded', L.length, 'lines →', outFile);
  process.exit(0);
})().catch((e) => { origConsoleError('RECORDER FAILED', e); fs.writeFileSync(outFile + '.fail', String(e.stack)); process.exit(2); });
