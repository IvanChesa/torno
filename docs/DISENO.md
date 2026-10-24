# Diseño: dirección B «Barro»

Elegida por Iván el 24-10-2026 (`docs/PLAN.md` §10, D23). Este documento la desarrolla y es la referencia de todo lo visual: la web, el instrumento HTML (fase 2) y el aparato en 3D (fase 5). Los valores viven en un solo sitio, `src/styles/tokens.css`; aquí se explican.

- **Fuente única:** `src/styles/tokens.css`. Ningún componente escribe a mano un color, un tamaño de letra, un peso, un interlineado, un espaciado o una duración: usa un token. Las medidas propias de un componente (el ancho de una columna, el tamaño de una muestra de color) sí pueden ir en el componente.
- **Comprobado por tests:** el contraste de cada combinación (`scripts/contrast.spec.ts`), el color de la barra del navegador frente al fondo (`site.config.spec.ts`) y la ausencia de violaciones de axe (`e2e/static.spec.ts`).
- **Muestrario:** la portada de la fase 0 enseña los tokens (`features/design-sample`, temporal hasta la fase 7). Capturas en `docs/informes/img/fase-0/`.

---

## 1. La idea

Torno es un **torno de alfarero**: un disco que gira y barro que se moldea a mano, como las capas de sonido que se repiten y se van modelando. La dirección «Barro» lleva esa idea a la materia y al color:

- **El objeto** es cálido y está hecho a mano: un cuerpo de **terracota mate** con textura de cerámica, metal de **latón envejecido**, teclas de **crema esmaltada**, un disco de **cerámica vidriada** con anillo de latón y una **pantalla de fósforo verde**.
- **La web** es el olivar de noche alrededor del objeto: fondo **verde oliva oscuro** (los olivares del Bajo Cinca), tinta **de hueso** y un único acento de **terracota**.
- **Las letras** tienen la forma suave del barro: Fraunces con el eje `SOFT` al máximo en los títulos, como letras modeladas con los dedos; Geist Mono para lo que dice el aparato.

**Lo que no es** (anti-referencias):

- Nada del original (TAPE): ni su marfil con azul cobalto, ni Barlow Condensed, DM Sans o IBM Plex Mono, ni su distribución (cuerpo casi cuadrado, disco grande a la izquierda, brazo plateado arriba a la derecha, columna de teclas azules y dial a la derecha, cuatro diales delante). La distribución propia se decide en la fase 5.a.
- Nada del aspecto genérico de las páginas generadas: el fondo **no** es crema (la crema es la tinta, y de croma bajo, sin amarillear), el acento de terracota se usa **poco** (la acción principal), sin etiquetas pequeñas encima de los títulos, sin degradados, sin texto con degradado, sin tarjetas con icono en fila, sin vidrio esmerilado y sin monoespaciada de adorno.

---

## 2. Color de la web

Proporciones: **fondo 70–90 %** de la pantalla, tinta para el texto, **acento por debajo del 5 %** (la acción principal y, como mucho, otra cosa recurrente). Las superficies se separan del fondo por un escalón de tono, nunca por una línea o una sombra.

