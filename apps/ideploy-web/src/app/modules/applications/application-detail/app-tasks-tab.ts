import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { ScheduledTask, TaskExecution } from '../../../shared/models/ideploy.models';

/**
 * Scheduled tasks — a command run inside the container on a cron schedule.
 * Each row: what runs, when, and the three things you do with it (run now,
 * see its past runs, remove it).
 */
@Component({
  selector: 'app-tasks-tab',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card overflow-hidden">
      <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <h2 class="font-semibold text-text-primary">{{ 'applications.detail.scheduledTasks' | translate }}</h2>
        <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.tasksHint' | translate }}</p>
      </header>

      @if (loading()) {
        <div class="space-y-3 px-5 py-4" aria-hidden="true">
          @for (i of [1, 2]; track i) { <div class="skeleton h-5 rounded"></div> }
        </div>
      } @else if (tasks().length === 0) {
        <p class="px-5 py-6 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noTasks' | translate }}</p>
      } @else {
        <ul>
          @for (task of tasks(); track task.uuid) {
            <li class="px-5 py-3" style="border-bottom:1px solid var(--glass-border-subtle);">
              <div class="flex flex-wrap items-center gap-3">
                <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--glass-bg-subtle);">
                  <i class="pi pi-clock text-xs" style="color:var(--color-text-secondary);"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-text-primary">{{ task.name }}</div>
                  <div class="flex flex-wrap gap-x-3 font-mono text-xs" style="color:var(--color-text-secondary);">
                    <span class="truncate">{{ task.command }}</span>
                    <span style="color:var(--color-text-tertiary);">{{ task.frequency }}</span>
                  </div>
                </div>
                <button type="button" class="outer-button button-sm" [disabled]="running() === task.uuid" (click)="run(task)">
                  @if (running() === task.uuid) { <idem-loader size="xs" /> } @else { <i class="pi pi-play mr-1.5 text-xs"></i> }
                  {{ 'applications.detail.runNow' | translate }}
                </button>
                <button type="button" class="outer-button button-sm" [attr.aria-expanded]="expanded() === task.uuid" (click)="toggleRuns(task)">
                  {{ (expanded() === task.uuid ? 'applications.detail.hideRuns' : 'applications.detail.showRuns') | translate }}
                </button>
                <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-danger);"
                  [attr.aria-label]="'applications.detail.removeNamed' | translate: { name: task.name }" (click)="remove(task)">
                  <i class="pi pi-trash text-xs"></i>
                </button>
              </div>
              @if (expanded() === task.uuid) {
                <div class="mt-3 rounded-lg p-3 text-xs sm:ml-11" style="background:var(--glass-bg-subtle);color:var(--color-text-secondary);">
                  @if (runsLoading()) {
                    <idem-loader size="xs" />
                  } @else if (runs().length === 0) {
                    {{ 'applications.detail.noRuns' | translate }}
                  } @else {
                    <ul class="space-y-1">
                      @for (ex of runs(); track $index) {
                        <li class="flex gap-3"><span class="font-mono">{{ ex.created_at }}</span><span>{{ ex.status }}</span></li>
                      }
                    </ul>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }

      <form class="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1.5fr_1fr_auto] sm:items-end" style="background:var(--glass-bg-light);" [formGroup]="form" (ngSubmit)="add()">
        <div>
          <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="task-name">{{ 'applications.detail.taskNameLabel' | translate }}</label>
          <input type="text" id="task-name" [placeholder]="'applications.detail.namePlaceholder' | translate" formControlName="name" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="task-command">{{ 'applications.detail.taskCommandLabel' | translate }}</label>
          <input type="text" id="task-command" class="font-mono text-sm" [placeholder]="'applications.detail.commandPlaceholder' | translate" formControlName="command" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="task-cron">{{ 'applications.detail.taskFrequencyLabel' | translate }}</label>
          <input type="text" id="task-cron" class="font-mono text-sm" [placeholder]="'applications.detail.cronPlaceholder' | translate" formControlName="frequency" />
        </div>
        <button class="inner-button" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) { <idem-loader size="xs" /> } @else { <i class="pi pi-plus mr-2 text-xs"></i> }
          {{ 'applications.detail.addTask' | translate }}
        </button>
      </form>
    </section>
  `,
})
export class AppTasksTabComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly uuid = input.required<string>();

  protected readonly tasks = signal<ScheduledTask[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly running = signal<string | null>(null);
  protected readonly expanded = signal<string | null>(null);
  protected readonly runs = signal<TaskExecution[]>([]);
  protected readonly runsLoading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    command: ['', Validators.required],
    frequency: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listTasks(this.uuid()).subscribe({
      next: (t) => {
        this.tasks.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected add(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.createTask(this.uuid(), this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset();
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected run(task: ScheduledTask): void {
    this.running.set(task.uuid);
    this.api.runTask(this.uuid(), task.uuid).subscribe({
      next: () => this.running.set(null),
      error: () => this.running.set(null),
    });
  }

  protected remove(task: ScheduledTask): void {
    this.api.deleteTask(this.uuid(), task.uuid).subscribe(() => {
      this.tasks.update((list) => list.filter((t) => t.uuid !== task.uuid));
      if (this.expanded() === task.uuid) this.expanded.set(null);
    });
  }

  protected toggleRuns(task: ScheduledTask): void {
    if (this.expanded() === task.uuid) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(task.uuid);
    this.runs.set([]);
    this.runsLoading.set(true);
    this.api.listTaskExecutions(this.uuid(), task.uuid).subscribe({
      next: (e) => {
        this.runs.set(e);
        this.runsLoading.set(false);
      },
      error: () => this.runsLoading.set(false),
    });
  }
}
