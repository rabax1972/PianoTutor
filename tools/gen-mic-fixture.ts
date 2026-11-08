/**
 * Genera e2e/fixtures/do-re-mi.wav: la sequenza dell'esercizio guidato della lezione 1
 * (Do Do Re Re Mi Mi Re Re Do) con timbro "tipo pianoforte". Usato come microfono finto
 * di Chromium (--use-file-for-fake-audio-capture) nei test e2e del microfono.
 * Uso: npx tsx tools/gen-mic-fixture.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { synthesize } from '../src/input/mic/synth';

const SR = 24000;
const seq = [60, 60, 62, 62, 64, 64, 62, 62, 60];
const lead = 1.0;
const step = 0.75;
const signal = synthesize(
  seq.map((m, i) => ({ midis: [m], start: lead + i * step, dur: 0.6, amp: 0.5 })),
  lead + seq.length * step + 1.5,
  SR,
  0.0015,
);

const data = Buffer.alloc(44 + signal.length * 2);
data.write('RIFF', 0);
data.writeUInt32LE(36 + signal.length * 2, 4);
data.write('WAVE', 8);
data.write('fmt ', 12);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20); // PCM
data.writeUInt16LE(1, 22); // mono
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(signal.length * 2, 40);
signal.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
mkdirSync('e2e/fixtures', { recursive: true });
writeFileSync('e2e/fixtures/do-re-mi.wav', data);
console.log(`✔ e2e/fixtures/do-re-mi.wav (${(data.length / 1024).toFixed(0)} KB, ${(signal.length / SR).toFixed(1)} s)`);
