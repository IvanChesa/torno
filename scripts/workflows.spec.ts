// Los flujos de GitHub Actions del despliegue (PLAN D19 y fase 9, tarea 1), leídos como texto: la
// producción solo sale de una etiqueta v* (o a mano), publica el build que probó el CI y, en seco,
// no publica nada; staging nunca va a la rama de producción, y todas las acciones van fijadas por SHA.
// La prueba de verdad es un lanzamiento en seco (`gh workflow run production.yml -f etiqueta=main`).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = new URL('../.github/workflows/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8');
const PRODUCTION = read('production.yml');
const DEPLOY = read('deploy.yml');
const CI = read('ci.yml');

/** Los pasos de un flujo de un solo job: cada bloque que empieza por `      - `. */
function steps(yaml: string): string[] {
  const body = yaml.slice(yaml.indexOf('\n    steps:\n'));
  return body.split(/\n(?= {6}- )/).slice(1);
}

/** El paso cuyo `name:` es ese, o el que usa esa acción. */
function step(yaml: string, name: string): string {
  const found = steps(yaml).find(
    (block) => block.includes(`name: ${name}\n`) || block.includes(`uses: ${name}@`),
  );
  if (!found) throw new Error(`No está el paso «${name}»`);
  return found;
}

/** La expresión regular de bash (`[[ "$ref" =~ … ]]`) de la línea que sigue a `marker`, en JS. */
function bashRegex(block: string, marker: string): RegExp {
  const line = block.split('\n').find((text) => text.includes(marker) && text.includes('=~'));
  const source = /=~ (\^.*\$) \]\]/.exec(line ?? '')?.[1];
  if (!source) throw new Error(`No está la expresión de ${marker}`);
  return new RegExp(source);
}

