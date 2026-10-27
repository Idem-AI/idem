/**
 * LA BOUCLE IDEM, CÔTÉ API — ce que l'utilisateur fait dans chaque application, et ce qu'on lui propose
 * ensuite. L'API est le seul endroit qui voit tout : un site refait dans iCode, une vidéo faite dans iVision,
 * une mise en ligne dans iDeploy. Chaque application lui dit ce qui vient d'arriver (`record`) et lui demande
 * quoi proposer (`next`) ; les règles et les mots sont ceux de `@idem/shared-journey`, partagés par tous.
 *
 * Mémoire, par utilisateur (`users/<uid>/journey/state`) : les derniers événements (bornés) et ce qu'il a
 * fait des recommandations (affichées, suivies, écartées) — pour ne jamais insister sur ce qu'il a refusé.
 */
import logger from '../../config/logger';
import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { projectService } from '../project.service';
import {
  EMPTY_MEMORY,
  factsFromEvents,
  factsFromProject,
  IDEM_APPS,
  IdemApp,
  JOURNEY_EVENT_TYPES,
  JourneyDestination,
  JourneyEvent,
  JourneyEventType,
  JourneyFeedback,
  JourneyMemory,
  mergeFacts,
  ProjectFacts,
  Recommendation,
  recommend,
  remember,
} from '../../../../../packages/shared-journey/src';

const DESTINATIONS: readonly JourneyDestination[] = ['communication', 'video', 'charter', 'site', 'app', 'publish-site', 'publish-app', 'domain', 'business-plan', 'pitch-deck', 'legal'];
/** Assez pour couvrir la fenêtre d'opportunité (7 jours) de plusieurs projets, pas plus. */
const MAX_EVENTS = 80;
const STATE_ID = 'state';

interface JourneyState {
  id?: string;
  events: JourneyEvent[];
  memory: JourneyMemory;
  createdAt?: Date;
  updatedAt?: Date;
}

export const isJourneyEvent = (value: unknown): value is JourneyEventType => JOURNEY_EVENT_TYPES.includes(value as JourneyEventType);
export const isIdemApp = (value: unknown): value is IdemApp => IDEM_APPS.includes(value as IdemApp);
export const isDestination = (value: unknown): value is JourneyDestination => DESTINATIONS.includes(value as JourneyDestination);

