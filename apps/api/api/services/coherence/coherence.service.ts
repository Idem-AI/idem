import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import { ProjectSectionKey } from '../../models/revision.model';
import {
  CoherenceAlertModel,
  CoherenceIssue,
  CoherenceProposal,
} from '../../models/coherence.model';
import { CoherenceAlert } from '../../schemas/coherence.schema';
import { AIChatMessage, promptService } from '../prompt.service';
import { markRevisionAsAI, suppressCoherenceTrigger } from '../../utils/revision-context.util';
import { logAIEvent } from '../../utils/ai-trace.util';
import { sectionHasContent, sectionRegistry, summarizeValue } from '../context-engine/context-registry';
import { CoherenceRule, getRule, rulesForSection } from './coherence-rules';

/**
 * Coherence Guard — maintient la synchronisation intelligente entre artefacts.
 *
 * Déclenchement : à chaque écriture projet, le hook Chronicle appelle
 * onSectionsChanged() ; les règles concernées sont auditées par IA après un
 * debounce (les rafales d'écritures ne coûtent qu'un audit).
 *
 * Principe produit : détection AUTOMATIQUE, application EXPLICITE. L'IA propose
 * (alerte + propositions), l'utilisateur confirme (ou l'advisor applique après
 * confirmation dans le chat) — jamais d'écrasement silencieux des données.
 */

const DEBOUNCE_MS = 8_000;
/** Plafond du debounce: des écritures continues (autosave) ne repoussent plus l'audit indéfiniment. */
const MAX_DEBOUNCE_WAIT_MS = 60_000;
const SECTION_CONTEXT_MAX_CHARS = 7_000;
/** Code MongoDB pour une violation de contrainte unique (course gagnée par un autre audit/apply concurrent). */
const MONGO_DUPLICATE_KEY_ERROR = 11000;

const COHERENCE_SYSTEM_PROMPT = `Tu es un auditeur de cohérence pour la plateforme IDEM.
On te donne deux artefacts d'un même projet d'entreprise et le contrat de cohérence qui les lie.
Ta mission: détecter les incohérences RÉELLES et importantes (contradictions de fond, données manquantes d'un côté alors que l'autre les définit). Ignore les différences de formulation ou de niveau de détail.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, au format:
{
  "coherent": boolean,
  "analysis": "diagnostic en 2-4 phrases, en français",
  "issues": [
    {
      "description": "l'incohérence constatée",
      "targetSection": "la section à corriger",
      "suggestedAction": "l'action concrète recommandée"
    }
  ],
  "financeAutofillRecommended": boolean
}

"financeAutofillRecommended" = true si la section finance est vide ou très incomplète alors que le business plan définit un modèle économique exploitable — DANS CE CAS, mets-le à true MÊME SI tu réponds coherent=true avec issues=[] (une finance vide n'est pas "incohérente" en soi, mais reste une action recommandée: ce champ est indépendant de "coherent").
Si les deux artefacts sont cohérents et qu'il n'y a rien à recommander (ou si l'un des deux est trop vide pour juger sans rapport avec l'autre), renvoie coherent=true, issues=[], financeAutofillRecommended=false.`;

export class CoherenceService {
  private readonly projectRepository: IRepository<ProjectModel>;
  private readonly pendingChecks = new Map<string, NodeJS.Timeout>();
  /** Horodatage de la 1ère écriture de la rafale en cours, par clé — sert au plafond de debounce. */
  private readonly pendingSince = new Map<string, number>();

