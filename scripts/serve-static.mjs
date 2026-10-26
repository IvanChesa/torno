// Servidor estático mínimo para probar el build prerenderizado en local (sin dependencias).
// Imita lo que hace el servidor real con public/.htaccess:
// - URLs sin barra final (/ruta → ruta/index.html; /ruta/ → 301 a /ruta) y la página /404 con su
//   código 404;
// - tipos MIME de los módulos JS y del worklet;
// - las cabeceras del .htaccess del build (CSP, Permissions-Policy, caché…), leídas con
//   scripts/htaccess-rules.mjs: los e2e del build corren bajo la CSP de producción. Con
//   `--sin-cabeceras` (o `headers: false`), sin ellas.
//
// Uso: node scripts/serve-static.mjs [--port 4300] [--sin-cabeceras]   (después de `npm run build`)
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { headersFor, parseHtaccess } from './htaccess-rules.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../dist/torno/browser/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
};

async function isFile(file) {
  return (await stat(file).catch(() => undefined))?.isFile() ?? false;
}

/** Archivo que corresponde a una ruta pedida, o `undefined` si no existe. */
async function resolve(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const file = path.normalize(path.join(root, decoded));
  if (!file.startsWith(root)) return undefined;
  if (await isFile(file)) return file;
  const index = path.join(file, 'index.html');
  return (await isFile(index)) ? index : undefined;
}

/** Las reglas del .htaccess del build (o ninguna si no lo hay o no se quieren). */
async function loadRules(root, headers) {
  if (!headers) return { headers: [], files: [] };
  const text = await readFile(path.join(root, '.htaccess'), 'utf8').catch(() => '');
  return parseHtaccess(text);
}

/** Arranca el servidor; devuelve su URL base y una función para cerrarlo. */
export async function startStaticServer({ port = 4300, root = DEFAULT_ROOT, headers = true } = {}) {
  if (!(await isFile(path.join(root, 'index.html')))) {
    throw new Error(`No hay build en ${root}: ejecuta antes «npm run build».`);
  }
  const rules = await loadRules(root, headers);
  const server = createServer(async (request, response) => {
    const { pathname, search } = new URL(request.url ?? '/', 'http://localhost');
    // Como el .htaccess: /ruta/ → /ruta (salvo la raíz).
    if (pathname.length > 1 && pathname.endsWith('/')) {
      response.writeHead(301, { Location: `${pathname.replace(/\/+$/, '')}${search}` });
      response.end();
      return;
    }
    let file = await resolve(root, pathname).catch(() => undefined);
    let status = 200;
    if (file && headersFor(rules, file).deny) file = undefined;
    if (!file) {
      file = path.join(root, '404', 'index.html');
      status = 404;
    }
    // Las del .htaccess (en minúsculas); sin regla de caché, `no-store` (el build cambia a menudo).
    const fileHeaders = new Map([
      ['cache-control', 'no-store'],
      ...headersFor(rules, file).headers,
    ]);
    fileHeaders.set('content-type', MIME[path.extname(file)] ?? 'application/octet-stream');
    response.writeHead(status, Object.fromEntries(fileHeaders));
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(file).pipe(response);
  });
  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const address = server.address();
  const url = `http://localhost:${typeof address === 'object' && address ? address.port : port}`;
  return { url, close: () => new Promise((done) => server.close(done)) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 4300;
  const headers = !process.argv.includes('--sin-cabeceras');
  const { url } = await startStaticServer({ port, headers });
  console.log(
    `Build estático en ${url}${headers ? ', con las cabeceras del .htaccess' : ''} (Ctrl+C para salir)`,
  );
}
