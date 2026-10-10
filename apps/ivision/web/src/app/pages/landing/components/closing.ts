import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

/** La fin : le compte et les crédits IDEM suffisent (calebasse de cauris), et les deux portes d'entrée. */
@Component({
  selector: 'iv-landing-closing',
  imports: [RouterLink, TranslateModule, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section ivWrap class="grid items-center gap-12 py-20 lg:grid-cols-12 lg:gap-10 lg:py-28">
      <div class="lg:col-span-7">
        <iv-display-title [lines]="'landing.closing.title' | translate" />
        <p class="mt-8 max-w-xl text-lg text-text-secondary">{{ 'landing.closing.text' | translate }}</p>
        <div class="mt-10 flex flex-wrap gap-3">
          <a class="inner-button button-lg" routerLink="/studio/video"><i class="pi pi-video" aria-hidden="true"></i> {{ 'landing.ctaVideo' | translate }}</a>
          <a class="outer-button button-lg" routerLink="/studio/image"><i class="pi pi-image" aria-hidden="true"></i> {{ 'landing.ctaImage' | translate }}</a>
        </div>
      </div>
      <iv-landing-art kind="cauris" ivInView class="mx-auto w-full max-w-md text-text-primary lg:col-span-5 lg:max-w-none" />
    </section>
  `,
})
export class LandingClosing {}
