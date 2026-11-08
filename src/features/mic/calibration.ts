/**
 * Calcoli della calibrazione del microfono (puri, testati).
 */

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i]!;
}

/**
 * Rumore di fondo dai livelli (dBFS) misurati in silenzio: 90° percentile, per non farsi
 * ingannare da un rumore isolato ma includere il fondo "normale" della stanza.
 */
export function noiseFloorFrom(levelsDb: number[]): number | null {
  const valid = levelsDb.filter((x) => Number.isFinite(x) && x > -120);
  if (valid.length < 10) return null;
  return Math.round(percentile(valid, 90) * 10) / 10;
}

/** Valutazione dell'ambiente per un messaggio all'utente. */
export function noiseVerdict(floorDb: number): 'quiet' | 'ok' | 'noisy' {
  if (floorDb < -55) return 'quiet';
  if (floorDb < -40) return 'ok';
  return 'noisy';
}

/**
 * Diapason dal pianoforte dell'utente: se il Do suonato risulta mediamente +c cents,
 * il La di riferimento diventa a4·2^(c/1200). Limitato a ±50 cents (oltre è un'altra nota).
 */
export function a4FromCents(centsSamples: number[], currentA4 = 440): number | null {
  const valid = centsSamples.filter((c) => Number.isFinite(c) && Math.abs(c) <= 50);
  if (valid.length < 5) return null;
  const c = median(valid);
  return Math.round(currentA4 * Math.pow(2, c / 1200) * 10) / 10;
}

/**
 * Latenza del microfono da misure di "anello" (l'app suona una nota e la ascolta):
 * misurato = uscita + ingresso + rilevamento. Per il pianoforte acustico conta solo
 * ingresso + rilevamento, quindi si sottrae la latenza di uscita nota.
 */
export function micLatencyFrom(loopbackMs: number[], outputLatencyMs: number): number | null {
  const valid = loopbackMs.filter((x) => Number.isFinite(x) && x > 0 && x < 1000);
  if (valid.length < 2) return null;
  return Math.max(0, Math.min(400, Math.round(median(valid) - outputLatencyMs)));
}
