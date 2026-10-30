import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// e2e contra los dos sitios donde tiene que funcionar el audio (PLAN fases 0 y 2):
// - «dev»: `ng serve` (el worklet y el micrófono sintético los genera `npm run e2e` antes, en pree2e);
// - «estatico»: el build prerenderizado (`npm run build` antes), servido como en Cloudflare Pages
//   con `wrangler pages dev` (scripts/serve-pages.mjs): su _headers (CSP incluida), las URLs sin
//   barra final y la 404 de Pages (fase 4);
// - «webkit»: ese mismo build en WebKit de escritorio (reproducir, pausar y menú);
// - «escena-dev» y «escena-estatico»: el escenario 3D (fase 5.b), en los dos sitios, **después** de
//   los demás. El WebGL de Chromium sin interfaz es por software y ocupa la máquina: a la vez que
//   los e2e del audio, que miden tiempos, los frenaría (una cola que entraba antes de verse).
// Chromium sin interfaz va con --mute-audio (lo pone Playwright): el audio se procesa y se mide,
// pero no suena por los altavoces. Su micrófono es un archivo propio (scripts/make-fake-mic.mjs).
// Puertos poco comunes y sin reutilizar un servidor que ya escuche en ellos: en local puede haber
// otro proyecto en el 4200 o el 4300, y un servidor ajeno con «fallback» de SPA responde 200 a todo.
const DEV_PORT = 4317;
const STATIC_PORT = 4318;
const CI = !!process.env['CI'];
const FAKE_MIC = path.resolve('e2e/.generated/fake-mic.wav');

const chromium = {
  ...devices['Desktop Chrome'],
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
    ],
  },
};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // En el CI, «github» deja cada fallo como anotación del commit, visible sin abrir el registro.
  reporter: CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'dev',
      use: { ...chromium, baseURL: `http://localhost:${DEV_PORT}` },
      testIgnore: /(static|hydration|webkit|headers|stage)\.spec\.ts$/,
    },
    {
      name: 'estatico',
      use: { ...chromium, baseURL: `http://localhost:${STATIC_PORT}` },
      testIgnore: /(webkit|stage)\.spec\.ts$/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], baseURL: `http://localhost:${STATIC_PORT}` },
      testMatch: /webkit\.spec\.ts$/,
    },
    {
      name: 'escena-dev',
      use: { ...chromium, baseURL: `http://localhost:${DEV_PORT}` },
      testMatch: /stage\.spec\.ts$/,
      dependencies: ['dev', 'estatico'],
    },
    {
      name: 'escena-estatico',
      use: { ...chromium, baseURL: `http://localhost:${STATIC_PORT}` },
      testMatch: /stage\.spec\.ts$/,
      dependencies: ['dev', 'estatico'],
    },
  ],
  webServer: [
    {
      command: `npx ng serve --port ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // wrangler arranca workerd: unos segundos.
      command: `node scripts/serve-pages.mjs --port ${STATIC_PORT}`,
      url: `http://localhost:${STATIC_PORT}`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
