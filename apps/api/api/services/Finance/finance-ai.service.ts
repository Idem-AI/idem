/**
 * FinanceAIService — couche IA du module Finance.
 *
 * Responsabilités:
 *  - Auto-fill d'une section (ou globale) à partir du contexte projet/BP.
 *  - Parsing d'intentions conversationnelles (chat) pour permettre les
 *    modifications du module Finance via le Business Advisor.
 *  - Génération d'un résumé synthétique en langage naturel.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import {
  AISuggestion,
  createEmptyFinanceModel,
  FinanceModel,
  zerosMonthly,
} from '../../models/finance.model';
import { FinanceService, financeService } from './finance.service';
import {
  FINANCE_AUTOFILL_GLOBAL_PROMPT,
  FINANCE_AUTOFILL_SYSTEM_PROMPT,
  FINANCE_CHAT_INTENT_PROMPT,
  FINANCE_SECTION_PROMPTS,
} from './prompts/finance-autofill.prompt';
import { SectionSource } from '../../models/section.model';
import { DeliverableSection } from '../research/research.types';

export type FinanceSectionKey =
  | 'products'
  | 'salesObjectives'
  | 'revenueParams'
  | 'variableCharges'
  | 'fixedCharges'
  | 'taxesParams'
  | 'investments'
  | 'financing';

export interface FinanceAutoFillResult {
  finance: FinanceModel;
  suggestionsAdded: AISuggestion[];
  /** Sources web réelles ayant servi de benchmark (mode sourcé). */
  sources?: SectionSource[];
}

export interface FinanceChatIntent {
  isFinanceIntent: boolean;
  kind:
    | 'read_summary'
    | 'read_section'
    | 'update_field'
    | 'add_line'
    | 'delete_line'
    | 'none';
  section?: FinanceSectionKey | null;
  target?: string | null;
  fieldPath?: string | null;
  value?: number | string | null;
  month?: number | null;
  year?: number | null;
  confirmationSentence?: string | null;
  summaryText?: string | null;
}

const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  provider: AI_CONFIG.finance.autofill.provider,
  modelName: AI_CONFIG.finance.autofill.modelName,
  promptType: AI_CONFIG.finance.autofill.promptType,
  llmOptions: {
    ...AI_CONFIG.finance.autofill.llmOptions,
  },
};


export class FinanceAIService {
  private readonly projectRepository: IRepository<ProjectModel>;

