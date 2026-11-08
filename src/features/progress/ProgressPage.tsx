import { getBadges, getCourse, getLesson } from '../../core/content/loader';
import { badgeProgress } from '../../core/progress/badges';
import { mostMissedNotes, recentAccuracy } from '../../core/progress/stats';
import { lastDays } from '../../core/progress/streak';
import { isPassed } from '../../core/progress/unlock';
import { noteLabel } from '../../core/music/pitch';
import { useSettings } from '../../app/settingsStore';
import { TopBar } from '../../ui/components';
import { BarChart } from './BarChart';
import { GoalRing } from './GoalRing';
import { useProgressSummary } from './summary';
import './progress.css';

const WEEKDAY = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

export function formatMinutes(min: number): string {
  if (min < 1) return min > 0 ? '< 1 min' : '0 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function ProgressPage() {
  const s = useProgressSummary();
  const { settings } = useSettings();
  const course = getCourse();

  if (!s) return <main className="page"><TopBar title="I tuoi progressi" /></main>;

  const week = lastDays(s.days, s.today, 7).map((d) => {
    const date = fmtDate(d.date);
    return {
      label: d.date === s.today ? 'oggi' : WEEKDAY[date.getDay()]!,
      fullLabel: date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
      value: d.minutes,
      display: formatMinutes(d.minutes),
    };
  });
  const lessonTitle = (id: string, step: string) => {
    if (id.startsWith('brano:')) return `Brano · ${id.slice(6)}`;
    const l = getLesson(id);
    const stepName = step === 'guidato' ? 'esercizio guidato' : step === 'libero' ? 'esercizio libero' : step === 'brano' ? 'brano' : step;
    return l ? `${l.title} · ${stepName}` : id;
  };
  const sessions = recentAccuracy(s.attempts, 10).map((a, i, arr) => ({
    label: String(i + 1 - arr.length === 0 ? 'ultima' : i + 1),
    fullLabel: `${lessonTitle(a.lessonId, a.stepId)} — ${new Date(a.startedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
    value: a.accuracy * 100,
    display: `${Math.round(a.accuracy * 100)}%`,
  }));
  const missed = mostMissedNotes(s.attempts, 5);
  const passed = course.units.flatMap((u) => u.lessons).filter((id) => isPassed(s.progressMap.get(id))).length;
  const totalLessons = course.units.flatMap((u) => u.lessons).length;
  const stars = [...s.lessons.values()].reduce((n, l) => n + l.bestStars, 0);
  const avg = s.attempts.length ? s.attempts.reduce((n, a) => n + a.pitchAccuracy, 0) / s.attempts.length : 0;
  const earned = new Map(s.earned.map((e) => [e.badgeId, e]));
  const badges = getBadges();

  return (
    <main className="page progress-page">
      <TopBar title="I tuoi progressi" />

      <section className="stat-tiles">
        <div className="stat-tile stat-tile--goal">
          <GoalRing ratio={s.goal.ratio} size={92} />
          <div>
            <div className="stat-tile__value" data-testid="today-minutes">
              {formatMinutes(s.goal.minutes)}
            </div>
            <div className="stat-tile__label">oggi · obiettivo {settings.dailyGoalMin} min</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value" data-testid="streak">
            🔥 {s.streak.current} {s.streak.current === 1 ? 'giorno' : 'giorni'}
          </div>
          <div className="stat-tile__label">di fila · record {s.streak.best}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value">{formatMinutes(s.totalMinutes)}</div>
          <div className="stat-tile__label">di pratica in totale</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value" data-testid="lessons-passed">
            {passed}/{totalLessons}
          </div>
          <div className="stat-tile__label">lezioni superate · ★ {stars}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__value">{s.attempts.length ? `${Math.round(avg * 100)}%` : '—'}</div>
          <div className="stat-tile__label">precisione media · {s.attempts.length} esercizi</div>
        </div>
      </section>

      <section className="charts">
        <BarChart
          title="Minuti di pratica · ultimi 7 giorni"
          data={week}
          max={Math.max(...week.map((d) => d.value), 1)}
          reference={{ value: settings.dailyGoalMin, label: `obiettivo ${settings.dailyGoalMin} min` }}
          testId="chart-week"
        />
        {sessions.length > 0 ? (
          <BarChart title="Note giuste · ultime sessioni" data={sessions} max={100} testId="chart-accuracy" />
        ) : (
          <div className="chart chart--empty">
            <div className="chart__title">Note giuste · ultime sessioni</div>
            <p className="muted">Completa un esercizio per vedere qui la tua precisione.</p>
          </div>
        )}
      </section>

      <section className="page-section">
        <h2>Note da ripassare</h2>
        {missed.length ? (
          <div className="missed" data-testid="missed-notes">
            {missed.map((m) => (
              <div key={m.midi} className="missed__item">
                <span className="missed__note">{noteLabel(m.midi, settings.noteNaming, { octave: true })}</span>
                <span className="muted">
                  {m.misses} {m.misses === 1 ? 'errore' : 'errori'} su {m.total}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Nessuna nota difficile per ora. Continua così! 👏
          </p>
        )}
      </section>

      <section className="page-section">
        <h2>
          Badge · {s.earned.length}/{badges.length}
        </h2>
        <div className="badges" data-testid="badges">
          {badges.map((b) => {
            const e = earned.get(b.id);
            const p = badgeProgress(b.criterion, s.stats);
            return (
              <div key={b.id} className={`badge${e ? ' is-earned' : ''}`} data-testid={`badge-${b.id}`} aria-label={`${b.title}${e ? ', ottenuto' : ', da ottenere'}`}>
                <span className="badge__icon" aria-hidden>
                  {e ? b.icon : '🔒'}
                </span>
                <strong>{b.title}</strong>
                <span className="muted badge__desc">{b.description}</span>
                {e ? (
                  <span className="badge__date">{new Date(e.earnedAt).toLocaleDateString('it-IT')}</span>
                ) : (
                  p > 0 && (
                    <div className="progress badge__progress" aria-label={`${Math.round(p * 100)}%`}>
                      <div style={{ width: `${p * 100}%` }} />
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
