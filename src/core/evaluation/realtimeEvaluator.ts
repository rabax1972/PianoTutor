/**
 * Valutazione in tempo reale: il brano scorre a tempo; ogni nota suonata viene abbinata
 * alla nota attesa più vicina con la stessa altezza entro ±goodMs.
 *
 * Le posizioni sono in beat; la conversione in ms usa msPerBeat (dipende dal tempo e dalla
 * velocità scelta), così le finestre restano in millisecondi reali anche rallentando.
 */
import type { ScoringConfig } from '../content/schema';
import type { Timeline } from '../timing/timeline';
import { buildResult, timingScore } from './scoring';
import type { Grade, NoteError, NoteFeedback, OnsetJudgement, SessionResult } from './types';

interface Expected {
  onsetIndex: number;
  t: number;
  midi: number;
  matched: boolean;
  deltaMs?: number;
  grade?: Grade;
}

interface WrongPress {
  midi: number;
  beat: number;
  onsetIndex: number | null;
}

export class RealtimeEvaluator {
  private readonly expected: Expected[] = [];
  private readonly byOnset = new Map<number, Expected[]>();
  private readonly finalized = new Set<number>();
  private readonly judgements: OnsetJudgement[] = [];
  private readonly wrong: WrongPress[] = [];
  private readonly errors: NoteError[] = [];

  constructor(
    private readonly tl: Timeline,
    private readonly cfg: ScoringConfig,
    private readonly msPerBeat: () => number,
  ) {
    tl.onsets.forEach((o, onsetIndex) => {
      if (!o.midis.length) return;
      const list = o.midis.map((midi) => ({ onsetIndex, t: o.t, midi, matched: false }));
      this.expected.push(...list);
      this.byOnset.set(onsetIndex, list);
    });
  }

  private get goodBeats(): number {
    return this.cfg.timing.goodMs / this.msPerBeat();
  }

  get totalOnsets(): number {
    return this.byOnset.size;
  }

  get done(): boolean {
    return this.finalized.size >= this.byOnset.size;
  }

  noteOn(midi: number, beat: number): NoteFeedback {
    const win = this.goodBeats;
    let best: Expected | undefined;
    for (const e of this.expected) {
      if (e.matched || e.midi !== midi || this.finalized.has(e.onsetIndex)) continue;
      const d = Math.abs(beat - e.t);
      if (d <= win && (!best || d < Math.abs(beat - best.t))) best = e;
    }
    if (best) {
      const deltaMs = (beat - best.t) * this.msPerBeat();
      const grade: Grade = Math.abs(deltaMs) <= this.cfg.timing.perfectMs ? 'perfect' : deltaMs < 0 ? 'early' : 'late';
      best.matched = true;
      best.deltaMs = deltaMs;
      best.grade = grade;
      const list = this.byOnset.get(best.onsetIndex)!;
      const complete = list.every((e) => e.matched);
      if (complete) this.finalize(best.onsetIndex);
      return {
        kind: 'hit',
        midi,
        grade,
        onsetIndex: best.onsetIndex,
        eventIndices: [...this.tl.onsets[best.onsetIndex]!.events],
        deltaMs,
        onsetComplete: complete,
      };
    }
    // nota sbagliata: attribuita all'onset aperto più vicino (per statistiche e colore)
    let nearest: number | null = null;
    let nd = Infinity;
    for (const [oi, list] of this.byOnset) {
      if (this.finalized.has(oi)) continue;
      const d = Math.abs(beat - list[0]!.t);
      if (d <= win * 1.5 && d < nd) {
        nd = d;
        nearest = oi;
      }
    }
    this.wrong.push({ midi, beat, onsetIndex: nearest });
    const expected = nearest !== null ? this.byOnset.get(nearest)!.map((e) => e.midi) : [];
    this.errors.push({ expected, played: midi });
    return { kind: 'wrong', midi, onsetIndex: nearest, expected };
  }

  noteOff(_midi: number, _beat: number): void {
    /* la durata tenuta non è valutata nei primi livelli */
  }

  /** Chiude gli onset la cui finestra è passata. Restituisce i giudizi nuovi. */
  advance(beat: number): OnsetJudgement[] {
    const win = this.goodBeats;
    const out: OnsetJudgement[] = [];
    for (const [oi, list] of this.byOnset) {
      if (this.finalized.has(oi)) continue;
      if (beat > list[0]!.t + win) out.push(this.finalize(oi));
    }
    return out;
  }

  private finalize(oi: number): OnsetJudgement {
    this.finalized.add(oi);
    const list = this.byOnset.get(oi)!;
    const onset = this.tl.onsets[oi]!;
    const wrongHere = this.wrong.filter((w) => w.onsetIndex === oi);
    let grade: Grade;
    const matched = list.filter((e) => e.matched);
    if (matched.length < list.length) grade = wrongHere.length ? 'wrong' : 'missed';
    else {
      const worst = matched.reduce((a, b) => (Math.abs(b.deltaMs!) > Math.abs(a.deltaMs!) ? b : a));
      grade = worst.grade!;
    }
    const deltas = matched.map((e) => e.deltaMs!);
    const j: OnsetJudgement = {
      onsetIndex: oi,
      t: onset.t,
      grade,
      eventIndices: [...onset.events],
      expected: list.map((e) => e.midi),
      played: [...matched.map((e) => e.midi), ...wrongHere.map((w) => w.midi)],
      deltaMs: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : undefined,
    };
    this.judgements.push(j);
    return j;
  }

  judgementsSoFar(): readonly OnsetJudgement[] {
    return this.judgements;
  }

  finish(): SessionResult {
    // chiude tutto ciò che è rimasto aperto
    for (const oi of this.byOnset.keys()) if (!this.finalized.has(oi)) this.finalize(oi);
    const total = this.expected.length;
    const matched = this.expected.filter((e) => e.matched);
    const pitch = total === 0 ? 0 : matched.length / (total + this.wrong.length * 0.5);
    const timing = matched.length ? matched.reduce((s, e) => s + timingScore(e.deltaMs!, this.cfg.timing), 0) / matched.length : 0;
    const onsets = [...this.judgements].sort((a, b) => a.t - b.t);
    return buildResult('realtime', onsets, [...this.errors], pitch, timing, this.cfg);
  }
}
