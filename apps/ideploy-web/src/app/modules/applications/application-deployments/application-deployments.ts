import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import {
  ApplicationPreview,
  DeploymentHistoryItem,
  RollbackTarget,
} from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';

/**
 * Deployments — every version put online, and going back to one.
 *
 * One list rather than three tables: each version says whether it worked,
 * when, and how it started, and the ones that can be restored carry their
 * "Go back to this version" button on their own row. Rollback goes through
 * the dedicated endpoint: the API knows which deployments are redeployable
 * (finished, and not the current one) and rebuilds from source, because the
 * old image may well have been pruned. Pull-request previews only show when
 * there are some.
 */
@Component({
  selector: 'app-application-deployments',
  imports: [RouterLink, TranslateModule, DatePipe, IdemLoaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!embedded()) {
      <a class="mb-4 inline-flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);" [routerLink]="['/applications', uuid]">
        <i class="pi pi-chevron-left text-[10px]"></i>
        {{ 'deployments.backToApplication' | translate }}
      </a>
      <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
        {{ 'deployments.title' | translate }}
      </h1>
    }

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <section class="glass-card overflow-hidden">
      <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <h2 class="font-semibold text-text-primary">{{ 'deployments.history' | translate }}</h2>
        <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'deployments.intro' | translate }}</p>
      </header>

      @if (loading()) {
        <div class="space-y-3 px-5 py-4" aria-hidden="true">
          @for (i of [1, 2, 3]; track i) { <div class="skeleton h-10 rounded"></div> }
        </div>
      } @else if (history().length === 0) {
        <app-empty-state kind="activity" [title]="'applications.detail.noDeployments' | translate" [body]="'applications.detail.noDeploymentsHint' | translate" />
      } @else {
        <ul>
          @for (d of history(); track d.deployment_uuid; let last = $last) {
            <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
              <span class="inline-flex w-32 flex-shrink-0 items-center gap-2 text-sm font-medium" [style.color]="statusColor(d.status)">
                <i class="pi pi-circle-fill text-[7px]" aria-hidden="true"></i>{{ statusLabel(d.status) | translate }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm">
                  {{ 'deployments.version' | translate }} <code class="font-mono text-xs">{{ shortCommit(d.commit) }}</code>
                  @if (d.deployment_uuid === current()) {
                    <span class="tag ml-2" style="color:var(--color-success);">{{ 'deployments.current' | translate }}</span>
                  }
                </p>
                <p class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
                  {{ d.created_at | date: 'medium' }} · {{ (d.is_webhook ? 'deployments.viaWebhook' : 'deployments.manual') | translate }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                @if (restorable().has(d.deployment_uuid)) {
                  <button type="button" class="outer-button button-sm" [disabled]="rollingBack() !== null" (click)="rollbackTo(d.deployment_uuid)">
                    @if (rollingBack() === d.deployment_uuid) { <idem-loader size="xs" /> } @else { <i class="pi pi-replay mr-1.5 text-xs" aria-hidden="true"></i> }
                    {{ 'deployments.rollbackTo' | translate }}
                  </button>
                }
                <a class="button-ghost button-sm" [routerLink]="['/deployments', d.deployment_uuid]">{{ 'deployments.viewLogs' | translate }}</a>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    @if (previews().length > 0) {
      <section class="glass-card mt-6 overflow-hidden">
        <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
          <h2 class="font-semibold text-text-primary">{{ 'deployments.previews' | translate }}</h2>
          <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'deployments.previewsHint' | translate }}</p>
        </header>
        <ul>
          @for (p of previews(); track p.uuid; let last = $last) {
            <li class="flex flex-wrap items-center gap-3 px-5 py-3 text-sm" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
              <span class="font-medium">#{{ p.pull_request_id }}</span>
              @if (p.fqdn) {
                <a class="font-mono text-xs hover:underline" style="color:var(--color-primary-500);" [href]="p.fqdn" target="_blank" rel="noopener noreferrer">{{ p.fqdn }}</a>
              }
              @if (p.pull_request_html_url) {
                <a class="text-xs hover:underline" style="color:var(--color-text-secondary);" [href]="p.pull_request_html_url" target="_blank" rel="noopener noreferrer">{{ 'deployments.openPullRequest' | translate }}</a>
              }
              <span class="ml-auto text-xs" style="color:var(--color-text-secondary);">{{ p.status || '—' }}</span>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class ApplicationDeploymentsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  /** Shown as a tab of the application page: no back link, no page title. */
  readonly embedded = input(false);

  protected uuid = '';

  protected readonly history = signal<DeploymentHistoryItem[]>([]);
  protected readonly targets = signal<RollbackTarget[]>([]);
  protected readonly previews = signal<ApplicationPreview[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** uuid of the target being redeployed, so only that row shows progress. */
  protected readonly rollingBack = signal<string | null>(null);

  protected readonly restorable = computed(() => new Set(this.targets().map((t) => t.deploymentUuid)));
  /** The version online now: the latest one that finished. */
  protected readonly current = computed(() => this.history().find((d) => d.status === 'finished')?.deployment_uuid ?? null);

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.api.listDeployments(this.uuid).subscribe({
      next: (d) => {
        this.history.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.report(e, 'deployments.targetsError');
      },
    });
    this.api.listRollbackTargets(this.uuid).subscribe({
      next: (t) => this.targets.set(t),
      error: (e) => this.report(e, 'deployments.targetsError'),
    });
    // Previews are an extra: a failure to list them is not worth an error on the page.
    this.api.listPreviews(this.uuid).subscribe({ next: (p) => this.previews.set(p), error: () => undefined });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected shortCommit(commit: string): string {
    return commit ? commit.slice(0, 7) : 'HEAD';
  }

  protected statusColor(status: string): string {
    if (status === 'finished' || status === 'success') return 'var(--color-success)';
    if (status === 'failed' || status === 'error') return 'var(--color-danger)';
    if (status === 'in_progress' || status === 'running' || status === 'queued') return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  }

  /** The deployment states the worker writes, in words; anything else is "other". */
  protected statusLabel(status: string): string {
    const known = ['finished', 'failed', 'in_progress', 'queued', 'cancelled'];
    return `applications.detail.depStatus.${known.includes(status) ? status : 'other'}`;
  }

  protected rollbackTo(deploymentUuid: string): void {
    this.rollingBack.set(deploymentUuid);
    this.error.set(null);
    this.api.rollback(this.uuid, deploymentUuid).subscribe({
      next: (res) => this.router.navigate(['/deployments', res.deploymentUuid]),
      error: (e) => {
        this.report(e, 'deployments.rollbackError');
        this.rollingBack.set(null);
      },
    });
  }
}
