/**
 * Promemoria quotidiano senza backend.
 *  - nell'app: avviso in home dopo l'ora scelta se oggi non si è ancora suonato
 *  - notifica di sistema: solo mentre l'app è aperta (anche in background), dove il browser
 *    lo consente. Le notifiche "programmate" ad app chiusa richiedono un server push (futuro).
 *  - calendario: file .ics con evento ricorrente giornaliero → funziona ovunque, anche su iPad
 */

export function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: Math.min(23, Math.max(0, h ?? 18)), m: Math.min(59, Math.max(0, m ?? 0)) };
}

/** È passata l'ora del promemoria (oggi)? */
export function isReminderDue(time: string, now = new Date()): boolean {
  const { h, m } = parseTime(time);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** File iCalendar con un evento giornaliero ricorrente di `durationMin` minuti. */
export function buildIcs(time: string, durationMin: number, url: string, now = new Date()): string {
  const { h, m } = parseTime(time);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (start.getTime() < now.getTime()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Piano Tutor//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:pianotutor-promemoria-${stamp}@pianotutor`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:🎹 Piano Tutor: ${durationMin} minuti di pianoforte`,
    `DESCRIPTION:È l'ora della tua pratica quotidiana. ${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Piano Tutor',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadIcs(time: string, durationMin: number): void {
  const url = location.href.split('#')[0]!;
  const blob = new Blob([buildIcs(time, durationMin, url)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'piano-tutor-promemoria.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Programma (finché l'app resta aperta) una notifica all'ora scelta, se oggi non si è suonato.
 * `practicedToday` viene ricontrollato al momento della notifica.
 */
export function scheduleReminder(enabled: boolean, time: string, practicedToday: () => boolean): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return;
  const { h, m } = parseTime(time);
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  timer = setTimeout(async () => {
    if (!practicedToday()) {
      const opts: NotificationOptions = { body: 'Bastano pochi minuti: la tua tastiera ti aspetta!', icon: 'pwa-192x192.png', tag: 'pianotutor-reminder' };
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification('🎹 È l’ora del pianoforte', opts);
      else new Notification('🎹 È l’ora del pianoforte', opts);
    }
    scheduleReminder(enabled, time, practicedToday);
  }, Math.min(at.getTime() - now.getTime(), 2 ** 31 - 1));
}
