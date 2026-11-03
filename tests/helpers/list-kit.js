'use strict';
// Loads the notes list's code (the src/list/ parts, as list.html lists them) in a Node `vm` with a stand-in DOM in which
// every element accepts anything, and gives back the shared kit K (window.COSMO_LIST_KIT) with the data you pass as what
// main's list:get answers. For tests of the list's own logic (sorting, groups, locks, move rules…) without a browser.
// Usage: const K = await require('./helpers/list-kit')({ notes: [...], groups: [...], settings: {...} });  K.sortItems(...), K.V.state…
// Anything that builds or reads real elements (cards, menus, sizes on screen) needs the browser tests (tests/helpers/list-ui.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = require('./sources');

function fake(name) {
  const store = {};
  const f = function () { return fake(name + '()'); };
  return new Proxy(f, {
    get: (t, k) => {
      if (k === Symbol.iterator) return function* () {};
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (k in store) return store[k];
      if (k === 'length' || k === 'size') return 0;
      if (k === 'children' || k === 'childNodes') return [];
      return (store[k] = fake(`${name}.${String(k)}`));
    },
    set: (t, k, v) => { store[k] = v; return true; },
    apply: () => fake(name + '()'),
    construct: () => fake(`new ${name}`),
  });
}

module.exports = async function listKit(data = {}) {
  const state = { notes: [], groups: [], settings: {}, ...data };
  const calls = [];
  // window.sticky: list.get answers with the data; every other call is logged and answers nothing
  const api = (p) => new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? undefined : api(p ? `${p}.${String(k)}` : String(k))),
    apply: (t, self, args) => { calls.push([p, ...args]); return p === 'list.get' ? Promise.resolve(JSON.parse(JSON.stringify(state))) : Promise.resolve(undefined); },
  });
  const doc = { querySelector: (s) => fake(s), querySelectorAll: () => [], createElement: (t) => fake(t), createElementNS: (n, t) => fake(t), addEventListener() {}, body: fake('body'), documentElement: fake('html'), hidden: false };
  const sandbox = {
    document: doc,
    window: { sticky: api(''), COSMO_FX: fake('COSMO_FX'), COSMO_ABOUT: { VERSIONS: [], FEATURES: [] }, addEventListener() {}, matchMedia: () => ({ matches: true }) },
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, getComputedStyle: () => fake('style'), innerWidth: 1000, innerHeight: 700,
    ResizeObserver: class { observe() {} }, IntersectionObserver: class { observe() {} unobserve() {} },
    Intl, Date, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise, parseFloat,
  };
  vm.createContext(sandbox);
  for (const f of src.files.list) vm.runInContext(fs.readFileSync(path.join(src.SRC, f), 'utf8'), sandbox, { filename: f });
  await new Promise((r) => setImmediate(r)); // the first load (list.get) has answered
  const K = sandbox.window.COSMO_LIST_KIT;
  K.calls = calls;
  // replace the data later on: K.set({ notes, groups, settings })
  K.set = (d) => { K.V.state = { notes: [], groups: [], settings: {}, ...d }; };
  return K;
};
module.exports.fake = fake; // the stand-in element: every property and call gives another one
