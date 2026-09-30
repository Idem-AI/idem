import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';

/**
 * Service catalog — the "browse" page installed services on `/services` link
 * out to. Vercel-style card grid (logo + name + short description + category
 * tag); a card no longer deploys on click — it opens the template's own page
 * (`/templates/:name`), which carries the "Install" action and whatever else
 * is known about it.
 */
@Component({
  selector: 'app-templates-page',
  imports: [RouterLink, FormsModule, TranslateModule, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'templates.title' | translate" [subtitle]="'templates.subtitle' | translate" [count]="loading() ? null : templates().length" />

    @if (loading()) {
      <div class="skeleton mb-6 h-11 rounded-xl" aria-hidden="true"></div>
      <app-list-skeleton variant="cards" [count]="6" />
    } @else if (templates().length === 0) {
      <div class="glass-card">
        <app-empty-state kind="market" [title]="'templates.noTemplates' | translate" [body]="error()" />
      </div>
    } @else {
      <div class="mb-6 space-y-3">
        <div class="relative">
          <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs" style="color:var(--color-text-tertiary);"></i>
          <input type="text" style="padding-left:36px;" [placeholder]="'templates.searchPlaceholder' | translate" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        </div>
        <div class="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" [attr.aria-label]="'templates.category' | translate">
          @for (c of chips(); track c.value) {
            <button
              type="button"
              role="radio"
              class="flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-smooth"
              [attr.aria-checked]="category() === c.value"
              [style.border-color]="category() === c.value ? 'var(--color-primary-500)' : 'var(--glass-border)'"
              [style.background]="category() === c.value ? 'var(--glass-bg-light)' : 'transparent'"
              [style.color]="category() === c.value ? 'var(--color-primary-500)' : 'var(--color-text-secondary)'"
              (click)="category.set(c.value)"
            >
              {{ c.value ? c.value : ('templates.allCategories' | translate) }}
              <span class="ml-1 font-normal" style="color:var(--color-text-tertiary);">{{ c.count }}</span>
            </button>
          }
        </div>
      </div>

      @if (filtered().length === 0) {
        <div class="glass-card"><app-empty-state kind="search" [title]="'templates.noMatch' | translate" /></div>
      } @else {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          @for (t of filtered(); track t.name) {
            <a class="glass-card group flex flex-col p-5 transition-smooth hover:border-[var(--color-primary-500)]" [routerLink]="['/templates', t.name]">
              <div class="mb-3 flex items-center gap-3">
                <span class="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style="background:var(--glass-bg-subtle);">
                  @if (serviceLogoUrl(t.logo); as logo) {
                    <img [src]="logo" class="h-7 w-7 object-contain" alt="" (error)="onLogoError($event)" />
                  } @else {
                    <i class="pi pi-box" style="color:var(--color-text-secondary);"></i>
                  }
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-semibold capitalize text-text-primary">{{ t.name }}</span>
                  <span class="block truncate text-[11px] uppercase tracking-wide" style="color:var(--color-text-tertiary);">{{ t.category }}</span>
                </span>
              </div>
              <p class="flex-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">{{ t.slogan }}</p>
              <span class="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold opacity-0 transition-smooth group-hover:opacity-100" style="color:var(--color-primary-500);">
                {{ 'templates.install' | translate }} <i class="pi pi-arrow-right text-[10px]"></i>
              </span>
            </a>
          }
        </div>
      }
    }
  `,
})
export class TemplatesPageComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  protected readonly serviceLogoUrl = serviceLogoUrl;

  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly query = signal('');
  protected readonly category = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  protected readonly categories = computed(() =>
    [...new Set(this.templates().map((t) => t.category).filter(Boolean))].sort()
  );

  /** "All" first, then each category with how many it holds — the count says where to look. */
  protected readonly chips = computed(() => [
    { value: '', count: this.templates().length },
    ...this.categories().map((c) => ({ value: c, count: this.templates().filter((t) => t.category === c).length })),
  ]);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.templates().filter((t) => {
      if (cat && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.slogan.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  });

  ngOnInit(): void {
    this.api.listServiceTemplates().subscribe({
      next: (t) => {
        this.templates.set(t);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? this.translate.instant('templates.loadError'));
        this.loading.set(false);
      },
    });
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
