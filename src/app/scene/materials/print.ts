/**
 * Lo impreso en la cubierta (PLAN §4.6, «rótulos»): las escalas de los diales, el número de cada
 * capa, el tempo, los signos de la rueda, la escala del brazo y un filete alrededor del disco, en
 * engobe crema sobre el barro. Las marcas se calculan en mm (sin DOM, se prueban en Node) y se pintan
 * una vez en una textura de canvas que cubre la parte plana de la cubierta.
 */
import type { CanvasTexture } from 'three';
import {
  armHead,
  BODY,
  DISC_OUTER_RADIUS,
  LAYER_CONTROLS,
  PLACEMENTS,
  polar,
  WHEEL,
  type PlacedControl,
  type Point,
} from '../../instrument';
import { rad } from '../model/geometry';
import { PALETTE } from './palette';
import { canvas, canvasTexture, MONO } from './textures';

/** Radio de la parte plana de la cubierta (hasta el bisel del canto): lo que cubre la textura. */
export const PRINT_RADIUS = BODY.radius - BODY.edgeRadius;
/** Radio interior: el borde del hueco oscuro del disco. */
export const PRINT_INNER_RADIUS = DISC_OUTER_RADIUS + 4;

export type PrintMark =
  | { readonly kind: 'line'; readonly from: Point; readonly to: Point; readonly width: number }
  | { readonly kind: 'dot'; readonly at: Point; readonly radius: number }
  | { readonly kind: 'ring'; readonly radius: number; readonly width: number }
  | { readonly kind: 'text'; readonly at: Point; readonly text: string; readonly size: number };

/** El recorrido de las agujas de los diales: de −135° a 135° desde las 12 (al fondo). */
const SWEEP = 135;
/** Marcas de cada escala: cada 27°; la primera, la del medio y la última, más largas. */
const TICKS = 11;

/**
 * La dirección de la aguja de un dial vista desde arriba, para un ángulo en grados desde las 12 (el
 * fondo, −z) en el sentido de las agujas del reloj (hacia +x).
 */
export function needleDirection(degrees: number): Point {
  return { x: Math.sin(rad(degrees)), z: -Math.cos(rad(degrees)) };
}

/** Lo más cerca del canto que llega lo impreso: el bisel empieza en `PRINT_RADIUS`. */
const EDGE_MARGIN = 1.2;

function scale(id: PlacedControl, label: string): PrintMark[] {
  const placement = PLACEMENTS[id];
  const center = polar(placement.radius, placement.angle);
  const inner = placement.footprint + 1.2;
  const marks: PrintMark[] = [];
  for (let i = 0; i < TICKS; i++) {
    const angle = -SWEEP + (2 * SWEEP * i) / (TICKS - 1);
    const major = i === 0 || i === TICKS - 1 || i === (TICKS - 1) / 2;
    const direction = needleDirection(angle);
    const at = (distance: number): Point => ({
      x: center.x + direction.x * distance,
      z: center.z + direction.z * distance,
    });
    // Los diales de las capas van cerca del canto: las marcas que mirarían fuera de la parte plana
    // se acortan hasta ella.
    let outer = inner + (major ? 2.8 : 2);
    while (
      outer > inner + 0.8 &&
      Math.hypot(at(outer).x, at(outer).z) > PRINT_RADIUS - EDGE_MARGIN
    ) {
      outer -= 0.1;
    }
    marks.push({ kind: 'line', from: at(inner), to: at(outer), width: major ? 0.7 : 0.45 });
  }
  // El rótulo, en el hueco de abajo de la escala (hacia quien toca).
  marks.push({
    kind: 'text',
    at: { x: center.x, z: center.z + placement.footprint + 3.4 },
    text: label,
    size: label.length > 1 ? 2.6 : 3.6,
  });
  return marks;
}

export function deckPrint(): PrintMark[] {
  const marks: PrintMark[] = [];
  LAYER_CONTROLS.forEach((id, layer) =>
    marks.push(...scale(id as PlacedControl, String(layer + 1))),
  );
  marks.push(...scale('main', 'TEMPO'));
  // La rueda: más volumen hacia fuera (hacia el fondo), menos hacia el disco.
  const wheel = PLACEMENTS.volume;
  const reach = WHEEL.diameter / 2 + 4.5;
  const side = polar(wheel.radius, wheel.angle + 10);
  marks.push(
    { kind: 'text', at: polar(wheel.radius + reach, wheel.angle), text: '+', size: 3.6 },
    { kind: 'text', at: polar(wheel.radius - reach, wheel.angle), text: '−', size: 3.6 },
    { kind: 'text', at: side, text: 'VOL', size: 2.6 },
  );
  // El brazo: puntos en el recorrido de la costilla, de fuera (sin filtro) hacia el disco. En
  // reposo, la costilla asoma por el canto: ahí no hay cubierta plana en la que imprimir.
  for (let i = 0; i <= 6; i++) {
    const at = armHead(i / 6);
    if (Math.hypot(at.x, at.z) > PRINT_RADIUS - 2) continue;
    marks.push({ kind: 'dot', at, radius: i === 6 ? 1 : 0.6 });
  }
  // Un filete alrededor del disco, como el de un torno.
  marks.push({ kind: 'ring', radius: PRINT_INNER_RADIUS + 3, width: 0.5 });
  return marks;
}

/** Pinta lo impreso en una textura de `size`×`size` que cubre el cuadrado de la cubierta. */
export function printTexture(size: number): CanvasTexture {
  const { element, context } = canvas(size, size);
  const scale = size / (2 * PRINT_RADIUS);
  const px = (point: Point) => ({
    x: (point.x + PRINT_RADIUS) * scale,
    y: (point.z + PRINT_RADIUS) * scale,
  });
  context.fillStyle = PALETTE.key;
  context.strokeStyle = PALETTE.key;
  context.lineCap = 'round';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const mark of deckPrint()) {
    switch (mark.kind) {
      case 'line': {
        const from = px(mark.from);
        const to = px(mark.to);
        context.lineWidth = mark.width * scale;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        break;
      }
      case 'dot': {
        const at = px(mark.at);
        context.beginPath();
        context.arc(at.x, at.y, mark.radius * scale, 0, 2 * Math.PI);
        context.fill();
        break;
      }
      case 'ring': {
        const c = px({ x: 0, z: 0 });
        context.lineWidth = mark.width * scale;
        context.beginPath();
        context.arc(c.x, c.y, mark.radius * scale, 0, 2 * Math.PI);
        context.stroke();
        break;
      }
      case 'text': {
        const at = px(mark.at);
        context.font = `500 ${mark.size * scale}px ${MONO}`;
        context.fillText(mark.text, at.x, at.y);
        break;
      }
    }
  }
  const texture = canvasTexture(element, 'cubierta impresa');
  texture.anisotropy = 4;
  return texture;
}
