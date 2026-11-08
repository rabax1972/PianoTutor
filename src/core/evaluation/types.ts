/**
 * Tipi del motore di valutazione.
 *
 * Gradi:
 *  - perfect   entro ±perfectMs (verde)
 *  - early/late entro ±goodMs (giallo)
 *  - corrected wait mode: giusta dopo uno o più errori (giallo)
 *  - wrong     nota sbagliata al posto di quella attesa (rosso)
 *  - missed    non suonata in tempo (rosso)
 */
export type Grade = 'perfect' | 'early' | 'late' | 'corrected' | 'wrong' | 'missed';

export const GOOD_GRADES: readonly Grade[] = ['perfect', 'early', 'late', 'corrected'];

export interface OnsetJudgement {
  /** indice nell'array timeline.onsets */
  onsetIndex: number;
  t: number;
  grade: Grade;
  /** eventi (indici in piece.events) coinvolti */
  eventIndices: number[];
  expected: number[];
  /** note effettivamente suonate per questo onset (giuste e sbagliate) */
  played: number[];
  /** scarto medio (ms, negativo = in anticipo); solo realtime */
  deltaMs?: number;
}

export interface NoteError {
  expected: number[];
  played: number;
}

export interface SessionResult {
  mode: 'wait' | 'realtime';
  /** 0–1 */
  pitchAccuracy: number;
  /** 0–1, null in wait mode */
  timingAccuracy: number | null;
  /** 0–1 combinato secondo i pesi */
  score: number;
  stars: 0 | 1 | 2 | 3;
  onsets: OnsetJudgement[];
  errors: NoteError[];
  counts: Record<Grade, number>;
}

/** Feedback immediato restituito per ogni nota suonata. */
export type NoteFeedback =
  | { kind: 'hit'; midi: number; grade: Grade; onsetIndex: number; eventIndices: number[]; deltaMs?: number; onsetComplete: boolean }
  | { kind: 'wrong'; midi: number; onsetIndex: number | null; expected: number[] }
  | { kind: 'ignored'; midi: number };
