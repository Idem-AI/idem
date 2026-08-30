import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import {
  CrowdSecStatus,
  Destination,
  ProxyStatus,
  Server,
  ServerCheck,
  ServerHealth,
  ServerReadiness,
  ServerResource,
  SslCertificate,
} from '../../../shared/models/ideploy.models';

/**
 * Server detail — everything about one host in one screen.
 *
 * The legacy UI split this across a dozen Livewire components behind a navbar
 * (Show, Resources, Destinations, Proxy, Security, CaCertificate…). Sections
 * that only report state load with the page; anything that costs an SSH round
 * trip (health, readiness, proxy, CrowdSec) is fetched on demand, so opening a
 * server never blocks on a host that may be unreachable.
 */
@Component({
  selector: 'app-server-detail',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/servers"
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
    >
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
      {{ 'servers.detail.backToList' | translate }}
    </a>

    @if (loading()) {
      <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'servers.loading' | translate }}</p>
    } @else if (server(); as s) {
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
            {{ s.name }}
          </h1>
          <p class="mt-1 font-mono text-sm" style="color:var(--color-text-secondary);">
            {{ s.user }}&#64;{{ s.ip }}:{{ s.port }}
          </p>
          @if (s.description) {
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ s.description }}</p>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <a class="button-secondary" [routerLink]="['/servers', s.uuid, 'terminal']">
            <i class="fa-solid fa-terminal mr-2"></i>{{ 'terminal.open' | translate }}
          </a>
          <button class="button-secondary" (click)="validate()" [disabled]="validating()">
            {{ (validating() ? 'servers.detail.validating' : 'servers.validate') | translate }}
          </button>
          <button class="button" (click)="setUp()" [disabled]="settingUp()">
            {{ (settingUp() ? 'servers.settingUp' : 'servers.setUp') | translate }}
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
      }

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Health: one SSH round trip, on demand. -->
        <section class="box">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">{{ 'servers.detail.health' | translate }}</h2>
            <button class="text-xs" style="color:var(--color-text-secondary);" (click)="checkHealth()" [disabled]="probing()">
              {{ (probing() ? 'servers.detail.probing' : 'servers.detail.probe') | translate }}
            </button>
          </div>
          @if (health(); as h) {
            <dl class="space-y-2 text-sm">
              <div class="flex items-center justify-between gap-2">
                <dt style="color:var(--color-text-secondary);">{{ 'servers.detail.reachability' | translate }}</dt>
                <dd [style.color]="h.reachable ? 'var(--color-success)' : 'var(--color-danger)'">
                  {{ (h.reachable ? 'servers.detail.reachable' : 'servers.detail.unreachable') | translate }}
                </dd>
              </div>
              @if (h.diskUsedPercent !== null) {
                <div class="flex items-center justify-between gap-2">
                  <dt style="color:var(--color-text-secondary);">{{ 'servers.detail.diskUsage' | translate }}</dt>
                  <dd style="font-variant-numeric:tabular-nums;" [style.color]="diskColor(h.diskUsedPercent)">
                    {{ h.diskUsedPercent }}%
                  </dd>
                </div>
                <!-- A bar reads at a glance where a number has to be interpreted. -->
                <div
                  class="h-1.5 w-full overflow-hidden rounded-full"
                  style="background:var(--color-surface-2);"
                  role="img"
                  [attr.aria-label]="'servers.detail.diskUsage' | translate"
                >
                  <div
                    class="h-full rounded-full"
                    [style.width.%]="h.diskUsedPercent"
                    [style.background]="diskColor(h.diskUsedPercent)"
                  ></div>
                </div>
              }
            </dl>
          } @else {
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'servers.detail.healthHint' | translate }}
            </p>
          }
          <button class="button-secondary mt-3" (click)="dockerCleanup()" [disabled]="cleaning()">
            {{ (cleaning() ? 'servers.detail.cleaning' : 'servers.detail.dockerCleanup') | translate }}
          </button>
          @if (cleanupOutput(); as out) {
            <pre class="mt-2 max-h-40 overflow-auto rounded-md p-2 font-mono text-xs" style="background:var(--color-bg-dark);border:1px solid var(--color-surface-2);">{{ out }}</pre>
          }
        </section>

        <!-- Readiness: the same report the list screen shows, in full. -->
        <section class="box">
          <h2 class="mb-3 text-sm font-semibold">{{ 'servers.detail.readiness' | translate }}</h2>
          @if (readiness(); as r) {
            <p class="mb-2 text-sm font-semibold" [style.color]="r.ready ? 'var(--color-success)' : 'var(--color-danger)'">
              {{ (r.ready ? 'servers.ready' : 'servers.notReady') | translate }}
            </p>
            <ul class="space-y-1.5 text-sm">
              @for (check of r.checks; track check.id) {
                @if (check.status !== 'skipped') {
                  <li class="flex gap-2">
                    <span aria-hidden="true" [style.color]="checkColor(check.status)">{{ statusMark(check.status) }}</span>
                    <span>
                      {{ check.label }}
                      @if (check.detail) {
                        <span style="color:var(--color-text-secondary);"> — {{ check.detail }}</span>
                      }
                      @if (check.remedy) {
                        <span class="mt-0.5 block text-xs" style="color:var(--color-warning);">{{ check.remedy }}</span>
                      }
                    </span>
                  </li>
                }
              }
            </ul>
          } @else {
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'servers.detail.readinessHint' | translate }}
            </p>
          }
        </section>

        <!-- Live setup/cleanup output — streamed over the server-provision.{uuid}
             Soketi channel while "Configurer" or the Docker cleanup runs, kept
             on screen afterwards so a failure is explained, not just reported. -->
        @if (provisionLines().length > 0) {
          <section class="box lg:col-span-2">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-sm font-semibold">
                {{ 'servers.detail.console' | translate }}
                @if (settingUp() || cleaning()) {
                  <span class="flex items-center gap-1.5 text-xs font-normal" style="color:var(--color-primary-400);">
                    <span class="inline-block h-2 w-2 animate-pulse rounded-full" style="background:currentColor;"></span>
                    {{ 'servers.detail.inProgress' | translate }}
                  </span>
                } @else {
                  <span class="text-xs font-normal" style="color:var(--color-text-secondary);">
                    {{ 'servers.detail.consoleDone' | translate }}
                  </span>
                }
              </h2>
              <button class="text-xs" style="color:var(--color-text-secondary);" (click)="clearConsole()">
                {{ 'servers.detail.clearConsole' | translate }}
              </button>
            </div>
            <pre
              #consoleEl
              class="max-h-80 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed"
              style="background:#080b12;color:#c9d1d9;border:1px solid var(--color-surface-2);"
            >@for (line of provisionLines(); track $index) {<span>{{ line }}</span>
}@if (settingUp() || cleaning()) {<span class="inline-block animate-pulse">▋</span>}</pre>
          </section>
        }

        <!-- Proxy -->
        <section class="box">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">{{ 'servers.detail.proxy' | translate }}</h2>
            <button class="text-xs" style="color:var(--color-text-secondary);" (click)="refreshProxy()">
              {{ 'servers.detail.refresh' | translate }}
            </button>
          </div>
          @if (proxy(); as p) {
            <p class="mb-3 text-sm">
              <span style="color:var(--color-text-secondary);">{{ 'servers.detail.state' | translate }}</span>
              <span class="ml-2 font-semibold" [style.color]="proxyColor(p.status)">
                {{ 'servers.detail.proxyState.' + p.status | translate }}
              </span>
            </p>
          } @else {
            <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
              {{ 'servers.detail.proxyHint' | translate }}
            </p>
          }
          <div class="flex gap-2">
            <button class="button-secondary" (click)="startProxy()" [disabled]="proxyBusy()">
              {{ 'servers.startProxy' | translate }}
            </button>
            <button class="button-secondary" (click)="stopProxy()" [disabled]="proxyBusy()">
              {{ 'servers.detail.stopProxy' | translate }}
            </button>
            <button class="text-xs" style="color:var(--color-text-secondary);" (click)="toggleProxyConfig()">
              {{ (proxyConfig() !== null ? 'servers.detail.hideConfig' : 'servers.detail.viewConfig') | translate }}
            </button>
          </div>
          @if (proxyConfig() !== null) {
            <pre class="mt-3 max-h-64 overflow-auto rounded-md p-3 font-mono text-xs" style="background:var(--color-bg-dark);border:1px solid var(--color-surface-2);">{{ proxyConfig() || ('servers.detail.noConfig' | translate) }}</pre>
          }

          <!--
            sslip.io resolves correctly everywhere — verified repeatedly against
            public resolvers — but some client-side/ISP DNS resolvers refuse or
            rate-limit dynamic-DNS-style domains, which nothing on the server
            side can fix. A domain the operator actually controls, with a
            wildcard record pointed at this server, has no such failure mode.
          -->
          <form class="mt-4 pt-4" style="border-top:1px solid var(--color-surface-2);" [formGroup]="wildcardForm" (ngSubmit)="saveWildcardDomain()">
            <label class="mb-1 block text-sm font-medium" for="wildcard-domain">
              {{ 'servers.detail.wildcardDomain' | translate }}
            </label>
            <p class="mb-2 text-xs" style="color:var(--color-text-secondary);">
              {{ 'servers.detail.wildcardDomainHint' | translate: { ip: server()?.ip ?? '' } }}
            </p>
            <div class="flex gap-2">
              <input class="input flex-1" id="wildcard-domain" formControlName="wildcardDomain" placeholder="apps.example.com" />
              <button class="button-secondary" type="submit" [disabled]="savingWildcard()">
                {{ (savingWildcard() ? 'servers.detail.saving' : 'servers.detail.save') | translate }}
              </button>
            </div>
            @if (wildcardSaved()) {
              <p class="mt-2 text-xs" style="color:var(--color-success);">{{ 'servers.detail.wildcardSaved' | translate }}</p>
            }
          </form>
        </section>

        <!-- Docker networks resources are deployed onto. -->
        <section class="box">
          <h2 class="mb-3 text-sm font-semibold">{{ 'servers.detail.destinations' | translate }}</h2>
          @if (destinations().length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">
              {{ 'servers.detail.noDestinations' | translate }}
            </p>
          } @else {
            <ul class="space-y-2 text-sm">
              @for (d of destinations(); track d.uuid) {
                <li class="flex items-center justify-between gap-2">
                  <span>
                    {{ d.name }}
                    <code class="ml-2 text-xs" style="color:var(--color-text-secondary);">{{ d.network }}</code>
                  </span>
                  <button class="text-xs" style="color:var(--color-danger);" (click)="removeDestination(d)">
                    {{ 'servers.detail.delete' | translate }}
                  </button>
                </li>
              }
            </ul>
          }
          <form class="mt-3 flex gap-2" [formGroup]="destinationForm" (ngSubmit)="addDestination()">
            <input
              class="input flex-1"
              formControlName="network"
              [placeholder]="'servers.detail.networkPlaceholder' | translate"
            />
            <button class="button" type="submit" [disabled]="destinationForm.invalid">
              {{ 'servers.detail.add' | translate }}
            </button>
          </form>
        </section>
      </div>

      <!-- What is deployed here. Deleting a server refuses while this is non-empty. -->
      <section class="box mt-4">
        <h2 class="mb-3 text-sm font-semibold">
          {{ 'servers.detail.deployedResources' | translate }}
          <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ resources().length }})</span>
        </h2>
        @if (resources().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">
            {{ 'servers.detail.noResources' | translate }}
          </p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="color:var(--color-text-secondary);">
                  <th class="py-1.5 pr-3 text-left font-medium">{{ 'servers.detail.resourceName' | translate }}</th>
                  <th class="py-1.5 pr-3 text-left font-medium">{{ 'servers.detail.resourceKind' | translate }}</th>
                  <th class="py-1.5 text-left font-medium">{{ 'servers.detail.resourceStatus' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of resources(); track r.kind + r.uuid) {
                  <tr style="border-top:1px solid var(--color-surface-2);">
                    <td class="py-1.5 pr-3">
                      @if (r.kind === 'application') {
                        <a class="hover:underline" [routerLink]="['/applications', r.uuid]">{{ r.name }}</a>
                      } @else {
                        {{ r.name }}
                      }
                    </td>
                    <td class="py-1.5 pr-3" style="color:var(--color-text-secondary);">
                      {{ 'servers.detail.kind.' + r.kind | translate }}
                      @if (r.databaseType) {
                        <span class="ml-1">· {{ r.databaseType }}</span>
                      }
                    </td>
                    <td class="py-1.5" style="color:var(--color-text-secondary);">{{ r.status || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Security: agent + certificates held on this host. -->
      <section class="box mt-4">
        <h2 class="mb-3 text-sm font-semibold">{{ 'servers.detail.security' | translate }}</h2>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <span class="text-sm" style="color:var(--color-text-secondary);">{{ 'servers.detail.crowdsec' | translate }}</span>
          @if (crowdsec(); as c) {
            <span class="text-sm font-semibold" [style.color]="c.running ? 'var(--color-success)' : 'var(--color-text-secondary)'">
              {{ (c.running ? 'servers.detail.crowdsecRunning' : 'servers.detail.crowdsecStopped') | translate }}
            </span>
          }
          <button class="text-xs" style="color:var(--color-text-secondary);" (click)="refreshCrowdSec()">
            {{ 'servers.detail.refresh' | translate }}
          </button>
          <button class="button-secondary" (click)="installCrowdSec()" [disabled]="crowdsecBusy()">
            {{ (crowdsecBusy() ? 'servers.detail.installing' : 'servers.installCrowdSec') | translate }}
          </button>
        </div>

        @if (crowdsec()?.running) {
          <form class="mb-4 flex flex-wrap items-center gap-2" [formGroup]="bouncerForm" (ngSubmit)="addBouncer()">
            <span class="text-sm" style="color:var(--color-text-secondary);">{{ 'servers.detail.bouncer' | translate }}</span>
            <input class="input w-48" formControlName="name" [placeholder]="'servers.detail.bouncerNamePlaceholder' | translate" />
            <button class="button-secondary" type="submit" [disabled]="bouncerForm.invalid">
              {{ 'servers.detail.addBouncer' | translate }}
            </button>
          </form>
          @if (bouncerKey()) {
            <div class="mb-4 rounded-lg p-3 text-sm" role="status" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);">
              <p class="mb-1 font-semibold" style="color:var(--color-success);">{{ 'servers.detail.bouncerKeyOnce' | translate }}</p>
              <code class="block overflow-x-auto font-mono text-xs">{{ bouncerKey() }}</code>
            </div>
          }
        }

        <h3 class="mb-2 text-sm font-semibold">{{ 'servers.detail.certificates' | translate }}</h3>
        @if (certificates().length === 0) {
          <p class="text-sm" style="color:var(--color-text-secondary);">
            {{ 'servers.detail.noCertificates' | translate }}
          </p>
        } @else {
          <ul class="space-y-2 text-sm">
            @for (c of certificates(); track c.id) {
              <li class="flex items-center justify-between gap-2">
                <span>
                  <code>{{ c.common_name }}</code>
                  @if (c.is_ca_certificate) {
                    <span class="ml-2 text-xs" style="color:var(--color-text-secondary);">
                      {{ 'servers.detail.certificateAuthority' | translate }}
                    </span>
                  }
                  <span class="ml-2 text-xs" style="color:var(--color-text-secondary);">
                    {{ 'servers.detail.validUntil' | translate }} {{ c.valid_until }}
                  </span>
                </span>
                <button class="text-xs" style="color:var(--color-danger);" (click)="removeCertificate(c)">
                  {{ 'servers.detail.delete' | translate }}
                </button>
              </li>
            }
          </ul>
        }
        <form class="mt-3 flex flex-wrap gap-2" [formGroup]="certificateForm" (ngSubmit)="addCertificate()">
          <input
            class="input flex-1"
            formControlName="common_name"
            [placeholder]="'servers.detail.commonNamePlaceholder' | translate"
          />
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="is_ca" />
            {{ 'servers.detail.isCa' | translate }}
          </label>
          <button class="button" type="submit" [disabled]="certificateForm.invalid">
            {{ 'servers.detail.generate' | translate }}
          </button>
        </form>
      </section>

      <!-- Destructive, and refused by the API while resources remain. -->
      <section class="box mt-4" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
        <h2 class="mb-1 text-sm font-semibold">{{ 'servers.detail.dangerZone' | translate }}</h2>
        <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
          {{ 'servers.detail.deleteHint' | translate }}
        </p>
        <button class="button-secondary" style="color:var(--color-danger);" (click)="remove()" [disabled]="deleting()">
          {{ (deleting() ? 'servers.detail.deleting' : 'servers.detail.deleteServer') | translate }}
        </button>
      </section>
    } @else {
      <p class="text-sm" style="color:var(--color-danger);">{{ 'servers.detail.notFound' | translate }}</p>
    }
  `,
})
export class ServerDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private realtime = inject(RealtimeService);

  protected readonly server = signal<Server | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly health = signal<ServerHealth | null>(null);
  protected readonly readiness = signal<ServerReadiness | null>(null);
  protected readonly proxy = signal<ProxyStatus | null>(null);
  protected readonly destinations = signal<Destination[]>([]);
  protected readonly resources = signal<ServerResource[]>([]);
  protected readonly certificates = signal<SslCertificate[]>([]);
  protected readonly crowdsec = signal<CrowdSecStatus | null>(null);
  /** Null = not fetched yet; empty string is a valid (if unusual) empty config. */
  protected readonly proxyConfig = signal<string | null>(null);
  /** Shown once — CrowdSec bouncer keys are not retrievable after creation. */
  protected readonly bouncerKey = signal<string | null>(null);

  protected readonly probing = signal(false);
  protected readonly validating = signal(false);
  protected readonly settingUp = signal(false);
  protected readonly proxyBusy = signal(false);
  protected readonly crowdsecBusy = signal(false);
  protected readonly deleting = signal(false);
  protected readonly cleaning = signal(false);
  protected readonly cleanupOutput = signal<string | null>(null);

  /** Live setup/cleanup script output, streamed over Soketi while it runs. */
  protected readonly provisionLines = signal<string[]>([]);
  private unsubscribeProvision?: () => void;
  private readonly consoleEl = viewChild<ElementRef<HTMLElement>>('consoleEl');

  constructor() {
    // Keeps the console pinned to its latest line as it streams in — the
    // single biggest reason "Configurer" read as frozen: new output was
    // arriving below the fold with nothing telling the eye to look there.
    effect(() => {
      this.provisionLines();
      const el = this.consoleEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private uuid = '';

  protected readonly destinationForm = this.fb.nonNullable.group({
    network: ['', Validators.required],
  });

  protected readonly bouncerForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  protected readonly certificateForm = this.fb.nonNullable.group({
    common_name: ['', Validators.required],
    is_ca: [false],
  });

  protected readonly wildcardForm = this.fb.nonNullable.group({
    wildcardDomain: [''],
  });
  protected readonly savingWildcard = signal(false);
  protected readonly wildcardSaved = signal(false);

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';

    this.api.getServer(this.uuid).subscribe({
      next: (s) => {
        this.server.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api.getServerSettings(this.uuid).subscribe((s) => {
      this.wildcardForm.patchValue({ wildcardDomain: s.wildcardDomain ?? '' });
    });

    // Cheap, database-only reads: safe to load with the page.
    this.api.listServerResources(this.uuid).subscribe((r) => this.resources.set(r));
    this.api.listDestinations(this.uuid).subscribe((d) => this.destinations.set(d));
    this.api.listCertificates(this.uuid).subscribe((c) => this.certificates.set(c));
  }

  /** Surface the API's own message; fall back to a generic one only if absent. */
  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected statusMark(status: ServerCheck['status']): string {
    return status === 'ok' ? '✓' : status === 'warning' ? '!' : '✕';
  }

  protected checkColor(status: ServerCheck['status']): string {
    if (status === 'ok') return 'var(--color-success)';
    if (status === 'warning') return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  /** Disk pressure is the failure that arrives silently — colour it before it bites. */
  protected diskColor(percent: number): string {
    if (percent >= 90) return 'var(--color-danger)';
    if (percent >= 80) return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  protected proxyColor(status: ProxyStatus['status']): string {
    if (status === 'running') return 'var(--color-success)';
    if (status === 'stopped') return 'var(--color-danger)';
    return 'var(--color-text-secondary)';
  }

  protected checkHealth(): void {
    this.probing.set(true);
    this.error.set(null);
    this.api.getServerHealth(this.uuid).subscribe({
      next: (h) => {
        this.health.set(h);
        this.probing.set(false);
      },
      error: (e) => {
        this.report(e, 'servers.detail.healthError');
        this.probing.set(false);
      },
    });
  }

  protected validate(): void {
    this.validating.set(true);
    this.error.set(null);
    this.api.validateServer(this.uuid).subscribe({
      next: (r) => {
        this.readiness.set(r);
        this.validating.set(false);
      },
      error: (e) => {
        this.report(e, 'servers.detail.validateError');
        this.validating.set(false);
      },
    });
  }

  /** Setup re-checks readiness itself, so its report replaces the current one. */
  protected setUp(): void {
    this.settingUp.set(true);
    this.error.set(null);
    this.openConsole();
    this.api.setUpServer(this.uuid).subscribe({
      next: (result) => {
        this.readiness.set(result.readiness);
        this.settingUp.set(false);
        this.unsubscribeProvision?.();
        // A successful setup starts the proxy on its own (server-side) — show
        // that immediately rather than leaving stale "not checked yet" state
        // on screen until the operator thinks to click "Actualiser".
        if (result.success) this.refreshProxy();
      },
      error: (e) => {
        this.report(e, 'servers.detail.setUpError');
        this.settingUp.set(false);
        this.unsubscribeProvision?.();
      },
    });
  }

  /** Reclaim disk space. Named volumes are never touched — see the API docstring. */
  protected dockerCleanup(): void {
    this.cleaning.set(true);
    this.error.set(null);
    this.cleanupOutput.set(null);
    this.openConsole();
    this.api.dockerCleanup(this.uuid).subscribe({
      next: (result) => {
        this.cleanupOutput.set(result.output);
        this.cleaning.set(false);
        this.unsubscribeProvision?.();
        this.checkHealth();
      },
      error: (e) => {
        this.report(e, 'servers.detail.cleanupError');
        this.cleaning.set(false);
        this.unsubscribeProvision?.();
      },
    });
  }

  /** Starts fresh and subscribes to this server's live script-output channel. */
  private openConsole(): void {
    this.unsubscribeProvision?.();
    this.provisionLines.set([]);
    this.unsubscribeProvision = this.realtime.subscribeToServerProvision(this.uuid, (line) => {
      this.provisionLines.update((lines) => [...lines, line]);
    });
  }

  protected clearConsole(): void {
    this.provisionLines.set([]);
  }

  protected refreshProxy(): void {
    this.api.getProxyStatus(this.uuid).subscribe({
      next: (p) => this.proxy.set(p),
      error: (e) => this.report(e, 'servers.detail.proxyError'),
    });
  }

  /**
   * A domain the operator actually controls, pointed at this server, replaces
   * sslip.io for every application's auto-generated FQDN from here on —
   * existing applications keep their current domain until redeployed, same
   * as any other label change (see `application-labels.service.ts`).
   */
  protected saveWildcardDomain(): void {
    this.savingWildcard.set(true);
    this.wildcardSaved.set(false);
    this.api
      .updateServerSettings(this.uuid, { wildcardDomain: this.wildcardForm.getRawValue().wildcardDomain || null })
      .subscribe({
        next: (s) => {
          this.wildcardForm.patchValue({ wildcardDomain: s.wildcardDomain ?? '' });
          this.savingWildcard.set(false);
          this.wildcardSaved.set(true);
        },
        error: (e) => {
          this.report(e, 'servers.detail.wildcardError');
          this.savingWildcard.set(false);
        },
      });
  }

  protected startProxy(): void {
    this.proxyBusy.set(true);
    this.api.startProxy(this.uuid).subscribe({
      next: () => {
        this.proxyBusy.set(false);
        this.refreshProxy();
      },
      error: (e) => {
        this.report(e, 'servers.detail.proxyError');
        this.proxyBusy.set(false);
      },
    });
  }

  protected stopProxy(): void {
    this.proxyBusy.set(true);
    this.api.stopProxy(this.uuid).subscribe({
      next: () => {
        this.proxyBusy.set(false);
        this.refreshProxy();
      },
      error: (e) => {
        this.report(e, 'servers.detail.proxyError');
        this.proxyBusy.set(false);
      },
    });
  }

  protected toggleProxyConfig(): void {
    if (this.proxyConfig() !== null) {
      this.proxyConfig.set(null);
      return;
    }
    this.api.getProxyConfiguration(this.uuid).subscribe({
      next: (cfg) => this.proxyConfig.set(cfg),
      error: (e) => this.report(e, 'servers.detail.proxyError'),
    });
  }

  protected addDestination(): void {
    if (this.destinationForm.invalid) return;
    this.api.createDestination(this.uuid, this.destinationForm.getRawValue()).subscribe({
      next: (d) => {
        this.destinations.update((list) => [...list, d]);
        this.destinationForm.reset({ network: '' });
      },
      error: (e) => this.report(e, 'servers.detail.destinationError'),
    });
  }

  protected removeDestination(d: Destination): void {
    this.api.deleteDestination(d.uuid).subscribe({
      next: () => this.destinations.update((list) => list.filter((x) => x.uuid !== d.uuid)),
      error: (e) => this.report(e, 'servers.detail.destinationError'),
    });
  }

  protected refreshCrowdSec(): void {
    this.api.crowdSecStatus(this.uuid).subscribe({
      next: (c) => this.crowdsec.set(c),
      error: (e) => this.report(e, 'servers.detail.crowdsecError'),
    });
  }

  protected installCrowdSec(): void {
    this.crowdsecBusy.set(true);
    this.error.set(null);
    this.api.installCrowdSec(this.uuid).subscribe({
      next: () => {
        this.crowdsecBusy.set(false);
        this.refreshCrowdSec();
      },
      error: (e) => {
        this.report(e, 'servers.detail.crowdsecError');
        this.crowdsecBusy.set(false);
      },
    });
  }

  protected addBouncer(): void {
    if (this.bouncerForm.invalid) return;
    this.error.set(null);
    this.bouncerKey.set(null);
    this.api.addCrowdSecBouncer(this.uuid, this.bouncerForm.getRawValue().name).subscribe({
      next: (r) => {
        this.bouncerKey.set(r.key ?? null);
        this.bouncerForm.reset({ name: '' });
      },
      error: (e) => this.report(e, 'servers.detail.bouncerError'),
    });
  }

  protected addCertificate(): void {
    if (this.certificateForm.invalid) return;
    this.api.generateCertificate(this.uuid, this.certificateForm.getRawValue()).subscribe({
      next: (c) => {
        this.certificates.update((list) => [...list, c]);
        this.certificateForm.reset({ common_name: '', is_ca: false });
      },
      error: (e) => this.report(e, 'servers.detail.certificateError'),
    });
  }

  protected removeCertificate(c: SslCertificate): void {
    this.api.deleteCertificate(this.uuid, c.id).subscribe({
      next: () => this.certificates.update((list) => list.filter((x) => x.id !== c.id)),
      error: (e) => this.report(e, 'servers.detail.certificateError'),
    });
  }

  /**
   * The API refuses while resources are still deployed, and says which ones.
   * That refusal is shown rather than swallowed — it is the useful answer.
   */
  protected remove(): void {
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteServer(this.uuid).subscribe({
      next: () => this.router.navigate(['/servers']),
      error: (e) => {
        this.report(e, 'servers.detail.deleteError');
        this.deleting.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeProvision?.();
  }
}
