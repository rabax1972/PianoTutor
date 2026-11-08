import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settingsStore';
import { noteLabel } from '../../core/music/pitch';
import { micInput } from '../../input/mic/MicInput';
import './mic.css';

/**
 * Livello del microfono e nota rilevata, aggiornati a ogni frame.
 * `compact`: versione piccola per la barra dei controlli.
 */
export function MicMeter({ compact = false }: { compact?: boolean }) {
  const { settings } = useSettings();
  const barRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<{ midi: number | null; cents: number }>({ midi: null, cents: 0 });

  useEffect(() => {
    let raf = 0;
    let lastMidi: number | null = null;
    let lastCents = 0;
    const loop = () => {
      const lv = micInput.level;
      const cfgGate = micInput.trackerConfig ? (micInput.trackerConfig.noiseFloorDb ?? -58) + micInput.trackerConfig.gateMarginDb : -46;
      // scala -80…0 dBFS
      const pct = (db: number) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
      if (barRef.current) {
        barRef.current.style.width = `${pct(lv?.db ?? -120)}%`;
        barRef.current.classList.toggle('is-active', !!lv?.aboveGate);
      }
      if (gateRef.current) gateRef.current.style.left = `${pct(cfgGate)}%`;
      const midi = lv?.midi ?? null;
      const cents = Math.round(lv?.cents ?? 0);
      if (midi !== lastMidi || (midi !== null && Math.abs(cents - lastCents) >= 3)) {
        lastMidi = midi;
        lastCents = cents;
        setNote({ midi, cents });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`mic-meter${compact ? ' mic-meter--compact' : ''}`} data-testid="mic-meter">
      <span className="mic-meter__icon" aria-hidden>
        🎤
      </span>
      <div className="mic-meter__track" aria-hidden>
        <div className="mic-meter__bar" ref={barRef} />
        <div className="mic-meter__gate" ref={gateRef} title="Soglia" />
      </div>
      {!compact && (
        <div className="mic-meter__note" data-testid="mic-note" aria-live="polite">
          {note.midi !== null ? noteLabel(note.midi, settings.noteNaming, { octave: true }) : '—'}
          {note.midi !== null && (
            <span className="muted mic-meter__cents">
              {note.cents > 0 ? '+' : ''}
              {note.cents} cent
            </span>
          )}
        </div>
      )}
    </div>
  );
}
