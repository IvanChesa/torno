/**
 * La colección (PLAN fase 3, D8): 12 bucles propios en Re menor, 90 BPM y 2 compases de 4/4, tres
 * por papel, con nombres en español (tierra, alfarería y Bajo Cinca). Cada bucle es una receta
 * determinista: la misma frecuencia de muestreo da los mismos bytes.
 *
 * Todo se suma en un búfer circular (sin junta) y se acaba igual: continua fuera y nivel por papel
 * (`LEVELS`: RMS objetivo y techo de pico de −1 dBFS).
 */
import { clap, hat, kick, rim, shaker, snare, tom, type KickOptions } from './drums';
import { loopEcho, levelLoop, removeDc, saturate } from './effects';
import { applyEnvelope, percussive } from './envelope';
import { CONTROL_FRAMES, filter, SynthFilter } from './filter';
import { LoopBuffer, processLooped } from './loop-buffer';
import {
  chordAt,
  LIBRARY_BPM,
  LIBRARY_LOOP_BEATS,
  libraryLoopFrames,
  midiToFrequency,
  PROGRESSION,
} from './music';
import { sine } from './oscillators';
import { createRandom, jitter, noise, type Random } from './random';
import {
  bell,
  droplet,
  electricPiano,
  pad,
  pluckBass,
  rubberBass,
  subBass,
  woodTone,
} from './voices';

export type LibraryCategory = 'drums' | 'bass' | 'chords' | 'texture';

/**
 * Nivel de cada papel (RMS en dBFS, sobre el bucle entero). Pensado para que las cuatro capas a
 * tope sumen unos −11 dBFS de RMS y el limitador del núcleo apenas trabaje.
 */
export const LEVELS: Readonly<Record<LibraryCategory, number>> = {
  drums: -16,
  bass: -17,
  chords: -19,
  texture: -23,
};

/** Techo de pico de todos los bucles (un poco por debajo de −1 dBFS, por el redondeo a float32). */
export const PEAK_CEILING_DB = -1.05;

/** Lo que una receta necesita: frecuencia, rejilla de pulsos, azar con semilla y el bucle. */
class Context {
  readonly framesPerBeat: number;
  readonly frames: number;
  readonly random: Random;

  constructor(
    readonly sampleRate: number,
    seed: number,
  ) {
    this.frames = libraryLoopFrames(sampleRate);
    this.framesPerBeat = this.frames / LIBRARY_LOOP_BEATS;
    this.random = createRandom(seed);
  }

  /** Muestra del bucle en un pulso, con un retraso «humano» opcional en segundos. */
  frame(beat: number, humanize = 0): number {
    return beat * this.framesPerBeat + jitter(this.random, humanize) * this.sampleRate;
  }

  /** Segundos que duran `beats` pulsos. */
  seconds(beats: number): number {
    return (beats * 60) / LIBRARY_BPM;
  }

  buffer(): LoopBuffer {
    return new LoopBuffer(this.frames);
  }

  /** Fuerza con una pequeña variación (±`amount` relativo). */
  velocity(value: number, amount = 0.06): number {
    return value * (1 + jitter(this.random, amount));
  }
}

// --- Rejilla de semicorcheas -------------------------------------------------------------------

/** Fuerza de cada carácter de un patrón: X fuerte, x normal, o fantasma, «.» nada. */
const STRENGTH: Readonly<Record<string, number>> = { X: 1, x: 0.8, o: 0.4 };

interface Hit {
  readonly step: number;
  readonly velocity: number;
}

/** Los golpes de un patrón de semicorcheas (16 por compás; aquí, 32 por bucle). */
function hits(pattern: string): Hit[] {
  const out: Hit[] = [];
  for (let step = 0; step < pattern.length; step++) {
    const velocity = STRENGTH[pattern[step]!];
    if (velocity) out.push({ step, velocity });
  }
  return out;
}

