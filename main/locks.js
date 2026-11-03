'use strict';
const crypto = require('crypto');
const { SECRET } = require('./constants');
const crypt = require('./crypt');
const { S } = require('./state');

// What a window is allowed to see: a locked note's contents stay in this
// process until the right password is typed in that window.
// A note is locked by its own lock or by any locked group it sits in. 1.1.30: a note still sealed on disk
// (encrypted, the PIN not typed yet this session) counts as locked too, whatever happened to its lock.
function isLocked(n) {
  return !!n.locked || !!n.enc || S.store.lockedGroupsOf(n).length > 0;
}
function lockedBy(n) {
  if (n.locked || n.enc) return 'note';
  return S.store.lockedGroupsOf(n).length ? 'group' : null;
}
function viewOf(n, win) {
  const hidden = isLocked(n) && !(win && win.revealed);
  const v = { ...n, hidden, lockedBy: lockedBy(n) };
  delete v.enc; // windows never get the sealed contents either
  delete v.encAtt;
  if (hidden) for (const k of SECRET) v[k] = k === 'html' || k === 'text' || k === 'title' ? '' : null;
  return v;
}

// ---------- password for locked notes (one for all notes)
// Before 1.1.30 (and while nothing is encrypted yet): "salt:hash" in settings.json. Since 1.1.30 the first
// right PIN sets up encryption (main/crypt.js); from then on the PIN is checked by opening the encryption key.
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt, hash };
}
// Stored on one line in settings.json as "salt:hash" (never the password itself).
const packLock = ({ salt, hash }) => `${salt}:${hash}`;
function checkOldHash(pw) {
  const [salt, hash] = String(S.store.settings.lock || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hashPassword(pw, salt).hash, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// true when pw is the PIN / password. It also opens every encrypted note for this session, and the first time an
// older PIN is typed after the update it encrypts the locked notes (the recovery key is then shown in the list).
async function checkPassword(pw) {
  if (crypt.isSetUp()) return crypt.unlock(pw);
  if (!checkOldHash(pw)) return false;
  await crypt.setUp(pw);
  return true;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = { checkPassword, hashPassword, isLocked, packLock, viewOf, wait };
