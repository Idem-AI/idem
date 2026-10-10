import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

/**
 * « Votre site devient votre charte » : le tampon adinkra imprime la marque sur l'étoffe ; en
 * face, l'épreuve de ce qu'iVision a lu sur le site (couleurs, polices, logo, ton), posée comme
 * une planche d'imprimeur, avec ses repères de calage.
 */
@Component({
  selector: 'iv-landing-imprint',
  imports: [TranslateModule, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="site" ivWrap class="scroll-mt-20 py-20 lg:py-28">
      <div class="grid items-end gap-8 lg:grid-cols-12">
        <iv-display-title class="lg:col-span-8" [lines]="'landing.imprint.title' | translate" />
        <div class="lg:col-span-4">
          <p class="text-lg text-text-secondary">{{ 'landing.imprint.text' | translate }}</p>
          <p class="mt-4 text-sm text-text-tertiary">{{ 'landing.imprint.noSite' | translate }}</p>
        </div>
      </div>

      <div class="mt-16 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <iv-landing-art kind="stamp" ivInView class="mx-auto w-full max-w-xl text-text-primary lg:col-span-6" />

        <!-- L'épreuve. -->
        <figure class="sheet glass-card relative p-6 sm:p-8 lg:col-span-6" ivInView [attr.aria-label]="'landing.imprint.sheet' | translate">
          @for (corner of corners; track corner) {
            <svg class="mark" [class]="corner" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="5" />
              <path d="M10 0 V20 M0 10 H20" />
            </svg>
          }
          <figcaption class="flex flex-wrap items-center gap-3">
            <span class="tag"><i class="pi pi-globe" aria-hidden="true"></i> {{ 'landing.imprint.url' | translate }}</span>
            <span class="text-sm text-text-tertiary">{{ 'landing.imprint.sheet' | translate }}</span>
          </figcaption>

          <p class="label mt-7">{{ 'landing.imprint.colors' | translate }}</p>
          <div class="mt-3 grid grid-cols-4 gap-2">
            @for (swatch of swatches; track swatch; let i = $index) {
              <span class="ink h-20 rounded-md border border-[var(--glass-border)] sm:h-28" [style.background]="swatch" [style.--i]="i"></span>
            }
          </div>

          <div class="mt-7 grid gap-6 border-t border-[var(--glass-border-subtle)] pt-6 sm:grid-cols-2">
            <div>
              <p class="label">{{ 'landing.imprint.fonts' | translate }}</p>
              <div class="mt-3 flex items-end gap-6">
                <span class="ink" style="--i: 4">
                  <span class="block text-6xl font-black leading-none text-secondary-500 dark:text-text-primary">Aa</span>
                  <span class="mt-2 block text-xs text-text-tertiary">{{ 'landing.imprint.display' | translate }}</span>
                </span>
                <span class="ink" style="--i: 5">
                  <span class="block text-6xl font-light leading-none text-text-secondary">Aa</span>
                  <span class="mt-2 block text-xs text-text-tertiary">{{ 'landing.imprint.body' | translate }}</span>
                </span>
              </div>
            </div>
            <div>
              <p class="label">{{ 'landing.imprint.logo' | translate }}</p>
              <div class="ink mt-3 flex items-center gap-3" style="--i: 6">
                <span class="grid size-14 place-items-center rounded-full bg-primary-500 text-2xl font-black text-[var(--color-on-primary)]">{{ 'landing.demo.monogram' | translate }}</span>
                <span class="text-xl font-black text-secondary-500 dark:text-text-primary">{{ 'landing.demo.brand' | translate }}</span>
              </div>
            </div>
          </div>

          <div class="mt-6 border-t border-[var(--glass-border-subtle)] pt-6">
            <p class="label">{{ 'landing.imprint.tone' | translate }}</p>
            <p class="ink mt-2 text-lg font-semibold" style="--i: 7">{{ 'landing.imprint.toneWords' | translate }}</p>
          </div>
          <p class="mt-6 text-sm text-text-tertiary">{{ 'landing.imprint.others' | translate }}</p>
        </figure>
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
    /* Repères de calage aux quatre coins de l'épreuve. */
    .mark {
      position: absolute;
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: var(--color-text-tertiary);
      stroke-width: 1;
    }
    .tl {
      top: -0.625rem;
      left: -0.625rem;
    }
    .tr {
      top: -0.625rem;
      right: -0.625rem;
    }
    .bl {
      bottom: -0.625rem;
      left: -0.625rem;
    }
    .br {
      bottom: -0.625rem;
      right: -0.625rem;
    }
    .sheet:hover {
      transform: none;
    }
    /* L'encre se pose, élément après élément, quand l'épreuve arrive (visible au repos). */
    .sheet.is-drawn .ink {
      animation: ink-in 0.6s var(--ease-fluid) both;
      animation-delay: calc(0.3s + var(--i, 0) * 110ms);
    }
    @keyframes ink-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
  `,
})
export class LandingImprint {
  protected readonly corners = ['tl', 'tr', 'bl', 'br'];
  /** La palette lue sur le site : principale, titres, accent, fond. */
  protected readonly swatches = ['var(--color-primary-500)', 'var(--color-secondary-500)', 'var(--color-accent-300)', 'var(--color-primary-50)'];
}
