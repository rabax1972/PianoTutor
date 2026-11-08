/**
 * Metriche di latenza raccolte durante l'uso, mostrate nella schermata Diagnostica.
 */
const MAX = 30;
const touchDelays: number[] = [];

/** Ritardo tra l'evento touch generato dal sistema e la sua gestione nell'app (ms). */
export function recordTouchDelay(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0 || ms > 1000) return;
  touchDelays.push(ms);
  if (touchDelays.length > MAX) touchDelays.shift();
}

export function touchDelayStats(): { avg: number; max: number; count: number } {
  if (touchDelays.length === 0) return { avg: 0, max: 0, count: 0 };
  const sum = touchDelays.reduce((a, b) => a + b, 0);
  return { avg: sum / touchDelays.length, max: Math.max(...touchDelays), count: touchDelays.length };
}
