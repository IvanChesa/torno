// El arranque sin tareas largas (fase 5.b, `SceneEngine.#makeEnvironment`) compila antes los
// *shaders* de PMREM con lo que hay dentro de `PMREMGenerator` (three 0.186): `_setSize`,
// `_allocateTargets`, `_pingPongRenderTarget`, `_blurMaterial` y `_ggxMaterial`. Si una versión de
// three los cambia, el motor sigue funcionando, pero vuelve la tarea de más de 600 ms de la primera
// visita sin que nada falle. Este test es el que avisa. Ninguno de esos pasos toca WebGL.
import { Material, PMREMGenerator, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';

interface PmremInternals {
  _setSize?(cubeSize: number): void;
  _allocateTargets?(): WebGLRenderTarget;
  _pingPongRenderTarget?: WebGLRenderTarget | null;
  _blurMaterial?: Material | null;
  _ggxMaterial?: Material | null;
}

describe('lo que usa el motor de dentro de PMREMGenerator', () => {
  it('sigue ahí: tamaño, destinos, y los materiales del desenfoque y del GGX', () => {
    const pmrem = new PMREMGenerator({} as WebGLRenderer) as unknown as PmremInternals;
    expect(typeof pmrem._setSize).toBe('function');
    expect(typeof pmrem._allocateTargets).toBe('function');
    pmrem._setSize!(256);
    const target = pmrem._allocateTargets!();
    expect(target).toBeInstanceOf(WebGLRenderTarget);
    expect(pmrem._pingPongRenderTarget).toBeInstanceOf(WebGLRenderTarget);
    expect(pmrem._blurMaterial).toBeInstanceOf(Material);
    expect(pmrem._ggxMaterial).toBeInstanceOf(Material);
    // Con el mismo tamaño, `fromScene` los reutiliza: no los vuelve a crear.
    const blur = pmrem._blurMaterial;
    pmrem._allocateTargets!().dispose();
    expect(pmrem._blurMaterial).toBe(blur);
    target.dispose();
  });
});
