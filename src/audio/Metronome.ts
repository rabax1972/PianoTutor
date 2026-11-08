import { audioEngine } from './AudioEngine';

/** Click del metronomo sintetizzato (nessun file da caricare). */
export function scheduleClick(when: number, accent: boolean, volume = 0.5): void {
  const ctx = audioEngine.context;
  const t = Math.max(when, ctx.currentTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1760 : 1175;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume * (accent ? 0.5 : 0.32), t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(gain).connect(audioEngine.output);
  osc.start(t);
  osc.stop(t + 0.06);
  osc.onended = () => gain.disconnect();
}
