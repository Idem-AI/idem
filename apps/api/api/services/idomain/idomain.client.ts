/**
 * iDomain, vu de l'API IDEM. iDomain (`apps/idomain`) est la SEULE source des noms de domaine :
 * prix publics, commandes, enregistrement chez les registrars. L'API IDEM ne garde ni prix ni
 * commandes de domaines ; elle appelle iDomain (`/internal/v1`, clé `IDOMAIN_SERVICE_KEY`) pour :
 *   - afficher les prix publics (page Offres, pack Lancement + domaine) ;
 *   - passer la commande d'un pack Lancement + domaine, payé ici, enregistré là-bas ;
 *   - lister les domaines d'un utilisateur (anciennes routes `/billing/domains`).
 */
import axios from 'axios';
import logger from '../../config/logger';

export interface DomainPrice {
  priceXaf: number | null;
  renewalXaf: number | null;
  packXaf: number | null;
}

const baseUrl = () => (process.env.IDOMAIN_API_URL || 'http://localhost:3007').replace(/\/+$/, '');
const headers = () => ({ 'x-idomain-key': process.env.IDOMAIN_SERVICE_KEY || '' });

let catalogCache: { value: Record<string, DomainPrice>; at: number } | null = null;
const CATALOG_TTL_MS = 5 * 60_000;

export const idomainClient = {
  /** Les prix publics par extension (cache 5 min ; iDomain injoignable : le dernier connu, sinon vide). */
  async catalog(): Promise<Record<string, DomainPrice>> {
    if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.value;
    try {
      const res = await axios.get<{ domains: Record<string, DomainPrice> }>(`${baseUrl()}/internal/v1/catalog`, { headers: headers(), timeout: 5000 });
      catalogCache = { value: res.data.domains ?? {}, at: Date.now() };
      return catalogCache.value;
    } catch (error) {
      logger.warn('idomain.catalog_unavailable', { event: 'idomain.catalog_unavailable', error });
      return catalogCache?.value ?? {};
    }
  },

  /** Une commande payée par IDEM (pack) : idempotente par `reference`. */
  async prepaidOrder(input: { userId: string; domain: string; reference: string; source: 'pack' | 'pass' | 'idem'; appUuid?: string }): Promise<{ id: string; status: string }> {
    const res = await axios.post<{ id: string; status: string }>(`${baseUrl()}/internal/v1/orders/prepaid`, input, { headers: headers(), timeout: 15_000 });
    return res.data;
  },

  async userDomains(userId: string): Promise<{ domains: unknown[]; orders: unknown[] }> {
    const res = await axios.get<{ domains: unknown[]; orders: unknown[] }>(`${baseUrl()}/internal/v1/users/${encodeURIComponent(userId)}/domains`, { headers: headers(), timeout: 8000 });
    return res.data;
  },

  /** Où envoyer l'utilisateur pour chercher, acheter et brancher un domaine. */
  webUrl(): string {
    return (process.env.IDOMAIN_WEB_URL || 'https://idomain.idem.africa').replace(/\/+$/, '');
  },
};

/** Extension d'un nom enregistrable (`ma-boutique.africa` → `africa`), ou null s'il est invalide. */
export function domainExtension(domain: string): string | null {
  const match = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.([a-z]{2,24})$/.exec(domain.trim().toLowerCase());
  return match ? match[1] : null;
}
