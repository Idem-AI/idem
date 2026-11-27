/**
 * Projets IDEM partagés : un membre de l'équipe d'un projet ouvre, dans
 * iDeploy, les applications de ce projet — et elles seules.
 *
 * La vérité vit dans IDEM (équipe du projet, espace « Mise en ligne ») ; IDEM
 * l'écrit dans `idem_project_shares` (voir la migration). Ici, on la lit :
 *
 *   - `sharesOf(uid)`            les projets partagés avec ce compte, par équipe ;
 *   - `scopeFor(uid, teamId)`    les applications ouvertes dans l'équipe d'un autre,
 *                                avec leur niveau (`read` voir, `write` agir) ;
 *   - `scopeAllows(...)`         la route est-elle permise à un membre restreint ?
 *
 * Tout ce qui n'est pas une application partagée (serveurs, bases, réglages,
 * équipe, abonnement…) reste fermé au membre : c'est l'espace du propriétaire.
 */
import pool from '../config/db.config';

export type ShareLevel = 'read' | 'write';

export interface IdemScope {
  /** Équipe du propriétaire, dans laquelle le membre agit. */
  teamId: number;
  /** uuid d'application → niveau. */
  apps: Map<string, ShareLevel>;
}

export interface SharedProject {
  idemProjectId: string;
  projectName: string;
  ownerTeamId: number;
  ownerName: string;
  level: ShareLevel;
  applicationUuids: string[];
}

interface ShareRow {
  idem_project_id: string;
  project_name: string;
  owner_team_id: string | number;
  owner_name: string;
  level: ShareLevel;
  application_uuids: string[] | null;
}

export async function sharesOf(idemUid: string | null | undefined): Promise<SharedProject[]> {
  if (!idemUid) return [];
  try {
    const { rows } = await pool.query(
      `SELECT idem_project_id, project_name, owner_team_id, owner_name, level, application_uuids
         FROM idem_project_shares WHERE member_idem_uid = $1 ORDER BY project_name ASC`,
      [idemUid]
    );
    return (rows as unknown as ShareRow[]).map((row) => ({
      idemProjectId: row.idem_project_id,
      projectName: row.project_name,
      ownerTeamId: Number(row.owner_team_id),
      ownerName: row.owner_name,
      level: row.level === 'write' ? 'write' : 'read',
      applicationUuids: row.application_uuids ?? [],
    }));
  } catch {
    // Table absente (migration pas encore passée) : aucun partage.
    return [];
  }
}

/** Les applications ouvertes à ce compte dans l'équipe `teamId`, ou `null` s'il n'y a rien. */
export async function scopeFor(idemUid: string | null | undefined, teamId: number): Promise<IdemScope | null> {
  const shares = (await sharesOf(idemUid)).filter((share) => share.ownerTeamId === teamId);
  if (shares.length === 0) return null;
  const apps = new Map<string, ShareLevel>();
  for (const share of shares) {
    for (const uuid of share.applicationUuids) {
      // Deux projets partagent la même application : le niveau le plus large gagne.
      if (apps.get(uuid) !== 'write') apps.set(uuid, share.level);
    }
  }
  return { teamId, apps };
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Actions réservées au propriétaire, même avec « Modifier » : supprimer, exécuter dans le conteneur. */
const OWNER_ONLY = [/^DELETE \/api\/v1\/applications\/[^/]+$/, /\/exec$/, /\/terminal/];

/**
 * La route est-elle permise à un membre restreint à `scope` ?
 * `path` est l'adresse complète, sans la chaîne de requête.
 */
export function scopeAllows(method: string, path: string, body: unknown, scope: IdemScope): boolean {
  const verb = method.toUpperCase();
  const read = READ_METHODS.has(verb);
  const clean = path.replace(/\/+$/, '');

  // Ce que l'interface lit pour se dessiner : la liste (filtrée), l'équipe et ses partages.
  if (read && (clean === '/api/v1/applications' || clean === '/api/v1/team' || clean === '/api/v1/team/shared' || clean === '/api/v1/version')) {
    return true;
  }
  if (OWNER_ONLY.some((rule) => rule.test(`${verb} ${clean}`) || rule.test(clean))) return false;

  // Une application précise, et tout ce qui la concerne (domaine, journaux, pare-feu, pipeline…).
  const app = clean.match(/^\/api\/v1\/applications\/([^/]+)/);
  if (app) {
    const level = scope.apps.get(app[1]);
    if (!level) return false;
    return read || level === 'write';
  }

  // Déclencher un déploiement : l'application vient dans le corps.
  if (clean === '/api/v1/deploy' && verb === 'POST') {
    const uuid = (body as { uuid?: unknown } | undefined)?.uuid;
    return typeof uuid === 'string' && scope.apps.get(uuid) === 'write';
  }
  if (read && /^\/api\/v1\/deploy\/[^/]+$/.test(clean)) return true;

  return false;
}
