/**
 * Data Lifecycle — EXÉCUTE les suppressions promises aux utilisateurs.
 *
 *  - Compte : la demande (`users.deletionRequest`) arrive à échéance (J+180) → tout ce qui est rattaché au compte
 *    est effacé ; les preuves comptables sont gardées 10 ans, sans e-mail ni téléphone.
 *  - Projet : « supprimer » archive (`isArchived`) ; `PROJECT_PURGE_AFTER_DAYS` (30) jours plus tard, le projet,
 *    ses révisions, conversations, générations et fichiers sont effacés.
 *
 * Modes (`DATA_PURGE_MODE`) :
 *   off      rien ;
 *   dry-run  (défaut) chaque échéance produit un RAPPORT de ce qui serait effacé (`data_purge_reports`), rien n'est
 *            touché — pour relire avant de basculer ;
 *   enforce  efface, puis RECOMPTE : un rapport n'est `completed` que si plus rien ne reste. Le document `users` est
 *            effacé en dernier : une purge interrompue est reprise au passage suivant.
 *
 * Le balayage se fait PAR DÉCOUVERTE : chaque collection de la base est passée au filtre (userId, uid, ownerId,
 * projectId, brandId, _id, e-mail), sauf celles listées ici. Une collection ajoutée plus tard est donc couverte
 * sans y penser ; ce qui doit survivre se déclare.
 *
 * Hors d'atteinte, signalé dans le rapport : les ressources iDeploy (applications et serveurs en marche, à
 * arrêter par l'équipe), les journaux (rotation) et les sauvegardes (rétention de 14 jours).
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import logger from '../../config/logger';
import MinIOConnection from '../../config/minio.config';
import RedisConnection from '../../config/redis.config';
import { supabaseAdmin } from '../identity/supabaseAuth.client';
import { getIDeploySummaryForUser } from '../ideploy-pg.service';

export type PurgeMode = 'off' | 'dry-run' | 'enforce';

export function purgeMode(): PurgeMode {
  const raw = (process.env.DATA_PURGE_MODE ?? 'dry-run').toLowerCase();
  return raw === 'off' || raw === 'enforce' ? raw : 'dry-run';
}

export function projectPurgeAfterDays(): number {
  const days = Number(process.env.PROJECT_PURGE_AFTER_DAYS ?? 30);
  return Number.isFinite(days) && days >= 1 ? days : 30;
}

/** Preuves comptables (10 ans, cf. config/data-governance.ts) : gardées, coordonnées retirées. */
export const RETAINED_COLLECTIONS = new Set([
  'credit_ledger',
  'credit_balances',
  'payment_transactions',
  'payment_events',
  'payment_callbacks_raw',
  'billing_invoices',
  'billing_subscriptions',
  'idomain_charges',
  'deploy_meters',
  'promotion_redemptions',
]);

/** Champs de contact retirés des preuves gardées. */
const RETAINED_CONTACT_FIELDS = ['userEmail', 'email', 'phoneEncrypted', 'phoneHash', 'phone', 'phoneNumber', 'customerEmail', 'customerPhone'];

/** Métadonnées d'usage (sans contenu) : gardées pour les statistiques, détachées du compte et du projet. */
export const ANONYMIZED_COLLECTIONS = new Set(['ai_usage_events', 'token_usage']);

/** Données de la plateforme ou journaux légitimes : jamais balayés. */
export const UNTOUCHED_COLLECTIONS = new Set([
  'admins',
  'admin_audit_log',
  'data_purge_reports',
  'platform_settings',
  'pricing_changes',
  'pricing_defaults',
  'pricing_overrides',
  'billing_products',
  'billing_plans',
  'billing_settings',
  'billing_counters',
  'billing_health',
  'billing_sync_jobs',
  'payment_admin_actions',
  'promotions',
  'promotion_presets',
  'catalog_performance',
  'video_experience',
  'blog_posts',
]);

const PURGE_REPORTS = 'data_purge_reports';

export interface PurgeSubject {
  kind: 'account' | 'project';
  userId: string;
  projectId?: string;
}

