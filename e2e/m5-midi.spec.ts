import { expect, test, type Page } from '@playwright/test';

/**
 * Tastiera MIDI simulata: sostituisce navigator.requestMIDIAccess con un dispositivo finto
 * ("Tastiera di prova") pilotabile dal test con window.__midi.
 */
const FAKE_MIDI = () => {
  class FakeInput extends EventTarget {
    id = 'fake-1';
    name = 'Tastiera di prova';
    manufacturer = 'Piano Tutor Test';
    type = 'input';
    state = 'connected';
    connection = 'open';
  }
  class FakeAccess extends EventTarget {
    inputs = new Map<string, FakeInput>();
    outputs = new Map();
    sysexEnabled = false;
  }
  const access = new FakeAccess();
  const kb = new FakeInput();
  access.inputs.set(kb.id, kb);
  const send = (data: number[]) => {
    const ev = new Event('midimessage');
    Object.defineProperty(ev, 'data', { value: new Uint8Array(data) });
    kb.dispatchEvent(ev);
  };
  (window as unknown as { __midi: object }).__midi = {
    press: (note: number, vel = 100) => send([0x90, note, vel]),
    release: (note: number) => send([0x80, note, 0]),
    tap: (note: number) => {
      send([0x90, note, 100]);
      send([0x80, note, 0]);
    },
    unplug: () => {
      kb.state = 'disconnected';
      access.dispatchEvent(new Event('statechange'));
    },
    plug: () => {
      kb.state = 'connected';
      access.dispatchEvent(new Event('statechange'));
    },
  };
  Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { value: () => Promise.resolve(access), configurable: true });
};

type Midi = { press(n: number, v?: number): void; release(n: number): void; tap(n: number): void; unplug(): void; plug(): void };
const midi = (page: Page) => ({
  press: (n: number, v = 100) => page.evaluate(([n, v]) => (window as unknown as { __midi: Midi }).__midi.press(n!, v), [n, v]),
  release: (n: number) => page.evaluate((n) => (window as unknown as { __midi: Midi }).__midi.release(n), n),
  tap: (n: number) => page.evaluate((n) => (window as unknown as { __midi: Midi }).__midi.tap(n), n),
  unplug: () => page.evaluate(() => (window as unknown as { __midi: Midi }).__midi.unplug()),
  plug: () => page.evaluate(() => (window as unknown as { __midi: Midi }).__midi.plug()),
});

async function chooseMidi(page: Page) {
  await page.addInitScript(FAKE_MIDI);
  await page.goto('./');
  await page.getByTestId('input-midi').tap();
  await expect(page.getByTestId('midi-setup')).toBeVisible();
}

test.describe('M5 – tastiera MIDI', () => {
  test.setTimeout(60_000);

  test('configurazione: dispositivo trovato, prova dei tasti, suono dal tablet', async ({ page }) => {
    await chooseMidi(page);
    await expect(page.getByTestId('midi-device')).toContainText('Tastiera di prova');
    await midi(page).press(60, 127);
    await expect(page.getByTestId('midi-last-note')).toHaveText('Do4');
    await midi(page).tap(67);
    await expect(page.getByTestId('midi-last-note')).toHaveText('Sol4');
    const sw = page.getByRole('switch', { name: 'Suona dal tablet' });
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await sw.tap();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('midi-done').tap();
    await expect(page.getByText('Pronto a suonare?')).toBeVisible();
  });

  test('esercizio guidato suonato sulla tastiera MIDI', async ({ page }) => {
    await chooseMidi(page);
    await page.getByTestId('midi-done').tap();
    await page.goto('./#/lezione/u1-l01-do-re-mi');
    await expect(page.getByTestId('slide-text')).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 5; i++) await page.getByTestId('next-slide').tap();
    await page.getByTestId('start-step').tap();
    await expect(page.getByTestId('midi-chip')).toContainText('Tastiera di prova');

    // il tasto tenuto sulla tastiera fisica appare premuto anche sullo schermo
    await midi(page).press(60);
    await expect(page.getByTestId('key-60')).toHaveClass(/is-down/);
    await midi(page).release(60);
    for (const n of [60, 62, 62, 64, 64, 62, 62, 60]) {
      await midi(page).tap(n);
      await page.waitForTimeout(40);
    }
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('100%');
    await expect(page.getByRole('img', { name: '3 stelle su 3' })).toBeVisible();
  });

  test('scollegamento e ricollegamento a caldo', async ({ page }) => {
    await chooseMidi(page);
    await page.getByTestId('midi-done').tap();
    await page.getByTestId('tile-free-play').tap();
    await expect(page.getByTestId('midi-chip')).toBeVisible();
    await midi(page).tap(64);
    await expect(page.getByTestId('current-note')).toContainText('Mi');

    await midi(page).unplug();
    await expect(page.getByTestId('midi-banner')).toContainText('Nessuna tastiera MIDI collegata');
    await expect(page.getByTestId('midi-chip')).toHaveCount(0);

    await midi(page).plug();
    await expect(page.getByTestId('midi-banner')).toHaveCount(0);
    await midi(page).tap(65);
    await expect(page.getByTestId('current-note')).toContainText('Fa');
  });

  test('la diagnostica mostra dispositivi e messaggi MIDI', async ({ page }) => {
    await chooseMidi(page);
    await page.getByTestId('midi-done').tap();
    await page.goto('./#/diagnostica');
    await expect(page.getByTestId('midi-diagnostics')).toContainText('Tastiera di prova');
    await midi(page).press(60, 100);
    await expect(page.getByTestId('midi-last-message')).toContainText('90 3C 64');
  });

  test('browser senza Web MIDI (es. Safari su iPad): opzione disattivata con spiegazione', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Navigator.prototype as unknown as Record<string, unknown>).requestMIDIAccess;
    });
    await page.goto('./');
    const tile = page.getByTestId('input-midi');
    await expect(tile).toHaveAttribute('aria-disabled', 'true');
    await expect(tile).toContainText('Non disponibile');
    await expect(tile).toContainText('Safari su iPad');
  });
});
