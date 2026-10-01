import { DestroyRef, Signal, inject, signal } from '@angular/core';

/**
 * Largeur sous laquelle le module passe en disposition téléphone.
 *
 * Même seuil que le dock de mode (`mode-dock.css`, 640 px) : les deux
 * s'emboîtent en bas de l'écran, ils doivent basculer ensemble.
 */
export const COMPACT_QUERY = '(max-width: 640px)';

/**
 * Vrai sur un écran de téléphone, et suivi en direct (rotation, fenêtre
 * redimensionnée).
 *
 * Réservé à ce que le CSS ne sait pas faire seul : ouvrir ou fermer un
 * `<details>`, choisir une vue par défaut. La mise en page, elle, reste dans
 * les feuilles de style.
 */
export function injectCompactViewport(): Signal<boolean> {
  const query = typeof window !== 'undefined' ? window.matchMedia?.(COMPACT_QUERY) : undefined;
  const compact = signal(!!query?.matches);
  if (query) {
    const listener = (event: MediaQueryListEvent) => compact.set(event.matches);
    query.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
  }
  return compact.asReadonly();
}
