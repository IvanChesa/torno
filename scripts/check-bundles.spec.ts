// El comprobador de presupuestos (scripts/check-bundles.mjs) caza lo que tiene que cazar:
// librerías y capas prohibidas en el bundle inicial y tamaños por encima de §5.
import { describe, expect, it } from 'vitest';
import {
  checkBundles,
  eagerResources,
  forbiddenInInitial,
  initialScripts,
  LIMITS,
  PAGES_LIMITS,
} from './check-bundles.mjs';

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
      inputs: { 'src/app/audio/synth/library.ts': { bytesInOutput: 900 } },
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
    ['src/app/audio/synth/library.ts', 'audio'],
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

  it('límites de Pages: falla con un archivo de más de 25 MiB o con más de 20 000 archivos', () => {
    const run = (files: { file: string; bytes: number }[]) =>
      checkBundles(metafile(healthy()), { '/': PAGE }, { ...WORKLET, files });
    expect(run([{ file: 'main-ABC.js', bytes: 250_000 }]).errors).toEqual([]);
    const big = run([
      { file: 'a.bin', bytes: PAGES_LIMITS.fileBytes + 1 },
      { file: 'b.bin', bytes: PAGES_LIMITS.fileBytes + 2 },
      { file: 'c.bin', bytes: PAGES_LIMITS.fileBytes },
    ]).errors.join('\n');
    expect(big).toContain('a.bin');
    expect(big).toContain('b.bin');
    expect(big).not.toContain('c.bin');
    const atLimit = Array.from({ length: PAGES_LIMITS.files }, (_, i) => ({
      file: `f${i}.txt`,
      bytes: 1,
    }));
    expect(run(atLimit).errors).toEqual([]);
    expect(run([...atLimit, { file: 'otro.txt', bytes: 1 }]).errors.join('\n')).toContain(
      'Archivos del despliegue',
    );
  });

  it('lee lo demás que pide una página al cargar (sin las imágenes «lazy»)', () => {
    const html = `<link rel="icon" href="favicon.svg"><link rel="stylesheet" href="styles-A.css">
      <link rel="stylesheet" href="styles-A.css" media="print">
      <picture><source srcset="/img/movil.webp"><img fetchpriority="high" src="/img/poster.webp"></picture>
      <img loading="lazy" src="/img/abajo.webp">`;
    expect(eagerResources(html)).toEqual(['favicon.svg', 'styles-A.css', 'img/poster.webp']);
  });

  it('falla si la primera visita de una ruta pasa de 650 kB (sin el 3D)', () => {
    const page = `${PAGE}<link rel="stylesheet" href="styles-A.css"><img src="/img/poster.webp">`;
    const run = (posterBytes: number) =>
      checkBundles(
        metafile(healthy()),
        { '/': page },
        {
          ...WORKLET,
          files: [
            { file: 'styles-A.css', bytes: 20_000 },
            { file: 'img/poster.webp', bytes: posterBytes },
          ],
        },
      );
    // 250 + 12 kB de JS, 100 de fuentes, 20 de estilos y el HTML: 382 kB y un poco más.
    const base = 250_000 + 12_000 + 100_000 + 20_000 + Buffer.byteLength(page);
    const ok = run(LIMITS.firstVisit.error - base);
    expect(ok.errors).toEqual([]);
    expect(ok.rows.find((row) => row.label === 'Primera visita a /')?.bytes).toBe(
      LIMITS.firstVisit.error,
    );
    expect(run(LIMITS.firstVisit.error - base + 1).errors.join('\n')).toContain(
      'Primera visita a /',
    );
    expect(LIMITS.firstVisit.error).toBe(650_000);
  });

  it('falla si una página pide algo que no se despliega', () => {
    const page = `${PAGE}<img src="/img/no-esta.webp">`;
    const { errors } = checkBundles(metafile(healthy()), { '/': page }, { ...WORKLET, files: [] });
    expect(errors.join('\n')).toContain('img/no-esta.webp no está en lo que se despliega');
  });

  it('falla si un script de la página no está en el metafile o no hay worklet', () => {
    const { errors } = checkBundles(metafile({}), { '/': PAGE }, { worklet: [] });
    expect(errors.join('\n')).toContain('main-ABC.js no está en el metafile');
    expect(errors.join('\n')).toContain('Esperaba un worklet');
  });
});
