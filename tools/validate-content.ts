/**
 * Valida tutti i contenuti. Eseguito automaticamente prima della build (npm run build).
 * Uso manuale: npm run validate
 */
import { checkContent } from './content-check';

const { files, errors } = checkContent();
if (errors.length) {
  console.error(`✖ ${errors.length} errori nei contenuti:\n`);
  for (const e of errors) console.error('  • ' + e);
  process.exit(1);
}
console.log(`✔ contenuti validi (${files} file)`);
