import { expect, test } from '@playwright/test';

test.describe('M1 – scheletro PWA e tastiera a schermo', () => {
  test('al primo avvio si sceglie la modalità e si suona la tastiera', async ({ page }) => {
    await page.goto('./');

    // Primo avvio: schermata di scelta dell'input
    await expect(page.getByRole('heading', { name: /Benvenuto/ })).toBeVisible();
    await page.getByTestId('input-virtual').tap();

    // Home
    await expect(page.getByText('Pronto a suonare?')).toBeVisible();
    await page.getByTestId('tile-free-play').tap();

    // Tastiera libera: attende il caricamento dei campioni, poi suona Do centrale e Sol
    await expect(page.getByText(/Tocca un tasto/)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('key-60').tap();
    await expect(page.getByTestId('current-note')).toContainText('Do');
    await page.getByTestId('key-67').tap();
    await expect(page.getByTestId('current-note')).toContainText('Sol');
  });

  test('la scelta dell’input viene ricordata dopo il ricaricamento', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await expect(page.getByText('Pronto a suonare?')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Pronto a suonare?')).toBeVisible();
  });

  test('il manifest PWA è valido e in italiano', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}manifest.webmanifest`);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toBe('Piano Tutor');
    expect(m.lang).toBe('it');
    expect(m.display).toBe('standalone');
    expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });

  test('l’app funziona offline dopo il primo caricamento', async ({ page, context }) => {
    await page.goto('./');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // ora la pagina è controllata dal service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Benvenuto/ })).toBeVisible();
    const sampleOk = await page.evaluate(async () => (await fetch('samples/piano/C4.mp3')).ok);
    expect(sampleOk).toBe(true);
  });
});
