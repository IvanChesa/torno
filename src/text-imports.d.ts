// Tipos para importar archivos como texto con atributos de importación (los resuelve el esbuild
// de Angular): `import html from './index.html' with { loader: 'text' }`. Solo en los tests.
declare module '*.html' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
