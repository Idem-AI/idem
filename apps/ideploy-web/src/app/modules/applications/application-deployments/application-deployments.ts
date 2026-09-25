import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  ApplicationPreview,
  DeploymentHistoryItem,
  RollbackTarget,
} from '../../../shared/models/ideploy.models';

/**
 * Deployments — history, rollback, and pull-request previews.
 *
 * Rollback goes through the dedicated endpoint rather than re-deploying a
 * commit by hand: the API knows which deployments are actually redeployable
 * (finished, and not the current one) and rebuilds from source, because the
 * old image may well have been pruned.
 */
@Component({
  selector: 'app-application-deployments',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="['/applications', uuid]"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'deployments.backToApplication' | translate }}
    </a>

    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
      {{ 'deployments.title' | translate }}
    </h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <section class="glass-card p-4 mb-4">
      <h2 class="mb-3 text-sm font-semibold">{{ 'deployments.history' | translate }}</h2>
      @if (history().length === 0) {
        <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'deployments.noHistory' | translate }}</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="color:var(--color-text-secondary);">
                <th class="py-1.5 pr-3 text-left font-medium">{{ 'deployments.commit' | translate }}</th>
                <th class="py-1.5 pr-3 text-left font-medium">{{ 'deployments.status' | translate }}</th>
                <th class="py-1.5 pr-3 text-left font-medium">{{ 'deployments.trigger' | translate }}</th>
                <th class="py-1.5 pr-3 text-left font-medium">{{ 'deployments.date' | translate }}</th>
                <th class="py-1.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              @for (d of history(); track d.deployment_uuid) {
                <tr style="border-top:1px solid var(--color-surface-2);">
                  <td class="py-1.5 pr-3"><code class="font-mono text-xs">{{ shortCommit(d.commit) }}</code></td>
                  <td class="py-1.5 pr-3" [style.color]="statusColor(d.status)">{{ d.status }}</td>
                  <td class="py-1.5 pr-3" style="color:var(--color-text-secondary);">
                    {{ (d.is_webhook ? 'deployments.viaWebhook' : 'deployments.manual') | translate }}
                  </td>
                  <td class="py-1.5 pr-3" style="color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">
                    {{ d.created_at }}
                  </td>
                  <td class="py-1.5">
                    <a class="text-xs hover:underline" style="color:var(--color-primary-500);" [routerLink]="['/deployments', d.deployment_uuid]">
                      {{ 'deployments.viewLogs' | translate }}
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <section class="glass-card p-4 mb-4">
      <h2 class="mb-1 text-sm font-semibold">{{ 'deployments.rollback' | translate }}</h2>
      <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
        {{ 'deployments.rollbackHint' | translate }}
      </p>
      @if (targets().length === 0) {
        <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'deployments.noTargets' | translate }}</p>
      } @else {
        <ul class="space-y-2 text-sm">
          @for (t of targets(); track t.deploymentUuid) {
            <li class="flex flex-wrap items-center gap-3">
              <code class="font-mono text-xs">{{ shortCommit(t.commit) }}</code>
              <span style="color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">{{ t.finishedAt || '—' }}</span>
              <button
                class="outer-button ml-auto"
                (click)="rollbackTo(t)"
                [disabled]="rollingBack() === t.deploymentUuid"
              >
                {{ (rollingBack() === t.deploymentUuid ? 'deployments.rollingBack' : 'deployments.rollbackTo') | translate }}
              </button>
            </li>
          }
        </ul>
      }
    </section>

    <section class="glass-card p-4">
      <h2 class="mb-1 text-sm font-semibold">{{ 'deployments.previews' | translate }}</h2>
      <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
        {{ 'deployments.previewsHint' | translate }}
      </p>
      @if (previews().length === 0) {
        <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'deployments.noPreviews' | translate }}</p>
      } @else {
        <ul class="space-y-2 text-sm">
          @for (p of previews(); track p.uuid) {
            <li class="flex flex-wrap items-center gap-3">
              <span class="font-medium">#{{ p.pull_request_id }}</span>
              @if (p.fqdn) {
                <a
                  class="text-xs hover:underline"
                  style="color:var(--color-primary-500);"
                  [href]="p.fqdn"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ p.fqdn }}</a
                >
              }
              @if (p.pull_request_html_url) {
                <a
                  class="text-xs hover:underline"
                  style="color:var(--color-text-secondary);"
                  [href]="p.pull_request_html_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ 'deployments.openPullRequest' | translate }}</a
                >
              }
              <span class="ml-auto text-xs" style="color:var(--color-text-secondary);">{{ p.status || '—' }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ApplicationDeploymentsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected uuid = '';

  protected readonly history = signal<DeploymentHistoryItem[]>([]);
  protected readonly targets = signal<RollbackTarget[]>([]);
  protected readonly previews = signal<ApplicationPreview[]>([]);
  protected readonly error = signal<string | null>(null);
  /** uuid of the target being redeployed, so only that row shows progress. */
  protected readonly rollingBack = signal<string | null>(null);

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.api.listDeployments(this.uuid).subscribe((d) => this.history.set(d));
    this.api.listRollbackTargets(this.uuid).subscribe({
      next: (t) => this.targets.set(t),
      error: (e) => this.report(e, 'deployments.targetsError'),
    });
    this.api.listPreviews(this.uuid).subscribe({
      next: (p) => this.previews.set(p),
      error: (e) => this.report(e, 'deployments.previewsError'),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected shortCommit(commit: string): string {
    return commit ? commit.slice(0, 7) : '—';
  }

  protected statusColor(status: string): string {
    if (status === 'finished' || status === 'success') return 'var(--color-success)';
    if (status === 'failed' || status === 'error') return 'var(--color-danger)';
    if (status === 'in_progress' || status === 'running') return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  }

  protected rollbackTo(target: RollbackTarget): void {
    this.rollingBack.set(target.deploymentUuid);
    this.error.set(null);
    this.api.rollback(this.uuid, target.deploymentUuid).subscribe({
      next: (res) => this.router.navigate(['/deployments', res.deploymentUuid]),
      error: (e) => {
        this.report(e, 'deployments.rollbackError');
        this.rollingBack.set(null);
      },
    });
  }
}
