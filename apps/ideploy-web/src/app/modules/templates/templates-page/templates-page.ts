import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';

/**
 * Service catalog — the "browse" page installed services on `/services` link
 * out to. Vercel-style card grid (logo + name + short description + category
 * tag); a card no longer deploys on click — it opens the template's own page
 * (`/templates/:name`), which carries the "Install" action and whatever else
 * is known about it.
 */
@Component({
  selector: 'app-templates-page',
  imports: [RouterLink, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">{{ 'templates.title' | translate }}</h1>
      <span class="text-sm" style="color:var(--color-text-secondary);">{{ filtered().length }} / {{ templates().length }}</span>
    </div>

    <div class="mb-6 flex flex-col gap-2 sm:flex-row">
      <input type="text"
        class="flex-1 !w-auto min-w-0"
        [placeholder]="'templates.searchPlaceholder' | translate"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
      />
      <select class="sm:w-56" [ngModel]="category()" (ngModelChange)="category.set($event)">
        <option value="">{{ 'templates.allCategories' | translate }}</option>
        @for (c of categories(); track c) {
          <option [value]="c">{{ c }}</option>
        }
      </select>
    </div>

    @if (error()) {
      <div class="mb-4 rounded-md p-3 text-sm" style="color:var(--color-danger);background:color-mix(in srgb, var(--color-danger) 8%, transparent);border:1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);">
        {{ error() }}
      </div>
    }

    @if (templates().length === 0) {
      <div class="glass-card p-4">{{ 'templates.noTemplates' | translate }}</div>
    } @else if (filtered().length === 0) {
      <div class="glass-card p-4" style="color: var(--color-text-secondary)">{{ 'templates.noMatch' | translate }}</div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (t of filtered(); track t.name) {
          <a class="glass-card p-4 flex flex-col transition-colors hover:border-[var(--color-primary-500)]" [routerLink]="['/templates', t.name]">
            <div class="mb-3 flex items-center gap-3">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style="background:var(--color-surface-2);">
                @if (serviceLogoUrl(t.logo); as logo) {
                  <img [src]="logo" class="h-7 w-7 object-contain" alt="" (error)="onLogoError($event)" />
                } @else {
                  <i class="pi pi-box" style="color:var(--color-primary-400);"></i>
                }
              </div>
              <div class="min-w-0">
                <div class="truncate font-semibold capitalize">{{ t.name }}</div>
                <span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
                  {{ t.category }}
                </span>
              </div>
            </div>
            <p class="flex-1 text-sm" style="color:var(--color-text-secondary);">{{ t.slogan }}</p>
          </a>
        }
      </div>
    }
  `,
})
export class TemplatesPageComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly serviceLogoUrl = serviceLogoUrl;

  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly query = signal('');
  protected readonly category = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly categories = computed(() =>
    [...new Set(this.templates().map((t) => t.category).filter(Boolean))].sort()
  );

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
      next: (t) => this.templates.set(t),
      error: () => this.error.set(null),
    });
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
