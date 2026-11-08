/**
 * Sampler di pianoforte su Web Audio API.
 * - campioni decodificati in memoria (nessuna latenza di decodifica al tocco)
 * - polifonia limitata, rilascio morbido, velocity → volume
 */
import { audioEngine } from './AudioEngine';
import { loadOrder, nearestSample, SAMPLES } from './sampleMap';

interface Voice {
  midi: number;
  src: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const MAX_VOICES = 32;
const RELEASE_S = 0.35;

class SamplerImpl {
  private buffers = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  state: LoadState = 'idle';
  loaded = 0;
  readonly total = SAMPLES.length;
  sustain = false;
  private sustained = new Set<Voice>();

  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.state = 'loading';
    this.emit();
    const ctx = audioEngine.context;
    const base = `${import.meta.env.BASE_URL}samples/piano/`;
    this.loadPromise = Promise.all(
      loadOrder().map(async (s) => {
        const res = await fetch(`${base}${s.name}.mp3`);
        if (!res.ok) throw new Error(`Campione ${s.name}: HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(data);
        this.buffers.set(s.name, buf);
        this.loaded++;
        this.emit();
      }),
    )
      .then(() => {
        this.state = 'ready';
        this.emit();
      })
      .catch((err) => {
        console.error(err);
        this.state = 'error';
        this.loadPromise = null;
        this.emit();
        throw err;
      });
    return this.loadPromise;
  }

  /** Suona una nota. `when` in tempo AudioContext (default: subito). */
  noteOn(midi: number, velocity = 0.8, when?: number): void {
    const ctx = audioEngine.context;
    const sample = nearestSample(midi);
    const buffer = this.buffers.get(sample.name);
    if (!buffer) return; // campione non ancora caricato: meglio silenzio che un ritardo

    // Una stessa nota ripetuta: rilascia la voce precedente.
    this.release(midi, when);

    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12);
    const gain = ctx.createGain();
    const v = Math.max(0.05, Math.min(1, velocity));
    gain.gain.setValueAtTime(v * v * 0.9 + 0.1 * v, t); // curva leggermente esponenziale
    src.connect(gain).connect(audioEngine.output);
    src.start(t);
    const voice: Voice = { midi, src, gain, startedAt: t };
    src.onended = () => {
      this.voices = this.voices.filter((x) => x !== voice);
      this.sustained.delete(voice);
      gain.disconnect();
    };
    this.voices.push(voice);

    if (this.voices.length > MAX_VOICES) {
      const oldest = this.voices.shift()!;
      this.fadeOut(oldest, ctx.currentTime, 0.05);
    }
  }

  noteOff(midi: number, when?: number): void {
    if (this.sustain) {
      this.voices.filter((v) => v.midi === midi).forEach((v) => this.sustained.add(v));
      return;
    }
    this.release(midi, when);
  }

  setSustain(on: boolean): void {
    this.sustain = on;
    if (!on) {
      const now = audioEngine.now();
      this.sustained.forEach((v) => this.fadeOut(v, now, RELEASE_S));
      this.sustained.clear();
    }
  }

  allNotesOff(): void {
    const now = audioEngine.now();
    this.voices.forEach((v) => this.fadeOut(v, now, 0.08));
    this.sustained.clear();
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private release(midi: number, when?: number) {
    const t = Math.max(when ?? audioEngine.now(), audioEngine.now());
    for (const v of this.voices) {
      if (v.midi === midi && !this.sustained.has(v)) this.fadeOut(v, t, RELEASE_S);
    }
  }

  private fadeOut(v: Voice, t: number, dur: number) {
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, dur / 4);
      v.src.stop(t + dur * 1.5);
    } catch {
      /* voce già fermata */
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const sampler = new SamplerImpl();
