/**
 * Domain Name API — premier connecteur (compte revendeur, API REST JSON).
 *
 * Contrat relevé dans la bibliothèque officielle (`domainreseller/php-dna`, `DNARest.php`) :
 *   - production `https://api.domainresellerapi.com/api/v1`, bac à sable `https://ote.domainresellerapi.com/api/v1` ;
 *   - authentification par en-têtes : `X-API-KEY` (clé) et `__reseller` (identifiant revendeur) ;
 *   - une redirection 301/302 signifie des identifiants refusés ;
 *   - une zone DNS s'écrit par JEU (nom + type) : un POST remplace toutes les valeurs du jeu, un
 *     DELETE nommant une valeur supprime le jeu entier, et rien n'est publié sans `zones/apply`.
 *     Les noms se lisent qualifiés (`www.exemple.com`) et s'écrivent relatifs (`''` pour l'apex).
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import logger from '../../config/logger';
import {
  AvailabilityResult,
  DnsRecordSet,
  RegisteredDomain,
  RegistrantContact,
  RegistrarAdapter,
  RegistrarError,
  RegistrarOperation,
  ResellerAccount,
  TldPricing,
} from './types';

const PRODUCTION_URL = 'https://api.domainresellerapi.com/api/v1';
const SANDBOX_URL = 'https://ote.domainresellerapi.com/api/v1';

/** Serveurs de noms du fournisseur : la zone reste tenue chez lui, donc écrivable par iDomain. */
const DEFAULT_NAMESERVERS = ['ns1.domainnameapi.com', 'ns2.domainnameapi.com'];

/** Types qu'accepte l'API de zones (au-delà, la bibliothèque officielle refuse). */
const ZONE_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']);

interface DnaZoneSet {
  name?: string;
  type?: string;
  ttl?: number;
  records?: { content?: string; disabled?: boolean }[];
}

export class DomainNameApiAdapter implements RegistrarAdapter {
  readonly code = 'domainnameapi';
  private readonly http: AxiosInstance;

