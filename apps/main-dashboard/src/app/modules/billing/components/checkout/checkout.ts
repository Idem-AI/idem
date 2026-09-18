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
 * Pays déduit du fuseau horaire du navigateur.
 *
 * Aucune permission demandée, aucun appel réseau : le fuseau est déjà connu.
 *
 * **Seuls les noms de ville sans ambiguïté figurent ici.** Dans la base IANA,
 * `Africa/Dakar` et `Africa/Ouagadougou` sont des alias d'`Africa/Abidjan`, et
 * `Africa/Douala`, `Africa/Libreville`, `Africa/Brazzaville`, `Africa/Porto-Novo`
 * des alias d'`Africa/Lagos`. Un navigateur qui normalise vers le fuseau
 * canonique ne permet donc pas de distinguer le Sénégal de la Côte d'Ivoire.
 * Dans ce cas on ne présélectionne rien : mieux vaut demander que d'étiqueter
 * un client dans le mauvais pays, avec le mauvais indicatif.
 */
const COUNTRY_BY_TIMEZONE: Record<string, string> = {
  'Africa/Douala': 'CMR',
  'Africa/Abidjan': 'CIV',
  'Africa/Dakar': 'SEN',
  'Africa/Porto-Novo': 'BEN',
  'Africa/Ouagadougou': 'BFA',
  'Africa/Brazzaville': 'COG',
  'Africa/Libreville': 'GAB',
};

/** Le pays désigné par le fuseau du navigateur, ou `null` si le doute subsiste. */
function countryFromTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (zone && COUNTRY_BY_TIMEZONE[zone]) || null;
  } catch {
    // Environnement sans `Intl` complet : on demandera le pays, simplement.
    return null;
  }
}

/**
 * Pays servant au calcul du devis tant qu'aucun n'est choisi.
 *
 * Le prix ne dépend pas du pays : XAF et XOF sont à parité fixe 1:1 dans toute
 * la zone franc. Le montant affiché est donc exact avant même le choix, ce qui
 * évite de laisser le récapitulatif vide — la première chose qu'on veut lire
 * sur un écran de paiement.
 */
const QUOTE_FALLBACK_COUNTRY = 'CMR';

