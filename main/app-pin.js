'use strict';
// 1.4.5: app pins. Right-click a note's pin: a list of the open apps (and their workspaces / files) to tick. A note
// pinned over apps (note.pinApps, store.js cleanPinApps) mirrors its app (the owner's wish):
// - one of its apps is in front: the note is on top, like any pinned note ('top');
// - its app is open but another app is in front: the note stays on screen, but just above its app's window instead of
//   on top of everything (win.appBehind: not always-on-top, moveAbove the app's window), so the app in front covers it
//   like it covers the app ('behind');
// - its app is minimised or closed (no window of it in the list): the note is hidden ('hide'), and comes back when the
//   app (or that workspace) opens again. Its window is hidden (win.hide, win.appHidden), never closed: `open` stays true.
//
// Which windows are open: Electron's desktopCapturer lists the top-level windows with their titles, front to back
// (Windows' EnumWindows order; WebRTC, which makes the list, leaves out minimised and hidden windows). Our own windows
// (the notes are always on top, so they come first) are skipped by their handle; the first one left is the app in front.
// Nothing native, nothing for Smart App Control to block. Only the title is known (no program name), so the app is the
// title's last part ("main.js - ShopWebsite - Visual Studio Code") and its workspace / file the part before it
// (parseTitle). A browser gets no parts (its tab title changes on every page).
// Not confirmed on a real PC yet: the order of the list, that minimised windows are left out, and its cost. If the list
// can't be read (an error, or it takes over SLOW_MS), every note shows on top: a broken check must never make notes vanish.
// The clock (a check every POLL_MS) runs only while a note is pinned over apps AND the focus is in another app (1.4.7):
// reading the list is costly enough that moving a note hitched twice a second (seen on the owner's PC). While one of our
// windows has the focus, the app in front is ours and no other app can come in front until the focus leaves, so there is
// nothing to read; when it leaves, a check runs at once (focusMoved).
//
// Coming and going is animated (animate: it fades in while dropping into place, and fades out rising).
// On top anyway: a note whose window has the focus (you are ticking its list), one opened from the list or brought to
// front (win.peek: until another window comes in front), one whose reminder rings. One minimised with its own button
// is left alone.
const { app, BrowserWindow, desktopCapturer } = require('electron');
const REMIND = require('../src/reminders');
const { showInk } = require('./ink-window');
const { applyState } = require('./note-state');
const { S, wins } = require('./state');

const POLL_MS = 500;
const SLOW_MS = 3000;

// ------------------------------------------------------------------ window titles
const ZERO_WIDTH = /[​-‍⁠﻿]/g; // Edge writes "Microsoft​ Edge"
const SEP = /\s+[-–—]\s+/; // " - ", " – ", " — "
const BROWSERS = /^(google chrome|chrome|chromium|microsoft edge|edge|mozilla firefox|firefox|brave|opera|opera gx|vivaldi|arc|tor browser|zen browser|waterfox|librewolf)$/i;
// "● index.html - ShopWebsite - Visual Studio Code" → { app: 'Visual Studio Code', part: 'ShopWebsite', segs: ['index.html', 'ShopWebsite'] }
// part: the one before the app (3+ parts: file - folder - app), or the first of two (file - app); segs: every part but the app
function parseTitle(title) {
  const t = String(title || '').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const segs = t.split(SEP).map((s) => s.replace(/^[●•*]\s*/, '').trim()).filter(Boolean);
  if (!segs.length) return null;
  const app = segs.pop().slice(0, 80);
  const rest = BROWSERS.test(app) ? [] : segs.map((s) => s.slice(0, 120));
  return { app, part: rest.length ? rest[rest.length - 1] : null, segs: rest };
}
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
// a rule of note.pinApps ({ app, part }) and a window (parseTitle): the app, and the part anywhere in its title
const matches = (rule, w) => !!w && same(rule.app, w.app) && (!rule.part || w.segs.some((s) => same(s, rule.part)));
const appPinned = (n) => !!(n && n.pinned && Array.isArray(n.pinApps) && n.pinApps.length);

