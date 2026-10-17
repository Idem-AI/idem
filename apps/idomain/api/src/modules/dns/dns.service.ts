/**
 * Les DNS d'un domaine géré par iDomain (zone tenue chez le registrar qui l'a enregistré).
 *
 * Règles qui ne se discutent pas :
 *   - on ne remplace JAMAIS toute une zone : on écrit le seul jeu (nom + type) concerné ;
 *   - brancher un site ne touche que l'adresse (A) du nom branché, et retire seulement ce qui la
 *     contredit sur ce même nom (CNAME, AAAA) — MX, SPF, DKIM, DMARC et tout le reste sont intacts ;
 *   - chaque écriture garde ce qu'il y avait avant (`dns_changes`) : on peut tout restaurer.
 */
import { z } from 'zod';
import { one, query } from '../../config/db';
import { HttpError } from '../../middleware/error';
import { DnsRecordSet, registrar } from '../../integrations/registrars';
import { audit } from '../audit/audit.service';

export const EDITABLE_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV'] as const;

export const recordSetInput = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(@|\*|(\*\.)?[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)*)$/, 'Nom invalide (ex. @, www, mail)'),
  type: z.enum(EDITABLE_TYPES),
  ttl: z.number().int().min(60).max(86400).default(3600),
  values: z.array(z.string().trim().min(1).max(1024)).max(20),
});

interface DomainRow {
  id: string;
  owner_uid: string;
  name: string;
  registrar_code: string | null;
  dns_mode: string;
  status: string;
}

export async function ownedDomain(ownerUid: string, domainId: string): Promise<DomainRow> {
  const row = await one<DomainRow>(`SELECT id, owner_uid, name, registrar_code, dns_mode, status FROM domains WHERE id = $1 AND owner_uid = $2`, [domainId, ownerUid]);
  if (!row) throw new HttpError(404, 'domain_not_found');
  return row;
}

function zoneAdapter(domain: DomainRow) {
  if (domain.dns_mode !== 'managed' || !domain.registrar_code) throw new HttpError(409, 'dns_not_managed', 'Les DNS de ce domaine sont gérés ailleurs.');
  const adapter = registrar(domain.registrar_code);
  if (!adapter) throw new HttpError(503, 'provider_unavailable', 'Le service DNS est momentanément indisponible.');
  return adapter;
}

