import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiService, apiCode, apiMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Application, Contact, DomainSession, PaymentRequiredBody, PriceSession } from '../../core/models';
import { ContactForm } from '../../shared/components/contact-form';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * Commander un nom : le prix garanti (le temps de la commande), le titulaire, l'application à
 * laquelle le relier (facultatif), puis le paiement depuis le portefeuille IDEM. Si le solde ne
 * suffit pas, la commande attend : on recharge, on revient, on paie — sans tout recommencer.
 */
@Component({
  selector: 'idm-checkout',
  imports: [DatePipe, FormsModule, RouterLink, TranslateModule, IdemLoaderComponent, ContactForm, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10">
      <a routerLink="/" class="button-ghost button-sm inline-flex items-center gap-2"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ 'checkout.back' | translate }}</a>
      <h1 class="mt-4 text-2xl font-semibold">{{ 'checkout.title' | translate }}</h1>

      @if (loadError()) {
        <section class="glass-card mt-6 flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="120" />
          <p class="mt-4 font-semibold">{{ loadError() }}</p>
          <a routerLink="/" class="inner-button mt-5">{{ 'checkout.searchAgain' | translate }}</a>
        </section>
      } @else if (!session()) {
        <div class="mt-6 space-y-3"><div class="skeleton h-28 rounded-xl"></div><div class="skeleton h-40 rounded-xl"></div></div>
      } @else {
        @let s = session()!;
        <!-- 1. Le nom et son prix garanti. -->
        <section class="glass-card mt-6 p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="break-all text-lg font-semibold">{{ s.domain }}</p>
              <p class="mt-1 text-xs text-[var(--color-text-secondary)]">{{ 'checkout.guaranteed' | translate: { time: (s.expiresAt | date: 'HH:mm') } }}</p>
            </div>
            <div class="text-right">
              <p class="text-xl font-semibold">{{ s.priceXaf | xaf }}</p>
              @if (s.atCost) { <p class="text-xs text-[var(--color-success)]">{{ 'checkout.atCost' | translate }}</p> }
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <label for="years" class="!mb-0 text-sm">{{ 'checkout.duration' | translate }}</label>
            <select id="years" class="!w-auto" [ngModel]="years()" (ngModelChange)="changeYears($event)" [disabled]="refreshing()">
              @for (y of yearOptions; track y) { <option [ngValue]="y">{{ (y === 1 ? 'checkout.oneYear' : 'checkout.years') | translate: { count: y } }}</option> }
            </select>
            @if (refreshing()) { <idem-loader size="xs" /> }
          </div>
          @if (s.renewalXaf) {
            <p class="mt-3 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.renewal' | translate: { price: (s.renewalXaf | xaf) } }}</p>
          }
        </section>

        <!-- 2. Le titulaire. -->
        <section class="glass-card mt-4 p-5">
          <h2 class="font-semibold">{{ 'checkout.holder' | translate }}</h2>
          @if (contact() && !editingContact()) {
            <p class="mt-2 text-sm">{{ contact()!.firstName }} {{ contact()!.lastName }} · {{ contact()!.email }}</p>
            <p class="text-sm text-[var(--color-text-secondary)]">{{ contact()!.address }}, {{ contact()!.city }} ({{ contact()!.country }})</p>
            <button type="button" class="button-ghost button-sm mt-2" (click)="editingContact.set(true)">{{ 'checkout.editHolder' | translate }}</button>
          } @else {
            <p class="mb-4 mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.holderWhy' | translate }}</p>
            <idm-contact-form [contact]="contact()" [defaults]="defaults()" [cancellable]="!!contact()" (saved)="contactSaved($event)" (cancelled)="editingContact.set(false)" />
          }
        </section>

        <!-- 3. Relier à une application (facultatif). -->
        <section class="glass-card mt-4 p-5">
          <h2 class="font-semibold">{{ 'checkout.connectTitle' | translate }}</h2>
          @if (domainSession(); as ds) {
            <p class="mt-2 text-sm">{{ 'checkout.connectFixed' | translate: { app: ds.appName || ds.appUuid } }}</p>
          } @else if (apps() === null) {
            <idem-loader size="sm" block />
          } @else if (apps()!.length) {
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.connectWhy' | translate }}</p>
            <label for="app" class="sr-only">{{ 'checkout.connectTitle' | translate }}</label>
            <select id="app" class="mt-3" [ngModel]="appUuid()" (ngModelChange)="appUuid.set($event)">
              <option [ngValue]="null">{{ 'checkout.connectLater' | translate }}</option>
              @for (a of apps(); track a.uuid) { <option [ngValue]="a.uuid">{{ a.name }}</option> }
            </select>
          } @else {
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.noApps' | translate }}</p>
          }
        </section>

        <!-- 4. Payer. -->
        <section class="mt-6">
          @if (payment(); as p) {
            <div class="glass-card mb-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center" role="alert">
              <idm-illustration kind="cowries" [width]="96" class="shrink-0" />
              <div class="flex-1">
                <p class="font-semibold">{{ 'checkout.missing' | translate: { missing: (p.missingXaf ?? 0 | xaf) } }}</p>
                <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.topupHint' | translate }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <a [href]="topupUrl(p)" target="_blank" rel="noopener" class="outer-button button-sm">{{ 'checkout.topup' | translate }}</a>
                  <button type="button" class="inner-button button-sm inline-flex items-center gap-2" [disabled]="paying()" (click)="retryPayment()">
                    @if (paying()) { <idem-loader size="xs" /> }
                    {{ 'checkout.paidRetry' | translate }}
                  </button>
                </div>
              </div>
            </div>
          }
          @if (error()) { <p class="mb-3 text-sm text-[var(--color-danger)]" role="alert">{{ error() }}</p> }
          @if (!payment()) {
            <button type="button" class="inner-button button-lg inline-flex w-full items-center justify-center gap-2" [disabled]="!canPay()" (click)="pay()">
              @if (paying()) { <idem-loader size="xs" /> }
              {{ 'checkout.pay' | translate: { price: (s.priceXaf | xaf) } }}
            </button>
            <p class="mt-2 text-center text-xs text-[var(--color-text-tertiary)]">{{ 'checkout.payHint' | translate }}</p>
          }
        </section>
      }
    </div>
  `,
})
export class CheckoutPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly yearOptions = [1, 2, 3, 4, 5];
  protected readonly domain = this.params.get('domain') ?? '';
  protected readonly years = signal(Math.min(5, Math.max(1, Number(this.params.get('years')) || 1)));
  protected readonly session = signal<PriceSession | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly refreshing = signal(false);
  protected readonly contact = signal<Contact | null>(null);
  protected readonly defaults = signal<Partial<Contact>>({});
  protected readonly editingContact = signal(false);
  protected readonly apps = signal<Application[] | null>(null);
  protected readonly appUuid = signal<string | null>(this.params.get('app'));
  protected readonly domainSession = signal<DomainSession | null>(null);
  protected readonly paying = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly payment = signal<PaymentRequiredBody | null>(null);
  private pendingOrderId: string | null = null;
  /** Une clé par page : le même clic rejoué (double clic, réseau coupé) ne crée qu'une commande. */
  private readonly idempotencyKey = crypto.randomUUID();

  protected readonly canPay = computed(() => Boolean(this.session()) && Boolean(this.contact()) && !this.editingContact() && !this.paying() && !this.refreshing());

  constructor() {
    if (!this.domain) {
      this.loadError.set(this.translate.instant('checkout.noDomain'));
      return;
    }
    this.lockPrice();
    this.api.me().subscribe({
      next: (me) => {
        this.contact.set(me.contact);
        const [firstName, ...rest] = (me.user.displayName ?? '').split(' ');
        this.defaults.set({ email: me.user.email, firstName: firstName || '', lastName: rest.join(' ') });
      },
    });
    const sessionId = this.params.get('session');
    if (sessionId) {
      this.api.domainSession(sessionId).subscribe({ next: (ds) => this.domainSession.set(ds), error: () => this.loadApps() });
    } else {
      this.loadApps();
    }
  }

  private loadApps(): void {
    this.api.applications().subscribe({ next: (r) => this.apps.set(r.applications), error: () => this.apps.set([]) });
  }

  private lockPrice(): void {
    this.refreshing.set(true);
    this.api.priceSession(this.domain, this.years()).subscribe({
      next: (s) => {
        this.session.set(s);
        this.refreshing.set(false);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.loadError.set(apiMessage(e, this.translate.instant('checkout.priceError')));
      },
    });
  }

  protected changeYears(years: number): void {
    this.years.set(years);
    this.lockPrice();
  }

  protected contactSaved(contact: Contact): void {
    this.contact.set(contact);
    this.editingContact.set(false);
  }

  protected pay(): void {
    const s = this.session();
    if (!s) return;
    this.paying.set(true);
    this.error.set(null);
    const ds = this.domainSession();
    this.api
      .createOrder({
        priceSessionIds: [s.id],
        idempotencyKey: this.idempotencyKey,
        ...(ds ? { domainSessionId: ds.id, connectAppUuid: ds.appUuid } : this.appUuid() ? { connectAppUuid: this.appUuid()! } : {}),
      })
      .subscribe({
        next: (order) => void this.router.navigate(['/orders', order.id]),
        error: (e: HttpErrorResponse) => this.handlePayError(e),
      });
  }

  protected retryPayment(): void {
    if (!this.pendingOrderId) return this.pay();
    this.paying.set(true);
    this.api.payOrder(this.pendingOrderId).subscribe({
      next: (order) => void this.router.navigate(['/orders', order.id]),
      error: (e: HttpErrorResponse) => this.handlePayError(e),
    });
  }

  private handlePayError(e: HttpErrorResponse): void {
    this.paying.set(false);
    if (e.status === 402) {
      const body = e.error as PaymentRequiredBody;
      this.pendingOrderId = body.orderId ?? this.pendingOrderId;
      this.payment.set(body);
      return;
    }
    if (apiCode(e) === 'price_session_expired') {
      this.error.set(apiMessage(e, ''));
      this.lockPrice();
      return;
    }
    if (apiCode(e) === 'contact_required') this.editingContact.set(true);
    this.error.set(apiMessage(e, this.translate.instant('checkout.payError')));
  }

  protected topupUrl(p: PaymentRequiredBody): string {
    const amount = p.topupXaf ?? p.missingXaf ?? 0;
    return `${environment.services.dashboard.url}/account/plans?topup=${amount}`;
  }
}
