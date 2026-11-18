'use strict';
// Rules for the note window's own code (src/note/, read as text) where no browser test clicks through yet
// (note-ui.test.js does the text toolbar and word wrap). Each line names the owner's request or the trap it guards:
// checklist boxes (measured values never saved, measured all at once), Backspace / Delete next to boxes and photos,
// the photo menu, ticked photos struck through, find with Ctrl+F (nothing of it saved), picture descriptions, joining
// lines keeps their formatting, the text panel keeps the selection, a toolbar window never keeps the focus.
const assert = require('assert');
const src = require('./helpers/sources');

const nj = src.note();
const nc = src.css('note');
const nh = src.read('src/note.html');
const between = (a, b) => nj.slice(nj.indexOf(a), nj.indexOf(b));
assert.ok(nj.indexOf('function collect()') > 0 && nj.indexOf('function collect()') < nj.indexOf('function changed()'), '(collect() comes before changed())');
assert.ok(nj.indexOf('function alignChecks()') > 0 && nj.indexOf('function alignChecks()') < nj.indexOf('function paintStrikes()'), '(alignChecks() comes before paintStrikes())');

// ---- checklist boxes follow their line's first words; the measured values are never saved; measured all at once
assert.ok(/top: var\(--cb-t, \.3em\)/.test(nc) && /width: var\(--cb-s, 1em\)/.test(nc), 'box size / place from --cb-*');
assert.ok(/for \(const v of (K\.)?CB_VARS\) el\.style\.removeProperty\(v\)/.test(nj), 'collect() strips the measured values');
const al = between('function alignChecks()', 'function paintStrikes()');
assert.ok(/out\.push\(\[li, size, top, pad\]\)/.test(al) && al.indexOf('setVar(li') > al.indexOf('out.push'), 'checklist boxes: measure all lines, then write (no layout per line per key)');
// 1.4.12 (the owner's wish): a font changes no size. Every note font has one text size, line height and box; the letters
// are matched by font-size-adjust; a font tag's size= is its only size; the box = the words' size × BOX (no per-font table).
{
  assert.ok(!/data-font="\w+"\]\[data-size/.test(nc) && /body\[data-size="m"\] \{ --fs: 15\.5px; \}/.test(nc), 'one --fs for every note font');
  assert.ok(/#editor \{[^}]*font-size-adjust: \.484;[^}]*line-height: 1\.45;/.test(nc), 'the editor matches every font\'s letters (font-size-adjust)');
  assert.ok(!/data-font="\w+"\] #editor[^{]*\{[^}]*(line-height|font-size|width|padding)/.test(nc), 'no note font has its own line height, size or box');
  assert.ok(!/--kf|--sm\b|--k\b/.test(nc) && !/--kf/.test(nj), 'the per-font resize (--kf, 1.3.15-1.4.11) is gone');
  assert.ok(!/#editor font[^{]*\{[^}]*font-size: calc/.test(nc) && !/#editor font\[face[^{]*\{[^}]*font-size/.test(nc), 'no font tag sets its own font-size (it would beat size=)');
  assert.ok(/#editor font \{ line-height: 1\.3; \}/.test(nc), 'a font tag\'s line height is under the line\'s: a font change keeps the line\'s height');
  const box = JSON.parse(/const BOX = (\{.*?\});/.exec(nj)[1].replace(/(\w+):/g, '"$1":').replace(/: \./g, ': 0.'));
  const em = (re) => Number((re.exec(nc) || [])[1]);
  assert.equal(box.k, em(/#editor ul\.checklist li::before \{[^}]*width: var\(--cb-s, ([.\d]+)em\)/), 'box = CSS');
  assert.equal(box.pad, em(/#editor ul\.checklist li \{ position: relative; padding-left: var\(--cb-p, ([.\d]+)em\)/), 'indent = CSS');
}

// ---- Backspace / Delete
assert.ok(/checkLineStart\(s\)/.test(nj) && /execCommand\('outdent'\)/.test(nj), 'Backspace at the start of a checklist line takes the box away');
assert.ok(/leafAfter\(r\.startContainer, r\.startOffset\)/.test(nj) && /leaf\.nodeName === 'IMG'/.test(nj), 'Delete before a photo deletes it');
assert.ok(!/sel\.remove\(\); changed\(\);/.test(nj), 'a picked photo is deleted with the browser’s delete (so Ctrl+Z brings it back)');
assert.ok(/function joinLines\(A, B, from\)/.test(nj) && /execCommand\(html \? 'insertHTML' : 'delete'/.test(nj), 'Delete / Backspace between two lines joins them with the words as they were');

// ---- photos
assert.ok(nj.indexOf("label: 'Copy image'") > 0 && nj.indexOf("label: 'Copy image'") < nj.indexOf("label: 'Open in photo viewer'") && !/Open full size'/.test(nj), 'photo menu: Copy image above Open in photo viewer');
assert.ok(/#strikes > i/.test(nc) && /li\.done img/.test(nj), 'ticked photos are struck through');
assert.ok(/Add description…/.test(nj) && /IMG: \['src', 'alt', 'title'\]/.test(nj), 'right-click → Add description; pasting keeps it');

// ---- find (Ctrl+F): highlights without changing the text; nothing of it is saved
assert.ok(/e\.key\.toLowerCase\(\) === 'f'\) \{ e\.preventDefault\(\);/.test(nj), 'Ctrl+F opens find');
assert.ok(/CSS\.highlights\.set\('cn-find'/.test(nj) && /::highlight\(cn-find-cur\)/.test(nc), 'matches are highlighted without changing the text');
assert.ok(['find', 'findMarks', 'findPrev', 'findNext'].every((id) => nh.includes(`id="${id}"`)), 'find bar with up / down and the scrollbar marks');
assert.ok(!/cn-find|findMarks/.test(between('function collect()', 'function changed()')), 'nothing of it is saved');
assert.ok(/parts\.push\(\{ img: n, at: all\.length \}\)/.test(nj), 'Ctrl+F finds pictures by their description');
assert.ok(/clone\.querySelectorAll\('\.find-hit, \.find-cur'\)/.test(nj), 'the find outline is never saved');

// ---- the text panel, the Effects pop-up, toolbar windows
assert.ok(/const keep = (V\.)?savedRange && !(V\.)?savedRange\.collapsed/.test(nj), 'opening the text panel puts the selection back');
assert.ok(!nh.includes('id="fxColors"') && !nh.includes('id="fxOpacity"') && nh.includes('id="btnCloseAll"'), 'Effects: no colour or see-through (1.1.22), a close-all button');
assert.ok(/item\(null, 'Same as all'/.test(nj) && /add\(null, 'Same as all'/.test(src.list()), 'the short "Same as all" (note and list)');
assert.ok(/if \(win\.isFocused\(\)\) setTimeout\(\(\) => \{ if \(!win\.isDestroyed\(\)\) win\.webContents\.focus\(\); \}, 0\);/.test(src.main()), 'a toolbar window never keeps the focus from its note');
// 1.4.13 (the owner's wish): the checklist boxes are static: worked out from sizes only, never from the letters or a font
{
  const ac = nj.slice(nj.indexOf('function alignChecks()'), nj.indexOf('function paintStrikes()'));
  assert.ok(!/getClientRects|getBoundingClientRect|createRange|fontFamily/.test(ac), 'alignChecks measures no letters and reads no font');
  const tbl = (name) => new Function(`return ${new RegExp(`const ${name} = (\\{[^;]*\\});`).exec(nj)[1]}`)();
  const sizes = Object.fromEntries([...nc.matchAll(/#editor font\[size="(\d)"\] \{ font-size: ([.\d]+)em; \}/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(tbl('SIZE'), sizes, 'SIZE = note-text.css font[size]');
  const tags = tbl('TAG_SIZE');
  assert.ok(/#editor h1, #editor h2, #editor h3, #editor h4 \{ font-size: 1\.2em;/.test(nc) && tags.H1 === 1.2 && tags.H4 === 1.2, 'headings = CSS');
  assert.ok(/#editor code, #editor pre \{[^}]*font-size: \.8em;/.test(nc) && tags.CODE === 0.8 && tags.PRE === 0.8, 'code = CSS');
  const lh = tbl('LINE_H');
  assert.ok(new RegExp(`#editor \\{[^}]*line-height: ${lh.line};`).test(nc) && new RegExp(`#editor font \\{ line-height: ${lh.font}; \\}`).test(nc), 'LINE_H = CSS');
}

console.log('ok');
