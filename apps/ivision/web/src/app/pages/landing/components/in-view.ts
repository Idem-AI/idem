import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/**
 * Joue l'animation d'entrée d'un élément quand il approche de l'écran (une seule fois).
 *
 * Le contenu n'est JAMAIS caché par défaut : l'élément est complet au repos, et ses animations
 * (des @keyframes en `both`, déclarées sous `.is-drawn`) ne démarrent qu'avec la classe. Si elle
 * n'arrive jamais (pas d'IntersectionObserver, rendu sans défilement), on voit l'élément fini.
 * La classe est posée un peu avant l'entrée à l'écran (`rootMargin`), pour que l'animation parte
 * hors champ et non sur un dessin déjà visible. Rien n'est animé si l'élément est déjà à l'écran
 * au chargement, ni si le visiteur réduit les animations.
 *
 * `ivInViewEnter` prévient le composant quand l'élément devient visible (pour lancer une
 * démonstration au bon moment), y compris s'il l'est dès le chargement.
 */
@Directive({ selector: '[ivInView]' })
export class InView {
  readonly ivInViewEnter = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches && host.getBoundingClientRect().top >= innerHeight;

      const approach = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          if (animate) host.classList.add('is-drawn');
          approach.disconnect();
        },
        { rootMargin: '0px 0px 15% 0px' },
      );
      const visible = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          this.ivInViewEnter.emit();
          visible.disconnect();
        },
        { threshold: 0.25 },
      );
      approach.observe(host);
      visible.observe(host);
      destroyRef.onDestroy(() => {
        approach.disconnect();
        visible.disconnect();
      });
    });
  }
}
