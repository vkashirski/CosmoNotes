'use strict';
// How the code is cut into files, so a change can open one small file (CLAUDE.md, "Saving tokens"):
// - main.js + main/ (1.1.27): every part is loaded, none needs another in a circle, the shared state is only used as S.…,
//   paths still reach assets/ and src/, and every channel the windows use (preload.js) is answered, and nothing more;
// - src/note/ (1.1.44) and src/list/ (1.1.28): each window loads its parts in order, each part is one closed block, and
//   every name a part takes, calls or hands on through the shared kit (K, K.V) fits; all parts load together in a vm;
// - src/fx/ (1.1.24): both windows load the same parts in the same order; each part only adds the shared kit;
// - src/css/ (1.1.26): both windows load their parts in order, after the fonts; every cut is clean (whole rules only);
// - line endings are kept (CLAUDE.md lists which files are CRLF; 1.4.0: every text file as .gitattributes says), the old single
//   files are only a note, all is packaged.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = require('./helpers/sources');
const { fake } = require('./helpers/list-kit');

const { ROOT, SRC, read } = src;
const pack = require('../package.json').build.files;
for (const f of ['main.js', 'main/**/*', 'store.js', 'preload.js', 'src/**/*']) assert.ok(pack.includes(f), `the installer packs ${f}`);
const isCRLF = (t) => /\r\n/.test(t) && !/[^\r]\n/.test(t);
const isLF = (t) => !t.includes('\r');
const tagsIn = (page) => [...read(`src/${page}.html`).matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
for (const f of ['note.js', 'list.js', 'fx.js', 'note.css', 'list.css']) assert.ok(!/COSMO_|function|=>|[{}]/.test(read(`src/${f}`)), `the old src/${f} is only a note now`);

// ---- main.js and main/
{
  const parts = fs.readdirSync(path.join(ROOT, 'main')).filter((f) => f.endsWith('.js')).sort().map((p) => `main/${p}`);
  const files = ['main.js', ...parts];
  for (const f of files) assert.ok(isCRLF(read(f)), `${f}: CRLF`);
  // every part is loaded by something, nothing loads a part that is not there, no part needs one that needs it back
  const requires = (file) => [...read(file).matchAll(/require\('(\.{1,2}\/[^']+)'\)/g)].map((m) => path.normalize(path.join(path.dirname(file), m[1])).replace(/\\/g, '/'));
  const graph = {};
  for (const f of files) {
    graph[f] = requires(f).map((r) => (r.endsWith('.js') ? r : r + '.js'));
    for (const r of graph[f]) assert.ok(fs.existsSync(path.join(ROOT, r)), `${f} requires ${r}, which is not there`);
  }
  const reach = new Set(); const todo = ['main.js'];
  while (todo.length) { const f = todo.pop(); if (reach.has(f)) continue; reach.add(f); todo.push(...graph[f].filter((r) => graph[r])); }
  for (const p of parts) assert.ok(reach.has(p), `${p} is loaded by nothing`);
  const state = {};
  const visit = (f, trail) => { if (state[f] === 2 || !graph[f]) return; assert.notEqual(state[f], 1, `files need each other in a circle: ${trail.concat(f).join(' -> ')}`); state[f] = 1; for (const r of graph[f]) visit(r, trail.concat(f)); state[f] = 2; };
  visit('main.js', []);
  // main.js is the entry: the start-up calls that must run before the app is ready, and nothing else big
  const mainSrc = read('main.js');
  for (const needle of ['protocol.registerSchemesAsPrivileged', "app.setAppUserModelId('com.stickypins.app')", "'disable-features', 'WinUseBrowserSpellChecker'", 'app.requestSingleInstanceLock()', 'app.whenReady().then(start)']) assert.ok(mainSrc.includes(needle), `main.js keeps: ${needle}`);
  assert.ok(mainSrc.split('\n').length < 150, 'main.js stays small');
  // the shared variables: one object (S), nobody has a loose copy of them
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const bare = /(?<![.\w'"`$])(store|listWin|quitting|listUnlockedAll)(?![\w'"`:$])/;
  for (const f of files) {
    if (f === 'main/state.js') continue;
    const m = strip(read(f)).replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''").match(bare);
    assert.ok(!m, `${f}: "${m && m[1]}" is used without S. in front`);
  }
  const { S } = require('../main/state');
  assert.deepEqual(Object.keys(S).sort(), ['listUnlockedAll', 'listWin', 'quitting', 'store'], 'the shared state');
  // the paths still point at the folders next to main.js
  const C = require('../main/constants');
  assert.ok(fs.existsSync(C.ASSETS) && fs.existsSync(C.PRELOAD) && fs.existsSync(C.WIN_ICON), 'assets, preload.js and the window icon are found');
  for (const f of ['note.html', 'list.html']) assert.ok(read('main/note-window.js').includes(`'src', '${f}'`) || read('main/list-window.js').includes(`'src', '${f}'`), `${f} is loaded from src/`);
}

// ---- src/note/ and src/list/: the parts and the shared kit K
function checkKit(page, dir, ORDER, kitName, crlf, sandbox, shared) {
  const want = ORDER.map((n) => `${dir}/${n}.js`);
  assert.deepEqual(src.files[dir], want, `${page}.html: the ${dir}/ parts, in this order`);
  const tags = tagsIn(page);
  assert.deepEqual(tags.slice(-want.length), want, `${page}.html: the parts come last`);
  assert.ok(!tagsIn(page === 'note' ? 'list' : 'note').some((t) => t.startsWith(dir + '/')), `the other window loads none of src/${dir}/`);
  assert.deepEqual(fs.readdirSync(path.join(SRC, dir)).sort(), want.map((f) => f.slice(dir.length + 1)).sort(), `every file in src/${dir}/ is loaded`);
  const parts = want.map((f) => ({ f, raw: fs.readFileSync(path.join(SRC, f), 'utf8') }));
  const given = new Map(); // name -> part index
  const namesIn = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  parts.forEach((p, i) => {
    assert.ok(crlf ? isCRLF(p.raw) : isLF(p.raw), `${p.f}: ${crlf ? 'CRLF' : 'LF'} line endings`);
    const c = p.code = p.raw.replace(/\r\n/g, '\n');
    assert.ok(c.startsWith("'use strict';\n"), `${p.f} is strict`);
    assert.ok(/\n\(\(\) => \{\n/.test(c) && c.endsWith('\n})();\n') && c.split('\n})();').length === 2, `${p.f}: one closed block`);
    const take = c.match(/\n {2}const \{([^}]*)\} = K;\n/);
    p.take = take ? namesIn(take[1]) : [];
    p.later = [...c.matchAll(/(\w+) = K\.later\('(\w+)'\)/g)].map((m) => { assert.equal(m[1], m[2], `${p.f}: ${m[1]} = K.later('${m[2]}')`); return m[2]; });
    const give = c.match(/\n {2}Object\.assign\(K, \{([^}]*)\}\);\n\}\)\(\);\n$/);
    p.give = give ? namesIn(give[1]) : [];
    for (const n of p.give) {
      assert.ok(!given.has(n), `${n} is given by one part only`);
      assert.ok(new RegExp(`\\n  (function|async function|const|let) ${n.replace(/\$/g, '\\$')}(?![\\w$])`).test(c), `${p.f} defines ${n} itself`);
      given.set(n, i);
    }
    p.kRefs = [...new Set([...c.replace(/K\.later\('\w+'\)/g, '').matchAll(/\bK\.(\w+)/g)].map((m) => m[1]))].filter((n) => n !== 'V' && n !== 'later');
  });
  parts.forEach((p, i) => {
    for (const n of p.take) if (n !== 'V') assert.ok(given.has(n) && given.get(n) < i, `${p.f} takes ${n} from an earlier part`);
    for (const n of p.later) assert.ok(given.get(n) > i, `${p.f}: ${n} comes from a later part`);
    for (const n of p.kRefs) assert.ok(given.get(n) > i, `${p.f}: K.${n} comes from a later part`);
  });
  // shared variables: each V.x is set up in one place (at the top level of a part) and only used as V.x
  const all = parts.map((p) => p.code).join('\n');
  const vUsed = new Set([...all.matchAll(/\bV\.(\w+)/g)].map((m) => m[1]));
  for (const n of vUsed) {
    assert.equal((all.match(new RegExp(`\\n  V\\.${n} = `, 'g')) || []).length, 1, `V.${n} is set up once, at the top level of a part`);
    assert.ok(!new RegExp(`\\n  let ${n}\\b`).test(all), `${n} is not also a private variable`);
  }
  assert.ok(shared.every((n) => vUsed.has(n)), `${dir}: the main shared variables are on V`);
  // load the parts like the window does (a stand-in DOM where every element accepts anything)
  vm.createContext(sandbox);
  for (const p of parts) {
    const before = new Set(Object.keys(sandbox)); const win = new Set(Object.keys(sandbox.window));
    vm.runInContext(p.code, sandbox, { filename: p.f });
    assert.deepEqual(Object.keys(sandbox).filter((k) => !before.has(k)), [], `${p.f} makes no globals`);
    assert.deepEqual(Object.keys(sandbox.window).filter((k) => !win.has(k)), i0(p, parts) ? [kitName] : [], `${p.f}: only the shared kit on window`);
  }
  const K = sandbox.window[kitName];
  for (const [n] of given) assert.ok(K[n] !== undefined, `K.${n} is there once every part has loaded`);
  for (const p of parts) for (const n of p.later) assert.equal(typeof K[n], 'function', `${p.f}: K.later('${n}') finds a function`);
  return { K, parts };
}
const i0 = (p, parts) => p === parts[0];
const doc = () => ({ querySelector: (s) => fake(s), querySelectorAll: () => [], createElement: (t) => fake(t), createElementNS: (n, t) => fake(t), addEventListener() {}, hasFocus: () => true, body: fake('body'), documentElement: fake('html'), hidden: false, fonts: { ready: new Promise(() => {}), addEventListener() {} } });
const base = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, getComputedStyle: () => fake('style'),
  ResizeObserver: class { observe() {} }, MutationObserver: class { observe() {} }, IntersectionObserver: class { observe() {} unobserve() {} },
  Intl, Date, Math, JSON, Object, Array, Set, Map, WeakMap, String, Number, Boolean, Promise, RegExp, Error, parseFloat, parseInt, isFinite, Uint8Array, encodeURIComponent };
{
  const sticky = fake('sticky'); sticky.getNote = () => Promise.resolve(null); // the window then stops before it shows a note
  const { K, parts } = checkKit('note', 'note', ['base', 'fx-format', 'panels', 'content', 'editing', 'checklists', 'menus-voice-ink', 'speech', 'lock-zoom', 'draw-over', 'ink-out', 'remind', 'pin-apps', 'tags', 'top-bar', 'eraser-start'], 'COSMO_NOTE_KIT', true,
    { ...base, document: doc(), window: { sticky, COSMO_FX: fake('COSMO_FX'), addEventListener() {}, matchMedia: () => ({ matches: true }) }, getSelection: () => fake('selection'), innerWidth: 400, innerHeight: 400, devicePixelRatio: 1,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: fake('navigator'), CSS: fake('CSS'), Highlight: class {},
      Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 } },
    ['note', 'settings', 'hidden', 'dirty', 'savedRange']);
  assert.equal(K.V.note, null, 'the shared variables start as before'); assert.equal(K.V.dirty, false);
  // two later-part functions are wired up while the window loads: they go through K.later (they work once all parts have loaded)
  assert.ok(/\$\('#btnRelock'\)\.addEventListener\('click', relock\)/.test(parts[2].code) && parts[2].later.includes('relock') && parts[2].later.includes('toggleLock'), 'relock / toggleLock from the lock part');
}
{
  const { K } = checkKit('list', 'list', ['base', 'cards', 'picking', 'settings-menus', 'effects-design', 'actions-locks', 'events'], 'COSMO_LIST_KIT', false,
    { ...base, document: doc(), window: { sticky: fake('sticky'), COSMO_FX: fake('COSMO_FX'), COSMO_ABOUT: { FEATURES: [] }, addEventListener() {}, matchMedia: () => ({ matches: true }) }, innerWidth: 1000, innerHeight: 700 },
    ['state', 'tab', 'openGroup', 'query', 'drag']);
  assert.equal(K.V.tab, 'notes', 'the shared variables start as before');
  assert.deepEqual(K.V.state, { notes: [], groups: [], settings: {} });
}