/** Une mise en ligne enregistrée par iCode (`<projectId>_deployment` ou `<projectId>_app_deployment`). */
interface DeploymentRecord {
  id?: string;
  ideploy?: { applicationUuid?: string; frontendUuid?: string; backendUuid?: string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

class JourneyService {
  private readonly repository: IRepository<JourneyState> = RepositoryFactory.getRepository<JourneyState>();
  private readonly deployments: IRepository<DeploymentRecord> = RepositoryFactory.getRepository<DeploymentRecord>();

  private path(userId: string): string {
    return `users/${userId}/journey`;
  }

  /** L'état de l'utilisateur, et s'il existait déjà (une mise à jour, sinon une création). */
  private async load(userId: string): Promise<{ state: JourneyState; existed: boolean }> {
    const stored = await this.repository.findById(STATE_ID, this.path(userId), { bypassCache: true }).catch(() => null);
    return {
      existed: !!stored,
      state: {
        events: Array.isArray(stored?.events) ? stored!.events : [],
        memory: {
          shown: { ...(stored?.memory?.shown ?? {}) },
          clicked: { ...(stored?.memory?.clicked ?? {}) },
          dismissed: { ...(stored?.memory?.dismissed ?? {}) },
        },
      },
    };
  }

  private async save(userId: string, state: JourneyState, existed: boolean): Promise<void> {
    const data = { events: state.events.slice(-MAX_EVENTS), memory: state.memory };
    try {
      if (existed) {
        const updated = await this.repository.update(STATE_ID, data, this.path(userId));
        if (updated) return;
      }
      await this.repository.create(data, this.path(userId), STATE_ID);
    } catch (error: any) {
      // La boucle est un confort : son stockage en panne ne casse jamais le geste qui l'a déclenchée.
      logger.warn('journey.save_failed', { event: 'journey.save_failed', userId, error: error?.message });
    }
  }

  /** Ce que le projet a déjà : sa fiche, son site enregistré, et les gestes faits ailleurs. */
  private async facts(userId: string, projectId: string | undefined, events: JourneyEvent[]): Promise<ProjectFacts> {
    if (!projectId) return mergeFacts(factsFromEvents(events));
    // La fiche, le site enregistré, et les mises en ligne (site et application) quel que soit l'écran qui les a
    // faites : on ne propose jamais de mettre en ligne ce qui l'est déjà.
    const [project, generation, siteDeployment, appDeployment] = await Promise.all([
      projectService.getUserProjectById(userId, projectId).catch(() => null),
      projectService.getProjectGeneration(userId, projectId).catch(() => null),
      projectService.getAppDeployment(userId, projectId, 'site').catch(() => null),
      projectService.getAppDeployment(userId, projectId, 'app').catch(() => null),
    ]);
    return mergeFacts(
      factsFromProject(project),
      factsFromEvents(events, projectId),
      generation ? { site: true } : {},
      siteDeployment?.url ? { site: true, sitePublished: true } : {},
      appDeployment?.url ? { app: true, appPublished: true } : {}
    );
  }

  /**
   * Le projet IDEM d'une application iDeploy : iDeploy ne connaît pas les projets d'IDEM, mais une mise en ligne
   * faite depuis iCode garde les identifiants de ses applications (`users/<uid>/appDeployments`). Une
   * application publiée autrement n'a pas de projet : pas de carte plutôt qu'une carte sur le mauvais projet.
   */
  async projectOfApp(userId: string, appUuid: string): Promise<{ projectId: string; product: 'site' | 'app' } | null> {
    if (!appUuid) return null;
    const records = await this.deployments.findAll(`users/${userId}/appDeployments`).catch(() => [] as DeploymentRecord[]);
    for (const record of records) {
      const ideploy = record.ideploy ?? {};
      if (![ideploy.applicationUuid, ideploy.frontendUuid, ideploy.backendUuid].includes(appUuid)) continue;
      const match = String(record.id ?? '').match(/^(.+?)_(app_)?deployment$/);
      if (match) return { projectId: match[1], product: match[2] ? 'app' : 'site' };
    }
    return null;
  }

  /** Un geste vient d'avoir lieu : il est retenu, et ses recommandations sont rendues tout de suite. */
  async record(
    userId: string,
    input: { type: JourneyEventType; app: IdemApp; projectId?: string; place?: JourneyDestination; limit?: number }
  ): Promise<Recommendation[]> {
    const { state, existed } = await this.load(userId);
    const event: JourneyEvent = { type: input.type, app: input.app, ...(input.projectId ? { projectId: input.projectId } : {}), at: new Date().toISOString() };
    // Le même geste répété dans la minute (double clic, nouvel essai) n'est retenu qu'une fois.
    const duplicate = state.events.some((e) => e.type === event.type && e.projectId === event.projectId && Date.now() - Date.parse(e.at) < 60_000);
    if (!duplicate) state.events.push(event);
    if (!duplicate) await this.save(userId, state, existed);
    logger.info('journey.event', { event: 'journey.event', userId, type: input.type, app: input.app, projectId: input.projectId, duplicate });

    const facts = await this.facts(userId, input.projectId, state.events);
    return recommend({ facts, events: state.events, memory: state.memory, surface: { app: input.app, place: input.place }, trigger: input.type, projectId: input.projectId, limit: input.limit });
  }

  /**
   * Un geste constaté par l'API elle-même (fin d'une génération) : retenu sans attendre ni rien rendre. C'est le
   * chemin le plus sûr — aucun écran ne peut l'oublier — et une panne de la boucle n'atteint jamais la génération.
   */
  signal(userId: string | undefined, type: JourneyEventType, projectId: string | undefined, app: IdemApp = 'dashboard'): void {
    if (!userId) return;
    void this.record(userId, { type, app, projectId }).catch((error: any) =>
      logger.warn('journey.signal_failed', { event: 'journey.signal_failed', userId, type, error: error?.message })
    );
  }

  /** Les recommandations du moment pour une page. */
  async next(userId: string, input: { app: IdemApp; projectId?: string; place?: JourneyDestination; limit?: number; ambient?: boolean }): Promise<Recommendation[]> {
    const { state } = await this.load(userId);
    const facts = await this.facts(userId, input.projectId, state.events);
    return recommend({ facts, events: state.events, memory: state.memory, surface: { app: input.app, place: input.place }, projectId: input.projectId, limit: input.limit, ambient: input.ambient });
  }

  async feedback(userId: string, id: string, action: JourneyFeedback): Promise<void> {
    const { state, existed } = await this.load(userId);
    const memory = remember(state.memory ?? EMPTY_MEMORY, id, action);
    if (memory === state.memory) return;
    await this.save(userId, { ...state, memory }, existed);
    if (action !== 'shown') logger.info('journey.feedback', { event: 'journey.feedback', userId, id, action });
  }
}

export const journeyService = new JourneyService();
