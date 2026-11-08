/**
 * Renderer dello spartito con VexFlow.
 * Disegna il brano su UN rigo orizzontale continuo (singolo o grand staff), così può scorrere
 * sotto una linea di esecuzione fissa. Restituisce la mappa beat → x e gli elementi SVG di
 * ogni evento, per evidenziazioni e feedback senza ridisegnare.
 */
import VexFlow, {
  Accidental,
  Annotation,
  BarlineType,
  Beam,
  Dot,
  Font,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Voice,
  type RenderContext,
} from 'vexflow/core';
import type { Piece } from '../core/content/schema';
import { decomposeDuration } from '../core/music/durations';
import { noteColor, pitchLabel, pitchToMidi, type NoteNaming } from '../core/music/pitch';
import { interpolate, type BeatPoint } from './interpolate';
import { buildTimeline, measureEnd, type Staff, type Timeline, type TimelineEvent } from '../core/timing/timeline';

export type { BeatPoint };

export interface RenderOptions {
  scale: number;
  showNoteNames: boolean;
  naming: NoteNaming;
  colorNotes: boolean;
  showFingers: boolean;
  showLyrics: boolean;
  /** spazio vuoto (px non scalati) prima della prima nota, per allineare l inizio alla linea di esecuzione */
  leadIn?: number;
  /** anteprime didattiche: niente indicazione di tempo né pause di riempimento */
  bare?: boolean;
  /**
   * Disegno progressivo: le battute che iniziano entro questa larghezza (px non scalati) si
   * disegnano subito, le altre a blocchi quando il browser è libero. Assente = tutto subito.
   */
  eagerWidth?: number;
}


export interface RenderedScore {
  timeline: Timeline;
  /** dimensioni in px (già scalate) */
  width: number;
  height: number;
  scale: number;
  /** punti beat → x (px scalati), ordinati per t */
  points: BeatPoint[];
  /** elementi SVG (gruppi .vf-stavenote) per indice evento */
  noteEls: Map<number, Element[]>;
  xAtBeat: (beat: number) => number;
  /** distanza (px) dall inizio del rigo alla prima nota */
  startOffset: number;
  /** risolta quando tutte le battute sono disegnate */
  complete: Promise<void>;
  /** interrompe il disegno progressivo (es. ridisegno prima della fine) */
  cancel: () => void;
}

const PX_PER_BEAT = 64;
const MEASURE_PAD = 18;
const TREBLE_Y = 10;
const BASS_Y = 160;
const STAVE_LINES_H = 40;
const EPS = 1e-6;

const MAJOR_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_KEYS = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];

export function keySpec(piece: Pick<Piece, 'key'>): string {
  const i = piece.key.fifths + 7;
  return (piece.key.mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS)[i] ?? 'C';
}

/** "F#3" → "f#/3", "Bb4" → "bb/4" */
export function toVexKey(pitch: string): string {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)$/.exec(pitch)!;
  return `${m[1]!.toLowerCase()}${m[2] ?? ''}/${m[3]}`;
}

/** Altezza di un singolo rigo / del grand staff, in px non scalati. */
export function scoreHeight(staves: Staff[]): number {
  return staves.length === 2 ? BASS_Y + 40 + STAVE_LINES_H + 70 : TREBLE_Y + 40 + STAVE_LINES_H + 80;
}

interface Item {
  t: number;
  d: number;
  event?: TimelineEvent;
  /** parte successiva di una nota spezzata (legata alla precedente) */
  tiedFromPrev: boolean;
}

/** Note e pause di una battuta su un rigo, con pause automatiche nei vuoti. */
function measureItems(tl: Timeline, staff: Staff, start: number, end: number): Item[] {
  const evs = tl.events.filter((e) => e.staff === staff && e.t >= start - EPS && e.t < end - EPS);
  const items: Item[] = [];
  let cursor = start;
  const pushRest = (from: number, len: number) => {
    let t = from;
    for (const part of decomposeDuration(len)) {
      items.push({ t, d: part.beats, tiedFromPrev: false });
      t += part.beats;
    }
  };
  for (const e of evs) {
    if (e.t > cursor + EPS) pushRest(cursor, e.t - cursor);
    let t = e.t;
    decomposeDuration(e.d).forEach((part, i) => {
      items.push({ t, d: part.beats, event: e, tiedFromPrev: i > 0 });
      t += part.beats;
    });
    cursor = e.t + e.d;
  }
  if (end - cursor > EPS) pushRest(cursor, end - cursor);
  return items;
}

