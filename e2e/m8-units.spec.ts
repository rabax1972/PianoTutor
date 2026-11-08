import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('./');
  await page.getByTestId('input-virtual').tap();
  await expect(page.getByText('Pronto a suonare?')).toBeVisible();
  // modalità insegnante: le unità 4-6 sono aperte senza completare le precedenti
  await page.goto('./#/impostazioni');
  await page.getByRole('switch', { name: 'Sblocca tutte le lezioni' }).tap();
}

/** Apre una lezione e arriva all'esercizio guidato (o libero con skipGuided). */
async function openStep(page: Page, id: string, step: 'guidato' | 'libero' = 'guidato') {
  const lesson = JSON.parse(readFileSync(`content/lessons/${id}.json`, 'utf8')) as { steps: { slides?: unknown[] }[] };
  await page.goto(`./#/lezione/${id}`);
  await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < lesson.steps[0]!.slides!.length; i++) await page.getByTestId('next-slide').tap();
  await expect(page.getByTestId('step-intro')).toBeVisible();
  await page.getByTestId('start-step').tap();
  await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
  if (step === 'libero') throw new Error('non usato');
}

async function tap(page: Page, ...midis: number[]) {
  for (const m of midis) {
    await page.getByTestId(`key-${m}`).tap();
    await page.waitForTimeout(40);
  }
}

test.describe('M8 – due mani, accordi, alterazioni e scale', () => {
  test.setTimeout(120_000);

  test('due mani insieme: ogni battuta richiede sia la destra sia la sinistra', async ({ page }) => {
    await start(page);
    await openStep(page, 'u4-l01-mani-insieme');
    // primo istante: Do4 (destra) + Do3 (sinistra) suggeriti insieme
    await expect(page.getByTestId('key-60')).toHaveClass(/is-hint/);
    await expect(page.getByTestId('key-48')).toHaveClass(/is-hint/);
    await tap(page, 60); // solo la destra: il brano aspetta ancora la sinistra
    await expect(page.getByTestId('key-48')).toHaveClass(/is-hint/);
    // Re Mi Fa | Sol+Mi3 | Fa+Sol3 Mi Re Do | Do+Do3
    await tap(page, 48, 62, 64, 65, 67, 52, 65, 55, 64, 62, 60, 60, 48);
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('100%');
  });

  test('una mano alla volta: si suona la destra, l’app suona la sinistra', async ({ page }) => {
    await start(page);
    await page.goto('./#/brano/ode-alla-gioia-due-mani');
    await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '⏸ Ti aspetto' }).tap();
    await page.getByRole('button', { name: 'Destra', exact: true }).tap();
    await page.getByTestId('play').tap();
    await expect(page.getByTestId('key-48')).not.toHaveClass(/is-hint/); // la sinistra non è richiesta
    const ode = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60];
    await tap(page, ...ode);
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('100%');
    await expect(page.locator('.score__track .vf-stavenote.is-correct')).toHaveCount(30); // solo le note della destra
  });

  test('alterazioni: nomi corretti su spartito, tastiera e messaggi', async ({ page }) => {
    await start(page);
    await openStep(page, 'u6-l01-diesis-bemolle');
    await expect(page.locator('.score__track svg text', { hasText: 'Fa♯' }).first()).toBeVisible();
    await expect(page.getByTestId('key-66')).toContainText('Fa♯'); // nome sul tasto nero
    await tap(page, 62, 64);
    await tap(page, 65); // Fa naturale al posto di Fa♯
    await expect(page.getByTestId('feedback')).toContainText('Cerca il Fa♯');

    // tonalità con bemolle: Si♭ (non La♯) sullo spartito e sulla tastiera
    await page.goto('./#/brano/greensleeves');
    await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('key-68')).toContainText('Sol♯');
  });

  test('accordi: sigle sopra il rigo e accordo completato con tre note', async ({ page }) => {
    await start(page);
    await openStep(page, 'u5-l02-maggiore-minore');
    for (const chord of ['Do', 'Fa', 'Sol']) await expect(page.locator('.score__track svg text', { hasText: new RegExp(`^${chord}$`) }).first()).toBeAttached();
    await tap(page, 60, 64, 67); // Do maggiore
    await expect(page.getByTestId('key-65')).toHaveClass(/is-hint/); // ora Fa maggiore
    await tap(page, 65, 69, 72, 67, 71, 74, 60, 64, 67);
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('100%');
  });

  test('scala: le dita suggerite seguono il passaggio del pollice', async ({ page }) => {
    await start(page);
    await openStep(page, 'u6-l02-scala-do');
    await tap(page, 60, 62, 64);
    await expect(page.getByTestId('key-65').locator('.pk-finger')).toHaveText('1'); // pollice sotto, sul Fa
  });
});
