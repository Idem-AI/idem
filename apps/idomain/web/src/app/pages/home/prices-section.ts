import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CatalogEntry } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * Les prix, et ce qui protège l'acheteur. Une grille par extension où le renouvellement est aussi
 * lisible que la première année (c'est lui que l'on paie ensuite chaque année), puis trois
 * garanties tenues par le code, sous le bouclier : protéger, c'est ce que dit l'objet.
 */
/** Extensions du catalogue affichées d'abord, puis à chaque « Afficher plus » (×2). */
const PAGE = 24;

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

    @if (featured(); as rows) {
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
        @if (others().length) {
          <div class="mt-14">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-[var(--color-heading)]">{{ 'home.prices.allTitle' | translate }}</h3>
                <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'home.prices.allCount' | translate: { count: others().length } }}</p>
              </div>
              <div class="w-full sm:w-72">
                <label for="tld-filter" class="sr-only">{{ 'home.prices.filterLabel' | translate }}</label>
                <input #filterField id="tld-filter" type="search" autocomplete="off" autocapitalize="none" spellcheck="false"
                  [placeholder]="'home.prices.filterPlaceholder' | translate" [value]="filter()" (input)="setFilter(filterField.value)" />
              </div>
            </div>
            @if (shown().length) {
              <ul class="idm-tld-grid mt-6">
                @for (row of shown(); track row.tld) {
                  <li>
                    <button type="button" class="idm-tld" (click)="pick.emit(row.tld)" [attr.aria-label]="'home.prices.search' | translate: { tld: row.tld }">
                      <span class="min-w-0 truncate text-lg font-bold">.{{ row.tld }}</span>
                      <span class="shrink-0 text-right">
                        <span class="block font-semibold">{{ row.registerXaf | xaf }}</span>
                        @if (row.renewXaf && row.renewXaf !== row.registerXaf) {
                          <span class="block text-xs text-[var(--color-text-tertiary)]">{{ 'home.prices.thenPerYear' | translate: { price: (row.renewXaf | xaf) } }}</span>
                        } @else {
                          <span class="block text-xs text-[var(--color-text-tertiary)]">{{ 'home.perYear' | translate }}</span>
                        }
                      </span>
                    </button>
                  </li>
                }
              </ul>
              @if (matches().length > shown().length) {
                <div class="mt-6 flex justify-center">
                  <button type="button" class="outer-button button-sm" (click)="showMore()">
                    {{ 'home.prices.showMore' | translate: { count: matches().length - shown().length } }}
                  </button>
                </div>
              }
            } @else {
              <p class="mt-6 text-sm text-[var(--color-text-secondary)]">{{ 'home.prices.noMatch' | translate }}</p>
            }
          </div>
        }
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
  styles: `
    .idm-tld-grid {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    }
    .idm-tld {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border: 1px solid var(--glass-border-subtle);
      border-radius: 1rem;
      background: var(--color-surface-1);
      padding: 0.875rem 1.125rem;
      text-align: left;
      transition: border-color 160ms ease-out;
    }
    .idm-tld:hover,
    .idm-tld:focus-visible { border-color: var(--color-primary-500); }
  `,
})
export class PricesSection {
  readonly catalog = input<CatalogEntry[] | null>(null);
  /** La grille : les extensions mises en avant ; les autres sont comptées sous elle. */
  protected readonly featured = computed(() => this.catalog()?.filter((c) => c.featured) ?? null);
  /** Tout le reste du catalogue, par ordre alphabétique : prix lus en base, aucune vérification en direct. */
  protected readonly others = computed(() => (this.catalog() ?? []).filter((c) => !c.featured).sort((a, b) => a.tld.localeCompare(b.tld)));
  protected readonly filter = signal('');
  private readonly limit = signal(PAGE);
  protected readonly matches = computed(() => {
    const f = this.filter().trim().toLowerCase().replace(/^\.+/, '');
    return f ? this.others().filter((c) => c.tld.includes(f)) : this.others();
  });
  protected readonly shown = computed(() => this.matches().slice(0, this.limit()));

  protected setFilter(value: string): void {
    this.filter.set(value);
    this.limit.set(PAGE);
  }

  protected showMore(): void {
    this.limit.update((n) => n + PAGE * 2);
  }
  /** « Chercher en .com » : l'extension est appliquée au champ du haut. */
  readonly pick = output<string>();
  protected readonly guarantees = ['price', 'refund', 'mail'];
}