| Token | Valor | Nombre | Uso |
|---|---|---|---|
| `--color-bg` | `#252712` | Fondo de olivar | El suelo de todas las páginas. También `theme-color`. |
| `--color-surface` | `#2f3119` | Superficie | Paneles (la prueba técnica, la guía…). Un escalón de tono sobre el fondo. |
| `--color-surface-2` | `#3a3d23` | Superficie elevada | Botón secundario, `kbd`, barra de desplazamiento. |
| `--color-ink` | `#f1ece0` | Tinta de hueso | Todo el texto corrido y los títulos. Anillo de foco (`--color-focus`). |
| `--color-ink-muted` | `#c5c2ac` | Tinta suave | Texto secundario (notas, pie, estados). Teñida de oliva, no gris. |
| `--color-ink-faint` | `#78765b` | Tinta tenue | **Solo texto grande** (≥ 24 px) sobre el fondo: el nombre del pie. |
| `--color-accent` | `#e48762` | Terracota | Relleno del botón principal y de la selección de texto. |
| `--color-accent-hover` | `#f19c75` | Terracota clara | El botón principal con el puntero encima. |
| `--color-on-accent` | `#252712` | — | Texto sobre la terracota (es el fondo). |
| `--color-accent-text` | `#eea580` | Terracota para texto | Texto de acento sobre el fondo o un panel (cifra destacada, estado activo). |
| `--color-warning` | `#eec469` | Aviso | Avisos (p. ej., «usa auriculares»). |
| `--color-error` | `#f58c81` | Error | Errores visibles del audio, del micrófono o de los archivos. |
| `--color-screen` | `#0c1a0f` | Pantalla | Fondo de la pantalla del aparato y de su espejo HTML. |
| `--color-phosphor` | `#79f481` | Fósforo | Texto de la pantalla y pilotos de capa. |

Reglas:

- **El texto corrido va en la tinta completa.** La tinta suave es para lo secundario; la tenue, solo para texto grande decorativo.
- **El acento no es para títulos, iconos, viñetas ni bordes.** Un título es tinta. En los enlaces, el acento solo subraya (la palabra sigue en tinta).
- **El estado nunca va solo en el color:** error, aviso y estados del aparato llevan siempre texto (WCAG 1.4.1).
- **Modo oscuro único:** `color-scheme: dark` y `<meta name="color-scheme" content="dark">`; no hay tema claro en la v1.

### 2.1 Contraste comprobado (WCAG 2.1 AA)

Generada con `node scripts/contrast.mjs` a partir de `tokens.css`; `scripts/contrast.spec.ts` falla si alguna combinación baja de su mínimo. Mínimos: 4,5:1 para texto, 3:1 para texto grande y para los componentes de la interfaz (WCAG 1.4.3 y 1.4.11). La tinta sobre el fondo se exige a 7:1 (AAA) por ser el texto de lectura.

| Texto o componente | Fondo | Contraste | Mínimo | Uso |
|---|---|---|---|---|
| `--color-ink` #f1ece0 | `--color-bg` #252712 | ✅ 12,93:1 | 7,00:1 | Texto principal |
| `--color-ink` #f1ece0 | `--color-surface` #2f3119 | ✅ 11,32:1 | 7,00:1 | Texto en paneles |
| `--color-ink` #f1ece0 | `--color-surface-2` #3a3d23 | ✅ 9,52:1 | 4,50:1 | Botón secundario, teclas (`kbd`) |
| `--color-ink-muted` #c5c2ac | `--color-bg` #252712 | ✅ 8,48:1 | 4,50:1 | Texto secundario |
| `--color-ink-muted` #c5c2ac | `--color-surface` #2f3119 | ✅ 7,42:1 | 4,50:1 | Texto secundario en paneles |
| `--color-ink-muted` #c5c2ac | `--color-surface-2` #3a3d23 | ✅ 6,24:1 | 4,50:1 | Texto secundario en paneles elevados |
| `--color-ink-faint` #78765b | `--color-bg` #252712 | ✅ 3,30:1 | 3,00:1 | Solo texto grande (≥ 24 px): el nombre del pie |
| `--color-accent-text` #eea580 | `--color-bg` #252712 | ✅ 7,50:1 | 4,50:1 | Texto de acento |
| `--color-accent-text` #eea580 | `--color-surface` #2f3119 | ✅ 6,56:1 | 4,50:1 | Texto de acento en paneles |
| `--color-on-accent` #252712 | `--color-accent` #e48762 | ✅ 5,76:1 | 4,50:1 | Texto del botón principal y de la selección |
| `--color-on-accent` #252712 | `--color-accent-hover` #f19c75 | ✅ 7,08:1 | 4,50:1 | Botón principal con el puntero encima |
| `--color-accent` #e48762 | `--color-bg` #252712 | ✅ 5,76:1 | 3,00:1 | Botón principal frente al fondo (WCAG 1.4.11) |
| `--color-accent` #e48762 | `--color-surface` #2f3119 | ✅ 5,04:1 | 3,00:1 | Botón principal frente a un panel |
| `--color-focus` #f1ece0 | `--color-bg` #252712 | ✅ 12,93:1 | 3,00:1 | Anillo de foco |
| `--color-focus` #f1ece0 | `--color-surface` #2f3119 | ✅ 11,32:1 | 3,00:1 | Anillo de foco sobre un panel |
| `--color-bg` #252712 | `--color-ink` #f1ece0 | ✅ 12,93:1 | 7,00:1 | Enlace «Saltar al contenido» (invertido) |
| `--color-error` #f58c81 | `--color-bg` #252712 | ✅ 6,50:1 | 4,50:1 | Mensajes de error |
| `--color-error` #f58c81 | `--color-surface` #2f3119 | ✅ 5,69:1 | 4,50:1 | Mensajes de error en paneles |
| `--color-warning` #eec469 | `--color-bg` #252712 | ✅ 9,24:1 | 4,50:1 | Avisos |
| `--color-warning` #eec469 | `--color-surface` #2f3119 | ✅ 8,09:1 | 4,50:1 | Avisos en paneles |
| `--color-phosphor` #79f481 | `--color-screen` #0c1a0f | ✅ 12,88:1 | 7,00:1 | Pantalla del aparato |