function makeNote(item: Item, staff: Staff, opts: RenderOptions): StaveNote {
  const spec = decomposeDuration(item.d)[0]!;
  const ev = item.event;
  const isRest = !ev || ev.isRest;
  const note = new StaveNote({
    keys: isRest ? [staff === 'treble' ? 'b/4' : 'd/3'] : ev!.pitches.map(toVexKey),
    duration: spec.vex + (isRest ? 'r' : ''),
    dots: spec.dots,
    clef: staff,
    autoStem: true,
  });
  if (spec.dots) Dot.buildAndAttach([note], { all: true });
  if (isRest || !ev) return note;

  if (opts.colorNotes) {
    ev.midis.forEach((m, i) => note.setKeyStyle(i, { fillStyle: noteColor(m), strokeStyle: noteColor(m) }));
  }
  if (!item.tiedFromPrev) {
    const below = staff === 'treble' ? Annotation.VerticalJustify.BOTTOM : Annotation.VerticalJustify.BOTTOM;
    if (ev.chord) {
      const a = new Annotation(ev.chord).setVerticalJustification(Annotation.VerticalJustify.TOP);
      a.setFont('Academico', 15, 'bold');
      note.addModifier(a, 0);
    }
    if (opts.showFingers && ev.fingers?.length) {
      const a = new Annotation(ev.fingers.join(' ')).setVerticalJustification(Annotation.VerticalJustify.TOP);
      a.setFont('Academico', 13, 'bold');
      note.addModifier(a, 0);
    }
    if (opts.showNoteNames) {
      // nomi dalla grafia scritta (Si♭, non La♯), dal grave all'acuto
      const label = [...ev.pitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b)).map((p) => pitchLabel(p, opts.naming)).join('·');
      const a = new Annotation(label).setVerticalJustification(below);
      a.setFont('Academico', 13, 'bold');
      note.addModifier(a, 0);
    }
    if (opts.showLyrics && ev.label) {
      const a = new Annotation(ev.label).setVerticalJustification(below);
      a.setFont('Academico', 12, 'italic');
      note.addModifier(a, 0);
    }
  }
  return note;
}

let fontsReady: Promise<unknown> | null = null;
/**
 * Carica i font musicali (Bravura per i simboli, Academico per i testi) da public/fonts.
 * File woff2 separati (estratti da VexFlow con tools/extract-vexflow-fonts.ts): scaricati in
 * parallelo, fuori dal parser JavaScript, e in precache per l'uso offline.
 */
export function ensureNotationFonts(): Promise<unknown> {
  fontsReady ??= (async () => {
    const base = `${import.meta.env.BASE_URL}fonts/`;
    await Promise.all([
      Font.load('Bravura', `${base}Bravura.woff2`, { display: 'block' }),
      Font.load('Academico', `${base}Academico.woff2`, { display: 'swap' }),
      Font.load('Academico', `${base}AcademicoBold.woff2`, { display: 'swap', weight: 'bold' }),
    ]);
    VexFlow.setFonts('Bravura', 'Academico');
  })().catch((err) => {
    console.warn('Font musicali non caricati', err);
    fontsReady = null;
  });
  return fontsReady;
}

