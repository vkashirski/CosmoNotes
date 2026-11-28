'use strict';
// Ground control (1.4.34): a feature request or a bug report. First the relay (feedback-worker/worker.mjs) under Node with
// a stand-in KV and GitHub: the challenge and the puzzle, the fields' limits, pictures, one use per challenge, the count
// per IP and per day, the off switch, a GitHub failure, @names tamed. Then main's side (main/feedback.js) against the
// real relay on a local server: only the list window, the draft on disk (kept after a failed Send, gone after one that
// worked), pictures made smaller and never refused, what is sent (the app details only when ticked), Send resting.
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const app = require('./helpers/app'); // note: it puts a stand-in global Response; the relay's replies are read with body()

const body = async (r) => JSON.parse(typeof r.text === 'function' ? await r.text() : r.body);
const kv = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); } }; };
// GitHub, played: every call is kept; `fail` makes the next issue fail
const gh = { calls: [], fail: false, next: 1 };
const fetch0 = globalThis.fetch;
globalThis.fetch = async (url, o = {}) => {
  if (!String(url).startsWith('https://api.github.com/')) return fetch0(url, o);
  gh.calls.push({ url: String(url), method: o.method, body: JSON.parse(o.body), auth: o.headers.authorization });
  const ok = !(gh.fail && String(url).endsWith('/issues'));
  return { ok, status: ok ? 201 : 500, json: async () => (String(url).endsWith('/issues') ? { number: gh.next++ } : { content: {} }) };
};
const zeroBits = (buf) => { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; };
const sha = (s) => crypto.createHash('sha256').update(s);
function solve(challenge, words, bits) {
  const tail = ':' + sha(words).digest('hex');
  for (let n = 0; ; n++) if (zeroBits(sha(`${challenge}:${n}${tail}`).digest()) >= bits) return n;
}
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };

