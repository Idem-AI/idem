import logger from '../../config/logger';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import { ProjectSectionKey, RevisionLogEntry } from '../../models/revision.model';
import { versionHistoryService } from '../history/version-history.service';
import { jsonSizeBytes } from '../../utils/json-patch.util';
import { setRevisionNote } from '../../utils/revision-context.util';
import {
  ALL_SECTION_KEYS,
  getAtPath,
  isSectionKey,
  sectionHasContent,
  sectionRegistry,
  summarizeValue,
} from './context-registry';

/**
 * Context Engine — la couche par laquelle les agents IA (et les autres apps
 * IDEM) accèdent à la connaissance projet, à la demande et au bon grain :
 *
 *  - getProjectMap : carte compacte du projet (progressive disclosure) — quelles
 *    sections existent, leur taille, leur dernière modification et version ;
 *  - getSection    : récupération just-in-time d'une section (résumé ou intégral,
 *    éventuellement un sous-chemin précis) ;
 *  - searchProject : recherche plein-texte dans toutes les sections, renvoie
 *    chemins + extraits (l'agent sait ensuite QUOI demander et OÙ).
 *
 * Combiné à Chronicle (VersionHistoryService), l'agent dispose du présent
 * (sections) et du passé (log/show/diff/stateAt) du projet.
 */

export interface SectionMapEntry {
  section: ProjectSectionKey;
  description: string;
  exists: boolean;
  sizeBytes: number;
  currentVersion?: number;
  lastModifiedAt?: Date;
  lastModifiedBy?: 'user' | 'ai' | 'system';
  lastChangeSummary?: string;
}

export interface ProjectMap {
  projectId: string;
  name: string;
  type: string;
  updatedAt?: Date;
  sections: SectionMapEntry[];
}

export interface SearchMatch {
  section: ProjectSectionKey;
  path: string;
  snippet: string;
}

const MAX_FULL_SECTION_CHARS = 60_000;
const MAX_SEARCH_RESULTS = 20;
const SEARCH_SNIPPET_RADIUS = 90;

export class ContextEngineService {
  private readonly projectRepository: IRepository<ProjectModel>;

