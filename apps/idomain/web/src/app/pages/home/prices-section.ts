import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CatalogEntry } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * Les prix, et ce qui protège l'acheteur. Une grille par extension où le renouvellement est aussi
 * lisible que la première année (c'est lui que l'on paie ensuite chaque année), puis trois
 * garanties tenues par le code, sous le bouclier : protéger, c'est ce que dit l'objet.
 */
@Component({
  selector: 'idm-prices-section',
  imports: [TranslateModule, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h2 class="idm-section-title text-[var(--color-heading)]">
      <span class="block">{{ 'home.prices.title1' | translate }}</span>
      <span class="block"><span class="i-underline">{{ 'home.prices.title2' | translate }}</span></span>
    </h2>
    <p class="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.prices.lead' | translate }}</p>

    @if (catalog(); as rows) {
      @if (rows.length) {
        <div class="mt-10 overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--color-surface-1)]">
          <table class="w-full text-left">
            <caption class="sr-only">{{ 'home.prices.caption' | translate }}</caption>
            <thead>
              <tr class="text-xs text-[var(--color-text-secondary)]">
                <th scope="col" class="px-6 py-4 font-medium sm:px-8">{{ 'home.prices.extension' | translate }}</th>
                <th scope="col" class="px-4 py-4 font-medium">{{ 'home.prices.firstYear' | translate }}</th>
                <th scope="col" class="px-4 py-4 font-medium">{{ 'home.prices.renewal' | translate }}</th>
                <th scope="col" class="hidden px-4 py-4 sm:table-cell"><span class="sr-only">{{ 'home.prices.action' | translate }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.tld) {
                <tr class="border-t border-[var(--glass-border-subtle)]">
                  <th scope="row" class="px-6 py-5 text-2xl font-black sm:px-8 sm:text-3xl">.{{ row.tld }}</th>
                  <td class="px-4 py-5 text-lg font-semibold">{{ row.registerXaf | xaf }}</td>
                  <td class="px-4 py-5"><span class="text-lg font-semibold">{{ row.renewXaf | xaf }}</span><span class="ml-1 text-xs text-[var(--color-text-tertiary)]">{{ 'home.perYear' | translate }}</span></td>
                  <td class="hidden px-4 py-5 text-right sm:table-cell sm:pr-8">
                    <button type="button" class="outer-button button-sm" (click)="pick.emit(row.tld)">{{ 'home.prices.search' | translate: { tld: row.tld } }}</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="mt-8 text-sm text-[var(--color-text-secondary)]">{{ 'home.pricesUnavailable' | translate }}</p>
      }
    } @else {
      <div class="skeleton mt-10 h-48 rounded-3xl"></div>
    }

    <div class="mt-16 grid items-center gap-10 md:grid-cols-[200px_1fr]">
      <idm-illustration kind="shield" [width]="190" class="mx-auto" />
      <dl class="grid gap-8 sm:grid-cols-3">
        @for (g of guarantees; track g) {
          <div>
            <dt class="text-lg font-semibold">{{ ('home.guarantees.' + g + '.title') | translate }}</dt>
            <dd class="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ ('home.guarantees.' + g + '.body') | translate }}</dd>
          </div>
        }
      </dl>
    </div>
  `,
})
export class PricesSection {
  readonly catalog = input<CatalogEntry[] | null>(null);
  /** « Chercher en .africa » : l'extension est appliquée au champ du haut. */
  readonly pick = output<string>();
  protected readonly guarantees = ['price', 'refund', 'mail'];
}