Una combinación nueva se añade a `PAIRS` en `scripts/contrast.mjs` antes de usarla.

---

## 3. Tipografías

Dos familias, las dos **OFL 1.1**, autoalojadas desde Fontsource y **solo con el subconjunto latino** (cubre el español: á, é, í, ó, ú, ü, ñ, ¿, ¡, «», —, €, el signo menos −). Detalle de licencias en `docs/FUENTES.md`.

| Familia | Archivo (subconjunto latino) | Peso | Ejes | Papel |
|---|---|---|---|---|
| **Fraunces Variable** (Undercase Type) | `fraunces-latin-full-normal.woff2` | 121.016 B | `wght` 100–900, `opsz` 9–144, `SOFT` 0–100, `WONK` 0–1 | Títulos y texto: la voz de la web |
| **Geist Mono Variable** (Vercel) | `geist-mono-latin-wght-normal.woff2` | 23.128 B | `wght` 100–900 | Lo que dice el aparato, cifras medidas, código y atajos |
| **Total** | | **144.144 B** | | Presupuesto de §5: ≤ 150 kB ✅ (medido en el build por `scripts/check-bundles.mjs`) |

**Por qué el archivo con todos los ejes.** Se compararon tres cortes de Fraunces con capturas (fase 0): solo `opsz` (67 kB), solo `SOFT` con el tamaño óptico fijo en 14 (62 kB, los títulos quedan pesados) y el completo (121 kB). El eje `SOFT` es la firma de la dirección (los remates redondeados, de barro) y `opsz` hace que la misma familia funcione a 17 px y a 96 px; solo el corte completo tiene los dos. Si el rendimiento lo pidiera en la fase 8, el plan B es el corte `opsz` (−54 kB) con `SOFT` 0.

**Sin cursiva.** La cursiva de Fraunces (46 kB más) no cabe en el presupuesto. El énfasis se marca con el peso (`strong`); los extranjerismos se evitan en los textos (`docs/ESTILO.md`, fase 7). Si alguno es inevitable, el navegador sintetiza la cursiva.

Reglas de uso:

- **Títulos** (`h1`–`h3`): Fraunces, `SOFT` 100 (`--soft-display`), peso 560 (`--weight-heading`), interletraje negativo y `text-wrap: balance`. Dos líneas como máximo.
- **Texto:** Fraunces, `SOFT` 0, peso 400, tamaño óptico automático (`font-optical-sizing: auto`, por defecto). Interlineado 1,55 y medida de 65 caracteres (`--measure`).
- **Geist Mono** solo para lo que es dato o máquina: la pantalla del aparato y su espejo HTML, lecturas (BPM, dBFS, ms, Hz), la ficha técnica, `code` y `kbd`. Siempre con cifras tabulares (`font-variant-numeric: tabular-nums`). **Nunca** como etiqueta decorativa ni para «parecer técnico».
- Las pilas de reserva (`Iowan Old Style`, `Palatino Linotype`, Georgia; `ui-monospace`, Cascadia Mono, Consolas) mantienen el carácter mientras carga la fuente (`font-display: swap`). El ajuste de métricas de la reserva (`size-adjust`) y la precarga de Fraunces se hacen en la fase 8, con el CLS medido.

