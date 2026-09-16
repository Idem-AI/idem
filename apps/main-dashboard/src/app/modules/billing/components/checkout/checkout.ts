import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, interval, takeUntil } from 'rxjs';
import { BillingService } from '../../services/billing.service';
import {
  FINAL_PAYMENT_STATUSES,
  PaymentMethods,
  PaymentProviderOption,
  PaymentView,
  Quote,
} from '../../models/billing.model';

/**
 * Paiement Mobile Money, de bout en bout.
 *
 * Le parcours suit ce que vit réellement l'abonné :
 *
 *   1. ce qu'il achète et combien ;
 *   2. son pays et son numéro — l'opérateur est deviné, jamais demandé en
 *      premier (personne ne pense « MTN_MOMO_CMR », tout le monde connaît son
 *      numéro) ;
 *   3. l'attente pendant qu'il saisit son code sur son téléphone ;
 *   4. le résultat, en français, avec ce qu'il peut faire s'il a échoué.
 *
 * Deux détails comptent plus qu'ils n'en ont l'air. Le **rappel de saisie du
 * code** après quinze secondes : chez plusieurs opérateurs la demande
 * disparaît de l'écran et l'abonné croit avoir raté son paiement. Et le
 * **message d'attente au-delà de trois minutes** : le réseau Mobile Money peut
 * confirmer bien plus tard, et il vaut mieux dire « nous vous préviendrons »
 * que d'afficher un échec qui n'en est pas un.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="w-full max-w-md mx-auto">
      <!-- 1. Ce qu'on achète -->
      @if (quote(); as offer) {
        <div class="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-surface-1)] p-4 mb-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-text-secondary">{{ 'billing.checkout.youArePaying' | translate }}</p>
              <p class="text-base font-semibold text-text-primary mt-0.5">{{ offer.label }}</p>
              @if (offer.credits > 0) {
                <p class="text-xs text-text-tertiary mt-1">
                  {{ 'billing.checkout.creditsIncluded' | translate: { count: offer.credits } }}
                </p>
              }
            </div>
            <div class="text-right shrink-0">
              <p class="text-2xl font-bold text-text-primary tabular-nums">
                {{ offer.amount | number: '1.0-0' }}
              </p>
              <p class="text-xs text-text-tertiary">{{ offer.currency }}</p>
            </div>
          </div>
        </div>
      }

      @if (loadError(); as message) {
        <div class="rounded-lg border border-danger/30 bg-danger/10 p-4 mb-4">
          <p class="text-sm text-danger">{{ message }}</p>
        </div>
      }

      <!-- 2. Numéro et opérateur -->
      @if (step() === 'form') {
        <div class="space-y-4">
          <label class="block">
            <span class="text-sm text-text-secondary">{{ 'billing.checkout.country' | translate }}</span>
            <select
              class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-text-primary"
              [ngModel]="country()"
              (ngModelChange)="onCountryChange($event)"
            >
              @for (option of countries(); track option.code) {
                <option [value]="option.code">{{ option.name }} (+{{ option.prefix }})</option>
              }
            </select>
          </label>

          <label class="block">
            <span class="text-sm text-text-secondary">{{ 'billing.checkout.phone' | translate }}</span>
            <div class="relative mt-1">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                +{{ selectedCountry()?.prefix }}
              </span>
              <input
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2.5 pl-14 pr-3 text-text-primary"
                [placeholder]="'billing.checkout.phonePlaceholder' | translate"
                [ngModel]="phone()"
                (ngModelChange)="onPhoneChange($event)"
              />
            </div>
            <span class="mt-1 block text-xs text-text-tertiary">
              {{ 'billing.checkout.phoneHint' | translate }}
            </span>
          </label>

          <!-- L'opérateur détecté est présélectionné ; la liste reste ouverte
               parce qu'un numéro porté peut appartenir à un autre réseau. -->
          @if (providers().length > 0) {
            <div>
              <span class="text-sm text-text-secondary">{{ 'billing.checkout.provider' | translate }}</span>
              <div class="mt-2 grid grid-cols-2 gap-2">
                @for (option of providers(); track option.provider) {
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors"
                    [class.border-primary]="provider() === option.provider"
                    [class.bg-primary]="provider() === option.provider"
                    [class.text-white]="provider() === option.provider"
                    [class.border-[var(--color-border)]]="provider() !== option.provider"
                    [class.opacity-40]="!option.available"
                    [disabled]="!option.available"
                    (click)="provider.set(option.provider)"
                  >
                    @if (option.logo) {
                      <img [src]="option.logo" [alt]="option.displayName" class="h-6 w-6 rounded object-contain" />
                    }
                    <span class="text-sm">
                      {{ option.displayName }}
                      @if (!option.available) {
                        <span class="block text-xs opacity-70">
                          {{ 'billing.checkout.providerClosed' | translate }}
                        </span>
                      }
                    </span>
                  </button>
                }
              </div>
            </div>
          }

          <button
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition-opacity disabled:opacity-40"
            [disabled]="!canPay()"
            (click)="pay()"
          >
            @if (isPaying()) {
              <i class="pi pi-spinner pi-spin mr-2"></i>
            }
            {{ 'billing.checkout.pay' | translate: { amount: quote()?.amount, currency: quote()?.currency } }}
          </button>

          <p class="text-center text-xs text-text-tertiary">
            {{ 'billing.checkout.secured' | translate }}
          </p>
        </div>
      }

      <!-- 3. Attente de validation -->
      @if (step() === 'waiting') {
        <div class="text-center py-6">
          <div class="mx-auto mb-5 h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>

          <p class="text-base font-semibold text-text-primary">
            {{ 'billing.checkout.waitingTitle' | translate }}
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            {{ 'billing.checkout.waitingBody' | translate: { phone: payment()?.phoneMasked } }}
          </p>

          <!-- Rappel de relance : chez plusieurs opérateurs la demande de code
               disparaît, et l'abonné croit que le paiement a échoué. -->
          @if (showPinReminder()) {
            <div class="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-left">
              <p class="text-sm text-text-primary">
                {{ 'billing.checkout.pinReminder' | translate }}
              </p>
              @if (pinInstructions(); as instructions) {
                <p class="mt-1 text-xs text-text-secondary">{{ instructions }}</p>
              }
            </div>
          }

          @if (slowPayment()) {
            <div class="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <p class="text-sm text-text-secondary">
                {{ 'billing.checkout.slowPayment' | translate }}
              </p>
            </div>
          }

          @if (payment()?.reference; as reference) {
            <p class="mt-5 font-mono text-xs text-text-tertiary">{{ reference }}</p>
          }
        </div>
      }

      <!-- 4. Résultat -->
      @if (step() === 'result') {
        <div class="text-center py-4">
          @if (payment()?.status === 'COMPLETED') {
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <i class="pi pi-check text-2xl text-success"></i>
            </div>
            <p class="text-lg font-semibold text-text-primary">
              {{ 'billing.checkout.successTitle' | translate }}
            </p>
            <p class="mt-2 text-sm text-text-secondary">
              {{ 'billing.checkout.successBody' | translate: { label: payment()?.label } }}
            </p>
          } @else {
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
              <i class="pi pi-times text-2xl text-danger"></i>
            </div>
            <p class="text-lg font-semibold text-text-primary">
              {{ payment()?.failure?.message || ('billing.checkout.failedTitle' | translate) }}
            </p>
            @if (payment()?.failure?.hint; as hint) {
              <p class="mt-2 text-sm text-text-secondary">{{ hint }}</p>
            }
            <!-- Dire que rien n'a été prélevé : c'est la première inquiétude
                 après un échec de paiement Mobile Money. -->
            <p class="mt-3 text-xs text-text-tertiary">
              {{ 'billing.checkout.noCharge' | translate }}
            </p>
          }

          <div class="mt-6 flex flex-col gap-2">
            @if (payment()?.status === 'COMPLETED') {
              <button type="button" class="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white" (click)="finish()">
                {{ 'billing.checkout.continue' | translate }}
              </button>
            } @else {
              @if (payment()?.failure?.retryable !== false) {
                <button type="button" class="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white" (click)="retry()">
                  {{ 'billing.checkout.retry' | translate }}
                </button>
              }
              <button type="button" class="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 text-text-secondary" (click)="finish()">
                {{ 'common.close' | translate }}
              </button>
            }
          </div>

          @if (payment()?.reference; as reference) {
            <p class="mt-4 font-mono text-xs text-text-tertiary">{{ reference }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class CheckoutComponent {
  private readonly billing = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);

  /** Produit acheté. Le prix vient de l'API, jamais du composant. */
  readonly productCode = input.required<string>();
  readonly engine = input<string | undefined>(undefined);
  readonly projectId = input<string | undefined>(undefined);
  readonly interval = input<'month' | 'year' | undefined>(undefined);
  readonly simulationTier = input<string | undefined>(undefined);
  /** Application d'origine, pour mesurer les tunnels séparément. */
  readonly app = input<'dashboard' | 'appgen' | 'simulation' | 'ideploy'>('dashboard');

  readonly completed = output<PaymentView>();
  readonly dismissed = output<void>();

  readonly step = signal<'form' | 'waiting' | 'result'>('form');
  readonly quote = signal<Quote | null>(null);
  readonly methods = signal<PaymentMethods | null>(null);
  readonly payment = signal<PaymentView | null>(null);
  readonly isPaying = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly country = signal('CMR');
  readonly phone = signal('');
  readonly provider = signal<string | null>(null);

  /** Affiché après 15 s d'attente. */
  readonly showPinReminder = signal(false);
  /** Affiché après 3 min : le paiement peut encore aboutir. */
  readonly slowPayment = signal(false);

  private readonly stopPolling = new Subject<void>();
  private predictTimer?: ReturnType<typeof setTimeout>;

  readonly countries = computed(() => this.billing.catalog()?.countries ?? []);
  readonly selectedCountry = computed(() =>
    this.countries().find((entry) => entry.code === this.country()),
  );
  readonly providers = computed<PaymentProviderOption[]>(() => this.methods()?.providers ?? []);

  readonly canPay = computed(
    () =>
      !this.isPaying() &&
      Boolean(this.quote()) &&
      Boolean(this.provider()) &&
      this.phone().replace(/\D/g, '').length >= 8,
  );

  /** Instructions de relance du code, fournies par l'opérateur via pawaPay. */
  readonly pinInstructions = computed(
    () =>
      this.providers().find((option) => option.provider === this.provider())
        ?.pinPromptInstructions ?? null,
  );

  constructor() {
    // Le devis et les moyens de paiement dépendent du produit et du pays :
    // un effet les recharge à chaque changement, sans que l'appelant s'en soucie.
    effect(() => {
      const code = this.productCode();
      const country = this.country();
      if (code) this.loadQuote(code, country);
    });

    effect(() => {
      const country = this.country();
      if (country) this.loadMethods(country);
    });

    this.destroyRef.onDestroy(() => {
      this.stopPolling.next();
      this.stopPolling.complete();
      if (this.predictTimer) clearTimeout(this.predictTimer);
    });
  }

  private loadQuote(productCode: string, country: string): void {
    this.billing
      .getQuote({
        productCode,
        interval: this.interval(),
        country,
        engine: this.engine(),
      })
      .subscribe({
        next: (quote) => {
          this.quote.set(quote);
          this.loadError.set(null);
        },
        error: (err) => this.loadError.set(err?.error?.message ?? null),
      });
  }

  private loadMethods(country: string): void {
    this.billing.getPaymentMethods(country).subscribe({
      next: (methods) => {
        this.methods.set(methods);

        // Un seul opérateur disponible : on le choisit d'office, l'abonné n'a
        // pas de décision à prendre.
        const available = methods.providers.filter((option) => option.available);
        if (available.length === 1) this.provider.set(available[0].provider);
      },
      error: () => this.methods.set(null),
    });
  }

  onCountryChange(code: string): void {
    this.country.set(code);
    this.provider.set(null);
  }

  /**
   * Détection de l'opérateur pendant la saisie.
   *
   * Temporisée : interroger le prestataire à chaque touche produirait dix
   * requêtes pour un numéro, et la détection n'a d'intérêt qu'une fois le
   * numéro presque complet.
   */
  onPhoneChange(value: string): void {
    this.phone.set(value);

    if (this.predictTimer) clearTimeout(this.predictTimer);
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8) return;

    this.predictTimer = setTimeout(() => {
      this.billing.predictProvider(digits, this.country()).subscribe({
        next: (prediction) => {
          if (!prediction.provider) return;

          // La détection ne contredit pas un choix explicite de l'utilisateur.
          const known = this.providers().some(
            (option) => option.provider === prediction.provider && option.available,
          );
          if (known && !this.provider()) this.provider.set(prediction.provider);
        },
        error: () => undefined,
      });
    }, 500);
  }

  pay(): void {
    if (!this.canPay()) return;

    this.isPaying.set(true);
    this.loadError.set(null);

    this.billing
      .checkout({
        productCode: this.productCode(),
        phoneNumber: this.phone().replace(/\D/g, ''),
        country: this.country(),
        provider: this.provider() ?? undefined,
        engine: this.engine() as never,
        projectId: this.projectId(),
        interval: this.interval(),
        simulationTier: this.simulationTier(),
        app: this.app(),
      })
      .subscribe({
        next: (payment) => {
          this.isPaying.set(false);
          this.payment.set(payment);

          // Opérateur à redirection (Wave) : l'abonné autorise sur une page
          // externe. On l'y envoie, et le suivi continue de notre côté.
          if (payment.authorizationUrl) {
            window.open(payment.authorizationUrl, '_blank', 'noopener');
          }

          this.step.set('waiting');
          this.startWaitingTimers();
          this.startPolling(payment.reference);
        },
        error: (err) => {
          this.isPaying.set(false);
          this.loadError.set(
            err?.error?.message ?? 'Le paiement n’a pas pu être lancé. Réessayez.',
          );
        },
      });
  }

  private startWaitingTimers(): void {
    this.showPinReminder.set(false);
    this.slowPayment.set(false);

    setTimeout(() => {
      if (this.step() === 'waiting') this.showPinReminder.set(true);
    }, 15_000);

    setTimeout(() => {
      if (this.step() === 'waiting') this.slowPayment.set(true);
    }, 180_000);
  }

  /**
   * Suit le statut jusqu'à une issue finale.
   *
   * Toutes les trois secondes : assez pour que l'écran suive la validation de
   * l'abonné, assez peu pour ne pas marteler l'API. Le suivi s'arrête de
   * lui-même à la destruction du composant.
   */
  private startPolling(reference: string): void {
    interval(3000)
      .pipe(takeUntil(this.stopPolling))
      .subscribe(() => {
        this.billing.getPayment(reference).subscribe({
          next: (payment) => {
            this.payment.set(payment);

            if (FINAL_PAYMENT_STATUSES.includes(payment.status)) {
              this.stopPolling.next();
              this.step.set('result');

              if (payment.status === 'COMPLETED') {
                // Les droits viennent de changer : on les recharge avant que
                // l'utilisateur revienne à son écran de travail.
                this.billing.loadMe().subscribe();
                this.completed.emit(payment);
              }
            }
          },
          error: () => undefined,
        });
      });
  }

  retry(): void {
    this.payment.set(null);
    this.step.set('form');
  }

  finish(): void {
    this.stopPolling.next();
    this.dismissed.emit();
  }
}
