/**
 * Suonare con la tastiera del computer (desktop e accessibilità: niente tocco necessario).
 * Mappa per posizione fisica dei tasti (KeyboardEvent.code), quindi funziona con layout
 * italiano, QWERTY e QWERTZ:
 *
 *    W E   T Y U   O P          ← tasti neri (Do♯ Re♯  Fa♯ Sol♯ La♯  Do♯ Re♯)
 *   A S D F G H J K L ;         ← tasti bianchi (Do Re Mi Fa Sol La Si Do Re Mi)
 *   Z / X: ottava giù / su
 */
import { useEffect } from 'react';
import { inputHub } from '../inputHub';

const OFFSETS: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
  KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};

export function noteForKey(code: string, baseMidi: number): number | null {
  const o = OFFSETS[code];
  return o === undefined ? null : baseMidi + o;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Attiva la tastiera del computer finché il componente è montato. */
export function useComputerKeyboard(enabled = true, initialBase = 60): void {
  useEffect(() => {
    if (!enabled) return;
    let base = initialBase;
    const down = new Map<string, number>();
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        base = Math.max(36, Math.min(84, base + (e.code === 'KeyZ' ? -12 : 12)));
        return;
      }
      const midi = noteForKey(e.code, base);
      if (midi === null || down.has(e.code)) return;
      e.preventDefault();
      down.set(e.code, midi);
      inputHub.virtual.press(midi, e.timeStamp, 0.8);
    };
    const onUp = (e: KeyboardEvent) => {
      const midi = down.get(e.code);
      if (midi === undefined) return;
      down.delete(e.code);
      inputHub.virtual.release(midi, e.timeStamp);
    };
    const releaseAll = () => {
      down.forEach((midi) => inputHub.virtual.release(midi, performance.now()));
      down.clear();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      releaseAll();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, [enabled, initialBase]);
}
