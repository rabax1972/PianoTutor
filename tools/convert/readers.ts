/**
 * Lettori di file: MIDI (Standard MIDI File) e MusicXML (score-partwise non compresso).
 * Restituiscono note grezze + metadati per notesToPiece.
 */
import * as tonejs from '@tonejs/midi';
import { XMLParser } from 'fast-xml-parser';
import { pitchToMidi } from '../../src/core/music/pitch';
import { fifthsFromKey, type RawNote } from './notesToPiece';

export interface ReadResult {
  notes: RawNote[];
  title?: string;
  composer?: string;
  bpm: number;
  timeSignature: [number, number];
  fifths: number;
  mode: 'major' | 'minor';
}

// ---------------------------------------------------------------- MIDI

/** @tonejs/midi è CommonJS: in Node ESM gli export con nome stanno sotto `default` */
export const { Midi } = ((tonejs as unknown as { default?: typeof tonejs }).default ?? tonejs) as typeof tonejs;

export function readMidi(data: Uint8Array): ReadResult {
  const midi = new Midi(data);
  const ppq = midi.header.ppq;
  const ts = midi.header.timeSignatures[0]?.timeSignature;
  const key = midi.header.keySignatures[0];
  const k = key ? fifthsFromKey(key.key + (key.scale === 'minor' ? 'm' : '')) : { fifths: 0, mode: 'major' as const };
  // solo tracce con note (niente batteria, canale 10): l'indice serve per assegnare le mani
  const tracks = midi.tracks.filter((t) => t.notes.length > 0 && t.channel !== 9);
  const notes: RawNote[] = tracks.flatMap((t, track) =>
    t.notes.map((n) => ({ midi: n.midi, start: n.ticks / ppq, duration: n.durationTicks / ppq, track })),
  );
  return {
    notes,
    title: midi.name || undefined,
    bpm: midi.header.tempos[0]?.bpm ?? 100,
    timeSignature: ts && ts.length === 2 ? [ts[0]!, ts[1]!] : [4, 4],
    ...k,
  };
}

// ---------------------------------------------------------------- MusicXML

/** Nodo del parser con preserveOrder: { tag: figli[], ':@': attributi } oppure { '#text': valore }. */
type XNode = Record<string, unknown>;

const tagOf = (n: XNode) => Object.keys(n).find((k) => k !== ':@')!;
const kids = (n: XNode): XNode[] => (n[tagOf(n)] as XNode[]) ?? [];
const attr = (n: XNode, name: string) => (n[':@'] as Record<string, string> | undefined)?.[`@${name}`];
const child = (n: XNode, tag: string) => kids(n).find((c) => tagOf(c) === tag);
const children = (n: XNode, tag: string) => kids(n).filter((c) => tagOf(c) === tag);
const text = (n: XNode | undefined, tag?: string): string | undefined => {
  const t = tag ? (n ? child(n, tag) : undefined) : n;
  if (!t) return undefined;
  const v = kids(t).find((c) => '#text' in c)?.['#text'];
  return v === undefined ? undefined : String(v);
};
const num = (v: string | undefined, d = 0) => (v === undefined || v === '' ? d : Number(v));

export function readMusicXml(xml: string): ReadResult {
  const root = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', preserveOrder: true, parseTagValue: false }).parse(xml) as XNode[];
  const score = root.find((n) => tagOf(n) === 'score-partwise');
  if (!score) throw new Error('Solo MusicXML "score-partwise" non compresso (.musicxml/.xml) è supportato');

  const title = text(child(score, 'work'), 'work-title') ?? text(score, 'movement-title');
  const composer = children(child(score, 'identification') ?? { x: [] }, 'creator')
    .filter((c) => attr(c, 'type') === 'composer' || !attr(c, 'type'))
    .map((c) => text(c))
    .find(Boolean);

  let bpm = 100;
  let fifths = 0;
  let mode: 'major' | 'minor' = 'major';
  let timeSignature: [number, number] = [4, 4];
  const notes: RawNote[] = [];
  const parts = children(score, 'part');

  parts.forEach((part, partIndex) => {
    let divisions = 1;
    let cursor = 0; // posizione in divisioni
    let lastStart = 0;
    const tieOpen = new Map<string, RawNote>();

    for (const measure of children(part, 'measure')) {
      let maxCursor = cursor;
      for (const el of kids(measure)) {
        const tag = tagOf(el);
        if (tag === 'attributes') {
          if (child(el, 'divisions')) divisions = num(text(el, 'divisions'), 1);
          const key = child(el, 'key');
          if (key && partIndex === 0) {
            fifths = num(text(key, 'fifths'));
            mode = text(key, 'mode') === 'minor' ? 'minor' : 'major';
          }
          const time = child(el, 'time');
          if (time && partIndex === 0) timeSignature = [num(text(time, 'beats'), 4), num(text(time, 'beat-type'), 4)];
        } else if (tag === 'direction' || tag === 'sound') {
          const sound = tag === 'sound' ? el : child(el, 'sound');
          const t = sound && attr(sound, 'tempo');
          if (t) bpm = Number(t);
        } else if (tag === 'backup') {
          cursor -= num(text(el, 'duration'));
        } else if (tag === 'forward') {
          cursor += num(text(el, 'duration'));
          maxCursor = Math.max(maxCursor, cursor);
        } else if (tag === 'note') {
          const dur = num(text(el, 'duration'));
          const isChord = !!child(el, 'chord');
          const start = isChord ? lastStart : cursor;
          if (!isChord) {
            lastStart = cursor;
            cursor += dur;
            maxCursor = Math.max(maxCursor, cursor);
          }
          const pitch = child(el, 'pitch');
          if (!pitch || child(el, 'rest') || child(el, 'grace')) continue;
          const alter = num(text(pitch, 'alter'));
          const midi = pitchToMidi(`${text(pitch, 'step')}${alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)}${text(pitch, 'octave')}`);
          const staff = num(text(el, 'staff'), 1);
          const hand: 'R' | 'L' = parts.length > 1 ? (partIndex === 0 ? 'R' : 'L') : staff >= 2 ? 'L' : 'R';
          const ties = children(el, 'tie').map((t) => attr(t, 'type'));
          const key = `${midi}-${hand}`;
          const open = tieOpen.get(key);
          if (ties.includes('stop') && open) {
            // le note legate diventano una sola: notesToPiece le rispezza alle stanghette
            open.duration += dur / divisions;
            if (!ties.includes('start')) tieOpen.delete(key);
            continue;
          }
          const raw: RawNote = { midi, start: start / divisions, duration: dur / divisions, hand };
          notes.push(raw);
          if (ties.includes('start')) tieOpen.set(key, raw);
        }
      }
      cursor = maxCursor;
    }
  });

  return { notes, title, composer, bpm, timeSignature, fifths, mode };
}
