# Informe: Fase 3 (biblioteca de sonidos y menú completo)

- **Rama:** `fase-3-sonidos`
- **Fecha:** 2026-10-26
- **Estado:** en curso

## 0. Plan de la fase

Antes de empezar se aplicó la revisión del bloque A en `main` (`docs/revisiones/bloque-A.md`, «Respuesta a la revisión»): banco fuera de `check`, worklet y workers a 60 kB, CI en `ubuntu-24.04` y autoguardado con dos huecos.

**Punto de partida.** El menú SONIDO de la fase 2 ya recorre sin cambiar el audio, confirma, pone EN COLA con la capa destino, apaga, pide confirmación al sustituir una grabación («Cancelar» primero) y el núcleo cancela la cola al deshacer. Falta la colección, la primera reproducción, el tempo por pulsaciones, el *aliasing* del *varispeed* y la escucha.

**Entregas:**

- **3.a · Síntesis y colección** (`audio/synth/`, TS puro y determinista):
  - piezas: azar con semilla (mulberry32), osciladores PolyBLEP (sierra, pulso, triángulo y seno), envolventes ADSR, filtro SVF con corte modulable, FM de dos operadores, batería sintética (bombo con barrido, caja, charles de 6 osciladores, palmas, aro, tom, maraca), eco y saturación suave;
  - un **búfer circular** del tamaño del bucle: las colas de las notas y de los efectos que pasan del final entran por el principio, y los efectos con memoria (eco, filtros continuos) se calculan con una vuelta previa. Así los 12 bucles **no tienen junta**;
  - **12 bucles** en Re menor, 90 BPM y 2 compases, con una progresión propia (Rem9 · Si♭maj9 · Solm9 · La7sus4→La7, dos pulsos cada acorde) y nombres propios en español (tierra, alfarería y Bajo Cinca): BATERÍA ALFAR, HORNO y ADOBE; BAJO RAÍZ, CINCA y SURCO; ACORDES OLIVO, VEGA y ALMENDRO; TEXTURA CIERZO, ACEQUIA y BRASA;
  - **equilibrio por papel**: RMS objetivo por categoría y pico ≤ −1 dBFS, sin continua (se resta la media de un bucle periódico), documentado en `docs/AUDIO.md`;
  - el worker de síntesis renderiza la colección (la caché en memoria ya está en el motor) y el catálogo del menú (`instrument/sounds.ts`) la lista; un test comprueba que coinciden;
  - tests: determinismo (hash del PCM a 44,1 y 48 kHz), duración exacta, picos y RMS en rango, sin continua, sin junta, fundamentales de los bajos en la tonalidad (FFT) y tiempo de render ≤ 50 ms (en el banco, fuera de `check`);
  - `npm run demo:sounds`: los 12 bucles y 3 combinaciones (mezcla del propio núcleo) en WAV en `demo-sounds/` (ignorada).
- **3.b · Sin *aliasing* al acelerar** (`audio/core/voice.ts`):
  - cuando el *varispeed* lee más deprisa que el tempo nativo y las imágenes pueden caer en la banda audible (por encima de `2 − 40000/sr`, 1,17× a 48 kHz), la voz pasa la señal por un **paso bajo de Chebyshev II de orden 10 a la frecuencia del propio PCM, antes de interpolar**. El corte sigue a la velocidad (lo que plegaría por debajo de 20 kHz queda ≥ 60 dB abajo);
  - el paso entre leer con y sin filtro es un fundido de 10 ms dentro de la voz (sin clics); con el disco no se filtra;
  - sin reservas en `process()`: coeficientes recalculados en arrays ya reservados solo cuando cambia la velocidad;
  - tests: tono alto a 240 BPM sin imágenes por encima de −60 dB, tono bajo intacto, sin clics al cruzar el umbral y CPU con el filtro activo (banco).
- **3.c · Menú e interacción:**
  - **primera reproducción**: si la sesión está vacía, la primera vez que se pulsa reproducir la capa 1 arranca con la batería ALFAR (sin compás vacío: reproducir espera a que el sonido esté en la capa) y queda elegida la capa 2;
  - **tempo por pulsaciones** en BUCLE: pulsar el dial sobre «TEMPO A PULSOS» marca pulsos; con dos o más, el tempo es la media de los últimos intervalos (se reinicia tras 2 s sin pulsar);
  - e2e: la cola entra exactamente en el compás siguiente (aviso del núcleo con la muestra del transporte, múltiplo exacto de un compás) y deshacer la cancela; primera reproducción; tempo por pulsaciones;
  - capturas del menú SONIDO con la colección (escritorio y móvil).

**Riesgos:** que los bucles no gusten (son datos: se ajustan tras la escucha de Iván); el coste del filtro a tempos muy altos con grabaciones lentas (40 → 240 BPM, 6×: se mide y se documenta); el desbloqueo inicial está a 1,9 kB de 2 (no se toca el bundle inicial).

**Skills consultadas:** ninguna (no hay skill de audio; manda PLAN §4.3–§4.4).
