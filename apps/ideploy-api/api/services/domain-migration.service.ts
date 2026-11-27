/**
 * Startup migration: `monapp.idem.africa` → `monapp.ideploy.site`.
 *
 * iDeploy used to give applications their free address under `idem.africa`.
 * It now gives them `ideploy.site` (see config/platform-domain.config.ts). At
 * every start this job looks for applications still answering at a
 * `<name>.idem.africa` address, and moves each one:
 *
 *   1. the same name is claimed on ideploy.site (`buni.idem.africa` →
 *      `buni.ideploy.site`); a short id is added only if it is taken;
 *   2. the new address takes the old one's place in `fqdn` (first stays first);
 *   3. the proxy is told now when the application's routes allow it,
 *      otherwise a deployment is started — never "at the next deploy";
 *   4. the old record is removed from the idem.africa zone;
 *   5. each owner gets one email listing their applications' new links.
 *
 * Then a report goes to beta@idem.africa: moved, failed, or nothing to do
 * ("migration déjà effectuée"), with each application's links and owner.
 *
 * The first version (6d10fd36a) never ran in production: it waited for
 * `IDEPLOY_PLATFORM_DOMAIN` to be changed in the `.env`, which nobody did, and
 * it rewrote `fqdn` without telling the proxy. It also said nothing when it
 * did nothing.
 *
 * Best-effort and idempotent: a failure for one application is reported and
 * retried at the next start; the server always starts.
 */
import { randomBytes } from 'crypto';
import pool from '../config/db.config';
import logger from '../config/logger';
import redis from '../config/redis.config';
import { LEGACY_PLATFORM_DOMAIN, PLATFORM_DOMAIN } from '../config/platform-domain.config';
import { RESERVED_LABELS, claimPlatformHost, releasePlatformHost } from './platform-domain.service';
import { getDnsProvider, getLegacyDnsProvider } from './dns/namecheap.client';
import { getServerForDestination } from './domain.service';
import { EmailPayload, sendEmail } from './email.service';

/** Where the report goes. A fixed address of the team, not a setting. */
export const MIGRATION_REPORT_TO = 'beta@idem.africa';

/** Several processes start together (API, workers): one of them runs the migration. */
const RUN_LOCK_KEY = 'ideploy:domain-migration:run';
const RUN_LOCK_TTL_MS = 10 * 60 * 1000;

export interface AppToMigrate {
  id: number;
  uuid: string;
  name: string;
  fqdn: string;
  teamId: number;
  destinationId: number | null;
  status: string | null;
  routesFileAt: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  /** The `idem.africa` address to move, e.g. `buni.idem.africa`. */
  oldHost: string;
}

export type MigrationOutcome =
  | { status: 'migrated'; newHost: string; applied: 'routed' | 'redeploying' | 'next_start' }
  | { status: 'failed'; reason: string };

export interface MigrationEntry {
  app: AppToMigrate;
  outcome: MigrationOutcome;
  ownerNotified: boolean;
}

export interface MigrationReport {
  state: 'nothing_to_do' | 'succeeded' | 'partial' | 'failed';
  entries: MigrationEntry[];
  /** Set when the migration could not even start (Namecheap not configured, database unreadable). */
  blocker?: string;
}

const LEGACY_HOST = new RegExp(`^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\\.${LEGACY_PLATFORM_DOMAIN.replace('.', '\\.')}$`);

