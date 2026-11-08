import { useMemo, useState, type ReactNode } from 'react';
import { useElementWidth } from '../../app/hooks';
import { useSettings } from '../../app/settingsStore';
import { ensureAudio } from '../../audio/ensureAudio';
import { pitchRange, type TimelineEvent } from '../../core/timing/timeline';
import { useActiveInput } from '../../input/activeInput';
import { inputHub } from '../../input/inputHub';
import { MicMeter } from '../mic/MicMeter';
import { MicWarning } from '../mic/MicWarning';
import { ScoreView } from '../../notation/ScoreView';
import { Segmented } from '../../ui/components';
import { octavesForWidth, rangeForNotes } from '../../ui/keyboard/layout';
import { PianoKeyboard, type KeyMark } from '../../ui/keyboard/PianoKeyboard';
import type { PlaySession, SessionSnapshot } from './PlaySession';
import './play.css';

const STATUS_TEXT: Partial<Record<SessionSnapshot['status'], string>> = {
  countin: 'Pronti… 1, 2, 3, 4',
  waiting: 'Tocca a te!',
};

/**
 * Vista di esecuzione: spartito + feedback + controlli + tastiera.
 * `overlay` permette di mostrare introduzione o risultato sopra lo spartito.
 */
export function PlayView({
  session,
  snapshot,
  showNoteNames,
  showFingers = true,
  overlay,
  extraControls,
}: {
  session: PlaySession;
  snapshot: SessionSnapshot;
  showNoteNames: boolean;
  showFingers?: boolean;
  overlay?: ReactNode;
  extraControls?: ReactNode;
}) {
  const { settings } = useSettings();
  const input = useActiveInput();
  const [kbRef, kbWidth] = useElementWidth<HTMLDivElement>();
  const { piece, mode } = session.config;
  const running = ['playing', 'countin', 'waiting'].includes(snapshot.status);
  const [current, setCurrent] = useState<TimelineEvent[]>([]);

  // in ascolto la tastiera mostra le note che suonano; altrimenti i segni della sessione
  const keyMarks = useMemo(() => {
    if (mode !== 'listen') return snapshot.keyMarks;
    const m = new Map<number, KeyMark>();
    current.forEach((e) => e.midis.forEach((midi) => m.set(midi, 'hint')));
    return m;
  }, [mode, current, snapshot.keyMarks]);

  // dita suggerite: in ascolto quelle delle note che suonano, altrimenti quelle attese dalla sessione
  const fingers = useMemo(() => {
    if (!showFingers) return new Map<number, number>();
    if (mode !== 'listen') return snapshot.keyFingers;
    const f = new Map<number, number>();
    current.forEach((e) => e.midis.forEach((midi, i) => e.fingers?.[i] && f.set(midi, e.fingers[i]!)));
    return f;
  }, [current, mode, showFingers, snapshot.keyFingers]);

  const range = useMemo(() => {
    const r = pitchRange(session.timeline) ?? { min: 60, max: 72 };
    return rangeForNotes(r.min, r.max, kbWidth ? octavesForWidth(kbWidth) : 2);
  }, [session, kbWidth]);

  const scoreOptions = useMemo(
    () => ({
      showNoteNames,
      naming: settings.noteNaming,
      colorNotes: settings.colorNotes,
      showFingers,
      showLyrics: !showNoteNames,
    }),
    [showNoteNames, showFingers, settings.noteNaming, settings.colorNotes],
  );

  const toggle = async () => {
    if (running) session.pause();
    else {
      await ensureAudio();
      session.start();
    }
  };

  const msg = snapshot.message;
  const statusText = STATUS_TEXT[snapshot.status];

  return (
    <div className="playview">
      {input.mode === 'mic' && <MicWarning />}
      <section className="playview__score">
        <ScoreView piece={piece} options={scoreOptions} getBeat={session.getBeat} marks={snapshot.marks} onCurrentChange={setCurrent} />
        <div className="playview__hud" aria-live="polite">
          {statusText && <span className="hud-chip">{statusText}</span>}
          {msg && (
            <span key={msg.id} className={`hud-msg hud-msg--${msg.tone}`} data-testid="feedback">
              {msg.text}
            </span>
          )}
        </div>
        {snapshot.progress.total > 0 && (
          <div className="playview__progress progress" aria-hidden>
            <div style={{ width: `${(snapshot.progress.done / snapshot.progress.total) * 100}%` }} />
          </div>
        )}
        {overlay && <div className="playview__overlay">{overlay}</div>}
      </section>

      <div className="playview__controls">
        <button className="btn btn--icon" aria-label="Dall’inizio" onClick={() => session.restart()} data-testid="restart">
          ⏮
        </button>
        <button
          className="btn btn--primary playview__play"
          onClick={toggle}
          data-testid="play"
          disabled={snapshot.status === 'finished'}
          aria-label={running ? 'Pausa' : 'Suona'}
        >
          {running ? '⏸ Pausa' : snapshot.status === 'paused' ? '▶ Continua' : '▶ Inizia'}
        </button>
        <Segmented
          label="Velocità"
          value={snapshot.tempoScale}
          onChange={(v) => session.setTempoScale(v)}
          options={[
            { value: 0.5, label: '50%' },
            { value: 0.75, label: '75%' },
            { value: 1, label: '100%' },
          ]}
        />
        {mode !== 'listen' && (
          <button
            className={`btn${snapshot.metronome ? ' btn--on' : ''}`}
            aria-pressed={snapshot.metronome}
            onClick={() => session.setMetronome(!snapshot.metronome)}
          >
            Metronomo
          </button>
        )}
        {extraControls}
        {input.mode === 'mic' && input.mic.state === 'on' && <MicMeter compact />}
        <span className="muted playview__meta">{mode === 'wait' ? 'Ti aspetto su ogni nota' : mode === 'realtime' ? 'A tempo' : 'Ascolta'}</span>
      </div>

      <div className="playview__keyboard" ref={kbRef}>
        <PianoKeyboard
          from={range.from}
          to={range.to}
          onNoteOn={(m, ts, v) => inputHub.virtual.press(m, ts, v)}
          onNoteOff={(m, ts) => inputHub.virtual.release(m, ts)}
          marks={keyMarks}
          fingers={fingers}
          showLabels={settings.showNoteNames}
          naming={settings.noteNaming}
          colorNotes={settings.colorNotes}
        />
      </div>
    </div>
  );
}
