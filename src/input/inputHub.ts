/**
 * InputHub: raccoglie gli eventi dalla sorgente attiva, li rende disponibili all'app
 * e fa suonare il sampler (tranne per il microfono, dove suona già il pianoforte reale).
 */
import { sampler } from '../audio/Sampler';
import type { InputSource, NoteInputEvent, NoteListener } from './types';
import { VirtualKeyboardInput } from './virtual/VirtualKeyboardInput';

class InputHubImpl {
  readonly virtual = new VirtualKeyboardInput();
  private sources = new Map<InputSource, () => void>();
  private listeners = new Set<NoteListener>();
  /** note attualmente premute (da qualsiasi sorgente) */
  readonly held = new Set<number>();
  monitorSound = true;
  /** le tastiere MIDI con altoparlanti suonano da sole: il tablet suona solo se richiesto */
  midiSound = false;
  private heldListeners = new Set<() => void>();

  constructor() {
    this.attach(this.virtual);
  }

  attach(source: InputSource): void {
    if (this.sources.has(source)) return;
    this.sources.set(source, source.subscribe((e) => this.handle(e)));
  }

  detach(source: InputSource): void {
    this.sources.get(source)?.();
    this.sources.delete(source);
  }

  /** comunica a tutte le sorgenti le note attese (verifica accordi del microfono) */
  setExpectedNotes(midis: number[]): void {
    this.sources.forEach((_, src) => src.setExpectedNotes?.(midis));
  }

  subscribe(l: NoteListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private handle(e: NoteInputEvent) {
    if (e.type === 'on') this.held.add(e.midi);
    else this.held.delete(e.midi);

    if (this.monitorSound && e.source !== 'mic' && (e.source !== 'midi' || this.midiSound)) {
      if (e.type === 'on') sampler.noteOn(e.midi, e.velocity);
      else sampler.noteOff(e.midi);
    }
    this.listeners.forEach((l) => l(e));
    if (e.source !== 'virtual') this.heldListeners.forEach((l) => l());
  }

  /** notifica quando cambiano le note tenute da sorgenti esterne (MIDI/microfono) */
  subscribeHeld(l: () => void): () => void {
    this.heldListeners.add(l);
    return () => this.heldListeners.delete(l);
  }
}

export const inputHub = new InputHubImpl();
