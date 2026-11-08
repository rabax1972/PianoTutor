/**
 * PlaySession: orchestra una singola esecuzione di un brano.
 *  - trasporto (orologio audio), metronomo/accompagnamento (PlaybackScheduler)
 *  - input dall'inputHub (qualsiasi sorgente)
 *  - valutazione (WaitEvaluator / RealtimeEvaluator) e feedback visivo
 *
 * Espone uno snapshot osservabile per React (useSyncExternalStore).
 */
import { audioEngine } from '../../audio/AudioEngine';
import { PlaybackScheduler } from '../../audio/PlaybackScheduler';
import { sampler } from '../../audio/Sampler';
import { DEFAULT_SCORING, type Piece, type ScoringConfig } from '../../core/content/schema';
import { RealtimeEvaluator } from '../../core/evaluation/realtimeEvaluator';
import type { Grade, NoteFeedback, OnsetJudgement, SessionResult } from '../../core/evaluation/types';
import { WaitEvaluator } from '../../core/evaluation/waitEvaluator';
import { noteLabel, type NoteNaming } from '../../core/music/pitch';
import { buildTimeline, measureRange, sliceTimeline, type Timeline } from '../../core/timing/timeline';
import { Transport } from '../../core/timing/transport';
import { inputHub } from '../../input/inputHub';
import type { NoteInputEvent } from '../../input/types';
import type { NoteMark } from '../../notation/ScoreView';
import type { KeyMark } from '../../ui/keyboard/PianoKeyboard';

export type PlayMode = 'listen' | 'wait' | 'realtime';
export type SessionStatus = 'idle' | 'countin' | 'playing' | 'waiting' | 'paused' | 'finished';

export interface SessionConfig {
  piece: Piece;
  mode: PlayMode;
  tempoScale: number;
  metronome: boolean;
  /** suggerimenti sulla tastiera e messaggi con il nome della nota */
  guided: boolean;
  hands: 'R' | 'L' | 'both';
  naming: NoteNaming;
  scoring?: Partial<ScoringConfig>;
  loop?: { fromMeasure: number; toMeasure: number };
  /** sorgente di input: col microfono l'app non suona l'accompagnamento (lo sentirebbe come note dell'utente) */
  inputKind?: 'virtual' | 'midi' | 'mic';
}

export interface FeedbackMessage {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}

export interface SessionSnapshot {
  status: SessionStatus;
  marks: ReadonlyMap<number, NoteMark>;
  keyMarks: ReadonlyMap<number, KeyMark>;
  /** dita suggerite per le note da suonare */
  keyFingers: ReadonlyMap<number, number>;
  message: FeedbackMessage | null;
  progress: { done: number; total: number };
  result: SessionResult | null;
  /** striscia di note giuste consecutive */
  streak: number;
  tempoScale: number;
  metronome: boolean;
}

const GRADE_TO_MARK: Record<Grade, NoteMark> = {
  perfect: 'correct',
  early: 'early',
  late: 'early',
  corrected: 'early',
  wrong: 'wrong',
  missed: 'wrong',
};

const PRAISE = ['Perfetto!', 'Bravo!', 'Ottimo!', 'Continua così!', 'Grande!'];

export class PlaySession {
  readonly timeline: Timeline;
  private readonly fullTimeline: Timeline;
  private readonly transport: Transport;
  private scheduler: PlaybackScheduler | null = null;
  private wait: WaitEvaluator | null = null;
  private realtime: RealtimeEvaluator | null = null;
  private readonly scoring: ScoringConfig;
  private unsubInput: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flashTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private msgId = 0;
  private startBeat: number;
  private endBeat: number;
  private activeSince: number | null = null;
  /** millisecondi di pratica effettiva (escluse pause) */
  practiceMs = 0;

  private snap: SessionSnapshot = {
    status: 'idle',
    marks: new Map(),
    keyMarks: new Map(),
    keyFingers: new Map(),
    message: null,
    progress: { done: 0, total: 0 },
    result: null,
    streak: 0,
    tempoScale: 1,
    metronome: false,
  };

