// El comprobador de presupuestos (scripts/check-bundles.mjs) caza lo que tiene que cazar:
// librerías y capas prohibidas en el bundle inicial y tamaños por encima de §5.
import { describe, expect, it } from 'vitest';
import { checkBundles, forbiddenInInitial, initialScripts, LIMITS } from './check-bundles.mjs';

interface Output {
  bytes: number;
  entryPoint?: string;
  inputs: Record<string, { bytesInOutput: number }>;
}

const PAGE = `<html><head>
  <link rel="modulepreload" href="chunk-HOME.js">
  <script src="main-ABC.js" type="module"></script>
</head></html>`;

function metafile(outputs: Record<string, Output>) {
  return { outputs };
}

/** Un build sano: main, la portada con el desbloqueo, el motor diferido, un worker y fuentes. */
function healthy(): Record<string, Output> {
  return {
    'main-ABC.js': { bytes: 250_000, inputs: { 'src/main.ts': { bytesInOutput: 100 } } },
    'chunk-HOME.js': {
      bytes: 12_000,
      entryPoint: 'src/app/pages/home/home-page.ts',
      inputs: {
        'src/app/audio/engine/index.ts': { bytesInOutput: 300 },
        'src/app/audio/engine/unlock.ts': { bytesInOutput: 400 },
      },
    },
    'chunk-PROBE.js': {
      bytes: 3_000,
      entryPoint: 'src/app/audio/engine/probe.ts',
      inputs: { 'src/app/audio/core/protocol.ts': { bytesInOutput: 500 } },
    },
    'worker-ABCD1234.js': {
      bytes: 1_300,
      entryPoint: 'src/app/audio/workers/synth.worker.ts',
      inputs: { 'src/app/audio/synth/tone.ts': { bytesInOutput: 900 } },
    },
    'media/font-AAAA.woff2': { bytes: 100_000, inputs: {} },
  };
}

const WORKLET = { worklet: [{ file: 'audio/processor.ABC.js', bytes: 1_900 }] };

describe('check-bundles', () => {
  it('lee los scripts iniciales de una página prerenderizada', () => {
    expect(initialScripts(PAGE)).toEqual(['main-ABC.js', 'chunk-HOME.js']);
  });

  it.each([
    ['node_modules/three/build/three.module.js', 'three'],
    ['src/app/audio/core/loop-core.ts', 'audio'],
    ['src/app/audio/synth/tone.ts', 'audio'],
    ['src/app/audio/worklet/processor.ts', 'audio'],
    ['src/app/audio/engine/probe.ts', 'motor'],
    ['src/app/scene/engine.ts', 'escena'],
  ])('%s no puede ir en el inicial (%s)', (input, reason) => {
    expect(forbiddenInInitial(input)).toBe(reason);
  });

  it.each([
    'src/app/audio/engine/index.ts',
    'src/app/audio/engine/unlock.ts',
    'src/app/scene/index.ts',
    'src/app/app.ts',
  ])('%s sí puede ir en el inicial', (input) => {
    expect(forbiddenInInitial(input)).toBeUndefined();
  });

  it('un build sano pasa sin errores ni avisos y mide el desbloqueo', () => {
    const result = checkBundles(metafile(healthy()), { '/': PAGE }, WORKLET);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    const unlock = result.rows.find((row) => row.label.startsWith('Desbloqueo'));
    expect(unlock?.bytes).toBe(700);
  });

  it('falla si three o el motor entran en el bundle inicial', () => {
    const outputs = healthy();
    const home = outputs['chunk-HOME.js']!;
    home.inputs['node_modules/three/build/three.module.js'] = { bytesInOutput: 1 };
    home.inputs['src/app/audio/engine/probe.ts'] = { bytesInOutput: 1 };
    const { errors } = checkBundles(metafile(outputs), { '/': PAGE }, WORKLET);
    expect(errors.join('\n')).toContain('three');
    expect(errors.join('\n')).toContain('probe.ts (motor)');
  });

  it('avisa por encima de 330 kB de JS inicial y falla por encima de 400 kB', () => {
    const outputs = healthy();
    // main + la portada (12 kB) justo en el aviso: no avisa.
    outputs['main-ABC.js'] = { bytes: LIMITS.initialJs.warn - 12_000, inputs: {} };
    const atLimit = checkBundles(metafile(outputs), { '/': PAGE }, WORKLET);
    expect(atLimit.warnings).toEqual([]);

    outputs['main-ABC.js'] = { bytes: 325_000, inputs: {} };
    const warned = checkBundles(metafile(outputs), { '/': PAGE }, WORKLET);
    expect(warned.errors).toEqual([]);
    expect(warned.warnings.join('\n')).toContain('JS inicial de /');

    outputs['main-ABC.js'] = { bytes: LIMITS.initialJs.error, inputs: {} };
    const failed = checkBundles(metafile(outputs), { '/': PAGE }, WORKLET);
    expect(failed.errors.join('\n')).toContain('JS inicial de /');
  });

  it('falla si el worklet, un worker, el motor o las fuentes se pasan de su límite', () => {
    const outputs = healthy();
    outputs['worker-ABCD1234.js'] = { ...outputs['worker-ABCD1234.js']!, bytes: 60_001 };
    outputs['chunk-PROBE.js'] = { ...outputs['chunk-PROBE.js']!, bytes: 60_001 };
    outputs['media/font-BBBB.woff2'] = { bytes: 50_001, inputs: {} };
    const { errors } = checkBundles(
      metafile(outputs),
      { '/': PAGE },
      {
        worklet: [{ file: 'audio/processor.ABC.js', bytes: 60_001 }],
      },
    );
    expect(errors).toHaveLength(4);
  });

  it('falla si un script de la página no está en el metafile o no hay worklet', () => {
    const { errors } = checkBundles(metafile({}), { '/': PAGE }, { worklet: [] });
    expect(errors.join('\n')).toContain('main-ABC.js no está en el metafile');
    expect(errors.join('\n')).toContain('Esperaba un worklet');
  });
});
