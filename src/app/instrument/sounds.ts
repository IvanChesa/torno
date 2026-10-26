/**
 * Catálogo de sonidos del menú SONIDO (PLAN §4.5): categorías y sonidos, con el id que renderiza el
 * worker de síntesis (`audio/synth/library.ts`; un test comprueba que coinciden). Nombres propios
 * en español: la tierra, la alfarería y el Bajo Cinca.
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

const names = INSTRUMENT_CONTENT.sounds;

export const SOUNDS: readonly SoundEntry[] = [
  { id: 'alfar', category: 'drums', name: names.alfar },
  { id: 'horno', category: 'drums', name: names.horno },
  { id: 'adobe', category: 'drums', name: names.adobe },
  { id: 'raiz', category: 'bass', name: names.raiz },
  { id: 'cinca', category: 'bass', name: names.cinca },
  { id: 'surco', category: 'bass', name: names.surco },
  { id: 'olivo', category: 'chords', name: names.olivo },
  { id: 'vega', category: 'chords', name: names.vega },
  { id: 'almendro', category: 'chords', name: names.almendro },
  { id: 'cierzo', category: 'texture', name: names.cierzo },
  { id: 'acequia', category: 'texture', name: names.acequia },
  { id: 'brasa', category: 'texture', name: names.brasa },
];

/** La batería con la que arranca la primera reproducción de una sesión vacía (PLAN §0.1). */
export const FIRST_PLAY_SOUND = 'alfar';

export function soundsIn(category: SoundCategory): readonly SoundEntry[] {
  return SOUNDS.filter((sound) => sound.category === category);
}

export function soundById(id: string): SoundEntry | undefined {
  return SOUNDS.find((sound) => sound.id === id);
}

/** «BATERÍA · ALFAR», o el id si no está en el catálogo. */
export function soundLabel(id: string): string {
  const sound = soundById(id);
  return sound ? `${INSTRUMENT_CONTENT.menu.categories[sound.category]} · ${sound.name}` : id;
}