  constructor(private readonly promptService: PromptService) {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
    logger.info('FinanceAIService initialized.');
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /** Auto-fill d'une section précise. Retourne le modèle finance mis à jour. */
  async autoFillSection(
    userId: string,
    projectId: string,
    section: FinanceSectionKey,
  ): Promise<FinanceAutoFillResult> {
    logger.info(`FinanceAI.autoFillSection userId=${userId} projectId=${projectId} section=${section}`);
    const project = await this.loadProject(userId, projectId);
    const currentFinance =
      (await financeService.getFinance(userId, projectId)) || createEmptyFinanceModel(projectId);

    const sectionPrompt = FINANCE_SECTION_PROMPTS[section];
    if (!sectionPrompt) {
      throw new Error(`Unsupported finance section for auto-fill: ${section}`);
    }

    const messages = this.buildMessages(project, currentFinance, sectionPrompt);
    const raw = await this.promptService.runPrompt({ ...DEFAULT_PROMPT_CONFIG, userId }, messages);
    const parsed = this.parseJSON(raw);

    const payload = this.extractSectionPayload(parsed, section, currentFinance);
    const suggestionsAdded: AISuggestion[] = this.extractSuggestions(parsed);

    const updated = await financeService.updateSection(userId, projectId, section, payload);
    if (!updated) throw new Error(`Failed to persist finance section ${section}`);

    if (suggestionsAdded.length > 0) {
      await financeService.appendAISuggestions(userId, projectId, suggestionsAdded);
    }

    const final = (await financeService.getFinance(userId, projectId))!;
    return { finance: final, suggestionsAdded };
  }

  /**
   * Auto-fill GLOBAL — remplit toutes les sections cohérentes ensemble.
   *
   * @param groundedContext Digest de recherche marché sourcé (optionnel). Quand
   *   fourni, les hypothèses chiffrées sont calées sur ces benchmarks réels.
   * @param marketSources Sources réelles associées, rattachées aux suggestions.
   */
  async autoFillAll(
    userId: string,
    projectId: string,
    groundedContext?: string,
    marketSources?: SectionSource[]
  ): Promise<FinanceAutoFillResult> {
    logger.info(
      `FinanceAI.autoFillAll userId=${userId} projectId=${projectId} grounded=${!!groundedContext}`
    );
    const project = await this.loadProject(userId, projectId);
    const currentFinance =
      (await financeService.getFinance(userId, projectId)) || createEmptyFinanceModel(projectId);

    const messages = this.buildMessages(
      project,
      currentFinance,
      FINANCE_AUTOFILL_GLOBAL_PROMPT,
      groundedContext
    );
    const raw = await this.promptService.runPrompt({ ...DEFAULT_PROMPT_CONFIG, userId }, messages);
    const parsed = this.parseJSON(raw);

    // Construit un Partial<FinanceModel> à partir du JSON renvoyé
    const incoming: Partial<FinanceModel> = {};
    if (Array.isArray(parsed.products)) {
      incoming.products = this.normalizeProducts(parsed.products);
    }
    if (Array.isArray(parsed.salesObjectives)) {
      incoming.salesObjectives = this.normalizeSalesObjectives(parsed.salesObjectives);
    }
    if (parsed.revenueParams && typeof parsed.revenueParams === 'object') {
      incoming.revenueParams = parsed.revenueParams;
    }
    if (parsed.variableCharges && typeof parsed.variableCharges === 'object') {
      incoming.variableCharges = this.normalizeChargesContainer(parsed.variableCharges, currentFinance.variableCharges);
    }
    if (parsed.fixedCharges && typeof parsed.fixedCharges === 'object') {
      incoming.fixedCharges = this.normalizeFixedCharges(parsed.fixedCharges, currentFinance.fixedCharges);
    }
    if (Array.isArray(parsed.investments)) {
      incoming.investments = this.normalizeInvestments(parsed.investments);
    }
    if (parsed.financing && typeof parsed.financing === 'object') {
      incoming.financing = parsed.financing;
    }

    const suggestionsAdded = this.extractSuggestions(parsed);
    // Mode sourcé: on rattache les sources réelles et on les cite dans la justification.
    if (marketSources && marketSources.length > 0 && suggestionsAdded.length > 0) {
      const citation = marketSources.map((s) => `[${s.id}] ${s.url}`).join(' · ');
      for (const suggestion of suggestionsAdded) {
        suggestion.sources = marketSources;
        suggestion.justification = `${suggestion.justification} — Sources: ${citation}`.trim();
      }
    }
    if (suggestionsAdded.length > 0) {
      incoming.meta = {
        ...(currentFinance.meta || {}),
        aiSuggestions: [...(currentFinance.meta?.aiSuggestions || []), ...suggestionsAdded],
        lastAutoFilledAt: new Date(),
      } as any;
    }

    const updated = await financeService.replaceFinance(userId, projectId, incoming);
    if (!updated) throw new Error('Failed to persist global finance auto-fill');
    return { finance: updated, suggestionsAdded, sources: marketSources };
  }

  /**
   * Spécifie les axes de recherche marché sourcés pour caler les prévisions
   * financières (prix, coûts, fiscalité, croissance). Consommé par l'équipe
   * d'agents avant l'auto-fill.
   */
  buildMarketResearchSpec(project: ProjectModel): DeliverableSection[] {
    const country = project.additionalInfos?.country || '';
    const geo = country ? ` (zone: ${country})` : '';
    const ctx = `${project.name || ''} — ${project.description || ''}`.slice(0, 300);
    return [
      {
        name: 'Prix de marché',
        instructions:
          'Synthèse des fourchettes de prix de vente constatées pour ce type de produit/service, avec année et zone.',
        needsResearch: true,
        researchBriefs: [
          `Prix de vente pratiqués et fourchettes tarifaires pour ce type d'offre${geo}. Contexte: ${ctx}`,
        ],
      },
      {
        name: 'Structure de coûts',
        instructions:
          'Synthèse des postes de coûts et marges de référence du secteur (coûts unitaires, charges variables/fixes).',
        needsResearch: true,
        researchBriefs: [
          `Structure de coûts, coûts unitaires et marges brutes de référence du secteur${geo}. Contexte: ${ctx}`,
        ],
      },
      {
        name: 'Fiscalité & charges sociales',
        instructions:
          "Synthèse des taux d'imposition sur les sociétés, TVA et taux de charges sociales applicables.",
        needsResearch: true,
        researchBriefs: [
          `Taux d'impôt sur les sociétés, TVA et charges sociales en vigueur${geo}`,
        ],
      },
      {
        name: 'Croissance & adoption',
        instructions:
          "Synthèse des taux de croissance du marché et rythmes d'adoption observés.",
        needsResearch: true,
        researchBriefs: [
          `Taux de croissance annuel du marché et rythme d'adoption pour ce secteur${geo}. Contexte: ${ctx}`,
        ],
      },
    ];
  }

  /** Parse une intention finance à partir d'un message utilisateur. */
  async parseChatIntent(
    userId: string,
    projectId: string,
    userMessage: string,
  ): Promise<FinanceChatIntent> {
    logger.info(`FinanceAI.parseChatIntent userId=${userId} projectId=${projectId}`);
    const project = await this.loadProject(userId, projectId);
    const currentFinance = await financeService.getFinance(userId, projectId);

    const messages: AIChatMessage[] = [
      { role: 'system', content: FINANCE_CHAT_INTENT_PROMPT },
      {
        role: 'system',
        content: `CONTEXTE PROJET:\nNom: ${project.name}\nDescription: ${project.description}\nType: ${project.type}`,
      },
      {
        role: 'system',
        content: `CONTEXTE FINANCE (résumé):\n${this.summarizeFinanceForContext(currentFinance)}`,
      },
      { role: 'user', content: userMessage },
    ];

    const raw = await this.promptService.runPrompt(
      { ...DEFAULT_PROMPT_CONFIG, userId, llmOptions: { ...AI_CONFIG.finance.intent.llmOptions } },
      messages,
    );
    const parsed = this.parseJSON(raw);
    return this.normalizeIntent(parsed);
  }

  /** Applique une intention de modification précédemment confirmée par l'utilisateur. */
  async applyChatIntent(
    userId: string,
    projectId: string,
    intent: FinanceChatIntent,
  ): Promise<FinanceModel | null> {
    if (!intent.isFinanceIntent || !intent.section || !intent.kind) {
      throw new Error('Cannot apply: intent is not a valid finance mutation');
    }
    logger.info(
      `FinanceAI.applyChatIntent userId=${userId} projectId=${projectId} kind=${intent.kind} section=${intent.section}`,
    );
    const currentFinance =
      (await financeService.getFinance(userId, projectId)) || createEmptyFinanceModel(projectId);

    const section = intent.section;
    const updated: any = { ...(currentFinance as any)[section] };

    if (intent.kind === 'update_field' && intent.target && intent.value !== null && intent.value !== undefined) {
      this.applyUpdateField(updated, section, intent);
    } else if (intent.kind === 'add_line' && intent.target) {
      this.applyAddLine(updated, section, intent);
    } else if (intent.kind === 'delete_line' && intent.target) {
      this.applyDeleteLine(updated, section, intent);
    } else {
      throw new Error(`Unsupported intent kind for apply: ${intent.kind}`);
    }

    const result = await financeService.updateSection(userId, projectId, section, updated);
    return result;
  }

  // -------------------------------------------------------------------
  // Helpers — Apply intent
  // -------------------------------------------------------------------

  private applyUpdateField(payload: any, section: string, intent: FinanceChatIntent): void {
    const target = (intent.target || '').toLowerCase();
    const value = Number(intent.value) || 0;

    if (section === 'products') {
      const products = Array.isArray(payload) ? payload : payload?.products || [];
      const match = products.find((p: any) => p.name?.toLowerCase().includes(target));
      if (match) {
        const yearIdx = (intent.year || 1) - 1;
        if (!Array.isArray(match.prices)) match.prices = [];
        match.prices[yearIdx] = value;
      }
    } else if (section === 'fixedCharges') {
      const lines = payload.lines || [];
      const match = lines.find((l: any) => l.label?.toLowerCase().includes(target));
      if (match) {
        match.monthlyValues = Array(36).fill(value);
      } else {
        // Si le poste n'existe pas, on l'ajoute
        lines.push({
          id: uuidv4(),
          category: 'locations',
          label: intent.target || 'Charge',
          monthlyValues: Array(36).fill(value),
        });
        payload.lines = lines;
      }
    } else if (section === 'financing') {
      if (target.includes('apport') || target.includes('capital')) {
        payload.apportCapital = value;
      } else if (target.includes('emprunt') || target.includes('cmt')) {
        payload.cmt = { ...(payload.cmt || {}), amount: value };
      } else if (target.includes('subvention')) {
        payload.subvention = value;
      } else if (target.includes('autofinanc')) {
        payload.autofinancement = value;
      }
    } else if (section === 'salesObjectives') {
      const objectives = Array.isArray(payload) ? payload : [];
      const monthIdx = (intent.month || 1) - 1;
      // Modification sur le premier objectif correspondant — simplification
      const first = objectives[0];
      if (first) {
        if (!Array.isArray(first.monthlyQuantities)) first.monthlyQuantities = zerosMonthly();
        first.monthlyQuantities[monthIdx] = value;
      }
    }
  }

  private applyAddLine(payload: any, section: string, intent: FinanceChatIntent): void {
    const value = Number(intent.value) || 0;
    const label = intent.target || 'Nouvelle ligne';
    const monthIdx = (intent.month || 1) - 1;

    if (section === 'investments') {
      const monthly = Array(36).fill(0);
      monthly[monthIdx] = value;
      const arr = Array.isArray(payload) ? payload : [];
      arr.push({
        id: uuidv4(),
        category: 'materielOutillageIndustriel',
        amortGroup: 'materielOutillage',
        label,
        monthlyValues: monthly,
      });
      // Mutation in-place for array case
      if (Array.isArray(payload)) (payload as any).length = arr.length;
    } else if (section === 'variableCharges' || section === 'fixedCharges') {
      const lines = payload.lines || [];
      const monthly = Array(36).fill(value);
      lines.push({
        id: uuidv4(),
        category: section === 'variableCharges' ? 'autresChargesExternes' : 'locations',
        label,
        monthlyValues: monthly,
      });
      payload.lines = lines;
    }
  }

  private applyDeleteLine(payload: any, section: string, intent: FinanceChatIntent): void {
    const target = (intent.target || '').toLowerCase();
    if (section === 'variableCharges' || section === 'fixedCharges') {
      payload.lines = (payload.lines || []).filter(
        (l: any) => !l.label?.toLowerCase().includes(target),
      );
    } else if (section === 'investments') {
      const arr = Array.isArray(payload) ? payload : [];
      const filtered = arr.filter((l: any) => !l.label?.toLowerCase().includes(target));
      (payload as any).length = 0;
      filtered.forEach((x) => (payload as any).push(x));
    } else if (section === 'products') {
      const arr = Array.isArray(payload) ? payload : [];
      const filtered = arr.filter((p: any) => !p.name?.toLowerCase().includes(target));
      (payload as any).length = 0;
      filtered.forEach((x) => (payload as any).push(x));
    }
  }

  // -------------------------------------------------------------------
  // Helpers — LLM I/O
  // -------------------------------------------------------------------

  private async loadProject(userId: string, projectId: string): Promise<ProjectModel> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project;
  }

