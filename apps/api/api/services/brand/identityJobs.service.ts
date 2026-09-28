/**
 * Régénérations lancées depuis le panneau « Identité visuelle », en TÂCHES DE
 * FOND.
 *
 * Une génération de logos dure plusieurs dizaines de secondes. Tant qu'elle
 * vivait dans une connexion SSE, fermer le panneau coupait la connexion, et la
 * coupure annulait la génération (`req.on('close')`) : l'utilisateur perdait
 * ce qu'il venait de payer en allant vérifier sa charte.
 *
 * Ici, la requête ne fait que DÉMARRER la tâche et répond aussitôt. La tâche
 * vit dans le serveur, enregistre ses propositions au fil de l'eau, et ne
 * s'arrête que sur demande explicite (`cancel`). Le panneau suit son état par
 * `status`, qu'il soit resté ouvert, qu'il ait été fermé puis rouvert, ou que
 * la page ait été rechargée.
 *
 * Facturation : les crédits sont débités par le middleware AVANT le démarrage.
 * Une tâche qui échoue, ou qu'on annule avant qu'elle n'ait rien produit, les
 * restitue — la contrepassation automatique du middleware ne voit plus rien
 * une fois la réponse partie.
 */

import logger from '../../config/logger';
import { BillingRequestContext } from '../../interfaces/express.interface';
import { ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { LogoModel, LogoPreferences, LogoType } from '../../models/logo.model';
import { ProjectModel } from '../../models/project.model';
import { BrandingService, GenerationCancelledError } from '../BandIdentity/branding.service';
import { logoAnalysisService } from '../BandIdentity/logoAnalysis.service';
import { creditLedgerService } from '../billing/credit-ledger.service';
import { entitlementsService } from '../billing/entitlements.service';
import { resolveSvgContent } from '../logo-import.service';
import { PromptService } from '../prompt.service';
import { runWithRevisionContext } from '../../utils/revision-context.util';

export type IdentityJobKind = 'logos' | 'colors' | 'typography';
export type IdentityJobStatus = 'running' | 'done' | 'failed' | 'cancelled';

export interface IdentityJob {
  kind: IdentityJobKind;
  status: IdentityJobStatus;
  startedAt: string;
  finishedAt?: string;
  /** Logos finalisés, au fil de la génération (tâche `logos`). */
  logos?: LogoModel[];
  /** Palettes proposées (tâche `colors`). */
  colors?: ColorModel[];
  /** Paires de polices proposées (tâche `typography`). */
  typography?: TypographyModel[];
  /** « Améliorer » : l'analyse qui a servi de brief, affichée à l'utilisateur. */
  improvementBrief?: string;
  /** Code d'erreur lisible par l'interface — jamais le message brut du modèle. */
  error?: 'generation_failed' | 'analysis_failed';
}

export interface LogoJobOptions {
  preferences?: { type?: LogoType; customDescription?: string };
  /**
   * Améliorer un logo existant plutôt que partir de zéro : il est analysé, et
   * l'analyse devient le brief de la génération — même voie que « Améliorer
   * mon logo avec l'IA » à la création.
   */
  improveSvg?: string;
}

interface JobEntry {
  job: IdentityJob;
  cancelled: boolean;
  billing?: BillingRequestContext;
  userId: string;
}

/** Une tâche terminée reste consultable ce temps-là, puis est oubliée. */
const RETENTION_MS = 30 * 60 * 1000;

const LOGO_TYPES: LogoType[] = ['icon', 'name', 'initial'];

export class IdentityJobsService {
  private readonly jobs = new Map<string, JobEntry>();
  private brandingInstance?: BrandingService;

  /**
   * Instancié au premier usage, pas au chargement du module : `BrandingService`
   * tire toute la chaîne de génération, dont l'ordre de chargement est
   * sensible (cycle prompt ↔ simulation).
   */
  private get branding(): BrandingService {
    this.brandingInstance ??= new BrandingService(new PromptService());
    return this.brandingInstance;
  }

  private key(userId: string, projectId: string, kind: IdentityJobKind): string {
    return `${userId}:${projectId}:${kind}`;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.jobs) {
      const finished = entry.job.finishedAt ? Date.parse(entry.job.finishedAt) : NaN;
      if (entry.job.status !== 'running' && now - finished > RETENTION_MS) this.jobs.delete(key);
    }
  }

  isRunning(userId: string, projectId: string, kind: IdentityJobKind): boolean {
    return this.jobs.get(this.key(userId, projectId, kind))?.job.status === 'running';
  }

  status(userId: string, projectId: string): Partial<Record<IdentityJobKind, IdentityJob>> {
    this.prune();
    const result: Partial<Record<IdentityJobKind, IdentityJob>> = {};
    for (const kind of ['logos', 'colors', 'typography'] as const) {
      const entry = this.jobs.get(this.key(userId, projectId, kind));
      if (entry) result[kind] = entry.job;
    }
    return result;
  }

  cancel(userId: string, projectId: string, kind: IdentityJobKind): boolean {
    const entry = this.jobs.get(this.key(userId, projectId, kind));
    if (!entry || entry.job.status !== 'running') return false;
    entry.cancelled = true;
    if (kind === 'logos') this.branding.cancelLogoGeneration(userId, projectId);
    return true;
  }

  private begin(
    userId: string,
    projectId: string,
    kind: IdentityJobKind,
    billing?: BillingRequestContext
  ): JobEntry {
    const entry: JobEntry = {
      userId,
      billing,
      cancelled: false,
      job: { kind, status: 'running', startedAt: new Date().toISOString() },
    };
    this.jobs.set(this.key(userId, projectId, kind), entry);
    return entry;
  }

  /**
   * Les propositions enregistrées par une tâche sont écrites par l'IA, et ne
   * changent le fond d'aucun document : pas d'audit de cohérence (lui-même un
   * appel au modèle) pour des logos simplement proposés.
   */
  private inBackground(kind: IdentityJobKind, task: () => Promise<void>): void {
    void runWithRevisionContext(
      {
        authorType: 'ai',
        source: `identity-panel:regenerate:${kind}`,
        note: `Nouvelles propositions (${kind}) depuis le panneau Identité visuelle`,
        suppressCoherenceTrigger: true,
      },
      task
    );
  }

  private async finish(entry: JobEntry, status: IdentityJobStatus, produced: boolean): Promise<void> {
    entry.job.status = status;
    entry.job.finishedAt = new Date().toISOString();

    // Rien de produit (échec, ou annulation avant le premier résultat) : les
    // crédits reviennent à l'utilisateur.
    if (produced || !entry.billing?.charged) return;
    const { engine, cost, action } = entry.billing;
    entry.billing = { ...entry.billing, charged: false };
    try {
      await creditLedgerService.refundDebit(entry.userId, engine, cost, {
        action,
        note:
          status === 'cancelled'
            ? 'Régénération annulée avant tout résultat — crédits restitués'
            : 'Régénération en échec — crédits restitués',
      });
      await entitlementsService.invalidate(entry.userId);
    } catch (error: any) {
      logger.error(`billing.refund_failed: ${error.message}`, {
        event: 'billing.refund_failed',
        userId: entry.userId,
        engine,
        action,
        cost,
      });
    }
  }

  /** Nouveaux logos, ou logo existant amélioré. Rend la main aussitôt. */
  startLogos(
    userId: string,
    projectId: string,
    options: LogoJobOptions,
    billing?: BillingRequestContext
  ): IdentityJob {
    const entry = this.begin(userId, projectId, 'logos', billing);
    entry.job.logos = [];

    this.inBackground('logos', async () => {
      try {
        let preferences: LogoPreferences | undefined = options.preferences?.type
          ? {
              type: options.preferences.type,
              useAIGeneration: !options.preferences.customDescription,
              customDescription: options.preferences.customDescription?.slice(0, 1200) || undefined,
            }
          : undefined;

        if (options.improveSvg) {
          let analysis;
          try {
            analysis = await logoAnalysisService.analyzeLogo(await resolveSvgContent(options.improveSvg));
          } catch (error: any) {
            logger.warn(`Analyse du logo à améliorer impossible (${projectId}) : ${error.message}`);
            entry.job.error = 'analysis_failed';
            await this.finish(entry, 'failed', false);
            return;
          }
          if (entry.cancelled) {
            await this.finish(entry, 'cancelled', false);
            return;
          }
          const reference =
            `Original logo reference — shapes: ${analysis.shapes}; ` +
            `colors: ${analysis.colors.join(', ')}; symbolism: ${analysis.symbolism}; ` +
            `weaknesses to fix: ${analysis.weaknesses}`;
          const userWish = options.preferences?.customDescription?.trim();
          entry.job.improvementBrief = analysis.improvementBrief;
          preferences = {
            // Le type choisi par l'utilisateur l'emporte sur celui détecté.
            type: options.preferences?.type ?? analysis.logoType,
            useAIGeneration: true,
            customDescription: [userWish, analysis.improvementBrief, reference].filter(Boolean).join('\n\n'),
          };
        }

        const logos = await this.branding.generateLogoConceptsWithStreaming(
          userId,
          projectId,
          async (event) => {
            if (event.type === 'concept_finalized' && event.logo) {
              entry.job.logos = [...(entry.job.logos ?? []).filter((l) => l.id !== event.logo!.id), event.logo];
            }
          },
          true,
          preferences
        );

        const produced = logos.length > 0;
        await this.finish(entry, entry.cancelled ? 'cancelled' : produced ? 'done' : 'failed', produced);
        if (!produced && !entry.cancelled) entry.job.error = 'generation_failed';
      } catch (error: any) {
        logger.error(`Régénération des logos échouée (${projectId}) : ${error.message}`, { stack: error.stack });
        entry.job.error = 'generation_failed';
        await this.finish(entry, entry.cancelled ? 'cancelled' : 'failed', (entry.job.logos?.length ?? 0) > 0);
      }
    });

    return entry.job;
  }

  /** Nouvelles palettes OU nouvelles polices. Rend la main aussitôt. */
  startProposals(
    userId: string,
    projectId: string,
    kind: 'colors' | 'typography',
    project: ProjectModel,
    billing?: BillingRequestContext
  ): IdentityJob {
    const entry = this.begin(userId, projectId, kind, billing);

    this.inBackground(kind, async () => {
      try {
        const result = await this.branding.generateColorsAndTypography(
          userId,
          project,
          kind,
          () => entry.cancelled
        );
        if (kind === 'colors') entry.job.colors = result.colors;
        else entry.job.typography = result.typography;
        await this.finish(entry, 'done', true);
      } catch (error: any) {
        if (error instanceof GenerationCancelledError) {
          await this.finish(entry, 'cancelled', false);
          return;
        }
        logger.error(`Régénération ${kind} échouée (${projectId}) : ${error.message}`, { stack: error.stack });
        entry.job.error = 'generation_failed';
        await this.finish(entry, 'failed', false);
      }
    });

    return entry.job;
  }

  static isLogoType(value: unknown): value is LogoType {
    return LOGO_TYPES.includes(value as LogoType);
  }
}

export const identityJobsService = new IdentityJobsService();
