import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Un téléphone dessiné au trait, comme les illustrations d'IDEM : le contour dans la couleur du
 * texte (il suit le thème), l'écran clair. Le contenu est projeté dans l'écran ; toutes les
 * tailles sont en unités du téléphone (`cqw`), il se dessine à n'importe quelle largeur.
 */
@Component({
  selector: 'iv-mockup-phone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="frame">
      <span class="key volume"></span>
      <span class="key power"></span>
      <div class="screen">
        <ng-content />
        <span class="island"></span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      aspect-ratio: 9 / 19;
      container-type: inline-size;
    }
    .frame {
      position: relative;
      height: 100%;
      padding: 3.2cqw;
      border: max(2px, 2.2cqw) solid var(--color-text-primary);
      border-radius: 16cqw;
      background: var(--color-bg-darker);
    }
    /* Les touches sur la tranche. */
    .key {
      position: absolute;
      width: 2cqw;
      border-radius: 1cqw;
      background: var(--color-text-primary);
    }
    .volume {
      top: 22%;
      left: -4.4cqw;
      height: 12%;
    }
    .power {
      top: 30%;
      right: -4.4cqw;
      height: 9%;
    }
    .screen {
      position: relative;
      height: 100%;
      overflow: hidden;
      border-radius: 11.5cqw;
      background: var(--color-primary-50);
    }
    .island {
      position: absolute;
      top: 3cqw;
      left: 50%;
      z-index: 5;
      width: 28cqw;
      height: 7.5cqw;
      translate: -50% 0;
      border-radius: 4cqw;
      background: var(--color-secondary-900);
    }
  `,
})
export class MockupPhone {}
