import { describe, expect, it } from 'vitest';
import { PieceSchema } from '../../src/core/content/schema';
import { fifthsFromKey, notesToPiece, type ConvertOptions } from './notesToPiece';
import { Midi, readMidi, readMusicXml } from './readers';

const opts: ConvertOptions = {
  id: 'prova',
  title: 'Prova',
  bpm: 90,
  timeSignature: [4, 4],
  fifths: 0,
  mode: 'major',
  license: 'original',
};

describe('notesToPiece', () => {
  it('quantizza e assegna le mani dal Do centrale', () => {
    const { piece, warnings } = notesToPiece(
      [
        { midi: 60, start: 0.02, duration: 0.97 },
        { midi: 48, start: 0, duration: 4 },
        { midi: 64, start: 1.01, duration: 1.03 },
      ],
      opts,
    );
    expect(warnings).toEqual([]);
    expect(piece.staves).toEqual(['treble', 'bass']);
    expect(piece.events).toEqual([
      { t: 0, d: 1, p: ['C4'], hand: 'R' },
      { t: 0, d: 4, p: ['C3'], hand: 'L' },
      { t: 1, d: 1, p: ['E4'], hand: 'R' },
    ]);
    expect(PieceSchema.safeParse(piece).success).toBe(true);
  });

  it('unisce le note simultanee in un accordo', () => {
    const { piece } = notesToPiece(
      [
        { midi: 64, start: 0, duration: 2 },
        { midi: 60, start: 0, duration: 2 },
        { midi: 67, start: 0, duration: 2 },
      ],
      opts,
    );
    expect(piece.events).toEqual([{ t: 0, d: 2, p: ['C4', 'E4', 'G4'], hand: 'R' }]);
  });

  it('spezza alla stanghetta con una legatura', () => {
    const { piece, warnings } = notesToPiece([{ midi: 62, start: 3, duration: 2 }], opts);
    expect(piece.events).toEqual([
      { t: 3, d: 1, p: ['D4'], hand: 'R', tie: true },
      { t: 4, d: 1, p: ['D4'], hand: 'R' },
    ]);
    expect(warnings).toEqual([]);
  });

  it('accorcia le sovrapposizioni sullo stesso rigo e lo segnala', () => {
    const { piece, warnings } = notesToPiece(
      [
        { midi: 60, start: 0, duration: 2 },
        { midi: 62, start: 1, duration: 1 },
      ],
      opts,
    );
    expect(piece.events.map((e) => [e.t, e.d])).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(warnings[0]).toMatch(/accorciate/);
  });

  it('usa i bemolle nelle tonalità con bemolle', () => {
    const { piece } = notesToPiece([{ midi: 70, start: 0, duration: 1 }], { ...opts, fifths: -1 });
    expect(piece.events[0]!.p).toEqual(['Bb4']);
  });

  it('assegna le mani per traccia', () => {
    const { piece } = notesToPiece(
      [
        { midi: 72, start: 0, duration: 1, track: 1 },
        { midi: 50, start: 0, duration: 1, track: 0 },
      ],
      { ...opts, split: 'track' },
    );
    expect(piece.events.find((e) => e.p[0] === 'C5')!.hand).toBe('L');
  });

  it('tonalità dai nomi', () => {
    expect(fifthsFromKey('G')).toEqual({ fifths: 1, mode: 'major' });
    expect(fifthsFromKey('Bb')).toEqual({ fifths: -2, mode: 'major' });
    expect(fifthsFromKey('Am')).toEqual({ fifths: 0, mode: 'minor' });
    expect(fifthsFromKey('F#m')).toEqual({ fifths: 3, mode: 'minor' });
  });
});

describe('lettore MIDI', () => {
  it('legge note, tempo e metro da un file MIDI', () => {
    const midi = new Midi();
    midi.header.setTempo(80);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4] });
    const t = midi.addTrack();
    const ppq = midi.header.ppq;
    [60, 62, 64].forEach((m, i) => t.addNote({ midi: m, ticks: i * ppq, durationTicks: ppq }));
    const r = readMidi(midi.toArray());
    expect(r.bpm).toBeCloseTo(80, 0);
    expect(r.timeSignature).toEqual([3, 4]);
    expect(r.notes.map((n) => [n.midi, n.start, n.duration])).toEqual([
      [60, 0, 1],
      [62, 1, 1],
      [64, 2, 1],
    ]);
    const { piece } = notesToPiece(r.notes, { ...opts, timeSignature: r.timeSignature, bpm: r.bpm });
    expect(PieceSchema.safeParse(piece).success).toBe(true);
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Piccolo valzer</work-title></work>
  <identification><creator type="composer">Anonimo</creator></identification>
  <part-list><score-part id="P1"><part-name>Pianoforte</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>
      <direction><sound tempo="96"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><staff>1</staff></note>
      <backup><duration>6</duration></backup>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>6</duration><staff>2</staff></note>
      <note><chord/><pitch><step>D</step><octave>3</octave></pitch><duration>6</duration><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><staff>1</staff></note>
      <note><rest/><duration>4</duration><staff>1</staff></note>
      <backup><duration>6</duration></backup>
      <forward><duration>6</duration></forward>
    </measure>
  </part>
</score-partwise>`;

describe('lettore MusicXML', () => {
  it('legge metadati, alterazioni, accordi, due righi, backup e legature', () => {
    const r = readMusicXml(XML);
    expect(r).toMatchObject({ title: 'Piccolo valzer', composer: 'Anonimo', bpm: 96, timeSignature: [3, 4], fifths: 1 });
    const { piece, warnings } = notesToPiece(r.notes, { ...opts, timeSignature: r.timeSignature, fifths: r.fifths, bpm: r.bpm });
    expect(warnings).toEqual([]);
    expect(piece.events).toEqual([
      { t: 0, d: 1, p: ['G4'], hand: 'R' },
      { t: 0, d: 3, p: ['G2', 'D3'], hand: 'L' },
      { t: 1, d: 1, p: ['F#4'], hand: 'R' },
      // Mi legato a cavallo della stanghetta: unito e poi rispezzato con "tie"
      { t: 2, d: 1, p: ['E4'], hand: 'R', tie: true },
      { t: 3, d: 1, p: ['E4'], hand: 'R' },
    ]);
  });

  it('rifiuta formati non supportati', () => {
    expect(() => readMusicXml('<score-timewise/>')).toThrow(/score-partwise/);
  });
});
