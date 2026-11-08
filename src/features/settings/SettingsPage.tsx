import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { t } from '../../i18n/it';
import { storage, DEFAULT_SETTINGS } from '../../storage';
import { downloadIcs, notificationsSupported, requestNotificationPermission } from '../progress/reminders';
import { pushToast } from '../progress/toasts';
import { Row, Segmented, Switch, TopBar } from '../../ui/components';

const INPUT_LABEL = { virtual: '📱 Schermo', midi: '🎹 MIDI', mic: '🎤 Microfono' } as const;

export function SettingsPage() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();

  const reset = async () => {
    if (!window.confirm(t.settings.resetConfirm)) return;
    await storage.clearAll();
    useSettings.setState({ settings: DEFAULT_SETTINGS });
    navigate('/benvenuto', { replace: true });
  };

  return (
    <main className="page">
      <TopBar title={t.settings.title} />

      <section className="page-section">
        <h2>Gioco</h2>
        <Row label={t.settings.input} desc={settings.inputMode ? INPUT_LABEL[settings.inputMode] : '—'}>
          <button className="btn" onClick={() => navigate('/benvenuto')}>
            Cambia
          </button>
        </Row>
        {settings.inputMode === 'mic' && (
          <>
            <Row
              label="Microfono"
              desc={settings.mic.calibratedAt ? `Calibrato il ${new Date(settings.mic.calibratedAt).toLocaleDateString('it-IT')}` : 'Non ancora calibrato'}
            >
              <button className="btn" onClick={() => navigate('/microfono')}>
                Calibra
              </button>
            </Row>
            <Row label="Sensibilità del microfono" desc="Aumentala se alcune note non vengono sentite; riducila se senti note “fantasma”.">
              <input
                type="range"
                min={4}
                max={24}
                step={1}
                // più a destra = più sensibile = margine più basso
                value={28 - settings.mic.gateMarginDb}
                aria-label="Sensibilità del microfono"
                onChange={(e) => update({ mic: { ...settings.mic, gateMarginDb: 28 - Number(e.target.value) } })}
              />
            </Row>
          </>
        )}
        {settings.inputMode === 'midi' && (
          <>
            <Row label="Tastiera MIDI" desc="Dispositivo, prova dei tasti">
              <button className="btn" onClick={() => navigate('/midi')}>
                Configura
              </button>
            </Row>
            <Row label="Suona dal tablet" desc="Attivalo se la tua tastiera non ha altoparlanti.">
              <Switch
                label="Suona dal tablet"
                checked={settings.midi.playSound}
                onChange={(v) => update({ midi: { ...settings.midi, playSound: v } })}
              />
            </Row>
          </>
        )}
        <Row label={t.settings.naming}>
          <Segmented
            label={t.settings.naming}
            value={settings.noteNaming}
            onChange={(v) => update({ noteNaming: v })}
            options={[
              { value: 'italian', label: t.settings.namingIt },
              { value: 'english', label: t.settings.namingEn },
            ]}
          />
        </Row>
        <Row label={t.settings.showNames}>
          <Switch label={t.settings.showNames} checked={settings.showNoteNames} onChange={(v) => update({ showNoteNames: v })} />
        </Row>
        <Row label={t.settings.colorNotes} desc={t.settings.colorNotesDesc}>
          <Switch label={t.settings.colorNotes} checked={settings.colorNotes} onChange={(v) => update({ colorNotes: v })} />
        </Row>
        <Row label={t.settings.volume}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            aria-label={t.settings.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </Row>
      </section>

      <section className="page-section">
        <h2>Obiettivo e promemoria</h2>
        <Row label="Obiettivo giornaliero" desc="Minuti di pratica al giorno: bastano pochi minuti, ma tutti i giorni.">
          <Segmented
            label="Obiettivo giornaliero"
            value={settings.dailyGoalMin}
            onChange={(v) => update({ dailyGoalMin: v })}
            options={[5, 10, 15, 20, 30].map((v) => ({ value: v, label: `${v} min` }))}
          />
        </Row>
        <Row label="Promemoria quotidiano" desc="Un avviso all’ora scelta se oggi non hai ancora suonato.">
          <Switch
            label="Promemoria quotidiano"
            checked={settings.reminder.enabled}
            onChange={async (v) => {
              update({ reminder: { ...settings.reminder, enabled: v } });
              if (v && notificationsSupported()) {
                const p = await requestNotificationPermission();
                if (p === 'denied') pushToast({ icon: '🔕', title: 'Notifiche bloccate', text: 'Vedrai l’avviso nell’app. Per le notifiche, consentile nelle impostazioni del browser.' });
              }
            }}
          />
        </Row>
        {settings.reminder.enabled && (
          <>
            <Row label="Ora del promemoria">
              <input
                type="time"
                className="time-input"
                value={settings.reminder.time}
                aria-label="Ora del promemoria"
                onChange={(e) => e.target.value && update({ reminder: { ...settings.reminder, time: e.target.value } })}
              />
            </Row>
            <Row
              label="Aggiungi al calendario"
              desc="Il modo più affidabile, anche su iPad: un evento ripetuto ogni giorno nel calendario del dispositivo. Le notifiche dell’app arrivano solo mentre l’app è aperta."
            >
              <button className="btn" onClick={() => downloadIcs(settings.reminder.time, settings.dailyGoalMin)} data-testid="download-ics">
                📅 Scarica evento
              </button>
            </Row>
          </>
        )}
      </section>

      <section className="page-section">
        <h2>Accessibilità</h2>
        <Row label={t.settings.fontSize}>
          <Segmented
            label={t.settings.fontSize}
            value={settings.fontScale}
            onChange={(v) => update({ fontScale: v })}
            options={[
              { value: 0.9, label: 'A−' },
              { value: 1, label: 'A' },
              { value: 1.2, label: 'A+' },
              { value: 1.4, label: 'A++' },
            ]}
          />
        </Row>
        <Row label={t.settings.highContrast}>
          <Switch label={t.settings.highContrast} checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
        </Row>
      </section>

      <section className="page-section">
        <h2>Insegnante</h2>
        <Row label="Sblocca tutte le lezioni" desc="Per insegnanti e genitori: apre tutto il percorso senza dover completare le lezioni in ordine.">
          <Switch label="Sblocca tutte le lezioni" checked={settings.unlockAll} onChange={(v) => update({ unlockAll: v })} />
        </Row>
      </section>

      <section className="page-section">
        <h2>Dati</h2>
        <Row label={t.settings.reset} desc="Progressi, statistiche e impostazioni salvati su questo dispositivo.">
          <button className="btn btn--danger" onClick={reset}>
            Cancella
          </button>
        </Row>
      </section>
    </main>
  );
}
