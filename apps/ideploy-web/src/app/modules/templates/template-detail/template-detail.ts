import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl, serviceScreenshotUrl } from '../../../shared/utils/service-logo.util';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

/**
 * One catalog entry's own page — a template card's click target. Carries the
 * "Install" action (a workspace/name form, same shape as every other
 * resource-creation flow), which the catalog grid itself no longer does.
 *
 * Two content tiers, honestly distinguished: templates in the curated subset
 * (`template-enrichment.json`) get a real, sourced multi-paragraph overview
 * and a screenshot gallery; everything else falls back to the catalog's own
 * one-line `slogan` and the plain gradient hero — there is no fabricated
 * content standing in for what wasn't actually researched yet.
 */
@Component({
  selector: 'app-template-detail',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, WorkspaceTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'services.loading' | translate }}</p>
    } @else if (!template()) {
      <div class="glass-card p-4">
        <p class="mb-3">{{ 'templates.notFound' | translate }}</p>
        <a class="outer-button" routerLink="/templates">{{ 'templates.backToBrowse' | translate }}</a>
      </div>
    } @else {
      <div class="mb-4">
        <a class="text-sm hover:underline" style="color: var(--color-text-secondary)" routerLink="/templates">
          <i class="pi pi-arrow-left mr-1"></i>{{ 'templates.backToBrowse' | translate }}
        </a>
      </div>

      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style="background:var(--color-surface-2);">
            @if (logo(); as l) {
              <img [src]="l" class="h-8 w-8 object-contain" alt="" (error)="onLogoError($event)" />
            } @else {
              <i class="pi pi-box text-xl" style="color:var(--color-primary-400);"></i>
            }
          </div>
          <h1 class="text-2xl font-bold capitalize">{{ template()!.name }}</h1>
        </div>
        <div class="flex gap-2">
          @if (template()!.documentation) {
            <a class="outer-button" [href]="template()!.documentation" target="_blank" rel="noopener">
              <i class="pi pi-book mr-2"></i>{{ 'templates.documentation' | translate }}
            </a>
          }
          <button class="inner-button" type="button" (click)="showInstall.set(!showInstall())">
            <i class="pi pi-download mr-2"></i>{{ 'templates.install' | translate }}
          </button>
        </div>
      </div>

      @if (screenshots().length > 0) {
        <!-- Gallery: main preview + a thumbnail column, like a marketplace listing's own screenshots. -->
        <div class="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
          <div class="overflow-hidden rounded-xl" style="background:var(--color-surface-1);border:1px solid var(--color-surface-2);aspect-ratio:16/10;">
            <img [src]="activeScreenshot()" class="h-full w-full object-cover" [alt]="template()!.name" (error)="onScreenshotError($event)" />
          </div>
          <div class="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-x-visible">
            @for (shot of screenshots(); track shot; let i = $index) {
              <button
                type="button"
                class="flex-shrink-0 overflow-hidden rounded-lg transition-opacity"
                style="width:120px;aspect-ratio:16/10;"
                [style.border]="i === activeIndex() ? '2px solid var(--color-primary-500)' : '1px solid var(--color-surface-2)'"
                [style.opacity]="i === activeIndex() ? '1' : '0.7'"
                (click)="activeIndex.set(i)"
              >
                <img [src]="shot" class="h-full w-full object-cover" alt="" (error)="onScreenshotError($event)" />
              </button>
            }
          </div>
        </div>
      } @else {
        <!-- No sourced screenshots yet — the plain gradient hero. -->
        <div
          class="mb-6 flex flex-col items-center justify-center rounded-2xl p-10 text-center"
          style="background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary-500) 30%, transparent), color-mix(in srgb, var(--color-primary-700) 45%, transparent)); border:1px solid var(--color-surface-2);"
        >
          <div class="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl" style="background: var(--color-surface-1);">
            @if (logo(); as l) {
              <img [src]="l" class="h-10 w-10 object-contain" alt="" (error)="onLogoError($event)" />
            } @else {
              <i class="pi pi-box text-2xl" style="color:var(--color-primary-400);"></i>
            }
          </div>
          <h2 class="text-3xl font-bold capitalize" style="color: var(--color-text-primary);">{{ template()!.name }}</h2>
          <p class="mt-2 max-w-xl text-sm" style="color: var(--color-text-secondary);">{{ template()!.slogan }}</p>
        </div>
      }

      @if (showInstall()) {
        <form class="glass-card p-4 mb-6 space-y-3" [formGroup]="form" (ngSubmit)="install()">
          <h2 class="font-semibold">{{ 'templates.installTitle' | translate: { name: template()!.name } }}</h2>
          <div>
            <label class="mb-1 block text-sm">{{ 'services.name' | translate }}</label>
            <input type="text"  formControlName="name" />
          </div>
          <app-workspace-target-picker (targetChange)="target.set($event)" />
          @if (installError()) {
            <p class="text-sm text-red-400">{{ installError() }}</p>
          }
          <button class="inner-button" type="submit" [disabled]="form.invalid || !target() || installing()">
            {{ (installing() ? 'templates.installing' : 'templates.install') | translate }}
          </button>
        </form>
      }

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="glass-card p-4 lg:col-span-2">
          <h2 class="box-title mb-3">{{ 'templates.overview' | translate }}</h2>
          @for (paragraph of overviewParagraphs(); track $index) {
            <p class="text-sm leading-relaxed" style="color: var(--color-text-secondary);" [class.mt-3]="$index > 0">
              {{ paragraph }}
            </p>
          }
        </div>

        <div class="glass-card p-4 space-y-4">
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-tertiary);">
              {{ 'templates.category' | translate }}
            </h3>
            <span class="inline-block rounded-full px-2.5 py-1 text-xs font-medium" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
              {{ template()!.category }}
            </span>
          </div>
          @if (template()!.tags.length > 0) {
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-tertiary);">
                {{ 'templates.tags' | translate }}
              </h3>
              <div class="flex flex-wrap gap-1.5">
                @for (tag of template()!.tags; track tag) {
                  <span class="rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);color:var(--color-text-secondary);">{{ tag }}</span>
                }
              </div>
            </div>
          }
          @if (template()!.documentation) {
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" style="color: var(--color-text-tertiary);">
                {{ 'templates.resources' | translate }}
              </h3>
              <a class="flex items-center gap-2 text-sm hover:underline" style="color: var(--color-primary-400);" [href]="template()!.documentation" target="_blank" rel="noopener">
                <i class="pi pi-book"></i>{{ 'templates.documentation' | translate }}
              </a>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class TemplateDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly serviceLogoUrl = serviceLogoUrl;

  protected readonly template = signal<ServiceTemplate | null>(null);
  protected readonly loading = signal(true);
  protected readonly showInstall = signal(false);
  protected readonly installing = signal(false);
  protected readonly installError = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);
  protected readonly activeIndex = signal(0);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  protected readonly screenshots = computed(() => (this.template()?.screenshots ?? []).map(serviceScreenshotUrl));
  protected readonly activeScreenshot = computed(() => this.screenshots()[this.activeIndex()] ?? this.screenshots()[0]);

  /** The curated `overview` (already real paragraphs, split on blank lines) or a one-paragraph fallback to the catalog's own `slogan`. */
  protected readonly overviewParagraphs = computed(() => {
    const t = this.template();
    if (!t) return [];
    const raw = t.overview?.trim();
    return raw ? raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [t.slogan];
  });

  protected logo(): string | null {
    return serviceLogoUrl(this.template()?.logo ?? null);
  }

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('name');
    if (!name) {
      this.loading.set(false);
      return;
    }
    this.form.patchValue({ name });
    this.api.getServiceTemplate(name).subscribe({
      next: (t) => {
        this.template.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  protected onScreenshotError(event: Event): void {
    (event.target as HTMLImageElement).style.visibility = 'hidden';
  }

  protected install(): void {
    const t = this.template();
    const target = this.target();
    const v = this.form.getRawValue();
    if (!t || !target || this.form.invalid) return;
    this.installing.set(true);
    this.installError.set(null);
    this.api
      .createServiceFromTemplate({
        template: t.name,
        name: v.name,
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
      })
      .subscribe({
        next: (svc) => {
          this.installing.set(false);
          void this.router.navigate(['/services', svc.uuid]);
        },
        error: (e: { error?: { error?: { message?: string } } }) => {
          this.installError.set(e?.error?.error?.message ?? this.translate.instant('templates.deploymentFailed'));
          this.installing.set(false);
        },
      });
  }
}
