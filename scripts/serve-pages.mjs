// El build servido en local tal como lo sirve Cloudflare Pages (PLAN D19 y fase 4, tarea 2): arranca
// `wrangler pages dev` sobre dist/torno/browser. Aplica el _headers del build (CSP, caché…), las URLs
// sin barra final, las redirecciones y la 404 con el mismo código que Pages, así que los e2e del build
// (playwright.config.ts) y las capturas (scripts/capture.mjs) prueban lo que se publica.
//
// Solo en 127.0.0.1 y sin las métricas de uso de wrangler (WRANGLER_SEND_METRICS=false). Al cerrar,
// se cierran también los procesos de wrangler y de workerd.
//
// Uso: node scripts/serve-pages.mjs [--port 4300]   (después de `npm run build`)
import { spawn, spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/torno/browser/', import.meta.url));
const WRANGLER = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);
const HOST = '127.0.0.1';
/** Fecha de compatibilidad de workerd: sin Functions no cambia nada, pero sin ella wrangler avisa. */
const COMPATIBILITY_DATE = '2026-10-06';
const STARTUP_TIMEOUT_MS = 60_000;

/** Los argumentos de `wrangler pages dev` para servir un build en un puerto. */
export function pagesDevArgs(root, port) {
  return [
    'pages',
    'dev',
    root,
    '--ip',
    HOST,
    '--port',
    String(port),
    '--compatibility-date',
    COMPATIBILITY_DATE,
    '--log-level',
    'warn',
    '--show-interactive-dev-session=false',
  ];
}

/** Un puerto libre de 127.0.0.1. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

async function isFile(file) {
  return (await stat(file).catch(() => undefined))?.isFile() ?? false;
}

/**
 * Arranca el servidor y espera a que responda. Devuelve su URL y una función para cerrarlo.
 * @param {{ port?: number, root?: string, cli?: boolean }} [options] con `cli`, la salida de
 *   wrangler va a la consola y el proceso se queda en el grupo del que lo lanza (así lo cierra
 *   Playwright); sin él, va en su propio grupo para poder cerrarlo entero.
 */
export async function startPagesServer({ port = 0, root = ROOT, cli = false } = {}) {
  if (!(await isFile(path.join(root, 'index.html')))) {
    throw new Error(`No hay build en ${root}: ejecuta antes «npm run build».`);
  }
  if (!(await isFile(path.join(root, '_headers')))) {
    throw new Error(`El build de ${root} no tiene _headers: falta scripts/pages.mjs (postbuild).`);
  }
  const listen = port || (await freePort());
  const detached = !cli && process.platform !== 'win32';
  const child = spawn(process.execPath, [WRANGLER, ...pagesDevArgs(root, listen)], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdio: cli ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    detached,
    windowsHide: true,
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  const exited = new Promise((resolve) => child.once('exit', resolve));

  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      // wrangler lanza otro node y workerd: hay que cerrar el árbol entero.
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else if (detached && child.pid) {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    }
    await exited;
  };

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler pages dev se ha cerrado al arrancar:\n${output}`);
    }
    const ready = await fetch(`http://${HOST}:${listen}/`, { signal: AbortSignal.timeout(2000) })
      .then(() => true)
      .catch(() => false);
    if (ready) break;
    if (Date.now() > deadline) {
      await close();
      throw new Error(
        `wrangler pages dev no responde en ${STARTUP_TIMEOUT_MS / 1000} s:\n${output}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { url: `http://localhost:${listen}`, close };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 4300;
  const { url, close } = await startPagesServer({ port, cli: true });
  console.log(`Build en ${url}, servido como en Cloudflare Pages (Ctrl+C para salir)`);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => void close().then(() => process.exit(0)));
  }
}
