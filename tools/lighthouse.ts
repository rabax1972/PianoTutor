/**
 * Audit Lighthouse (Performance, Accessibilità, Best Practices) di più pagine della build.
 *
 * Uso:  npm run audit                     (build + audit, emulazione mobile con CPU rallentata 4×)
 *       npm run lighthouse -- --desktop   (solo audit della build esistente, profilo desktop)
 *       npm run lighthouse -- --runs=5    (misure per pagina; si riporta la mediana)
 * Chrome: usa CHROME_PATH se impostata, altrimenti il Chromium installato da Playwright.
 * Esce con codice 1 se una categoria (mediana) è sotto la soglia (90).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
// configurazione desktop ufficiale (rete veloce, CPU non rallentata, schermo grande)
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { preview } from 'vite';

const PORT = 4190;
const BASE = `http://127.0.0.1:${PORT}/pianotutor/`;
const THRESHOLD = 90;
const CATEGORIES = ['performance', 'accessibility', 'best-practices'];
const desktop = process.argv.includes('--desktop');
/** misure per pagina: si riporta la mediana (Lighthouse varia molto tra un giro e l'altro) */
const RUNS = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 3);
const PAGES = ['', '#/percorso', '#/lezione/u1-l01-do-re-mi', '#/brano/fra-martino', '#/progressi', '#/impostazioni', '#/brani'];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

function findChrome(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '', '.cache'), 'ms-playwright');
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = join(root, dir, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

// preview() si risolve quando il server è già in ascolto
const server = await preview({ base: '/pianotutor/', preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
let failed = false;
try {
  const chrome = await chromeLauncher.launch({ chromePath: findChrome(), chromeFlags: ['--headless=new'] });
  try {
    console.log(`Lighthouse (${desktop ? 'desktop' : 'mobile, CPU 4× più lenta'}) — mediana di ${RUNS} misure, soglia ${THRESHOLD}\n`);
    console.log('pagina'.padEnd(30), 'perf', ' a11y', ' best');
    for (const page of PAGES) {
      const runs: { scores: number[]; issues: Set<string> }[] = [];
      for (let i = 0; i < RUNS; i++) {
        const res = await lighthouse(
          BASE + page,
          { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES },
          desktop ? desktopConfig : undefined,
        );
        if (!res) continue;
        const issues = new Set<string>();
        for (const a of Object.values(res.lhr.audits))
          if (a.score !== null && a.score < 0.9 && ['binary', 'numeric'].includes(a.scoreDisplayMode) && !a.id.endsWith('-insight') && a.id !== 'valid-source-maps')
            issues.add(a.id);
        runs.push({ scores: CATEGORIES.map((k) => Math.round((res.lhr.categories[k]?.score ?? 0) * 100)), issues });
      }
      if (!runs.length) continue;
      const scores = CATEGORIES.map((_, i) => median(runs.map((r) => r.scores[i]!)));
      if (scores.some((x) => x < THRESHOLD)) failed = true;
      const perfAll = runs.map((r) => r.scores[0]).join('/');
      console.log((page || '(avvio)').padEnd(30), ...scores.map((x) => String(x).padStart(4) + (x < THRESHOLD ? '✗' : ' ')), `  perf: ${perfAll}`);
      // problemi presenti in almeno metà delle misure
      const count = new Map<string, number>();
      runs.forEach((r) => r.issues.forEach((id) => count.set(id, (count.get(id) ?? 0) + 1)));
      for (const [id, n] of count) if (n * 2 >= runs.length) console.log('   ·', id);
    }
  } finally {
    await chrome.kill();
  }
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
