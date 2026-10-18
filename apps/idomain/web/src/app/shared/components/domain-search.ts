import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CatalogEntry, Quote, SearchResult } from '../../core/models';
import { XafPipe } from '../xaf.pipe';

/** Pause de frappe avant de vérifier (assez courte pour paraître instantané, assez longue pour ne pas interroger à chaque lettre). */
const TYPING_PAUSE_MS = 450;

/**
 * Chercher un nom, en direct. Pendant que le visiteur tape, les noms possibles apparaissent
 * déjà : celui qu'il écrit d'abord, puis les variantes et autres extensions libres, puis celles qui
 * sont prises — chacune avec un état franc (disponible / pris), son prix et une action. Entrée ou
 * le bouton relancent tout de suite. Les extensions en vente et leur prix sont sous le champ.
 */
@Component({
  selector: 'idm-domain-search',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <form role="search" class="idm-composer" (ngSubmit)="search()">
      <label class="sr-only" for="domain-query">{{ 'search.label' | translate }}</label>
      <span class="hidden shrink-0 select-none pl-5 text-lg text-[var(--color-text-tertiary)] sm:inline" aria-hidden="true">www.</span>
      <input #field id="domain-query" type="text" name="q" class="idm-composer-input" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="253"
        role="combobox" aria-autocomplete="list" aria-controls="domain-results" [attr.aria-expanded]="rows().length > 0"
        [placeholder]="'search.placeholder' | translate" [(ngModel)]="query" (ngModelChange)="onType($event)" />
      @if (loading()) { <idem-loader size="xs" class="shrink-0" [label]="'search.checking' | translate" /> }
      <button type="submit" class="inner-button button-lg m-1.5 shrink-0">
        <i class="pi pi-search" aria-hidden="true"></i>
        <span class="hidden sm:inline">{{ 'search.submit' | translate }}</span>
      </button>
    </form>

    @if (catalog().length) {
      <ul class="mt-4 flex flex-wrap gap-2" [attr.aria-label]="'search.extensionsLabel' | translate">
        @for (c of catalog(); track c.tld) {
          <li>
            <button type="button" class="idm-chip" (click)="pickTld(c.tld)">
              <span class="font-semibold">.{{ c.tld }}</span>
              <span class="text-[var(--color-text-secondary)]">{{ c.registerXaf | xaf }}</span>
            </button>
          </li>
        }
      </ul>
    }

    <div aria-live="polite">
      @if (error()) {
        <p class="mt-6 text-sm text-[var(--color-danger)]" role="alert">{{ error()! | translate }}</p>
      }
      @if (loading() && !rows().length) {
        <div class="mt-6 space-y-2">
          <div class="skeleton h-20 rounded-2xl"></div>
          <div class="skeleton h-14 rounded-xl"></div>
          <div class="skeleton h-14 rounded-xl"></div>
        </div>
      }
      @if (result() && !rows().length && !loading()) {
        <p class="mt-6 text-sm text-[var(--color-text-secondary)]">{{ 'search.invalid' | translate }}</p>
      }
      @if (rows().length) {
        <ul id="domain-results" class="idm-results mt-6" [class.is-stale]="loading()" [attr.aria-label]="'search.resultsLabel' | translate">
          @for (q of rows(); track q.domain; let first = $first) {
            <li class="idm-row" [class.is-exact]="first && isExact(q)" [class.is-free]="q.state === 'available'">
              <div class="min-w-0" [class]="first && isExact(q) ? 'min-w-0 basis-full' : 'min-w-0 flex-1'">
                <p class="break-all" [class]="first && isExact(q) ? 'text-2xl font-black sm:text-3xl' : 'font-semibold'">
                  <span>{{ label(q) }}</span><span class="text-[var(--color-text-secondary)]">.{{ q.tld }}</span>
                </p>
                @if (q.state === 'available' && q.renewalXaf) {
                  <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{{ 'search.renewal' | translate: { price: (q.renewalXaf | xaf) } }}@if (q.promotion) { · {{ 'search.promotion' | translate }} }</p>
                }
              </div>
              <span class="idm-badge" [class.is-free]="q.state === 'available'" [class.mr-auto]="first && isExact(q)">
                <span class="idm-badge-dot" aria-hidden="true"></span>
                {{ ('search.state.' + q.state) | translate }}
              </span>
              @if (q.state === 'available') {
                <span class="w-24 shrink-0 text-right font-bold">{{ q.priceXaf | xaf }}</span>
                <button type="button" class="shrink-0" [class]="first && isExact(q) ? 'inner-button' : 'outer-button button-sm'" (click)="chosen.emit(q)">{{ 'search.take' | translate }}</button>
              } @else if (q.state === 'taken' && allowConnect()) {
                <button type="button" class="button-ghost button-sm shrink-0" (click)="connectOwned.emit(q.domain)">{{ 'search.itsMine' | translate }}</button>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .idm-composer {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      border: 1.5px solid var(--glass-border);
      border-radius: 1.25rem;
      background: var(--color-surface-1);
      box-shadow: 0 24px 60px -32px color-mix(in oklch, var(--color-primary-500) 45%, transparent);
      transition: border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .idm-composer:focus-within {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-primary-500) 16%, transparent), 0 24px 60px -32px color-mix(in oklch, var(--color-primary-500) 45%, transparent);
    }
    /* Le champ natif est stylé par le design system : ici il s'efface dans le composeur. */
    .idm-composer-input.idm-composer-input {
      min-width: 0;
      flex: 1;
      border: 0;
      background: transparent;
      box-shadow: none;
      padding: 1.125rem 1rem 1.125rem 1.25rem;
      font-size: 1.125rem;
      outline: none;
    }
    @media (min-width: 640px) {
      .idm-composer-input.idm-composer-input { padding-left: 0.125rem; }
    }
    .idm-chip {
      display: inline-flex;
      align-items: baseline;
      gap: 0.5rem;
      border: 1px solid var(--glass-border-subtle);
      border-radius: 999px;
      background: var(--color-surface-1);
      padding: 0.375rem 0.875rem;
      font-size: 0.875rem;
      transition: border-color 160ms ease-out;
    }
    .idm-chip:hover,
    .idm-chip:focus-visible { border-color: var(--color-primary-500); }
    .idm-results {
      overflow: hidden;
      border: 1px solid var(--glass-border);
      border-radius: 1.25rem;
      background: var(--color-surface-1);
      transition: opacity 160ms ease-out;
    }
    .idm-results.is-stale { opacity: 0.6; }
    .idm-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      padding: 0.875rem 1.25rem;
      animation: idm-row-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .idm-row + .idm-row { border-top: 1px solid var(--glass-border-subtle); }
    .idm-row.is-exact { padding-block: 1.25rem; }
    .idm-row.is-exact.is-free { background: color-mix(in oklch, var(--color-success) 7%, transparent); }
    .idm-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      flex-shrink: 0;
      border-radius: 999px;
      padding: 0.25rem 0.625rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      background: var(--color-surface-2);
    }
    .idm-badge.is-free {
      color: var(--color-success);
      background: color-mix(in oklch, var(--color-success) 12%, transparent);
    }
    .idm-badge-dot { height: 0.4rem; width: 0.4rem; border-radius: 999px; background: currentColor; }
    @keyframes idm-row-in { from { opacity: 0; transform: translateY(4px); } }
    @media (prefers-reduced-motion: reduce) {
      .idm-row { animation: none; }
    }
  `,
})
export class DomainSearch {
  private readonly api = inject(ApiService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  /** Montrer « C'est le mien » sur un nom pris (parcours de connexion d'une application). */
  readonly allowConnect = input(false);
  readonly initial = input<string>('');
  /** Les extensions en vente (prix affichés sous le champ, sans appel réseau). */
  readonly catalog = input<CatalogEntry[]>([]);
  readonly chosen = output<Quote>();
  readonly connectOwned = output<string>();
  /** Ce qui est tapé, à chaque frappe (l'illustration du hero l'inscrit sur sa plaque). */
  readonly queryChange = output<string>();

  protected query = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<SearchResult | null>(null);
  private running?: Subscription;
  private pause?: ReturnType<typeof setTimeout>;

  /** Une seule liste : le nom demandé, puis les noms libres, puis ceux qui sont pris. */
  protected readonly rows = computed<Quote[]>(() => {
    const r = this.result();
    if (!r) return [];
    const others = [...r.suggestions, ...r.extensions].filter((q) => q.domain !== r.exact?.domain);
    const free = others.filter((q) => q.state === 'available');
    const rest = others.filter((q) => q.state !== 'available' && q.state !== 'not_sold');
    return [...(r.exact ? [r.exact] : []), ...free, ...rest];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.running?.unsubscribe();
      clearTimeout(this.pause);
    });
    queueMicrotask(() => {
      if (this.initial()) this.searchFor(this.initial());
    });
  }

  protected isExact(q: Quote): boolean {
    return this.result()?.exact?.domain === q.domain;
  }

  protected label(q: Quote): string {
    return q.domain.slice(0, q.domain.length - q.tld.length - 1);
  }

  /** À chaque frappe : l'illustration suit, et la vérification part après une courte pause. */
  protected onType(value: string): void {
    this.queryChange.emit(value);
    clearTimeout(this.pause);
    const label = value.trim().replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split('.')[0];
    if (label.length < 2) {
      this.running?.unsubscribe();
      this.loading.set(false);
      if (!value.trim()) this.result.set(null);
      return;
    }
    this.pause = setTimeout(() => this.search(), TYPING_PAUSE_MS);
  }

  /** Mettre le curseur dans le champ (bouton « Chercher mon nom » plus bas dans la page). */
  focus(): void {
    this.field()?.nativeElement.focus({ preventScroll: true });
  }

  /** Chercher un nom précis (depuis un autre endroit de la page). */
  searchFor(q: string): void {
    this.query = q;
    this.queryChange.emit(q);
    this.search();
  }

  /** Une puce d'extension : le nom tapé, sur cette extension. */
  protected pickTld(tld: string): void {
    const label = this.query.trim().replace(/^www\./, '').split('.')[0] || '';
    if (!label) {
      this.focus();
      return;
    }
    this.searchFor(`${label}.${tld}`);
  }

  search(): void {
    const q = this.query.trim();
    if (!q) {
      this.focus();
      return;
    }
    clearTimeout(this.pause);
    this.running?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.running = this.api.search(q).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('search.error');
      },
    });
  }
}
