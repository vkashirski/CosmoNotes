'use strict';
const { session } = require('electron');
const { CHECK_OPTS, cleanFxOpacity } = require('../store');
const { evePhase } = require('./evening');
const { S, wins } = require('./state');

function spellLanguages() {
  const ses = session.defaultSession;
  const avail = ses.availableSpellCheckerLanguages || [];
  const ok = (l) => !avail.length || avail.includes(l);
  const langs = ['en-US'].filter(ok);
  // Macedonian has no dictionary in the spell checker; these are the closest.
  if (S.store.settings.spellCyrillic) for (const l of ['mk', 'sr', 'bg', 'ru', 'uk']) if (avail.includes(l)) langs.push(l);
  try { ses.setSpellCheckerLanguages(langs.length ? langs : ['en-US']); } catch (e) { console.error(e); }
}

function noteSettings() {
  // appTheme (1.1.16): the notes list's colours; a note's pop-ups and toolbars use them too
  return { spellCheck: !!S.store.settings.spellCheck, hasPassword: !!S.store.settings.lock, ...lockInfo(), ...fxSettings(), ...checkSettings(), ...eveningAndPanic(), ...remindSettings(), appTheme: S.store.settings.listTheme || 'cream' };
}
// 1.4.1: the sound a reminder plays (unless it has its own) and how loud: the note window plays it (src/note/remind.js)
function remindSettings() {
  return { remindSound: S.store.settings.remindSound, remindVolume: S.store.settings.remindVolume };
}
// 1.3.27: evening colours (on for notes that follow Settings, and how far into the evening it is now) and the panic button
// (1.3.34: and the click-through button)
function eveningAndPanic() {
  const s = S.store.settings;
  return { eveOn: !!s.eveOn, evePhase: evePhase(), panicOn: !!s.panicOn, panicKey: s.panicOn ? s.panicKey : '', clickThroughOn: !!s.clickThroughOn };
}
// 1.3.19: checklists in every note (Settings → Checklists): checkDrag, checkSink, checkFixed
function checkSettings() {
  const out = {};
  for (const k of Object.values(CHECK_OPTS)) out[k] = !!S.store.settings[k];
  return out;
}
// 1.1.16: effects for all notes (Settings → Effects), sent to every note window
function fxSettings() {
  const s = S.store.settings;
  return { fxEffect: s.fxEffect, fxFollower: s.fxFollower, fxEffectAmount: s.fxEffectAmount, fxFollowerAmount: s.fxFollowerAmount,
    fxEffectOpacity: cleanFxOpacity(s.fxEffectOpacity) ?? 1, fxFollowerOpacity: cleanFxOpacity(s.fxFollowerOpacity) ?? 1, fxForceAll: !!s.fxForceAll, fxPaused: !!s.fxPaused,
    fxInteract: s.fxInteract !== false };
}
// PIN or password: a PIN only takes digits and opens as soon as all of them are typed.
function lockInfo() {
  const pin = S.store.settings.lockKind === 'pin';
  return { lockKind: pin ? 'pin' : 'password', lockLen: pin ? Number(S.store.settings.lockLen) || 0 : 0 };
}
function broadcastSettings() {
  const s = noteSettings();
  for (const win of wins.values()) if (!win.isDestroyed()) win.webContents.send('settings:changed', s);
}
module.exports = { broadcastSettings, lockInfo, noteSettings, spellLanguages };
