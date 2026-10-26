/**
 * Catálogo de sonidos del menú SONIDO (PLAN §4.5): categorías y sonidos, con el id que renderiza el
 * worker de síntesis. Hasta la fase 3 hay un sonido de prueba por categoría.
 */
import { INSTRUMENT_CONTENT } from './instrument.content';

export type SoundCategory = 'drums' | 'bass' | 'chords' | 'texture';

export interface SoundEntry {
  readonly id: string;
  readonly category: SoundCategory;
  /** Nombre en la pantalla (mayúsculas). */
  readonly name: string;
}

export const SOUND_CATEGORIES: readonly SoundCategory[] = ['drums', 'bass', 'chords', 'texture'];

export const SOUNDS: readonly SoundEntry[] = [
  { id: 'prueba-bateria', category: 'drums', name: 'PRUEBA' },
  { id: 'prueba-bajo', category: 'bass', name: 'PRUEBA' },
  { id: 'prueba-acordes', category: 'chords', name: 'PRUEBA' },
  { id: 'prueba-textura', category: 'texture', name: 'PRUEBA' },
];

export function soundsIn(category: SoundCategory): readonly SoundEntry[] {
  return SOUNDS.filter((sound) => sound.category === category);
}

export function soundById(id: string): SoundEntry | undefined {
  return SOUNDS.find((sound) => sound.id === id);
}

/** «BATERÍA · PRUEBA», o el id si no está en el catálogo. */
export function soundLabel(id: string): string {
  const sound = soundById(id);
  return sound ? `${INSTRUMENT_CONTENT.menu.categories[sound.category]} · ${sound.name}` : id;
}
