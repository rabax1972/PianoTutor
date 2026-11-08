/**
 * Trasporto: converte tra tempo audio (s) e posizione nel brano (beat).
 * L'orologio è iniettato (AudioContext.currentTime in app, finto nei test).
 */
export class Transport {
  private _playing = false;
  /** tempo audio a cui corrisponde anchorBeat */
  private anchorTime = 0;
  private anchorBeat = 0;
  private _tempoScale = 1;

  constructor(
    private readonly now: () => number,
    public bpm = 90,
  ) {}

  get playing(): boolean {
    return this._playing;
  }

  get tempoScale(): number {
    return this._tempoScale;
  }

  /** secondi per beat al tempo effettivo */
  get secondsPerBeat(): number {
    return 60 / (this.bpm * this._tempoScale);
  }

  /** Posizione (beat) al tempo audio dato. */
  beatAt(time = this.now()): number {
    if (!this._playing) return this.anchorBeat;
    return this.anchorBeat + (time - this.anchorTime) / this.secondsPerBeat;
  }

  /** Tempo audio (s) a cui verrà raggiunto il beat dato (se in riproduzione). */
  timeAt(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) * this.secondsPerBeat;
  }

  /** Avvia; `delay` (s) permette di schedulare con un piccolo margine. */
  play(fromBeat = this.beatAt(), delay = 0.05): void {
    this.anchorBeat = fromBeat;
    this.anchorTime = this.now() + delay;
    this._playing = true;
  }

  pause(): void {
    if (!this._playing) return;
    this.anchorBeat = this.beatAt();
    this._playing = false;
  }

  seek(beat: number): void {
    if (this._playing) {
      this.anchorBeat = beat;
      this.anchorTime = this.now();
    } else this.anchorBeat = beat;
  }

  /** Cambia velocità mantenendo continua la posizione. */
  setTempoScale(scale: number): void {
    const beat = this.beatAt();
    this._tempoScale = scale;
    if (this._playing) {
      this.anchorBeat = beat;
      this.anchorTime = this.now();
    }
  }
}
