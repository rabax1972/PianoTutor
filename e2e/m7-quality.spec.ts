import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.goto('./');
  await page.getByTestId('input-virtual').tap();
  await expect(page.getByText('Pronto a suonare?')).toBeVisible();
}

/** Controllo WCAG 2.1 A/AA con axe-core sulla pagina corrente. */
async function expectNoA11yViolations(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = res.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} elementi — ${v.nodes[0]?.target.join(' ')}`);
  expect(summary, `violazioni di accessibilità in ${label}`).toEqual([]);
}

test.describe('M7 – qualità: accessibilità, sezioni, tastiera del computer, offline', () => {
  test.setTimeout(120_000);

  test('nessuna violazione WCAG A/AA nelle schermate principali', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('input-virtual')).toBeVisible();
    await expectNoA11yViolations(page, 'benvenuto');
    await page.getByTestId('input-virtual').tap();
    await expect(page.getByTestId('home-goal')).toBeVisible();
    await expectNoA11yViolations(page, 'home');

    for (const [route, ready, label] of [
      ['#/percorso', 'lesson-u1-l01-do-re-mi', 'percorso'],
      ['#/progressi', 'chart-week', 'progressi'],
      ['#/impostazioni', null, 'impostazioni'],
      ['#/diagnostica', null, 'diagnostica'],
      ['#/suona', 'key-60', 'tastiera libera'],
    ] as const) {
      await page.goto(`./${route}`);
      if (ready) await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });
      else await expect(page.locator('h1')).toBeVisible();
      await expectNoA11yViolations(page, label);
    }

    await page.goto('./#/lezione/u1-l01-do-re-mi');
    await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
    await expectNoA11yViolations(page, 'lezione: spiegazione');
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
    await page.getByTestId('start-step').tap();
    await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
    await expectNoA11yViolations(page, 'lezione: esercizio');

    await page.goto('./#/brano/fra-martino');
    await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
    await expectNoA11yViolations(page, 'brano');
  });

  test('ripeti sezione: si esercitano solo le battute scelte', async ({ page }) => {
    await start(page);
    await page.goto('./#/brano/fra-martino');
    await expect(page.locator('.score__track svg')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '⏸ Ti aspetto' }).tap();
    await page.getByTestId('loop-toggle').tap();
    // battute 3–4: "Mi Fa Sol – Mi Fa Sol"
    await page.getByRole('button', { name: 'Alla battuta: più', exact: true }).tap();
    await page.getByRole('button', { name: 'Alla battuta: più', exact: true }).tap();
    await page.getByRole('button', { name: 'Dalla battuta: più', exact: true }).tap();
    await page.getByRole('button', { name: 'Dalla battuta: più', exact: true }).tap();
    await expect(page.getByTestId('loop-from')).toHaveText('3');
    await expect(page.getByTestId('loop-to')).toHaveText('4');
    await page.getByTestId('loop-apply').tap();
    await expect(page.getByTestId('loop-toggle')).toContainText('Battute 3–4');
    await page.getByTestId('play').tap();
    await expect(page.getByTestId('key-64')).toHaveClass(/is-hint/); // la sezione inizia con Mi
    for (const m of [64, 65, 67, 64, 65, 67]) {
      await page.getByTestId(`key-${m}`).tap();
      await page.waitForTimeout(50);
    }
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('100%');
    // solo le 6 note della sezione sono state valutate
    await expect(page.locator('.score__track .vf-stavenote.is-correct')).toHaveCount(6);
  });

  test('si può suonare con la tastiera del computer', async ({ page }) => {
    await start(page);
    await page.getByTestId('tile-free-play').tap();
    await expect(page.getByText(/Tocca un tasto/)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('current-note')).toContainText('Do');
    await page.keyboard.press('KeyG');
    await expect(page.getByTestId('current-note')).toContainText('Sol');
    await page.keyboard.press('KeyW');
    await expect(page.getByTestId('current-note')).toContainText('Do♯');
  });

  test('una lezione funziona completamente offline (spartito e font dalla cache)', async ({ page, context }) => {
    await start(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto('./#/lezione/u1-l01-do-re-mi');
    await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
    await page.getByTestId('start-step').tap();
    await expect(page.locator('.score__track .vf-stavenote').first()).toBeVisible({ timeout: 15_000 });
    // font musicale realmente disponibile (non solo dichiarato)
    await expect.poll(() => page.evaluate(() => document.fonts.check('30px Bravura'))).toBe(true);
    for (const m of [60, 60, 62, 62, 64, 64, 62, 62, 60]) {
      await page.getByTestId(`key-${m}`).tap();
      await page.waitForTimeout(40);
    }
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