/** Pulso de una semicorchea con *swing*: las impares se retrasan `swing` pulsos. */
const stepBeat = (step: number, swing: number) => step / 4 + (step % 2 === 1 ? swing : 0);

/** Suma un golpe a cada paso del patrón. */
function sequence(
  ctx: Context,
  out: LoopBuffer,
  pattern: string,
  voice: (velocity: number, step: number) => Float64Array,
  gain: number,
  swing: number,
): void {
  for (const { step, velocity } of hits(pattern)) {
    const v = ctx.velocity(velocity);
    out.add(voice(v, step), ctx.frame(stepBeat(step, swing), 0.003), gain * v);
  }
}

// --- BATERÍA -----------------------------------------------------------------------------------

const SWING = 0.04;

/** ALFAR: el ritmo de la casa, *boom bap* con algo de *swing*. */
function alfar(ctx: Context): Float64Array {
  const { sampleRate: sr, random } = ctx;
  const out = ctx.buffer();
  const kickSound: KickOptions = {
    from: 150,
    to: 50,
    sweep: 0.04,
    decay: 0.18,
    length: 0.55,
    click: 0.35,
    drive: 1.8,
  };
  sequence(
    ctx,
    out,
    'X......x..X.....' + 'X..x......Xx....',
    () => kick(sr, random, kickSound),
    1,
    SWING,
  );
  sequence(
    ctx,
    out,
    '....X....o..X...' + '....X.......X..o',
    () =>
      snare(sr, random, {
        tone: 190,
        bodyDecay: 0.06,
        noiseDecay: 0.07,
        snappy: 0.6,
        length: 0.35,
      }),
    0.75,
    SWING,
  );
  sequence(
    ctx,
    out,
    'x.o.x.o.x.o.x.o.' + 'x.o.x.o.x.o.x.o.',
    (_, step) =>
      step === 30
        ? hat(sr, random, { decay: 0.11, length: 0.6, tone: 8800 })
        : hat(sr, random, { decay: 0.018, length: 0.15, tone: 9200 }),
    0.24,
    SWING,
  );
  return saturate(out.data, 1.15);
}

/** HORNO: medio tiempo pesado, con palmas sobre la caja y un redoble de toms afinados. */
function horno(ctx: Context): Float64Array {
  const { sampleRate: sr, random } = ctx;
  const out = ctx.buffer();
  const kickSound: KickOptions = {
    from: 120,
    to: 44,
    sweep: 0.05,
    decay: 0.3,
    length: 0.9,
    click: 0.25,
    drive: 2.4,
  };
  sequence(
    ctx,
    out,
    'X.........x..x..' + 'X......x..X.....',
    () => kick(sr, random, kickSound),
    1,
    SWING,
  );
  // Caja y palmas en su propio bus, con un eco corto que hace de sala.
  const backbeat = ctx.buffer();
  sequence(
    ctx,
    backbeat,
    '........X.......' + '........X.....o.',
    () =>
      snare(sr, random, {
        tone: 175,
        bodyDecay: 0.08,
        noiseDecay: 0.11,
        snappy: 0.55,
        length: 0.45,
      }),
    0.75,
    SWING,
  );
  sequence(
    ctx,
    backbeat,
    '........X.......' + '........X.......',
    () => clap(sr, random),
    0.5,
    SWING,
  );
  out.mix(loopEcho(backbeat.data, sr, { delay: 0.083, feedback: 0.35, mix: 0.18, damping: 3000 }));
  // Semicorcheas con acento (fuerte en el pulso, normal en la corchea, fantasma entre medias),
  // calladas durante el redoble.
  let hatPattern = '';
  for (let step = 0; step < 32; step++) {
    hatPattern += step >= 28 ? '.' : step % 4 === 0 ? 'X' : step % 2 === 0 ? 'x' : 'o';
  }
  sequence(
    ctx,
    out,
    hatPattern,
    (_, step) =>
      step === 22
        ? hat(sr, random, { decay: 0.09, length: 0.5, tone: 8200 })
        : hat(sr, random, { decay: 0.012, length: 0.1, tone: 8000 }),
    0.2,
    SWING,
  );
  // Redoble: La2, Fa2 y Re2 al final del segundo compás.
  for (const [step, note] of [
    [28, 45],
    [29, 41],
    [31, 38],
  ] as const) {
    out.add(tom(sr, random, midiToFrequency(note)), ctx.frame(stepBeat(step, SWING), 0.003), 0.55);
  }
  return saturate(out.data, 1.3);
}

