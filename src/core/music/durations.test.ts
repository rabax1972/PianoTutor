import { describe, expect, it } from 'vitest';
import { decomposeDuration, durationSpec, isRepresentable } from './durations';

describe('durations', () => {
  it('riconosce le figure semplici e puntate', () => {
    expect(durationSpec(4)!.name).toBe('semibreve');
    expect(durationSpec(1.5)).toMatchObject({ vex: 'q', dots: 1 });
    expect(durationSpec(0.5)!.vex).toBe('8');
    expect(durationSpec(2.5)).toBeUndefined();
  });

  it('scompone durate composte', () => {
    expect(decomposeDuration(2.5).map((d) => d.beats)).toEqual([2, 0.5]);
    expect(decomposeDuration(5).map((d) => d.beats)).toEqual([4, 1]);
    expect(decomposeDuration(3.75).map((d) => d.beats)).toEqual([3, 0.75]);
  });

  it('rifiuta durate non multiple di semicroma', () => {
    expect(isRepresentable(1 / 3)).toBe(false);
    expect(isRepresentable(0.25)).toBe(true);
  });
});
