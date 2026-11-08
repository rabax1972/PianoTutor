import { useEffect, useMemo, useState } from 'react';
import { useElementWidth, useSamplerState } from '../../app/hooks';
import { useSettings } from '../../app/settingsStore';
import { ensureAudio } from '../../audio/ensureAudio';
import { sampler } from '../../audio/Sampler';
import { noteColor, noteLabel } from '../../core/music/pitch';
import { t } from '../../i18n/it';
import { inputHub } from '../../input/inputHub';
import { TopBar } from '../../ui/components';
import { octavesForWidth, visibleRange } from '../../ui/keyboard/layout';
import { PianoKeyboard } from '../../ui/keyboard/PianoKeyboard';
import './FreePlayPage.css';

export function FreePlayPage() {
  const { settings, update } = useSettings();
  const [kbRef, kbWidth] = useElementWidth<HTMLDivElement>();
  const [shift, setShift] = useState(0);
  const [sustain, setSustain] = useState(false);
  const [lastNotes, setLastNotes] = useState<number[]>([]);
  useSamplerState();

  const octaves = kbWidth ? octavesForWidth(kbWidth) : 3;
  // limita lo spostamento perché il range resti dentro i campioni disponibili (circa Do2–Do7)
  const maxShift = Math.max(0, 3 - Math.ceil(octaves / 2));
  const minShift = -(2 - Math.floor(octaves / 2));
  const range = useMemo(() => visibleRange(octaves, shift), [octaves, shift]);

  useEffect(() => {
    setShift((s) => Math.min(maxShift, Math.max(minShift, s)));
  }, [maxShift, minShift]);

  useEffect(
    () =>
      inputHub.subscribe((e) => {
        if (e.type === 'on') setLastNotes((prev) => [...prev.slice(-5), e.midi]);
      }),
    [],
  );

  useEffect(() => {
    sampler.setSustain(sustain);
  }, [sustain]);

  useEffect(() => () => sampler.setSustain(false), []);

  const loading = sampler.state === 'loading' || sampler.state === 'idle';
  const current = lastNotes[lastNotes.length - 1];

  return (
    <main className="page page--full freeplay">
      <TopBar
        title={t.play.title}
        actions={
          <>
            <button
              className="btn btn--icon"
              aria-label={t.play.octaveDown}
              onClick={() => setShift((s) => Math.max(minShift, s - 1))}
              disabled={shift <= minShift}
            >
              ◀
            </button>
            <button
              className="btn btn--icon"
              aria-label={t.play.octaveUp}
              onClick={() => setShift((s) => Math.min(maxShift, s + 1))}
              disabled={shift >= maxShift}
            >
              ▶
            </button>
            <button
              className={`btn${settings.showNoteNames ? ' btn--on' : ''}`}
              aria-pressed={settings.showNoteNames}
              onClick={() => update({ showNoteNames: !settings.showNoteNames })}
            >
              {t.play.labels}
            </button>
            <button className={`btn${sustain ? ' btn--on' : ''}`} aria-pressed={sustain} onClick={() => setSustain((v) => !v)}>
              {t.play.sustain}
            </button>
          </>
        }
      />

      <section className="freeplay__display" aria-live="polite">
        {sampler.state === 'error' ? (
          <div className="banner banner--warn">
            {t.play.samplesError}
            <button className="btn" onClick={() => void ensureAudio()}>
              {t.play.retry}
            </button>
          </div>
        ) : loading ? (
          <div className="freeplay__loading">
            <p>{t.play.loadingSamples}</p>
            <div className="progress" style={{ maxWidth: 320 }}>
              <div style={{ width: `${(sampler.loaded / sampler.total) * 100}%` }} />
            </div>
          </div>
        ) : current === undefined ? (
          <p className="muted freeplay__hint">{t.play.hint}</p>
        ) : (
          <>
            <div
              className="freeplay__note"
              data-testid="current-note"
              style={{ color: settings.colorNotes ? noteColor(current) : undefined }}
            >
              {noteLabel(current, settings.noteNaming)}
              <span className="freeplay__octave">{Math.floor(current / 12) - 1}</span>
            </div>
            <div className="freeplay__history">
              {lastNotes.slice(0, -1).map((m, i) => (
                <span key={i}>{noteLabel(m, settings.noteNaming)}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="freeplay__keyboard" ref={kbRef}>
        <PianoKeyboard
          from={range.from}
          to={range.to}
          onNoteOn={(m, ts, v) => inputHub.virtual.press(m, ts, v)}
          onNoteOff={(m, ts) => inputHub.virtual.release(m, ts)}
          showLabels={settings.showNoteNames}
          naming={settings.noteNaming}
          colorNotes={settings.colorNotes}
        />
      </div>
    </main>
  );
}