/** ADOBE: percusión de manos: maraca, aro, bombo suave y congas de madera afinadas. */
function adobe(ctx: Context): Float64Array {
  const { sampleRate: sr, random } = ctx;
  const out = ctx.buffer();
  const accents = [0.9, 0.4, 0.65, 0.45];
  for (let step = 0; step < 32; step++) {
    const v = ctx.velocity(accents[step % 4]!, 0.12);
    out.add(shaker(sr, random), ctx.frame(stepBeat(step, SWING), 0.004), 0.3 * v);
  }
  const kickSound: KickOptions = {
    from: 110,
    to: 52,
    sweep: 0.03,
    decay: 0.12,
    length: 0.4,
    click: 0.1,
    drive: 1.1,
  };
  sequence(
    ctx,
    out,
    'x.....x...x.....' + 'x.....x.....x...',
    () => kick(sr, random, kickSound),
    0.8,
    SWING,
  );
  sequence(ctx, out, '....x.......x...' + '....x.......x..o', () => rim(sr, random), 0.45, SWING);
  // Congas: La3, Re4, Sol3, Fa4, Do4 (de la escala).
  const congas: readonly (readonly [number, number])[] = [
    [3, 57],
    [6, 62],
    [11, 55],
    [14, 57],
    [19, 57],
    [22, 62],
    [25, 65],
    [27, 62],
    [30, 60],
    [31, 57],
  ];
  for (const [step, note] of congas) {
    const v = ctx.velocity(step % 2 === 1 ? 0.7 : 0.9);
    out.add(woodTone(sr, midiToFrequency(note)), ctx.frame(stepBeat(step, SWING), 0.004), 0.45 * v);
  }
  return out.data;
}

// --- BAJO --------------------------------------------------------------------------------------

/** Una nota de bajo: dónde empieza (en pulsos, ya con el *swing*), nota MIDI y duración en pulsos. */
export interface BassNote {
  readonly beat: number;
  readonly note: number;
  readonly beats: number;
}

/** Las notas en la rejilla (pulso, nota, duración); las semicorcheas impares, con *swing*. */
const line = (notes: readonly (readonly [number, number, number])[], swing: number): BassNote[] =>
  notes.map(([beat, note, beats]) => ({ beat: stepBeat(beat * 4, swing), note, beats }));

/**
 * Las tres líneas de bajo (datos: los tests comprueban, nota a nota, que lo que suena es esto y que
 * está en Re menor).
 */
