import { describe, expect, it } from 'vitest';
import { loadOrder, nearestSample, SAMPLES } from './sampleMap';

describe('sampleMap', () => {
  it('mappa i nomi dei file in MIDI', () => {
    expect(SAMPLES.find((s) => s.name === 'C4')!.midi).toBe(60);
    expect(SAMPLES.find((s) => s.name === 'Ds4')!.midi).toBe(63);
    expect(SAMPLES.find((s) => s.name === 'Fs4')!.midi).toBe(66);
  });

  it('trova il campione più vicino entro ±2 semitoni', () => {
    for (let m = 36; m <= 96; m++) {
      expect(Math.abs(nearestSample(m).midi - m)).toBeLessThanOrEqual(2);
    }
  });

  it('carica prima il registro centrale', () => {
    expect(loadOrder()[0]!.name).toBe('C4');
  });
});
