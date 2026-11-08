import { useEffect, useRef, useState } from 'react';
import type { Piece } from '../core/content/schema';
import { soundingAt, type TimelineEvent } from '../core/timing/timeline';
import { ensureNotationFonts, renderHeader, renderScore, scoreHeight, type RenderedScore, type RenderOptions } from './scoreRenderer';
import './ScoreView.css';

export type NoteMark = 'current' | 'next' | 'correct' | 'early' | 'wrong';

export interface ScoreViewProps {
  piece: Piece;
  options: Omit<RenderOptions, 'scale'>;
  /** posizione corrente in beat, letta a ogni frame */
  getBeat: () => number;
  /** evidenziazioni persistenti per indice evento (feedback, M3) */
  marks?: ReadonlyMap<number, NoteMark>;
  /** evidenzia automaticamente le note che suonano alla posizione corrente */
  autoHighlight?: boolean;
  /** chiamato quando cambia l'insieme delle note correnti */
  onCurrentChange?: (events: TimelineEvent[]) => void;
}

/**
 * Spartito che scorre orizzontalmente sotto una linea di esecuzione fissa.
 * Il disegno avviene una sola volta; lo scroll è un transform GPU aggiornato a ogni frame.
 */
/** posizione della linea di esecuzione, in frazione della larghezza */
const PLAYHEAD_RATIO = 0.3;
/** distanza tipica (px non scalati) tra l'inizio del rigo e la prima nota (indicazione di tempo + margine) */
const ESTIMATED_START_OFFSET = 52;

export function ScoreView({ piece, options, getBeat, marks, autoHighlight = true, onCurrentChange }: ScoreViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<RenderedScore | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [headerW, setHeaderW] = useState(0);
  const [ready, setReady] = useState(false);
  const [startOffset, setStartOffset] = useState(0);
  /** incrementato quando il disegno progressivo termina: riapplica le evidenziazioni */
  const [drawn, setDrawn] = useState(0);
  const getBeatRef = useRef(getBeat);
  getBeatRef.current = getBeat;
  const onChangeRef = useRef(onCurrentChange);
  onChangeRef.current = onCurrentChange;
  const marksRef = useRef(marks);
  marksRef.current = marks;

  useEffect(() => {
    const el = rootRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const staves = piece.staves.length === 2 ? 2 : 1;
  const scale = size.h ? Math.max(0.7, Math.min(1.8, size.h / scoreHeight(staves === 2 ? ['treble', 'bass'] : ['treble']))) : 0;
  const optsKey = JSON.stringify(options);

  // disegno (solo quando cambiano brano, opzioni o scala)
  useEffect(() => {
    if (!scale) return;
    let cancelled = false;
    void ensureNotationFonts().then(() => {
      if (cancelled || !trackRef.current || !headerRef.current) return;
      performance.mark('pt:score-start');
      const hw = renderHeader(headerRef.current, piece, scale);
      // attacco stimato prima del disegno (un solo rendering): se la linea di esecuzione è più a
      // destra dell'inizio del rigo, si allunga la prima battuta così il rigo resta continuo
      const gap = size.w * PLAYHEAD_RATIO - (hw + ESTIMATED_START_OFFSET * scale);
      rendered.current?.cancel();
      // disegno progressivo: subito ciò che è visibile (più un margine), il resto nei momenti liberi
      const r = renderScore(trackRef.current, piece, { ...options, scale, leadIn: gap > 1 ? gap / scale : 0, eagerWidth: (size.w * 1.3) / scale });
      rendered.current = r;
      performance.measure('pt:score-render', 'pt:score-start');
      setStartOffset(r.startOffset);
      setHeaderW(hw);
      setReady(true);
      void r.complete.then(() => !cancelled && setDrawn((n) => n + 1));
    });
    return () => {
      cancelled = true;
      rendered.current?.cancel();
    };
    // la larghezza conta solo per l attacco iniziale: arrotondata per non ridisegnare a ogni pixel
  }, [piece, optsKey, scale, Math.round(size.w / 40)]);

  // linea di esecuzione: a circa un terzo della larghezza, così si vede la nota appena suonata
  // e restano visibili le prossime; mai sopra l intestazione con la chiave
  // spartito centrato verticalmente nello spazio disponibile
  const expectedH = scale ? scoreHeight(staves === 2 ? ['treble', 'bass'] : ['treble']) * scale : size.h;
  const top = Math.max(0, Math.round((size.h - expectedH) / 2));
  const playheadX = Math.round(Math.max(headerW + startOffset, size.w * PLAYHEAD_RATIO));

  // applica le evidenziazioni persistenti
  useEffect(() => {
    const r = rendered.current;
    if (!r || !ready) return;
    r.noteEls.forEach((els, idx) => {
      const m = marks?.get(idx);
      els.forEach((el) => {
        el.classList.remove('is-correct', 'is-early', 'is-wrong');
        if (m && m !== 'current' && m !== 'next') el.classList.add(`is-${m}`);
      });
    });
  }, [marks, ready, drawn]);

  // ciclo di animazione: scroll + nota corrente
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let lastKey = '';
    let lastBeat = NaN;
    let lastTx = '';
    const loop = () => {
      const r = rendered.current;
      const track = trackRef.current;
      const beat = getBeatRef.current();
      // da fermi (o in attesa sulla nota) non c'è nulla da ricalcolare: nessun lavoro per frame
      if (r && track && beat !== lastBeat) {
        lastBeat = beat;
        const tx = `translate3d(${(playheadX - r.xAtBeat(beat)).toFixed(1)}px,0,0)`;
        if (tx !== lastTx) {
          lastTx = tx;
          track.style.transform = tx;
        }

        if (autoHighlight) {
          let current = soundingAt(r.timeline, beat);
          let cls = 'is-current';
          if (current.length === 0) {
            const next = r.timeline.onsets.find((o) => o.t >= beat - 1e-6 && o.midis.length > 0);
            if (next && next.t - beat <= r.timeline.measureBeats) {
              current = r.timeline.events.filter((e) => next.events.includes(e.index) && !e.isRest);
              cls = 'is-next';
            }
          }
          const key = cls + current.map((e) => e.index).join(',');
          if (key !== lastKey) {
            lastKey = key;
            r.noteEls.forEach((els) => els.forEach((el) => el.classList.remove('is-current', 'is-next')));
            for (const e of current) r.noteEls.get(e.index)?.forEach((el) => el.classList.add(cls));
            onChangeRef.current?.(current);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, playheadX, autoHighlight]);

  return (
    <div className="score" ref={rootRef} data-testid="score" aria-label={`Spartito: ${piece.title}`} role="img">
      <div className="score__track" ref={trackRef} style={{ top }} />
      <div className="score__header" ref={headerRef} style={{ paddingTop: top }} />
      {ready && <div className="score__playhead" style={{ left: playheadX }} aria-hidden />}
    </div>
  );
}

