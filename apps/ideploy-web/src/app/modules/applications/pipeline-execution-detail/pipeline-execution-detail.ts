import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { PipelineExecution, PipelineJob, PipelineScan } from '../../../shared/models/ideploy.models';
import {
  formatPipelineDuration,
  isPipelineActive,
  pipelineStatusBackground,
  pipelineStatusColor,
  pipelineStatusIcon,
} from '../../../shared/utils/pipeline-status.util';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

const POLL_INTERVAL_MS = 3_000;

/**
 * One pipeline run, GitLab-style: a horizontal graph of its stages — click one
 * to see that stage's scan results (when it has any) and its raw log, rather
 * than a flat list that never says *which* step is the one that failed.
 */
@Component({
  selector: 'app-pipeline-execution-detail',
  imports: [RouterLink, TranslateModule, DatePipe, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="['/applications', appUuid, 'pipeline']"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'pipeline.detail.backToPipeline' | translate }}
    </a>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (execution(); as ex) {
      <!-- Header -->
      <div class="glass-card p-4 mb-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  [style.background]="statusBackground(ex.status)" [style.color]="statusColor(ex.status)">
              @if (ex.status === 'running') {
                <idem-loader size="xs" />
              } @else {
                <i [class]="statusIcon(ex.status)" aria-hidden="true"></i>
              }
              {{ 'pipeline.status.' + ex.status | translate }}
            </span>
            <h1 class="heading-serif" style="font-size:24px;font-weight:700;color:var(--color-text-primary);">
              {{ 'pipeline.detail.title' | translate: { id: shortId(ex.uuid) } }}
            </h1>
          </div>
          <div class="flex items-center gap-2">
            <button class="outer-button text-xs px-3 py-1.5" [disabled]="rerunning()" (click)="rerun(ex)">
              <i class="pi pi-refresh mr-1" aria-hidden="true"></i>
              {{ (rerunning() ? 'pipeline.rerunning' : 'pipeline.rerun') | translate }}
            </button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs" style="color:var(--color-text-secondary);">
          <span class="flex items-center gap-1.5"><i class="pi pi-sitemap" aria-hidden="true"></i>
            <code>{{ ex.branch || 'main' }}</code>
          </span>
          @if (ex.commit_sha) {
            <span class="flex items-center gap-1.5"><i class="pi pi-circle" aria-hidden="true"></i>
              <code>{{ ex.commit_sha.slice(0, 7) }}</code>
            </span>
          }
          @if (ex.trigger_user) {
            <span class="flex items-center gap-1.5"><i class="pi pi-user" aria-hidden="true"></i>{{ ex.trigger_user }}</span>
          }
          @if (ex.started_at) {
            <span class="flex items-center gap-1.5"><i class="pi pi-clock" aria-hidden="true"></i>
              {{ ex.started_at | date: 'short' }}
              @if (duration()) { ({{ duration() }}) }
            </span>
          }
        </div>
        @if (ex.commit_message) {
          <p class="mt-2 text-sm">{{ ex.commit_message }}</p>
        }
        @if (ex.error_message) {
          <p class="mt-2 rounded-md p-2 text-sm" style="background:color-mix(in srgb, var(--color-danger) 10%, transparent);color:var(--color-danger);">
            {{ ex.error_message }}
          </p>
        }
      </div>

      <!-- Stage graph -->
      <div class="glass-card p-4 mb-4 overflow-x-auto">
        <div class="flex items-center gap-2">
          @for (job of ex.jobs ?? []; track job.uuid; let last = $last) {
            <button
              type="button"
              class="flex min-w-[180px] flex-1 items-center gap-3 rounded-xl p-3 text-left transition-colors"
              [style.background]="selectedStage() === job.name ? 'var(--color-surface-2)' : 'transparent'"
              [style.border]="'1.5px solid ' + (selectedStage() === job.name ? statusColor(job.status) : 'var(--color-surface-2)')"
              (click)="selectStage(job.name)"
            >
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
                    [style.background]="statusColor(job.status)">
                @if (job.status === 'running') {
                  <idem-loader size="xs" />
                } @else {
                  <i [class]="statusIcon(job.status)" style="color:#0a0a0a;" aria-hidden="true"></i>
                }
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold" [style.color]="statusColor(job.status)">
                  {{ 'pipeline.stage.' + job.name | translate }}
                </span>
                <span class="block text-xs" style="color:var(--color-text-secondary);">
                  {{ jobSubtitle(job) }}
                </span>
              </span>
            </button>
            @if (!last) {
              <i class="pi pi-chevron-right shrink-0 text-xs" style="color:var(--color-text-tertiary);" aria-hidden="true"></i>
            }
          }
        </div>
      </div>

      @if (selectedJob(); as job) {
        <!-- Scan metrics, when the stage produced any -->
        @if (scanFor(job.name); as scan) {
          <div class="glass-card p-4 mb-4">
            <div class="mb-3 flex items-center gap-2">
              <h3 class="text-sm font-semibold">{{ scan.tool }}</h3>
              @if (scan.quality_gate_status) {
                <span class="text-xs font-semibold" [style.color]="gateColor(scan.quality_gate_status)">
                  {{ scan.quality_gate_status }}
                </span>
              }
            </div>
            <div class="flex flex-wrap gap-4 text-sm" style="font-variant-numeric:tabular-nums;">
              @for (metric of scanMetrics(scan); track metric.key) {
                <span style="color:var(--color-text-secondary);">
                  {{ 'pipeline.metric.' + metric.key | translate }}: <strong style="color:var(--color-text-primary);">{{ metric.value }}</strong>
                </span>
              }
            </div>
          </div>
        }

        <!-- Logs -->
        <div class="glass-card overflow-hidden p-0">
          <div class="flex items-center justify-between gap-2 p-4" style="border-bottom:1px solid var(--color-surface-2);">
            <h3 class="text-sm font-semibold">{{ 'pipeline.detail.logs' | translate }}</h3>
            @if (job.logs) {
              <button class="outer-button text-xs px-3 py-1.5" (click)="downloadLogs(job)">
                <i class="pi pi-download mr-1" aria-hidden="true"></i>{{ 'pipeline.detail.download' | translate }}
              </button>
            }
          </div>
          <div class="max-h-[28rem] overflow-auto p-4 font-mono text-xs" style="background:#0a0a0a;">
            @if (job.logs) {
              <pre class="whitespace-pre-wrap" style="color:#4ade80;">{{ job.logs }}</pre>
            } @else {
              <p class="py-6 text-center" style="color:var(--color-text-tertiary);">{{ 'pipeline.detail.noLogs' | translate }}</p>
            }
          </div>
        </div>
      }
    } @else if (!error()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'pipeline.loading' | translate }}</p>
    }
  `,
})
export class PipelineExecutionDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected appUuid = '';
  protected executionUuid = '';

  protected readonly execution = signal<PipelineExecution | null>(null);
  protected readonly selectedStage = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rerunning = signal(false);

  protected readonly selectedJob = computed<PipelineJob | null>(() => {
    const stage = this.selectedStage();
    return this.execution()?.jobs?.find((j) => j.name === stage) ?? null;
  });

  protected readonly duration = computed(() => formatPipelineDuration(this.execution()?.duration_seconds ?? null));

  protected statusColor = pipelineStatusColor;
  protected statusBackground = pipelineStatusBackground;
  protected statusIcon = pipelineStatusIcon;

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.appUuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.executionUuid = this.route.snapshot.paramMap.get('executionUuid') ?? '';
    this.load();
    this.timer = setInterval(() => {
      if (isPipelineActive(this.execution()?.status ?? 'success')) this.load();
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private load(): void {
    this.api.getPipelineExecution(this.executionUuid).subscribe({
      next: (ex) => {
        this.execution.set(ex);
        if (!this.selectedStage()) this.selectStage(this.defaultStage(ex.jobs ?? []));
      },
      error: (e) => this.report(e, 'pipeline.detailError'),
    });
  }

  /** The stage an operator would want to see first: the one that failed, else the one running, else the last. */
  private defaultStage(jobs: PipelineJob[]): string | null {
    if (jobs.length === 0) return null;
    const failed = jobs.find((j) => j.status === 'failed');
    if (failed) return failed.name;
    const active = jobs.find((j) => j.status === 'running');
    if (active) return active.name;
    return jobs[jobs.length - 1].name;
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected shortId(uuid: string): string {
    return uuid.slice(0, 8);
  }

  protected selectStage(name: string | null): void {
    this.selectedStage.set(name);
  }

  protected jobSubtitle(job: PipelineJob): string {
    if (job.status === 'running') return this.translate.instant('pipeline.status.running');
    const duration = formatPipelineDuration(job.duration_seconds);
    return duration ?? this.translate.instant('pipeline.status.' + job.status);
  }

  protected scanFor(stageName: string): PipelineScan | null {
    return this.execution()?.scans?.find((s) => s.tool === stageName) ?? null;
  }

  protected gateColor(gate: string): string {
    return gate.toUpperCase() === 'OK' || gate.toUpperCase() === 'PASSED'
      ? 'var(--color-success)'
      : 'var(--color-danger)';
  }

  /** Only the metrics the scan actually reported — blanks are not information. */
  protected scanMetrics(scan: PipelineScan): { key: string; value: number }[] {
    const candidates: [string, number | null][] = [
      ['bugs', scan.bugs],
      ['vulnerabilities', scan.vulnerabilities],
      ['codeSmells', scan.code_smells],
      ['coverage', scan.coverage],
    ];
    return candidates
      .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined)
      .map(([key, value]) => ({ key, value }));
  }

  protected downloadLogs(job: PipelineJob): void {
    if (!job.logs) return;
    const blob = new Blob([job.logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.name}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected rerun(ex: PipelineExecution): void {
    this.rerunning.set(true);
    this.api.rerunPipelineExecution(ex.uuid).subscribe({
      next: (r) => {
        this.rerunning.set(false);
        void this.router.navigate(['/applications', this.appUuid, 'pipeline', r.executionUuid]);
      },
      error: (e) => {
        this.report(e, 'pipeline.rerunError');
        this.rerunning.set(false);
      },
    });
  }
}
