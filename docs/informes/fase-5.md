# Informe: Fase 5 (diseño del instrumento y modelo 3D)

- **Rama:** `fase-5-modelo-3d`
- **Fecha:** 2026-10-30 (5.a)
- **Estado:** entrega 5.a terminada y **PARADA** (prevista). Espera a que Iván apruebe el diseño y haga las pruebas del móvil (`docs/PRUEBAS-MOVIL.md`) antes de la 5.b. La revisión y la fusión de la fase llegan al final de la 5.b.

## 0. Plan de la fase

**Antes de la fase, en `main`** (revisión del bloque B, fase 4; respuesta al final de `docs/revisiones/bloque-B.md`):
- la precarga de ALFAR al acercarse al instrumento (`765ba8a`);
- las vistas previas de las ramas `fase-*` (`7bd30da`): gracias a ellas, esta rama se publica en `https://fase-5-modelo-3d.torno.pages.dev`;
- el PR #1 de Dependabot (`3bc5bbb`).

**Entrega 5.a: maqueta** (esta sesión; termina con la PARADA):

1. **Medidas y distribución propias, en mm** (`src/app/instrument/layout.ts`, TS puro: la misma fuente para el 3D, el instrumento HTML y la guía). La idea sale del nombre: **un torno de alfarero visto desde arriba**. El aparato es **redondo**, Ø 300 mm, con el **disco en el centro**, como la cabeza del torno, y los controles alrededor, por zonas:
   - a la izquierda, las **4 capas** en arco (la mezcla);
   - delante, las **3 teclas** de transporte (lo que más se pulsa, lo más cerca);
   - a la derecha, el **brazo**: una costilla de alfarero de latón que se acerca al disco para «moldear» el sonido («hacia dentro, más oscura», como dice su ayuda);
   - detrás, la **bandeja**: un borde levantado, como el de un torno, con la pantalla curva. Delante de ella, el dial principal, el reposo y la rueda de volumen. *Al principio era una consola en media luna con el volumen y el reposo en sus extremos, pero así sus zonas táctiles chocaban con la capa 1 (cálculo de §2.1).*

   Nada de la distribución del original (cuerpo casi cuadrado, disco grande a la izquierda, brazo de tocadiscos arriba a la derecha, columna de teclas y dial a la derecha, cuatro diales delante). Un test comprueba que las piezas caben en el cuerpo, que no se solapan y que dejan sitio para zonas táctiles de 44 px en el encuadre del móvil.
2. **Modelo de bloques** (`src/app/scene/`):
   - piezas sencillas: `LatheGeometry`, cilindros, `RoundedBoxGeometry` y `ExtrudeGeometry`;
   - `MeshPhysicalMaterial` provisionales según `DISENO.md` §7;
   - `RoomEnvironment` + PMREM, una luz principal y una sombra de contacto pintada una vez;
   - sin texturas procedurales todavía (son de la 5.b), salvo la pantalla con su texto;
   - **3 variantes de color** de `DISENO.md` §7: Terracota, Barro oscuro y Arcilla clara.
3. **Visor de la maqueta** en la portada con `?maqueta=1`:
   - variante, mapeo de tonos y vista con botones nativos;
   - órbita libre para inspeccionar y render bajo demanda (0 fps quieto);
   - `?captura=1` determinista;
   - `three` y la escena se cargan con `import()` desde `scene/index.ts`: nada entra en el bundle inicial (lo comprueba `check-bundles`). Sin `?maqueta=1`, la portada no carga nada del 3D.
