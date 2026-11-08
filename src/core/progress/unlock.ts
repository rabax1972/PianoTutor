/**
 * Sblocco progressivo delle lezioni (TS puro).
 *  - una lezione è "superata" se completata con almeno 1 stella
 *  - nella stessa unità si sblocca la lezione successiva a quella superata
 *  - la prima lezione di un'unità richiede le lezioni indicate in unit.unlock
 *    (con almeno unit.unlock.minStars stelle, default 1) e la fine dell'unità precedente
 */
import type { Course } from '../content/schema';

export interface LessonState {
  completed: boolean;
  bestStars: number;
}

export type ProgressMap = ReadonlyMap<string, LessonState>;

export function isPassed(p: LessonState | undefined, minStars = 1): boolean {
  return !!p && p.completed && p.bestStars >= minStars;
}

export function isUnitUnlocked(course: Course, unitId: string, progress: ProgressMap): boolean {
  const ui = course.units.findIndex((u) => u.id === unitId);
  if (ui <= 0) return ui === 0;
  const unit = course.units[ui]!;
  const min = unit.unlock.minStars ?? 1;
  const required = unit.unlock.requiresLessons.length ? unit.unlock.requiresLessons : course.units[ui - 1]!.lessons;
  return required.every((id) => isPassed(progress.get(id), min));
}

export function isLessonUnlocked(course: Course, lessonId: string, progress: ProgressMap): boolean {
  const unit = course.units.find((u) => u.lessons.includes(lessonId));
  if (!unit || !isUnitUnlocked(course, unit.id, progress)) return false;
  const i = unit.lessons.indexOf(lessonId);
  return i === 0 || isPassed(progress.get(unit.lessons[i - 1]!));
}

/** Prima lezione sbloccata e non ancora superata (per "Continua"), oppure undefined se il corso è finito. */
export function nextLesson(course: Course, progress: ProgressMap): string | undefined {
  for (const u of course.units)
    for (const id of u.lessons) if (isLessonUnlocked(course, id, progress) && !isPassed(progress.get(id))) return id;
  return undefined;
}

export function unitStats(course: Course, unitId: string, progress: ProgressMap): { passed: number; total: number; stars: number } {
  const unit = course.units.find((u) => u.id === unitId)!;
  let passed = 0;
  let stars = 0;
  for (const id of unit.lessons) {
    const p = progress.get(id);
    if (isPassed(p)) passed++;
    stars += p?.bestStars ?? 0;
  }
  return { passed, total: unit.lessons.length, stars };
}
