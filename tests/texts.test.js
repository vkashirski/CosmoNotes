'use strict';
// The app's texts, as the owner wants them (CLAUDE.md, "Texts in the app"): short and plain. Hints in Settings and
// pop-ups and the feature list's items stay short, the long locked-note warnings are gone (1.1.41), and the wording the
// owner picked stays: the Bin (1.1.42), Settings (1.1.45), "Mouse can interact with the background" (1.1.22).
const assert = require('assert');
const vm = require('vm');
const src = require('./helpers/sources');

const { read } = src;
const listHtml = read('src/list.html'); const noteHtml = read('src/note.html');

// ---- short
for (const m of (listHtml + noteHtml).matchAll(/<(small|p class="(?:muted|hint|ehint)[^"]*")[^>]*>([^<]+)</g)) {
  assert.ok(m[2].length <= 130, `a hint in Settings or a pop-up is short (${m[2].length}): ${m[2]}`);
}
const box = { window: {} };
vm.runInNewContext(read('src/about.js'), box);
for (const f of box.window.COSMO_ABOUT.FEATURES) for (const it of f.items) assert.ok(it.length <= 140, `a feature item is short (${it.length}): ${it}`);
const lockCode = read('src/list/actions-locks.js');
for (const gone of ['weak spot', '4 digits in seconds', 'Since this update', 'not even CosmoNotes', 'written back in plain text']) {
  assert.ok(!lockCode.includes(gone), `the long locked-note text is gone: "${gone}"`);
}

// ---- the owner's wording
assert.ok(!/wait here/.test(listHtml + src.list()), 'no "wait here" left in the Bin');
assert.ok(listHtml.includes('<p class="bintip">You can restore these notes, or delete them for good.</p>'), 'the tip above the Bin');
assert.ok(src.list().includes("emptyState('The bin is empty', 'Deleted notes show up here.')"), 'the empty Bin');
assert.ok(listHtml.includes('<span><b>Start with Windows</b></span>'), 'Start with Windows: no text below');
assert.ok(listHtml.includes('<span><b>Colour Theme</b></span>'), 'Colour Theme: renamed, no text below');
assert.ok(!listHtml.includes('by the clock'), 'Pause all effects: no "by the clock"');
assert.ok(listHtml.includes('Also with the sparkle button, or the CosmoNotes icon.</small>'));
for (const [f, html] of [['note.html', noteHtml], ['list.html', listHtml]]) {
  assert.ok(html.includes('Mouse can interact with the background') && !html.includes('Mouse plays with the background'), `${f}: the switch’s name`);
}
console.log('ok');
