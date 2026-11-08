import type { InputKind, InputSource, NoteInputEvent, NoteListener } from './types';

export abstract class BaseInputSource implements InputSource {
  abstract readonly kind: InputKind;
  private listeners = new Set<NoteListener>();
  /** offset di latenza (ms) da sottrarre al tempo dell'evento, impostato dalla calibrazione */
  latencyOffsetMs = 0;

  abstract start(): Promise<void>;
  abstract stop(): void;

  subscribe(listener: NoteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(e: Omit<NoteInputEvent, 'source'>): void {
    const ev: NoteInputEvent = { ...e, time: e.time - this.latencyOffsetMs / 1000, source: this.kind };
    this.listeners.forEach((l) => l(ev));
  }
}
