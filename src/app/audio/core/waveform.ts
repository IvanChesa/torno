/**
 * La forma de onda de una capa para la pantalla del aparato (PLAN §0.2: «formas de onda y medidores
 * de nivel de cada capa»): el pico de cada tramo, de 0 a 1. Se normaliza al pico de la capa: su
 * forma se ve igual de clara aunque suene flojo (el nivel lo enseña el medidor). Una capa en
 * silencio se queda en cero. Lo calcula el motor de audio en el hilo principal, de una copia de la
 * sesión y solo cuando cambia el sonido: nunca en `process()`.
 */
export function waveformPeaks(pcm: Float32Array, bins: number): Float32Array {
  const peaks = new Float32Array(bins);
  const frames = pcm.length;
  if (frames === 0 || bins <= 0) return peaks;
  let max = 0;
  for (let bin = 0; bin < bins; bin++) {
    const start = Math.floor((bin * frames) / bins);
    const end = Math.min(frames, Math.max(start + 1, Math.floor(((bin + 1) * frames) / bins)));
    let peak = 0;
    for (let i = start; i < end; i++) {
      const value = Math.abs(pcm[i]!);
      if (value > peak) peak = value;
    }
    peaks[bin] = peak;
    if (peak > max) max = peak;
  }
  if (max > 1e-6) for (let bin = 0; bin < bins; bin++) peaks[bin]! /= max;
  return peaks;
}
