import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DemoScene, DemoSceneKind } from './demo-scene';

export const DEMO_SCENES: DemoSceneKind[] = ['hook', 'offer', 'date', 'brand'];

/**
 * La vidéo d'exemple lue dans un écran de maquette : les quatre plans empilés, le plan courant
 * entre par un balayage PAR-DESSUS le précédent (resté opaque) : pas de fondu boueux entre deux
 * aplats, et le fond de l'écran ne transparaît jamais. Toutes les maquettes reçoivent le même
 * `scene` : elles jouent la même vidéo, en même temps, chacune dans son format.
 */
@Component({
  selector: 'iv-scene-player',
  imports: [DemoScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (s of scenes; track s; let i = $index) {
      <iv-demo-scene
        class="layer"
        [class.is-current]="i === scene()"
        [class.is-entering]="i === scene() && previous() !== -1"
        [class.is-previous]="i === previous()"
        [scene]="s"
        [playing]="i === scene()"
      />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background: var(--color-primary-50);
    }
    .layer {
      position: absolute;
      inset: 0;
      opacity: 0;
    }
    .layer.is-previous {
      z-index: 1;
      opacity: 1;
    }
    .layer.is-current {
      z-index: 2;
      opacity: 1;
    }
    /* Pas au premier plan (rien dessous) : seulement quand un plan en remplace un autre. */
    .layer.is-entering {
      animation: wipe 0.6s var(--ease-fluid) both;
    }
    @keyframes wipe {
      from {
        clip-path: inset(0 100% 0 0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .layer.is-entering {
        animation: none;
      }
    }
  `,
})
export class ScenePlayer {
  protected readonly scenes = DEMO_SCENES;
  readonly scene = input(0);
  readonly previous = input(-1);
}
