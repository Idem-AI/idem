import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import { Database, DatabaseDetail, DatabaseType } from '../../../shared/models/ideploy.models';
import { DB_ENGINES, dbEngine } from '../../../shared/utils/db-icon.util';
import { credentialLabel, isSecretField } from '../../../shared/utils/db-credentials.util';
import { GuideSessionService } from '../../../shared/services/guide-session.service';

/** The engines a step's "primary database" picker offers — the cache engines below are only ever the optional second one. */
const PRIMARY_DB_TYPES: DatabaseType[] = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'clickhouse'];

/**
 * The credential columns worth letting an operator set themselves before
 * creation — mirrors `database-types.ts`'s field registry on the backend,
 * minus each engine's root/admin-only password (mysql/mariadb): an app
 * connects with the regular user, never root, so customizing that field
 * would invite confusion for no benefit. Anything left blank at creation
 * still gets the backend's own default or a securely generated value —
 * see `ApiService.createDatabase`'s `credentials` param.
 */
const CREDENTIAL_COLUMNS: Record<DatabaseType, string[]> = {
  postgresql: ['postgres_user', 'postgres_password', 'postgres_db'],
  mysql: ['mysql_user', 'mysql_password', 'mysql_database'],
  mariadb: ['mariadb_user', 'mariadb_password', 'mariadb_database'],
  mongodb: ['mongo_initdb_root_username', 'mongo_initdb_root_password', 'mongo_initdb_database'],
  redis: ['redis_password'],
  keydb: ['keydb_password'],
  dragonfly: ['dragonfly_password'],
  clickhouse: ['clickhouse_admin_user', 'clickhouse_admin_password'],
};

type ResourceStatus = 'idle' | 'creating' | 'starting' | 'started' | 'start-failed';

/**
 * Inline "create your database" step — the SQL/Mongo engine the rest of the
 * architecture depends on, plus an optional Redis cache alongside it.
 *
 * Creating the row is instant (`createDatabase` only inserts it — see
 * `database.service.ts`, no container yet), so the real wait, and the real
 * failure mode, is the start right after it: this streams that start's live
 * output over the same realtime channel `database-detail.ts` uses, and only
 * calls the step done once the container is actually confirmed up — never
 * on the row existing alone, which is exactly the gap that let a backend get
 * pointed at a database that was created but never running (the crash-loop
 * this session traced live back to a `DATABASE_URL` nothing was listening
 * on). A failed start offers a retry and an explicit, deliberate "continue
 * anyway" rather than silently pretending it worked.
 */
