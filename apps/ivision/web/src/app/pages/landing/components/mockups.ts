import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MockupFeed } from './mockup-feed';
import { MockupLaptop } from './mockup-laptop';
import { MockupStory } from './mockup-story';
import { DEMO_SCENES } from './scene-player';

/** Durée d'un plan : 4 plans = une vidéo de 9 secondes. */
const SCENE_MS = 2250;

/**
 * Les écrans du hero : la même vidéo, jouée en même temps sur un ordinateur (paysage, sur le site
 * de la marque), en story (9:16) et en publication (4:5). Une demande, tous les formats. La
 * composition se met à l'échelle de sa largeur (`cqw`) ; elle est à l'arrêt si le visiteur réduit
 * les animations, et une pause discrète reste disponible (WCAG 2.2.2).
 */
@Component({
  selector: 'iv-mockups',
  imports: [TranslateModule, MockupFeed, MockupLaptop, MockupStory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="stage" [attr.aria-label]="'landing.mockups.label' | translate">
      <iv-mockup-laptop class="laptop" [scene]="scene()" [previous]="previous()" [paused]="!playing()" />
      <iv-mockup-feed class="feed" [scene]="scene()" [previous]="previous()" />
      <iv-mockup-story class="story" [scene]="scene()" [previous]="previous()" [paused]="!playing()" />
      <button type="button" class="button-icon toggle" (click)="toggle()" [attr.aria-label]="(playing() ? 'landing.mockups.pause' : 'landing.mockups.play') | translate">
        <i class="pi" [class.pi-pause]="playing()" [class.pi-play]="!playing()" aria-hidden="true"></i>
      </button>
    </figure>
  `,
  styles: `
    .stage {
      position: relative;
      aspect-ratio: 10 / 8.8;
      container-type: inline-size;
      margin: 0;
    }
    .laptop {
      position: absolute;
      top: 0;
      left: 8cqw;
      width: 84cqw;
    }
    .feed {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 21cqw;
    }
    .story {
      position: absolute;
      right: 0;
      bottom: 3cqw;
      width: 21cqw;
    }
    /* La pause, sous l'ordinateur, entre les deux téléphones. */
    .toggle {
      position: absolute;
      bottom: 5cqw;
      left: 50%;
      translate: -50% 0;
    }
  `,
})
export class Mockups {
  protected readonly scene = signal(0);
  /** Le plan d'avant, gardé sous le nouveau pendant son balayage. */
  protected readonly previous = signal(-1);
  protected readonly playing = signal(true);

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.playing.set(false);
      else this.start();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected toggle(): void {
    this.playing.update((p) => !p);
    if (this.playing()) this.start();
    else this.stop();
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => {
      this.previous.set(this.scene());
      this.scene.update((s) => (s + 1) % DEMO_SCENES.length);
    }, SCENE_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
