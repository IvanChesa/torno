import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Prueba técnica del audio (PLAN fase 0, tareas 5 y 6) contra `ng serve` y contra el build
// estático: el worklet carga, procesa y suena; el worker de síntesis responde; nada se crea antes
// del gesto, y el contexto se crea y se reanuda dentro del clic aunque el módulo tarde.
//
// Dos límites de Chromium con Playwright, y cómo se cubren:
// - No enseña las descargas de los módulos de AudioWorklet (ni en los eventos de red ni en
//   `page.route`): la instrumentación envuelve `AudioWorklet.addModule` para contar las cargas y
//   retrasarlas, y el tipo MIME del módulo se comprueba con una petición directa.
// - Deja sonar un `AudioContext` creado sin gesto, así que «está en running» no demuestra nada.
//   Se anota el evento que se está despachando (`window.event`) al crear el contexto y al llamar
//   a `resume()`: tiene que ser el `click`. Límite: el código que sigue a un `await` sobre una
//   promesa ya resuelta corre todavía dentro del despacho y no se distinguiría.

interface AudioProbeLog {
  contexts: AudioContext[];
  modules: string[];
  /** «new:<evento>» y «resume:<evento>», con el evento en curso o «ninguno». */
  calls: string[];
}

declare global {
  interface Window {
    __torno?: AudioProbeLog;
  }
}

const WORKLET = /\/audio\/processor\.[A-Z0-9]+\.js$/;

/** Registra los AudioContext, sus `resume()` y las cargas del worklet (con un retraso opcional). */
async function instrumentAudio(page: Page, moduleDelayMs = 0): Promise<void> {
  await page.addInitScript((delayMs) => {
    const log: AudioProbeLog = { contexts: [], modules: [], calls: [] };
    window.__torno = log;
    const currentEvent = () => window.event?.type ?? 'ninguno';
    const NativeContext = window.AudioContext;
    const resume = NativeContext.prototype.resume;
    NativeContext.prototype.resume = function (this: AudioContext) {
      log.calls.push(`resume:${currentEvent()}`);
      return resume.call(this);
    };
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        log.contexts.push(this);
        log.calls.push(`new:${currentEvent()}`);
      }
    };
    const addModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = async function (url, options) {
      log.modules.push(String(url));
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return addModule.call(this, url, options);
    };
  }, moduleDelayMs);
}

const contextStates = (page: Page) =>
  page.evaluate(() => (window.__torno?.contexts ?? []).map((context) => context.state));
const loadedModules = (page: Page) => page.evaluate(() => window.__torno?.modules ?? []);
const audioCalls = (page: Page) => page.evaluate(() => window.__torno?.calls ?? []);

async function openHome(page: Page, moduleDelayMs = 0): Promise<void> {
  await instrumentAudio(page, moduleDelayMs);
  await page.goto('/');
  // Con la hidratación terminada, el clic llega directo al componente (sin repetición de eventos).
  await page.waitForLoadState('networkidle');
}

test.describe('prueba técnica del audio', () => {
  test('nada se crea ni se carga antes del gesto', async ({ page }) => {
    const workers: string[] = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    await openHome(page);
    expect(await contextStates(page)).toEqual([]);
    expect(await audioCalls(page)).toEqual([]);
    expect(await loadedModules(page)).toEqual([]);
    expect(workers).toEqual([]);
  });

  test('la instrumentación distingue un contexto creado fuera del gesto', async ({ page }) => {
    await openHome(page);
    // Control negativo: tras un await de verdad (una tarea nueva), ya no hay evento en curso.
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new AudioContext().close();
    });
    expect(await audioCalls(page)).toEqual(['new:ninguno']);
  });

  test('el módulo del worklet se sirve con hash y como JavaScript', async ({ request }) => {
    const generated = await readFile('src/app/audio/engine/worklet-url.generated.ts', 'utf8');
    const workletPath = /WORKLET_PATH = '([^']+)'/.exec(generated)?.[1] ?? '';
    expect(`/${workletPath}`).toMatch(WORKLET);
    const response = await request.get(`/${workletPath}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/javascript/);
    expect(await response.text()).toContain('registerProcessor');
  });

  test('el pitido suena por el AudioWorklet: la salida no es silencio', async ({ page }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Probar el pitido' }).click();

    const status = page.getByTestId('worklet-probe');
    await expect(status).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
    // El contexto se creó y se reanudó dentro del clic, antes de cualquier await (PLAN §4.9).
    expect(await audioCalls(page)).toEqual(['new:click', 'resume:click']);
    expect(await contextStates(page)).toEqual(['running']);
    const modules = await loadedModules(page);
    expect(modules).toHaveLength(1);
    expect(new URL(modules[0] ?? '').pathname).toMatch(WORKLET);
    await expect(status).toHaveAttribute('data-context-state', 'running');
    // El pitido es de ganancia 0,25 (−12 dBFS): medido a la salida, no es silencio ni satura.
    const peak = Number(await status.getAttribute('data-peak-dbfs'));
    expect(peak).toBeGreaterThan(-13);
    expect(peak).toBeLessThan(-11);
    // El worklet avisa de la duración exacta: 0,5 s en muestras a la frecuencia del contexto.
    expect(await status.getAttribute('data-frames')).toBe(
      await status.getAttribute('data-expected-frames'),
    );
    await expect(status).toContainText('Ha sonado');
  });

  test('el contexto se crea y se reanuda dentro del clic aunque el módulo tarde 1,5 s', async ({
    page,
  }) => {
    await openHome(page, 1500);
    const clickedAt = Date.now();
    await page.getByRole('button', { name: 'Probar el pitido' }).click();

    // Antes de que llegue el módulo, el contexto ya se creó y se reanudó en el clic, y está en marcha.
    await expect.poll(() => contextStates(page), { timeout: 1000 }).toEqual(['running']);
    expect(Date.now() - clickedAt).toBeLessThan(1500);
    expect(await audioCalls(page)).toEqual(['new:click', 'resume:click']);
    const status = page.getByTestId('worklet-probe');
    await expect(status).toHaveAttribute('data-state', 'running');

    // Y cuando llega, suena.
    await expect(status).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
    expect(Date.now() - clickedAt).toBeGreaterThanOrEqual(1500);
    expect(Number(await status.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-13);
  });

  test('el worker de síntesis renderiza el tono y suena', async ({ page }) => {
    await openHome(page);
    const worker = page.waitForEvent('worker');
    await page.getByRole('button', { name: 'Probar el sintetizador' }).click();
    expect(new URL((await worker).url()).pathname).toMatch(/^\/worker-[A-Z0-9]+\.js$/);

    const status = page.getByTestId('synth-probe');
    await expect(status).toHaveAttribute('data-state', 'done', { timeout: 10_000 });
    expect(await audioCalls(page)).toEqual(['new:click', 'resume:click']);
    // Un segundo exacto a la frecuencia del contexto, con pico 0,3 (−10,5 dBFS).
    expect(await status.getAttribute('data-frames')).toBe(
      await status.getAttribute('data-expected-frames'),
    );
    const peak = Number(await status.getAttribute('data-peak-dbfs'));
    expect(peak).toBeGreaterThan(-11.5);
    expect(peak).toBeLessThan(-9.5);
  });
});