  constructor(
    readonly config: SessionConfig,
    private readonly onFinish?: (result: SessionResult | null) => void,
  ) {
    this.fullTimeline = buildTimeline(config.piece);
    if (config.loop) {
      const r = measureRange(this.fullTimeline, config.loop.fromMeasure, config.loop.toMeasure);
      this.timeline = sliceTimeline(this.fullTimeline, r.from, r.to);
      this.startBeat = r.from;
      this.endBeat = r.to;
    } else {
      this.timeline = this.fullTimeline;
      this.startBeat = 0;
      this.endBeat = this.fullTimeline.totalBeats;
    }
    this.scoring = {
      ...DEFAULT_SCORING,
      ...config.scoring,
      timing: { ...DEFAULT_SCORING.timing, ...config.scoring?.timing },
      weights: { ...DEFAULT_SCORING.weights, ...config.scoring?.weights },
    };
    this.transport = new Transport(() => audioEngine.now(), config.piece.tempo.bpm);
    this.transport.setTempoScale(config.tempoScale);
    this.transport.seek(this.initialBeat());
    this.snap = { ...this.snap, tempoScale: config.tempoScale, metronome: config.metronome };
    this.setup();
  }

  // ---------- API pubblica ----------

  get snapshot(): SessionSnapshot {
    return this.snap;
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** posizione visiva corrente (beat), compensata per la latenza di uscita */
  getBeat = (): number => {
    const beat = this.transport.beatAt(this.visualTime());
    if (this.wait) {
      const o = this.wait.currentOnset;
      if (o) return Math.min(beat, o.t);
    }
    return beat;
  };

  start(): void {
    if (this.snap.status === 'playing' || this.snap.status === 'countin' || this.snap.status === 'waiting') return;
    if (this.snap.status === 'finished') this.reset();
    const resume = this.snap.status === 'paused';
    let from = this.transport.beatAt();
    if (!resume && this.config.mode !== 'wait') from = this.startBeat - this.timeline.measureBeats; // conteggio
    this.transport.play(from, 0.08);
    if (this.config.mode !== 'wait' || this.config.metronome) {
      this.scheduler = new PlaybackScheduler(this.transport, this.timeline, this.schedulerOptions());
      this.scheduler.start(from);
    }
    this.unsubInput ??= inputHub.subscribe(this.onInput);
    this.updateExpected();
    this.timer ??= setInterval(this.tick, 30);
    this.activeSince = performance.now();
    this.patch({ status: from < this.startBeat && this.config.mode !== 'wait' ? 'countin' : 'playing' });
  }

  pause(): void {
    if (!['playing', 'countin', 'waiting'].includes(this.snap.status)) return;
    this.transport.pause();
    this.scheduler?.stop();
    sampler.allNotesOff();
    this.accumulatePractice();
    this.patch({ status: 'paused' });
  }

  /** ricomincia da capo (stessa configurazione) */
  restart(): void {
    this.stopAll();
    this.reset();
  }

  setTempoScale(scale: number): void {
    this.config.tempoScale = scale;
    this.transport.setTempoScale(scale);
    this.patch({ tempoScale: scale });
  }

  setMetronome(on: boolean): void {
    this.config.metronome = on;
    this.patch({ metronome: on });
    if (this.scheduler) this.scheduler.update({ metronome: on });
    else if (on && this.transport.playing) {
      this.scheduler = new PlaybackScheduler(this.transport, this.timeline, this.schedulerOptions());
      this.scheduler.start();
    }
  }

  dispose(): void {
    this.stopAll();
    inputHub.setExpectedNotes([]);
    this.unsubInput?.();
    this.unsubInput = null;
    this.listeners.clear();
  }

  // ---------- interni ----------

  private initialBeat(): number {
    if (this.config.mode === 'wait') {
      const first = this.timeline.onsets.find((o) => o.midis.length);
      return Math.max(this.startBeat - 1, (first?.t ?? this.startBeat) - 1);
    }
    return this.startBeat;
  }

  private setup() {
    this.wait = null;
    this.realtime = null;
    if (this.config.mode === 'wait') this.wait = new WaitEvaluator(this.timeline, this.scoring);
    if (this.config.mode === 'realtime')
      this.realtime = new RealtimeEvaluator(this.timeline, this.scoring, () => this.transport.secondsPerBeat * 1000);
    const total = this.wait?.progress.total ?? this.realtime?.totalOnsets ?? 0;
    this.snap = { ...this.snap, marks: new Map(), ...this.keyState(), progress: { done: 0, total }, result: null, streak: 0, message: null };
  }

  private reset() {
    this.transport.pause();
    this.transport.seek(this.initialBeat());
    this.setup();
    this.patch({ status: 'idle' });
  }

  private stopAll() {
    this.transport.pause();
    this.scheduler?.stop();
    this.scheduler = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.flashTimers.forEach((t) => clearTimeout(t));
    this.flashTimers.clear();
    sampler.allNotesOff();
    this.accumulatePractice();
  }

  private accumulatePractice() {
    if (this.activeSince !== null) {
      this.practiceMs += performance.now() - this.activeSince;
      this.activeSince = null;
    }
  }

  private visualTime(): number {
    const info = audioEngine.latencyInfo();
    return audioEngine.now() - info.outputLatency - info.baseLatency;
  }

  /** In "ascolta" suona tutto; a tempo, l app accompagna con la mano non richiesta. */
  private schedulerOptions() {
    const { mode, hands, metronome, piece } = this.config;
    const other: 'R' | 'L' | null = hands === 'R' ? 'L' : hands === 'L' ? 'R' : null;
    return {
      playNotes: mode === 'listen' || (mode === 'realtime' && other !== null && this.config.inputKind !== 'mic'),
      hands: mode === 'listen' ? ('both' as const) : (other ?? 'both'),
      metronome,
      clickEvery: piece.timeSignature[1] === 8 ? 1.5 : 1,
    };
  }

  private tick = () => {
    const status = this.snap.status;
    if (status === 'paused' || status === 'finished' || status === 'idle') return;
    const beat = this.transport.beatAt(this.visualTime());

    if (status === 'countin' && beat >= this.startBeat) this.patch({ status: 'playing' });

    if (this.wait) {
      const o = this.wait.currentOnset;
      if (o && this.transport.playing && this.transport.beatAt() >= o.t) {
        // il brano aspetta l'utente sulla nota
        this.transport.pause();
        this.transport.seek(o.t);
        this.patch({ status: 'waiting' });
      }
      return;
    }

    if (this.realtime) {
      const closed = this.realtime.advance(beat);
      if (closed.length) this.applyJudgements(closed, true);
      if (this.config.guided) this.refreshKeys(beat);
      else this.updateExpected(beat);
    }

    if (beat >= this.endBeat + 0.3) this.finish();
  };

  private onInput = (e: NoteInputEvent) => {
    if (e.type !== 'on') {
      this.wait?.noteOff(e.midi);
      return;
    }
    const status = this.snap.status;
    if (this.config.mode === 'listen' || status === 'idle' || status === 'paused' || status === 'finished') return;

    if (this.wait) {
      const fb = this.wait.noteOn(e.midi);
      this.handleFeedback(fb);
      if (fb.kind === 'hit' && fb.onsetComplete) {
        const j = this.wait.judgementsSoFar().at(-1)!;
        this.applyJudgements([j], false);
        if (this.wait.done) {
          setTimeout(() => this.finish(), 600);
          return;
        }
        if (this.transport.beatAt() < j.t) this.transport.seek(j.t); // l'utente è più veloce dello scorrimento
        if (!this.transport.playing) {
          // riparte verso la nota successiva
          this.transport.play(this.transport.beatAt(), 0);
          this.patch({ status: 'playing' });
        }
      }
      this.refreshKeys();
      return;
    }

    if (this.realtime) {
      const beat = this.transport.beatAt(e.time - audioEngine.latencyInfo().outputLatency - audioEngine.latencyInfo().baseLatency);
      const fb = this.realtime.noteOn(e.midi, beat);
      this.handleFeedback(fb);
      if (fb.kind === 'hit' && fb.onsetComplete) {
        const j = this.realtime.judgementsSoFar().at(-1)!;
        this.applyJudgements([j], false);
      }
    }
  };

  private handleFeedback(fb: NoteFeedback) {
    if (fb.kind === 'ignored') return;
    if (fb.kind === 'wrong') {
      this.flash(fb.midi, 'wrong');
      const name = fb.expected.map((m) => noteLabel(m, this.config.naming)).join(' + ');
      const text = this.config.guided && name ? `Quasi! Cerca il ${name}` : 'Riprova, ce la fai!';
      this.patch({ streak: 0, message: this.msg(text, 'bad') });
      return;
    }
    const mark: KeyMark = fb.grade === 'perfect' ? 'correct' : fb.grade === 'corrected' ? 'correct' : 'early';
    this.flash(fb.midi, mark);
    if (!fb.onsetComplete) return;
    const streak = fb.grade === 'perfect' ? this.snap.streak + 1 : 0;
    let message: FeedbackMessage | null = this.snap.message;
    if (fb.grade === 'early') message = this.msg('Un po’ in anticipo', 'warn');
    else if (fb.grade === 'late') message = this.msg('Un po’ in ritardo', 'warn');
    else if (fb.grade === 'corrected') message = this.msg('Giusto!', 'ok');
    else if (streak > 0 && streak % 5 === 0) message = this.msg(`${PRAISE[(streak / 5 - 1) % PRAISE.length]} ${streak} di fila`, 'ok');
    this.patch({ streak, message });
  }

  private applyJudgements(js: readonly OnsetJudgement[], fromAdvance: boolean) {
    const marks = new Map(this.snap.marks);
    for (const j of js) {
      for (const idx of j.eventIndices) {
        const ev = this.timeline.events.find((e) => e.index === idx);
        if (ev && !ev.isRest) marks.set(idx, GRADE_TO_MARK[j.grade]);
      }
    }
    const done = (this.wait?.judgementsSoFar().length ?? this.realtime?.judgementsSoFar().length) ?? 0;
    const patch: Partial<SessionSnapshot> = { marks, progress: { ...this.snap.progress, done } };
    if (fromAdvance && js.some((j) => j.grade === 'missed' || j.grade === 'wrong')) patch.streak = 0;
    this.patch(patch);
  }

  private finish() {
    if (this.snap.status === 'finished') return;
    this.stopAll();
    const result = this.wait?.finish() ?? this.realtime?.finish() ?? null;
    if (result) this.applyJudgements(result.onsets, false);
    this.patch({ status: 'finished', result, keyMarks: new Map(), keyFingers: new Map() });
    this.onFinish?.(result);
  }

  /** onset da suggerire (solo modalità guidata) */
  private hintOnset(beat?: number) {
    if (!this.config.guided || this.config.mode === 'listen') return undefined;
    if (this.wait) return this.wait.currentOnset;
    if (this.realtime && beat !== undefined) {
      const next = this.timeline.onsets.find((o) => o.midis.length && o.t >= beat - 0.15);
      if (next && next.t - beat <= 1) return next;
    }
    return undefined;
  }

  /** segni e dita sulla tastiera: suggerimenti + lampeggi di feedback */
  private keyState(beat?: number): Pick<SessionSnapshot, 'keyMarks' | 'keyFingers'> {
    const marks = new Map<number, KeyMark>();
    const fingers = new Map<number, number>();
    const o = this.hintOnset(beat);
    if (o) {
      const todo = this.wait ? new Set(this.wait.remaining) : new Set(o.midis);
      for (const idx of o.events) {
        const ev = this.timeline.events.find((e) => e.index === idx);
        ev?.midis.forEach((m, i) => {
          if (!todo.has(m)) return;
          marks.set(m, 'hint');
          const fg = ev.fingers?.[i];
          if (fg) fingers.set(m, fg);
        });
      }
    }
    this.flashes.forEach((v, k) => marks.set(k, v));
    return { keyMarks: marks, keyFingers: fingers };
  }

  private refreshKeys(beat?: number) {
    this.patch(this.keyState(beat ?? (this.wait ? undefined : this.getBeat())));
    this.updateExpected(beat);
  }

  private lastExpected = '';
  /** comunica alle sorgenti (microfono) le note attese ora, per la verifica degli accordi */
  private updateExpected(beat?: number) {
    let midis: number[] = [];
    if (this.wait) midis = this.wait.remaining;
    else if (this.realtime) {
      const b = beat ?? this.getBeat();
      const win = this.scoring.timing.goodMs / (this.transport.secondsPerBeat * 1000);
      const o = this.timeline.onsets.find((x) => x.midis.length && Math.abs(x.t - b) <= win);
      midis = o ? o.midis : [];
    }
    const key = midis.join(',');
    if (key === this.lastExpected) return;
    this.lastExpected = key;
    inputHub.setExpectedNotes(midis);
  }

  private flashes = new Map<number, KeyMark>();

  private flash(midi: number, mark: KeyMark) {
    this.flashes.set(midi, mark);
    clearTimeout(this.flashTimers.get(midi));
    this.flashTimers.set(
      midi,
      setTimeout(() => {
        this.flashes.delete(midi);
        this.refreshKeys();
      }, 380),
    );
    this.refreshKeys();
  }

  private msg(text: string, tone: FeedbackMessage['tone']): FeedbackMessage {
    return { id: ++this.msgId, text, tone };
  }

  private patch(p: Partial<SessionSnapshot>) {
    const keys = Object.keys(p);
    const onlyKeys = keys.every((k) => k === 'keyMarks' || k === 'keyFingers');
    if (
      onlyKeys &&
      (!p.keyMarks || sameMarks(p.keyMarks, this.snap.keyMarks)) &&
      (!p.keyFingers || sameMarks(p.keyFingers, this.snap.keyFingers))
    )
      return;
    this.snap = { ...this.snap, ...p };
    this.listeners.forEach((l) => l());
  }
}

function sameMarks<T>(a: ReadonlyMap<number, T>, b: ReadonlyMap<number, T>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}
