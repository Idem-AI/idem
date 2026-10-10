import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { DomainDnsCheck, DomainDnsGuide } from '../../../shared/models/ideploy.models';

/** How often DNS is read again while a domain is still being set up, and for how long. */
const POLL_MS = 30_000;
const MAX_POLLS = 20;

/**
 * Where to point each domain, and whether it is there yet.
 *
 * A user of an IDEM-managed server cannot look up its IP: it is given here,
 * with the exact record to create (type, name, value) and copy buttons. Public
 * DNS is read as the domains are typed, then every 30 seconds while one is
 * still propagating, and each problem is said in words the user can act on.
 */
@Component({
  selector: 'app-domain-dns-guide',
  imports: [TranslateModule, IdemLoaderComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (guide(); as g) {
      @if (custom(g).length > 0) {
        <section class="mt-3 rounded-lg p-4" style="border:1px solid var(--color-surface-2);" aria-live="polite">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium">{{ 'applications.detail.dns.title' | translate }}</p>
            <button type="button" class="outer-button button-sm" (click)="refresh()" [disabled]="loading()">
              @if (loading()) { <idem-loader size="xs" /> }
              {{ 'applications.detail.dns.check' | translate }}
            </button>
          </div>
          <p class="mb-4 text-xs" style="color:var(--color-text-secondary);">
            {{ (g.managed ? 'applications.detail.dns.introManaged' : 'applications.detail.dns.intro') | translate }}
            <span class="ml-1 inline-flex items-center gap-1 font-mono" style="color:var(--color-text-primary);">
              {{ g.serverIp }}
              <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.detail.dns.copyIp' | translate" (click)="copy(g.serverIp, 'ip')">
                <i class="pi text-xs" [class.pi-copy]="copied() !== 'ip'" [class.pi-check]="copied() === 'ip'" aria-hidden="true"></i>
              </button>
            </span>
          </p>

          <ul class="space-y-4">
            @for (d of custom(g); track d.host) {
              <li class="rounded-md p-3" style="background:var(--glass-bg-subtle);">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span class="font-mono text-sm">{{ d.host }}</span>
                  <span class="tag" [style.color]="color(d)">
                    <i class="pi text-xs" [class.pi-check-circle]="d.status === 'ok'" [class.pi-clock]="d.status === 'missing'" [class.pi-exclamation-triangle]="d.status !== 'ok' && d.status !== 'missing'" aria-hidden="true"></i>
                    {{ 'applications.detail.dns.status.' + d.status | translate }}
                  </span>
                </div>

                @if (d.record; as r) {
                  <p class="mb-2 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.dns.createAt' | translate: { zone: r.zone } }}</p>
                  <div class="overflow-x-auto">
                    <table class="w-full text-left font-mono text-xs">
                      <thead>
                        <tr style="color:var(--color-text-tertiary);">
                          <th class="py-1 pr-4 font-normal">{{ 'applications.detail.dns.type' | translate }}</th>
                          <th class="py-1 pr-4 font-normal">{{ 'applications.detail.dns.name' | translate }}</th>
                          <th class="py-1 pr-4 font-normal">{{ 'applications.detail.dns.value' | translate }}</th>
                          <th class="py-1 font-normal">TTL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td class="py-1 pr-4">{{ r.type }}</td>
                          <td class="py-1 pr-4">
                            {{ r.name }}
                            <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.detail.dns.copyName' | translate" (click)="copy(r.name, d.host + ':name')">
                              <i class="pi text-xs" [class.pi-copy]="copied() !== d.host + ':name'" [class.pi-check]="copied() === d.host + ':name'" aria-hidden="true"></i>
                            </button>
                          </td>
                          <td class="py-1 pr-4">
                            {{ r.value }}
                            <button type="button" class="button-ghost button-sm" [attr.aria-label]="'applications.detail.dns.copyValue' | translate" (click)="copy(r.value, d.host + ':value')">
                              <i class="pi text-xs" [class.pi-copy]="copied() !== d.host + ':value'" [class.pi-check]="copied() === d.host + ':value'" aria-hidden="true"></i>
                            </button>
                          </td>
                          <td class="py-1">{{ 'applications.detail.dns.ttlAuto' | translate }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                }

                @if (d.status !== 'ok') {
                  <p class="mt-2 text-xs" [style.color]="color(d)">
                    {{ 'applications.detail.dns.explain.' + d.status | translate: { found: d.found.a.join(', '), ip: g.serverIp, aaaa: d.found.aaaa.join(', ') } }}
                  </p>
                }

                <p class="mt-2 flex items-center gap-1.5 text-xs" style="color:var(--color-text-secondary);">
                  <i class="pi pi-lock text-xs" aria-hidden="true"></i>
                  @switch (d.https.status) {
                    @case ('valid') {
                      {{ 'applications.detail.dns.httpsValid' | translate: { issuer: d.https.issuer ?? '' } }}
                      @if (d.https.expiresAt) { · {{ 'applications.detail.dns.expires' | translate }} {{ d.https.expiresAt | date: 'longDate' }} }
                    }
                    @case ('not_checked') { {{ 'applications.detail.dns.httpsAfterDns' | translate }} }
                    @default { {{ 'applications.detail.dns.httpsPending' | translate }} }
                  }
                </p>
              </li>
            }
          </ul>
          @if (polling()) {
            <p class="mt-3 text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.detail.dns.polling' | translate }}</p>
          }
        </section>
      }
    }
  `,
})
export class DomainDnsGuideComponent {
  private api = inject(ApiService);

  readonly appUuid = input.required<string>();
  /** The domains as typed in the form, comma-separated. */
  readonly domains = input<string>('');

  protected readonly guide = signal<DomainDnsGuide | null>(null);
  protected readonly loading = signal(false);
  protected readonly polling = signal(false);
  protected readonly copied = signal<string | null>(null);

  private debounce?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setTimeout>;
  private polls = 0;

  constructor() {
    // Read DNS once typing pauses.
    effect(() => {
      const domains = this.domains();
      const uuid = this.appUuid();
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        this.polls = 0;
        this.load(uuid, domains);
      }, 700);
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.debounce);
      clearTimeout(this.poll);
    });
  }

  protected custom(g: DomainDnsGuide): DomainDnsCheck[] {
    return g.domains.filter((d) => d.status !== 'automatic');
  }

  protected color(d: DomainDnsCheck): string {
    if (d.status === 'ok') return 'var(--color-success)';
    if (d.status === 'missing') return 'var(--color-text-secondary)';
    return 'var(--color-warning)';
  }

  protected refresh(): void {
    this.polls = 0;
    this.load(this.appUuid(), this.domains());
  }

  protected copy(text: string, key: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(key);
      setTimeout(() => this.copied() === key && this.copied.set(null), 1500);
    });
  }

  private load(uuid: string, domains: string): void {
    clearTimeout(this.poll);
    this.loading.set(true);
    this.api.getDomainDns(uuid, domains).subscribe({
      next: (g) => {
        this.guide.set(g);
        this.loading.set(false);
        // Keep reading while a domain is still being set up (DNS or certificate).
        const pending = this.custom(g).some((d) => d.status !== 'ok' || d.https.status !== 'valid');
        this.polling.set(pending && this.polls < MAX_POLLS);
        if (pending && this.polls < MAX_POLLS) {
          this.polls++;
          this.poll = setTimeout(() => this.load(uuid, domains), POLL_MS);
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