export interface PurgeReport {
  _id: string;
  kind: PurgeSubject['kind'];
  userId: string;
  projectId?: string;
  mode: PurgeMode;
  status: 'planned' | 'completed' | 'incomplete';
  /** Documents effacés (ou à effacer) par collection. */
  deleted: Record<string, number>;
  /** Documents gardés comme preuve (coordonnées retirées) ou détachés. */
  retained: Record<string, number>;
  anonymized: Record<string, number>;
  storageObjects: number;
  cacheKeys: number;
  authAccount: 'deleted' | 'absent' | 'would_delete' | 'kept' | 'error';
  /** Ressources iDeploy encore en place : arrêt manuel par l'équipe. */
  ideployResources: number | null;
  remaining?: Record<string, number>;
  notes: string[];
  at: Date;
}

const db = () => mongoose.connection;

/** Les identifiants rattachés au sujet, et le filtre qui les retrouve partout. */
async function scope(subject: PurgeSubject): Promise<{ filter: Record<string, unknown>; prefixes: string[]; email?: string; authId?: string }> {
  const { userId, projectId } = subject;
  if (subject.kind === 'project') {
    if (!projectId) throw new Error('projectId requis');
    return {
      // `_id` du projet, et tout ce qui le cite. Le propriétaire est vérifié avant (cf. planProjectPurge).
      filter: { $or: [{ _id: projectId }, { projectId }, { defaultProjectId: projectId }] },
      prefixes: [`users/${userId}/projects/${projectId}/`, `projects/${projectId}/`],
    };
  }
  const user = await db().collection('users').findOne({ _id: userId as any });
  const projectIds = (await db().collection('projects').find({ userId }, { projection: { _id: 1 } }).toArray()).map((p) => String(p._id));
  const brandIds = (await db().collection('ivision_brands').find({ userId }, { projection: { _id: 1 } }).toArray()).map((b) => String(b._id));
  const ids = [userId, ...projectIds, ...brandIds];
  const email = typeof user?.email === 'string' && user.email ? user.email : undefined;
  return {
    filter: {
      $or: [
        { userId },
        { uid: userId },
        { ownerId: userId },
        { _id: { $in: ids } },
        ...(projectIds.length ? [{ projectId: { $in: projectIds } }, { defaultProjectId: { $in: projectIds } }] : []),
        ...(brandIds.length ? [{ brandId: { $in: brandIds } }] : []),
        // Formulaires et listes tenus à l'adresse seule (bêta, contact).
        ...(email ? [{ email }, { userEmail: email }] : []),
      ],
    },
    prefixes: [`users/${userId}/`, ...projectIds.map((id) => `projects/${id}/`)],
    email,
    authId: typeof user?.authId === 'string' ? user.authId : undefined,
  };
}

async function collectionNames(): Promise<string[]> {
  return (await db().db!.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));
}

async function listObjects(prefix: string): Promise<string[]> {
  const client = MinIOConnection.getClient();
  const bucket = MinIOConnection.getBucketName();
  const names: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = client.listObjectsV2(bucket, prefix, true);
    stream.on('data', (obj) => obj.name && names.push(obj.name));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });
  return names;
}

async function cacheKeysFor(id: string): Promise<string[]> {
  const redis = RedisConnection.getInstance();
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', `*${id}*`, 'COUNT', 500);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0' && keys.length < 10_000);
  // `MATCH *id*` ratisse large : seule une clé où l'identifiant est un SEGMENT entier (`:`, `_`, `/`, `.`) est
  // retenue — jamais celle d'un autre identifiant qui le contiendrait.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const segment = new RegExp(`(^|[:_/.])${escaped}($|[:_/.])`);
  return keys.filter((key) => segment.test(key));
}

/**
 * Le cœur : compte (dry-run) ou efface (enforce), puis vérifie. Idempotent.
 */
