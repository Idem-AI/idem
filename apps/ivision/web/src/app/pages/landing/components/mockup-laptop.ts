import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ScenePlayer } from './scene-player';

/**
 * La vidéo en paysage (16:9) sur un ordinateur, intégrée au site de la marque : un ordinateur
 * dessiné au trait (contour dans la couleur du texte), la barre du site, la vidéo et sa barre de
 * lecture qui avance plan par plan. Tailles en unités de l'ordinateur (`cqw`).
 */
@Component({
  selector: 'iv-mockup-laptop',
  imports: [TranslateModule, ScenePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.is-paused]': 'paused()' },
  template: `
    <div class="lid">
      <span class="camera"></span>
      <div class="screen">
        <div class="site">
          <span class="logo"><span>{{ 'landing.demo.monogram' | translate }}</span></span>
          <span class="brand">{{ 'landing.demo.brand' | translate }}</span>
          <span class="url">{{ 'landing.mockups.url' | translate }}</span>
          <span class="menu"><i></i><i></i><i></i></span>
        </div>
        <div class="video">
          <iv-scene-player class="h-full" [scene]="scene()" [previous]="previous()" />
          <div class="controls">
            <i class="pi" [class.pi-pause]="!paused()" [class.pi-play]="paused()"></i>
            <span class="track">
              @for (k of [scene()]; track k) {
                <span class="elapsed" [style.--from]="k / 4" [style.--to]="(k + 1) / 4"></span>
              }
            </span>
            <i class="pi pi-volume-up"></i>
          </div>
        </div>
      </div>
    </div>
    <div class="base"><span class="notch"></span></div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .lid {
      position: relative;
      padding: 2cqw;
      border: max(2px, 0.75cqw) solid var(--color-text-primary);
      border-bottom-width: max(2px, 1.1cqw);
      border-radius: 2.8cqw 2.8cqw 0.8cqw 0.8cqw;
      background: var(--color-bg-darker);
    }
    .camera {
      position: absolute;
      top: 0.65cqw;
      left: 50%;
      width: 0.8cqw;
      height: 0.8cqw;
      translate: -50% 0;
      border-radius: 50%;
      background: var(--color-text-primary);
    }
    .screen {
      overflow: hidden;
      border-radius: 0.8cqw;
      background: var(--color-primary-50);
      color: var(--color-secondary-500);
    }
    /* La barre du site de la marque. */
    .site {
      display: flex;
      align-items: center;
      gap: 1.2cqw;
      height: 5.6cqw;
      padding: 0 2cqw;
      font-size: 1.6cqw;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 2.6cqw;
      height: 2.6cqw;
      rotate: 45deg;
      border-radius: 0.5cqw;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
      font-size: 1.3cqw;
      font-weight: 900;
    }
    .logo > span {
      rotate: -45deg;
    }
    .brand {
      font-weight: 800;
    }
    .url {
      margin: 0 auto;
      padding: 0.5cqw 3cqw;
      border-radius: 2cqw;
      background: color-mix(in oklch, var(--color-secondary-500) 7%, transparent);
      font-size: 1.4cqw;
    }
    .menu {
      display: flex;
      flex-direction: column;
      gap: 0.4cqw;
    }
    .menu i {
      width: 2.2cqw;
      height: 0.3cqw;
      border-radius: 0.2cqw;
      background: currentColor;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
    }
    .controls {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 1.6cqw;
      padding: 2.4cqw 2.2cqw 1.4cqw;
      background: linear-gradient(transparent, color-mix(in oklch, var(--color-secondary-950) 30%, transparent));
      color: var(--color-on-primary);
      font-size: 1.9cqw;
    }
    .track {
      position: relative;
      flex: 1;
      height: 0.55cqw;
      overflow: hidden;
      border-radius: 0.3cqw;
      background: color-mix(in oklch, var(--color-on-primary) 35%, transparent);
    }
    .elapsed {
      position: absolute;
      inset: 0;
      background: var(--color-accent-300);
      transform-origin: left;
      animation: elapse 2.25s linear both;
    }
    :host(.is-paused) .elapsed {
      animation-play-state: paused;
    }
    @keyframes elapse {
      from {
        transform: scaleX(var(--from));
      }
      to {
        transform: scaleX(var(--to));
      }
    }
    /* Le socle, plus large que l'écran, et son encoche. */
    .base {
      position: relative;
      width: 112%;
      height: 2.4cqw;
      margin-left: -6%;
      border: max(2px, 0.75cqw) solid var(--color-text-primary);
      border-radius: 0.6cqw 0.6cqw 2.6cqw 2.6cqw;
      background: var(--color-bg-darker);
    }
    .notch {
      position: absolute;
      top: -0.1cqw;
      left: 50%;
      width: 14%;
      height: 0.9cqw;
      translate: -50% 0;
      border-radius: 0 0 0.8cqw 0.8cqw;
      background: var(--color-text-primary);
    }
    @media (prefers-reduced-motion: reduce) {
      .elapsed {
        animation: none;
        transform: scaleX(var(--to));
      }
    }
  `,
})
export class MockupLaptop {
  readonly scene = input(0);
  readonly previous = input(-1);
  readonly paused = input(false);
}
