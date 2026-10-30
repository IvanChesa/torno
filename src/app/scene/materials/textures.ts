/**
 * Las texturas del aparato (PLAN §4.6): las procedurales de datos (cerámica y moleteado, sin DOM) y
 * las de canvas (rótulos de las teclas y sombra de contacto), que se pintan una vez, en el
 * navegador. La pantalla y la cubierta impresa tienen su propio módulo.
 */
import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { rad } from '../model/geometry';
import { PALETTE } from './palette';
import { ceramicMaps, knurlNormal } from './procedural';

export const MONO = '"Geist Mono Variable", ui-monospace, Consolas, monospace';

/** Una textura de datos RGBA lineal que se repite en mosaico, con mipmaps. */
function tiled(data: Uint8Array, width: number, height: number, name: string): DataTexture {
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.name = name;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface CeramicTextures {
  readonly color: DataTexture;
  readonly roughness: DataTexture;
  readonly normal: DataTexture;
}

/** La cerámica sin esmaltar: grano en el color y en la rugosidad, y poros en el relieve. */
export function ceramicTextures(size: number): CeramicTextures {
  const maps = ceramicMaps(size);
  return {
    color: tiled(maps.color, size, size, 'cerámica: grano'),
    roughness: tiled(maps.roughness, size, size, 'cerámica: rugosidad'),
    normal: tiled(maps.normal, size, size, 'cerámica: poros'),
  };
}

/** El moleteado del faldón de los diales y del canto de la rueda (una estría por repetición). */
export function knurlTexture(): DataTexture {
  const width = 32;
  return tiled(knurlNormal(width), width, 2, 'moleteado');
}

export function canvas(
  width: number,
  height: number,
): {
  element: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Sin canvas 2D');
  return { element, context };
}

export function canvasTexture(
  element: HTMLCanvasElement,
  name: string,
  color = true,
): CanvasTexture {
  const result = new CanvasTexture(element);
  result.name = name;
  if (color) result.colorSpace = SRGBColorSpace;
  return result;
}

/** Espera a que la fuente de la pantalla y de la cubierta esté cargada (si no, pintaría con otra). */
export async function loadScreenFont(): Promise<void> {
  try {
    await document.fonts.load(`500 64px ${MONO}`);
  } catch {
    // Sin la fuente, el canvas usa la de reserva: se ve igual de bien.
  }
}

export type LabelIcon = 'play' | 'record' | 'undo' | 'standby';

/** El rótulo de una tecla: su icono grabado en la tinta de la web, sobre transparente. */
export function labelTexture(icon: LabelIcon): CanvasTexture {
  const size = 256;
  const { element, context } = canvas(size, size);
  context.fillStyle = PALETTE.ink;
  context.strokeStyle = PALETTE.ink;
  context.lineWidth = 22;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const c = size / 2;
  switch (icon) {
    case 'play':
      context.beginPath();
      context.moveTo(c - 52, c - 70);
      context.lineTo(c + 74, c);
      context.lineTo(c - 52, c + 70);
      context.closePath();
      context.fill();
      break;
    case 'record':
      context.beginPath();
      context.arc(c, c, 62, 0, 2 * Math.PI);
      context.fill();
      break;
    case 'undo':
      context.beginPath();
      context.arc(c + 6, c + 14, 62, rad(200), rad(110));
      context.stroke();
      context.beginPath();
      context.moveTo(c - 92, c - 40);
      context.lineTo(c - 56, c + 8);
      context.lineTo(c - 12, c - 28);
      context.stroke();
      break;
    case 'standby':
      context.lineWidth = 26;
      context.beginPath();
      context.arc(c, c + 10, 72, rad(-55), rad(235));
      context.stroke();
      context.beginPath();
      context.moveTo(c, c - 92);
      context.lineTo(c, c - 8);
      context.stroke();
      break;
  }
  return canvasTexture(element, `rótulo ${icon}`);
}

/**
 * La sombra de contacto: un degradado radial bajo el cuerpo, pintado una vez. Densa bajo la base y
 * desvanecida del todo en el borde del plano (alfa 0), para que el lienzo no la corte en recto.
 * `baseFraction` y `bodyFraction` son los radios de la base y del cuerpo divididos entre la mitad
 * del lado del plano.
 */
export function contactShadowTexture(baseFraction: number, bodyFraction: number): CanvasTexture {
  const size = 512;
  const { element, context } = canvas(size, size);
  const c = size / 2;
  const gradient = context.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  gradient.addColorStop(baseFraction * 0.95, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(baseFraction, 'rgba(0, 0, 0, 0.42)');
  gradient.addColorStop(bodyFraction, 'rgba(0, 0, 0, 0.18)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvasTexture(element, 'sombra de contacto');
}
