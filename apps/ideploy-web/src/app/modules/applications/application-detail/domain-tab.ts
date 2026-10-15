import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Application, DomainDnsCheck, DomainDnsGuide } from '../../../shared/models/ideploy.models';
import { IllustrationComponent } from '../../../shared/components/illustration/illustration';
import { DomainOptionsComponent } from './domain-options';
import { DomainWizardComponent } from './domain-wizard';
import { bareHost } from './domain-providers';

/** How often DNS is read again while a domain is still being set up, and for how long. */
const POLL_MS = 30_000;
const MAX_POLLS = 20;

/** Row shown for one address, whether or not DNS has been read yet. */
interface DomainRow {
  host: string;
  check: DomainDnsCheck | null;
  /** The IDEM address (`monprojet.idem.africa`) or another automatic one. */
  automatic: boolean;
  primary: boolean;
  live: boolean;
}

/**
 * The "Domain" tab: where the application answers, and connecting one's own
 * domain.
 *
 * The IDEM address is there from the first deployment, so the tab is never
 * empty. Connecting a domain is a guide (`app-domain-wizard`) rather than a
 * field: a user who has never touched DNS is told, provider by provider, which
 * buttons to press, and the page says when it works.
 */
@Component({
  selector: 'app-domain-tab',
  imports: [TranslateModule, IllustrationComponent, DomainOptionsComponent, DomainWizardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      @if (wizardOpen()) {
        <app-domain-wizard
          [hosts]="wizardHosts()"
          [guide]="guide()"
          [saving]="saving()"
          [loading]="loading()"
          [error]="error()"
          [redeployRequired]="redeployRequired()"
          [redeploying]="redeploying()"
          (submitted)="addDomains($event)"
          (refresh)="refresh()"
          (redeploy)="redeploy()"
          (closed)="closeWizard()"
        />
      } @else if (customCount() === 0) {
        <!-- No domain of one's own yet: the invitation, in plain words. -->
        <section class="glass-card grid items-center gap-6 p-6 md:grid-cols-[180px_1fr]">
          <app-illustration name="facade" [width]="170" class="mx-auto block" />
          <div>
            <h2 class="text-lg font-semibold text-text-primary">{{ 'applications.domain.inviteTitle' | translate }}</h2>
            <p class="mt-1 max-w-xl text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.domain.inviteBody' | translate }}</p>
            <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs" style="color:var(--color-text-secondary);">
              <li><i class="pi pi-check mr-1.5 text-[10px]" style="color:var(--color-success);" aria-hidden="true"></i>{{ 'applications.domain.inviteFree' | translate }}</li>
              <li><i class="pi pi-check mr-1.5 text-[10px]" style="color:var(--color-success);" aria-hidden="true"></i>{{ 'applications.domain.inviteHttps' | translate }}</li>
              <li><i class="pi pi-check mr-1.5 text-[10px]" style="color:var(--color-success);" aria-hidden="true"></i>{{ 'applications.domain.inviteTime' | translate }}</li>
            </ul>
            <button type="button" class="inner-button mt-5" (click)="openWizard([])">{{ 'applications.domain.connect' | translate }}</button>
          </div>
        </section>
      }

      <!-- Every address the application answers at. -->
      <section class="glass-card overflow-hidden">
        <header class="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
          <div>
            <h2 class="font-semibold text-text-primary">{{ 'applications.domain.listTitle' | translate }}</h2>
            <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.listHint' | translate }}</p>
          </div>
          @if (customCount() > 0 && !wizardOpen()) {
            <button type="button" class="outer-button button-sm" (click)="openWizard([])">
              <i class="pi pi-plus mr-1.5 text-xs" aria-hidden="true"></i>{{ 'applications.domain.addAnother' | translate }}
            </button>
          }
        </header>
        <ul>
          @for (row of rows(); track row.host; let last = $last) {
            <li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
              <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="dotColor(row)" aria-hidden="true"></span>
              <div class="min-w-0 flex-1">
                <a class="break-all font-mono text-sm font-semibold hover:underline" [href]="'https://' + row.host" target="_blank" rel="noopener noreferrer">{{ row.host }}</a>
                <p class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
                  {{ statusText(row) | translate }}
                  @if (row.automatic) { · {{ (row.host.endsWith('.idem.africa') ? 'applications.domain.idemAddress' : 'applications.domain.backupAddress') | translate }} }
                  @if (row.primary && rows().length > 1) { · {{ 'applications.domain.primary' | translate }} }
                </p>
              </div>
              <div class="flex items-center gap-1">
                @if (!row.automatic && !row.live && row.check) {
                  <button type="button" class="outer-button button-sm" (click)="resume(row.host)">{{ 'applications.domain.resume' | translate }}</button>
                }
                <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.domain.copy' | translate: { host: row.host }" (click)="copy(row.host)">
                  <i class="pi text-xs" [class.pi-copy]="copied() !== row.host" [class.pi-check]="copied() === row.host" aria-hidden="true"></i>
                </button>
                @if (!row.primary) {
                  <button type="button" class="button-ghost button-sm" [title]="'applications.domain.makePrimary' | translate" [attr.aria-label]="'applications.domain.makePrimary' | translate" [disabled]="saving()" (click)="makePrimary(row.host)">
                    <i class="pi pi-star text-xs" aria-hidden="true"></i>
                  </button>
                }
                @if (domains().length > 1) {
                  <button type="button" class="button-ghost button-sm" style="color:var(--color-danger);" [attr.aria-label]="'applications.domain.remove' | translate: { host: row.host }" [disabled]="saving()" (click)="remove(row.host)">
                    <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="px-5 py-4 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.none' | translate }}</li>
          }
        </ul>
        @if (error() && !wizardOpen()) {
          <p class="px-5 pb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
        }
      </section>

      <details class="glass-card px-5 py-4">
        <summary class="cursor-pointer select-none text-sm font-medium">{{ 'applications.domain.advanced' | translate }}</summary>
        <app-domain-options [appUuid]="app().uuid" (redeployNeeded)="redeployRequired.set(true)" />
      </details>
    </div>
  `,
})
export class DomainTabComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  readonly app = input.required<Application>();
  /** The application as the API returned it after a change — the header shows it right away. */
  readonly updated = output<Application>();

  /** Hostnames, no scheme, in the order they are served (first = primary). */
  protected readonly domains = signal<string[]>([]);
  protected readonly guide = signal<DomainDnsGuide | null>(null);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal<string | null>(null);
  protected readonly redeployRequired = signal(false);
  protected readonly redeploying = signal(false);
  protected readonly wizardOpen = signal(false);
  protected readonly wizardHosts = signal<string[]>([]);

  protected readonly rows = computed<DomainRow[]>(() => {
    const checks = new Map((this.guide()?.domains ?? []).map((d) => [d.host.toLowerCase(), d]));
    return this.domains().map((host, i) => {
      const check = checks.get(host) ?? null;
      return {
        host,
        check,
        automatic: check?.status === 'automatic',
        primary: i === 0,
        live: check?.https.status === 'valid',
      };
    });
  });
  /** Domains of the user's own — known once DNS has been read. */
  protected readonly customCount = computed(() => this.rows().filter((r) => r.check && !r.automatic).length);

  private poll?: ReturnType<typeof setTimeout>;
  private polls = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.poll));
  }

  ngOnInit(): void {
    this.domains.set(this.parse(this.app().fqdn));
    this.load();
  }

  private parse(fqdn: string | null | undefined): string[] {
    return (fqdn ?? '').split(',').map(bareHost).filter(Boolean);
  }

  protected statusText(row: DomainRow): string {
    const c = row.check;
    if (!c) return 'applications.domain.status.checking';
    if (row.live) return 'applications.domain.status.live';
    if (row.automatic) return 'applications.domain.status.starting';
    if (c.status === 'ok') return 'applications.domain.status.certificate';
    if (c.status === 'missing') return 'applications.domain.status.waitingDns';
    return 'applications.detail.dns.status.' + c.status;
  }

  protected dotColor(row: DomainRow): string {
    if (row.live) return 'var(--color-success)';
    const s = row.check?.status;
    if (!s || s === 'missing' || s === 'ok' || s === 'automatic') return 'var(--color-text-tertiary)';
    return 'var(--color-warning)';
  }

  protected copy(host: string): void {
    void navigator.clipboard?.writeText(`https://${host}`).then(() => {
      this.copied.set(host);
      setTimeout(() => this.copied() === host && this.copied.set(null), 1500);
    });
  }

  protected openWizard(hosts: string[]): void {
    this.error.set(null);
    this.wizardHosts.set(hosts);
    this.wizardOpen.set(true);
  }

  /** Back to the guide for a domain not live yet — with its `www.` (or bare) twin when both were added. */
  protected resume(host: string): void {
    const twin = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const pending = this.rows().filter((r) => !r.live && !r.automatic).map((r) => r.host);
    this.openWizard(pending.includes(twin) ? [host, twin] : [host]);
  }

  protected closeWizard(): void {
    this.wizardOpen.set(false);
    this.wizardHosts.set([]);
    this.error.set(null);
  }

  protected addDomains(hosts: string[]): void {
    const fresh = hosts.filter((h) => !this.domains().includes(h));
    if (fresh.length === 0) {
      // Already there: straight on to the next step.
      this.wizardHosts.set(hosts);
      this.refresh();
      return;
    }
    this.persist([...this.domains(), ...fresh], () => this.wizardHosts.set(hosts));
  }

  protected remove(host: string): void {
    this.persist(this.domains().filter((d) => d !== host));
  }

  protected makePrimary(host: string): void {
    this.persist([host, ...this.domains().filter((d) => d !== host)]);
  }

  protected refresh(): void {
    this.polls = 0;
    this.load();
  }

  private persist(list: string[], done?: () => void): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.updateApplication(this.app().uuid, { fqdn: list.map((h) => `https://${h}`).join(',') }).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.domains.set(this.parse(a.fqdn));
        if (a.redeployRequired) this.redeployRequired.set(true);
        this.updated.emit(a);
        done?.();
        this.refresh();
      },
      // A taken or invalid domain says which, and why.
      error: (e) => {
        this.saving.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.error.set(message ?? this.translate.instant('applications.detail.saveError'));
      },
    });
  }

  protected redeploy(): void {
    this.redeploying.set(true);
    this.api.deploy(this.app().uuid).subscribe({
      next: () => {
        this.redeploying.set(false);
        this.redeployRequired.set(false);
      },
      error: (e) => {
        this.redeploying.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.error.set(message ?? this.translate.instant('applications.detail.redeployError'));
      },
    });
  }

  private load(): void {
    clearTimeout(this.poll);
    this.loading.set(true);
    this.api.getDomainDns(this.app().uuid, this.domains().join(',')).subscribe({
      next: (g) => {
        this.guide.set(g);
        this.loading.set(false);
        // Keep reading while a domain is still being set up (DNS or certificate).
        const pending = g.domains.some((d) => d.https.status !== 'valid' && d.status !== 'taken');
        if (pending && this.polls < MAX_POLLS) {
          this.polls++;
          this.poll = setTimeout(() => this.load(), POLL_MS);
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