export const BASS_LINES: Readonly<Record<'raiz' | 'cinca' | 'surco', readonly BassNote[]>> = {
  // RAÍZ: sub-bajo redondo que sigue las fundamentales.
  raiz: line(
    [
      [0, 38, 1.3],
      [1.5, 38, 0.4],
      [2, 34, 1.75],
      [4, 31, 1.3],
      [5.5, 31, 0.4],
      [6, 33, 0.9],
      [7, 33, 0.45],
      [7.5, 36, 0.4],
    ],
    0,
  ),
  // CINCA: bajo pulsado con saltos de octava, en corcheas y semicorcheas.
  cinca: line(
    [
      [0, 38, 0.45],
      [0.75, 50, 0.2],
      [1, 38, 0.3],
      [1.5, 45, 0.3],
      [1.75, 48, 0.2],
      [2, 34, 0.45],
      [2.75, 46, 0.2],
      [3, 34, 0.3],
      [3.5, 41, 0.3],
      [3.75, 43, 0.2],
      [4, 31, 0.45],
      [4.75, 43, 0.2],
      [5, 31, 0.3],
      [5.5, 38, 0.3],
      [5.75, 41, 0.2],
      [6, 33, 0.45],
      [6.75, 45, 0.2],
      [7, 40, 0.3],
      [7.5, 43, 0.25],
    ],
    SWING,
  ),
  // SURCO: bajo de goma, funk de semicorcheas con portamento entre notas.
  surco: line(
    [
      [0, 38, 0.2],
      [0.5, 38, 0.15],
      [0.75, 41, 0.2],
      [1.25, 38, 0.15],
      [1.5, 33, 0.2],
      [1.75, 36, 0.2],
      [2, 34, 0.3],
      [2.5, 34, 0.15],
      [2.75, 38, 0.2],
      [3.25, 41, 0.15],
      [3.5, 34, 0.2],
      [3.75, 33, 0.2],
      [4, 31, 0.3],
      [4.5, 31, 0.15],
      [4.75, 34, 0.2],
      [5.25, 38, 0.15],
      [5.5, 31, 0.2],
      [5.75, 41, 0.2],
      [6, 33, 0.3],
      [6.5, 33, 0.15],
      [6.75, 40, 0.2],
      [7.25, 43, 0.15],
      [7.5, 40, 0.2],
      [7.75, 36, 0.2],
    ],
    SWING,
  ),
};

function raiz(ctx: Context): Float64Array {
  const out = ctx.buffer();
  for (const { beat, note, beats } of BASS_LINES.raiz) {
    out.add(subBass(ctx.sampleRate, midiToFrequency(note), ctx.seconds(beats)), ctx.frame(beat), 1);
  }
  return out.data;
}

function cinca(ctx: Context): Float64Array {
  const out = ctx.buffer();
  for (const { beat, note, beats } of BASS_LINES.cinca) {
    const velocity = ctx.velocity(beat % 1 === 0 ? 0.9 : 0.65);
    const sound = pluckBass(ctx.sampleRate, midiToFrequency(note), ctx.seconds(beats), velocity);
    out.add(sound, ctx.frame(beat), velocity);
  }
  return out.data;
}

function surco(ctx: Context): Float64Array {
  const out = ctx.buffer();
  const notes = BASS_LINES.surco;
  let previous = midiToFrequency(notes[notes.length - 1]!.note);
  for (const { beat, note, beats } of notes) {
    const hz = midiToFrequency(note);
    const velocity = ctx.velocity(beat % 1 === 0 ? 1 : 0.7);
    const sound = rubberBass(ctx.sampleRate, hz, previous, ctx.seconds(beats), velocity);
    out.add(sound, ctx.frame(beat), velocity);
    previous = hz;
  }
  return out.data;
}

// --- ACORDES -----------------------------------------------------------------------------------

/** Suma un acorde, rasgueado hacia arriba (`strum` segundos entre notas). */
function strum(
  ctx: Context,
  out: LoopBuffer,
  notes: readonly number[],
  beat: number,
  strumSeconds: number,
  voice: (hz: number, index: number) => Float64Array,
  gain: number,
): void {
  const start = ctx.frame(beat, 0.003);
  notes.forEach((note, index) => {
    const sound = voice(midiToFrequency(note), index);
    out.add(sound, start + index * strumSeconds * ctx.sampleRate, gain * ctx.velocity(1, 0.08));
  });
}

