/**
 * Interfaccia comune a tutte le sorgenti di input (tastiera a schermo, MIDI, microfono).
 * Il motore di valutazione riceve solo NoteInputEvent e non sa da dove arrivano.
 */

export type InputKind = 'virtual' | 'midi' | 'mic';

export interface NoteInputEvent {
  type: 'on' | 'off';
  midi: number;
  /** 0–1 */
  velocity: number;
  /** tempo AudioContext (s), GIÀ corretto con l'offset di latenza della sorgente */
  time: number;
  source: InputKind;
}

export type NoteListener = (e: NoteInputEvent) => void;

export interface InputSource {
  readonly kind: InputKind;
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: NoteListener): () => void;
  /** note che l'app si aspetta ora (usate dal microfono per verificare gli accordi) */
  setExpectedNotes?(midis: number[]): void;
}

/** Disponibilità di una modalità di input nel browser corrente. */
export interface InputAvailability {
  kind: InputKind;
  available: boolean;
  /** messaggio da mostrare se non disponibile */
  reason?: string;
}
