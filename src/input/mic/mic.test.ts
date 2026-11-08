import { describe, expect, it } from 'vitest';
import { verifyNotes } from './chordVerifier';
import { magnitudeSpectrum } from './fft';
import { PitchTracker, type TrackerEvent } from './pitchTracker';
import { frames, synthesize, whiteNoise } from './synth';

const SR = 48000;
const WIN = 2048;
const HOP = 512;

function run(signal: Float32Array, cfg: Partial<ConstructorParameters<typeof PitchTracker>[0]> = {}) {
  const tr = new PitchTracker({ sampleRate: SR, ...cfg });
  const ev: TrackerEvent[] = [];
  for (const { frame, time } of frames(signal, WIN, HOP, SR)) ev.push(...tr.process(frame, time));
  return ev;
}
const ons = (ev: TrackerEvent[]) => ev.filter((e): e is Extract<TrackerEvent, { type: 'on' }> => e.type === 'on');

describe('PitchTracker', () => {
  it.each([
    [48, 'Do3'],
    [60, 'Do4'],
    [64, 'Mi4'],
    [69, 'La4'],
    [79, 'Sol5'],
    [88, 'Mi6'],
  ])('riconosce una nota singola (MIDI %i, %s)', (midi) => {
    const sig = synthesize([{ midis: [midi], start: 0.2, dur: 0.8 }], 1.2, SR);
    const on = ons(run(sig));
    expect(on).toHaveLength(1);
    expect(on[0]!.midi).toBe(midi);
  });

  it('data la nota vicino al vero attacco (latenza di rilevamento < 70 ms)', () => {
    const sig = synthesize([{ midis: [60], start: 0.3, dur: 0.6 }], 1, SR);
    const on = ons(run(sig))[0]!;
    expect(on.time).toBeGreaterThan(0.3 - 0.03);
    expect(on.time).toBeLessThan(0.3 + 0.07);
  });

  it('riconosce una sequenza Do Re Mi con note ripetute', () => {
    const seq = [60, 60, 62, 62, 64];
    const sig = synthesize(
      seq.map((m, i) => ({ midis: [m], start: 0.2 + i * 0.5, dur: 0.42 })),
      3,
      SR,
    );
    expect(ons(run(sig)).map((e) => e.midi)).toEqual(seq);
  });

  it('riconosce la stessa nota ripercossa senza silenzio (salto di energia)', () => {
    const sig = synthesize(
      [
        { midis: [67], start: 0.2, dur: 0.6, amp: 0.25 },
        { midis: [67], start: 0.8, dur: 0.6, amp: 0.35 },
      ],
      1.6,
      SR,
    );
    expect(ons(run(sig)).map((e) => e.midi)).toEqual([67, 67]);
  });

  it('ignora il rumore di fondo e i rumori non intonati', () => {
    expect(ons(run(whiteNoise(1.5, SR, 0.001)))).toHaveLength(0);
    // rumore forte ma non intonato (es. qualcuno che parla, un colpo): nessuna nota
    expect(ons(run(whiteNoise(1.5, SR, 0.2)))).toHaveLength(0);
  });

  it('con la soglia calibrata ignora una nota troppo debole rispetto al fondo', () => {
    const sig = synthesize([{ midis: [60], start: 0.2, dur: 0.6, amp: 0.002 }], 1, SR, 0.0005);
    expect(ons(run(sig, { noiseFloorDb: -45 }))).toHaveLength(0);
  });

  it('rispetta il diapason calibrato', () => {
    // pianoforte calante di ~30 cents: con a4 corretto la nota resta Do4
    const sig = synthesize([{ midis: [60], start: 0.1, dur: 0.6 }], 0.8, SR);
    expect(ons(run(sig, { a4: 440 * Math.pow(2, 0.3 / 12) }))[0]!.midi).toBe(60);
  });

  it('rilascia la nota nel silenzio', () => {
    const sig = synthesize([{ midis: [62], start: 0.1, dur: 0.4 }], 1.2, SR);
    const ev = run(sig);
    expect(ev.filter((e) => e.type === 'off')).toHaveLength(1);
  });
});

describe('verifica accordi', () => {
  const N = 8192;
  const spectrumOf = (midis: number[]) => {
    const sig = synthesize([{ midis, start: 0, dur: 0.5, amp: 0.4 }], 0.4, SR, 0.003);
    return magnitudeSpectrum(sig.subarray(sig.length - N));
  };

  it('trova tutte le note di un accordo di Do maggiore', () => {
    const ev = verifyNotes(spectrumOf([60, 64, 67]), SR, [60, 64, 67]);
    expect(ev.map((e) => e.present)).toEqual([true, true, true]);
  });

  it('segnala la nota mancante (Fa atteso, suonato Mi)', () => {
    const ev = verifyNotes(spectrumOf([60, 64, 67]), SR, [60, 65, 69]);
    expect(ev.find((e) => e.midi === 60)!.present).toBe(true);
    expect(ev.find((e) => e.midi === 65)!.present).toBe(false);
    expect(ev.find((e) => e.midi === 69)!.present).toBe(false);
  });

  it('riconosce un accordo minore (La minore)', () => {
    const ev = verifyNotes(spectrumOf([57, 60, 64]), SR, [57, 60, 64]);
    expect(ev.every((e) => e.present)).toBe(true);
  });

  it('nel silenzio non trova nulla', () => {
    const spec = magnitudeSpectrum(whiteNoise(0.2, SR, 0.002).subarray(0, N));
    expect(verifyNotes(spec, SR, [60, 64, 67]).some((e) => e.present)).toBe(false);
  });
});

describe('FFT', () => {
  it('individua il picco di una sinusoide', () => {
    const n = 4096;
    const sig = new Float32Array(n);
    const f = 1000;
    for (let i = 0; i < n; i++) sig[i] = Math.sin((2 * Math.PI * f * i) / SR);
    const spec = magnitudeSpectrum(sig);
    let best = 0;
    for (let i = 1; i < spec.length; i++) if (spec[i]! > spec[best]!) best = i;
    expect(Math.abs(best * (SR / n) - f)).toBeLessThan(SR / n);
  });
});
