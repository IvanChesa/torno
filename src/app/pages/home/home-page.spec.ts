import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';
import { HOME_CONTENT } from './home.content';

describe('HomePage', () => {
  it('tiene un solo h1 con el nombre y una sección con título para cada bloque', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const h1 = root.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]?.textContent?.trim()).toBe(HOME_CONTENT.title);
    // La portada lleva el h1; cada sección de debajo, su h2.
    const sections = [...root.querySelectorAll('section[aria-labelledby]')];
    expect(sections.length).toBeGreaterThanOrEqual(3);
    sections.forEach((section, i) => {
      const id = section.getAttribute('aria-labelledby') ?? '';
      expect(root.querySelector(`#${id}`)?.tagName).toBe(i === 0 ? 'H1' : 'H2');
    });
  });

  it('sus textos están pendientes de revisión', () => {
    expect(HOME_CONTENT.reviewed).toBe(false);
  });
});
