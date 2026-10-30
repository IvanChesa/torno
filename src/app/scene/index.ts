/**
 * scene: API pública del 3D (PLAN §4.6). Three.js sin Angular ni audio; es el único sitio donde se
 * importa `three`. Los componentes solo llegan aquí: tipos, las opciones de la maqueta (sin `three`)
 * y funciones diminutas que cargan la implementación con `import()`, para que `three` nunca entre
 * en el bundle inicial.
 *
 * Fase 5.a: la maqueta (`mockup/`). El motor definitivo (`SceneEngine`) llega en la 5.b.
 */
import type { MockupOptions, MockupViewer } from './mockup/viewer';

export { TONE_MAPPINGS, VARIANTS, VIEWS } from './mockup/options';
export type { ToneMapping, Variant, View } from './mockup/options';
export type { MockupOptions, MockupState, MockupStats, MockupViewer } from './mockup/viewer';

/** Carga `three` y la maqueta, y la monta en el lienzo. Falla si el navegador no tiene WebGL. */
export async function createMockupViewer(options: MockupOptions): Promise<MockupViewer> {
  const mockup = await import('./mockup/viewer');
  return mockup.MockupViewer.create(options);
}
