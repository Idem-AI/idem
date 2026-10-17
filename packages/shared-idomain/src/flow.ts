/**
 * Le parcours d'achat d'un nom, sans framework : iDeploy (Angular) et iCode (React) n'en font que
 * le rendu. Une seule logique, donc un seul comportement des deux côtés :
 *
 *   search   chercher un nom (prix de la 1ʳᵉ année et du renouvellement) ;
 *   holder   le titulaire, demandé une seule fois (exigé par les registres) ;
 *   confirm  le prix garanti, la durée, l'application qui recevra le nom, le paiement ;
 *   payment  le portefeuille ne suffit pas : recharger (nouvel onglet), puis payer, sans recommencer ;
 *   progress enregistrement, puis DNS et branchement faits par IDEM, jusqu'au HTTPS.
 *
 * L'utilisateur ne configure rien : le nom acheté est relié à l'application dès son enregistrement.
 */
import { Application, Connection, Contact, IdomainClient, IdomainError, Order, PriceSession, Quote, SearchResult } from './client';

export type PurchaseStep = 'search' | 'holder' | 'confirm' | 'payment' | 'progress';

/** Ce que voit l'utilisateur pendant l'installation, dans l'ordre. */
export type PurchaseProgress = 'paying' | 'registering' | 'connecting' | 'securing' | 'live' | 'on_hold' | 'failed' | 'connection_failed';

/** Un message : une clé de `texts.ts`, ou le texte écrit par l'API pour l'utilisateur. */
export interface FlowMessage {
  key?: string;
  text?: string;
}

export interface PurchaseState {
  step: PurchaseStep;
  searching: boolean;
  result: SearchResult | null;
  chosen: Quote | null;
  session: PriceSession | null;
  years: number;
  locking: boolean;
  contact: Contact | null;
  contactDefaults: Partial<Contact>;
  savingContact: boolean;
  apps: Application[] | null;
  appUuid: string | null;
  paying: boolean;
  missingXaf: number | null;
  topupXaf: number | null;
  order: Order | null;
  connection: Connection | null;
  progress: PurchaseProgress | null;
  error: FlowMessage | null;
}

export interface PurchaseOptions {
  /** L'application qui recevra le nom ; absente : l'utilisateur la choisit parmi les siennes. */
  appUuid?: string | null;
}

const POLL_MS = 4000;

