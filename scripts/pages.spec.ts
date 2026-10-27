// El build para Cloudflare Pages (PLAN D19 y fase 4, tarea 2): lo que dice public/_headers para cada
// URL, su analizador y el paso tras el build (scripts/pages.mjs), que reorganiza las rutas, completa
// la CSP con los hashes de los scripts en línea y comprueba la caché de cada archivo.
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { headersFor, parseHeaders } from './pages-headers.mjs';
import {
  applyScriptHashes,
  cacheProblem,
  HEADERS_LIMITS,
  headersLimitProblems,
  inlineHandlers,
  inlineScripts,
  isHashed,
  PLACEHOLDER,
  processBuild,
  routeFile,
  scriptHash,
  servedPath,
} from './pages.mjs';

const SOURCE = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const rules = parseHeaders(SOURCE);
const header = (url: string, name: string) => headersFor(rules, url).get(name);
const YEAR = 'public, max-age=31536000, immutable';

/** Archivos como los de un build real (los nombres con hash, de uno de verdad). */
const BUILD_FILES = [
  'index.html',
  'sobre-el-proyecto.html',
  '404.html',
  'main-XRTRA2B6.js',
  'chunk-DJVAsKa_.js',
  'chunk-U_8ZRXDg.js',
  'styles-6C34OBR7.css',
  'worker-YAR6FGUI.js',
  'audio/processor.JUKLXABX.js',
  'media/fraunces-latin-full-normal-2NUMMRN6.woff2',
  'favicon.svg',
  'licencias/terceros.txt',
  'licencias/fraunces-OFL.txt',
];

describe('public/_headers', () => {
  it('cabeceras de seguridad para todo: CSP, Permissions-Policy, nosniff…', () => {
    const csp = header('/', 'content-security-policy') ?? '';
    expect(csp).toContain(`script-src 'self' ${PLACEHOLDER};`);
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
    // Los scripts nunca en línea sin hash; los estilos sí (los de los componentes de Angular).
    expect(/script-src[^;]*unsafe-inline/.test(csp)).toBe(false);
    expect(header('/', 'permissions-policy')).toContain('microphone=(self)');
    expect(header('/', 'x-content-type-options')).toBe('nosniff');
    expect(header('/', 'x-frame-options')).toBe('DENY');
    // La misma política en todo: el JS, el worklet, la 404 y cualquier URL desconocida.
    for (const url of ['/main-XRTRA2B6.js', '/audio/processor.JUKLXABX.js', '/404', '/no/existe']) {
      expect(header(url, 'content-security-policy'), url).toBe(csp);
    }
  });

  it('sin COOP ni COEP (no hay SharedArrayBuffer, CLAUDE.md)', () => {
    expect(header('/', 'cross-origin-opener-policy')).toBeUndefined();
    expect(header('/', 'cross-origin-embedder-policy')).toBeUndefined();
  });

  it('noindex en torno.pages.dev; las vistas previas lo llevan de Pages', () => {
    expect(header('https://torno.pages.dev/', 'x-robots-tag')).toBe('noindex');
    expect(header('https://torno.pages.dev/sobre-el-proyecto', 'x-robots-tag')).toBe('noindex');
    // `:project` no casa con «staging.torno»: el noindex de la vista previa lo pone Pages.
    expect(header('https://staging.torno.pages.dev/', 'x-robots-tag')).toBeUndefined();
    expect(header('https://torno.ivanchesa.es/', 'x-robots-tag')).toBeUndefined();
    expect(header('/', 'x-robots-tag')).toBeUndefined();
  });

  it('caché: un año e inmutable con hash, la de Pages en el HTML y un día el resto', () => {
    const cacheOf = (file: string) => header(servedPath(file), 'cache-control');
    for (const file of BUILD_FILES.filter((name) => /\.(js|css|woff2)$/.test(name))) {
      expect(cacheOf(file), file).toBe(YEAR);
    }
    for (const file of ['index.html', 'sobre-el-proyecto.html', '404.html']) {
      expect(cacheOf(file), file).toBeUndefined();
    }
    for (const file of ['favicon.svg', 'licencias/terceros.txt', 'licencias/fraunces-OFL.txt']) {
      expect(cacheOf(file), file).toBe('public, max-age=86400');
    }
    for (const file of BUILD_FILES) expect(cacheProblem(rules, file), file).toBeNull();
  });

  it('cada cabecera sale de una sola regla (Pages uniría los valores con una coma)', () => {
    const urls = [...BUILD_FILES.map(servedPath), 'https://torno.pages.dev/', '/no-existe'];
    for (const url of urls) {
      const names = rules
        .filter((rule) => headersFor([rule], url).size > 0)
        .flatMap((rule) => rule.headers.map(([name]) => name.toLowerCase()));
      expect(names.length, url).toBe(new Set(names).size);
    }
  });

  it('cabe en los límites de Pages, también con muchos hashes en la CSP', () => {
    expect(headersLimitProblems(SOURCE)).toEqual([]);
    const hashes = Array.from({ length: 30 }, (_, i) => scriptHash(`script${i}()`));
    expect(headersLimitProblems(applyScriptHashes(SOURCE, hashes))).toEqual([]);
  });
});

