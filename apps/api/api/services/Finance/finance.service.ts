/**
 * Service Finance — orchestre la persistance des données financières d'un projet
 * et déclenche les recalculs à chaque mutation.
 *
 * Les données sont stockées dans `project.analysisResultModel.finance` afin de
 * réutiliser l'infrastructure existante (auth, ownership, schemas Mongoose).
 */

import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { ProjectModel } from '../../models/project.model';
import {
  AISuggestion,
  createEmptyFinanceModel,
  FinanceModel,
  SectionCompletionStatus,
} from '../../models/finance.model';
import { computeFinance } from './finance-calculator.service';
import logger from '../../config/logger';

type SectionKey =
  | 'products'
  | 'salesObjectives'
  | 'revenueParams'
  | 'variableCharges'
  | 'fixedCharges'
  | 'taxesParams'
  | 'investments'
  | 'financing'
  | 'ratiosParams';

/** Mapping section input -> clé de completionStatus dans le modèle */
const SECTION_TO_COMPLETION: Record<SectionKey, keyof FinanceModel['meta']['completionStatus']> = {
  products: 'products',
  salesObjectives: 'salesObjectives',
  revenueParams: 'revenue',
  variableCharges: 'variableCharges',
  fixedCharges: 'fixedCharges',
  taxesParams: 'taxes',
  investments: 'investments',
  financing: 'financing',
  ratiosParams: 'taxes', // pas de section dédiée -> regroupé
};

export class FinanceService {
  private projectRepository: IRepository<ProjectModel>;