export class DomainPurchaseFlow {
  private listeners = new Set<(s: PurchaseState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** Une clé par achat : un double clic, une coupure réseau rejoués ne créent qu'une commande. */
  private idempotencyKey = newKey();
  state: PurchaseState;

  constructor(
    private readonly client: IdomainClient,
    options: PurchaseOptions = {}
  ) {
    this.state = {
      step: 'search',
      searching: false,
      result: null,
      chosen: null,
      session: null,
      years: 1,
      locking: false,
      contact: null,
      contactDefaults: {},
      savingContact: false,
      apps: null,
      appUuid: options.appUuid ?? null,
      paying: false,
      missingXaf: null,
      topupXaf: null,
      order: null,
      connection: null,
      progress: null,
      error: null,
    };
    void this.client
      .me()
      .then((me) => {
        const [firstName, ...rest] = (me.user.displayName ?? '').split(' ');
        this.set({ contact: me.contact, contactDefaults: { email: me.user.email, firstName: firstName || '', lastName: rest.join(' ') } });
      })
      .catch(() => undefined);
    if (!options.appUuid) {
      void this.client
        .applications()
        .then((r) => this.set({ apps: r.applications, appUuid: r.applications.length === 1 ? r.applications[0].uuid : null }))
        .catch(() => this.set({ apps: [] }));
    }
  }

  subscribe(listener: (s: PurchaseState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }

  private set(patch: Partial<PurchaseState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private fail(error: unknown, fallbackKey: string, extra: Partial<PurchaseState> = {}): void {
    const text = error instanceof IdomainError && error.message ? error.message : undefined;
    this.set({ ...extra, error: text ? { text } : { key: fallbackKey } });
  }

  // ─── Étapes ───────────────────────────────────────────────────────────────

  async search(query: string): Promise<void> {
    const q = query.trim();
    if (!q) return;
    this.set({ searching: true, error: null });
    try {
      this.set({ result: await this.client.search(q), searching: false });
    } catch (error) {
      this.fail(error, 'errors.search', { searching: false });
    }
  }

  /** Un nom choisi : son prix est figé pour la durée de la commande. */
  async choose(quote: Quote): Promise<void> {
    this.set({ chosen: quote, years: 1, error: null });
    await this.lock();
  }

  async setYears(years: number): Promise<void> {
    this.set({ years: Math.min(5, Math.max(1, years)) });
    await this.lock();
  }

  private async lock(): Promise<void> {
    const chosen = this.state.chosen;
    if (!chosen) return;
    this.set({ locking: true, error: null });
    try {
      const session = await this.client.priceSession(chosen.domain, this.state.years);
      this.set({ session, locking: false, step: this.state.contact ? 'confirm' : 'holder' });
    } catch (error) {
      this.fail(error, 'errors.price', { locking: false, step: 'search' });
    }
  }

  async saveContact(contact: Contact): Promise<void> {
    this.set({ savingContact: true, error: null });
    try {
      const saved = await this.client.saveContact({ ...contact, country: contact.country.toUpperCase() });
      this.set({ contact: saved.contact, savingContact: false, step: this.state.session ? 'confirm' : 'search' });
    } catch (error) {
      this.fail(error, 'errors.contact', { savingContact: false });
    }
  }

  editContact(): void {
    this.set({ step: 'holder', error: null });
  }

  setApp(appUuid: string | null): void {
    this.set({ appUuid });
  }

  back(): void {
    this.set({ step: 'search', session: null, chosen: null, error: null, missingXaf: null });
  }

  async pay(): Promise<void> {
    const session = this.state.session;
    if (!session || this.state.paying) return;
    this.set({ paying: true, error: null });
    try {
      const order = this.state.order
        ? await this.client.payOrder(this.state.order.id)
        : await this.client.createOrder({ priceSessionIds: [session.id], idempotencyKey: this.idempotencyKey, ...(this.state.appUuid ? { connectAppUuid: this.state.appUuid } : {}) });
      this.set({ order, paying: false, step: 'progress', progress: 'registering', missingXaf: null });
      this.poll();
    } catch (error) {
      if (error instanceof IdomainError && error.status === 402) {
        const body = error.body as { orderId?: string; missingXaf?: number; topupXaf?: number };
        this.set({
          paying: false,
          step: 'payment',
          missingXaf: body.missingXaf ?? null,
          topupXaf: body.topupXaf ?? body.missingXaf ?? null,
          // La commande attend son paiement : on la paiera, on n'en crée pas une autre.
          order: body.orderId ? ({ id: body.orderId } as Order) : this.state.order,
        });
        return;
      }
      if (error instanceof IdomainError && error.code === 'price_session_expired') {
        this.set({ paying: false });
        await this.lock();
        return;
      }
      if (error instanceof IdomainError && error.code === 'contact_required') {
        this.set({ paying: false, step: 'holder' });
        return;
      }
      this.fail(error, 'errors.pay', { paying: false });
    }
  }

  // ─── Suivi ────────────────────────────────────────────────────────────────

  private poll(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), POLL_MS);
  }

  private async refresh(): Promise<void> {
    const orderId = this.state.order?.id;
    if (!orderId || this.disposed) return;
    try {
      const order = await this.client.order(orderId);
      const item = order.items[0];
      let connection = this.state.connection;
      if (item && this.state.appUuid) {
        const list = await this.client.connections({ appUuid: this.state.appUuid });
        connection = list.connections.find((c) => c.host === item.domain) ?? null;
      }
      const progress = progressOf(order, connection, Boolean(this.state.appUuid));
      this.set({ order, connection, progress });
      if (!['live', 'failed', 'connection_failed'].includes(progress)) this.poll();
    } catch {
      this.poll();
    }
  }

  /** Relancer un branchement qui n'a pas abouti. */
  async retryConnection(): Promise<void> {
    const c = this.state.connection;
    if (!c) return;
    try {
      this.set({ connection: await this.client.retryConnection(c.id), progress: 'connecting' });
      this.poll();
    } catch (error) {
      this.fail(error, 'errors.retry');
    }
  }
}

/** Où en est l'installation, en mots d'utilisateur. */
export function progressOf(order: Order, connection: Connection | null, wantsConnection: boolean): PurchaseProgress {
  const item = order.items[0];
  if (['failed', 'refunded', 'cancelled'].includes(order.status) || item?.status === 'failed') return 'failed';
  if (order.status === 'on_hold' || order.status === 'needs_review') return 'on_hold';
  if (order.status === 'awaiting_payment') return 'paying';
  if (item?.status !== 'registered') return 'registering';
  if (!wantsConnection) return 'live';
  if (!connection) return 'connecting';
  if (connection.status === 'active') return 'live';
  if (connection.status === 'failed') return 'connection_failed';
  if (connection.status === 'waiting_dns' || connection.status === 'activating_tls') return 'securing';
  return 'connecting';
}

/** Les quatre étapes vues par l'utilisateur (barre de progression de la fenêtre). */
export const PURCHASE_STAGES = ['search', 'holder', 'pay', 'setup'] as const;

export function stageIndex(s: Pick<PurchaseState, 'step'>): number {
  return s.step === 'search' ? 0 : s.step === 'holder' ? 1 : s.step === 'progress' ? 3 : 2;
}

/** Un montant en francs, comme on l'écrit : `6 500 F`. */
export function formatXaf(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('fr-FR').replace(/\s/g, ' ')} F`;
}

function newKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
