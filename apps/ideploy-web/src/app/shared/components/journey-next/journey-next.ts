import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import type { JourneyClient, JourneyUrls, Recommendation } from '@idem/shared-journey';
import { JourneyCardComponent } from '@idem/shared-journey/angular';
import { environment } from '../../../../environments/environment';

/**
 * L'étape suivante d'une application en ligne (la faire connaître, lui donner son nom…), calculée par la boucle
 * IDEM. iDeploy ne connaît pas les projets d'IDEM : l'API retrouve le projet par l'application (une mise en ligne
 * faite depuis iCode garde ses identifiants). Une application sans projet IDEM n'affiche rien — jamais une carte
 * sur le mauvais projet.
 *
 * « Votre propre nom de domaine » s'ouvre ici même, dans l'onglet Nom de domaine (`openDomain`).
 */
@Component({
  selector: 'app-journey-next',
  imports: [JourneyCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recommendation(); as rec) {
      <idem-journey-card [recommendation]="rec" [urls]="urls" from="ideploy" [lang]="lang()" [client]="client" [beforeOpen]="beforeOpen" (dismissed)="recommendation.set(null)" />
    }
  `,
})
export class JourneyNextComponent {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly base = `${environment.services.api.url.replace(/\/+$/, '')}/journey`;

  /** L'application iDeploy affichée. */
  readonly appUuid = input.required<string>();
  readonly openDomain = output<void>();

  protected readonly recommendation = signal<Recommendation | null>(null);
  protected readonly lang = () => this.translate.currentLang || 'fr';
  protected readonly urls: JourneyUrls = { dashboard: environment.services.console.url, icode: environment.services.icode.url };

  protected readonly client: JourneyClient = {
    record: async () => [],
    next: async ({ place }) => {
      const params = new HttpParams().set('app', 'ideploy').set('appUuid', this.appUuid()).set('place', place ?? 'publish-site').set('limit', '3');
      const answer = await firstValueFrom(this.http.get<{ recommendations?: Recommendation[] }>(`${this.base}/next`, { params })).catch(() => null);
      return answer?.recommendations ?? [];
    },
    feedback: async (id, action) => {
      await firstValueFrom(this.http.post(`${this.base}/feedback`, { id, action })).catch(() => undefined);
    },
  };

  protected readonly beforeOpen = (rec: Recommendation): boolean => {
    if (rec.destination !== 'domain') return true;
    this.openDomain.emit();
    return false;
  };

  constructor() {
    effect(() => {
      const uuid = this.appUuid();
      this.recommendation.set(null);
      if (!uuid) return;
      // On EST sur la mise en ligne : ni « Mettre en ligne » ni son équivalent pour l'application.
      void this.client.next({ app: 'ideploy', place: 'publish-site' }).then((recs) => {
        if (this.appUuid() !== uuid) return;
        this.recommendation.set(recs.find((rec) => rec.destination !== 'publish-app') ?? null);
      });
    });
  }
}
