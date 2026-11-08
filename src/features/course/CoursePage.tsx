import { Link } from 'react-router-dom';
import { getCourse, getLesson } from '../../core/content/loader';
import { isLessonUnlocked, isPassed, isUnitUnlocked, unitStats } from '../../core/progress/unlock';
import { useProgressSummary } from '../progress/summary';
import { useSettings } from '../../app/settingsStore';
import { TopBar } from '../../ui/components';
import { Stars } from '../../ui/Stars';
import './course.css';

/** Mappa del percorso: unità e lezioni con sblocco progressivo (almeno 1 stella per proseguire). */
export function CoursePage() {
  const course = getCourse();
  const s = useProgressSummary();
  const progress = s?.progressMap ?? new Map();
  const unlockAll = useSettings((st) => st.settings.unlockAll);

  return (
    <main className="page">
      <TopBar title={course.title} />
      {course.units.map((u, ui) => {
        const open = unlockAll || isUnitUnlocked(course, u.id, progress);
        const st = unitStats(course, u.id, progress);
        const prev = course.units[ui - 1];
        return (
          <section key={u.id} className={`unit${open ? '' : ' is-locked'}`} data-testid={`unit-${u.id}`}>
            <header className="unit__head">
              <span className="unit__icon" aria-hidden>
                {open ? u.icon : '🔒'}
              </span>
              <div className="unit__info">
                <h2>
                  Unità {ui + 1} · {u.title}
                </h2>
                <span className="muted">
                  {open ? u.description : `Completa l’unità «${prev?.title}» per sbloccarla.`}
                </span>
              </div>
              <div className="unit__stats" aria-label={`${st.passed} lezioni su ${st.total}, ${st.stars} stelle`}>
                <strong>
                  {st.passed}/{st.total}
                </strong>
                <span className="muted">★ {st.stars}</span>
              </div>
            </header>

            <ol className="path">
              {u.lessons.map((id, li) => {
                const l = getLesson(id);
                if (!l) return null;
                const p = progress.get(id);
                const unlocked = s !== null && (unlockAll || isLessonUnlocked(course, id, progress));
                const passed = isPassed(p);
                const current = unlocked && !passed && s?.next === id;
                const node = (
                  <>
                    <span className="path__node" aria-hidden>
                      {passed ? '✓' : unlocked ? li + 1 : '🔒'}
                    </span>
                    <span className="path__text">
                      <strong>{l.title}</strong>
                      <span className="muted">
                        {l.summary} · {l.estimatedMinutes} min
                      </span>
                      {p?.completed && <Stars value={p.bestStars} size="sm" />}
                    </span>
                  </>
                );
                const cls = `path__item${passed ? ' is-passed' : ''}${current ? ' is-current' : ''}${unlocked ? '' : ' is-locked'}${li % 2 ? ' is-right' : ''}`;
                return (
                  <li key={id} className={cls}>
                    {unlocked ? (
                      <Link to={`/lezione/${id}`} className="path__link" data-testid={`lesson-${id}`}>
                        {node}
                      </Link>
                    ) : (
                      <div className="path__link" aria-disabled="true" data-testid={`lesson-${id}`}>
                        {node}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
