import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useElementWidth } from '../../app/hooks';
import { useSettings } from '../../app/settingsStore';
import { audioEngine } from '../../audio/AudioEngine';
import { ensureAudio } from '../../audio/ensureAudio';
import { PlaybackScheduler } from '../../audio/PlaybackScheduler';
import { sampler } from '../../audio/Sampler';
import { getPiece } from '../../core/content/loader';
import type { Piece } from '../../core/content/schema';
import { buildTimeline, pitchRange, type TimelineEvent } from '../../core/timing/timeline';
import { Transport } from '../../core/timing/transport';
import { t } from '../../i18n/it';
import { inputHub } from '../../input/inputHub';
import { ScoreView } from '../../notation/ScoreView';
import { Segmented, TopBar } from '../../ui/components';
import { octavesForWidth, rangeForNotes } from '../../ui/keyboard/layout';
import { PianoKeyboard, type KeyMark } from '../../ui/keyboard/PianoKeyboard';
import './ScorePlayerPage.css';

export function ScorePlayerPage() {
  const { id } = useParams();
  const piece = id ? getPiece(id) : undefined;
  if (!piece) return <Navigate to="/brani" replace />;
  return <ScorePlayer key={piece.id} piece={piece} />;
}

function ScorePlayer({ piece }: { piece: Piece }) {
  const { settings, update } = useSettings();
  const timeline = useMemo(() => buildTimeline(piece), [piece]);
  const transport = useMemo(() => new Transport(() => audioEngine.now(), piece.tempo.bpm), [piece]);
  const [playing, setPlaying] = useState(false);
  const [tempoScale, setTempoScale] = useState(1);
  const [metronome, setMetronome] = useState(false);
  const [listen, setListen] = useState(true);
  const [current, setCurrent] = useState<TimelineEvent[]>([]);
  const schedulerRef = useRef<PlaybackScheduler | null>(null);
  const [kbRef, kbWidth] = useElementWidth<HTMLDivElement>();

  const stop = useCallback(() => {
    transport.pause();
    schedulerRef.current?.stop();
    sampler.allNotesOff();
    setPlaying(false);
  }, [transport]);

  useEffect(() => stop, [stop]);

  const play = async () => {
    await ensureAudio();
    let from = transport.beatAt();
    if (from >= timeline.totalBeats - 1e-6 || from <= 0) from = -timeline.measureBeats; // conteggio di una battuta
    transport.setTempoScale(tempoScale);
    transport.play(from, 0.1);
    schedulerRef.current = new PlaybackScheduler(
      transport,
      timeline,
      { playNotes: listen, hands: 'both', metronome, clickEvery: piece.timeSignature[1] === 8 ? 1.5 : 1 },
      () => {
        transport.pause();
        transport.seek(timeline.totalBeats);
        setPlaying(false);
      },
    );
    schedulerRef.current.start(from);
    setPlaying(true);
  };

  const restart = () => {
    stop();
    transport.seek(0);
    setCurrent([]);
  };

  // opzioni modificabili durante la riproduzione
  useEffect(() => {
    transport.setTempoScale(tempoScale);
  }, [tempoScale, transport]);
  useEffect(() => {
    schedulerRef.current?.update({ metronome, playNotes: listen });
  }, [metronome, listen]);

  // la posizione visiva tiene conto della latenza di uscita (si vede ciò che si sente)
  const getBeat = useCallback(() => {
    const info = audioEngine.latencyInfo();
    return transport.beatAt(audioEngine.now() - info.outputLatency - info.baseLatency);
  }, [transport]);

  const range = useMemo(() => {
    const r = pitchRange(timeline) ?? { min: 60, max: 72 };
    return rangeForNotes(r.min, r.max, kbWidth ? octavesForWidth(kbWidth) : 2);
  }, [timeline, kbWidth]);

  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>();
    current.forEach((e) => e.midis.forEach((midi) => m.set(midi, 'hint')));
    return m;
  }, [current]);

  const fingers = useMemo(() => {
    const f = new Map<number, number>();
    current.forEach((e) => e.midis.forEach((midi, i) => e.fingers?.[i] && f.set(midi, e.fingers[i]!)));
    return f;
  }, [current]);

  const scoreOptions = useMemo(
    () => ({
      showNoteNames: settings.showNoteNames,
      naming: settings.noteNaming,
      colorNotes: settings.colorNotes,
      showFingers: true,
      showLyrics: !settings.showNoteNames,
    }),
    [settings.showNoteNames, settings.noteNaming, settings.colorNotes],
  );

  return (
    <main className="page page--full player">
      <TopBar
        title={piece.title}
        backTo="/brani"
        actions={
          <>
            <Segmented
              label={t.player.tempo}
              value={tempoScale}
              onChange={setTempoScale}
              options={[
                { value: 0.5, label: '50%' },
                { value: 0.75, label: '75%' },
                { value: 1, label: '100%' },
              ]}
            />
            <button className={`btn${metronome ? ' btn--on' : ''}`} aria-pressed={metronome} onClick={() => setMetronome((v) => !v)}>
              {t.player.metronome}
            </button>
            <button className={`btn${listen ? ' btn--on' : ''}`} aria-pressed={listen} onClick={() => setListen((v) => !v)}>
              {t.player.listen}
            </button>
            <button
              className={`btn${settings.showNoteNames ? ' btn--on' : ''}`}
              aria-pressed={settings.showNoteNames}
              onClick={() => update({ showNoteNames: !settings.showNoteNames })}
            >
              {t.play.labels}
            </button>
          </>
        }
      />

      <section className="player__score">
        <ScoreView piece={piece} options={scoreOptions} getBeat={getBeat} onCurrentChange={setCurrent} />
      </section>

      <div className="player__controls">
        <button className="btn btn--icon" aria-label={t.player.restart} onClick={restart} data-testid="restart">
          ⏮
        </button>
        <button
          className="btn btn--primary player__play"
          onClick={playing ? stop : play}
          data-testid="play"
          aria-label={playing ? t.player.pause : t.player.play}
        >
          {playing ? '⏸ ' + t.player.pause : '▶ ' + t.player.play}
        </button>
        <span className="muted player__meta">
          ♩ = {Math.round(piece.tempo.bpm * tempoScale)} · {piece.timeSignature.join('/')}
        </span>
      </div>

      <div className="player__keyboard" ref={kbRef}>
        <PianoKeyboard
          from={range.from}
          to={range.to}
          onNoteOn={(m, ts, v) => inputHub.virtual.press(m, ts, v)}
          onNoteOff={(m, ts) => inputHub.virtual.release(m, ts)}
          marks={marks}
          fingers={fingers}
          showLabels={settings.showNoteNames}
          naming={settings.noteNaming}
          colorNotes={settings.colorNotes}
        />
      </div>
    </main>
  );
}
