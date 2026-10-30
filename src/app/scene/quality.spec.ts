// Niveles de calidad del 3D (PLAN §4.6 y §5): el nivel inicial, el DPR, el MSAA, la bajada
// automática cuando los FPS no llegan y la memoria de vídeo estimada.
import { describe, expect, it } from 'vitest';
import {
  antialiasFor,
  drawingBufferBytes,
  FrameMonitor,
  initialQuality,
  lowerQuality,
  MONITOR_FRAMES,
  pixelRatioFor,
  QUALITY,
  QUALITY_LEVELS,
  textureBytes,
  type DeviceHints,
} from './quality';

const DESKTOP: DeviceHints = {
  pixelRatio: 1,
  coarsePointer: false,
  cores: 8,
  memoryGb: 8,
  saveData: false,
};

/** Pasa `count` fotogramas de `ms` cada uno; devuelve el último nivel pedido (o `null`). */
function run(
  monitor: FrameMonitor,
  count: number,
  ms: number,
  start = 0,
): ReturnType<FrameMonitor['frame']> {
  let result: ReturnType<FrameMonitor['frame']> = null;
  let time = start;
  for (let i = 0; i <= count; i++) {
    const next = monitor.frame(time);
    if (next) result = next;
    time += ms;
  }
  return result;
}

describe('niveles', () => {
  it('cada nivel pinta menos que el de encima', () => {
    for (const key of [
      'maxPixelRatio',
      'roundSegments',
      'smallSegments',
      'environmentSize',
    ] as const) {
      const values = QUALITY_LEVELS.map((level) => QUALITY[level][key]);
      expect([...values].sort((a, b) => a - b)).toEqual(values);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('el escritorio empieza en alto; el móvil, el ahorro de datos y un PC flojo, más abajo', () => {
    expect(initialQuality(DESKTOP)).toBe('high');
    expect(initialQuality({ ...DESKTOP, coarsePointer: true, pixelRatio: 3 })).toBe('low');
    expect(initialQuality({ ...DESKTOP, saveData: true })).toBe('low');
    expect(initialQuality({ ...DESKTOP, cores: 2 })).toBe('medium');
    expect(initialQuality({ ...DESKTOP, memoryGb: 2 })).toBe('medium');
    // Sin datos del dispositivo, no se castiga.
    expect(initialQuality({ ...DESKTOP, cores: 0, memoryGb: 0 })).toBe('high');
  });

  it('el DPR tiene techo por nivel y el MSAA solo va por debajo de 1,5', () => {
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('medium', 3)).toBe(1.5);
    expect(pixelRatioFor('low', 3)).toBe(1.25);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('high', 0)).toBe(1);
    expect(antialiasFor('high', 1)).toBe(true);
    expect(antialiasFor('high', 2)).toBe(false);
    expect(antialiasFor('medium', 2)).toBe(false);
    expect(antialiasFor('low', 3)).toBe(true);
  });

  it('se baja de uno en uno y el bajo no tiene nada debajo', () => {
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBeNull();
  });
});

describe('FrameMonitor', () => {
  it('a 60 fps no baja nunca', () => {
    const monitor = new FrameMonitor('high');
    expect(run(monitor, 10 * MONITOR_FRAMES, 1000 / 60)).toBeNull();
    expect(monitor.level).toBe('high');
  });

  it('a 30 fps baja de alto a medio tras una ventana entera, y de medio a bajo tras otra', () => {
    const monitor = new FrameMonitor('high');
    expect(run(monitor, MONITOR_FRAMES - 1, 1000 / 30)).toBeNull();
    expect(monitor.frame(MONITOR_FRAMES * (1000 / 30))).toBe('medium');
    expect(run(monitor, MONITOR_FRAMES, 1000 / 30, 10_000)).toBe('low');
    // En bajo ya no hay a dónde ir.
    expect(run(monitor, 3 * MONITOR_FRAMES, 1000 / 10, 20_000)).toBeNull();
    expect(monitor.level).toBe('low');
  });

  it('a 45 fps, el alto baja pero el medio aguanta', () => {
    const high = new FrameMonitor('high');
    expect(run(high, MONITOR_FRAMES, 1000 / 45)).toBe('medium');
    const medium = new FrameMonitor('medium');
    expect(run(medium, 5 * MONITOR_FRAMES, 1000 / 45)).toBeNull();
  });

  it('los huecos entre animaciones no cuentan como fotogramas lentos', () => {
    const monitor = new FrameMonitor('high');
    let time = 0;
    for (let burst = 0; burst < 20; burst++) {
      for (let i = 0; i < 30; i++) {
        expect(monitor.frame(time)).toBeNull();
        time += 1000 / 60;
      }
      // Una pausa larga (nada se mueve) y luego otra animación.
      monitor.pause();
      time += 5000;
    }
    // Una pestaña oculta tampoco: un salto de varios segundos no se mide.
    expect(monitor.frame(time + 60_000)).toBeNull();
    expect(monitor.level).toBe('high');
  });

  it('al cambiar el nivel a mano se empieza a medir de cero', () => {
    const monitor = new FrameMonitor('high');
    run(monitor, MONITOR_FRAMES - 5, 1000 / 20);
    monitor.reset('medium');
    expect(run(monitor, MONITOR_FRAMES - 5, 1000 / 20, 50_000)).toBeNull();
    expect(monitor.level).toBe('medium');
  });
});

describe('memoria de vídeo', () => {
  it('una textura RGBA de 1024 con mipmaps ocupa un tercio más', () => {
    expect(textureBytes({ width: 1024, height: 1024, bytesPerTexel: 4, mipmaps: false })).toBe(
      4 * 1024 * 1024,
    );
    expect(textureBytes({ width: 1024, height: 1024, bytesPerTexel: 4, mipmaps: true })).toBe(
      Math.round((4 * 4 * 1024 * 1024) / 3),
    );
  });

  it('el lienzo: tres búferes sin MSAA; con 4 muestras, color y profundidad por cuatro y la copia', () => {
    expect(drawingBufferBytes(100, 100, 0)).toBe(3 * 4 * 10_000);
    expect(drawingBufferBytes(100, 100, 4)).toBe(2 * 4 * 4 * 10_000 + 2 * 4 * 10_000);
  });
});
