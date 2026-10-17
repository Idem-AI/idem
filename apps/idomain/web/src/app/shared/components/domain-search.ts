import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Quote, SearchResult } from '../../core/models';
import { XafPipe } from '../xaf.pipe';

/**
 * Chercher un nom : le champ, puis le nom demandé, le même nom sur les autres extensions et,
 * s'il est pris, quelques variantes libres. Un prix par nom, le renouvellement juste à côté —
 * jamais de surprise l'année suivante. Utilisé à l'accueil et dans le parcours venu d'iDeploy.
 */
@Component({
  selector: 'idm-domain-search',
  imports: [NgTemplateOutlet, FormsModule, TranslateModule, IdemLoaderComponent, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-2 sm:flex-row" role="search" (ngSubmit)="search()">
      <label class="sr-only" for="domain-query">{{ 'search.label' | translate }}</label>
      <input id="domain-query" type="text" name="q" class="flex-1 !text-base" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="253"
        [placeholder]="'search.placeholder' | translate" [(ngModel)]="query" />
      <button type="submit" class="inner-button button-lg inline-flex items-center justify-center gap-2" [disabled]="loading() || !query.trim()">
        @if (loading()) { <idem-loader size="xs" /> } @else { <i class="pi pi-search" aria-hidden="true"></i> }
        {{ 'search.submit' | translate }}
      </button>
    </form>

    <div aria-live="polite">
      @if (error()) {
        <p class="mt-4 text-sm text-[var(--color-danger)]" role="alert">{{ error()! | translate }}</p>
      }
      @if (loading() && !result()) {
        <div class="mt-6 space-y-2">
          @for (i of [1, 2, 3]; track i) { <div class="skeleton h-16 rounded-xl"></div> }
        </div>
      }
      @if (result(); as r) {
        @if (r.exact; as exact) {
          <div class="glass-card mt-6 p-5">
            <ng-container *ngTemplateOutlet="row; context: { $implicit: exact, primary: true }" />
          </div>
        } @else {
          <p class="mt-6 text-sm text-[var(--color-text-secondary)]">{{ 'search.invalid' | translate }}</p>
        }
        @if (r.suggestions.length) {
          <h3 class="mt-6 text-sm font-medium text-[var(--color-text-secondary)]">{{ 'search.suggestions' | translate }}</h3>
          <ul class="glass-card mt-2 divide-y divide-[var(--glass-border-subtle)]">
            @for (q of r.suggestions; track q.domain) { <li class="px-5 py-4"><ng-container *ngTemplateOutlet="row; context: { $implicit: q }" /></li> }
          </ul>
        }
        @if (r.extensions.length) {
          <h3 class="mt-6 text-sm font-medium text-[var(--color-text-secondary)]">{{ 'search.otherExtensions' | translate }}</h3>
          <ul class="glass-card mt-2 divide-y divide-[var(--glass-border-subtle)]">
            @for (q of r.extensions; track q.domain) { <li class="px-5 py-4"><ng-container *ngTemplateOutlet="row; context: { $implicit: q }" /></li> }
          </ul>
        }
      }
    </div>

    <ng-template #row let-q let-primary="primary">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="min-w-0 flex-1">
          <p class="break-all font-semibold" [class.text-lg]="primary">{{ q.domain }}</p>
          <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {{ ('search.state.' + q.state) | translate }}
            @if (q.state === 'available' && q.renewalXaf) { · {{ 'search.renewal' | translate: { price: (q.renewalXaf | xaf) } }} }
            @if (q.promotion) { · {{ 'search.promotion' | translate }} }
          </p>
        </div>
        @if (q.state === 'available') {
          <p class="text-right">
            <span class="block font-semibold">{{ q.priceXaf | xaf }}</span>
            <span class="block text-xs text-[var(--color-text-tertiary)]">{{ 'search.firstYear' | translate }}</span>
          </p>
          <button type="button" class="inner-button button-sm" (click)="chosen.emit(q)">{{ 'search.choose' | translate }}</button>
        } @else if (q.state === 'taken' && allowConnect()) {
          <button type="button" class="outer-button button-sm" (click)="connectOwned.emit(q.domain)">{{ 'search.itsMine' | translate }}</button>
        }
      </div>
    </ng-template>
  `,
  host: { class: 'block' },
})
export class DomainSearch {
  private readonly api = inject(ApiService);
  /** Montrer « C'est le mien » sur un nom pris (le parcours de connexion d'une application). */
  readonly allowConnect = input(false);
  readonly initial = input<string>('');
  readonly chosen = output<Quote>();
  readonly connectOwned = output<string>();

  protected query = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<SearchResult | null>(null);
  private running?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.running?.unsubscribe());
    queueMicrotask(() => {
      if (this.initial()) {
        this.query = this.initial();
        this.search();
      }
    });
  }

  search(): void {
    const q = this.query.trim();
    if (!q) return;
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
