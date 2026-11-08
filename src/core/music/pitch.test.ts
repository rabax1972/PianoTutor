import { describe, expect, it } from 'vitest';
import {
  frequencyToMidi,
  isBlackKey,
  midiToFrequency,
  midiToPitch,
  noteLabel,
  pitchToMidi,
} from './pitch';

describe('pitch', () => {
  it('converte nomi in MIDI', () => {
    expect(pitchToMidi('C4')).toBe(60);
    expect(pitchToMidi('A4')).toBe(69);
    expect(pitchToMidi('F#3')).toBe(54);
    expect(pitchToMidi('Bb4')).toBe(70);
    expect(pitchToMidi('A0')).toBe(21);
    expect(pitchToMidi('C8')).toBe(108);
    expect(pitchToMidi('Cb4')).toBe(59);
  });

  it('rifiuta altezze non valide', () => {
    expect(() => pitchToMidi('H4')).toThrow();
    expect(() => pitchToMidi('C')).toThrow();
  });

  it('converte MIDI in nomi', () => {
    expect(midiToPitch(60)).toBe('C4');
    expect(midiToPitch(61)).toBe('C#4');
    expect(midiToPitch(61, true)).toBe('Db4');
    expect(midiToPitch(pitchToMidi('G2'))).toBe('G2');
  });

  it('riconosce i tasti neri', () => {
    expect(isBlackKey(60)).toBe(false);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(66)).toBe(true);
    expect(isBlackKey(64)).toBe(false);
  });

  it('genera etichette in italiano e inglese', () => {
    expect(noteLabel(60, 'italian')).toBe('Do');
    expect(noteLabel(67, 'italian', { octave: true })).toBe('Sol4');
    expect(noteLabel(61, 'italian')).toBe('Do♯');
    expect(noteLabel(70, 'italian', { preferFlats: true })).toBe('Si♭');
    expect(noteLabel(69, 'english')).toBe('A');
  });

  it('converte frequenze', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
    expect(frequencyToMidi(261.63)).toBeCloseTo(60, 2);
  });
});

describe('pitchLabel', () => {
  it('rispetta la grafia scritta di diesis e bemolle', async () => {
    const { pitchLabel } = await import('./pitch');
    expect(pitchLabel('Bb4', 'italian')).toBe('Si♭');
    expect(pitchLabel('F#4', 'italian', { octave: true })).toBe('Fa♯4');
    expect(pitchLabel('Eb3', 'english')).toBe('E♭');
    expect(pitchLabel('C##4', 'italian')).toBe('Do♯♯');
  });
});
