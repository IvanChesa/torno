/**
 * audio/core: núcleo DSP en TS puro (PLAN §4.4). Se ejecuta igual en el worklet, en el worker de
 * exportación y en los tests de Node. Sin DOM, sin Web Audio, sin Angular y sin dependencias.
 *
 * Fase 0: el pitido de la prueba técnica y el protocolo. `LoopCore` llega en la fase 1.
 */
export * from './beep';
export * from './protocol';
