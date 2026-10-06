import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Service, ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';
import { serviceStatusDisplay } from '../../../shared/utils/service-status.util';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { ListSkeletonComponent } from '../../../shared/components/list-skeleton/list-skeleton';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

type StatusFilter = 'all' | 'running' | 'exited' | 'partial';

/**
 * Installed-services overview — same information architecture as Vercel's
 * Integrations page: installed items on the left (search + status filter),
 * a "browse the catalog" sidebar on the right instead of duplicating the
 * catalog inline. Deploying *from* a template now happens on `/templates`
 * (the catalog) and its detail page, not in a form on this page — this page
 * is only what's already running and how it's doing.
 */
@Component({
  selector: 'app-services-list',
  imports: [RouterLink, FormsModule, ReactiveFormsModule, TranslateModule, DatePipe, IdemLoaderComponent, WorkspaceTargetPickerComponent, EmptyStateComponent, PageHeaderComponent, ListSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'services.title' | translate" [subtitle]="'services.subtitle' | translate" [count]="loading() ? null : services().length">
      <a class="inner-button" routerLink="/templates"><i class="pi pi-compass mr-2 text-xs"></i>{{ 'services.browseServices' | translate }}</a>
    </app-page-header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        @if (loading()) {
          <app-list-skeleton />
        } @else if (services().length === 0) {
          <div class="glass-card">
            <app-empty-state kind="market" [title]="'services.empty' | translate" [body]="'services.emptyHint' | translate">
              <a class="inner-button mt-5" routerLink="/templates">{{ 'services.browseServices' | translate }}</a>
            </app-empty-state>
          </div>
        } @else {
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="relative flex-1">
              <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs" style="color:var(--color-text-tertiary);"></i>
              <input type="text" style="padding-left:36px;" [placeholder]="'services.searchPlaceholder' | translate" [ngModel]="query()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="query.set($event)" />
            </div>
            <div class="inline-flex flex-wrap rounded-lg border p-1" style="border-color:var(--glass-border);background:var(--glass-bg-subtle);" role="radiogroup" [attr.aria-label]="'services.filterLabel' | translate">
              @for (f of statusFilters; track f) {
                <button
                  type="button"
                  role="radio"
                  class="rounded-md px-3 py-1 text-xs font-semibold transition-smooth"
                  [attr.aria-checked]="statusFilter() === f"
                  [style.background]="statusFilter() === f ? 'var(--glass-bg-light)' : 'transparent'"
                  [style.box-shadow]="statusFilter() === f ? '0 0 0 1px var(--glass-border-medium)' : 'none'"
                  [style.color]="statusFilter() === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                  (click)="statusFilter.set(f)"
                >
                  {{ 'services.filter.' + f | translate }}
                </button>
              }
            </div>
          </div>

          @if (filtered().length === 0) {
            <div class="glass-card"><app-empty-state kind="search" [title]="'services.noMatch' | translate" /></div>
          } @else {
            <div class="glass-card overflow-hidden">
              @for (svc of filtered(); track svc.uuid; let last = $last) {
                <div class="flex flex-wrap items-center gap-4 px-5 py-4 transition-smooth hover:bg-[var(--glass-bg-subtle)]" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
                  <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style="background:var(--glass-bg-subtle);">
                    @if (logoFor(svc); as logo) {
                      <img [src]="logo" class="h-7 w-7 object-contain" alt="" (error)="onLogoError($event)" />
                    } @else {
                      <i class="pi pi-box" style="color:var(--color-text-secondary);"></i>
                    }
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <a class="truncate font-semibold text-text-primary hover:underline" [routerLink]="['/services', svc.uuid]">{{ svc.name }}</a>
                      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" [style.color]="status(svc).color" style="background:color-mix(in srgb, currentColor 10%, transparent);">
                        <i [class]="status(svc).icon" class="text-[10px]"></i>{{ status(svc).labelKey | translate }}
                      </span>
                    </div>
                    <div class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
                      <span class="capitalize">{{ svc.service_type || ('services.customCompose' | translate) }}</span>
                      @if (svc.updated_at) {
                        · {{ 'services.updated' | translate: { date: (svc.updated_at | date: 'mediumDate') } }}
                      }
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button type="button" class="outer-button button-sm" [disabled]="acting() === svc.uuid" (click)="action(svc, isActive(svc) ? 'stop' : 'start')">
                      @if (acting() === svc.uuid) { <idem-loader size="xs" /> } @else { <i class="pi mr-1.5 text-xs" [class.pi-stop]="isActive(svc)" [class.pi-play]="!isActive(svc)"></i> }
                      {{ (isActive(svc) ? 'services.stop' : 'services.start') | translate }}
                    </button>
                    <a class="outer-button button-sm" [routerLink]="['/services', svc.uuid]">{{ 'services.manage' | translate }}</a>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- The raw-compose path is for people who already have a docker-compose.yml; it stays one click away, folded. -->
        <div class="mt-6 overflow-hidden rounded-xl border" style="border-color:var(--glass-border);">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-smooth"
            [style.background]="showCustomForm() ? 'var(--glass-bg-light)' : 'transparent'"
            [attr.aria-expanded]="showCustomForm()"
            (click)="showCustomForm.set(!showCustomForm())"
          >
            <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
              <i class="pi pi-file-edit text-sm" style="color:var(--color-text-secondary);"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-text-primary">{{ 'services.deployCustom' | translate }}</span>
              <span class="block text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'services.deployCustomHint' | translate }}</span>
            </span>
            <i class="pi text-xs" style="color:var(--color-text-tertiary);" [class.pi-chevron-down]="!showCustomForm()" [class.pi-chevron-up]="showCustomForm()"></i>
          </button>
          @if (showCustomForm()) {
            <form class="space-y-4 px-4 pb-4 pt-2" style="background:var(--glass-bg-light);" [formGroup]="form" (ngSubmit)="create()">
              <div>
                <label class="mb-1 block text-sm" for="svc-name">{{ 'services.name' | translate }}</label>
                <input type="text" id="svc-name" formControlName="name" />
              </div>
              <app-workspace-target-picker (targetChange)="target.set($event)" />
              <div>
                <label class="mb-1 block text-sm" for="svc-compose">{{ 'services.dockerComposeLabel' | translate }}</label>
                <textarea id="svc-compose" class="font-mono text-xs" rows="8" formControlName="docker_compose_raw" placeholder="services:&#10;  web:&#10;    image: nginx"></textarea>
              </div>
              @if (error()) {
                <p class="text-sm" style="color:var(--color-danger);">{{ error() }}</p>
              }
              <div class="flex justify-end">
                <button class="inner-button" type="submit" [disabled]="!target() || saving() || form.invalid">
                  @if (saving()) { <idem-loader size="xs" /> }
                  {{ (saving() ? 'services.creating' : 'services.createService') | translate }}
                </button>
              </div>
            </form>
          }
        </div>
      </div>

      <aside class="glass-card h-fit p-5">
        <h2 class="text-sm font-semibold text-text-primary">{{ 'services.latestServices' | translate }}</h2>
        <p class="mb-4 mt-1 text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'services.latestServicesHint' | translate }}</p>
        @if (latestTemplates().length === 0) {
          <div class="space-y-3" aria-hidden="true">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="flex items-center gap-3"><div class="skeleton h-9 w-9 rounded-lg"></div><div class="skeleton h-3 flex-1 rounded"></div></div>
            }
          </div>
        } @else {
          <div class="-mx-2 space-y-1">
            @for (t of latestTemplates(); track t.name) {
              <a class="flex items-start gap-3 rounded-lg px-2 py-2 transition-smooth hover:bg-[var(--glass-bg-subtle)]" [routerLink]="['/templates', t.name]">
                <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style="background:var(--glass-bg-subtle);">
                  @if (serviceLogoUrl(t.logo); as logo) {
                    <img [src]="logo" class="h-6 w-6 object-contain" alt="" (error)="onLogoError($event)" />
                  } @else {
                    <i class="pi pi-box text-sm" style="color:var(--color-text-secondary);"></i>
                  }
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold capitalize text-text-primary">{{ t.name }}</span>
                  <span class="block text-xs" style="color:var(--color-text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{{ t.slogan }}</span>
                </span>
              </a>
            }
          </div>
        }
        <a class="outer-button button-sm mt-4 w-full justify-center" routerLink="/templates">{{ 'services.browseAll' | translate }}</a>
      </aside>
    </div>
  `,
})
export class ServicesListComponent implements OnInit {
  private readonly router = inject(Router);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly serviceLogoUrl = serviceLogoUrl;

  protected status(svc: Service) {
    return serviceStatusDisplay(svc.status);
  }

  protected isActive(svc: Service): boolean {
    return svc.status === 'running' || svc.status === 'partial';
  }

  protected readonly services = signal<Service[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);
  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly showCustomForm = signal(false);
  protected readonly acting = signal<string | null>(null);
  protected readonly statusFilters: StatusFilter[] = ['all', 'running', 'partial', 'exited'];

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.services().filter((s) => {
      if (status !== 'all' && (s.status ?? 'unknown') !== status) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.service_type ?? '').toLowerCase().includes(q);
    });
  });

  /** A handful of catalog entries for the sidebar — the same list the browse page shows, just truncated. */
  protected readonly latestTemplates = computed(() => this.templates().slice(0, 6));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    docker_compose_raw: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t));
  }

  /** Best-effort icon for an installed service: match its template name if it was deployed from one. */
  protected logoFor(svc: Service): string | null {
    if (!svc.service_type) return null;
    const t = this.templates().find((tpl) => tpl.name === svc.service_type);
    return t ? serviceLogoUrl(t.logo) : null;
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private load(): void {
    this.api.listServices().subscribe({
      next: (s) => {
        this.services.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    const target = this.target();
    const v = this.form.getRawValue();
    if (!v.name || !target || this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createService({
        name: v.name,
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
        docker_compose_raw: v.docker_compose_raw,
      })
      .subscribe({
        next: () => {
          this.form.reset({ name: '', docker_compose_raw: '' });
          this.target.set(null);
          this.saving.set(false);
          this.showCustomForm.set(false);
          this.load();
        },
        error: (e: { error?: { error?: { message?: string } } }) => {
          this.error.set(e?.error?.error?.message ?? this.translate.instant('services.createError'));
          this.saving.set(false);
        },
      });
  }

  protected action(svc: Service, act: 'start' | 'stop' | 'restart'): void {
    this.acting.set(svc.uuid);
    this.api.serviceLifecycle(svc.uuid, act).subscribe({
      // The operation runs in the background: its console is on the detail page.
      next: () => {
        this.acting.set(null);
        void this.router.navigate(['/services', svc.uuid]);
      },
      error: () => this.acting.set(null),
    });
  }
}
