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

const ms = (s: number) => `${(s * 1000).toFixed(1)} ms`;

export function DiagnosticsPage() {
  const [, setTick] = useState(0);
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

      <section className="page-section">
        <h2>Tastiera a schermo</h2>
        <dl className="kv">
          <dt>Ritardo del tocco (media)</dt>
          <dd>{touch.count ? `${touch.avg.toFixed(1)} ms (max ${touch.max.toFixed(1)} ms, ${touch.count} tocchi)` : 'suona qualche nota nella Tastiera libera'}</dd>
          <dt>Tocco → suono (stima)</dt>
          <dd>{touch.count ? ms(estTotal) : '—'}</dd>
        </dl>
        <p className="muted" style={{ margin: 0 }}>
          Sotto i 30 ms la risposta è percepita come immediata; fino a 50 ms è comunque buona per imparare. La
          calibrazione manuale di microfono e MIDI arriverà con le milestone M4 e M5.
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
