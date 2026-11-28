// CosmoNotes Feedback relay ("Ground control" in the code): a Cloudflare Worker (free plan). The app (main/feedback.js) sends a feature request or
// a bug report here; the relay turns it into an issue in a private GitHub repo, pictures included. Setup: README.md here.
// It is not part of the app: package.json's `build.files` leaves this folder out.
//
//   GET  /challenge  → { challenge, bits }        a puzzle for one report (signed, good for 15 minutes)
//   POST /report     → { ok, number } | { error, retryAfter? }
//
// Guards, cheapest first: the off switch (OPEN), the body size, the puzzle (the app hashes until it finds a nonce; the relay
// checks it with one hash), the fields' limits, one use per challenge, then a count per IP and a count for the whole day.
// Settings (Worker → Settings → Variables): GITHUB_TOKEN and PUZZLE_SECRET (secrets), REPO ("owner/name"), OPEN ("yes" /
// "no"), PER_IP_DAY (5), PER_DAY (50), BITS (18); the KV namespace bound as LIMITS.
//
// Free plan: 10 ms of CPU per request. Pictures are never decoded here: they go to GitHub as the base64 the app sent.

export const LIMITS = { title: 120, text: 4000, expected: 2000, email: 200, details: 300, version: 40, images: 3, imageB64: 1_000_000, body: 4_500_000 };
const KINDS = { feature: 'enhancement', bug: 'bug' };
const AGE = 15 * 60e3;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = (s) => crypto.subtle.digest('SHA-256', enc.encode(s));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const today = (now) => new Date(now).toISOString().slice(0, 10);
const untilMidnight = (now) => Math.ceil((Date.parse(today(now) + 'T00:00:00Z') + 864e5 - now) / 1000);

// The words the puzzle is tied to: every text field, in this order. The app builds the same string (main/feedback.js).
export const wordsOf = (r) => JSON.stringify([r.kind, r.title, r.text, r.expected, r.email, r.details, r.version]);
export function zeroBits(buf) {
  let n = 0;
  for (const b of new Uint8Array(buf)) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
}

async function sign(secret, s) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(s))).slice(0, 22);
}

// Plain text only: @names and #numbers would ping people or link other issues, so they get a zero-width space.
const tame = (s) => String(s).replace(/@/g, '@​').replace(/#(\d)/g, '#​$1');
const clean = (s, max) => (typeof s === 'string' && s.length <= max ? s.replace(/\r\n?/g, '\n').trim() : null);

function readReport(r) {
  if (!r || typeof r !== 'object' || !KINDS[r.kind]) return null;
  const out = { kind: r.kind };
  for (const k of ['title', 'text', 'expected', 'email', 'details', 'version']) {
    const v = clean(r[k] ?? '', LIMITS[k]);
    if (v === null) return null;
    out[k] = v;
  }
  return out.title && out.text ? out : null;
}
function readImages(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > LIMITS.images) return null;
  const out = [];
  for (const im of list) {
    const data = im && typeof im.data === 'string' ? im.data : '';
    if (!data || data.length > LIMITS.imageB64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) return null;
    if (im.type === 'png' && data.startsWith('iVBORw0KGgo')) out.push({ ext: 'png', data });
    else if (im.type === 'jpeg' && data.startsWith('/9j/')) out.push({ ext: 'jpg', data });
    else return null;
  }
  return out;
}

async function github(env, method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${env.REPO}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'cosmonotes-ground-control', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status}`);
  return res.json();
}

function issueBody(r, pics) {
  const part = (head, s) => (s ? `### ${head}\n\n${tame(s)}\n\n` : '');
  return [
    part(r.kind === 'bug' ? 'What happened' : 'The idea', r.text),
    part('What they expected', r.expected),
    pics.map((p, i) => `![Picture ${i + 1}](${p})`).join('\n') + (pics.length ? '\n\n' : ''),
    '---\n',
    r.details ? `${tame(r.details)}  \n` : '',
    r.email ? `Reply to: ${tame(r.email)}  \n` : 'No email given.  \n',
    `Sent from CosmoNotes ${tame(r.version || '?')}`,
  ].join('');
}