/** OLIVO: piano eléctrico cálido, acompañamiento sincopado. */
function olivo(ctx: Context): Float64Array {
  const out = ctx.buffer();
  const comp: readonly (readonly [beat: number, beats: number, velocity: number])[] = [
    [0, 0.9, 0.8],
    [1.25, 0.55, 0.6],
    [2, 0.9, 0.8],
    [3.25, 0.55, 0.6],
    [4, 0.9, 0.8],
    [5.25, 0.55, 0.6],
    [6, 0.9, 0.8],
    [7, 0.45, 0.7],
    [7.5, 0.35, 0.5],
  ];
  // Las notas se repiten entre golpes y acordes: cada (nota, duración, fuerza) se sintetiza una vez.
  const notes = new Map<string, Float64Array>();
  for (const [beat, beats, velocity] of comp) {
    const chord = chordAt(beat);
    const gate = ctx.seconds(beats);
    strum(
      ctx,
      out,
      chord.voicing,
      beat + SWING * (beat % 0.5 === 0.25 ? 1 : 0),
      0.006,
      (hz) => {
        const key = `${hz}:${beats}:${velocity}`;
        let note = notes.get(key);
        if (!note) {
          note = electricPiano(ctx.sampleRate, hz, gate, velocity);
          notes.set(key, note);
        }
        return note;
      },
      velocity / 2,
    );
  }
  const wet = loopEcho(out.data, ctx.sampleRate, {
    delay: ctx.seconds(0.75),
    feedback: 0.2,
    mix: 0.12,
    damping: 2500,
  });
  return saturate(wet, 1.2);
}

/** VEGA: pad de sierras que se abre en cada acorde, con eco de corchea con puntillo. */
function vega(ctx: Context): Float64Array {
  const out = ctx.buffer();
  PROGRESSION.forEach((chord, index) => {
    const next = PROGRESSION[index + 1]?.beat ?? LIBRARY_LOOP_BEATS;
    const gate = ctx.seconds(next - chord.beat - 0.08);
    // El cambio de La7sus4 a La7 solo mueve una voz: el pad ataca más suave.
    const soft = chord.beat === 7 ? 0.6 : 1;
    strum(
      ctx,
      out,
      chord.voicing,
      chord.beat,
      0.004,
      (hz) =>
        pad(ctx.sampleRate, hz, gate, {
          envelope: { attack: 0.09 * (2 - soft), decay: 0.5, sustain: 0.75, release: 0.4 },
          cutoff: 650,
          cutoffPeak: 650 + 1700 * soft,
          q: 0.9,
        }),
      0.35 * soft,
    );
  });
  return loopEcho(out.data, ctx.sampleRate, {
    delay: ctx.seconds(0.75),
    feedback: 0.32,
    mix: 0.22,
    damping: 2500,
  });
}

/** ALMENDRO: arpegio de campanas en corcheas, con eco que se va oscureciendo. */
function almendro(ctx: Context): Float64Array {
  const out = ctx.buffer();
  const accents = [0.9, 0.6, 0.75, 0.6];
  for (let i = 0; i < 16; i++) {
    const beat = i / 2;
    const chord = chordAt(beat);
    const note = chord.arpeggio[i % 4]!;
    const velocity = ctx.velocity(accents[i % 4]!);
    const sound = bell(ctx.sampleRate, midiToFrequency(note), 1.1, velocity);
    out.add(sound, ctx.frame(beat, 0.003), 0.4 * velocity);
  }
  return loopEcho(out.data, ctx.sampleRate, {
    delay: ctx.seconds(0.75),
    feedback: 0.38,
    mix: 0.33,
    damping: 3500,
  });
}

// --- TEXTURA -----------------------------------------------------------------------------------

/** Ruido de un bucle entero (para leerlo en bucle: periódico, sin junta). */
function noiseLoop(ctx: Context): Float64Array {
  const out = new Float64Array(ctx.frames);
  for (let i = 0; i < out.length; i++) out[i] = noise(ctx.random);
  return out;
}

/** Un ciclo lento que da `cycles` vueltas exactas por bucle (periódico), en [−1, 1]. */
const lfo = (ctx: Context, index: number, cycles: number, phase: number) =>
  sine((cycles * index) / ctx.frames + phase);

