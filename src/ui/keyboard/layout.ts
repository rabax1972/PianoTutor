import { isBlackKey } from '../../core/music/pitch';

export interface KeyLayout {
  midi: number;
  black: boolean;
  /** posizione sinistra in % della larghezza totale */
  left: number;
  /** larghezza in % */
  width: number;
}

/** Spostamento laterale dei tasti neri (in frazioni di tasto bianco), come su un pianoforte reale. */
const BLACK_OFFSET: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };
const BLACK_WIDTH_RATIO = 0.6;

/**
 * Calcola posizione e dimensione dei tasti fra `from` e `to` inclusi.
 * Gli estremi vengono allargati al tasto bianco più vicino.
 */
export function layoutKeys(from: number, to: number): KeyLayout[] {
  let lo = from;
  let hi = to;
  if (isBlackKey(lo)) lo--;
  if (isBlackKey(hi)) hi++;
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m);
  const ww = 100 / whites.length;
  const keys: KeyLayout[] = whites.map((midi, i) => ({ midi, black: false, left: i * ww, width: ww }));
  for (let m = lo; m <= hi; m++) {
    if (!isBlackKey(m)) continue;
    const prevWhiteIdx = whites.indexOf(m - 1);
    const bw = ww * BLACK_WIDTH_RATIO;
    const center = (prevWhiteIdx + 1) * ww + (BLACK_OFFSET[m % 12] ?? 0) * ww;
    keys.push({ midi: m, black: true, left: center - bw / 2, width: bw });
  }
  return keys;
}

/**
 * Sceglie quante ottave mostrare in base alla larghezza disponibile (px),
 * mantenendo i tasti bianchi comodi da toccare (≥ minWhitePx).
 */
export function octavesForWidth(widthPx: number, minWhitePx = 44, maxOctaves = 3): number {
  const fit = Math.floor((widthPx - minWhitePx) / (7 * minWhitePx)); // -1 tasto per il Do finale
  return Math.max(1, Math.min(maxOctaves, fit));
}

/** Range visibile centrato sul Do centrale, spostabile di ottave con `shift`. */
export function visibleRange(octaves: number, shift = 0): { from: number; to: number } {
  const startOctave = 4 - Math.floor(octaves / 2) + shift; // 3 ottave → C3..C6
  const from = (startOctave + 1) * 12;
  return { from, to: from + octaves * 12 };
}

/**
 * Range della tastiera per un brano: copre tutte le note (da Do a Do) e, se lo spazio
 * lo consente, si allarga fino a `targetOctaves` alternando sotto/sopra.
 */
export function rangeForNotes(min: number, max: number, targetOctaves: number): { from: number; to: number } {
  let from = Math.floor(min / 12) * 12;
  let to = Math.max(from + 12, Math.ceil((max + 1) / 12) * 12);
  let below = false;
  while ((to - from) / 12 < targetOctaves) {
    if (below) from -= 12;
    else to += 12;
    below = !below;
  }
  return { from, to };
}
