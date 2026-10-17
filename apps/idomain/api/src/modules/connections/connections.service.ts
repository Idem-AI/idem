/**
 * Relier un domaine à une application iDeploy, sans manipulation technique pour l'utilisateur.
 *
 * Deux méthodes, choisies d'après le domaine :
 *   - `managed` — le domaine est chez iDomain : iDomain écrit lui-même l'adresse dans la zone ;
 *   - `manual`  — le domaine est ailleurs, sans intégration : iDomain prouve d'abord que
 *                 l'utilisateur le contrôle (un TXT à poser), lui donne les deux réglages à copier,
 *                 puis surveille le DNS public jusqu'à ce qu'il soit bon.
 *   (Les DNS externes pilotables par API — Cloudflare… — s'ajouteront derrière la même chaîne.)
 *
 * La chaîne, avancée par le worker et reprise après tout arrêt :
 *   awaiting_domain → (verifying_ownership) → pending → configuring_dns → attaching
 *   → waiting_dns → activating_tls → active
 * `active` n'est déclaré qu'avec le DNS public bon ET un certificat HTTPS valide.
 */
import { randomBytes } from 'crypto';
import { Resolver } from 'dns/promises';
import { z } from 'zod';
import { one, query } from '../../config/db';
import logger from '../../config/logger';
import { HttpError } from '../../middleware/error';
import { hosting } from '../../integrations/ideploy.client';
import { enqueueConnection } from '../../queue/queues';
import { normalizeHost, relativeTo, zoneOf } from '../../utils/domain-name';
import { audit } from '../audit/audit.service';
import { pointNamesTo, revertConnectionChanges } from '../dns/dns.service';
import { emit } from '../webhooks/webhooks.service';

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

export interface ConnectionRow {
  id: string;
  owner_uid: string;
  domain_id: string | null;
  host: string;
  include_www: boolean;
  target: string;
  app_uuid: string;
  environment: string;
  session_id: string | null;
  dns_method: 'managed' | 'manual';
  status: ConnectionStatus;
  target_ip: string | null;
  last_check: { domains?: { host: string; dns: string; https: string }[] } | null;
  attempts: number;
  error: string | null;
  activated_at: Date | null;
  cycle_started_at: Date;
  created_at: Date;
  updated_at: Date;
}

/** Au-delà, un réglage manuel jamais fait est abandonné (avec un message clair). */
const GIVE_UP_MS = 72 * 3600_000;
const VERIFY_PREFIX = '_idem-verification';

export const connectionInput = z.object({
  host: z.string().min(3).max(253),
  appUuid: z.string().min(1).max(64),
  includeWww: z.boolean().default(true),
  domainSessionId: z.string().uuid().optional(),
});

/** Les adresses servies pour une connexion : le nom, et son `www.` quand c'est le domaine lui-même. */
export function hostsOf(c: Pick<ConnectionRow, 'host' | 'include_www'>): string[] {
  return c.include_www && zoneOf(c.host) === c.host ? [c.host, `www.${c.host}`] : [c.host];
}

