import { describe, expect, it } from 'vitest';
import { LessonSchema, PieceSchema } from './schema';

const piece = {
  schemaVersion: 1,
  id: 'test-piece',
  title: 'Prova',
  license: 'original',
  tempo: { bpm: 80 },
  timeSignature: [4, 4],
  key: { fifths: 0, mode: 'major' },
  staves: ['treble'],
  events: [
    { t: 0, d: 1, p: ['C4'], hand: 'R', fingers: [1] },
    { t: 1, d: 1, p: [], hand: 'R' },
    { t: 2, d: 2, p: ['C4', 'E4', 'G4'], hand: 'R', fingers: [1, 3, 5] },
  ],
};

describe('content schema', () => {
  it('accetta un brano valido', () => {
    expect(PieceSchema.safeParse(piece).success).toBe(true);
  });

  it('rifiuta altezze non valide', () => {
    const bad = { ...piece, events: [{ t: 0, d: 1, p: ['H4'], hand: 'R' }] };
    expect(PieceSchema.safeParse(bad).success).toBe(false);
  });

  it('rifiuta diteggiature non allineate', () => {
    const bad = { ...piece, events: [{ t: 0, d: 1, p: ['C4', 'E4'], hand: 'R', fingers: [1] }] };
    expect(PieceSchema.safeParse(bad).success).toBe(false);
  });

  it('rifiuta licenze non ammesse', () => {
    expect(PieceSchema.safeParse({ ...piece, license: 'copyrighted' }).success).toBe(false);
  });

  it('accetta una lezione con brano inline e riferimento', () => {
    const lesson = {
      schemaVersion: 1,
      id: 'u1-l01',
      unitId: 'u1',
      title: 'Il Do centrale',
      summary: 'Trova il Do',
      estimatedMinutes: 3,
      steps: [
        { type: 'explain', id: 'intro', slides: [{ text: 'Ciao!', highlightKeys: ['C4'] }] },
        { type: 'exercise', id: 'ex1', mode: 'guided', piece, settings: { flow: 'wait' } },
        { type: 'song', id: 'song', piece: 'fra-martino', settings: { flow: 'wait' } },
      ],
    };
    const r = LessonSchema.safeParse(lesson);
    expect(r.success).toBe(true);
  });
});