/** Bare host of one `fqdn` entry. */
const hostOf = (part: string) => part.trim().replace(/^https?:\/\//i, '').replace(/[/:].*$/, '').toLowerCase();

/**
 * The address iDeploy gave this application under idem.africa, if any: one
 * label (`buni.idem.africa`, never `www.buni.idem.africa`, which a user typed),
 * outside IDEM's own names (`console`, `api`…).
 */
export function legacyHostOf(fqdn: string): string | null {
  for (const part of fqdn.split(',')) {
    const host = hostOf(part);
    const label = LEGACY_HOST.exec(host)?.[1];
    if (label && !RESERVED_LABELS.has(label)) return host;
  }
  return null;
}

/** `fqdn` with `oldHost` replaced by `newHost`, at the same place, scheme and path kept. */
export function rewriteFqdn(fqdn: string, oldHost: string, newHost: string): string {
  const parts = fqdn
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const already = parts.some((part) => hostOf(part) === newHost);
  return parts
    .flatMap((part) => {
      if (hostOf(part) !== oldHost) return [part];
      if (already) return [];
      const scheme = /^http:\/\//i.test(part) ? 'http://' : 'https://';
      const rest = part.replace(/^https?:\/\//i, '').slice(oldHost.length);
      return [`${scheme}${newHost}${rest}`];
    })
    .join(',');
}

/** Applications still answering at a `<name>.idem.africa` address, with their owner. */
export async function findApplicationsToMigrate(): Promise<AppToMigrate[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.uuid, a.name, a.fqdn, a.destination_id, a.status, a.routes_file_at, p.team_id,
            owner.email AS owner_email, owner.name AS owner_name
       FROM applications a
       JOIN environments e ON e.id = a.environment_id
       JOIN projects p     ON p.id = e.project_id
       LEFT JOIN LATERAL (
         SELECT u.email, u.name FROM users u
           JOIN team_user tu ON tu.user_id = u.id
          WHERE tu.team_id = p.team_id
          ORDER BY (tu.role = 'owner') DESC, tu.id ASC
          LIMIT 1
       ) owner ON true
      WHERE a.fqdn ILIKE $1
      ORDER BY a.id ASC`,
    [`%.${LEGACY_PLATFORM_DOMAIN}%`]
  );
  return rows.flatMap((r) => {
    const oldHost = legacyHostOf(String(r.fqdn ?? ''));
    if (!oldHost) return [];
    return [
      {
        id: Number(r.id),
        uuid: String(r.uuid),
        name: String(r.name),
        fqdn: String(r.fqdn),
        teamId: Number(r.team_id),
        destinationId: r.destination_id === null ? null : Number(r.destination_id),
        status: r.status ? String(r.status) : null,
        routesFileAt: r.routes_file_at ? String(r.routes_file_at) : null,
        ownerEmail: r.owner_email ? String(r.owner_email) : null,
        ownerName: r.owner_name && String(r.owner_name) !== 'Anonymous' ? String(r.owner_name) : null,
        oldHost,
      },
    ];
  });
}

/** The proxy serves the new address now, or a deployment is started to do it. */
async function applyNewAddress(app: AppToMigrate): Promise<'routed' | 'redeploying' | 'next_start'> {
  const { applyDomainsLive } = await import('./domain-options.service');
  const live = await applyDomainsLive(app.teamId, app.uuid).catch((err) => {
    logger.warn('Domain migration: routes not applied live', { event: 'domain_migration.routes_failed', appUuid: app.uuid, reason: (err as Error).message });
    return { applied: false as const };
  });
  if (live.applied) return 'routed';
  // A stopped application is served again at its next start, with the new address.
  if (!app.status || app.status === 'exited') return 'next_start';
  const appService = await import('./application.service');
  const deploymentService = await import('./deployment.service');
  const fresh = await appService.getApplicationById(app.id);
  if (!fresh) return 'next_start';
  await deploymentService.createDeployment(fresh, app.teamId, {});
  return 'redeploying';
}

/** Move one application. Never throws. */
export async function migrateApplication(app: AppToMigrate): Promise<MigrationOutcome> {
  try {
    const server = app.destinationId ? await getServerForDestination(app.destinationId) : null;
    if (!server) return { status: 'failed', reason: 'Aucun serveur rattaché à l’application.' };

    const label = app.oldHost.slice(0, -(LEGACY_PLATFORM_DOMAIN.length + 1));
    const newHost = await claimPlatformHost(app.name, server.ip, { label, excludeApplicationId: app.id });
    if (!newHost) return { status: 'failed', reason: `L’adresse ${label}.${PLATFORM_DOMAIN} n’a pas pu être créée chez Namecheap.` };

    const newFqdn = rewriteFqdn(app.fqdn, app.oldHost, newHost);
    // Only if nobody changed the addresses meanwhile: otherwise the next start tries again.
    const { rowCount } = await pool.query('UPDATE applications SET fqdn = $1, updated_at = now() WHERE id = $2 AND fqdn = $3', [newFqdn, app.id, app.fqdn]);
    if (!rowCount) {
      await releasePlatformHost(newHost);
      return { status: 'failed', reason: 'Les adresses de l’application ont changé pendant la migration ; nouvel essai au prochain démarrage.' };
    }

    const applied = await applyNewAddress(app).catch((err) => {
      logger.warn('Domain migration: new address not applied', { event: 'domain_migration.apply_failed', appUuid: app.uuid, reason: (err as Error).message });
      return 'next_start' as const;
    });
    // The old record goes: users' applications do not stay under idem.africa.
    await releasePlatformHost(app.oldHost, getLegacyDnsProvider());

    logger.info('Domain migration: application migrated', {
      event: 'domain_migration.migrated',
      appUuid: app.uuid,
      oldHost: app.oldHost,
      newHost,
      applied,
    });
    return { status: 'migrated', newHost, applied };
  } catch (err) {
    logger.error('Domain migration: application not migrated', { event: 'domain_migration.error', appUuid: app.uuid, reason: (err as Error).message });
    return { status: 'failed', reason: (err as Error).message };
  }
}

// ── Emails ──────────────────────────────────────────────────────────────────

const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || '';

/** One email per owner, listing every application of theirs that moved. */
export function ownerEmail(to: string, ownerName: string | null, moved: { app: AppToMigrate; newHost: string }[]): EmailPayload {
  const hello = firstName(ownerName) ? `Bonjour ${firstName(ownerName)},` : 'Bonjour,';
  const several = moved.length > 1;
  const intro = several
    ? `Les adresses gratuites des applications iDeploy passent de idem.africa à ideploy.site. Vos ${moved.length} applications ont été déplacées, en gardant leur nom :`
    : `Les adresses gratuites des applications iDeploy passent de idem.africa à ideploy.site. Votre application « ${moved[0].app.name} » a été déplacée, en gardant son nom :`;
  const lines = moved.map(({ app, newHost }) => `« ${app.name} » : https://${newHost} (avant : https://${app.oldHost})`);
  const outro = [
    'Votre application continue de tourner normalement, rien n’est à faire de votre côté.',
    'L’ancienne adresse ne répond plus : pensez à mettre à jour les liens que vous avez partagés (réseaux sociaux, cartes de visite, affiches).',
    'Pour une adresse bien à vous (monentreprise.com), ouvrez l’onglet « Nom de domaine » de votre application dans iDeploy.',
  ];
  const subject = several ? 'Vos applications ont une nouvelle adresse sur ideploy.site' : `« ${moved[0].app.name} » a une nouvelle adresse : ${moved[0].newHost}`;
  return {
    to,
    subject,
    template: 'ideploy.domain_migration',
    text: [hello, '', intro, ...lines.map((l) => `  ${l}`), '', ...outro, '', 'L’équipe IDEM'].join('\n'),
    html: `<p>${[hello, intro, ...lines, ...outro].map(escapeHtml).join('</p><p>')}</p>`,
    layout: {
      title: several ? 'Vos applications ont une nouvelle adresse' : 'Votre application a une nouvelle adresse',
      subtitle: 'idem.africa → ideploy.site',
      preheader: moved.map((m) => m.newHost).join(', '),
      paragraphs: [hello, intro],
      panels: moved.map(({ app, newHost }) => ({
        title: app.name,
        rows: [
          { label: 'Nouvelle adresse', value: `https://${newHost}` },
          { label: 'Ancienne adresse', value: `https://${app.oldHost}` },
        ],
      })),
      cta: { label: several ? 'Ouvrir ma première application' : 'Ouvrir mon application', url: `https://${moved[0].newHost}` },
      footerNote: outro.join(' '),
    },
  };
}

const APPLIED_TEXT = { routed: 'en ligne', redeploying: 'redéploiement lancé', next_start: 'au prochain démarrage (arrêtée)' } as const;

/** The report to the team: what moved, what did not, who owns what. */
export function reportEmail(report: MigrationReport): EmailPayload {
  const migrated = report.entries.filter((e) => e.outcome.status === 'migrated');
  const failed = report.entries.filter((e) => e.outcome.status === 'failed');
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });

  const subject =
    report.state === 'nothing_to_do'
      ? '[iDeploy] Migration des domaines : déjà effectuée'
      : report.state === 'succeeded'
        ? `[iDeploy] Migration des domaines réussie : ${migrated.length} application(s) sur ${PLATFORM_DOMAIN}`
        : report.state === 'partial'
          ? `[iDeploy] Migration des domaines : ${migrated.length} réussie(s), ${failed.length} en échec`
          : `[iDeploy] Migration des domaines échouée${failed.length ? ` : ${failed.length} application(s)` : ''}`;

  const summary =
    report.state === 'nothing_to_do'
      ? `Aucune application n’est plus sur ${LEGACY_PLATFORM_DOMAIN}. La migration vers ${PLATFORM_DOMAIN} a déjà été effectuée : rien n’a été modifié.`
      : report.blocker
        ? `La migration n’a pas pu démarrer : ${report.blocker}`
        : `${migrated.length} application(s) déplacée(s) de ${LEGACY_PLATFORM_DOMAIN} vers ${PLATFORM_DOMAIN}, ${failed.length} en échec. Les applications en échec seront retentées au prochain démarrage.`;

  const owner = (e: MigrationEntry) =>
    e.app.ownerName || e.app.ownerEmail ? `${e.app.ownerName ?? '—'}${e.app.ownerEmail ? ` <${e.app.ownerEmail}>` : ''}` : 'propriétaire introuvable';
  const rowsOf = (e: MigrationEntry) =>
    e.outcome.status === 'migrated'
      ? [
          { label: 'Utilisateur', value: owner(e) },
          { label: 'Nouvelle adresse', value: `https://${e.outcome.newHost}` },
          { label: 'Ancienne adresse', value: `https://${e.app.oldHost}` },
          { label: 'Mise en service', value: APPLIED_TEXT[e.outcome.applied] },
          { label: 'E-mail au propriétaire', value: e.ownerNotified ? 'envoyé' : 'non envoyé' },
        ]
      : [
          { label: 'Utilisateur', value: owner(e) },
          { label: 'Adresse actuelle', value: `https://${e.app.oldHost}` },
          { label: 'Cause', value: e.outcome.reason },
        ];

  const textLines = report.entries.map((e) =>
    e.outcome.status === 'migrated'
      ? `✔ ${e.app.name} — ${owner(e)} — https://${e.outcome.newHost} (avant https://${e.app.oldHost}, ${APPLIED_TEXT[e.outcome.applied]})`
      : `✘ ${e.app.name} — ${owner(e)} — https://${e.app.oldHost} — ${e.outcome.reason}`
  );

  return {
    to: MIGRATION_REPORT_TO,
    subject,
    template: 'ideploy.domain_migration_report',
    text: [summary, `Démarrage du ${date}.`, '', ...textLines].join('\n'),
    html: `<p>${[summary, `Démarrage du ${date}.`, ...textLines].map(escapeHtml).join('</p><p>')}</p>`,
    layout: {
      title: 'Migration des domaines iDeploy',
      subtitle: `${LEGACY_PLATFORM_DOMAIN} → ${PLATFORM_DOMAIN}`,
      preheader: summary,
      paragraphs: [summary, `Démarrage de l’API iDeploy du ${date}.`],
      panels: [
        ...migrated.map((e) => ({ title: `✔ ${e.app.name}`, rows: rowsOf(e) })),
        ...failed.map((e) => ({ title: `✘ ${e.app.name}`, rows: rowsOf(e) })),
      ],
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Run ─────────────────────────────────────────────────────────────────────

/** Move every application still under idem.africa, email the owners. Returns what happened. */
export async function migrateAll(): Promise<MigrationReport> {
  let apps: AppToMigrate[];
  try {
    apps = await findApplicationsToMigrate();
  } catch (err) {
    return { state: 'failed', entries: [], blocker: `la base iDeploy n’a pas pu être lue (${(err as Error).message}).` };
  }
  if (apps.length === 0) return { state: 'nothing_to_do', entries: [] };

  if (!getDnsProvider()) {
    return {
      state: 'failed',
      entries: apps.map((app) => ({ app, outcome: { status: 'failed', reason: 'Compte Namecheap non configuré (NAMECHEAP_*).' }, ownerNotified: false })),
      blocker: `le compte Namecheap n’est pas configuré (NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_CLIENT_IP) : ${apps.length} application(s) restent sur ${LEGACY_PLATFORM_DOMAIN}.`,
    };
  }

  logger.info(`Domain migration: ${apps.length} application(s) to move to ${PLATFORM_DOMAIN}`, { event: 'domain_migration.started', count: apps.length });
  const entries: MigrationEntry[] = [];
  // One after the other: every write rewrites a whole Namecheap zone, under one lock.
  for (const app of apps) entries.push({ app, outcome: await migrateApplication(app), ownerNotified: false });

  // One email per owner, for all their applications.
  const byOwner = new Map<string, MigrationEntry[]>();
  for (const entry of entries) {
    if (entry.outcome.status !== 'migrated' || !entry.app.ownerEmail) continue;
    const key = entry.app.ownerEmail.toLowerCase();
    byOwner.set(key, [...(byOwner.get(key) ?? []), entry]);
  }
  for (const group of byOwner.values()) {
    const moved = group.map((e) => ({ app: e.app, newHost: (e.outcome as { newHost: string }).newHost }));
    const sent = await sendEmail(ownerEmail(group[0].app.ownerEmail as string, group[0].app.ownerName, moved));
    for (const e of group) e.ownerNotified = sent;
  }

  const migrated = entries.filter((e) => e.outcome.status === 'migrated').length;
  const state = migrated === entries.length ? 'succeeded' : migrated === 0 ? 'failed' : 'partial';
  logger.info(`Domain migration done: ${migrated} moved, ${entries.length - migrated} failed`, {
    event: 'domain_migration.done',
    migrated,
    failed: entries.length - migrated,
    ...(state !== 'succeeded' ? { alert: 'critical' } : {}),
  });
  return { state, entries };
}

/**
 * At startup. Runs once even when several processes start together, and
 * always ends with the report to beta@idem.africa. Never throws.
 */
export async function runDomainMigration(): Promise<void> {
  try {
    const token = randomBytes(8).toString('hex');
    // Not released at the end: a process starting a minute later finds the work done and sends no second report.
    const mine = await redis.set(RUN_LOCK_KEY, token, 'PX', RUN_LOCK_TTL_MS, 'NX');
    if (!mine) {
      logger.info('Domain migration: already run by another process', { event: 'domain_migration.skipped' });
      return;
    }
  } catch (err) {
    logger.warn('Domain migration: lock unavailable, running anyway', { event: 'domain_migration.lock_failed', reason: (err as Error).message });
  }

  const report = await migrateAll();
  if (report.state === 'nothing_to_do') {
    logger.info('Domain migration: nothing to migrate — already done.', { event: 'domain_migration.nothing_to_do' });
  }
  const sent = await sendEmail(reportEmail(report));
  if (!sent) logger.warn('Domain migration: report not sent', { event: 'domain_migration.report_failed', to: MIGRATION_REPORT_TO });
}
