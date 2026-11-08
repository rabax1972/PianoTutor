import { describe, expect, it } from 'vitest';
import type { Course } from '../content/schema';
import { badgeProgress, newBadges, type AchievementStats, type Badge } from './badges';
import { mostMissedNotes, recentAccuracy, totals, type AttemptLike } from './stats';
import { addDays, computeStreak, goalProgress, lastDays } from './streak';
import { isLessonUnlocked, isUnitUnlocked, nextLesson, unitStats, type LessonState } from './unlock';

const min = (m: number) => m * 60_000;

describe('streak', () => {
  it('calcola i giorni', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('conta i giorni consecutivi fino a oggi', () => {
    const days = [
      { date: '2026-11-06', practiceMs: min(5) },
      { date: '2026-11-07', practiceMs: min(12) },
      { date: '2026-11-08', practiceMs: min(3) },
    ];
    expect(computeStreak(days, '2026-11-08')).toEqual({ current: 3, best: 3, practicedToday: true });
  });

  it('oggi non ancora suonato non rompe la streak', () => {
    const days = [
      { date: '2026-11-06', practiceMs: min(5) },
      { date: '2026-11-07', practiceMs: min(5) },
    ];
    expect(computeStreak(days, '2026-11-08')).toMatchObject({ current: 2, practicedToday: false });
  });

  it('un giorno saltato azzera la streak ma conserva il record', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-07', '2026-11-08'].map((date) => ({ date, practiceMs: min(2) }));
    expect(computeStreak(days, '2026-11-08')).toEqual({ current: 2, best: 4, practicedToday: true });
  });

  it('meno di un minuto non conta', () => {
    expect(computeStreak([{ date: '2026-11-08', practiceMs: 20_000 }], '2026-11-08').current).toBe(0);
  });

  it('obiettivo giornaliero e ultimi giorni', () => {
    const days = [{ date: '2026-11-08', practiceMs: min(6) }];
    expect(goalProgress(days, '2026-11-08', 10)).toEqual({ minutes: 6, ratio: 0.6, reached: false });
    expect(goalProgress(days, '2026-11-08', 5).reached).toBe(true);
    const week = lastDays(days, '2026-11-08', 7);
    expect(week).toHaveLength(7);
    expect(week[0]!.date).toBe('2026-11-02');
    expect(week[6]).toEqual({ date: '2026-11-08', minutes: 6 });
  });
});

const course: Course = {
  schemaVersion: 1,
  id: 'c',
  title: 'C',
  units: [
    { id: 'u1', title: 'U1', description: '', icon: '', lessons: ['a', 'b'], unlock: { requiresLessons: [] } },
    { id: 'u2', title: 'U2', description: '', icon: '', lessons: ['c', 'd'], unlock: { requiresLessons: [], minStars: 2 } },
  ],
};
const pm = (o: Record<string, [boolean, number]>) => new Map<string, LessonState>(Object.entries(o).map(([k, [completed, bestStars]]) => [k, { completed, bestStars }]));

describe('sblocchi', () => {
  it('all’inizio è aperta solo la prima lezione', () => {
    const p = pm({});
    expect(isLessonUnlocked(course, 'a', p)).toBe(true);
    expect(isLessonUnlocked(course, 'b', p)).toBe(false);
    expect(isUnitUnlocked(course, 'u2', p)).toBe(false);
    expect(nextLesson(course, p)).toBe('a');
  });

  it('serve almeno una stella per proseguire', () => {
    expect(isLessonUnlocked(course, 'b', pm({ a: [true, 0] }))).toBe(false);
    expect(isLessonUnlocked(course, 'b', pm({ a: [true, 1] }))).toBe(true);
  });

  it('l’unità successiva richiede le stelle minime sulle lezioni precedenti', () => {
    expect(isUnitUnlocked(course, 'u2', pm({ a: [true, 3], b: [true, 1] }))).toBe(false);
    const p = pm({ a: [true, 3], b: [true, 2] });
    expect(isUnitUnlocked(course, 'u2', p)).toBe(true);
    expect(isLessonUnlocked(course, 'c', p)).toBe(true);
    expect(isLessonUnlocked(course, 'd', p)).toBe(false);
    expect(nextLesson(course, p)).toBe('c');
    expect(unitStats(course, 'u1', p)).toEqual({ passed: 2, total: 2, stars: 5 });
  });

  it('corso finito: nessuna lezione successiva', () => {
    expect(nextLesson(course, pm({ a: [true, 3], b: [true, 3], c: [true, 3], d: [true, 3] }))).toBeUndefined();
  });
});

const attempt = (over: Partial<AttemptLike>): AttemptLike => ({
  lessonId: 'l',
  stepId: 's',
  startedAt: 0,
  durationMs: 1000,
  inputMode: 'virtual',
  pitchAccuracy: 1,
  timingAccuracy: 0,
  stars: 3,
  noteResults: [],
  ...over,
});

describe('statistiche', () => {
  it('note più sbagliate', () => {
    const atts = [
      attempt({
        noteResults: [
          { expected: ['C4'], played: ['C4'], grade: 'perfect' },
          { expected: ['D4'], played: ['E4'], grade: 'wrong' },
          { expected: ['D4'], played: [], grade: 'missed' },
          { expected: ['E4'], played: ['F4', 'E4'], grade: 'corrected' },
        ],
      }),
    ];
    expect(mostMissedNotes(atts)).toEqual([
      { midi: 62, misses: 2, total: 2 },
      { midi: 64, misses: 1, total: 1 },
    ]);
  });

  it('precisione recente in ordine cronologico e totali', () => {
    const atts = [attempt({ startedAt: 3, pitchAccuracy: 0.9 }), attempt({ startedAt: 1, pitchAccuracy: 0.5, stars: 1, timingAccuracy: 0.8, inputMode: 'midi' })];
    expect(recentAccuracy(atts).map((a) => a.accuracy)).toEqual([0.5, 0.9]);
    const t = totals(atts);
    expect(t).toMatchObject({ attempts: 2, perfect: 1, avgAccuracy: 0.7, realtime: 1 });
    expect([...t.inputModes].sort()).toEqual(['midi', 'virtual']);
  });
});

describe('badge', () => {
  const badges: Badge[] = [
    { id: 'prima', title: '', description: '', icon: '', criterion: { type: 'attempts', count: 1 } },
    { id: 'streak3', title: '', description: '', icon: '', criterion: { type: 'streak', days: 3 } },
    { id: 'u1', title: '', description: '', icon: '', criterion: { type: 'unit', unitId: 'u1' } },
    { id: 'midi', title: '', description: '', icon: '', criterion: { type: 'input', mode: 'midi' } },
  ];
  const stats: AchievementStats = {
    attempts: 4,
    lessonsPassed: 2,
    unitsCompleted: new Set(['u1']),
    bestStreak: 2,
    perfectAttempts: 1,
    totalMinutes: 12,
    goalDays: 1,
    realtimeAttempts: 0,
    inputModes: new Set(['virtual']),
  };

  it('assegna solo i badge nuovi e meritati', () => {
    expect(newBadges(badges, stats, new Set()).map((b) => b.id)).toEqual(['prima', 'u1']);
    expect(newBadges(badges, stats, new Set(['prima'])).map((b) => b.id)).toEqual(['u1']);
  });

  it('mostra l’avanzamento verso un badge', () => {
    expect(badgeProgress({ type: 'streak', days: 3 }, stats)).toBeCloseTo(2 / 3);
    expect(badgeProgress({ type: 'input', mode: 'midi' }, stats)).toBe(0);
  });
});
