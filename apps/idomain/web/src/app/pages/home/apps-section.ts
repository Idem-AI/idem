import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { Illustration } from '../../shared/components/illustration';

/**
 * Pour qui est déjà en ligne avec IDEM : le même achat se fait dans iDeploy et dans iCode, sans
 * quitter l'application. La pirogue dit la mise en ligne.
 */
@Component({
  selector: 'idm-apps-section',
  imports: [TranslateModule, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid items-center gap-12 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-20">
      <!-- La pirogue à la proue dressée : la mise en ligne, depuis l'application où l'on est déjà. -->
      <idm-illustration kind="pirogue" [width]="420" class="order-2 mx-auto w-full max-w-md lg:order-1" />

      <div class="order-1 lg:order-2">
        <h2 class="idm-section-title text-[var(--color-heading)]">
          <span class="block">{{ 'home.apps.title1' | translate }}</span>
          <span class="block"><span class="i-underline">{{ 'home.apps.title2' | translate }}</span></span>
        </h2>
        <p class="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.apps.lead' | translate }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a class="outer-button" [href]="ideployUrl">{{ 'home.apps.ideploy' | translate }}</a>
        </div>
      </div>
    </div>
  `,
})
export class AppsSection {
  protected readonly ideployUrl = environment.services.ideploy.url;
}
