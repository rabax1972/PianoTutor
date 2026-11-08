/**
 * Validazione di tutti i contenuti in content/: schema Zod + controlli semantici + id univoci.
 * Usato da tools/validate-content.ts (build) e dai test unitari.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CourseSchema, LessonSchema, PieceSchema } from '../src/core/content/schema';
import { checkPiece } from '../src/core/timing/timeline';
import { BadgesFileSchema } from '../src/core/progress/badgeSchema';

export interface ContentReport {
  files: number;
  errors: string[];
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f));
}

function formatZod(file: string, issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((i) => `${file}: ${i.path.map(String).join('.') || '(radice)'}: ${i.message}`);
}

export function checkContent(root = 'content'): ContentReport {
  const errors: string[] = [];
  let files = 0;
  const pieceIds = new Set<string>();

  for (const file of jsonFiles(join(root, 'pieces'))) {
    files++;
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const r = PieceSchema.safeParse(data);
    if (!r.success) {
      errors.push(...formatZod(file, r.error.issues));
      continue;
    }
    const expectedId = file.replace(/\\/g, '/').split('/').pop()!.replace(/\.json$/, '');
    if (r.data.id !== expectedId) errors.push(`${file}: l'id "${r.data.id}" deve coincidere con il nome del file`);
    if (pieceIds.has(r.data.id)) errors.push(`${file}: id duplicato "${r.data.id}"`);
    pieceIds.add(r.data.id);
    errors.push(...checkPiece(r.data).map((e) => `${file}: ${e}`));
  }

  const lessonIds = new Set<string>();
  for (const file of jsonFiles(join(root, 'lessons'))) {
    files++;
    const r = LessonSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!r.success) {
      errors.push(...formatZod(file, r.error.issues));
      continue;
    }
    lessonIds.add(r.data.id);
    for (const step of r.data.steps) {
      if (step.type === 'explain') continue;
      if (typeof step.piece === 'string') {
        if (!pieceIds.has(step.piece)) errors.push(`${file}: step "${step.id}" usa il brano inesistente "${step.piece}"`);
      } else errors.push(...checkPiece(step.piece).map((e) => `${file}: step "${step.id}": ${e}`));
    }
  }

  const coursePath = join(root, 'course.json');
  if (existsSync(coursePath)) {
    files++;
    const r = CourseSchema.safeParse(JSON.parse(readFileSync(coursePath, 'utf8')));
    if (!r.success) errors.push(...formatZod(coursePath, r.error.issues));
    else
      for (const u of r.data.units)
        for (const l of [...u.lessons, ...u.unlock.requiresLessons])
          if (!lessonIds.has(l)) errors.push(`${coursePath}: unità "${u.id}" cita la lezione inesistente "${l}"`);
  }

  const badgesPath = join(root, 'badges.json');
  if (existsSync(badgesPath)) {
    files++;
    const r = BadgesFileSchema.safeParse(JSON.parse(readFileSync(badgesPath, 'utf8')));
    if (!r.success) errors.push(...formatZod(badgesPath, r.error.issues));
    else {
      const course = existsSync(coursePath) ? (JSON.parse(readFileSync(coursePath, 'utf8')) as { units: { id: string }[] }) : { units: [] };
      const units = new Set(course.units.map((u) => u.id));
      const ids = new Set<string>();
      for (const b of r.data.badges) {
        if (ids.has(b.id)) errors.push(`${badgesPath}: badge duplicato "${b.id}"`);
        ids.add(b.id);
        if (b.criterion.type === 'unit' && !units.has(b.criterion.unitId))
          errors.push(`${badgesPath}: il badge "${b.id}" cita l'unità inesistente "${b.criterion.unitId}"`);
      }
    }
  }

  return { files, errors };
}
