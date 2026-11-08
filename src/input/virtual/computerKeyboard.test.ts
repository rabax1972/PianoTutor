import { describe, expect, it } from 'vitest';
import { noteForKey } from './computerKeyboard';

describe('tastiera del computer', () => {
  it('mappa la fila centrale sui tasti bianchi e quella superiore sui neri', () => {
    expect(noteForKey('KeyA', 60)).toBe(60); // Do
    expect(noteForKey('KeyS', 60)).toBe(62); // Re
    expect(noteForKey('KeyW', 60)).toBe(61); // Do♯
    expect(noteForKey('KeyK', 60)).toBe(72); // Do acuto
    expect(noteForKey('KeyQ', 60)).toBeNull();
  });
});
