/**
 * Mappa dei campioni di pianoforte (Salamander Grand Piano, CC-BY 3.0, Alexander Holm).
 * Un campione ogni terza minore; le note intermedie si ottengono variando il playbackRate
 * (al massimo ±1 semitono e mezzo, impercettibile).
 */
import { pitchToMidi } from '../core/music/pitch';

export const SAMPLE_NAMES = [
  'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4',
  'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7',
] as const;

export interface SampleInfo {
  name: string;
  midi: number;
}

export const SAMPLES: SampleInfo[] = SAMPLE_NAMES.map((name) => ({
  name,
  midi: pitchToMidi(name.replace('s', '#')),
}));

export const SAMPLE_RANGE = { min: SAMPLES[0]!.midi - 2, max: SAMPLES[SAMPLES.length - 1]!.midi + 5 };

/** Campione più vicino per una nota MIDI. */
export function nearestSample(midi: number): SampleInfo {
  let best = SAMPLES[0]!;
  for (const s of SAMPLES) {
    if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  }
  return best;
}

/** Ordine di caricamento: prima i campioni del registro centrale, usati nelle prime lezioni. */
export function loadOrder(centerMidi = 60): SampleInfo[] {
  return [...SAMPLES].sort((a, b) => Math.abs(a.midi - centerMidi) - Math.abs(b.midi - centerMidi));
}