// ---- src/fx/: the same parts in both windows, before their own code; each only adds the shared kit
{
  const ORDER = ['kit', 'effects-classic', 'effects-lab', 'effects-magic', 'followers-classic', 'followers-lab', 'followers-magic', 'engine'];
  const want = ORDER.map((n) => `fx/${n}.js`);
  const SHARED = ['evening.js', 'reminders.js', 'remind-ui.js', 'tags.js']; // 1.3.27 evening colours; 1.4.1 reminders (rules, then the panel); 1.4.10 tags
  assert.deepEqual(tagsIn('note'), [...want, ...SHARED, ...src.files.note], 'note.html: the effects, the evening colours, the reminders, then its own code');
  assert.deepEqual(tagsIn('list'), ['about.js', ...want, ...SHARED, 'tab-icons.js', ...src.files.list], 'list.html: about.js, the effects, the evening colours, the reminders, the tab icons (1.4.33, list only), then its own code');
  // 1.3.27: src/evening.js is shared by both windows and main: strict, LF, only window.COSMO_EVENING in a window, module.exports in Node
  const eve = read('src/evening.js');
  assert.ok(eve.startsWith("'use strict';") && isLF(eve), 'src/evening.js: strict, LF');
  const box = { window: {} }; box.window.window = box.window; vm.createContext(box);
  vm.runInContext(eve, box, { filename: 'src/evening.js' });
  assert.deepEqual(Object.keys(box.window).filter((k) => k !== 'window'), ['COSMO_EVENING'], 'src/evening.js: only COSMO_EVENING on window');
  assert.equal(typeof require('../src/evening').phase, 'function', 'src/evening.js: main and store.js require it');
  // 1.4.1: src/reminders.js the same way (window.COSMO_REMIND; main and store.js require it); src/remind-ui.js only in a
  // window, after it (window.COSMO_REMIND_UI)
  const rem = read('src/reminders.js');
  const remUi = read('src/remind-ui.js');
  assert.ok(rem.startsWith("'use strict';") && isLF(rem) && remUi.startsWith("'use strict';") && isLF(remUi), 'src/reminders.js and src/remind-ui.js: strict, LF');
  const rbox = { window: {} }; rbox.window.window = rbox.window; vm.createContext(rbox);
  vm.runInContext(rem, rbox, { filename: 'src/reminders.js' });
  rbox.window.document = { head: null }; rbox.document = rbox.window.document;
  vm.runInContext(remUi, rbox, { filename: 'src/remind-ui.js' });
  assert.deepEqual(Object.keys(rbox.window).filter((k) => !['window', 'document'].includes(k)), ['COSMO_REMIND', 'COSMO_REMIND_UI'], 'only COSMO_REMIND and COSMO_REMIND_UI on window');
  assert.equal(typeof require('../src/reminders').ring, 'function', 'src/reminders.js: main and store.js require it');
  // 1.4.10: src/tags.js the same way (window.COSMO_TAGS; main and store.js require it)
  const tg = read('src/tags.js');
  assert.ok(tg.startsWith("'use strict';") && isLF(tg), 'src/tags.js: strict, LF');
  const tbox = { window: {} }; tbox.window.window = tbox.window; vm.createContext(tbox);
  vm.runInContext(tg, tbox, { filename: 'src/tags.js' });
  assert.deepEqual(Object.keys(tbox.window).filter((k) => k !== 'window'), ['COSMO_TAGS'], 'src/tags.js: only COSMO_TAGS on window');
  assert.equal(typeof require('../src/tags').cleanAll, 'function', 'src/tags.js: main and store.js require it');
  // 1.4.33: src/tab-icons.js the same way (window.COSMO_TAB_ICONS; store.js requires it), only in the list window
  const ti = read('src/tab-icons.js');
  assert.ok(ti.startsWith("'use strict';") && isLF(ti), 'src/tab-icons.js: strict, LF');
  const ibox = { window: {} }; ibox.window.window = ibox.window; vm.createContext(ibox);
  vm.runInContext(ti, ibox, { filename: 'src/tab-icons.js' });
  assert.deepEqual(Object.keys(ibox.window).filter((k) => k !== 'window'), ['COSMO_TAB_ICONS'], 'src/tab-icons.js: only COSMO_TAB_ICONS on window');
  const TI = require('../src/tab-icons');
  assert.equal(TI.IDS.length, 40, 'the owner\'s 40 tab icons');
  assert.deepEqual(TI.FIXED, { favs: 'star', locks: 'lock', bin: 'trash' }, 'Favourites, Locked and the Bin keep their icons');
  assert.deepEqual(src.files.fx, want, 'the tests load what the windows load');
  assert.deepEqual(fs.readdirSync(path.join(SRC, 'fx')).sort(), want.map((f) => f.slice(3)).sort(), 'every file in src/fx/ is loaded');
  const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => fake('ctx') }) }, performance: { now: () => 0 },
    requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Map, Set, Float32Array };
  vm.createContext(sandbox);
  for (const f of want) {
    const code = fs.readFileSync(path.join(SRC, f), 'utf8');
    assert.ok(code.startsWith("'use strict';"), `${f} is strict`); assert.ok(isLF(code), `${f}: LF`);
    const before = new Set(Object.keys(sandbox));
    vm.runInContext(code, sandbox, { filename: f });
    assert.deepEqual(Object.keys(sandbox).filter((k) => !before.has(k)), [], `${f} makes no globals of its own`);
    assert.deepEqual(Object.keys(sandbox.window).sort(), f === 'fx/engine.js' ? ['COSMO_FX', 'COSMO_FX_KIT'] : ['COSMO_FX_KIT'], `${f}: only the shared kit on window`);
  }
}

