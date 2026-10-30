// 1.1.23: the owner's notes after 1.1.22 (28–30 October 2026): checklist boxes sized and centred to their text, Backspace /
// Delete fixes, Copy image, struck-through ticked pictures, uniform effect choices, small card pictures, card menu order,
// a calm Analog monitor whose lines part round the pointer, the Cauldron's soft dip, Ctrl+F, Warp speed's hyperdrive in
// the middle, a light paper tint on effects and picture descriptions.
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const vm = require('vm');
assert.equal(require('../package.json').version, '1.1.23');

// ---- the effects
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const sandbox = { window: { devicePixelRatio: 1 }, document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: fakeCtx }) }, performance: { now: () => 0 }, requestAnimationFrame: () => 0, setTimeout, clearTimeout, Math, Object, Array, JSON, Number, Float32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8'), sandbox);
const FX = sandbox.window.COSMO_FX;
function recorder() {
  const bad = []; const calls = [];
  const check = (name, args) => { calls.push([name, args]); for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`); };
  const grad = { addColorStop: (...a) => check('addColorStop', a) };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { check(String(k), a); return String(k).startsWith('create') ? grad : undefined; }),
    set: (t, k, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`); t[k] = v; return true; },
  });
  return { ctx, bad, calls };
}
const seeded = (n = 7) => { let s = n; const old = Math.random; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; return () => { Math.random = old; }; };
const PAL = (dark) => (dark ? FX.PALETTES.dark : FX.PALETTES.light);
const ptr = (x, y, vx = 0, vy = 0) => ({ x, y, vx, vy, sp: Math.hypot(vx, vy) });


