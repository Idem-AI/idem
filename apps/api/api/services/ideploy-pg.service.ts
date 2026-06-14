// @ts-nocheck
import pool from '../config/ideploy-pg.config';
import logger from '../config/logger';
import type { IDeploySummary } from './ideploy.service';

/**
 * Résout la team principale d'un utilisateur à partir de son email.
 * Priorité : personal_team=true, sinon la première team trouvée.
 */
async function getTeamIdByEmail(email: string): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    `SELECT t.id
     FROM teams t
     JOIN team_user tu ON tu.team_id = t.id
     JOIN users u      ON u.id = tu.user_id
     WHERE u.email = $1
     ORDER BY t.personal_team DESC
     LIMIT 1`,
    [email]
  );
  return result.rows[0]?.id ?? null;
}

/**
 * Retourne le résumé complet des ressources iDeploy pour un utilisateur donné
 * en interrogeant directement la base PostgreSQL d'iDeploy (lecture seule).
 */
export async function getIDeploySummaryForUser(email: string): Promise<IDeploySummary> {
  const teamId = await getTeamIdByEmail(email);

  if (!teamId) {
    logger.warn('iDeploy: no team found for user', { email });
    return emptySummary();
  }

  const [applications, databases, services, servers, projects] = await Promise.all([
    fetchApplications(teamId),
    fetchDatabases(teamId),
    fetchServices(teamId),
    fetchServers(teamId),
    fetchProjects(teamId),
  ]);

  // Cast DB rows to the expected interface shapes (fields match the SQL SELECT columns)
  return {
    applications: applications as unknown as IDeploySummary['applications'],
    databases:    databases    as unknown as IDeploySummary['databases'],
    services:     services     as unknown as IDeploySummary['services'],
    servers:      servers      as unknown as IDeploySummary['servers'],
    projects:     projects     as unknown as IDeploySummary['projects'],
    stats: {
      totalApplications:   applications.length,
      totalDatabases:      databases.length,
      totalServices:       services.length,
      totalServers:        servers.length,
      totalProjects:       projects.length,
      runningApplications: applications.filter((a) => (a.status as string)?.toLowerCase().startsWith('running')).length,
    },
  };
}

async function fetchApplications(teamId: number): Promise<Row[]> {
  const { rows } = await pool.query(
    `SELECT a.uuid, a.name, a.status, a.fqdn,
            a.git_repository, a.git_branch, a.build_pack,
            a.environment_id, a.last_online_at,
            a.created_at, a.updated_at
     FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects     p ON p.id = e.project_id
     WHERE p.team_id = $1
     ORDER BY a.updated_at DESC`,
    [teamId]
  );
  return rows;
}

async function fetchDatabases(teamId: number): Promise<Row[]> {
  const tables: Array<{ table: string; type: string }> = [
    { table: 'standalone_postgresqls', type: 'postgresql' },
    { table: 'standalone_mysqls',      type: 'mysql'      },
    { table: 'standalone_mariadbs',    type: 'mariadb'    },
    { table: 'standalone_redis',       type: 'redis'      },
    { table: 'standalone_mongodbs',    type: 'mongodb'    },
    { table: 'standalone_keydbs',      type: 'keydb'      },
    { table: 'standalone_dragonflies', type: 'dragonfly'  },
    { table: 'standalone_clickhouses', type: 'clickhouse' },
  ];

  const results = await Promise.all(
    tables.map(async ({ table, type }) => {
      try {
        const { rows } = await pool.query(
          `SELECT d.uuid, d.name, d.status, d.environment_id,
                  d.created_at, d.updated_at, $2::text as type
           FROM ${table} d
           JOIN environments e ON e.id = d.environment_id
           JOIN projects     p ON p.id = e.project_id
           WHERE p.team_id = $1`,
          [teamId, type]
        );
        return rows;
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

async function fetchServices(teamId: number): Promise<Row[]> {
  const { rows } = await pool.query(
    `SELECT s.uuid, s.name, s.status, s.environment_id,
            s.created_at, s.updated_at
     FROM services s
     JOIN environments e ON e.id = s.environment_id
     JOIN projects     p ON p.id = e.project_id
     WHERE p.team_id = $1`,
    [teamId]
  );
  return rows;
}

async function fetchServers(teamId: number): Promise<Row[]> {
  const { rows } = await pool.query(
    `SELECT s.uuid, s.name, s.ip, s.created_at, s.updated_at
     FROM servers s
     WHERE s.team_id = $1`,
    [teamId]
  );
  return rows;
}

async function fetchProjects(teamId: number): Promise<Row[]> {
  const { rows } = await pool.query(
    `SELECT uuid, name, description, created_at, updated_at
     FROM projects
     WHERE team_id = $1
     ORDER BY updated_at DESC`,
    [teamId]
  );
  return rows;
}

function emptySummary(): IDeploySummary {
  return {
    applications: [],
    databases:    [],
    services:     [],
    servers:      [],
    projects:     [],
    stats: {
      totalApplications:   0,
      totalDatabases:      0,
      totalServices:       0,
      totalServers:        0,
      totalProjects:       0,
      runningApplications: 0,
    },
  };
}

/**
 * Vérifie que la connexion à la BD iDeploy est opérationnelle.
 */
export async function checkIDeployPgConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
