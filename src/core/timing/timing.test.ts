import { describe, expect, it } from 'vitest';
import type { Piece } from '../content/schema';
import { buildTimeline, checkPiece, measureIndexAt, measureRange, pitchRange, sliceTimeline, soundingAt } from './timeline';
import { Transport } from './transport';

const base: Omit<Piece, 'events'> = {
  schemaVersion: 1,
  id: 'p',
  title: 'P',
  license: 'original',
  tempo: { bpm: 60 },
  timeSignature: [4, 4],
  key: { fifths: 0, mode: 'major' },
  staves: ['treble', 'bass'],
};

const piece: Piece = {
  ...base,
  events: [
    { t: 0, d: 1, p: ['C4'], hand: 'R' },
    { t: 0, d: 4, p: ['C3'], hand: 'L' },
    { t: 1, d: 1, p: ['D4'], hand: 'R' },
    { t: 2, d: 2, p: ['E4', 'G4'], hand: 'R' },
    { t: 4, d: 2, p: ['F4'], hand: 'R', tie: true },
    { t: 6, d: 2, p: ['F4'], hand: 'R' },
    { t: 4, d: 4, p: [], hand: 'L' },
  ],
};

describe('timeline', () => {
  const tl = buildTimeline(piece);

  it('calcola battute e lunghezza', () => {
    expect(tl.measureBeats).toBe(4);
    expect(tl.measureStarts).toEqual([0, 4]);
    expect(tl.totalBeats).toBe(8);
    expect(measureIndexAt(tl, 3.99)).toBe(0);
    expect(measureIndexAt(tl, 4)).toBe(1);
  });

  it('raggruppa gli onset delle due mani', () => {
    expect(tl.onsets.map((o) => o.t)).toEqual([0, 1, 2, 4, 6]);
    expect(tl.onsets[0]!.midis.sort()).toEqual([48, 60]);
    expect(tl.onsets[2]!.midis).toEqual([64, 67]);
  });

  it('non richiede di ripremere una nota legata', () => {
    expect(tl.onsets.find((o) => o.t === 6)!.midis).toEqual([]);
  });

  it('assegna il rigo dalla mano', () => {
    expect(tl.events.find((e) => e.index === 1)!.staff).toBe('bass');
  });

  it('trova le note che suonano a un dato beat', () => {
    expect(soundingAt(tl, 2.5).map((e) => e.pitches.join())).toEqual(['C3', 'E4,G4']);
  });

  it('calcola il range di note', () => {
    expect(pitchRange(tl)).toEqual({ min: 48, max: 67 });
  });

  it('gestisce l’anacrusi', () => {
    const p: Piece = { ...base, pickupBeats: 1, events: [{ t: 0, d: 1, p: ['G4'], hand: 'R' }, { t: 1, d: 4, p: ['C5'], hand: 'R' }] };
    const t = buildTimeline(p);
    expect(t.measureStarts).toEqual([0, 1]);
    expect(t.totalBeats).toBe(5);
  });
});

describe('checkPiece', () => {
  it('accetta un brano corretto', () => {
    expect(checkPiece(piece)).toEqual([]);
  });

  it('segnala note che attraversano la stanghetta', () => {
    const p: Piece = { ...base, events: [{ t: 3, d: 2, p: ['C4'], hand: 'R' }] };
    expect(checkPiece(p)[0]).toMatch(/stanghetta/);
  });

  it('segnala sovrapposizioni sullo stesso rigo', () => {
    const p: Piece = { ...base, events: [{ t: 0, d: 2, p: ['C4'], hand: 'R' }, { t: 1, d: 1, p: ['E4'], hand: 'R' }] };
    expect(checkPiece(p)[0]).toMatch(/sovrappone/);
  });

  it('segnala righi mancanti in staves', () => {
    const p: Piece = { ...base, staves: ['treble'], events: [{ t: 0, d: 1, p: ['C3'], hand: 'L' }] };
    expect(checkPiece(p).some((e) => e.includes('bass'))).toBe(true);
  });
});

describe('Transport', () => {
  const clock = () => {
    let t = 0;
    return { now: () => t, advance: (s: number) => (t += s) };
  };

  it('converte tempo ↔ beat', () => {
    const c = clock();
    const tr = new Transport(c.now, 120);
    tr.play(0, 0);
    c.advance(1);
    expect(tr.beatAt()).toBeCloseTo(2);
    expect(tr.timeAt(4)).toBeCloseTo(2);
  });

  it('si ferma e riparte dalla stessa posizione', () => {
    const c = clock();
    const tr = new Transport(c.now, 60);
    tr.play(0, 0);
    c.advance(1.5);
    tr.pause();
    c.advance(10);
    expect(tr.beatAt()).toBeCloseTo(1.5);
    tr.play(undefined, 0);
    c.advance(0.5);
    expect(tr.beatAt()).toBeCloseTo(2);
  });

  it('rallenta mantenendo la posizione', () => {
    const c = clock();
    const tr = new Transport(c.now, 60);
    tr.play(0, 0);
    c.advance(2);
    tr.setTempoScale(0.5);
    expect(tr.beatAt()).toBeCloseTo(2);
    c.advance(2);
    expect(tr.beatAt()).toBeCloseTo(3);
  });

  it('supporta il conteggio iniziale (beat negativi)', () => {
    const c = clock();
    const tr = new Transport(c.now, 60);
    tr.play(-4, 0);
    c.advance(1);
    expect(tr.beatAt()).toBeCloseTo(-3);
  });
});

describe('sezioni', () => {
  const tl = buildTimeline(piece);
  it('calcola l’intervallo di battute', () => {
    expect(measureRange(tl, 2, 2)).toEqual({ from: 4, to: 8 });
    expect(measureRange(tl, 1, 9)).toEqual({ from: 0, to: 8 });
  });
  it('restringe eventi e onset alla sezione', () => {
    const s = sliceTimeline(tl, 4, 8);
    expect(s.onsets.map((o) => o.t)).toEqual([4, 6]);
    expect(s.events.every((e) => e.t >= 4)).toBe(true);
    expect(s.totalBeats).toBe(8);
  });
});

describe('una mano alla volta', () => {
  it('filtra la timeline per mano mantenendo le posizioni', async () => {
    const { filterTimelineHand } = await import('./timeline');
    const tl = buildTimeline(piece);
    const right = filterTimelineHand(tl, 'R');
    expect(right.events.every((e) => e.hand === 'R')).toBe(true);
    expect(right.onsets[0]!.midis).toEqual([60]); // senza il Do3 della sinistra
    expect(right.measureStarts).toEqual(tl.measureStarts);
    const left = filterTimelineHand(tl, 'L');
    expect(left.onsets.map((o) => o.t)).toEqual([0, 4]);
  });
});
