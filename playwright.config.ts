import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 4173;
const BASE = process.env.BASE_PATH ?? '/pianotutor/';
const MIC_FIXTURE = resolve('e2e/fixtures/do-re-mi.wav');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // le schermate si caricano in lazy: sotto il carico dell'intera suite servono attese un po' più lunghe
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // audio + rendering dello spartito sono pesanti: troppi browser in parallelo falsano i tempi
  workers: process.env.CI ? 2 : 4,
  // i test di timing (audio, microfono) possono risentire del carico della macchina di CI
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    hasTouch: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    {
      name: 'tablet-landscape',
      testIgnore: /m4-mic/,
      use: { browserName: 'chromium', viewport: { width: 1194, height: 834 } },
    },
    {
      name: 'tablet-portrait',
      testIgnore: /m4-mic/,
      use: { browserName: 'chromium', viewport: { width: 834, height: 1194 } },
    },
    {
      // microfono finto: Chromium riproduce un WAV sintetico (Do Do Re Re Mi Mi Re Re Do) in loop
      name: 'mic',
      testMatch: /m4-mic/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1194, height: 834 },
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${MIC_FIXTURE}`,
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
