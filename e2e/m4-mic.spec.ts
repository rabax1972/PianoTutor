import { expect, test, type Page } from '@playwright/test';

/**
 * Test con microfono finto: Chromium riproduce in loop e2e/fixtures/do-re-mi.wav
 * (Do Do Re Re Mi Mi Re Re Do, timbro sintetico tipo pianoforte).
 */

async function chooseMic(page: Page) {
  await page.goto('./');
  await page.getByTestId('input-mic').tap();
  await expect(page.getByTestId('calib-intro')).toBeVisible();
}

test.describe('M4 – microfono', () => {
  test.setTimeout(90_000);

  test('calibrazione: permesso, intonazione e riepilogo', async ({ page }) => {
    await chooseMic(page);
    await page.getByTestId('calib-enable').tap();
    await expect(page.getByTestId('calib-noise')).toBeVisible();
    await expect(page.getByTestId('mic-meter')).toBeVisible();
    // il WAV contiene musica, non silenzio: saltiamo la misura del rumore
    await page.getByRole('button', { name: 'Salta' }).tap();

    await expect(page.getByTestId('calib-tune')).toBeVisible();
    await page.getByRole('button', { name: 'Misura' }).tap();
    await expect(page.getByTestId('calib-info')).toContainText('ben intonato', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Avanti →' }).tap();

    await expect(page.getByTestId('calib-latency')).toBeVisible();
    await page.getByRole('button', { name: 'Fine →' }).tap();
    await expect(page.getByTestId('calib-done')).toBeVisible();
    // sintetizzatore perfettamente intonato: diapason entro ±1 Hz da 440
    await expect(page.getByText(/La = 4(39|40|41)(,\d)? Hz/)).toBeVisible();
  });

  test('la diagnostica mostra le note rilevate dal microfono', async ({ page }) => {
    await chooseMic(page);
    await page.getByTestId('calib-skip').tap();
    await expect(page.getByTestId('home-calibrate')).toBeVisible(); // invito a calibrare
    await page.goto('./#/diagnostica');
    await expect(page.getByText('✅ in ascolto')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('mic-note')).toHaveText(/^(Do|Re|Mi)4/, { timeout: 15_000 });
  });

  test('esercizio guidato suonato "al pianoforte" (microfono)', async ({ page }) => {
    await chooseMic(page);
    await page.getByTestId('calib-skip').tap();
    await page.goto('./#/lezione/u1-l01-do-re-mi');
    await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
    await expect(page.getByTestId('step-intro')).toBeVisible();
    await page.getByTestId('start-step').tap();
    // il "pianoforte" suona la sequenza: il brano avanza nota dopo nota fino al risultato
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.score__track .vf-stavenote.is-correct, .score__track .vf-stavenote.is-early')).toHaveCount(9);
  });
});