// ---- eighth round: Analog monitor and Cauldron
{
  // seventh round: the pointer opens a gap in the lines where it is (also at rest) and it closes when it leaves; no springs
  const src = FX.EFFECTS.glitch.make.toString();
  assert.ok(!/fringe|blobs|RED|CYAN|Float32Array/.test(src), 'analog monitor: no blobs, fringe or springy lines');
  // the y of every drawn line near x = 170 (straight lines are rect(), bent ones line segments)
  const linesAt = (e, X) => {
    const ys = []; let last = null;
    const spy = new Proxy({}, { get: (t, k) => (k === 'rect' ? (x, y, w2) => { if (x <= X && x + w2 >= X) ys.push(y); } : k === 'moveTo' ? (x, y) => { last = [x, y]; } : k === 'lineTo' ? (x, y) => { if (last && last[0] <= X && x >= X) ys.push(last[1] + (y - last[1]) * ((X - last[0]) / ((x - last[0]) || 1)) - .5); last = [x, y]; } : k in t ? t[k] : (String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    e.draw(spy, 0); return ys.sort((p1, p2) => p1 - p2);
  };
  const gapAround = (ys, y) => { const above = ys.filter((v) => v < y).pop(); const below = ys.find((v) => v >= y); return below - above; };
  const e = FX.EFFECTS.glitch.make(340, 280, PAL(true), true, .0001); // the scan line stays away
  for (let i = 0; i < 30; i++) e.step(1 / 30, i / 30, null);
  const calm = gapAround(linesAt(e, 170), 140);
  for (let i = 0; i < 30; i++) e.step(1 / 30, 1 + i / 30, ptr(170, 140)); // the pointer rests there
  const open = gapAround(linesAt(e, 170), 140); const far = gapAround(linesAt(e, 20), 140);
  assert.ok(calm <= 6.01, `lines every 6 px (${calm.toFixed(1)})`);
  assert.ok(open >= 20, `a resting pointer opens a gap (${open.toFixed(1)} px between the lines round it)`);
  assert.ok(far <= 6.6, `far to the side the lines stay as they are (${far.toFixed(1)})`);
  for (let i = 0; i < 15; i++) e.step(1 / 30, 2 + i / 30, null);
  assert.ok(gapAround(linesAt(e, 170), 140) <= 6.01, 'and it closes again within half a second of leaving');
  // the lines crawl slowly (3 px a second)
  const y0 = linesAt(e, 300)[2]; e.step(1, 4, null); const y1 = linesAt(e, 300).find((v) => v > y0 - .01);
  assert.ok(Math.abs((y1 - y0) - 3) < .2, `lines crawl 3 px/s (${(y1 - y0).toFixed(2)})`);
}
{
  // ONE scan line, slow (8 s to cross), and Frequency = how often it comes
  const sweeps = (k) => {
    const e = FX.EFFECTS.glitch.make(340, 280, PAL(true), true, k); let n = 0; let was = false; let most = 0; let g = 0;
    const spy = new Proxy({}, { get: (t, key) => (key === 'createLinearGradient' ? () => { g++; return { addColorStop() {} }; } : key in t ? t[key] : () => {}), set: (t, key, v) => { t[key] = v; return true; } });
    for (let i = 0; i < 2 * 300; i++) { e.step(.5, i * .5, null); g = 0; e.draw(spy, i * .5); most = Math.max(most, g); if (g && !was) n++; was = g > 0; }
    return { n, most };
  };
  const rarely = sweeps(.18); const normal = sweeps(1); const often = sweeps(3.6);
  assert.equal(Math.max(rarely.most, normal.most, often.most), 1, 'only one scan line at a time');
  assert.ok(rarely.n >= 3 && rarely.n <= 6, `rarely: about every 75 s (${rarely.n} in 5 min)`);
  assert.ok(normal.n >= 10 && normal.n <= 15, `normal: about every 24 s (${normal.n} in 5 min)`);
  assert.ok(often.n >= 20 && often.n <= 28, `often: about every 12 s (${often.n} in 5 min)`);
}
{
  // Cauldron (mouse interacts): a soft dip under the pointer, no quick sideways wave and no swirl
  const src = FX.EFFECTS.cauldron.make.toString();
  assert.ok(!/ellipse|stir\.ph|stir\.dir/.test(src), 'cauldron: no whirlpool, no wave');
}
// ---- seventh round : note editing and the list
{
  const nj = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.js'), 'utf8');
  const nc = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.css'), 'utf8');
  const lj = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.js'), 'utf8');
  const lc = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.css'), 'utf8');
  // checklist boxes follow their line's first words; the measured values are never saved
  assert.ok(/top: var\(--cb-t, \.3em\)/.test(nc) && /width: var\(--cb-s, \.78em\)/.test(nc), 'box size / place from --cb-*');
  assert.ok(/for \(const v of CB_VARS\) el\.style\.removeProperty\(v\)/.test(nj), 'collect() strips the measured values');
  // Backspace at the start of a checklist line takes the box away; Delete / Backspace next to a photo removes it
  assert.ok(/checkLineStart\(s\)/.test(nj) && /execCommand\('outdent'\)/.test(nj), 'Backspace at a line start removes the box');
  assert.ok(/leafAfter\(r\.startContainer, r\.startOffset\)/.test(nj) && /leaf\.nodeName === 'IMG'/.test(nj), 'Delete before a photo deletes it');
  assert.ok(!/sel\.remove\(\); changed\(\);/.test(nj), 'a picked photo is deleted with the browser’s delete (undoable)');
  // photos: Copy image above "Open in photo viewer"
  assert.ok(nj.indexOf("label: 'Copy image'") > 0 && nj.indexOf("label: 'Copy image'") < nj.indexOf("label: 'Open in photo viewer'") && !/Open full size'/.test(nj), 'photo menu');
  assert.ok(/#strikes > i/.test(nc) && /li\.done img/.test(nj), 'ticked photos are struck through');
  // effect choices are all the same height
  assert.ok(/#fxPop \.fxlist \{ grid-auto-rows: 30px; \}/.test(nc) && /\.fxlist \{ grid-auto-rows: 38px; \}/.test(lc), 'uniform effect choices');
  assert.ok(/item\(null, 'Same as all'/.test(nj) && /add\(null, 'Same as all'/.test(lj), 'shorter "Same as all"');
  // card menu: favourites first, then Edit design; no "Open on desktop"
  const menu = lj.slice(lj.indexOf('function noteMenu'), lj.indexOf('function groupMenu'));
  assert.ok(!/'Open on desktop'|'Bring to front'/.test(menu), 'no Open on desktop');
  assert.ok(menu.indexOf('Add to favourites') < menu.indexOf('Edit design…') && menu.indexOf('Edit design…') < menu.indexOf('Duplicate note'), 'menu order');
  // a small picture on a card isn't blown up
  assert.ok(/function fitThumb/.test(lj) && /\.thumb\.small \{[^}]*width: auto; height: auto/.test(lc), 'small pictures keep their size');
}

// ---- ninth round : Warp speed hyperdrive in the middle; Ctrl+F in a note
{
  const src = FX.EFFECTS.warp.make.toString();
  assert.ok(!/sf\.vp\.x \+=/.test(src), 'warp: the pointer no longer steers where the stars come from');
  const blueAt = (e, t) => { let blue = false; const spy = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {})), set: (o, k, v) => { if (k === 'strokeStyle' && v === FX.PALETTES.dark.warp) blue = true; o[k] = v; return true; } }); e.draw(spy, t); return blue; };
  let hits = 0; let tries = 0;
  for (let seed = 1; seed <= 12; seed++) {
    // a twin with no pointer at all tells when the warp's own jump (every ~35 s) would come anyway
    let undo = seeded(seed); const twin = FX.EFFECTS.warp.make(340, 280, PAL(true), true, 1); undo();
    let own = false; for (let i = 0; i < 140; i++) { twin.step(.05, i * .05, null); if (blueAt(twin, i * .05)) own = true; }
    if (own) continue; tries++; // its own jump would get in the way of the check
    undo = seeded(seed); const e = FX.EFFECTS.warp.make(340, 280, PAL(true), true, 1); undo();
    for (let i = 0; i < 40; i++) e.step(.05, i * .05, null);
    for (let i = 0; i < 30; i++) e.step(.05, 2 + i * .05, ptr(170, 140)); // 1.5 s in the middle
    const inMid = blueAt(e, 4);
    for (let i = 0; i < 60; i++) e.step(.05, 4 + i * .05, ptr(20, 20)); // then 3 s near a corner
    if (inMid && !blueAt(e, 7)) hits++;
  }
  assert.ok(tries >= 3 && hits === tries, `warp: hyperdrive while the pointer is in the middle, back to cruising outside it (${hits}/${tries})`);
}
{
  const nj = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.js'), 'utf8');
  const nh = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8');
  const nc = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.css'), 'utf8');
  assert.ok(/e\.key\.toLowerCase\(\) === 'f'\) \{ e\.preventDefault\(\);/.test(nj), 'Ctrl+F opens find');
  assert.ok(/CSS\.highlights\.set\('cn-find'/.test(nj) && /::highlight\(cn-find-cur\)/.test(nc), 'matches are highlighted without changing the text');
  assert.ok(/id="find"/.test(nh) && /id="findMarks"/.test(nh) && /id="findPrev"/.test(nh) && /id="findNext"/.test(nh), 'find bar with up / down and the scrollbar marks');
  assert.ok(!/cn-find|findMarks/.test(nj.slice(nj.indexOf('function collect()'), nj.indexOf('function changed()'))), 'nothing of it is saved');
}

// ---- 1.1.23 (tenth round): Warp speed's middle a little smaller; each note's paper tints its effects a little; picture descriptions
{
  // hyperdrive only in a box 24 % of the note's width / height round the centre (was 31.6 %)
  assert.ok(/const BOX = \.12;/.test(FX.EFFECTS.warp.make.toString()), 'warp: a smaller middle');
}
{
  const light = FX.PALETTES.light; const blue = FX.paperPalette(false, 'blue'); const yellow = FX.paperPalette(false, 'yellow');
  assert.equal(FX.paperPalette(false, 'charcoal'), light, 'charcoal has no hue: no tint');
  assert.equal(FX.paperPalette(false, null), light, 'no paper: no tint');
  assert.equal(FX.paperPalette(false, 'blue'), blue, 'cached');
  const hue = (hex) => { const x = hex.slice(1); const [r, g, b2] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b2); const mn = Math.min(r, g, b2); const d = mx - mn; if (!d) return null; let h = mx === r ? ((g - b2) / d) % 6 : mx === g ? (b2 - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
  const turn = (a, b2) => { const d = Math.abs(a - b2) % 360; return d > 180 ? 360 - d : d; };
  let n = 0;
  for (const k of Object.keys(light)) {
    const v = light[k]; if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) continue;
    const h0 = hue(v); const h1 = hue(blue[k]); if (h0 === null || h1 === null) continue;
    n++; assert.ok(turn(h0, h1) <= 22, `${k}: only a little different (${turn(h0, h1).toFixed(1)}°)`);
  }
  assert.ok(n > 20, 'many inks checked');
  assert.notEqual(blue.heart, light.heart, 'a coloured ink does change'); assert.notEqual(blue.heart, yellow.heart, 'differently per paper');
  assert.equal(blue.brewHi, light.brewHi, 'white stays white');
  // every effect still draws fine on every paper
  for (const paper of ['yellow', 'blue', 'plum', 'forest']) for (const id of FX.EFFECT_IDS) {
    const dark = ['plum', 'forest'].includes(paper); const e = FX.EFFECTS[id].make(220, 180, FX.paperPalette(dark, paper), dark, 1); const { ctx, bad } = recorder();
    for (let i = 0; i < 20; i++) e.step(.05, i * .05, null); e.draw(ctx, 1); assert.deepEqual(bad, [], `${id} on ${paper}`);
  }
}
{
  const { pictureWords } = require('../store.js');
  assert.equal(pictureWords('<div>x<img class="att-img" src="a" alt="Plumber &amp; receipt" title="t"><img src="b"><img alt="" src="c"></div>'), 'Plumber & receipt');
  assert.equal(pictureWords('<p>none</p>'), ''); assert.equal(pictureWords(null), '');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/pics: hiddenInList\(n\) \? '' : pictureWords\(n\.html\)/.test(main), 'the list gets the descriptions (not for locked notes)');
  const lj = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.js'), 'utf8');
  assert.equal((lj.match(/\.pics \|\| ''\}`/g) || []).length, 4, 'every search in the list looks in them');
  const nj = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.js'), 'utf8');
  assert.ok(/Add description…/.test(nj) && /IMG: \['src', 'alt', 'title'\]/.test(nj), 'right-click → Add description; pasting keeps it');
  assert.ok(/parts\.push\(\{ img: n, at: all\.length \}\)/.test(nj), 'Ctrl+F finds pictures by their description');
  assert.ok(/clone\.querySelectorAll\('\.find-hit, \.find-cur'\)/.test(nj), 'the find outline is never saved');
}


// ---- speed (same version): lighter effects, slower computers step less often, no layout per checklist line per key
{
  const rb = FX.EFFECTS.rainbow.make.toString();
  assert.ok(!/c\.filter = 'blur/.test(rb), 'rainbow: no longer blurs the whole note every frame');
  assert.ok(/cur\.key/.test(rb) && /solidBow/.test(rb), 'rainbow: bands drawn and blurred once, the mask only laid again while it draws in');
  const fxsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'fx.js'), 'utf8');
  const glowDotSrc = fxsrc.slice(fxsrc.indexOf('function glowDot('), fxsrc.indexOf('function flake('));
  assert.ok(!/createRadialGradient/.test(glowDotSrc) && /stamp\(c, halo\(col\)/.test(glowDotSrc), 'glows are stamped from a ready picture');
  assert.equal((fxsrc.match(/createRadialGradient/g) || []).length, 4, 'gradients left: the glow picture itself, the warp flash, the healing pointer glow and the cauldron brew (one each a frame at most)');
  assert.equal(FX.loopPace(), 30, 'effects step 30 times a second on a normal machine');
  assert.ok(/const PACE = \[1 \/ 30, 1 \/ 20, 1 \/ 15\]/.test(fxsrc), '…and 20 or 15 on one that can’t keep up');
  const nj = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.js'), 'utf8');
  const al = nj.slice(nj.indexOf('function alignChecks()'), nj.indexOf('function paintStrikes()'));
  assert.ok(/out\.push\(\[li, size, top, pad\]\)/.test(al) && al.indexOf('setVar(li') > al.indexOf('out.push'), 'checklist boxes: measure all lines, then write');
  // every effect and follower still draws without errors
  for (const id of FX.EFFECT_IDS) { const e = FX.EFFECTS[id].make(300, 240, PAL(true), true, 1); const { ctx, bad } = recorder(); for (let i = 0; i < 60; i++) e.step(1 / 30, i / 30, i % 2 ? ptr(150, 120, 90, 0) : null); e.draw(ctx, 2); e.draw(ctx, 2.03); assert.deepEqual(bad, [], id); }
}

// ---- joining lines keeps their formatting; the text panel keeps the selection
{
  const nj = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.js'), 'utf8');
  assert.ok(/function joinLines\(A, B, from\)/.test(nj) && /execCommand\(html \? 'insertHTML' : 'delete'/.test(nj), 'Delete / Backspace between two lines joins them with the words as they were');
  assert.ok(/const keep = savedRange && !savedRange\.collapsed/.test(nj), 'opening the text panel puts the selection back');
  const mj = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/if \(win\.isFocused\(\)\) setTimeout\(\(\) => \{ if \(!win\.isDestroyed\(\)\) win\.webContents\.focus\(\); \}, 0\);/.test(mj), 'a toolbar window never keeps the focus from its note');
}
console.log('v1123 ok');
