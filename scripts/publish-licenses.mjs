// Publica los avisos de licencias de terceros junto a la web. Angular los deja en
// dist/torno/3rdpartylicenses.txt, fuera de dist/torno/browser/ (lo que se despliega en la fase 4),
// y el JS minificado no lleva los comentarios @license. Se ejecuta tras `npm run build` (postbuild).
import { copyFile, mkdir } from 'node:fs/promises';

const dist = new URL('../dist/torno/', import.meta.url);
await mkdir(new URL('browser/licencias/', dist), { recursive: true });
await copyFile(
  new URL('3rdpartylicenses.txt', dist),
  new URL('browser/licencias/terceros.txt', dist),
);
console.log('✔ Licencias de terceros: dist/torno/browser/licencias/terceros.txt');
