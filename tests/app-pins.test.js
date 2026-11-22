'use strict';
// App pins (1.4.5, main/app-pin.js): a note pinned over some apps mirrors its app: on top while one of them is in front,
// on screen just above its app while another app is in front, minimised (in the taskbar) while it is closed or minimised. Here: reading window titles (app + workspace / file, browsers get no parts), store.js cleaning pinApps
// (unpinning forgets them, a whole app covers its parts, not an edit), the watch (only while such a note is open; our own
// windows are skipped; front = the first window left), minimise / show (the window stays open; a click on it in the taskbar brings it back until the focus leaves), a peek (opened from the list,
// Bring notes to front, until another window comes in front), a ringing reminder and a focused note show, a list that
// can't be read shows every note, the animation (fades in dropping into place, out rising; the saved place never changes), enforcePinned leaves a hidden one hidden, the list's card, a hidden locked note, pin:apps.
// main/app-pin.js check() is called by hand, so nothing waits for its clock. The note window's list: note-ui-pins.test.js.
const assert = require('assert');
const app = require('./helpers/app');

(async () => {
  const { H, E, ev, tick } = await app.start();
  const P = require('../main/app-pin');
  const { normalize } = require('../store');
  const { S } = require('../main/state');
  P.ANIM.in = P.ANIM.out = 0; // at once, except in the part about the animation
  const wait = (ms) => new Promise((r) => { const t0 = Date.now(); const f = () => (Date.now() - t0 >= ms ? r() : setTimeout(f, 10)); f(); }); // (real time: the test's clock runs 10× faster from 100 ms)

  // ---- window titles
  const t = (x) => { const p = P.parseTitle(x); return p && [p.app, p.part, p.segs.join('|')]; };
  assert.deepEqual(t('● index.html - ShopWebsite - Visual Studio Code'), ['Visual Studio Code', 'ShopWebsite', 'index.html|ShopWebsite'], 'VS Code: file - folder - app (the dot of an unsaved file dropped)');
  assert.deepEqual(t('ShopWebsite - Visual Studio Code'), ['Visual Studio Code', 'ShopWebsite', 'ShopWebsite'], 'no file open: the folder');
  assert.deepEqual(t('Budget.xlsx - Excel'), ['Excel', 'Budget.xlsx', 'Budget.xlsx'], 'file - app');
  assert.deepEqual(t('Calculator'), ['Calculator', null, ''], 'just an app');
  assert.deepEqual(t('Inbox (3) - you@mail.com - Gmail - Google Chrome'), ['Google Chrome', null, ''], 'a browser: no parts (its tab changes)');
  assert.deepEqual(t('New tab and 2 more pages - Personal - Microsoft​ Edge'), ['Microsoft Edge', null, ''], 'Edge, with its zero-width space');
  assert.deepEqual(t('notes.txt – Notepad'), ['Notepad', 'notes.txt', 'notes.txt'], 'an en dash too');
  assert.equal(P.parseTitle('   '), null);
  const vs = P.parseTitle('main.js - CosmoNotes - Visual Studio Code');
  assert.ok(P.matches({ app: 'visual studio code', part: null }, vs) && P.matches({ app: 'Visual Studio Code', part: 'cosmonotes' }, vs), 'an app, any case; its workspace');
  assert.ok(!P.matches({ app: 'Visual Studio Code', part: 'ShopWebsite' }, vs) && !P.matches({ app: 'Excel', part: null }, vs) && !P.matches({ app: 'Excel', part: null }, null));

  // ---- store.js: cleaned, kept only while pinned, a whole app covers its parts
  const c = (n) => normalize({ id: 'x', ...n }).pinApps;
  assert.deepEqual(c({ pinned: true, pinApps: [{ app: ' Visual  Studio Code ', part: 'Shop' }, { app: 'Excel', part: '' }, { app: 'excel' }, { app: '' }, 'junk', { app: 'Excel', part: 'B.xlsx' }] }),
    [{ app: 'Visual Studio Code', part: 'Shop' }, { app: 'Excel', part: null }], 'spaces tidied, the same app once, a whole app drops its parts, junk out');
  assert.deepEqual(c({ pinned: false, pinApps: [{ app: 'Excel' }] }), [], 'not pinned: no apps');
  assert.deepEqual(c({ pinned: true }), [], 'an older note: none');

  // ---- a note pinned over VS Code: ShopWebsite
  const id = await app.newNote({ html: '<p>SQL tips</p>' });
  const w = app.winOf(id);
  const hw = (x) => String(5000 + x.id); // the fake window's handle
  const VS = { id: 'window:111:0', name: 'index.html - ShopWebsite - Visual Studio Code' };
  const VS2 = { id: 'window:112:0', name: 'Other - Visual Studio Code' };
  const CHROME = { id: 'window:222:0', name: 'Search - Google Chrome' };
  const XL = { id: 'window:333:0', name: 'Budget.xlsx - Excel' };
  const front = async (...list) => { E.__sources = list; await P.check(); };
  E.__sources = [VS, CHROME];
  assert.ok(!P.watching(), 'no note pinned over apps: nothing watches');
  const before = (await app.card(id)).updatedAt;
  await tick(5);
  let v = await H['note:update'](ev(w), { pinApps: [{ app: 'Visual Studio Code', part: 'ShopWebsite' }] });
  assert.ok(v.pinned && w.top, 'pinning over an app pins the note');
  assert.deepEqual(v.pinApps, [{ app: 'Visual Studio Code', part: 'ShopWebsite' }]);
  assert.equal(S.store.get(id).updatedAt, before, 'not an edit');
  assert.ok(P.watching(), 'the watch started');
  // the clock rests while one of our windows has the focus: moving a note hitched on every check (seen on a real PC)
  assert.ok(P.ticking(), 'the focus is in another app: the clock ticks');
  w.focused = true; E.app.emit('browser-window-focus', {}, w);
  assert.ok(!P.ticking(), 'a note has the focus (moved, typed in): no checks');
  E.app.emit('browser-window-blur', {}, w); await tick(5);
  assert.ok(!P.ticking(), 'a blur while one of ours still has the focus (it went to another of our windows): still resting');
  w.focused = false;
  const calls = E.desktopCapturer.calls;
  E.app.emit('browser-window-blur', {}, w); await tick(5);
  assert.ok(P.ticking() && E.desktopCapturer.calls > calls, 'the focus went to another app: a check at once, and the clock again');
  // it mirrors its app: in front = on top; open behind another app = on screen, just above its app; closed or
  // minimised (not in the list) = minimised too (1.4.28: in the taskbar, not hidden), back when it opens again
  const top = () => w.isVisible() && w.top && !w.appBehind;
  const under = (src) => w.isVisible() && !w.top && w.appBehind && w.above === src.id;
  await front({ id: `window:${hw(w)}:0`, name: 'SQL tips' }, VS, CHROME);
  assert.ok(top(), 'VS Code with ShopWebsite in front (our own note skipped): on top');
  await front(CHROME, VS);
  assert.ok(under(VS), 'Chrome in front, VS Code open behind it: the note stays, just above VS Code, not on top');
  await front(VS2, CHROME, VS);
  assert.ok(under(VS), 'another VS Code folder in front: the same');
  await front(VS, CHROME);
  assert.ok(top(), 'VS Code in front again: on top');
  await front(CHROME);
  const away = () => w.minimized && w.appHidden && !w.destroyed;
  assert.ok(away(), 'VS Code closed or minimised: minimised, not closed');
  assert.ok(w.visible, 'in the taskbar (minimised, not hidden: hidden looked closed)');
  assert.ok(S.store.get(id).open, 'still open');
  await front(VS2);
  assert.ok(away(), 'only another VS Code folder open: still minimised');
  // ---- a click on it in the taskbar while its app is away: back, on top, until the focus leaves
  w.restore(); w.focused = true;
  assert.ok(top() && !w.appHidden, 'brought back from the taskbar: on screen, on top');
  assert.ok(!w.minimizable, 'and not minimisable again (only its own button and app pins minimise it)');
  w.focused = false; E.app.emit('browser-window-blur', {}, w); await tick(5); await P.check();
  assert.ok(away(), 'the focus left and its app is still away: minimised again');
  await front(CHROME, VS);
  assert.ok(under(VS), 'ShopWebsite opens again (behind Chrome): back, just above it');
  await front(VS);
  assert.ok(top(), 'and on top once it is in front');
  // ---- the animation (the owner's pick: "Drop in"): it fades in while dropping 10 px into place, fades out rising
  P.ANIM.in = 180; P.ANIM.out = 130;
  const home = { ...w.bounds };
  const saved = JSON.stringify(S.store.get(id).bounds);
  await front(CHROME);
  assert.ok(w.isVisible() && w.appHidden, 'going: still on screen while it fades');
  await wait(70);
  assert.ok(w.opacity > 0 && w.opacity < 1 && w.bounds.y < home.y && w.bounds.y >= home.y - 10, `half-way: fading and rising (${w.opacity}, ${w.bounds.y})`);
  await wait(150);
  assert.ok(away() && w.opacity === 1 && w.bounds.y === home.y, 'gone: minimised, put back in its place, its see-through back');
  await front(VS);
  assert.ok(w.isVisible() && !w.minimized && w.opacity < 0.5 && w.bounds.y <= home.y - 5, 'coming: on screen at once (restored), clear and a little higher');
  await wait(260);
  assert.ok(w.isVisible() && w.opacity === 1 && w.bounds.y === home.y && w.bounds.x === home.x, 'in its place');
  await front(CHROME); await wait(50); await front(VS); await wait(260);
  assert.ok(w.isVisible() && w.opacity === 1 && w.bounds.y === home.y, 'turned back half-way: it comes back from where it was');
  await wait(400);
  assert.equal(JSON.stringify(S.store.get(id).bounds), saved, 'its saved place never changed');
  P.ANIM.in = P.ANIM.out = 0;

  const card = await app.card(id);
  assert.ok(card.appPinned && card.pinApps.length === 1, 'the list knows (its card says "Over …")');

  // ---- enforcePinned (every 2.5 s) leaves a hidden one hidden, and one behind its app behind
  await front(CHROME);
  require('../main/note-window').enforcePinned();
  assert.ok(!w.isVisible(), 'enforcePinned doesn’t bring it back');
  await front(CHROME, VS);
  require('../main/note-window').enforcePinned();
  assert.ok(under(VS), 'nor on top');
  await H['note:update'](ev(w), { opacity: 0.8 });
  assert.ok(under(VS), 'other changes keep it behind (applyState)');
  await H['note:update'](ev(w), { opacity: 1 });

  // ---- a whole app, two apps
  await H['note:update'](ev(w), { pinApps: [{ app: 'Visual Studio Code', part: null }, { app: 'Excel', part: null }] });
  await front(VS2); assert.ok(top(), 'any VS Code window');
  await front(XL); assert.ok(top(), 'or Excel');
  await front(CHROME, XL, VS); assert.ok(under(XL), 'both behind Chrome: just above the nearer one');
  await front(CHROME); assert.ok(!w.isVisible(), 'neither open: hidden');
  await front(); assert.ok(!w.isVisible(), 'nothing open: hidden');

  // ---- shows anyway: its window has the focus (ticking its list), a reminder rings, the list can't be read
  await front(VS); w.focused = true;
  await front(CHROME); assert.ok(top(), 'the focused note never hides'); w.focused = false;
  await front(CHROME); assert.ok(!w.isVisible());
  S.store.get(id).reminders = [{ id: 'r1', start: Date.now(), at: Date.now(), repeat: null, firing: true, count: 1, target: 'note' }];
  await front(CHROME); assert.ok(top(), 'a reminder rings: it shows, on top');
  S.store.get(id).reminders = [];
  await front(CHROME); assert.ok(!w.isVisible());
  E.__sourcesFail = true; await P.check();
  assert.ok(w.isVisible(), 'the list can’t be read: every note shows (a broken check never hides notes)');
  E.__sourcesFail = false; await front(CHROME); assert.ok(!w.isVisible(), 'and hides again once it can');

  // ---- a peek: opened from the list it shows over whatever is in front, until another window comes in front
  await H['list:open-note']({}, id);
  assert.ok(w.isVisible() && w.peek, 'opened from the list: it shows');
  await front(CHROME); assert.ok(w.isVisible(), 'Chrome still in front: it stays');
  await front(XL); assert.ok(w.isVisible() && !w.peek, 'Excel came in front (one of its apps): the peek is over, it stays');
  await front(CHROME); assert.ok(!w.isVisible(), 'Chrome: hidden again');
  await H['list:bring-front']();
  assert.ok(w.isVisible(), 'Bring notes to front: it comes up too');
  await front(CHROME); assert.ok(w.isVisible(), 'until another window comes in front');
  await front({ id: 'window:444:0', name: 'Spotify' }); assert.ok(!w.isVisible());
  await front(CHROME, XL); assert.ok(under(XL));
  await H['list:open-note']({}, id);
  assert.ok(top(), 'opened from the list while behind its app: on top at once');
  await front(XL); assert.ok(top());

  // ---- unpinning: the apps are forgotten, it shows again; the watch stops
  v = await H['note:update'](ev(w), { pinned: false, clickThrough: false });
  assert.ok(!v.pinned && v.pinApps.length === 0 && w.isVisible() && !w.top && !w.appBehind, 'unpinned: back, apps forgotten');
  assert.ok(!P.watching(), 'the watch stopped');
  v = await H['note:update'](ev(w), { pinned: true });
  assert.ok(v.pinned && v.pinApps.length === 0, 'a normal pin again: on top everywhere');
  await front(CHROME); assert.ok(w.isVisible());

  // ---- a note that opens pinned over apps waits for the first check (no flash), and the watch stops when it closes
  await H['note:update'](ev(w), { pinApps: [{ app: 'Excel', part: null }] });
  await H['list:close-note']({}, id);
  await tick(5);
  assert.ok(!P.watching(), 'its window closed: nothing watches');
  E.__sources = [CHROME];
  await H['list:open-note']({}, id); // opened from the list: a peek
  await tick(5);
  const w2 = app.winOf(id);
  assert.ok(w2.isVisible(), 'from the list it shows at once');
  await front(CHROME); await front(XL); await front(CHROME);
  assert.ok(!w2.isVisible(), 'then follows Excel');
  S.store.get(id).open = true;
  E.app.emit('second-instance'); // (not a list open: brings notes up = a peek)
  assert.ok(w2.isVisible());
  // opened some other way (a start of CosmoNotes) while Excel is open behind Chrome: on screen just above Excel, not on
  // top (shown once the watch's first check knows; the check runs as the window is made)
  await H['list:close-note']({}, id);
  await tick(5);
  E.__sources = [CHROME, XL];
  require('../main/note-window').openNoteWindow(S.store.get(id));
  await tick(5);
  const w3 = app.winOf(id);
  await P.check();
  assert.ok(w3.isVisible() && !w3.top && w3.above === XL.id, 'just above Excel, not on top');
  // opened that way while none of its apps is open: it starts minimised (in the taskbar), and shows when Excel opens
  await H['list:close-note']({}, id);
  await tick(5);
  E.__sources = [CHROME];
  require('../main/note-window').openNoteWindow(S.store.get(id));
  await tick(5);
  const w4 = app.winOf(id);
  await P.check(); await tick(5);
  assert.ok(w4.minimized && w4.visible && w4.appHidden, 'Excel not open: it starts minimised');
  await front(XL);
  assert.ok(w4.isVisible() && w4.top && !w4.appHidden, 'Excel in front: it shows');
  await front(CHROME, XL);
  S.store.get(id).open = true;

  // ---- pin:apps: the open apps once each, A to Z, with their parts (none for a browser); our windows left out
  E.__sources = [{ id: `window:${hw(w4)}:0`, name: 'SQL tips' }, VS2, XL, CHROME, VS, { id: 'window:555:0', name: 'b.xlsx - excel' }];
  const apps = await H['pin:apps'](ev(w4));
  assert.deepEqual(apps, [{ app: 'Excel', parts: ['b.xlsx', 'Budget.xlsx'] }, { app: 'Google Chrome', parts: [] }, { app: 'Visual Studio Code', parts: ['Other', 'ShopWebsite'] }]);
  E.__sourcesFail = true;
  assert.equal(await H['pin:apps'](ev(w4)), null, 'can’t be read: null (the note says so)');
  E.__sourcesFail = false;
  assert.equal(await H['pin:apps']({ sender: {} }), null, 'only a note window asks');

  // ---- a hidden locked note: it may be pinned over apps (a kind of pin), the list doesn't get the names
  await H['lock:set'](null, { current: '', next: '1234', kind: 'pin' });
  await H['list:set-locked'](null, id, true, '1234');
  await tick(20);
  await H['note:relock'](ev(w4)); // (what its window does on note:lock-now)
  v = await H['note:update'](ev(w4), { pinApps: [{ app: 'Notepad', part: 'secret plan.txt' }], html: '<p>no</p>' });
  assert.deepEqual(S.store.get(id).pinApps, [{ app: 'Notepad', part: 'secret plan.txt' }], 'pinned over an app while hidden');
  assert.ok(!S.store.get(id).html.includes('no'), 'nothing else changes');
  const lc = await app.card(id);
  assert.ok(lc.appPinned && lc.pinApps.length === 0, 'its card only knows that it is pinned over apps');

  await app.quit();
})();
