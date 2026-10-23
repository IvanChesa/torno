import { afterNextRender, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_CONTENT } from './app.content';
import { applyCaptureMode } from './core/capture-mode';
import { SITE_CONFIG } from './core/site.config';

@Component({
  selector: 'trn-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip-link" href="#contenido">{{ text.skipLink }}</a>

    <header class="site-header">
      <a class="wordmark" routerLink="/" [attr.aria-label]="text.homeLabel">{{ site.name }}</a>
      <nav [attr.aria-label]="text.navLabel">
        <ul>
          <li>
            <a
              routerLink="/"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: true }"
              ariaCurrentWhenActive="page"
              >{{ text.nav.instrument }}</a
            >
          </li>
          <li>
            <a
              routerLink="/sobre-el-proyecto"
              routerLinkActive="is-active"
              ariaCurrentWhenActive="page"
              >{{ text.nav.about }}</a
            >
          </li>
        </ul>
      </nav>
    </header>

    <main id="contenido" tabindex="-1">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <p class="site-footer__name" aria-hidden="true">{{ site.name }}</p>
      <div class="site-footer__body">
        <p>
          {{ text.authorPrefix }} <a [href]="site.author.url">{{ site.author.name }}</a
          >.
        </p>
        <p>{{ text.privacy }}</p>
        <nav class="site-footer__legal" [attr.aria-label]="text.legalLabel">
          <ul>
            @for (link of site.legal; track link.url) {
              <li>
                <a [href]="link.url">{{ link.label }}</a>
              </li>
            }
          </ul>
        </nav>
      </div>
    </footer>
  `,
  styleUrl: './app.css',
})
export class App {
  protected readonly site = SITE_CONFIG;
  protected readonly text = APP_CONTENT;

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => applyCaptureMode(document));
  }
}
