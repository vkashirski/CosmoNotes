// 1.1.24: the effects code (src/fx.js, ~180 KB) was split into smaller files in src/fx/ so that a change to one
// effect only needs that file. The code itself did not change (checked with a recording of every drawing call
// before and after). This checks the parts are loaded the same way everywhere and fit together.
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
// (the version check moved on to the next version's test: v1125.test.js)

const SRC = path.join(__dirname, '..', 'src');
const ORDER = ['kit', 'effects-classic', 'effects-lab', 'effects-magic', 'followers-classic', 'followers-lab', 'followers-magic', 'engine'];
const tagsIn = (page) => [...fs.readFileSync(path.join(SRC, page), 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

// both windows load the same parts, in the same order, before their own script; nothing loads the old fx.js
const want = ORDER.map((n) => `fx/${n}.js`);
assert.deepEqual(tagsIn('note.html'), [...want, 'note.js'], 'note.html: the parts, then note.js');
assert.deepEqual(tagsIn('list.html'), ['about.js', ...want, 'list.js'], 'list.html: about.js, the parts, then list.js');
assert.deepEqual(require('./fx-source').FILES, want, 'the tests load what the windows load');
assert.deepEqual(fs.readdirSync(path.join(SRC, 'fx')).sort(), want.map((f) => f.slice(3)).sort(), 'every file in src/fx/ is loaded');
assert.ok(!/COSMO_FX|function|=>/.test(fs.readFileSync(path.join(SRC, 'fx.js'), 'utf8')), 'the old src/fx.js is only a note now');
// the installer packs src/** (so src/fx/ goes in)
assert.ok(require('../package.json').build.files.includes('src/**/*'), 'src/fx/ is packaged');

// each part is its own closed block that only adds window.COSMO_FX_KIT (the shared names) and, last, window.COSMO_FX
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const sandbox = { window: {}, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: fakeCtx }) }, performance: { now: () => 0 },
  requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Map, Set, Float32Array };
vm.createContext(sandbox);
for (const f of want) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  assert.ok(code.startsWith("'use strict';"), `${f} is strict`);
  const before = new Set(Object.keys(sandbox));
  vm.runInContext(code, sandbox, { filename: f });
  assert.deepEqual(Object.keys(sandbox).filter((k) => !before.has(k)), [], `${f} makes no globals of its own`);
  const win = Object.keys(sandbox.window).sort();
  assert.deepEqual(win, f === 'fx/engine.js' ? ['COSMO_FX', 'COSMO_FX_KIT'] : ['COSMO_FX_KIT'], `${f}: only the shared kit on window`);
}
// and together they give the same effects as store.js lists, in the same order
const { FX_EFFECTS, FX_FOLLOWERS } = require(path.join(__dirname, '..', 'store.js'));
const FX = sandbox.window.COSMO_FX;
assert.deepEqual([...FX.EFFECT_IDS], FX_EFFECTS, 'backgrounds: the same ids as store.js');
assert.deepEqual([...FX.FOLLOWER_IDS], FX_FOLLOWERS, 'mouse followers: the same ids as store.js');
for (const id of FX.EFFECT_IDS) assert.ok(FX.EFFECTS[id].make && FX.ICONS.effect[id], `${id}: made and has an icon`);
for (const id of FX.FOLLOWER_IDS) assert.ok(FX.FOLLOWERS[id].make && FX.ICONS.follower[id], `${id} (mouse): made and has an icon`);
console.log('v1124 ok');
