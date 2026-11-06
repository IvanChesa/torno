# Pruebas en el móvil (fases 4.b y 8)

Lista para probar Torno en un Android y en un iPhone en la vista previa de Cloudflare Pages (el staging). La usó Iván en la fase 4 (el audio) y vuelve a servir en la fase 8, la última del bloque E, **con el 3D, la web y el lector de pantalla** (pruebas 15 a 26). Es el criterio de aceptación «Iván da el visto bueno en su móvil y en un iPhone» (PLAN, fase 8).

## Resultado

- **Fase 4 (Iván, 30-10):** probado en el móvil, funciona bien; sin cifras ni informe del panel. Con esto empezó la entrega 5.b.
- **Fase 8 (Iván, 05-11):** las pruebas 1 a 26, en el móvil y en el iPhone, «bien están». Sin cifras ni informe del panel. Con la 16, el 3D se queda como llega ahora (2b), y el espejo B también. Siguen sin medir en el móvil el primer sonido en frío (1), la latencia calibrada y las tomas seguidas (5 y 7), los 5 minutos sin cortes (10) y los FPS del 3D (15). No bloquean el lanzamiento: la ficha técnica solo publica lo medido.

## Cómo se rellena

Rellena las casillas y los huecos. Cuando la lista diga **«copia el informe»**, pulsa «Copiar el informe» en el panel de diagnóstico y pégalo al final de esta página, en «Informes del panel». Ni el panel ni la web envían nada: todo se queda en el móvil hasta que tú lo pegues aquí.

## Antes de empezar

- **Dirección:** `https://staging.torno.pages.dev/?diagnostico=1`. Es pública, sin contraseña, y no la indexan los buscadores (`noindex`). Se actualiza sola con cada cambio en `main`. Con `?diagnostico=1`, debajo del instrumento aparece el panel «Diagnóstico del audio». Las pruebas 1 a 14 son del audio (con el instrumento 3D de la portada o con el plato, `?sin3d=1&diagnostico=1`: los dos tocan lo mismo); de la 15 en adelante, el 3D y la web.
- **Desde la fase 8, el 3D llega con el primer gesto** (tocar o desplazar la página) **o a los 6 s sin tocar nada**; hasta entonces se ve su póster, que es el mismo aparato. Para la prueba 16, fíjate en cómo llega.
- **Auriculares con cable**, y unos Bluetooth si los tienes, para comparar la latencia.
- Volumen a media altura. Cierra las demás apps que suenen (música, vídeos).
- En el iPhone, haz las pruebas 1 a 3 con el **interruptor de silencio activado** (naranja) y repítelas desactivado.
- Navegador: Chrome en Android y Safari en el iPhone (los que use la gente). Si sobra tiempo, Firefox en Android.

## Los dispositivos

| Dato | Android | iPhone |
|---|---|---|
| Modelo | sin dato | sin dato |
| Versión del sistema | sin dato | sin dato |
| Navegador y versión | sin dato | sin dato |
| Auriculares (cable / Bluetooth, modelo) | sin dato | sin dato |
| Frecuencia de muestreo (panel) | sin dato | sin dato |
| Latencia base y de salida (panel) | sin dato | sin dato |

## La lista

Marca ✅ o ❌ y apunta las cifras y lo raro que veas u oigas.

