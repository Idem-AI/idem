import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Application, CatalogEntry, Connection, Contact, DomainSession, DomainSummary, Order, PriceSession, RecordSet, SearchResult } from './models';

/** Le client de l'API iDomain (`/v1`). Le cookie de session voyage avec chaque appel (intercepteur). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api.url}/v1`;

  catalog() {
    return this.http.get<{ currency: 'XAF'; extensions: CatalogEntry[] }>(`${this.base}/catalog`);
  }
  search(q: string, years = 1) {
    return this.http.get<SearchResult>(`${this.base}/domains/search`, { params: { q, years } });
  }

  me() {
    return this.http.get<{ user: { uid: string; email: string; displayName?: string }; contact: Contact | null; atCost: boolean }>(`${this.base}/me`);
  }
  saveContact(contact: Contact) {
    return this.http.put<{ contact: Contact; resumedOrders: number }>(`${this.base}/contact`, contact);
  }

  priceSession(domain: string, years: number) {
    return this.http.post<PriceSession>(`${this.base}/price-sessions`, { domain, years });
  }
  createOrder(body: { priceSessionIds: string[]; idempotencyKey: string; domainSessionId?: string; connectAppUuid?: string }) {
    return this.http.post<Order>(`${this.base}/orders`, body);
  }
  orders() {
    return this.http.get<{ orders: Order[] }>(`${this.base}/orders`);
  }
  order(id: string) {
    return this.http.get<Order>(`${this.base}/orders/${id}`);
  }
  payOrder(id: string) {
    return this.http.post<Order>(`${this.base}/orders/${id}/pay`, {});
  }
  cancelOrder(id: string) {
    return this.http.post<Order>(`${this.base}/orders/${id}/cancel`, {});
  }

  domains() {
    return this.http.get<{ domains: DomainSummary[] }>(`${this.base}/domains`);
  }
  domain(id: string) {
    return this.http.get<DomainSummary>(`${this.base}/domains/${id}`);
  }
  registrar(id: string) {
    return this.http.get<{ domain: string; registrar: string | null }>(`${this.base}/domains/${id}/registrar`);
  }
  records(id: string) {
    return this.http.get<{ records: RecordSet[] }>(`${this.base}/domains/${id}/dns-records`);
  }
  saveRecordSet(id: string, set: RecordSet) {
    return this.http.post<{ records: RecordSet[] }>(`${this.base}/domains/${id}/dns-records`, set);
  }

  applications() {
    return this.http.get<{ applications: Application[] }>(`${this.base}/applications`);
  }
  domainSession(id: string) {
    return this.http.get<DomainSession>(`${this.base}/domain-sessions/${id}`);
  }
  connect(body: { host: string; appUuid: string; includeWww?: boolean; domainSessionId?: string }) {
    return this.http.post<Connection>(`${this.base}/domain-connections`, body);
  }
  connections(filter: { appUuid?: string; domainId?: string } = {}) {
    return this.http.get<{ connections: Connection[] }>(`${this.base}/domain-connections`, { params: { ...filter } });
  }
  connection(id: string) {
    return this.http.get<Connection>(`${this.base}/domain-connections/${id}`);
  }
  retryConnection(id: string) {
    return this.http.post<Connection>(`${this.base}/domain-connections/${id}/retry`, {});
  }
  detach(id: string) {
    return this.http.delete<Connection>(`${this.base}/domain-connections/${id}`);
  }
}

/** Le message d'erreur que l'API a écrit pour l'utilisateur, sinon `fallback`. */
export function apiMessage(error: unknown, fallback: string): string {
  const body = (error as HttpErrorResponse)?.error as { message?: string } | undefined;
  return typeof body?.message === 'string' && body.message ? body.message : fallback;
}

export function apiCode(error: unknown): string | null {
  const body = (error as HttpErrorResponse)?.error as { error?: string } | undefined;
  return typeof body?.error === 'string' ? body.error : null;
}
