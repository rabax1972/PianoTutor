/**
 * Animazioni delle slide di spiegazione (Slide.animation.kind).
 * Sono interattive: si può toccare la tastiera e ascoltare.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../../app/hooks';
import { useSettings } from '../../app/settingsStore';
import { audioEngine } from '../../audio/AudioEngine';
import { ensureAudio } from '../../audio/ensureAudio';
import { scheduleClick } from '../../audio/Metronome';
import { sampler } from '../../audio/Sampler';
import type { Piece, Slide } from '../../core/content/schema';
import { pitchClass, pitchToMidi } from '../../core/music/pitch';
import { inputHub } from '../../input/inputHub';
import { octavesForWidth, visibleRange } from '../../ui/keyboard/layout';
import { PianoKeyboard, type KeyMark } from '../../ui/keyboard/PianoKeyboard';

const GROUPS: Record<string, number[]> = {
  'black-twos': [1, 3],
  'black-threes': [6, 8, 10],
  'all-c': [0],
  'all-white': [0, 2, 4, 5, 7, 9, 11],
};

function SlideKeyboard({ highlight, fingers }: { highlight: (midi: number) => boolean; fingers?: Map<number, number> }) {
  const { settings } = useSettings();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const range = visibleRange(width ? octavesForWidth(width, 44, 3) : 2);
  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>();
    for (let k = range.from; k <= range.to; k++) if (highlight(k)) m.set(k, 'hint');
    return m;
  }, [range.from, range.to, highlight]);
  return (
    <div className="slide-keyboard pulse-hints" ref={ref}>
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
  );
}

function StaffPreview({ notes, clef }: { notes: string[]; clef: 'treble' | 'bass' }) {
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const piece = useMemo<Piece>(
    () => ({
      schemaVersion: 1,
      id: 'preview',
      title: 'Anteprima',
      license: 'original',
      tempo: { bpm: 80 },
      timeSignature: [4, 4],
      key: { fifths: 0, mode: 'major' },
      staves: [clef],
      events: notes.map((p, i) => ({ t: i, d: 1, p: [p], hand: clef === 'treble' ? 'R' : 'L' })),
    }),
    [notes, clef],
  );
  useEffect(() => {
    let off = false;
    // VexFlow caricato solo per le slide che mostrano lo spartito
    void import('../../notation/scoreRenderer').then(async ({ ensureNotationFonts, renderHeader, renderScore }) => {
      await ensureNotationFonts();
      if (off || !headRef.current || !bodyRef.current) return;
      renderHeader(headRef.current, piece, 1.6);
      renderScore(bodyRef.current, piece, {
        scale: 1.6,
        showNoteNames: true,
        naming: settings.noteNaming,
        colorNotes: settings.colorNotes,
        showFingers: false,
        showLyrics: false,
        bare: true,
      });
    });
    return () => {
      off = true;
    };
  }, [piece, settings.noteNaming, settings.colorNotes]);

  const play = async () => {
    await ensureAudio();
    const t0 = audioEngine.now() + 0.05;
    notes.forEach((p, i) => {
      const m = pitchToMidi(p);
      sampler.noteOn(m, 0.8, t0 + i * 0.6);
      sampler.noteOff(m, t0 + i * 0.6 + 0.55);
    });
  };

  return (
    <div className="staff-preview">
      <div className="staff-preview__paper">
        <div ref={headRef} />
        <div ref={bodyRef} />
      </div>
      <button className="btn" onClick={play}>
        🔊 Ascolta
      </button>
    </div>
  );
}

function RhythmPulse({ pattern, bpm }: { pattern: number[]; bpm: number }) {
  const [active, setActive] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const play = async () => {
    await ensureAudio();
    const spb = 60 / bpm;
    let t = 0;
    const t0 = audioEngine.now() + 0.1;
    pattern.forEach((d, i) => {
      // valori negativi = pause: si contano ma non suonano
      if (d > 0) scheduleClick(t0 + t, i === 0, 0.7);
      timers.current.push(setTimeout(() => setActive(i), (t + 0.1) * 1000));
      t += Math.abs(d) * spb;
    });
    timers.current.push(setTimeout(() => setActive(-1), (t + 0.1) * 1000));
  };
  const glyph = (d: number) => (d < 0 ? '𝄽' : d >= 4 ? '𝅝' : d >= 2 ? '𝅗𝅥' : d >= 1 ? '♩' : '♪');
  return (
    <div className="rhythm-pulse">
      <div className="rhythm-pulse__row">
        {pattern.map((d, i) => (
          <span key={i} className={`rhythm-pulse__note${i === active ? ' is-active' : ''}${d < 0 ? ' is-rest' : ''}`} style={{ flexGrow: Math.abs(d) }}>
            {glyph(d)}
          </span>
        ))}
      </div>
      <button className="btn" onClick={play}>
        🔊 Ascolta il ritmo
      </button>
    </div>
  );
}

export function SlideAnimation({ slide }: { slide: Slide }) {
  const anim = slide.animation;
  const params = (anim?.params ?? {}) as Record<string, unknown>;
  const highlightKeys = useMemo(() => new Set((slide.highlightKeys ?? []).map(pitchToMidi)), [slide.highlightKeys]);

  const kind = anim?.kind ?? (slide.highlightKeys ? 'keyboard-highlight' : slide.showStaff ? 'staff-note' : undefined);

  const highlight = useMemo(() => {
    const group = GROUPS[String(params.group ?? '')];
    return (m: number) => highlightKeys.has(m) || (group ? group.includes(pitchClass(m)) : false);
  }, [highlightKeys, params.group]);

  const fingers = useMemo(() => {
    const f = new Map<number, number>();
    Object.entries((params.fingers as Record<string, number>) ?? {}).forEach(([p, n]) => f.set(pitchToMidi(p), n));
    return f;
  }, [params.fingers]);

  if (kind === 'keyboard-highlight') return <SlideKeyboard highlight={highlight} />;
  if (kind === 'hand-position') return <SlideKeyboard highlight={(m) => fingers.has(m)} fingers={fingers} />;
  if (kind === 'staff-note') {
    const notes = (params.notes as string[]) ?? slide.highlightKeys ?? ['C4'];
    return <StaffPreview notes={notes} clef={slide.showStaff === 'bass' ? 'bass' : 'treble'} />;
  }
  if (kind === 'rhythm-pulse') {
    return <RhythmPulse pattern={(params.pattern as number[]) ?? [1, 1, 1, 1]} bpm={(params.bpm as number) ?? 80} />;
  }
  return null;
}