export function renderScore(container: HTMLElement, piece: Piece, opts: RenderOptions): RenderedScore {
  const tl = buildTimeline(piece);
  const staves: Staff[] = piece.staves.includes('treble') && piece.staves.includes('bass') ? ['treble', 'bass'] : [piece.staves[0]!];
  const yOf = (s: Staff) => (s === 'bass' && staves.length === 2 ? BASS_Y : TREBLE_Y);

  container.innerHTML = '';
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  const ctx = renderer.getContext() as RenderContext;

  const allNotes: { note: StaveNote; item: Item; staff: Staff }[] = [];
  const measures: { x: number; draw: () => void; notes: { note: StaveNote; item: Item }[] }[] = [];
  let x = 0;
  const lastMeasure = tl.measureStarts.length - 1;

  tl.measureStarts.forEach((start, mi) => {
    const end = measureEnd(tl, mi);
    const isFirst = mi === 0;
    const isLast = mi === lastMeasure;

    const vstaves = staves.map((s) => {
      const st = new Stave(x, yOf(s), 100);
      // chiave e armatura sono nell intestazione fissa (renderHeader): qui solo il tempo
      if (isFirst) st.setBegBarType(BarlineType.NONE);
      if (isFirst && !opts.bare) st.addTimeSignature(`${piece.timeSignature[0]}/${piece.timeSignature[1]}`);
      if (isLast) st.setEndBarType(BarlineType.END);
      return st;
    });
    const noteStart = Math.max(...vstaves.map((s) => s.getNoteStartX())) + (isFirst ? (opts.leadIn ?? 0) : 0);

    const mNotes: { note: StaveNote; item: Item }[] = [];
    const mBeams: Beam[] = [];
    const voices = staves.map((s, si) => {
      const items = measureItems(tl, s, start, end).filter((it) => !opts.bare || it.event);
      const notes = items.map((item) => {
        const n = makeNote(item, s, opts);
        n.setStave(vstaves[si]!);
        allNotes.push({ note: n, item, staff: s });
        mNotes.push({ note: n, item });
        return n;
      });
      const voice = new Voice({ numBeats: piece.timeSignature[0], beatValue: piece.timeSignature[1] }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      Accidental.applyAccidentals([voice], keySpec(piece));
      mBeams.push(...Beam.generateBeams(notes));
      return voice;
    });

    const formatter = new Formatter();
    voices.forEach((v) => formatter.joinVoices([v]));
    const minW = formatter.preCalculateMinTotalWidth(voices);
    const contentW = Math.max(minW * 1.35 + MEASURE_PAD, (end - start) * PX_PER_BEAT);
    const width = noteStart - x + contentW + MEASURE_PAD;
    vstaves.forEach((s) => {
      s.setWidth(width);
      s.setNoteStartX(noteStart);
    });
    formatter.format(voices, contentW);

    const mx = x;
    const draw = () => {
      vstaves.forEach((s) => s.setContext(ctx).draw());
      if (vstaves.length === 2) {
        const [t, b] = vstaves as [Stave, Stave];
        if (isFirst) {
          new StaveConnector(t, b).setType('brace').setContext(ctx).draw();
          new StaveConnector(t, b).setType('singleLeft').setContext(ctx).draw();
        }
        new StaveConnector(t, b).setType(isLast ? 'boldDoubleRight' : 'singleRight').setContext(ctx).draw();
      }
      voices.forEach((v, i) => v.draw(ctx, vstaves[i]));
      mBeams.forEach((b) => b.setContext(ctx).draw());
    };
    measures.push({ x: mx, draw, notes: mNotes });
    x += width;
  });

  const totalW = x + 2;
  const height = scoreHeight(staves);
  renderer.resize(totalW * opts.scale, height * opts.scale);
  ctx.scale(opts.scale, opts.scale);
  const svg = container.querySelector('svg')!;

  // mappa beat → x: disponibile subito (la formattazione è già fatta), anche prima del disegno
  const byT = new Map<number, number>();
  for (const { note, item } of allNotes) {
    const nx = (note.getAbsoluteX() + 7) * opts.scale;
    const k = Math.round(item.t * 1e4) / 1e4;
    byT.set(k, Math.min(byT.get(k) ?? Infinity, nx));
  }

  // elementi SVG per evento, raccolti man mano che le battute vengono disegnate
  const noteEls = new Map<number, Element[]>();
  const collect = (notes: { note: StaveNote; item: Item }[]) => {
    for (const { note, item } of notes) {
      if (!item.event || item.event.isRest) continue;
      const el = svg.querySelector(`#vf-${note.getAttribute('id')}`);
      if (el) noteEls.set(item.event.index, [...(noteEls.get(item.event.index) ?? []), el]);
    }
  };
  const drawMeasure = (m: (typeof measures)[number]) => {
    m.draw();
    collect(m.notes);
  };

  // legature: parti di note spezzate + "tie" esplicite fra eventi consecutivi dello stesso rigo
  const drawTies = () => {
    for (const s of staves) {
      const list = allNotes.filter((n) => n.staff === s && n.item.event && !n.item.event.isRest);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1]!;
        const cur = list[i]!;
        const contiguous = Math.abs(prev.item.t + prev.item.d - cur.item.t) < EPS;
        const explicit = !cur.item.tiedFromPrev && prev.item.event!.tie && contiguous;
        if (cur.item.tiedFromPrev || explicit) {
          const idx = prev.item.event!.midis.map((_, k) => k).filter((k) => cur.item.event!.midis.includes(prev.item.event!.midis[k]!));
          if (idx.length === 0) continue;
          new StaveTie({
            firstNote: prev.note,
            lastNote: cur.note,
            firstIndexes: idx,
            lastIndexes: idx.map((k) => cur.item.event!.midis.indexOf(prev.item.event!.midis[k]!)),
          })
            .setContext(ctx)
            .draw();
        }
      }
    }
  };

  // disegno: battute visibili subito, le altre a blocchi nei momenti liberi
  const eager = opts.eagerWidth;
  const now = eager === undefined ? measures : measures.filter((m) => m.x < eager);
  const later = eager === undefined ? [] : measures.filter((m) => m.x >= eager);
  now.forEach(drawMeasure);
  let cancelled = false;
  let complete: Promise<void>;
  if (later.length === 0) {
    drawTies();
    complete = Promise.resolve();
  } else {
    complete = new Promise<void>((resolve) => {
      const step = (deadline?: { timeRemaining: () => number }) => {
        if (cancelled) return resolve();
        const until = performance.now() + Math.max(4, Math.min(12, deadline?.timeRemaining() ?? 8));
        do drawMeasure(later.shift()!);
        while (later.length && performance.now() < until);
        if (later.length) scheduleIdle(step);
        else {
          drawTies();
          resolve();
        }
      };
      scheduleIdle(step);
    });
  }

  const points: BeatPoint[] = [...byT.entries()].map(([t, px]) => ({ t, x: px })).sort((a, b) => a.t - b.t);
  points.push({ t: tl.totalBeats, x: (x - MEASURE_PAD / 2) * opts.scale });

  const xAtBeat = (beat: number) => interpolate(points, beat, PX_PER_BEAT * opts.scale);
  return {
    timeline: tl,
    width: totalW * opts.scale,
    height: height * opts.scale,
    scale: opts.scale,
    points,
    noteEls,
    xAtBeat,
    startOffset: points[0]?.x ?? 0,
    complete,
    cancel: () => {
      cancelled = true;
    },
  };
}