(async () => {
  const W = await import(pathToFileURL(path.join(app.ROOT, 'feedback-worker', 'worker.mjs')).href);
  const relay = W.default;
  const env = { GITHUB_TOKEN: 'tok', PUZZLE_SECRET: 'secret-for-tests', REPO: 'me/feedback', OPEN: 'yes', PER_IP_DAY: '3', PER_DAY: '5', BITS: '8', LIMITS: kv() };
  const get = (p, e = env) => relay.fetch(new Request(`https://relay.test${p}`), e);
  const post = (msg, ip = '1.1.1.1', e = env) => relay.fetch(new Request('https://relay.test/report', { method: 'POST', body: typeof msg === 'string' ? msg : JSON.stringify(msg), headers: { 'cf-connecting-ip': ip } }), e);
  const R = (o = {}) => ({ kind: 'bug', title: 'Notes jump', text: 'They move by @someone #12', expected: 'Stay put', email: 'a@b.co', details: 'CosmoNotes 1.4.34', version: '1.4.34', ...o });
  async function signed(report, images, e = env) {
    const c = await body(await get('/challenge', e));
    return { challenge: c.challenge, nonce: solve(c.challenge, W.wordsOf(report), Number(e.BITS)), report, images };
  }

  // ---- the relay: the challenge
  const ch = await body(await get('/challenge'));
  assert.equal(ch.bits, 8, 'the puzzle size comes from BITS');
  assert.equal(ch.challenge.split('.').length, 3, 'time.random.signature');
  assert.equal((await get('/nothing')).status, 404);

  // ---- a report: the pictures go into the repo first, then the issue shows them; labels by kind; @names tamed
  const pic = { type: 'png', data: png(10, 10).toString('base64') };
  let r = await post(await signed(R(), [pic, { type: 'jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 0, 1]).toString('base64') }]));
  assert.equal(r.status, 200);
  assert.deepEqual(await body(r), { ok: true, number: 1 });
  assert.deepEqual(gh.calls.map((c) => c.method), ['PUT', 'PUT', 'POST'], 'two pictures, then the issue');
  assert.ok(gh.calls.every((c) => c.auth === 'Bearer tok' && c.url.startsWith('https://api.github.com/repos/me/feedback/')), 'the token goes only to GitHub, for REPO');
  assert.match(gh.calls[0].url, /\/contents\/reports\/\d{4}-\d\d\/\d{4}-\d\d-\d\d-\w+-1\.png$/);
  assert.match(gh.calls[1].url, /-2\.jpg$/);
  assert.equal(gh.calls[0].body.content, pic.data, 'the picture goes as the app sent it (never decoded)');
  const issue = gh.calls[2].body;
  assert.deepEqual(issue.labels, ['bug']);
  assert.equal(issue.title, 'Notes jump');
  assert.ok(issue.body.includes('@​someone') && issue.body.includes('#​12') && !/@someone/.test(issue.body), 'a report can’t ping anyone or link an issue');
  assert.ok(issue.body.includes('Stay put') && issue.body.includes('Reply to: a@​b.co') && issue.body.includes('CosmoNotes 1.4.34'));
  assert.equal((issue.body.match(/!\[Picture \d\]\(https:\/\/github\.com\/me\/feedback\/blob\/main\/reports\//g) || []).length, 2, 'the issue shows both pictures');
  gh.calls.length = 0;
  r = await post(await signed(R({ kind: 'feature', expected: '', email: '' }), []));
  assert.deepEqual(gh.calls[0].body.labels, ['enhancement'], 'a feature request');
  assert.ok(gh.calls[0].body.body.includes('No email given.'));

  // ---- the puzzle: tied to the words, signed by the relay, not too old, used once
  let m = await signed(R({ title: 'one' }), []);
  assert.equal((await post({ ...m, report: R({ title: 'two' }) })).status, 400, 'a solved puzzle can’t carry other words');
  const [ts, rand] = m.challenge.split('.');
  assert.equal((await body(await post({ ...m, challenge: `${ts}.${rand}.forged` }))).error, 'puzzle', 'only the relay’s own challenges');
  assert.equal((await post(m)).status, 200);
  assert.equal((await body(await post(m))).error, 'used', 'one report per challenge');
  const old = await signed(R({ title: 'old' }), []);
  const now0 = Date.now;
  Date.now = () => now0() + 16 * 60e3;
  assert.equal((await body(await post(old))).error, 'expired', 'a challenge is good for 15 minutes');
  Date.now = now0;

  // ---- the fields' limits and the pictures
  const bad = async (report, images) => (await post(await signed(report, images))).status;
  assert.equal(await bad(R({ title: '' }), []), 400, 'a title is needed');
  assert.equal(await bad(R({ text: '  ' }), []), 400, 'and some words');
  assert.equal(await bad(R({ text: 'x'.repeat(4001) }), []), 400, 'text: 4000 at most');
  assert.equal(await bad(R({ kind: 'rant' }), []), 400);
  assert.equal(await bad(R(), [pic, pic, pic, pic]), 400, '3 pictures at most');
  assert.equal(await bad(R(), [{ type: 'png', data: Buffer.from('MZ not a picture').toString('base64') }]), 400, 'only PNG / JPEG');
  assert.equal(await bad(R(), [{ type: 'png', data: 'iVBORw0KGgo' + 'A'.repeat(1e6) }]), 400, 'a picture of 1 MB at most');
  assert.equal((await post('{nope')).status, 400);
  assert.equal((await relay.fetch(new Request('https://relay.test/report', { method: 'POST', body: 'x', headers: { 'content-length': '9000000' } }), env)).status, 413, 'too big');

  // ---- the counts: per IP a day (PER_IP_DAY = 3; 1.1.1.1 sent 3 already), and the whole day (PER_DAY = 5)
  r = await post(await signed(R({ title: 'four' }), []));
  assert.equal(r.status, 429);
  const lim = await body(r);
  assert.equal(lim.error, 'limit');
  assert.ok(lim.retryAfter > 0 && lim.retryAfter <= 86400, 'until midnight (UTC)');
  assert.equal((await post(await signed(R({ title: 'b1' }), []), '2.2.2.2')).status, 200);
  assert.equal((await post(await signed(R({ title: 'b2' }), []), '2.2.2.2')).status, 200);
  assert.equal((await body(await post(await signed(R({ title: 'c1' }), []), '3.3.3.3'))).error, 'busy', 'the day is full for everyone');
  assert.ok(![...env.LIMITS.m.keys()].some((k) => k.includes('1.1.1.1')), 'IPs are kept only as a hash');

  // ---- GitHub failing: an error, and not counted
  const env2 = { ...env, LIMITS: kv() };
  gh.fail = true;
  assert.equal((await post(await signed(R(), [], env2), '4.4.4.4', env2)).status, 502);
  gh.fail = false;
  assert.ok(![...env2.LIMITS.m.keys()].some((k) => k.startsWith('ip:') || k.startsWith('day:')), 'a report GitHub refused isn’t counted');

  // ---- the off switch
  const shut = { ...env, OPEN: 'no' };
  assert.equal((await get('/challenge', shut)).status, 503);
  assert.equal((await body(await post({}, '5.5.5.5', shut))).error, 'closed');

  // ---------------------------------------------------------------- main's side
  const relayEnv = { ...env, LIMITS: kv(), PER_IP_DAY: '2', PER_DAY: '50' };
  let lastPost = null;
  let down = false;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (down) { res.writeHead(500); res.end('{}'); return; }
    const raw = Buffer.concat(chunks).toString();
    if (req.method === 'POST') lastPost = JSON.parse(raw);
    const out = await relay.fetch(new Request(`https://relay.test${req.url}`, { method: req.method, body: req.method === 'POST' ? raw : undefined, headers: { 'cf-connecting-ip': '9.9.9.9' } }), relayEnv);
    res.writeHead(out.status, { 'content-type': 'application/json' });
    res.end(typeof out.text === 'function' ? await out.text() : out.body);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const fb = require('../main/feedback');
  fb.setRelay(`http://127.0.0.1:${server.address().port}/`);
  assert.match(fb.RELAY, /^https:\/\/[\w.-]+\.workers\.dev$/, 'the app sends only to its relay, over https');

  const { H, ev } = await app.start({ realTime: true });
  await H['list:show']();
  const L = ev(app.listWin());
  const note = ev(app.noteWins()[0]);
  assert.equal(await H['gc:info'](note), null, 'a note window can’t use Ground control');
  assert.deepEqual(await H['gc:send'](note, R()), { error: 'failed' });
  let info = await H['gc:info'](L);
  assert.deepEqual(info.drafts, { feature: null, bug: null });
  assert.equal(info.wait, 0);
  assert.match(info.details, /^CosmoNotes 1\.0\.0 · Windows .+/, 'the details shown are the ones sent');

  // ---- pictures: made smaller, never refused (the fake: PNG = 1 byte a pixel, JPEG = quality / 400 a pixel)
  const small = await H['gc:image'](L, png(400, 300));
  assert.deepEqual([small.type, small.w, small.h], ['png', 400, 300], 'a small screenshot stays a PNG, its size');
  const big = await H['gc:image'](L, png(4000, 3000));
  assert.ok(Math.max(big.w, big.h) <= 1600, 'the longest side: 1600 px at most');
  assert.ok(Buffer.from(big.data, 'base64').length <= 600e3, 'and 600 KB at most');
  assert.equal(big.type, 'jpeg');
  assert.ok(Buffer.from(big.data, 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])));
  const huge = await H['gc:image'](L, png(20000, 20000));
  assert.ok(huge && Buffer.from(huge.data, 'base64').length <= 600e3, 'even a huge one fits');
  assert.equal(await H['gc:image'](L, Buffer.from('not a picture at all, just words')), null, 'not a picture');
  assert.equal(await H['gc:image'](note, png(10, 10)), null);

  // ---- drafts, one per kind: on disk while typed, cleaned, the other kind's kept
  const draft = { kind: 'bug', title: 'Tray icon gone', text: 'After sleep the icon is gone.', expected: 'Still there', email: 'me@x.org', withDetails: true, images: [small, { type: 'gif', data: 'R0lG' }] };
  await H['gc:draft'](L, 'bug', draft);
  const file = path.join(app.DATA, 'feedback-draft.json');
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(onDisk.bug.title, 'Tray icon gone');
  assert.equal(onDisk.feature, null);
  assert.deepEqual(onDisk.bug.images.map((p) => p.type), ['png'], 'only PNG / JPEG pictures are kept');
  await H['gc:draft'](L, 'feature', { title: 'Idea half-written', text: '' });
  let drafts = (await H['gc:info'](L)).drafts;
  assert.deepEqual([drafts.feature.title, drafts.bug.title], ['Idea half-written', 'Tray icon gone'], 'both kinds can be half-written');
  assert.equal(drafts.feature.kind, 'feature');
  await H['gc:draft'](L, 'bug', { ...draft, title: 'x'.repeat(500) });
  assert.equal((await H['gc:info'](L)).drafts.bug.title.length, 120, 'cut to the limits');
  await H['gc:draft'](note, 'bug', { title: 'from a note' });
  assert.equal((await H['gc:info'](L)).drafts.bug.title.length, 120, 'a note window can’t write it');
  await H['gc:draft'](L, 'nonsense', { title: 'no' });
  await H['gc:draft'](L, 'feature', null);
  drafts = (await H['gc:info'](L)).drafts;
  assert.equal(drafts.feature, null, 'one kind cleared');
  assert.ok(drafts.bug, 'the other kept');
  await H['gc:draft'](L, 'bug', { title: '', text: '' });
  assert.ok(!fs.existsSync(file), 'no drafts left: no file');
  fs.writeFileSync(file, JSON.stringify({ kind: 'bug', title: 'Old shape', text: 'x' }));
  assert.equal((await H['gc:info'](L)).drafts.bug.title, 'Old shape', 'a draft from before one per kind still opens');
  fs.unlinkSync(file);

  // ---- Send: needs words; what goes is what the form shows
  assert.deepEqual(await H['gc:send'](L, { ...draft, title: ' ' }), { error: 'empty' });
  gh.calls.length = 0;
  await H['gc:draft'](L, 'feature', { title: 'Keep me', text: 'half an idea' });
  let s = await H['gc:send'](L, draft);
  assert.deepEqual(s, { ok: true, wait: fb.WAIT });
  assert.deepEqual(Object.keys(lastPost).sort(), ['challenge', 'images', 'nonce', 'report']);
  assert.deepEqual(lastPost.report, { kind: 'bug', title: 'Tray icon gone', text: 'After sleep the icon is gone.', expected: 'Still there', email: 'me@x.org', details: info.details, version: '1.0.0' });
  assert.deepEqual(lastPost.images, [{ type: 'png', data: small.data }]);
  assert.equal(gh.calls.filter((c) => c.method === 'POST').length, 1, 'one issue');
  const left = (await H['gc:info'](L)).drafts;
  assert.equal(left.bug, null, 'sent: its draft is gone');
  assert.equal(left.feature.title, 'Keep me', 'the other kind’s draft stays');
  await H['gc:draft'](L, 'feature', null);
  assert.ok(!fs.existsSync(file));
  // Send rests
  info = await H['gc:info'](L);
  assert.ok(info.wait > 50 && info.wait <= fb.WAIT, 'Send rests for a minute');
  assert.equal((await H['gc:send'](L, draft)).error, 'wait');

  // ---- a failed Send keeps the draft; the app details only when ticked; a feature request has no "expected"
  fb.setRelay(`http://127.0.0.1:${server.address().port}`); // (also ends the rest, for the test)
  down = true;
  const feat = { kind: 'feature', title: 'Dark paper', text: 'A black paper colour.', expected: 'leftover', email: '', withDetails: false, images: [] };
  assert.equal((await H['gc:send'](L, feat)).error, 'failed');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).feature.title, 'Dark paper', 'the words are kept');
  fb.setRelay('http://127.0.0.1:1');
  assert.equal((await H['gc:send'](L, feat)).error, 'offline', 'no connection');
  assert.ok(fs.existsSync(file));
  down = false;
  fb.setRelay(`http://127.0.0.1:${server.address().port}`);
  s = await H['gc:send'](L, feat);
  assert.equal(s.ok, true);
  assert.equal(lastPost.report.details, '', 'no app details when not ticked');
  assert.equal(lastPost.report.expected, '', 'a feature request sends no "expected"');

  // ---- the relay's limit: Send rests until it says, the words stay
  fb.setRelay(`http://127.0.0.1:${server.address().port}`);
  s = await H['gc:send'](L, { ...feat, title: 'third' });
  assert.equal(s.error, 'limit');
  assert.ok(s.wait >= fb.WAIT, 'rests as long as the relay says');
  assert.ok(fs.existsSync(file));
  relayEnv.OPEN = 'no';
  fb.setRelay(`http://127.0.0.1:${server.address().port}`);
  assert.equal((await H['gc:send'](L, feat)).error, 'closed');

  server.close();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
