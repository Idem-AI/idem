import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Wrap } from './wrap';
import { environment } from '../../../../environments/environment';

/** Le pied de page : IDEM, sa promesse, et les deux portes vers le reste d'IDEM. */
@Component({
  selector: 'iv-landing-footer',
  imports: [TranslateModule, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <footer ivWrap class="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--glass-border-subtle)] py-8 text-sm text-text-tertiary">
      <span>© {{ year }} IDEM · {{ 'landing.footer' | translate }}</span>
      <span class="flex gap-4">
        <a [href]="landingUrl" class="hover:text-text-primary">idem.africa</a>
        <a [href]="dashboardUrl" class="hover:text-text-primary">{{ 'landing.dashboard' | translate }}</a>
      </span>
    </footer>
  `,
})
export class LandingFooter {
  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly landingUrl = environment.services.landing.url;
  protected readonly year = new Date().getFullYear();
}
