import { RenderMode, ServerRoute } from '@angular/ssr';

// Salida estática (outputMode: "static"): todas las rutas se prerenderizan (PLAN D14).
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
