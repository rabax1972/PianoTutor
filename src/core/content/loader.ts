/**
 * Caricamento dei contenuti da content/ (inclusi nel bundle e quindi disponibili offline).
 * La validazione completa (Zod + controlli semantici) avviene a build: tools/validate-content.ts.
 */
import courseJson from '../../../content/course.json';
import type { Course, Lesson, Piece, Step } from './schema';

const pieceModules = import.meta.glob<Piece>('/content/pieces/*.json', { eager: true, import: 'default' });
const lessonModules = import.meta.glob<Lesson>('/content/lessons/*.json', { eager: true, import: 'default' });

const pieces: Piece[] = Object.values(pieceModules).sort((a, b) => a.title.localeCompare(b.title, 'it'));
const piecesById = new Map(pieces.map((p) => [p.id, p]));
const lessonsById = new Map(Object.values(lessonModules).map((l) => [l.id, l]));
const course = courseJson as unknown as Course;

export function listPieces(): Piece[] {
  return pieces;
}

export function getPiece(id: string): Piece | undefined {
  return piecesById.get(id);
}

export function getCourse(): Course {
  return course;
}

export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

/** Brano di uno step: riferimento a content/pieces oppure brano inline. */
export function resolveStepPiece(step: Extract<Step, { piece: unknown }>): Piece {
  if (typeof step.piece !== 'string') return step.piece;
  const p = piecesById.get(step.piece);
  if (!p) throw new Error(`Brano non trovato: ${step.piece}`);
  return p;
}

/** Lezione successiva nel corso (anche nell'unità seguente). */
export function nextLessonId(id: string): string | undefined {
  const all = course.units.flatMap((u) => u.lessons);
  const i = all.indexOf(id);
  return i >= 0 ? all[i + 1] : undefined;
}
