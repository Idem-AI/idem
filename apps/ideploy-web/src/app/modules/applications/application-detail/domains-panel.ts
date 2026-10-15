import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { Application, DomainDnsCheck, DomainDnsGuide } from '../../../shared/models/ideploy.models';
import { DomainOptionsComponent } from './domain-options';

/** How often DNS is read again while a domain is still being set up, and for how long. */
const POLL_MS = 30_000;
const MAX_POLLS = 20;

/** `boutique.com`, `app.boutique.co.uk` — letters, digits and dashes, at least one dot. */
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Row shown for one address, whether or not DNS has been read yet. */
interface DomainRow {
  host: string;
  check: DomainDnsCheck | null;
  automatic: boolean;
  primary: boolean;
}

/**
 * The addresses of an application, in one place.
 *
 * The IDEM address (`monprojet.idem.africa`) is there from the first
 * deployment. Adding one's own domain is a single field; the one record to
 * create at the registrar is then shown in three copyable boxes, and the page
 * checks DNS and the HTTPS certificate on its own until the domain is live.
 */
@Component({
  selector: 'app-domains-panel',
  imports: [TranslateModule, IdemLoaderComponent, DomainOptionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card overflow-hidden">
      <header class="flex flex-wrap items-start justify-between gap-3 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <div>
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.domains.title' | translate }}</h2>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.domains.hint' | translate }}</p>
        </div>
        @if (pending()) {
          <span class="inline-flex items-center gap-2 text-xs" style="color:var(--color-text-tertiary);" role="status">
            <idem-loader size="xs" />{{ 'applications.detail.domains.watching' | translate }}
          </span>
        }
      </header>

      <div class="space-y-5 p-5">
        <!-- Addresses -->
        <ul class="space-y-2">
          @for (row of rows(); track row.host) {
            <li class="rounded-lg" style="border:1px solid var(--color-surface-2);">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <i class="pi text-sm" [class.pi-lock]="row.check?.https?.status === 'valid'" [class.pi-globe]="row.check?.https?.status !== 'valid'"
                  [style.color]="row.check?.https?.status === 'valid' ? 'var(--color-success)' : 'var(--color-text-tertiary)'" aria-hidden="true"></i>
                <a class="min-w-0 break-all font-mono text-sm hover:underline" [href]="'https://' + row.host" target="_blank" rel="noopener">{{ row.host }}</a>
                @if (row.primary) {
                  <span class="tag" style="color:var(--color-primary-500);">{{ 'applications.detail.domains.primary' | translate }}</span>
                }
                <span class="ml-auto flex items-center gap-2">
                  <span class="tag" [style.color]="color(row)">
                    <i class="pi text-xs" [class.pi-check-circle]="isLive(row)" [class.pi-clock]="!isLive(row) && waiting(row)" [class.pi-exclamation-triangle]="!isLive(row) && !waiting(row)" aria-hidden="true"></i>
                    {{ label(row) | translate }}
                  </span>
                  <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.detail.domains.copy' | translate" (click)="copy(row.host, row.host)">
                    <i class="pi text-xs" [class.pi-copy]="copied() !== row.host" [class.pi-check]="copied() === row.host" aria-hidden="true"></i>
                  </button>
                  @if (!row.primary) {
                    <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.detail.domains.makePrimary' | translate" [title]="'applications.detail.domains.makePrimary' | translate" [disabled]="saving()" (click)="makePrimary(row.host)">
                      <i class="pi pi-star text-xs" aria-hidden="true"></i>
                    </button>
                  }
                  @if (domains().length > 1) {
                    <button type="button" class="button-ghost button-sm" style="color:var(--color-danger);" [attr.aria-label]="'applications.detail.domains.remove' | translate: { host: row.host }" [disabled]="saving()" (click)="remove(row.host)">
                      <i class="pi pi-trash text-xs" aria-hidden="true"></i>
                    </button>
                  }
                </span>
              </div>

              <!-- What is left to do for a domain of one's own -->
              @if (!row.automatic && row.check && row.check.status !== 'ok') {
                <div class="space-y-3 px-4 pb-4 pt-3" style="border-top:1px solid var(--color-surface-2);background:var(--glass-bg-subtle);">
                  @if (row.check.record; as r) {
                    <p class="text-sm font-medium">{{ 'applications.detail.domains.stepTitle' | translate }}</p>
                    <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domains.stepIntro' | translate: { zone: r.zone } }}</p>
                    <div class="grid gap-2 sm:grid-cols-[5rem_1fr_1.6fr]">
                      @for (f of fields(r, row.host); track f.key) {
                        <div class="min-w-0 rounded-md px-3 py-2" style="border:1px solid var(--color-surface-2);background:var(--color-surface-1);">
                          <p class="text-[11px] uppercase tracking-wide" style="color:var(--color-text-tertiary);">{{ f.label | translate }}</p>
                          <div class="mt-0.5 flex items-center justify-between gap-2">
                            <span class="min-w-0 break-all font-mono text-sm">{{ f.value }}</span>
                            @if (f.copy) {
                              <button type="button" class="button-ghost button-sm shrink-0" [attr.aria-label]="'applications.detail.domains.copy' | translate" (click)="copy(f.value, f.key)">
                                <i class="pi text-xs" [class.pi-copy]="copied() !== f.key" [class.pi-check]="copied() === f.key" aria-hidden="true"></i>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                  <p class="text-xs" [style.color]="color(row)" aria-live="polite">
                    {{ 'applications.detail.dns.explain.' + row.check.status | translate: { found: row.check.found.a.join(', '), ip: guide()?.serverIp, aaaa: row.check.found.aaaa.join(', ') } }}
                  </p>
                  <button type="button" class="outer-button button-sm" (click)="refresh()" [disabled]="loading()">
                    @if (loading()) { <idem-loader size="xs" /> }
                    {{ 'applications.detail.dns.check' | translate }}
                  </button>
                </div>
              } @else if (!row.automatic && row.check && row.check.https.status !== 'valid') {
                <p class="px-4 pb-3 text-xs" style="color:var(--color-text-secondary);">
                  <i class="pi pi-lock mr-1 text-xs" aria-hidden="true"></i>{{ 'applications.detail.domains.certificate' | translate }}
                </p>
              }
            </li>
          }
        </ul>

        <!-- Add one's own domain -->
        <form (submit)="add($event)" novalidate>
          <label class="mb-1 block text-sm font-medium" for="dom-new">{{ 'applications.detail.domains.addTitle' | translate }}</label>
          <div class="flex flex-wrap gap-2">
            <input id="dom-new" type="text" class="min-w-0 flex-1 !w-auto font-mono text-sm" autocomplete="off" autocapitalize="off" spellcheck="false"
              placeholder="boutique.com" [value]="draft()" (input)="draft.set($any($event.target).value); formError.set(null)" />
            <button type="submit" class="inner-button" [disabled]="saving() || !draft().trim()">
              @if (saving()) { <idem-loader size="xs" /> }
              {{ 'applications.detail.domains.add' | translate }}
            </button>
          </div>
          @if (formError(); as message) {
            <p class="mt-2 text-sm" role="alert" style="color:var(--color-danger);">{{ message }}</p>
          } @else {
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domains.addHint' | translate }}</p>
          }
        </form>

        @if (redeployRequired()) {
          <div class="flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm" role="status" style="border:1px solid var(--color-surface-2);">
            <span>{{ 'applications.detail.domainRedeploy' | translate }}</span>
            <button class="outer-button ml-auto" type="button" (click)="redeploy()" [disabled]="redeploying()">
              @if (redeploying()) { <idem-loader size="xs" /> }
              {{ (redeploying() ? 'applications.detail.redeploying' : 'applications.detail.redeployNow') | translate }}
            </button>
          </div>
        }

        <details class="group">
          <summary class="cursor-pointer select-none text-sm" style="color:var(--color-text-secondary);">
            <i class="pi pi-sliders-h mr-2 text-xs" aria-hidden="true"></i>{{ 'applications.detail.domains.advanced' | translate }}
          </summary>
          <app-domain-options [appUuid]="app().uuid" (redeployNeeded)="redeployRequired.set(true)" />
        </details>
      </div>
    </section>
  `,
})
export class DomainsPanelComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  readonly app = input.required<Application>();
  /** The application as the API returned it after a change — the header shows it right away. */
  readonly updated = output<Application>();

  /** Hostnames, no scheme, in the order they are served (first = principal). */
  protected readonly domains = signal<string[]>([]);
  protected readonly guide = signal<DomainDnsGuide | null>(null);
  protected readonly draft = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly polling = signal(false);
  protected readonly copied = signal<string | null>(null);
  protected readonly redeployRequired = signal(false);
  protected readonly redeploying = signal(false);

  protected readonly rows = computed<DomainRow[]>(() => {
    const checks = new Map((this.guide()?.domains ?? []).map((d) => [d.host.toLowerCase(), d]));
    return this.domains().map((host, i) => {
      const check = checks.get(host) ?? null;
      return { host, check, automatic: check?.status === 'automatic', primary: i === 0 };
    });
  });
  /** A custom domain is still waiting on DNS or on its certificate. */
  protected readonly pending = computed(() => this.polling());

  private poll?: ReturnType<typeof setTimeout>;
  private polls = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.poll));
  }

  ngOnInit(): void {
    this.domains.set(this.parse(this.app().fqdn));
    this.polls = 0;
    this.load();
  }

  private parse(fqdn: string | null | undefined): string[] {
    return (fqdn ?? '')
      .split(',')
      .map((d) => d.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase())
      .filter(Boolean);
  }

  protected isLive(row: DomainRow): boolean {
    return row.check?.https.status === 'valid';
  }

  protected waiting(row: DomainRow): boolean {
    const c = row.check;
    return !c || c.status === 'missing' || c.status === 'ok' || c.status === 'automatic';
  }

  /** The words on the status chip. */
  protected label(row: DomainRow): string {
    const c = row.check;
    if (!c) return 'applications.detail.domains.checking';
    if (c.https.status === 'valid') return 'applications.detail.domains.live';
    if (row.automatic) return 'applications.detail.domains.starting';
    if (c.status === 'ok') return 'applications.detail.domains.certificatePending';
    return 'applications.detail.dns.status.' + c.status;
  }

  protected color(row: DomainRow): string {
    if (this.isLive(row)) return 'var(--color-success)';
    if (this.waiting(row)) return 'var(--color-text-secondary)';
    return 'var(--color-warning)';
  }

  protected fields(r: { type: string; name: string; value: string }, host: string): { key: string; label: string; value: string; copy: boolean }[] {
    return [
      { key: host + ':type', label: 'applications.detail.dns.type', value: r.type, copy: false },
      { key: host + ':name', label: 'applications.detail.dns.name', value: r.name, copy: true },
      { key: host + ':value', label: 'applications.detail.dns.value', value: r.value, copy: true },
    ];
  }

  protected copy(text: string, key: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(key);
      setTimeout(() => this.copied() === key && this.copied.set(null), 1500);
    });
  }

  protected add(event: Event): void {
    event.preventDefault();
    const host = this.parse(this.draft())[0] ?? '';
    if (!HOSTNAME.test(host)) {
      this.formError.set(this.translate.instant('applications.detail.domains.invalid'));
      return;
    }
    if (this.domains().includes(host)) {
      this.formError.set(this.translate.instant('applications.detail.domains.duplicate'));
      return;
    }
    this.persist([...this.domains(), host], () => this.draft.set(''));
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
    this.formError.set(null);
    this.api.updateApplication(this.app().uuid, { fqdn: list.map((h) => `https://${h}`).join(',') }).subscribe({
      next: (a) => {
        this.saving.set(false);
        done?.();
        this.domains.set(this.parse(a.fqdn));
        if (a.redeployRequired) this.redeployRequired.set(true);
        this.updated.emit(a);
        this.polls = 0;
        this.load();
      },
      // A taken or invalid domain says which, and why.
      error: (e) => {
        this.saving.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.formError.set(message ?? this.translate.instant('applications.detail.saveError'));
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
        this.formError.set(message ?? this.translate.instant('applications.detail.redeployError'));
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
        const again = pending && this.polls < MAX_POLLS;
        this.polling.set(again);
        if (again) {
          this.polls++;
          this.poll = setTimeout(() => this.load(), POLL_MS);
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
