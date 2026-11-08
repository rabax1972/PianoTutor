/**
 * Durate musicali in beat (1 = semiminima) ↔ notazione.
 */

export interface DurationSpec {
  /** durata VexFlow di base: w, h, q, 8, 16 */
  vex: 'w' | 'h' | 'q' | '8' | '16';
  dots: 0 | 1;
  beats: number;
  /** nome italiano, per spiegazioni e accessibilità */
  name: string;
}

export const DURATIONS: readonly DurationSpec[] = [
  { vex: 'w', dots: 0, beats: 4, name: 'semibreve' },
  { vex: 'h', dots: 1, beats: 3, name: 'minima puntata' },
  { vex: 'h', dots: 0, beats: 2, name: 'minima' },
  { vex: 'q', dots: 1, beats: 1.5, name: 'semiminima puntata' },
  { vex: 'q', dots: 0, beats: 1, name: 'semiminima' },
  { vex: '8', dots: 1, beats: 0.75, name: 'croma puntata' },
  { vex: '8', dots: 0, beats: 0.5, name: 'croma' },
  { vex: '16', dots: 0, beats: 0.25, name: 'semicroma' },
];

const EPS = 1e-6;

export function durationSpec(beats: number): DurationSpec | undefined {
  return DURATIONS.find((d) => Math.abs(d.beats - beats) < EPS);
}

/**
 * Scompone una durata in figure rappresentabili (greedy, dalla più lunga).
 * Es. 2.5 → [minima, croma]; 5 → [semibreve, semiminima].
 * Restituisce [] se non è scomponibile in multipli di semicroma.
 */
export function decomposeDuration(beats: number): DurationSpec[] {
  const out: DurationSpec[] = [];
  let rest = beats;
  while (rest > EPS) {
    const d = DURATIONS.find((x) => x.beats <= rest + EPS);
    if (!d) return [];
    out.push(d);
    rest -= d.beats;
  }
  return out;
}

export function isRepresentable(beats: number): boolean {
  return decomposeDuration(beats).length > 0;
}
