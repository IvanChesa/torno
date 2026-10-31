/**
 * scene: API pública del 3D (PLAN §4.6). Three.js sin Angular ni audio; es el único sitio donde se
 * importa `three`. Los componentes solo llegan aquí: tipos, las opciones (sin `three`) y una función
 * diminuta que carga el motor con `import()`, para que `three` nunca entre en el bundle inicial.
 */
import type { SceneEngine, SceneOptions } from './engine';

export { ORBIT_LIMITS, SHOTS, VIEWS } from './options';
export type { CameraGoal, ControlBox, Orbit, SceneMotion, Shot, View, Waveform } from './options';
export { QUALITY_LEVELS } from './quality';
export type { QualityLevel } from './quality';
export type { FrameStats, SceneEngine, SceneEvent, SceneOptions, SceneStats } from './engine';

/** Carga `three` y el motor, y monta el aparato en el lienzo. Falla si no hay WebGL. */
export async function createSceneEngine(options: SceneOptions): Promise<SceneEngine> {
  const scene = await import('./engine');
  return scene.SceneEngine.create(options);
}
