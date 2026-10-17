/**
 * Un parcours ouvert depuis un produit IDEM (« Votre application est en ligne — voulez-vous votre
 * propre nom ? »). iDeploy ou iCode le crée avec l'application, l'environnement et l'adresse où
 * revenir ; l'utilisateur fait tout dans iDomain, puis revient là où il était.
 *
 * L'identité est celle de la session IDEM (cookie) : un produit ne peut pas ouvrir un parcours
 * pour quelqu'un d'autre, et iDeploy confirme que l'application est bien accessible à l'utilisateur.
 */
import { z } from 'zod';
import { env } from '../../config/env';
import { one } from '../../config/db';
import { HttpError } from '../../middleware/error';
import { hosting } from '../../integrations/ideploy.client';

export const domainSessionInput = z.object({
  source: z.enum(['ideploy', 'icode']),
  appUuid: z.string().min(1).max(64),
  environment: z.string().max(40).default('production'),
  returnUrl: z.string().url().max(2000).optional(),
});

/** Un retour n'est suivi que vers un produit IDEM (sinon iDomain serait un relais de redirection ouvert). */
export function isTrustedReturnUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return false;
    return env.returnHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function createDomainSession(ownerUid: string, input: z.infer<typeof domainSessionInput>) {
  if (input.returnUrl && !isTrustedReturnUrl(input.returnUrl)) throw new HttpError(422, 'untrusted_return_url', 'Adresse de retour refusée.');
  const app = await hosting.target(ownerUid, input.appUuid);
  const row = await one<{ id: string; expires_at: Date }>(
    `INSERT INTO domain_sessions (owner_uid, source, app_uuid, app_name, environment, return_url, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + interval '24 hours') RETURNING id, expires_at`,
    [ownerUid, input.source, app.uuid, app.name, input.environment, input.returnUrl ?? null]
  );
  return { id: row!.id, expiresAt: row!.expires_at, url: `${env.webUrl}/connect?session=${row!.id}`, app: { uuid: app.uuid, name: app.name, domains: app.domains } };
}

export async function getDomainSession(ownerUid: string, id: string) {
  const row = await one<{ id: string; source: string; app_uuid: string; app_name: string | null; environment: string; return_url: string | null; expires_at: Date }>(
    `SELECT id, source, app_uuid, app_name, environment, return_url, expires_at FROM domain_sessions WHERE id = $1 AND owner_uid = $2 AND expires_at > now()`,
    [id, ownerUid]
  );
  if (!row) throw new HttpError(404, 'domain_session_not_found', 'Ce parcours a expiré. Revenez depuis votre application.');
  return { id: row.id, source: row.source, appUuid: row.app_uuid, appName: row.app_name, environment: row.environment, returnUrl: row.return_url, expiresAt: row.expires_at };
}
