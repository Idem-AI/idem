/**
 * Un registrar simulé, pour le développement et les contrôles (`IDOMAIN_SIMULATED_REGISTRAR=true`,
 * refusé en production). Son état vit dans Redis : l'API et les workers, deux processus, voient
 * les mêmes domaines et les mêmes zones.
 *
 * Des noms déclenchent les cas difficiles, pour les éprouver sans fournisseur réel :
 *   `pris…`, `taken…`  déjà enregistré ;
 *   `premium…`         nom premium (jamais vendu au prix catalogue) ;
 *   `incertain…`       le premier enregistrement « coupe » APRÈS avoir réussi (résultat incertain) ;
 *   `refuse…`          refus définitif de ce fournisseur.
 */
import redis from '../../config/redis';
import {
  AvailabilityResult,
  DnsRecordSet,
  RegisteredDomain,
  RegistrarAdapter,
  RegistrarError,
  RegistrarOperation,
  ResellerAccount,
  TldPricing,
} from './types';

const KEY = 'idomain:sim';
const COSTS: Record<string, { register: number; renew: number; transfer: number }> = {
  com: { register: 10, renew: 10, transfer: 10 },
  africa: { register: 7, renew: 9, transfer: 9 },
};

export class SimulatedRegistrar implements RegistrarAdapter {
  readonly code = 'simulated';

  isConfigured(): boolean {
    return true;
  }

  /** Le coût annoncé est celui d'une année, comme chez Domain Name API. */
  async checkAvailability(domains: string[], operation: RegistrarOperation, _years: number): Promise<AvailabilityResult[]> {
    const out: AvailabilityResult[] = [];
    for (const domain of domains) {
      const [label, ...rest] = domain.split('.');
      const tld = rest.join('.');
      const owned = await redis.hexists(`${KEY}:domains`, domain);
      const taken = owned || /^(pris|taken)/.test(label);
      const cost = COSTS[tld]?.[operation === 'restore' ? 'renew' : operation];
      out.push({
        domain,
        available: !taken && Boolean(COSTS[tld]),
        premium: label.startsWith('premium'),
        ...(cost !== undefined ? { cost, currency: 'USD' } : {}),
      });
    }
    return out;
  }

  async listTldPricing(): Promise<TldPricing[]> {
    return Object.entries(COSTS).map(([tld, c]) => ({ tld, currency: 'USD', minYears: 1, maxYears: 10, costs: { register: c.register, renew: c.renew, transfer: c.transfer } }));
  }

  async register(input: { domain: string; years: number; idempotencyKey: string }): Promise<RegisteredDomain> {
    const label = input.domain.split('.')[0];
    if (label.startsWith('refuse')) throw new RegistrarError('rejected', 'Refusé par le fournisseur simulé.');
    if (/^(pris|taken)/.test(label) || (await redis.hexists(`${KEY}:domains`, input.domain))) {
      throw new RegistrarError('unavailable', 'Domaine déjà enregistré.');
    }
    const expiresAt = new Date(Date.now() + input.years * 365 * 24 * 3600 * 1000);
    const record: RegisteredDomain = { ref: `sim-${input.domain}`, domain: input.domain, expiresAt, nameservers: ['ns1.sim.idem.africa', 'ns2.sim.idem.africa'] };
    await redis.hset(`${KEY}:domains`, input.domain, JSON.stringify(record));
    // Le premier essai sur `incertain…` réussit chez le fournisseur, mais la réponse se perd.
    if (label.startsWith('incertain') && (await redis.set(`${KEY}:cut:${input.domain}`, '1', 'EX', 3600, 'NX'))) {
      throw new RegistrarError('uncertain', 'Délai dépassé (simulé) après envoi.');
    }
    return record;
  }

  async renew(input: { domain: string; years: number }): Promise<{ expiresAt: Date | null }> {
    const current = await this.getDomain(input.domain);
    if (!current) throw new RegistrarError('rejected', 'Domaine inconnu du fournisseur simulé.');
    const base = Math.max(Date.now(), current.expiresAt?.getTime() ?? Date.now());
    const expiresAt = new Date(base + input.years * 365 * 24 * 3600 * 1000);
    await redis.hset(`${KEY}:domains`, input.domain, JSON.stringify({ ...current, expiresAt }));
    return { expiresAt };
  }

  async transfer(input: { domain: string }): Promise<{ ref: string | null }> {
    return { ref: `sim-${input.domain}` };
  }

  async getDomain(domain: string): Promise<RegisteredDomain | null> {
    const raw = await redis.hget(`${KEY}:domains`, domain);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegisteredDomain & { expiresAt: string | null };
    return { ...parsed, expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null };
  }

  async getRecordSets(domain: string): Promise<DnsRecordSet[]> {
    const raw = await redis.hgetall(`${KEY}:zone:${domain}`);
    return Object.values(raw).map((v) => JSON.parse(v) as DnsRecordSet);
  }

  async setRecordSet(domain: string, set: DnsRecordSet): Promise<void> {
    if (!set.values.length) return this.deleteRecordSet(domain, set.name, set.type);
    await redis.hset(`${KEY}:zone:${domain}`, `${set.name}|${set.type.toUpperCase()}`, JSON.stringify({ ...set, type: set.type.toUpperCase() }));
  }

  async deleteRecordSet(domain: string, name: string, type: string): Promise<void> {
    await redis.hdel(`${KEY}:zone:${domain}`, `${name}|${type.toUpperCase()}`);
  }

  async account(): Promise<ResellerAccount> {
    return { balance: 500, currency: 'USD' };
  }

  /** Pour les contrôles : une zone préexistante (mail, vérifications) que rien ne doit effacer. */
  async seedZone(domain: string, sets: DnsRecordSet[]): Promise<void> {
    for (const set of sets) await this.setRecordSet(domain, set);
  }

  async reset(): Promise<void> {
    const keys = await redis.keys(`${KEY}:*`);
    if (keys.length) await redis.del(...keys);
  }
}
