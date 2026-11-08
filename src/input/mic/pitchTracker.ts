/**
 * PitchTracker: trasforma frame audio del microfono in eventi nota (on/off).
 * TS puro (testato con segnali sintetici), indipendente da Web Audio.
 *
 *  - livello RMS con soglia di rumore (calibrata) → ignora il silenzio/fondo
 *  - altezza con pitchy (McLeod Pitch Method) + soglia di chiarezza → ignora rumori non intonati
 *  - stabilità: la nota deve essere confermata per `stableFrames` frame consecutivi
 *  - nuovo attacco della stessa nota riconosciuto dal salto di energia
 *  - isteresi d'ottava: evita salti di ottava spuri durante il decadimento
 */
import { PitchDetector } from 'pitchy';
import { frequencyToMidi } from '../../core/music/pitch';

export interface TrackerConfig {
  sampleRate: number;
  /** campioni per analisi (2048 ≈ 43 ms a 48 kHz) */
  windowSize: number;
  a4: number;
  /** rumore di fondo misurato (dBFS); null = valore prudente predefinito */
  noiseFloorDb: number | null;
  /** margine sopra il rumore per considerare un suono (dB) */
  gateMarginDb: number;
  clarity: number;
  stableFrames: number;
  /** frame sotto soglia prima del rilascio */
  releaseFrames: number;
  /** salto di energia che indica un nuovo attacco (dB) */
  onsetJumpDb: number;
  minMidi: number;
  maxMidi: number;
  /** tolleranza di intonazione (cents) */
  maxCents: number;
}

export const DEFAULT_TRACKER: Omit<TrackerConfig, 'sampleRate'> = {
  windowSize: 2048,
  a4: 440,
  noiseFloorDb: null,
  gateMarginDb: 12,
  clarity: 0.88,
  stableFrames: 2,
  releaseFrames: 6,
  onsetJumpDb: 6,
  minMidi: 33, // La1
  maxMidi: 100, // Mi7
  maxCents: 45,
};

export interface FrameInfo {
  db: number;
  freq: number | null;
  clarity: number;
  midi: number | null;
  cents: number;
  aboveGate: boolean;
  attack: boolean;
}

export type TrackerEvent =
  | { type: 'on'; midi: number; velocity: number; time: number }
  | { type: 'off'; midi: number; time: number }
  /** attacco energetico (anche senza altezza chiara): usato per la verifica accordi */
  | { type: 'attack'; time: number; db: number };

const DEFAULT_FLOOR_DB = -58;
/** ≈ 85 ms con hop di 512 campioni a 48 kHz */
const REFRACTORY_FRAMES = 8;

export function rmsDb(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i]! * frame[i]!;
  const rms = Math.sqrt(s / frame.length);
  return rms > 0 ? 20 * Math.log10(rms) : -120;
}

export class PitchTracker {
  readonly cfg: TrackerConfig;
  private detector: PitchDetector<Float32Array>;
  private current: number | null = null;
  private candidate: number | null = null;
  private candCount = 0;
  private candTime = 0;
  private silent = 0;
  private unstable = 0;
  private framesSinceOn = 0;
  private recentDb: number[] = [];
  private frameIndex = 0;
  private lastAttackFrame = -1000;
  /** attacco rilevato ma non ancora associato a un'altezza stabile */
  private pendingAttack = 0;
  last: FrameInfo = { db: -120, freq: null, clarity: 0, midi: null, cents: 0, aboveGate: false, attack: false };

  constructor(cfg: Partial<TrackerConfig> & { sampleRate: number }) {
    this.cfg = { ...DEFAULT_TRACKER, ...cfg };
    this.detector = PitchDetector.forFloat32Array(this.cfg.windowSize);
    this.detector.minVolumeDecibels = -90;
  }

  update(cfg: Partial<TrackerConfig>): void {
    Object.assign(this.cfg, cfg);
  }

  get gateDb(): number {
    return Math.max((this.cfg.noiseFloorDb ?? DEFAULT_FLOOR_DB) + this.cfg.gateMarginDb, -72);
  }

  get currentNote(): number | null {
    return this.current;
  }

