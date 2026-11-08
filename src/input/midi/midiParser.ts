/**
 * Decodifica dei messaggi MIDI (canale qualsiasi). TS puro.
 *  - 0x9n note on (velocity 0 = note off, come fanno molte tastiere)
 *  - 0x8n note off
 *  - 0xBn controller: 64 = pedale di risonanza, 120/123 = tutte le note spente
 */
export type MidiMessage =
  | { type: 'noteon'; note: number; velocity: number; channel: number }
  | { type: 'noteoff'; note: number; channel: number }
  | { type: 'sustain'; on: boolean; channel: number }
  | { type: 'allnotesoff'; channel: number }
  | { type: 'other' };

export function parseMidi(data: ArrayLike<number>): MidiMessage {
  if (!data || data.length < 1) return { type: 'other' };
  const status = data[0]! & 0xf0;
  const channel = data[0]! & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  switch (status) {
    case 0x90:
      return d2 > 0 ? { type: 'noteon', note: d1, velocity: d2 / 127, channel } : { type: 'noteoff', note: d1, channel };
    case 0x80:
      return { type: 'noteoff', note: d1, channel };
    case 0xb0:
      if (d1 === 64) return { type: 'sustain', on: d2 >= 64, channel };
      if (d1 === 120 || d1 === 123) return { type: 'allnotesoff', channel };
      return { type: 'other' };
    default:
      return { type: 'other' };
  }
}

/** Rappresentazione esadecimale per la diagnostica, es. "90 3C 64". */
export function midiHex(data: ArrayLike<number>): string {
  return Array.from(data)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}