// ------------------------------------------------------------------ the windows that are open, front first
function handleOf(w) {
  try {
    const b = w.getNativeWindowHandle();
    return b.length >= 8 ? b.readBigUInt64LE(0).toString() : String(b.readUInt32LE(0));
  } catch { return null; }
}
function inTime(p) {
  let t = null;
  return Promise.race([p, new Promise((res, rej) => { t = setTimeout(() => rej(new Error('too slow')), SLOW_MS); })]).finally(() => clearTimeout(t));
}
async function openWindows() {
  const list = await inTime(desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }));
  const own = new Set(BrowserWindow.getAllWindows().map(handleOf).filter(Boolean));
  const out = [];
  for (const s of list || []) {
    const hwnd = String(s.id || '').split(':')[1] || '';
    if (own.has(hwnd)) continue;
    const p = parseTitle(s.name);
    if (p) out.push({ hwnd, ...p });
  }
  return out;
}
// the pin's list (pin:apps, ipc-notes.js): each open app once, A to Z, with its workspaces / files. null: can't tell
async function openApps() {
  let list;
  try { list = await openWindows(); } catch { return null; }
  const by = new Map();
  for (const w of list) {
    const k = w.app.toLowerCase();
    if (!by.has(k)) by.set(k, { app: w.app, parts: new Map() });
    if (w.part) by.get(k).parts.set(w.part.toLowerCase(), w.part);
  }
  const az = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  return [...by.values()].map((x) => ({ app: x.app, parts: [...x.parts.values()].sort(az) })).sort((a, b) => az(a.app, b.app));
}

// ------------------------------------------------------------------ the watch
let list = []; // the open windows, front first (openWindows)
let front = null; // the one in front (list[0]), or null
let known = false; // a list came back since the watch started
let broken = false; // the last one failed: every note shows
let active = false; // an open note is pinned over apps (sync): the watch is on
let ours = false; // one of our windows has the focus (focusMoved): the clock rests
let timer = null; // the clock: only while active and not ours (setClock)

// how a note shows now: 'top' (on top of everything), { under: window } (just above its app's window), 'hide', or
// null = can't tell yet (leave it as it is). A note not pinned over apps: 'top' (app pins leave it alone)
function stateOf(win, n) {
  if (!appPinned(n) || win.peek || REMIND.ringing(n.reminders).length || broken || win.isFocused()) return 'top';
  if (!known) return null;
  const mine = list.find((w) => n.pinApps.some((r) => matches(r, w)));
  if (!mine) return 'hide';
  return mine === front ? 'top' : { under: mine };
}
const shows = (win, n) => { const st = stateOf(win, n); return st === null ? null : st !== 'hide'; };
// a peek lasts until another window comes in front than the one there when it started
function endPeek(win) {
  if (!win.peek || !known) return;
  const at = front ? front.hwnd : null;
  if (win.peekFrom === undefined) win.peekFrom = at;
  else if (win.peekFrom !== at) { win.peek = false; win.peekFrom = undefined; }
}
// ------------------------------------------------------------------ the animation (the owner's pick B, "Drop in")
// Coming: the window fades in while it drops ANIM.drop px into its place; going: it fades out while it rises, then
// hides and is put back. Only its opacity and place change (a window can't scale); its saved place never does (the
// moves end where they started, and rememberBounds skips an unchanged place). A turn the other way mid-way goes on from
// where it is. 0 ms = at once (the tests). A maximised note only fades (moving it would un-maximise it).
const ANIM = { in: 180, out: 130, drop: 10 };
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;
function animate(win, n, dir) {
  const prev = win.appAnim;
  if (prev) clearTimeout(prev.timer);
  win.appAnim = null;
  if (win.isDestroyed()) return;
  const home = prev ? prev.home : { x: win.getBounds().x, y: win.getBounds().y };
  const full = n.opacity;
  const move = !win.isMaximized();
  const from = prev ? prev.p : dir === 'in' ? 0 : 1; // 0 = gone (up, clear), 1 = in its place
  const to = dir === 'in' ? 1 : 0;
  const set = (p) => {
    win.setOpacity(full * p);
    if (move) win.setPosition(home.x, Math.round(home.y - ANIM.drop * (1 - p)));
  };
  const done = () => {
    win.appAnim = null;
    if (dir === 'out') win.hide();
    if (move) win.setPosition(home.x, home.y);
    win.setOpacity(full);
    if (dir === 'in') showInk(win, !n.rolled);
  };
  if (dir === 'in') { set(from); if (!win.isVisible()) win.showInactive(); } else showInk(win, false);
  const span = Math.abs(to - from) * ANIM[dir];
  if (!span) { done(); return; }
  const a = { home, p: from, timer: null };
  win.appAnim = a;
  const t0 = Date.now();
  const step = () => {
    if (win.isDestroyed() || win.appAnim !== a) return;
    const k = Math.min(1, (Date.now() - t0) / span);
    a.p = from + (to - from) * (dir === 'in' ? easeOut(k) : easeIn(k));
    set(a.p);
    if (k < 1) a.timer = setTimeout(step, 16);
    else done();
  };
  a.timer = setTimeout(step, 16);
}
// show / hide by the app in front (a window still loading is only marked: openNoteWindow shows it when ready)
function comeIn(win, n) {
  win.appHidden = false;
  if (win.loaded && (!win.isVisible() || win.appAnim)) animate(win, n, 'in');
}
function goAway(win, n) {
  win.appHidden = true;
  if (win.isVisible()) animate(win, n, 'out');
}

