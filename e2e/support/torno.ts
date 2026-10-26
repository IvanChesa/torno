import type { Page } from '@playwright/test';
import { clickTable } from '../../src/app/audio/core/metronome';
import { isTornoError, readTorno, type TornoFile } from '../../src/app/audio/files/torno-format';
import { downloadBytes } from './audio';
import { InstrumentDriver, MENU } from './instrument';

/** Guarda la sesión desde el menú (SESIÓN → GUARDAR) y la lee con el formato del proyecto. */
export async function saveSession(
  driver: InstrumentDriver,
): Promise<{ bytes: Uint8Array; file: TornoFile }> {
  const download = driver.page.waitForEvent('download');
  await driver.menu(MENU.session, MENU.sessionItems.save);
  const result = await download;
  await driver.closeMenu();
  const bytes = await downloadBytes(result);
  const file = readTorno(bytes);
  if (isTornoError(file)) throw new Error(`El .torno guardado no vale: ${file}`);
  return { bytes, file };
}

/**
 * Ataques de una señal: la primera muestra que llega al 30 % del pico de su entorno, tras al menos
 * `quietMs` por debajo de `floor`. Así se fecha igual un clic grabado que el de referencia.
 */
export function onsets(
  signal: Float32Array,
  sampleRate: number,
  { floor = 0.02, quietMs = 100, windowMs = 20 } = {},
): number[] {
  const quiet = Math.round((quietMs / 1000) * sampleRate);
  const window = Math.round((windowMs / 1000) * sampleRate);
  const found: number[] = [];
  let silent = quiet;
  for (let i = 0; i < signal.length; i++) {
    const a = Math.abs(signal[i]!);
    if (a < floor) {
      silent++;
      continue;
    }
    if (silent >= quiet) {
      let peak = 0;
      for (let j = i; j < Math.min(signal.length, i + window); j++) {
        peak = Math.max(peak, Math.abs(signal[j]!));
      }
      let onset = i;
      for (let j = Math.max(0, i - window); j < i + window; j++) {
        if (Math.abs(signal[j]!) >= 0.3 * peak) {
          onset = j;
          break;
        }
      }
      found.push(onset);
    }
    silent = 0;
  }
  return found;
}

/** Dónde fecha `onsets` el principio de un clic del metrónomo (en muestras desde que empieza). */
export function clickOnsetOffset(sampleRate: number, frequency: number, gain: number): number {
  const table = clickTable(sampleRate, frequency, gain);
  let peak = 0;
  for (const x of table) peak = Math.max(peak, Math.abs(x));
  return table.findIndex((x) => Math.abs(x) >= 0.3 * peak);
}

/** Simula que la pestaña se oculta (Playwright no puede ocultarla de verdad). */
export function hideTab(page: Page): Promise<void> {
  return page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
