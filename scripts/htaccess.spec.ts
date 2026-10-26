// El .htaccess del proyecto (PLAN fase 4, tarea 2): lo que dice para cada archivo y el paso tras el
// build que completa la CSP con los hashes de los scripts en línea y comprueba la caché.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { headersFor, parseHtaccess } from './htaccess-rules.mjs';
import {
  applyScriptHashes,
  cacheProblem,
  inlineHandlers,
  inlineScripts,
  PLACEHOLDER,
  processBuild,
  scriptHash,
} from './htaccess.mjs';

const SOURCE = await readFile(new URL('../public/.htaccess', import.meta.url), 'utf8');
const rules = parseHtaccess(SOURCE);
const header = (file: string, name: string) => headersFor(rules, file).headers.get(name);

describe('public/.htaccess', () => {
  it('cabeceras de seguridad para todo: CSP, Permissions-Policy, nosniff…', () => {
    const csp = header('index.html', 'content-security-policy') ?? '';
    expect(csp).toContain(`script-src 'self' ${PLACEHOLDER};`);
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
    // Los scripts nunca en línea sin hash; los estilos sí (los de los componentes de Angular).
    expect(/script-src[^;]*unsafe-inline/.test(csp)).toBe(false);
    expect(header('index.html', 'permissions-policy')).toContain('microphone=(self)');
    expect(header('index.html', 'x-content-type-options')).toBe('nosniff');
    expect(header('main-CIPZRPKM.js', 'content-security-policy')).toBe(csp);
  });

  it('caché: inmutable con hash en el nombre, no-cache el HTML y un día el resto', () => {
    for (const file of [
      'main-CIPZRPKM.js',
      'chunk-D-0ul86W.js',
      'chunk-DJVAsKa_.js',
      'styles-6C34OBR7.css',
      'worker-YAR6FGUI.js',
      'audio/processor.JUKLXABX.js',
      'media/fraunces-latin-full-normal-2NUMMRN6.woff2',
    ]) {
      expect(header(file, 'cache-control'), file).toBe('public, max-age=31536000, immutable');
    }
    for (const file of ['index.html', '404/index.html', 'sobre-el-proyecto/index.html']) {
      expect(header(file, 'cache-control'), file).toBe('no-cache');
    }
    for (const file of ['favicon.svg', 'licencias/terceros.txt', 'licencias/fraunces-OFL.txt']) {
      expect(header(file, 'cache-control'), file).toBe('public, max-age=86400');
    }
  });

  it('no sirve lo que empieza por punto (el estado del FTP, el propio .htaccess)', () => {
    expect(headersFor(rules, '.ftp-deploy-sync-state.json').deny).toBe(true);
    expect(headersFor(rules, '.htaccess').deny).toBe(true);
    expect(headersFor(rules, 'index.html').deny).toBe(false);
  });

  it('URLs: HTTPS, sin barra final, 404 y sin listados', () => {
    expect(SOURCE).toMatch(/RewriteCond %\{HTTPS\} !=on/);
    expect(SOURCE).toMatch(/RewriteRule \^\(\.\+\)\/\$ \/\$1 \[R=301,L\]/);
    expect(SOURCE).toMatch(/ErrorDocument 404 \/404\/index\.html/);
    expect(SOURCE).toMatch(/Options -Indexes/);
    expect(SOURCE).toMatch(/DirectorySlash Off/);
  });

  it('el analizador: <Files>, bloques sin cerrar y cabeceras que mandan sobre las globales', () => {
    const parsed = parseHtaccess(
      [
        'Header always set X-Uno "global"',
        '<Files "secreto.txt">',
        '  Require all denied',
        '</Files>',
        '<FilesMatch "\\.txt$">',
        '  Header set X-Uno "texto"',
        '</FilesMatch>',
      ].join('\n'),
    );
    expect(headersFor(parsed, 'a/secreto.txt')).toEqual({
      headers: new Map([['x-uno', 'texto']]),
      deny: true,
    });
    expect(headersFor(parsed, 'otro.js').headers.get('x-uno')).toBe('global');
    expect(() => parseHtaccess('<FilesMatch "x">')).toThrow(/sin cerrar/);
    expect(() => parseHtaccess('</Files>')).toThrow(/sin apertura/);
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

  it('la caché de cada archivo: lo que no cumple, sale', () => {
    expect(cacheProblem(rules, 'main-CIPZRPKM.js')).toBeNull();
    expect(cacheProblem(rules, 'index.html')).toBeNull();
    expect(cacheProblem(rules, 'favicon.svg')).toBeNull();
    expect(cacheProblem(rules, 'app.js')).toMatch(/sin hash/);
    const broken = parseHtaccess(
      '<FilesMatch "\\.(html|js)$">\nHeader set Cache-Control "public, max-age=31536000, immutable"\n</FilesMatch>',
    );
    expect(cacheProblem(broken, 'index.html')).toMatch(/no-cache/);
    const wrong = parseHtaccess(
      '<FilesMatch "\\.svg$">\nHeader set Cache-Control "immutable"\n</FilesMatch>',
    );
    expect(cacheProblem(wrong, 'favicon.svg')).toMatch(/inmutable/);
  });
});

describe('el paso tras el build', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  async function build(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'torno-htaccess-'));
    dirs.push(root);
    for (const [name, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await writeFile(path.join(root, name), content);
    }
    return root;
  }

  it('completa la CSP con los hashes de todas las páginas y la deja en el .htaccess', async () => {
    const root = await build({
      '.htaccess': SOURCE,
      'index.html': '<script>uno()</script><script src="main-ABCDEFGH.js" type="module"></script>',
      'otra/index.html': '<script>uno()</script><script>dos()</script>',
      'main-ABCDEFGH.js': '',
      'favicon.svg': '',
    });
    expect(await processBuild(root)).toEqual({ pages: 2, hashes: 2, files: 5 });
    const written = await readFile(path.join(root, '.htaccess'), 'utf8');
    expect(written).not.toContain(PLACEHOLDER);
    expect(written).toContain(
      `script-src 'self' ${[scriptHash('dos()'), scriptHash('uno()')].sort().join(' ')};`,
    );
  });

  it('falla sin .htaccess, con un atributo de evento o con un archivo sin hash', async () => {
    await expect(processBuild(await build({ 'index.html': '' }))).rejects.toThrow(
      /No hay \.htaccess/,
    );
    const root = await build({
      '.htaccess': SOURCE,
      'index.html': '<button onclick="x()">x</button>',
      'app.js': '',
    });
    await expect(processBuild(root)).rejects.toThrow(/onclick="x\(\)"[\s\S]*app\.js: sin hash/);
    // Si falla, el .htaccess del build no se toca.
    expect(await readFile(path.join(root, '.htaccess'), 'utf8')).toBe(SOURCE);
  });
});
