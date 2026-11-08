/**
 * Estrae i font musicali incorporati in VexFlow (base64) in file woff2 separati in public/fonts/.
 * Il browser li scarica in parallelo e non passano dal parser JavaScript (molto più veloce su tablet).
 * Da rieseguire solo se si aggiorna VexFlow:  npx tsx tools/extract-vexflow-fonts.ts
 * Licenze: Bravura e Academico sono distribuiti con SIL Open Font License 1.1.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'node_modules/vexflow/build/esm/src/fonts';
const FONTS = { Bravura: 'bravura.js', Academico: 'academico.js', AcademicoBold: 'academicobold.js' };

mkdirSync('public/fonts', { recursive: true });
for (const [name, file] of Object.entries(FONTS)) {
  const js = readFileSync(`${SRC}/${file}`, 'utf8');
  const b64 = /base64,([A-Za-z0-9+/=]+)/.exec(js)?.[1];
  if (!b64) throw new Error(`Font non trovato in ${file}`);
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(`public/fonts/${name}.woff2`, buf);
  console.log(`✔ public/fonts/${name}.woff2 (${(buf.length / 1024).toFixed(0)} KB)`);
}
