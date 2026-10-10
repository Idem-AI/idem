import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DemoScene, DemoSceneKind } from './demo-scene';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

/**
 * « Montrez un modèle, il le reproduit » : le pochoir d'adire posé sur l'étoffe, et la preuve
 * plan par plan. En haut, le squelette du modèle (où vont les textes, comment ils bougent) ; en
 * bas, la vidéo obtenue : même découpage, mêmes mouvements, la marque du client.
 */
@Component({
  selector: 'iv-landing-stencil',
  imports: [TranslateModule, DemoScene, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="modele" ivWrap class="scroll-mt-20 py-20 lg:py-28">
      <div class="grid items-end gap-8 lg:grid-cols-12">
        <iv-display-title class="lg:col-span-8" [lines]="'landing.stencil.title' | translate" />
        <p class="text-lg text-text-secondary lg:col-span-4">{{ 'landing.stencil.text' | translate }}</p>
      </div>

      <div class="mt-16 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <iv-landing-art kind="stencil" ivInView class="mx-auto w-full max-w-xl text-text-primary lg:col-span-5" />

        <div class="compare lg:col-span-7" ivInView>
          <p class="label">{{ 'landing.stencil.model' | translate }}</p>
          <ol class="mt-3 grid grid-cols-4 gap-2 sm:gap-4">
            @for (s of scenes; track s; let i = $index) {
              <li>
                <iv-demo-scene class="aspect-[4/5] text-text-tertiary" [scene]="s" variant="stencil" />
                <p class="mt-2 text-xs text-text-tertiary">
                  <span class="font-semibold text-text-secondary">{{ 'landing.stencil.plan' | translate: { n: i + 1 } }}</span>
                  <span class="hidden sm:inline"> · </span>
                  <span class="block sm:inline">{{ 'landing.stencil.moves.' + s | translate }}</span>
                </p>
              </li>
            }
          </ol>

          <div class="my-5 grid grid-cols-4 gap-2 text-primary-500 sm:gap-4" aria-hidden="true">
            @for (s of scenes; track s) {
              <i class="pi pi-arrow-down justify-self-center"></i>
            }
          </div>

          <p class="label">{{ 'landing.stencil.yours' | translate }}</p>
          <ol class="mt-3 grid grid-cols-4 gap-2 sm:gap-4">
            @for (s of scenes; track s; let i = $index) {
              <li class="print" [style.--i]="i">
                <iv-demo-scene class="aspect-[4/5] rounded-md shadow-lg" [scene]="s" />
              </li>
            }
          </ol>
        </div>
      </div>
    </section>
  `,
  styles: `
    .label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      color: var(--color-text-tertiary);
    }
    /* Les plans de la vidéo s'impriment l'un après l'autre (visibles au repos). */
    .compare.is-drawn .print {
      animation: print-in 0.7s var(--ease-fluid) both;
      animation-delay: calc(0.5s + var(--i, 0) * 160ms);
    }
    @keyframes print-in {
      from {
        opacity: 0;
        transform: translateY(0.75rem);
      }
    }
  `,
})
export class LandingStencil {
  protected readonly scenes: DemoSceneKind[] = ['hook', 'offer', 'date', 'brand'];
}
