// Lighthouse en el móvil (PLAN §5 y fase 8, tarea 7), con @lhci/cli: el build servido como en
// Cloudflare Pages (scripts/serve-pages.mjs), tres pasadas por ruta y la mediana contra los umbrales
// de §5. El SEO no es criterio (la vista previa lleva `noindex`). Los informes quedan en
// lighthouse/ (en el CI, como artefacto).
//
// Uso: npm run lighthouse   (después de `npm run build`)
const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}`;

/** La mediana de las tres pasadas, no la mejor (lo que hace @lhci/cli si no se dice). */
const atLeast = (minScore) => ['error', { minScore, aggregationMethod: 'median-run' }];
const atMost = (maxNumericValue) => ['error', { maxNumericValue, aggregationMethod: 'median-run' }];

/** LCP ≤ 2,5 s y CLS ≤ 0,05 en las dos rutas (§5). */
const vitals = {
  'largest-contentful-paint': atMost(2500),
  'cumulative-layout-shift': atMost(0.05),
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: `node scripts/serve-pages.mjs --port ${PORT}`,
      startServerReadyPattern: 'servido como en Cloudflare Pages',
      url: [`${BASE}/`, `${BASE}/sobre-el-proyecto`],
      numberOfRuns: 3,
      settings: {
        // El móvil de Lighthouse (lo que trae por defecto): Moto G Power, 4G lento y CPU ×4.
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        // En las máquinas del CI, Chrome sin el sandbox de espacios de nombres de Ubuntu 24.04.
        chromeFlags: process.env.CI ? '--headless=new --no-sandbox' : '--headless=new',
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '/$',
          assertions: {
            'categories:performance': atLeast(0.9),
            'categories:accessibility': atLeast(0.95),
            'categories:best-practices': atLeast(0.95),
            ...vitals,
          },
        },
        {
          matchingUrlPattern: '/sobre-el-proyecto$',
          assertions: {
            'categories:performance': atLeast(0.95),
            'categories:accessibility': atLeast(0.95),
            'categories:best-practices': atLeast(0.95),
            ...vitals,
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: 'lighthouse' },
  },
};
