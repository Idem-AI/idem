import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  BillingCatalog,
  BillingEngine,
  BillingMe,
  CheckoutRequest,
  CreditLedgerRow,
  PaymentMethods,
  PaymentView,
  ProviderPrediction,
  Quote,
} from '../models/billing.model';

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

  loadCatalog(engine?: BillingEngine): Observable<BillingCatalog | null> {
    const url = engine ? `${this.base}/catalog?engine=${engine}` : `${this.base}/catalog`;

    return this.http.get<BillingCatalog>(url).pipe(
      tap((catalog) => this.catalog.set(catalog)),
      catchError(() => of(null)),
    );
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
