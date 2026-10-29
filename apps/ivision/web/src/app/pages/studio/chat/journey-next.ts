import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import type { JourneyClient, JourneyUrls, Recommendation } from '@idem/shared-journey';
import { JourneyCardComponent } from '@idem/shared-journey/angular';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';

/**
 * L'étape suivante sous un livrable (vidéo, visuel) d'une marque rattachée à un projet IDEM : créer son site,
 * sa charte, gérer sa communication… La recommandation arrive avec le message (l'API iVision la demande à la
 * boucle d'IDEM) ; les retours passent par l'API iVision. Une fois écartée, elle disparaît.
 */
@Component({
  selector: 'iv-journey-next',
  imports: [JourneyCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <idem-journey-card class="mt-3 block" [recommendation]="recommendation()" [urls]="urls" from="ivision" [lang]="lang()" [client]="client" (dismissed)="dismissed.set(true)" />
    }
  `,
})
export class JourneyNext {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);

  readonly recommendation = input.required<Recommendation>();
  protected readonly dismissed = signal(false);
  protected readonly lang = () => this.translate.currentLang || 'fr';
  protected readonly urls: JourneyUrls = { dashboard: environment.services.dashboard.url, icode: environment.services.icode.url };

  /** Seuls les retours passent ici : la recommandation, elle, est déjà calculée par l'API. */
  protected readonly client: JourneyClient = {
    record: async () => [],
    next: async () => [],
    feedback: async (id, action) => {
      await firstValueFrom(this.api.journeyFeedback(id, action)).catch(() => undefined);
    },
  };
}
