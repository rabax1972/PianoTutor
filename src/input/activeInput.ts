/**
 * Attiva la sorgente di input scelta nelle impostazioni mentre una schermata la usa.
 * La tastiera a schermo è sempre disponibile; il microfono si accende solo dove serve.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '../app/settingsStore';
import type { Settings } from '../storage';
import { inputHub } from './inputHub';
import { micInput, type MicState } from './mic/MicInput';

inputHub.attach(micInput);

export function applyMicSettings(s: Settings): void {
  micInput.configure({ a4: s.a4Hz, noiseFloorDb: s.mic.noiseFloorDb, gateMarginDb: s.mic.gateMarginDb });
  micInput.latencyOffsetMs = s.latency.mic;
  inputHub.virtual.latencyOffsetMs = s.latency.virtual;
}

/** Stato reattivo del microfono. */
export function useMicState(): { state: MicState; message: string } {
  const state = useSyncExternalStore(
    (cb) => micInput.onState(cb),
    () => micInput.state,
  );
  return { state, message: micInput.errorMessage };
}

/**
 * Da usare nelle schermate in cui si suona: se la modalità è "microfono" lo accende
 * (e lo spegne all'uscita).
 */
export function useActiveInput(force?: 'mic'): { mode: Settings['inputMode']; mic: ReturnType<typeof useMicState> } {
  const settings = useSettings((s) => s.settings);
  const mode = force ?? settings.inputMode;
  const mic = useMicState();

  useEffect(() => {
    applyMicSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (mode !== 'mic') return;
    void micInput.acquire();
    return () => micInput.release();
  }, [mode]);

  return { mode, mic };
}
