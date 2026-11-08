/**
 * AudioEngine: unico AudioContext dell'app, sbloccato al primo gesto dell'utente.
 * L'orologio di riferimento per trasporto, input e valutazione è `ctx.currentTime`.
 */

type Listener = () => void;

export interface LatencyInfo {
  sampleRate: number;
  /** latenza di elaborazione del browser (s) */
  baseLatency: number;
  /** latenza dell'uscita audio stimata (s), 0 se il browser non la espone */
  outputLatency: number;
  state: AudioContextState | 'uninitialized';
}

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private listeners = new Set<Listener>();

  get context(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 6;
      compressor.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(compressor).connect(this.ctx.destination);
      this.ctx.addEventListener('statechange', () => this.emit());
    }
    return this.ctx;
  }

  get output(): GainNode {
    void this.context;
    return this.master!;
  }

  get isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Da chiamare dentro un gestore di gesto (tap/click): su iOS l'audio parte solo così. */
  async unlock(): Promise<void> {
    const ctx = this.context;
    if (ctx.state !== 'running') {
      // Buffer silenzioso: necessario su alcune versioni di iOS Safari.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
      await ctx.resume();
    }
  }

  setVolume(v: number): void {
    this.output.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.context.currentTime, 0.02);
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * Converte un timestamp DOM (event.timeStamp / performance.now(), in ms)
   * nel tempo dell'AudioContext (s). Usato per datare con precisione gli input.
   */
  performanceToAudioTime(perfMs: number): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (performance.now() - perfMs) / 1000;
  }

  latencyInfo(): LatencyInfo {
    const ctx = this.ctx;
    if (!ctx) return { sampleRate: 0, baseLatency: 0, outputLatency: 0, state: 'uninitialized' };
    return {
      sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency ?? 0,
      outputLatency: (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0,
      state: ctx.state,
    };
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const audioEngine = new AudioEngineImpl();
