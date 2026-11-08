import { memo, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MIDDLE_C, noteColor, noteLabel, type NoteNaming } from '../../core/music/pitch';
import { recordTouchDelay } from '../../features/diagnostics/metrics';
import { layoutKeys } from './layout';
import './PianoKeyboard.css';

export type KeyMark = 'hint' | 'correct' | 'early' | 'wrong';

export interface PianoKeyboardProps {
  from: number;
  to: number;
  onNoteOn: (midi: number, eventTimeStamp: number, velocity: number) => void;
  onNoteOff: (midi: number, eventTimeStamp: number) => void;
  /** evidenziazioni esterne (suggerimento, feedback) */
  marks?: ReadonlyMap<number, KeyMark>;
  /** note premute da altre sorgenti (MIDI/mic), mostrate come premute */
  externalPressed?: ReadonlySet<number>;
  showLabels?: boolean;
  naming?: NoteNaming;
  colorNotes?: boolean;
  /** diteggiatura da mostrare sui tasti */
  fingers?: ReadonlyMap<number, number>;
}

/**
 * Tastiera multitouch. Ogni dito (pointerId) è tracciato separatamente;
 * scorrere un dito sui tasti produce un glissando.
 */
function PianoKeyboardImpl({
  from,
  to,
  onNoteOn,
  onNoteOff,
  marks,
  externalPressed,
  showLabels = true,
  naming = 'italian',
  colorNotes = false,
  fingers,
}: PianoKeyboardProps) {
  const keys = useMemo(() => layoutKeys(from, to), [from, to]);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>()); // pointerId → midi
  const counts = useRef(new Map<number, number>()); // midi → n. dita
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());

  const sync = () => setPressed(new Set(counts.current.keys()));

  const keyAt = (x: number, y: number): { midi: number; el: HTMLElement } | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const keyEl = el?.closest<HTMLElement>('[data-midi]');
    if (!keyEl || !rootRef.current?.contains(keyEl)) return null;
    return { midi: Number(keyEl.dataset.midi), el: keyEl };
  };

  /** Velocity dalla posizione verticale: più in basso sul tasto = più forte (come sul piano vero). */
  const velocityFor = (el: HTMLElement, y: number) => {
    const r = el.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (y - r.top) / r.height));
    return 0.5 + 0.45 * rel;
  };

  const press = (pointerId: number, midi: number, ts: number, velocity: number) => {
    pointers.current.set(pointerId, midi);
    const c = counts.current.get(midi) ?? 0;
    counts.current.set(midi, c + 1);
    if (c === 0) onNoteOn(midi, ts, velocity);
  };

  const release = (pointerId: number, ts: number) => {
    const midi = pointers.current.get(pointerId);
    if (midi === undefined) return;
    pointers.current.delete(pointerId);
    const c = (counts.current.get(midi) ?? 1) - 1;
    if (c <= 0) {
      counts.current.delete(midi);
      onNoteOff(midi, ts);
    } else counts.current.set(midi, c);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const hit = keyAt(e.clientX, e.clientY);
      if (!hit) return;
      recordTouchDelay(performance.now() - e.timeStamp);
      rootRef.current?.setPointerCapture(e.pointerId);
      press(e.pointerId, hit.midi, e.timeStamp, velocityFor(hit.el, e.clientY));
      sync();
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
      const current = pointers.current.get(e.pointerId);
      if (current === undefined) return;
      const hit = keyAt(e.clientX, e.clientY);
      if (!hit || hit.midi === current) return;
      release(e.pointerId, e.timeStamp);
      press(e.pointerId, hit.midi, e.timeStamp, velocityFor(hit.el, e.clientY));
      sync();
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
      release(e.pointerId, e.timeStamp);
      sync();
  };

  return (
    <div
      ref={rootRef}
      className={`piano-keyboard${colorNotes ? ' piano-keyboard--color' : ''}`}
      role="group"
      aria-label="Tastiera del pianoforte"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {keys.map((k) => {
        const isDown = pressed.has(k.midi) || externalPressed?.has(k.midi);
        const mark = marks?.get(k.midi);
        const finger = fingers?.get(k.midi);
        const label = noteLabel(k.midi, naming);
        return (
          <div
            key={k.midi}
            data-midi={k.midi}
            data-testid={`key-${k.midi}`}
            role="button"
            aria-label={noteLabel(k.midi, naming, { octave: true })}
            aria-pressed={!!isDown}
            className={[
              'pk-key',
              k.black ? 'pk-key--black' : 'pk-key--white',
              isDown ? 'is-down' : '',
              mark ? `is-${mark}` : '',
            ].join(' ')}
            style={
              {
                left: `${k.left}%`,
                width: `${k.width}%`,
                '--note-color': noteColor(k.midi),
              } as React.CSSProperties
            }
          >
            {finger !== undefined && <span className="pk-finger">{finger}</span>}
            {k.midi === MIDDLE_C && <span className="pk-middle-c" title="Do centrale" />}
            {showLabels && !k.black && <span className="pk-label">{label}</span>}
          </div>
        );
      })}
    </div>
  );
}

export const PianoKeyboard = memo(PianoKeyboardImpl);
