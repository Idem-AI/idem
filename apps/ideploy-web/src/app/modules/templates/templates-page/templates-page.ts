import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ServiceTemplate } from '../../../shared/models/ideploy.models';

/**
 * One-click templates browser — Angular port of the Laravel one-click services
 * grid. Lists every template from service-templates.json with search; deploying
 * goes through /quick-deploy (auto project/server/destination).
 */
@Component({
  selector: 'app-templates-page',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">{{ 'templates.title' | translate }}</h1>
      <span class="text-sm" style="color:var(--color-text-secondary);">{{ filtered().length }} / {{ templates().length }}</span>
    </div>

    <input class="input mb-6" [placeholder]="'templates.searchPlaceholder' | translate"
           [ngModel]="query()" (ngModelChange)="query.set($event)" />

    @if (error()) {
      <div class="mb-4 rounded-md p-3 text-sm" style="color:var(--color-danger);background:color-mix(in srgb, var(--color-danger) 8%, transparent);border:1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);">
        {{ error() }}
        @if (error()!.toLowerCase().includes('server')) {
          · <a href="/servers/new" style="color:var(--color-primary-400);">{{ 'templates.addServer' | translate }}</a>
        }
      </div>
    }

    @if (templates().length === 0) {
      <div class="box">{{ 'templates.noTemplates' | translate }}</div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (t of filtered(); track t.name) {
          <div class="box flex flex-col">
            <div class="mb-3 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                <i class="fa-solid fa-cube" style="color:var(--color-primary-400);"></i>
              </div>
              <div class="min-w-0">
                <div class="truncate font-semibold capitalize">{{ t.name }}</div>
                <div class="text-xs" style="color:var(--color-text-tertiary);">{{ t.category }}</div>
              </div>
            </div>
            <p class="mb-4 flex-1 text-sm" style="color:var(--color-text-secondary);">{{ t.slogan }}</p>
            <button class="button w-full" [disabled]="busy() === t.name" (click)="deploy(t)">
              {{ busy() === t.name ? ('templates.deploying' | translate) : ('templates.deploy' | translate) }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class TemplatesPageComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly query = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.templates();
    return this.templates().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.slogan.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t));
  }

  protected deploy(t: ServiceTemplate): void {
    this.busy.set(t.name);
    this.error.set(null);
    this.api.quickDeploy({ name: t.name, template: t.name }).subscribe({
      next: () => {
        this.busy.set(null);
        void this.router.navigate(['/services']);
      },
      error: (e) => {
        this.busy.set(null);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('templates.deploymentFailed'));
      },
    });
  }
}