// ---- src/css/: the parts in order after the fonts; whole rules only; line endings
{
  const NOTE = ['note-base', 'note-text', 'note-toolbars', 'note-drawing', 'note-effects-lock', 'note-popups-find'].map((n) => `css/${n}.css`);
  const LIST = ['list-base', 'list-cards', 'list-groups-menus', 'list-settings-fx', 'list-picking-edit'].map((n) => `css/${n}.css`);
  const sheetsIn = (page) => [...read(`src/${page}.html`).matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  for (const [page, want] of [['note', NOTE], ['list', LIST]]) {
    const all = sheetsIn(page);
    const first = all.findIndex((h) => h.startsWith('css/'));
    assert.deepEqual(all.slice(first), want, `${page}.html: the parts, in order (later rules win), and nothing after them`);
    assert.ok(all.slice(0, first).every((h) => h.startsWith('../node_modules/@fontsource/')), `${page}.html: only the fonts come before the parts`);
    assert.deepEqual(src.cssFiles(page), want, 'the tests load what the window loads');
  }
  assert.deepEqual(fs.readdirSync(path.join(SRC, 'css')).sort(), [...NOTE, ...LIST].map((f) => f.slice(4)).sort(), 'every file in src/css/ is loaded by one window');
  for (const f of [...NOTE, ...LIST]) {
    const s = fs.readFileSync(path.join(SRC, f), 'utf8');
    let depth = 0; let comment = false; let quote = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i]; const n = s[i + 1];
      if (comment) { if (c === '*' && n === '/') { comment = false; i++; } continue; }
      if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
      if (c === '/' && n === '*') { comment = true; i++; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '{') depth++; else if (c === '}') { depth--; assert.ok(depth >= 0, `${f}: a } with no {`); }
    }
    assert.ok(depth === 0 && !comment && !quote && s.trim().length > 0, `${f}: whole rules only (braces balance, nothing left open)`);
    assert.ok(f.startsWith('css/note-') ? isCRLF(s) : isLF(s), `${f}: ${f.startsWith('css/note-') ? 'CRLF' : 'LF'}`);
  }
}

