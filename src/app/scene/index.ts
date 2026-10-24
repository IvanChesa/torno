/**
 * scene: API pública del 3D (PLAN §4.6). Three.js sin Angular ni audio; es el único sitio donde se
 * importa `three`. Los componentes solo llegan aquí, y el motor (`SceneEngine`, con model/,
 * materials/, camera/, projection.ts y quality.ts) se cargará con `import()` para que nunca entre
 * en el bundle inicial. Llega en la fase 5.
 */
export {};
