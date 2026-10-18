/**
 * Le client de l'API publique d'iDomain (`/v1`), pour les applications IDEM qui vendent et gèrent
 * des domaines chez elles (iDeploy, iCode) : même compte (cookie `session` d'IDEM, envoyé avec
 * `credentials: 'include'`), mêmes prix, même portefeuille. Contrat : `GET {api}/v1/openapi.json`.
 */

export type QuoteState = 'available' | 'taken' | 'premium' | 'not_sold' | 'unavailable_now' | 'unknown';

export interface Quote {
  domain: string;
  tld: string;
  years: number;
  state: QuoteState;
  priceXaf: number | null;
  renewalXaf: number | null;
  atCost: boolean;
  promotion: { id: number; endsAt: string } | null;
}

export interface SearchResult {
  query: string;
  exact: Quote | null;
  extensions: Quote[];
  suggestions: Quote[];
}

export interface PriceSession extends Quote {
  id: string;
  expiresAt: string;
}

export interface Contact {
  firstName: string;
  lastName: string;
  company?: string | null;
  email: string;
  phoneCountryCode: string;
  phone: string;
  address: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country: string;
}

export type OrderStatus = 'awaiting_contact' | 'awaiting_payment' | 'paid' | 'processing' | 'completed' | 'on_hold' | 'needs_review' | 'failed' | 'refunded' | 'cancelled';

export interface Order {
  id: string;
  status: OrderStatus;
  statusReason: string | null;
  totalXaf: number;
  items: { id: string; domain: string; years: number; priceXaf: number; renewalXaf: number | null; status: string; domainId: string | null }[];
}

export type ConnectionStatus =
  | 'awaiting_domain'
  | 'verifying_ownership'
  | 'pending'
  | 'configuring_dns'
  | 'attaching'
  | 'waiting_dns'
  | 'activating_tls'
  | 'active'
  | 'failed'
  | 'detached';

export interface Connection {
  id: string;
  host: string;
  hosts: string[];
  appUuid: string;
  method: 'managed' | 'manual';
  status: ConnectionStatus;
  error: string | null;
  domain: { id: string; name: string; expiresAt: string | null; renewalXaf: number | null; dnsManaged: boolean } | null;
  activatedAt: string | null;
}

export interface Application {
  uuid: string;
  name: string;
  domains: string[];
}

export interface RecordSet {
  name: string;
  type: string;
  ttl: number;
  values: string[];
}

/** Une réponse refusée, avec ce que l'API a écrit pour l'utilisateur. */
export class IdomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'IdomainError';
  }
}

export interface IdomainClient {
  search(q: string, years?: number): Promise<SearchResult>;
  me(): Promise<{ user: { uid: string; email: string; displayName?: string }; contact: Contact | null; atCost: boolean }>;
  saveContact(contact: Contact): Promise<{ contact: Contact }>;
  priceSession(domain: string, years: number): Promise<PriceSession>;
  createOrder(body: { priceSessionIds: string[]; idempotencyKey: string; connectAppUuid?: string }): Promise<Order>;
  payOrder(id: string): Promise<Order>;
  order(id: string): Promise<Order>;
  applications(): Promise<{ applications: Application[] }>;
  connections(filter: { appUuid?: string }): Promise<{ connections: Connection[] }>;
  connection(id: string): Promise<Connection>;
  connect(body: { host: string; appUuid: string }): Promise<Connection>;
  retryConnection(id: string): Promise<Connection>;
  detach(id: string): Promise<Connection>;
  records(domainId: string): Promise<{ records: RecordSet[] }>;
  saveRecordSet(domainId: string, set: RecordSet): Promise<{ records: RecordSet[] }>;
}

/** `fetchImpl` : pour les contrôles hors navigateur (le navigateur envoie seul le cookie de session). */
export function createIdomainClient(apiUrl: string, language: () => string = () => 'fr', fetchImpl: typeof fetch = (input, init) => fetch(input, init)): IdomainClient {
  const base = `${apiUrl.replace(/\/+$/, '')}/v1`;
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        credentials: 'include',
        headers: { Accept: 'application/json', 'Accept-Language': language(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new IdomainError(0, 'network', '');
    }
    const text = await res.text();
    const data: Record<string, unknown> = text ? JSON.parse(text) : {};
    if (!res.ok) throw new IdomainError(res.status, String(data['error'] ?? `http_${res.status}`), String(data['message'] ?? ''), data);
    return data as T;
  }
  const q = (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)] as [string, string])).toString();
    return s ? `?${s}` : '';
  };
  return {
    search: (text, years = 1) => call('GET', `/domains/search${q({ q: text, years })}`),
    me: () => call('GET', '/me'),
    saveContact: (contact) => call('PUT', '/contact', contact),
    priceSession: (domain, years) => call('POST', '/price-sessions', { domain, years }),
    createOrder: (body) => call('POST', '/orders', body),
    payOrder: (id) => call('POST', `/orders/${id}/pay`),
    order: (id) => call('GET', `/orders/${id}`),
    applications: () => call('GET', '/applications'),
    connections: (filter) => call('GET', `/domain-connections${q({ appUuid: filter.appUuid })}`),
    connection: (id) => call('GET', `/domain-connections/${id}`),
    connect: (body) => call('POST', '/domain-connections', body),
    retryConnection: (id) => call('POST', `/domain-connections/${id}/retry`),
    detach: (id) => call('DELETE', `/domain-connections/${id}`),
    records: (domainId) => call('GET', `/domains/${domainId}/dns-records`),
    saveRecordSet: (domainId, set) => call('POST', `/domains/${domainId}/dns-records`, set),
  };
}
