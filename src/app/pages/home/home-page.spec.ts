import { DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';
import { HOME_CONTENT } from './home.content';

describe('HomePage', () => {
  beforeAll(() => {
    // jsdom no tiene IntersectionObserver (los `@defer` de la portada esperan a verse).
    globalThis.IntersectionObserver ??= class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  it('tiene un solo h1 con el nombre y una sección con título para cada bloque', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    // Las secciones de debajo de la portada van en `@defer` (con hidratación incremental): se
    // pintan, salvo el instrumento (el primero), que en jsdom no tiene WebGL ni audio.
    const blocks = await fixture.getDeferBlocks();
    for (const block of blocks.slice(1)) await block.render(DeferBlockState.Complete);
    const root = fixture.nativeElement as HTMLElement;
    const h1 = root.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]?.textContent?.trim()).toBe(HOME_CONTENT.title);
    // La portada lleva el h1; cada sección de debajo, su h2.
    const sections = [...root.querySelectorAll('section[aria-labelledby]')];
    expect(sections).toHaveLength(8);
    sections.forEach((section, i) => {
      const id = section.getAttribute('aria-labelledby') ?? '';
      expect(root.querySelector(`#${id}`)?.tagName).toBe(i === 0 ? 'H1' : 'H2');
    });
  });

  it('sus textos están pendientes de revisión', () => {
    expect(HOME_CONTENT.reviewed).toBe(false);
  });
});
