import { expect, test, type Page } from '@playwright/test';

const KEY: Record<string, number> = { C: 60, D: 62, E: 64, F: 65, G: 67 };

async function playNotes(page: Page, notes: string) {
  for (const n of notes.split(' ')) {
    await page.getByTestId(`key-${KEY[n]}`).tap();
    await page.waitForTimeout(60);
  }
}

async function startStep(page: Page) {
  await expect(page.getByTestId('step-intro')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('start-step').tap();
  await expect(page.getByTestId('play')).toHaveAccessibleName('Pausa');
}

test.describe('M3 – prima lezione completa con la tastiera a schermo', () => {
  test.setTimeout(90_000);

  test('spiegazione → esercizio guidato → libero → brano → lezione completata', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.getByTestId('tile-course').tap();
    await page.getByTestId('lesson-u1-l01-do-re-mi').tap();

    // 1. Spiegazione: 5 slide
    await expect(page.getByTestId('slide-text')).toContainText('tasti neri', { timeout: 15_000 }); // pagina caricata in lazy
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();

    // 2. Esercizio guidato (wait mode): un errore, poi le note giuste
    await startStep(page);
    await expect(page.getByTestId('key-60')).toHaveClass(/is-hint/); // suggerimento sul Do
    await page.getByTestId('key-65').tap(); // Fa: sbagliato
    await expect(page.getByTestId('feedback')).toContainText('Cerca il Do');
    await playNotes(page, 'C C D D E E D D C');
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('90%');
    await expect(page.locator('.score__track .vf-stavenote.is-correct')).toHaveCount(8);
    await expect(page.locator('.score__track .vf-stavenote.is-early')).toHaveCount(1); // giusta dopo l'errore
    await page.getByTestId('continue').tap();

    // 3. Esercizio libero: nessun suggerimento sulla tastiera
    await startStep(page);
    await expect(page.locator('.pk-key.is-hint')).toHaveCount(0);
    await playNotes(page, 'E D C C D E E D C D C');
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByRole('img', { name: '3 stelle su 3' })).toBeVisible();
    await page.getByTestId('continue').tap();

    // 4. Brano "Panini caldi" (propone di ascoltare prima)
    await expect(page.getByTestId('listen-first')).toBeVisible();
    await startStep(page);
    await playNotes(page, 'E D C E D C C C C C D D D D E D C');
    await expect(page.getByTestId('result')).toBeVisible();
    await page.getByTestId('continue').tap();

    // 5. Fine lezione e progresso salvato
    await expect(page.getByTestId('lesson-complete')).toBeVisible();
    await expect(page.getByTestId('lesson-complete').getByRole('img', { name: '3 stelle su 3' })).toBeVisible();
    await page.getByRole('button', { name: 'Torna al percorso' }).tap();
    await expect(page.getByTestId('lesson-u1-l01-do-re-mi')).toContainText('★★★');
    await page.reload();
    await expect(page.getByTestId('lesson-u1-l01-do-re-mi')).toContainText('★★★');
  });

  test('“Riprova” ricomincia l’esercizio da capo', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.goto('./#/lezione/u1-l01-do-re-mi');
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
    await startStep(page);
    await playNotes(page, 'C C D D E E D D C');
    await expect(page.getByTestId('result')).toBeVisible();
    await page.getByTestId('retry').tap();
    await startStep(page);
    await expect(page.locator('.score__track .vf-stavenote.is-correct')).toHaveCount(0);
    await expect(page.getByTestId('key-60')).toHaveClass(/is-hint/);
  });

  test('modalità “A tempo”: le note non suonate risultano mancate', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.goto('./#/brano/panini-caldi');
    await page.getByRole('button', { name: '⏱ A tempo' }).tap();
    await page.getByTestId('play').tap();
    await expect(page.getByText('Pronti… 1, 2, 3, 4')).toBeVisible();
    // senza suonare nulla: alla fine 0% e note rosse
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('0%');
    await expect(page.locator('.score__track .vf-stavenote.is-wrong')).toHaveCount(17);
  });
});
