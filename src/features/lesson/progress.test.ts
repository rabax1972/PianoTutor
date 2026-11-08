import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Lesson } from '../../core/content/schema';
import { completeStep, lessonStars, todayKey } from './progress';

const lesson = {
  id: 'test-lesson',
  steps: [
    { type: 'explain', id: 'a', slides: [] },
    { type: 'exercise', id: 'b' },
    { type: 'song', id: 'c' },
  ],
} as unknown as Lesson;

describe('progress', () => {
  it('le stelle della lezione sono la media degli step suonabili', () => {
    expect(lessonStars(lesson, { b: 3, c: 3 })).toBe(3);
    expect(lessonStars(lesson, { b: 3, c: 2 })).toBe(3); // 2,5 → 3
    expect(lessonStars(lesson, { b: 2, c: 1 })).toBe(2); // 1,5 → 2
    expect(lessonStars(lesson, { b: 1, c: 0 })).toBe(1);
    expect(lessonStars(lesson, {})).toBe(0);
  });

  it('formatta la data locale', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('completa la lezione e conserva le stelle migliori', async () => {
    await completeStep(lesson, 'a');
    await completeStep(lesson, 'b', 3);
    let p = await completeStep(lesson, 'c', 0);
    expect(p.completed).toBe(true);
    expect(p.bestStars).toBe(2); // (3 + 0) / 2 = 1,5 → 2
    p = await completeStep(lesson, 'c', 3);
    expect(p.bestStars).toBe(3);
    p = await completeStep(lesson, 'b', 1); // un tentativo peggiore non abbassa il record
    expect(p.stepStars.b).toBe(3);
    expect(p.bestStars).toBe(3);
  });
});
