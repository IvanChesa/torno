/**
 * audio/core: núcleo DSP en TS puro (PLAN §4.4). Se ejecuta igual en el worklet, en el worker de
 * exportación y en los tests de Node. Sin DOM, sin Web Audio, sin Angular y sin dependencias.
 */
export * from './constants';
export * from './content';
export * from './loop-core';
export * from './memory';
export * from './offline';
export * from './protocol';
export * from './session';
