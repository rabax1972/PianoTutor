import { describe, expect, it } from 'vitest';
import { layoutKeys, octavesForWidth, visibleRange } from './layout';

describe('keyboard layout', () => {
  it('una ottava + Do finale: 8 bianchi e 5 neri', () => {
    const keys = layoutKeys(60, 72);
    expect(keys.filter((k) => !k.black)).toHaveLength(8);
    expect(keys.filter((k) => k.black)).toHaveLength(5);
  });

  it('i tasti bianchi coprono esattamente il 100%', () => {
    const whites = layoutKeys(48, 84).filter((k) => !k.black);
    const last = whites[whites.length - 1]!;
    expect(last.left + last.width).toBeCloseTo(100);
  });

  it('il Do# sta a cavallo tra Do e Re', () => {
    const keys = layoutKeys(60, 72);
    const c = keys.find((k) => k.midi === 60)!;
    const cs = keys.find((k) => k.midi === 61)!;
    expect(cs.left).toBeGreaterThan(c.left);
    expect(cs.left + cs.width).toBeGreaterThan(c.left + c.width);
  });

  it('estende gli estremi neri al bianco vicino', () => {
    const keys = layoutKeys(61, 70);
    expect(Math.min(...keys.map((k) => k.midi))).toBe(60);
    expect(Math.max(...keys.map((k) => k.midi))).toBe(71);
  });

  it('sceglie le ottave in base alla larghezza', () => {
    expect(octavesForWidth(360)).toBe(1); // telefono portrait
    expect(octavesForWidth(800)).toBe(2);
    expect(octavesForWidth(1180)).toBe(3); // iPad landscape
    expect(octavesForWidth(2560)).toBe(3);
  });

  it('centra il range sul Do centrale', () => {
    expect(visibleRange(3)).toEqual({ from: 48, to: 84 });
    expect(visibleRange(1)).toEqual({ from: 60, to: 72 });
    expect(visibleRange(2)).toEqual({ from: 48, to: 72 });
    expect(visibleRange(1, 1)).toEqual({ from: 72, to: 84 });
  });
});
