# Torno

Instrumento de bucles de cuatro capas, en 3D, que se toca en el navegador. Biblioteca de sonidos sintetizada, grabación con el micrófono, un disco para arrastrar el tiempo y un brazo que filtra el sonido. Todo el audio es propio (Web Audio API y AudioWorklet) y nunca sale del dispositivo.

Proyecto en desarrollo, de [Iván Chesa Lapena](https://ivanchesa.es). El plan está en [`docs/PLAN.md`](docs/PLAN.md) y el diseño, en [`docs/DISENO.md`](docs/DISENO.md).

## Comandos

- `npm start`: servidor de desarrollo (compila el worklet en modo vigilancia). Con `-- --host 0.0.0.0`, accesible desde el móvil en la red local.
- `npm test`: tests unitarios (Vitest en Node para el núcleo de audio y Vitest con jsdom para Angular).
- `npm run lint`: tipos de cada capa, ESLint (con las capas de la arquitectura) y Prettier.
- `npm run build`: build estático con prerenderizado en `dist/torno/browser`.
- `npm run e2e`: Playwright (Chromium) contra `ng serve` y contra el build estático (`npm run build` antes).
- `npm run check`: lint, tests, build y presupuestos de tamaño. Obligatorio antes de cerrar una fase.
- `npm run capturas -- --fase=N`: capturas deterministas (`?captura=1`) en `docs/informes/img/fase-N/` (`npm run build` antes).

Requisitos: Node 22.22.3 o superior (o 24.15+). Para el e2e, `npx playwright install chromium` la primera vez.
