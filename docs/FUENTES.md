# Fuentes y licencias

Todo recurso de terceros, archivo a archivo. Torno no usa imágenes, texturas, modelos 3D ni audio de terceros: el instrumento, sus texturas y sus sonidos se generan con código propio.

| Recurso | Archivo o paquete | Autor | Licencia | URL |
|---|---|---|---|---|
| Three.js (se instala en la fase 5) | `three` | three.js authors | MIT | https://github.com/mrdoob/three.js |
| Fraunces (variable: `wght`, `opsz`, `SOFT`, `WONK`), subconjunto latino, redonda | `@fontsource-variable/fraunces` 5.3.0 → `files/fraunces-latin-full-normal.woff2` | Copyright 2020 The Fraunces Project Authors (Undercase Type) | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces · https://fontsource.org/fonts/fraunces |
| Geist Mono (variable: `wght`), subconjunto latino, redonda | `@fontsource-variable/geist-mono` 5.3.0 → `files/geist-mono-latin-wght-normal.woff2` | Copyright 2024 The Geist Project Authors (Vercel) | SIL Open Font License 1.1 | https://github.com/vercel/geist-font · https://fontsource.org/fonts/geist-mono |

Las dos fuentes se sirven desde el propio dominio (el build las copia con hash en `media/`). Como pide la OFL al redistribuirlas, el texto de cada licencia se sirve al lado: `public/licencias/fraunces-OFL.txt` y `public/licencias/geist-mono-OFL.txt` (copiados de cada paquete; `/sobre-el-proyecto` los enlazará en la fase 7). Uso y pesos en `docs/DISENO.md` §3.

## Inspiración (sin código, textos ni recursos copiados)
- TAPE, de Ethan (`ethanplusai/tape`, https://tape.ethanplus.ai). Su código es MIT; su marca, sus imágenes y sus recursos creativos están excluidos de esa licencia. Torno no usa nada de él.