  private buildMessages(
    project: ProjectModel,
    currentFinance: FinanceModel,
    instructionPrompt: string,
    groundedContext?: string,
  ): AIChatMessage[] {
    const messages: AIChatMessage[] = [
      { role: 'system', content: FINANCE_AUTOFILL_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `CONTEXTE PROJET:\n${this.summarizeProjectForContext(project)}`,
      },
      {
        role: 'system',
        content: `BUSINESS PLAN (sections existantes):\n${this.summarizeBusinessPlanForContext(project)}`,
      },
      {
        role: 'system',
        content: `ÉTAT FINANCE ACTUEL:\n${this.summarizeFinanceForContext(currentFinance)}`,
      },
    ];
    if (groundedContext && groundedContext.trim()) {
      messages.push({
        role: 'system',
        content:
          'BENCHMARKS DE MARCHÉ SOURCÉS (données réelles issues du web — cale tes hypothèses dessus, ' +
          "n'invente aucun chiffre au-delà de ce qui est cohérent avec ces références):\n" +
          groundedContext,
      });
    }
    messages.push({ role: 'user', content: instructionPrompt });
    return messages;
  }

  private summarizeProjectForContext(project: ProjectModel): string {
    return [
      `Nom: ${project.name || '—'}`,
      `Description: ${project.description || '—'}`,
      `Type: ${project.type || '—'}`,
      `Cible: ${project.targets || '—'}`,
      `Scope: ${project.scope || '—'}`,
      `Taille équipe: ${project.teamSize || '—'}`,
      `Budget: ${project.budgetIntervals || '—'}`,
      `Pays: ${project.additionalInfos?.country || '—'}`,
    ].join('\n');
  }

