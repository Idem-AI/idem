import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Display } from './display';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

/**
 * Les deux ateliers, en écran partagé sur toute la largeur : les visuels (bandes de kente, la
 * composition) d'un côté, les vidéos (kora, raconter en musique) de l'autre. Un mot géant par
 * moitié, ce qu'on y obtient, et la porte d'entrée.
 */
@Component({
  selector: 'iv-landing-workshops',
  imports: [RouterLink, TranslateModule, Display, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="ateliers" class="scroll-mt-20 border-y border-[var(--glass-border)]">
      <div ivWrap class="pt-20 lg:pt-28">
        <iv-display-title [lines]="'landing.workshops.title' | translate" />
        <p class="mt-8 max-w-2xl text-lg text-text-secondary">{{ 'landing.workshops.text' | translate }}</p>
      </div>

      <div class="mt-16 grid border-t border-[var(--glass-border)] md:grid-cols-2">
        <div class="flex flex-col border-[var(--glass-border)] px-5 py-14 sm:px-10 md:border-r lg:px-16 lg:py-20">
          <h3 ivDisplay="word">{{ 'landing.workshops.image.name' | translate }}</h3>
          <iv-landing-art kind="kente" ivInView class="my-12 h-80 text-text-primary sm:h-[28rem]" />
          <ul class="flex flex-wrap gap-2">
            @for (f of imageFormats; track f) {
              <li class="tag">{{ 'formats.' + f | translate }}</li>
            }
          </ul>
          <p class="mt-6 max-w-md text-lg text-text-secondary">{{ 'landing.workshops.image.text' | translate }}</p>
          <a class="outer-button button-lg mt-10 self-start" routerLink="/studio/image">
            <i class="pi pi-image" aria-hidden="true"></i> {{ 'landing.ctaImage' | translate }}
          </a>
        </div>

        <div class="flex flex-col border-t border-[var(--glass-border)] px-5 py-14 sm:px-10 md:border-t-0 lg:px-16 lg:py-20">
          <h3 ivDisplay="word">{{ 'landing.workshops.video.name' | translate }}</h3>
          <iv-landing-art kind="kora" ivInView class="my-12 h-80 text-text-primary sm:h-[28rem]" />
          <ul class="flex flex-wrap gap-2">
            <li class="tag">{{ 'landing.workshops.video.duration' | translate }}</li>
            @for (f of videoFormats; track f) {
              <li class="tag">{{ 'formats.' + f | translate }}</li>
            }
            @for (m of moods; track m) {
              <li class="tag"><i class="pi pi-wave-pulse" aria-hidden="true"></i> {{ 'moods.' + m | translate }}</li>
            }
          </ul>
          <p class="mt-6 max-w-md text-lg text-text-secondary">{{ 'landing.workshops.video.text' | translate }}</p>
          <a class="inner-button button-lg mt-10 self-start" routerLink="/studio/video">
            <i class="pi pi-video" aria-hidden="true"></i> {{ 'landing.ctaVideo' | translate }}
          </a>
        </div>
      </div>
    </section>
  `,
})
export class LandingWorkshops {
  protected readonly imageFormats = ['post', 'story', 'banner', 'a4'];
  protected readonly videoFormats = ['story', 'square', 'portrait', 'landscape'];
  protected readonly moods = ['afro', 'epic', 'calm'];
}
