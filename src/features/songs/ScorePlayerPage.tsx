import { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { getPiece } from '../../core/content/loader';
import type { Piece } from '../../core/content/schema';
import type { SessionResult } from '../../core/evaluation/types';
import { t } from '../../i18n/it';
import { addPracticeTime, recordAttempt } from '../lesson/progress';
import type { PlayMode } from '../play/PlaySession';
import { PlayView } from '../play/PlayView';
import { ResultCard } from '../play/ResultCard';
import { usePlaySession } from '../play/usePlaySession';
import type { LoopRange } from '../play/LoopControl';
import { Segmented, TopBar } from '../../ui/components';
import { preloadNotation } from '../../notation/preload';

preloadNotation();

export function ScorePlayerPage() {
  const { id } = useParams();
  const piece = id ? getPiece(id) : undefined;
  if (!piece) return <Navigate to="/brani" replace />;
  return <ScorePlayer key={piece.id} piece={piece} />;
}

/** Brani liberi: ascolta, suona con attesa o a tempo, con valutazione. */
function ScorePlayer({ piece }: { piece: Piece }) {
  const { settings, update } = useSettings();
  const [mode, setMode] = useState<PlayMode>('listen');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loop, setLoop] = useState<LoopRange | null>(null);
  const [hands, setHands] = useState<'R' | 'L' | 'both'>('both');
  const startedAt = useRef(Date.now());

  const { session, snapshot } = usePlaySession(
    {
      piece,
      mode,
      tempoScale: 1,
      metronome: false,
      guided: true,
      hands,
      naming: settings.noteNaming,
      inputKind: settings.inputMode ?? 'virtual',
      loop: loop ?? undefined,
    },
    `${mode}-${attempt}-${hands}-${loop ? `${loop.fromMeasure}-${loop.toMeasure}` : 'tutto'}`,
    (r, sess) => {
      void addPracticeTime(sess.practiceMs);
      if (!r) return;
      setResult(r);
      void recordAttempt(r, {
        lessonId: `brano:${piece.id}`,
        stepId: mode,
        inputMode: settings.inputMode ?? 'virtual',
        tempoScale: sess.config.tempoScale,
        startedAt: startedAt.current,
        practiceMs: sess.practiceMs,
      }).catch(console.warn);
    },
  );

  const changeMode = (m: PlayMode) => {
    setResult(null);
    setMode(m);
    startedAt.current = Date.now();
  };

  return (
    <main className="page page--full player">
      <TopBar
        title={piece.title}
        backTo="/brani"
        actions={
          <>
            <Segmented
              label="Modalità"
              value={mode}
              onChange={changeMode}
              options={[
                { value: 'listen', label: '🔊 Ascolta' },
                { value: 'wait', label: '⏸ Ti aspetto' },
                { value: 'realtime', label: '⏱ A tempo' },
              ]}
            />
            <button
              className={`btn${settings.showNoteNames ? ' btn--on' : ''}`}
              aria-pressed={settings.showNoteNames}
              onClick={() => update({ showNoteNames: !settings.showNoteNames })}
            >
              {t.play.labels}
            </button>
          </>
        }
      />
      {session && snapshot && (
        <PlayView
          session={session}
          snapshot={snapshot}
          showNoteNames={settings.showNoteNames}
          loop={loop}
          onHandsChange={(h) => {
            setResult(null);
            setHands(h);
          }}
          onLoopChange={(l) => {
            setResult(null);
            setLoop(l);
          }}
          overlay={
            result ? (
              <ResultCard
                result={result}
                naming={settings.noteNaming}
                onRetry={() => {
                  setResult(null);
                  setAttempt((a) => a + 1);
                  startedAt.current = Date.now();
                }}
              />
            ) : null
          }
        />
      )}
    </main>
  );
}
