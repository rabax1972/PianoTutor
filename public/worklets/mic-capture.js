/**
 * AudioWorklet di cattura del microfono: invia al thread principale blocchi da 512 campioni
 * con il tempo audio dell'ultimo campione. L'analisi (pitch) avviene in PitchTracker.
 */
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = 512;
    this.buf = new Float32Array(this.hop);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.hop) {
        this.port.postMessage({ samples: this.buf, time: currentTime + (i + 1) / sampleRate }, [this.buf.buffer]);
        this.buf = new Float32Array(this.hop);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
