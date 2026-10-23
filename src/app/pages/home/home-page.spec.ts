import { TestBed } from '@angular/core/testing';
import { HomePage } from './home-page';
import { HOME_CONTENT } from './home.content';

describe('HomePage', () => {
  it('tiene un solo h1 con el nombre y una sección con título para cada bloque', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const h1 = root.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]?.textContent?.trim()).toBe(HOME_CONTENT.title);
    for (const section of root.querySelectorAll('section[aria-labelledby]')) {
      const id = section.getAttribute('aria-labelledby') ?? '';
      expect(root.querySelector(`#${id}`)?.tagName).toBe('H2');
    }
  });

  it('sus textos están pendientes de revisión', () => {
    expect(HOME_CONTENT.reviewed).toBe(false);
  });
});
