/**
 * Valutazione in "wait mode": il brano si ferma su ogni nota finché l'utente non la suona.
 * Conta solo l'altezza. Gli accordi si completano anche premendo le note una alla volta.
 */
import type { ScoringConfig } from '../content/schema';
import type { Timeline } from '../timing/timeline';
import { buildResult } from './scoring';
import type { NoteError, NoteFeedback, OnsetJudgement, SessionResult } from './types';

export class WaitEvaluator {
  /** indici degli onset da suonare (senza pause/legature) */
  private readonly playable: number[];
  private pos = 0;
  private pressed = new Set<number>();
  private errorsHere = 0;
  private playedHere: number[] = [];
  private readonly judgements: OnsetJudgement[] = [];
  private readonly errors: NoteError[] = [];
  private totalNotes = 0;
  private totalErrors = 0;

  constructor(
    private readonly tl: Timeline,
    private readonly cfg: ScoringConfig,
  ) {
    this.playable = tl.onsets.map((o, i) => (o.midis.length ? i : -1)).filter((i) => i >= 0);
  }

  get done(): boolean {
    return this.pos >= this.playable.length;
  }

  /** onset corrente da suonare (indice in timeline.onsets) */
  get currentOnsetIndex(): number | null {
    return this.done ? null : this.playable[this.pos]!;
  }

  get currentOnset() {
    const i = this.currentOnsetIndex;
    return i === null ? undefined : this.tl.onsets[i];
  }

  /** note dell'onset corrente non ancora premute */
  get remaining(): number[] {
    const o = this.currentOnset;
    return o ? o.midis.filter((m) => !this.pressed.has(m)) : [];
  }

  get progress(): { done: number; total: number } {
    return { done: this.pos, total: this.playable.length };
  }

  noteOn(midi: number): NoteFeedback {
    const o = this.currentOnset;
    const oi = this.currentOnsetIndex;
    if (!o || oi === null) return { kind: 'ignored', midi };
    this.playedHere.push(midi);
    if (!o.midis.includes(midi)) {
      this.errorsHere++;
      this.totalErrors++;
      this.errors.push({ expected: [...o.midis], played: midi });
      return { kind: 'wrong', midi, onsetIndex: oi, expected: [...o.midis] };
    }
    this.pressed.add(midi);
    const complete = o.midis.every((m) => this.pressed.has(m));
    const grade = this.errorsHere === 0 ? 'perfect' : 'corrected';
    if (complete) {
      this.judgements.push({
        onsetIndex: oi,
        t: o.t,
        grade,
        eventIndices: [...o.events],
        expected: [...o.midis],
        played: [...this.playedHere],
      });
      this.totalNotes += o.midis.length;
      this.pos++;
      this.pressed.clear();
      this.errorsHere = 0;
      this.playedHere = [];
    }
    return { kind: 'hit', midi, grade, onsetIndex: oi, eventIndices: [...o.events], onsetComplete: complete };
  }

  /** Nel wait mode il rilascio non conta (accordi a note successive ammessi). */
  noteOff(_midi: number): void {}

  judgementsSoFar(): readonly OnsetJudgement[] {
    return this.judgements;
  }

  finish(): SessionResult {
    const pitch = this.totalNotes + this.totalErrors === 0 ? 0 : this.totalNotes / (this.totalNotes + this.totalErrors);
    return buildResult('wait', [...this.judgements], [...this.errors], pitch, null, this.cfg);
  }
}
