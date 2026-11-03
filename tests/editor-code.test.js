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
assert.ok(/top: var\(--cb-t, \.3em\)/.test(nc) && /width: var\(--cb-s, \.78em\)/.test(nc), 'box size / place from --cb-*');
assert.ok(/for \(const v of (K\.)?CB_VARS\) el\.style\.removeProperty\(v\)/.test(nj), 'collect() strips the measured values');
const al = between('function alignChecks()', 'function paintStrikes()');
assert.ok(/out\.push\(\[li, size, top, pad\]\)/.test(al) && al.indexOf('setVar(li') > al.indexOf('out.push'), 'checklist boxes: measure all lines, then write (no layout per line per key)');

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
console.log('ok');
