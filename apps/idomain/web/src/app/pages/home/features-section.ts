import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Illustration } from '../../shared/components/illustration';

/**
 * Ce qui vient avec un nom : ce qui est inclus (gratuit, pour tous) et ce qui se paie en plus.
 * Deux colonnes de nature différente, pas une grille de cartes identiques : une liste cochée d'un
 * côté, des options avec leur statut de l'autre. Ce qui n'est pas encore construit est marqué
 * « Bientôt » — on ne vend pas une promesse. La calebasse de cauris dit le prix : gratuit ou payant.
 */
@Component({
  selector: 'idm-features-section',
  imports: [TranslateModule, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
      <h2 class="idm-section-title text-[var(--color-heading)]">
        <span class="block">{{ 'home.features.title1' | translate }}</span>
        <span class="block"><span class="i-underline">{{ 'home.features.title2' | translate }}</span></span>
      </h2>
      <idm-illustration kind="cowries" [width]="170" class="hidden lg:block" />
    </div>

    <div class="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
      <!-- Inclus, pour chaque nom. -->
      <section class="rounded-3xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-6 sm:p-8">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-xl font-black">{{ 'home.features.included' | translate }}</h3>
          <span class="text-sm font-semibold" style="color: var(--color-success)">{{ 'home.features.free' | translate }}</span>
        </div>
        <ul class="mt-6 space-y-5">
          @for (f of included; track f) {
            <li class="flex gap-4">
              <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style="background: color-mix(in oklch, var(--color-success) 14%, transparent); color: var(--color-success)">
                <i class="pi pi-check text-[10px]" aria-hidden="true"></i>
              </span>
              <span>
                <span class="block font-semibold">{{ ('home.features.items.' + f + '.title') | translate }}</span>
                <span class="mt-0.5 block text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ ('home.features.items.' + f + '.body') | translate }}</span>
              </span>
            </li>
          }
        </ul>
      </section>

      <!-- En option. -->
      <section class="p-0 sm:p-2">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-xl font-black">{{ 'home.features.options' | translate }}</h3>
          <span class="text-sm text-[var(--color-text-secondary)]">{{ 'home.features.paid' | translate }}</span>
        </div>
        <ul class="mt-6 divide-y divide-[var(--glass-border-subtle)] border-y border-[var(--glass-border-subtle)]">
          @for (o of options; track o.key) {
            <li class="flex flex-wrap items-start gap-x-4 gap-y-1 py-5">
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{{ ('home.features.items.' + o.key + '.title') | translate }}</span>
                <span class="mt-0.5 block text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ ('home.features.items.' + o.key + '.body') | translate }}</span>
              </span>
              <span class="tag shrink-0">{{ ('home.features.status.' + o.status) | translate }}</span>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class FeaturesSection {
  /** Inclus avec chaque nom, sans supplément (tout est construit). */
  protected readonly included = ['dns', 'https', 'connect', 'mail', 'reminders', 'manage'];
  /** En plus, payant : « soon » tant que ce n'est pas livré, « request » pour l'accompagnement. */
  protected readonly options = [
    { key: 'email', status: 'soon' },
    { key: 'monitoring', status: 'soon' },
    { key: 'portfolio', status: 'soon' },
    { key: 'migration', status: 'request' },
  ];
}