### 3.1 Escala

Escala fluida con `clamp()` entre 360 y 1440 px de ancho. **Cinco tamaños a la vista como mucho** en una pantalla; la relación entre el titular y el texto es de 5 a 1 en escritorio.

| Token | Valor | A 360 px | A 768 px | A 1440 px | Uso |
|---|---|---|---|---|---|
| `--text-xs` | `0.8125rem` | 13 | 13 | 13 | Solo Geist Mono: tokens, anotaciones |
| `--text-s` | `0.9375rem` | 15 | 15 | 15 | Pie, notas |
| `--text-m` | `clamp(1.0625rem, 1.02rem + 0.19vw, 1.1875rem)` | 17 | 17,8 | 19 | Texto corrido |
| `--text-l` | `clamp(1.25rem, 1.1rem + 0.65vw, 1.625rem)` | 20 | 22,6 | 26 | Entradilla, `h3`, marca de la cabecera |
| `--text-xl` | `clamp(1.75rem, 1.35rem + 1.8vw, 2.75rem)` | 28,1 | 35,4 | 44 | `h2` |
| `--text-display` | `clamp(3rem, 1.6rem + 6.4vw, 6rem)` | 48,6 | 74,8 | 96 | `h1` |
| `--text-colossal` | `clamp(5rem, 2rem + 18vw, 16rem)` | 96,8 | 170,2 | 256 | Solo el nombre que cierra la página (decorativo, fuera de la escala de lectura) |

| Token | Valor | Uso |
|---|---|---|
| `--leading-display` | 0,96 | `h1` |
| `--leading-heading` | 1,1 | `h2`, `h3` |
| `--leading-lead` | 1,4 | Entradillas |
| `--leading-text` | 1,55 | Texto corrido |
| `--leading-colossal` | 0,8 | El nombre del pie |
| `--tracking-display` | −0,03 em | `h1` |
| `--tracking-heading` | −0,015 em | `h2` y marca |
| `--tracking-colossal` | −0,04 em | El nombre del pie |
| `--weight-text` / `--weight-strong` / `--weight-heading` | 400 / 600 / 560 | Texto, énfasis y botones, títulos |
| `--weight-brand` | 640 | La marca «Torno» (cabecera y pie) |
| `--soft-display` / `--soft-text` | 100 / 0 | Eje `SOFT` de Fraunces en títulos / en texto |

---

## 4. Espacio y retícula

Base de 4 px. Los huecos dentro de un bloque son claramente menores que la separación entre secciones.

| Token | Valor | | Token | Valor |
|---|---|---|---|---|
| `--space-1` | 4 px | | `--space-6` | 32 px |
| `--space-2` | 8 px | | `--space-7` | 48 px |
| `--space-3` | 12 px | | `--space-8` | 64 px |
| `--space-4` | 16 px | | `--space-9` | 96 px |
| `--space-5` | 24 px | | `--space-10` | 128 px |

| Token | Valor | A 360 / 768 / 1440 px | Uso |
|---|---|---|---|
| `--page-margin` | `clamp(1rem, 0.6rem + 1.8vw, 2.5rem)` | 16 / 23 / 36 px | Márgenes laterales, iguales a los dos lados |
| `--max-width` | `76rem` | 1216 px | Ancho máximo del contenido |
| `--measure` | `65ch` | — | Medida del texto corrido |
| `--section-gap` | `clamp(5rem, 3rem + 7vw, 10rem)` | 80 / 102 / 149 px | Separación entre secciones |

