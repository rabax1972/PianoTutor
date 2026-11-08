import { audioEngine } from './AudioEngine';
import { sampler } from './Sampler';

/**
 * Sblocca l'audio e avvia il caricamento dei campioni.
 * Va chiamata dentro un gestore di gesto (pointerdown/click).
 */
export function ensureAudio(): Promise<void> {
  const unlocked = audioEngine.unlock();
  const loaded = sampler.load().catch(() => undefined);
  return Promise.all([unlocked, loaded]).then(() => undefined);
}

/** Al primo tocco ovunque nell'app sblocca l'audio (iOS/Android richiedono un gesto). */
export function installAudioUnlockOnFirstGesture(): void {
  const handler = () => {
    void ensureAudio();
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
  };
  window.addEventListener('pointerdown', handler, true);
  window.addEventListener('keydown', handler, true);
}
