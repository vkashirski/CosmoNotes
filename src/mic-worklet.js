// CosmoNotes voice to text (1.3.1): the AudioWorklet of Speak to text (src/note/speech.js). It turns the microphone into
// 16 kHz mono chunks of 0.25 s (4000 samples), each sent with its loudness (RMS). Loaded by the note window (script-src
// 'self' allows it). From the prototype (Step 1). If the AudioContext already runs at 16 kHz the samples pass straight
// through; otherwise they are averaged down (a simple box filter, enough for speech).
class Mic16k extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const inRate = (options.processorOptions && options.processorOptions.inRate) || sampleRate;
    this.ratio = inRate / 16000;
    this.buf = new Float32Array(4000);
    this.n = 0;
    this.acc = 0;
    this.cnt = 0;
    this.pos = 0;
    this.port.onmessage = (e) => { if (e.data === 'flush') this.flush(); };
  }

  put(x) {
    this.buf[this.n++] = x;
    if (this.n === this.buf.length) this.flush();
  }

  flush() {
    if (!this.n) return;
    const pcm = this.n === this.buf.length ? this.buf : this.buf.slice(0, this.n);
    let s = 0;
    for (let i = 0; i < pcm.length; i++) s += pcm[i] * pcm[i];
    this.port.postMessage({ pcm, rms: Math.sqrt(s / pcm.length) }, [pcm.buffer]);
    this.buf = new Float32Array(4000);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (this.ratio === 1) {
      for (let i = 0; i < ch.length; i++) this.put(ch[i]);
      return true;
    }
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.cnt++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.put(this.acc / this.cnt);
        this.pos -= this.ratio;
        this.acc = 0;
        this.cnt = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic16k', Mic16k);
