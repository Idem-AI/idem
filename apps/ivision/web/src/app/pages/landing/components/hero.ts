import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Display } from './display';
import { Mockups } from './mockups';
import { LandingRequest } from './request';
import { Wrap } from './wrap';

/**
 * L'ouverture, en deux temps. « Dites-le. » : la demande, écrite comme dans l'atelier.
 * « Voyez-le. » : la vidéo qu'elle donne, jouée en même temps sur un ordinateur, en story et en
 * publication. Sur grand écran, les deux mots forment une seule ligne au-dessus de leur colonne ;
 * sur téléphone, le titre, le texte et les boutons viennent d'abord, la démonstration ensuite.
 * Le titre lu par les lecteurs d'écran est le `h1` masqué ; les deux mots visibles sont décoratifs.
 * Sur bureau, le hero occupe au moins toute la hauteur de l'écran sous l'en-tête (4,5 rem, voir
 * `landing-header.ts`) et son contenu y est centré verticalement ; s'il est plus haut, il grandit.
 */
@Component({
  selector: 'iv-landing-hero',
  imports: [RouterLink, TranslateModule, Display, Mockups, LandingRequest, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section ivWrap class="pb-20 pt-6 sm:pt-10 lg:flex lg:min-h-[calc(100svh_-_4.5rem)] lg:flex-col lg:justify-center lg:py-12">
      <h1 class="sr-only">{{ 'landing.hero.title' | translate }}</h1>
      <div class="grid grid-cols-1 gap-y-8 lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:gap-x-24 lg:gap-y-10 3xl:gap-x-32">
        <span ivDisplay="hero" class="order-1 whitespace-nowrap text-heading lg:col-start-1 lg:row-start-1" aria-hidden="true">{{ 'landing.hero.say' | translate }}</span>
        <span ivDisplay="hero" class="order-2 -mt-6 whitespace-nowrap text-heading lg:col-start-2 lg:row-start-1 lg:mt-0" aria-hidden="true">
          <span class="i-underline">{{ 'landing.hero.see' | translate }}</span>
        </span>

        <div class="order-3 lg:col-start-1 lg:row-start-3">
          <p class="max-w-xl text-lg text-text-secondary sm:text-xl 3xl:max-w-2xl 3xl:text-2xl">{{ 'landing.hero.lead' | translate }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a class="inner-button button-lg" routerLink="/studio/video"><i class="pi pi-video" aria-hidden="true"></i> {{ 'landing.ctaVideo' | translate }}</a>
            <a class="outer-button button-lg" routerLink="/studio/image"><i class="pi pi-image" aria-hidden="true"></i> {{ 'landing.ctaImage' | translate }}</a>
          </div>
        </div>

        <iv-request class="order-4 mt-6 lg:col-start-1 lg:row-start-2 lg:mt-0" />
        <span class="order-5 justify-self-center text-xl text-primary-500 lg:hidden" aria-hidden="true"><i class="pi pi-arrow-down"></i></span>
        <iv-mockups class="order-6 mx-auto w-full max-w-xl lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:max-w-none" />
      </div>
    </section>
  `,
})
export class LandingHero {}
