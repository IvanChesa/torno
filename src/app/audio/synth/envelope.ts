/**
 * Envolventes: ADSR (ataque lineal, caída y relajación exponenciales) y percusiva. Todas terminan
 * en 0 exacto con un fundido de coseno de 2 ms, así una nota nunca acaba con un salto.
 */

export interface Adsr {
  /** Segundos hasta el máximo (lineal). */
  readonly attack: number;
  /** Constante de tiempo de la caída hacia `sustain`, en segundos. */
  readonly decay: number;
  /** Nivel mientras se mantiene la nota (0–1). */
  readonly sustain: number;
  /** Segundos que tarda en apagarse al soltar (hasta −60 dB). */
  readonly release: number;
}

const END_FADE_SECONDS = 0.002;
/** ln(1000): una exponencial que dura `t` segundos hasta −60 dB tiene τ = t / ln(1000). */
const TO_MINUS_60_DB = Math.log(1000);

/** Fundido de coseno de las últimas muestras hasta 0 (sin salto al acabar). */
function fadeEnd(out: Float64Array, sampleRate: number): Float64Array {
  const fade = Math.min(out.length, Math.max(1, Math.round(END_FADE_SECONDS * sampleRate)));
  for (let i = 0; i < fade; i++) {
    const index = out.length - fade + i;
    out[index] = out[index]! * (0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / fade));
  }
  return out;
}

/** Muestras que dura una nota de `gate` segundos con su relajación. */
export function adsrLength(envelope: Adsr, gate: number, sampleRate: number): number {
  return Math.max(1, Math.round((gate + envelope.release) * sampleRate));
}

/** ADSR de una nota mantenida `gate` segundos (más la relajación). */
export function adsr(envelope: Adsr, gate: number, sampleRate: number): Float64Array {
  const length = adsrLength(envelope, gate, sampleRate);
  const out = new Float64Array(length);
  const gateFrames = Math.round(gate * sampleRate);
  const attackFrames = Math.max(1, Math.round(envelope.attack * sampleRate));
  const decay = Math.exp(-1 / (Math.max(1e-4, envelope.decay) * sampleRate));
  const release = Math.exp(-TO_MINUS_60_DB / (Math.max(1e-4, envelope.release) * sampleRate));
  let level = 0;
  for (let i = 0; i < length; i++) {
    if (i < gateFrames) {
      if (i < attackFrames) level = (i + 1) / attackFrames;
      else level = envelope.sustain + (level - envelope.sustain) * decay;
    } else {
      level *= release;
    }
    out[i] = level;
  }
  return fadeEnd(out, sampleRate);
}

/** Envolvente percusiva: ataque lineal de `attack` s y caída exponencial con constante `decay`. */
export function percussive(
  attack: number,
  decay: number,
  seconds: number,
  sampleRate: number,
): Float64Array {
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float64Array(length);
  const attackFrames = Math.max(1, Math.round(attack * sampleRate));
  const k = Math.exp(-1 / (decay * sampleRate));
  let level = 1;
  for (let i = 0; i < length; i++) {
    if (i < attackFrames) {
      out[i] = (i + 1) / attackFrames;
    } else {
      level *= k;
      out[i] = level;
    }
  }
  return fadeEnd(out, sampleRate);
}

/** Multiplica `signal` por `envelope` muestra a muestra (en su sitio; la más corta manda). */
export function applyEnvelope(signal: Float64Array, envelope: Float64Array): Float64Array {
  const length = Math.min(signal.length, envelope.length);
  for (let i = 0; i < length; i++) signal[i] = signal[i]! * envelope[i]!;
  for (let i = length; i < signal.length; i++) signal[i] = 0;
  return signal;
}
