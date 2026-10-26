import { firstSound, playbackStats, waitForSound, type OutputWindow } from './diagnostics';

describe('diagnóstico del audio', () => {
  it('encuentra la primera muestra con sonido', () => {
    expect(firstSound(new Float32Array(8))).toBe(-1);
    expect(firstSound(Float32Array.from([0, 0.0005, 0, -0.01, 0.2]))).toBe(3);
  });

  it('copia las estadísticas de reproducción que dé el navegador (numéricas)', () => {
    // Getters enumerables en el prototipo, como los atributos WebIDL.
    const prototype = Object.defineProperties(
      {},
      {
        underrunEvents: { get: () => 2, enumerable: true },
        averageLatency: { get: () => 0.012, enumerable: true },
        label: { get: () => 'no', enumerable: true },
      },
    );
    const stats: object = Object.create(prototype);
    const withStats = { playbackStats: stats } as unknown as BaseAudioContext;
    expect(playbackStats(withStats)).toEqual({ underrunEvents: 2, averageLatency: 0.012 });
    const experimental = {
      playoutStats: { fallbackFramesEvents: 1 },
    } as unknown as BaseAudioContext;
    expect(playbackStats(experimental)).toEqual({ fallbackFramesEvents: 1 });
    expect(playbackStats({} as BaseAudioContext)).toBeNull();
  });

  /** Una ventana de 10 ms a 48 kHz (480 muestras) con sonido en los tramos dados, y su hora. */
  function window(end: number, ...ranges: [number, number][]): OutputWindow {
    const samples = new Float32Array(480);
    for (const [from, to] of ranges) samples.fill(0.3, from, to);
    return { samples, sampleRate: 48_000, end };
  }

  /** `waitForSound` con un reloj de mentira que avanza 4 ms en cada espera. */
  function measure(reads: (OutputWindow | null)[], since: number, timeoutMs = 5000) {
    let clock = since;
    return waitForSound(
      () => reads.shift() ?? null,
      since,
      timeoutMs,
      () => clock,
      async () => {
        clock += 4;
      },
    );
  }

  it('mide del toque a que el primer sonido sale por el altavoz (con la hora de la ventana)', async () => {
    // La tercera lectura trae sonido en sus últimas 120 muestras (2,5 ms); su última muestra sale a
    // los 1015 ms: el sonido empezó a salir a los 1012,5, 22,5 ms después del toque (990).
    const ms = await measure([null, window(1000), window(1004), window(1015, [360, 480])], 990);
    expect(ms).toBeCloseTo(22.5, 6);
  });

  it('no cuenta lo que sonaba antes del toque (la cola de una pausa reciente)', async () => {
    // Toque a los 1009: la ventana termina a los 1015, así que el toque cae en la muestra 192. Lo
    // de las muestras 0–99 sonó antes; cuenta el sonido de la 360 (1012,5 ms).
    const ms = await measure([window(1015, [0, 100], [360, 480])], 1009);
    expect(ms).toBeCloseTo(3.5, 6);
  });

  it('sin sonido en el plazo, devuelve null', async () => {
    const reads = Array.from({ length: 20 }, (_, i) => window(i * 4));
    expect(await measure(reads, 0, 50)).toBeNull();
  });
});
