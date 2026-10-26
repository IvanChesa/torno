/**
 * API pública del motor de audio (PLAN §4.2): lo único que importan state/, features/ y pages/.
 * Entra en el bundle inicial, así que solo lleva el desbloqueo en el gesto (§4.9, < 2 kB) y tipos;
 * el motor se carga con `import()`.
 */
import type { AutosaveDates, AutosaveSlot } from './autosave';
import type { AudioEngine } from './engine';

export {
  installAudioUnlock,
  missedAudioGesture,
  noteInstrumentTap,
  onAudioUnlock,
  unlockAudio,
} from './unlock';
export type {
  AudioEngine,
  EngineErrorCode,
  EngineEvent,
  EngineState,
  MicState,
  RecordOptions,
} from './engine';
export type { LatencyMode, LatencySetting } from './latency';
export type {
  CoreCommandBody,
  CoreStatus,
  LayerStatus,
  Notice,
  NoticeCode,
  NoticeReason,
  RecordingState,
  TransportState,
} from '../core/protocol';

export type { TornoSettings } from '../files/torno-format';
export type { AutosaveDates, AutosaveSlot } from './autosave';
export type { EngineDiagnostics } from './diagnostics';

let loading: Promise<AudioEngine> | undefined;

/**
 * Cuándo se autoguardó cada hueco (la sesión anterior y la que se tocó sin contestar el panel de
 * recuperar). Solo lee IndexedDB: no carga el motor ni toca el audio.
 */
export async function autosaveDates(): Promise<AutosaveDates> {
  return (await import('./autosave')).autosaveDates();
}

/** Borra un hueco del autoguardado de este navegador, o los dos. */
export async function deleteAutosave(slot?: AutosaveSlot): Promise<boolean> {
  return (await import('./autosave')).clearAutosave(slot);
}

/** Pasa la sesión del hueco nuevo al principal (al recuperarla, o si solo queda esa). */
export async function promoteAutosave(): Promise<boolean> {
  return (await import('./autosave')).promotePendingAutosave();
}

/** Carga el motor (una vez) y devuelve la instancia única. */
export function loadAudioEngine(): Promise<AudioEngine> {
  loading ??= import('./engine').then((module) => module.audioEngine());
  return loading;
}

/** Precarga el motor sin arrancarlo (al acercarse el puntero o el foco al instrumento). */
export function preloadAudioEngine(): void {
  void loadAudioEngine().catch(() => (loading = undefined));
}
