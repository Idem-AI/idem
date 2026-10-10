import { ChangeDetectionStrategy, Component, ElementRef, computed, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import { ComposeAnalysis, ServiceDetail, ServiceOperation } from '../../../shared/models/ideploy.models';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { EnvRow, EnvVarsEditorComponent } from '../../../shared/components/env-vars-editor/env-vars-editor';

/**
 * Service (stack) detail: what it runs, what happened at the last start, its
 * variables and its compose file — in the order someone fixing a stack needs
 * them.
 */
@Component({
  selector: 'app-service-detail',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, EnvVarsEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/services" class="mb-4 inline-flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
      <i class="pi pi-chevron-left text-[10px]" aria-hidden="true"></i>
      {{ 'services.detail.backToList' | translate }}
    </a>

    @if (loading()) {
      <idem-loader block [label]="'services.loading' | translate" />
    } @else if (service(); as s) {
      <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">{{ s.name }}</h1>
          <p class="mt-1 flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
            <span class="inline-block h-2 w-2 rounded-full" [style.background]="stateColor(stackState())" aria-hidden="true"></span>
            {{ 'services.detail.state.' + stackState() | translate: { running: runningCount(), total: s.applications.length } }}
            @if (s.service_type && s.service_type !== 'custom') { <span>· {{ s.service_type }}</span> }
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="outer-button" (click)="lifecycle('stop')" [disabled]="busy()">
            @if (acting() === 'stop') { <idem-loader size="xs" /> }
            {{ 'services.detail.stop' | translate }}
          </button>
          <button type="button" class="outer-button" (click)="lifecycle('restart')" [disabled]="busy()">
            @if (acting() === 'restart') { <idem-loader size="xs" /> }
            {{ 'services.detail.restart' | translate }}
          </button>
          <button type="button" class="inner-button" (click)="lifecycle('start')" [disabled]="busy()">
            @if (acting() === 'start') { <idem-loader size="xs" /> }
            {{ 'services.detail.start' | translate }}
          </button>
        </div>
      </header>

      @if (error()) {
        <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
      }

      <!-- What happened at the last start / stop / restart, kept after a reload. -->
      <section class="glass-card mb-4 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            @if (busy()) { <idem-loader size="xs" /> }
            {{ 'services.detail.console' | translate }}
          </h2>
          @if (operation(); as op) {
            @if (op.action && op.status) {
              <span class="tag" [style.color]="opColor(op.status)">
                {{ 'services.detail.action.' + op.action | translate }} · {{ 'services.detail.status.' + op.status | translate }}
              </span>
            }
          }
        </div>
        <pre #consoleEl class="custom-scrollbar m-4 max-h-80 min-h-24 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed"
             style="background:var(--color-bg-dark);border:1px solid var(--color-surface-2);color:var(--color-text-primary);white-space:pre-wrap;word-break:break-word;"
        >@if (output()) {<span>{{ output() }}</span>} @else {<span style="color:var(--color-text-tertiary);">{{ 'services.detail.consoleEmpty' | translate }}</span>}</pre>
      </section>

      <div class="mb-4 grid gap-4" [class.lg:grid-cols-2]="s.databases.length > 0">
        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">
            {{ 'services.detail.containers' | translate }}
            <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ s.applications.length }})</span>
          </h2>
          @if (s.applications.length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'services.detail.noContainers' | translate }}</p>
          } @else {
            <ul class="divide-y text-sm" style="border-color:var(--color-surface-2);">
              @for (app of s.applications; track app.uuid) {
                <li class="flex items-center justify-between gap-3 py-2">
                  <span class="min-w-0 truncate">
                    <span class="font-medium">{{ app.name }}</span>
                    @if (app.fqdn) {
                      <a class="ml-2 text-xs hover:underline" style="color:var(--color-primary-500);" [href]="app.fqdn" target="_blank" rel="noopener noreferrer">{{ app.fqdn }}</a>
                    }
                  </span>
                  <span class="flex shrink-0 items-center gap-1.5 text-xs" style="color:var(--color-text-secondary);">
                    <span class="inline-block h-2 w-2 rounded-full" [style.background]="stateColor(app.status)" aria-hidden="true"></span>
                    {{ app.status || '—' }}
                  </span>
                </li>
              }
            </ul>
          }
        </section>

        @if (s.databases.length > 0) {
          <section class="glass-card p-4">
            <h2 class="mb-3 text-sm font-semibold">
              {{ 'services.detail.databases' | translate }}
              <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ s.databases.length }})</span>
            </h2>
            <ul class="space-y-2 text-sm">
              @for (db of s.databases; track db.uuid) {
                <li class="flex items-center justify-between gap-2">
                  <span>{{ db.name }}</span>
                  <span class="text-xs" style="color:var(--color-text-secondary);">{{ db.status || '—' }}</span>
                </li>
              }
            </ul>
          </section>
        }
      </div>

      <section class="glass-card mb-4 p-4">
        <h2 class="mb-1 text-sm font-semibold">{{ 'services.detail.envTitle' | translate }}</h2>
        <p class="mb-4 text-xs" style="color:var(--color-text-secondary);">{{ 'services.detail.envHint' | translate }}</p>
        @if (envRows().length === 0 && (analysis()?.variables ?? []).length === 0) {
          <p class="mb-3 text-sm" style="color:var(--color-text-tertiary);">{{ 'services.detail.envEmpty' | translate }}</p>
        }
        <app-env-vars-editor [(rows)]="envRows" [expected]="analysis()?.variables ?? []" />
        @for (w of analysis()?.warnings ?? []; track w.code + w.message) {
          <p class="mt-3 flex items-start gap-1.5 text-xs" style="color:var(--color-warning);">
            <i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i>{{ w.message }}
          </p>
        }
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style="border-color:var(--color-surface-2);">
          <button type="button" class="inner-button button-sm" (click)="saveEnv(true)" [disabled]="savingEnv() || busy()">
            @if (savingEnv()) { <idem-loader size="xs" /> }
            {{ 'services.detail.envSaveRestart' | translate }}
          </button>
          <button type="button" class="outer-button button-sm" (click)="saveEnv(false)" [disabled]="savingEnv() || busy()">
            {{ 'services.detail.envSave' | translate }}
          </button>
          @if (envSaved()) {
            <span class="text-xs" role="status" style="color:var(--color-text-secondary);">{{ 'services.detail.envSaved' | translate }}</span>
          }
        </div>
      </section>

      <section class="glass-card mb-4 p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">{{ 'services.detail.composeFile' | translate }}</h2>
          @if (!editingCompose()) {
            <button type="button" class="outer-button button-sm" (click)="editCompose(s.docker_compose_raw ?? '')">
              <i class="pi pi-pencil mr-1 text-xs" aria-hidden="true"></i>{{ 'services.detail.composeEdit' | translate }}
            </button>
          }
        </div>
        @if (editingCompose()) {
          <textarea class="font-mono text-xs" rows="18" spellcheck="false" [attr.aria-label]="'services.detail.composeFile' | translate"
                    [value]="composeDraft()" (input)="composeDraft.set($any($event.target).value)"></textarea>
          <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">{{ 'services.detail.composeEditHint' | translate }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="inner-button button-sm" (click)="saveCompose(true)" [disabled]="savingCompose() || busy() || !composeDraft().trim()">
              @if (savingCompose()) { <idem-loader size="xs" /> }
              {{ 'services.detail.composeSaveRestart' | translate }}
            </button>
            <button type="button" class="outer-button button-sm" (click)="saveCompose(false)" [disabled]="savingCompose() || !composeDraft().trim()">
              {{ 'services.detail.envSave' | translate }}
            </button>
            <button type="button" class="button-ghost button-sm" (click)="editingCompose.set(false)">{{ 'services.detail.cancel' | translate }}</button>
          </div>
        } @else if (s.docker_compose_raw) {
          <details>
            <summary class="cursor-pointer text-xs" style="color:var(--color-text-secondary);">
              {{ 'services.detail.composeShow' | translate: { count: composeLines(s.docker_compose_raw) } }}
            </summary>
            <pre class="custom-scrollbar mt-3 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs"
                 style="background:var(--color-bg-dark);border:1px solid var(--color-surface-2);">{{ s.docker_compose_raw }}</pre>
          </details>
        } @else {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'services.detail.noCompose' | translate }}</p>
        }
      </section>

      <section class="glass-card p-4" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
        <h2 class="mb-1 text-sm font-semibold">{{ 'services.detail.dangerZone' | translate }}</h2>
        <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">{{ 'services.detail.deleteHint' | translate }}</p>
        <button type="button" class="outer-button button-sm" style="color:var(--color-danger);" (click)="remove()" [disabled]="deleting()">
          @if (deleting()) { <idem-loader size="xs" /> }
          {{ (deleting() ? 'services.detail.deleting' : 'services.detail.deleteService') | translate }}
        </button>
      </section>
    } @else {
      <p class="text-sm" style="color:var(--color-danger);">{{ 'services.detail.notFound' | translate }}</p>
    }
  `,
})
export class ServiceDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private realtime = inject(RealtimeService);

  protected readonly service = signal<ServiceDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly deleting = signal(false);
  protected readonly operation = signal<ServiceOperation | null>(null);
  protected readonly output = computed(() => this.operation()?.output ?? '');
  protected readonly envRows = signal<EnvRow[]>([]);
  protected readonly analysis = signal<ComposeAnalysis | null>(null);
  protected readonly savingEnv = signal(false);
  protected readonly envSaved = signal(false);
  /** Which button started the running operation, for its loader. */
  protected readonly acting = computed(() => (this.busy() ? (this.operation()?.action ?? this.requested()) : null));
  private readonly requested = signal<'start' | 'stop' | 'restart' | null>(null);
  protected readonly editingCompose = signal(false);
  protected readonly composeDraft = signal('');
  protected readonly savingCompose = signal(false);
  protected readonly runningCount = computed(() => (this.service()?.applications ?? []).filter((a) => a.status === 'running').length);
  /** running: every container up · partial · stopped. */
  protected readonly stackState = computed(() => {
    const total = this.service()?.applications.length ?? 0;
    const up = this.runningCount();
    return total > 0 && up === total ? 'running' : up > 0 ? 'partial' : 'stopped';
  });

  private readonly consoleEl = viewChild<ElementRef<HTMLElement>>('consoleEl');
  private unsubscribeRealtime?: () => void;

  private uuid = '';
  private polling = false;
  private destroyed = false;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Auto-scroll: a console that doesn't follow the newest line is not one
    // anyone can watch a deploy through.
    effect(() => {
      this.output();
      const el = this.consoleEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.reload();
    this.loadEnv();
    // The console is read back from the API: it shows the last operation even
    // after a reload, and does not depend on the realtime channel.
    this.refreshOperation();
    this.unsubscribeRealtime = this.realtime.subscribeToService(this.uuid, () => this.refreshOperation());
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
    clearTimeout(this.pollTimer);
    this.destroyed = true;
  }

  private loadEnv(): void {
    this.api.getServiceEnv(this.uuid).subscribe({
      next: (r) => {
        this.envRows.set(r.variables);
        this.analysis.set(r.analysis);
      },
    });
  }

  /** Reads the last operation; keeps polling while it runs. */
  private refreshOperation(): void {
    if (this.polling) return;
    this.polling = true;
    this.api.latestServiceOperation(this.uuid).subscribe({
      next: (op) => {
        this.polling = false;
        const wasRunning = this.busy();
        this.operation.set(op);
        this.busy.set(op?.status === 'running');
        if (op?.status === 'running' && !this.destroyed) {
          this.pollTimer = setTimeout(() => this.refreshOperation(), 1500);
        } else if (wasRunning) {
          this.reload();
        }
      },
      error: () => (this.polling = false),
    });
  }

  private reload(): void {
    this.api.getService(this.uuid).subscribe({
      next: (s) => {
        this.service.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected stateColor(status: string | null | undefined): string {
    if (status === 'running') return 'var(--color-success)';
    if (status === 'partial' || status === 'restarting' || status === 'starting') return 'var(--color-warning)';
    return 'var(--color-text-tertiary)';
  }

  protected opColor(status: ServiceOperation['status']): string {
    return status === 'succeeded' ? 'var(--color-success)' : status === 'failed' ? 'var(--color-danger)' : 'var(--color-text-secondary)';
  }

  protected composeLines(text: string): number {
    return text.split('\n').length;
  }

  protected editCompose(current: string): void {
    this.composeDraft.set(current);
    this.editingCompose.set(true);
  }

  protected saveCompose(thenStart: boolean): void {
    this.savingCompose.set(true);
    this.error.set(null);
    this.api.updateServiceCompose(this.uuid, this.composeDraft()).subscribe({
      next: () => {
        this.savingCompose.set(false);
        this.editingCompose.set(false);
        this.reload();
        this.loadEnv();
        if (thenStart) this.lifecycle('start');
      },
      error: (e) => {
        this.report(e, 'services.detail.composeError');
        this.savingCompose.set(false);
      },
    });
  }

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
    this.requested.set(action);
    this.busy.set(true);
    this.error.set(null);
    this.api.serviceLifecycle(this.uuid, action).subscribe({
      next: (op) => {
        this.operation.set(op);
        this.refreshOperation();
      },
      error: (e) => {
        this.report(e, 'services.detail.lifecycleError');
        this.busy.set(false);
      },
    });
  }

  protected saveEnv(thenRestart: boolean): void {
    this.savingEnv.set(true);
    this.envSaved.set(false);
    this.error.set(null);
    const variables = this.envRows().filter((r) => r.key.trim() !== '').map((r) => ({ key: r.key.trim(), value: r.value }));
    this.api.saveServiceEnv(this.uuid, variables).subscribe({
      next: (r) => {
        this.envRows.set(r.variables);
        this.savingEnv.set(false);
        this.envSaved.set(true);
        if (thenRestart) this.lifecycle('start');
        else setTimeout(() => this.envSaved.set(false), 4000);
      },
      error: (e) => {
        this.report(e, 'services.detail.envError');
        this.savingEnv.set(false);
      },
    });
  }

  protected remove(): void {
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteService(this.uuid).subscribe({
      next: () => this.router.navigate(['/services']),
      error: (e) => {
        this.report(e, 'services.detail.deleteError');
        this.deleting.set(false);
      },
    });
  }
}