  /**
   * Analizza un frame (lunghezza = windowSize). `endTime` è il tempo audio (s) dell'ultimo campione.
   */
  process(frame: Float32Array, endTime: number): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    const { cfg } = this;
    const winDur = cfg.windowSize / cfg.sampleRate;
    const db = rmsDb(frame);
    const gate = this.gateDb;
    const aboveGate = db > gate;

    // attacco: salto di energia rispetto a una finestra intera prima (frame non sovrapposti),
    // con periodo refrattario per non contare più volte la stessa salita
    const hopsPerWindow = 4;
    const before = this.recentDb.length >= hopsPerWindow ? this.recentDb[this.recentDb.length - hopsPerWindow]! : -120;
    let attack = false;
    this.frameIndex++;
    if (aboveGate && db - before >= cfg.onsetJumpDb && this.frameIndex - this.lastAttackFrame >= REFRACTORY_FRAMES) {
      attack = true;
      this.lastAttackFrame = this.frameIndex;
      this.pendingAttack = 5;
      out.push({ type: 'attack', time: endTime - winDur / 2, db });
    }
    this.recentDb.push(db);
    if (this.recentDb.length > 8) this.recentDb.shift();

    let freq: number | null = null;
    let clarity = 0;
    let midi: number | null = null;
    let cents = 0;
    if (aboveGate) {
      const [f, c] = this.detector.findPitch(frame, cfg.sampleRate);
      clarity = c;
      if (c >= cfg.clarity && f > 0) {
        const m = frequencyToMidi(f, cfg.a4);
        const r = Math.round(m);
        cents = (m - r) * 100;
        if (r >= cfg.minMidi && r <= cfg.maxMidi && Math.abs(cents) <= cfg.maxCents) {
          freq = f;
          midi = r;
        }
      }
    }
    // isteresi d'ottava durante il decadimento della stessa nota
    if (midi !== null && this.current !== null && this.pendingAttack === 0 && Math.abs(midi - this.current) === 12) midi = this.current;

    this.last = { db, freq, clarity, midi, cents, aboveGate, attack };
    this.framesSinceOn++;
    const attackRecent = this.pendingAttack > 0;
    if (this.pendingAttack > 0) this.pendingAttack--;

    if (!aboveGate) {
      this.silent++;
      this.candidate = null;
      this.candCount = 0;
      if (this.current !== null && this.silent >= cfg.releaseFrames) out.push(this.off(endTime));
      return out;
    }
    this.silent = 0;

    if (midi === null) {
      this.unstable++;
      if (this.current !== null && this.unstable >= cfg.releaseFrames * 2) out.push(this.off(endTime));
      return out;
    }
    this.unstable = 0;

    if (midi === this.candidate) this.candCount++;
    else {
      this.candidate = midi;
      this.candCount = 1;
      this.candTime = endTime - winDur / 2;
    }

    const velocity = Math.max(0.2, Math.min(1, 0.3 + (db - gate) / 40));
    if (this.current === null) {
      if (this.candCount >= cfg.stableFrames) {
        this.pendingAttack = 0;
        out.push(this.on(midi, velocity));
      }
    } else if (midi !== this.current) {
      if (this.candCount >= cfg.stableFrames) {
        this.pendingAttack = 0;
        out.push(this.off(endTime));
        out.push(this.on(midi, velocity));
      }
    } else if (attackRecent && this.framesSinceOn > 4) {
      // stessa nota ripercossa
      this.pendingAttack = 0;
      out.push(this.off(endTime));
      this.candTime = endTime - winDur / 2;
      out.push(this.on(midi, velocity));
    }
    return out;
  }

  reset(): TrackerEvent[] {
    const out: TrackerEvent[] = [];
    if (this.current !== null) out.push(this.off(0));
    this.candidate = null;
    this.candCount = 0;
    this.recentDb = [];
    return out;
  }

  private on(midi: number, velocity: number): TrackerEvent {
    this.current = midi;
    this.framesSinceOn = 0;
    return { type: 'on', midi, velocity, time: this.candTime };
  }

  private off(time: number): TrackerEvent {
    const midi = this.current!;
    this.current = null;
    return { type: 'off', midi, time };
  }
}
