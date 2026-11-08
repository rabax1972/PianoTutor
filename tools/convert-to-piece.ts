/**
 * Converte un file MIDI o MusicXML in un brano Piano Tutor (content/pieces/<id>.json).
 *
 * Uso:
 *   npm run convert -- <file.mid|file.musicxml> --id mio-brano [opzioni]
 *
 * Opzioni:
 *   --id <id>            id del brano (obbligatorio; minuscole e trattini)
 *   --title <titolo>     titolo (default: dal file)
 *   --license <l>        public-domain | original   (default: public-domain)
 *   --composer <nome>    compositore
 *   --split <n|track>    mani: nota MIDI di divisione (default 60 = Do centrale) o "track" (traccia 1 = destra)
 *   --quantize <beat>    griglia di quantizzazione (default 0.25 = semicroma)
 *   --bpm <n>            tempo (default: dal file)
 *   --pickup <beat>      anacrusi in beat
 *   --out <file>         file di uscita (default content/pieces/<id>.json)
 *
 * Il risultato va poi rifinito a mano (diteggiatura, testo, mani) e validato con `npm run validate`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { PieceSchema } from '../src/core/content/schema';
import { notesToPiece } from './convert/notesToPiece';
import { readMidi, readMusicXml } from './convert/readers';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!input || !opt('id')) {
  console.error('Uso: npm run convert -- <file.mid|file.musicxml> --id mio-brano [--title …] [--split 60|track] [--license original]');
  process.exit(1);
}

const ext = extname(input).toLowerCase();
const read =
  ext === '.mid' || ext === '.midi'
    ? readMidi(new Uint8Array(readFileSync(input)))
    : ext === '.musicxml' || ext === '.xml'
      ? readMusicXml(readFileSync(input, 'utf8'))
      : (() => {
          throw new Error(`Formato non supportato: ${ext} (usa .mid, .midi, .musicxml o .xml non compresso)`);
        })();

const split = opt('split');
const { piece, warnings } = notesToPiece(read.notes, {
  id: opt('id')!,
  title: opt('title') ?? read.title ?? opt('id')!,
  composer: opt('composer') ?? read.composer,
  license: (opt('license') as 'public-domain' | 'original') ?? 'public-domain',
  bpm: Number(opt('bpm') ?? read.bpm),
  timeSignature: read.timeSignature,
  fifths: read.fifths,
  mode: read.mode,
  split: split === 'track' ? 'track' : split ? Number(split) : 60,
  quantize: opt('quantize') ? Number(opt('quantize')) : undefined,
  pickupBeats: opt('pickup') ? Number(opt('pickup')) : undefined,
});

const valid = PieceSchema.safeParse(piece);
if (!valid.success) {
  console.error('✖ Il brano generato non è valido:');
  for (const i of valid.error.issues) console.error('  •', i.path.join('.'), i.message);
  process.exit(1);
}
const out = opt('out') ?? `content/pieces/${piece.id}.json`;
writeFileSync(out, JSON.stringify({ $schema: '../../docs/schema/piece.schema.json', ...piece }, null, 2) + '\n');
console.log(`✔ ${out}: ${piece.events.length} eventi, ${piece.staves.join(' + ')}, ${piece.tempo.bpm} bpm, ${piece.timeSignature.join('/')}`);
for (const w of warnings) console.warn('  ⚠', w);
console.log('Ricorda: aggiungi diteggiatura ("fingers") e controlla le mani, poi `npm run validate`.');
