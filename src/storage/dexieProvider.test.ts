import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDexieProvider } from './dexieProvider';
import { DEFAULT_SETTINGS } from './types';

let n = 0;
const fresh = () => createDexieProvider(`test-db-${n++}`);

describe('dexieProvider', () => {
  it('restituisce le impostazioni di default al primo avvio', async () => {
    const s = await fresh().settings.load();
    expect(s.inputMode).toBeNull();
    expect(s.noteNaming).toBe('italian');
  });

  it('salva e rilegge le impostazioni', async () => {
    const p = fresh();
    await p.settings.save({ ...DEFAULT_SETTINGS, inputMode: 'virtual', colorNotes: true });
    const s = await p.settings.load();
    expect(s.inputMode).toBe('virtual');
    expect(s.colorNotes).toBe(true);
    expect(s.updatedAt).toBeGreaterThan(0);
  });

  it('accumula il tempo di pratica per giorno', async () => {
    const p = fresh();
    await p.stats.addPractice('2026-11-08', 60_000);
    await p.stats.addPractice('2026-11-08', 30_000);
    await p.stats.addPractice('2026-11-09', 10_000);
    const days = await p.stats.listPracticeDays();
    expect(days.find((d) => d.date === '2026-11-08')!.practiceMs).toBe(90_000);
    expect(await p.stats.listPracticeDays('2026-11-09')).toHaveLength(1);
  });

  it('assegna un badge una sola volta', async () => {
    const p = fresh();
    expect(await p.stats.awardBadge('prima-nota')).toBe(true);
    expect(await p.stats.awardBadge('prima-nota')).toBe(false);
    expect(await p.stats.listBadges()).toHaveLength(1);
  });
});
