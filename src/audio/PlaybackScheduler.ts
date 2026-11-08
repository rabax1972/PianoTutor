/**
 * Riproduce un brano e/o il metronomo seguendo il Transport, con scheduling anticipato
 * (lookahead) sull'orologio audio: timing preciso anche se il thread principale è occupato.
 */
import type { Timeline } from '../core/timing/timeline';
import type { Transport } from '../core/timing/transport';
import { audioEngine } from './AudioEngine';
import { scheduleClick } from './Metronome';
import { sampler } from './Sampler';

export interface PlaybackOptions {
  /** suona le note del brano (modalità "ascolta") */
  playNotes: boolean;
  /** quali mani suonare quando playNotes è attivo */
  hands: 'R' | 'L' | 'both';
  /** click su tutto il brano (il conteggio iniziale suona comunque) */
  metronome: boolean;
  /** suddivisione del metronomo in beat (1 = semiminima; 1.5 per 6/8) */
  clickEvery?: number;
}

type QueueItem = { beat: number; kind: 'on' | 'off'; midi: number } | { beat: number; kind: 'click'; accent: boolean };

const TICK_MS = 25;
const LOOKAHEAD_S = 0.12;

export class PlaybackScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private queue: QueueItem[] = [];
  private cursor = 0;
  /** ultimo beat già schedulato */
  private scheduledUntil = -Infinity;

  constructor(
    private readonly transport: Transport,
    private readonly timeline: Timeline,
    public options: PlaybackOptions,
    private readonly onEnd?: () => void,
  ) {}

  /** Avvia lo scheduling dalla posizione corrente del transport (che deve essere in play). */
  start(countInFrom?: number): void {
    this.stop();
    this.buildQueue(countInFrom ?? this.transport.beatAt());
    this.scheduledUntil = this.transport.beatAt() - 1e-6;
    this.cursor = this.queue.findIndex((q) => q.beat > this.scheduledUntil);
    if (this.cursor < 0) this.cursor = this.queue.length;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Cambio opzioni a caldo (metronomo, mani): ricostruisce la coda dalla posizione attuale. */
  update(options: Partial<PlaybackOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.timer) {
      const from = this.scheduledUntil;
      this.buildQueue(Math.min(from, this.transport.beatAt()));
      this.cursor = this.queue.findIndex((q) => q.beat > from);
      if (this.cursor < 0) this.cursor = this.queue.length;
    }
  }

  private buildQueue(fromBeat: number) {
    const q: QueueItem[] = [];
    const tl = this.timeline;
    const { playNotes, hands, metronome } = this.options;
    if (playNotes) {
      for (const e of tl.events) {
        if (e.isRest || (hands !== 'both' && e.hand !== hands)) continue;
        for (const midi of e.midis) {
          q.push({ beat: e.t, kind: 'on', midi });
          q.push({ beat: e.t + e.d - 0.04, kind: 'off', midi });
        }
      }
    }
    // il conteggio iniziale (beat negativi) suona sempre; il resto solo col metronomo attivo
    {
      const every = this.options.clickEvery ?? 1;
      const start = Math.floor(Math.min(fromBeat, 0) / every) * every;
      const stop = metronome ? tl.totalBeats : 0;
      for (let b = start; b < stop - 1e-6; b += every) {
        const rel = b < 0 ? b - Math.floor(b / tl.measureBeats) * tl.measureBeats : this.beatInMeasure(b);
        q.push({ beat: b, kind: 'click', accent: Math.abs(rel) < 1e-6 });
      }
    }
    // a parità di beat: prima i rilasci, poi click, poi attacchi
    const order = { off: 0, click: 1, on: 2 } as const;
    q.sort((a, b) => a.beat - b.beat || order[a.kind] - order[b.kind]);
    this.queue = q;
  }

  private beatInMeasure(b: number): number {
    const starts = this.timeline.measureStarts;
    let s = 0;
    for (const m of starts) if (m <= b + 1e-6) s = m;
    return b - s;
  }

  private tick() {
    if (!this.transport.playing) return;
    const until = this.transport.beatAt(audioEngine.now() + LOOKAHEAD_S);
    while (this.cursor < this.queue.length && this.queue[this.cursor]!.beat <= until) {
      const item = this.queue[this.cursor++]!;
      const when = this.transport.timeAt(item.beat);
      if (item.kind === 'click') scheduleClick(when, item.accent);
      else if (item.kind === 'on') sampler.noteOn(item.midi, 0.75, when);
      else sampler.noteOff(item.midi, when);
    }
    this.scheduledUntil = until;
    if (until > this.timeline.totalBeats + 0.5 && this.cursor >= this.queue.length) {
      this.stop();
      this.onEnd?.();
    }
  }
}
