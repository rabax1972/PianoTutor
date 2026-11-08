import { useEffect, useState } from 'react';
import { getCourse, getLesson } from '../../core/content/loader';
import { storage, type LessonProgress } from '../../storage';
import { Tile, TopBar } from '../../ui/components';
import '../lesson/lesson.css';

/** Percorso (versione M3: elenco con sblocco sequenziale; mappa completa in M6). */
export function CoursePage() {
  const course = getCourse();
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());

  useEffect(() => {
    storage.progress
      .listLessons()
      .then((list) => setProgress(new Map(list.map((p) => [p.lessonId, p]))))
      .catch(console.warn);
  }, []);

  const order = course.units.flatMap((u) => u.lessons);
  const unlocked = (id: string) => {
    const i = order.indexOf(id);
    return i <= 0 || (progress.get(order[i - 1]!)?.completed ?? false);
  };

  return (
    <main className="page">
      <TopBar title={course.title} />
      {course.units.map((u) => (
        <section key={u.id} className="unit">
          <div className="unit__head">
            <span className="unit__icon" aria-hidden>
              {u.icon}
            </span>
            <div>
              <h2>{u.title}</h2>
              <span className="muted">{u.description}</span>
            </div>
          </div>
          <div className="tiles">
            {u.lessons.map((id) => {
              const l = getLesson(id);
              if (!l) return null;
              const p = progress.get(id);
              const open = unlocked(id);
              return (
                <Tile
                  key={id}
                  testId={`lesson-${id}`}
                  icon={p?.completed ? '✅' : open ? '▶️' : '🔒'}
                  title={l.title}
                  desc={`${l.summary} · ${l.estimatedMinutes} min`}
                  to={open ? `/lezione/${id}` : undefined}
                  disabled={!open}
                  tag={p?.completed ? '★'.repeat(p.bestStars) || 'Fatta' : undefined}
                  hero={open && !p?.completed}
                />
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
