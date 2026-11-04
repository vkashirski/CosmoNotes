// CosmoNotes voice to text (1.3.1): the engine's plain logic. Pause detection, splitting long audio, the live
// session and text clean-up. No Transformers.js and no DOM here, so plain Node can test it (tests/stt.test.js).
// From the prototype (tools/stt-prototype/engine/engine-core.js, Step 1), with one addition: a session that writes
// everything down when you stop (live: false), for a PC that is too slow for live text.

export const RATE = 16000;

export function rmsOf(pcm, from = 0, to = pcm.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += pcm[i] * pcm[i];
  return to > from ? Math.sqrt(s / (to - from)) : 0;
}

export function concat(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// ------------------------------------------------------------------ text
// Keep the model's own punctuation and capitals. Drop tags like [BLANK_AUDIO], (music), <|en|>.
export function cleanText(t) {
  return String(t || '')
    .replace(/\[[^\]]*\]|\([^)]*\)|<\|[^|]*\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function joinTexts(parts) { return parts.map(cleanText).filter(Boolean).join(' '); }

// ------------------------------------------------------------------ splitting long audio
// Splits a recording into pieces of at most maxSec, cutting at pauses. Silent stretches are
// left out (they are never sent to the model). Returns [{ start, end }] in samples.
export function splitAtPauses(pcm, { rate = RATE, maxSec = 20, frameMs = 50, pauseMs = 300, padMs = 150 } = {}) {
  const fl = Math.round((rate * frameMs) / 1000);
  const nf = Math.ceil(pcm.length / fl);
  if (!nf) return [];
  const e = new Float32Array(nf);
  for (let f = 0; f < nf; f++) e[f] = rmsOf(pcm, f * fl, Math.min(pcm.length, (f + 1) * fl));
  const sorted = Array.from(e).sort((a, b) => a - b);
  const floor = sorted[Math.floor(nf * 0.1)] || 0; // background noise (gaps between words)
  const median = sorted[Math.floor(nf * 0.5)] || 0;
  // 3 × the noise, but never above half the typical level (a recording with almost no gaps)
  const thr = Math.max(0.006, Math.min(floor * 3, median * 0.5));
  const voiced = Array.from(e, (v) => v > thr);

  // stretches of voice, joined across pauses shorter than pauseMs
  const gap = Math.ceil(pauseMs / frameMs);
  const segs = [];
  let s = -1;
  let last = -1;
  for (let f = 0; f < nf; f++) {
    if (!voiced[f]) continue;
    if (s < 0) s = f;
    else if (f - last > gap) { segs.push([s, last + 1]); s = f; }
    last = f;
  }
  if (s >= 0) segs.push([s, last + 1]);

  // a stretch longer than maxSec is cut at its quietest frame in the last 40 % of the window
  const maxF = Math.floor((maxSec * 1000) / frameMs);
  const cutLong = [];
  for (let [a, b] of segs) {
    while (b - a > maxF) {
      let best = a + maxF;
      let bestV = Infinity;
      for (let f = a + Math.floor(maxF * 0.6); f < a + maxF; f++) if (e[f] < bestV) { bestV = e[f]; best = f; }
      cutLong.push([a, best]);
      a = best;
    }
    cutLong.push([a, b]);
  }

  // merge neighbours while the piece stays within maxSec
  const pieces = [];
  for (const [a, b] of cutLong) {
    const p = pieces[pieces.length - 1];
    if (p && b - p[0] <= maxF) p[1] = b;
    else pieces.push([a, b]);
  }
  const pad = Math.round((rate * padMs) / 1000);
  const maxLen = maxSec * rate;
  return pieces
    .filter(([a, b]) => b - a >= 2) // at least 0.1 s of voice
    .map(([a, b]) => {
      let start = Math.max(0, a * fl - pad);
      let end = Math.min(pcm.length, b * fl + pad);
      if (end - start > maxLen) { const over = end - start - maxLen; start += Math.min(pad, Math.ceil(over / 2)); end = start + Math.min(end - start, maxLen); }
      return { start, end };
    });
}

// ------------------------------------------------------------------ live dictation
// Audio comes in as ~0.25 s chunks with their loudness. A piece starts when the voice is louder
// than the threshold and ends after pauseMs of quiet (or at maxSec). While a piece grows, a
// grey draft of it is written about once a second; when it ends it gets one final pass.
// If the engine falls more than maxLagSec behind, drafts stop and the final text is held
// back until Stop ("Writing it down when you stop"); the audio is still processed.
// live: false (a slow PC) = no drafts at all, and every piece's text is held until Stop.
export class LiveSession {
  constructor({ asr, emit, rate = RATE, pauseMs = 600, maxSec = 20, maxLagSec = 5, draftEverySec = 1, threshold = 0.012, auto = true, maxAuto = 0.04, live = true, now = () => Date.now() }) {
    Object.assign(this, { asr, emit, rate, pauseMs, maxSec, maxLagSec, draftEverySec, threshold, auto, maxAuto, live, now });
    this.floor = null;
    this.recent = []; // loudness of the last ~8 s of chunks
    this.preroll = [];
    this.cur = [];
    this.curLen = 0;
    this.curStart = 0;
    this.pieceNo = 0;
    this.speaking = false;
    this.speechChunks = 0;
    this.silentMs = 0;
    this.received = 0;
    this.doneUpTo = 0;
    this.finals = [];
    this.held = [];
    this.busy = false;
    this.draftsOn = !!live;
    this.lastDraftLen = 0;
    this.draftShown = false;
    this.stopped = false;
    this.cancelled = false;
    this.waiters = [];
    this.stats = { pieces: 0, drafts: 0, droppedBlips: 0, audioSec: 0, workSec: 0, draftAudioSec: 0, draftWorkSec: 0, maxLagSec: 0, fellBehind: false, heardSec: 0 };
  }

  // Auto: 3 × the background noise = the quietest chunk of the last ~8 s (there is always a
  // breath or a gap between words in that time), never below the base value, and never
  // above maxAuto (talking from the very first chunk must still count as talking).
  currentThreshold() {
    return this.auto && this.floor !== null ? Math.max(this.threshold, Math.min(this.floor * 3, this.maxAuto)) : this.threshold;
  }

  lag() { return (this.received - this.doneUpTo) / this.rate; }

  push(pcm, rms) {
    if (this.stopped || this.cancelled) return;
    if (typeof rms !== 'number') rms = rmsOf(pcm);
    const start = this.received;
    this.received += pcm.length;
    this.stats.heardSec = this.received / this.rate;
    this.recent.push(rms);
    if (this.recent.length > Math.ceil((8 * this.rate) / pcm.length)) this.recent.shift();
    this.floor = Math.min(...this.recent);
    const speech = rms > this.currentThreshold();
    const chunkMs = (pcm.length / this.rate) * 1000;

    if (!this.speaking) {
      this.preroll.push({ pcm, start });
      if (this.preroll.length > 2) this.preroll.shift();
      if (speech) {
        this.speaking = true;
        this.pieceNo++;
        this.cur = this.preroll.map((c) => c.pcm);
        this.curStart = this.preroll[0].start;
        this.curLen = this.cur.reduce((n, c) => n + c.length, 0);
        this.preroll = [];
        this.speechChunks = 1;
        this.silentMs = 0;
        this.lastDraftLen = 0;
      } else if (!this.busy && !this.finals.length) {
        this.doneUpTo = this.received; // nothing waiting: quiet audio is "done"
      }
    } else {
      this.cur.push(pcm);
      this.curLen += pcm.length;
      if (speech) { this.speechChunks++; this.silentMs = 0; } else this.silentMs += chunkMs;
      if (this.silentMs >= this.pauseMs || this.curLen >= this.maxSec * this.rate) this.cutPiece();
    }
    const lag = this.lag();
    if (lag > this.stats.maxLagSec) this.stats.maxLagSec = lag;
    if (this.draftsOn && lag > this.maxLagSec) {
      this.draftsOn = false;
      this.stats.fellBehind = true;
      this.emit({ type: 'status', state: 'behind', lagSec: lag });
      if (this.draftShown) { this.emit({ type: 'draft', text: '' }); this.draftShown = false; }
    }
    this.pump();
  }

  cutPiece(force = false) {
    if (this.speechChunks >= 2 || (force && this.speechChunks >= 1)) {
      this.finals.push({ pcm: concat(this.cur), end: this.curStart + this.curLen });
    } else {
      this.stats.droppedBlips++;
      if (this.draftShown) { this.emit({ type: 'draft', text: '' }); this.draftShown = false; }
    }
    this.cur = [];
    this.curLen = 0;
    this.speaking = false;
    this.speechChunks = 0;
    this.silentMs = 0;
    this.preroll = [];
  }

  async timed(pcm, draft) {
    const t = this.now();
    const text = await this.asr(pcm);
    const sec = (this.now() - t) / 1000;
    const audio = pcm.length / this.rate;
    if (draft) { this.stats.draftWorkSec += sec; this.stats.draftAudioSec += audio; } else { this.stats.workSec += sec; this.stats.audioSec += audio; }
    return text;
  }

  async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (!this.cancelled) {
        if (this.finals.length) {
          const p = this.finals.shift();
          const text = cleanText(await this.timed(p.pcm, false));
          if (this.cancelled) break;
          this.stats.pieces++;
          this.doneUpTo = Math.max(this.doneUpTo, p.end);
          if (this.draftsOn) { this.emit({ type: 'final', text }); this.draftShown = false; } else if (text) this.held.push(text);
          continue;
        }
        if (this.draftsOn && this.speaking && this.curLen - this.lastDraftLen >= this.draftEverySec * this.rate) {
          const no = this.pieceNo;
          const len = this.curLen;
          const end = this.curStart + this.curLen;
          const text = cleanText(await this.timed(concat(this.cur), true));
          if (this.cancelled) break;
          this.lastDraftLen = len;
          this.stats.drafts++;
          this.doneUpTo = Math.max(this.doneUpTo, end);
          if (this.draftsOn && this.speaking && no === this.pieceNo) { this.emit({ type: 'draft', text }); this.draftShown = true; }
          continue;
        }
        break;
      }
    } catch (e) {
      // the model failed: what is still waiting is dropped (the window keeps the recording as a voice note)
      this.failed = true;
      this.finals = [];
      this.emit({ type: 'error', message: String((e && e.message) || e) });
    } finally {
      this.busy = false;
    }
    if (!this.speaking && !this.finals.length && !this.busy) this.doneUpTo = this.received;
    if (this.stopped && !this.finals.length && !this.busy) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    if (!this.cancelled && this.held.length) this.emit({ type: 'final', text: this.held.join(' ') });
    this.held = [];
    if (!this.cancelled) this.emit({ type: 'done' });
    for (const w of this.waiters) w(this.summary());
    this.waiters = [];
  }

  // Stop listening and finish only the audio already heard.
  stop() {
    if (!this.stopped) {
      this.stopped = true;
      if (this.speaking) this.cutPiece(true);
      if (this.finals.length) this.emit({ type: 'status', state: 'finishing' });
    }
    return new Promise((resolve) => {
      if (this.finished) return resolve(this.summary());
      this.waiters.push(resolve);
      this.pump();
    });
  }

  cancel() {
    this.cancelled = true;
    this.stopped = true;
    this.finals = [];
    this.held = [];
    this.finish();
  }

  summary() {
    const s = this.stats;
    return { ...s, failed: !!this.failed, speed: s.workSec ? s.audioSec / s.workSec : null, draftSpeed: s.draftWorkSec ? s.draftAudioSec / s.draftWorkSec : null };
  }
}

// Test my computer (1.3.1): the speed (× real time) says how a model can be used on this PC.
export function verdictOf(speed) {
  if (!(speed > 0)) return null;
  return speed >= 2 ? 'live' : speed >= 0.5 ? 'after' : 'slow';
}