  constructor() {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  // -------------------------------------------------------------------
  // Helpers internes
  // -------------------------------------------------------------------

  private collectionPath(userId: string): string {
    return `users/${userId}/projects`;
  }

  /** Récupère le projet et son modèle Finance (créé vide si absent) */
  private async loadFinanceFromProject(
    userId: string,
    projectId: string
  ): Promise<{ project: ProjectModel; finance: FinanceModel } | null> {
    const project = await this.projectRepository.findById(projectId, this.collectionPath(userId));
    if (!project) {
      logger.warn(`Finance: project not found ${projectId} for user ${userId}`);
      return null;
    }
    const existing: FinanceModel | undefined = (project as any).analysisResultModel?.finance;
    const finance: FinanceModel = existing
      ? this.ensureFinanceShape(existing, projectId)
      : createEmptyFinanceModel(projectId);
    return { project, finance };
  }

  /** Assure la rétro-compatibilité si le modèle stocké est partiel */
  private ensureFinanceShape(stored: any, projectId: string): FinanceModel {
    const base = createEmptyFinanceModel(projectId);
    return {
      ...base,
      ...stored,
      projectId,
      revenueParams: { ...base.revenueParams, ...(stored.revenueParams || {}) },
      variableCharges: { ...base.variableCharges, ...(stored.variableCharges || {}) },
      fixedCharges: { ...base.fixedCharges, ...(stored.fixedCharges || {}) },
      taxesParams: { ...base.taxesParams, ...(stored.taxesParams || {}) },
      amortizationDefaults: {
        ...base.amortizationDefaults,
        ...(stored.amortizationDefaults || {}),
      },
      financing: { ...base.financing, ...(stored.financing || {}) },
      ratiosParams: { ...base.ratiosParams, ...(stored.ratiosParams || {}) },
      meta: {
        ...base.meta,
        ...(stored.meta || {}),
        completionStatus: {
          ...base.meta.completionStatus,
          ...((stored.meta && stored.meta.completionStatus) || {}),
        },
        aiSuggestions: (stored.meta && stored.meta.aiSuggestions) || [],
      },
      products: stored.products || [],
      salesObjectives: stored.salesObjectives || [],
      investments: stored.investments || [],
      createdAt: stored.createdAt ? new Date(stored.createdAt) : base.createdAt,
      updatedAt: new Date(),
    };
  }

  /** Sauvegarde le modèle Finance dans le projet et déclenche le recalcul */
  private async saveFinance(
    userId: string,
    projectId: string,
    project: ProjectModel,
    finance: FinanceModel
  ): Promise<FinanceModel> {
    // Recalcul automatique avant sauvegarde
    try {
      finance.computed = computeFinance(finance);
      finance.meta.lastCalculatedAt = new Date();
    } catch (err: any) {
      logger.error(`Finance: compute failed for project ${projectId}: ${err.message}`, {
        stack: err.stack,
      });
    }
    finance.updatedAt = new Date();

    const analysisResultModel = {
      ...((project as any).analysisResultModel || {}),
      finance,
    };

    const updated = await this.projectRepository.update(
      projectId,
      { analysisResultModel } as any,
      this.collectionPath(userId)
    );

    if (!updated) {
      throw new Error(`Failed to persist finance for project ${projectId}`);
    }
    return finance;
  }

  /** Calcule automatiquement le statut de complétion d'une section */
  private computeSectionStatus(finance: FinanceModel, section: SectionKey): SectionCompletionStatus {
    switch (section) {
      case 'products':
        if (finance.products.length === 0) return 'empty';
        return finance.products.every((p) => p.name && p.prices.length > 0)
          ? 'completed'
          : 'in_progress';
      case 'salesObjectives':
        if (finance.salesObjectives.length === 0) return 'empty';
        return finance.salesObjectives.every((s) =>
          s.monthlyQuantities.some((q) => q > 0)
        )
          ? 'completed'
          : 'in_progress';
      case 'variableCharges':
        return finance.variableCharges.lines.length === 0 ? 'empty' : 'completed';
      case 'fixedCharges':
        return finance.fixedCharges.lines.length + finance.fixedCharges.salaries.length === 0
          ? 'empty'
          : 'completed';
      case 'investments':
        return finance.investments.length === 0 ? 'empty' : 'completed';
      case 'financing':
        return finance.financing.apportCapital +
          finance.financing.cmt.amount +
          finance.financing.creditBail.amount +
          finance.financing.compteCourantAssocies.amount >
          0
          ? 'completed'
          : 'empty';
      default:
        return 'completed';
    }
  }

  // -------------------------------------------------------------------
  // API publique
  // -------------------------------------------------------------------

  /**
   * Récupère le modèle Finance complet d'un projet (avec computed).
   * Crée un modèle vide si absent.
   */
  async getFinance(userId: string, projectId: string): Promise<FinanceModel | null> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return null;
    const { finance } = ctx;
    // S'assure que computed est à jour pour les lectures
    if (!finance.computed) {
      try {
        finance.computed = computeFinance(finance);
      } catch (err: any) {
        logger.error(`Finance: compute on read failed: ${err.message}`);
      }
    }
    return finance;
  }

