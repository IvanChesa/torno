/**
 * instrument: modelo del instrumento en TS puro (PLAN §4.5, D11): catálogo de controles, gestos,
 * menú, pantalla, atajos y medidas del aparato. Lo usan el instrumento HTML, el 3D (fases 5 y 6) y
 * la guía (fase 7). Sin DOM, sin audio y sin Angular: se prueba en Node.
 */
export * from './catalog';
export * from './constants';
export * from './control-value';
export * from './display';
export * from './gestures';
export * from './instrument';
export * from './instrument.content';
export * from './keyboard';
export * from './layout';
export * from './menu';
export * from './pose';
export * from './sounds';
