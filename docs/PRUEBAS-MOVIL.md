# Pruebas en el móvil (fase 4.b)

Lista para probar Torno en un Android y en un iPhone en la vista previa de Cloudflare Pages (el staging). Los resultados desbloquean el bloque C: si el audio falla en iOS, se arregla antes de construir el 3D (PLAN, fase 4).

Rellena las casillas y los huecos. Cuando la lista diga **«copia el informe»**, pulsa «Copiar el informe» en el panel de diagnóstico y pégalo al final de esta página, en «Informes del panel». Ni el panel ni la web envían nada: todo se queda en el móvil hasta que tú lo pegues aquí.

## Antes de empezar

- **Dirección:** `https://staging.torno.pages.dev/?diagnostico=1`. Es pública, sin contraseña, y no la indexan los buscadores (`noindex`). Se actualiza sola con cada cambio en `main`. Con `?diagnostico=1`, debajo del instrumento aparece el panel «Diagnóstico del audio».
- **Auriculares con cable**, y unos Bluetooth si los tienes, para comparar la latencia.
- Volumen a media altura. Cierra las demás apps que suenen (música, vídeos).
- En el iPhone, haz las pruebas 1 a 3 con el **interruptor de silencio activado** (naranja) y repítelas desactivado.
- Navegador: Chrome en Android y Safari en el iPhone (los que use la gente). Si sobra tiempo, Firefox en Android.

## Los dispositivos

| Dato | Android | iPhone |
|---|---|---|
| Modelo | | |
| Versión del sistema | | |
| Navegador y versión | | |
| Auriculares (cable / Bluetooth, modelo) | | |
| Frecuencia de muestreo (panel) | | |
| Latencia base y de salida (panel) | | |

## La lista

Marca ✅ o ❌ y apunta las cifras y lo raro que veas u oigas.

| # | Prueba | Cómo | Android | iPhone |
|---|---|---|---|---|
| 1 | **Primera reproducción en frío** | Abre la dirección en una pestaña nueva (mejor tras cerrar el navegador). Sin tocar nada más, pulsa REPRODUCIR una vez. Tiene que sonar la batería ALFAR enseguida, y la capa 2 tiene que quedar elegida. Apunta «Del toque al primer sonido» (la primera cifra, «en frío»). Si pasa de **150 ms**, se precargará ALFAR al acercarse al instrumento (PLAN §5, «Síntesis»). | … ms | … ms |
| 2 | Reproducir, pausar y parar | Pausa y reproduce otra vez: apunta la segunda cifra del panel. Mantén REPRODUCIR para parar. | … ms | … ms |
| 3 | Con el interruptor de silencio (iPhone) | Con el interruptor activado, ¿suena? | — | |
| 4 | Sonidos y cola | Con la batería sonando, elige en la capa 2 un bajo (SONIDO → BAJO). Pone EN COLA y entra al empezar el compás. DESHACER antes del compás cancela la cola. | | |
| 5 | **Calibrar la latencia** | Con los auriculares de cable puestos, acerca uno de ellos al micrófono del móvil. Luego ENTRADA → LATENCIA → CALIBRAR, sin tocar nada mientras suenan los clics. Apunta la latencia que sale en la pantalla. Repite con los Bluetooth si los tienes. **Copia el informe.** | cable … ms · BT … ms | cable … ms · BT … ms |
| 6 | Grabar con auriculares | Batería sonando, capa 3, GRABAR. Da palmas en cada pulso durante una toma libre y cierra con GRABAR. Al escucharla, ¿las palmas caen con la batería? | | |
| 7 | **Tomas seguidas, alineadas** | Tras calibrar, graba tres tomas de 1 compás (BUCLE → DURACIÓN → 1 COMPÁS) en las capas 2, 3 y 4, con una palma en cada pulso. ¿Suenan juntas, sin «flam», entre ellas y con la batería? | | |
| 8 | Sobregrabar | Graba otra vez en una capa que ya tenga sonido: lo nuevo se suma a lo de antes. | | |
| 9 | Cambiar de app y volver | Durante una toma, cambia a otra app o bloquea la pantalla y vuelve. La toma se cancela, el audio se pausa y el icono del micrófono del sistema desaparece. Al tocar otra vez, vuelve a sonar. | | |
| 10 | **5 minutos sin cortes** | Cuatro capas largas (tomas de 30–60 s) y a tocar 5 min seguidos girando diales: niveles, filtro (BRAZO) y tempo. ¿Algún corte, chasquido o silencio? Al final, **copia el informe** (las «Estadísticas del navegador», si las da, cuentan los cortes). | | |
| 11 | **240 BPM con las cuatro capas** | Con las cuatro capas sonando, sube el tempo (dial TEMPO Y MENÚ) hasta 240 y déjalo un minuto. Es el peor caso del filtro contra el *aliasing*. ¿Cortes? ¿Se calienta el móvil? | | |
| 12 | Guardar, cargar y exportar | SESIÓN → GUARDAR (un `.torno`), SESIÓN NUEVA y SESIÓN → CARGAR ese archivo. Luego EXPORTAR MEZCLA y EXPORTAR PISTAS: ¿se abren los WAV en el móvil? | | |
| 13 | Recargar y recuperar | Recarga la página: «Recuperar la sesión anterior» la devuelve tal cual. | | |
| 14 | Reposo | Pulsa REPOSO: el audio para y el micrófono se suelta. Vuelve a pulsarlo: sigue donde estaba. | | |

## Lo que no ha ido bien

Una línea por problema: qué hacías, qué esperabas y qué pasó (con el dispositivo).

-

## Informes del panel

Pega aquí cada informe copiado (pruebas 5 y 10, y los que quieras), con el dispositivo delante.

```
(Android)

```

```
(iPhone)

```
