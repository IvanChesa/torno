import type { BufferGeometry, Material, Object3D, Texture } from 'three';

/**
 * Libera todo lo que cuelga de un objeto: geometrías, materiales y sus texturas (PLAN §4.6:
 * `dispose()` completo), más los materiales de `extra` que no estén en ninguna pieza. Lo compartido
 * se libera una vez.
 */
export function disposeObject(root: Object3D, extra: readonly Material[] = []): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>(extra);
  root.traverse((object) => {
    const mesh = object as Partial<{ geometry: BufferGeometry; material: Material | Material[] }>;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) for (const item of material) materials.add(item);
    else if (material) materials.add(material);
  });
  const textures = new Set<Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if ((value as Partial<Texture> | null)?.isTexture) textures.add(value as Texture);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