  private summarizeBusinessPlanForContext(project: ProjectModel): string {
    const bp: any = project.analysisResultModel?.businessPlan;
    if (!bp || !bp.sections || bp.sections.length === 0) return 'Aucun business plan disponible.';

    const IMPORTANT_SECTIONS = [
      'company summary',
      'opportunity',
      'products & services',
      'products services',
      'marketing & sales',
      'marketing sales',
      'financial plan'
    ];

    return bp.sections
      .filter((s: any) => s && s.name && IMPORTANT_SECTIONS.includes(s.name.toLowerCase()))
      .map((s: any) => `### ${s.name}\n${s.summary || s.data?.slice(0, 800) || ''}`)
      .join('\n\n');
  }

  private summarizeFinanceForContext(finance: FinanceModel | null): string {
    if (!finance) return 'Aucune donnée finance.';
    const products = finance.products.map((p) => `- ${p.name}: ${p.prices?.[0] || 0} FCFA`).join('\n');
    const salaries = finance.fixedCharges.salaries
      .map((s) => `- ${s.position}: ${s.monthlyValues?.[0] || 0} FCFA/mois`)
      .join('\n');
    return [
      `Produits (${finance.products.length}):\n${products || '—'}`,
      `Salaires (${finance.fixedCharges.salaries.length}):\n${salaries || '—'}`,
      `Apport capital: ${finance.financing.apportCapital} FCFA`,
      `Devise: ${finance.meta.currency}`,
    ].join('\n');
  }

