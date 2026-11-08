import { useEffect, useState } from 'react';
import { useSamplerState } from '../../app/hooks';
import { isStandalone } from '../../app/useInstallPrompt';
import { audioEngine } from '../../audio/AudioEngine';
import { ensureAudio } from '../../audio/ensureAudio';
import { sampler } from '../../audio/Sampler';
import { t } from '../../i18n/it';
import { isMicSupported, isWebMidiSupported } from '../../input/availability';
import { TopBar } from '../../ui/components';
import { touchDelayStats } from './metrics';
import { useSettings } from '../../app/settingsStore';
import { useActiveInput } from '../../input/activeInput';
import { micInput } from '../../input/mic/MicInput';
import { MicMeter } from '../mic/MicMeter';
import { Link } from 'react-router-dom';
import { Row } from '../../ui/components';

const ms = (s: number) => `${(s * 1000).toFixed(1)} ms`;

export function DiagnosticsPage() {
  const [, setTick] = useState(0);
  const { settings, update } = useSettings();
  const input = useActiveInput();
  useSamplerState();

  // aggiorna periodicamente i valori misurati
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const info = audioEngine.latencyInfo();
  const touch = touchDelayStats();
  const estTotal = touch.avg / 1000 + info.baseLatency + info.outputLatency;
  const swActive = !!navigator.serviceWorker?.controller;

  const testSound = async () => {
    await ensureAudio();
    sampler.noteOn(60, 0.8);
    setTimeout(() => sampler.noteOff(60), 600);
  };

  return (
    <main className="page">
      <TopBar
        title={t.diagnostics.title}
        actions={
          <button className="btn btn--primary" onClick={testSound}>
            🔊 Prova suono
          </button>
        }
      />

      <section className="page-section">
        <h2>Audio</h2>
        <dl className="kv">
          <dt>Stato</dt>
          <dd>{info.state === 'running' ? '✅ attivo' : info.state === 'uninitialized' ? 'non avviato (tocca lo schermo)' : info.state}</dd>
          <dt>Frequenza di campionamento</dt>
          <dd>{info.sampleRate ? `${info.sampleRate} Hz` : '—'}</dd>
          <dt>Latenza di elaborazione</dt>
          <dd>{ms(info.baseLatency)}</dd>
          <dt>Latenza di uscita</dt>
          <dd>{info.outputLatency ? ms(info.outputLatency) : 'non esposta dal browser'}</dd>
          <dt>Campioni pianoforte</dt>
          <dd>
            {sampler.loaded}/{sampler.total} ({sampler.state})
          </dd>
        </dl>
      </section>

      {input.mode === 'mic' && (
        <section className="page-section">
          <h2>Microfono</h2>
          <div className="row">
            <MicMeter />
          </div>
          <dl className="kv">
            <dt>Stato</dt>
            <dd>{input.mic.state === 'on' ? '✅ in ascolto' : input.mic.state === 'starting' ? 'avvio…' : input.mic.message || input.mic.state}</dd>
            <dt>Rumore di fondo</dt>
            <dd>{settings.mic.noiseFloorDb !== null ? `${settings.mic.noiseFloorDb} dB` : 'non calibrato (valore standard)'}</dd>
            <dt>Soglia di ascolto</dt>
            <dd>{micInput.trackerConfig ? `${Math.round(((micInput.trackerConfig.noiseFloorDb ?? -58) + micInput.trackerConfig.gateMarginDb) * 10) / 10} dB` : '—'}</dd>
            <dt>Diapason</dt>
            <dd>La = {settings.a4Hz.toLocaleString('it-IT')} Hz</dd>
            <dt>Finestra di analisi</dt>
            <dd>{micInput.trackerConfig ? `${Math.round((micInput.trackerConfig.windowSize / micInput.trackerConfig.sampleRate) * 1000)} ms` : '—'}</dd>
          </dl>
          <Link className="btn" to="/microfono">
            Calibra il microfono
          </Link>
        </section>
      )}

      <section className="page-section">
        <h2>Calibrazione manuale della latenza</h2>
        <p className="muted" style={{ margin: 0 }}>
          Se le note risultano sempre “in ritardo” anche quando suoni a tempo, aumenta il valore della tua modalità; se risultano “in anticipo”, diminuiscilo.
        </p>
        {(
          [
            ['mic', 'Microfono', 0, 300],
            ['midi', 'Tastiera MIDI', 0, 150],
            ['virtual', 'Tastiera a schermo', 0, 150],
          ] as const
        ).map(([k, label, min, max]) => (
          <Row key={k} label={`${label}: ${settings.latency[k]} ms`}>
            <input
              type="range"
              min={min}
              max={max}
              step={5}
              value={settings.latency[k]}
              aria-label={`Latenza ${label}`}
              onChange={(e) => update({ latency: { ...settings.latency, [k]: Number(e.target.value) } })}
            />
          </Row>
        ))}
      </section>

      <section className="page-section">
        <h2>Tastiera a schermo</h2>
        <dl className="kv">
          <dt>Ritardo del tocco (media)</dt>
          <dd>{touch.count ? `${touch.avg.toFixed(1)} ms (max ${touch.max.toFixed(1)} ms, ${touch.count} tocchi)` : 'suona qualche nota nella Tastiera libera'}</dd>
          <dt>Tocco → suono (stima)</dt>
          <dd>{touch.count ? ms(estTotal) : '—'}</dd>
        </dl>
        <p className="muted" style={{ margin: 0 }}>
          Sotto i 30 ms la risposta è percepita come immediata; fino a 50 ms è comunque buona per imparare.
        </p>
      </section>

      <section className="page-section">
        <h2>Dispositivo</h2>
        <dl className="kv">
          <dt>Connessione sicura (HTTPS)</dt>
          <dd>{window.isSecureContext ? '✅' : '❌ microfono e offline non disponibili'}</dd>
          <dt>App installata</dt>
          <dd>{isStandalone() ? '✅' : 'no (aperta nel browser)'}</dd>
          <dt>Funzionamento offline</dt>
          <dd>{swActive ? '✅ pronto' : 'in preparazione (ricarica la pagina)'}</dd>
          <dt>Web MIDI</dt>
          <dd>{isWebMidiSupported() ? '✅ supportato' : '❌ non supportato'}</dd>
          <dt>Microfono</dt>
          <dd>{isMicSupported() ? '✅ supportato' : '❌ non disponibile'}</dd>
          <dt>Tocco multiplo</dt>
          <dd>{navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} punti` : 'nessuno (mouse)'}</dd>
          <dt>Browser</dt>
          <dd style={{ fontWeight: 400, fontSize: '0.85rem' }}>{navigator.userAgent}</dd>
        </dl>
      </section>
    </main>
  );
}
