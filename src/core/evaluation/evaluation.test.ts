import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORING, type Piece } from '../content/schema';
import { buildTimeline } from '../timing/timeline';
import { RealtimeEvaluator } from './realtimeEvaluator';
import { starsFor, timingScore } from './scoring';
import { WaitEvaluator } from './waitEvaluator';

const piece: Piece = {
  schemaVersion: 1,
  id: 'p',
  title: 'P',
  license: 'original',
  tempo: { bpm: 60 }, // 1 beat = 1000 ms
  timeSignature: [4, 4],
  key: { fifths: 0, mode: 'major' },
  staves: ['treble'],
  events: [
    { t: 0, d: 1, p: ['C4'], hand: 'R' },
    { t: 1, d: 1, p: ['D4'], hand: 'R' },
    { t: 2, d: 1, p: [], hand: 'R' },
    { t: 3, d: 1, p: ['C4', 'E4', 'G4'], hand: 'R' },
  ],
};
const tl = buildTimeline(piece);
const C = 60, D = 62, E = 64, G = 67, F = 65;

describe('scoring', () => {
  it('assegna le stelle in base alle soglie', () => {
    expect(starsFor(0.5, [0.6, 0.8, 0.93])).toBe(0);
    expect(starsFor(0.6, [0.6, 0.8, 0.93])).toBe(1);
    expect(starsFor(0.85, [0.6, 0.8, 0.93])).toBe(2);
    expect(starsFor(0.93, [0.6, 0.8, 0.93])).toBe(3);
  });

  it('calcola il punteggio di timing', () => {
    const cfg = { perfectMs: 80, goodMs: 180 };
    expect(timingScore(50, cfg)).toBe(1);
    expect(timingScore(-80, cfg)).toBe(1);
    expect(timingScore(130, cfg)).toBeCloseTo(0.75);
    expect(timingScore(400, cfg)).toBe(0.5);
  });
});

describe('WaitEvaluator', () => {
  it('avanza solo con la nota giusta e salta le pause', () => {
    const ev = new WaitEvaluator(tl, DEFAULT_SCORING);
    expect(ev.currentOnset!.midis).toEqual([C]);
    expect(ev.noteOn(D).kind).toBe('wrong');
    expect(ev.currentOnset!.midis).toEqual([C]);
    const hit = ev.noteOn(C);
    expect(hit).toMatchObject({ kind: 'hit', grade: 'corrected', onsetComplete: true });
    expect(ev.noteOn(D)).toMatchObject({ kind: 'hit', grade: 'perfect' });
    // la pausa a t=2 viene saltata: ora tocca all'accordo
    expect(ev.currentOnset!.t).toBe(3);
  });

  it('completa un accordo anche con note premute una alla volta', () => {
    const ev = new WaitEvaluator(tl, DEFAULT_SCORING);
    ev.noteOn(C);
    ev.noteOn(D);
    expect(ev.noteOn(E)).toMatchObject({ kind: 'hit', onsetComplete: false });
    expect(ev.remaining).toEqual([C, G]);
    ev.noteOn(C);
    expect(ev.noteOn(G)).toMatchObject({ kind: 'hit', onsetComplete: true });
    expect(ev.done).toBe(true);
  });

  it('calcola precisione, stelle ed errori', () => {
    const ev = new WaitEvaluator(tl, DEFAULT_SCORING);
    ev.noteOn(C);
    ev.noteOn(F); // errore
    ev.noteOn(D);
    [C, E, G].forEach((m) => ev.noteOn(m));
    const r = ev.finish();
    expect(r.pitchAccuracy).toBeCloseTo(5 / 6);
    expect(r.timingAccuracy).toBeNull();
    expect(r.stars).toBe(2);
    expect(r.errors).toEqual([{ expected: [D], played: F }]);
    expect(r.counts).toMatchObject({ perfect: 2, corrected: 1 });
  });

  it('esecuzione perfetta = 3 stelle', () => {
    const ev = new WaitEvaluator(tl, DEFAULT_SCORING);
    [C, D, C, E, G].forEach((m) => ev.noteOn(m));
    expect(ev.finish()).toMatchObject({ pitchAccuracy: 1, stars: 3, score: 1 });
  });
});

describe('RealtimeEvaluator', () => {
  const make = () => new RealtimeEvaluator(tl, DEFAULT_SCORING, () => 1000);

  it('classifica perfetta, in anticipo e in ritardo', () => {
    const ev = make();
    expect(ev.noteOn(C, 0.05)).toMatchObject({ kind: 'hit', grade: 'perfect' });
    expect(ev.noteOn(D, 0.85)).toMatchObject({ kind: 'hit', grade: 'early', deltaMs: expect.closeTo(-150, 3) });
    const late = make();
    expect(late.noteOn(C, 0.12)).toMatchObject({ grade: 'late' });
  });

  it('una nota fuori finestra è un errore, non un colpo', () => {
    const ev = make();
    expect(ev.noteOn(C, 0.4).kind).toBe('wrong');
  });

  it('segna come mancate le note non suonate quando la finestra è passata', () => {
    const ev = make();
    ev.noteOn(C, 0);
    const closed = ev.advance(1.3);
    expect(closed.map((j) => [j.t, j.grade])).toEqual([[1, 'missed']]);
  });

  it('distingue nota sbagliata da nota mancata', () => {
    const ev = make();
    ev.noteOn(E, 0.02); // al posto del Do
    const [j] = ev.advance(0.5);
    expect(j).toMatchObject({ t: 0, grade: 'wrong', played: [E] });
  });

  it('abbina ogni nota dell’accordo e usa lo scarto peggiore', () => {
    const ev = make();
    ev.noteOn(C, 2.98);
    ev.noteOn(E, 3.0);
    const fb = ev.noteOn(G, 3.12);
    expect(fb).toMatchObject({ kind: 'hit', onsetComplete: true });
    const r = ev.finish();
    expect(r.onsets.find((o) => o.t === 3)!.grade).toBe('late');
  });

  it('calcola il risultato complessivo', () => {
    const ev = make();
    ev.noteOn(C, 0);
    ev.noteOn(D, 1.15); // tardi (150 ms)
    ev.noteOn(C, 3);
    ev.noteOn(E, 3);
    ev.noteOn(G, 3);
    const r = ev.finish();
    expect(r.pitchAccuracy).toBe(1);
    expect(r.timingAccuracy).toBeCloseTo((1 + 0.65 + 1 + 1 + 1) / 5, 2);
    expect(r.stars).toBe(3);
    expect(r.counts).toMatchObject({ perfect: 2, late: 1 });
  });

  it('le finestre restano in ms anche a velocità ridotta', () => {
    const ev = new RealtimeEvaluator(tl, DEFAULT_SCORING, () => 2000); // metà velocità
    // 0.05 beat = 100 ms → in anticipo/ritardo, non perfetta
    expect(ev.noteOn(C, 0.05)).toMatchObject({ grade: 'late' });
  });

  it('le note sbagliate abbassano la precisione', () => {
    const ev = make();
    ev.noteOn(C, 0);
    ev.noteOn(F, 0.5);
    ev.noteOn(D, 1);
    [C, E, G].forEach((m) => ev.noteOn(m, 3));
    const r = ev.finish();
    expect(r.pitchAccuracy).toBeCloseTo(5 / 5.5);
    expect(r.errors).toHaveLength(1);
  });
});