/** CIERZO: viento: ruido por dos pasos banda que barren, ráfagas y un silbido. */
function cierzo(ctx: Context): Float64Array {
  const sr = ctx.sampleRate;
  const phases = Array.from({ length: 6 }, () => ctx.random());
  const low = new SynthFilter(sr);
  const high = new SynthFilter(sr);
  const whistle = new SynthFilter(sr);
  const rumble = new SynthFilter(sr);
  // Las modulaciones lentas, a ritmo de control (cada `CONTROL_FRAMES` muestras).
  let gust = 0;
  let lowHz = 0;
  let highHz = 0;
  let whistleHz = 0;
  return processLooped(noiseLoop(ctx), (x, i) => {
    if (i % CONTROL_FRAMES === 0) {
      gust =
        0.55 +
        0.25 * lfo(ctx, i, 1, phases[0]!) +
        0.15 * lfo(ctx, i, 2, phases[1]!) +
        0.06 * lfo(ctx, i, 5, phases[2]!);
      lowHz = 480 * 2 ** (1.1 * lfo(ctx, i, 1, phases[3]!));
      highHz = 1500 * 2 ** (0.8 * lfo(ctx, i, 2, phases[4]!));
      whistleHz = midiToFrequency(86) * 2 ** (0.06 * lfo(ctx, i, 3, phases[5]!));
    }
    const a = low.step(x, lowHz, 2.5, 'bandpass');
    const b = high.step(x, highHz, 5, 'bandpass');
    const tone = whistle.step(x, whistleHz, 40, 'bandpass');
    const body = gust * (0.6 * a + 0.35 * b) + gust * gust * gust * 0.5 * tone;
    return rumble.step(body, 70, Math.SQRT1_2, 'highpass');
  });
}

/** ACEQUIA: gotas en la pentatónica de Re menor sobre un hilo de agua, con eco. */
function acequia(ctx: Context): Float64Array {
  const sr = ctx.sampleRate;
  const drops = ctx.buffer();
  const pentatonic = [74, 77, 79, 81, 84, 86];
  for (let i = 0; i < 34; i++) {
    const beat = ctx.random() * LIBRARY_LOOP_BEATS;
    const note = pentatonic[Math.floor(ctx.random() * pentatonic.length)]!;
    const velocity = 0.3 + 0.7 * ctx.random() ** 1.5;
    drops.add(droplet(sr, midiToFrequency(note)), ctx.frame(beat), velocity);
  }
  const wet = loopEcho(drops.data, sr, {
    delay: ctx.seconds(0.5),
    feedback: 0.35,
    mix: 0.4,
    damping: 4000,
  });
  const phase = ctx.random();
  const lowpass = new SynthFilter(sr);
  const band = new SynthFilter(sr);
  let flow = 0;
  const stream = processLooped(noiseLoop(ctx), (x, i) => {
    if (i % CONTROL_FRAMES === 0) flow = 0.75 + 0.25 * lfo(ctx, i, 3, phase);
    return flow * band.step(lowpass.step(x, 1400, Math.SQRT1_2, 'lowpass'), 2600, 0.7, 'bandpass');
  });
  for (let i = 0; i < wet.length; i++) wet[i] = wet[i]! + 0.12 * stream[i]!;
  return wet;
}

