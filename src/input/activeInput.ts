/**
 * Attiva la sorgente di input scelta nelle impostazioni mentre una schermata la usa.
 * La tastiera a schermo è sempre disponibile; il microfono si accende solo dove serve.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSettings } from '../app/settingsStore';
import type { Settings } from '../storage';
import { inputHub } from './inputHub';
import { micInput, type MicState } from './mic/MicInput';
import { midiInput } from './midi/midiInstance';
import type { MidiState } from './midi/MidiInput';

inputHub.attach(micInput);
inputHub.attach(midiInput);

export function applyInputSettings(s: Settings): void {
  micInput.configure({ a4: s.a4Hz, noiseFloorDb: s.mic.noiseFloorDb, gateMarginDb: s.mic.gateMarginDb });
  micInput.latencyOffsetMs = s.latency.mic;
  inputHub.virtual.latencyOffsetMs = s.latency.virtual;
  midiInput.latencyOffsetMs = s.latency.midi;
  inputHub.midiSound = s.midi.playSound;
  if (midiInput.deviceId !== s.midi.deviceId) midiInput.selectDevice(s.midi.deviceId);
}

/** Stato reattivo della Web MIDI (si aggiorna anche a ogni collegamento/nota). */
export function useMidiState(): { state: MidiState; message: string; version: number } {
  const version = useSyncExternalStore(
    (cb) => midiInput.subscribeState(cb),
    () => midiVersion(),
  );
  return { state: midiInput.state, message: midiInput.errorMessage, version };
}

let ver = 0;
let lastKey = '';
function midiVersion(): number {
  const key = `${midiInput.state}|${midiInput.connectedDevices.map((d) => d.id).join(',')}|${midiInput.deviceId}|${midiInput.lastActivity?.hex ?? ''}`;
  if (key !== lastKey) {
    lastKey = key;
    ver++;
  }
  return ver;
}

/** Note tenute su tastiere esterne (MIDI) o sentite dal microfono, da mostrare sulla tastiera a schermo. */
export function useExternalHeld(): ReadonlySet<number> {
  const key = useSyncExternalStore(
    (cb) => inputHub.subscribeHeld(cb),
    () => [...inputHub.held].sort().join(','),
  );
  return useMemo(() => new Set(key ? key.split(',').map(Number) : []), [key]);
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
 * Da usare nelle schermate in cui si suona: attiva la sorgente scelta (microfono: acceso solo
 * qui e spento all'uscita; MIDI: accesso ai dispositivi) e applica le impostazioni.
 */
export function useActiveInput(force?: 'mic' | 'midi'): { mode: Settings['inputMode']; mic: ReturnType<typeof useMicState> } {
  const settings = useSettings((s) => s.settings);
  const mode = force ?? settings.inputMode;
  const mic = useMicState();

  useEffect(() => {
    applyInputSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (mode === 'mic') {
      void micInput.acquire();
      return () => micInput.release();
    }
    if (mode === 'midi') {
      void midiInput.acquire();
      return () => midiInput.release();
    }
  }, [mode]);

  return { mode, mic };
}
