import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'sim-not-found',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="sim-main" class="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p class="font-mono text-meta tracking-widest text-ink-subtle">404</p>
      <h1 class="text-h1 font-semibold text-ink">{{ 'notFound.heading' | translate }}</h1>
      <p class="text-sm leading-relaxed text-ink-muted">{{ 'notFound.body' | translate }}</p>
      <a routerLink="/simulations" class="inner-button mt-2">
        {{ 'notFound.action' | translate }}
      </a>
    </main>
  `,
})
export class NotFound {}
