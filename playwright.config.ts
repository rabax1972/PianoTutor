import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE = process.env.BASE_PATH ?? '/pianotutor/';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    hasTouch: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'tablet-landscape', use: { browserName: 'chromium', viewport: { width: 1194, height: 834 } } },
    { name: 'tablet-portrait', use: { browserName: 'chromium', viewport: { width: 834, height: 1194 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
