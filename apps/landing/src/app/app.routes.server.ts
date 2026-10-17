import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Les billets sont publiés depuis le panel admin, sans nouvelle version du
    // site : leur page n'existe pas au prérendu. Elle est rendue dans le
    // navigateur (nginx sert `index.csr.html` pour toute adresse sans fichier).
    path: 'blog/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
