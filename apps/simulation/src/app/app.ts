import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ToastStack } from './shared/components/toast-stack/toast-stack';

@Component({
  selector: 'sim-root',
  imports: [RouterOutlet, ToastStack, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="sim-skip-link" href="#sim-main">{{ 'a11y.skipToContent' | translate }}</a>
    <router-outlet />
    <sim-toast-stack />
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
export class App {}
