// Genera el micrófono sintético de los e2e (PLAN fase 2, tarea 9): un WAV propio que Chromium
// reproduce como si fuera el micrófono (--use-file-for-fake-audio-capture) y repite sin fin.
// Ráfagas de tono de 50 ms cada 500 ms, con un ataque de 1 ms: los e2e comprueban que la toma
// grabada tiene esos ataques, separados 500 ms.
//
// Uso: node scripts/make-fake-mic.mjs   → e2e/.generated/fake-mic.wav (fuera de git)
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FAKE_MIC = {
  sampleRate: 48_000,
  seconds: 4,
  /** Separación entre ataques. */
  intervalSeconds: 0.5,
  burstSeconds: 0.05,
  frequency: 660,
  amplitude: 0.5,
};

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const FAKE_MIC_PATH = path.join(ROOT, 'e2e/.generated/fake-mic.wav');

/** Las muestras del micrófono sintético (mono, ±1). */
export function fakeMicSamples(config = FAKE_MIC) {
  const { sampleRate, seconds, intervalSeconds, burstSeconds, frequency, amplitude } = config;
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  const interval = Math.round(intervalSeconds * sampleRate);
  const burst = Math.round(burstSeconds * sampleRate);
  const attack = Math.round(0.001 * sampleRate);
  for (let start = 0; start < samples.length; start += interval) {
    for (let i = 0; i < burst && start + i < samples.length; i++) {
      const envelope = i < attack ? i / attack : i > burst - attack ? (burst - i) / attack : 1;
      samples[start + i] =
        amplitude * envelope * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
  }
  return samples;
}

/** WAV PCM de 16 bits, mono. */
export function wav16(samples, sampleRate) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write('WAVEfmt ', 8, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) =>
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2),
  );
  return bytes;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await mkdir(path.dirname(FAKE_MIC_PATH), { recursive: true });
  await writeFile(FAKE_MIC_PATH, wav16(fakeMicSamples(), FAKE_MIC.sampleRate));
  console.log(`✔ Micrófono sintético: ${path.relative(ROOT, FAKE_MIC_PATH)}`);
}