export async function requestConnection(
  ownerUid: string,
  input: { host: string; appUuid: string; includeWww?: boolean; domainSessionId?: string; orderItemId?: string }
): Promise<ConnectionRow> {
  const host = normalizeHost(input.host);
  if (!host) throw new HttpError(422, 'invalid_domain', 'Ce nom de domaine n’est pas valide.');
  // iDeploy dit si l'utilisateur a accès à l'application (404 sinon) — vérifié AVANT toute écriture.
  await hosting.target(ownerUid, input.appUuid);

  const zone = zoneOf(host);
  const owned = await one<{ id: string; status: string }>(`SELECT id, status FROM domains WHERE name = $1 AND owner_uid = $2 AND status = 'active' AND dns_mode = 'managed'`, [zone, ownerUid]);
  let status: ConnectionStatus;
  let method: 'managed' | 'manual';
  if (owned) {
    status = 'pending';
    method = 'managed';
  } else if (input.orderItemId) {
    status = 'awaiting_domain';
    method = 'managed';
  } else {
    // Un domaine qui appartient à un AUTRE compte iDomain ne se connecte pas par ce chemin.
    const foreign = await one<{ id: string }>(`SELECT id FROM domains WHERE name = $1 AND owner_uid <> $2 AND status <> 'failed'`, [zone, ownerUid]);
    if (foreign) throw new HttpError(409, 'domain_owned_elsewhere', 'Ce domaine est géré par un autre compte.');
    status = 'verifying_ownership';
    method = 'manual';
  }

  let row: ConnectionRow | null;
  try {
    row = await one<ConnectionRow>(
      `INSERT INTO domain_connections (owner_uid, domain_id, host, include_www, app_uuid, session_id, dns_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [ownerUid, owned?.id ?? null, host, input.includeWww ?? true, input.appUuid, input.domainSessionId ?? null, method, status]
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const existing = await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE host = $1 AND status NOT IN ('failed', 'detached')`, [host]);
      if (existing && existing.owner_uid === ownerUid && existing.app_uuid === input.appUuid) return existing;
      throw new HttpError(409, 'domain_already_connected', 'Ce domaine est déjà relié à une autre application.');
    }
    throw error;
  }
  if (method === 'manual') {
    const token = randomBytes(16).toString('hex');
    await query(`INSERT INTO domain_verifications (connection_id, record_name, token) VALUES ($1, $2, $3)`, [row!.id, `${VERIFY_PREFIX}.${host}`, token]);
  }
  await audit({ actorKind: 'user', actorId: ownerUid, action: 'connection.requested', targetType: 'connection', targetId: row!.id, data: { host, appUuid: input.appUuid, method } });
  if (status !== 'awaiting_domain') await enqueueConnection(row!.id);
  return row!;
}

/** Délai avant la prochaine lecture : rapide au début (le DNS d'iDomain se propage en minutes), puis espacé. */
function nextDelay(attempts: number): number {
  if (attempts < 10) return 30_000;
  if (attempts < 40) return 2 * 60_000;
  return 10 * 60_000;
}

async function setStatus(id: string, status: ConnectionStatus, fields: Partial<{ error: string | null; target_ip: string; last_check: unknown; activated_at: Date }> = {}): Promise<void> {
  await query(
    `UPDATE domain_connections SET status = $2, error = $3, target_ip = COALESCE($4, target_ip), last_check = COALESCE($5, last_check), activated_at = COALESCE($6, activated_at), updated_at = now() WHERE id = $1`,
    [id, status, fields.error ?? null, fields.target_ip ?? null, fields.last_check ? JSON.stringify(fields.last_check) : null, fields.activated_at ?? null]
  );
}

