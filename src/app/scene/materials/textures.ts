/**
 * Texturas de canvas de la maqueta (PLAN fase 5.a): la pantalla de fósforo, los rótulos de las
 * teclas y la sombra de contacto. Se pintan una vez, en el navegador.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';
import { SCREEN, TRAY } from '../../instrument';
import { rad } from '../model/geometry';
import { FIXED_COLORS } from './variants';

const MONO = '"Geist Mono Variable", ui-monospace, Consolas, monospace';

function canvas(
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

function texture(element: HTMLCanvasElement, color = true): CanvasTexture {
  const result = new CanvasTexture(element);
  if (color) result.colorSpace = SRGBColorSpace;
  return result;
}

/** La proporción de la pantalla: su arco (a media altura) entre su alto (en la cara inclinada). */
export function screenAspect(): number {
  const middle = (SCREEN.bottom + SCREEN.top) / 2;
  const radius = TRAY.innerRadius + middle * Math.tan(rad(TRAY.lean));
  const arc = radius * rad(2 * SCREEN.halfAngle);
  const height = (SCREEN.top - SCREEN.bottom) / Math.cos(rad(TRAY.lean));
  return arc / height;
}

/** Espera a que la fuente de la pantalla esté cargada (si no, el canvas pintaría con otra). */
export async function loadScreenFont(): Promise<void> {
  try {
    await document.fonts.load(`500 64px ${MONO}`);
  } catch {
    // Sin la fuente, el canvas usa la de reserva: la maqueta se ve igual de bien.
  }
}

/** El texto de la pantalla, en fósforo sobre negro, como la del instrumento HTML. */
export function screenTexture(lines: readonly string[]): CanvasTexture {
  const height = 320;
  const width = Math.round((height * screenAspect()) / 64) * 64;
  const { element, context } = canvas(width, height);
  context.fillStyle = FIXED_COLORS.screen;
  context.fillRect(0, 0, width, height);
  context.fillStyle = FIXED_COLORS.phosphor;
  context.font = `500 64px ${MONO}`;
  context.textBaseline = 'middle';
  const lineHeight = height / (lines.length + 0.6);
  lines.forEach((line, i) => {
    context.fillText(line, width * 0.035, lineHeight * (i + 0.8));
  });
  return texture(element);
}

export type LabelIcon = 'play' | 'record' | 'undo' | 'standby';

/** El rótulo de una tecla: su icono en la tinta de la web, sobre transparente. */
export function labelTexture(icon: LabelIcon): CanvasTexture {
  const size = 256;
  const { element, context } = canvas(size, size);
  context.fillStyle = FIXED_COLORS.ink;
  context.strokeStyle = FIXED_COLORS.ink;
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
  return texture(element);
}

/**
 * La sombra de contacto: un degradado radial bajo el cuerpo, pintado una vez. `bodyFraction` es
 * el radio del cuerpo dividido entre la mitad del lado del plano.
 */
export function contactShadowTexture(bodyFraction: number): CanvasTexture {
  const size = 512;
  const { element, context } = canvas(size, size);
  const c = size / 2;
  const gradient = context.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  gradient.addColorStop(bodyFraction * 0.86, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(bodyFraction, 'rgba(0, 0, 0, 0.32)');
  gradient.addColorStop(Math.min(1, bodyFraction * 1.18), 'rgba(0, 0, 0, 0.08)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return texture(element);
}