  constructor() {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  /**
   * Point d'entrée appelé par le hook Chronicle après chaque écriture projet.
   * Programme (avec debounce) un audit pour chaque règle touchée.
   *
   * Le délai avant exécution est plafonné à MAX_DEBOUNCE_WAIT_MS: une rafale
   * d'écritures continues (autosave toutes les ~5s) repousserait sinon l'audit
   * indéfiniment tant que l'utilisateur édite (famine).
   */
  onSectionsChanged(
    projectId: string,
    userId: string,
    changedSections: ProjectSectionKey[]
  ): void {
    if (process.env.COHERENCE_CHECKS_ENABLED === 'false') return;

    const rules = new Map<string, { rule: CoherenceRule; trigger: ProjectSectionKey }>();
    for (const section of changedSections) {
      for (const rule of rulesForSection(section)) {
        if (!rules.has(rule.id)) rules.set(rule.id, { rule, trigger: section });
      }
    }

    const now = Date.now();
    for (const { rule, trigger } of rules.values()) {
      const key = `${projectId}:${rule.id}`;
      const existing = this.pendingChecks.get(key);
      if (existing) clearTimeout(existing);

      const since = this.pendingSince.get(key) ?? now;
      if (!this.pendingSince.has(key)) this.pendingSince.set(key, now);
      const elapsed = now - since;
      const delay = Math.max(0, Math.min(DEBOUNCE_MS, MAX_DEBOUNCE_WAIT_MS - elapsed));

      const timer = setTimeout(() => {
        this.pendingChecks.delete(key);
        this.pendingSince.delete(key);
        this.checkRule(userId, projectId, rule.id, trigger).catch((err) =>
          logger.error(`CoherenceService scheduled check failed (${key}): ${err.message}`)
        );
      }, delay);
      // Ne bloque pas l'arrêt propre du process en attendant ce timer.
      timer.unref?.();
      this.pendingChecks.set(key, timer);

      logger.info(`CoherenceService: audit "${rule.id}" programmé pour ${projectId} (déclencheur: ${trigger}, delayMs=${delay})`);
      logAIEvent('coherence.scheduled', { ruleId: rule.id, projectId, trigger, delayMs: delay });
    }
  }

  /**
   * Audite une règle: compare les deux sections via IA, remplace l'éventuelle
   * alerte ouverte précédente, crée une nouvelle alerte si incohérence.
   * Retourne l'alerte créée, ou null si tout est cohérent.
   */
  async checkRule(
    userId: string,
    projectId: string,
    ruleId: string,
    triggeredBySection?: ProjectSectionKey
  ): Promise<CoherenceAlertModel | null> {
    const rule = getRule(ruleId);
    if (!rule) throw new Error(`Règle de cohérence inconnue: "${ruleId}"`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) throw new Error(`Projet introuvable: ${projectId}`);

    const [keyA, keyB] = rule.sections;
    const valueA = sectionRegistry.get(keyA)!.extract(project);
    const valueB = sectionRegistry.get(keyB)!.extract(project);

    // Rien à auditer si les deux sections sont vides.
    if (!sectionHasContent(valueA) && !sectionHasContent(valueB)) {
      await this.supersedeOpenAlerts(projectId, ruleId);
      return null;
    }

    const messages: AIChatMessage[] = [
      { role: 'system', content: COHERENCE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `CONTRAT DE COHÉRENCE (règle "${rule.id}"):`,
          rule.contract,
          '',
          `=== SECTION "${keyA}" ===`,
          this.serializeSection(valueA),
          '',
          `=== SECTION "${keyB}" ===`,
          this.serializeSection(valueB),
        ].join('\n'),
      },
    ];

    const raw = await promptService.runPrompt(
      {
        provider: AI_CONFIG.default.provider,
        modelName: AI_CONFIG.default.modelName,
        // Audit initié par le système: ne consomme pas le quota utilisateur.
        skipQuotaCheck: true,
        llmOptions: { temperature: 0.2, maxOutputTokens: 2048 },
      },
      messages
    );
    const verdict = this.parseVerdict(raw);
    const hasFinanceProposal = rule.supportsFinanceAutofill && verdict.financeAutofillRecommended;

    logAIEvent('coherence.verdict', {
      ruleId,
      projectId,
      coherent: verdict.coherent,
      issuesCount: verdict.issues.length,
      financeAutofillRecommended: verdict.financeAutofillRecommended,
    });

    await this.supersedeOpenAlerts(projectId, ruleId);

    // Une alerte est créée dès qu'il y a quelque chose à proposer — incohérence
    // détectée OU recommandation d'autofill — indépendamment du booléen
    // "coherent" (une finance vide n'est pas "incohérente" en soi mais reste
    // une action à proposer).
    if (verdict.issues.length === 0 && !hasFinanceProposal) {
      logger.info(`CoherenceService: "${ruleId}" cohérent pour ${projectId}, rien à proposer`);
      return null;
    }

    const proposals: CoherenceProposal[] = verdict.issues.map((issue) => ({
      id: uuidv4(),
      kind: 'manual',
      targetSection: issue.targetSection,
      description: issue.suggestedAction,
    }));

    if (hasFinanceProposal) {
      proposals.unshift({
        id: uuidv4(),
        kind: 'finance_autofill',
        targetSection: 'finance',
        description:
          'Remplir automatiquement les prévisions financières à partir du business plan (produits, prix, charges, investissements) — vous pourrez ajuster ensuite.',
      });
    }

    const alert: CoherenceAlertModel = {
      projectId,
      userId,
      ruleId,
      status: 'open',
      analysis:
        verdict.analysis ||
        (hasFinanceProposal
          ? 'Le business plan définit un modèle économique, mais les prévisions financières sont vides ou très incomplètes.'
          : 'Incohérence détectée.'),
      issues: verdict.issues,
      proposals,
      triggeredBySection: triggeredBySection ?? rule.sections[0],
    };

    try {
      const created = await CoherenceAlert.create(alert);
      logger.info(
        `CoherenceService: alerte "${ruleId}" créée pour ${projectId} (${verdict.issues.length} incohérence(s), autofill=${hasFinanceProposal})`
      );
      logAIEvent('coherence.alert_created', {
        ruleId,
        projectId,
        issuesCount: verdict.issues.length,
        hasFinanceProposal,
      });
      return { ...alert, id: created._id?.toString() };
    } catch (err: any) {
      // Index unique partiel (projectId, ruleId, status='open'): un autre audit
      // concurrent (autre instance, ou requête POST /check manuelle en parallèle
      // du debounce) a créé sa propre alerte 'open' entre notre supersede et
      // notre create. On abandonne proprement plutôt que produire un doublon —
      // l'alerte gagnante reflète un audit tout aussi récent.
      if (err?.code === MONGO_DUPLICATE_KEY_ERROR) {
        logger.info(
          `CoherenceService: audit "${ruleId}" pour ${projectId} abandonné (alerte concurrente déjà créée)`
        );
        return null;
      }
      throw err;
    }
  }

