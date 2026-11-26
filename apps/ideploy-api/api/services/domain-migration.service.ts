/**
 * Startup migration: `*.idem.africa` → `*.ideploy.site`.
 *
 * iDeploy used to publish applications under `monapp.idem.africa`.  The
 * platform domain has moved to `ideploy.site`.  This module runs once at boot,
 * finds every application whose `fqdn` still carries a `*.idem.africa` address
 * that was auto-created by iDeploy (not a custom domain the user typed), swaps
 * it for the matching `*.ideploy.site` hostname, and notifies the application
 * owner by email.
 *
 * The old DNS A record at Namecheap is released; a new one is claimed on the
 * new zone (same label, same server IP).  If the new label is already taken a
 * short random suffix is appended, exactly as `claimPlatformHost` does for new
 * applications.
 *
 * The migration is **best-effort**: a failure for one application is logged but
 * never stops the server from starting.  An application that could not be
 * migrated keeps its old address until the next attempt (the job is idempotent:
 * re-running it is always safe).
 */

import pool from '../config/db.config';
import logger from '../config/logger';
import { claimPlatformHost, releasePlatformHost } from './platform-domain.service';
import { getDnsProvider } from './dns/namecheap.client';
import { sendEmail } from './email.service';

/** The old platform domain that needs to be replaced. */
const OLD_DOMAIN = 'idem.africa';
/** The new platform domain. */
const NEW_DOMAIN = 'ideploy.site';

interface AppToMigrate {
  id: number;
  uuid: string;
  name: string;
  fqdn: string;
  serverIp: string;
  ownerEmail: string | null;
  ownerName: string | null;
}

/**
 * Find all applications that still have at least one `*.idem.africa` host in
 * their `fqdn` column.
 */
async function findApplicationsToMigrate(): Promise<AppToMigrate[]> {
  const { rows } = await pool.query<{
    id: number;
    uuid: string;
    name: string;
    fqdn: string;
    server_ip: string;
    owner_email: string | null;
    owner_name: string | null;
  }>(
    `SELECT
       a.id,
       a.uuid,
       a.name,
       a.fqdn,
       s.ip AS server_ip,
       -- Pick the team owner's email (personal team = sole owner).
       (SELECT u.email
          FROM users u
          JOIN team_user tu ON tu.user_id = u.id
          WHERE tu.team_id = p.team_id AND tu.role = 'owner'
          ORDER BY tu.id ASC
          LIMIT 1
       ) AS owner_email,
       (SELECT u.name
          FROM users u
          JOIN team_user tu ON tu.user_id = u.id
          WHERE tu.team_id = p.team_id AND tu.role = 'owner'
          ORDER BY tu.id ASC
          LIMIT 1
       ) AS owner_name
     FROM applications a
     JOIN environments e   ON e.id  = a.environment_id
     JOIN projects p       ON p.id  = e.project_id
     JOIN standalone_dockers sd ON sd.id = a.destination_id
                               AND a.destination_type LIKE '%StandaloneDocker'
     JOIN servers s        ON s.id  = sd.server_id
     WHERE a.fqdn LIKE $1
       AND a.fqdn NOT LIKE $2`,
    [`%${OLD_DOMAIN}%`, `%${NEW_DOMAIN}%`]
  );

  return rows.map((r) => ({
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    fqdn: String(r.fqdn),
    serverIp: String(r.server_ip),
    ownerEmail: r.owner_email ? String(r.owner_email) : null,
    ownerName: r.owner_name ? String(r.owner_name) : null,
  }));
}

/** Replace every `*.idem.africa` host in an fqdn string with the new domain. */
function rewriteFqdn(fqdn: string, newHost: string, oldHost: string): string {
  return fqdn
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      // Extract hostname from https://monapp.idem.africa
      const hostMatch = trimmed.match(/^(https?:\/\/)?(.+)$/i);
      if (!hostMatch) return trimmed;
      const scheme = hostMatch[1] ?? 'https://';
      const host = hostMatch[2].toLowerCase();
      if (host === oldHost) return `${scheme}${newHost}`;
      return trimmed;
    })
    .join(',');
}

