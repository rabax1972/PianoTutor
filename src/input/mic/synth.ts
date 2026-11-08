/**
 * Generatore di segnali "tipo pianoforte" (armoniche con decadimento) per test e fixture.
 * Usato dai test unitari e da tools/gen-mic-fixture.ts.
 */
import { midiToFrequency } from '../../core/music/pitch';

export interface ToneSpec {
  midis: number[];
  start: number;
  dur: number;
  amp?: number;
}

const HARMONICS = [1, 0.55, 0.3, 0.18, 0.1, 0.06];

/** pseudo-casuale deterministico (per test ripetibili) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

export function synthesize(tones: ToneSpec[], totalSec: number, sampleRate: number, noiseAmp = 0.002, seed = 1): Float32Array {
  const n = Math.round(totalSec * sampleRate);
  const out = new Float32Array(n);
  const rnd = rng(seed);
  for (const t of tones) {
    const amp = t.amp ?? 0.3;
    const s0 = Math.round(t.start * sampleRate);
    const s1 = Math.min(n, Math.round((t.start + t.dur) * sampleRate));
    for (const midi of t.midis) {
      const f = midiToFrequency(midi);
      for (let i = s0; i < s1; i++) {
        const tt = (i - s0) / sampleRate;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.9) * Math.min(1, (s1 - i) / (0.03 * sampleRate));
        let v = 0;
        HARMONICS.forEach((h, k) => {
          // leggera inarmonicità come nelle corde reali
          v += h * Math.sin(2 * Math.PI * f * (k + 1) * (1 + 0.0004 * k * k) * tt);
        });
        out[i]! += (amp / t.midis.length) * env * v * 0.55;
      }
    }
  }
  if (noiseAmp > 0) for (let i = 0; i < n; i++) out[i]! += noiseAmp * rnd() * 2;
  return out;
}

export function whiteNoise(totalSec: number, sampleRate: number, amp: number, seed = 7): Float32Array {
  const rnd = rng(seed);
  const out = new Float32Array(Math.round(totalSec * sampleRate));
  for (let i = 0; i < out.length; i++) out[i] = amp * rnd() * 2;
  return out;
}

/** Fa scorrere il segnale in frame sovrapposti (finestra/hop) come farebbe il microfono. */
export function* frames(signal: Float32Array, windowSize: number, hop: number, sampleRate: number) {
  for (let end = windowSize; end <= signal.length; end += hop) {
    yield { frame: signal.subarray(end - windowSize, end), time: end / sampleRate };
  }
}