describe('el analizador de _headers', () => {
  it('`*` casa con cualquier cosa; `:nombre`, con un trozo sin / (en el dominio, sin .)', () => {
    const parsed = parseHeaders(
      [
        '/a/*',
        '  X-Uno: a',
        '/p/:slug/fin',
        '  X-Dos: p',
        'https://:project.pages.dev/*',
        '  X-Tres: dominio',
      ].join('\n'),
    );
    expect(headersFor(parsed, '/a/b/c.js').get('x-uno')).toBe('a');
    expect(headersFor(parsed, '/ab').get('x-uno')).toBeUndefined();
    expect(headersFor(parsed, '/p/hola/fin').get('x-dos')).toBe('p');
    expect(headersFor(parsed, '/p/ho/la/fin').get('x-dos')).toBeUndefined();
    expect(headersFor(parsed, 'https://torno.pages.dev/x').get('x-tres')).toBe('dominio');
    expect(headersFor(parsed, 'https://a.torno.pages.dev/x').get('x-tres')).toBeUndefined();
    // Una ruta sola no casa con las reglas con dominio.
    expect(headersFor(parsed, '/x').get('x-tres')).toBeUndefined();
  });

  it('une con una coma lo que dan dos reglas y respeta los nombres sin mayúsculas', () => {
    const parsed = parseHeaders('/*\n  X-Uno: a\n\n# comentario\n/b\n  x-uno: b\n');
    expect(headersFor(parsed, '/b')).toEqual(new Map([['x-uno', 'a, b']]));
    expect(headersFor(parsed, '/c')).toEqual(new Map([['x-uno', 'a']]));
  });

  it('rechaza lo que no entiende y lo que en Pages no casaría nunca', () => {
    expect(() => parseHeaders('/*\n  ! X-Uno')).toThrow(/quitar cabeceras/);
    expect(() => parseHeaders('/*/*\n  X: y')).toThrow(/más de un \*/);
    expect(() => parseHeaders('  X: y')).toThrow(/sin patrón/);
    expect(() => parseHeaders('/*\n  sin dos puntos')).toThrow(/sin «:»/);
    expect(() => parseHeaders('main.js\n  X: y')).toThrow(/tiene que ser una ruta/);
    // Pages solo reconoce https:// y, en las reglas de dominio, con ruta.
    expect(() => parseHeaders('http://torno.pages.dev/*\n  X: y')).toThrow(/tiene que ser/);
    expect(() => parseHeaders('https://torno.pages.dev\n  X: y')).toThrow(/tiene que ser/);
  });
});