  /** Alertes d'un projet (ouvertes par défaut). Filtrées par propriétaire (anti-IDOR). */
  async listAlerts(
    projectId: string,
    userId: string,
    options: { status?: string; limit?: number } = {}
  ): Promise<CoherenceAlertModel[]> {
    const query: Record<string, unknown> = { projectId, userId };
    query.status = options.status ?? 'open';

    const docs = await CoherenceAlert.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit ?? 20, 100))
      .lean();

    return docs.map((d) => ({
      id: d._id.toString(),
      projectId: d.projectId,
      userId: d.userId,
      ruleId: d.ruleId,
      status: d.status,
      analysis: d.analysis,
      issues: d.issues ?? [],
      proposals: d.proposals ?? [],
      triggeredBySection: d.triggeredBySection as ProjectSectionKey,
      createdAt: d.createdAt as Date,
      updatedAt: d.updatedAt as Date,
    }));
  }

  /**
   * Applique une proposition d'une alerte ouverte. Seul 'finance_autofill' est
   * automatisable — il réutilise l'autofill Finance existant, avec attribution
   * IA dans Chronicle.
   */
  async applyProposal(
    userId: string,
    projectId: string,
    alertId: string,
    proposalId: string
  ): Promise<{ message: string }> {
    // Transition atomique open→applying, conditionnée sur status='open' dans
    // la requête elle-même: un double-clic ou un doublon d'onglet trouve la
    // requête sans match (l'autre l'a déjà fait passer en 'applying') et
    // échoue proprement au lieu de lancer un second autofill en parallèle.
    const claimed = await CoherenceAlert.findOneAndUpdate(
      { _id: alertId, projectId, userId, status: 'open' },
      { $set: { status: 'applying' } },
      { new: true }
    );
    if (!claimed) {
      const existing = await CoherenceAlert.findOne({ _id: alertId, projectId, userId }).lean();
      if (!existing) throw new Error(`Alerte introuvable: ${alertId}`);
      throw new Error(
        existing.status === 'applying'
          ? 'Cette proposition est déjà en cours d’application.'
          : `Cette alerte n'est plus ouverte (statut: ${existing.status}).`
      );
    }

    const proposal = (claimed.proposals ?? []).find((p) => p.id === proposalId);
    if (!proposal) {
      // Revert: l'alerte n'a rien à faire rester bloquée en 'applying' si la
      // proposition demandée n'existe pas.
      await CoherenceAlert.updateOne({ _id: alertId }, { $set: { status: 'open' } });
      throw new Error(`Proposition introuvable: ${proposalId}`);
    }

    if (proposal.kind !== 'finance_autofill') {
      await CoherenceAlert.updateOne({ _id: alertId }, { $set: { status: 'open' } });
      throw new Error(
        'Cette proposition est une action manuelle — appliquez-la depuis l’éditeur concerné, puis l’alerte sera automatiquement réévaluée.'
      );
    }

    try {
      // Import différé: évite un cycle statique (finance-ai → repository → hook).
      const { financeAIService } = await import('../Finance/finance-ai.service');

      markRevisionAsAI('Synchronisation des finances depuis le business plan (Coherence Guard)');
      suppressCoherenceTrigger();
      await financeAIService.autoFillAll(userId, projectId);

      await CoherenceAlert.updateOne({ _id: alertId }, { $set: { status: 'applied' } });
    } catch (err: any) {
      // L'autofill a échoué: rendre la main à l'utilisateur plutôt que de
      // laisser l'alerte bloquée en 'applying' pour toujours.
      await CoherenceAlert.updateOne({ _id: alertId }, { $set: { status: 'open' } });
      logger.error(`CoherenceService: applyProposal autofill failed (alerte ${alertId}): ${err.message}`);
      throw err;
    }

    logger.info(`CoherenceService: proposition ${proposalId} appliquée (alerte ${alertId})`);
    return {
      message:
        'Prévisions financières synchronisées depuis le business plan. Vérifiez les valeurs et ajustez si besoin.',
    };
  }

  /** Rejette une alerte ouverte (elle ne sera plus proposée pour cet état des données). */
  async dismissAlert(userId: string, projectId: string, alertId: string): Promise<void> {
    const result = await CoherenceAlert.findOneAndUpdate(
      { _id: alertId, projectId, userId, status: 'open' },
      { $set: { status: 'dismissed' } }
    );
    if (!result) {
      const existing = await CoherenceAlert.findOne({ _id: alertId, projectId, userId }).lean();
      if (!existing) throw new Error(`Alerte introuvable: ${alertId}`);
      throw new Error(`Cette alerte n'est plus ouverte (statut: ${existing.status}).`);
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private async supersedeOpenAlerts(projectId: string, ruleId: string): Promise<void> {
    await CoherenceAlert.updateMany(
      { projectId, ruleId, status: 'open' },
      { $set: { status: 'superseded' } }
    );
  }

  private serializeSection(value: unknown): string {
    if (!sectionHasContent(value)) {
      return '(section vide — aucune donnée)';
    }
    const serialized = JSON.stringify(summarizeValue(value), null, 1);
    return serialized.length > SECTION_CONTEXT_MAX_CHARS
      ? `${serialized.slice(0, SECTION_CONTEXT_MAX_CHARS)}\n… [tronqué]`
      : serialized;
  }

  private parseVerdict(raw: string): {
    coherent: boolean;
    analysis: string;
    issues: CoherenceIssue[];
    financeAutofillRecommended: boolean;
  } {
    const cleaned = promptService.getCleanAIText(raw).trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Réponse IA invalide (JSON attendu) pour l’audit de cohérence');
      parsed = JSON.parse(match[0]);
    }

    const issues: CoherenceIssue[] = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((i: any) => i && i.description && i.targetSection)
          .map((i: any) => ({
            description: String(i.description),
            targetSection: String(i.targetSection) as ProjectSectionKey,
            suggestedAction: String(i.suggestedAction || ''),
          }))
      : [];

    return {
      coherent: parsed.coherent !== false,
      analysis: String(parsed.analysis || ''),
      issues,
      financeAutofillRecommended: parsed.financeAutofillRecommended === true,
    };
  }
}

export const coherenceService = new CoherenceService();
