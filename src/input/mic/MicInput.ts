/**
 * Sorgente "microfono" (pianoforte acustico).
 *
 * getUserMedia (senza cancellazione eco/AGC) → AudioWorklet di cattura → frame da 2048 campioni
 * ogni 512 → PitchTracker (note singole) + verifica spettrale delle note attese (accordi).
 *
 * Il microfono si accende solo quando serve (acquire/release, conteggio dei riferimenti)
 * e si spegne poco dopo l'ultimo rilascio, per rispetto della privacy.
 */
import { audioEngine } from '../../audio/AudioEngine';
import { sampler } from '../../audio/Sampler';
import { pitchClass } from '../../core/music/pitch';
import { BaseInputSource } from '../BaseInputSource';
import { verifyNotes } from './chordVerifier';
import { magnitudeSpectrum } from './fft';
import { PitchTracker, rmsDb, type FrameInfo, type TrackerConfig, type TrackerEvent } from './pitchTracker';

export type MicState = 'off' | 'starting' | 'on' | 'denied' | 'error' | 'unsupported';

const WINDOW = 2048;
const CHORD_WINDOW = 8192;
/** finestra (s) in cui un'eco dei suoni dell'app viene ignorata */
const ECHO_GUARD_S = 0.6;

export class MicInput extends BaseInputSource {
  readonly kind = 'mic' as const;
  state: MicState = 'off';
  errorMessage = '';

  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private tracker: PitchTracker | null = null;
  private ring = new Float32Array(CHORD_WINDOW);
  private ringFill = 0;
  private expected: number[] = [];
  /** note già emesse dall'ultimo attacco (per non duplicare tra tracker e verifica accordi) */
  private emitted = new Set<number>();
  /** note attualmente "tenute" (per inviare i rilasci) */
  private held = new Set<number>();
  private chordCheckUntil = 0;
  private refs = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners = new Set<() => void>();
  private rawListeners = new Set<(ev: TrackerEvent[], info: FrameInfo, time: number) => void>();
  private pendingCfg: Partial<TrackerConfig> = {};

  /** aggiorna la configurazione (diapason, rumore, sensibilità) */
  configure(cfg: Partial<TrackerConfig>): void {
    this.pendingCfg = { ...this.pendingCfg, ...cfg };
    this.tracker?.update(cfg);
  }

  get trackerConfig(): TrackerConfig | null {
    return this.tracker?.cfg ?? null;
  }

