// LCP, CLS y peso de cada ruta en el móvil (PLAN §5 y fase 7), con el build servido como en
// Cloudflare Pages: Chromium con la pantalla de un Pixel 7, la red de un 4G lento y la CPU 4 veces
// más lenta (lo que usa Lighthouse en el móvil), en una visita en frío. No es Lighthouse (su
// puntuación pide una herramienta fuera de la lista cerrada): son las dos métricas de §5 y el TBT
// (el tiempo de bloqueo, que pesa un 30 % en su nota de rendimiento), medidos con las API del propio
// navegador. El TBT, como Lighthouse: lo que pasa de 50 ms cada tarea larga desde el FCP, hasta que
// la página se queda quieta (aquí, 1,5 s después de que la red se calme).
//
// Uso: node scripts/measure-web.mjs [--veces 3]   (después de `npm run build`)
/* global PerformanceObserver, window -- dentro de addInitScript() y evaluate(), en la página */
import { chromium, devices } from '@playwright/test';
import { startPagesServer } from './serve-pages.mjs';

const ROUTES = ['/', '/sobre-el-proyecto'];
const timesArg = process.argv.indexOf('--veces');
const TIMES = timesArg > 0 ? Number(process.argv[timesArg + 1]) : 3;
/** La red «4G lento» de Lighthouse: 150 ms de ida y vuelta, 1,6 Mbit/s de bajada y 750 kbit/s de subida. */
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
const CPU_SLOWDOWN = 4;

async function visit(browser, url) {
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.addInitScript(() => {
    window.__web = { lcp: 0, lcpElement: '', cls: 0, fcp: 0, tasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__web.fcp = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__web.tasks.push([entry.startTime, entry.duration]);
      }
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__web.lcp = entry.startTime;
        const element = entry.element;
        window.__web.lcpElement = element
          ? `${element.tagName.toLowerCase()}${element.className ? '.' + String(element.className).split(' ')[0] : ''}`
          : '';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__web.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => ({
    ...window.__web,
    tbt: window.__web.tasks
      .filter(([start]) => start >= window.__web.fcp)
      .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0),
    bytes: performance
      .getEntriesByType('resource')
      .concat(performance.getEntriesByType('navigation'))
      .reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0),
  }));
  await context.close();
  return result;
}

const server = await startPagesServer();
const browser = await chromium.launch();
try {
  for (const route of ROUTES) {
    const runs = [];
    for (let i = 0; i < TIMES; i++) runs.push(await visit(browser, `${server.url}${route}`));
    const lcps = runs.map((run) => Math.round(run.lcp));
    const cls = Math.max(...runs.map((run) => run.cls));
    const tbts = runs.map((run) => Math.round(run.tbt));
    console.log(
      `${route}: LCP ${Math.min(...lcps)}–${Math.max(...lcps)} ms (${runs[0].lcpElement}) · ` +
        `CLS ${cls.toFixed(3)} · TBT ${Math.min(...tbts)}–${Math.max(...tbts)} ms · ` +
        `${(runs[0].bytes / 1000).toFixed(1)} kB en la primera visita`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
