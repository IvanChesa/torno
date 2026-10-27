import { Routes } from '@angular/router';
import { ROUTES_CONTENT } from './app.routes.content';
import type { SeoRouteData } from './core/seo.service';

const loadNotFound = () => import('./pages/not-found/not-found-page').then((m) => m.NotFoundPage);
const notFoundData: SeoRouteData = { noindex: true };

// Rutas de PLAN §2, en español y sin barra final.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'sobre-el-proyecto',
    title: ROUTES_CONTENT.about.title,
    data: { description: ROUTES_CONTENT.about.description } satisfies SeoRouteData,
    loadComponent: () => import('./pages/about/about-page').then((m) => m.AboutPage),
  },
  // /404 existe para prerenderizar la página de error (el 404.html de Cloudflare Pages, fase 4);
  // ** muestra la misma página en el cliente para cualquier otra URL. Las dos, con noindex.
  {
    path: '404',
    title: ROUTES_CONTENT.notFound.title,
    data: notFoundData,
    loadComponent: loadNotFound,
  },
  {
    path: '**',
    title: ROUTES_CONTENT.notFound.title,
    data: notFoundData,
    loadComponent: loadNotFound,
  },
];
