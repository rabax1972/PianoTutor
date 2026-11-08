import type { InputAvailability } from './types';

export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export function isMicSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  );
}

export function getInputAvailability(): InputAvailability[] {
  return [
    {
      kind: 'mic',
      available: isMicSupported(),
      reason: isMicSupported()
        ? undefined
        : 'Il microfono richiede una connessione sicura (HTTPS) e un browser recente.',
    },
    {
      kind: 'midi',
      available: isWebMidiSupported(),
      reason: isWebMidiSupported()
        ? undefined
        : 'Questo browser non supporta le tastiere MIDI (ad esempio Safari su iPad e iPhone). Usa il microfono o la tastiera a schermo, oppure Chrome o Edge su Android e computer.',
    },
    { kind: 'virtual', available: true },
  ];
}
