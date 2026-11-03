'use strict';
// Pictures on the notes list's cards, in a real browser (tests/helpers/list-ui.js; 1.1.46): a card shows a note's first
// picture where it is among the words and as big as in the note (a small picture stays small), says when the note has
// more than the card shows (the bottom fades out; 1.1.48: strongly, and no "+3 lines"), also at another card size. (Where main says the
// picture is: picturePlace in store.test.js.)
const assert = require('assert');

(async () => {
  // pictures of a known size (an SVG says its own width and height)
  const pic = (w, h, fill) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`);
  const small = pic(130, 34, '#283C2D'); const big = pic(600, 400, '#5A8CC8');
  const ids = {};
  const ui = await require('./helpers/list-ui')(async (s) => {
    const make = async (key, o, pic) => {
      const id = await s.note({ ...o, open: true });
      const w = s.E.__all.find((x) => x.noteId === id && !x.destroyed);
      const text = o.html.replace(/<img[^>]*>/g, '').replace(/<\/(li|div|p)>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n+/g, '\n').trim();
      await s.H['note:update']({ sender: w.webContents }, { html: o.html, text: o.text ?? text, firstImage: pic });
      await s.H['list:close-note']({}, id);
      ids[key] = id;
    };
    const items = Array.from({ length: 12 }, (_, i) => `<li class="done">item ${i + 1}</li>`).join('');
    // like the owner's note: a long checklist, a small picture far down, more after it
    await make('far', { title: 'To do', html: `<ul class="checklist">${items}</ul><div><img class="att-img" width="110" src="${small}"></div><div>one more</div>` }, small);
    // a small picture between two lines: shown there, small
    await make('mid', { html: `<div>before</div><div><img class="att-img" width="110" src="${small}"></div><div>after</div>` }, small);
    // a big picture at the top, full width
    await make('top', { title: 'Photo', html: `<div><img class="att-img" src="${big}"></div><div>under it</div>` }, big);
    await make('short', { html: '<div>hello</div>' });
    await make('only', { html: `<div><img class="att-img" src="${big}"></div>`, text: '\u{1F5BC}️ Photo' }, big);
    // the picture is beyond the 600 letters the list gets: not on the card at all
    const long = Array.from({ length: 40 }, (_, i) => `<div>a fairly long line of words, number ${i + 1}</div>`).join('');
    await make('beyond', { html: `${long}<div><img class="att-img" width="110" src="${small}"></div>` }, small);
  });
  const { page } = ui;
  await ui.settle(400); // pictures load, cards measure again
  const card = (k) => ui.noteKey(ids[k]);
  const info = (k) => page.$eval(card(k), (c) => {
    const b = c.querySelector('.body'); const txt = b.querySelector('.txt');
    const kids = txt ? [...txt.children].map((x) => (x.tagName === 'IMG' ? 'IMG' : x.textContent.trim())) : [];
    const bottom = b.clientHeight;
    const fit = txt ? [...txt.querySelectorAll('.ln:not(.tt)')].filter((l) => l.offsetTop + l.offsetHeight <= bottom).length : 0;
    const pic = b.querySelector('.pic');
    return { kids, fit, more: b.classList.contains('more'),
      pic: pic ? { w: pic.offsetWidth, top: pic.offsetTop, visible: pic.offsetTop < bottom } : null, cardW: b.clientWidth,
      thumb: !!b.querySelector('.thumb.only'), dataPic: b.dataset.pic || '' };
  });

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  const far = await info('far');
  if (process.env.DBG) console.log(JSON.stringify(far));
  assert.ok(far.fit >= 4, `the long checklist shows more than two lines now (${far.fit})`);
  assert.equal(far.kids.indexOf('IMG'), 13, 'the picture sits after the twelve lines (and the title), like in the note');
  assert.ok(far.pic && !far.pic.visible, 'the picture is further down than the card shows: not seen');
  assert.ok(far.more, 'the bottom fades out');

  const mid = await info('mid');
  assert.deepEqual(mid.kids, ['before', 'IMG', 'after'], 'the picture between the same lines as in the note');
  assert.ok(mid.pic.w < mid.cardW * 0.8, `a small picture stays small (${mid.pic.w} of ${mid.cardW} px)`);
  assert.ok(!mid.more, 'everything fits: no fade');

  const top = await info('top');
  assert.deepEqual(top.kids, ['Photo', 'IMG', 'under it'], 'title, then the picture at the top, then the words');

  const short = await info('short');
  assert.ok(!short.more, 'a short note: no fade');

  const only = await info('only');
  assert.ok(only.thumb, 'a note that is only a picture still shows it big');

  const beyond = await info('beyond');
  assert.ok(!beyond.pic && beyond.dataPic === '0', 'a picture beyond what the list gets is not on the card');
  assert.ok(beyond.more, 'more than the list gets: it fades');

  // other card sizes: the cards are measured again, so the count follows the size
  await ui.click('#btnSize');
  await ui.click('#sizeSeg button[data-v="xxl"]');
  await ui.key('Escape'); await ui.settle(200);
  const bigger = await info('far');
  assert.ok(bigger.fit > far.fit && bigger.more, `a bigger card shows more lines (${bigger.fit}) and still fades`);
  assert.equal(await ui.count('.moretag'), 0, 'no "+3 lines" label on any card (the owner, 1.1.48)');
  const fade = /\.card \.body\.more \{[^}]*mask-image: linear-gradient\(to bottom, #000 calc\(100% - ([\d.]+)em\)/.exec(require('./helpers/sources').css('list'));
  assert.ok(fade && +fade[1] >= 3, 'the fade starts about two lines up (it was 1.7em: too faint on some papers, 1.1.48)');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT.replace(/\.png$/, '-xxl.png') });
  await ui.done();
  console.log('ok');
  process.exit(0);
})();
