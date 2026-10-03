import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Illustration } from '../illustration/illustration';

/** Page introuvable : Sankofa, revenir sur ses pas. */
@Component({
  selector: 'sim-not-found',
  imports: [RouterLink, TranslatePipe, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="sim-main"
      class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <sim-illustration name="sankofa" class="w-44" />
      <h1 class="mt-2 text-2xl font-bold">{{ 'notFound.heading' | translate }}</h1>
      <p class="text-sm leading-relaxed text-text-secondary md:text-base">
        {{ 'notFound.body' | translate }}
      </p>
      <a routerLink="/simulations" class="inner-button mt-3">
        {{ 'notFound.action' | translate }}
      </a>
    </main>
  `,
})
export class NotFound {}