export async function runPurge(subject: PurgeSubject, mode: Exclude<PurgeMode, 'off'>): Promise<PurgeReport> {
  const enforce = mode === 'enforce';
  const { filter, prefixes, email, authId } = await scope(subject);
  const report: PurgeReport = {
    _id: `${subject.kind}:${subject.userId}${subject.projectId ? `:${subject.projectId}` : ''}:${mode}`,
    kind: subject.kind,
    userId: subject.userId,
    ...(subject.projectId ? { projectId: subject.projectId } : {}),
    mode,
    status: 'planned',
    deleted: {},
    retained: {},
    anonymized: {},
    storageObjects: 0,
    cacheKeys: 0,
    authAccount: subject.kind === 'account' ? (enforce ? 'kept' : 'would_delete') : 'kept',
    ideployResources: null,
    notes: [],
    at: new Date(),
  };

  const names = await collectionNames();
  for (const name of names) {
    if (UNTOUCHED_COLLECTIONS.has(name)) continue;
    const col = db().collection(name);

    if (RETAINED_COLLECTIONS.has(name)) {
      // Le projet n'a pas de preuve comptable propre : rien à faire pour une purge de projet.
      if (subject.kind === 'project') continue;
      const n = await col.countDocuments({ userId: subject.userId });
      if (!n) continue;
      report.retained[name] = n;
      if (enforce) await col.updateMany({ userId: subject.userId }, { $unset: Object.fromEntries(RETAINED_CONTACT_FIELDS.map((f) => [f, ''])) });
      continue;
    }

    if (ANONYMIZED_COLLECTIONS.has(name)) {
      const match = subject.kind === 'project' ? { projectId: subject.projectId } : { userId: subject.userId };
      const n = await col.countDocuments(match);
      if (!n) continue;
      report.anonymized[name] = n;
      if (enforce) await col.updateMany(match, subject.kind === 'project' ? { $unset: { projectId: '' } } : { $unset: { userId: '', projectId: '' } });
      continue;
    }

    // L'ANCRE (la fiche du compte, ou celle du projet) est effacée en dernier, après vérification : tant qu'elle
    // existe, l'échéance reste visible et une purge interrompue est reprise au passage suivant.
    if (name === 'users' || (subject.kind === 'project' && name === 'projects')) continue;
    const n = await col.countDocuments(filter);
    if (!n) continue;
    report.deleted[name] = n;
    if (enforce) await col.deleteMany(filter);
  }

  // Fichiers.
  try {
    for (const prefix of prefixes) {
      const objects = await listObjects(prefix);
      report.storageObjects += objects.length;
      if (enforce) {
        const client = MinIOConnection.getClient();
        for (let i = 0; i < objects.length; i += 1000) await client.removeObjects(MinIOConnection.getBucketName(), objects.slice(i, i + 1000));
      }
    }
  } catch (error) {
    report.notes.push(`stockage : ${(error as Error).message}`);
  }

  // Caches.
  try {
    const keys = await cacheKeysFor(subject.kind === 'project' ? subject.projectId! : subject.userId);
    report.cacheKeys = keys.length;
    if (enforce && keys.length) await RedisConnection.getInstance().del(...keys);
  } catch (error) {
    report.notes.push(`cache : ${(error as Error).message}`);
  }

  if (subject.kind === 'account') {
    // iDeploy : des applications EN MARCHE ne s'arrêtent pas en silence. Comptées, laissées à l'équipe.
    if (email) {
      try {
        const summary: any = await getIDeploySummaryForUser(email);
        const count = ['applications', 'databases', 'services', 'servers'].reduce((sum, k) => sum + (Array.isArray(summary?.[k]) ? summary[k].length : 0), 0);
        report.ideployResources = count;
        if (count) report.notes.push(`iDeploy : ${count} ressource(s) à supprimer par l'équipe (applications, bases, serveurs)`);
      } catch (error) {
        report.notes.push(`iDeploy non joignable : ${(error as Error).message}`);
      }
    }

    if (enforce) {
      // Compte d'authentification, puis la fiche — en DERNIER.
      try {
        report.authAccount = authId ? ((await supabaseAdmin.deleteUser(authId)) ? 'deleted' : 'absent') : 'absent';
      } catch (error) {
        report.authAccount = 'error';
        report.notes.push(`authentification : ${(error as Error).message}`);
      }
    }
    report.deleted.users = await db().collection('users').countDocuments({ _id: subject.userId as any });
  } else {
    report.deleted.projects = await db().collection('projects').countDocuments({ _id: subject.projectId as any, userId: subject.userId });
  }

  if (enforce) {
    // Vérification : on recompte. Rien ne doit rester, sinon la purge est reprise au passage suivant.
    const remaining: Record<string, number> = {};
    for (const name of Object.keys(report.deleted)) {
      if (name === 'users' || (subject.kind === 'project' && name === 'projects')) continue;
      const n = await db().collection(name).countDocuments(filter);
      if (n) remaining[name] = n;
    }
    try {
      for (const prefix of prefixes) {
        const left = (await listObjects(prefix)).length;
        if (left) remaining[`minio:${prefix}`] = left;
      }
    } catch {
      remaining.minio = -1;
    }
    const authOk = subject.kind === 'project' || report.authAccount !== 'error';
    if (!Object.keys(remaining).length && authOk) {
      if (subject.kind === 'account') await db().collection('users').deleteOne({ _id: subject.userId as any });
      else await db().collection('projects').deleteOne({ _id: subject.projectId as any, userId: subject.userId });
      report.status = 'completed';
    } else {
      report.status = 'incomplete';
      report.remaining = remaining;
    }
  }

  await db().collection<PurgeReport>(PURGE_REPORTS).replaceOne({ _id: report._id }, report, { upsert: true });
  const meta = {
    event: `privacy.purge.${report.status}`,
    kind: report.kind,
    mode,
    // Identifiant haché dans le journal : la preuve complète est dans data_purge_reports.
    subject: crypto.createHash('sha256').update(report._id).digest('hex').slice(0, 16),
    deletedDocs: Object.values(report.deleted).reduce((a, b) => a + b, 0),
    storageObjects: report.storageObjects,
    ideployResources: report.ideployResources,
  };
  if (report.status === 'incomplete') logger.error('privacy.purge.incomplete', { ...meta, remaining: report.remaining });
  else logger.info(meta.event, meta);
  return report;
}

