import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { DomainDnsCheck, DomainDnsGuide } from '../../../shared/models/ideploy.models';
import { DNS_PROVIDERS, DOMAIN_SELLERS, DnsProvider, HOSTNAME, bareHost, isApex } from './domain-providers';

type Step = 'domain' | 'provider' | 'record' | 'check';
const STEPS: Step[] = ['domain', 'provider', 'record', 'check'];

/** The three things that must be true, in order, for a domain to answer. */
type Stage = 'done' | 'waiting' | 'problem' | 'todo';

/**
 * Connecting one's own domain, one question per screen.
 *
 * 1. Which domain (and, for `boutique.com`, `www.boutique.com` too) — saved
 *    at once, so a taken or invalid name is said here, not three steps later.
 * 2. Where it was bought — the next screen names that provider's own buttons.
 * 3. The record to create, in boxes to copy, with the provider's known trap.
 * 4. The page checks DNS, then the certificate, on its own, and says when the
 *    domain is live — or, in words, what is still wrong.
 *
 * The parent owns the data (saving, DNS reads, polling); this component only
 * walks the user through it.
 */
@Component({
  selector: 'app-domain-wizard',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card overflow-hidden" aria-labelledby="dw-title">
      <header class="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <h2 id="dw-title" class="font-semibold text-text-primary">{{ 'applications.domain.wizard.title' | translate }}</h2>
        <button type="button" class="button-ghost button-sm" (click)="closed.emit()">
          <i class="pi pi-times mr-1.5 text-xs" aria-hidden="true"></i>{{ 'applications.domain.wizard.close' | translate }}
        </button>
      </header>

      <!-- Where the user is, in four words. -->
      <ol class="flex gap-2 px-5 pt-5" [attr.aria-label]="'applications.domain.wizard.progress' | translate">
        @for (s of steps; track s; let i = $index) {
          <li class="min-w-0 flex-1" [attr.aria-current]="step() === s ? 'step' : null">
            <div class="h-1 rounded-full" [style.background]="i <= stepIndex() ? 'var(--color-primary-500)' : 'var(--color-surface-2)'"></div>
            <p class="mt-2 truncate text-xs" [style.color]="i === stepIndex() ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'" [class.font-semibold]="i === stepIndex()">
              {{ i + 1 }}. {{ 'applications.domain.wizard.steps.' + s | translate }}
            </p>
          </li>
        }
      </ol>

      <div class="p-5">
        @switch (step()) {
          <!-- 1. Which domain -->
          @case ('domain') {
            <form class="max-w-xl space-y-4" (submit)="submitDomain($event)" novalidate>
              <div>
                <h3 class="text-lg font-semibold">{{ 'applications.domain.wizard.domainTitle' | translate }}</h3>
                <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.domainIntro' | translate }}</p>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium" for="dw-domain">{{ 'applications.domain.wizard.domainLabel' | translate }}</label>
                <input id="dw-domain" type="text" class="font-mono" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="boutique.com"
                  [value]="draft()" (input)="draft.set($any($event.target).value); localError.set(null)" />
              </div>
              @if (offerWww()) {
                <div class="flex items-start gap-3">
                  <input id="dw-www" type="checkbox" class="mt-0.5 shrink-0" [checked]="withWww()" (change)="withWww.set($any($event.target).checked)" />
                  <div>
                    <label for="dw-www" class="!mb-0 text-sm">{{ 'applications.domain.wizard.alsoWww' | translate: { host: 'www.' + host() } }}</label>
                    <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.alsoWwwHint' | translate }}</p>
                  </div>
                </div>
              }
              @if (localError() || error(); as message) {
                <p class="text-sm" role="alert" style="color:var(--color-danger);">{{ message }}</p>
              }
              <div class="flex flex-wrap items-center gap-3">
                <button type="submit" class="inner-button" [disabled]="saving() || !draft().trim()">
                  @if (saving()) { <idem-loader size="xs" /> }
                  {{ 'applications.domain.wizard.continue' | translate }}
                </button>
                <button type="button" class="button-ghost button-sm" [attr.aria-expanded]="showBuy()" (click)="showBuy.set(!showBuy())">
                  {{ 'applications.domain.wizard.noDomain' | translate }}
                </button>
              </div>
              @if (showBuy()) {
                <div class="rounded-lg p-4 text-sm" style="background:var(--glass-bg-subtle);">
                  <p style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.buyIntro' | translate }}</p>
                  <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    @for (s of sellers; track s.name) {
                      <a class="inline-flex items-center gap-1 hover:underline" style="color:var(--color-primary-500);" [href]="s.url" target="_blank" rel="noopener noreferrer">
                        {{ s.name }}<i class="pi pi-external-link text-[10px]" aria-hidden="true"></i>
                      </a>
                    }
                  </p>
                </div>
              }
            </form>
          }

          <!-- 2. Where it was bought -->
          @case ('provider') {
            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold">{{ 'applications.domain.wizard.providerTitle' | translate }}</h3>
                <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.providerIntro' | translate: { host: hosts()[0] } }}</p>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                @for (p of providers; track p.id) {
                  <button type="button" class="outer-button !justify-center !py-4" [attr.aria-pressed]="provider()?.id === p.id" (click)="pick(p)">
                    {{ p.name || ('applications.domain.wizard.otherProvider' | translate) }}
                  </button>
                }
              </div>
              <p class="text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.domain.wizard.providerHint' | translate }}</p>
            </div>
          }

          <!-- 3. The record to create -->
          @case ('record') {
            @if (provider(); as p) {
              <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div>
                  <h3 class="text-lg font-semibold">{{ 'applications.domain.wizard.recordTitle' | translate: { provider: p.name || ('applications.domain.wizard.yourProvider' | translate) } }}</h3>
                  <ol class="mt-4 space-y-3">
                    @for (n of [1, 2, 3]; track n) {
                      <li class="flex gap-3 text-sm">
                        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style="border:1px solid var(--color-surface-2);">{{ n }}</span>
                        <span class="pt-0.5">{{ 'applications.domain.providers.' + p.id + '.step' + n | translate }}</span>
                      </li>
                    }
                  </ol>
                  @if (p.url) {
                    <a class="outer-button button-sm mt-4" [href]="p.url" target="_blank" rel="noopener noreferrer">
                      {{ 'applications.domain.wizard.openProvider' | translate: { provider: p.name } }}<i class="pi pi-external-link ml-2 text-[10px]" aria-hidden="true"></i>
                    </a>
                  }
                  <p class="mt-4 flex gap-2 rounded-lg p-3 text-xs" style="border:1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);color:var(--color-text-secondary);">
                    <i class="pi pi-exclamation-circle mt-0.5 text-xs" style="color:var(--color-warning);" aria-hidden="true"></i>
                    <span>{{ 'applications.domain.providers.' + p.id + '.tip' | translate }}</span>
                  </p>
                </div>

                <div class="space-y-4">
                  @for (c of checks(); track c.host) {
                    @if (c.record; as r) {
                      <div>
                        @if (checks().length > 1) {
                          <p class="mb-2 text-xs font-semibold" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.recordFor' | translate: { host: c.host } }}</p>
                        }
                        <div class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[4.5rem_minmax(0,0.8fr)_minmax(0,1.4fr)]">
                          <div class="rounded-md px-3 py-2" style="border:1px solid var(--color-surface-2);background:var(--color-surface-1);">
                            <p class="text-[11px] uppercase tracking-wide" style="color:var(--color-text-tertiary);">{{ 'applications.detail.dns.type' | translate }}</p>
                            <p class="mt-0.5 font-mono text-sm font-semibold">{{ r.type }}</p>
                          </div>
                          <div class="rounded-md px-3 py-2" style="border:1px solid var(--color-surface-2);background:var(--color-surface-1);">
                            <p class="text-[11px] uppercase tracking-wide" style="color:var(--color-text-tertiary);">{{ 'applications.detail.dns.name' | translate }}</p>
                            <div class="mt-0.5 flex items-center justify-between gap-1">
                              <span class="min-w-0 break-all font-mono text-sm font-semibold">{{ r.name }}</span>
                              <button type="button" class="button-ghost button-sm shrink-0" [attr.aria-label]="'applications.detail.dns.copyName' | translate" (click)="copy(r.name, c.host + ':n')">
                                <i class="pi text-xs" [class.pi-copy]="copied() !== c.host + ':n'" [class.pi-check]="copied() === c.host + ':n'" aria-hidden="true"></i>
                              </button>
                            </div>
                          </div>
                          <div class="col-span-2 rounded-md px-3 py-2 sm:col-span-1" style="border:1px solid var(--color-surface-2);background:var(--color-surface-1);">
                            <p class="text-[11px] uppercase tracking-wide" style="color:var(--color-text-tertiary);">{{ 'applications.detail.dns.value' | translate }}</p>
                            <div class="mt-0.5 flex items-center justify-between gap-1">
                              <span class="min-w-0 break-all font-mono text-sm font-semibold">{{ r.value }}</span>
                              <button type="button" class="button-ghost button-sm shrink-0" [attr.aria-label]="'applications.detail.dns.copyValue' | translate" (click)="copy(r.value, c.host + ':v')">
                                <i class="pi text-xs" [class.pi-copy]="copied() !== c.host + ':v'" [class.pi-check]="copied() === c.host + ':v'" aria-hidden="true"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                        @if (r.name === '@') {
                          <p class="mt-1.5 text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.domain.wizard.atMeans' | translate: { host: c.host } }}</p>
                        }
                      </div>
                    }
                  } @empty {
                    <div class="skeleton h-16 rounded-md" aria-hidden="true"></div>
                  }
                  <p class="text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.domain.wizard.ttl' | translate }}</p>
                </div>
              </div>
              <div class="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" class="inner-button" (click)="go('check'); refresh.emit()">{{ 'applications.domain.wizard.done' | translate }}</button>
                <button type="button" class="button-ghost button-sm" (click)="go('provider')">{{ 'applications.domain.wizard.back' | translate }}</button>
              </div>
            }
          }

          <!-- 4. Checking, on its own -->
          @case ('check') {
            @if (allLive()) {
              <div class="flex flex-col items-center py-6 text-center" role="status">
                <span class="flex h-12 w-12 items-center justify-center rounded-full" style="background:color-mix(in srgb, var(--color-success) 14%, transparent);">
                  <i class="pi pi-check text-lg" style="color:var(--color-success);" aria-hidden="true"></i>
                </span>
                <h3 class="mt-4 text-lg font-semibold">{{ 'applications.domain.wizard.liveTitle' | translate }}</h3>
                <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.liveIntro' | translate }}</p>
                <a class="mt-4 font-mono text-sm hover:underline" style="color:var(--color-primary-500);" [href]="'https://' + hosts()[0]" target="_blank" rel="noopener noreferrer">https://{{ hosts()[0] }}</a>
                <button type="button" class="inner-button mt-6" (click)="closed.emit()">{{ 'applications.domain.wizard.finish' | translate }}</button>
              </div>
            } @else {
              <div class="space-y-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="text-lg font-semibold">{{ 'applications.domain.wizard.checkTitle' | translate }}</h3>
                    <p class="mt-1 max-w-xl text-sm" style="color:var(--color-text-secondary);">{{ 'applications.domain.wizard.checkIntro' | translate }}</p>
                  </div>
                  <button type="button" class="outer-button button-sm" (click)="refresh.emit()" [disabled]="loading()">
                    @if (loading()) { <idem-loader size="xs" /> }
                    {{ 'applications.detail.dns.check' | translate }}
                  </button>
                </div>

                @for (c of checks(); track c.host) {
                  <div class="rounded-lg p-4" style="border:1px solid var(--color-surface-2);" aria-live="polite">
                    <p class="mb-3 font-mono text-sm font-semibold">{{ c.host }}</p>
                    <ol class="space-y-3">
                      @for (s of stagesOf(c); track s.key) {
                        <li class="flex gap-3">
                          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                            @switch (s.state) {
                              @case ('done') { <i class="pi pi-check-circle text-sm" style="color:var(--color-success);" aria-hidden="true"></i> }
                              @case ('waiting') { <idem-loader size="xs" /> }
                              @case ('problem') { <i class="pi pi-exclamation-triangle text-sm" style="color:var(--color-warning);" aria-hidden="true"></i> }
                              @default { <i class="pi pi-circle text-sm" style="color:var(--color-text-tertiary);" aria-hidden="true"></i> }
                            }
                          </span>
                          <div class="min-w-0">
                            <p class="text-sm" [style.color]="s.state === 'todo' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)'">{{ 'applications.domain.wizard.stage.' + s.key | translate }}</p>
                            @if (s.detail) {
                              <p class="mt-0.5 text-xs" [style.color]="s.state === 'problem' ? 'var(--color-warning)' : 'var(--color-text-secondary)'">
                                {{ s.detail | translate: { found: c.found.a.join(', '), ip: guide()?.serverIp, aaaa: c.found.aaaa.join(', ') } }}
                              </p>
                            }
                          </div>
                        </li>
                      }
                    </ol>
                  </div>
                }

                @if (redeployRequired()) {
                  <div class="flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm" role="status" style="border:1px solid var(--color-surface-2);">
                    <span>{{ 'applications.detail.domainRedeploy' | translate }}</span>
                    <button class="outer-button ml-auto" type="button" (click)="redeploy.emit()" [disabled]="redeploying()">
                      @if (redeploying()) { <idem-loader size="xs" /> }
                      {{ (redeploying() ? 'applications.detail.redeploying' : 'applications.detail.redeployNow') | translate }}
                    </button>
                  </div>
                }

                <p class="text-xs" style="color:var(--color-text-tertiary);">{{ 'applications.domain.wizard.canLeave' | translate }}</p>
                <button type="button" class="button-ghost button-sm" (click)="go('record')">{{ 'applications.domain.wizard.seeRecord' | translate }}</button>
              </div>
            }
          }
        }
      </div>
    </section>
  `,
})
export class DomainWizardComponent {
  private translate = inject(TranslateService);

  /** The domains this guide is setting up — set by the parent once they are saved. */
  readonly hosts = input<string[]>([]);
  readonly guide = input<DomainDnsGuide | null>(null);
  readonly saving = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly redeployRequired = input(false);
  readonly redeploying = input(false);

  readonly submitted = output<string[]>();
  readonly refresh = output<void>();
  readonly redeploy = output<void>();
  readonly closed = output<void>();

  protected readonly steps = STEPS;
  protected readonly providers = DNS_PROVIDERS;
  protected readonly sellers = DOMAIN_SELLERS;

  protected readonly step = signal<Step>('domain');
  protected readonly stepIndex = computed(() => STEPS.indexOf(this.step()));
  protected readonly draft = signal('');
  protected readonly withWww = signal(true);
  protected readonly showBuy = signal(false);
  protected readonly localError = signal<string | null>(null);
  protected readonly provider = signal<DnsProvider | null>(null);
  protected readonly copied = signal<string | null>(null);

  protected readonly host = computed(() => bareHost(this.draft()));
  protected readonly offerWww = computed(() => HOSTNAME.test(this.host()) && !this.host().startsWith('www.') && isApex(this.host()));

  /** What public DNS says about the domains of this guide. */
  protected readonly checks = computed<DomainDnsCheck[]>(() => {
    const wanted = new Set(this.hosts());
    return (this.guide()?.domains ?? []).filter((d) => wanted.has(d.host.toLowerCase()));
  });
  protected readonly allLive = computed(() => {
    const c = this.checks();
    return c.length > 0 && c.length === this.hosts().length && c.every((d) => d.status === 'ok' && d.https.status === 'valid');
  });

  constructor() {
    // Saved: on to the next question. A guide reopened on a domain already
    // saved starts there too.
    effect(() => {
      if (this.hosts().length > 0 && this.step() === 'domain') this.step.set('provider');
    });
  }

  protected go(step: Step): void {
    this.step.set(step);
  }

  protected submitDomain(event: Event): void {
    event.preventDefault();
    const host = this.host();
    if (!HOSTNAME.test(host)) {
      this.localError.set(this.translate.instant('applications.domain.wizard.invalid'));
      return;
    }
    this.submitted.emit(this.offerWww() && this.withWww() ? [host, `www.${host}`] : [host]);
  }

  protected pick(p: DnsProvider): void {
    this.provider.set(p);
    this.step.set('record');
  }

  protected copy(text: string, key: string): void {
    void navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(key);
      setTimeout(() => this.copied() === key && this.copied.set(null), 1500);
    });
  }

  /** DNS found → certificate issued → live, each with what it is waiting on. */
  protected stagesOf(c: DomainDnsCheck): { key: string; state: Stage; detail: string | null }[] {
    const dnsOk = c.status === 'ok';
    const https = c.https.status === 'valid';
    const dns: Stage = dnsOk ? 'done' : c.status === 'missing' ? 'waiting' : 'problem';
    return [
      { key: 'dns', state: dns, detail: dnsOk ? null : `applications.detail.dns.explain.${c.status}` },
      {
        key: 'https',
        state: !dnsOk ? 'todo' : https ? 'done' : 'waiting',
        detail: dnsOk && !https ? 'applications.domain.wizard.httpsWaiting' : null,
      },
      { key: 'live', state: https && dnsOk ? 'done' : 'todo', detail: null },
    ];
  }
}
