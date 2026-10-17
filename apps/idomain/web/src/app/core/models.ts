/** Les objets de l'API iDomain (`/v1`), tels que le client les reçoit. Les prix sont en F CFA, entiers. */

export type QuoteState = 'available' | 'taken' | 'premium' | 'not_sold' | 'unavailable_now' | 'unknown';

export interface Quote {
  domain: string;
  tld: string;
  operation: 'register' | 'renew' | 'transfer';
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

export interface CatalogEntry {
  tld: string;
  registerXaf: number | null;
  renewXaf: number | null;
  transferXaf: number | null;
}

export interface PriceSession extends Quote {
  id: string;
  expiresAt: string;
}

export interface Contact {
  id?: string;
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

export interface OrderItem {
  id: string;
  domain: string;
  operation: string;
  years: number;
  priceXaf: number;
  renewalXaf: number | null;
  atCost: boolean;
  status: 'pending' | 'registering' | 'registered' | 'on_hold' | 'needs_review' | 'failed';
  domainId: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  statusReason: string | null;
  totalXaf: number;
  paymentMethod: 'wallet' | 'prepaid';
  source: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
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

export interface ConnectionInstruction {
  type: string;
  name: string;
  value: string;
  zone: string;
  purpose: 'ownership' | 'address';
}

export interface Connection {
  id: string;
  host: string;
  hosts: string[];
  appUuid: string;
  environment: string;
  method: 'managed' | 'manual';
  status: ConnectionStatus;
  error: string | null;
  check: { domains?: { host: string; dns: string; https: string }[] } | null;
  instructions: ConnectionInstruction[];
  activatedAt: string | null;
  createdAt: string;
}

export interface DomainSummary {
  id: string;
  name: string;
  tld: string;
  status: string;
  dnsMode: 'managed' | 'external';
  registeredAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  renewalXaf: number | null;
  source: string;
  connection: { id: string; host: string; appUuid: string; status: ConnectionStatus; error: string | null } | null;
}

export interface RecordSet {
  name: string;
  type: string;
  ttl: number;
  values: string[];
}

export interface Application {
  uuid: string;
  name: string;
  domains: string[];
  status?: string | null;
}

export interface DomainSession {
  id: string;
  source: 'ideploy' | 'icode';
  appUuid: string;
  appName: string | null;
  environment: string;
  returnUrl: string | null;
  expiresAt: string;
}

/** Le refus d'un paiement : ce qui manque au portefeuille, et la recharge qui le couvre (corps d'IDEM). */
export interface PaymentRequiredBody {
  error: 'payment_required';
  message: string;
  orderId?: string;
  priceXaf?: number;
  balanceXaf?: number;
  missingXaf?: number;
  topupXaf?: number;
}
