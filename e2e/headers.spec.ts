import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { instrumentAudio } from './support/audio';
import { InstrumentDriver, MENU } from './support/instrument';
import { saveSession } from './support/torno';

// Las cabeceras y las rutas del servidor (PLAN fase 4, tarea 2): el build servido por
// `wrangler pages dev` (scripts/serve-pages.mjs), que aplica su _headers y las reglas de Cloudflare
// Pages como el despliegue. La CSP no puede romper nada del instrumento: worklet, workers de síntesis
// y de exportación, micrófono y descargas por blob:.

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

/** Apunta cada violación de la CSP (directiva y recurso) desde antes de que cargue la página. */
async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations!.push(`${event.effectiveDirective} ${event.blockedURI || 'inline'}`);
    });
  });
}

const violations = (page: Page) => page.evaluate(() => window.__cspViolations ?? []);

test.describe('cabeceras del servidor', () => {
  test('HTML, módulos, worklet y errores llevan sus cabeceras', async ({ request }) => {
    const home = await request.get('/');
    expect(home.status()).toBe(200);
    const headers = home.headers();
    const csp = headers['content-security-policy'] ?? '';
    // script-src: el propio sitio y los scripts en línea por su hash (los pone el build).
    expect(csp).toMatch(/script-src 'self'( 'sha256-[A-Za-z0-9+/]+=*')+;/);
    expect(csp).not.toContain('__SCRIPT_HASHES__');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers['permissions-policy']).toContain('microphone=(self)');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=');
    // Sin COOP ni COEP: no hay SharedArrayBuffer (D7, CLAUDE.md).
    expect(headers['cross-origin-opener-policy']).toBeUndefined();
    expect(headers['cross-origin-embedder-policy']).toBeUndefined();
    // El HTML, con la caché de Pages: se revalida siempre.
    expect(headers['cache-control']).toBe('public, max-age=0, must-revalidate');

    // Los módulos con hash: caché inmutable y tipo JS (también el worklet).
    const html = await home.text();
    const main = /<script src="(main-[A-Za-z0-9_-]+\.js)"/.exec(html)?.[1];
    expect(main).toBeTruthy();
    const script = await request.get(`/${main}`);
    expect(script.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(script.headers()['content-type']).toMatch(/javascript/);
    const css = /href="(styles-[A-Za-z0-9_-]+\.css)"/.exec(html)?.[1];
    expect((await request.get(`/${css}`)).headers()['cache-control']).toContain('immutable');

    // Pages: /ruta/ y /ruta.html redirigen a /ruta; una URL que no existe da 404, con la CSP.
    const slash = await request.get('/sobre-el-proyecto/', { maxRedirects: 0 });
    expect(slash.status()).toBe(308);
    expect(slash.headers()['location']).toBe('/sobre-el-proyecto');
    const dotHtml = await request.get('/sobre-el-proyecto.html', { maxRedirects: 0 });
    expect(dotHtml.status()).toBe(308);
    expect(dotHtml.headers()['location']).toBe('/sobre-el-proyecto');
    expect((await request.get('/sobre-el-proyecto')).status()).toBe(200);
    const missing = await request.get('/no-existe');
    expect(missing.status()).toBe(404);
    expect(missing.headers()['content-security-policy']).toBe(csp);
    // La configuración de Pages no se sirve (Pages da 404; `wrangler pages dev` en Linux, 502,
    // porque busca _headers/index.html), ni la página sin prerenderizar de Angular.
    const config = await request.get('/_headers');
    expect(config.status()).toBeGreaterThanOrEqual(400);
    expect(await config.text()).not.toContain('Content-Security-Policy:');
    expect((await request.get('/index.csr.html')).status()).toBe(404);
  });

  test('la comprobación del despliegue (verify-pages) pasa entera contra Pages en local', async ({
    baseURL,
  }) => {
    // La misma orden que corre tras cada despliegue contra la vista previa (deploy.yml), con el
    // build local: el HTML servido es el del build y la CSP, la de su _headers.
    const { stdout } = await promisify(execFile)(process.execPath, [
      'scripts/verify-pages.mjs',
      baseURL ?? '',
      '--build',
      'dist/torno/browser',
    ]).catch((error: { stdout?: string }) => ({ stdout: error.stdout ?? String(error) }));
    const lines = stdout.split('\n');
    expect(lines.filter((line) => line.startsWith('✖'))).toEqual([]);
    const total = /^(\d+) de \1 bien$/.exec(lines.find((line) => / bien$/.test(line)) ?? '');
    expect(Number(total?.[1])).toBeGreaterThan(30);
  });

  test('el worklet se sirve con su tipo y caché inmutable', async ({ page, request }) => {
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    await driver.chooseSound(MENU.categories.drums);
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    const [module] = await page.evaluate(() => window.__torno?.modules ?? []);
    expect(module).toMatch(/\/audio\/processor\.[A-Z0-9]+\.js$/);
    const response = await request.get(new URL(module!).pathname);
    expect(response.headers()['content-type']).toMatch(/javascript/);
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('con la CSP: tocar, grabar, guardar y exportar sin ninguna violación', async ({ page }) => {
    test.setTimeout(60_000);
    await watchCsp(page);
    await instrumentAudio(page);
    const driver = new InstrumentDriver(page);
    await driver.open();
    // Reproducir: el worklet (script) y el worker de síntesis.
    await driver.chooseSound(MENU.categories.drums);
    await driver.expectScreen('CAPA 1 · BATERÍA · ALFAR');
    await driver.control('play').click();
    await driver.expectScreen('EN MARCHA');
    // Grabar con el micrófono (Permissions-Policy: microphone=(self)).
    await driver.adjust([MENU.loop, MENU.loopItems.countIn], -1);
    await driver.key('main', '2');
    await driver.control('record').click();
    await driver.expectScreen('GRABANDO');
    await page.waitForTimeout(1200);
    await driver.control('record').click();
    await driver.expectScreen('CAPA 2 · GRABACIÓN');
    // Guardar (descarga por blob:) y exportar la mezcla y las pistas (el worker de exportación).
    await saveSession(driver);
    const mix = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportMix, 2);
    await mix;
    await driver.closeMenu();
    const stems = page.waitForEvent('download');
    await driver.menu(MENU.session, MENU.sessionItems.exportStems);
    await stems;
    await driver.closeMenu();
    expect(await violations(page)).toEqual([]);

    // Control: un script en línea sin hash sí se bloquea (la escucha de violaciones funciona).
    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inlineRan = true;';
      document.head.append(script);
      return (window as unknown as { __inlineRan?: boolean }).__inlineRan ?? false;
    });
    expect(ran).toBe(false);
    await expect.poll(() => violations(page)).toEqual(['script-src-elem inline']);
  });
});
