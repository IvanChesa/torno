/**
 * API pública del motor de audio (PLAN §4.2): lo único que importan state/, features/ y pages/.
 * Entra en el bundle inicial, así que solo lleva el desbloqueo en el gesto (§4.9, < 2 kB) y tipos;
 * el motor se carga con `import()`.
 */
import type { AudioEngine } from './engine';

export { installAudioUnlock, unlockAudio } from './unlock';
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

let loading: Promise<AudioEngine> | undefined;

/** Carga el motor (una vez) y devuelve la instancia única. */
export function loadAudioEngine(): Promise<AudioEngine> {
  loading ??= import('./engine').then((module) => module.audioEngine());
  return loading;
}

/** Precarga el motor sin arrancarlo (al acercarse el puntero o el foco al instrumento). */
export function preloadAudioEngine(): void {
  void loadAudioEngine().catch(() => (loading = undefined));
}
