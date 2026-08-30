import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { PipelineConfig, PipelineExecution } from '../../../shared/models/ideploy.models';
import {
  isPipelineActive,
  pipelineStageMarkIcon,
  pipelineStatusBackground,
  pipelineStatusColor,
  pipelineStatusIcon,
} from '../../../shared/utils/pipeline-status.util';

/** The stages the API knows about, in the order it runs them. */
const AVAILABLE_STAGES = ['language_detection', 'sonarqube', 'trivy', 'deploy'] as const;

/** How often the run list is refreshed while something is still active. */
const POLL_INTERVAL_MS = 4_000;

/**
 * CI/CD pipeline — configuration, and the run history (GitLab-style: each row
 * is one run with a small dot per stage, linking to a full pipeline graph).
 *
 * Stages are ordered and the order is meaningful (scan before deploy), so they
 * are presented as a fixed sequence to enable or disable rather than a free
 * list to sort: an operator cannot produce an invalid pipeline by accident.
 */
@Component({
  selector: 'app-application-pipeline',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="['/applications', uuid]"
    >
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
      {{ 'pipeline.backToApplication' | translate }}
    </a>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
        {{ 'pipeline.title' | translate }}
      </h1>
      <button class="button" (click)="run()" [disabled]="running() || !config()?.enabled">
        {{ (running() ? 'pipeline.running' : 'pipeline.runNow') | translate }}
      </button>
    </div>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (config(); as c) {
      <div class="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section class="box self-start">
          <h2 class="mb-3 text-sm font-semibold">{{ 'pipeline.configuration' | translate }}</h2>

          <label class="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" [checked]="c.enabled" (change)="toggleEnabled(c)" />
            {{ 'pipeline.enabled' | translate }}
          </label>
          @if (!c.enabled) {
            <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">
              {{ 'pipeline.disabledHint' | translate }}
            </p>
          }

          <p class="mb-2 text-sm font-medium">{{ 'pipeline.stages' | translate }}</p>
          <ul class="mb-4 space-y-2">
            @for (stage of availableStages; track stage; let i = $index) {
              <li class="flex items-center gap-2 text-sm">
                <span
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                  style="background:var(--color-surface-2);color:var(--color-text-secondary);font-variant-numeric:tabular-nums;"
                  aria-hidden="true"
                  >{{ i + 1 }}</span
                >
                <label class="flex items-center gap-2">
                  <input type="checkbox" [checked]="c.stages.includes(stage)" (change)="toggleStage(c, stage)" />
                  {{ 'pipeline.stage.' + stage | translate }}
                </label>
              </li>
            }
          </ul>

          <form class="space-y-3" [formGroup]="triggerForm" (ngSubmit)="saveTrigger(c)">
            <div>
              <label class="mb-1 block text-sm" for="trigger-mode">{{ 'pipeline.triggerMode' | translate }}</label>
              <select class="input" id="trigger-mode" formControlName="trigger_mode">
                <option value="manual">{{ 'pipeline.trigger.manual' | translate }}</option>
                <option value="on_push">{{ 'pipeline.trigger.onPush' | translate }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm" for="trigger-branches">{{ 'pipeline.triggerBranches' | translate }}</label>
              <input
                class="input"
                id="trigger-branches"
                formControlName="trigger_branches"
                [placeholder]="'pipeline.branchesPlaceholder' | translate"
              />
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">
                {{ 'pipeline.branchesHint' | translate }}
              </p>
            </div>
            <button class="button" type="submit" [disabled]="saving()">
              {{ (saving() ? 'pipeline.saving' : 'pipeline.save') | translate }}
            </button>
          </form>
        </section>

        <section class="box overflow-hidden p-0">
          <div class="flex items-center justify-between gap-2 p-4" style="border-bottom:1px solid var(--color-surface-2);">
            <h2 class="text-sm font-semibold">{{ 'pipeline.executions' | translate }}</h2>
            <button class="text-xs" style="color:var(--color-text-secondary);" (click)="loadExecutions()">
              {{ 'pipeline.refresh' | translate }}
            </button>
          </div>

          @if (executions().length === 0) {
            <p class="p-4 text-sm" style="color:var(--color-text-secondary);">{{ 'pipeline.noExecutions' | translate }}</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="vtable">
                <thead>
                  <tr>
                    <th>{{ 'pipeline.runs.status' | translate }}</th>
                    <th>{{ 'pipeline.runs.pipeline' | translate }}</th>
                    <th>{{ 'pipeline.runs.triggeredBy' | translate }}</th>
                    <th>{{ 'pipeline.runs.stages' | translate }}</th>
                    <th class="text-right">{{ 'pipeline.runs.actions' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ex of executions(); track ex.uuid) {
                    <tr>
                      <td class="whitespace-nowrap">
                        <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                              [style.background]="statusBackground(ex.status)" [style.color]="statusColor(ex.status)">
                          <i [class]="statusIcon(ex.status)" aria-hidden="true"></i>
                          {{ 'pipeline.status.' + ex.status | translate }}
                        </span>
                      </td>
                      <td>
                        <a class="font-mono text-xs font-semibold hover:underline" style="color:var(--color-primary-400);" [routerLink]="['/applications', uuid, 'pipeline', ex.uuid]">
                          #{{ shortId(ex.uuid) }}
                        </a>
                        <div class="mt-0.5 flex items-center gap-2 text-xs" style="color:var(--color-text-secondary);">
                          <code class="rounded px-1.5 py-0.5" style="background:var(--color-surface-2);">{{ ex.branch || 'main' }}</code>
                          @if (ex.commit_message) {
                            <span class="truncate max-w-[220px]">{{ ex.commit_message }}</span>
                          }
                        </div>
                      </td>
                      <td class="whitespace-nowrap">
                        <div style="color:var(--color-text-primary);">{{ 'pipeline.trigger.' + (ex.trigger_type === 'push' ? 'onPush' : ex.trigger_type === 'webhook' ? 'webhook' : 'manual') | translate }}</div>
                        @if (ex.created_at) {
                          <div class="text-xs" style="color:var(--color-text-secondary);">{{ ex.created_at | date: 'short' }}</div>
                        }
                      </td>
                      <td>
                        <div class="flex items-center gap-1">
                          @for (stage of ex.stages ?? []; track stage.name) {
                            <span
                              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                              [style.background]="statusColor(stage.status)"
                              [title]="('pipeline.stage.' + stage.name | translate) + ': ' + (('pipeline.status.' + stage.status) | translate)"
                            >
                              <i [class]="stageMarkIcon(stage.status)" style="color:#0a0a0a;" aria-hidden="true"></i>
                            </span>
                          }
                        </div>
                      </td>
                      <td class="text-right whitespace-nowrap">
                        <a class="button-secondary mr-2 px-2.5 py-1 text-xs" [routerLink]="['/applications', uuid, 'pipeline', ex.uuid]">
                          {{ 'pipeline.viewDetail' | translate }}
                        </a>
                        @if (!isActive(ex.status)) {
                          <button class="button-secondary mr-2 px-2.5 py-1 text-xs" [disabled]="rerunning() === ex.uuid" (click)="rerun(ex)">
                            {{ (rerunning() === ex.uuid ? 'pipeline.rerunning' : 'pipeline.rerun') | translate }}
                          </button>
                          @if (confirmingDelete() === ex.uuid) {
                            <button class="px-2.5 py-1 text-xs font-semibold" style="color:var(--color-danger);" (click)="deleteExecution(ex)">
                              {{ 'pipeline.confirmDelete' | translate }}
                            </button>
                            <button class="px-2 py-1 text-xs" style="color:var(--color-text-secondary);" (click)="cancelDelete()">
                              {{ 'pipeline.cancel' | translate }}
                            </button>
                          } @else {
                            <button class="px-2.5 py-1 text-xs" style="color:var(--color-text-secondary);" (click)="askDelete(ex)" [attr.aria-label]="'pipeline.delete' | translate">
                              <i class="fa-solid fa-trash" aria-hidden="true"></i>
                            </button>
                          }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>
    } @else {
      <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'pipeline.loading' | translate }}</p>
    }
  `,
})
export class ApplicationPipelineComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected uuid = '';
  protected readonly availableStages = AVAILABLE_STAGES;

  protected readonly config = signal<PipelineConfig | null>(null);
  protected readonly executions = signal<PipelineExecution[]>([]);
  protected readonly confirmingDelete = signal<string | null>(null);
  protected readonly rerunning = signal<string | null>(null);

  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly running = signal(false);

  protected readonly triggerForm = this.fb.nonNullable.group({
    trigger_mode: ['manual'],
    trigger_branches: [''],
  });

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.api.getPipeline(this.uuid).subscribe({
      next: (c) => {
        this.config.set(c);
        this.triggerForm.patchValue({
          trigger_mode: c.trigger_mode ?? 'manual',
          trigger_branches: (c.trigger_branches ?? []).join(', '),
        });
      },
      error: (e) => this.report(e, 'pipeline.loadError'),
    });
    this.loadExecutions();
    // Only a run in flight can change between polls; an all-terminal history
    // never needs a background request just to confirm nothing moved.
    this.timer = setInterval(() => {
      if (this.executions().some((ex) => this.isActive(ex.status))) this.loadExecutions();
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected shortId(uuid: string): string {
    return uuid.slice(0, 8);
  }

  protected isActive(status: string): boolean {
    return isPipelineActive(status);
  }

  protected statusColor = pipelineStatusColor;
  protected statusBackground = pipelineStatusBackground;
  protected statusIcon = pipelineStatusIcon;
  protected stageMarkIcon = pipelineStageMarkIcon;

  protected loadExecutions(): void {
    this.api.listPipelineExecutions(this.uuid).subscribe({
      next: (e) => this.executions.set(e),
      error: (e) => this.report(e, 'pipeline.executionsError'),
    });
  }

  protected toggleEnabled(c: PipelineConfig): void {
    this.persist(c, { enabled: !c.enabled });
  }

  /** Keep the canonical order regardless of the order boxes were ticked in. */
  protected toggleStage(c: PipelineConfig, stage: string): void {
    const selected = new Set(c.stages);
    selected.has(stage) ? selected.delete(stage) : selected.add(stage);
    const stages = AVAILABLE_STAGES.filter((s) => selected.has(s));
    this.persist(c, { stages });
  }

  protected saveTrigger(c: PipelineConfig): void {
    const raw = this.triggerForm.getRawValue();
    this.persist(c, {
      trigger_mode: raw.trigger_mode,
      trigger_branches: raw.trigger_branches
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
    });
  }

  private persist(
    current: PipelineConfig,
    patch: Partial<Pick<PipelineConfig, 'enabled' | 'stages' | 'trigger_mode' | 'trigger_branches'>>
  ): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.updatePipeline(this.uuid, patch).subscribe({
      next: (c) => {
        this.config.set(c);
        this.saving.set(false);
      },
      error: (e) => {
        this.report(e, 'pipeline.saveError');
        this.saving.set(false);
      },
    });
  }

  protected run(): void {
    this.running.set(true);
    this.error.set(null);
    this.api.triggerPipeline(this.uuid).subscribe({
      next: (r) => {
        this.running.set(false);
        void this.router.navigate(['/applications', this.uuid, 'pipeline', r.executionUuid]);
      },
      error: (e) => {
        this.report(e, 'pipeline.runError');
        this.running.set(false);
      },
    });
  }

  protected rerun(ex: PipelineExecution): void {
    this.rerunning.set(ex.uuid);
    this.api.rerunPipelineExecution(ex.uuid).subscribe({
      next: (r) => {
        this.rerunning.set(null);
        void this.router.navigate(['/applications', this.uuid, 'pipeline', r.executionUuid]);
      },
      error: (e) => {
        this.report(e, 'pipeline.rerunError');
        this.rerunning.set(null);
      },
    });
  }

  protected askDelete(ex: PipelineExecution): void {
    this.confirmingDelete.set(ex.uuid);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  protected deleteExecution(ex: PipelineExecution): void {
    this.api.deletePipelineExecution(ex.uuid).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        this.executions.update((list) => list.filter((e) => e.uuid !== ex.uuid));
      },
      error: (e) => {
        this.report(e, 'pipeline.deleteError');
        this.confirmingDelete.set(null);
      },
    });
  }
}
