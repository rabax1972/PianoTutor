/**
 * Statistiche aggregate dai tentativi salvati (TS puro).
 */
import { pitchToMidi } from '../music/pitch';

export interface AttemptLike {
  lessonId: string;
  stepId: string;
  startedAt: number;
  durationMs: number;
  inputMode: string;
  pitchAccuracy: number;
  timingAccuracy: number;
  stars: number;
  noteResults: { expected: string[]; played: string[]; grade: string }[];
}

/** Note più sbagliate o mancate: conteggio per nota attesa (MIDI). */
export function mostMissedNotes(attempts: AttemptLike[], max = 5): { midi: number; misses: number; total: number }[] {
  const miss = new Map<number, number>();
  const tot = new Map<number, number>();
  for (const a of attempts)
    for (const r of a.noteResults)
      for (const p of r.expected) {
        const m = pitchToMidi(p);
        tot.set(m, (tot.get(m) ?? 0) + 1);
        if (r.grade === 'wrong' || r.grade === 'missed' || r.grade === 'corrected') miss.set(m, (miss.get(m) ?? 0) + 1);
      }
  return [...miss.entries()]
    .map(([midi, misses]) => ({ midi, misses, total: tot.get(midi) ?? misses }))
    .sort((a, b) => b.misses - a.misses || b.misses / b.total - a.misses / a.total)
    .slice(0, max);
}

/** Precisione delle ultime `n` sessioni (tentativi), dal più vecchio al più recente. */
export function recentAccuracy(attempts: AttemptLike[], n = 10): { startedAt: number; accuracy: number; stars: number; lessonId: string; stepId: string }[] {
  return [...attempts]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-n)
    .map((a) => ({ startedAt: a.startedAt, accuracy: a.pitchAccuracy, stars: a.stars, lessonId: a.lessonId, stepId: a.stepId }));
}

export function totals(attempts: AttemptLike[]): { attempts: number; perfect: number; avgAccuracy: number; inputModes: Set<string>; realtime: number } {
  const n = attempts.length;
  return {
    attempts: n,
    perfect: attempts.filter((a) => a.stars === 3).length,
    avgAccuracy: n ? attempts.reduce((s, a) => s + a.pitchAccuracy, 0) / n : 0,
    inputModes: new Set(attempts.map((a) => a.inputMode)),
    realtime: attempts.filter((a) => a.timingAccuracy > 0).length,
  };
}
