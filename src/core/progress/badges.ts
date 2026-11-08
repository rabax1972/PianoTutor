/**
 * Badge: definiti come dati (content/badges.json, schema in badgeSchema.ts), valutati qui (TS puro).
 */
export type BadgeCriterion =
  | { type: 'attempts'; count: number }
  | { type: 'lessons'; count: number }
  | { type: 'unit'; unitId: string }
  | { type: 'streak'; days: number }
  | { type: 'perfect'; count: number }
  | { type: 'minutes'; total: number }
  | { type: 'goal-days'; count: number }
  | { type: 'realtime'; count: number }
  | { type: 'input'; mode: 'virtual' | 'mic' | 'midi' };

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  criterion: BadgeCriterion;
}

/** Fotografia dei progressi su cui valutare i badge. */
export interface AchievementStats {
  attempts: number;
  lessonsPassed: number;
  unitsCompleted: ReadonlySet<string>;
  bestStreak: number;
  perfectAttempts: number;
  totalMinutes: number;
  goalDays: number;
  realtimeAttempts: number;
  inputModes: ReadonlySet<string>;
}

export function meets(c: BadgeCriterion, s: AchievementStats): boolean {
  switch (c.type) {
    case 'attempts':
      return s.attempts >= c.count;
    case 'lessons':
      return s.lessonsPassed >= c.count;
    case 'unit':
      return s.unitsCompleted.has(c.unitId);
    case 'streak':
      return s.bestStreak >= c.days;
    case 'perfect':
      return s.perfectAttempts >= c.count;
    case 'minutes':
      return s.totalMinutes >= c.total;
    case 'goal-days':
      return s.goalDays >= c.count;
    case 'realtime':
      return s.realtimeAttempts >= c.count;
    case 'input':
      return s.inputModes.has(c.mode);
  }
}

/** Badge guadagnati ora e non ancora assegnati. */
export function newBadges(badges: Badge[], stats: AchievementStats, alreadyEarned: ReadonlySet<string>): Badge[] {
  return badges.filter((b) => !alreadyEarned.has(b.id) && meets(b.criterion, stats));
}

/** Avanzamento verso un badge (0–1), per mostrare "quasi fatto". */
export function badgeProgress(c: BadgeCriterion, s: AchievementStats): number {
  const r = (v: number, t: number) => Math.max(0, Math.min(1, v / t));
  switch (c.type) {
    case 'attempts':
      return r(s.attempts, c.count);
    case 'lessons':
      return r(s.lessonsPassed, c.count);
    case 'streak':
      return r(s.bestStreak, c.days);
    case 'perfect':
      return r(s.perfectAttempts, c.count);
    case 'minutes':
      return r(s.totalMinutes, c.total);
    case 'goal-days':
      return r(s.goalDays, c.count);
    case 'realtime':
      return r(s.realtimeAttempts, c.count);
    default:
      return meets(c, s) ? 1 : 0;
  }
}
