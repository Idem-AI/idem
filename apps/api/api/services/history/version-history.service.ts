import logger from '../../config/logger';
import { ProjectRevision } from '../../schemas/revision.schema';
import {
  ProjectRevisionModel,
  ProjectSectionKey,
  RevisionAuthor,
  RevisionLogEntry,
  SectionDiffResult,
} from '../../models/revision.model';
import {
  applyJsonPatch,
  compareJson,
  jsonSizeBytes,
  summarizePatch,
  JsonPatchOp,
} from '../../utils/json-patch.util';
import { logAIEvent } from '../../utils/ai-trace.util';

/**
 * "Chronicle" — historique versionné des artefacts projet, interrogeable comme
 * git par les agents IA et le dashboard :
 *   - record  ≈ commit (automatique à chaque écriture projet)
 *   - log     ≈ git log [--section]
 *   - show    ≈ git show section@version
 *   - diff    ≈ git diff v1..v2
 *   - stateAt ≈ git checkout section@{date}
 *
 * Stockage: pattern MongoDB "Document Versioning" — collection séparée
 * `project_revisions`, snapshot complet sur v1 puis toutes les
 * SNAPSHOT_INTERVAL versions, delta RFC 6902 entre deux versions successives.
 */
const SNAPSHOT_INTERVAL = 10;
/** Au-delà de cette taille de patch (octets), on stocke aussi un snapshot. */
const PATCH_SNAPSHOT_THRESHOLD = 64 * 1024;
const MAX_VERSION_RETRIES = 3;

export interface RecordRevisionInput {
  projectId: string;
  userId: string;
  section: ProjectSectionKey;
  before: unknown;
  after: unknown;
  author: RevisionAuthor;
  source: string;
  summary?: string;
}

