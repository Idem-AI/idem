import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import {
  BackupExecution,
  BackupSchedule,
  DatabaseDetail,
  DatabaseType,
} from '../../../shared/models/ideploy.models';
import { credentialLabel, isSecretField } from '../../../shared/utils/db-credentials.util';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/**
 * Database detail — connection facts, lifecycle, and scheduled backups.
 *
 * Two things this page used to be silent about, both raised directly: no
 * feedback while a start/stop/restart was in flight (same live-console gap
 * services and pipelines already had fixed), and no way to see or change the
 * real username/password/connection string a container was actually started
 * with — `database.service.ts` generated and stored them from the start, but
 * nothing ever read them back out. Both come straight from `ideploy-legacy`'s
 * own "General" page for each engine, which shows and edits these same fields.
 *
 * Backups live here rather than on a screen of their own because a schedule
 * only means anything next to the database it dumps. Executions are fetched
 * per schedule, on expand: a database with daily backups accumulates hundreds
 * of rows nobody reads until something has gone wrong.
 */
@Component({
  selector: 'app-database-detail',
  imports: [RouterLink, FormsModule, ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/databases"
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'databases.detail.backToList' | translate }}
    </a>

    @if (loading()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'databases.loading' | translate }}</p>
    } @else if (database(); as db) {
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
            {{ db.name }}
          </h1>
          <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
            {{ db.type }} · <code class="font-mono">{{ db.image }}</code>
          </p>
          @if (db.description) {
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ db.description }}</p>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="outer-button" (click)="lifecycle('restart')" [disabled]="busy()">
            {{ 'databases.detail.restart' | translate }}
          </button>
          <button class="outer-button" (click)="lifecycle('stop')" [disabled]="busy()">
            {{ 'databases.detail.stop' | translate }}
          </button>
          <button class="inner-button" (click)="lifecycle('start')" [disabled]="busy()">
            {{ 'databases.detail.start' | translate }}
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
      }
      @if (notice()) {
        <p class="mb-4 text-sm" role="status" style="color:var(--color-success);">{{ notice() }}</p>
      }

      <!--
        Live console: the same gap services and pipelines already had —
        a start/stop that either fails or "succeeds" while the container
        quietly exits, with nothing anywhere saying which, or why.
      -->
      @if (consoleLines().length > 0) {
        <section class="glass-card overflow-hidden mb-4">
          <div class="box-header">
            <h2 class="box-title flex items-center gap-2">
              @if (busy()) {
                <idem-loader size="xs" />
              } @else {
                <i class="pi pi-code text-xs" style="color:var(--color-text-tertiary);" aria-hidden="true"></i>
              }
              {{ 'databases.detail.console' | translate }}
            </h2>
          </div>
          <pre
            #consoleEl
            class="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed"
            style="background:#080b12;color:#c9d1d9;"
          >@for (line of consoleLines(); track $index) {<span>{{ line }}</span>
}@if (busy()) {<span class="animate-pulse">▋</span>}</pre>
        </section>
      }

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">{{ 'databases.detail.overview' | translate }}</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'databases.detail.status' | translate }}</dt>
              <dd>{{ db.status || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'databases.detail.engine' | translate }}</dt>
              <dd>{{ db.type }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'databases.detail.image' | translate }}</dt>
              <dd><code class="font-mono text-xs">{{ db.image }}</code></dd>
            </div>
          </dl>
        </section>

        <!-- Public exposure is a security fact, so it is stated, not implied. -->
        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">{{ 'databases.detail.access' | translate }}</h2>
          @if (db.is_public) {
            <p class="mb-2 text-sm font-semibold" style="color:var(--color-warning);">
              {{ 'databases.detail.publiclyExposed' | translate }}
            </p>
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'databases.detail.publicPort' | translate }}: <code class="font-mono">{{ db.public_port ?? '—' }}</code>
            </p>
          } @else {
            <p class="text-sm" style="color:var(--color-success);">
              {{ 'databases.detail.privateOnly' | translate }}
            </p>
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
              {{ 'databases.detail.privateHint' | translate: { host: db.internal_host } }}
            </p>
          }
        </section>
      </div>

      <!-- Connection: the actual host/port/URL a client needs — previously shown nowhere at all. -->
      <section class="glass-card p-4 mt-4">
        <h2 class="mb-3 text-sm font-semibold">{{ 'databases.detail.connection' | translate }}</h2>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">
              {{ 'databases.detail.internalUrl' | translate }}
            </label>
            <div class="flex items-center gap-2">
              <input type="text"
                class="font-mono text-xs"
                readonly
                [type]="revealed().has('__url') ? 'text' : 'password'"
                [value]="db.connection_url ?? ''"
              />
              <button type="button" class="button-icon" (click)="toggleReveal('__url')" [attr.aria-label]="'databases.detail.reveal' | translate">
                <i class="pi" [class.pi-eye]="!revealed().has('__url')" [class.pi-eye-slash]="revealed().has('__url')"></i>
              </button>
              <button type="button" class="button-icon" (click)="copy(db.connection_url)" [attr.aria-label]="'databases.detail.copy' | translate">
                <i class="pi pi-copy"></i>
              </button>
            </div>
          </div>
          @if (db.public_connection_url) {
            <div>
              <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">
                {{ 'databases.detail.publicUrl' | translate }}
              </label>
              <div class="flex items-center gap-2">
                <input type="text"
                  class="font-mono text-xs"
                  readonly
                  [type]="revealed().has('__public_url') ? 'text' : 'password'"
                  [value]="db.public_connection_url"
                />
                <button type="button" class="button-icon" (click)="toggleReveal('__public_url')" [attr.aria-label]="'databases.detail.reveal' | translate">
                  <i class="pi" [class.pi-eye]="!revealed().has('__public_url')" [class.pi-eye-slash]="revealed().has('__public_url')"></i>
                </button>
                <button type="button" class="button-icon" (click)="copy(db.public_connection_url)" [attr.aria-label]="'databases.detail.copy' | translate">
                  <i class="pi pi-copy"></i>
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Credentials: real, editable values — same shape as ideploy-legacy's per-engine General page. -->
      <section class="glass-card p-4 mt-4">
        <h2 class="mb-1 text-sm font-semibold">{{ 'databases.detail.credentials' | translate }}</h2>
        <p class="mb-3 text-xs" style="color:var(--color-text-secondary);">
          {{ 'databases.detail.credentialsHint' | translate }}
        </p>
        <div class="space-y-3">
          @for (col of credentialColumns(); track col) {
            <div>
              <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">
                {{ credentialLabel(col) }}
              </label>
              <div class="flex items-center gap-2">
                <input type="text"
                  class="font-mono text-xs"
                  [type]="!isSecretField(col) || revealed().has(col) ? 'text' : 'password'"
                  [value]="credentialEdits()[col]"
                  (input)="onCredentialInput(col, $event)"
                />
                @if (isSecretField(col)) {
                  <button type="button" class="button-icon" (click)="toggleReveal(col)" [attr.aria-label]="'databases.detail.reveal' | translate">
                    <i class="pi" [class.pi-eye]="!revealed().has(col)" [class.pi-eye-slash]="revealed().has(col)"></i>
                  </button>
                }
                <button type="button" class="button-icon" (click)="copy(credentialEdits()[col])" [attr.aria-label]="'databases.detail.copy' | translate">
                  <i class="pi pi-copy"></i>
                </button>
              </div>
            </div>
          }
        </div>
        <p class="mt-3 text-xs" style="color:var(--color-text-tertiary);">
          {{ 'databases.detail.credentialsSaveHint' | translate }}
        </p>
        @if (credentialsError()) {
          <p class="mt-2 text-sm" style="color:var(--color-danger);">{{ credentialsError() }}</p>
        }
        @if (credentialsNotice()) {
          <p class="mt-2 text-sm" style="color:var(--color-success);">{{ credentialsNotice() }}</p>
        }
        <button class="inner-button mt-3" type="button" (click)="saveCredentials()" [disabled]="savingCredentials() || !credentialsDirty()">
          {{ (savingCredentials() ? 'databases.detail.savingCredentials' : 'databases.detail.saveCredentials') | translate }}
        </button>
      </section>

      <!-- Scheduled backups -->
      <section class="glass-card p-4 mt-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">{{ 'databases.detail.backups' | translate }}</h2>
          <button class="outer-button" (click)="backupNow()" [disabled]="backingUp()">
            {{ (backingUp() ? 'databases.detail.backingUp' : 'databases.detail.backupNow') | translate }}
          </button>
        </div>

        @if (schedules().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">
            {{ 'databases.detail.noSchedules' | translate }}
          </p>
        } @else {
          <ul class="space-y-3">
            @for (s of schedules(); track s.uuid) {
              <li style="border-top:1px solid var(--color-surface-2);" class="pt-3 first:border-t-0 first:pt-0">
                <div class="flex flex-wrap items-center gap-3 text-sm">
                  <code class="font-mono">{{ s.frequency }}</code>
                  <span
                    class="rounded-full px-2 py-0.5 text-xs"
                    [style.background]="s.enabled ? 'color-mix(in srgb, var(--color-success) 18%, transparent)' : 'var(--color-surface-2)'"
                    [style.color]="s.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)'"
                  >
                    {{ (s.enabled ? 'databases.detail.enabled' : 'databases.detail.disabled') | translate }}
                  </span>
                  <span style="color:var(--color-text-secondary);">
                    {{ 'databases.detail.keepLocally' | translate: { count: s.number_of_backups_locally } }}
                  </span>
                  @if (s.save_s3) {
                    <span style="color:var(--color-text-secondary);">· {{ 'databases.detail.alsoS3' | translate }}</span>
                  }
                  <button
                    class="ml-auto text-xs"
                    style="color:var(--color-text-secondary);"
                    (click)="toggleExecutions(s)"
                  >
                    {{ (expanded() === s.uuid ? 'databases.detail.hideRuns' : 'databases.detail.showRuns') | translate }}
                  </button>
                  <button class="text-xs" style="color:var(--color-danger);" (click)="removeSchedule(s)">
                    {{ 'databases.detail.delete' | translate }}
                  </button>
                </div>

                @if (expanded() === s.uuid) {
                  @if (executions().length === 0) {
                    <p class="mt-2 text-sm" style="color:var(--color-text-secondary);">
                      {{ 'databases.detail.noRuns' | translate }}
                    </p>
                  } @else {
                    <div class="mt-2 overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr style="color:var(--color-text-secondary);">
                            <th class="py-1 pr-3 text-left font-medium">{{ 'databases.detail.runDate' | translate }}</th>
                            <th class="py-1 pr-3 text-left font-medium">{{ 'databases.detail.runStatus' | translate }}</th>
                            <th class="py-1 pr-3 text-left font-medium">{{ 'databases.detail.runSize' | translate }}</th>
                            <th class="py-1 text-left font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (ex of executions(); track ex.uuid) {
                            <tr style="border-top:1px solid var(--color-surface-2);">
                              <td class="py-1 pr-3" style="font-variant-numeric:tabular-nums;">{{ ex.created_at }}</td>
                              <td class="py-1 pr-3" [style.color]="runColor(ex.status)">{{ ex.status }}</td>
                              <td class="py-1 pr-3" style="font-variant-numeric:tabular-nums;">{{ formatSize(ex.size) }}</td>
                              <td class="py-1">
                                @if (ex.filename) {
                                  <button class="text-xs" style="color:var(--color-primary-500);" (click)="download(ex)">
                                    {{ 'databases.detail.download' | translate }}
                                  </button>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                }
              </li>
            }
          </ul>
        }

        <form class="mt-4 flex flex-wrap items-center gap-2" [formGroup]="scheduleForm" (ngSubmit)="addSchedule()">
          <input type="text"
            class="!w-48"
            formControlName="frequency"
            [placeholder]="'databases.detail.cronPlaceholder' | translate"
          />
          <input
            class="!w-32"
            type="number"
            min="1"
            max="365"
            formControlName="number_of_backups_locally"
            [attr.aria-label]="'databases.detail.retention' | translate"
          />
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="save_s3" />
            {{ 'databases.detail.saveToS3' | translate }}
          </label>
          <button class="inner-button" type="submit" [disabled]="scheduleForm.invalid">
            {{ 'databases.detail.addSchedule' | translate }}
          </button>
        </form>
        <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">
          {{ 'databases.detail.cronHint' | translate }}
        </p>
      </section>

      <section class="glass-card p-4 mt-4" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
        <h2 class="mb-1 text-sm font-semibold">{{ 'databases.detail.dangerZone' | translate }}</h2>
        <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
          {{ 'databases.detail.deleteHint' | translate }}
        </p>
        <button class="outer-button" style="color:var(--color-danger);" (click)="remove()" [disabled]="deleting()">
          {{ (deleting() ? 'databases.detail.deleting' : 'databases.detail.deleteDatabase') | translate }}
        </button>
      </section>
    } @else {
      <p class="text-sm" style="color:var(--color-danger);">{{ 'databases.detail.notFound' | translate }}</p>
    }
  `,
})
export class DatabaseDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private realtime = inject(RealtimeService);

  protected readonly credentialLabel = credentialLabel;
  protected readonly isSecretField = isSecretField;

  protected readonly database = signal<DatabaseDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly consoleLines = signal<string[]>([]);

  protected readonly schedules = signal<BackupSchedule[]>([]);
  protected readonly executions = signal<BackupExecution[]>([]);
  /** uuid of the schedule whose runs are open, or null. */
  protected readonly expanded = signal<string | null>(null);

  protected readonly busy = signal(false);
  protected readonly backingUp = signal(false);
  protected readonly deleting = signal(false);

  /** Which masked fields (credential columns, plus the two connection-URL pseudo-keys) are currently shown in clear. */
  protected readonly revealed = signal<Set<string>>(new Set());
  /** Working copy of credential values — starts as the real ones fetched from the server, edited in place. */
  protected readonly credentialEdits = signal<Record<string, string>>({});
  protected readonly savingCredentials = signal(false);
  protected readonly credentialsError = signal<string | null>(null);
  protected readonly credentialsNotice = signal<string | null>(null);

  private readonly consoleEl = viewChild<ElementRef<HTMLElement>>('consoleEl');
  private unsubscribeRealtime?: () => void;

  private uuid = '';
  private type: DatabaseType = 'postgresql';

  protected readonly scheduleForm = this.fb.nonNullable.group({
    frequency: ['0 2 * * *', Validators.required],
    number_of_backups_locally: [
      7,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
    save_s3: [false],
  });

  constructor() {
    // Auto-scroll: a console that doesn't follow the newest line is not one
    // anyone can watch a start/stop through.
    effect(() => {
      this.consoleLines();
      const el = this.consoleEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected credentialColumns(): string[] {
    return Object.keys(this.credentialEdits());
  }

  protected credentialsDirty(): boolean {
    const db = this.database();
    if (!db) return false;
    const edits = this.credentialEdits();
    return Object.keys(edits).some((k) => edits[k] !== (db.credentials[k] ?? ''));
  }

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.type = (this.route.snapshot.paramMap.get('type') ?? 'postgresql') as DatabaseType;

    this.reload();
    this.reloadSchedules();
    this.unsubscribeRealtime = this.realtime.subscribeToDatabase(this.uuid, (line) => {
      this.consoleLines.update((lines) => [...lines, line]);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
  }

  private reload(): void {
    this.api.getDatabase(this.type, this.uuid).subscribe({
      next: (db) => {
        this.database.set(db);
        this.credentialEdits.set({ ...db.credentials });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reloadSchedules(): void {
    this.api.listBackupSchedules(this.type, this.uuid).subscribe((s) => this.schedules.set(s));
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected runColor(status: string): string {
    if (status === 'success') return 'var(--color-success)';
    if (status === 'failed') return 'var(--color-danger)';
    return 'var(--color-text-secondary)';
  }

  /** Bytes as reported by the dump; the column is text in the schema. */
  protected formatSize(size: string | number | null): string {
    const bytes = typeof size === 'string' ? Number(size) : size;
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
    const units = ['B', 'kB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  protected toggleReveal(key: string): void {
    this.revealed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected async copy(value: string | null | undefined): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard permission denied — nothing sensible to fall back to here */
    }
  }

  protected onCredentialInput(col: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.credentialEdits.update((edits) => ({ ...edits, [col]: value }));
  }

  protected saveCredentials(): void {
    const db = this.database();
    if (!db) return;
    const edits = this.credentialEdits();
    const changed: Record<string, string> = {};
    for (const k of Object.keys(edits)) {
      if (edits[k] !== (db.credentials[k] ?? '')) changed[k] = edits[k];
    }
    if (Object.keys(changed).length === 0) return;

    this.savingCredentials.set(true);
    this.credentialsError.set(null);
    this.credentialsNotice.set(null);
    this.api.updateDatabaseCredentials(this.type, this.uuid, changed).subscribe({
      next: (updated) => {
        this.database.set(updated);
        this.credentialEdits.set({ ...updated.credentials });
        this.savingCredentials.set(false);
        this.credentialsNotice.set(this.translate.instant('databases.detail.credentialsSaved'));
      },
      error: (e) => {
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.credentialsError.set(message ?? this.translate.instant('databases.detail.credentialsError'));
        this.savingCredentials.set(false);
      },
    });
  }

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
    this.busy.set(true);
    this.error.set(null);
    this.consoleLines.set([]);
    this.api.dbLifecycle(this.type, this.uuid, action).subscribe({
      next: () => {
        this.busy.set(false);
        this.reload();
      },
      error: (e) => {
        this.report(e, 'databases.detail.lifecycleError');
        this.busy.set(false);
      },
    });
  }

  protected backupNow(): void {
    this.backingUp.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.api.backupNow(this.type, this.uuid).subscribe({
      next: (r) => {
        this.notice.set(
          this.translate.instant('databases.detail.backupDone', { filename: r.filename })
        );
        this.backingUp.set(false);
        if (this.expanded()) this.loadExecutions(this.expanded()!);
      },
      error: (e) => {
        this.report(e, 'databases.detail.backupError');
        this.backingUp.set(false);
      },
    });
  }

  protected addSchedule(): void {
    if (this.scheduleForm.invalid) return;
    this.error.set(null);
    this.api.createBackupSchedule(this.type, this.uuid, this.scheduleForm.getRawValue()).subscribe({
      next: (s) => {
        this.schedules.update((list) => [...list, s]);
        this.scheduleForm.reset({
          frequency: '0 2 * * *',
          number_of_backups_locally: 7,
          save_s3: false,
        });
      },
      error: (e) => this.report(e, 'databases.detail.scheduleError'),
    });
  }

  protected removeSchedule(s: BackupSchedule): void {
    this.api.deleteBackupSchedule(s.uuid).subscribe({
      next: () => {
        this.schedules.update((list) => list.filter((x) => x.uuid !== s.uuid));
        if (this.expanded() === s.uuid) this.expanded.set(null);
      },
      error: (e) => this.report(e, 'databases.detail.scheduleError'),
    });
  }

  protected toggleExecutions(s: BackupSchedule): void {
    if (this.expanded() === s.uuid) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(s.uuid);
    this.loadExecutions(s.uuid);
  }

  private loadExecutions(scheduleUuid: string): void {
    this.executions.set([]);
    this.api.listBackupExecutions(scheduleUuid).subscribe({
      next: (e) => this.executions.set(e),
      error: (e) => this.report(e, 'databases.detail.runsError'),
    });
  }

  /**
   * The response is a file stream, so it is turned into an object URL and
   * clicked. An error arrives as JSON inside the blob — read it back out
   * rather than downloading a file containing an error message.
   */
  protected download(ex: BackupExecution): void {
    this.error.set(null);
    this.api.downloadBackup(ex.uuid).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = ex.filename ?? `${ex.uuid}.dump`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: async (e) => {
        const body = e?.error;
        if (body instanceof Blob) {
          try {
            const parsed = JSON.parse(await body.text());
            this.error.set(parsed?.error?.message ?? this.translate.instant('databases.detail.downloadError'));
            return;
          } catch {
            /* fall through to the generic message */
          }
        }
        this.report(e, 'databases.detail.downloadError');
      },
    });
  }

  protected remove(): void {
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteDatabase(this.type, this.uuid).subscribe({
      next: () => this.router.navigate(['/databases']),
      error: (e) => {
        this.report(e, 'databases.detail.deleteError');
        this.deleting.set(false);
      },
    });
  }
}
