// Servidor estático mínimo para probar el build prerenderizado en local (sin dependencias).
// Imita lo que hará Apache en la fase 4: URLs sin barra final (/ruta → ruta/index.html), tipos
// MIME de los módulos JS y del worklet, y la página /404 con su código 404.
//
// Uso: node scripts/serve-static.mjs [--port 4300]   (después de `npm run build`)
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Arranca el servidor; devuelve su URL base y una función para cerrarlo. */
export async function startStaticServer({ port = 4300, root = DEFAULT_ROOT } = {}) {
  if (!(await isFile(path.join(root, 'index.html')))) {
    throw new Error(`No hay build en ${root}: ejecuta antes «npm run build».`);
  }
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    let file = await resolve(root, pathname).catch(() => undefined);
    let status = 200;
    if (!file) {
      file = path.join(root, '404', 'index.html');
      status = 404;
    }
    response.writeHead(status, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
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
  const { url } = await startStaticServer({ port });
  console.log(`Build estático en ${url} (Ctrl+C para salir)`);
}
