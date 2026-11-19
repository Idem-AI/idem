import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IdemUpdateBannerComponent } from '@idem/shared-offline/angular';

import { ToastStack } from './shared/components/toast-stack/toast-stack';

@Component({
  selector: 'sim-root',
  imports: [RouterOutlet, ToastStack, TranslatePipe, IdemUpdateBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="sim-skip-link" href="#sim-main">{{ 'a11y.skipToContent' | translate }}</a>
    <router-outlet />
    <sim-toast-stack />
    <idem-update-banner
      [label]="t.instant('appUpdate.message')"
      [actionLabel]="t.instant('appUpdate.reload')"
      [dismissLabel]="t.instant('appUpdate.later')"
    />
  `,
  styles: `
    .sim-skip-link {
      position: fixed;
      top: 0.5rem;
      left: 0.5rem;
      z-index: 100;
      padding: 0.5rem 0.875rem;
      border-radius: 0.5rem;
      background: var(--color-primary);
      color: var(--color-brand-ink);
      font-size: 0.875rem;
      font-weight: 600;
      transform: translateY(-200%);
      transition: transform 160ms var(--ease-out-quint);
    }

    .sim-skip-link:focus-visible {
      transform: none;
    }
  `,
})
export class App {
  protected readonly t = inject(TranslateService);
}
