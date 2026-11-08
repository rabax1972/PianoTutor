import { audioEngine } from '../../audio/AudioEngine';
import { BaseInputSource } from '../BaseInputSource';

/**
 * Sorgente "tastiera a schermo". Il componente <PianoKeyboard> chiama press/release
 * passando event.timeStamp, che viene convertito nel tempo dell'AudioContext.
 */
export class VirtualKeyboardInput extends BaseInputSource {
  readonly kind = 'virtual' as const;

  async start(): Promise<void> {
    /* nessuna risorsa da acquisire */
  }

  stop(): void {
    /* niente da rilasciare */
  }

  press(midi: number, eventTimeStampMs: number, velocity = 0.8): void {
    this.emit({ type: 'on', midi, velocity, time: audioEngine.performanceToAudioTime(eventTimeStampMs) });
  }

  release(midi: number, eventTimeStampMs: number): void {
    this.emit({ type: 'off', midi, velocity: 0, time: audioEngine.performanceToAudioTime(eventTimeStampMs) });
  }
}
