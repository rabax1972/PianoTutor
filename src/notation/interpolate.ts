export interface BeatPoint {
  t: number;
  x: number;
}

/** Interpolazione lineare a tratti; fuori dai limiti estrapola a velocità costante. */
export function interpolate(points: BeatPoint[], beat: number, pxPerBeat: number): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (beat <= first.t) return first.x - (first.t - beat) * pxPerBeat;
  if (beat >= last.t) return last.x + (beat - last.t) * pxPerBeat;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.t <= beat) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  return a.x + ((beat - a.t) / (b.t - a.t)) * (b.x - a.x);
}
