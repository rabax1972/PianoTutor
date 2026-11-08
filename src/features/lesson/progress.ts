/**
 * Salvataggio di tentativi, progressi delle lezioni e tempo di pratica.
 */
import type { Lesson } from '../../core/content/schema';
import type { SessionResult } from '../../core/evaluation/types';
import { midiToPitch } from '../../core/music/pitch';
import type { InputKind } from '../../input/types';
import { storage, type Attempt, type LessonProgress } from '../../storage';

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function playableSteps(lesson: Lesson): string[] {
  return lesson.steps.filter((s) => s.type !== 'explain').map((s) => s.id);
}

/** Stelle della lezione: media delle migliori stelle degli step suonabili, arrotondata (tono incoraggiante). */
export function lessonStars(lesson: Lesson, stepStars: Record<string, number>): 0 | 1 | 2 | 3 {
  const ids = playableSteps(lesson);
  if (ids.length === 0) return 3;
  const avg = ids.reduce((s, id) => s + (stepStars[id] ?? 0), 0) / ids.length;
  return Math.round(avg) as 0 | 1 | 2 | 3;
}

export interface AttemptMeta {
  lessonId: string;
  stepId: string;
  inputMode: InputKind;
  tempoScale: number;
  startedAt: number;
  practiceMs: number;
}

export async function recordAttempt(result: SessionResult, meta: AttemptMeta): Promise<void> {
  const attempt: Attempt = {
    id: newId(),
    lessonId: meta.lessonId,
    stepId: meta.stepId,
    startedAt: meta.startedAt,
    durationMs: Math.round(meta.practiceMs),
    inputMode: meta.inputMode,
    tempoScale: meta.tempoScale,
    pitchAccuracy: result.pitchAccuracy,
    timingAccuracy: result.timingAccuracy ?? 0,
    stars: result.stars,
    noteResults: result.onsets.map((o) => ({
      expected: o.expected.map((m) => midiToPitch(m)),
      played: o.played.map((m) => midiToPitch(m)),
      deltaMs: o.deltaMs,
      grade: o.grade,
    })),
    updatedAt: Date.now(),
  };
  await storage.progress.addAttempt(attempt);
}

export async function addPracticeTime(ms: number): Promise<void> {
  if (ms > 500) await storage.stats.addPractice(todayKey(), Math.round(ms));
}

/** Aggiorna il progresso della lezione dopo uno step (suonabile o spiegazione). */
export async function completeStep(lesson: Lesson, stepId: string, stars?: number): Promise<LessonProgress> {
  const cur: LessonProgress = (await storage.progress.getLesson(lesson.id)) ?? {
    lessonId: lesson.id,
    bestStars: 0,
    completedSteps: [],
    stepStars: {},
    completed: false,
    attempts: 0,
    updatedAt: 0,
  };
  const stepStars = { ...(cur.stepStars ?? {}) };
  if (stars !== undefined) stepStars[stepId] = Math.max(stepStars[stepId] ?? 0, stars);
  const completedSteps = cur.completedSteps.includes(stepId) ? cur.completedSteps : [...cur.completedSteps, stepId];
  const completed = lesson.steps.every((s) => completedSteps.includes(s.id));
  const best = completed ? Math.max(cur.bestStars, lessonStars(lesson, stepStars)) : cur.bestStars;
  const next: LessonProgress = {
    ...cur,
    stepStars,
    completedSteps,
    completed,
    attempts: cur.attempts + (stars !== undefined ? 1 : 0),
    bestStars: best as 0 | 1 | 2 | 3,
    updatedAt: Date.now(),
  };
  await storage.progress.putLesson(next);
  return next;
}