  /** richiede il microfono (avvia se necessario) */
  async acquire(): Promise<void> {
    this.refs++;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.state !== 'on' && this.state !== 'starting') await this.start();
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && !this.stopTimer) {
      this.stopTimer = setTimeout(() => {
        this.stopTimer = null;
        if (this.refs === 0) this.stop();
      }, 2000);
    }
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.setState('unsupported', 'Il microfono richiede HTTPS e un browser recente.');
      return;
    }
    this.setState('starting');
    try {
      const ctx = audioEngine.context;
      await audioEngine.unlock();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      this.source = ctx.createMediaStreamSource(this.stream);
      this.tracker = new PitchTracker({ sampleRate: ctx.sampleRate, windowSize: WINDOW, ...this.pendingCfg });
      this.ring = new Float32Array(CHORD_WINDOW);
      this.ringFill = 0;
      // il nodo deve essere collegato a una destinazione per ricevere audio: uscita a volume zero
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.sink.connect(ctx.destination);

      if (ctx.audioWorklet) {
        await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/mic-capture.js`);
        const node = new AudioWorkletNode(ctx, 'mic-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        node.port.onmessage = (e: MessageEvent<{ samples: Float32Array; time: number }>) => this.onHop(e.data.samples, e.data.time);
        this.node = node;
      } else {
        // ripiego per browser senza AudioWorklet
        const sp = ctx.createScriptProcessor(512, 1, 1);
        sp.onaudioprocess = (e) => this.onHop(new Float32Array(e.inputBuffer.getChannelData(0)), e.playbackTime + 512 / ctx.sampleRate);
        this.node = sp;
      }
      this.source.connect(this.node);
      this.node.connect(this.sink);
      this.setState('on');
    } catch (err) {
      this.teardown();
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError')
        this.setState('denied', 'Accesso al microfono negato. Puoi riattivarlo dalle impostazioni del browser (icona del lucchetto accanto all’indirizzo).');
      else if (name === 'NotFoundError') this.setState('error', 'Nessun microfono trovato su questo dispositivo.');
      else this.setState('error', `Non riesco ad avviare il microfono (${name ?? 'errore sconosciuto'}).`);
    }
  }

  stop(): void {
    this.teardown();
    this.setState('off');
  }

  setExpectedNotes(midis: number[]): void {
    this.expected = midis;
  }

  /** stato e livelli per l'interfaccia */
  get level(): FrameInfo | null {
    return this.tracker?.last ?? null;
  }

  onState(l: () => void): () => void {
    this.stateListeners.add(l);
    return () => this.stateListeners.delete(l);
  }

  /** eventi grezzi del tracker, senza correzione di latenza (per la calibrazione) */
  onRaw(l: (ev: TrackerEvent[], info: FrameInfo, time: number) => void): () => void {
    this.rawListeners.add(l);
    return () => this.rawListeners.delete(l);
  }

  // ---------- interni ----------

  private teardown() {
    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      this.source?.disconnect();
      this.node?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* già scollegati */
    }
    if (this.node && 'port' in this.node) this.node.port.onmessage = null;
    this.stream = null;
    this.source = null;
    this.node = null;
    this.sink = null;
    this.tracker?.reset();
    for (const m of [...this.held]) this.emitOff(m, audioEngine.now());
    this.emitted.clear();
  }

  private setState(s: MicState, msg = '') {
    this.state = s;
    this.errorMessage = msg;
    this.stateListeners.forEach((l) => l());
  }

  private onHop(samples: Float32Array, time: number) {
    const tracker = this.tracker;
    if (!tracker) return;
    // buffer circolare lineare (shift): 8192 campioni, costo trascurabile
    this.ring.copyWithin(0, samples.length);
    this.ring.set(samples, CHORD_WINDOW - samples.length);
    this.ringFill = Math.min(CHORD_WINDOW, this.ringFill + samples.length);
    if (this.ringFill < WINDOW) return;

    const frame = this.ring.subarray(CHORD_WINDOW - WINDOW);
    const events = tracker.process(frame, time);
    this.rawListeners.forEach((l) => l(events, tracker.last, time));

    for (const ev of events) {
      if (ev.type === 'attack') {
        // nuovo attacco: le note dell'accordo precedente (non seguite dal tracker) si considerano rilasciate
        for (const m of [...this.held]) if (m !== tracker.currentNote) this.emitOff(m, ev.time);
        this.emitted.clear();
        this.chordCheckUntil = time + 0.35;
      } else if (ev.type === 'on') {
        if (this.isEcho(ev.midi, ev.time)) continue;
        if (!this.emitted.has(ev.midi)) this.emitOn(ev.midi, ev.velocity, ev.time);
      } else if (ev.type === 'off') {
        this.emitOff(ev.midi, ev.time);
      }
    }

    // accordi: dopo un attacco, verifica spettrale delle note attese (finestra lunga per la risoluzione)
    if (this.expected.length > 1 && time <= this.chordCheckUntil && this.ringFill >= CHORD_WINDOW && rmsDb(frame) > tracker.gateDb) {
      const spec = magnitudeSpectrum(this.ring);
      const found = verifyNotes(spec, tracker.cfg.sampleRate, this.expected, { a4: tracker.cfg.a4 });
      if (found.every((n) => n.present)) {
        const t = time - CHORD_WINDOW / tracker.cfg.sampleRate / 2;
        for (const n of found) {
          if (this.emitted.has(n.midi) || this.isEcho(n.midi, t)) continue;
          this.emitOn(n.midi, 0.7, Math.max(t, this.chordCheckUntil - 0.35));
        }
        this.chordCheckUntil = 0;
      }
    }
  }

  private emitOn(midi: number, velocity: number, time: number) {
    if (this.held.has(midi)) this.emitOff(midi, time);
    this.emitted.add(midi);
    this.held.add(midi);
    this.emit({ type: 'on', midi, velocity, time });
  }

  private emitOff(midi: number, time: number) {
    if (this.held.delete(midi)) this.emit({ type: 'off', midi, velocity: 0, time });
  }

  /** il suono rilevato è probabilmente l'app stessa (tastiera a schermo, "ascolta") */
  private isEcho(midi: number, time: number): boolean {
    for (const [m, t] of sampler.lastStart) {
      if (pitchClass(m) === pitchClass(midi) && Math.abs(m - midi) <= 12 && time - t < ECHO_GUARD_S && time >= t - 0.05) return true;
    }
    return false;
  }
}

export const micInput = new MicInput();