  constructor() {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  private async loadProject(userId: string, projectId: string): Promise<ProjectModel> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      throw new Error(`Projet introuvable: ${projectId}`);
    }
    return project;
  }

  /** Carte compacte du projet — le "sommaire" injecté en tête de contexte agent. */
  async getProjectMap(userId: string, projectId: string): Promise<ProjectMap> {
    const [project, latest] = await Promise.all([
      this.loadProject(userId, projectId),
      versionHistoryService.latestVersions(projectId),
    ]);

    const sections: SectionMapEntry[] = ALL_SECTION_KEYS.map((key) => {
      const definition = sectionRegistry.get(key)!;
      const value = definition.extract(project);
      const exists = sectionHasContent(value);
      const lastRevision: RevisionLogEntry | undefined = latest[key];
      return {
        section: key,
        description: definition.description,
        exists,
        sizeBytes: exists ? jsonSizeBytes(value) : 0,
        currentVersion: lastRevision?.version,
        lastModifiedAt: lastRevision?.createdAt,
        lastModifiedBy: lastRevision?.author?.type,
        lastChangeSummary: lastRevision?.summary,
      };
    });

    return {
      projectId,
      name: project.name,
      type: project.type,
      updatedAt: project.updatedAt,
      sections,
    };
  }

  /**
   * Récupération just-in-time d'une section.
   * @param detail 'summary' (défaut, token-efficient) ou 'full'
   * @param path   sous-chemin pointé optionnel ("colors.primary", "sections.0")
   */
  async getSection(
    userId: string,
    projectId: string,
    section: string,
    detail: 'summary' | 'full' = 'summary',
    path?: string
  ): Promise<unknown> {
    if (!isSectionKey(section)) {
      throw new Error(
        `Section inconnue "${section}". Sections valides: ${ALL_SECTION_KEYS.join(', ')}`
      );
    }
    const project = await this.loadProject(userId, projectId);
    const definition = sectionRegistry.get(section)!;
    const raw = getAtPath(definition.extract(project), path);

    if (raw === undefined || raw === null) {
      return {
        section,
        path: path ?? null,
        exists: false,
        message: `La section "${section}"${path ? ` (chemin "${path}")` : ''} est vide ou n'existe pas encore.`,
      };
    }

    if (detail === 'summary') {
      return { section, path: path ?? null, detail, data: summarizeValue(raw) };
    }

    const serialized = JSON.stringify(raw);
    if (serialized.length > MAX_FULL_SECTION_CHARS) {
      return {
        section,
        path: path ?? null,
        detail: 'summary',
        truncated: true,
        message: `Contenu intégral trop volumineux (${serialized.length} caractères). Résumé renvoyé — préciser un chemin plus profond pour le détail.`,
        data: summarizeValue(raw),
      };
    }
    return { section, path: path ?? null, detail, data: raw };
  }

  /**
   * Recherche plein-texte (insensible à la casse) dans toutes les sections du
   * projet. Renvoie section + chemin pointé + extrait, afin que l'agent puisse
   * ensuite cibler get_section sur le bon chemin.
   */
  async searchProject(userId: string, projectId: string, query: string): Promise<SearchMatch[]> {
    const trimmed = (query || '').trim().toLowerCase();
    if (trimmed.length < 2) {
      throw new Error('La requête de recherche doit contenir au moins 2 caractères.');
    }

    const project = await this.loadProject(userId, projectId);
    const matches: SearchMatch[] = [];

    for (const key of ALL_SECTION_KEYS) {
      if (matches.length >= MAX_SEARCH_RESULTS) break;
      const definition = sectionRegistry.get(key)!;
      const value = definition.extract(project);
      if (!sectionHasContent(value)) continue;
      this.searchValue(value, trimmed, key, '', matches);
    }

    return matches;
  }

  private searchValue(
    value: unknown,
    query: string,
    section: ProjectSectionKey,
    path: string,
    matches: SearchMatch[]
  ): void {
    if (matches.length >= MAX_SEARCH_RESULTS || value === null || value === undefined) return;

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      const index = lower.indexOf(query);
      if (index >= 0) {
        const start = Math.max(0, index - SEARCH_SNIPPET_RADIUS);
        const end = Math.min(value.length, index + query.length + SEARCH_SNIPPET_RADIUS);
        matches.push({
          section,
          path: path || '(racine)',
          snippet: `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`,
        });
      }
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      if (String(value).toLowerCase() === query) {
        matches.push({ section, path: path || '(racine)', snippet: String(value) });
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        this.searchValue(item, query, section, path ? `${path}.${i}` : String(i), matches)
      );
      return;
    }

    if (typeof value === 'object') {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        // Le nom de clé lui-même peut matcher (ex: "typography").
        if (key.toLowerCase().includes(query) && matches.length < MAX_SEARCH_RESULTS) {
          matches.push({
            section,
            path: path ? `${path}.${key}` : key,
            snippet: `[clé "${key}" présente]`,
          });
        }
        this.searchValue(v, query, section, path ? `${path}.${key}` : key, matches);
      }
    }
  }

  /**
   * Restaure une section à une version antérieure (git revert-style: crée une
   * NOUVELLE révision avec l'état d'époque, l'historique reste intact).
   */
  async restoreSection(
    userId: string,
    projectId: string,
    section: string,
    version: number
  ): Promise<{ section: ProjectSectionKey; restoredVersion: number }> {
    if (!isSectionKey(section)) {
      throw new Error(
        `Section inconnue "${section}". Sections valides: ${ALL_SECTION_KEYS.join(', ')}`
      );
    }
    const project = await this.loadProject(userId, projectId);
    const pastState = await versionHistoryService.show(projectId, section, version);

    setRevisionNote(`Restauration de la version ${version}`);

    const update = this.buildSectionUpdate(project, section, pastState);
    await this.projectRepository.update(projectId, update, `users/${userId}/projects`);

    logger.info(`ContextEngine.restoreSection ${projectId}/${section} → v${version}`);
    return { section, restoredVersion: version };
  }

  /** Construit le partial d'update projet correspondant à une section. */
  private buildSectionUpdate(
    project: ProjectModel,
    section: ProjectSectionKey,
    value: unknown
  ): Partial<ProjectModel> {
    if (section === 'overview') {
      return value as Partial<ProjectModel>;
    }
    if (section === 'deployments') {
      return { deployments: value } as Partial<ProjectModel>;
    }
    return {
      analysisResultModel: {
        ...project.analysisResultModel,
        [section]: value,
      },
    } as Partial<ProjectModel>;
  }
}

export const contextEngineService = new ContextEngineService();
