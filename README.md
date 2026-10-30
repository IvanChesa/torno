# Torno

Instrumento de bucles de cuatro capas, en 3D, que se toca en el navegador. Biblioteca de sonidos sintetizada, grabación con el micrófono, un disco para arrastrar el tiempo y un brazo que filtra el sonido. Todo el audio es propio (Web Audio API y AudioWorklet) y nunca sale del dispositivo.

Proyecto en desarrollo, de [Iván Chesa Lapena](https://ivanchesa.es). El plan está en [`docs/PLAN.md`](docs/PLAN.md) y el diseño, en [`docs/DISENO.md`](docs/DISENO.md).

## Comandos

- `npm start`: servidor de desarrollo (compila el worklet en modo vigilancia). Con `-- --host 0.0.0.0`, accesible desde el móvil en la red local.
- `npm test`: tests unitarios (Vitest en Node para el núcleo de audio y Vitest con jsdom para Angular).
- `npm run lint`: tipos de cada capa, ESLint (con las capas de la arquitectura) y Prettier.
- `npm run build`: build estático con prerenderizado en `dist/torno/browser`, preparado para Cloudflare Pages (rutas como `ruta.html`, `404.html` y `_headers` con la CSP).
- `node scripts/serve-pages.mjs`: el build en `http://localhost:4300`, servido por `wrangler pages dev` como en Cloudflare Pages (`npm run build` antes).
- `npm run e2e`: Playwright (Chromium y WebKit) contra `ng serve` y contra el build servido como en Pages (`npm run build` antes).
- `npm run check`: lint, tests, build, presupuestos de tamaño y límites de Pages. Obligatorio antes de cerrar una fase.
- `npm run capturas -- --fase=N`: capturas deterministas (`?captura=1`) en `docs/informes/img/fase-N/` (`npm run build` antes).
- `node scripts/verify-pages.mjs <URL> [--build dist/torno/browser]`: comprueba un despliegue como con `curl` (rutas, redirecciones, 404, cabeceras, caché y que sirve ese build).

Requisitos: Node 22.22.3 o superior (o 24.15+). Para el e2e, `npx playwright install chromium webkit` la primera vez.

## Despliegue

Cloudflare Pages, proyecto `torno`. Cada *push* a `main` con el CI en verde publica el build que ha probado el CI en la vista previa [`staging.torno.pages.dev`](https://staging.torno.pages.dev) (`.github/workflows/deploy.yml`) y la comprueba. Un *push* a una rama de fase (`fase-*`) va a su propia vista previa, `https://<rama>.torno.pages.dev`, para probarla en el móvil antes de fusionar. La producción, `torno.ivanchesa.es`, llega con el lanzamiento.