/**
 * Paiement Mobile Money, de bout en bout.
 *
 * Le parcours suit ce que vit réellement l'abonné :
 *
 *   1. ce qu'il achète et combien ;
 *   2. son pays — deviné quand c'est possible, demandé sinon — puis son
 *      numéro, dont l'indicatif suit le pays ; l'opérateur est détecté, jamais
 *      demandé en premier (personne ne pense « MTN_MOMO_CMR », tout le monde
 *      connaît son numéro) ;
 *   3. l'attente pendant qu'il saisit son code sur son téléphone ;
 *   4. le résultat, avec ce qu'il peut faire s'il a échoué.
 *
 * **Deux colonnes par requête de conteneur, pas par paramètre.** Cet écran sert
 * à deux endroits : la page de paiement, large, et la fenêtre de paywall,
 * étroite. Un paramètre de mise en page aurait obligé chaque appelant à savoir
 * de quoi il dispose ; le conteneur le sait déjà. Au-delà de 46rem, le
 * récapitulatif passe à gauche et le formulaire à droite.
 *
 * **Les champs et les boutons ne sont pas restylés ici.** `select` et
 * `input[type='tel']` sont habillés par le design system sur l'élément
 * lui-même, et le bouton principal est `.inner-button`. Redéfinir des valeurs
 * voisines produisait un écran presque identique au reste de l'application —
 * l'écart le plus visible qui soit.
 *
 * Deux détails comptent plus qu'ils n'en ont l'air. Le **rappel de saisie du
 * code** après quinze secondes : chez plusieurs opérateurs la demande disparaît
 * de l'écran et l'abonné croit avoir raté son paiement. Et le **message
 * d'attente au-delà de trois minutes** : le réseau Mobile Money peut confirmer
 * bien plus tard, et il vaut mieux dire « nous vous préviendrons » que
 * d'afficher un échec qui n'en est pas un.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="pay">
      <!-- Ce qu'on achète. Reste affiché pendant toute l'opération : l'abonné
           doit pouvoir vérifier le montant au moment où il tape son code. -->
      <section class="pay__summary">
        @if (quote(); as offer) {
          <p class="pay__eyebrow">{{ 'billing.checkout.youArePaying' | translate }}</p>
          <h2 class="pay__product">{{ offer.label }}</h2>

          <p class="pay__amount">
            <span class="pay__figure">{{ offer.amount | number: '1.0-0' }}</span>
            <span class="pay__currency">{{ offer.currency }}</span>
          </p>
          @if (intervalKey(); as key) {
            <p class="pay__cadence">{{ key | translate }}</p>
          }

          @if (offer.credits > 0) {
            <dl class="pay__details">
              <div class="pay__detail">
                <dt>{{ 'billing.checkout.included' | translate }}</dt>
                <dd>{{ 'billing.checkout.creditsIncluded' | translate: { count: offer.credits } }}</dd>
              </div>
            </dl>
          }
        } @else {
          <!-- Le devis vient du serveur : tant qu'il n'est pas là, on montre sa
               forme plutôt qu'un vide ou un montant provisoire. -->
          <p class="pay__eyebrow">{{ 'billing.checkout.youArePaying' | translate }}</p>
          <div class="pay__skeleton pay__skeleton--title"></div>
          <div class="pay__skeleton pay__skeleton--figure"></div>
        }

        <p class="pay__secured">{{ 'billing.checkout.secured' | translate }}</p>
      </section>

      <section class="pay__action">
        <!-- 1. Pays, numéro, opérateur -->
        @if (step() === 'form') {
          <div class="pay__form">
            <div class="field">
              <label class="field__label" for="pay-country">
                {{ 'billing.checkout.country' | translate }}
              </label>
              <!-- Seuls les pays ouverts au paiement Mobile Money figurent ici :
                   la liste vient du serveur, pas d'une copie locale. -->
              <select id="pay-country" [ngModel]="country()" (ngModelChange)="onCountryChange($event)">
                <option value="" disabled>
                  {{ 'billing.checkout.chooseCountry' | translate }}
                </option>
                @for (option of countries(); track option.code) {
                  <option [value]="option.code">{{ option.name }} (+{{ option.prefix }})</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field__label" for="pay-phone">
                {{ 'billing.checkout.phone' | translate }}
              </label>
              <div class="field__phone">
                <!-- L'indicatif suit le pays choisi : il n'est ni saisi ni
                     modifiable, et l'abonné tape son numéro comme il le dit. -->
                @if (selectedCountry(); as place) {
                  <span class="field__prefix" aria-hidden="true">+{{ place.prefix }}</span>
                }
                <input
                  id="pay-phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel-national"
                  [class.field__control--phone]="selectedCountry()"
                  [disabled]="!country()"
                  [placeholder]="'billing.checkout.phonePlaceholder' | translate"
                  aria-describedby="pay-phone-hint"
                  [ngModel]="phone()"
                  (ngModelChange)="onPhoneChange($event)"
                />
              </div>

              <!-- L'opérateur détecté s'affiche en une ligne plutôt qu'en grille
                   de boutons : dans neuf cas sur dix il est juste, et une
                   question de moins vaut mieux qu'un choix de plus. -->
              @if (!country()) {
                <p class="field__hint" id="pay-phone-hint">
                  {{ 'billing.checkout.countryFirst' | translate }}
                </p>
              } @else if (selectedProvider(); as chosen) {
                <p class="field__hint field__hint--detected" id="pay-phone-hint">
                  <span class="dot dot--on" aria-hidden="true"></span>
                  {{ chosen.displayName }}
                  @if (providers().length > 1) {
                    <button type="button" class="linkish" (click)="openProviderPicker()">
                      {{ 'billing.checkout.changeProvider' | translate }}
                    </button>
                  }
                </p>
              } @else {
                <p class="field__hint" id="pay-phone-hint">
                  {{ 'billing.checkout.phoneHint' | translate }}
                </p>
              }
            </div>

            <!-- Liste ouverte seulement quand la détection s'est trompée, ou
                 quand rien n'a été détecté. -->
            @if (providerPickerOpen() || (country() && !selectedProvider() && providers().length > 0)) {
              <div class="field">
                <span class="field__label" id="pay-provider-label">
                  {{ 'billing.checkout.provider' | translate }}
                </span>
                <div class="providers" role="radiogroup" aria-labelledby="pay-provider-label">
                  @for (option of providers(); track option.provider) {
                    <button
                      type="button"
                      role="radio"
                      class="provider"
                      [class.provider--on]="provider() === option.provider"
                      [attr.aria-checked]="provider() === option.provider"
                      [disabled]="!option.available"
                      (click)="chooseProvider(option.provider)"
                    >
                      @if (option.logo) {
                        <img [src]="option.logo" alt="" class="provider__logo" />
                      }
                      <span class="provider__name">{{ option.displayName }}</span>
                      @if (!option.available) {
                        <span class="provider__closed">
                          {{ 'billing.checkout.providerClosed' | translate }}
                        </span>
                      }
                    </button>
                  }
                </div>
              </div>
            }

            @if (loadError(); as message) {
              <p class="notice notice--error" role="alert">{{ message }}</p>
            }

            <button
              type="button"
              class="inner-button button-lg w-full"
              [disabled]="!canPay()"
              (click)="pay()"
            >
              @if (isPaying()) {
                {{ 'billing.checkout.starting' | translate }}
              } @else {
                {{ 'billing.checkout.pay' | translate: { amount: payAmount(), currency: payCurrency() } }}
              }
            </button>

            <p class="pay__next">{{ 'billing.checkout.beforePay' | translate }}</p>
          </div>
        }

        <!-- 2. Attente. Pas de cercle qui tourne : trois étapes nommées, dont
             celle en cours. L'abonné sait ce qu'on attend de lui. -->
        @if (step() === 'waiting') {
          <div class="wait" aria-live="polite">
            <h3 class="wait__title">{{ 'billing.checkout.waitingTitle' | translate }}</h3>
            <p class="wait__body">
              {{ 'billing.checkout.waitingBody' | translate: { phone: payment()?.phoneMasked } }}
            </p>

            <ol class="steps">
              <li class="step step--done">
                <span class="dot dot--done" aria-hidden="true"></span>
                {{ 'billing.checkout.steps.request' | translate }}
              </li>
              <li class="step step--current">
                <span class="dot dot--pulse" aria-hidden="true"></span>
                {{ 'billing.checkout.steps.pin' | translate }}
              </li>
              <li class="step">
                <span class="dot" aria-hidden="true"></span>
                {{ 'billing.checkout.steps.confirm' | translate }}
              </li>
            </ol>

            @if (showPinReminder()) {
              <p class="notice">
                {{ 'billing.checkout.pinReminder' | translate }}
                @if (pinInstructions(); as instructions) {
                  <span class="notice__detail">{{ instructions }}</span>
                }
              </p>
            }

            @if (slowPayment()) {
              <p class="notice">{{ 'billing.checkout.slowPayment' | translate }}</p>
            }

            @if (payment()?.reference; as reference) {
              <p class="reference">
                {{ 'billing.checkout.reference' | translate }} <span>{{ reference }}</span>
              </p>
            }
          </div>
        }

        <!-- 3. Résultat -->
        @if (step() === 'result') {
          <div class="outcome" aria-live="polite">
            @if (payment()?.status === 'COMPLETED') {
              <p class="outcome__mark outcome__mark--ok">
                <i class="pi pi-check" aria-hidden="true"></i>
                {{ 'billing.checkout.successTitle' | translate }}
              </p>
              <p class="outcome__body">
                {{ 'billing.checkout.successBody' | translate: { label: payment()?.label } }}
              </p>

              <div class="outcome__actions">
                <button type="button" class="inner-button button-lg w-full" (click)="finish()">
                  {{ 'billing.checkout.continue' | translate }}
                </button>
              </div>
            } @else {
              <p class="outcome__mark outcome__mark--ko">
                <i class="pi pi-times" aria-hidden="true"></i>
                {{ payment()?.failure?.message || ('billing.checkout.failedTitle' | translate) }}
              </p>
              @if (payment()?.failure?.hint; as hint) {
                <p class="outcome__body">{{ hint }}</p>
              }
              <!-- Première inquiétude après un échec Mobile Money : « m'a-t-on
                   prélevé quand même ? » On y répond avant qu'elle soit posée. -->
              <p class="outcome__body outcome__body--quiet">
                {{ 'billing.checkout.noCharge' | translate }}
              </p>

              <div class="outcome__actions">
                @if (payment()?.failure?.retryable !== false) {
                  <button type="button" class="inner-button button-lg w-full" (click)="retry()">
                    {{ 'billing.checkout.retry' | translate }}
                  </button>
                }
                <button type="button" class="button-ghost w-full" (click)="finish()">
                  {{ 'common.close' | translate }}
                </button>
              </div>
            }

            @if (payment()?.reference; as reference) {
              <p class="reference">
                {{ 'billing.checkout.reference' | translate }} <span>{{ reference }}</span>
              </p>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      /* Le conteneur décide de la mise en page : page large à deux colonnes,
         fenêtre de paywall à une seule, sans que l'appelant ait à le dire. */
      :host {
        display: block;
        container-type: inline-size;
      }

      .pay {
        display: grid;
        gap: var(--spacing-8);
      }

      @container (min-width: 46rem) {
        .pay {
          grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
          gap: var(--spacing-10);
          align-items: start;
        }

        /* Un filet, pas une carte : la séparation suffit à distinguer ce qu'on
           achète de ce qu'on saisit. */
        .pay__action {
          border-left: 1px solid var(--glass-border);
          padding-left: var(--spacing-10);
        }

        .pay__summary {
          position: sticky;
          top: var(--spacing-8);
        }
      }

      /* ── Ce qu'on achète ─────────────────────────────────────────────── */

      .pay__eyebrow {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--idem-text-secondary);
      }

      .pay__product {
        margin: var(--spacing-1) 0 0;
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        line-height: 1.25;
        color: var(--idem-text-primary);
        text-wrap: balance;
      }

      .pay__amount {
        display: flex;
        align-items: baseline;
        gap: var(--spacing-2);
        margin: var(--spacing-5) 0 0;
      }

      .pay__figure {
        font-size: var(--font-size-4xl);
        font-weight: var(--font-weight-semibold);
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
        color: var(--idem-text-primary);
      }

      .pay__currency {
        font-size: var(--font-size-base);
        color: var(--idem-text-secondary);
      }

      .pay__cadence {
        margin: var(--spacing-1) 0 0;
        font-size: var(--font-size-sm);
        color: var(--idem-text-secondary);
      }

      .pay__details {
        margin: var(--spacing-6) 0 0;
        padding-top: var(--spacing-4);
        border-top: 1px solid var(--glass-border);
      }

      .pay__detail {
        display: flex;
        justify-content: space-between;
        gap: var(--spacing-4);
        font-size: var(--font-size-sm);
      }

      .pay__detail dt {
        color: var(--idem-text-secondary);
      }

      .pay__detail dd {
        margin: 0;
        color: var(--idem-text-primary);
        font-variant-numeric: tabular-nums;
      }

      .pay__secured {
        margin: var(--spacing-6) 0 0;
        font-size: var(--font-size-xs);
        line-height: 1.5;
        color: var(--idem-text-secondary);
      }

      .pay__skeleton {
        border-radius: var(--radius-md);
        background: var(--idem-surface-3);
      }

      .pay__skeleton--title {
        height: 1.25rem;
        width: 70%;
        margin-top: var(--spacing-2);
      }

      .pay__skeleton--figure {
        height: 2.25rem;
        width: 50%;
        margin-top: var(--spacing-5);
      }

      /* ── Formulaire ──────────────────────────────────────────────────────
         Les listes déroulantes et les champs téléphone sont habillés par le
         design system sur l'élément lui-même : fond, bordure, rayon, focus et
         flèche en viennent. Rien n'est redéfini ici, sauf la place de
         l'indicatif. */

      .pay__form {
        display: grid;
        gap: var(--spacing-5);
      }

      .field {
        display: grid;
        gap: var(--spacing-2);
      }

      .field__label {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--idem-text-primary);
      }

      .field__phone {
        position: relative;
      }

      .field__prefix {
        position: absolute;
        top: 50%;
        left: var(--spacing-4);
        transform: translateY(-50%);
        font-size: var(--font-size-base);
        color: var(--idem-text-secondary);
        font-variant-numeric: tabular-nums;
        pointer-events: none;
      }

      /* Seule entorse aux styles du système : la place de l'indicatif. */
      .field__control--phone {
        padding-left: 3.75rem;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }

      .field__hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        font-size: var(--font-size-sm);
        color: var(--idem-text-secondary);
      }

      .field__hint--detected {
        color: var(--idem-text-primary);
      }

      .linkish {
        border: none;
        background: none;
        padding: 0;
        margin-left: auto;
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .providers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: var(--spacing-2);
      }

      .provider {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        min-height: 2.875rem;
        padding: var(--spacing-2) var(--spacing-3);
        text-align: left;
        font-size: var(--font-size-sm);
        color: var(--idem-text-primary);
        background: var(--idem-field-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-xl);
        cursor: pointer;
        transition:
          border-color var(--duration-150) var(--ease-out),
          background-color var(--duration-150) var(--ease-out);
      }

      .provider:hover:not(:disabled) {
        border-color: var(--glass-border-medium);
      }

      .provider--on {
        border-color: color-mix(in oklch, var(--color-primary) 65%, var(--glass-border-strong));
        background: var(--idem-field-bg-focus);
        box-shadow: 0 1px 2px color-mix(in oklch, var(--color-primary) 10%, transparent);
      }

      .provider:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .provider__logo {
        width: 1.25rem;
        height: 1.25rem;
        object-fit: contain;
        border-radius: var(--radius-sm);
      }

      .provider__closed {
        margin-left: auto;
        font-size: var(--font-size-xs);
        color: var(--idem-text-tertiary);
      }

      .pay__next {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--idem-text-secondary);
      }

      /* ── Attente ─────────────────────────────────────────────────────── */

      .wait__title {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--idem-text-primary);
      }

      .wait__body {
        margin: var(--spacing-2) 0 0;
        font-size: var(--font-size-base);
        line-height: 1.6;
        color: var(--idem-text-secondary);
        max-width: 60ch;
      }

      .steps {
        display: grid;
        gap: var(--spacing-3);
        margin: var(--spacing-6) 0 0;
        padding: 0;
        list-style: none;
      }

      .step {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
        font-size: var(--font-size-sm);
        color: var(--idem-text-tertiary);
      }

      .step--done,
      .step--current {
        color: var(--idem-text-primary);
      }

      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: var(--radius-full);
        background: var(--glass-border-strong);
        flex-shrink: 0;
      }

      .dot--done,
      .dot--on {
        background: var(--color-primary);
      }

      .dot--pulse {
        background: var(--color-primary);
        animation: pulse 1.6s var(--ease-in-out) infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.45;
          transform: scale(0.8);
        }
      }

      .notice {
        margin: var(--spacing-5) 0 0;
        padding: var(--spacing-3) 0 0;
        border-top: 1px solid var(--glass-border);
        font-size: var(--font-size-sm);
        line-height: 1.6;
        color: var(--idem-text-secondary);
      }

      .notice--error {
        margin: 0;
        padding: 0;
        border-top: none;
        color: var(--color-danger);
      }

      .notice__detail {
        display: block;
        margin-top: var(--spacing-1);
        color: var(--idem-text-tertiary);
      }

      .reference {
        margin: var(--spacing-6) 0 0;
        font-size: var(--font-size-xs);
        color: var(--idem-text-tertiary);
      }

      .reference span {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
      }

      /* ── Résultat ────────────────────────────────────────────────────── */

      .outcome__mark {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--idem-text-primary);
      }

      .outcome__mark i {
        font-size: var(--font-size-base);
      }

      .outcome__mark--ok i {
        color: var(--color-success);
      }

      .outcome__mark--ko i {
        color: var(--color-danger);
      }

      .outcome__body {
        margin: var(--spacing-2) 0 0;
        font-size: var(--font-size-base);
        line-height: 1.6;
        color: var(--idem-text-secondary);
        max-width: 60ch;
      }

      .outcome__body--quiet {
        font-size: var(--font-size-sm);
      }

      .outcome__actions {
        display: grid;
        gap: var(--spacing-2);
        margin-top: var(--spacing-6);
      }

      /* Le mouvement porte un état ; s'il gêne, l'état reste lisible sans lui. */
      @media (prefers-reduced-motion: reduce) {
        .dot--pulse {
          animation: none;
        }

        .provider {
          transition: none;
        }
      }
    `,
  ],
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

  /** Vide tant que le pays n'est pas établi : on demande plutôt que de supposer. */
  readonly country = signal<string>('');
  readonly phone = signal('');
  readonly provider = signal<string | null>(null);
  /** Ouvert seulement quand la détection s'est trompée : une question de moins. */
  readonly providerPickerOpen = signal(false);

  /** Affiché après 15 s d'attente. */
  readonly showPinReminder = signal(false);
  /** Affiché après 3 min : le paiement peut encore aboutir. */
  readonly slowPayment = signal(false);

  private readonly stopPolling = new Subject<void>();
  private predictTimer?: ReturnType<typeof setTimeout>;

  /** Les pays ouverts au Mobile Money, tels que le serveur les déclare. */
  readonly countries = computed(() => this.billing.catalog()?.countries ?? []);
  readonly selectedCountry = computed(() =>
    this.countries().find((entry) => entry.code === this.country()),
  );
  readonly providers = computed<PaymentProviderOption[]>(() => this.methods()?.providers ?? []);

  /** L'opérateur retenu, avec son nom lisible. */
  readonly selectedProvider = computed(
    () => this.providers().find((option) => option.provider === this.provider()) ?? null,
  );

  /** Montant et devise du bouton : ils viennent du devis, jamais d'une saisie. */
  readonly payAmount = computed(() => this.quote()?.amount ?? 0);
  readonly payCurrency = computed(() => this.quote()?.currency ?? '');

  /** Périodicité affichée sous le montant, si l'offre en a une. */
  readonly intervalKey = computed(() => {
    const value = this.interval();
    if (value === 'month') return 'billing.checkout.perMonth';
    if (value === 'year') return 'billing.checkout.perYear';
    return null;
  });

  readonly canPay = computed(
    () =>
      !this.isPaying() &&
      Boolean(this.quote()) &&
      Boolean(this.country()) &&
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
    /**
     * Le catalogue porte la liste des pays ouverts au paiement.
     *
     * Il n'était chargé que par les pages Aperçu et Offres : en arrivant
     * directement ici — depuis la landing, une relance par e-mail, ou la
     * fenêtre de paywall — la liste des pays restait vide. Le composant le
     * charge donc lui-même : il en dépend, il ne peut pas supposer qu'un autre
     * écran est passé avant lui.
     */
    if (!this.billing.catalog()) {
      this.billing.loadCatalog().subscribe();
    }

    /**
     * Le pays deviné n'est posé qu'une fois la liste du serveur connue.
     *
     * On vérifie l'appartenance à cette liste plutôt que la seule
     * correspondance du fuseau : un utilisateur situé dans un pays encore fermé
     * au paiement ne doit rien voir de présélectionné.
     */
    const guess = countryFromTimeZone();
    effect(() => {
      const available = this.countries();
      if (!guess || this.country() || !available.length) return;

      if (available.some((entry) => entry.code === guess)) {
        this.country.set(guess);
      }
    });

    // Le devis dépend du produit ; le pays ne change pas le montant dans la
    // zone franc, mais l'API en attend un.
    effect(() => {
      const code = this.productCode();
      const country = this.country() || QUOTE_FALLBACK_COUNTRY;
      if (code) this.loadQuote(code, country);
    });

    // Les opérateurs, eux, dépendent réellement du pays : rien à charger tant
    // qu'il n'est pas choisi.
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
    // L'indicatif et les opérateurs changent avec le pays : un opérateur retenu
    // pour le précédent n'a plus de sens.
    this.provider.set(null);
    this.providerPickerOpen.set(false);
  }

  openProviderPicker(): void {
    this.providerPickerOpen.set(true);
  }

  chooseProvider(code: string): void {
    this.provider.set(code);
    this.providerPickerOpen.set(false);
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
    if (digits.length < 8 || !this.country()) return;

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
