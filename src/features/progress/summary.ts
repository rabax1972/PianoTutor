/**
 * Riepilogo dei progressi (da storage) e assegnazione dei traguardi.
 * Le funzioni di calcolo sono in src/core/progress (TS puro, testate).
 */
import { useEffect, useState } from 'react';
import { useSettings } from '../../app/settingsStore';
import { getBadges, getCourse } from '../../core/content/loader';
import { newBadges, type AchievementStats, type Badge } from '../../core/progress/badges';
import { totals } from '../../core/progress/stats';
import { computeStreak, dateKey, goalProgress, type StreakInfo } from '../../core/progress/streak';
import { isPassed, nextLesson, type ProgressMap } from '../../core/progress/unlock';
import { storage, type Attempt, type EarnedBadge, type LessonProgress, type PracticeDay } from '../../storage';
import { pushToast } from './toasts';

export interface ProgressSummary {
  today: string;
  lessons: Map<string, LessonProgress>;
  progressMap: ProgressMap;
  attempts: Attempt[];
  days: PracticeDay[];
  earned: EarnedBadge[];
  streak: StreakInfo;
  goal: { minutes: number; ratio: number; reached: boolean; goalMin: number };
  totalMinutes: number;
  next: string | undefined;
  stats: AchievementStats;
}

export async function loadSummary(goalMin: number): Promise<ProgressSummary> {
  const [lessonList, attempts, days, earned] = await Promise.all([
    storage.progress.listLessons(),
    storage.progress.listAttempts(),
    storage.stats.listPracticeDays(),
    storage.stats.listBadges(),
  ]);
  const today = dateKey(new Date());
  const lessons = new Map(lessonList.map((l) => [l.lessonId, l]));
  const progressMap: ProgressMap = new Map(lessonList.map((l) => [l.lessonId, { completed: l.completed, bestStars: l.bestStars }]));
  const course = getCourse();
  const streak = computeStreak(days, today);
  const totalMinutes = days.reduce((s, d) => s + d.practiceMs, 0) / 60_000;
  const t = totals(attempts);
  const unitsCompleted = new Set(course.units.filter((u) => u.lessons.every((id) => isPassed(progressMap.get(id)))).map((u) => u.id));
  const stats: AchievementStats = {
    attempts: t.attempts,
    lessonsPassed: lessonList.filter((l) => isPassed(l)).length,
    unitsCompleted,
    bestStreak: streak.best,
    perfectAttempts: t.perfect,
    totalMinutes,
    goalDays: days.filter((d) => d.practiceMs / 60_000 >= goalMin).length,
    realtimeAttempts: t.realtime,
    inputModes: t.inputModes,
  };
  return {
    today,
    lessons,
    progressMap,
    attempts,
    days,
    earned,
    streak,
    goal: { ...goalProgress(days, today, goalMin), goalMin },
    totalMinutes,
    next: nextLesson(course, progressMap),
    stats,
  };
}

// ---------- notifiche di cambiamento ----------

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Da chiamare dopo ogni salvataggio di progressi: aggiorna le viste e controlla i traguardi. */
export function notifyProgress(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void checkAchievements().finally(() => listeners.forEach((l) => l()));
  }, 150);
}

export function onProgress(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Assegna i badge appena guadagnati e festeggia l'obiettivo del giorno. Restituisce i nuovi badge. */
export async function checkAchievements(): Promise<Badge[]> {
  try {
    const goalMin = useSettings.getState().settings.dailyGoalMin;
    const s = await loadSummary(goalMin);
    const fresh = newBadges(getBadges(), s.stats, new Set(s.earned.map((e) => e.badgeId)));
    for (const b of fresh) {
      if (await storage.stats.awardBadge(b.id)) pushToast({ icon: b.icon, title: `Nuovo badge: ${b.title}`, text: b.description });
    }
    celebrateGoal(s);
    return fresh;
  } catch (err) {
    console.warn('Traguardi non verificati', err);
    return [];
  }
}

function celebrateGoal(s: ProgressSummary) {
  if (!s.goal.reached) return;
  const key = `goal-celebrated-${s.today}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    return;
  }
  pushToast({ icon: '🎯', title: 'Obiettivo di oggi raggiunto!', text: `${s.goal.goalMin} minuti di pratica. Bravissimo!` });
}

/** Riepilogo reattivo, ricaricato a ogni cambiamento dei progressi. */
export function useProgressSummary(): ProgressSummary | null {
  const goalMin = useSettings((st) => st.settings.dailyGoalMin);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      loadSummary(goalMin)
        .then((s) => alive && setSummary(s))
        .catch(console.warn);
    load();
    const off = onProgress(load);
    return () => {
      alive = false;
      off();
    };
  }, [goalMin]);
  return summary;
}
