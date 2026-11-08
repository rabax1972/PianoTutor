/**
 * Genera i JSON Schema dei contenuti a partire dagli schemi Zod (fonte unica di verità).
 * Uso: npm run schema  →  docs/schema/*.schema.json
 * Gli editor (VS Code) li usano per autocompletamento e validazione dei file in content/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { CourseSchema, LessonSchema, PieceSchema } from '../src/core/content/schema';
import { BadgesFileSchema } from '../src/core/progress/badgeSchema';

const out = 'docs/schema';
mkdirSync(out, { recursive: true });
for (const [name, schema] of Object.entries({ course: CourseSchema, lesson: LessonSchema, piece: PieceSchema, badges: BadgesFileSchema })) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  writeFileSync(`${out}/${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
  console.log(`✔ ${out}/${name}.schema.json`);
}
