/**
 * Utility per le altezze. Convenzione: notazione scientifica ("C4" = Do centrale = MIDI 60).
 * Accetta diesis (#) e bemolle (b), es. "F#3", "Bb4".
 */

export type Pitch = string;
export type NoteNaming = 'italian' | 'english';

const LETTER_TO_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const ITALIAN: Record<string, string> = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

const PITCH_RE = /^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)$/;

export const MIDDLE_C = 60;

export function pitchToMidi(pitch: Pitch): number {
  const m = PITCH_RE.exec(pitch.trim());
  if (!m) throw new Error(`Altezza non valida: "${pitch}"`);
  const letter = m[1]!.toUpperCase();
  const acc = m[2] ?? '';
  const octave = Number(m[3]);
  const alter = acc.startsWith('#') ? acc.length : -acc.length;
  return (octave + 1) * 12 + LETTER_TO_SEMITONE[letter]! + alter;
}

export function isValidPitch(pitch: string): boolean {
  return PITCH_RE.test(pitch.trim());
}

export function midiToPitch(midi: number, preferFlats = false): Pitch {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Nome visualizzabile, es. midi 61 → "Do#" (italiano) o "C#" (inglese). */
export function noteLabel(midi: number, naming: NoteNaming, opts: { octave?: boolean; preferFlats?: boolean } = {}): string {
  const p = midiToPitch(midi, opts.preferFlats);
  const m = PITCH_RE.exec(p)!;
  const letter = m[1]!;
  const acc = (m[2] ?? '').replace('#', '♯').replace('b', '♭');
  const base = naming === 'italian' ? ITALIAN[letter]! : letter;
  return `${base}${acc}${opts.octave ? m[3] : ''}`;
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Colori per "note colorate" (supporto ai principianti): uno per nota naturale, stile boomwhackers. */
export const NOTE_COLORS: readonly string[] = [
  '#e53935', // Do
  '#e53935',
  '#fb8c00', // Re
  '#fb8c00',
  '#fdd835', // Mi
  '#43a047', // Fa
  '#43a047',
  '#00acc1', // Sol
  '#00acc1',
  '#3949ab', // La
  '#3949ab',
  '#8e24aa', // Si
];

export function noteColor(midi: number): string {
  return NOTE_COLORS[pitchClass(midi)]!;
}
