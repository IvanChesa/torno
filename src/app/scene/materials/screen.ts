/**
 * La pantalla del aparato (PLAN §4.5 y §4.6): el modelo de pantalla del instrumento pintado en una
 * textura de canvas, en fósforo sobre negro, como la del instrumento HTML. Solo se repinta cuando
 * cambia lo que dice.
 */
import type { CanvasTexture } from 'three';
import { SCREEN, TRAY, type DisplayModel } from '../../instrument';
import { rad } from '../model/geometry';
import { PALETTE } from './palette';
import { canvas, canvasTexture, MONO } from './textures';

/** Una fila de la pantalla: texto a la izquierda, valor a la derecha. */
export interface ScreenRow {
  readonly text: string;
  readonly value: string;
  /** La fila elegida del menú, invertida (fósforo de fondo). */
  readonly inverted: boolean;
  /** El título y la línea de estado, a media luz. */
  readonly dim: boolean;
}

/** Filas del menú que caben a la vez (las de alrededor del cursor). */
export const VISIBLE_MENU_ROWS = 3;
/** Filas de la pantalla, contando la de estado, que va siempre abajo. */
export const SCREEN_ROWS = 5;

/**
 * Lo que se pinta, de arriba abajo (sin la línea de estado, que va aparte): el título, las líneas
 * y una ventana del menú alrededor de la fila elegida.
 */
export function screenRows(display: DisplayModel): ScreenRow[] {
  const rows: ScreenRow[] = [];
  if (display.title) rows.push({ text: display.title, value: '', inverted: false, dim: true });
  for (const line of display.lines)
    rows.push({ text: line, value: '', inverted: false, dim: false });
  const menu = display.rows;
  const selected = Math.max(
    0,
    menu.findIndex((row) => row.selected),
  );
  const start = Math.min(Math.max(0, selected - 1), Math.max(0, menu.length - VISIBLE_MENU_ROWS));
  for (const row of menu.slice(start, start + VISIBLE_MENU_ROWS)) {
    rows.push({
      text: row.label,
      value: row.editing ? `‹ ${row.value} ›` : row.value,
      inverted: row.selected,
      dim: false,
    });
  }
  return rows.slice(0, SCREEN_ROWS - 1);
}

/** La proporción de la pantalla: su arco (a media altura) entre su alto (en la cara inclinada). */
export function screenAspect(): number {
  const middle = (SCREEN.bottom + SCREEN.top) / 2;
  const radius = TRAY.innerRadius + middle * Math.tan(rad(TRAY.lean));
  const arc = radius * rad(2 * SCREEN.halfAngle);
  const height = (SCREEN.top - SCREEN.bottom) / Math.cos(rad(TRAY.lean));
  return arc / height;
}

/** Lo que identifica lo que dice la pantalla: si no cambia, no se repinta. */
function signature(display: DisplayModel): string {
  return JSON.stringify([display.title, display.lines, display.rows, display.status]);
}

export class ScreenPainter {
  readonly texture: CanvasTexture;
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #signature = '';

  constructor(height = 256) {
    const width = Math.round((height * screenAspect()) / 64) * 64;
    const { element, context } = canvas(width, height);
    this.#canvas = element;
    this.#context = context;
    this.texture = canvasTexture(element, 'pantalla');
  }

  /** Pinta la pantalla si ha cambiado; dice si lo ha hecho. */
  paint(display: DisplayModel): boolean {
    const next = signature(display);
    if (next === this.#signature) return false;
    this.#signature = next;
    const { width, height } = this.#canvas;
    const context = this.#context;
    context.fillStyle = PALETTE.screen;
    context.fillRect(0, 0, width, height);
    const padX = width * 0.03;
    const padY = height * 0.06;
    const line = (height - 2 * padY) / SCREEN_ROWS;
    const rows = screenRows(display);
    rows.forEach((row, i) => this.#row(row, padX, padY + i * line, width - 2 * padX, line));
    if (display.status) {
      this.#row(
        { text: display.status, value: '', inverted: false, dim: true },
        padX,
        padY + (SCREEN_ROWS - 1) * line,
        width - 2 * padX,
        line,
      );
    }
    this.texture.needsUpdate = true;
    return true;
  }

  #row(row: ScreenRow, x: number, y: number, width: number, height: number): void {
    const context = this.#context;
    let size = Math.round(height * 0.72);
    context.font = `500 ${size}px ${MONO}`;
    const gap = size;
    const needed =
      context.measureText(row.text).width +
      (row.value ? gap + context.measureText(row.value).width : 0);
    // Una línea que no cabe se encoge, no se corta.
    if (needed > width) {
      size = Math.floor((size * width) / needed);
      context.font = `500 ${size}px ${MONO}`;
    }
    if (row.inverted) {
      context.fillStyle = PALETTE.phosphor;
      context.fillRect(x - height * 0.15, y + height * 0.06, width + height * 0.3, height * 0.9);
    }
    context.fillStyle = row.inverted ? PALETTE.screen : PALETTE.phosphor;
    context.globalAlpha = row.dim ? 0.78 : 1;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillText(row.text, x, y + height / 2);
    if (row.value) {
      context.textAlign = 'right';
      context.fillText(row.value, x + width, y + height / 2);
    }
    context.globalAlpha = 1;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
