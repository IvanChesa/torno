# Estilo de los textos

Cómo se escriben los textos visibles de Torno: la web, el instrumento, los avisos y los nombres accesibles. Lo pide `CLAUDE.md` («Idioma») y la fase 7 del plan. Manda sobre cualquier costumbre del inglés.

Los textos viven en archivos `*.content.ts`, junto a su componente, con `reviewed: false` hasta que Iván los revisa (la lista, en el informe de la fase 7).

---

## 1. Voz

- **Tuteo.** «Toca», «graba», «tu audio». Nunca «usted» ni el plural «toquen».
- **Frases cortas.** Una idea por frase; si una frase lleva dos comas y un «que», se parte.
- **Primero lo que pasa, luego el detalle.** «Mantén el disco para congelar la capa. Al soltarlo, vuelve a su sitio».
- **Sin promesas ni adjetivos de anuncio.** Ni «revolucionario», ni «increíble», ni «la mejor experiencia». Lo que hace y cómo; el que lee decide si le gusta.
- **Sin inventar.** Ni cifras, ni clientes, ni opiniones. Si no está medido, no se escribe (§5).
- **Sin cursiva** (no hay cursiva de Fraunces; `DISENO.md` §3). El énfasis, con `strong`, y poco.
- **El estado nunca solo en color:** cada aviso dice con palabras qué pasa y qué hacer.

## 2. Vocabulario

En español, siempre que haya palabra:

| Sí | No |
|---|---|
| bucle | *loop* |
| toma | *take* |
| sobregrabación, sobregrabar | *overdub* |
| capa | *track*, pista (pista es solo el archivo que se exporta de cada capa) |
| cuenta previa | *count-in* |
| metrónomo | *click* |
| tempo, pulsos por minuto (BPM en la pantalla) | *beats* |
| compás, pulso | *bar*, *beat* |
| marcar el tempo con pulsaciones | *tap tempo* |
| silenciar, en silencio | *mute* |
| reverso, del revés | *reverse* |
| filtro, brillo | *cutoff* |
| reposo | *standby* |
| mezcla | *mix* |
| panorama | *pan* |
| latencia | *lag* |
| forma de onda | *waveform* |
| vista despiezada, despiezar | *exploded view* |
| pantalla completa | *fullscreen* |
| autoguardado | *autosave* |
| diales, teclas, disco, brazo, rueda | *knobs*, *buttons*, *jog wheel*, *fader* |

- **Las marcas y los nombres propios**, como son: Angular, Three.js, Web Audio, AudioWorklet, WebGL, Cloudflare Pages, GitHub. Sin explicar lo que no hace falta.
- **Las siglas**, en mayúsculas y sin puntos: BPM, WAV, MIDI, CPU, FPS, kHz. La primera vez que una sigla técnica sale en un texto para todos, con su explicación: «la latencia (lo que tarda el sonido en salir)».
- **Los nombres de los sonidos** son los del catálogo (`instrument/sounds.ts`): ALFAR, RAÍZ, OLIVO, CIERZO… En el texto corrido, con mayúscula inicial: Alfar, Raíz.
- **Los controles**, con artículo y en minúscula: «el disco», «el brazo», «el dial principal», «la tecla de grabar».

## 3. Formato

- **Mayúsculas:** solo la primera palabra y los nombres propios, también en los títulos y los botones («Ver en el instrumento», no «Ver En El Instrumento»). La pantalla del aparato va en mayúsculas porque es una pantalla de fósforo: es su forma, no la de la web.
- **Comillas:** angulares «» para citar y para nombrar botones y opciones («Pausar movimiento»); dentro, las inglesas “ ”.
- **Rayas y guiones:** la raya (—) solo para incisos largos, y mejor evitarla; el guion (-) para unir palabras. El signo menos de las cifras negativas es − (U+2212).
- **Teclas:** con `kbd` y el nombre en español: Espacio, Intro, Esc, Mayús, Inicio, Fin, las flechas (← →).
- **Botones:** un verbo en infinitivo o la acción que hacen: «Tocar», «Escuchar la batería», «Ver en el instrumento». Nunca «Haz clic aquí».
- **Enlaces:** el texto dice adónde llevan («el código en GitHub», no «aquí»).
- **Listas:** una lista solo si hay tres cosas o más; si no, una frase.

## 4. Cifras y unidades

- **Con `Intl` y `es-ES`** (`core/format.ts`): coma decimal y punto de millar desde 10.000 (`es-ES` no agrupa los números de cuatro cifras: 4800, pero 48.000). En el código, nunca se escribe una cifra con formato a mano si sale de un cálculo.
- **Espacio entre la cifra y la unidad**, sin separar (U+00A0 si el texto puede partirse ahí): 48 kHz, 90 BPM, 4,3 ms, 596 kB. El porcentaje también: 12 %.
- **Unidades del Sistema Internacional** y sus símbolos: ms, s, kHz, dB, dBFS, mm. kB son 1000 bytes; MiB, 1.048.576.
- **Rangos** con «de… a…» en el texto («de 40 a 240 BPM») y con guion corto en las tablas (40–240 BPM).
- **Las veces:** «240 veces el tiempo real» en el texto; «240×» en la ficha técnica.

## 5. Mediciones

Cada cifra publicada (la ficha técnica y `/sobre-el-proyecto`) es una **medición**, no un objetivo:

1. **Qué se midió**, con su unidad: «Del gesto al cambio en el audio: de 0,4 a 4,3 ms».
2. **Cómo y dónde**: la prueba, el navegador o el equipo, y las condiciones («en Chromium, con el motor ya cargado, 50 repeticiones»).
3. **El informe** donde está el detalle (`docs/informes/fase-N.md`).

- **Con el rango o la mediana**, no la mejor cifra suelta. Si se dan dos cifras (frío y caliente, escritorio y móvil), las dos.
- **Lo que no se ha medido no se publica**, aunque sea el objetivo del plan. Si falta, se dice «pendiente de medir en el móvil», o no se pone.
- **Sin redondeos que favorezcan:** 4,3 ms es 4,3 ms, no «menos de 5».

## 6. Accesibilidad de los textos

- **Nombres accesibles** (`aria-label`) cortos y con el mismo verbo que el rótulo visible: si la tecla dice «Grabar», el nombre empieza por «Grabar».
- **`aria-valuetext`** con la unidad y en palabras: «90 BPM», «Capa 2: 80 %, en silencio».
- **Regiones en vivo** (`aria-live`): frases completas y sin ruido; solo lo que cambia.
- **Texto alternativo** de las imágenes: lo que se ve y para qué está («Torno despiezado: el cuerpo de barro, la cubierta, el disco y las piezas de latón, separados»). Las decorativas, `alt=""`.
- **Títulos** que se entiendan solos en la lista de títulos de un lector de pantalla: «Conoce tu instrumento», no «Más».
