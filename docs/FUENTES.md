# Fuentes y licencias

Todo recurso de terceros, archivo a archivo. Torno no usa imágenes, texturas, modelos 3D ni audio de terceros: el instrumento, sus texturas y sus sonidos se generan con código propio.

| Recurso | Archivo o paquete | Autor | Licencia | URL |
|---|---|---|---|---|
| Angular (lo que llega al navegador: `core`, `common`, `platform-browser`, `router`) | `@angular/*` 22.2 | Google LLC | MIT | https://github.com/angular/angular |
| RxJS (lo usa el router de Angular) | `rxjs` 7.8 | RxJS authors | Apache-2.0 | https://github.com/ReactiveX/rxjs |
| tslib (ayudantes del compilador de TypeScript) | `tslib` 2 | Microsoft | 0BSD | https://github.com/microsoft/tslib |
| Fraunces (variable: `wght`, `opsz`, `SOFT`, `WONK`), subconjunto latino, redonda | `@fontsource-variable/fraunces` 5.3.0 → `files/fraunces-latin-full-normal.woff2` | Copyright 2020 The Fraunces Project Authors (Undercase Type) | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces · https://fontsource.org/fonts/fraunces |
| Geist Mono (variable: `wght`), subconjunto latino, redonda | `@fontsource-variable/geist-mono` 5.3.0 → `files/geist-mono-latin-wght-normal.woff2` | Copyright 2024 The Geist Project Authors (Vercel) | SIL Open Font License 1.1 | https://github.com/vercel/geist-font · https://fontsource.org/fonts/geist-mono |
| Three.js (se instala en la fase 5) | `three` | three.js authors | MIT | https://github.com/mrdoob/three.js |

El prerenderizado usa además `@angular/ssr` y `@angular/platform-server` (MIT), `beasties` (Apache-2.0) y `xhr2` (MIT) en el build; no llegan al navegador. Las herramientas de desarrollo (Vitest, Playwright, ESLint, esbuild, wrangler…) no se distribuyen.

**Dónde están los textos de las licencias en la web publicada:**
- `licencias/terceros.txt`: los avisos de todo el JS de terceros, que genera el build de Angular (`3rdpartylicenses.txt`) y copia `scripts/publish-licenses.mjs` dentro de lo que se despliega.
- `licencias/fraunces-OFL.txt` y `licencias/geist-mono-OFL.txt`: la OFL de cada tipografía (copiadas de su paquete en `public/licencias/`), como pide la licencia al redistribuir las fuentes.
- `/sobre-el-proyecto` los enlazará en la fase 7. Uso y pesos de las fuentes en `docs/DISENO.md` §3.

## Inspiración (sin código, textos ni recursos copiados)
- TAPE, de Ethan (`ethanplusai/tape`, https://tape.ethanplus.ai). Su código es MIT; su marca, sus imágenes y sus recursos creativos están excluidos de esa licencia. Torno no usa nada de él.
