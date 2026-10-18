import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Connection, Contact, Quote, createIdomainClient } from '../client';
import { DomainPurchaseFlow, PURCHASE_STAGES, PurchaseState, formatXaf, stageIndex } from '../flow';
import { CONTACT_FIELDS, FACADE_PATHS, idomainText } from '../texts';

/**
 * Acheter un nom sans quitter l'application (iDeploy) : une fenêtre, quatre gestes au plus —
 * chercher, (titulaire la première fois), payer, regarder l'installation se faire. Le nom est
 * relié à l'application dès son enregistrement ; aucun réglage n'est demandé.
 *
 * ```html
 * <idem-domain-purchase [apiUrl]="idomainApi" [appUuid]="app.uuid" [appName]="app.name" [lang]="lang" [topupUrl]="topup" (closed)="…" (finished)="…" />
 * ```
 */
@Component({
  selector: 'idem-domain-purchase',
  imports: [IdemLoaderComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6', '(keydown.escape)': 'close()' },
  template: `
    @let s = state();
    <button type="button" class="absolute inset-0 cursor-default" style="background: color-mix(in oklch, var(--color-bg-darker) 60%, transparent)" [attr.aria-label]="t('close')" (click)="close()"></button>
    <section class="modal-panel relative flex max-h-[88dvh] w-full max-w-[34rem] flex-col overflow-hidden !rounded-b-none sm:max-h-[min(44rem,88dvh)] sm:!rounded-b-[var(--radius-2xl)]" role="dialog" aria-modal="true" aria-labelledby="idm-purchase-title">
      <header class="shrink-0 px-6 pb-4 pt-5">
        <div class="flex items-center justify-between gap-4">
          <h2 id="idm-purchase-title" class="text-base font-semibold">{{ t('title') }}</h2>
          <button type="button" class="button-icon !p-2" [attr.aria-label]="t('close')" (click)="close()"><i class="pi pi-times" aria-hidden="true"></i></button>
        </div>
        <div class="mt-3 flex gap-1.5" aria-hidden="true">
          @for (st of stages; track st; let i = $index) {
            <span class="h-1 flex-1 rounded-full" [style.background]="i <= stage() ? 'var(--color-primary-500)' : 'var(--color-surface-3)'"></span>
          }
        </div>
        <p class="mt-2 text-xs text-[var(--color-text-secondary)]">{{ t('stage.label', { n: stage() + 1, name: t('stage.' + stages[stage()]) }) }}</p>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6" aria-live="polite">
        @if (s.error) {
          <p class="mb-4 rounded-lg px-3 py-2 text-sm text-[var(--color-danger)]" style="background: color-mix(in oklch, var(--color-danger) 8%, transparent)" role="alert">{{ s.error.text || t(s.error.key || 'errors.pay') }}</p>
        }

        @switch (s.step) {
          @case ('search') {
            <form role="search" class="flex items-center gap-1 rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-2)] p-1 focus-within:border-[var(--color-primary-500)]" (submit)="$event.preventDefault(); search(query.value)">
              <label class="sr-only" for="idm-query">{{ t('search.label') }}</label>
              <input #query id="idm-query" type="text" class="!m-0 min-w-0 flex-1 !border-0 !bg-transparent !px-3 !py-2 !shadow-none !outline-none" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="253" [placeholder]="t('search.placeholder')" [value]="initial()" (input)="flow.type($any($event.target).value)" />
              <button type="submit" class="inner-button button-sm inline-flex shrink-0 items-center gap-2" [disabled]="s.searching || s.locking">
                @if (s.searching) { <idem-loader size="xs" /> }
                {{ t('search.submit') }}
              </button>
            </form>
            @if (s.locking) { <idem-loader block class="mt-6" /> }
            @if (!s.result && !s.searching) {
              <div class="flex flex-col items-center px-4 py-8 text-center">
                <svg viewBox="0 0 120 88" width="120" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--color-text-tertiary)">
                  @for (p of facade; track p.d) {
                    <path [attr.d]="p.d" [attr.stroke-width]="p.width" [attr.opacity]="p.opacity ?? null" [style.color]="p.accent ? 'var(--color-primary-500)' : null" />
                  }
                </svg>
                <p class="mt-4 max-w-xs text-sm text-[var(--color-text-secondary)]">{{ t('search.empty') }}</p>
              </div>
            }
            @if (s.searching && !s.result) {
              <div class="mt-4 space-y-2"><div class="skeleton h-14 rounded-xl"></div><div class="skeleton h-12 rounded-xl"></div></div>
            }
            @if (s.result; as r) {
              @if (r.exact) {
                <ul class="mt-4 overflow-hidden rounded-xl border border-[var(--glass-border)]">
                  <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: r.exact, featured: true }" />
                </ul>
              } @else {
                <p class="mt-4 text-sm text-[var(--color-text-secondary)]">{{ t('search.invalid') }}</p>
              }
              @if (r.suggestions.length) {
                <p class="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">{{ t('search.suggestions') }}</p>
                <ul class="mt-2 divide-y divide-[var(--glass-border-subtle)] overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]">
                  @for (q of r.suggestions; track q.domain) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: q }" /> }
                </ul>
              }
              @if (r.extensions.length) {
                <p class="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">{{ t('search.otherExtensions') }}</p>
                <ul class="mt-2 divide-y divide-[var(--glass-border-subtle)] overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]">
                  @for (q of r.extensions; track q.domain) { <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: q }" /> }
                </ul>
              }
            }
          }

          @case ('holder') {
            <h3 class="font-semibold">{{ t('holder.title') }}</h3>
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ t('holder.lead') }}</p>
            <form id="idm-holder" class="mt-4 grid gap-3 sm:grid-cols-2" novalidate (submit)="$event.preventDefault(); saveContact()">
              @for (f of fields; track f.name) {
                <div [class.sm:col-span-2]="f.wide">
                  <label [for]="'idm-' + f.name">{{ t('field.' + f.name) }}</label>
                  <input [id]="'idm-' + f.name" [type]="f.type" [attr.autocomplete]="f.autocomplete" [value]="contactValue(f.name)" (input)="setField(f.name, $any($event.target).value)"
                    [attr.aria-invalid]="invalid(f.name)" [attr.aria-describedby]="invalid(f.name) ? 'idm-' + f.name + '-err' : null" />
                  @if (invalid(f.name)) { <p [id]="'idm-' + f.name + '-err'" class="mt-1 text-xs text-[var(--color-danger)]">{{ t('holder.invalid') }}</p> }
                </div>
              }
            </form>
          }

          @case ('confirm') {
            @let session = s.session!;
            <div class="rounded-2xl border border-[var(--glass-border)] p-4">
              <div class="flex items-center gap-2 rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-xs">
                <i class="pi pi-lock text-[10px]" style="color: var(--color-success)" aria-hidden="true"></i>
                <span class="truncate"><span class="text-[var(--color-text-tertiary)]">https://</span><span class="font-medium">{{ session.domain }}</span></span>
              </div>
              <div class="mt-4 flex items-end justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-lg font-semibold">{{ session.domain }}</p>
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ t('confirm.guaranteed', { time: time(session.expiresAt) }) }}</p>
                </div>
                <p class="shrink-0 text-2xl font-black">{{ xaf(session.priceXaf) }}</p>
              </div>
            </div>
            <dl class="mt-4 divide-y divide-[var(--glass-border-subtle)] text-sm">
              <div class="flex items-center justify-between gap-3 py-3">
                <dt><label for="idm-years" class="!m-0">{{ t('confirm.duration') }}</label></dt>
                <dd class="flex items-center gap-2">
                  @if (s.locking) { <idem-loader size="xs" /> }
                  <select id="idm-years" class="!m-0 !w-auto !py-1.5" (change)="flow.setYears(+$any($event.target).value)" [disabled]="s.locking">
                    @for (y of years; track y) { <option [value]="y" [selected]="y === s.years">{{ y === 1 ? t('confirm.oneYear') : t('confirm.years', { count: y }) }}</option> }
                  </select>
                </dd>
              </div>
              @if (session.renewalXaf) { <div class="py-3 text-[var(--color-text-secondary)]">{{ t('confirm.renewal', { price: xaf(session.renewalXaf) }) }}</div> }
              <div class="flex items-center justify-between gap-3 py-3">
                <dt class="text-[var(--color-text-secondary)]">{{ t('confirm.app') }}</dt>
                <dd class="min-w-0 text-right font-medium">
                  @if (appUuid()) {
                    <span class="truncate">{{ appName() || appUuid() }}</span>
                  } @else if (s.apps === null) {
                    <idem-loader size="xs" />
                  } @else if (s.apps.length) {
                    <label class="sr-only" for="idm-app">{{ t('confirm.chooseApp') }}</label>
                    <select id="idm-app" class="!m-0 !w-auto !py-1.5" (change)="flow.setApp($any($event.target).value || null)">
                      <option value="" [selected]="!s.appUuid">{{ t('confirm.chooseApp') }}</option>
                      @for (a of s.apps; track a.uuid) { <option [value]="a.uuid" [selected]="a.uuid === s.appUuid">{{ a.name }}</option> }
                    </select>
                  } @else {
                    <span class="text-xs font-normal text-[var(--color-text-secondary)]">{{ t('confirm.noApps') }}</span>
                  }
                </dd>
              </div>
              @if (s.contact) {
                <div class="flex items-center justify-between gap-3 py-3">
                  <dt class="truncate text-[var(--color-text-secondary)]">{{ t('confirm.holder', { name: s.contact.firstName + ' ' + s.contact.lastName }) }}</dt>
                  <dd><button type="button" class="button-ghost button-sm" (click)="flow.editContact()">{{ t('confirm.editHolder') }}</button></dd>
                </div>
              }
            </dl>
          }

          @case ('payment') {
            <div class="py-2">
              <p class="text-lg font-semibold">{{ t('payment.title', { missing: xaf(s.missingXaf) }) }}</p>
              <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ t('payment.lead') }}</p>
            </div>
          }

          @case ('progress') {
            <p class="truncate text-lg font-semibold">{{ s.order?.items?.[0]?.domain || s.session?.domain }}</p>
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ t('progress.' + (s.progress || 'registering')) }}</p>
            @if (!['failed', 'on_hold'].includes(s.progress || '')) {
              <ol class="mt-5 space-y-4">
                @for (step of steps(); track step) {
                  <li class="flex items-center gap-3 text-sm">
                    @if (done(step)) {
                      <span class="grid h-6 w-6 place-items-center rounded-full" style="background: var(--color-success)"><i class="pi pi-check text-[10px]" style="color: var(--color-surface-1)" aria-hidden="true"></i></span>
                    } @else if (current() === step) {
                      <span class="grid h-6 w-6 place-items-center"><idem-loader size="xs" /></span>
                    } @else {
                      <span class="h-6 w-6 rounded-full border border-[var(--glass-border)]" aria-hidden="true"></span>
                    }
                    <span [style.color]="!done(step) && current() !== step ? 'var(--color-text-tertiary)' : null">{{ t('progress.step.' + step) }}</span>
                  </li>
                }
              </ol>
            }
            @if (!['live', 'failed', 'connection_failed'].includes(s.progress || '')) {
              <p class="mt-5 text-xs text-[var(--color-text-tertiary)]">{{ t('progress.canClose') }}</p>
            }
          }
        }
      </div>

      @switch (s.step) {
        @case ('holder') {
          <footer class="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--glass-border-subtle)] px-6 py-4">
            <button type="button" class="button-ghost button-sm" (click)="flow.back()">{{ t('back') }}</button>
            <button type="submit" form="idm-holder" class="inner-button inline-flex items-center gap-2" [disabled]="s.savingContact">@if (s.savingContact) { <idem-loader size="xs" /> }{{ t('holder.save') }}</button>
          </footer>
        }
        @case ('confirm') {
          <footer class="shrink-0 border-t border-[var(--glass-border-subtle)] px-6 py-4">
            <button type="button" class="inner-button inline-flex w-full items-center justify-center gap-2" [disabled]="s.paying || s.locking" (click)="flow.pay()">
              @if (s.paying) { <idem-loader size="xs" /> }
              {{ s.appUuid ? t('confirm.pay', { price: xaf(s.session!.priceXaf) }) : t('confirm.payOnly', { price: xaf(s.session!.priceXaf) }) }}
            </button>
            <div class="mt-2 flex items-center justify-between gap-3">
              <button type="button" class="button-ghost button-sm" (click)="flow.back()">{{ t('back') }}</button>
              <p class="text-right text-[11px] leading-snug text-[var(--color-text-tertiary)]">{{ t('confirm.payHint') }}</p>
            </div>
          </footer>
        }
        @case ('payment') {
          <footer class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--glass-border-subtle)] px-6 py-4">
            <a class="outer-button" [href]="topupHref()" target="_blank" rel="noopener">{{ t('payment.topup') }}</a>
            <button type="button" class="inner-button inline-flex items-center gap-2" [disabled]="s.paying" (click)="flow.pay()">@if (s.paying) { <idem-loader size="xs" /> }{{ t('payment.retry') }}</button>
          </footer>
        }
        @case ('progress') {
          <footer class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--glass-border-subtle)] px-6 py-4">
            <button type="button" class="button-ghost" (click)="close()">{{ t('close') }}</button>
            @if (s.progress === 'connection_failed') { <button type="button" class="outer-button" (click)="flow.retryConnection()">{{ t('progress.retry') }}</button> }
            @if (s.progress === 'live' && s.connection) {
              <a class="inner-button" [href]="'https://' + s.connection.host" target="_blank" rel="noopener">{{ t('progress.open', { domain: s.connection.host }) }}</a>
            }
          </footer>
        }
      }
    </section>

    <ng-template #row let-q let-featured="featured">
      <li class="flex items-center gap-3 px-4 py-3" [style.background]="featured && q.state === 'available' ? 'color-mix(in oklch, var(--color-success) 7%, transparent)' : null">
        <div class="min-w-0 flex-1">
          <p class="truncate" [class]="featured ? 'text-base font-semibold' : 'text-sm font-medium'">{{ q.domain }}</p>
          <p class="text-xs" [style.color]="q.state === 'available' ? 'var(--color-success)' : 'var(--color-text-tertiary)'">
            {{ t('state.' + q.state) }}
            @if (q.state === 'available' && q.renewalXaf) { <span class="text-[var(--color-text-tertiary)]"> · {{ t('search.renewal', { price: xaf(q.renewalXaf) }) }}</span> }
          </p>
        </div>
        @if (q.state === 'available') {
          <span class="shrink-0 text-sm font-semibold">{{ xaf(q.priceXaf) }}</span>
          <button type="button" [class]="featured ? 'inner-button button-sm shrink-0' : 'outer-button button-sm shrink-0'" [disabled]="state().locking" (click)="choose(q)">{{ t('search.choose') }}</button>
        }
      </li>
    </ng-template>
  `,
})
export class DomainPurchaseComponent implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  /** L'API iDomain (environnement de l'application). */
  readonly apiUrl = input.required<string>();
  /** L'application qui recevra le nom ; absente, l'utilisateur la choisit. */
  readonly appUuid = input<string | null>(null);
  readonly appName = input<string | null>(null);
  readonly lang = input('fr');
  /** La page de recharge du portefeuille (le montant manquant y est ajouté). */
  readonly topupUrl = input.required<string>();
  /** Un nom à chercher tout de suite (le nom de l'application, par exemple). */
  readonly initial = input('');
  readonly closed = output<void>();
  /** L'installation est terminée (en ligne) : l'écran hôte peut se rafraîchir. */
  readonly finished = output<Connection | null>();

  protected flow!: DomainPurchaseFlow;
  protected readonly state = signal<PurchaseState>({} as PurchaseState);
  protected readonly facade = FACADE_PATHS;
  protected readonly fields = CONTACT_FIELDS;
  protected readonly years = [1, 2, 3, 4, 5];
  protected readonly stages = PURCHASE_STAGES;
  protected readonly stage = computed(() => stageIndex(this.state()));
  private draft: Partial<Contact> = {};
  private submitted = false;
  private unsubscribe?: () => void;
  private reported = false;

  protected readonly steps = computed(() => (this.state().appUuid ? ['paid', 'registered', 'connected', 'live'] : ['paid', 'registered']));
  protected readonly current = computed(() => {
    const p = this.state().progress;
    return p === 'registering' ? 'registered' : p === 'connecting' ? 'connected' : p === 'securing' ? 'live' : p === 'paying' ? 'paid' : null;
  });

  constructor() {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('#idm-query')?.focus());
  }

  ngOnInit(): void {
    this.flow = new DomainPurchaseFlow(createIdomainClient(this.apiUrl(), () => this.lang()), { appUuid: this.appUuid() });
    this.unsubscribe = this.flow.subscribe((s) => {
      this.state.set(s);
      if (s.progress === 'live' && !this.reported) {
        this.reported = true;
        this.finished.emit(s.connection);
      }
    });
    if (this.initial()) void this.flow.search(this.initial());
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.flow.dispose();
  }

  protected t(key: string, params: Record<string, string | number> = {}): string {
    return idomainText(this.lang(), key, params);
  }

  protected xaf(v: number | null | undefined): string {
    return formatXaf(v);
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString(this.lang().startsWith('en') ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  protected search(q: string): void {
    void this.flow.search(q);
  }

  protected choose(q: Quote): void {
    void this.flow.choose(q);
  }

  protected contactValue(name: keyof Contact): string {
    const source = { phoneCountryCode: '237', country: 'CM', ...this.state().contactDefaults, ...(this.state().contact ?? {}), ...this.draft };
    return String(source[name] ?? '');
  }

  protected setField(name: keyof Contact, value: string): void {
    this.draft = { ...this.draft, [name]: value };
  }

  protected invalid(name: string): boolean {
    if (!this.submitted) return false;
    const f = CONTACT_FIELDS.find((x) => x.name === name)!;
    const v = this.contactValue(name as keyof Contact).trim();
    return !(f.optional && !v) && !f.pattern.test(v);
  }

  protected saveContact(): void {
    this.submitted = true;
    if (CONTACT_FIELDS.some((f) => this.invalid(f.name))) {
      this.state.update((s) => ({ ...s }));
      return;
    }
    const value = Object.fromEntries(CONTACT_FIELDS.map((f) => [f.name, this.contactValue(f.name).trim()])) as unknown as Contact;
    void this.flow.saveContact({ ...value, company: value.company || null });
  }

  protected done(step: string): boolean {
    const p = this.state().progress;
    const order = ['paid', 'registered', 'connected', 'live'];
    if (p === 'live') return true;
    const cur = this.current();
    return cur !== null && order.indexOf(step) < order.indexOf(cur);
  }

  protected topupHref(): string {
    const amount = this.state().topupXaf ?? this.state().missingXaf;
    return `${this.topupUrl()}${amount ? `${this.topupUrl().includes('?') ? '&' : '?'}topup=${amount}` : ''}`;
  }

  protected close(): void {
    this.closed.emit();
  }
}
