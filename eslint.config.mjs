// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- Capas de la arquitectura (docs/PLAN.md §4.2) ---------------------------------------------
//
// Cada archivo de src/app pertenece a la capa de su carpeta más concreta. Un import relativo solo
// puede llegar a su propia capa o a las de `allow`; `allow` con `:api` significa «solo por su
// index.ts». `urls` son las capas a las que puede apuntar con `new URL('…', import.meta.url)` (los
// workers). `packages` es la lista de paquetes permitidos (`only`) o prohibidos (`deny`).
//
// La regla mira imports estáticos, `export … from`, `import()` dinámicos y `new URL(…)`, que es
// lo que `no-restricted-imports` no ve (y por patrones confunde `core/` con `audio/core/`).

/** @typedef {{ only: string[] } | { deny: string[] }} PackageRule */
/** @typedef {{ name: string, dir: string, allow: string[], urls?: string[], packages: PackageRule }} Layer */

const NO_PACKAGES = { only: [] };
const NOT_THREE = { deny: ['three'] };
const ENGINE_API = 'audio/engine:api';
const SCENE_API = 'scene:api';

/** @type {Layer[]} */
const LAYERS = [
  { name: 'audio/core', dir: 'src/app/audio/core', allow: [], packages: NO_PACKAGES },
  { name: 'audio/synth', dir: 'src/app/audio/synth', allow: ['audio/core'], packages: NO_PACKAGES },
  { name: 'audio/files', dir: 'src/app/audio/files', allow: ['audio/core'], packages: NO_PACKAGES },
  {
    name: 'audio/worklet',
    dir: 'src/app/audio/worklet',
    allow: ['audio/core'],
    packages: NO_PACKAGES,
  },
  {
    name: 'audio/workers',
    dir: 'src/app/audio/workers',
    allow: ['audio/core', 'audio/synth', 'audio/files'],
    packages: NO_PACKAGES,
  },
  {
    name: 'audio/engine',
    dir: 'src/app/audio/engine',
    allow: ['audio/core', 'audio/files'],
    urls: ['audio/workers'],
    packages: NO_PACKAGES,
  },
  { name: 'instrument', dir: 'src/app/instrument', allow: [], packages: NO_PACKAGES },
  { name: 'scene', dir: 'src/app/scene', allow: ['instrument'], packages: { only: ['three'] } },
  { name: 'core', dir: 'src/app/core', allow: [], packages: NOT_THREE },
  {
    name: 'state',
    dir: 'src/app/state',
    allow: ['core', 'instrument', ENGINE_API, SCENE_API],
    packages: NOT_THREE,
  },
  {
    name: 'features',
    dir: 'src/app/features',
    allow: ['core', 'instrument', 'state', ENGINE_API, SCENE_API],
    packages: NOT_THREE,
  },
  {
    name: 'pages',
    dir: 'src/app/pages',
    allow: ['core', 'instrument', 'state', 'features', ENGINE_API, SCENE_API],
    packages: NOT_THREE,
  },
  {
    name: 'app',
    dir: 'src/app',
    allow: ['core', 'instrument', 'state', 'features', 'pages', ENGINE_API, SCENE_API],
    packages: NOT_THREE,
  },
];

/** Capas que no pueden salir de src/app (salvo en sus tests). */
const SEALED = new Set([
  'audio/core',
  'audio/synth',
  'audio/files',
  'audio/worklet',
  'audio/workers',
  'audio/engine',
  'instrument',
  'scene',
]);

/** Paquetes que los tests pueden usar además de los de su capa. */
const TEST_PACKAGES = ['vitest', 'node:'];

/** @param {string} file ruta relativa a la raíz, con `/` */
function layerOf(file) {
  let best;
  for (const layer of LAYERS) {
    if (file === layer.dir || file.startsWith(`${layer.dir}/`)) {
      if (!best || layer.dir.length > best.dir.length) best = layer;
    }
  }
  return best;
}