/** Comptes dont la demande est échue, et projets archivés depuis plus du délai. */
export async function dueSubjects(now = new Date(), limit = 50): Promise<PurgeSubject[]> {
  const accounts = await db()
    .collection('users')
    .find({ 'deletionRequest.scheduledAt': { $lte: now } }, { projection: { _id: 1 } })
    .limit(limit)
    .toArray();
  const cutoff = new Date(now.getTime() - projectPurgeAfterDays() * 86_400_000);
  const projects = await db()
    .collection('projects')
    .find({ isArchived: true, archivedAt: { $lte: cutoff } }, { projection: { _id: 1, userId: 1 } })
    .limit(limit)
    .toArray();
  return [
    ...accounts.map((u) => ({ kind: 'account' as const, userId: String(u._id) })),
    ...projects.filter((p) => typeof p.userId === 'string').map((p) => ({ kind: 'project' as const, userId: p.userId as string, projectId: String(p._id) })),
  ];
}

/**
 * Re-vérifie l'échéance juste avant d'agir : une demande annulée (reconnexion) ou un projet désarchivé entre la
 * sélection et l'exécution n'est jamais effacé.
 */
async function stillDue(subject: PurgeSubject, now: Date): Promise<boolean> {
  if (subject.kind === 'account') {
    const user = await db().collection('users').findOne({ _id: subject.userId as any, 'deletionRequest.scheduledAt': { $lte: now } }, { projection: { _id: 1 } });
    return !!user;
  }
  const cutoff = new Date(now.getTime() - projectPurgeAfterDays() * 86_400_000);
  const project = await db().collection('projects').findOne({ _id: subject.projectId as any, userId: subject.userId, isArchived: true, archivedAt: { $lte: cutoff } }, { projection: { _id: 1 } });
  return !!project;
}

/** Tâche planifiée (billing-scheduler, chaque heure). */
export async function runScheduledPurges(): Promise<{ mode: PurgeMode; processed: number }> {
  const mode = purgeMode();
  if (mode === 'off') return { mode, processed: 0 };
  const now = new Date();
  let processed = 0;
  for (const subject of await dueSubjects(now)) {
    if (!(await stillDue(subject, now))) continue;
    try {
      await runPurge(subject, mode);
      processed++;
    } catch (error) {
      logger.error('privacy.purge.failed', { event: 'privacy.purge.failed', kind: subject.kind, mode, error });
    }
  }
  return { mode, processed };
}

/** Pour le script manuel : l'échéance n'est vérifiée que si on le demande. */
export { stillDue };
