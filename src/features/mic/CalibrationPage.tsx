import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { audioEngine } from '../../audio/AudioEngine';
import { ensureAudio } from '../../audio/ensureAudio';
import { sampler } from '../../audio/Sampler';
import { pitchClass } from '../../core/music/pitch';
import { applyInputSettings, useMicState } from '../../input/activeInput';
import { micInput } from '../../input/mic/MicInput';
import { TopBar } from '../../ui/components';
import { a4FromCents, micLatencyFrom, noiseFloorFrom, noiseVerdict } from './calibration';
import { MicMeter } from './MicMeter';
import './mic.css';

type Step = 'intro' | 'noise' | 'tune' | 'latency' | 'done';
const STEPS: Step[] = ['intro', 'noise', 'tune', 'latency', 'done'];

const NOISE_SEC = 3;
const TUNE_SAMPLES = 40;

export function CalibrationPage() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const mic = useMicState();
  const [step, setStep] = useState<Step>('intro');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const acquired = useRef(false);

  // rilascia il microfono all'uscita
  useEffect(
    () => () => {
      if (acquired.current) micInput.release();
      applyInputSettings(useSettings.getState().settings);
    },
    [],
  );

  const enableMic = async () => {
    await ensureAudio();
    if (!acquired.current) {
      acquired.current = true;
      await micInput.acquire();
    }
    if (micInput.state === 'on') {
      setStep('noise');
      setInfo('');
    }
  };

  // ---- 1. rumore di fondo ----
  const measureNoise = async () => {
    setBusy(true);
    setInfo('Shhh… sto ascoltando la stanza');
    const levels: number[] = [];
    const off = micInput.onRaw((_ev, lv) => levels.push(lv.db));
    await wait(NOISE_SEC * 1000);
    off();
    setBusy(false);
    const floor = noiseFloorFrom(levels);
    if (floor === null) {
      setInfo('Non ho ricevuto audio dal microfono. Controlla che non sia disattivato e riprova.');
      return;
    }
    const verdict = noiseVerdict(floor);
    update({ mic: { ...useSettings.getState().settings.mic, noiseFloorDb: floor } });
    micInput.configure({ noiseFloorDb: floor });
    setInfo(
      verdict === 'quiet'
        ? `Stanza silenziosa (${floor} dB): perfetto!`
        : verdict === 'ok'
          ? `Un po’ di rumore di fondo (${floor} dB), ma va bene.`
          : `C’è parecchio rumore (${floor} dB). Funzionerà, ma se puoi spegni TV o elettrodomestici e ripeti.`,
    );
  };

  // ---- 2. intonazione ----
  const measureTuning = async () => {
    setBusy(true);
    setInfo('Suona un Do e tienilo premuto…');
    micInput.configure({ a4: 440 });
    const cents: number[] = [];
    const off = micInput.onRaw((_ev, lv) => {
      if (lv.midi !== null && pitchClass(lv.midi) === 0) cents.push(lv.cents);
    });
    const start = performance.now();
    while (cents.length < TUNE_SAMPLES && performance.now() - start < 15000) await wait(100);
    off();
    setBusy(false);
    const a4 = a4FromCents(cents, 440);
    if (a4 === null) {
      micInput.configure({ a4: settings.a4Hz });
      setInfo('Non ho sentito un Do chiaro. Riprova suonando il Do centrale con decisione, oppure salta questo passo.');
      return;
    }
    update({ a4Hz: a4 });
    micInput.configure({ a4 });
    const diff = Math.round(1200 * Math.log2(a4 / 440));
    setInfo(
      Math.abs(diff) <= 8
        ? 'Il tuo pianoforte è ben intonato. 👍'
        : `Il tuo pianoforte è un po’ ${diff < 0 ? 'calante' : 'crescente'} (${diff > 0 ? '+' : ''}${diff} cent): mi sono adattato, nessun problema.`,
    );
  };

  // ---- 3. latenza (automatica: l'app suona e si ascolta) ----
  const measureLatency = async () => {
    setBusy(true);
    setInfo('Ascolta: suono 4 note. Lascia il volume alto e non toccare nulla.');
    await ensureAudio();
    const results: number[] = [];
    const target = 72; // Do5: ben riconoscibile
    let pending: number | null = null;
    const off = micInput.onRaw((events) => {
      for (const e of events) {
        if (e.type === 'on' && pending !== null && pitchClass(e.midi) === 0 && e.time > pending - 0.05) {
          results.push((e.time - pending) * 1000);
          pending = null;
        }
      }
    });
    for (let i = 0; i < 4; i++) {
      const t = audioEngine.now() + 0.4;
      pending = t;
      sampler.noteOn(target, 0.95, t);
      sampler.noteOff(target, t + 0.5);
      await wait(1300);
      pending = null;
    }
    off();
    setBusy(false);
    const info = audioEngine.latencyInfo();
    const ms = micLatencyFrom(results, (info.outputLatency + info.baseLatency) * 1000);
    if (ms === null) {
      setInfo('Non sono riuscito a sentire il tablet (forse le cuffie sono collegate o il volume è basso). Uso un valore standard: potrai regolarlo in Diagnostica.');
      update({ latency: { ...useSettings.getState().settings.latency, mic: 40 } });
      return;
    }
    update({ latency: { ...useSettings.getState().settings.latency, mic: ms } });
    setInfo(`Ritardo del microfono: ${ms} ms. Lo compenserò automaticamente.`);
  };

  const finish = () => {
    update({ mic: { ...useSettings.getState().settings.mic, calibratedAt: Date.now() } });
    setStep('done');
    setInfo('');
  };

  const next = (s: Step) => {
    setStep(s);
    setInfo('');
  };

  const idx = STEPS.indexOf(step);
  const s = useSettings.getState().settings;

  return (
    <main className="page calib">
      <TopBar title="Calibrazione del microfono" backTo="/" />
      <div className="calib__steps" aria-hidden>
        {STEPS.map((x, i) => (
          <span key={x} className={i < idx ? 'is-done' : i === idx ? 'is-on' : ''} />
        ))}
      </div>

      {(mic.state === 'denied' || mic.state === 'error' || mic.state === 'unsupported') && (
        <div className="banner banner--warn mic-banner" role="alert">
          <span>⚠️ {mic.message}</span>
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

      <section className="calib__card" data-testid={`calib-${step}`}>
        {step === 'intro' && (
          <>
            <h2>🎤 Ti ascolto mentre suoni</h2>
            <p>Appoggia il tablet sul leggio del pianoforte. In tre passi brevi imparo a riconoscere il tuo strumento e la tua stanza:</p>
            <p>
              1. il <strong>rumore di fondo</strong> · 2. l’<strong>intonazione</strong> del pianoforte · 3. il <strong>ritardo</strong> del microfono
            </p>
            <div className="calib__actions">
              <button className="btn" onClick={() => navigate('/')} data-testid="calib-skip">
                Più tardi
              </button>
              <button className="btn btn--primary" onClick={enableMic} disabled={mic.state === 'starting'} data-testid="calib-enable">
                {mic.state === 'starting' ? 'Attendo il permesso…' : 'Attiva il microfono'}
              </button>
            </div>
          </>
        )}

        {step === 'noise' && (
          <>
            <h2>1. Silenzio, per favore 🤫</h2>
            <p>Non suonare e resta in silenzio per {NOISE_SEC} secondi: misuro il rumore della stanza.</p>
            <MicMeter />
            {info && <p className="muted" data-testid="calib-info">{info}</p>}
            <div className="calib__actions">
              <button className="btn" onClick={() => next('tune')}>
                Salta
              </button>
              <button className="btn" onClick={measureNoise} disabled={busy}>
                {busy ? 'Ascolto…' : s.mic.noiseFloorDb !== null && info ? 'Ripeti' : 'Misura'}
              </button>
              <button className="btn btn--primary" onClick={() => next('tune')} disabled={busy || !info}>
                Avanti →
              </button>
            </div>
          </>
        )}

        {step === 'tune' && (
          <>
            <h2>2. Suona un Do 🎹</h2>
            <p>Premi il <strong>Do centrale</strong> e tienilo premuto un paio di secondi.</p>
            <MicMeter />
            {info && <p className="muted" data-testid="calib-info">{info}</p>}
            <div className="calib__actions">
              <button className="btn" onClick={() => next('latency')}>
                Salta
              </button>
              <button className="btn" onClick={measureTuning} disabled={busy}>
                {busy ? 'Ascolto…' : 'Misura'}
              </button>
              <button className="btn btn--primary" onClick={() => next('latency')} disabled={busy}>
                Avanti →
              </button>
            </div>
          </>
        )}

        {step === 'latency' && (
          <>
            <h2>3. Misuro il ritardo ⏱</h2>
            <p>Il tablet suonerà alcune note e le ascolterà con il microfono. Alza il volume e non usare le cuffie.</p>
            <MicMeter />
            {info && <p className="muted" data-testid="calib-info">{info}</p>}
            <div className="calib__actions">
              <button className="btn" onClick={finish}>
                Salta
              </button>
              <button className="btn" onClick={measureLatency} disabled={busy}>
                {busy ? 'Misuro…' : 'Misura'}
              </button>
              <button className="btn btn--primary" onClick={finish} disabled={busy}>
                Fine →
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <h2>✅ Tutto pronto!</h2>
            <p>Prova a suonare qualche nota: dovresti vederla qui sotto.</p>
            <MicMeter />
            <dl className="calib__summary">
              <dt>Rumore di fondo</dt>
              <dd>{s.mic.noiseFloorDb !== null ? `${s.mic.noiseFloorDb} dB` : 'standard'}</dd>
              <dt>Diapason</dt>
              <dd>La = {s.a4Hz.toLocaleString('it-IT')} Hz</dd>
              <dt>Ritardo microfono</dt>
              <dd>{s.latency.mic} ms</dd>
            </dl>
            <div className="calib__actions">
              <button className="btn btn--primary" onClick={() => navigate('/')} data-testid="calib-start-playing">
                Inizia a suonare →
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