/** Valeurs vérifiées selon le type : une adresse pour A, un nom pour CNAME… */
function validateValues(type: string, values: string[]): string[] {
  const check: Record<string, RegExp> = {
    A: /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
    AAAA: /^[0-9a-f:]{2,39}$/i,
    CNAME: /^([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,}\.?$/i,
    MX: /^\d{1,5}\s+([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,}\.?$/i,
  };
  for (const v of values) {
    if (check[type] && !check[type].test(v)) throw new HttpError(422, 'invalid_record_value', `Valeur invalide pour un enregistrement ${type} : ${v}`);
  }
  if (type === 'CNAME' && values.length > 1) throw new HttpError(422, 'invalid_record_value', 'Un CNAME n’a qu’une seule valeur.');
  return values;
}

export async function listRecordSets(ownerUid: string, domainId: string): Promise<DnsRecordSet[]> {
  const domain = await ownedDomain(ownerUid, domainId);
  const sets = await zoneAdapter(domain).getRecordSets(domain.name);
  return sets.sort((a, b) => (a.name === '@' ? -1 : b.name === '@' ? 1 : a.name.localeCompare(b.name)) || a.type.localeCompare(b.type));
}

/** Écrit un jeu en gardant la trace de l'ancien (restauration possible). */
async function writeSet(domain: DomainRow, set: DnsRecordSet, actor: { uid: string | null; connectionId?: string | null }): Promise<void> {
  const adapter = zoneAdapter(domain);
  const current = (await adapter.getRecordSets(domain.name)).find((s) => s.name === set.name && s.type === set.type);
  const before = current?.values ?? [];
  if (sameValues(before, set.values) && (!set.values.length || current?.ttl === set.ttl)) return;
  await adapter.setRecordSet(domain.name, set);
  for (const value of before) await logChange(domain.id, actor, 'delete', set.name, set.type, value, current?.ttl ?? null);
  for (const value of set.values) await logChange(domain.id, actor, 'add', set.name, set.type, value, set.ttl);
}

async function logChange(domainId: string, actor: { uid: string | null; connectionId?: string | null }, action: 'add' | 'delete', name: string, type: string, content: string, ttl: number | null): Promise<void> {
  await query(`INSERT INTO dns_changes (domain_id, connection_id, actor_uid, action, name, type, content, ttl) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [domainId, actor.connectionId ?? null, actor.uid, action, name, type, content, ttl]);
}

function sameValues(a: string[], b: string[]): boolean {
  const norm = (l: string[]) => [...l].map((v) => v.toLowerCase().replace(/\.$/, '')).sort().join('|');
  return norm(a) === norm(b);
}

/** Vue avancée : écrire un jeu (valeurs vides = le supprimer). */
export async function saveRecordSet(ownerUid: string, domainId: string, input: z.infer<typeof recordSetInput>): Promise<DnsRecordSet[]> {
  const domain = await ownedDomain(ownerUid, domainId);
  const values = validateValues(input.type, input.values);
  if (input.type === 'CNAME' && input.name === '@') throw new HttpError(422, 'cname_at_apex', 'Le domaine lui-même ne peut pas être un CNAME : utilisez un enregistrement A.');
  await writeSet(domain, { name: input.name, type: input.type, ttl: input.ttl, values }, { uid: ownerUid });
  await audit({ actorKind: 'user', actorId: ownerUid, action: 'dns.set_saved', targetType: 'domain', targetId: domain.id, data: { name: input.name, type: input.type, values } });
  return listRecordSets(ownerUid, domainId);
}

/**
 * Brancher des noms (`@`, `www`) sur une adresse IP, pour une connexion. Seuls les jeux A du nom
 * sont écrits ; un CNAME ou un AAAA sur CE nom est retiré (il contredirait l'adresse, et un AAAA
 * ferait échouer le certificat). Le reste de la zone n'est pas lu pour être réécrit.
 */
export async function pointNamesTo(domainId: string, names: string[], ip: string, actor: { uid: string; connectionId: string }): Promise<void> {
  const domain = (await one<DomainRow>(`SELECT id, owner_uid, name, registrar_code, dns_mode, status FROM domains WHERE id = $1`, [domainId]))!;
  const adapter = zoneAdapter(domain);
  const sets = await adapter.getRecordSets(domain.name);
  for (const name of names) {
    for (const conflicting of ['CNAME', 'AAAA']) {
      const set = sets.find((s) => s.name === name && s.type === conflicting);
      if (set?.values.length) await writeSet(domain, { ...set, values: [] }, actor);
    }
    await writeSet(domain, { name, type: 'A', ttl: 300, values: [ip] }, actor);
  }
  await audit({ actorKind: 'system', actorId: actor.uid, action: 'dns.pointed', targetType: 'domain', targetId: domain.id, data: { names, ip, connectionId: actor.connectionId } });
}

/** Restaure ce qu'une connexion a changé : chaque jeu touché retrouve ses valeurs d'avant. */
export async function revertConnectionChanges(connectionId: string): Promise<number> {
  const changes = await query<{ id: string; domain_id: string; action: 'add' | 'delete'; name: string; type: string; content: string; ttl: number | null }>(
    `SELECT id, domain_id, action, name, type, content, ttl FROM dns_changes WHERE connection_id = $1 AND reverted_at IS NULL ORDER BY id`,
    [connectionId]
  );
  if (!changes.length) return 0;
  const domain = (await one<DomainRow>(`SELECT id, owner_uid, name, registrar_code, dns_mode, status FROM domains WHERE id = $1`, [changes[0].domain_id]))!;
  const adapter = zoneAdapter(domain);
  const touched = new Map<string, { name: string; type: string; before: string[]; ttl: number }>();
  for (const c of changes) {
    const key = `${c.name}|${c.type}`;
    // La PREMIÈRE trace d'un jeu dit ce qu'il contenait avant toute écriture de la connexion.
    if (!touched.has(key)) touched.set(key, { name: c.name, type: c.type, before: [], ttl: c.ttl ?? 3600 });
    const entry = touched.get(key)!;
    if (c.action === 'delete' && !changes.some((x) => x.id < c.id && x.name === c.name && x.type === c.type && x.action === 'add')) entry.before.push(c.content);
  }
  for (const set of touched.values()) await adapter.setRecordSet(domain.name, { name: set.name, type: set.type, ttl: set.ttl, values: set.before });
  await query(`UPDATE dns_changes SET reverted_at = now() WHERE connection_id = $1 AND reverted_at IS NULL`, [connectionId]);
  await audit({ actorKind: 'system', action: 'dns.reverted', targetType: 'connection', targetId: connectionId, data: { sets: [...touched.keys()] } });
  return touched.size;
}
