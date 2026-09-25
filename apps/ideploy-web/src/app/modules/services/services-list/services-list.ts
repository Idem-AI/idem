import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Service, ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';
import { serviceStatusDisplay } from '../../../shared/utils/service-status.util';
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
  imports: [RouterLink, FormsModule, ReactiveFormsModule, TranslateModule, DatePipe, WorkspaceTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">{{ 'services.title' | translate }}</h1>
      <a class="inner-button" routerLink="/templates">
        <i class="pi pi-compass mr-2"></i>{{ 'services.browseServices' | translate }}
      </a>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            class="input flex-1"
            [placeholder]="'services.searchPlaceholder' | translate"
            [ngModel]="query()"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="query.set($event)"
          />
          <select class="input sm:w-52" [ngModel]="statusFilter()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="statusFilter.set($event)">
            <option value="all">{{ 'services.filter.all' | translate }}</option>
            <option value="running">{{ 'services.filter.running' | translate }}</option>
            <option value="partial">{{ 'services.filter.partial' | translate }}</option>
            <option value="exited">{{ 'services.filter.exited' | translate }}</option>
          </select>
        </div>

        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'services.loading' | translate }}</p>
        } @else if (services().length === 0) {
          <div class="glass-card p-4 text-center">
            <p class="mb-3" style="color: var(--color-text-secondary)">{{ 'services.empty' | translate }}</p>
            <a class="inner-button" routerLink="/templates">{{ 'services.browseServices' | translate }}</a>
          </div>
        } @else if (filtered().length === 0) {
          <div class="glass-card p-4" style="color: var(--color-text-secondary)">{{ 'services.noMatch' | translate }}</div>
        } @else {
          <div class="glass-card overflow-hidden">
            @for (svc of filtered(); track svc.uuid; let last = $last) {
              <div class="flex flex-wrap items-center gap-4 px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--color-surface-2)'">
                <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style="background:var(--color-surface-2);">
                  @if (logoFor(svc); as logo) {
                    <img [src]="logo" class="h-7 w-7 object-contain" alt="" (error)="onLogoError($event)" />
                  } @else {
                    <i class="pi pi-box" style="color:var(--color-primary-400);"></i>
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <a class="font-semibold hover:underline" [routerLink]="['/services', svc.uuid]">{{ svc.name }}</a>
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      [style.color]="status(svc).color"
                      style="background: color-mix(in srgb, currentColor 12%, transparent);"
                    >
                      <i [class]="status(svc).icon" class="text-[10px]"></i>
                      {{ status(svc).labelKey | translate }}
                    </span>
                  </div>
                  <div class="text-sm" style="color: var(--color-text-secondary)">
                    {{ svc.service_type || ('services.customCompose' | translate) }}
                    @if (svc.updated_at) {
                      · {{ 'services.updated' | translate: { date: (svc.updated_at | date: 'mediumDate') } }}
                    }
                  </div>
                </div>
                <div class="flex gap-2">
                  @if (isActive(svc)) {
                    <button class="outer-button" (click)="action(svc, 'stop')">{{ 'services.stop' | translate }}</button>
                  } @else {
                    <button class="outer-button" (click)="action(svc, 'start')">{{ 'services.start' | translate }}</button>
                  }
                  <a class="outer-button" [routerLink]="['/services', svc.uuid]">{{ 'services.manage' | translate }}</a>
                </div>
              </div>
            }
          </div>
        }

        <div class="mt-6">
          <button type="button" class="text-sm font-semibold hover:underline" style="color:var(--color-primary-400);" (click)="showCustomForm.set(!showCustomForm())">
            {{ (showCustomForm() ? 'services.hideCustomForm' : 'services.showCustomForm') | translate }}
          </button>
          @if (showCustomForm()) {
            <form class="glass-card p-4 mt-3 space-y-3" [formGroup]="form" (ngSubmit)="create()">
              <h2 class="font-semibold">{{ 'services.deployCustom' | translate }}</h2>
              <div>
                <label class="mb-1 block text-sm">{{ 'services.name' | translate }}</label>
                <input class="input" formControlName="name" />
              </div>
              <app-workspace-target-picker (targetChange)="target.set($event)" />
              <div>
                <label class="mb-1 block text-sm">{{ 'services.dockerComposeLabel' | translate }}</label>
                <textarea class="input font-mono" rows="6" formControlName="docker_compose_raw"></textarea>
              </div>
              @if (error()) {
                <p class="text-sm text-red-400">{{ error() }}</p>
              }
              <button class="inner-button" type="submit" [disabled]="!target() || saving()">
                {{ (saving() ? 'services.creating' : 'services.createService') | translate }}
              </button>
            </form>
          }
        </div>
      </div>

      <div class="glass-card p-4">
        <div class="mb-1 flex items-center gap-2">
          <i class="pi pi-clone" style="color:var(--color-primary-400);"></i>
          <h2 class="box-title">{{ 'services.latestServices' | translate }}</h2>
        </div>
        <p class="mb-4 text-sm" style="color: var(--color-text-secondary)">{{ 'services.latestServicesHint' | translate }}</p>
        @if (latestTemplates().length === 0) {
          <p class="text-sm" style="color: var(--color-text-tertiary)">{{ 'services.loading' | translate }}</p>
        } @else {
          <div class="space-y-4">
            @for (t of latestTemplates(); track t.name) {
              <a class="flex items-start gap-3 hover:opacity-80" [routerLink]="['/templates', t.name]">
                <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style="background:var(--color-surface-2);">
                  @if (serviceLogoUrl(t.logo); as logo) {
                    <img [src]="logo" class="h-6 w-6 object-contain" alt="" (error)="onLogoError($event)" />
                  } @else {
                    <i class="pi pi-box text-sm" style="color:var(--color-primary-400);"></i>
                  }
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold capitalize">{{ t.name }}</div>
                  <p class="text-xs" style="color: var(--color-text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    {{ t.slogan }}
                  </p>
                </div>
              </a>
            }
          </div>
        }
        <a class="mt-4 block text-center text-sm font-semibold hover:underline" style="color:var(--color-primary-400);" routerLink="/templates">
          {{ 'services.browseServices' | translate }}
        </a>
      </div>
    </div>
  `,
})
export class ServicesListComponent implements OnInit {
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
    this.api.serviceLifecycle(svc.uuid, act).subscribe(() => this.load());
  }
}