| # | Prueba | Cómo | Android | iPhone |
|---|---|---|---|---|
| 1 | **Primera reproducción en frío** | Con el altavoz del móvil o auriculares de cable (los Bluetooth añaden por sí solos más de 150 ms). Abre la dirección en una pestaña nueva (mejor tras cerrar el navegador) y espera a que cargue del todo: el panel de diagnóstico aparece debajo del instrumento (si pulsas antes, esa reproducción no se mide). Sin tocar nada más, pulsa REPRODUCIR una vez. Tiene que sonar la batería ALFAR enseguida, y la capa 2 tiene que quedar elegida. Apunta «Del toque al primer sonido» (la primera cifra, «en frío»): tiene que quedar por debajo de **150 ms** (PLAN §5, «Síntesis»). Desde el 30-10, ALFAR se prepara en silencio al acercarse al instrumento: espera unos 3 s con el instrumento a la vista antes de tocar. **La cifra de antes**, la misma prueba en `https://a769d658.torno.pages.dev/?diagnostico=1` (el despliegue sin la precarga). | sin dato | sin dato |
| 2 | Reproducir, pausar y parar | Igual que en la 1, sin Bluetooth. Pausa y reproduce otra vez: apunta la segunda cifra del panel. Mantén REPRODUCIR para parar. | sin dato | sin dato |
| 3 | Con el interruptor de silencio (iPhone) | Con el interruptor activado, ¿suena? | — | sin dato |
| 4 | Sonidos y cola | Con la batería sonando, elige en la capa 2 un bajo (SONIDO → BAJO). Pone EN COLA y entra al empezar el compás. DESHACER antes del compás cancela la cola. | sin dato | sin dato |
| 5 | **Calibrar la latencia** | Con los auriculares de cable puestos, acerca uno de ellos al micrófono del móvil. Luego ENTRADA → LATENCIA → CALIBRAR, sin tocar nada mientras suenan los clics. Apunta la latencia que sale en la pantalla. Repite con los Bluetooth si los tienes. **Copia el informe.** | sin dato | sin dato |
| 6 | Grabar con auriculares | Batería sonando, capa 3, GRABAR. Da palmas en cada pulso durante una toma libre y cierra con GRABAR. Al escucharla, ¿las palmas caen con la batería? | sin dato | sin dato |
| 7 | **Tomas seguidas, alineadas** | Tras calibrar, graba tres tomas de 1 compás (BUCLE → DURACIÓN → 1 COMPÁS) en las capas 2, 3 y 4, con una palma en cada pulso. ¿Suenan juntas, sin «flam», entre ellas y con la batería? | sin dato | sin dato |
| 8 | Sobregrabar | Graba otra vez en una capa que ya tenga sonido: lo nuevo se suma a lo de antes. | sin dato | sin dato |
| 9 | Cambiar de app y volver | Durante una toma, cambia a otra app o bloquea la pantalla y vuelve. La toma se cancela, el audio se pausa y el icono del micrófono del sistema desaparece. Al tocar otra vez, vuelve a sonar. | sin dato | sin dato |
| 10 | **5 minutos sin cortes** | Cuatro capas largas (tomas de 30–60 s) y a tocar 5 min seguidos girando diales: niveles, filtro (BRAZO) y tempo. ¿Algún corte, chasquido o silencio? Al final, **copia el informe** (las «Estadísticas del navegador», si las da, cuentan los cortes). | sin dato | sin dato |
| 11 | **240 BPM con las cuatro capas** | Con las cuatro capas sonando, sube el tempo (dial TEMPO Y MENÚ) hasta 240 y déjalo un minuto. Es el peor caso del filtro contra el *aliasing*. ¿Cortes? ¿Se calienta el móvil? | sin dato | sin dato |
| 12 | Guardar, cargar y exportar | SESIÓN → GUARDAR (un `.torno`), SESIÓN NUEVA y SESIÓN → CARGAR ese archivo. Luego EXPORTAR MEZCLA y EXPORTAR PISTAS: ¿se abren los WAV en el móvil? | sin dato | sin dato |
| 13 | Recargar y recuperar | Recarga la página: «Recuperar la sesión anterior» la devuelve tal cual. | sin dato | sin dato |
| 14 | Reposo | Pulsa REPOSO: el audio para y el micrófono se suelta. Vuelve a pulsarlo: sigue donde estaba. | sin dato | sin dato |
| 15 | **FPS del 3D** (desde la fase 5) | Con `?diagnostico=1`, baja hasta el aparato en 3D. Debajo sale el panel «Escena 3D»: apunta la calidad con la que empieza (en el móvil, «low») y pulsa «Medir 5 s» sin tocar nada. Apunta los fps y el p95. Tiene que dar **30 fps o más** (PLAN §5). Repítelo tocando (con la batería sonando, el disco gira). **Copia el informe.** | sin dato | sin dato |
| 16 | **Cómo llega el 3D** (fase 8, `TODO(ivan)`) | Abre `https://staging.torno.pages.dev` en una pestaña nueva y **no toques nada**: a los 6 s, el póster se funde con el aparato en 3D. Recarga y, nada más cargar, desplaza la página: llega enseguida. ¿Te parece bien así, o prefieres que llegue antes (aunque la carga vaya algo peor en los móviles lentos)? ¿Salta algo de sitio cuando llega? | sin dato | sin dato |
| 17 | **Tocar el 3D con el dedo** (fase 6) | Diales (arrastrar en vertical o en círculo; tocar para elegir capa; mantener para silenciar), las teclas, el disco (mantener y arrastrar) y el brazo. Fuera de los controles, desplazar la página por encima del aparato tiene que funcionar. | sin dato | sin dato |
| 18 | **Encuadres y vistas** (fase 6 y barra nueva de la fase 8) | En la barra de debajo: COMPLETO, CAPAS y CONTROLES (un grupo), INSPECCIONAR (girar con el dedo) y DESPIEZAR (otro grupo), y los iconos de pantalla completa (en Android), pausar movimiento y atajos. ¿Se entiende cada icono? ¿Se tocan bien los botones? | sin dato | sin dato |
| 19 | **El móvil en horizontal** (fase 8) | Gira el móvil con el aparato a la vista: la caja va a la izquierda, tan alta como la pantalla, y el espejo y la barra a la derecha. ¿Se toca bien? ¿Algo se sale o se tapa? | sin dato | sin dato |
| 20 | **El disco** (revisión del bloque C, #2) | En el encuadre COMPLETO, ¿el disco se ve verde oliva o blanquecino («lavado»)? | sin dato | sin dato |
| 21 | **La guía** (fase 7) | En «Conoce tu instrumento», pulsa «Ver en el instrumento» en dos o tres controles: la página sube al aparato, la cámara se acerca y el control queda señalado. No tiene que sonar nada. | sin dato | sin dato |
| 22 | **La web** (fase 7) | Recorre la portada entera y `/sobre-el-proyecto`: «Despiezar el instrumento», «Escuchar» en la anatomía, las preguntas y compartir (el menú del sistema). ¿Algo se ve mal, se corta o salta al cargar? | sin dato | sin dato |
| 23 | **Lector de pantalla** (fase 8) | Activa **TalkBack** (Android: Ajustes → Accesibilidad) o **VoiceOver** (iPhone: Ajustes → Accesibilidad, o tres pulsaciones en el botón lateral si lo tienes configurado). Recorre la portada deslizando el dedo: el titular, «Tocar», la guía y el instrumento. En el instrumento, cada control dice su nombre y su valor («Capa 1, 100 %…»), y con dos toques se pulsa. Reproduce: ¿lo anuncia? Gira un dial (en VoiceOver, deslizar arriba o abajo con un dedo; en TalkBack, con los botones de volumen o el menú): ¿cambia su valor en voz? Apunta lo que no se entienda. | sin dato | sin dato |
| 24 | **Texto grande** (fase 8) | Sube el tamaño del texto del sistema (o haz zum en la página con dos dedos hasta el doble). ¿Se sigue leyendo todo sin que se salga ni se monte? | sin dato | sin dato |
| 25 | **Cambiar de app con el 3D a la vista** (fase 8) | Con el aparato en 3D a la vista (sin sonar), cambia a otra app 30 s y vuelve. Tiene que seguir el 3D (o volver en un momento). Si sale «El 3D se ha detenido y no ha vuelto» y el instrumento sin 3D, apúntalo: el móvil quitó el contexto y no lo devolvió. | sin dato | sin dato |
| 26 | **Narrador en el PC** (fase 8; Windows: Ctrl + Win + Intro) | En el ordenador, con Narrador encendido y Chrome o Edge, recorre la portada con el tabulador: el titular, «Tocar» y el instrumento. Activa «Tocar» (Intro o Espacio): el foco tiene que llegar a REPRODUCIR enseguida, y cada control dice su nombre y su valor. Prueba también un «Ver en el instrumento» de la guía. Apunta lo que no se entienda o tarde. | sin dato (PC) | — |

## Lo que no ha ido bien

Una línea por problema: qué hacías, qué esperabas y qué pasó (con el dispositivo).

- Ninguno anotado (Iván, 30-10: «ya funciona bien»).

## Informes del panel

Pega aquí cada informe copiado (pruebas 5 y 10, y los que quieras), con el dispositivo delante.

```
(Android)
sin dato
```

```
(iPhone)
sin dato
```
