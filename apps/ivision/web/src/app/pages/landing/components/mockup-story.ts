import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MockupPhone } from './mockup-phone';
import { DEMO_SCENES, ScenePlayer } from './scene-player';

/**
 * La vidéo en story (9:16), plein écran sur un téléphone : les barres de progression comptent
 * les plans (une barre par plan, celle du plan en cours se remplit), le compte de la marque en
 * haut, la réponse en bas.
 */
@Component({
  selector: 'iv-mockup-story',
  imports: [TranslateModule, MockupPhone, ScenePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '[class.is-paused]': 'paused()' },
  template: `
    <iv-mockup-phone>
      <div class="story">
        <iv-scene-player class="h-full" [scene]="scene()" [previous]="previous()" />
        <span class="shade top"></span>
        <span class="shade bottom"></span>
        <div class="bars">
          @for (s of scenes; track s; let i = $index) {
            <span class="bar">
              @if (i === scene()) {
                <span class="fill run"></span>
              } @else if (i < scene()) {
                <span class="fill"></span>
              }
            </span>
          }
        </div>
        <div class="who">
          <span class="avatar"><span>{{ 'landing.demo.monogram' | translate }}</span></span>
          <span>{{ 'landing.mockups.handle' | translate }}</span>
        </div>
        <div class="reply">
          <span class="pill">{{ 'landing.mockups.reply' | translate }}</span>
          <i class="pi pi-heart"></i>
          <i class="pi pi-send"></i>
        </div>
      </div>
    </iv-mockup-phone>
  `,
  styles: `
    .story {
      position: relative;
      height: 100%;
      color: var(--color-on-primary);
    }
    /* Voiles haut et bas : l'interface reste lisible sur les plans clairs. */
    .shade {
      position: absolute;
      right: 0;
      left: 0;
      z-index: 3;
      height: 20%;
      pointer-events: none;
    }
    .shade.top {
      top: 0;
      background: linear-gradient(color-mix(in oklch, var(--color-secondary-950) 38%, transparent), transparent);
    }
    .shade.bottom {
      bottom: 0;
      background: linear-gradient(transparent, color-mix(in oklch, var(--color-secondary-950) 32%, transparent));
    }
    .bars {
      position: absolute;
      top: 13cqw;
      right: 5cqw;
      left: 5cqw;
      z-index: 4;
      display: flex;
      gap: 1.6cqw;
    }
    .bar {
      position: relative;
      flex: 1;
      height: 1.3cqw;
      overflow: hidden;
      border-radius: 1cqw;
      background: color-mix(in oklch, var(--color-on-primary) 40%, transparent);
    }
    .fill {
      position: absolute;
      inset: 0;
      background: var(--color-on-primary);
      transform-origin: left;
    }
    .fill.run {
      animation: fill 2.25s linear both;
    }
    :host(.is-paused) .fill.run {
      animation-play-state: paused;
    }
    @keyframes fill {
      from {
        transform: scaleX(0);
      }
    }
    .who {
      position: absolute;
      top: 18cqw;
      left: 5cqw;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 2.4cqw;
      font-size: 4.6cqw;
      font-weight: 600;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 8.5cqw;
      height: 8.5cqw;
      border: 0.6cqw solid var(--color-on-primary);
      border-radius: 50%;
      background: var(--color-primary-500);
      font-size: 4.4cqw;
      font-weight: 900;
    }
    .reply {
      position: absolute;
      right: 5cqw;
      bottom: 6cqw;
      left: 5cqw;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 3cqw;
      font-size: 6cqw;
    }
    .pill {
      flex: 1;
      padding: 2.4cqw 3.6cqw;
      overflow: hidden;
      border: 0.5cqw solid color-mix(in oklch, var(--color-on-primary) 75%, transparent);
      border-radius: 10cqw;
      font-size: 4.2cqw;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    @media (prefers-reduced-motion: reduce) {
      .fill.run {
        animation: none;
      }
    }
  `,
})
export class MockupStory {
  protected readonly scenes = DEMO_SCENES;
  readonly scene = input(0);
  readonly previous = input(-1);
  readonly paused = input(false);
}
