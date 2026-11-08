import { describe, expect, it } from 'vitest';
import { a4FromCents, median, micLatencyFrom, noiseFloorFrom, noiseVerdict, percentile } from './calibration';

describe('calibrazione microfono', () => {
  it('mediana e percentili', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });

  it('rumore di fondo robusto ai picchi isolati', () => {
    const levels = Array.from({ length: 100 }, (_, i) => -62 + (i % 5) * 0.5);
    levels[50] = -20; // un colpo di tosse
    expect(noiseFloorFrom(levels)).toBe(-60);
    expect(noiseFloorFrom([-60, -61])).toBeNull();
  });

  it('valuta l’ambiente', () => {
    expect(noiseVerdict(-65)).toBe('quiet');
    expect(noiseVerdict(-48)).toBe('ok');
    expect(noiseVerdict(-30)).toBe('noisy');
  });

  it('calcola il diapason da un pianoforte calante o crescente', () => {
    expect(a4FromCents([-20, -21, -19, -20, -22, -18])).toBeCloseTo(434.9, 1);
    expect(a4FromCents([10, 10, 10, 10, 10])).toBeCloseTo(442.5, 1);
    expect(a4FromCents([0, 0])).toBeNull();
    expect(a4FromCents([80, 90, 70, 85, 75])).toBeNull(); // nota sbagliata, non intonazione
  });

  it('calcola la latenza del microfono togliendo quella di uscita', () => {
    expect(micLatencyFrom([95, 100, 105], 40)).toBe(60);
    expect(micLatencyFrom([90], 0)).toBeNull();
    expect(micLatencyFrom([30, 32], 50)).toBe(0);
  });
});
