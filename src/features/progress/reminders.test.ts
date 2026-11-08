import { describe, expect, it } from 'vitest';
import { buildIcs, isReminderDue, parseTime } from './reminders';

describe('promemoria', () => {
  it('interpreta l’orario', () => {
    expect(parseTime('07:30')).toEqual({ h: 7, m: 30 });
    expect(parseTime('99:99')).toEqual({ h: 23, m: 59 });
  });

  it('sa se è l’ora del promemoria', () => {
    expect(isReminderDue('18:00', new Date(2026, 10, 8, 17, 59))).toBe(false);
    expect(isReminderDue('18:00', new Date(2026, 10, 8, 18, 0))).toBe(true);
  });

  it('genera un evento di calendario ricorrente', () => {
    const ics = buildIcs('18:00', 10, 'https://example.org/pianotutor/', new Date(2026, 10, 8, 9, 0));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261108T180000');
    expect(ics).toContain('DTEND:20261108T181000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('URL:https://example.org/pianotutor/');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });

  it('se l’ora di oggi è passata, inizia da domani', () => {
    const ics = buildIcs('08:00', 15, 'x', new Date(2026, 10, 8, 9, 0));
    expect(ics).toContain('DTSTART:20261109T080000');
  });
});
