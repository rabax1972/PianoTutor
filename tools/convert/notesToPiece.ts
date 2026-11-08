/**
 * Da note "grezze" (lette da MIDI o MusicXML) a un brano Piano Tutor valido.
 *  - quantizzazione (default: semicroma = 0.25 beat)
 *  - mano: dal rigo/traccia se noti, altrimenti dal punto di divisione (default Do centrale)
 *  - note simultanee sullo stesso rigo → accordo; sovrapposizioni → la nota precedente si accorcia
 *  - note che attraversano la stanghetta → spezzate in note legate ("tie")
 *  - grafia di diesis/bemolle secondo l'armatura
 */
import type { NoteEvent, Piece } from '../../src/core/content/schema';
import { midiToPitch } from '../../src/core/music/pitch';
import { checkPiece } from '../../src/core/timing/timeline';

export interface RawNote {
  midi: number;
  /** inizio in beat (semiminime) */
  start: number;
  /** durata in beat */
  duration: number;
  /** mano esplicita (es. dal rigo del MusicXML) */
  hand?: 'R' | 'L';
  track?: number;
}

export interface ConvertOptions {
  id: string;
  title: string;
  bpm: number;
  timeSignature: [number, number];
  fifths: number;
  mode: 'major' | 'minor';
  license: 'public-domain' | 'original';
  composer?: string;
  arranger?: string;
  /** 'track': traccia 0 = destra, 1 = sinistra; numero: nota MIDI di divisione (≥ destra) */
  split?: 'track' | number;
  quantize?: number;
  pickupBeats?: number;
}

const EPS = 1e-6;
const q = (x: number, step: number) => Math.round(x / step) * step;

export function notesToPiece(notes: RawNote[], opts: ConvertOptions): { piece: Piece; warnings: string[] } {
  const warnings: string[] = [];
  const step = opts.quantize ?? 0.25;
  const split = opts.split ?? 60;
  const measure = (opts.timeSignature[0] * 4) / opts.timeSignature[1];
  const pickup = opts.pickupBeats ?? 0;
  const flats = opts.fifths < 0;

  // 1. quantizzazione e mano
  const qn = notes
    .map((n) => {
      const start = Math.max(0, q(n.start, step));
      const duration = Math.max(step, q(n.duration, step));
      const hand: 'R' | 'L' = n.hand ?? (split === 'track' ? ((n.track ?? 0) === 0 ? 'R' : 'L') : n.midi >= split ? 'R' : 'L');
      return { midi: n.midi, start, duration, hand };
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  // 2. per mano: accordi e sovrapposizioni
  const events: NoteEvent[] = [];
  let truncated = 0;
  let chordDurations = 0;
  for (const hand of ['R', 'L'] as const) {
    const hn = qn.filter((n) => n.hand === hand);
    const groups: { start: number; midis: number[]; duration: number }[] = [];
    for (const n of hn) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last.start - n.start) < EPS) {
        if (!last.midis.includes(n.midi)) last.midis.push(n.midi);
        if (Math.abs(last.duration - n.duration) > EPS) chordDurations++;
        last.duration = Math.min(last.duration, n.duration);
      } else groups.push({ start: n.start, midis: [n.midi], duration: n.duration });
    }
    groups.forEach((g, i) => {
      const next = groups[i + 1];
      if (next && g.start + g.duration > next.start + EPS) {
        g.duration = next.start - g.start;
        truncated++;
      }
    });
    // 3. stanghette: spezza con legatura
    for (const g of groups) {
      let t = g.start;
      let remaining = g.duration;
      const pitches = g.midis.sort((a, b) => a - b).map((m) => midiToPitch(m, flats));
      while (remaining > EPS) {
        const barEnd = t < pickup - EPS ? pickup : pickup + (Math.floor((t - pickup) / measure + EPS) + 1) * measure;
        const d = Math.min(remaining, barEnd - t);
        remaining -= d;
        events.push({ t: round(t), d: round(d), p: pitches, hand, ...(remaining > EPS ? { tie: true } : {}) });
        t += d;
      }
    }
  }
  if (truncated) warnings.push(`${truncated} note sovrapposte sullo stesso rigo sono state accorciate`);
  if (chordDurations) warnings.push(`${chordDurations} accordi avevano note di durata diversa: usata la più breve`);

  events.sort((a, b) => a.t - b.t || (a.hand === 'R' ? -1 : 1));
  const staves = (['treble', 'bass'] as const).filter((s) => events.some((e) => (s === 'treble' ? e.hand === 'R' : e.hand === 'L')));
  const piece: Piece = {
    schemaVersion: 1,
    id: opts.id,
    title: opts.title,
    ...(opts.composer ? { composer: opts.composer } : {}),
    ...(opts.arranger ? { arranger: opts.arranger } : {}),
    license: opts.license,
    tempo: { bpm: Math.round(opts.bpm) },
    timeSignature: opts.timeSignature,
    key: { fifths: opts.fifths, mode: opts.mode },
    ...(pickup ? { pickupBeats: pickup } : {}),
    staves: staves.length ? [...staves] : ['treble'],
    events,
  };
  warnings.push(...checkPiece(piece));
  return { piece, warnings };
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;

/** Tonalità da nome (es. "G", "Bb", "F#m") a quinte. */
export function fifthsFromKey(key: string): { fifths: number; mode: 'major' | 'minor' } {
  const minor = /m$/.test(key) && !/^[A-G][b#]?$/.test(key) ? true : key.endsWith('m');
  const name = minor ? key.slice(0, -1) : key;
  const MAJ = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const MIN = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
  const i = (minor ? MIN : MAJ).indexOf(name);
  return { fifths: i >= 0 ? i - 7 : 0, mode: minor ? 'minor' : 'major' };
}
