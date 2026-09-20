import logger from '../../config/logger';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import {
  DeliverableDocumentMap,
  DeliverableKind,
  findDocument,
  listDocuments,
  newDocumentId,
  withDocument,
  withoutDocument,
} from './deliverable-documents';

type NewDocument<K extends DeliverableKind> = Omit<
  DeliverableDocumentMap[K],
  'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Lecture et écriture des documents d'un livrable (business plans, pitch decks).
 *
 * Chaque écriture relit le projet juste avant d'écrire : une génération
 * persiste une section toutes les quelques secondes, et partir d'une copie
 * lue au début du run effacerait ce que l'éditeur ou un autre document a
 * enregistré entre-temps.
 */
export class DeliverableDocumentStore {
  private readonly projectRepository: IRepository<ProjectModel> =
    RepositoryFactory.getRepository<ProjectModel>();

  private collectionPath(userId: string): string {
    return `users/${userId}/projects`;
  }

  async loadProject(userId: string, projectId: string): Promise<ProjectModel | null> {
    return this.projectRepository.findById(projectId, this.collectionPath(userId));
  }

  /** Documents du livrable ; `null` quand le projet est introuvable. */
  async list<K extends DeliverableKind>(
    userId: string,
    projectId: string,
    kind: K
  ): Promise<DeliverableDocumentMap[K][] | null> {
    const project = await this.loadProject(userId, projectId);
    return project ? listDocuments(project.analysisResultModel, kind) : null;
  }

  /** Document désigné, ou le document principal sans identifiant. */
  async find<K extends DeliverableKind>(
    userId: string,
    projectId: string,
    kind: K,
    documentId?: string | null
  ): Promise<DeliverableDocumentMap[K] | null> {
    const project = await this.loadProject(userId, projectId);
    return project ? findDocument(project.analysisResultModel, kind, documentId) : null;
  }

  async create<K extends DeliverableKind>(
    userId: string,
    projectId: string,
    kind: K,
    init: NewDocument<K>
  ): Promise<DeliverableDocumentMap[K] | null> {
    const project = await this.loadProject(userId, projectId);
    if (!project) return null;

    const now = new Date();
    const document = { ...init, id: newDocumentId(), createdAt: now, updatedAt: now } as DeliverableDocumentMap[K];
    const saved = await this.write(
      userId,
      projectId,
      withDocument(project.analysisResultModel, kind, document)
    );
    if (!saved) return null;

    logger.info(`Created ${kind} document ${document.id} for project ${projectId}`);
    return document;
  }

  /**
   * Applique `mutate` au document et l'enregistre.
   *
   * `touch: false` laisse la date de modification intacte : télécharger le PDF
   * enregistre sa qualité de mise en page, et ne doit pas faire remonter le
   * document en tête de liste.
   */
  async update<K extends DeliverableKind>(
    userId: string,
    projectId: string,
    kind: K,
    documentId: string | null | undefined,
    mutate: (document: DeliverableDocumentMap[K]) => DeliverableDocumentMap[K],
    options: { touch?: boolean } = {}
  ): Promise<DeliverableDocumentMap[K] | null> {
    const project = await this.loadProject(userId, projectId);
    if (!project) return null;

    const current = findDocument(project.analysisResultModel, kind, documentId);
    if (!current) {
      logger.warn(`No ${kind} document ${documentId ?? '(primary)'} in project ${projectId}`);
      return null;
    }

    const next = {
      ...mutate(current),
      id: current.id,
      ...(options.touch === false ? {} : { updatedAt: new Date() }),
    } as DeliverableDocumentMap[K];
    const saved = await this.write(userId, projectId, withDocument(project.analysisResultModel, kind, next));
    return saved ? next : null;
  }

  async remove(
    userId: string,
    projectId: string,
    kind: DeliverableKind,
    documentId: string
  ): Promise<boolean> {
    const project = await this.loadProject(userId, projectId);
    if (!project) return false;

    const exists = listDocuments(project.analysisResultModel, kind).some((d) => d.id === documentId);
    if (!exists) return false;

    const saved = await this.write(
      userId,
      projectId,
      withoutDocument(project.analysisResultModel, kind, documentId)
    );
    if (saved) logger.info(`Deleted ${kind} document ${documentId} from project ${projectId}`);
    return !!saved;
  }

  /**
   * Écrit `analysisResultModel` seul : les autres champs du projet ne sont pas
   * renvoyés, et un champ modifié ailleurs pendant la génération reste intact.
   */
  private async write(
    userId: string,
    projectId: string,
    analysisResultModel: ProjectModel['analysisResultModel']
  ): Promise<ProjectModel | null> {
    return this.projectRepository.update(
      projectId,
      { analysisResultModel } as Partial<ProjectModel>,
      this.collectionPath(userId)
    );
  }
}

export const deliverableDocumentStore = new DeliverableDocumentStore();