describe('CSP con hashes', () => {
  it('el hash de un script en línea es el de la especificación (ejemplo de MDN)', () => {
    expect(scriptHash("alert('Hello, world.');")).toBe(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    );
  });

  it('solo cuenta los scripts en línea que se ejecutan', () => {
    const html = [
      '<script type="text/javascript" id="contrato">uno()</script>',
      '<script>dos()</script>',
      '<script type="module">tres()</script>',
      '<script src="main-ABC.js" type="module"></script>',
      '<script id="ng-state" type="application/json">{"a":1}</script>',
    ].join('');
    expect(inlineScripts(html)).toEqual(['uno()', 'dos()', 'tres()']);
  });

  it('detecta lo que la CSP bloquearía: atributos de evento y enlaces javascript:', () => {
    const html =
      '<p onclick="x()">texto onload="no"</p><a href="javascript:void 0">a</a>' +
      '<script>const s = "<b onmouseover=\'no\'>";</script><img src="a.svg" alt="">';
    expect(inlineHandlers(html)).toEqual(['onclick="x()"', 'href="javascript:']);
    expect(
      inlineHandlers('<link rel="stylesheet" media="print" data-beasties-media="all">'),
    ).toEqual([]);
  });

  it('escribe los hashes una vez, sin repetir y ordenados', () => {
    const csp = `script-src 'self' ${PLACEHOLDER}; worker-src 'self'`;
    expect(applyScriptHashes(csp, ["'sha256-b'", "'sha256-a'", "'sha256-b'"])).toBe(
      "script-src 'self' 'sha256-a' 'sha256-b'; worker-src 'self'",
    );
    expect(applyScriptHashes(csp, [])).toBe("script-src 'self'; worker-src 'self'");
    expect(() => applyScriptHashes('nada', [])).toThrow(/una vez/);
    expect(() => applyScriptHashes(`${PLACEHOLDER} ${PLACEHOLDER}`, [])).toThrow(/lleva 2/);
  });

  it('avisa si el _headers pasa de los límites de Pages', () => {
    const line = `  X-Larga: ${'a'.repeat(HEADERS_LIMITS.lineLength)}`;
    expect(headersLimitProblems(`/*\n${line}\n`)).toEqual([
      `_headers, línea 2: ${line.length} caracteres (Pages admite ${HEADERS_LIMITS.lineLength})`,
    ]);
    const many = Array.from({ length: HEADERS_LIMITS.rules + 1 }, (_, i) => `/r${i}\n  X: y`);
    expect(headersLimitProblems(many.join('\n'))).toEqual([
      `_headers: ${HEADERS_LIMITS.rules + 1} reglas (Pages admite ${HEADERS_LIMITS.rules})`,
    ]);
  });
});

describe('rutas y caché para Pages', () => {
  it('la URL de cada archivo: sin .html ni index.html', () => {
    expect(servedPath('index.html')).toBe('/');
    expect(servedPath('sobre-el-proyecto.html')).toBe('/sobre-el-proyecto');
    expect(servedPath('404.html')).toBe('/404');
    expect(servedPath('guia/index.html')).toBe('/guia/');
    expect(servedPath('audio/processor.JUKLXABX.js')).toBe('/audio/processor.JUKLXABX.js');
  });

  it('el archivo de cada ruta prerenderizada', () => {
    expect(routeFile('/')).toBe('index.html');
    expect(routeFile('/sobre-el-proyecto')).toBe('sobre-el-proyecto.html');
    expect(routeFile('/404')).toBe('404.html');
    expect(routeFile('/guia/paso')).toBe('guia/paso.html');
  });

  it('qué lleva hash: el JS y el CSS de Angular y esbuild, y los recursos de media/', () => {
    for (const file of BUILD_FILES.filter((name) => /\.(js|css|woff2)$/.test(name))) {
      expect(isHashed(file), file).toBe(true);
    }
    // Las imágenes que cite el CSS (o el póster de la fase 7) van a media/ con el mismo hash.
    expect(isHashed('media/poster-ABCD1234.webp')).toBe(true);
    for (const file of [
      'index.html',
      'sobre-el-proyecto.html',
      'favicon.svg',
      'licencias/terceros.txt',
      'licencias/fraunces-OFL.txt',
      'app.js',
      'media/logotipo.svg',
    ]) {
      expect(isHashed(file), file).toBe(false);
    }
  });

  it('la caché de cada archivo: lo que no cumple, sale', () => {
    expect(cacheProblem(rules, 'main-XRTRA2B6.js')).toBeNull();
    expect(cacheProblem(rules, 'media/poster-ABCD1234.webp')).toBeNull();
    expect(cacheProblem(rules, 'media/logotipo.svg')).toMatch(/sin hash y con caché inmutable/);
    // Con hash, fuera de una regla inmutable: también sale.
    expect(cacheProblem(rules, 'img/foto-ABCD1234.webp')).toMatch(/sin caché inmutable/);
    expect(cacheProblem(rules, 'app.js')).toMatch(/sin hash/);
    // Un archivo sin hash en una carpeta inmutable (audio/) no puede quedarse en caché un año.
    expect(cacheProblem(rules, 'audio/sin-hash.json')).toMatch(/sin hash y con caché inmutable/);
    const broken = parseHeaders(`/*\n  Cache-Control: ${YEAR}\n`);
    expect(cacheProblem(broken, 'index.html')).toMatch(/el HTML no puede/);
    expect(cacheProblem(broken, 'favicon.svg')).toMatch(/sin hash y con caché inmutable/);
    const none = parseHeaders('/*\n  X-Uno: a\n');
    expect(cacheProblem(none, 'main-XRTRA2B6.js')).toMatch(/sin caché inmutable/);
    const revalidate = parseHeaders('/sobre\n  Cache-Control: no-cache\n');
    expect(cacheProblem(revalidate, 'sobre.html')).toBeNull();
  });
});