@Component({
  selector: 'app-guide-db-step',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (phase() === 'form') {
        <div>
          <label class="mb-2 block text-sm">{{ 'databases.chooseEngine' | translate }}</label>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            @for (engine of primaryEngines; track engine.type) {
              <button
                type="button"
                class="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors"
                [style.border]="type() === engine.type ? '1px solid ' + engine.color : '1px solid var(--color-surface-2)'"
                [style.background]="type() === engine.type ? 'color-mix(in srgb, ' + engine.color + ' 12%, transparent)' : 'var(--color-surface-1)'"
                (click)="onTypeChange(engine.type)"
              >
                <div class="flex h-9 w-9 items-center justify-center [&_svg]:h-6 [&_svg]:w-6" [innerHTML]="iconHtml(engine.type)"></div>
                <span class="text-xs font-semibold">{{ engine.name }}</span>
              </button>
            }
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm">{{ 'databases.name' | translate }}</label>
          <input class="input" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </div>

        <button type="button" class="text-xs font-semibold hover:underline" style="color:var(--color-text-tertiary);" (click)="showAdvanced.set(!showAdvanced())">
          <i class="pi mr-1" [class.pi-chevron-right]="!showAdvanced()" [class.pi-chevron-down]="showAdvanced()"></i>
          {{ 'architectures.dbStep.advancedCredentials' | translate }}
        </button>
        @if (showAdvanced()) {
          <div class="space-y-2 rounded-xl border p-3" style="border-color:var(--color-surface-2);">
            <p class="text-xs" style="color:var(--color-text-tertiary);">{{ 'architectures.dbStep.advancedCredentialsHint' | translate }}</p>
            @for (col of primaryColumns(); track col) {
              <div>
                <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">{{ credentialLabel(col) }}</label>
                <div class="flex items-center gap-2">
                  <input
                    class="input font-mono text-xs"
                    [type]="!isSecretField(col) || revealed().has(col) ? 'text' : 'password'"
                    [value]="customCredentials()[col] || ''"
                    (input)="onCredentialInput('primary', col, $any($event.target).value)"
                  />
                  @if (isSecretField(col)) {
                    <button type="button" class="button-icon" (click)="toggleReveal(col)" [attr.aria-label]="'databases.detail.reveal' | translate">
                      <i class="pi" [class.pi-eye]="!revealed().has(col)" [class.pi-eye-slash]="revealed().has(col)"></i>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" [checked]="includeRedis()" (change)="includeRedis.set(!includeRedis())" />
          {{ 'architectures.addRedisCache' | translate }}
        </label>
        @if (includeRedis()) {
          <div class="space-y-2 rounded-xl border p-3" style="border-color:var(--color-surface-2);">
            <label class="mb-1 block text-sm">{{ 'databases.name' | translate }}</label>
            <input class="input" [ngModel]="redisName()" (ngModelChange)="redisName.set($event)" />
            <div>
              <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">{{ credentialLabel('redis_password') }}</label>
              <div class="flex items-center gap-2">
                <input
                  class="input font-mono text-xs"
                  [type]="revealed().has('redis_password') ? 'text' : 'password'"
                  [value]="redisCredentials()['redis_password'] || ''"
                  (input)="onCredentialInput('cache', 'redis_password', $any($event.target).value)"
                />
                <button type="button" class="button-icon" (click)="toggleReveal('redis_password')" [attr.aria-label]="'databases.detail.reveal' | translate">
                  <i class="pi" [class.pi-eye]="!revealed().has('redis_password')" [class.pi-eye-slash]="revealed().has('redis_password')"></i>
                </button>
              </div>
            </div>
          </div>
        }

        @if (formError()) {
          <p class="text-sm text-red-400">{{ formError() }}</p>
        }

        <button class="inner-button" type="button" [disabled]="!name().trim() || (includeRedis() && !redisName().trim())" (click)="create()">
          {{ 'databases.createDatabase' | translate }}
        </button>
      }

      @if (phase() === 'working') {
        <div class="space-y-3">
          @if (primaryDb(); as db) {
            <div class="flex items-center gap-2 text-sm">
              @if (primaryStatus() === 'started') {
                <i class="pi pi-check-circle" style="color:var(--color-success);"></i>
              } @else if (primaryStatus() === 'start-failed') {
                <i class="pi pi-exclamation-triangle" style="color:var(--color-danger);"></i>
              } @else {
                <i class="pi pi-spinner pi-spin" style="color:var(--color-primary-400);"></i>
              }
              <span>{{ (primaryStatus() === 'creating' ? 'architectures.dbStep.creatingRow' : primaryStatus() === 'started' ? 'architectures.dbStep.startedLabel' : primaryStatus() === 'start-failed' ? 'architectures.dbStep.startFailedLabel' : 'architectures.dbStep.startingContainer') | translate: { name: db.name } }}</span>
            </div>
            @if (primaryStatus() === 'start-failed') {
              <div class="ml-6">
                <p class="mb-2 text-sm text-red-400">{{ primaryStartError() }}</p>
                <div class="flex gap-3">
                  <button type="button" class="outer-button text-xs px-3 py-1.5" (click)="retryPrimaryStart()">{{ 'architectures.dbStep.retryStart' | translate }}</button>
                  <button type="button" class="text-xs font-semibold hover:underline" style="color:var(--color-text-tertiary);" (click)="continuePrimaryAnyway()">{{ 'architectures.dbStep.continueAnyway' | translate }}</button>
                </div>
              </div>
            }
          }
          @if (includeRedis() && cacheDb(); as db) {
            <div class="flex items-center gap-2 text-sm">
              @if (cacheStatus() === 'started') {
                <i class="pi pi-check-circle" style="color:var(--color-success);"></i>
              } @else if (cacheStatus() === 'start-failed') {
                <i class="pi pi-exclamation-triangle" style="color:var(--color-danger);"></i>
              } @else {
                <i class="pi pi-spinner pi-spin" style="color:var(--color-primary-400);"></i>
              }
              <span>{{ (cacheStatus() === 'creating' ? 'architectures.dbStep.creatingRow' : cacheStatus() === 'started' ? 'architectures.dbStep.startedLabel' : cacheStatus() === 'start-failed' ? 'architectures.dbStep.startFailedLabel' : 'architectures.dbStep.startingContainer') | translate: { name: db.name } }}</span>
            </div>
            @if (cacheStatus() === 'start-failed') {
              <div class="ml-6">
                <p class="mb-2 text-sm text-red-400">{{ cacheStartError() }}</p>
                <div class="flex gap-3">
                  <button type="button" class="outer-button text-xs px-3 py-1.5" (click)="retryCacheStart()">{{ 'architectures.dbStep.retryStart' | translate }}</button>
                  <button type="button" class="text-xs font-semibold hover:underline" style="color:var(--color-text-tertiary);" (click)="continueCacheAnyway()">{{ 'architectures.dbStep.continueAnyway' | translate }}</button>
                </div>
              </div>
            }
          }

          <!-- Live console: the same tail the database detail page shows while a start is in flight. -->
          @if (consoleLines().length > 0) {
            <pre class="max-h-56 overflow-auto rounded-xl p-3 font-mono text-xs leading-relaxed" style="background:#080b12;color:#c9d1d9;">@for (line of consoleLines(); track $index) {<span>{{ line }}</span>
}</pre>
          }
        </div>
      }

      @if (phase() === 'result') {
        <div class="space-y-4">
          <p class="text-sm font-semibold" style="color:var(--color-success);">
            <i class="pi pi-check-circle mr-1"></i>{{ 'architectures.dbStep.connectionInfo' | translate }}
          </p>

          @if (primaryDetail(); as detail) {
            <div class="rounded-xl border p-3" style="border-color:var(--color-surface-2);">
              <div class="mb-2 text-xs font-semibold" style="color:var(--color-text-secondary);">{{ detail.name }}</div>
              <div class="space-y-2">
                <div>
                  <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">{{ 'databases.detail.internalUrl' | translate }}</label>
                  <div class="flex items-center gap-2">
                    <input class="input font-mono text-xs" readonly [type]="revealed().has('__primary_url') ? 'text' : 'password'" [value]="detail.connection_url ?? ''" />
                    <button type="button" class="button-icon" (click)="toggleReveal('__primary_url')" [attr.aria-label]="'databases.detail.reveal' | translate"><i class="pi" [class.pi-eye]="!revealed().has('__primary_url')" [class.pi-eye-slash]="revealed().has('__primary_url')"></i></button>
                    <button type="button" class="button-icon" (click)="copy(detail.connection_url)" [attr.aria-label]="'databases.detail.copy' | translate"><i class="pi pi-copy"></i></button>
                  </div>
                </div>
                @for (col of objectKeys(detail.credentials); track col) {
                  <div>
                    <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">{{ credentialLabel(col) }}</label>
                    <div class="flex items-center gap-2">
                      <input class="input font-mono text-xs" readonly [type]="!isSecretField(col) || revealed().has(col) ? 'text' : 'password'" [value]="detail.credentials[col]" />
                      @if (isSecretField(col)) {
                        <button type="button" class="button-icon" (click)="toggleReveal(col)" [attr.aria-label]="'databases.detail.reveal' | translate"><i class="pi" [class.pi-eye]="!revealed().has(col)" [class.pi-eye-slash]="revealed().has(col)"></i></button>
                      }
                      <button type="button" class="button-icon" (click)="copy(detail.credentials[col])" [attr.aria-label]="'databases.detail.copy' | translate"><i class="pi pi-copy"></i></button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (includeRedis() && cacheDetail(); as detail) {
            <div class="rounded-xl border p-3" style="border-color:var(--color-surface-2);">
              <div class="mb-2 text-xs font-semibold" style="color:var(--color-text-secondary);">{{ detail.name }}</div>
              <div class="space-y-2">
                <div>
                  <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);">{{ 'databases.detail.internalUrl' | translate }}</label>
                  <div class="flex items-center gap-2">
                    <input class="input font-mono text-xs" readonly [type]="revealed().has('__cache_url') ? 'text' : 'password'" [value]="detail.connection_url ?? ''" />
                    <button type="button" class="button-icon" (click)="toggleReveal('__cache_url')" [attr.aria-label]="'databases.detail.reveal' | translate"><i class="pi" [class.pi-eye]="!revealed().has('__cache_url')" [class.pi-eye-slash]="revealed().has('__cache_url')"></i></button>
                    <button type="button" class="button-icon" (click)="copy(detail.connection_url)" [attr.aria-label]="'databases.detail.copy' | translate"><i class="pi pi-copy"></i></button>
                  </div>
                </div>
              </div>
            </div>
          }

          <p class="text-xs" style="color:var(--color-text-tertiary);">{{ 'architectures.dbStep.readyHint' | translate }}</p>

          <button class="inner-button" type="button" (click)="finish()">{{ 'projects.new.continue' | translate }}</button>
        </div>
      }
    </div>
  `,
})
export class GuideDbStepComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);
  private realtime = inject(RealtimeService);
  private guideSession = inject(GuideSessionService);

  readonly architectureId = input.required<string>();
  readonly workspaceUuid = input.required<string>();
  readonly suggestedName = input<string>('database');
  readonly completed = output<void>();

  protected readonly primaryEngines = DB_ENGINES.filter((e) => PRIMARY_DB_TYPES.includes(e.type));
  protected readonly credentialLabel = credentialLabel;
  protected readonly isSecretField = isSecretField;
  protected readonly objectKeys = Object.keys;

  protected readonly phase = signal<'form' | 'working' | 'result'>('form');
  protected readonly type = signal<DatabaseType>('postgresql');
  protected readonly name = signal('');
  protected readonly includeRedis = signal(false);
  protected readonly redisName = signal('');
  protected readonly showAdvanced = signal(false);
  protected readonly customCredentials = signal<Record<string, string>>({});
  protected readonly redisCredentials = signal<Record<string, string>>({});
  protected readonly revealed = signal<Set<string>>(new Set());
  protected readonly formError = signal<string | null>(null);

  protected readonly primaryDb = signal<Database | null>(null);
  protected readonly primaryDetail = signal<DatabaseDetail | null>(null);
  protected readonly primaryStatus = signal<ResourceStatus>('idle');
  protected readonly primaryStartError = signal<string | null>(null);

  protected readonly cacheDb = signal<Database | null>(null);
  protected readonly cacheDetail = signal<DatabaseDetail | null>(null);
  protected readonly cacheStatus = signal<ResourceStatus>('idle');
  protected readonly cacheStartError = signal<string | null>(null);

  protected readonly consoleLines = signal<string[]>([]);

  private readonly iconCache = new Map<DatabaseType, SafeHtml>();
  private unsubscribeRealtime?: () => void;

  protected primaryColumns(): string[] {
    return CREDENTIAL_COLUMNS[this.type()];
  }

  ngOnInit(): void {
    this.name.set(this.suggestedName());
    this.redisName.set(`${this.suggestedName()}-cache`);
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
  }

  protected onTypeChange(type: DatabaseType): void {
    this.type.set(type);
    // Column names are engine-specific — values typed for a Postgres user/db don't mean anything once MySQL is picked.
    this.customCredentials.set({});
  }

  protected onCredentialInput(target: 'primary' | 'cache', col: string, value: string): void {
    const sig = target === 'primary' ? this.customCredentials : this.redisCredentials;
    sig.update((creds) => ({ ...creds, [col]: value }));
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

  /** Trusted markup — hand-authored SVGs in `db-icon.util.ts`, never user input. */
  protected iconHtml(type: DatabaseType): SafeHtml {
    let html = this.iconCache.get(type);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(dbEngine(type).svg);
      this.iconCache.set(type, html);
    }
    return html;
  }

  /** Only fields the operator actually typed override the backend's own default/generated value — a blank field must stay unset, not become an empty-string credential. */
  private nonEmpty(record: Record<string, string>): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(record)) if (v.trim()) out[k] = v.trim();
    return Object.keys(out).length > 0 ? out : undefined;
  }

  protected create(): void {
    if (!this.name().trim()) return;
    this.formError.set(null);
    this.phase.set('working');
    this.primaryStatus.set('creating');
    this.api
      .createDatabase(this.type(), { name: this.name().trim(), workspace_uuid: this.workspaceUuid(), credentials: this.nonEmpty(this.customCredentials()) })
      .subscribe({
        next: (db) => {
          this.primaryDb.set(db);
          this.api.getDatabase(db.type, db.uuid).subscribe({
            next: (detail) => this.primaryDetail.set(detail),
            error: () => undefined,
          });
          this.startPrimary(db);
        },
        error: (e) => {
          this.phase.set('form');
          this.primaryStatus.set('idle');
          this.formError.set(e?.error?.error?.message ?? this.translate.instant('databases.createError'));
        },
      });
  }

  private startPrimary(db: Database): void {
    this.primaryStatus.set('starting');
    this.primaryStartError.set(null);
    this.consoleLines.set([]);
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.realtime.subscribeToDatabase(db.uuid, (line) => this.consoleLines.update((lines) => [...lines, line]));
    this.api.dbLifecycle(db.type, db.uuid, 'start').subscribe({
      next: () => {
        this.unsubscribeRealtime?.();
        this.primaryStatus.set('started');
        this.api.getDatabase(db.type, db.uuid).subscribe({
          next: (detail) => {
            this.primaryDetail.set(detail);
            this.afterPrimaryDone();
          },
          error: () => this.afterPrimaryDone(),
        });
      },
      error: (e) => {
        this.unsubscribeRealtime?.();
        this.primaryStatus.set('start-failed');
        this.primaryStartError.set(e?.error?.error?.message ?? this.translate.instant('databases.detail.lifecycleError'));
      },
    });
  }

  protected retryPrimaryStart(): void {
    const db = this.primaryDb();
    if (db) this.startPrimary(db);
  }

  /** A deliberate, visible override — never automatic — for when the operator knows the failure doesn't matter here (e.g. they'll start it manually later). */
  protected continuePrimaryAnyway(): void {
    if (this.primaryDb()) this.afterPrimaryDone();
  }

  private afterPrimaryDone(): void {
    if (this.includeRedis()) this.createCache();
    else this.phase.set('result');
  }

  private createCache(): void {
    this.cacheStatus.set('creating');
    this.api
      .createDatabase('redis', { name: this.redisName().trim(), workspace_uuid: this.workspaceUuid(), credentials: this.nonEmpty(this.redisCredentials()) })
      .subscribe({
        next: (db) => {
          this.cacheDb.set(db);
          this.api.getDatabase(db.type, db.uuid).subscribe({
            next: (detail) => this.cacheDetail.set(detail),
            error: () => undefined,
          });
          this.startCache(db);
        },
        // The primary database is real and unaffected — only the optional
        // cache failed to even get created. Don't block on it.
        error: (e) => {
          this.cacheStatus.set('start-failed');
          this.cacheStartError.set(e?.error?.error?.message ?? this.translate.instant('databases.createError'));
        },
      });
  }

  private startCache(db: Database): void {
    this.cacheStatus.set('starting');
    this.cacheStartError.set(null);
    this.consoleLines.set([]);
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.realtime.subscribeToDatabase(db.uuid, (line) => this.consoleLines.update((lines) => [...lines, line]));
    this.api.dbLifecycle(db.type, db.uuid, 'start').subscribe({
      next: () => {
        this.unsubscribeRealtime?.();
        this.cacheStatus.set('started');
        this.api.getDatabase(db.type, db.uuid).subscribe({
          next: (detail) => {
            this.cacheDetail.set(detail);
            this.phase.set('result');
          },
          error: () => this.phase.set('result'),
        });
      },
      error: (e) => {
        this.unsubscribeRealtime?.();
        this.cacheStatus.set('start-failed');
        this.cacheStartError.set(e?.error?.error?.message ?? this.translate.instant('databases.detail.lifecycleError'));
      },
    });
  }

  protected retryCacheStart(): void {
    const db = this.cacheDb();
    if (db) this.startCache(db);
  }

  /** The cache is optional — unlike the primary database, proceeding without it just means a `REDIS_URL`-shaped variable won't auto-fill later, not a broken backend. */
  protected continueCacheAnyway(): void {
    this.phase.set('result');
  }

  /**
   * Only now — once the operator has actually seen the credentials and had
   * the chance to copy them — does this step register as done. Linking any
   * earlier (e.g. right when the start succeeded) would flip the parent
   * guide's `isDone()` immediately, which destroys this component the same
   * render pass and takes the connection-info screen down with it before
   * anyone could read it.
   */
  protected finish(): void {
    const db = this.primaryDb();
    if (db) {
      this.guideSession.linkDatabase(this.architectureId(), { uuid: db.uuid, type: db.type, name: db.name, connectionUrl: this.primaryDetail()?.connection_url ?? null });
    }
    if (this.includeRedis()) {
      const cache = this.cacheDb();
      if (cache) {
        this.guideSession.linkCache(this.architectureId(), { uuid: cache.uuid, type: cache.type, name: cache.name, connectionUrl: this.cacheDetail()?.connection_url ?? null });
      }
    }
    this.completed.emit();
  }
}