export class VersionHistoryService {
  /**
   * Enregistre une révision si (et seulement si) la section a changé.
   * Ne lève jamais: l'historique ne doit pas casser l'écriture métier.
   */
  async record(input: RecordRevisionInput): Promise<ProjectRevisionModel | null> {
    try {
      const patch = compareJson(input.before, input.after);
      if (patch.length === 0) {
        return null;
      }

      for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
        const last = await ProjectRevision.findOne({
          projectId: input.projectId,
          section: input.section,
        })
          .sort({ version: -1 })
          .lean();

        const version = (last?.version ?? 0) + 1;
        const isSnapshot =
          version === 1 ||
          (version - 1) % SNAPSHOT_INTERVAL === 0 ||
          jsonSizeBytes(patch) > PATCH_SNAPSHOT_THRESHOLD;

        const revision: ProjectRevisionModel = {
          projectId: input.projectId,
          userId: input.userId,
          section: input.section,
          version,
          author: input.author,
          source: input.source,
          summary: input.summary || summarizePatch(patch),
          changedPaths: this.extractChangedPaths(patch),
          patch: version === 1 ? undefined : patch,
          snapshot: isSnapshot ? this.toPlainJson(input.after) : undefined,
          sizeBytes: jsonSizeBytes(input.after),
        };

        try {
          const created = await ProjectRevision.create(revision);
          logger.info(
            `VersionHistory.record ${input.projectId}/${input.section}@v${version} by ${input.author.type} (${input.source})`
          );
          logAIEvent('chronicle.commit', {
            projectId: input.projectId,
            section: input.section,
            version,
            authorType: input.author.type,
            source: input.source,
            isSnapshot,
            changedPaths: revision.changedPaths,
          });
          return { ...revision, id: created._id?.toString() };
        } catch (err: any) {
          // Collision d'index unique = écriture concurrente sur la même section → retry.
          if (err?.code === 11000 && attempt < MAX_VERSION_RETRIES - 1) {
            logger.warn(
              `VersionHistory.record version conflict on ${input.projectId}/${input.section}, retrying`
            );
            continue;
          }
          throw err;
        }
      }
      return null;
    } catch (error: any) {
      logger.error(
        `VersionHistory.record failed for ${input.projectId}/${input.section}: ${error.message}`,
        { stack: error.stack }
      );
      return null;
    }
  }

  /** git log — dernières révisions, toutes sections ou une section donnée. */
  async log(
    projectId: string,
    options: { section?: ProjectSectionKey; limit?: number; beforeVersion?: number } = {}
  ): Promise<RevisionLogEntry[]> {
    const query: Record<string, unknown> = { projectId };
    if (options.section) query.section = options.section;
    if (options.beforeVersion && options.section) {
      query.version = { $lt: options.beforeVersion };
    }

    const docs = await ProjectRevision.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit ?? 20, 100))
      .select('section version author source summary changedPaths createdAt')
      .lean();

    logAIEvent('chronicle.query', {
      op: 'log',
      projectId,
      section: options.section,
      resultCount: docs.length,
    });

    return docs.map((d) => ({
      section: d.section as ProjectSectionKey,
      version: d.version,
      author: d.author,
      source: d.source,
      summary: d.summary,
      changedPaths: d.changedPaths ?? [],
      createdAt: d.createdAt as Date,
    }));
  }

  /**
   * git show — reconstruit l'état exact d'une section à une version donnée :
   * snapshot le plus proche ≤ version, puis application des deltas successifs.
   */
  async show(projectId: string, section: ProjectSectionKey, version: number): Promise<unknown> {
    const snapshotRev = await ProjectRevision.findOne({
      projectId,
      section,
      version: { $lte: version },
      snapshot: { $exists: true, $ne: null },
    })
      .sort({ version: -1 })
      .lean();

    if (!snapshotRev) {
      throw new Error(`Aucun snapshot trouvé pour ${section} ≤ v${version} (projet ${projectId})`);
    }

    if (snapshotRev.version === version) {
      logAIEvent('chronicle.query', { op: 'show', projectId, section, version, fromSnapshot: true });
      return snapshotRev.snapshot;
    }

    const deltas = await ProjectRevision.find({
      projectId,
      section,
      version: { $gt: snapshotRev.version, $lte: version },
    })
      .sort({ version: 1 })
      .select('version patch snapshot')
      .lean();

    const expectedCount = version - snapshotRev.version;
    if (deltas.length !== expectedCount) {
      throw new Error(
        `Historique incomplet pour ${section}: ${deltas.length}/${expectedCount} deltas entre v${snapshotRev.version} et v${version}`
      );
    }

    let state: unknown = snapshotRev.snapshot;
    for (const delta of deltas) {
      if (delta.snapshot !== undefined && delta.snapshot !== null) {
        state = delta.snapshot;
      } else if (delta.patch) {
        state = applyJsonPatch(state, delta.patch as JsonPatchOp[]);
      }
    }
    logAIEvent('chronicle.query', {
      op: 'show',
      projectId,
      section,
      version,
      reconstructedFromSnapshotVersion: snapshotRev.version,
      deltasApplied: deltas.length,
    });
    return state;
  }

  /** git diff v1..v2 — delta entre deux versions d'une section. */
  async diff(
    projectId: string,
    section: ProjectSectionKey,
    fromVersion: number,
    toVersion: number
  ): Promise<SectionDiffResult> {
    const [from, to] = await Promise.all([
      this.show(projectId, section, fromVersion),
      this.show(projectId, section, toVersion),
    ]);
    const patch = compareJson(from, to);
    logAIEvent('chronicle.query', {
      op: 'diff',
      projectId,
      section,
      fromVersion,
      toVersion,
      opsCount: patch.length,
    });
    return {
      section,
      fromVersion,
      toVersion,
      patch,
      summary: summarizePatch(patch),
    };
  }

  /**
   * git log @{date} — dernière version d'une section à (ou avant) une date.
   * Retourne null si la section n'existait pas encore.
   */
  async versionAt(
    projectId: string,
    section: ProjectSectionKey,
    date: Date
  ): Promise<RevisionLogEntry | null> {
    const doc = await ProjectRevision.findOne({
      projectId,
      section,
      createdAt: { $lte: date },
    })
      .sort({ createdAt: -1 })
      .select('section version author source summary changedPaths createdAt')
      .lean();

    if (!doc) return null;
    return {
      section: doc.section as ProjectSectionKey,
      version: doc.version,
      author: doc.author,
      source: doc.source,
      summary: doc.summary,
      changedPaths: doc.changedPaths ?? [],
      createdAt: doc.createdAt as Date,
    };
  }

  /** État complet d'une section telle qu'elle était à une date donnée. */
  async stateAt(
    projectId: string,
    section: ProjectSectionKey,
    date: Date
  ): Promise<{ version: number; state: unknown } | null> {
    const entry = await this.versionAt(projectId, section, date);
    logAIEvent('chronicle.query', {
      op: 'stateAt',
      projectId,
      section,
      date: date.toISOString(),
      found: !!entry,
      resolvedVersion: entry?.version,
    });
    if (!entry) return null;
    const state = await this.show(projectId, section, entry.version);
    return { version: entry.version, state };
  }

  /** Dernière version connue de chaque section (pour la carte du projet). */
  async latestVersions(
    projectId: string
  ): Promise<Partial<Record<ProjectSectionKey, RevisionLogEntry>>> {
    const docs = await ProjectRevision.aggregate([
      { $match: { projectId } },
      { $sort: { version: -1 } },
      {
        $group: {
          _id: '$section',
          version: { $first: '$version' },
          author: { $first: '$author' },
          source: { $first: '$source' },
          summary: { $first: '$summary' },
          changedPaths: { $first: '$changedPaths' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]);

    const result: Partial<Record<ProjectSectionKey, RevisionLogEntry>> = {};
    for (const doc of docs) {
      result[doc._id as ProjectSectionKey] = {
        section: doc._id,
        version: doc.version,
        author: doc.author,
        source: doc.source,
        summary: doc.summary,
        changedPaths: doc.changedPaths ?? [],
        createdAt: doc.createdAt,
      };
    }
    return result;
  }

  private extractChangedPaths(patch: JsonPatchOp[], max = 20): string[] {
    const paths = new Set<string>();
    for (const op of patch) {
      const dotted = op.path
        .split('/')
        .filter(Boolean)
        .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
        .join('.');
      paths.add(dotted || '(racine)');
      if (paths.size >= max) break;
    }
    return Array.from(paths);
  }

  private toPlainJson(value: unknown): unknown {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }
}

export const versionHistoryService = new VersionHistoryService();