// ---- every channel the windows use is answered by main, and main answers nothing they don't use
(async () => {
  const app = require('./helpers/app');
  const { H, L } = await app.start();
  const pre = read('preload.js') + read('src/engine/preload.js'); // 1.3.1: the voice-to-text engine window has its own
  const inv = new Set([...pre.matchAll(/\binv\('([^']+)'/g)].map((m) => m[1]));
  const sends = new Set([...pre.matchAll(/ipcRenderer\.send(?:Sync)?\('([^']+)'/g)].map((m) => m[1]));
  const ons = new Set([...pre.matchAll(/ipcRenderer\.on\('([^']+)'/g)].map((m) => m[1]));
  assert.ok(inv.size > 40 && sends.size >= 6 && ons.size >= 5, 'preload.js read');
  // 1.4.1: no name twice in one object of window.sticky: the second one silently replaces the first (1.4.0's `update`
  // for the updates replaced the note window's save, `update(patch)`)
  {
    const lines = read('preload.js').split(/\r?\n/);
    const seen = [new Map()];
    lines.forEach((l, i) => {
      const m = /^( +)([A-Za-z_$][\w$]*):/.exec(l);
      if (!m) return;
      const depth = m[1].length / 2;
      seen.length = depth; // a key at this depth: deeper objects before it are closed
      const at = seen[depth - 1] || (seen[depth - 1] = new Map());
      assert.ok(!at.has(m[2]), `preload.js: "${m[2]}" twice in the same object (lines ${at.get(m[2])} and ${i + 1})`);
      at.set(m[2], i + 1);
      seen[depth] = new Map();
    });
  }
  assert.deepEqual(Object.keys(H).sort(), [...inv].sort(), 'every ipcMain.handle channel is one preload.js asks, and the other way round');
  assert.deepEqual(Object.keys(L).sort(), [...sends].sort(), 'every ipcMain.on channel is one preload.js sends, and the other way round');
  const mainSrc = src.main();
  for (const ch of ons) assert.ok(mainSrc.includes(`send('${ch}'`), `main sends ${ch}, which the windows listen for`);

  // ---- 1.4.0: every text file has the line endings .gitattributes gives it (CRLF where listed, LF otherwise), so a fresh
  // clone (GitHub's machines) and the owner's folder are the same, and a new file can't slip in with the wrong ones
  const rules = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')).map((l) => {
      const m = l.match(/^(\S+)\s.*\beol=(crlf|lf)\b/);
      assert.ok(m, `.gitattributes: ${l}`);
      // a leading / is the top folder only (git's rule, 1.4.1: /preload.js is not src/engine/preload.js)
      const pat = m[1].replace(/^\//, '');
      const glob = pat.replace(/\[\[:space:\]\]/g, '\u0000').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\u0000/g, ' ');
      return { re: new RegExp(m[1].includes('/') ? `^${glob}$` : `(^|/)${glob}$`), eol: m[2] };
    });
  const eolOf = (f) => rules.reduce((e, r) => (r.re.test(f) ? r.eol : e), 'lf');
  const SKIP = new Set(['.git', 'node_modules', 'dist', 'tools', 'models']);
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const f = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(f, out); } else if (e.isFile()) out.push(f);
    }
    return out;
  };
  let seen = 0;
  for (const f of walk('')) {
    const b = fs.readFileSync(path.join(ROOT, f));
    if (b.includes(0) || /\.(wasm|ttf|ico|png|cer|exe)$/.test(f)) continue; // binary
    const t = b.toString('latin1');
    if (!t.includes('\n')) continue;
    seen++;
    if (eolOf(f) === 'crlf') assert.ok(isCRLF(t), `${f}: CRLF (.gitattributes)`);
    else assert.ok(isLF(t), `${f}: LF (.gitattributes)`);
  }
  assert.ok(seen > 150, 'every text file was looked at');
  for (const f of ['main.js', 'main/updater.js', 'src/note/base.js', 'src/css/note-base.css', 'HOW TO INSTALL.txt', 'release.bat']) assert.equal(eolOf(f), 'crlf', `${f} is a CRLF file`);
  for (const f of ['store.js', 'src/list/base.js', 'src/css/list-base.css', 'package.json', '.github/workflows/release.yml', 'src/engine/preload.js', 'src/reminders.js']) assert.equal(eolOf(f), 'lf', `${f} is an LF file`);
  assert.equal(eolOf('preload.js'), 'crlf', 'preload.js is a CRLF file');
  console.log('ok');
  await app.quit();
})();
