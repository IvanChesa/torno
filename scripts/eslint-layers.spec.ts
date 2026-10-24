// Demuestra que ESLint hace cumplir las capas de la arquitectura (PLAN §4.2): pasa código real
// por la configuración del repo (eslint.config.mjs) como si estuviera en cada carpeta.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LAYER_RULES = new Set([
  'torno/capas',
  'no-restricted-globals',
  'no-restricted-properties',
  'no-restricted-syntax',
  'no-console',
]);

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT });
});

/** Mensajes de las reglas de capas para `code` en `file` (ruta relativa a la raíz). */
async function layerMessages(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId !== null && LAYER_RULES.has(message.ruleId))
    .map((message) => message.message);
}

describe('capas de la arquitectura (ESLint)', { timeout: 60_000 }, () => {
  const forbidden: [file: string, code: string, reason: string][] = [
    // TS puro: ni Angular, ni three, ni otras capas, ni navegador, ni azar.
    ['src/app/audio/core/x.ts', "import { signal } from '@angular/core';", '«@angular/core»'],
    ['src/app/audio/core/x.ts', "import { Mesh } from 'three';", '`three` solo se importa'],
    ['src/app/audio/core/x.ts', "import { from } from 'rxjs';", '«rxjs»'],
    ['src/app/audio/core/x.ts', "import { SITE_CONFIG } from '../../core/site.config';", '«core»'],
    ['src/app/audio/core/x.ts', "import { renderTone } from '../synth/tone';", '«audio/synth»'],
    ['src/app/audio/core/x.ts', 'export const w = window.innerWidth;', 'TS puro'],
    ['src/app/audio/core/x.ts', 'export const t = setTimeout(() => 0, 1);', 'TS puro'],
    ['src/app/audio/synth/x.ts', 'export const r = Math.random();', 'determinista'],
    ['src/app/audio/synth/x.ts', "import { unlockAudio } from '../engine';", '«audio/engine»'],
    ['src/app/audio/files/x.ts', 'export const d = document.title;', 'TS puro'],
    [
      'src/app/instrument/x.ts',
      "import { BeepGenerator } from '../audio/core/beep';",
      '«audio/core»',
    ],
    // Worklet: solo audio/core.
    ['src/app/audio/worklet/x.ts', "import { renderTone } from '../synth/tone';", '«audio/synth»'],
    // Workers: synth, core y files; nada del motor.
    [
      'src/app/audio/workers/x.ts',
      "import { unlockAudio } from '../engine/unlock';",
      '«audio/engine»',
    ],
    // Motor: sin Angular, sin síntesis (va en el worker).
    ['src/app/audio/engine/x.ts', "import { inject } from '@angular/core';", '«@angular/core»'],
    ['src/app/audio/engine/x.ts', "import { renderTone } from '../synth/tone';", '«audio/synth»'],
    // Escena: sin Angular y sin audio.
    ['src/app/scene/x.ts', "import { signal } from '@angular/core';", '«@angular/core»'],
    ['src/app/scene/x.ts', "import { unlockAudio } from '../audio/engine';", '«audio/engine»'],
    // Componentes: solo las API públicas del motor y de la escena, también con import().
    ['src/app/features/x/x.ts', "import { Mesh } from 'three';", '`three` solo se importa'],
    [
      'src/app/features/x/x.ts',
      "import { BeepGenerator } from '../../audio/core/beep';",
      '«audio/core»',
    ],
    [
      'src/app/features/x/x.ts',
      "import { runWorkletProbe } from '../../audio/engine/probe';",
      'API pública',
    ],
    [
      'src/app/features/x/x.ts',
      "export const m = () => import('../../audio/engine/probe');",
      'API pública',
    ],
    [
      'src/app/features/x/x.ts',
      "export const s = () => import('../../scene/engine');",
      'API pública',
    ],
    ['src/app/features/x/x.ts', "export * from '../../audio/synth/tone';", '«audio/synth»'],
    [
      'src/app/pages/x/x.ts',
      "import { unlockedContext } from '../../audio/engine/unlock';",
      'API pública',
    ],
    ['src/app/state/x.ts', "import { HomePage } from '../pages/home/home-page';", '«pages»'],
    ['src/app/features/x/x.ts', "import { App } from '../../app';", '«app»'],
    // Solo el motor toca Web Audio, el micrófono y los workers.
    ['src/app/features/x/x.ts', 'export const c = new AudioContext();', 'Web Audio'],
    ['src/app/features/x/x.ts', 'export const m = navigator.mediaDevices;', 'micrófono'],
    [
      'src/app/features/x/x.ts',
      "export const w = new Worker(new URL('./w.worker', import.meta.url));",
      'crea workers',
    ],
    // …tampoco dando un rodeo por el objeto global.
    ['src/app/features/x/x.ts', 'export const c = new window.AudioContext();', 'Web Audio'],
    ['src/app/state/x.ts', 'export const c = new globalThis.AudioContext();', 'Web Audio'],
    [
      'src/app/pages/x/x.ts',
      'export const m = window.navigator.mediaDevices.getUserMedia({ audio: true });',
      'micrófono',
    ],
    // Higiene: nada de console.log olvidados.
    ['src/app/features/x/x.ts', "console.log('depurando');", 'console'],
    // Ruta caliente del hilo de audio: process*/render* no reservan memoria ni lanzan.
    [
      'src/app/audio/core/x.ts',
      'export class A { process(): number[] { return [1]; } }',
      'ruta caliente',
    ],
    [
      'src/app/audio/core/x.ts',
      'export class A { renderMix(out: Float32Array): number { return out.subarray(1).length; } }',
      'ruta caliente',
    ],
    [
      'src/app/audio/worklet/x.ts',
      'export class A { process(): boolean { const f = () => 1; return f() > 0; } }',
      'ruta caliente',
    ],
    [
      'src/app/audio/core/x.ts',
      'export function renderAll(x: number): string { return `${x}`; }',
      'ruta caliente',
    ],
    [
      'src/app/audio/core/x.ts',
      "export class A { processInto(): void { throw new RangeError('x'); } }",
      'ruta caliente',
    ],
  ];

  it.each(forbidden)('rechaza en %s: %s', async (file, code, reason) => {
    const messages = await layerMessages(file, code);
    expect(messages.length, `sin error para: ${code}`).toBeGreaterThan(0);
    expect(messages.join('\n')).toContain(reason);
  });

  const allowed: [file: string, code: string][] = [
    ['src/app/audio/core/x.ts', "import { BeepGenerator } from './beep';"],
    ['src/app/audio/synth/x.ts', "import { PROTOCOL_VERSION } from '../core/protocol';"],
    ['src/app/audio/worklet/x.ts', "import { BeepGenerator } from '../core/beep';"],
    ['src/app/audio/workers/x.ts', "import { renderTone } from '../synth/tone';"],
    [
      'src/app/audio/engine/x.ts',
      "import { PROTOCOL_VERSION } from '../core/protocol';\n" +
        "export const w = new Worker(new URL('../workers/synth.worker', import.meta.url));\n" +
        'export const c = new AudioContext();',
    ],
    ['src/app/scene/x.ts', "import { Mesh } from 'three';\nimport { X } from '../instrument';"],
    ['src/app/features/x/x.ts', "import { unlockAudio } from '../../audio/engine';"],
    ['src/app/features/x/x.ts', "export const s = () => import('../../scene');"],
    ['src/app/features/x/x.ts', "console.error('algo ha fallado');"],
    [
      'src/app/audio/engine/x.ts',
      'export const m = window.navigator.mediaDevices.getUserMedia({ audio: true });',
    ],
    [
      'src/app/pages/x/x.ts',
      "import { AudioProbe } from '../../features/audio-probe/audio-probe';",
    ],
    [
      'src/app/audio/core/x.spec.ts',
      "import { it } from 'vitest';\nimport { hash } from 'node:crypto';",
    ],
    // Fuera de la ruta caliente (comandos, render sin conexión) sí se puede reservar.
    [
      'src/app/audio/core/x.ts',
      'export class A { handle(): number[] { return [1]; } process(out: Float32Array): void { out[0] = 1; } }',
    ],
    [
      'src/app/audio/core/x.ts',
      'export function renderOffline(): Float32Array { return new Float32Array(4); }',
    ],
  ];

  it.each(allowed)('permite en %s: %s', async (file, code) => {
    expect(await layerMessages(file, code)).toEqual([]);
  });
});
