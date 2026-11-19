import { Injectable, signal } from '@angular/core';

/**
 * Chargement de Mermaid à la demande.
 *
 * Mermaid pèse 2,6 Mo (770 Ko compressés) : 83 % du poids initial du tableau
 * de bord, pour trois écrans qui s'en servent. Déclaré dans `scripts` de
 * `angular.json`, il partait avec CHAQUE page — en `defer`, donc sans bloquer
 * l'analyse du HTML, mais en se disputant la bande passante avec `main.js`.
 * Sur un lien à 30 Ko/s, cela doublait à peu près le temps d'affichage.
 *
 * Il est maintenant copié dans `/scripts/mermaid.min.js` (asset) et chargé
 * seulement quand un diagramme doit être dessiné.
 *
 * `ngx-markdown` lit la variable globale `mermaid` au moment du rendu et lève
 * une erreur si elle est absente : les écrans concernés n'affichent donc leur
 * `<markdown mermaid>` qu'une fois `ready()` passé à vrai.
 */
@Injectable({ providedIn: 'root' })
export class MermaidLoaderService {
  /** Vrai dès que la variable globale `mermaid` est utilisable. */
  readonly ready = signal(false);

  /** Vrai si le script n'a pas pu être chargé (réseau coupé, 404). */
  readonly failed = signal(false);

  private pending: Promise<void> | null = null;

  /**
   * Charge Mermaid si ce n'est pas déjà fait. Les appels concurrents partagent
   * la même promesse : le script n'est inséré qu'une fois.
   */
  load(): Promise<void> {
    if (this.ready()) return Promise.resolve();
    if (this.pending) return this.pending;

    this.pending = new Promise<void>((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('mermaid: pas de document'));
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>('script[data-idem-mermaid]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('mermaid: chargement échoué')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = '/scripts/mermaid.min.js';
      script.async = true;
      script.dataset['idemMermaid'] = '';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('mermaid: chargement échoué')), {
        once: true,
      });
      document.head.appendChild(script);
    })
      .then(() => {
        this.ready.set(true);
        this.failed.set(false);
      })
      .catch((error: unknown) => {
        // Une nouvelle tentative doit rester possible : on relâche la promesse.
        this.pending = null;
        this.failed.set(true);
        throw error;
      });

    return this.pending;
  }
}