type IdleDeadline = { timeRemaining: () => number };
function scheduleIdle(cb: (d?: IdleDeadline) => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: (d: IdleDeadline) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 250 });
  else setTimeout(() => cb(), 16);
}

/** Intestazione fissa (chiave + armatura) mostrata a sinistra mentre lo spartito scorre. */
export function renderHeader(container: HTMLElement, piece: Piece, scale: number): number {
  const staves: Staff[] = piece.staves.includes('treble') && piece.staves.includes('bass') ? ['treble', 'bass'] : [piece.staves[0]!];
  container.innerHTML = '';
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  const ctx = renderer.getContext() as RenderContext;
  const key = keySpec(piece);
  const vstaves = staves.map((s) => {
    const st = new Stave(14, s === 'bass' && staves.length === 2 ? BASS_Y : TREBLE_Y, 60);
    st.addClef(s).addKeySignature(key);
    return st;
  });
  const w = Math.max(...vstaves.map((s) => s.getNoteStartX())) + 6;
  vstaves.forEach((s) => s.setWidth(w - 14).setEndBarType(BarlineType.NONE));
  renderer.resize(w * scale, scoreHeight(staves) * scale);
  ctx.scale(scale, scale);
  vstaves.forEach((s) => s.setContext(ctx).draw());
  if (vstaves.length === 2) {
    new StaveConnector(vstaves[0]!, vstaves[1]!).setType('brace').setContext(ctx).draw();
    new StaveConnector(vstaves[0]!, vstaves[1]!).setType('singleLeft').setContext(ctx).draw();
  }
  return w * scale;
}
