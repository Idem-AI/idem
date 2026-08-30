import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  Country,
  FirewallConfig,
  FirewallRule,
  GeoSelection,
  GeoWarning,
  RateLimitSettings,
  RateLimitTemplate,
} from '../../../shared/models/ideploy.models';

/**
 * Application security — WAF, geo-blocking, rate limiting, and what the agent
 * has seen. Replaces the three legacy Livewire screens (FirewallOverview,
 * FirewallRules, FirewallTraffic) with one page.
 *
 * The organising idea is that *saved* and *enforced* are different states. Geo
 * rules and rate limits are Docker labels Traefik reads when the container
 * starts, so a change is inert until the next deploy. The API says so on every
 * mutation (`applyRequired`) and this screen repeats it, because an operator who
 * believes a control is live when it is not is worse off than one with no
 * control at all.
 */
@Component({
  selector: 'app-application-security',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="['/applications', uuid]"
    >
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
      {{ 'security.app.backToApplication' | translate }}
    </a>

    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
      {{ 'security.app.title' | translate }}
    </h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <!-- Saved ≠ enforced. Stated once, at the top, where it is unavoidable. -->
    @if (pendingApply()) {
      <div
        class="mb-4 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm"
        role="status"
        style="background:color-mix(in srgb, var(--color-warning) 14%, transparent);border:1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);"
      >
        <span style="color:var(--color-warning);">
          <strong>{{ 'security.app.pendingApplyTitle' | translate }}</strong>
          — {{ 'security.app.pendingApplyBody' | translate }}
        </span>
        <button class="button-secondary ml-auto" (click)="applyNow()" [disabled]="applying()">
          {{ (applying() ? 'security.app.applying' : 'security.app.applyNow') | translate }}
        </button>
      </div>
    }

    <!--
      Status hero — Vercel's own "Firewall is active" card, on our own state:
      the WAF toggle plus whether it is actually being enforced (a saved rule
      is not a live one — see the module doc), not a manufactured "all systems
      normal" that hides the one thing this screen exists to be honest about.
    -->
    @if (firewall(); as fw) {
      <section class="box box-flush mb-4">
        <div class="grid grid-cols-1 gap-0 sm:grid-cols-[220px_1fr]">
          <div class="flex flex-col items-center justify-center gap-2 p-6 text-center" style="border-bottom:1px solid var(--color-surface-2);">
            <i [class]="heroIcon(fw)" class="text-3xl" [style.color]="heroColor(fw)" aria-hidden="true"></i>
            <p class="text-sm font-semibold">{{ heroTitleKey(fw) | translate }}</p>
            <p class="text-xs" style="color:var(--color-text-secondary);">{{ heroSubtitleKey(fw) | translate }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4" style="border-top:1px solid var(--color-surface-2);">
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.app.totalRequests' | translate }}</dt>
              <dd class="text-xl font-semibold" style="font-variant-numeric:tabular-nums;">{{ fw.total_requests }}</dd>
            </div>
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.app.totalBlocked' | translate }}</dt>
              <dd class="text-xl font-semibold" style="font-variant-numeric:tabular-nums;">{{ fw.total_blocked }}</dd>
            </div>
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.app.rules' | translate }}</dt>
              <dd class="text-xl font-semibold" style="font-variant-numeric:tabular-nums;">{{ rules().length }}</dd>
            </div>
            <div>
              <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.app.banDuration' | translate }}</dt>
              <dd class="text-xl font-semibold" style="font-variant-numeric:tabular-nums;">{{ fw.ban_duration }}s</dd>
            </div>
          </div>
        </div>
      </section>
    }

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- WAF -->
      <section class="box">
        <div class="box-header">
          <h2 class="box-title">{{ 'security.app.waf' | translate }}</h2>
        </div>
        @if (firewall(); as fw) {
          <label class="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" [checked]="fw.enabled" (change)="toggleFirewall(fw)" />
            {{ 'security.app.wafEnabled' | translate }}
          </label>

          @if (fw.enforcement && fw.enforcement.state !== 'enforced') {
            <p
              class="mb-3 rounded-lg p-3 text-sm"
              role="status"
              style="background:color-mix(in srgb, var(--color-danger) 12%, transparent);color:var(--color-danger);"
            >
              <strong>{{ 'security.app.notEnforced' | translate }}</strong><br />
              {{ ('security.app.reasons.' + fw.enforcement.reasonCode) | translate: fw.enforcement.reasonParams }}
            </p>
          }

          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.totalRequests' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ fw.total_requests }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.totalBlocked' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ fw.total_blocked }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.banDuration' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ fw.ban_duration }}s</dd>
            </div>
          </dl>
        } @else {
          <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.loading' | translate }}</p>
        }
      </section>

      <!-- Rate limiting -->
      <section class="box">
        <div class="box-header">
          <h2 class="box-title">{{ 'security.app.rateLimit' | translate }}</h2>
        </div>
        @if (rateLimit(); as rl) {
          <p class="mb-3 text-sm">
            <span style="color:var(--color-text-secondary);">{{ 'security.app.activeTemplate' | translate }}</span>
            <strong class="ml-2">{{ rl.template }}</strong>
          </p>
          <dl class="mb-3 space-y-1.5 text-sm">
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.averagePerSecond' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ rl.averagePerSecond }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.burst' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ rl.burst }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt style="color:var(--color-text-secondary);">{{ 'security.app.concurrency' | translate }}</dt>
              <dd style="font-variant-numeric:tabular-nums;">{{ rl.concurrencyLimit }}</dd>
            </div>
          </dl>
          <button class="text-xs" style="color:var(--color-danger);" (click)="clearRateLimit()">
            {{ 'security.app.removeRateLimit' | translate }}
          </button>
        } @else {
          <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
            {{ 'security.app.noRateLimit' | translate }}
          </p>
        }

        <div class="mt-3">
          <label class="mb-1 block text-sm" for="rl-template">{{ 'security.app.applyTemplate' | translate }}</label>
          <div class="flex gap-2">
            <select class="input flex-1" id="rl-template" [value]="chosenTemplate()" (change)="onTemplatePick($event)">
              <option value="">{{ 'security.app.chooseTemplate' | translate }}</option>
              @for (t of templates(); track t.key) {
                <option [value]="t.key">{{ t.name }}</option>
              }
            </select>
            <button class="button" (click)="applyTemplate()" [disabled]="!chosenTemplate()">
              {{ 'security.app.apply' | translate }}
            </button>
          </div>
          @if (chosenTemplateDetail(); as t) {
            <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">{{ t.description }}</p>
          }
        </div>

        <details class="mt-4">
          <summary class="cursor-pointer text-sm" style="color:var(--color-text-secondary);">
            {{ 'security.app.customRateLimit' | translate }}
          </summary>
          <form class="mt-3 grid grid-cols-2 gap-2" [formGroup]="rateLimitForm" (ngSubmit)="saveCustomRateLimit()">
            <label class="text-sm">
              {{ 'security.app.averagePerSecond' | translate }}
              <input class="input mt-1" type="number" min="1" formControlName="averagePerSecond" />
            </label>
            <label class="text-sm">
              {{ 'security.app.burst' | translate }}
              <input class="input mt-1" type="number" min="1" formControlName="burst" />
            </label>
            <label class="text-sm">
              {{ 'security.app.periodSeconds' | translate }}
              <input class="input mt-1" type="number" min="1" formControlName="periodSeconds" />
            </label>
            <label class="text-sm">
              {{ 'security.app.concurrency' | translate }}
              <input class="input mt-1" type="number" min="1" formControlName="concurrencyLimit" />
            </label>
            <button class="button col-span-2 mt-1" type="submit" [disabled]="rateLimitForm.invalid">
              {{ 'security.app.saveCustom' | translate }}
            </button>
          </form>
        </details>
      </section>
    </div>

    <!-- Geo-blocking -->
    <section class="box mt-4">
      <div class="box-header">
        <h2 class="box-title">{{ 'security.app.geoBlocking' | translate }}</h2>
      </div>
      <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">
        {{ 'security.app.geoHint' | translate }}
      </p>

      @for (w of geoWarnings(); track w.code) {
        <p class="mb-2 rounded-lg p-2 text-sm" role="status" style="background:color-mix(in srgb, var(--color-warning) 12%, transparent);color:var(--color-warning);">
          {{ w.message }}
        </p>
      }

      @if (geo(); as g) {
        <div class="mb-3">
          <p class="mb-2 text-sm">
            <span style="color:var(--color-text-secondary);">{{ 'security.app.currentlyBlocked' | translate }}</span>
            <strong class="ml-2" style="font-variant-numeric:tabular-nums;">{{ g.countries.length }}</strong>
          </p>
          <div class="flex flex-wrap gap-1.5">
            @for (c of g.countries; track c.code) {
              <span class="rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);">
                {{ c.name }}
              </span>
            }
          </div>
          <button class="mt-3 text-xs" style="color:var(--color-danger);" (click)="clearGeo()">
            {{ 'security.app.removeGeo' | translate }}
          </button>
        </div>
      } @else {
        <p class="mb-3 text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noGeoRule' | translate }}</p>
      }

      <!-- Continents first: picking 250 countries one at a time is not a design. -->
      <div class="mb-3">
        <p class="mb-1.5 text-sm font-medium">{{ 'security.app.blockContinents' | translate }}</p>
        <div class="flex flex-wrap gap-3">
          @for (c of continentEntries(); track c.code) {
            <label class="flex items-center gap-1.5 text-sm">
              <input type="checkbox" [checked]="selectedContinents().has(c.code)" (change)="toggleContinent(c.code)" />
              {{ c.name }}
            </label>
          }
        </div>
      </div>

      <div class="mb-3">
        <label class="mb-1.5 block text-sm font-medium" for="geo-country">
          {{ 'security.app.blockCountries' | translate }}
        </label>
        <input
          class="input"
          id="geo-country"
          [value]="countryFilter()"
          (input)="onCountryFilter($event)"
          [placeholder]="'security.app.filterCountries' | translate"
        />
        @if (countryFilter()) {
          <div class="mt-2 max-h-48 overflow-y-auto rounded-md" style="border:1px solid var(--color-surface-2);">
            @for (c of filteredCountries(); track c.code) {
              <label class="flex items-center gap-2 px-3 py-1.5 text-sm">
                <input type="checkbox" [checked]="selectedCountries().has(c.code)" (change)="toggleCountry(c.code)" />
                {{ c.name }} <span style="color:var(--color-text-secondary);">({{ c.code }})</span>
              </label>
            } @empty {
              <p class="px-3 py-2 text-sm" style="color:var(--color-text-secondary);">
                {{ 'security.app.noCountryMatch' | translate }}
              </p>
            }
          </div>
        }
        @if (selectedCountries().size > 0) {
          <div class="mt-2 flex flex-wrap gap-1.5">
            @for (code of selectedCountryCodes(); track code) {
              <button
                class="rounded-full px-2 py-0.5 text-xs"
                style="background:var(--color-surface-2);"
                (click)="toggleCountry(code)"
              >
                {{ code }} ✕
              </button>
            }
          </div>
        }
      </div>

      <button class="button" (click)="saveGeo()" [disabled]="!hasGeoSelection() || savingGeo()">
        {{ (savingGeo() ? 'security.app.saving' : 'security.app.saveGeo') | translate }}
      </button>
    </section>

    <!-- Rules -->
    <section class="box box-flush mt-4">
      <div class="box-header">
        <h2 class="box-title">
          {{ 'security.app.rules' | translate }}
          <span class="ml-1 font-normal" style="color:var(--color-text-secondary);">({{ rules().length }})</span>
        </h2>
      </div>
      @if (rules().length === 0) {
        <p class="px-5 pb-5 text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noRules' | translate }}</p>
      } @else {
        <table class="vtable">
          <thead>
            <tr>
              <th>{{ 'security.app.ruleName' | translate }}</th>
              <th>{{ 'security.app.ruleAction' | translate }}</th>
              <th>{{ 'security.app.priority' | translate }}</th>
              <th class="text-right">{{ 'security.app.actionsCol' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rules(); track r.id) {
              <tr>
                <td class="font-medium">{{ r.name }}</td>
                <td style="color:var(--color-text-secondary);">{{ r.action }}</td>
                <td style="font-variant-numeric:tabular-nums;color:var(--color-text-secondary);">{{ r.priority }}</td>
                <td class="text-right">
                  <button class="text-xs" style="color:var(--color-danger);" (click)="removeRule(r)">
                    {{ 'security.app.delete' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>

    <!-- What the agent has seen -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section class="box box-flush">
        <div class="box-header">
          <h2 class="box-title">{{ 'security.app.alerts' | translate }}</h2>
          <button class="icon-button" [title]="'security.app.refresh' | translate" (click)="loadAlerts()">
            <i class="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
          </button>
        </div>
        @if (alerts().length === 0) {
          <p class="px-5 pb-5 text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noAlerts' | translate }}</p>
        } @else {
          <table class="vtable">
            <tbody>
              @for (a of alerts(); track $index) {
                <tr>
                  <td><code class="font-mono text-xs">{{ a['source_ip'] || a['ip'] || '—' }}</code></td>
                  <td style="color:var(--color-text-secondary);">{{ a['scenario'] || a['reason'] || '' }}</td>
                  <td class="text-right text-xs whitespace-nowrap" style="color:var(--color-text-secondary);">{{ a['created_at'] }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <section class="box box-flush">
        <div class="box-header">
          <h2 class="box-title">{{ 'security.app.traffic' | translate }}</h2>
          <button class="icon-button" [title]="'security.app.refresh' | translate" (click)="loadTraffic()">
            <i class="fa-solid fa-rotate-right text-xs" aria-hidden="true"></i>
          </button>
        </div>
        @if (traffic().length === 0) {
          <p class="px-5 pb-5 text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noTraffic' | translate }}</p>
        } @else {
          <table class="vtable">
            <tbody>
              @for (t of traffic(); track $index) {
                <tr>
                  <td><code class="font-mono text-xs">{{ t['source_ip'] || t['ip'] || '—' }}</code></td>
                  <td style="color:var(--color-text-secondary);">{{ t['path'] || t['uri'] || '' }}</td>
                  <td class="text-right text-xs whitespace-nowrap" style="color:var(--color-text-secondary);">{{ t['created_at'] }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
  `,
})
export class ApplicationSecurityComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected uuid = '';

  protected readonly firewall = signal<FirewallConfig | null>(null);
  protected readonly rules = signal<FirewallRule[]>([]);
  protected readonly alerts = signal<Record<string, unknown>[]>([]);
  protected readonly traffic = signal<Record<string, unknown>[]>([]);

  protected readonly geo = signal<GeoSelection | null>(null);
  protected readonly geoWarnings = signal<GeoWarning[]>([]);
  protected readonly countries = signal<Country[]>([]);
  protected readonly continents = signal<Record<string, { en: string; fr: string }>>({});
  protected readonly selectedCountries = signal<Set<string>>(new Set());
  protected readonly selectedContinents = signal<Set<string>>(new Set());
  protected readonly countryFilter = signal('');

  protected readonly templates = signal<RateLimitTemplate[]>([]);
  protected readonly rateLimit = signal<RateLimitSettings | null>(null);
  protected readonly chosenTemplate = signal('');

  protected readonly error = signal<string | null>(null);
  /** Set by any mutation the API flagged `applyRequired`. */
  protected readonly pendingApply = signal(false);
  protected readonly applying = signal(false);
  protected readonly savingGeo = signal(false);

  protected readonly rateLimitForm = this.fb.nonNullable.group({
    averagePerSecond: [10, [Validators.required, Validators.min(1)]],
    burst: [20, [Validators.required, Validators.min(1)]],
    periodSeconds: [1, [Validators.required, Validators.min(1)]],
    concurrencyLimit: [50, [Validators.required, Validators.min(1)]],
  });

  /** Continent codes paired with their name in the active language. */
  protected readonly continentEntries = computed(() => {
    const lang = this.translate.currentLang === 'fr' ? 'fr' : 'en';
    return Object.entries(this.continents()).map(([code, names]) => ({
      code,
      name: names[lang],
    }));
  });

  /** Filtered on demand: rendering 250 checkboxes upfront helps nobody. */
  protected readonly filteredCountries = computed(() => {
    const needle = this.countryFilter().trim().toLowerCase();
    if (!needle) return [];
    return this.countries()
      .filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle))
      .slice(0, 50);
  });

  protected readonly selectedCountryCodes = computed(() => [...this.selectedCountries()].sort());

  protected readonly hasGeoSelection = computed(
    () => this.selectedCountries().size > 0 || this.selectedContinents().size > 0
  );

  protected readonly chosenTemplateDetail = computed(
    () => this.templates().find((t) => t.key === this.chosenTemplate()) ?? null
  );

  /** The status hero's three states — off, on but not enforced, and genuinely active. */
  private heroState(fw: FirewallConfig): 'off' | 'partial' | 'active' {
    if (!fw.enabled) return 'off';
    return fw.enforcement?.state === 'enforced' ? 'active' : 'partial';
  }
  protected heroIcon(fw: FirewallConfig): string {
    const state = this.heroState(fw);
    if (state === 'active') return 'fa-solid fa-shield-check';
    if (state === 'partial') return 'fa-solid fa-shield-halved';
    return 'fa-solid fa-shield';
  }
  protected heroColor(fw: FirewallConfig): string {
    const state = this.heroState(fw);
    if (state === 'active') return 'var(--color-success)';
    if (state === 'partial') return 'var(--color-warning)';
    return 'var(--color-text-tertiary)';
  }
  protected heroTitleKey(fw: FirewallConfig): string {
    return `security.app.hero.${this.heroState(fw)}Title`;
  }
  protected heroSubtitleKey(fw: FirewallConfig): string {
    return `security.app.hero.${this.heroState(fw)}Subtitle`;
  }

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    const locale = this.translate.currentLang || 'en';

    this.api.getFirewall(this.uuid).subscribe((f) => this.firewall.set(f));
    this.api.listFirewallRules(this.uuid).subscribe((r) => this.rules.set(r));
    this.api.getGeoBlocking(this.uuid, locale).subscribe((g) => this.geo.set(g));
    this.api.listCountries(locale).subscribe((cat) => {
      this.countries.set(cat.countries);
      this.continents.set(cat.continents);
    });
    this.api.listRateLimitTemplates().subscribe((t) => this.templates.set(t));
    this.api.getRateLimit(this.uuid).subscribe((rl) => this.rateLimit.set(rl));
    this.loadAlerts();
    this.loadTraffic();
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected onCountryFilter(event: Event): void {
    this.countryFilter.set((event.target as HTMLInputElement).value);
  }

  protected onTemplatePick(event: Event): void {
    this.chosenTemplate.set((event.target as HTMLSelectElement).value);
  }

  protected toggleCountry(code: string): void {
    this.selectedCountries.update((set) => {
      const next = new Set(set);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  protected toggleContinent(code: string): void {
    this.selectedContinents.update((set) => {
      const next = new Set(set);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  protected loadAlerts(): void {
    this.api.listFirewallAlerts(this.uuid).subscribe({
      next: (a) => this.alerts.set(a),
      error: (e) => this.report(e, 'security.app.alertsError'),
    });
  }

  protected loadTraffic(): void {
    this.api.listFirewallTraffic(this.uuid).subscribe({
      next: (t) => this.traffic.set(t),
      error: (e) => this.report(e, 'security.app.trafficError'),
    });
  }

  protected toggleFirewall(fw: FirewallConfig): void {
    this.api.updateFirewall(this.uuid, { enabled: !fw.enabled }).subscribe({
      next: (f) => {
        this.firewall.set(f);
        this.pendingApply.set(true);
      },
      error: (e) => this.report(e, 'security.app.wafError'),
    });
  }

  protected removeRule(rule: FirewallRule): void {
    this.api.deleteFirewallRule(this.uuid, rule.id).subscribe({
      next: () => {
        this.rules.update((list) => list.filter((r) => r.id !== rule.id));
        this.pendingApply.set(true);
      },
      error: (e) => this.report(e, 'security.app.ruleError'),
    });
  }

  protected saveGeo(): void {
    if (!this.hasGeoSelection()) return;
    this.savingGeo.set(true);
    this.error.set(null);
    this.api
      .setGeoBlocking(this.uuid, {
        mode: 'block',
        countries: [...this.selectedCountries()],
        continents: [...this.selectedContinents()],
      })
      .subscribe({
        next: (result) => {
          this.geoWarnings.set(result.warnings);
          this.pendingApply.set(true);
          this.savingGeo.set(false);
          this.selectedCountries.set(new Set());
          this.selectedContinents.set(new Set());
          this.countryFilter.set('');
          this.refreshGeo();
        },
        error: (e) => {
          this.report(e, 'security.app.geoError');
          this.savingGeo.set(false);
        },
      });
  }

  private refreshGeo(): void {
    const locale = this.translate.currentLang || 'en';
    this.api.getGeoBlocking(this.uuid, locale).subscribe((g) => this.geo.set(g));
  }

  protected clearGeo(): void {
    this.api.removeGeoBlocking(this.uuid).subscribe({
      next: (r) => {
        this.geo.set(null);
        this.geoWarnings.set([]);
        this.pendingApply.set(r.applyRequired);
      },
      error: (e) => this.report(e, 'security.app.geoError'),
    });
  }

  protected applyTemplate(): void {
    const key = this.chosenTemplate();
    if (!key) return;
    this.error.set(null);
    this.api.applyRateLimitTemplate(this.uuid, key).subscribe({
      next: (rl) => {
        this.rateLimit.set(rl);
        this.pendingApply.set(rl.applyRequired);
      },
      error: (e) => this.report(e, 'security.app.rateLimitError'),
    });
  }

  protected saveCustomRateLimit(): void {
    if (this.rateLimitForm.invalid) return;
    this.error.set(null);
    this.api.setCustomRateLimit(this.uuid, this.rateLimitForm.getRawValue()).subscribe({
      next: (rl) => {
        this.rateLimit.set(rl);
        this.pendingApply.set(rl.applyRequired);
      },
      error: (e) => this.report(e, 'security.app.rateLimitError'),
    });
  }

  protected clearRateLimit(): void {
    this.api.removeRateLimit(this.uuid).subscribe({
      next: (r) => {
        this.rateLimit.set(null);
        this.pendingApply.set(r.applyRequired);
      },
      error: (e) => this.report(e, 'security.app.rateLimitError'),
    });
  }

  /**
   * Push the saved rules to the proxy. The API may refuse — enforcement is not
   * wired for every setup — and that refusal is shown rather than swallowed.
   */
  protected applyNow(): void {
    this.applying.set(true);
    this.error.set(null);
    this.api.deployFirewall(this.uuid).subscribe({
      next: () => {
        this.applying.set(false);
        this.pendingApply.set(false);
        this.api.getFirewall(this.uuid).subscribe((f) => this.firewall.set(f));
      },
      error: (e) => {
        this.report(e, 'security.app.applyError');
        this.applying.set(false);
      },
    });
  }
}