describe('el paso tras el build', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  async function build(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'torno-pages-'));
    dirs.push(root);
    for (const [name, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await writeFile(path.join(root, name), content);
    }
    return root;
  }

  async function list(root: string): Promise<string[]> {
    const entries = await readdir(root, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'),
      )
      .sort();
  }

  /** Un build como el de Angular: rutas en carpetas, la CSR y la plantilla copiada de public/. */
  const ANGULAR = {
    _headers: SOURCE,
    'index.html': '<script>uno()</script><script src="main-ABCDEFGH.js" type="module"></script>',
    'index.csr.html': '<app-root></app-root>',
    'sobre-el-proyecto/index.html': '<script>uno()</script><script>dos()</script>',
    '404/index.html': '<h1>Página no encontrada</h1>',
    'main-ABCDEFGH.js': '',
    'favicon.svg': '',
  };

  it('reorganiza las rutas, quita la CSR y escribe el _headers con los hashes', async () => {
    const root = await build(ANGULAR);
    expect(await processBuild({ root, template: SOURCE })).toEqual({
      moved: ['/404', '/sobre-el-proyecto'],
      pages: 3,
      hashes: 2,
      files: 5,
    });
    expect(await list(root)).toEqual([
      '404.html',
      '_headers',
      'favicon.svg',
      'index.html',
      'main-ABCDEFGH.js',
      'sobre-el-proyecto.html',
    ]);
    const written = await readFile(path.join(root, '_headers'), 'utf8');
    expect(written).not.toContain(PLACEHOLDER);
    expect(written).toContain(
      `script-src 'self' ${[scriptHash('dos()'), scriptHash('uno()')].sort().join(' ')};`,
    );
    // Otra vez, con el build ya preparado: lo mismo (lee la plantilla, no el _headers del build).
    expect(await processBuild({ root, template: SOURCE })).toMatchObject({ moved: [], hashes: 2 });
    expect(await readFile(path.join(root, '_headers'), 'utf8')).toBe(written);
  });

  it('falla sin 404, con un atributo de evento, con un archivo sin hash o con uno oculto', async () => {
    const root = await build({
      ...Object.fromEntries(Object.entries(ANGULAR).filter(([name]) => !name.startsWith('404'))),
      'index.html': '<button onclick="x()">x</button>',
      'app.js': '',
      '.htaccess': '',
    });
    await expect(processBuild({ root, template: SOURCE })).rejects.toThrow(
      /Falta 404\.html[\s\S]*onclick="x\(\)"[\s\S]*\.htaccess: empieza por punto[\s\S]*app\.js: sin hash/,
    );
    // Si falla, el _headers del build no se completa.
    expect(await readFile(path.join(root, '_headers'), 'utf8')).toBe(SOURCE);
  });

  it('no pisa una página que ya existe con el mismo nombre', async () => {
    const root = await build({ ...ANGULAR, 'sobre-el-proyecto.html': 'otra' });
    await expect(processBuild({ root, template: SOURCE })).rejects.toThrow(
      /Ya existe sobre-el-proyecto\.html/,
    );
  });

  it('falla si no hay build', async () => {
    await expect(processBuild({ root: await build({}), template: SOURCE })).rejects.toThrow(
      /No hay build/,
    );
  });
});
