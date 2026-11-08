import type { ScoringConfig } from '../content/schema';
import type { Grade, NoteError, OnsetJudgement, SessionResult } from './types';

export function starsFor(score: number, thresholds: readonly [number, number, number]): 0 | 1 | 2 | 3 {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

/** Punteggio di timing di una nota: 1 entro perfectMs, poi scende linearmente fino a 0.5 a goodMs. */
export function timingScore(deltaMs: number, cfg: ScoringConfig['timing']): number {
  const d = Math.abs(deltaMs);
  if (d <= cfg.perfectMs) return 1;
  if (d >= cfg.goodMs) return 0.5;
  return 1 - (0.5 * (d - cfg.perfectMs)) / (cfg.goodMs - cfg.perfectMs);
}

export function emptyCounts(): Record<Grade, number> {
  return { perfect: 0, early: 0, late: 0, corrected: 0, wrong: 0, missed: 0 };
}

export function combineScore(pitch: number, timing: number | null, w: ScoringConfig['weights']): number {
  if (timing === null || w.timing <= 0) return pitch;
  const tot = w.pitch + w.timing;
  return tot > 0 ? (pitch * w.pitch + timing * w.timing) / tot : pitch;
}

export function buildResult(
  mode: 'wait' | 'realtime',
  onsets: OnsetJudgement[],
  errors: NoteError[],
  pitchAccuracy: number,
  timingAccuracy: number | null,
  cfg: ScoringConfig,
): SessionResult {
  const counts = emptyCounts();
  onsets.forEach((o) => counts[o.grade]++);
  const p = clamp01(pitchAccuracy);
  const t = timingAccuracy === null ? null : clamp01(timingAccuracy);
  const score = combineScore(p, t, cfg.weights);
  return { mode, pitchAccuracy: p, timingAccuracy: t, score, stars: starsFor(score, cfg.stars), onsets, errors, counts };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