Todo bloque de página usa `inline-size: min(var(--max-width), 100% - 2 * var(--page-margin))` centrado: una sola retícula con los mismos márgenes en todas las páginas.

---

## 5. Forma, foco y movimiento

| Token | Valor | Uso |
|---|---|---|
| `--radius-pill` | `999px` | Botones y controles: redondos del todo, como una pella de barro. Se decide una vez y no se mezcla con esquinas cuadradas. |
| `--radius-panel` | `1.25rem` | Paneles |
| `--radius-s` | `0.5rem` | `kbd`, la pantalla |
| `--focus-ring` / `--focus-offset` | `2px solid var(--color-focus)` / `3px` | Foco visible con teclado (`:focus-visible`), nunca con el ratón |
| `--target-min` | `2.75rem` (44 px) | Altura mínima de todo lo que se pulsa (enlaces de navegación incluidos) |
| `--duration-fast` / `--duration` | 120 / 220 ms | Respuesta de los controles / transiciones |
| `--ease-out` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Salida exponencial suave |

- **Sombras:** ninguna en reposo. Solo lo que de verdad flota (un menú, un diálogo) lleva sombra con desplazamiento y desenfoque.
- **Líneas:** ninguna de 1 px como separador. Se separa con espacio o con un escalón de tono.
- **Movimiento:** solo `transform` y `opacity`. Con `prefers-reduced-motion: reduce` y en `?captura=1` no hay transiciones ni animaciones (`base.css`); el botón «Pausar movimiento» del instrumento llega en la fase 6.

---

## 6. Componentes base

Todos en `src/styles/base.css` (compartidos) o en el componente que los usa.

| Componente | Cómo es | Estados |
|---|---|---|
| **Botón principal** (`.button`) | Relleno de terracota, texto `--color-on-accent` en peso 600, píldora, ≥ 44 px de alto | Encima: `--color-accent-hover`. Pulsado: escala 0,97. Foco: anillo de tinta a 3 px. Desactivado: `aria-disabled="true"` u opacidad 0,55 y cursor de prohibido. |
| **Botón secundario** (`.button--secondary`) | Relleno `--color-surface-2`, texto de tinta | Encima: `--color-surface` |
| **Enlace** | Tinta con subrayado de terracota (0,08 em, separado 0,2 em) | Encima: el subrayado pasa a tinta. En la navegación, el subrayado aparece solo en la página activa (`aria-current="page"`) y al pasar por encima. |
| **Saltar al contenido** (`.skip-link`) | Píldora invertida (fondo de tinta). Su `href` lleva la ruta actual (`/ruta#contenido`): con `<base href="/">`, un `#contenido` suelto llevaría a la portada. Con JS, el clic lleva el foco a `main` sin tocar la URL. | Oculta hasta que recibe el foco; es lo primero de la página (probado con teclado en e2e) |
| **Panel** | `--color-surface`, `--radius-panel`, relleno de 32 px, sin borde ni sombra | — |
| **Estado en vivo** | `role="status"`, Geist Mono, tinta suave; reserva 3 líneas para no mover el diseño | Reposo, cargando, hecho y error, siempre con texto |
| **Tecla** (`kbd`) | Geist Mono sobre `--color-surface-2`, `--radius-s` | — |
| **Cabecera** | Marca «Torno» (Fraunces `SOFT` 100, `--weight-brand`) y dos enlaces, todos con 44 px de zona pulsable. Sin barra ni fondo propio. | — |
| **Pie** | El nombre vuelve en grande (`--text-colossal` en `--color-ink-faint`, decorativo, `aria-hidden`), autor, nota de privacidad y enlaces legales | — |
**Superficies del navegador**, tematizadas también: selección (`--color-accent` con `--color-on-accent`), cursor de texto (`caret-color` de terracota), barra de desplazamiento (`scrollbar-color`), `color-scheme: dark` para los controles nativos y `theme-color` igual al fondo.

---

## 7. Materiales y colores del instrumento

