/**
 * Desbloqueo del audio (PLAN §4.9). Va en el bundle inicial y tiene que ser diminuto.
 *
 * Se llama DENTRO del gesto del usuario y antes de cualquier `await`: crea el `AudioContext` (o
 * reutiliza el que hay), lo reanuda y reproduce un búfer silencioso de una muestra, que es lo que
 * Safari en iOS necesita para dejar sonar el contexto. El resto del motor, que se carga después,
 * adopta este mismo contexto.
 */

let context: AudioContext | undefined;

export function unlockAudio(): void {
  if (context?.state === 'running') return;
  if (!context || context.state === 'closed') {
    if (typeof AudioContext === 'undefined') {
      throw new Error('Este navegador no tiene Web Audio.');
    }
    // Sin `sampleRate`: la del dispositivo (PLAN D22); si no, el navegador remuestrea.
    context = new AudioContext({ latencyHint: 'interactive' });
  }
  // Sin `await`: la promesa se resuelve después, pero la petición sale dentro del gesto.
  context.resume().catch(() => undefined);
  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, context.sampleRate);
  source.connect(context.destination);
  source.start();
}

/** El contexto desbloqueado, para el resto del motor (no forma parte de la API pública). */
export function unlockedContext(): AudioContext {
  if (!context) throw new Error('El audio no está desbloqueado: llama antes a unlockAudio().');
  return context;
}
