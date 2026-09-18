import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { PRICING_DEFAULTS } from '@idem/shared-models/pricing/defaults';
import {
  BillingCatalog,
  BillingEngine,
  BillingProduct,
  BillingMe,
  CheckoutRequest,
  CreditLedgerRow,
  PaymentMethods,
  PaymentView,
  ProviderPrediction,
  Quote,
} from '../models/billing.model';

/** Dernier catalogue reçu de l'API, relu quand elle ne répond plus. */
const CATALOG_SNAPSHOT_KEY = 'idem.billing.catalog';

/**
 * Facturation : catalogue, droits et paiement Mobile Money.
 *
 * Les droits (`me`) sont maintenus dans un signal partagé : le compteur de
 * crédits de la barre latérale, la page « Mon offre » et le paywall lisent la
 * même source, et un paiement qui aboutit les met tous à jour d'un coup.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.services?.api?.url || 'http://localhost:3001';
  private readonly base = `${this.apiUrl}/billing`;

  /** Droits courants. `null` tant que rien n'a été chargé. */
  readonly me = signal<BillingMe | null>(null);
  readonly catalog = signal<BillingCatalog | null>(null);

  /** D'où viennent les prix affichés. `null` tant que rien n'a été chargé. */
  readonly catalogSource = signal<'api' | 'snapshot' | 'defaults' | null>(null);

  /**
   * Vrai quand les prix affichés ne viennent pas de l'API.
   *
   * Ils restent justes dans l'immense majorité des cas — le fichier embarqué
   * est celui de l'API — mais un prix ajusté depuis le panel ne s'y trouve
   * pas. L'écran doit donc le signaler plutôt que de laisser croire à un
   * montant ferme.
   */
  readonly pricesIndicative = computed(
    () => this.catalogSource() === 'snapshot' || this.catalogSource() === 'defaults',
  );

  /** Soldes par moteur, prêts pour l'affichage. */
  readonly credits = computed(() => this.me()?.credits ?? null);

  /** Vrai si un abonnement est en impayé : la bannière de relance s'appuie dessus. */
  readonly hasPastDue = computed(() =>
    (this.me()?.subscriptions ?? []).some((subscription) => subscription.status === 'past_due'),
  );

  readonly betaActive = computed(() =>
    (this.me()?.subscriptions ?? []).some((subscription) => subscription.complimentary),
  );

  // ============================================
  // DROITS ET CATALOGUE
  // ============================================

  /**
   * Recharge les droits.
   *
   * Silencieux en cas d'échec : le tableau de bord doit s'afficher même quand
   * la facturation est indisponible — on ne bloque pas l'accès au travail déjà
   * produit pour une panne de facturation.
   */
  loadMe(): Observable<BillingMe | null> {
    return this.http.get<BillingMe>(`${this.base}/me`).pipe(
      tap((me) => this.me.set(me)),
      catchError(() => of(null)),
    );
  }

  /**
   * Charge le catalogue, avec deux filets sous l'API.
   *
   * Une page d'offres vide est pire qu'une page d'offres datée : le client
   * conclut que le produit ne se vend pas. En cas d'échec, on reprend donc le
   * dernier catalogue reçu, et à défaut les prix embarqués au build
   * (`pricing.config.json`, le même fichier qui sert de valeurs par défaut à
   * l'API). Dans les deux cas `pricesIndicative()` passe à vrai et l'écran le
   * dit : c'est l'API qui facture, ces montants-là ne sont qu'affichés.
   */
  loadCatalog(engine?: BillingEngine): Observable<BillingCatalog | null> {
    const url = engine ? `${this.base}/catalog?engine=${engine}` : `${this.base}/catalog`;

    return this.http.get<BillingCatalog>(url).pipe(
      tap((catalog) => {
        this.catalog.set(catalog);
        this.catalogSource.set('api');
        this.rememberCatalog(catalog);
      }),
      catchError(() => {
        const snapshot = this.lastKnownCatalog();

        this.catalog.set(snapshot ?? this.catalogFromDefaults());
        this.catalogSource.set(snapshot ? 'snapshot' : 'defaults');

        return of(this.catalog());
      }),
    );
  }

  /** Dernier catalogue reçu, conservé pour survivre à une API indisponible. */
  private rememberCatalog(catalog: BillingCatalog): void {
    try {
      localStorage.setItem(CATALOG_SNAPSHOT_KEY, JSON.stringify(catalog));
    } catch {
      // Navigation privée ou stockage plein : on s'en passe, les prix
      // embarqués prendront le relais.
    }
  }

  private lastKnownCatalog(): BillingCatalog | null {
    try {
      const raw = localStorage.getItem(CATALOG_SNAPSHOT_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as BillingCatalog;
      return parsed?.products?.length ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Catalogue reconstruit depuis le fichier de tarification embarqué.
   *
   * Les pays listés sont ceux qui ont une grille ; ils ne disent pas où le
   * paiement est ouvert aujourd'hui — cette réponse-là n'appartient qu'à
   * l'API, qui interroge l'opérateur.
   */
  private catalogFromDefaults(): BillingCatalog {
    const products = Object.entries(PRICING_DEFAULTS.products)
      .filter(([, product]) => product.isActive)
      .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
      .map(([code, product]) => ({
        code,
        kind: product.kind as BillingProduct['kind'],
        engine: product.engine as BillingEngine | null,
        name: product.name,
        description: product.description,
        priceXaf: product.priceXaf,
        interval: product.interval,
        credits: product.credits,
        highlighted: product.highlighted,
        discountLabel: product.discountLabel,
        sortOrder: product.sortOrder,
      }));

    const countries = Object.entries(PRICING_DEFAULTS.countries).map(([code, country]) => ({
      code,
      name: country.name,
      prefix: country.prefix,
      currency: country.currency,
      decimals: country.decimals,
    }));

    return { currency: PRICING_DEFAULTS.baseCurrency, countries, products };
  }

  getCreditStatement(engine?: BillingEngine): Observable<{ entries: CreditLedgerRow[] }> {
    const url = engine ? `${this.base}/credits?engine=${engine}` : `${this.base}/credits`;
    return this.http.get<{ entries: CreditLedgerRow[] }>(url);
  }

  // ============================================
  // PRÉPARATION DU PAIEMENT
  // ============================================

  getQuote(params: {
    productCode: string;
    interval?: string;
    country?: string;
    engine?: string;
  }): Observable<Quote> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
    );
    return this.http.get<Quote>(`${this.base}/quote?${query.toString()}`);
  }

  /** Opérateurs réellement ouverts dans le pays, à cet instant. */
  getPaymentMethods(country: string): Observable<PaymentMethods> {
    return this.http.get<PaymentMethods>(`${this.base}/payment-methods?country=${country}`);
  }

  /** Devine l'opérateur pendant la saisie du numéro. */
  predictProvider(phoneNumber: string, country: string): Observable<ProviderPrediction> {
    return this.http.post<ProviderPrediction>(`${this.base}/predict-provider`, {
      phoneNumber,
      country,
    });
  }

  // ============================================
  // PAIEMENT
  // ============================================

  /**
   * Lance un paiement.
   *
   * La clé d'idempotence est générée ici et envoyée en en-tête : deux clics sur
   * « Payer » ne doivent pas faire sonner deux fois le téléphone de l'abonné,
   * ni le débiter deux fois.
   */
  checkout(request: CheckoutRequest): Observable<PaymentView> {
    return this.http.post<PaymentView>(`${this.base}/checkout`, request, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
  }

  getPayment(reference: string): Observable<PaymentView> {
    return this.http.get<PaymentView>(`${this.base}/payments/${encodeURIComponent(reference)}`);
  }

  listPayments(): Observable<{ payments: PaymentView[] }> {
    return this.http.get<{ payments: PaymentView[] }>(`${this.base}/payments`);
  }

  cancelSubscription(engine: BillingEngine): Observable<unknown> {
    return this.http.post(`${this.base}/subscriptions/${engine}/cancel`, {});
  }

  /** Un projet AppGen est-il débloqué ? */
  hasProjectAccess(projectId: string): Observable<{ unlocked: boolean }> {
    return this.http.get<{ unlocked: boolean }>(
      `${this.base}/access/appgen/${encodeURIComponent(projectId)}`,
    );
  }
}
