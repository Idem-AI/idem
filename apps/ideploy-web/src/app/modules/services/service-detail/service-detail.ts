import { ChangeDetectionStrategy, Component, ElementRef, computed, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import { ComposeAnalysis, ServiceDetail, ServiceOperation } from '../../../shared/models/ideploy.models';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { EnvRow, EnvVarsEditorComponent } from '../../../shared/components/env-vars-editor/env-vars-editor';

/**
 * Service (stack) detail — what the compose file produced, and the controls
 * that act on the whole stack.
 *
 * The compose source is shown read-only. Editing it is not offered because the
 * API has no update endpoint: a textarea that silently discarded its contents
 * would be worse than no textarea. The legacy EditCompose screen is the place
 * to change a stack until that endpoint exists.
 */
@Component({
  selector: 'app-service-detail',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, EnvVarsEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/services"
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'services.detail.backToList' | translate }}
    </a>

    @if (loading()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'services.loading' | translate }}</p>
    } @else if (service(); as s) {
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
            {{ s.name }}
          </h1>
          @if (s.service_type) {
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ s.service_type }}</p>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="outer-button" (click)="lifecycle('restart')" [disabled]="busy()">
            {{ 'services.detail.restart' | translate }}
          </button>
          <button class="outer-button" (click)="lifecycle('stop')" [disabled]="busy()">
            {{ 'services.detail.stop' | translate }}
          </button>
          <button class="inner-button" (click)="lifecycle('start')" [disabled]="busy()">
            {{ 'services.detail.start' | translate }}
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
      }

      <!--
        The live console: what was previously the whole complaint — a Start
        that either fails or "succeeds" while every container quietly exits,
        with nothing anywhere saying which, or why. Same channel/format as
        the pipeline and server-provision consoles elsewhere in this app.
      -->
      <section class="glass-card overflow-hidden mb-4" aria-live="off">
        <div class="box-header">
          <h2 class="box-title flex items-center gap-2">
            @if (busy()) {
              <idem-loader size="xs" />
            } @else {
              <i class="pi pi-code text-xs" style="color:var(--color-text-tertiary);" aria-hidden="true"></i>
            }
            {{ 'services.detail.console' | translate }}
            @if (operation(); as op) {
              <span class="text-xs font-normal" style="color:var(--color-text-secondary);">
                · {{ 'services.detail.action.' + op.action | translate }} ·
                {{ 'services.detail.status.' + op.status | translate }}
              </span>
            }
          </h2>
        </div>
        <pre
          #consoleEl
          class="max-h-80 min-h-24 overflow-auto p-4 font-mono text-xs leading-relaxed"
          style="background:#080b12;color:#c9d1d9;"
        >@if (output()) {<span>{{ output() }}</span>} @else {<span style="color:#8b949e;">{{ 'services.detail.consoleEmpty' | translate }}</span>}@if (busy()) {<span class="animate-pulse">▋</span>}</pre>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">
            {{ 'services.detail.containers' | translate }}
            <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ s.applications.length }})</span>
          </h2>
          @if (s.applications.length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'services.detail.noContainers' | translate }}
            </p>
          } @else {
            <ul class="space-y-2 text-sm">
              @for (app of s.applications; track app.uuid) {
                <li class="flex items-center justify-between gap-2">
                  <span>
                    {{ app.name }}
                    @if (app.fqdn) {
                      <a
                        class="ml-2 text-xs hover:underline"
                        style="color:var(--color-primary-500);"
                        [href]="app.fqdn"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ app.fqdn }}</a
                      >
                    }
                  </span>
                  <span class="text-xs" style="color:var(--color-text-secondary);">{{ app.status || '—' }}</span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="glass-card p-4">
          <h2 class="mb-3 text-sm font-semibold">
            {{ 'services.detail.databases' | translate }}
            <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ s.databases.length }})</span>
          </h2>
          @if (s.databases.length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'services.detail.noDatabases' | translate }}
            </p>
          } @else {
            <ul class="space-y-2 text-sm">
              @for (db of s.databases; track db.uuid) {
                <li class="flex items-center justify-between gap-2">
                  <span>{{ db.name }}</span>
                  <span class="text-xs" style="color:var(--color-text-secondary);">{{ db.status || '—' }}</span>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <section class="glass-card p-4 mt-4">
        <h2 class="mb-3 text-sm font-semibold">{{ 'services.detail.composeFile' | translate }}</h2>
        @if (s.docker_compose_raw) {
          <pre
            class="max-h-96 overflow-auto rounded-md p-3 font-mono text-xs"
            style="background:var(--color-bg-dark);border:1px solid var(--color-surface-2);"
          >{{ s.docker_compose_raw }}</pre>
          <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">
            {{ 'services.detail.composeReadOnly' | translate }}
          </p>
        } @else {
          <p class="text-sm" style="color:var(--color-text-secondary);">
            {{ 'services.detail.noCompose' | translate }}
          </p>
        }
      </section>

      <section class="glass-card p-4 mt-4">
        <h2 class="mb-1 text-sm font-semibold">{{ 'services.detail.envTitle' | translate }}</h2>
        <p class="mb-3 text-xs" style="color:var(--color-text-secondary);">{{ 'services.detail.envHint' | translate }}</p>
        <app-env-vars-editor [(rows)]="envRows" [expected]="analysis()?.variables ?? []" />
        @for (w of analysis()?.warnings ?? []; track w.code + w.message) {
          <p class="mt-2 text-xs" style="color:var(--color-warning, var(--color-text-secondary));">{{ w.message }}</p>
        }
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button class="inner-button" (click)="saveEnv(false)" [disabled]="savingEnv() || busy()">
            {{ 'services.detail.envSave' | translate }}
          </button>
          <button class="outer-button" (click)="saveEnv(true)" [disabled]="savingEnv() || busy()">
            {{ 'services.detail.envSaveRestart' | translate }}
          </button>
          @if (envSaved()) {
            <span class="text-xs" role="status" style="color:var(--color-text-secondary);">{{ 'services.detail.envSaved' | translate }}</span>
          }
        </div>
      </section>

      <section class="glass-card p-4 mt-4" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
        <h2 class="mb-1 text-sm font-semibold">{{ 'services.detail.dangerZone' | translate }}</h2>
        <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
          {{ 'services.detail.deleteHint' | translate }}
        </p>
        <button class="outer-button" style="color:var(--color-danger);" (click)="remove()" [disabled]="deleting()">
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

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
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