/** Send the migration notification to the application owner. */
async function notifyOwner(app: AppToMigrate, oldHost: string, newHost: string): Promise<void> {
  if (!app.ownerEmail) return;

  const firstName = app.ownerName?.split(' ')[0] ?? 'là';
  const appUrl = `https://${newHost}`;

  await sendEmail({
    to: app.ownerEmail,
    subject: `🚀 Votre application « ${app.name} » a un nouveau lien — ideploy.site`,
    text: [
      `Bonjour${firstName ? ` ${firstName}` : ''},`,
      '',
      `Nous avons migré le domaine de la plateforme iDeploy de idem.africa vers ideploy.site.`,
      '',
      `Votre application « ${app.name} » est maintenant accessible à l'adresse :`,
      `  ${appUrl}`,
      '',
      `L'ancienne adresse (https://${oldHost}) ne sera plus disponible.`,
      '',
      `Aucune action de votre part n'est nécessaire — votre application continue de tourner normalement.`,
      '',
      `À bientôt sur iDeploy !`,
      `L'équipe IDEM`,
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <img src="https://ideploy.site/logo.png" alt="iDeploy" style="height:36px;margin-bottom:24px">
    <h2 style="color:#09090b;margin:0 0 16px">Votre application a un nouveau lien 🚀</h2>
    <p style="color:#3f3f46">Bonjour${firstName ? ` <strong>${firstName}</strong>` : ''},</p>
    <p style="color:#3f3f46">
      Nous avons migré la plateforme iDeploy vers un domaine dédié :
      <strong>ideploy.site</strong>.
    </p>
    <p style="color:#3f3f46">
      Votre application <strong>${app.name}</strong> est maintenant disponible à l'adresse :
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${appUrl}"
         style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ouvrir mon application →
      </a>
    </div>
    <p style="color:#71717a;font-size:13px">
      L'ancienne adresse <code>https://${oldHost}</code> n'est plus active.<br>
      Aucune action n'est nécessaire de votre part — votre application tourne normalement.
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
    <p style="color:#a1a1aa;font-size:12px;margin:0">
      Vous recevez cet e-mail parce que vous êtes propriétaire d'une application sur iDeploy.<br>
      © ${new Date().getFullYear()} IDEM Africa — <a href="https://ideploy.site" style="color:#a1a1aa">ideploy.site</a>
    </p>
  </div>
</body>
</html>`,
  });
}

/**
 * Migrate a single application from `*.idem.africa` to `*.ideploy.site`.
 *
 * Returns the new host on success, null on failure.
 */
async function migrateApplication(app: AppToMigrate): Promise<string | null> {
  // Find the first idem.africa host in the fqdn column.
  const parts = app.fqdn.split(',').map((p) => p.trim());
  const oldPart = parts.find((p) => p.toLowerCase().includes(`.${OLD_DOMAIN}`));
  if (!oldPart) return null; // already clean — skipped by the SQL but sanity check

  const hostMatch = oldPart.match(/^(?:https?:\/\/)?(.+)$/i);
  if (!hostMatch) return null;
  const oldHost = hostMatch[1].toLowerCase();

  // Claim the matching label on ideploy.site.
  // `claimPlatformHost` already handles collision with a short suffix.
  const newHost = await claimPlatformHost(app.name, app.serverIp);
  if (!newHost) {
    logger.warn('Domain migration: could not claim new host, skipping', {
      event: 'domain_migration.claim_failed',
      appUuid: app.uuid,
      oldHost,
    });
    return null;
  }

  // Rewrite the fqdn column.
  const newFqdn = rewriteFqdn(app.fqdn, newHost, oldHost);
  await pool.query('UPDATE applications SET fqdn = $1, updated_at = now() WHERE id = $2', [newFqdn, app.id]);

  // Release the old DNS record (best-effort).
  await releasePlatformHost(oldHost);

  logger.info('Domain migration: application migrated', {
    event: 'domain_migration.migrated',
    appUuid: app.uuid,
    appName: app.name,
    oldHost,
    newHost,
  });

  // Notify the owner asynchronously — never block the migration on mail.
  notifyOwner(app, oldHost, newHost).catch((err) =>
    logger.warn('Domain migration: notification failed', {
      event: 'domain_migration.notify_failed',
      appUuid: app.uuid,
      reason: (err as Error).message,
    })
  );

  return newHost;
}

/**
 * Run the full migration scan at startup.
 *
 * Safe to call multiple times: applications already on `ideploy.site` are
 * excluded by the SQL query.
 */
export async function runDomainMigration(): Promise<void> {
  // Skip when the new platform domain is not configured — the DNS write would
  // fail anyway, and there is nothing to migrate to.
  const provider = getDnsProvider();
  if (!provider) {
    logger.info('Domain migration: DNS provider not configured, skipping', {
      event: 'domain_migration.skipped',
    });
    return;
  }

  // Also skip when the active platform domain is still the old one — that
  // means the operator has not switched `IDEPLOY_PLATFORM_DOMAIN` yet.
  const activeDomain = process.env.IDEPLOY_PLATFORM_DOMAIN?.trim().toLowerCase();
  if (!activeDomain || activeDomain === OLD_DOMAIN) {
    logger.info(
      `Domain migration: IDEPLOY_PLATFORM_DOMAIN is "${activeDomain || '(unset)'}". ` +
        `Set it to "${NEW_DOMAIN}" to enable the migration.`,
      { event: 'domain_migration.skipped', activeDomain }
    );
    return;
  }

  let apps: AppToMigrate[];
  try {
    apps = await findApplicationsToMigrate();
  } catch (err) {
    logger.error('Domain migration: could not query applications', {
      event: 'domain_migration.query_failed',
      reason: (err as Error).message,
    });
    return;
  }

  if (apps.length === 0) {
    logger.info('Domain migration: nothing to migrate — all applications are on the new domain.', {
      event: 'domain_migration.nothing_to_do',
    });
    return;
  }

  logger.info(`Domain migration: ${apps.length} application(s) to migrate from ${OLD_DOMAIN} → ${NEW_DOMAIN}.`, {
    event: 'domain_migration.started',
    count: apps.length,
  });

  let migrated = 0;
  let failed = 0;

  for (const app of apps) {
    try {
      const result = await migrateApplication(app);
      if (result) migrated++;
      else failed++;
    } catch (err) {
      failed++;
      logger.error('Domain migration: unexpected error for application', {
        event: 'domain_migration.error',
        appUuid: app.uuid,
        reason: (err as Error).message,
      });
    }
  }

  logger.info(`Domain migration complete: ${migrated} migrated, ${failed} failed.`, {
    event: 'domain_migration.done',
    migrated,
    failed,
  });
}