/** @param {string} specifier @param {string} rule */
function matchesPackage(specifier, rule) {
  if (rule.endsWith(':') || rule.endsWith('/')) return specifier.startsWith(rule);
  return specifier === rule || specifier.startsWith(`${rule}/`);
}

/**
 * Devuelve el motivo por el que `specifier` no se puede usar desde `file`, o `undefined`.
 * @param {string} file @param {string} specifier @param {'import' | 'url'} kind
 */
export function layerViolation(file, specifier, kind = 'import') {
  const layer = layerOf(file);
  if (!layer) return undefined;
  const isTest = /\.spec\.ts$/.test(file);

  if (!specifier.startsWith('.')) {
    if (isTest && TEST_PACKAGES.some((p) => matchesPackage(specifier, p))) return undefined;
    const rule = layer.packages;
    const allowed =
      'only' in rule
        ? rule.only.some((p) => matchesPackage(specifier, p))
        : !rule.deny.some((p) => matchesPackage(specifier, p));
    if (allowed) return undefined;
    if (matchesPackage(specifier, 'three')) {
      return '`three` solo se importa dentro de src/app/scene/ (PLAN §4.2).';
    }
    return `La capa «${layer.name}» no puede importar el paquete «${specifier}» (PLAN §4.2).`;
  }

  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  const targetLayer = layerOf(target);
  if (!targetLayer) {
    if (SEALED.has(layer.name) && !isTest) {
      return `La capa «${layer.name}» no puede importar nada de fuera de src/app (PLAN §4.2).`;
    }
    return undefined;
  }
  if (targetLayer === layer) return undefined;
  if (layer.allow.includes(targetLayer.name)) return undefined;
  if (kind === 'url' && layer.urls?.includes(targetLayer.name)) return undefined;
  if (layer.allow.includes(`${targetLayer.name}:api`)) {
    const isApi = [targetLayer.dir, `${targetLayer.dir}/index`, `${targetLayer.dir}/index.ts`];
    if (isApi.includes(target)) return undefined;
    return `«${layer.name}» solo llega a «${targetLayer.name}» por su API pública (${targetLayer.dir}/index.ts) (PLAN §4.2).`;
  }
  return `La capa «${layer.name}» no puede importar de «${targetLayer.name}» (PLAN §4.2).`;
}

/** @type {import('eslint').Rule.RuleModule} */
const layersRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Capas de la arquitectura de Torno (docs/PLAN.md §4.2).' },
    schema: [],
    messages: { forbidden: '{{reason}}' },
  },
  create(context) {
    const file = path.relative(ROOT, context.filename).replaceAll('\\', '/');
    if (!layerOf(file)) return {};
    /** @param {import('estree').Node} node @param {unknown} value @param {'import' | 'url'} kind */
    const check = (node, value, kind) => {
      if (typeof value !== 'string') return;
      const reason = layerViolation(file, value, kind);
      if (reason) context.report({ node, messageId: 'forbidden', data: { reason } });
    };
    return {
      ImportDeclaration: (node) => check(node.source, node.source.value, 'import'),
      ExportNamedDeclaration: (node) =>
        node.source && check(node.source, node.source.value, 'import'),
      ExportAllDeclaration: (node) => check(node.source, node.source.value, 'import'),
      ImportExpression: (node) =>
        node.source.type === 'Literal' && check(node.source, node.source.value, 'import'),
      NewExpression(node) {
        // new URL('./x.worker', import.meta.url): referencia a un módulo que empaqueta el builder.
        const [first, second] = node.arguments;
        const isUrl = node.callee.type === 'Identifier' && node.callee.name === 'URL';
        const isMetaUrl =
          second?.type === 'MemberExpression' &&
          second.object.type === 'MetaProperty' &&
          second.property.type === 'Identifier' &&
          second.property.name === 'url';
        if (isUrl && isMetaUrl && first?.type === 'Literal') check(first, first.value, 'url');
      },
    };
  },
};