Valores **de partida** para la maqueta de la fase 5.a; las capturas de esa fase los ajustan y Iván los aprueba. Los colores se escriben en sRGB (como `three` espera con `ColorManagement` activo, que los pasa a lineal) y están en `tokens.css` para que el instrumento HTML (fase 2) use los mismos.

| Pieza | Material | Color base (sRGB) | `metalness` | `roughness` | Otros parámetros (`MeshPhysicalMaterial`) |
|---|---|---|---|---|---|
| **Cuerpo** | Terracota mate: barro cocido sin esmaltar | `--instrument-body` `#aa5c40` | 0 | 0,85 | Textura procedural de cerámica: grano fino en el color (±4 % de luminancia) y en la rugosidad (±0,08), mapa normal suave de poros. Sin `clearcoat`. Bisel generoso en los cantos. |
| **Disco** | Cerámica vidriada (esmalte oliva) | `--instrument-glaze` `#626838` | 0 | 0,3 | `clearcoat` 1, `clearcoatRoughness` 0,06; el esmalte se oscurece un poco hacia el borde (acumulación). Anillo de latón alrededor. |
| **Anillo del disco, diales, brazo, rueda y tornillos** | Latón envejecido | `--instrument-brass` `#c4a269` | 1 | 0,38 | `anisotropy` 0,4 en los anillos y el moleteado (cepillado circular); pátina: más rugosidad en los huecos. |
| **Teclas de transporte** | Cerámica crema esmaltada | `--instrument-key` `#e7ddc8` | 0 | 0,45 | `clearcoat` 0,5, `clearcoatRoughness` 0,2; rótulos grabados en `--color-bg`. |
| **Pantalla** | Vidrio sobre fósforo | fondo `--color-screen` `#0c1a0f`, texto `--color-phosphor` `#79f481` | 0 | 0,05 | Textura de canvas emisiva, alimentada por el modelo de pantalla (§4.5); `clearcoat` 1 para el reflejo del vidrio. |
| **Pilotos** | Emisivos | capas: `--color-phosphor`; grabar: `--instrument-led-rec` `#f6623d` | 0 | 0,3 | `emissiveIntensity` según el estado; apagado = un tono apagado del mismo color, no negro. |
| **Patas** | Goma | `#1d1d19` | 0 | 0,9 | — |

Luz y color (para decidir en la fase 5.a con capturas): `RoomEnvironment` + PMREM, una luz principal para los brillos del latón y del esmalte, sombra de contacto horneada; salida sRGB con *tone mapping* Khronos PBR Neutral o AgX. El riesgo de la dirección es que la cerámica no parezca real: la rugosidad alta y el grano del cuerpo frente al brillo del esmalte del disco y de las teclas es lo que la hace creíble.

**Variantes candidatas** para las tres de la fase 5.a (dentro de la dirección):

1. **Terracota** (la de esta tabla): cuerpo de barro rojo claro, disco de esmalte oliva, teclas crema.
2. **Barro oscuro:** cuerpo más rojo y oscuro (`#8e4632`), disco de esmalte crema, latón más brillante.
3. **Arcilla clara:** cuerpo de bizcocho claro (`#c9a27e`), disco de esmalte oliva oscuro, latón oscuro.

---

## 8. Comprobaciones

| Qué | Cómo |
|---|---|
| Contraste AA de cada combinación | `scripts/contrast.spec.ts` (en `npm test`) y la tabla de §2.1 (`node scripts/contrast.mjs`) |
| Peso de las fuentes ≤ 150 kB | `scripts/check-bundles.mjs` (en `npm run check`) |
| Solo las dos fuentes latinas y ninguna petición a terceros | `e2e/static.spec.ts` |
| axe sin violaciones (graves, críticas, moderadas ni leves) en las tres rutas | `e2e/static.spec.ts` |
| `theme-color` = fondo, idioma = `es` | `src/app/core/site.config.spec.ts` |
| Que se parezca a lo que dice este documento | Capturas `?captura=1` de cada fase (`npm run capturas -- --fase=N`) |
