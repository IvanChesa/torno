import { defineConfig, devices } from '@playwright/test';

// e2e en Chromium contra los dos sitios donde tiene que funcionar el audio (PLAN fase 0):
// - «dev»: `ng serve` (el worklet lo genera `npm run e2e` antes, en pree2e);
// - «estatico»: el build prerenderizado servido en local (`npm run build` antes).
// Chromium sin interfaz va con --mute-audio (lo pone Playwright): el audio se procesa y se mide,
// pero no suena por los altavoces.
const DEV_PORT = 4200;
const STATIC_PORT = 4300;
const CI = !!process.env['CI'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'dev',
      use: { baseURL: `http://localhost:${DEV_PORT}` },
      testIgnore: /static\.spec\.ts$/,
    },
    {
      name: 'estatico',
      use: { baseURL: `http://localhost:${STATIC_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx ng serve --port ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      command: `node scripts/serve-static.mjs --port ${STATIC_PORT}`,
      url: `http://localhost:${STATIC_PORT}`,
      reuseExistingServer: !CI,
    },
  ],
});