// --- Lo que solo puede tocar audio/engine/ y lo que no existe en las capas de TS puro ----------

const ENGINE_ONLY =
  'Solo src/app/audio/engine/ toca Web Audio, el micrófono y el almacenamiento del audio (PLAN §4.2).';
const WEB_AUDIO_GLOBALS = [
  'AudioContext',
  'webkitAudioContext',
  'OfflineAudioContext',
  'AudioWorkletNode',
  'AudioBuffer',
  'AudioBufferSourceNode',
  'AnalyserNode',
  'GainNode',
  'MediaStream',
  'MediaStreamAudioSourceNode',
  'MediaRecorder',
  'indexedDB',
].map((name) => ({ name, message: ENGINE_ONLY }));

const PURE =
  'Las capas de TS puro no usan el navegador ni Node: se ejecutan igual en el worklet, en los workers y en los tests (PLAN §4.2).';
const browserGlobals = (names) => names.map((name) => ({ name, message: PURE }));
const DOM_GLOBALS = browserGlobals([
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'Worker',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]);
const RUNTIME_GLOBALS = browserGlobals([
  'self',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'process',
]);

const MEDIA_DEVICES = { object: 'navigator', property: 'mediaDevices', message: ENGINE_ONLY };
const DETERMINISM =
  'El audio es determinista (PLAN D8): usa un generador con semilla y el reloj de muestras.';
const NON_DETERMINISTIC = [
  { object: 'Math', property: 'random', message: DETERMINISM },
  { object: 'Date', property: 'now', message: DETERMINISM },
  { object: 'performance', property: 'now', message: DETERMINISM },
];
const NEW_WORKER = {
  selector: "NewExpression[callee.name='Worker']",
  message: 'Solo src/app/audio/engine/ crea workers (PLAN §4.2).',
};

// Variables globales de Node para los scripts .mjs (sin el paquete `globals`, fuera de la lista).
const NODE_GLOBALS = Object.fromEntries(
  [
    'process',
    'console',
    'URL',
    'URLSearchParams',
    'Buffer',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'performance',
    'structuredClone',
    'TextEncoder',
    'TextDecoder',
    'AbortController',
    'fetch',
  ].map((name) => [name, 'readonly']),
);

export default defineConfig([
  {
    ignores: [
      'dist/',
      '.angular/',
      'coverage/',
      'node_modules/',
      'public/audio/',
      'test-results/',
      'playwright-report/',
      'out/',
      '.claude/',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'trn', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'trn', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: NODE_GLOBALS },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },

  // --- Capas ---
  {
    files: ['src/**/*.ts'],
    plugins: { torno: { rules: { capas: layersRule } } },
    rules: { 'torno/capas': 'error' },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/app/audio/engine/**'],
    rules: {
      'no-restricted-globals': ['error', ...WEB_AUDIO_GLOBALS],
      'no-restricted-properties': ['error', MEDIA_DEVICES],
      'no-restricted-syntax': ['error', NEW_WORKER],
    },
  },
  {
    files: ['src/app/audio/core/**/*.ts', 'src/app/audio/synth/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-globals': ['error', ...WEB_AUDIO_GLOBALS, ...DOM_GLOBALS, ...RUNTIME_GLOBALS],
      'no-restricted-properties': ['error', MEDIA_DEVICES, ...NON_DETERMINISTIC],
    },
  },
  {
    files: [
      'src/app/audio/files/**/*.ts',
      'src/app/audio/worklet/**/*.ts',
      'src/app/instrument/**/*.ts',
    ],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-globals': ['error', ...WEB_AUDIO_GLOBALS, ...DOM_GLOBALS, ...RUNTIME_GLOBALS],
    },
  },
  {
    files: ['src/app/audio/workers/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-globals': ['error', ...WEB_AUDIO_GLOBALS, ...DOM_GLOBALS],
    },
  },
]);
