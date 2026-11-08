import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const LESSONS = [
  'u1-l01-do-re-mi',
  'u1-l02-fa-sol',
  'u1-l03-leggere',
  'u2-l01-chiave-di-basso',
  'u2-l02-salti-sinistra',
  'u2-l03-due-mani',
  'u3-l01-semiminime-minime',
  'u3-l02-semibrevi-pause',
  'u3-l03-crome',
];

async function tapNotes(page: Page, midis: number[]) {
  for (const m of midis) {
    await page.getByTestId(`key-${m}`).tap();
    await page.waitForTimeout(50);
  }
}

async function startStep(page: Page) {
  await expect(page.getByTestId('step-intro')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('start-step').tap();
  await expect(page.getByTestId('play')).toHaveAccessibleName('Pausa');
}

/** Completa la lezione 1 con la tastiera a schermo (un errore nel primo esercizio). */
async function completeLesson1(page: Page) {
  await page.goto('./#/lezione/u1-l01-do-re-mi');
  await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
  await startStep(page);
  await page.getByTestId('key-62').tap(); // errore voluto: Re al posto di Do
  await tapNotes(page, [60, 60, 62, 62, 64, 64, 62, 62, 60]);
  await page.getByTestId('continue').tap();
  await startStep(page);
  await tapNotes(page, [64, 62, 60, 60, 62, 64, 64, 62, 60, 62, 60]);
  await page.getByTestId('continue').tap();
  await startStep(page);
  await tapNotes(page, [64, 62, 60, 64, 62, 60, 60, 60, 60, 60, 62, 62, 62, 62, 64, 62, 60]);
  await page.getByTestId('continue').tap();
  await expect(page.getByTestId('lesson-complete')).toBeVisible();
}

test.describe('M6 – percorso, progressi e motivazione', () => {
  test.setTimeout(120_000);

  test('sblocco progressivo, badge e statistiche dopo la prima lezione', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();

    // all'inizio: solo la prima lezione è aperta
    await page.getByTestId('tile-course').tap();
    await expect(page.locator('a[data-testid="lesson-u1-l01-do-re-mi"]')).toBeVisible();
    await expect(page.getByTestId('lesson-u1-l02-fa-sol')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('unit-u2')).toContainText('Completa l’unità «Conosci la tastiera»');

    await completeLesson1(page);
    // badge guadagnati, annunciati con una notifica
    await expect(page.getByTestId('toast').filter({ hasText: 'Nuovo badge' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Prossima lezione →' }).tap();
    await expect(page.getByTestId('slide-text')).toContainText('cinque le dita', { timeout: 15_000 });

    // percorso: lezione 2 sbloccata ed evidenziata
    await page.goto('./#/percorso');
    await expect(page.locator('a[data-testid="lesson-u1-l02-fa-sol"]')).toBeVisible();
    await expect(page.locator('.path__item.is-current')).toContainText('Fa e Sol');
    await expect(page.getByTestId('lesson-u1-l03-leggere')).toHaveAttribute('aria-disabled', 'true');

    // home: "Continua" porta alla lezione successiva
    await page.goto('./#/');
    await expect(page.getByTestId('tile-continue')).toContainText('Continua: Fa e Sol');
    await expect(page.getByTestId('home-goal')).toBeVisible();

    // progressi
    await page.getByTestId('tile-progress').tap();
    await expect(page.getByTestId('lessons-passed')).toHaveText('1/9');
    await expect(page.getByTestId('badge-prima-nota')).toHaveClass(/is-earned/);
    await expect(page.getByTestId('badge-prima-lezione')).toHaveClass(/is-earned/);
    await expect(page.getByTestId('badge-perfetto')).toHaveClass(/is-earned/);
    await expect(page.getByTestId('badge-streak-7')).not.toHaveClass(/is-earned/);
    await expect(page.getByTestId('chart-accuracy').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('chart-week').getByRole('listitem')).toHaveCount(7);
    await expect(page.getByTestId('missed-notes')).toContainText('Do4');
    // tooltip con tastiera/focus
    await page.getByTestId('chart-accuracy').getByRole('listitem').first().focus();
    await expect(page.getByRole('tooltip')).toContainText('%');
  });

  test('obiettivo giornaliero e promemoria (evento di calendario)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.goto('./#/impostazioni');
    await page.getByRole('group', { name: 'Obiettivo giornaliero' }).getByRole('button', { name: '15 min' }).tap();
    await page.getByRole('switch', { name: 'Promemoria quotidiano' }).tap();
    await page.getByLabel('Ora del promemoria').fill('07:30');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-ics').tap()]);
    expect(download.suggestedFilename()).toBe('piano-tutor-promemoria.ics');
    const ics = readFileSync((await download.path())!, 'utf8');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toMatch(/DTSTART:\d{8}T073000/);
    expect(ics).toContain('15 minuti');
    await page.goto('./#/');
    await expect(page.getByTestId('home-goal')).toContainText('di 15 min');
  });

  test('una lezione bloccata aperta dall’indirizzo mostra come sbloccarla', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('input-virtual').tap();
    await page.goto('./#/lezione/u3-l03-crome');
    await expect(page.getByTestId('lesson-locked')).toContainText('almeno una stella');
  });

  for (const id of LESSONS) {
    test(`la lezione ${id} si apre e il suo brano si disegna`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('./');
      await page.getByTestId('input-virtual').tap();
      // modalità insegnante: tutte le lezioni aperte
      await page.goto('./#/impostazioni');
      await page.getByRole('switch', { name: 'Sblocca tutte le lezioni' }).tap();
      await page.goto(`./#/lezione/${id}`);
      await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 20_000 });
      // numero esatto di slide dal JSON (evita di toccare un pulsante che sta scomparendo)
      const lesson = JSON.parse(readFileSync(`content/lessons/${id}.json`, 'utf8')) as { steps: { type: string; slides?: unknown[] }[] };
      const slides = lesson.steps[0]!.slides!.length;
      for (let i = 0; i < slides; i++) await page.getByTestId('next-slide').tap();
      await expect(page.getByTestId('step-intro')).toBeVisible();
      await expect(page.locator('.score__track .vf-stavenote').first()).toBeVisible({ timeout: 20_000 });
      expect(errors).toEqual([]);
    });
  }
});
