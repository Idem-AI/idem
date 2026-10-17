/**
 * Les domaines d'un utilisateur : ce qui est actif, quand ça expire, ce que coûtera le
 * renouvellement, à quelle application c'est relié et dans quel état.
 */
import { one, query } from '../../config/db';
import { HttpError } from '../../middleware/error';

interface DomainListRow {
  id: string;
  name: string;
  tld: string;
  status: string;
  dns_mode: string;
  registered_at: Date | null;
  expires_at: Date | null;
  renewal_xaf: number | null;
  source: string;
  created_at: Date;
  connection: { id: string; host: string; app_uuid: string; status: string; error: string | null } | null;
}

function view(r: DomainListRow) {
  const daysLeft = r.expires_at ? Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86_400_000) : null;
  return {
    id: r.id,
    name: r.name,
    tld: r.tld,
    status: r.status,
    dnsMode: r.dns_mode,
    registeredAt: r.registered_at,
    expiresAt: r.expires_at,
    daysLeft,
    renewalXaf: r.renewal_xaf,
    source: r.source,
    connection: r.connection ? { id: r.connection.id, host: r.connection.host, appUuid: r.connection.app_uuid, status: r.connection.status, error: r.connection.error } : null,
  };
}

const SELECT = `
  SELECT d.id, d.name, d.tld, d.status, d.dns_mode, d.registered_at, d.expires_at, d.renewal_xaf, d.source, d.created_at,
         (SELECT json_build_object('id', c.id, 'host', c.host, 'app_uuid', c.app_uuid, 'status', c.status, 'error', c.error)
            FROM domain_connections c WHERE c.domain_id = d.id AND c.status <> 'detached' ORDER BY c.created_at DESC LIMIT 1) AS connection
    FROM domains d`;

export async function listDomains(ownerUid: string) {
  const rows = await query<DomainListRow>(`${SELECT} WHERE d.owner_uid = $1 AND d.status <> 'failed' ORDER BY d.created_at DESC`, [ownerUid]);
  return rows.map(view);
}

export async function getDomain(ownerUid: string, domainId: string) {
  const row = await one<DomainListRow>(`${SELECT} WHERE d.id = $1 AND d.owner_uid = $2`, [domainId, ownerUid]);
  if (!row) throw new HttpError(404, 'domain_not_found');
  return view(row);
}

/**
 * Les informations légales : qui a enregistré le domaine (le registrar n'apparaît pas dans
 * l'interface ordinaire, mais le titulaire a le droit de le connaître — transfert, litige).
 */
export async function registrarInfo(ownerUid: string, domainId: string) {
  const row = await one<{ name: string; registrar_code: string | null; registrar_name: string | null }>(
    `SELECT d.name, d.registrar_code, p.name AS registrar_name FROM domains d LEFT JOIN registrar_providers p ON p.code = d.registrar_code WHERE d.id = $1 AND d.owner_uid = $2`,
    [domainId, ownerUid]
  );
  if (!row) throw new HttpError(404, 'domain_not_found');
  return { domain: row.name, registrar: row.registrar_name };
}