4. **Capturas** (`npm run capturas -- --fase=5 --solo=maqueta`): las 3 variantes desde 4 ángulos (frente, tres cuartos, cenital y perfil), en escritorio y móvil, más la **prueba de mapeo de tonos** (Khronos PBR Neutral frente a AgX) con la misma vista.
5. **Propuesta del instrumento HTML** con la distribución nueva (revisión de la fase 2, #20), en este informe.
6. **Publicar** la maqueta en la vista previa de la rama y **PARAR** (`DIARIO.md` y chat). La 5.b no empieza sin la aprobación de Iván ni sin sus pruebas del móvil en `docs/PRUEBAS-MOVIL.md`.

**Entrega 5.b** (después de la parada): el modelo definitivo, `SceneEngine`, calidad, pérdida de contexto e `instrument-stage` (PLAN, fase 5). Su plan se escribe aquí al empezarla.

**Riesgos:**
- **Que la cerámica no parezca real** (`DISENO.md` §7): en la 5.a solo se valoran la forma, la distribución y la paleta; el grano, los poros y la pátina llegan con las texturas de la 5.b.
- **Lo redondo en el móvil vertical:** un objeto redondo encaja mejor en una pantalla vertical que uno apaisado, pero sus controles quedan más juntos. El test de medidas comprueba la separación para 44 px con el aparato entero en 360 px de ancho.
- **WebGL sin GPU:** el navegador sin interfaz de las capturas pinta por software, así que pueden tardar. El visor marca `data-listo` cuando ha pintado.

**Skills consultadas:**
- `threejs-scene`, `threejs-geometry`, `threejs-materials` y `threejs-lighting`;
- `threejs-performance`, para `dispose()`;
- `threejs-accessibility`, para los controles nativos del visor y el movimiento reducido.

## 1. Resumen
La 5.a propone el aparato y lo enseña en 3D para que Iván lo apruebe:
- **Torno es redondo**, como un torno de alfarero visto desde arriba: Ø 300 mm, el disco en el centro y los controles alrededor, por zonas. Las medidas viven en `src/app/instrument/layout.ts` (TS puro), la misma fuente para el 3D, el instrumento HTML y la guía. Los tests comprueban que todo cabe, que nada se solapa y que las zonas táctiles de 44 px no se pisan en el móvil.
- **Maqueta en bloques** (`src/app/scene/`):
  - piezas torneadas a partir de perfiles en mm, con los materiales físicos provisionales de `DISENO.md` §7 en **3 variantes**;
  - entorno con PMREM, una luz principal y sombra de contacto;
  - se ve en la portada con **`?maqueta=1`**: botones para la variante, el mapeo de tonos y la vista, órbita para inspeccionar y render bajo demanda;
  - `three` va en un chunk diferido de 632 kB; el bundle inicial apenas cambia (302,4 kB).
- **Capturas** de las 3 variantes desde 4 ángulos y la **prueba de mapeo de tonos**, en escritorio y móvil, y **propuesta del instrumento HTML** con la distribución nueva.
- Antes, en `main`: la precarga de ALFAR (la primera reproducción en frío baja de **200–272 ms a 68–93 ms** en el escritorio) y las vistas previas de las ramas de fase.

**Para Iván (la parada):** aprobar la distribución, elegir la variante y el mapeo de tonos, y dar el visto bueno a la propuesta del instrumento HTML (§10). Mi recomendación: **Terracota con Neutral**.

## 2. Criterios de aceptación
Los criterios de la fase 5 se cierran al final de la 5.b. Esto es lo que pide la 5.a, con su evidencia:

| Entregable de la 5.a | Estado | Evidencia |
|---|---|---|
| 5.a.1 Medidas y distribución propias (mm), coherentes con `DISENO.md` y distintas del original | ✅ | §2.1 y `src/app/instrument/layout.ts`; 11 tests en `layout.spec.ts` |
| 5.a.2 Modelo de bloques con materiales provisionales y 3 variantes de color; capturas de 4 ángulos en escritorio y móvil | ✅ | `src/app/scene/`; 24 capturas y 2 hojas de contactos (§7) |
| 5.a.3 Prueba de *tone mapping* (Neutral frente a AgX) con capturas | ✅ | §2.2; 6 capturas y 2 hojas (§7) |
| 5.a.4 Propuesta del instrumento HTML con la distribución nueva | ✅ | §2.3 y `propuesta-html-*.png` |
| La maqueta, en la vista previa de su rama | ✅ | `https://fase-5-modelo-3d.torno.pages.dev/?maqueta=1` (§11) |
| 5.a.5 PARADA para la aprobación de Iván | ✅ | `DIARIO.md` y `PENDIENTES.md` |

Criterios de la fase (se cierran en la 5.b):

| Criterio | Estado | Nota |
|---|---|---|
| Diseño aprobado por Iván (5.a) y capturas finales coherentes con él | ⏳ | Pendiente de Iván |
| Peso, VRAM, FPS, tiempo de generación y tamaño del chunk según §5 (cifras) | ⏳ (5.b) | Adelanto de la maqueta en §6 |
| 0 fps en reposo; pérdida y recuperación del contexto probadas; sin fugas en 10 cambios de calidad | ⏳ (5.b) | La maqueta ya pinta solo cuando algo cambia |

### 2.1 La distribución: un torno de alfarero
Vista desde arriba en `maqueta-*-cenital-*.jpg`. El ángulo se mide desde delante (0°, hacia quien toca), y es positivo hacia la derecha:

| Zona | Piezas | Posición (radio, ángulo) | Tamaño |
|---|---|---|---|
| Centro | **Disco** de cerámica vidriada, levantado 2 mm sobre un hueco oscuro, con anillo de latón, cubo y una marca crema | eje | Ø 150 mm (162 con el anillo), 12 mm de grueso |
| Izquierda | **Capas 1–4** en arco, de la 1 (detrás) a la 4 (delante), cada una con su piloto hacia el disco | 121 mm; −134°, −106°, −78°, −50° | diales de latón Ø 30 × 14 mm |
| Delante | **Reproducir, grabar y deshacer**: teclas de cerámica crema vueltas hacia el disco; el piloto de grabar, detrás de su tecla | 122 mm; −24°, 0°, 24° | 32 × 26 × 8 mm |
| Derecha | **Brazo**: una costilla de alfarero de latón (la hoja con forma de riñón con la que se alisa el barro) al final de una barra que gira sobre su eje. En reposo mira hacia delante, por fuera, y no filtra. Al girar 41° se acerca al disco y el sonido se oscurece | eje a 132 mm y 84°; barra de 58 mm | costilla de 30 × 18 × 3 mm; va de 144 a 104 mm del centro |
| Detrás | **La bandeja**: un borde levantado e inclinado 10° hacia atrás, como la bandeja de un torno, con la **pantalla curva** en su cara de dentro | de 134 a 142 mm; 180° ± 32° | 36 mm de alto; pantalla de 125 × 19 mm (±26°) |
| Detrás, delante de la bandeja | **Tempo y menú** (dial grande), **reposo** (botón) y **volumen** (rueda de canto, que asoma por una ranura) | 136° y 114 mm · 180° y 110 mm · −156° y 114 mm | Ø 40 × 18 · Ø 14 × 5 · Ø 30 × 10 mm |

El cuerpo es una pieza torneada: arranca de una base de Ø 282 mm, se abre hasta los Ø 300 mm y sube recta hasta un canto con bisel de 10 mm. Apoya en tres patas de goma. **Mide 46 mm de alto hasta la cubierta** (40 de cuerpo y 6 de patas) **y 82 mm con la bandeja**.

**Por qué así:**
- **El nombre hecho objeto:** el disco es la cabeza del torno y todo gira a su alrededor. El brazo es una herramienta de alfarero, no el de un tocadiscos.
- **Zonas por función**, en el orden de la mano: mezclar a la izquierda, tocar delante, expresar a la derecha, y leer y ajustar detrás.
- **Nada del original:** ni cuerpo casi cuadrado, ni disco a un lado, ni brazo de tocadiscos arriba a la derecha, ni columna de teclas con el dial a la derecha, ni cuatro diales delante (aquí, delante solo van las teclas).
- **En el móvil vertical,** un objeto redondo llena la pantalla mejor que uno apaisado (compárense las capturas `maqueta-*-movil.jpg`).

**Comprobado por tests** (`src/app/instrument/layout.spec.ts`):
- cada control del catálogo tiene su sitio;
- todas las piezas caben en la cubierta plana (r ≤ 140 mm) y dejan 6 mm hasta el disco y entre ellas;
- los pilotos caben entre su dial y el disco, y nada choca con la bandeja;
- el brazo, en todo su recorrido, no pasa por encima de ninguna pieza, y su costilla no toca el disco;
- **las zonas táctiles de 44 px no se solapan en el móvil**, con el aparato en 330 px de ancho (1,1 px/mm) y la cámara a 45° o más. La menor distancia entre dos centros es de **49,9 px** desde arriba, **48,7 px** a 60° y **45,6 px** a 45° (entre las capas 2 y 3). Todas quedan a más de media zona del disco. El encuadre de verdad se prueba con la proyección en la fase 6.

### 2.2 Mapeo de tonos: Neutral
La hoja `maqueta-tono-escritorio.jpg` (y su versión `-movil`) enseña las 3 variantes desde tres cuartos: arriba con Khronos PBR Neutral y abajo con AgX, con la misma luz.

- **AgX apaga los colores:** la terracota pasa a salmón, el latón a beis y el esmalte crema a gris. Va bien en escenas con luces muy intensas, y esta no las tiene.
- **Neutral deja cada material en su color** de `DISENO.md` y solo comprime los brillos.

**Propuesta: Neutral**, porque es un objeto de producto, con los colores de la marca y una luz de estudio.

**La luz se ajustó con las capturas:**
- el entorno, a 0,55;
- la luz principal, desde arriba, algo a la izquierda y detrás.

Así la cubierta sale en su color, los cantos de delante quedan en penumbra y el esmalte y el latón brillan hacia la cámara. Con la luz delante, la pared del cuerpo salía mucho más clara que su color (#d2714d en lugar de #aa5c40) y el aparato parecía un cojín.

### 2.3 El instrumento HTML con la distribución nueva (propuesta)
Los bocetos `propuesta-html-escritorio.png` y `propuesta-html-movil.png` están pintados con las mismas medidas:

- **Un plato redondo** con las mismas posiciones que el 3D (las de `instrument/layout.ts`, llevadas a CSS con las variables `--x` y `--z`), en todos los tamaños. Así, quien toca sin WebGL encuentra cada control donde está en el aparato, y la guía (fase 7) puede señalar el mismo sitio en los dos.
- **La pantalla sube encima del plato**, como un panel con su texto real: dentro del plato no se leería.
- **Rótulos:** en el escritorio, alrededor del plato. En el móvil no caben, así que van en una leyenda debajo. Cada control conserva su nombre accesible.
- **Zonas táctiles:** con el plato a todo el ancho de un móvil de 360 px (330 px de plato), la separación es la misma del test: 49,9 px desde arriba. En una pantalla de 320 px se quedaría justo por debajo de 44 px; ahí, el plato tendría que llegar al borde de la pantalla.
- **Contraste:** el plato sigue en `--instrument-plate` (#864230), con el que los rótulos y los controles ya cumplen AA (`DISENO.md` §2.1).

Si Iván lo aprueba, se hace en la 5.b, con los e2e del instrumento HTML como red.

## 3. Tareas del plan
| Tarea | Estado | Notas |
|---|---|---|
| Al empezar el bloque C: precarga de ALFAR | hecha (en `main`) | `765ba8a`; cifras en `docs/revisiones/bloque-B.md`, «Respuesta» |
| Al empezar el bloque C: vistas previas de las ramas `fase-*` | hecha (en `main`) | `7bd30da`; esta rama es la primera que la usa |
| 5.a.1 Medidas y distribución | hecha | `instrument/layout.ts` |
| 5.a.2 Modelo de bloques y 3 variantes | hecha | `scene/model/`, `scene/materials/`, `scene/camera/` y `scene/mockup/` |
| 5.a.3 Prueba de *tone mapping* | hecha | §2.2 |
| 5.a.4 Propuesta del instrumento HTML | hecha (propuesta) | §2.3; la implementación, tras la aprobación |
| 5.a.5 PARADA | hecha | |
| 5.b | sin empezar | Espera la aprobación y las pruebas del móvil |

## 4. Desviaciones del plan y motivo
- **Las medidas van en `instrument/`, no en `scene/model/`.** El plan pide medidas reales en mm, documentadas (§4.6), y un único modelo del instrumento (D11). Si las medidas fueran del 3D, el instrumento HTML y la guía tendrían que copiarlas. `scene/` las lee de `instrument/`, como permite §4.2.
- **La maqueta va en la portada con `?maqueta=1`**, no en una ruta propia. Así no cambian las rutas ni sus comprobaciones (prerenderizado, Pages y `verify-pages`). En la 5.b, el escenario de verdad la sustituye.
- **Las capturas de la maqueta van en JPEG**, con hojas de contactos. Un render 3D en PNG pesa varias veces más: así, las 38 imágenes de la 5.a suman 3,2 MB. Las de interfaz siguen en PNG. Las hojas las compone el propio navegador de las capturas, sin dependencias nuevas.
- **`npm run capturas -- --fase=5 --solo=maqueta`:** la 5.a no toca el instrumento HTML ni las páginas, así que esta vez no se repiten sus 30 capturas, que saldrían idénticas a las de la fase 4.

## 5. Decisiones técnicas nuevas
- **Todo torneado (`LatheGeometry`), desde perfiles en mm** con esquinas redondeadas (`scene/model/geometry.ts`):
  - si dos redondeos no caben en un lado, el pequeño se respeta y el grande se queda con lo que sobra;
  - las aristas vivas se duplican, para que el sombreado no las suavice;
  - los sectores, como la bandeja, llevan sus dos tapas.

  Alternativas: `ExtrudeGeometry` deformada (redondea mal los cantos curvos) o un GLB (D9 lo descarta). Un test comprueba que las caras miran hacia fuera.
- **El encuadre sigue la silueta proyectada** (`scene/camera/views.ts`), no la esfera que envuelve el aparato. La cámara se aleja hasta que todos los puntos caben con un 8 % de margen y se centra en lo que se ve, con cualquier proporción del lienzo. Con la esfera, el aparato redondo quedaba pequeño.
- **Render bajo demanda desde el principio:** el visor solo pinta, en un `requestAnimationFrame`, cuando cambia algo (la órbita, la vista, la variante o el tamaño). Quieto, 0 fotogramas.
- **`disposeObject()`** (`scene/dispose.ts`) recorre la escena y libera geometrías, materiales y texturas, cada cosa una vez. Lo prueba un test en Node.
- **Los tests del 3D corren en Node** (Vitest, como las capas de TS puro): la geometría se construye sin DOM ni WebGL, y las texturas de canvas las pone el visor.
- **La variante Terracota es la de `tokens.css`** (lo comprueba un test): los colores siguen teniendo una sola fuente.

## 6. Salida de los checks
```
npm run check            → 0 errores
  lint (tsc de las capas, ng lint y prettier) → sin errores
  tests en Node            → 473 (antes 453: +11 de las medidas y +9 del 3D)
  tests de Angular         → 74 (antes 69: +5 del modo maqueta)
  cobertura (TS puro)      → 98,42 % de sentencias · 95 % de ramas · 100 % de funciones
  presupuestos:
    JS inicial de /           302,4 kB (aviso > 330)   ← 302,1 antes de la fase
    Desbloqueo de audio         1,9 kB (error > 2,0)
    Motor de audio             23,0 kB · worker de síntesis 17,4 kB · de exportación 41,7 kB · worklet 40,8 kB
    Chunk 3D (three + escena) 631,8 kB (aviso > 800)
    Fuentes                   144,1 kB (error > 150)
    Bundle inicial sin motor de audio, síntesis, worklet ni 3D ✔
npx playwright test      → 101/101 en local (con el e2e nuevo de la maqueta, en dev y en estático)
```

**Lo que cuesta la maqueta** (adelanto para la 5.b; `data-estadisticas` en las capturas, Chromium sin interfaz):
- **44 llamadas de dibujo y 41 234 triángulos** por fotograma;
- **56 geometrías, 9 texturas** (las de canvas y el entorno) y **10 programas**;
- **24–41 ms** para generar el modelo y sus texturas (presupuesto de §5: ≤ 150 ms en el escritorio).

Son cifras de la maqueta. La 5.b añade detalle (moleteado, rótulos y texturas procedurales) y mide los FPS y la VRAM en un aparato de verdad.

**El e2e del tempo por pulsaciones** (`e2e/sounds.spec.ts`) falló 2 de 4 veces en el servidor de desarrollo con la precarga de ALFAR. La página está ocupada justo cuando el test pulsa, y Playwright espacia las pulsaciones algo más de 500 ms: salían 97 BPM, por debajo del mínimo de 100. No es un fallo de la aplicación, porque el tempo sale del momento de cada evento. Ahora el test lee esos momentos en la página y comprueba que el tempo es exactamente el de su intervalo medio: 18 de 18 en verde (`7afbd79`).

## 7. Capturas
En `docs/informes/img/fase-5/`, con `?captura=1` y el build servido por `wrangler pages dev`:
- **Hojas de contactos:** `maqueta-variantes-escritorio.jpg` y `-movil.jpg` (3 variantes × 4 vistas); `maqueta-tono-escritorio.jpg` y `-movil.jpg` (Neutral frente a AgX).
- **Cada imagen:** `maqueta-<variante>-<vista>-<escritorio|movil>.jpg` (24) y `maqueta-tono-agx-<variante>-<escritorio|movil>.jpg` (6).
- **La sección entera**, con los botones y las medidas: `maqueta-seccion-escritorio.png` y `-movil.png`.
- **La propuesta del instrumento HTML:** `propuesta-html-escritorio.png` y `-movil.png`.

![Las tres variantes desde los cuatro ángulos, en el escritorio](img/fase-5/maqueta-variantes-escritorio.jpg)

![Mapeo de tonos: Neutral arriba y AgX abajo](img/fase-5/maqueta-tono-escritorio.jpg)

![Propuesta del instrumento HTML, en el escritorio](img/fase-5/propuesta-html-escritorio.png)

## 8. Dependencias añadidas
| Paquete | Versión | Motivo | ¿Está en la lista permitida? |
|---|---|---|---|
| `three` | ^0.186.1 | El 3D (D3) | Sí (producción) |
| `@types/three` | ^0.186.0 | Sus tipos | Sí (desarrollo) |

## 9. Pendientes y `TODO(ivan)`
También en `docs/PENDIENTES.md`:
- **Aprobar el diseño** (la parada): la distribución redonda, la variante, el mapeo de tonos y la propuesta del instrumento HTML (§10).
- **Las pruebas del móvil** (`docs/PRUEBAS-MOVIL.md`): hacen falta antes de la 5.b. La prueba 1 ya puede dar la cifra de antes y la de después de la precarga de ALFAR.

## 10. Propuestas de cambio al plan (para la aprobación de Iván)
1. **Aprobar la distribución redonda** de §2.1.
2. **Variante: Terracota** (la 1). Contraste de los colores planos, antes de la luz (WCAG):

   | Variante | Teclas / cuerpo | Latón / cuerpo | Esmalte / cuerpo | Marca / esmalte | Cuerpo / fondo de la web |
   |---|---|---|---|---|---|
   | Terracota | 3,61 | 2,02 | 1,21 | 4,38 | 3,13 |
   | Barro oscuro | 5,07 | 3,15 | 4,47 | **1,13** | 2,23 |
   | Arcilla clara | **1,74** | **1,66** | 4,36 | 7,58 | 6,50 |

   - **Terracota:** es la de la marca, el disco oliva repite el fondo de la web y las teclas destacan (3,6:1). El latón se separa del cuerpo más por sus brillos que por su color.
   - **Barro oscuro:** es la más rotunda, pero la marca crema no se ve sobre el esmalte crema del disco (1,13:1; habría que hacerla de latón), y el cuerpo se pierde más en el fondo oliva.
   - **Arcilla clara:** es la más ligera, pero las teclas crema y el latón casi no se separan del cuerpo (1,7:1).
3. **Mapeo de tonos: Neutral** (§2.2).
4. **Instrumento HTML: el plato redondo** de §2.3, en la 5.b.
5. **La 5.b, en dos pasos**, para poder revisar cada uno con capturas:
   - primero, el modelo definitivo con sus materiales y texturas;
   - después, `SceneEngine`, la calidad, la pérdida de contexto e `instrument-stage`.

## 11. Cómo probarlo
- **En el móvil o en cualquier navegador:** `https://fase-5-modelo-3d.torno.pages.dev/?maqueta=1`, la vista previa de esta rama.
  - La maqueta va justo debajo del título. Los botones cambian la variante, el mapeo de tonos y la vista.
  - Para girarla, arrastra; para acercarla, usa la rueda o pellizca.
  - Lo elegido queda en la dirección, así que se puede enviar un enlace a una variante concreta (`&variante=barro-oscuro&tono=agx&vista=cenital`).
- **En local:** `npm run build`, después `node scripts/serve-pages.mjs` y abrir `http://localhost:4300/?maqueta=1`.
- **Las capturas otra vez:** `npm run capturas -- --fase=5 --solo=maqueta`, tras `npm run build`.
