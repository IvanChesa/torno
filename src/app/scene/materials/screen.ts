/**
 * La pantalla del aparato (PLAN §4.5, §4.6 y fase 6): el modelo de pantalla del instrumento pintado
 * en una textura de canvas, en fósforo sobre negro, como la del instrumento HTML.
 *
 * Ocupa todo el ancho (revisión del bloque C, hallazgo 1): arriba, el texto grande. En la pantalla
 * principal, debajo, un carril por capa con su forma de onda y su medidor (PLAN §0.2). El texto y
 * las formas de onda se pintan en la textura solo cuando cambian. Lo que se mueve con el audio (el
 * cabezal de cada carril y los medidores) lo pinta el *shader* de la pantalla con unos *uniforms*,
 * sin volver a subir la textura a cada fotograma.
 */
import {
  Color,
  type CanvasTexture,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { LAYER_COUNT, menuWindow, SCREEN, TRAY, type DisplayModel } from '../../instrument';
import { rad } from '../model/geometry';
import type { Waveform } from '../options';
import { PALETTE } from './palette';
import { canvas, canvasTexture, MONO } from './textures';

/** Una fila de texto: a la izquierda y, si hay, a la derecha; `size`, su alto relativo. */
export interface ScreenRow {
  readonly left: string;
  readonly right: string;
  readonly size: number;
  /** La fila elegida del menú, invertida (fósforo de fondo). */
  readonly inverted: boolean;
  /** Los títulos, a media luz. */
  readonly dim: boolean;
}

/** Lo que se pinta: las filas de texto y, en la pantalla principal, los carriles de las capas. */
export interface ScreenText {
  readonly rows: readonly ScreenRow[];
  readonly lanes: boolean;
}

/** Lo que enseña el carril de una capa. */
export interface ScreenLane {
  readonly waveform: Waveform;
  /** Tiene sonido. */
  readonly active: boolean;
  readonly muted: boolean;
  readonly selected: boolean;
}

/**
 * Dónde va cada cosa, en fracciones del ancho (x) y del alto (y) de la textura, con y hacia abajo.
 * El *shader* usa las mismas cifras.
 */
export const SCREEN_LAYOUT = {
  padX: 0.025,
  padY: 0.07,
  /** En la pantalla principal, el texto llega hasta aquí; debajo van los carriles. */
  textBottom: 0.66,
  lanesTop: 0.71,
  lanesBottom: 0.93,
  /** Hueco entre carriles, en fracción del ancho. */
  laneGap: 0.014,
  /** El medidor ocupa el final de cada carril; la forma de onda llega hasta `waveEnd`. */
  waveEnd: 0.86,
  meterStart: 0.9,
} as const;

/** La letra, en fracción del alto de su fila. */
const FONT_FRACTION = 0.74;
/** Filas del menú que caben a la vez: la elegida y la siguiente (o la anterior, al final). */
export const VISIBLE_MENU_ROWS = 2;

/** El ancho de un carril y el paso de uno al siguiente, en fracción del ancho. */
export function laneGeometry(): {
  readonly x0: number;
  readonly width: number;
  readonly step: number;
} {
  const { padX, laneGap } = SCREEN_LAYOUT;
  const width = (1 - 2 * padX - (LAYER_COUNT - 1) * laneGap) / LAYER_COUNT;
  return { x0: padX, width, step: width + laneGap };
}

/**
 * Lo que dice la pantalla, en filas: en la principal, la capa elegida en grande y, debajo, el
 * tempo con el estado; en el menú, el título y una ventana de dos filas alrededor de la elegida.
 */
export function screenText(display: DisplayModel): ScreenText {
  const row = (left: string, right = '', size = 1, inverted = false, dim = false): ScreenRow => ({
    left,
    right,
    size,
    inverted,
    dim,
  });
  switch (display.mode) {
    case 'main':
      return {
        rows: [
          row(display.lines[1] ?? '', '', 1),
          row(display.lines[0] ?? '', display.status, 0.72),
        ],
        lanes: true,
      };
    case 'menu':
      return {
        rows: [
          row(display.title, display.status, 0.62, false, true),
          ...menuWindow(display.rows, VISIBLE_MENU_ROWS).map((item) =>
            row(item.label, item.editing ? `‹ ${item.value} ›` : item.value, 1, item.selected),
          ),
        ],
        lanes: false,
      };
    case 'confirm':
      return {
        rows: [
          ...display.lines.map((line) => row(line, '', 0.9)),
          ...display.rows.map((item) => row(item.label, '', 0.85, item.selected)),
        ],
        lanes: false,
      };
    case 'text':
      return {
        rows: [
          row(display.title, display.status, 0.62, false, true),
          ...display.lines.map((line) => row(line, '', 0.85)),
        ],
        lanes: false,
      };
  }
}

/** La proporción de la pantalla: su arco (a media altura) entre su alto (en la cara inclinada). */
export function screenAspect(): number {
  const middle = (SCREEN.bottom + SCREEN.top) / 2;
  const radius = TRAY.innerRadius + middle * Math.tan(rad(TRAY.lean));
  const arc = radius * rad(2 * SCREEN.halfAngle);
  const height = (SCREEN.top - SCREEN.bottom) / Math.cos(rad(TRAY.lean));
  return arc / height;
}

/**
 * El alto de la letra de la primera fila, en fracción del alto de la pantalla (antes de encogerla
 * si no cabe a lo ancho): con el alto de la pantalla en píxeles, el cuerpo de letra que se ve.
 */
export function firstRowFont(text: ScreenText): number {
  const { padY, textBottom } = SCREEN_LAYOUT;
  const area = (text.lanes ? textBottom : 1 - padY) - padY;
  const total = text.rows.reduce((sum, row) => sum + row.size, 0);
  const first = text.rows[0];
  return first && total > 0 ? (FONT_FRACTION * area * first.size) / total : 0;
}

/** Lo que identifica lo que se pinta: si no cambia, no se repinta. */
function signature(text: ScreenText, lanes: readonly ScreenLane[]): string {
  return JSON.stringify([
    text,
    text.lanes ? lanes.map((lane) => [lane.active, lane.muted, lane.selected]) : null,
  ]);
}

export class ScreenPainter {
  readonly texture: CanvasTexture;
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #signature = '';
  #waveforms: readonly Waveform[] = [];
  /** El cuerpo de la primera fila de lo último pintado (fracción del alto). */
  #firstFont = 0;
  /** Lo último pintado lleva carriles. */
  #lanes = false;

  constructor(height = 256) {
    const width = Math.round((height * screenAspect()) / 64) * 64;
    const { element, context } = canvas(width, height);
    this.#canvas = element;
    this.#context = context;
    this.texture = canvasTexture(element, 'pantalla');
  }

  /** El alto de la letra de la primera fila de lo que se ve, en fracción del alto. */
  get firstRowFont(): number {
    return this.#firstFont;
  }

  /** Lo que se ve lleva los carriles de las capas (la pantalla principal). */
  get lanes(): boolean {
    return this.#lanes;
  }

  /** Pinta la pantalla si ha cambiado lo que dice o sus carriles; dice si lo ha hecho. */
  paint(display: DisplayModel, lanes: readonly ScreenLane[]): boolean {
    const text = screenText(display);
    const waveforms = lanes.map((lane) => lane.waveform);
    const sameWaves =
      waveforms.length === this.#waveforms.length &&
      waveforms.every((wave, i) => wave === this.#waveforms[i]);
    const next = signature(text, lanes);
    if (next === this.#signature && (sameWaves || !text.lanes)) return false;
    this.#signature = next;
    this.#waveforms = waveforms;
    this.#lanes = text.lanes;
    const { width, height } = this.#canvas;
    const context = this.#context;
    context.fillStyle = PALETTE.screen;
    context.fillRect(0, 0, width, height);
    const { padX, padY, textBottom } = SCREEN_LAYOUT;
    const top = padY * height;
    const bottom = (text.lanes ? textBottom : 1 - padY) * height;
    const total = text.rows.reduce((sum, row) => sum + row.size, 0);
    let y = top;
    for (const row of text.rows) {
      const rowHeight = ((bottom - top) * row.size) / total;
      this.#row(row, padX * width, y, width * (1 - 2 * padX), rowHeight);
      y += rowHeight;
    }
    this.#firstFont = firstRowFont(text);
    if (text.lanes) lanes.forEach((lane, i) => this.#lane(lane, i));
    this.texture.needsUpdate = true;
    return true;
  }

  #row(row: ScreenRow, x: number, y: number, width: number, height: number): void {
    const context = this.#context;
    let size = Math.round(height * FONT_FRACTION);
    context.font = `500 ${size}px ${MONO}`;
    const gap = size;
    const needed =
      context.measureText(row.left).width +
      (row.right ? gap + context.measureText(row.right).width : 0);
    // Una línea que no cabe se encoge, no se corta.
    if (needed > width) {
      size = Math.floor((size * width) / needed);
      context.font = `500 ${size}px ${MONO}`;
    }
    if (row.inverted) {
      context.fillStyle = PALETTE.phosphor;
      context.fillRect(x - height * 0.12, y + height * 0.08, width + height * 0.24, height * 0.84);
    }
    context.fillStyle = row.inverted ? PALETTE.screen : PALETTE.phosphor;
    context.globalAlpha = row.dim ? 0.78 : 1;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillText(row.left, x, y + height / 2);
    if (row.right) {
      context.textAlign = 'right';
      context.fillText(row.right, x + width, y + height / 2);
    }
    context.globalAlpha = 1;
  }

  /** El carril de una capa: su forma de onda (a media luz; el *shader* aviva lo ya sonado). */
  #lane(lane: ScreenLane, index: number): void {
    const context = this.#context;
    const { width, height } = this.#canvas;
    const { lanesTop, lanesBottom, waveEnd, meterStart } = SCREEN_LAYOUT;
    const geometry = laneGeometry();
    const x0 = (geometry.x0 + index * geometry.step) * width;
    const laneWidth = geometry.width * width;
    const top = lanesTop * height;
    const laneHeight = (lanesBottom - lanesTop) * height;
    const middle = top + laneHeight / 2;
    const waveWidth = laneWidth * waveEnd;
    context.fillStyle = PALETTE.phosphor;
    // La capa elegida, enmarcada.
    if (lane.selected) {
      context.globalAlpha = 0.9;
      const line = Math.max(1, Math.round(height / 128));
      context.strokeStyle = PALETTE.phosphor;
      context.lineWidth = line;
      context.strokeRect(
        x0 - 2 * line,
        top - 2 * line,
        waveWidth + 4 * line,
        laneHeight + 4 * line,
      );
    }
    const peaks = lane.waveform;
    if (lane.active && peaks && peaks.length > 0) {
      context.globalAlpha = lane.muted ? 0.22 : lane.selected ? 0.62 : 0.5;
      const bin = waveWidth / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const half = Math.max(0.5, (peaks[i]! * laneHeight) / 2);
        context.fillRect(x0 + i * bin, middle - half, Math.max(1, bin * 0.8), 2 * half);
      }
    } else {
      // Vacía (o sin forma de onda aún): una raya en el centro.
      context.globalAlpha = 0.25;
      context.fillRect(x0, middle - 0.5, waveWidth, 1);
    }
    // El hueco del medidor: lo llena el *shader*.
    context.globalAlpha = 0.12;
    context.fillRect(x0 + laneWidth * meterStart, top, laneWidth * (1 - meterStart), laneHeight);
    context.globalAlpha = 1;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

/** Los *uniforms* de lo que se mueve en la pantalla: el cabezal y el nivel de cada capa. */
export interface ScreenOverlay {
  /** Los carriles se ven (la pantalla principal). */
  setLanes(on: boolean): void;
  /** Por dónde va cada capa (0–1; negativo: sin cabezal) y su nivel (0–1). */
  set(heads: readonly number[], levels: readonly number[]): boolean;
}

/**
 * Añade al material de la pantalla lo que se mueve con el audio, en su *shader*: el cabezal de cada
 * carril (con lo ya sonado más vivo) y los medidores. Va detrás del mapa emisivo (`three` 0.186:
 * `#include <emissivemap_fragment>`). El ancho de la textura da el grosor del cabezal en texels.
 */
export function screenOverlay(material: Material, textureWidth: number): ScreenOverlay {
  const uniforms = {
    uScreenLanes: { value: 0 },
    uScreenHead: { value: Array.from({ length: LAYER_COUNT }, () => -1) },
    uScreenLevel: { value: Array.from({ length: LAYER_COUNT }, () => 0) },
    uScreenInk: { value: new Color(PALETTE.phosphor) },
  };
  const lane = laneGeometry();
  const { lanesTop, lanesBottom, waveEnd, meterStart } = SCREEN_LAYOUT;
  const number = (value: number) => value.toFixed(5);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uScreenLanes;
uniform float uScreenHead[ ${LAYER_COUNT} ];
uniform float uScreenLevel[ ${LAYER_COUNT} ];
uniform vec3 uScreenInk;
void main() {`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
if ( uScreenLanes > 0.5 ) {
  vec2 screenP = vec2( vEmissiveMapUv.x, 1.0 - vEmissiveMapUv.y );
  if ( screenP.y >= ${number(lanesTop)} && screenP.y <= ${number(lanesBottom)} ) {
    for ( int i = 0; i < ${LAYER_COUNT}; i ++ ) {
      float local = ( screenP.x - ( ${number(lane.x0)} + float( i ) * ${number(lane.step)} ) ) / ${number(lane.width)};
      if ( local < 0.0 || local > 1.0 ) continue;
      if ( local < ${number(waveEnd)} ) {
        float head = uScreenHead[ i ];
        if ( head >= 0.0 ) {
          float headX = head * ${number(waveEnd)};
          if ( local < headX ) totalEmissiveRadiance *= 1.6;
          if ( abs( local - headX ) * ${number(lane.width * textureWidth)} < 1.25 ) totalEmissiveRadiance = uScreenInk * emissive;
        }
      } else if ( local > ${number(meterStart)} ) {
        float fill = ( ${number(lanesBottom)} - screenP.y ) / ${number(lanesBottom - lanesTop)};
        if ( fill < uScreenLevel[ i ] ) totalEmissiveRadiance = uScreenInk * emissive;
      }
    }
  }
}
#endif`,
      );
  };
  material.customProgramCacheKey = () => `pantalla-carriles-${textureWidth}`;
  return {
    setLanes(on) {
      uniforms.uScreenLanes.value = on ? 1 : 0;
    },
    set(heads, levels) {
      let changed = false;
      for (let i = 0; i < LAYER_COUNT; i++) {
        const head = heads[i] ?? -1;
        const level = Math.min(1, Math.max(0, levels[i] ?? 0));
        if (uniforms.uScreenHead.value[i] !== head || uniforms.uScreenLevel.value[i] !== level) {
          uniforms.uScreenHead.value[i] = head;
          uniforms.uScreenLevel.value[i] = level;
          changed = true;
        }
      }
      return changed;
    },
  };
}
