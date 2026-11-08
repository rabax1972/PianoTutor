import { expect, test, type Page } from '@playwright/test';

async function openSong(page: Page, id: string) {
  await page.goto('./');
  await page.getByTestId('input-virtual').tap();
  await page.getByTestId('tile-songs').tap();
  await page.getByTestId(`song-${id}`).tap();
  await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
}

const trackX = (page: Page) =>
  page.locator('.score__track').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test.describe('M2 – spartito ed evidenziazione', () => {
  test('disegna Fra Martino ed evidenzia la prima nota da suonare', async ({ page }) => {
    await openSong(page, 'fra-martino');
    // 32 note + nessuna pausa
    await expect(page.locator('.score__track .vf-stavenote')).toHaveCount(32);
    // da fermi all'inizio la prima nota è già evidenziata come corrente
    await expect(page.locator('.score__track .vf-stavenote.is-current')).toHaveCount(1);
    // chiave fissa a sinistra
    await expect(page.locator('.score__header svg')).toBeVisible();
    // la tastiera suggerisce il Do centrale con il dito 1
    await expect(page.getByTestId('key-60')).toHaveClass(/is-hint/);
    await expect(page.getByTestId('key-60').locator('.pk-finger')).toHaveText('1');
  });

  test('durante la riproduzione lo spartito scorre e la nota corrente avanza', async ({ page }) => {
    await openSong(page, 'fra-martino');
    const x0 = await trackX(page);
    await page.getByTestId('play').tap();
    await expect(page.getByTestId('play')).toHaveAccessibleName('Pausa');
    // dopo il conteggio (1 battuta a 100 bpm = 2,4 s) le note diventano correnti
    await expect(page.locator('.score__track .vf-stavenote.is-current')).toHaveCount(1, { timeout: 6_000 });
    await page.waitForTimeout(800);
    const x1 = await trackX(page);
    expect(x1).toBeLessThan(x0 - 50);
    await page.getByTestId('play').tap(); // pausa
    const xp = await trackX(page);
    await page.waitForTimeout(400);
    expect(Math.abs((await trackX(page)) - xp)).toBeLessThan(1);
    // dall'inizio
    await page.getByTestId('restart').tap();
    await expect.poll(() => trackX(page)).toBeCloseTo(x0, 0);
  });

  test('brano a due mani: grand staff con pause automatiche', async ({ page }) => {
    await openSong(page, 'passeggiata');
    const staves = await page.locator('.score__track .vf-stave').count();
    expect(staves).toBe(12); // 6 battute × 2 righi
    await expect(page.locator('.score__track .vf-stavenote')).toHaveCount(25); // 17 note + 1 pausa (R) + 7 note (L)
  });

  test('tutti i brani si disegnano senza errori', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.getByTestId('tile-songs').tap();
    await expect(page.locator('[data-testid^="song-"]').first()).toBeVisible({ timeout: 15_000 }); // pagina caricata in lazy
    const ids = await page.locator('[data-testid^="song-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(5)));
    expect(ids.length).toBeGreaterThanOrEqual(4);
    for (const id of ids) {
      await page.goto(`./#/brano/${id}`);
      await expect(page.locator('.score__track .vf-stavenote').first()).toBeVisible({ timeout: 15_000 });
    }
    expect(errors).toEqual([]);
  });
});
