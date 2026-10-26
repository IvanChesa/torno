import { firstSound, playbackStats, waitForSound, type OutputWindow } from './diagnostics';

describe('diagnóstico del audio', () => {
  it('encuentra la primera muestra con sonido', () => {
    expect(firstSound(new Float32Array(8))).toBe(-1);
    expect(firstSound(Float32Array.from([0, 0.0005, 0, -0.01, 0.2]))).toBe(3);
  });

  it('copia las estadísticas de reproducción que dé el navegador (numéricas)', () => {
    class Stats {
      get underrunEvents(): number {
        return 2;
      }
      get averageLatency(): number {
        return 0.012;
      }
      get label(): string {
        return 'no';
      }
    }
    // Getters enumerables del prototipo, como los atributos WebIDL.
    for (const key of ['underrunEvents', 'averageLatency', 'label']) {
      Object.defineProperty(Stats.prototype, key, {
        ...Object.getOwnPropertyDescriptor(Stats.prototype, key),
        enumerable: true,
      });
    }
    const withStats = { playbackStats: new Stats() } as unknown as BaseAudioContext;
    expect(playbackStats(withStats)).toEqual({ underrunEvents: 2, averageLatency: 0.012 });
    const experimental = {
      playoutStats: { fallbackFramesEvents: 1 },
    } as unknown as BaseAudioContext;
    expect(playbackStats(experimental)).toEqual({ fallbackFramesEvents: 1 });
    expect(playbackStats({} as BaseAudioContext)).toBeNull();
  });

  it('mide del toque al primer sonido, descontando lo que ya sonaba en la ventana leída', async () => {
    let clock = 1000;
    const quiet: OutputWindow = { samples: new Float32Array(480), sampleRate: 48_000 };
    // Cuando se lee, el sonido empezó 2,5 ms antes del final de la ventana (120 muestras).
    const sounding = new Float32Array(480);
    sounding.fill(0.3, 360);
    const reads = [null, quiet, quiet, { samples: sounding, sampleRate: 48_000 }];
    const ms = await waitForSound(
      () => reads.shift() ?? null,
      990,
      5000,
      () => clock,
      async () => {
        clock += 4;
      },
    );
    // 3 esperas de 4 ms: se lee a los 1012; empezó a sonar a los 1009,5 (19,5 ms tras el toque).
    expect(ms).toBeCloseTo(19.5, 6);
  });

  it('sin sonido en el plazo, devuelve null', async () => {
    let clock = 0;
    const ms = await waitForSound(
      () => ({ samples: new Float32Array(64), sampleRate: 48_000 }),
      0,
      50,
      () => clock,
      async () => {
        clock += 10;
      },
    );
    expect(ms).toBeNull();
  });
});
