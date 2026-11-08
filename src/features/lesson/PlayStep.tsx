import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settingsStore';
import { ensureAudio } from '../../audio/ensureAudio';
import { resolveStepPiece } from '../../core/content/loader';
import type { Step } from '../../core/content/schema';
import type { SessionResult } from '../../core/evaluation/types';
import { PlayView } from '../play/PlayView';
import { ResultCard } from '../play/ResultCard';
import { usePlaySession } from '../play/usePlaySession';
import type { PlayMode } from '../play/PlaySession';
import { addPracticeTime, recordAttempt } from './progress';

type PlayableStep = Extract<Step, { type: 'exercise' | 'song' }>;
type Phase = 'intro' | 'listen' | 'ready' | 'play' | 'result';

function introCopy(step: PlayableStep, title: string): { title: string; text: string } {
  if (step.type === 'song') return { title: `🎵 ${title}`, text: 'Il tuo brano! Prima ascoltalo, poi suonalo tu.' };
  if (step.mode === 'guided')
    return {
      title: '👆 Esercizio guidato',
      text: step.settings.flow === 'wait' ? 'Suona i tasti illuminati. Ti aspetto su ogni nota, con calma.' : 'Suona i tasti illuminati quando arrivano sulla linea.',
    };
  return { title: '🎯 Ora da solo', text: 'Niente aiuti sulla tastiera: leggi le note sullo spartito. Ce la fai!' };
}

export function PlayStep({
  lessonId,
  step,
  onDone,
}: {
  lessonId: string;
  step: PlayableStep;
  onDone: (stars: number) => void;
}) {
  const { settings } = useSettings();
  const piece = resolveStepPiece(step);
  const s = step.settings;
  const [phase, setPhase] = useState<Phase>('intro');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const startedAt = useRef(Date.now());
  /** avvia la prossima sessione appena creata (cambio modalità ascolta → suona) */
  const pendingStart = useRef(false);

  const listening = phase === 'listen';
  const mode: PlayMode = listening ? 'listen' : s.flow;
  const hints = s.hints ?? !(step.type === 'exercise' && step.mode === 'free');
  const showNames = s.showNoteNames ?? (step.type === 'exercise' && step.mode === 'free' ? false : settings.showNoteNames);

  const { session, snapshot } = usePlaySession(
    {
      piece,
      mode,
      tempoScale: s.tempoScale ?? 1,
      metronome: s.metronome ?? false,
      guided: hints,
      hands: s.hands ?? 'both',
      naming: settings.noteNaming,
      scoring: s.scoring,
      loop: s.loop,
      inputKind: settings.inputMode ?? 'virtual',
    },
    `${step.id}-${mode}-${attempt}`,
    (r, sess) => {
      if (listening) {
        setPhase('ready');
        return;
      }
      if (!r) return;
      setResult(r);
      setPhase('result');
      void addPracticeTime(sess.practiceMs);
      void recordAttempt(r, {
        lessonId,
        stepId: step.id,
        inputMode: settings.inputMode ?? 'virtual',
        tempoScale: sess.config.tempoScale,
        startedAt: startedAt.current,
        practiceMs: sess.practiceMs,
      }).catch(console.warn);
    },
  );

  useEffect(() => {
    if (session && pendingStart.current) {
      pendingStart.current = false;
      session.start();
    }
  }, [session]);

  if (!session || !snapshot) return null;
  const copy = introCopy(step, piece.title);

  const begin = async (listenFirst: boolean) => {
    await ensureAudio();
    startedAt.current = Date.now();
    setPhase(listenFirst ? 'listen' : 'play');
    // la sessione viene ricreata dal cambio di modalità: avvio al prossimo frame
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid="play"]')?.click()));
  };

  const retry = () => {
    setResult(null);
    setAttempt((a) => a + 1);
    setPhase('ready');
  };

  let overlay: React.ReactNode = null;
  if (phase === 'intro' || phase === 'ready')
    overlay = (
      <div className="intro-card" data-testid="step-intro">
        <h2>{phase === 'ready' ? '🎹 Ora tocca a te!' : copy.title}</h2>
        <p>{phase === 'ready' ? (s.flow === 'wait' ? 'Ti aspetto su ogni nota.' : 'Segui il conteggio e suona a tempo.') : copy.text}</p>
        <div className="result__actions">
          {phase === 'intro' && s.listenFirst && (
            <button className="btn btn--primary" onClick={() => begin(true)} data-testid="listen-first">
              🔊 Ascolta
            </button>
          )}
          <button className={`btn${phase === 'intro' && s.listenFirst ? '' : ' btn--primary'}`} onClick={() => begin(false)} data-testid="start-step">
            ▶ {phase === 'intro' && s.listenFirst ? 'Suona subito' : 'Inizia'}
          </button>
        </div>
      </div>
    );
  if (phase === 'result' && result)
    overlay = <ResultCard result={result} naming={settings.noteNaming} onRetry={retry} onContinue={() => onDone(result.stars)} />;

  return <PlayView session={session} snapshot={snapshot} showNoteNames={showNames} overlay={overlay} />;
}