describe('production.yml', () => {
  it('se dispara con una etiqueta v* o a mano, en seco por defecto', () => {
    expect(PRODUCTION).toMatch(/\non:\n {2}push:\n {4}tags: \['v\*'\]\n {2}workflow_dispatch:\n/);
    expect(PRODUCTION).not.toMatch(/\n {4}branches:/);
    expect(PRODUCTION).toMatch(/en_seco:\n(?: {8}.*\n)*? {8}type: boolean\n {8}default: true\n/);
    // Con una etiqueta (event push), nunca en seco.
    expect(PRODUCTION).toContain(
      "DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.en_seco }}",
    );
  });

  it('acepta solo etiquetas vX.Y.Z, y en seco también main o un SHA', () => {
    const target = step(PRODUCTION, 'Qué se publica');
    const tag = bashRegex(target, 'if [[ "$ref"');
    for (const ok of ['v1.0.0', 'v1.2.30', 'v2.0.0-rc.1']) expect(tag.test(ok)).toBe(true);
    for (const bad of ['1.0.0', 'v1.0', 'v1.0.0;rm -rf', 'v1.0.0 ', 'main', 'v1.0.0-$(id)']) {
      expect(tag.test(bad)).toBe(false);
    }
    const dry = bashRegex(target, '[ "$DRY_RUN" = true ]');
    for (const ok of ['main', 'f176c2e', '62c4eef9a1b2c3d4e5f60718293a4b5c6d7e8f90']) {
      expect(dry.test(ok)).toBe(true);
    }
    for (const bad of ['fase-9', 'main;id', 'HEAD', 'F176C2E', 'f17'])
      expect(dry.test(bad)).toBe(false);
    // Lo validado es lo único que llega a los comandos: la etiqueta y el formulario, por el entorno.
    expect(target).toContain('INPUT_REF: ${{ inputs.etiqueta }}');
    expect(target).not.toMatch(/run: \|[\s\S]*\$\{\{/);
  });

  it('solo publica lo que está en main y coincide con package.json', () => {
    const target = step(PRODUCTION, 'Qué se publica');
    expect(target).toContain('git merge-base --is-ancestor "$sha" origin/main');
    expect(target).toContain('"v$version" != "$ref"');
    expect(step(PRODUCTION, 'actions/checkout')).toMatch(
      /fetch-depth: 0\n[\s\S]*persist-credentials: false/,
    );
  });

  it('publica el build del CI en verde de un push a main, sin construir nada', () => {
    const ci = step(PRODUCTION, 'El CI en verde de ese commit y su build');
    expect(ci).toMatch(/--workflow ci\.yml --branch main --event push/);
    expect(ci).toMatch(/--commit "\$SHA" --status success/);
    expect(ci).toContain('select(.name == "torno-browser" and .expired == false)');
    const download = step(PRODUCTION, 'El build que probó el CI');
    expect(download).toContain('name: torno-browser');
    expect(download).toContain('run-id: ${{ steps.ci.outputs.run }}');
    expect(PRODUCTION).not.toMatch(/npm run build|ng build|npm run check/);
  });

  it('va a la rama de producción solo si no es en seco, y comprueba después', () => {
    const deploy = step(PRODUCTION, 'Publica en producción');
    expect(deploy).toContain("if: env.DRY_RUN != 'true'");
    expect(deploy).toContain(
      'command: pages deploy ../site --project-name=torno --branch=main --commit-hash=${{ steps.target.outputs.sha }}',
    );
    // El único paso que llama a wrangler es ese (el resumen solo escribe la orden).
    const wrangler = steps(PRODUCTION).filter((block) => block.includes('wrangler-action@'));
    expect(wrangler).toEqual([deploy]);
    const verify = step(PRODUCTION, 'Comprueba la producción');
    expect(verify).toContain("if: env.DRY_RUN != 'true'");
    expect(verify).toContain('verify-pages.mjs https://torno.pages.dev --build site');
    // En producción no se crea el proyecto: lo creó staging.
    expect(PRODUCTION).not.toContain('pages project create');
  });

  it('los secrets, solo en los pasos que los usan', () => {
    const withToken = steps(PRODUCTION).filter((block) =>
      block.includes('CLOUDFLARE_API_TOKEN }}'),
    );
    expect(withToken.map((block) => /name: (.+)\n/.exec(block)?.[1])).toEqual([
      '¿Están los secrets de Cloudflare?',
      '¿Existe el proyecto torno?',
      'Publica en producción',
    ]);
    expect(step(PRODUCTION, 'wrangler del package-lock.json, sin el token')).not.toContain(
      'secrets.',
    );
    expect(PRODUCTION).toMatch(
      /permissions:\n {2}contents: read\n(?: {2}#.*\n)* {2}actions: read\n/,
    );
  });
});

describe('deploy.yml', () => {
  it('nunca publica en la rama de producción', () => {
    const code = DEPLOY.split('\n').filter((line) => !line.trimStart().startsWith('#'));
    expect(code.join('\n')).not.toMatch(/--branch=main\b/);
    expect(DEPLOY).toContain('--branch=${{ steps.branch.outputs.name }}');
    expect(step(DEPLOY, 'Rama de Pages')).toContain('pages=staging');
  });
});

describe('ci.yml', () => {
  it('guarda el build de main 90 días, para la producción', () => {
    expect(step(CI, 'Guardar el build')).toContain(
      "retention-days: ${{ github.ref == 'refs/heads/main' && 90 || 7 }}",
    );
  });
});

describe('todos los flujos', () => {
  const files = readdirSync(DIR).filter((file) => file.endsWith('.yml'));

  it.each(files)(
    '%s: acciones fijadas por SHA de commit, con la versión en el comentario',
    (file) => {
      const uses = [...read(file).matchAll(/uses: (\S+)(.*)/g)];
      expect(uses.length).toBeGreaterThan(0);
      for (const [, action, comment] of uses) {
        expect(action, file).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
        expect(comment, `${file}: ${action}`).toMatch(/^ # v\d+/);
      }
    },
  );
});
