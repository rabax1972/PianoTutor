import { Link } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { useInstallPrompt } from '../../app/useInstallPrompt';
import { getLesson } from '../../core/content/loader';
import { t } from '../../i18n/it';
import { GoalRing } from '../progress/GoalRing';
import { formatMinutes } from '../progress/ProgressPage';
import { isReminderDue } from '../progress/reminders';
import { useProgressSummary } from '../progress/summary';
import { Tile } from '../../ui/components';
import './home.css';

export function HomePage() {
  const install = useInstallPrompt();
  const settings = useSettings((s) => s.settings);
  const s = useProgressSummary();
  const next = s?.next ? getLesson(s.next) : undefined;
  const reminderDue = settings.reminder.enabled && s && !s.streak.practicedToday && isReminderDue(settings.reminder.time);

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="topbar__title">🎹 {t.appName}</h1>
        {install.canPrompt && !install.installed && (
          <button className="btn btn--primary" onClick={install.prompt}>
            {t.home.install}
          </button>
        )}
      </header>

      <p style={{ fontSize: '1.3rem', margin: 0 }}>{t.home.greeting}</p>

      {s && (
        <section className="home-status">
          <Link to="/progressi" className="home-goal" data-testid="home-goal">
            <GoalRing ratio={s.goal.ratio} size={76} />
            <div>
              <strong>{s.goal.reached ? 'Obiettivo raggiunto!' : 'Obiettivo di oggi'}</strong>
              <span className="muted">
                {formatMinutes(s.goal.minutes)} di {settings.dailyGoalMin} min
              </span>
            </div>
          </Link>
          <Link to="/progressi" className="home-streak" data-testid="home-streak">
            <span className="home-streak__flame" aria-hidden>
              {s.streak.current > 0 ? '🔥' : '🌱'}
            </span>
            <div>
              <strong>
                {s.streak.current} {s.streak.current === 1 ? 'giorno' : 'giorni'} di fila
              </strong>
              <span className="muted">
                {s.streak.practicedToday
                  ? 'Oggi hai già suonato 👏'
                  : s.streak.current > 0
                    ? 'Suona oggi per non interromperla!'
                    : 'Inizia oggi la tua serie!'}
              </span>
            </div>
          </Link>
        </section>
      )}

      {reminderDue && (
        <div className="banner" data-testid="reminder-banner">
          ⏰ È l’ora del pianoforte! Bastano pochi minuti.
        </div>
      )}
      {settings.inputMode === 'mic' && !settings.mic.calibratedAt && (
        <div className="banner">
          🎤 Per sentirti al meglio, calibra il microfono (1 minuto).
          <Link className="btn btn--primary" to="/microfono" data-testid="home-calibrate">
            Calibra
          </Link>
        </div>
      )}
      {install.showIosHint && <div className="banner">📲 {t.home.installIos}</div>}

      <div className="tiles">
        {next ? (
          <Tile
            icon="▶️"
            title={`Continua: ${next.title}`}
            desc={`${next.summary} · ${next.estimatedMinutes} min`}
            to={`/lezione/${next.id}`}
            testId="tile-continue"
            hero
          />
        ) : (
          s && <Tile icon="🏆" title="Percorso completato!" desc="Ripassa le lezioni per migliorare le stelle." to="/percorso" hero />
        )}
        <Tile icon="🗺️" title={t.home.course} desc={t.home.courseDesc} to="/percorso" testId="tile-course" />
        <Tile icon="📈" title="I tuoi progressi" desc="Statistiche, note da ripassare, badge" to="/progressi" testId="tile-progress" />
        <Tile icon="🎼" title={t.home.songs} desc={t.home.songsDesc} to="/brani" testId="tile-songs" />
        <Tile icon="🎹" title={t.home.freePlay} desc={t.home.freePlayDesc} to="/suona" testId="tile-free-play" />
        <Tile icon="⚙️" title={t.home.settings} desc="Obiettivo, promemoria, note, accessibilità" to="/impostazioni" />
        <Tile icon="🩺" title={t.home.diagnostics} desc="Latenza audio e del tocco" to="/diagnostica" />
        <Tile icon="ℹ️" title={t.home.about} desc="Crediti e licenze" to="/info" />
      </div>
    </main>
  );
}
