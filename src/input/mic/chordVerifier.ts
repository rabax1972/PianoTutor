/**
 * Verifica degli accordi dal microfono.
 * Riconoscere più note simultanee "alla cieca" è difficile; ma l'app sa quali note aspettarsi.
 * Si controlla quindi se nello spettro c'è energia sulle fondamentali (e armoniche) delle note
 * ATTESE, chiaramente sopra il fondo locale e più forte dei semitoni vicini.
 */
import { midiToFrequency } from '../../core/music/pitch';

export interface NoteEvidence {
  midi: number;
  /** rapporto segnale/fondo sulla fondamentale (dB) */
  snrDb: number;
  /** rapporto sulla seconda armonica (dB) */
  snr2Db: number;
  present: boolean;
}

function peakAround(spec: Float32Array, bin: number, radius = 1): number {
  let m = 0;
  const lo = Math.max(0, Math.floor(bin - radius));
  const hi = Math.min(spec.length - 1, Math.ceil(bin + radius));
  for (let i = lo; i <= hi; i++) m = Math.max(m, spec[i]!);
  return m;
}

function localFloor(spec: Float32Array, bin: number): number {
  // mediana in una banda di ±1/3 di ottava, escluso il picco
  const lo = Math.max(0, Math.floor(bin * 0.8));
  const hi = Math.min(spec.length - 1, Math.ceil(bin * 1.25));
  const vals: number[] = [];
  for (let i = lo; i <= hi; i++) if (Math.abs(i - bin) > 2) vals.push(spec[i]!);
  if (!vals.length) return 1e-9;
  vals.sort((a, b) => a - b);
  return Math.max(vals[Math.floor(vals.length / 2)]!, 1e-9);
}

export function verifyNotes(
  spec: Float32Array,
  sampleRate: number,
  midis: number[],
  opts: { a4?: number; thresholdDb?: number } = {},
): NoteEvidence[] {
  const a4 = opts.a4 ?? 440;
  const thr = opts.thresholdDb ?? 14;
  const binHz = sampleRate / (spec.length * 2);
  const db = (x: number) => 20 * Math.log10(x);
  return midis.map((midi) => {
    const f0 = midiToFrequency(midi, a4);
    const b1 = f0 / binHz;
    const b2 = (2 * f0) / binHz;
    const p1 = peakAround(spec, b1);
    const p2 = b2 < spec.length - 2 ? peakAround(spec, b2) : 0;
    const snr = db(p1 / localFloor(spec, b1));
    const snr2 = p2 ? db(p2 / localFloor(spec, b2)) : -Infinity;
    // i semitoni vicini non devono essere più forti (evita di confondere Mi con Fa)
    const lower = peakAround(spec, f0 / Math.pow(2, 1 / 12) / binHz, 0.5);
    const upper = peakAround(spec, (f0 * Math.pow(2, 1 / 12)) / binHz, 0.5);
    const dominant = p1 >= Math.max(lower, upper) * 0.9;
    // le note gravi del pianoforte hanno fondamentale debole: basta una buona seconda armonica
    const present = dominant && (snr >= thr || (snr >= thr / 2 && snr2 >= thr));
    return { midi, snrDb: snr, snr2Db: snr2, present };
  });
}