/** Une étape de la chaîne. Le worker rappelle tant qu'on n'est pas arrivé (ou abandonné). */
export async function advance(connectionId: string): Promise<void> {
  const c = await one<ConnectionRow>(`UPDATE domain_connections SET attempts = attempts + 1, last_attempt_at = now() WHERE id = $1 RETURNING *`, [connectionId]);
  if (!c || ['active', 'failed', 'detached', 'awaiting_domain'].includes(c.status)) return;
  const age = Date.now() - new Date(c.cycle_started_at).getTime();
  const hosts = hostsOf(c);

  try {
    if (c.status === 'verifying_ownership') {
      const v = await one<{ id: string; record_name: string; token: string }>(`SELECT id, record_name, token FROM domain_verifications WHERE connection_id = $1 AND verified_at IS NULL`, [c.id]);
      if (v && !(await txtContains(v.record_name, `idem-verify=${v.token}`))) {
        if (age > GIVE_UP_MS) return giveUp(c, 'ownership_not_verified');
        await enqueueConnection(c.id, nextDelay(c.attempts));
        return;
      }
      if (v) await query(`UPDATE domain_verifications SET verified_at = now() WHERE id = $1`, [v.id]);
      await audit({ actorKind: 'system', action: 'connection.ownership_verified', targetType: 'connection', targetId: c.id, data: { host: c.host } });
      await setStatus(c.id, 'attaching');
      return advance(c.id);
    }

    if (c.status === 'pending' || c.status === 'configuring_dns') {
      const target = await hosting.target(c.owner_uid, c.app_uuid);
      if (!target.serverIp) throw new Error('target_without_ip');
      await setStatus(c.id, 'configuring_dns', { target_ip: target.serverIp });
      const zone = zoneOf(c.host);
      await pointNamesTo(c.domain_id!, hosts.map((h) => relativeTo(h, zone)), target.serverIp, { uid: c.owner_uid, connectionId: c.id });
      await setStatus(c.id, 'attaching', { target_ip: target.serverIp });
      return advance(c.id);
    }

    if (c.status === 'attaching') {
      const target = await hosting.target(c.owner_uid, c.app_uuid);
      await hosting.attach(c.owner_uid, c.app_uuid, hosts);
      await setStatus(c.id, 'waiting_dns', { target_ip: target.serverIp ?? undefined });
      await enqueueConnection(c.id, 15_000);
      return;
    }

    // waiting_dns / activating_tls : ce que voit le monde, lu par iDeploy.
    const statuses = await hosting.status(c.owner_uid, c.app_uuid, hosts);
    const check = { domains: statuses.map((s) => ({ host: s.host, dns: s.dns, https: s.https })) };
    const dnsOk = statuses.length === hosts.length && statuses.every((s) => s.dns === 'ok' || s.dns === 'automatic');
    const primary = statuses.find((s) => s.host === c.host);
    if (dnsOk && primary?.https === 'valid') {
      await setStatus(c.id, 'active', { last_check: check, activated_at: new Date() });
      await audit({ actorKind: 'system', action: 'connection.active', targetType: 'connection', targetId: c.id, data: { host: c.host, appUuid: c.app_uuid } });
      logger.info('connection.active', { event: 'connection.active', connectionId: c.id, host: c.host, appUuid: c.app_uuid });
      await emit('domain.active', { connectionId: c.id, host: c.host, hosts, appUuid: c.app_uuid, environment: c.environment, ownerUid: c.owner_uid, status: 'active' });
      return;
    }
    if (statuses.some((s) => s.dns === 'taken')) return giveUp(c, 'domain_taken_by_other_app', check);
    // Géré par iDomain et toujours faux après une heure : l'adresse est réécrite (quelqu'un l'a changée).
    if (c.dns_method === 'managed' && age > 3600_000 && statuses.some((s) => s.dns === 'wrong_ip' || s.dns === 'missing') && c.attempts % 10 === 0) {
      await setStatus(c.id, 'configuring_dns', { last_check: check });
      await enqueueConnection(c.id);
      return;
    }
    if (age > GIVE_UP_MS) return giveUp(c, dnsOk ? 'certificate_not_issued' : 'dns_not_set', check);
    await setStatus(c.id, dnsOk ? 'activating_tls' : 'waiting_dns', { last_check: check });
    await enqueueConnection(c.id, nextDelay(c.attempts));
  } catch (error) {
    logger.warn('connection.step_failed', { event: 'connection.step_failed', connectionId: c.id, status: c.status, error });
    await query(`UPDATE domain_connections SET error = $2 WHERE id = $1`, [c.id, String((error as Error).message).slice(0, 300)]);
    if (age > GIVE_UP_MS) return giveUp(c, 'step_failed');
    await enqueueConnection(c.id, nextDelay(c.attempts));
  }
}

async function giveUp(c: ConnectionRow, reason: string, check?: unknown): Promise<void> {
  await setStatus(c.id, 'failed', { error: reason, last_check: check });
  await audit({ actorKind: 'system', action: 'connection.failed', targetType: 'connection', targetId: c.id, data: { host: c.host, reason } });
  await emit('connection.failed', { connectionId: c.id, host: c.host, appUuid: c.app_uuid, ownerUid: c.owner_uid, reason });
}

/** Lit un TXT chez des résolveurs publics (ce que voit le monde, pas un cache local). */
async function txtContains(name: string, expected: string): Promise<boolean> {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  try {
    const records = await resolver.resolveTxt(name);
    return records.some((chunks) => chunks.join('') === expected);
  } catch {
    return false;
  }
}

