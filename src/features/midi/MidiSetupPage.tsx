import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { ensureAudio } from '../../audio/ensureAudio';
import { noteLabel } from '../../core/music/pitch';
import { useActiveInput, useMidiState } from '../../input/activeInput';
import { inputHub } from '../../input/inputHub';
import { midiInput } from '../../input/midi/midiInstance';
import { Row, Switch, TopBar } from '../../ui/components';
import '../mic/mic.css';
import './midi.css';

/** Configurazione della tastiera MIDI: dispositivi, prova dei tasti, suono dal tablet. */
export function MidiSetupPage() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  useActiveInput('midi');
  const midi = useMidiState();
  const [last, setLast] = useState<{ midi: number; velocity: number } | null>(null);

  useEffect(
    () =>
      inputHub.subscribe((e) => {
        if (e.source === 'midi' && e.type === 'on') setLast({ midi: e.midi, velocity: e.velocity });
      }),
    [],
  );

  const devices = midiInput.devices;
  const connected = devices.filter((d) => d.connected);
  const unsupported = midi.state === 'unsupported';

  return (
    <main className="page calib">
      <TopBar title="Tastiera MIDI" backTo="/" />

      {(midi.state === 'denied' || midi.state === 'error' || unsupported) && (
        <div className="banner banner--warn mic-banner" role="alert" data-testid="midi-error">
          <span>⚠️ {midi.message || 'Web MIDI non disponibile.'}</span>
          <button
            className="btn"
            onClick={() => {
              update({ inputMode: 'virtual' });
              navigate('/');
            }}
          >
            Usa la tastiera a schermo
          </button>
        </div>
      )}

      {!unsupported && (
        <section className="calib__card" data-testid="midi-setup">
          <h2>🎹 Collega la tua tastiera</h2>
          <p>
            Collega la tastiera con il cavo <strong>USB</strong> (su tablet serve un adattatore USB-C/OTG) oppure via{' '}
            <strong>Bluetooth MIDI</strong>. Si collega da sola: non serve ricaricare la pagina.
          </p>

          {midi.state === 'starting' && <p className="muted">Cerco i dispositivi…</p>}
          {midi.state === 'on' && connected.length === 0 && (
            <div className="banner" data-testid="midi-none">
              🔌 Nessuna tastiera collegata. Accendila e collegala: comparirà qui.
              <span className="muted">Bluetooth: su Android associala prima dalle impostazioni Bluetooth del sistema.</span>
            </div>
          )}

          {devices.length > 0 && (
            <div className="midi-devices" role="radiogroup" aria-label="Dispositivo MIDI">
              <button
                role="radio"
                aria-checked={settings.midi.deviceId === null}
                className={`midi-device${settings.midi.deviceId === null ? ' is-on' : ''}`}
                onClick={() => update({ midi: { ...settings.midi, deviceId: null } })}
              >
                <span>Tutti i dispositivi collegati</span>
                <span className="muted">{connected.length === 1 ? '1 collegato' : `${connected.length} collegati`}</span>
              </button>
              {devices.map((d) => (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={settings.midi.deviceId === d.id}
                  className={`midi-device${settings.midi.deviceId === d.id ? ' is-on' : ''}`}
                  onClick={() => update({ midi: { ...settings.midi, deviceId: d.id } })}
                  data-testid="midi-device"
                >
                  <span>
                    <span className={`midi-dot${d.connected ? ' is-connected' : ''}`} aria-hidden />
                    {d.name}
                  </span>
                  <span className="muted">{d.connected ? d.manufacturer || 'collegata' : 'scollegata'}</span>
                </button>
              ))}
            </div>
          )}

          <div className="midi-test" aria-live="polite">
            <span className="muted">Prova: premi un tasto</span>
            <div className="calib__big" data-testid="midi-last-note">
              {last ? noteLabel(last.midi, settings.noteNaming, { octave: true }) : '—'}
            </div>
            {last && (
              <div className="progress" style={{ maxWidth: 260 }} aria-label="Intensità">
                <div style={{ width: `${Math.round(last.velocity * 100)}%` }} />
              </div>
            )}
          </div>

          <Row label="La tua tastiera ha gli altoparlanti?" desc="Se non senti nessun suono quando premi i tasti, fai suonare il tablet.">
            <div className="midi-sound">
              <span className="muted">Suona dal tablet</span>
              <Switch
                label="Suona dal tablet"
                checked={settings.midi.playSound}
                onChange={(v) => {
                  void ensureAudio();
                  update({ midi: { ...settings.midi, playSound: v } });
                }}
              />
            </div>
          </Row>

          <div className="calib__actions">
            <button className="btn btn--primary" onClick={() => navigate('/')} data-testid="midi-done">
              {connected.length ? 'Inizia a suonare →' : 'Continua →'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
