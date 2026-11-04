'use strict';
// The version and its paperwork agree (CLAUDE.md, "Every update"): package.json's version is the newest heading of
// CHANGELOG.md, with the same date as src/about.js's LAST_UPDATED and ai-context/CONTEXT.md's "Last updated" line;
// CHANGELOG.md keeps the two newest and CHANGELOG-archive.md the rest, every version once, newest first; the app shows
// no version history itself (1.1.41), only the version, the date and the feature list.
const assert = require('assert');
const vm = require('vm');
const src = require('./helpers/sources');

const { read } = src;
const version = require('../package.json').version;
const [MAJ, MIN, NOW] = version.split('.').map(Number);
assert.deepEqual([MAJ, MIN], [1, 3], 'the owner decides when the first or second number goes up: update this check then');
// where each 1.x series starts and ends: 1.0.0 – 1.0.4, 1.1.0 – 1.1.49, 1.2.1 – 1.2.4 (the owner's pick: there is no 1.2.0),
// then 1.3.1 on (voice to text; the owner's pick: there is no 1.3.0)
const SERIES = [[3, 1, NOW], [2, 1, 4], [1, 0, 49], [0, 0, 4]];

// ---- the newest version everywhere, with one date
const box = { window: {} };
vm.runInNewContext(read('src/about.js'), box);
const A = box.window.COSMO_ABOUT;
const top = read('CHANGELOG.md').match(/^## (\d+\.\d+\.\d+) – (\d{1,2}) (\w+) (\d{4})$/m);
assert.ok(top, 'CHANGELOG.md has a version heading');
assert.equal(top[1], version, 'the newest CHANGELOG.md entry is the version in package.json');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = `${top[4]}-${String(MONTHS.indexOf(top[3]) + 1).padStart(2, '0')}-${top[2].padStart(2, '0')}`;
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(A.LAST_UPDATED), 'about.js has LAST_UPDATED');
assert.equal(A.LAST_UPDATED, iso, 'about.js LAST_UPDATED is the date of the newest version');
assert.ok(read('ai-context/CONTEXT.md').includes(`**Last updated: ${top[2]} ${top[3]} ${top[4]} · App version ${version}**`), 'CONTEXT.md’s "Last updated" line is current');

// ---- the changelog: the two newest here, the rest in the archive, every version from 1.0.0 once, newest first
const heads = (f) => [...read(f).matchAll(/^## (\d+)\.(\d+)\.(\d+) – /gm)].map((m) => `${m[1]}.${m[2]}.${m[3]}`);
const want = SERIES.flatMap(([min, first, last]) => Array.from({ length: last - first + 1 }, (_, i) => `1.${min}.${last - i}`));
assert.deepEqual(heads('CHANGELOG.md'), want.slice(0, 2), 'CHANGELOG.md keeps the two newest');
assert.deepEqual([...heads('CHANGELOG.md'), ...heads('CHANGELOG-archive.md')], want, 'every version from the newest down to 1.0.0 once, newest first');
for (const m of read('CHANGELOG-archive.md').matchAll(/^## 1\.1\.(\d+) – .*$/gm)) {
  if (+m[1] >= 13 && +m[1] <= 40) assert.ok(/\(was (part \d of \d of )?1\.1\.\d+\)$/.test(m[0]), `the renumbered heading says what it was: ${m[0]}`);
}
assert.ok(/\| 1\.1\.24 – 1\.1\.31 \| 1\.1\.33 – 1\.1\.40/.test(read('CHANGELOG.md')), 'the old → new number table (1.1.41)');

// ---- no version history in the app (1.1.41): the feature list, no VERSIONS, nothing that draws them
assert.ok(Array.isArray(A.FEATURES) && A.FEATURES.length >= 8, 'about.js has the feature list');
assert.equal(A.VERSIONS, undefined, 'but no VERSIONS');
assert.ok(!/Version history|id="versions"|foldVersions/.test(read('src/list.html')), 'list.html has no "Version history" fold');
assert.ok(!/VERSIONS|vblock|vchanges/.test(src.list()), "the list's code doesn't draw a version history");
assert.ok(!/\.(vblock|vhead|vtag|vdate|vnow|vchanges)\b/.test(src.css('list')), 'its styles are gone');
console.log('ok');