  /** Extrait le JSON depuis une réponse LLM (tolère le markdown). */
  private parseJSON(raw: string): any {
    const cleaned = this.promptService.getCleanAIText(raw).trim();
    // Retire éventuels backticks
    const stripped = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(stripped);
    } catch (err: any) {
      // Tente d'extraire le plus large JSON object
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* fall through */
        }
      }
      logger.error(`FinanceAI.parseJSON failed: ${err.message}`, { snippet: stripped.slice(0, 300) });
      throw new Error('Invalid JSON returned by LLM');
    }
  }

  private extractSuggestions(parsed: any): AISuggestion[] {
    if (!Array.isArray(parsed?.aiSuggestions)) return [];
    return parsed.aiSuggestions
      .filter((s: any) => s && typeof s === 'object' && s.fieldPath)
      .map((s: any) => ({
        fieldPath: String(s.fieldPath),
        value: s.value,
        justification: String(s.justification || ''),
        generatedAt: new Date(),
        model: DEFAULT_PROMPT_CONFIG.modelName,
      }));
  }

  /** Pour une section donnée, extrait le payload typé depuis le JSON renvoyé par l'IA. */
  private extractSectionPayload(
    parsed: any,
    section: FinanceSectionKey,
    current: FinanceModel,
  ): any {
    switch (section) {
      case 'products':
        return this.normalizeProducts(parsed.products || []);
      case 'salesObjectives':
        return this.normalizeSalesObjectives(parsed.salesObjectives || []);
      case 'variableCharges':
        return this.normalizeChargesContainer(parsed.variableCharges, current.variableCharges);
      case 'fixedCharges':
        return this.normalizeFixedCharges(parsed.fixedCharges, current.fixedCharges);
      case 'investments':
        return this.normalizeInvestments(parsed.investments || []);
      case 'financing':
        return { ...current.financing, ...(parsed.financing || {}) };
      case 'revenueParams':
        return { ...current.revenueParams, ...(parsed.revenueParams || {}) };
      case 'taxesParams':
        return { ...current.taxesParams, ...(parsed.taxesParams || {}) };
      default:
        return parsed;
    }
  }

  // -------------------------------------------------------------------
  // Normalizers (assurent que les tableaux ont la bonne taille)
  // -------------------------------------------------------------------

  private padMonthly(arr: any[]): number[] {
    const out = zerosMonthly();
    for (let i = 0; i < Math.min(arr.length, 36); i++) {
      out[i] = Number(arr[i]) || 0;
    }
    return out;
  }

  private normalizeProducts(products: any[]): any[] {
    return products.map((p) => ({
      id: p.id || uuidv4(),
      name: String(p.name || 'Produit'),
      prices: Array.isArray(p.prices) ? p.prices.map((x: any) => Number(x) || 0) : [0],
      unitCosts: Array.isArray(p.unitCosts) ? p.unitCosts.map((x: any) => Number(x) || 0) : [0],
    }));
  }

  private normalizeSalesObjectives(objs: any[]): any[] {
    return objs.map((o) => ({
      productId: String(o.productId || ''),
      monthlyQuantities: this.padMonthly(o.monthlyQuantities || []),
      growthRateFromMonth25: o.growthRateFromMonth25,
    }));
  }

  private normalizeChargesContainer(input: any, fallback: any): any {
    if (!input) return fallback;
    return {
      lines: Array.isArray(input.lines)
        ? input.lines.map((l: any) => ({
            id: l.id || uuidv4(),
            category: String(l.category || 'autresChargesExternes'),
            label: String(l.label || 'Charge'),
            monthlyValues: this.padMonthly(l.monthlyValues || []),
          }))
        : fallback.lines,
      supplierDebtRatePct:
        typeof input.supplierDebtRatePct === 'number'
          ? input.supplierDebtRatePct
          : fallback.supplierDebtRatePct,
      safetyStockRatePct:
        typeof input.safetyStockRatePct === 'number'
          ? input.safetyStockRatePct
          : fallback.safetyStockRatePct,
    };
  }

  private normalizeFixedCharges(input: any, fallback: any): any {
    if (!input) return fallback;
    return {
      lines: Array.isArray(input.lines)
        ? input.lines.map((l: any) => ({
            id: l.id || uuidv4(),
            category: String(l.category || 'locations'),
            label: String(l.label || 'Charge'),
            monthlyValues: this.padMonthly(l.monthlyValues || []),
          }))
        : fallback.lines,
      salaries: Array.isArray(input.salaries)
        ? input.salaries.map((s: any) => ({
            id: s.id || uuidv4(),
            position: String(s.position || 'Poste'),
            monthlyValues: this.padMonthly(s.monthlyValues || []),
          }))
        : fallback.salaries,
      socialChargesRatePct:
        typeof input.socialChargesRatePct === 'number'
          ? input.socialChargesRatePct
          : fallback.socialChargesRatePct,
      tusRatePct:
        typeof input.tusRatePct === 'number' ? input.tusRatePct : fallback.tusRatePct,
    };
  }

  private normalizeInvestments(invs: any[]): any[] {
    return invs.map((i) => ({
      id: i.id || uuidv4(),
      category: String(i.category || 'materielOutillageIndustriel'),
      amortGroup: String(i.amortGroup || 'materielOutillage'),
      label: String(i.label || 'Investissement'),
      monthlyValues: this.padMonthly(i.monthlyValues || []),
      amortRateOverridePct: i.amortRateOverridePct,
    }));
  }

  private normalizeIntent(parsed: any): FinanceChatIntent {
    if (!parsed || typeof parsed !== 'object') {
      return { isFinanceIntent: false, kind: 'none' };
    }
    return {
      isFinanceIntent: !!parsed.isFinanceIntent,
      kind: parsed.kind || 'none',
      section: parsed.section || null,
      target: parsed.target || null,
      fieldPath: parsed.fieldPath || null,
      value: parsed.value ?? null,
      month: typeof parsed.month === 'number' ? parsed.month : null,
      year: typeof parsed.year === 'number' ? parsed.year : null,
      confirmationSentence: parsed.confirmationSentence || null,
      summaryText: parsed.summaryText || null,
    };
  }
}

export const financeAIService = new FinanceAIService(new PromptService());