async function challenge(env, now) {
  const head = `${now}.${b64url(crypto.getRandomValues(new Uint8Array(9)))}`;
  return json({ challenge: `${head}.${await sign(env.PUZZLE_SECRET, head)}`, bits: num(env.BITS, 18) });
}

async function report(request, env, now) {
  if (Number(request.headers.get('content-length') || 0) > LIMITS.body) return json({ error: 'toobig' }, 413);
  const raw = await request.text();
  if (raw.length > LIMITS.body) return json({ error: 'toobig' }, 413);
  let msg;
  try { msg = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  // the puzzle: a challenge this relay signed, not too old, and a nonce that gives enough zero bits with these words
  const c = String(msg.challenge || '');
  const [ts, rand, sig] = c.split('.');
  if (!ts || !rand || !sig || sig !== await sign(env.PUZZLE_SECRET, `${ts}.${rand}`)) return json({ error: 'puzzle' }, 400);
  if (!(now - Number(ts) >= -60e3 && now - Number(ts) <= AGE)) return json({ error: 'expired' }, 400);
  const r = readReport(msg.report);
  const pics = readImages(msg.images);
  if (!r || !pics) return json({ error: 'bad' }, 400);
  const proof = await sha256(`${c}:${String(msg.nonce)}:${hex(await sha256(wordsOf(msg.report)))}`);
  if (zeroBits(proof) < num(env.BITS, 18)) return json({ error: 'puzzle' }, 400);
  // one report per challenge; then the counts (KV is eventually consistent: the puzzle slows a burst down)
  const used = `used:${c}`;
  if (await env.LIMITS.get(used)) return json({ error: 'used' }, 409);
  await env.LIMITS.put(used, '1', { expirationTtl: 3600 });
  const day = today(now);
  const ip = hex(await sha256(`${env.PUZZLE_SECRET}:${request.headers.get('cf-connecting-ip') || '?'}`)).slice(0, 24);
  const ipKey = `ip:${day}:${ip}`, dayKey = `day:${day}`;
  const [ipN, dayN] = (await Promise.all([env.LIMITS.get(ipKey), env.LIMITS.get(dayKey)])).map((v) => Number(v) || 0);
  if (ipN >= num(env.PER_IP_DAY, 5)) return json({ error: 'limit', retryAfter: untilMidnight(now) }, 429);
  if (dayN >= num(env.PER_DAY, 50)) return json({ error: 'busy', retryAfter: untilMidnight(now) }, 429);
  // GitHub: the pictures first (into the repo, so the issue can show them), then the issue
  const id = `${day}-${rand.slice(0, 6).replace(/[^A-Za-z0-9]/g, 'x')}`;
  const links = [];
  try {
    for (const [i, p] of pics.entries()) {
      const path = `reports/${day.slice(0, 7)}/${id}-${i + 1}.${p.ext}`;
      await github(env, 'PUT', `/contents/${path}`, { message: `Picture for ${id}`, content: p.data });
      links.push(`https://github.com/${env.REPO}/blob/main/${path}?raw=true`);
    }
    const issue = await github(env, 'POST', '/issues', { title: tame(r.title), body: issueBody(r, links), labels: [KINDS[r.kind]] });
    await Promise.all([
      env.LIMITS.put(ipKey, String(ipN + 1), { expirationTtl: 172800 }),
      env.LIMITS.put(dayKey, String(dayN + 1), { expirationTtl: 172800 }),
    ]);
    return json({ ok: true, number: issue.number });
  } catch (err) {
    console.error(String(err));
    return json({ error: 'github' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const now = Date.now();
    const { pathname } = new URL(request.url);
    if (String(env.OPEN || 'yes').toLowerCase() !== 'yes') return json({ error: 'closed' }, 503);
    if (request.method === 'GET' && pathname === '/challenge') return challenge(env, now);
    if (request.method === 'POST' && pathname === '/report') return report(request, env, now);
    return json({ error: 'notfound' }, 404);
  },
};
