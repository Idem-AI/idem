import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { GuidedJourneyService } from '../../services/guided-journey.service';

/**
 * « Étape suivante recommandée » du mode Avancé.
 *
 * Calculée par le code d'après l'état réel du projet (le même parcours que le mode Assisté, sans le
 * verrouiller). Une petite carte FLOTTANTE (24/11/2026 : en tête de page, elle repoussait le contenu
 * important vers le bas), posée par la mise en page en haut au centre, sous la barre du haut ; fermable.
 * Le mode Assisté a sa propre barre : rien ici.
 */
@Component({
  selector: 'app-next-step-bar',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './next-step-bar.html',
  styles: `
    :host { display: block; }
    .next-float { display: flex; align-items: center; gap: 0.85rem; padding: 0.75rem 0.75rem 0.75rem 1rem; border-left: 4px solid var(--color-primary-500); box-shadow: 0 12px 32px color-mix(in oklch, var(--color-text-primary) 16%, transparent); animation: next-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .next-icon { display: flex; flex: none; align-items: center; justify-content: center; width: 2.4rem; height: 2.4rem; border-radius: 999px; background: color-mix(in oklch, var(--color-primary-500) 14%, transparent); color: var(--color-primary-500); }
    .next-label { margin: 0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-primary-500); }
    .next-title { margin: 0.1rem 0 0; font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .next-why { margin: 0.1rem 0 0; font-size: 0.78rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .next-close { width: 2rem; height: 2rem; padding: 0; }
    @keyframes next-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .next-float { animation: none; } }
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextStepBarComponent {
  private readonly uiMode = inject(UiModeService);
  private readonly journey = inject(GuidedJourneyService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** Fermetures de la session, par étape : « plus tard » vaut jusqu'au prochain changement d'étape. */
  private readonly dismissed = signal<ReadonlySet<string>>(new Set());

  protected readonly step = this.journey.currentStep;

  private readonly path = computed(() => this.url().split('?')[0].split('#')[0].replace(/\/$/, ''));

  protected readonly visible = computed(() => {
    const step = this.step();
    if (this.uiMode.mode() === 'guided' || !step || !this.journey.project()?.id) return false;
    if (this.dismissed().has(step.id)) return false;
    const path = this.path();
    if (!path.startsWith('/project/')) return false;
    // Sur l'accueil, le bandeau « complétez votre identité » dit déjà la même chose pour la marque.
    if (path === '/project/dashboard') return step.id !== 'branding' && step.id !== 'project';
    // Ailleurs : seulement sur la page d'une étape terminée (pas pendant qu'on travaille l'étape recommandée).
    const here = this.journey.stepForRoute(path);
    return !!here && here.id !== step.id && here.status === 'done';
  });

  constructor() {
    // Le rendu qu'on vient de générer change l'état du projet : on relit à chaque page pour recommander juste.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        if (this.uiMode.mode() !== 'guided') void this.journey.loadFromCookie(true);
      });
    if (this.uiMode.mode() !== 'guided') void this.journey.loadFromCookie();
  }

  protected open(): void {
    const step = this.step();
    if (step) void this.router.navigateByUrl(step.generateRoute ?? step.route);
  }

  protected dismiss(): void {
    const step = this.step();
    if (step) this.dismissed.update((s) => new Set(s).add(step.id));
  }
}