/** BRASA: brasas: un zumbido grave y cálido en Re, chasquidos sueltos y un siseo. */
function brasa(ctx: Context): Float64Array {
  const sr = ctx.sampleRate;
  const frames = ctx.frames;
  const drone = new Float64Array(frames);
  // Frecuencias redondeadas a un número entero de ciclos por bucle: el zumbido es periódico.
  for (const [note, gain] of [
    [38, 1],
    [45, 0.5],
    [50, 0.25],
  ] as const) {
    const cycles = Math.round((midiToFrequency(note) * frames) / sr);
    const phase = ctx.random();
    for (let i = 0; i < frames; i++) {
      drone[i] = drone[i]! + gain * sine((cycles * i) / frames + phase);
    }
  }
  const tremoloPhase = ctx.random();
  for (let i = 0; i < frames; i++) drone[i] = drone[i]! * (1 + 0.25 * lfo(ctx, i, 4, tremoloPhase));
  saturate(drone, 1.6);
  const warm = new SynthFilter(sr);
  const droneOut = processLooped(drone, (x) => warm.step(x, 900, Math.SQRT1_2, 'lowpass'));

  const crackle = ctx.buffer();
  let seconds = 0;
  const total = frames / sr;
  for (;;) {
    seconds += -Math.log(1 - ctx.random()) / 7;
    if (seconds >= total) break;
    const length = Math.round((0.002 + 0.003 * ctx.random()) * sr);
    const pop = new Float64Array(length);
    for (let i = 0; i < length; i++) pop[i] = noise(ctx.random);
    filter(pop, sr, 'highpass', 1500 + 2500 * ctx.random());
    applyEnvelope(pop, percussive(0.0001, 0.0006 + 0.001 * ctx.random(), length / sr, sr));
    crackle.add(pop, seconds * sr, ctx.random() ** 3);
  }
  const hissFilter = new SynthFilter(sr);
  const hiss = processLooped(noiseLoop(ctx), (x) =>
    hissFilter.step(x, 5000, Math.SQRT1_2, 'highpass'),
  );
  const out = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    out[i] = 0.5 * droneOut[i]! + 0.9 * crackle.data[i]! + 0.05 * hiss[i]!;
  }
  return out;
}

// --- Catálogo ----------------------------------------------------------------------------------

interface Recipe {
  readonly category: LibraryCategory;
  /** Semilla del azar de la receta. */
  readonly seed: number;
  readonly render: (ctx: Context) => Float64Array;
}

const RECIPES: Readonly<Record<string, Recipe>> = {
  alfar: { category: 'drums', seed: 1101, render: alfar },
  horno: { category: 'drums', seed: 1102, render: horno },
  adobe: { category: 'drums', seed: 1103, render: adobe },
  raiz: { category: 'bass', seed: 2101, render: raiz },
  cinca: { category: 'bass', seed: 2102, render: cinca },
  surco: { category: 'bass', seed: 2103, render: surco },
  olivo: { category: 'chords', seed: 3101, render: olivo },
  vega: { category: 'chords', seed: 3102, render: vega },
  almendro: { category: 'chords', seed: 3103, render: almendro },
  cierzo: { category: 'texture', seed: 4101, render: cierzo },
  acequia: { category: 'texture', seed: 4102, render: acequia },
  brasa: { category: 'texture', seed: 4103, render: brasa },
};

/** Los ids de la colección, en el orden del menú. */
export const LIBRARY_IDS: readonly string[] = Object.keys(RECIPES);

export function libraryCategory(id: string): LibraryCategory {
  const recipe = RECIPES[id];
  if (!recipe) throw new RangeError(`Sonido desconocido: ${id}`);
  return recipe.category;
}

/** Renderiza un bucle de la colección a la frecuencia del contexto (PCM mono float32). */
export function renderLibraryLoop(id: string, sampleRate: number): Float32Array<ArrayBuffer> {
  const recipe = RECIPES[id];
  if (!recipe) throw new RangeError(`Sonido desconocido: ${id}`);
  if (!(sampleRate >= 8000 && sampleRate <= 192_000)) {
    throw new RangeError(`Frecuencia de muestreo fuera de rango: ${sampleRate}`);
  }
  const ctx = new Context(sampleRate, recipe.seed);
  const loop = removeDc(recipe.render(ctx));
  return levelLoop(loop, LEVELS[recipe.category], PEAK_CEILING_DB);
}

export { LIBRARY_BPM, LIBRARY_LOOP_BEATS };
