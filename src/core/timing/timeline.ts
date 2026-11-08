/**
 * Timeline di un brano: eventi normalizzati, battute, onset.
 * TS puro: usato da rendering, riproduzione e (M3) valutazione.
 */
import type { NoteEvent, Piece } from '../content/schema';
import { pitchToMidi } from '../music/pitch';

export type Staff = 'treble' | 'bass';

export interface TimelineEvent {
  /** indice nell'array events del brano: id stabile per evidenziazioni e risultati */
  index: number;
  t: number;
  d: number;
  pitches: string[];
  midis: number[];
  hand: 'R' | 'L';
  staff: Staff;
  fingers?: number[];
  tie: boolean;
  label?: string;
  isRest: boolean;
}

/** Un istante in cui iniziano uno o più eventi (note/accordi/pause) */
export interface Onset {
  t: number;
  events: number[];
  /** note da suonare in questo istante (senza pause), per mano */
  midis: number[];
}

export interface Timeline {
  events: TimelineEvent[];
  onsets: Onset[];
  /** beat per battuta (4/4 → 4, 3/4 → 3, 6/8 → 3) */
  measureBeats: number;
  pickupBeats: number;
  /** inizio di ogni battuta, in beat */
  measureStarts: number[];
  totalBeats: number;
}

const EPS = 1e-6;

export function measureBeats(piece: Pick<Piece, 'timeSignature'>): number {
  const [num, den] = piece.timeSignature;
  return (num * 4) / den;
}

export function resolveStaff(e: Pick<NoteEvent, 'staff' | 'hand'>): Staff {
  return e.staff ?? (e.hand === 'R' ? 'treble' : 'bass');
}

export function buildTimeline(piece: Piece): Timeline {
  const events: TimelineEvent[] = piece.events.map((e, index) => ({
    index,
    t: e.t,
    d: e.d,
    pitches: e.p,
    midis: e.p.map(pitchToMidi),
    hand: e.hand,
    staff: resolveStaff(e),
    fingers: e.fingers,
    tie: e.tie ?? false,
    label: e.label,
    isRest: e.p.length === 0,
  }));
  events.sort((a, b) => a.t - b.t || a.index - b.index);

  const mb = measureBeats(piece);
  const pickup = piece.pickupBeats ?? 0;
  const end = Math.max(...events.map((e) => e.t + e.d));
  const measureStarts: number[] = [0];
  let m = pickup > EPS ? pickup : mb;
  while (m < end - EPS) {
    measureStarts.push(m);
    m += mb;
  }
  const totalBeats = m;

  const onsetMap = new Map<number, Onset>();
  for (const e of events) {
    const key = Math.round(e.t * 1e4) / 1e4;
    let o = onsetMap.get(key);
    if (!o) {
      o = { t: e.t, events: [], midis: [] };
      onsetMap.set(key, o);
    }
    o.events.push(e.index);
    // una nota legata dalla precedente non va ripremuta
    if (!e.isRest && !isTiedFromPrevious(events, e)) o.midis.push(...e.midis);
  }
  const onsets = [...onsetMap.values()].sort((a, b) => a.t - b.t);

  return { events, onsets, measureBeats: mb, pickupBeats: pickup, measureStarts, totalBeats };
}

function isTiedFromPrevious(events: TimelineEvent[], e: TimelineEvent): boolean {
  return events.some(
    (p) => p.tie && p.staff === e.staff && Math.abs(p.t + p.d - e.t) < EPS && p.midis.some((m) => e.midis.includes(m)),
  );
}

/** Indice della battuta che contiene il beat dato. */
export function measureIndexAt(tl: Timeline, beat: number): number {
  let lo = 0;
  let hi = tl.measureStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tl.measureStarts[mid]! <= beat + EPS) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function measureEnd(tl: Timeline, index: number): number {
  return tl.measureStarts[index + 1] ?? tl.totalBeats;
}

/** Eventi (non pause) che suonano al beat dato. */
export function soundingAt(tl: Timeline, beat: number): TimelineEvent[] {
  return tl.events.filter((e) => !e.isRest && e.t <= beat + EPS && beat < e.t + e.d - EPS);
}

/** Range di note del brano (MIDI), utile per scegliere le ottave della tastiera. */
export function pitchRange(tl: Timeline): { min: number; max: number } | null {
  const all = tl.events.flatMap((e) => e.midis);
  if (all.length === 0) return null;
  return { min: Math.min(...all), max: Math.max(...all) };
}

/**
 * Controlli semantici che lo schema JSON non può esprimere.
 * Restituisce messaggi d'errore in italiano (vuoto = brano valido).
 */
export function checkPiece(piece: Piece): string[] {
  const errors: string[] = [];
  const tl = buildTimeline(piece);
  const where = (e: TimelineEvent) => `evento #${e.index} (t=${e.t})`;

  for (const e of tl.events) {
    const mi = measureIndexAt(tl, e.t);
    if (e.t + e.d > measureEnd(tl, mi) + EPS) {
      errors.push(`${where(e)}: attraversa la stanghetta di battuta ${mi + 1}; dividilo in due note con "tie": true`);
    }
    const frac = (e.d * 4) % 1;
    if (Math.abs(frac) > EPS && Math.abs(frac - 1) > EPS) {
      errors.push(`${where(e)}: durata ${e.d} non multipla di semicroma (0.25)`);
    }
  }

  for (const staff of ['treble', 'bass'] as const) {
    const evs = tl.events.filter((e) => e.staff === staff);
    for (let i = 1; i < evs.length; i++) {
      const prev = evs[i - 1]!;
      const cur = evs[i]!;
      if (cur.t < prev.t + prev.d - EPS) {
        errors.push(
          `${where(cur)}: si sovrappone a ${where(prev)} sullo stesso rigo; per un accordo metti tutte le note nello stesso evento`,
        );
      }
    }
    if (evs.length > 0 && !piece.staves.includes(staff)) {
      errors.push(`ci sono note sul rigo "${staff}" ma "staves" non lo contiene`);
    }
  }
  return errors;
}

/** Intervallo in beat delle battute [from, to] (numerate da 1). */
export function measureRange(tl: Timeline, fromMeasure: number, toMeasure: number): { from: number; to: number } {
  const a = Math.max(0, Math.min(tl.measureStarts.length - 1, fromMeasure - 1));
  const b = Math.max(a, Math.min(tl.measureStarts.length - 1, toMeasure - 1));
  return { from: tl.measureStarts[a]!, to: measureEnd(tl, b) };
}

/**
 * Restringe la timeline a una sezione (per "ripeti sezione"): le posizioni restano assolute,
 * così lo spartito non va ridisegnato.
 */
export function sliceTimeline(tl: Timeline, from: number, to: number): Timeline {
  const inRange = (t: number) => t >= from - EPS && t < to - EPS;
  return {
    ...tl,
    events: tl.events.filter((e) => inRange(e.t)),
    onsets: tl.onsets.filter((o) => inRange(o.t)),
    totalBeats: to,
  };
}