/** Débrancher : l'application ne répond plus à ce nom, la zone retrouve ses valeurs d'avant. */
export async function detachConnection(ownerUid: string, connectionId: string): Promise<ConnectionRow> {
  const c = await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE id = $1 AND owner_uid = $2`, [connectionId, ownerUid]);
  if (!c) throw new HttpError(404, 'connection_not_found');
  if (c.status === 'detached') return c;
  if (!['awaiting_domain', 'verifying_ownership'].includes(c.status)) await hosting.detach(ownerUid, c.app_uuid, hostsOf(c)).catch((error) => logger.warn('connection.detach_hosting_failed', { event: 'connection.detach_hosting_failed', connectionId, error }));
  if (c.dns_method === 'managed') await revertConnectionChanges(c.id);
  await setStatus(c.id, 'detached');
  await audit({ actorKind: 'user', actorId: ownerUid, action: 'connection.detached', targetType: 'connection', targetId: c.id, data: { host: c.host } });
  return (await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE id = $1`, [c.id]))!;
}

/** Relancer une connexion abandonnée (réglage fait tard, certificat enfin émis). */
export async function retryConnection(ownerUid: string, connectionId: string): Promise<ConnectionRow> {
  const c = await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE id = $1 AND owner_uid = $2`, [connectionId, ownerUid]);
  if (!c) throw new HttpError(404, 'connection_not_found');
  if (c.status !== 'failed') return c;
  const verified = c.dns_method === 'manual' ? await one(`SELECT 1 FROM domain_verifications WHERE connection_id = $1 AND verified_at IS NOT NULL`, [c.id]) : true;
  const status: ConnectionStatus = c.dns_method === 'manual' && !verified ? 'verifying_ownership' : c.dns_method === 'managed' ? 'pending' : 'attaching';
  await query(`UPDATE domain_connections SET status = $2, error = NULL, attempts = 0, cycle_started_at = now(), updated_at = now() WHERE id = $1`, [c.id, status]);
  await enqueueConnection(c.id);
  return (await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE id = $1`, [c.id]))!;
}

/** Ce que l'utilisateur voit d'une connexion, avec les réglages à copier quand c'est à lui de les faire. */
export async function publicConnection(c: ConnectionRow) {
  let instructions: { type: string; name: string; value: string; zone: string; purpose: 'ownership' | 'address' }[] = [];
  if (c.dns_method === 'manual') {
    const zone = zoneOf(c.host);
    const v = await one<{ record_name: string; token: string; verified_at: Date | null }>(`SELECT record_name, token, verified_at FROM domain_verifications WHERE connection_id = $1 ORDER BY created_at DESC LIMIT 1`, [c.id]);
    const ip = c.target_ip ?? (await hosting.target(c.owner_uid, c.app_uuid).then((t) => t.serverIp).catch(() => null));
    if (v && !v.verified_at) instructions.push({ type: 'TXT', name: relativeTo(v.record_name, zone), value: `idem-verify=${v.token}`, zone, purpose: 'ownership' });
    if (ip) instructions = instructions.concat(hostsOf(c).map((h) => ({ type: 'A', name: relativeTo(h, zone), value: ip, zone, purpose: 'address' as const })));
  }
  return {
    id: c.id,
    host: c.host,
    hosts: hostsOf(c),
    appUuid: c.app_uuid,
    environment: c.environment,
    method: c.dns_method,
    status: c.status,
    error: c.error,
    check: c.last_check,
    instructions,
    activatedAt: c.activated_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function getConnection(ownerUid: string, id: string) {
  const c = await one<ConnectionRow>(`SELECT * FROM domain_connections WHERE id = $1 AND owner_uid = $2`, [id, ownerUid]);
  if (!c) throw new HttpError(404, 'connection_not_found');
  return publicConnection(c);
}

export async function listConnections(ownerUid: string, filter: { appUuid?: string; domainId?: string } = {}) {
  const rows = await query<ConnectionRow>(
    `SELECT * FROM domain_connections WHERE owner_uid = $1 AND status <> 'detached' AND ($2::text IS NULL OR app_uuid = $2) AND ($3::uuid IS NULL OR domain_id = $3) ORDER BY created_at DESC LIMIT 100`,
    [ownerUid, filter.appUuid ?? null, filter.domainId ?? null]
  );
  return Promise.all(rows.map(publicConnection));
}