  /** Remplace l'intégralité du modèle Finance (utilisé après auto-fill IA global) */
  async replaceFinance(
    userId: string,
    projectId: string,
    incoming: Partial<FinanceModel>
  ): Promise<FinanceModel | null> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return null;
    const merged: FinanceModel = {
      ...ctx.finance,
      ...incoming,
      projectId,
      meta: {
        ...ctx.finance.meta,
        ...(incoming.meta || {}),
        completionStatus: {
          ...ctx.finance.meta.completionStatus,
          ...((incoming.meta && incoming.meta.completionStatus) || {}),
        },
        aiSuggestions: [
          ...ctx.finance.meta.aiSuggestions,
          ...((incoming.meta && incoming.meta.aiSuggestions) || []),
        ],
      },
    };
    return this.saveFinance(userId, projectId, ctx.project, merged);
  }

  /** Met à jour une section précise et recalcule */
  async updateSection<K extends SectionKey>(
    userId: string,
    projectId: string,
    section: K,
    payload: FinanceModel[K]
  ): Promise<FinanceModel | null> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return null;
    const finance = ctx.finance;
    (finance as any)[section] = payload;
    // Mise à jour automatique du statut de complétion correspondant
    const completionKey = SECTION_TO_COMPLETION[section];
    finance.meta.completionStatus[completionKey] = this.computeSectionStatus(finance, section);
    return this.saveFinance(userId, projectId, ctx.project, finance);
  }

  /** Ajoute des justifications IA (issues d'un auto-fill) */
  async appendAISuggestions(
    userId: string,
    projectId: string,
    suggestions: AISuggestion[]
  ): Promise<FinanceModel | null> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return null;
    ctx.finance.meta.aiSuggestions.push(...suggestions);
    ctx.finance.meta.lastAutoFilledAt = new Date();
    return this.saveFinance(userId, projectId, ctx.project, ctx.finance);
  }

  /** Supprime totalement le modèle Finance d'un projet */
  async deleteFinance(userId: string, projectId: string): Promise<boolean> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return false;
    const analysisResultModel = { ...((ctx.project as any).analysisResultModel || {}) };
    delete analysisResultModel.finance;
    await this.projectRepository.update(
      projectId,
      { analysisResultModel } as any,
      this.collectionPath(userId)
    );
    return true;
  }

  /** Force un recalcul (utile après import ou modification manuelle externe) */
  async recompute(userId: string, projectId: string): Promise<FinanceModel | null> {
    const ctx = await this.loadFinanceFromProject(userId, projectId);
    if (!ctx) return null;
    return this.saveFinance(userId, projectId, ctx.project, ctx.finance);
  }

  /**
   * Récupère un résumé synthétique adapté au dashboard et au business advisor.
   * Utilisé pour l'alerte IA globale et les réponses du chat.
   */
  async getSummary(userId: string, projectId: string): Promise<{
    finance: FinanceModel;
    summary: {
      caY1: number;
      caY2: number;
      caY3: number;
      resultatNetY1: number;
      resultatNetY2: number;
      resultatNetY3: number;
      margeBrutePct: number;
      tresorerieClotureY1: number;
      pointMortJours: number;
      bfr: number;
      coutTotalProjet: number;
      tri: number;
      van: number;
      alerts: string[];
    };
  } | null> {
    const finance = await this.getFinance(userId, projectId);
    if (!finance || !finance.computed) return null;
    const c = finance.computed;
    const ce = c.compteExploitation;
    const seuil = c.seuilRentabilite;

    const alerts: string[] = [];
    if (c.fluxTresorerie.some((f) => f.tresorerieCloture < 0)) {
      const month = c.fluxTresorerie.findIndex((f) => f.tresorerieCloture < 0);
      alerts.push(
        `Votre trésorerie devient négative en année ${month + 1} — anticipez un besoin de financement.`
      );
    }
    if (seuil[0] && seuil[0].pointMortJours > 0) {
      alerts.push(
        `Votre point mort est atteint au jour ${Math.round(seuil[0].pointMortJours)}.`
      );
    }
    const emptyCount = Object.values(finance.meta.completionStatus).filter((s) => s === 'empty').length;
    if (emptyCount > 0) {
      alerts.push(
        `${emptyCount} section${emptyCount > 1 ? 's' : ''} encore vide${emptyCount > 1 ? 's' : ''} — voulez-vous que l'IA les complète automatiquement ?`
      );
    }

    return {
      finance,
      summary: {
        caY1: ce[0]?.chiffreAffaires || 0,
        caY2: ce[1]?.chiffreAffaires || 0,
        caY3: ce[2]?.chiffreAffaires || 0,
        resultatNetY1: ce[0]?.resultatNet || 0,
        resultatNetY2: ce[1]?.resultatNet || 0,
        resultatNetY3: ce[2]?.resultatNet || 0,
        margeBrutePct: ce[0]?.tauxMargePct || 0,
        tresorerieClotureY1: c.fluxTresorerie[0]?.tresorerieCloture || 0,
        pointMortJours: seuil[0]?.pointMortJours || 0,
        bfr: c.bfr.monthlyBfr[c.bfr.monthlyBfr.length - 1] || 0,
        coutTotalProjet: c.financing.coutTotalProjet,
        tri: c.ratios.tri,
        van: c.ratios.van,
        alerts,
      },
    };
  }
}

export const financeService = new FinanceService();
