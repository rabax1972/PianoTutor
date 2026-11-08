import { useInstallPrompt } from '../../app/useInstallPrompt';
import { t } from '../../i18n/it';
import { Tile } from '../../ui/components';

export function HomePage() {
  const install = useInstallPrompt();

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

      {install.showIosHint && <div className="banner">📲 {t.home.installIos}</div>}

      <div className="tiles">
        <Tile icon="🗺️" title={t.home.course} desc={t.home.courseDesc} to="/percorso" testId="tile-course" hero />
        <Tile icon="🎼" title={t.home.songs} desc={t.home.songsDesc} to="/brani" testId="tile-songs" />
        <Tile icon="🎹" title={t.home.freePlay} desc={t.home.freePlayDesc} to="/suona" testId="tile-free-play" />
        <Tile icon="⚙️" title={t.home.settings} desc="Note, testo, contrasto, volume" to="/impostazioni" />
        <Tile icon="🩺" title={t.home.diagnostics} desc="Latenza audio e del tocco" to="/diagnostica" />
        <Tile icon="ℹ️" title={t.home.about} desc="Crediti e licenze" to="/info" />
      </div>
    </main>
  );
}