// on top of everything, or just above its app's window (applyState reads win.appBehind: note-state.js onTop)
function place(win, n, st) {
  const behind = typeof st === 'object';
  const under = behind ? st.under.hwnd : null;
  if (behind === !!win.appBehind && under === (win.appUnder || null)) return;
  win.appBehind = behind;
  win.appUnder = under;
  applyState(win, n);
  if (behind && win.isVisible()) moveUnder(win);
}
function moveUnder(win) {
  if (!win.appUnder || win.isDestroyed()) return;
  try { win.moveAbove(`window:${win.appUnder}:0`); } catch { /* its app's window is gone: the next check sees it */ }
}
function apply() {
  for (const [id, win] of wins) {
    if (!win || win.isDestroyed() || win.userMin) continue;
    const n = S.store.get(id);
    if (!n) continue;
    endPeek(win);
    const st = stateOf(win, n);
    if (st === null) continue;
    // (a window shown by something else meanwhile, e.g. a reminder's pop-up for a note that stopped ringing, goes too)
    if (st === 'hide') {
      if (!win.appHidden || (win.isVisible() && !win.appAnim)) goAway(win, n);
      continue;
    }
    place(win, n, st);
    if (win.appHidden) { comeIn(win, n); moveUnder(win); }
  }
}
async function read() {
  try {
    list = await openWindows();
    front = list[0] || null;
    known = true;
    broken = false;
  } catch {
    broken = true;
  }
  if (active) apply();
}
// the clock's check: one at a time (a slow list skips a tick)
let inFlight = null;
function poll() {
  if (!inFlight) inFlight = read().finally(() => { inFlight = null; });
  return inFlight;
}
// a check now, after the one running (tests call it instead of waiting for the clock)
async function check() {
  if (inFlight) await inFlight;
  return poll();
}
// the clock ticks only while the watch is on and the focus is in another app (the top of this file)
function setClock() {
  const run = active && !ours;
  if (run && !timer) timer = setInterval(poll, POLL_MS);
  else if (!run && timer) { clearInterval(timer); timer = null; }
}
// the watch is on only while an open note is pinned over apps. It starts with a check even while one of our windows has
// the focus (a note opening pinned over apps waits for it: mayShow)
function sync() {
  const need = [...wins].some(([id, w]) => w && !w.isDestroyed() && appPinned(S.store.get(id)));
  if (need && !active) {
    active = true;
    known = false;
    broken = false;
    poll();
  } else if (!need && active) {
    active = false;
    known = false;
    front = null;
    list = [];
  }
  setClock();
}
// a window of ours got or lost the focus. A blur comes before the next window's focus, so it looks a moment later.
function focusMoved() {
  const now = BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.isFocused());
  if (now === ours) return;
  ours = now;
  setClock();
  if (!ours && active) poll(); // the focus went to another app: look now, not at the next tick
}
app.on('browser-window-focus', focusMoved);
app.on('browser-window-blur', () => setTimeout(focusMoved, 0));
// a note's pin changed, a window opened or closed
function changed() {
  sync();
  apply();
}
// openNoteWindow, when the window is ready: show it now? (no: it shows once one of its apps is in front)
// (and, its app open behind another, not on top: shown(win) then puts it just above that app)
function mayShow(win) {
  const n = S.store.get(win.noteId);
  if (!n) return true;
  const st = stateOf(win, n);
  if (st === null || st === 'hide') { win.appHidden = true; return false; } // (null, not known yet: hidden until the first check says)
  place(win, n, st);
  return true;
}
const shown = (win) => moveUnder(win);
// opened from the list, Bring notes to front: it shows over whatever is in front, until another window comes in front
function peek(win) {
  if (!win || win.isDestroyed()) return;
  win.peek = true;
  win.peekFrom = known ? (front ? front.hwnd : null) : undefined;
  const n = S.store.get(win.noteId);
  if (!n) return;
  place(win, n, 'top');
  if (win.appHidden) comeIn(win, n);
}
const watching = () => active;
const ticking = () => !!timer; // (tests)
module.exports = { ANIM, appPinned, changed, check, matches, mayShow, openApps, parseTitle, peek, shown, ticking, watching };
