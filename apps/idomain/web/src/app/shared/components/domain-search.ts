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
 * Lots enchaînés tout seuls après le premier, puis à chaque « Voir plus d'extensions ». Le
 * fournisseur limite ses requêtes : vérifier des centaines d'extensions à chaque frappe est impossible.
 */
const AUTO_PAGES = 1;
const PAGES_PER_CLICK = 2;
/** Noms montrés d'abord, puis à chaque « Voir plus d'extensions ». */
const VISIBLE_FIRST = 8;
const VISIBLE_STEP = 10;

/**
 * Chercher un nom, en direct. Pendant que le visiteur tape, le nom est essayé sur TOUT le
 * catalogue, lot par lot : chaque extension libre apparaît dès qu'elle est confirmée, sans qu'aucune
 * soit imposée. Une extension tapée passe en tête (avec des variantes si elle est prise) ; les
 * extensions mises en avant qui sont prises restent visibles, les autres prises sont tues. Entrée ou
 * le bouton relancent tout de suite. Les extensions mises en avant et leur prix sont sous le champ.
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

    @if (featured().length) {
      <ul class="mt-4 flex flex-wrap gap-2" [attr.aria-label]="'search.extensionsLabel' | translate">
        @for (c of featured(); track c.tld) {
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
      @if (result(); as r) {
        @if (!rows().length && !loading() && !progress()) {
          <p class="mt-6 text-sm text-[var(--color-text-secondary)]">{{ (r.exact || r.extensions.length ? 'search.noneFree' : 'search.invalid') | translate }}</p>
        }
      }
      @if (rows().length) {
        <ul id="domain-results" class="idm-results mt-6" [class.is-stale]="loading()" [attr.aria-label]="'search.resultsLabel' | translate" tabindex="0">
          @for (q of visibleRows(); track q.domain; let first = $first) {
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
      @if (rows().length && (hiddenRows() || paused() || progress())) {
        <div class="mt-4 flex flex-wrap items-center gap-3">
          @if (hiddenRows() || paused()) {
            <button type="button" class="outer-button button-sm" [disabled]="!hiddenRows() && !!progress()" (click)="showMore()">{{ 'search.loadMore' | translate }}</button>
          }
          @if (progress(); as p) {
            <span class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <idem-loader size="xs" />{{ 'search.checkingMore' | translate: { checked: p.checked, total: p.total } }}
            </span>
          } @else if (paused(); as p) {
            <span class="text-xs text-[var(--color-text-secondary)]">{{ 'search.remaining' | translate: { count: p.page.more.total - (p.page.more.nextOffset ?? 0) } }}</span>
          }
        </div>
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
    /* Hauteur bornée par l'écran, défilement interne : la page ne grandit pas avec la liste. */
    .idm-results {
      max-height: clamp(14rem, calc(100svh - 32rem), 30rem);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
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
  /** Les puces sous le champ : les extensions mises en avant seulement (le catalogue en compte des centaines). */
  protected readonly featured = computed(() => this.catalog().filter((c) => c.featured));
  readonly chosen = output<Quote>();
  readonly connectOwned = output<string>();
  /** Ce qui est tapé, à chaque frappe (l'illustration du hero l'inscrit sur sa plaque). */
  readonly queryChange = output<string>();

  protected query = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<SearchResult | null>(null);
  /** Les lots suivants du catalogue, ajoutés au fil de leur vérification. */
  private readonly more = signal<Quote[]>([]);
  /** Où en est la vérification du reste du catalogue (null : terminée ou pas commencée). */
  protected readonly progress = signal<{ checked: number; total: number } | null>(null);
  /** La suite du catalogue, en attente d'un « Voir plus d'extensions ». */
  protected readonly paused = signal<{ q: string; page: SearchResult } | null>(null);
  /** Numéro de la recherche en cours : un lot d'une recherche abandonnée est ignoré. */
  private generation = 0;
  /** Lots que la recherche peut encore enchaîner sans demander. */
  private budget = AUTO_PAGES;
  /** Combien de noms sont montrés (les autres attendent « Voir plus d'extensions »). */
  private readonly visible = signal(VISIBLE_FIRST);
  protected readonly visibleRows = computed(() => this.rows().slice(0, this.visible()));
  protected readonly hiddenRows = computed(() => Math.max(0, this.rows().length - this.visible()));
  private running?: Subscription;
  private pause?: ReturnType<typeof setTimeout>;

  /**
   * Une seule liste : le nom tapé avec son extension (s'il y en a une), puis tous les noms libres
   * dans l'ordre du catalogue, puis les extensions mises en avant qui sont prises. Les autres
   * extensions prises (des centaines) ne sont pas listées.
   */
  protected readonly rows = computed<Quote[]>(() => {
    const r = this.result();
    if (!r) return [];
    const featured = new Set(this.featured().map((c) => c.tld));
    const others = [...r.suggestions, ...r.extensions, ...this.more()].filter((q) => q.domain !== r.exact?.domain);
    const free = others.filter((q) => q.state === 'available');
    const rest = others.filter((q) => q.state !== 'available' && q.state !== 'not_sold' && featured.has(q.tld));
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
      this.stop();
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
    this.stop();
    const generation = ++this.generation;
    this.budget = AUTO_PAGES;
    this.visible.set(VISIBLE_FIRST);
    this.loading.set(true);
    this.error.set(null);
    this.running = this.api.search(q).subscribe({
      next: (r) => {
        this.result.set(r);
        this.more.set([]);
        this.loading.set(false);
        this.continueFrom(q, r, generation);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('search.error');
      },
    });
  }

  /** Le lot suivant du catalogue, puis le suivant, jusqu'au bout (ou jusqu'à une nouvelle saisie). */
  private continueFrom(q: string, r: SearchResult, generation: number): void {
    const offset = r.more?.nextOffset ?? null;
    if (offset === null || generation !== this.generation) {
      this.progress.set(null);
      return;
    }
    if (this.budget <= 0) {
      this.progress.set(null);
      this.paused.set({ q, page: r });
      return;
    }
    this.budget--;
    this.progress.set({ checked: offset, total: r.more.total });
    this.running = this.api.search(q, 1, offset).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;
        this.more.update((list) => [...list, ...page.extensions]);
        this.continueFrom(q, page, generation);
      },
      // Un lot qui échoue arrête la suite sans effacer ce qui est déjà montré.
      error: () => this.progress.set(null),
    });
  }

  /**
   * « Voir plus d'extensions » : dix noms de plus. Quand les noms déjà vérifiés ne suffisent plus,
   * les lots suivants du catalogue partent (jamais avant : le fournisseur limite ses requêtes).
   */
  protected showMore(): void {
    this.visible.update((n) => n + VISIBLE_STEP);
    if (this.rows().length < this.visible() + VISIBLE_STEP) this.loadMore();
  }

  private loadMore(): void {
    const p = this.paused();
    if (!p) return;
    this.paused.set(null);
    this.budget = PAGES_PER_CLICK;
    this.continueFrom(p.q, p.page, this.generation);
  }

  /** Abandonne la recherche en cours (premier lot comme lots suivants). */
  private stop(): void {
    clearTimeout(this.pause);
    this.generation++;
    this.running?.unsubscribe();
    this.loading.set(false);
    this.progress.set(null);
    this.paused.set(null);
  }
}
