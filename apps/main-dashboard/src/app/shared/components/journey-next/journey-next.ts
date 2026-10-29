import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { destinationApp, journeyLink, JourneyDestination, JourneyUrls, Recommendation } from '@idem/shared-journey';
import { JourneyCardComponent } from '@idem/shared-journey/angular';
import { environment } from '../../../../environments/environment';
import { JourneyService } from '../../services/journey.service';
import { LanguageService } from '../../services/language.service';

/**
 * « Prochaine étape » d'un projet dans le dashboard : la recommandation du moment, calculée par l'API sur ce
 * que l'utilisateur a fait dans toutes les applications (site refait dans iCode, vidéo dans iVision, mise en
 * ligne…). N'affiche rien quand il n'y a rien d'opportun — la plupart du temps.
 *
 * `place` : la destination que la page EST déjà (la page Communication ne recommande pas la communication).
 * `ambient` : la page peut montrer la prochaine étape logique même sans geste récent (accueil du projet).
 */
@Component({
  selector: 'app-journey-next',
  imports: [JourneyCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recommendation(); as rec) {
      <idem-journey-card
        [recommendation]="rec"
        [urls]="urls"
        from="dashboard"
        [lang]="lang"
        [client]="journey"
        [beforeOpen]="beforeOpen"
        (dismissed)="recommendation.set(null)"
      />
    }
  `,
})
export class JourneyNext {
  protected readonly journey = inject(JourneyService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  readonly projectId = input<string | null | undefined>(null);
  readonly place = input<JourneyDestination | undefined>(undefined);
  readonly ambient = input(false);

  protected readonly recommendation = signal<Recommendation | null>(null);
  protected readonly urls: JourneyUrls = {
    dashboard: typeof window !== 'undefined' ? window.location.origin : '',
    icode: environment.services.webgen.url,
  };
  protected get lang(): string {
    return this.language.getCurrentLanguage();
  }

  /** Une destination du dashboard s'ouvre sans recharger l'application (le projet est déjà sélectionné). */
  protected readonly beforeOpen = async (rec: Recommendation): Promise<boolean> => {
    if (destinationApp(rec.destination) !== 'dashboard') return true;
    const href = journeyLink(rec.destination, { urls: this.urls, projectId: rec.projectId, from: 'dashboard' });
    const url = new URL(href);
    await this.router.navigateByUrl(`${url.pathname}${url.search}`);
    return false;
  };

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      const place = this.place();
      const ambient = this.ambient();
      this.recommendation.set(null);
      if (!projectId) return;
      void this.journey.next({ app: 'dashboard', projectId, place, ambient }).then(([next]) => {
        // La page a pu changer de projet pendant l'appel.
        if (this.projectId() === projectId) this.recommendation.set(next ?? null);
      });
    });
  }
}
