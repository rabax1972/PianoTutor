/**
 * Streak giornaliera e obiettivo quotidiano (TS puro).
 * Un giorno "conta" se si è suonato almeno MIN_DAY_MS. Oggi non ancora suonato non rompe la
 * streak: si conta da ieri (c'è tempo fino a mezzanotte).
 */

export interface DayPractice {
  /** YYYY-MM-DD locale */
  date: string;
  practiceMs: number;
}

export const MIN_DAY_MS = 60_000;

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(y, m - 1, d + delta));
}

export interface StreakInfo {
  current: number;
  best: number;
  practicedToday: boolean;
}

export function computeStreak(days: DayPractice[], today: string): StreakInfo {
  const ok = new Set(days.filter((d) => d.practiceMs >= MIN_DAY_MS).map((d) => d.date));
  const practicedToday = ok.has(today);
  let current = 0;
  let cursor = practicedToday ? today : addDays(today, -1);
  while (ok.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  // record: la sequenza più lunga di giorni consecutivi
  let best = 0;
  for (const d of ok) {
    if (ok.has(addDays(d, -1))) continue; // non è l'inizio di una sequenza
    let len = 0;
    let c = d;
    while (ok.has(c)) {
      len++;
      c = addDays(c, 1);
    }
    best = Math.max(best, len);
  }
  return { current, best: Math.max(best, current), practicedToday };
}

export function minutesOn(days: DayPractice[], date: string): number {
  return (days.find((d) => d.date === date)?.practiceMs ?? 0) / 60_000;
}

export function goalProgress(days: DayPractice[], today: string, goalMin: number): { minutes: number; ratio: number; reached: boolean } {
  const minutes = minutesOn(days, today);
  const ratio = goalMin > 0 ? Math.min(1, minutes / goalMin) : 1;
  return { minutes, ratio, reached: minutes >= goalMin };
}

/** Ultimi `n` giorni (dal più vecchio a oggi) con i minuti suonati. */
export function lastDays(days: DayPractice[], today: string, n: number): { date: string; minutes: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    return { date, minutes: minutesOn(days, date) };
  });
}