  constructor(
    private readonly resellerId = process.env.DNA_RESELLER_ID || '',
    private readonly apiKey = process.env.DNA_API_KEY || '',
    sandbox = process.env.DNA_SANDBOX !== 'false'
  ) {
    this.http = axios.create({
      baseURL: process.env.DNA_API_URL || (sandbox ? SANDBOX_URL : PRODUCTION_URL),
      timeout: parseInt(process.env.DNA_TIMEOUT_MS || '30000', 10),
      // Une redirection n'est jamais suivie : chez ce fournisseur, elle veut dire « identifiants refusés ».
      maxRedirects: 0,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.resellerId && this.apiKey);
  }

  async checkAvailability(domains: string[], operation: RegistrarOperation, years: number): Promise<AvailabilityResult[]> {
    const body = domains.map((domainName) => ({ domainName }));
    const res = await this.call<{ infos?: Record<string, unknown>[] } | Record<string, unknown>[]>('read', 'POST', 'domains/bulk-search', body);
    const items = Array.isArray(res) ? res : res.infos ?? [];
    return items.map((item) => {
      const status = String(item.status ?? '').toLowerCase();
      const price = item.price !== undefined && item.price !== null ? Number(item.price) : undefined;
      // Le prix renvoyé par la recherche est celui de l'enregistrement d'une année : il ne vaut que pour lui.
      const usable = operation === 'register' && years === Number(item.period ?? 1) && Number.isFinite(price);
      return {
        domain: String(item.domainName ?? '').toLowerCase(),
        available: ['available', '1', 'true'].includes(status),
        premium: Boolean(item.isPremium),
        ...(usable ? { cost: price, currency: String(item.currency ?? 'USD').toUpperCase() } : {}),
        ...(item.reason ? { reason: String(item.reason) } : {}),
      };
    });
  }

  async listTldPricing(): Promise<TldPricing[]> {
    const out: TldPricing[] = [];
    const pageSize = 200;
    for (let skip = 0; skip < 5000; skip += pageSize) {
      const res = await this.call<{ items?: Record<string, any>[]; totalCount?: number }>('read', 'GET', 'products/tlds', { MaxResultCount: pageSize, SkipCount: skip });
      const items = res.items ?? [];
      for (const tld of items) {
        const prices = Array.isArray(tld.prices) ? tld.prices[0] : undefined;
        const costs: TldPricing['costs'] = {};
        let currency = 'USD';
        for (const [apiKey, op] of [['register', 'register'], ['renew', 'renew'], ['transfer', 'transfer'], ['restore', 'restore']] as const) {
          const raw = prices?.[apiKey];
          const entries: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
          // Le coût d'UNE année (une période 0 vaut 1, comme dans la bibliothèque officielle).
          const yearly = entries.find((e) => Math.max(1, Number(e.period ?? 1)) === 1);
          if (yearly && Number.isFinite(Number(yearly.price))) {
            costs[op] = Number(yearly.price);
            currency = String(yearly.currency || currency).toUpperCase();
          }
        }
        if (!tld.name || !Object.keys(costs).length) continue;
        out.push({
          tld: String(tld.name).replace(/^\./, '').toLowerCase(),
          currency,
          minYears: Math.max(1, Number(tld.minRegistrationPeriod ?? 1)),
          maxYears: Math.max(1, Number(tld.maxRegistrationPeriod ?? 10)),
          costs,
        });
      }
      if (items.length < pageSize || (res.totalCount !== undefined && skip + pageSize >= res.totalCount)) break;
    }
    return out;
  }

  async register(input: { domain: string; years: number; contact: RegistrantContact; nameservers?: string[]; idempotencyKey: string }): Promise<RegisteredDomain> {
    const contacts = (['Registrant', 'Admin', 'Tech', 'Billing'] as const).map((contactType) => this.contactPayload(input.contact, contactType));
    const res = await this.call<Record<string, any>>('write', 'POST', 'domains/register-with-contacts', {
      domainName: input.domain,
      period: input.years,
      nameServers: input.nameservers?.length ? input.nameservers : DEFAULT_NAMESERVERS,
      isLocked: true,
      privacyEnabled: false,
      contacts,
      tldAttributes: {},
    });
    return this.parseDomain(res, input.domain);
  }

  async renew(input: { domain: string; years: number; idempotencyKey: string }): Promise<{ expiresAt: Date | null }> {
    const res = await this.call<Record<string, any>>('write', 'POST', 'domains/renew', { domainName: input.domain, period: input.years });
    return { expiresAt: parseDate(res.expirationDate) };
  }

  async transfer(input: { domain: string; authCode: string; years: number; idempotencyKey: string }): Promise<{ ref: string | null }> {
    const res = await this.call<Record<string, any>>('write', 'POST', 'domains/transfer', { domainName: input.domain, authCode: input.authCode, period: input.years, contacts: [] });
    return { ref: res.id ? String(res.id) : null };
  }

  async getDomain(domain: string): Promise<RegisteredDomain | null> {
    try {
      const res = await this.call<Record<string, any>>('read', 'GET', 'domains/info', { DomainName: domain });
      if (!res || (!res.id && !res.domainName && !res.name)) return null;
      return this.parseDomain(res, domain);
    } catch (error) {
      // Pas dans notre compte : c'est une réponse, pas une panne.
      if (error instanceof RegistrarError && (error.status === 404 || (error.kind === 'rejected' && /not ?found|bulunamad/i.test(error.message)))) return null;
      throw error;
    }
  }

  async getRecordSets(domain: string): Promise<DnsRecordSet[]> {
    const res = await this.call<DnaZoneSet[]>('read', 'GET', 'domains/zones', { domainName: domain });
    return (Array.isArray(res) ? res : []).map((set) => ({
      name: relativeName(String(set.name ?? ''), domain),
      type: String(set.type ?? '').toUpperCase(),
      ttl: Number(set.ttl ?? 3600),
      values: (set.records ?? []).filter((r) => !r.disabled && r.content).map((r) => String(r.content)),
    }));
  }

  async setRecordSet(domain: string, set: DnsRecordSet): Promise<void> {
    const type = set.type.toUpperCase();
    if (!ZONE_TYPES.has(type)) throw new RegistrarError('unsupported', `Type d'enregistrement non pris en charge : ${type}`);
    const values = set.values.map((v) => v.trim()).filter(Boolean);
    if (!values.length) return this.deleteRecordSet(domain, set.name, type);
    const name = set.name === '@' ? '' : set.name;
    const ttl = Math.min(86400, Math.max(60, Math.round(set.ttl || 3600)));
    // POST crée le jeu ou remplace toutes ses valeurs ; PUT échouerait sur un jeu absent.
    await this.call('write', 'POST', `domains/zones?${new URLSearchParams({ domainName: domain })}`, { zoneStruct: { name, ttl, type, contents: values } });
    await this.apply(domain);
  }

  async deleteRecordSet(domain: string, name: string, type: string): Promise<void> {
    // L'API exige une valeur du jeu pour le supprimer (n'importe laquelle supprime tout le jeu).
    const current = (await this.getRecordSets(domain)).find((s) => s.name === name && s.type === type.toUpperCase());
    if (!current?.values.length) return;
    await this.call('write', 'DELETE', 'domains/zones', { domainName: domain, Name: qualifiedName(name, domain), Record: current.values[0], RecordType: type.toUpperCase() });
    await this.apply(domain);
  }

  async account(): Promise<ResellerAccount> {
    const res = await this.call<Record<string, unknown>>('read', 'GET', 'deposit/accounts/me');
    if (!res?.resellerId) throw new RegistrarError('credentials', 'Réponse du compte revendeur inattendue.');
    return { balance: Number(res.usdBalance ?? 0), currency: 'USD' };
  }

  // ─── Interne ──────────────────────────────────────────────────────────────

  private apply(domain: string): Promise<unknown> {
    return this.call('write', 'POST', `domains/zones/apply?${new URLSearchParams({ domainName: domain })}`, {});
  }

  private contactPayload(c: RegistrantContact, contactType: 'Registrant' | 'Admin' | 'Tech' | 'Billing') {
    return {
      contactType,
      firstName: c.firstName,
      lastName: c.lastName,
      companyName: c.company ?? '',
      eMail: c.email,
      address: c.address,
      city: c.city,
      state: c.state || c.city,
      country: c.country.toUpperCase(),
      postalCode: c.postalCode || '00000',
      phoneCountryCode: c.phoneCountryCode.replace(/\D/g, ''),
      phone: c.phone.replace(/\D/g, '').slice(0, 16),
      faxCountryCode: '',
      fax: '',
      isHidden: false,
    };
  }

  private parseDomain(res: Record<string, any>, fallbackName: string): RegisteredDomain {
    return {
      ref: String(res.id ?? res.domainName ?? fallbackName),
      domain: String(res.domainName ?? res.name ?? fallbackName).toLowerCase(),
      expiresAt: parseDate(res.expirationDate),
      nameservers: Array.isArray(res.nameservers) ? res.nameservers.map(String) : Array.isArray(res.nameServers) ? res.nameServers.map(String) : [],
    };
  }

  /**
   * Un appel au fournisseur, et son erreur rangée par ce qu'elle permet (voir `RegistrarErrorKind`).
   * `write` : une coupure APRÈS l'envoi rend le résultat incertain — l'opération a pu avoir lieu.
   */
  private async call<T>(mode: 'read' | 'write', method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown): Promise<T> {
    if (!this.isConfigured()) throw new RegistrarError('credentials', 'Domain Name API n’est pas configuré (DNA_RESELLER_ID, DNA_API_KEY).');
    const started = Date.now();
    try {
      const res = await this.http.request<T>({
        method,
        url: path,
        headers: { 'X-API-KEY': this.apiKey, __reseller: this.resellerId },
        ...(method === 'GET' || method === 'DELETE' ? { params: data } : { data }),
      });
      logger.debug('registrar.call', { event: 'registrar.call', provider: this.code, method, path: path.split('?')[0], status: res.status, durationMs: Date.now() - started });
      return res.data;
    } catch (error) {
      throw this.classify(error as AxiosError<Record<string, any>>, mode, path);
    }
  }

  private classify(error: AxiosError<Record<string, any>>, mode: 'read' | 'write', path: string): RegistrarError {
    const status = error.response?.status;
    const body = error.response?.data ?? {};
    const code = String(body.code ?? body.error?.code ?? (status ? `HTTP_${status}` : error.code ?? 'NETWORK'));
    const details = body.error?.validationErrors ? JSON.stringify(body.error.validationErrors).slice(0, 400) : '';
    const message = String(body.message ?? body.error?.message ?? body.details ?? error.message ?? 'Erreur du fournisseur') + (details ? ` — ${details}` : '');
    logger.warn('registrar.call_failed', { event: 'registrar.call_failed', provider: this.code, path: path.split('?')[0], status, code, mode });

    if (!status) {
      // Aucune réponse : refus de connexion (rien n'est parti) ou coupure en route (tout a pu partir).
      const neverSent = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(String(error.code));
      return new RegistrarError(mode === 'write' && !neverSent ? 'uncertain' : 'transient', message, code);
    }
    if (status === 301 || status === 302 || status === 401 || status === 403) return new RegistrarError('credentials', 'Identifiants Domain Name API refusés.', code, status);
    if (status === 429) return new RegistrarError('transient', message, code, status);
    if (status >= 500) return new RegistrarError(mode === 'write' ? 'uncertain' : 'transient', message, code, status);
    if (/insufficient|balance|bakiye/i.test(message)) return new RegistrarError('insufficient_funds', message, code, status);
    if (/not available|already (registered|exists)|unavailable|taken|kayıtlı/i.test(message)) return new RegistrarError('unavailable', message, code, status);
    return new RegistrarError('rejected', message, code, status);
  }
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `www.exemple.com.` → `www` ; `exemple.com` → `@`. */
export function relativeName(name: string, domain: string): string {
  const bare = name.trim().replace(/\.$/, '').toLowerCase();
  const zone = domain.toLowerCase();
  if (!bare || bare === '@' || bare === zone) return '@';
  return bare.endsWith(`.${zone}`) ? bare.slice(0, -(zone.length + 1)) : bare;
}

function qualifiedName(name: string, domain: string): string {
  return !name || name === '@' ? domain : `${name}.${domain}`;
}
