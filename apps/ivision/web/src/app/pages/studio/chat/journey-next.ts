import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { journeyFloatFirstTime, type JourneyClient, type JourneyUrls, type Recommendation } from '@idem/shared-journey';
import { JourneyCardComponent, JourneyFloatComponent } from '@idem/shared-journey/angular';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';

/**
 * L'étape suivante sous un livrable (vidéo, visuel) d'une marque rattachée à un projet IDEM : créer son site,
 * sa charte, gérer sa communication… La recommandation arrive avec le message (l'API iVision la demande à la
 * boucle d'IDEM) ; les retours passent par l'API iVision. Une fois écartée, elle disparaît.
 *
 * Elle est AUSSI annoncée en haut au centre de l'écran (`idem-journey-float`), une fois par session, comme dans toutes
 * les applications d'IDEM ; celle du fil reste pour y revenir.
 */
@Component({
  selector: 'iv-journey-next',
  imports: [JourneyCardComponent, JourneyFloatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <idem-journey-card class="mt-3 block" [recommendation]="recommendation()" [urls]="urls" from="ivision" [lang]="lang()" [client]="client" (dismissed)="dismissed.set(true)" />
      @if (floating()) {
        <idem-journey-float [recommendation]="recommendation()" [urls]="urls" from="ivision" [lang]="lang()" [client]="client" [silent]="true" top="4.5rem" (dismissed)="dismissed.set(true)" />
      }
    }
  `,
})
export class JourneyNext implements OnInit {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);

  readonly recommendation = input.required<Recommendation>();
  protected readonly dismissed = signal(false);
  protected readonly floating = signal(false);
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

  ngOnInit(): void {
    this.floating.set(journeyFloatFirstTime(this.recommendation()));
  }
}
