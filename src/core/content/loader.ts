/**
 * Caricamento dei contenuti da content/ (inclusi nel bundle e quindi disponibili offline).
 * La validazione completa (Zod + controlli semantici) avviene a build: tools/validate-content.ts.
 */
import type { Piece } from './schema';

const pieceModules = import.meta.glob<Piece>('/content/pieces/*.json', { eager: true, import: 'default' });

const pieces: Piece[] = Object.values(pieceModules).sort((a, b) => a.title.localeCompare(b.title, 'it'));
const byId = new Map(pieces.map((p) => [p.id, p]));

export function listPieces(): Piece[] {
  return pieces;
}

export function getPiece(id: string): Piece | undefined {
  return byId.get(id);
}
