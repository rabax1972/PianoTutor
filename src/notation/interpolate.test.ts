import { describe, expect, it } from 'vitest';
// importa solo la funzione pura (il modulo VexFlow non viene eseguito: nessun DOM nei test unitari)
import { interpolate } from './interpolate';

describe('interpolate (beat → x)', () => {
  const pts = [
    { t: 0, x: 100 },
    { t: 1, x: 160 },
    { t: 3, x: 200 },
  ];

  it('restituisce la x esatta sugli onset', () => {
    expect(interpolate(pts, 1, 50)).toBe(160);
  });

  it('interpola tra gli onset', () => {
    expect(interpolate(pts, 0.5, 50)).toBe(130);
    expect(interpolate(pts, 2, 50)).toBe(180);
  });

  it('estrapola prima dell’inizio (conteggio) e dopo la fine', () => {
    expect(interpolate(pts, -2, 50)).toBe(0);
    expect(interpolate(pts, 4, 50)).toBe(250);
  });
});
