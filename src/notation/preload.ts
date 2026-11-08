/**
 * Avvia in anticipo e in parallelo il download di ciò che serve allo spartito
 * (font musicali + modulo VexFlow), invece di scoprirlo a cascata. Idempotente.
 */
let started = false;

export function preloadNotation(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  const base = `${import.meta.env.BASE_URL}fonts/`;
  for (const f of ['Bravura.woff2', 'Academico.woff2']) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = base + f;
    document.head.appendChild(link);
  }
  void import('./scoreRenderer').then((m) => m.ensureNotationFonts());
}
