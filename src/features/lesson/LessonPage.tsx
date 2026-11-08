import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getLesson, nextLessonId } from '../../core/content/loader';
import type { Lesson } from '../../core/content/schema';
import type { LessonProgress } from '../../storage';
import { Stars } from '../../ui/Stars';
import { ExplainStep } from './ExplainStep';
import { PlayStep } from './PlayStep';
import { completeStep } from './progress';
import './lesson.css';

export function LessonPage() {
  const { id } = useParams();
  const lesson = id ? getLesson(id) : undefined;
  if (!lesson) return <Navigate to="/percorso" replace />;
  return <LessonRunner key={lesson.id} lesson={lesson} />;
}

const STEP_LABEL = { explain: 'Spiegazione', exercise: 'Esercizio', song: 'Brano' } as const;

function LessonRunner({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [lastStars, setLastStars] = useState<Record<string, number>>({});
  const finished = index >= lesson.steps.length;
  const step = lesson.steps[index];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  const done = async (stars?: number) => {
    if (step) {
      if (stars !== undefined) setLastStars((m) => ({ ...m, [step.id]: stars }));
      const p = await completeStep(lesson, step.id, stars).catch((e) => {
        console.warn(e);
        return null;
      });
      if (p) setProgress(p);
    }
    setIndex((i) => i + 1);
  };

  const next = nextLessonId(lesson.id);

  return (
    <main className="page page--full lesson">
      <header className="topbar lesson__top">
        <button className="btn btn--icon" aria-label="Chiudi la lezione" onClick={() => navigate('/percorso')}>
          ✕
        </button>
        <div className="lesson__title">
          <h1>{lesson.title}</h1>
          {step && (
            <span className="muted">
              {STEP_LABEL[step.type]} · {index + 1} di {lesson.steps.length}
            </span>
          )}
        </div>
        <div className="lesson__steps" aria-hidden>
          {lesson.steps.map((s, i) => (
            <span key={s.id} className={i < index ? 'is-done' : i === index ? 'is-on' : ''} />
          ))}
        </div>
      </header>

      {step?.type === 'explain' && <ExplainStep key={step.id} step={step} onDone={() => done()} />}
      {(step?.type === 'exercise' || step?.type === 'song') && (
        <PlayStep key={step.id} lessonId={lesson.id} step={step} onDone={(stars) => done(stars)} />
      )}

      {finished && (
        <div className="lesson__finish" data-testid="lesson-complete">
          <div className="intro-card">
            <h2>🎉 Lezione completata!</h2>
            <Stars value={progress?.bestStars ?? 0} size="lg" animate />
            <p>
              {lesson.steps
                .filter((s) => s.type !== 'explain')
                .map((s) => `${STEP_LABEL[s.type]}: ${'★'.repeat(lastStars[s.id] ?? 0) || '—'}`)
                .join(' · ')}
            </p>
            <p className="muted">Ogni giorno un pochino: è così che si impara il pianoforte.</p>
            <div className="result__actions">
              <button className="btn" onClick={() => navigate('/percorso')}>
                Torna al percorso
              </button>
              {next && (
                <button className="btn btn--primary" onClick={() => navigate(`/lezione/${next}`)}>
                  Prossima lezione →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
