import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { authGuard } from './core/auth.guard';

/**
 * `/studio/:mode` et `/studio/:mode/:sessionId` : UNE seule route, pour que la conversation ne
 * soit pas détruite quand son adresse reçoit l'identifiant de la session (le flux continue).
 */
export function chatMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (!segments.length || segments.length > 2 || !['image', 'video'].includes(segments[0].path)) return null;
  return { consumed: segments, posParams: { mode: segments[0], ...(segments[1] ? { sessionId: segments[1] } : {}) } };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing) },
  // L'éditeur d'un visuel occupe tout l'écran (hors de la barre latérale du studio).
  {
    path: 'studio/visual/:brandId/:visualId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/studio/visual-edit/visual-edit').then((m) => m.VisualEditPage),
  },
  {
    path: 'studio',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/studio/shell').then((m) => m.StudioShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'video' },
      { path: 'brands', loadComponent: () => import('./pages/studio/brands/brands').then((m) => m.BrandsPage) },
      { path: 'montage', loadComponent: () => import('./pages/studio/montage/montage').then((m) => m.MontagePage) },
      { path: 'montage/:montageId', loadComponent: () => import('./pages/studio/montage/montage').then((m) => m.MontagePage) },
      { path: 'video/:brandId/:videoId', loadComponent: () => import('./pages/studio/video-edit/video-edit').then((m) => m.VideoEditPage) },
      { matcher: chatMatcher, loadComponent: () => import('./pages/studio/chat/chat').then((m) => m.ChatPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
