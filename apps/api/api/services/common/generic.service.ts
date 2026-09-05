import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import {
  PromptService,
  LLMProvider,
  PromptRequest,
  PromptConfig,
  AIChatMessage,
} from '../prompt.service';
import { ProjectModel } from '../../models/project.model';
import { SectionModel } from '../../models/section.model';
import { ProjectSectionKey } from '../../models/revision.model';
// File operations have been removed - using in-memory context
import { AI_CONFIG, FeatureAIConfig, resolveSectionConfig } from '../../config/ai.config';
import { applyTier } from '../../config/model-router';

import logger from '../../config/logger';
import { RunBudget, createRunBudget, runAgent, runAgentPrompt } from '../agents/agent-runtime';
import { buildDependencyContext } from '../agents/section-digest.service';
import { QualityExpectation, inspectOutput, qualityValidator } from '../agents/quality-gate';
import { SlopLintOptions, lintHtml } from '../design/slopLint.service';
import { verifySection } from '../agents/section-verifier.service';
import { DeliverableGraph, graphDepth, validateGraph } from '../agents/deliverable-graph';
import { CONTEXT_TOOL_DECLARATIONS, createContextToolExecutor } from '../context-engine/context-tools';
import { DocumentDesignSystem } from '../design/documentDesignSystem';
import { SectionSeed } from '../design/designSeed';
import { Block, normalizeSectionContent } from '../design/sectionContent';
import {
  SECTION_PLAN_CONTRACT,
  describeSectionPlan,
  normalizeSectionPlan,
} from '../design/sectionPlan';
import { RenderOptions, renderSection } from '../design/sectionRenderer';
import {
  SECTION_CONTENT_CONTRACT,
  sectionVolumeDirective,
} from '../design/sectionContent.prompt';
import { parseLlmJson } from '../../utils/llm-json.util';

/**
 * Tout ce dont le rendu d'une section a besoin. Porté par l'étape parce que la
 * graine est PROPRE À LA PAGE (l'archétype varie d'une page à l'autre) alors que
 * le design system est commun au document.
 */
export interface SectionTemplate {
  designSystem: DocumentDesignSystem;
  seed: SectionSeed;
  /** Volume visé, en blocs. Ex : '6 to 8'. */
  volume: string;
  render?: RenderOptions;
  /**
   * Prompt à employer À LA PLACE de `promptConstant` en mode gabarit.
   *
   * Les deux coexistent volontairement sur l'étape : `promptConstant` garde le
   * prompt d'origine, qui décrit une composition HTML, et reste le REPLI quand
   * `IDEM_SECTION_TEMPLATE=off`. Écraser `promptConstant` par le brief aurait
   * rendu l'interrupteur dangereux — la section aurait alors reçu un contrat
   * JSON sans rendu pour le consommer, donc du JSON brut affiché comme page.
   */
  contentBrief?: string;
  /**
   * Blocs posés par le SERVICE, à partir des données réelles du projet, avant
   * ceux que le modèle produit.
   *
   * C'est ainsi qu'une page de nuancier reçoit les vraies valeurs hexadécimales
   * de la charte, une page de typographie les vraies familles, une page de logo
   * les vraies URLs. Ces valeurs ne passent JAMAIS par le modèle : lui demander
   * de recopier six chiffres hexadécimaux, c'est accepter qu'une charte affiche
   * une couleur qui n'est pas celle de la marque.
   *
   * Le modèle garde ce qu'il sait faire : écrire les règles d'usage autour.
   */
  prependBlocks?: Block[];
}

/**
 * Comment une étape reçoit ce que les étapes amont ont produit.
 *
 *  - `digest` (défaut dès qu'il y a des dépendances) : les faits des sections
 *    amont, réduits ~20× (cf. `section-digest.service`). C'est ce qui rend la
 *    cohérence inter-sections finançable.
 *  - `full`   : le texte intégral. À réserver aux étapes qui doivent réécrire ou
 *    prolonger littéralement l'amont — sinon le coût redevient quadratique.
 *  - `none`   : aucune injection.
 */
export type StepContextMode = 'none' | 'digest' | 'full';

// Define interface for prompt step
export interface IPromptStep {
  promptConstant: string;
  stepName: string;
  modelParser?: (content: string) => any;
  // Optional list of specific previous step names this step requires
  // If not provided, all previous steps will be included
  requiresSteps?: string[];
  // Boolean indicating if this step depends on ANY previous steps
  // If false, no previous steps will be included regardless of requiresSteps
  // If true, either all steps or those in requiresSteps will be included
  // If not provided, defaults to true (backward compatibility)
  hasDependencies?: boolean;
  // Maximum output tokens for LLM generation (optimization feature)
  maxOutputTokens?: number;
  /**
   * Réglages IA propres à cette section, déjà fusionnés avec ceux de la feature
   * (voir `resolveSectionConfig`). Posés par `withSectionConfigs`.
   *
   * Ne pas confondre avec `maxOutputTokens` ci-dessus, qui n'est lu nulle part :
   * le budget effectif vient de `aiConfig.llmOptions.maxOutputTokens`.
   */
  aiConfig?: FeatureAIConfig;
  /** Voir `StepContextMode`. Défaut : `digest` si l'étape a des dépendances. */
  contextMode?: StepContextMode;
  /**
   * Rendu par GABARIT : le modèle produit un `SectionContent` (contenu
   * structuré) et le serveur produit le HTML.
   *
   * Absent ⇒ comportement historique, le modèle écrit le HTML lui-même. La
   * bascule se fait donc section par section, ce qui permet de la valider page
   * par page au lieu de tout basculer d'un coup.
   *
   * Quand il est présent, l'étape reçoit le contrat de sortie JSON à la place
   * des consignes de composition, et sa sortie traverse
   * `normalizeSectionContent` puis `renderSection`.
   */
  template?: SectionTemplate;
  /**
   * Préfixe IDENTIQUE à toutes les étapes du livrable — contexte de marque,
   * direction artistique, invariants de composition, règles anti-générique,
   * exemple canonique.
   *
   * Il est émis en TÊTE des messages, avant tout ce qui varie. C'est la seule
   * disposition qui rende un cache de préfixe possible : jusqu'ici ce contexte
   * était concaténé à la FIN de chaque `promptConstant`, derrière la partie
   * variable, si bien que les ~3 400 tokens communs aux neuf sections étaient
   * repayés neuf fois et qu'aucun préfixe ne se répétait jamais.
   *
   * Posé par `withGraph` / `withSectionConfigs`, donc partagé par référence :
   * il n'est pas dupliqué en mémoire.
   */
  stablePrefix?: string;
  /**
   * Autorise l'étape à interroger elle-même le Context Engine (branding,
   * finance, historique…) via le function-calling, au lieu de recevoir ces
   * données empilées dans son prompt « au cas où ».
   *
   * C'est la différence entre pousser 8k tokens de contexte à 9 sections et
   * laisser 2 sections aller chercher les 300 tokens dont elles ont besoin.
   */
  contextTools?: boolean;
  /** Sections d'autres modules que l'étape est censée consulter (documentaire + prompt). */
  consults?: ProjectSectionKey[];
  /**
   * Attentes de forme sur la sortie. Quand elles sont déclarées, la sortie passe
   * la grille déterministe et, si besoin, UNE passe de réparation bornée.
   */
  quality?: QualityExpectation;
  /**
   * Produit le contenu de l'étape SANS appeler le LLM.
   *
   * Certaines sections ne sont pas rédigées : elles sont fabriquées (une image
   * générée, un gabarit rempli, un calcul). Les faire passer par le modèle
   * revenait à payer un prompt complet pour une sortie systématiquement jetée
   * — c'était le cas des pages de mise en situation de la charte.
   *
   * Rendre `null` signifie « pas de section » : l'étape est tenue pour faite,
   * mais rien n'est persisté ni diffusé. C'est ce qui permet à un livrable
   * d'omettre une page plutôt que d'en afficher une dégradée.
   */
  execute?: () => Promise<string | null>;
}

/**
 * Attache à chaque étape les réglages IA de sa section.
 *
 * Le `stepName` est la clé de section : c'est lui qui indexe
 * `AI_CONFIG.<feature>.sections`. Une étape sans entrée dédiée hérite
 * simplement de la config de la feature.
 *
 * `applyTier` traduit ensuite un éventuel étage (`tier`) en modèle concret :
 * c'est le point où le routeur prend la main sur le choix du modèle.
 */
export function withSectionConfigs(
  feature: FeatureAIConfig,
  steps: IPromptStep[],
  stablePrefix?: string
): IPromptStep[] {
  return steps.map((step) => ({
    ...step,
    aiConfig: step.aiConfig ?? applyTier(resolveSectionConfig(feature, step.stepName)),
    // Le préfixe COURT (sans les règles de composition) n'a de sens que sous
    // gabarit : coupé, la section retombe sur le prompt HTML d'origine et a de
    // nouveau besoin de ces règles.
    stablePrefix: (TEMPLATES_ENABLED ? step.stablePrefix : undefined) ?? stablePrefix,
    template: TEMPLATES_ENABLED ? step.template : undefined,
  }));
}

/**
 * Applique un graphe de dépendances à une liste d'étapes, puis leurs réglages IA.
 *
 * Remplace la déclaration manuelle de `requiresSteps` étape par étape : le
 * graphe est décrit à un seul endroit (`deliverable-graph.ts`), validé
 * (références inconnues, cycles) et journalisé avec sa profondeur — qui est le
 * multiplicateur de latence du livrable.
 */
export function withGraph(
  feature: FeatureAIConfig,
  steps: IPromptStep[],
  graph: DeliverableGraph,
  quality?: QualityExpectation,
  /** Contexte commun à toutes les étapes — cf. `IPromptStep.stablePrefix`. */
  stablePrefix?: string
): IPromptStep[] {
  const stepNames = steps.map((step) => step.stepName);
  validateGraph(graph, stepNames);

  logger.info(
    `Graphe appliqué: ${steps.length} étapes, profondeur ${graphDepth(graph)} vague(s)`
  );

  const wired = steps.map((step) => {
    const node = graph[step.stepName];
    if (!node) {
      // Étape hors graphe : elle reste indépendante plutôt que d'hériter d'un
      // « dépend de tout » implicite, qui sérialiserait tout le livrable.
      return { ...step, hasDependencies: false, quality: step.quality ?? quality };
    }

    const requires = node.requires ?? [];
    return {
      ...step,
      hasDependencies: requires.length > 0,
      requiresSteps: requires,
      contextMode: step.contextMode ?? (requires.length > 0 ? 'digest' : 'none'),
      contextTools: step.contextTools ?? Boolean(node.consults?.length),
      consults: step.consults ?? node.consults,
      quality: step.quality ?? quality,
    } as IPromptStep;
  });

  return withSectionConfigs(feature, wired, stablePrefix);
}

/**
 * Plafond de tokens d'un livrable, déduit des budgets de sortie déclarés.
 *
 * Ce n'est pas une prévision de coût mais un COUPE-CIRCUIT : le facteur 3
 * couvre l'entrée, la sortie et une escalade, si bien qu'un run normal ne
 * l'atteint jamais — seul un run qui dérape (boucle d'outils emballée,
 * réparations en chaîne) vient buter dessus et s'arrête au lieu de creuser.
 */
export function estimateRunBudget(steps: IPromptStep[]): number {
  const perStep = steps.reduce(
    (total, step) => total + (step.aiConfig?.llmOptions?.maxOutputTokens ?? 8000),
    0
  );
  return Math.max(50_000, perStep * 3);
}

/**
 * Étapes lancées de front sur un même livrable.
 *
 * ⚠️ NE PAS AUGMENTER sans mesurer. `ResearchTeamService` a fait l'expérience et
 * l'a documentée : monter de 3 à 5 paraît évident — moins de vagues — et donne
 * l'inverse, 162 s contre 121 s sur le pipeline complet. Au-delà de trois, la
 * file d'attente côté fournisseur coûte plus cher que la vague économisée.
 *
 * Cette mesure valait pour l'ordonnanceur de la recherche ; elle n'avait jamais
 * été appliquée à l'ordonnanceur GÉNÉRIQUE, qui lançait toutes les étapes prêtes
 * d'un coup — soit cinq à neuf appels simultanés sur un business plan.
 *
 * Configurable pour être re-mesurable : c'est un réglage d'infrastructure, pas
 * une constante de conception.
 */
const MAX_PARALLEL_STEPS = Math.max(1, Number(process.env.IDEM_MAX_PARALLEL_STEPS ?? 3));

/**
 * Budget de sortie d'une section rendue par gabarit.
 *
 * Une page A4 pleine porte 550 à 700 mots utiles, soit ~900 tokens ; le contenu
 * structuré qui les transporte tient largement sous 6 000, blocs et libellés
 * compris. Le reste de l'ancien budget servait à écrire du balisage — la partie
 * que le rendu produit désormais gratuitement, et instantanément.
 */
const TEMPLATE_OUTPUT_TOKENS = Number(process.env.IDEM_TEMPLATE_OUTPUT_TOKENS ?? 6000);

/**
 * Interrupteur global du rendu par gabarit.
 *
 * `IDEM_SECTION_TEMPLATE=off` fait retomber TOUTES les sections sur la
 * génération HTML libre, sans redéploiement. Sert à comparer les deux rendus
 * côte à côte sur un même projet — c'est la mesure qui décide, pas l'opinion.
 */
const TEMPLATES_ENABLED = (process.env.IDEM_SECTION_TEMPLATE ?? '').toLowerCase() !== 'off';

/**
 * Étape de PLAN avant l'écriture (cf. `sectionPlan.ts`).
 *
 * `IDEM_SECTION_PLAN=off` la coupe : la section est alors écrite d'un seul
 * appel, comme avant. Sert à mesurer ce que le découpage apporte réellement,
 * sur un même projet et un même modèle.
 */
const PLANNING_ENABLED = (process.env.IDEM_SECTION_PLAN ?? '').toLowerCase() !== 'off';

/**
 * Intervalle minimal entre deux annonces de progression d'une même section.
 *
 * Le modèle produit des dizaines de tokens par seconde ; relayer chacun d'eux
 * jusqu'au client coûterait plus en sérialisation SSE que le confort gagné.
 * 400 ms suffisent à donner l'impression d'un texte qui s'écrit.
 */
const DELTA_THROTTLE_MS = 400;

/** Limite la fréquence des annonces, en laissant toujours passer la dernière. */
function throttleDelta(emit: (partial: string) => void): (partial: string) => void {
  let lastAt = 0;
  return (partial: string) => {
    const now = Date.now();
    if (now - lastAt < DELTA_THROTTLE_MS) return;
    lastAt = now;
    emit(partial);
  };
}

/**
 * Note une sortie de section — plus BAS est meilleur.
 *
 * Le juge est du CODE : la grille qualité (troncature, balises, gabarits non
 * remplis) et le linter de charte. Un juge IA coûterait un appel de plus et
 * apporterait sa propre variance ; celui-ci ne coûte rien et ne varie pas.
 *
 * Pondération : un défaut BLOQUANT (section inutilisable) pèse bien plus qu'une
 * violation de charte, elle-même plus qu'un avertissement.
 */
export function scoreSection(
  text: string,
  expectation: QualityExpectation,
  lintOptions: SlopLintOptions = {}
): number {
  const gate = inspectOutput(text, expectation);
  const slop = lintHtml(text, lintOptions);
  return gate.blocking.length * 10 + slop.errorCount * 3 + slop.warningCount;
}

/** Ce dont une étape a besoin en plus de sa propre déclaration pour s'exécuter. */
export interface StepRunOptions {
  userId?: string;
  promptType?: string;
  /** Contexte des étapes amont, DÉJÀ réduit en digests par l'ordonnanceur. */
  dependencyContext?: string;
  promptConfig?: PromptConfig;
  /** Plafond de consommation partagé par toutes les étapes du même livrable. */
  budget?: RunBudget;
  language?: string;
  /**
   * Diffuse la section au fil de sa génération. Voir `AgentRunInput.onDelta` :
   * c'est un APERÇU, remplacé par le contenu validé en fin d'étape.
   */
  onDelta?: (payload: { stepName: string; partial: string }) => void;
}

// Define interface for section result
export interface ISectionResult {
  name: string;
  type: string;
  data: string;
  summary: string;
  parsedData?: any;
}

export class GenericService {
  protected projectRepository: IRepository<ProjectModel>;
  // tempFilePath property removed - using in-memory context instead

  constructor(protected promptService: PromptService) {
    logger.info('GenericService initialized');
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  /**
   * Fetches a project by ID and user ID
   * @param projectId Project ID
   * @param userId User ID
   * @returns Project model or null if not found
   */
  protected async getProject(projectId: string, userId: string): Promise<ProjectModel | null> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    logger.debug(`Project data fetched: ${project ? JSON.stringify(project.id) : 'null'}`);

    if (!project) {
      logger.warn(`Project not found with ID: ${projectId} for user: ${userId}`);
      return null;
    }
    return project;
  }

  /**
   * Extracts project description from business plan if available
   * @param project Project model
   * @returns Project description or empty string if not found
   */
  protected extractProjectDescription(project: ProjectModel): string {
    const projectName = project.name || 'Startup';
    const projectDescription = project.longDescription || project.description || '';
    const projectType = project.type || '';
    const projectScope = project.scope || '';
    const projectTargets = project.targets || '';

    return `Project Name: ${projectName}\nProject Description: ${projectDescription}\nProject Type: ${projectType}\nProject Scope: ${projectScope}\nProject Targets: ${projectTargets}`;
  }

  /**
   * Contexte amont d'une étape, à la forme dictée par `contextMode`.
   *
   * C'est ICI que se joue l'essentiel du coût d'un livrable. L'ancien
   * comportement — concaténer le texte intégral de toutes les étapes
   * précédentes — faisait croître le prompt de la n-ième section avec la somme
   * des n-1 précédentes : sur 9 sections de ~12k tokens, la facture d'entrée
   * seule dépassait celle de tout le contenu produit. Le mode `digest` ramène
   * chaque dépendance à ~200 tokens de faits.
   */
  protected async buildStepContext(
    step: IPromptStep,
    completedSteps: Map<string, { name: string; content: string }>,
    ctx: { userId?: string; projectId?: string; budget?: RunBudget; language?: string } = {}
  ): Promise<string> {
    const hasDependencies = step.hasDependencies !== undefined ? step.hasDependencies : true;
    const mode: StepContextMode = step.contextMode ?? (hasDependencies ? 'digest' : 'none');

    if (!hasDependencies || mode === 'none') {
      logger.info(`Aucun contexte amont pour '${step.stepName}'`);
      return '';
    }

    // Sans `requiresSteps`, l'étape hérite de tout ce qui précède : c'est le
    // comportement historique, conservé pour ne pas casser les flux existants.
    const dependencies = (
      step.requiresSteps && step.requiresSteps.length > 0
        ? (step.requiresSteps
            .map((name) => completedSteps.get(name))
            .filter(Boolean) as { name: string; content: string }[])
        : Array.from(completedSteps.values())
    ).filter((d) => d.content.trim().length > 0);

    if (dependencies.length === 0) return '';

    const sourceChars = dependencies.reduce((total, d) => total + d.content.length, 0);

    if (mode === 'full') {
      logger.info(
        `Contexte INTÉGRAL pour '${step.stepName}' depuis [${dependencies
          .map((d) => d.name)
          .join(', ')}] (${sourceChars} car.)`
      );
      return dependencies.map((d) => `## ${d.name}\n\n${d.content}\n\n---\n`).join('\n');
    }

    const context = await buildDependencyContext(dependencies, {
      userId: ctx.userId,
      projectId: ctx.projectId,
      budget: ctx.budget,
      language: ctx.language,
    });

    logger.info(
      `Contexte DIGEST pour '${step.stepName}' depuis [${dependencies
        .map((d) => d.name)
        .join(', ')}] : ${sourceChars} → ${context.length} car. ` +
        `(÷${Math.max(1, Math.round(sourceChars / Math.max(1, context.length)))})`
    );

    return context;
  }

  /**
   * Exécute UNE étape de génération.
   *
   * C'est le chokepoint de toutes les générations par sections (branding,
   * business plan, deck, diagrammes, docs légaux) : tout ce qui doit valoir pour
   * l'ensemble de la plateforme — routage de modèle, budget de run, contrôle de
   * sortie, ventilation du coût — se branche ici et nulle part ailleurs.
   *
   * Note historique : cette méthode construisait auparavant un long prompt
   * (« CURRENT TASK / PROJECT DETAILS / SPECIFIC INSTRUCTIONS ») qui n'était
   * jamais envoyé — seuls les `messages` de l'appelant partaient au modèle. Ce
   * code mort a été retiré ; la composition du prompt se fait désormais ici,
   * une seule fois, et c'est bien elle qui part au modèle.
   */
  protected async runStepAndAppend(
    step: IPromptStep,
    project: ProjectModel,
    options: StepRunOptions = {}
  ): Promise<string> {
    const { userId, promptType, dependencyContext = '', budget, language, onDelta } = options;
    const promptConfig: PromptConfig = options.promptConfig ?? {
      provider: AI_CONFIG.default.provider,
      modelName: AI_CONFIG.default.modelName,
      userId,
      promptType: promptType || step.stepName,
    };

    logger.info(`Generating section: '${step.stepName}' for projectId: ${project.id}`);

    // Réglages de la section par-dessus ceux de l'appel. Une section lourde
    // (plan financier, slide financials) obtient ainsi son propre budget de
    // tokens sans imposer le même à toutes les autres.
    const effectiveConfig: PromptConfig = step.aiConfig
      ? {
          ...promptConfig,
          provider: step.aiConfig.provider,
          modelName: step.aiConfig.modelName,
          promptType: promptConfig.promptType ?? step.aiConfig.promptType,
          fallbackModels: step.aiConfig.fallbackModels ?? promptConfig.fallbackModels,
          llmOptions: { ...promptConfig.llmOptions, ...step.aiConfig.llmOptions },
        }
      : promptConfig;

    const useTools = Boolean(step.contextTools && userId && project.id);

    logger.info(
      `Section '${step.stepName}' → ${effectiveConfig.modelName} ` +
        `(maxOutputTokens=${effectiveConfig.llmOptions?.maxOutputTokens ?? 'default'}, ` +
        `temperature=${effectiveConfig.llmOptions?.temperature ?? 'default'}, ` +
        `fallbacks=${effectiveConfig.fallbackModels?.length ?? 0}, ` +
        `contexte=${dependencyContext ? `${dependencyContext.length} car.` : 'aucun'}, ` +
        `outils=${useTools ? 'oui' : 'non'})`
    );

    // ── ÉTAPE ① — LE PLAN ────────────────────────────────────────────────────
    //
    // Même après que le rendu lui a retiré la composition, une section demande
    // encore DEUX choses d'un coup au modèle : décider quoi dire, et l'écrire.
    // Un petit modèle tient trois ou quatre exigences simultanées puis décroche
    // en silence — en comblant. On sépare donc les deux : ici on décide, à
    // l'étape ② on remplit.
    //
    // Le plan est vérifié SANS modèle (nombre de points, types de blocs
    // existants) : son échec est détecté avant que la page ne soit écrite, là
    // où le rattraper coûte quelques centaines de tokens au lieu d'une section.
    let planDirective = '';
    if (step.template && PLANNING_ENABLED) {
      try {
        const planned = await runAgentPrompt(
          {
            role: 'section-planner',
            task: 'extract',
            systemPrompt: SECTION_PLAN_CONTRACT,
            promptType: 'section-plan',
            // Une charpente tient en quelques centaines de tokens. Un budget
            // large n'y ajouterait que de la prose.
            llmOptions: { maxOutputTokens: 1200, temperature: 0.3, jsonMode: true },
            validate: (text: string) =>
              normalizeSectionPlan(parseLlmJson(text))
                ? { ok: true }
                : { ok: false, reason: 'plan illisible ou trop court' },
          },
          [
            step.template.contentBrief ?? step.promptConstant,
            dependencyContext ? `SECTIONS ALREADY WRITTEN:\n${dependencyContext}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          {
            userId,
            projectId: project.id,
            element: `plan:${step.stepName}`,
            budget,
            language: language ?? effectiveConfig.language,
            skipQuotaCheck: true,
          }
        );

        const plan = normalizeSectionPlan(parseLlmJson(planned.text));
        if (plan) {
          planDirective = describeSectionPlan(plan);
          logger.info(
            `Section '${step.stepName}' : plan retenu (${plan.points.length} points, ` +
              `blocs ${plan.blocks.join('/')}, tier=${planned.tier})`
          );
        }
      } catch (error: any) {
        // Un plan absent n'empêche pas d'écrire : on retombe sur l'appel unique.
        logger.warn(
          `Section '${step.stepName}' : planification impossible (${error?.message}) — écriture directe.`
        );
      }
    }

    const messages: AIChatMessage[] = [];

    // ① PRÉFIXE STABLE — byte-identique pour toutes les sections du livrable.
    //    Il DOIT venir en premier : c'est la seule partie du prompt qui puisse
    //    être servie depuis un cache de préfixe, et un cache ne s'accroche qu'à
    //    un début de message inchangé. Tout ce qui varie vient après.
    if (step.stablePrefix) {
      messages.push({ role: 'system', content: step.stablePrefix });
    }

    // ② à partir d'ici, tout varie d'une section à l'autre.
    if (dependencyContext) {
      // Le contexte amont est un RÉSUMÉ : il faut le dire au modèle, sinon il
      // tente de le prolonger ou de le recopier au lieu de s'y conformer.
      messages.push({
        role: 'system',
        content:
          `SECTIONS DÉJÀ PRODUITES POUR CE LIVRABLE (faits à respecter, à ne PAS recopier) :\n\n` +
          `${dependencyContext}\n\n` +
          `Ta section doit être cohérente avec ces faits : mêmes chiffres, mêmes noms, ` +
          `même devise, même positionnement. Ne les contredis jamais et ne répète pas leur contenu.`,
      });
    }

    if (useTools && step.consults?.length) {
      messages.push({
        role: 'system',
        content:
          `Tu peux consulter les données réelles du projet avec les outils fournis. ` +
          `Sections utiles pour cette étape : ${step.consults.join(', ')}. ` +
          `N'invente jamais une donnée que tu peux aller lire.`,
      });
    }

    // MODE GABARIT : on remplace les consignes de composition par le contrat de
    // sortie. Le modèle ne compose plus, il écrit — et ce qu'il écrit est
    // structuré, donc vérifiable et infalsifiable dans sa forme.
    messages.push({
      role: 'user',
      content: step.template
        ? [
            // Le brief de contenu quand la feature en fournit un ; sinon le
            // prompt d'origine, que le contrat de sortie réoriente vers du JSON.
            step.template.contentBrief ?? step.promptConstant,
            // La charpente décidée à l'étape ①. Elle transforme une tâche
            // ouverte en remplissage : c'est là que l'invention de structure —
            // donc le comblement — disparaît.
            planDirective,
            sectionVolumeDirective(step.template.volume),
            SECTION_CONTENT_CONTRACT,
          ]
            .filter(Boolean)
            .join('\n\n')
        : step.promptConstant,
    });

    const result = await runAgent(
      {
        role: 'section-writer',
        // La tâche ne sert que de défaut : `baseConfig` impose le modèle réel
        // choisi par la feature/section, l'étage n'entre en jeu qu'en escalade.
        task: 'draft',
        baseConfig: {
          provider: effectiveConfig.provider,
          modelName: effectiveConfig.modelName,
          fallbackModels: effectiveConfig.fallbackModels,
          llmOptions: {
            ...effectiveConfig.llmOptions,
            // Le gabarit change la NATURE de la sortie : ~2 500 tokens de
            // contenu structuré au lieu de ~10 000 de balisage. Conserver un
            // budget de 28 000 n'apporterait rien et laisserait le raisonnement
            // s'étendre sans objet — or c'est la sortie qui fait la latence.
            ...(step.template
              ? { maxOutputTokens: TEMPLATE_OUTPUT_TOKENS, jsonMode: true }
              : {}),
          },
          // Sans épinglage explicite, la section part à l'étage de sa TÂCHE
          // (`draft` → M) et n'escalade que si la grille qualité échoue. C'est
          // ce qui fait enfin travailler le routeur sur le volume principal.
          //
          // Une section rendue par GABARIT est dépinglée d'office : l'épinglage
          // transitoire existait parce que l'escalade ne détecte pas « la page
          // est plate » tant que la composition est demandée au modèle. Sous
          // gabarit, la composition ne lui est plus demandée — la condition de
          // retrait écrite dans ai.config.ts est donc remplie, section par
          // section, au fur et à mesure de la bascule.
          pinModel: step.template ? false : step.aiConfig?.pinModel,
        },
        promptType: effectiveConfig.promptType ?? step.stepName,
        tools: useTools ? CONTEXT_TOOL_DECLARATIONS : undefined,
        toolExecutor: useTools ? createContextToolExecutor(userId!, project.id!) : undefined,
        maxToolTurns: 4,
        // En mode gabarit, la sortie attendue est un CONTENU structuré : le
        // contrôle porte donc sur sa lisibilité, pas sur du balisage qui
        // n'existe plus. Le balisage, lui, est garanti par le rendu.
        validate: step.template
          ? (text: string) => {
              const parsed = normalizeSectionContent(parseLlmJson(text));
              return parsed
                ? { ok: true }
                : { ok: false, reason: 'contenu de section illisible ou vide' };
            }
          : step.quality
            ? qualityValidator(step.quality)
            : undefined,
      },
      {
        messages,
        userId,
        projectId: project.id,
        element: step.stepName,
        budget,
        // Tout ce que la config d'appel porte encore doit atteindre le modèle :
        // un champ oublié ici redevient un réglage mort côté service métier.
        language: language ?? effectiveConfig.language,
        cachedContent: effectiveConfig.cachedContent,
        file: effectiveConfig.file,
        contextFilePaths: effectiveConfig.contextFilePaths,
        skipQuotaCheck: effectiveConfig.skipQuotaCheck,
        // Étranglé : un événement par token saturerait le canal SSE et
        // coûterait plus en sérialisation qu'il ne rapporte en confort.
        onDelta: onDelta ? throttleDelta((partial) => onDelta({ stepName: step.stepName, partial })) : undefined,
      }
    );

    let content = result.text;

    // RENDU. Le modèle a produit du contenu ; la page est fabriquée ici, avec la
    // palette, la grille, la typographie, les contrastes et le logo du document.
    // Rien de tout cela ne dépend plus de ce que le modèle a bien voulu suivre.
    if (step.template) {
      const parsed = normalizeSectionContent(parseLlmJson(content));
      if (parsed) {
        // Les blocs SPÉCIMENS viennent du projet, pas du modèle : ils sont
        // posés en tête, avant ce que le modèle a écrit autour d'eux.
        const withSpecimens = step.template.prependBlocks?.length
          ? { ...parsed, blocks: [...step.template.prependBlocks, ...parsed.blocks] }
          : parsed;

        content = renderSection(
          withSpecimens,
          step.template.designSystem,
          step.template.seed,
          step.template.render ?? {}
        );
        logger.info(
          `Section '${step.stepName}' rendue par gabarit ` +
            `(archétype ${step.template.seed.archetype}, ${parsed.blocks.length} blocs, ${content.length} car.)`
        );
      } else {
        // Le contrôle de l'agent a déjà tenté une escalade : si l'on arrive ici,
        // c'est que même l'étage supérieur n'a pas rendu de contenu lisible. On
        // renvoie la sortie brute plutôt que rien — l'appelant la traitera comme
        // une section en échec.
        logger.error(
          `Section '${step.stepName}' : contenu illisible après escalade, sortie brute conservée.`
        );
      }
    }

    // Contrôle + réparation bornée. `verifySection` sort immédiatement si la
    // grille déterministe ne trouve rien : le cas nominal ne coûte rien.
    if (step.quality) {
      const outcome = await verifySection(content, step.quality, {
        userId,
        projectId: project.id,
        sectionName: step.stepName,
        budget,
        language,
      });
      content = outcome.content;
      if (outcome.flagged) {
        logger.warn(
          `Section '${step.stepName}' livrée avec défauts non corrigés: ${outcome.report.summary}`
        );
      }
    }

    logger.info(
      `Section '${step.stepName}' produite (${content.length} car., tier=${result.tier}` +
        `${result.escalated ? ', escaladée' : ''}, ${result.durationMs} ms)`
    );

    return content;
  }

  /**
   * Process steps with streaming, calling a callback for each completed step
   * Supports asynchronous execution of steps without dependencies
   * @param steps Array of prompt steps
   * @param project Project model
   * @param stepCallback Callback function called after each step completes
   * @param promptConfig Optional prompt configuration
   * @param promptType Optional prompt type
   * @param userId Optional user ID
   * @param finalizationCallback Optional callback called before sending completion message
   */
  protected async processStepsWithStreaming(
    steps: IPromptStep[],
    project: ProjectModel,
    stepCallback: (result: ISectionResult) => Promise<void>,
    promptConfig?: PromptConfig,
    promptType?: string,
    userId?: string,
    finalizationCallback?: () => Promise<void>,
    existingSections: SectionModel[] = [],
    budget: RunBudget = createRunBudget(
      `${promptType ?? 'deliverable'}:${project.id}`,
      estimateRunBudget(steps)
    )
  ): Promise<void> {
    const completedSteps: Map<string, { name: string; content: string }> = new Map();
    const runningSteps: Set<string> = new Set();
    const stepPromises: Map<string, Promise<void>> = new Map();

    // Pre-populate completedSteps with existing sections to satisfy dependencies
    for (const sec of existingSections) {
      if (sec.name && sec.data && typeof sec.data === 'string' && sec.data.trim().length > 0) {
        completedSteps.set(sec.name, {
          name: sec.name,
          content: sec.data,
        });
      }
    }

    const isRetry = existingSections.length > 0;
    const effectivePromptConfig: PromptConfig = {
      provider: promptConfig?.provider || AI_CONFIG.default.provider,
      modelName: promptConfig?.modelName || AI_CONFIG.default.modelName,
      ...promptConfig,
      skipQuotaCheck: isRetry ? true : (promptConfig?.skipQuotaCheck ?? false),
    };

    // Helper function to send progress updates
    const sendProgressUpdate = async () => {
      const progressResult: ISectionResult = {
        name: 'progress',
        type: 'event',
        data: 'steps_in_progress',
        summary: `Steps in progress: ${Array.from(runningSteps).join(', ')}`,
        parsedData: {
          status: 'progress',
          stepsInProgress: Array.from(runningSteps),
          completedSteps: Array.from(completedSteps.keys()),
        },
      };
      await stepCallback(progressResult);
    };

    // Helper function to execute a single step
    const executeStep = async (step: IPromptStep): Promise<void> => {
      try {
        runningSteps.add(step.stepName);
        await sendProgressUpdate();

        logger.info(`Starting execution of step: ${step.stepName}`);

        // Une étape fabriquée court-circuite le modèle : ni contexte amont à
        // construire, ni prompt à facturer.
        const content = step.execute
          ? await step.execute()
          : await this.runStepAndAppend(step, project, {
              userId,
              promptType: promptType || step.stepName,
              dependencyContext: await this.buildStepContext(step, completedSteps, {
                userId,
                projectId: project.id,
                budget,
              }),
              promptConfig: effectivePromptConfig,
              budget,
              // Aperçu au fil de l'eau. La section attendait jusqu'ici d'être
              // ENTIÈREMENT produite avant d'apparaître : une à trois minutes
              // devant un indicateur d'activité, alors que le premier
              // paragraphe est disponible en quelques secondes.
              //
              // C'est bien un APERÇU : il n'a passé ni la grille qualité ni la
              // réparation. L'événement `section` qui suit porte, lui, le
              // contenu validé et remplace ce qui a été affiché.
              onDelta: ({ stepName, partial }) => {
                void stepCallback({
                  name: 'section_delta',
                  type: 'event',
                  data: partial,
                  summary: `Streaming ${stepName}`,
                  parsedData: { status: 'streaming', stepName, chars: partial.length },
                }).catch(() => undefined);
              },
            });

        // Store the content of this step for future steps. Une étape sans
        // contenu est enregistrée VIDE : elle est faite (les étapes qui en
        // dépendent ne doivent pas attendre indéfiniment), mais elle n'entre
        // dans aucun contexte et ne produit aucune section.
        completedSteps.set(step.stepName, {
          name: step.stepName,
          content: content ?? '',
        });

        if (content === null) {
          logger.info(`Step '${step.stepName}' produced no section — page skipped`);
          runningSteps.delete(step.stepName);
          await sendProgressUpdate();
          return;
        }

        let parsedData = null;
        if (step.modelParser) {
          try {
            parsedData = step.modelParser(content);
            logger.info(`Successfully parsed ${step.stepName} for projectId: ${project.id}`);
          } catch (error) {
            logger.error(`Error parsing ${step.stepName} for project ${project.id}:`, error);
            parsedData = { error: 'Parsing error', content };
          }
        }

        const sectionResult: ISectionResult = {
          name: step.stepName,
          type: 'text/markdown',
          data: content,
          summary: `${step.stepName} for Project ${project.id}`,
          parsedData: {
            ...parsedData,
            status: 'completed',
            stepName: step.stepName,
          },
        };

        // Remove from running steps and update progress
        runningSteps.delete(step.stepName);
        await sendProgressUpdate();

        // Call the callback with the completed result
        await stepCallback(sectionResult);

        logger.info(`Completed execution of step: ${step.stepName}`);
      } catch (error) {
        runningSteps.delete(step.stepName);
        logger.error(`Error executing step ${step.stepName}:`, error);
        throw error;
      }
    };

    // Helper function to check if all dependencies are satisfied
    const areDependenciesSatisfied = (step: IPromptStep): boolean => {
      const hasDependencies = step.hasDependencies !== undefined ? step.hasDependencies : true;

      if (!hasDependencies) {
        return true; // No dependencies required
      }

      if (step.requiresSteps && step.requiresSteps.length > 0) {
        // Check if all required steps are completed
        return step.requiresSteps.every((requiredStep) => completedSteps.has(requiredStep));
      }

      // If hasDependencies=true but no specific requiresSteps,
      // we need to wait for all previous steps in the array
      const currentIndex = steps.findIndex((s) => s.stepName === step.stepName);
      const previousSteps = steps.slice(0, currentIndex);

      return previousSteps.every((prevStep) => completedSteps.has(prevStep.stepName));
    };

    // Main execution loop
    const pendingSteps = steps.filter((step) => !completedSteps.has(step.stepName));

    while (pendingSteps.length > 0 || stepPromises.size > 0) {
      // Find steps that can be started (dependencies satisfied)
      const readySteps = pendingSteps.filter(
        (step) =>
          !stepPromises.has(step.stepName) &&
          !runningSteps.has(step.stepName) &&
          areDependenciesSatisfied(step)
      );

      // Start execution of ready steps, dans la limite du plafond de concurrence.
      // Les étapes non lancées ce tour-ci restent en attente et repartiront au
      // tour suivant, dès qu'un créneau se libère.
      for (const step of readySteps) {
        if (stepPromises.size >= MAX_PARALLEL_STEPS) break;
        const stepPromise = executeStep(step);
        stepPromises.set(step.stepName, stepPromise);

        // Remove from pending steps
        const index = pendingSteps.findIndex((s) => s.stepName === step.stepName);
        if (index !== -1) {
          pendingSteps.splice(index, 1);
        }
      }

      // Wait for at least one step to complete if we have running steps
      if (stepPromises.size > 0) {
        await Promise.race(Array.from(stepPromises.values()));

        // Clean up completed promises
        for (const [stepName, promise] of stepPromises.entries()) {
          try {
            // Check if promise is resolved by trying to get its value with a 0 timeout
            await Promise.race([
              promise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 0)),
            ]);
            // If we reach here, the promise is resolved
            stepPromises.delete(stepName);
          } catch (error) {
            if ((error as Error).message !== 'timeout') {
              // Real error, remove the promise and re-throw
              stepPromises.delete(stepName);
              throw error;
            }
            // Timeout means promise is still pending, keep it
          }
        }
      }

      // Prevent infinite loop if no progress can be made
      if (readySteps.length === 0 && pendingSteps.length > 0) {
        const pendingStepNames = pendingSteps.map((s) => s.stepName);
        logger.warn(`No steps can be started. Pending steps: ${pendingStepNames.join(', ')}`);

        // Check for circular dependencies or missing dependencies
        for (const step of pendingSteps) {
          if (step.requiresSteps) {
            const missingDeps = step.requiresSteps.filter(
              (dep) => !completedSteps.has(dep) && !steps.some((s) => s.stepName === dep)
            );
            if (missingDeps.length > 0) {
              throw new Error(
                `Step '${step.stepName}' has missing dependencies: ${missingDeps.join(', ')}`
              );
            }
          }
        }

        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Wait for all remaining promises to complete
    if (stepPromises.size > 0) {
      await Promise.all(Array.from(stepPromises.values()));
    }

    // Execute finalization callback before sending completion message
    if (finalizationCallback) {
      logger.info(`Executing finalization callback for project ${project.id}`);
      await finalizationCallback();
      logger.info(`Finalization callback completed for project ${project.id}`);
    }

    // Send final completion message to frontend
    const completionResult: ISectionResult = {
      name: 'completion',
      type: 'event',
      data: 'all_steps_completed',
      summary: `All steps completed successfully for project ${project.id}`,
      parsedData: {
        status: 'completed',
        message: 'All generation steps have been completed successfully',
        totalSteps: steps.length,
        completedSteps: Array.from(completedSteps.keys()),
        projectId: project.id,
        timestamp: new Date().toISOString(),
      },
    };
    await stepCallback(completionResult);

    logger.info(`All steps completed for project ${project.id}`);
  }

  /**
   * Processes multiple steps sequentially
   * @param steps Array of prompt steps
   * @param project Project model
   * @returns Array of section results
   */

  protected async processSteps(
    steps: IPromptStep[],
    project: ProjectModel,
    promptConfig?: PromptConfig,
    promptType?: string,
    userId?: string,
    budget: RunBudget = createRunBudget(
      `${promptType ?? 'deliverable'}:${project.id}`,
      estimateRunBudget(steps)
    )
  ): Promise<ISectionResult[]> {
    const results: ISectionResult[] = [];
    const completedSteps = new Map<string, { name: string; content: string }>();
    // `null` : l'étape est faite mais ne produit pas de section (cf. `execute`).
    const stepPromises = new Map<string, Promise<ISectionResult | null>>();
    /** Étapes réellement en vol — sert de compteur de créneaux. */
    const running = new Set<string>();
    const pendingSteps = [...steps];

    logger.info(`Starting processSteps for ${steps.length} steps in project ${project.id}`);

    // Helper function to execute a single step
    const executeStep = async (step: IPromptStep): Promise<ISectionResult | null> => {
      logger.info(`Starting execution of step: ${step.stepName}`);

      const hasDependencies = step.hasDependencies !== undefined ? step.hasDependencies : true;

      // Attendre les dépendances AVANT de construire le contexte : sans
      // `requiresSteps`, l'étape attend tout ce qui est déjà lancé (comportement
      // séquentiel historique).
      if (hasDependencies) {
        const awaited =
          step.requiresSteps && step.requiresSteps.length > 0
            ? (step.requiresSteps
                .map((stepName) => stepPromises.get(stepName))
                .filter(Boolean) as Promise<ISectionResult | null>[])
            : Array.from(stepPromises.values());
        if (awaited.length > 0) {
          await Promise.all(awaited);
        }
      }

      try {
        // Une étape fabriquée (cf. `IPromptStep.execute`) ne passe pas par le
        // modèle. Elle peut aussi ne rien produire : l'étape est alors tenue
        // pour faite, sans section.
        const content = step.execute
          ? await step.execute()
          : await this.runStepAndAppend(step, project, {
              userId: userId ?? promptConfig?.userId,
              promptType: promptType || step.stepName,
              dependencyContext: await this.buildStepContext(step, completedSteps, {
                userId: userId ?? promptConfig?.userId,
                projectId: project.id,
                budget,
              }),
              promptConfig,
              budget,
            });

        // Store the completed step
        completedSteps.set(step.stepName, {
          name: step.stepName,
          content: content ?? '',
        });

        if (content === null) {
          logger.info(`Step '${step.stepName}' produced no section — page skipped`);
          return null;
        }

        // Parse the result if parser is provided
        let parsedData = null;
        if (step.modelParser) {
          try {
            parsedData = step.modelParser(content);
            logger.info(`Successfully parsed ${step.stepName} for projectId: ${project.id}`);
          } catch (parseError) {
            logger.error(`Error parsing ${step.stepName} for project ${project.id}:`, parseError);
            // Re-throw so the caller gets a proper error instead of a 200
            // with a broken payload (e.g. { error: 'Parsing error', content }).
            throw new Error(
              `Parsing failed for step "${step.stepName}": ${
                parseError instanceof Error ? parseError.message : 'unknown error'
              }`
            );
          }
        }

        const result: ISectionResult = {
          name: step.stepName,
          type: 'text/markdown',
          data: content,
          summary: `${step.stepName} for Project ${project.id}`,
          parsedData: parsedData,
        };

        logger.info(`Completed execution of step: ${step.stepName}`);
        return result;
      } catch (error) {
        logger.error(`Error executing step ${step.stepName}:`, error);
        throw error;
      }
    };

    const areDependenciesSatisfied = (step: IPromptStep): boolean => {
      const hasDependencies = step.hasDependencies !== undefined ? step.hasDependencies : true;

      if (!hasDependencies) {
        return true;
      }

      if (step.requiresSteps && step.requiresSteps.length > 0) {
        // Check if all required steps are completed
        return step.requiresSteps.every((stepName) => completedSteps.has(stepName));
      }

      return true;
    };

    // Main execution loop
    while (pendingSteps.length > 0) {
      // Find steps that can be started now
      const readySteps = pendingSteps.filter((step) => {
        const hasDependencies = step.hasDependencies !== undefined ? step.hasDependencies : true;

        // Steps without dependencies can start immediately
        if (!hasDependencies) {
          return true;
        }

        // Steps with specific requirements
        if (step.requiresSteps && step.requiresSteps.length > 0) {
          return areDependenciesSatisfied(step);
        }

        // Steps with general dependencies (hasDependencies=true, no specific requiresSteps)
        // These will be handled sequentially in executeStep
        return true;
      });

      // Start execution of ready steps, sous le même plafond de concurrence que
      // la voie streamée (cf. MAX_PARALLEL_STEPS). `running` suit les étapes
      // RÉELLEMENT en vol : `stepPromises` conserve aussi les promesses déjà
      // résolues (elles servent au rassemblement final), donc sa taille ne peut
      // pas servir de compteur de créneaux.
      let launched = 0;
      for (const step of readySteps) {
        if (running.size >= MAX_PARALLEL_STEPS) break;
        if (stepPromises.has(step.stepName)) continue;

        logger.info(`Launching step: ${step.stepName}`);
        running.add(step.stepName);
        const promise = executeStep(step).finally(() => running.delete(step.stepName));
        stepPromises.set(step.stepName, promise);
        launched += 1;

        // Remove from pending
        const index = pendingSteps.indexOf(step);
        if (index > -1) {
          pendingSteps.splice(index, 1);
        }
      }

      // Rien n'a pu démarrer ce tour-ci — soit les dépendances ne sont pas
      // satisfaites, soit le plafond est atteint. Dans les deux cas il faut
      // ATTENDRE qu'une étape se termine, sinon la boucle tourne à vide.
      if (launched === 0 && pendingSteps.length > 0) {
        if (running.size > 0) {
          await Promise.race(Array.from(stepPromises.values()));
        } else {
          logger.error('No steps can be started and no steps are running. Breaking loop.');
          break;
        }
      }
    }

    // Wait for all steps to complete
    logger.info(`Waiting for all ${stepPromises.size} steps to complete`);
    const completedResults = (await Promise.all(Array.from(stepPromises.values()))).filter(
      (result): result is ISectionResult => result !== null
    );

    // Sort results to match the original step order
    const stepOrder = steps.map((step) => step.stepName);
    completedResults.sort((a, b) => {
      const indexA = stepOrder.indexOf(a.name);
      const indexB = stepOrder.indexOf(b.name);
      return indexA - indexB;
    });

    logger.info(`All steps completed for project ${project.id}`);
    return completedResults;
  }

  /**
   * Parses content to JSON with error handling
   * @param content Content to parse
   * @param sectionName Section name for logging
   * @param projectId Project ID for logging
   * @returns Parsed JSON or fallback object
   */
  protected parseSection(content: string, sectionName: string, projectId: string): any {
    try {
      const parsed = JSON.parse(content);
      logger.info(`Successfully parsed ${sectionName} for projectId: ${projectId}`);
      return parsed;
    } catch (error) {
      logger.error(`Error parsing ${sectionName} for project ${projectId}:`, error);
      // Return a fallback structure with the raw content
      return {
        content: content,
        summary: `Error parsing ${sectionName}`,
      };
    }
  }

  /**
   * Updates a project with new section results
   * @param projectId Project ID
   * @param userId User ID
   * @param modelProperty Property name in analysisResultModel to update
   * @param sections Array of sections to update
   * @returns Updated project or null
   */
  protected async updateProjectWithSections(
    projectId: string,
    userId: string,
    modelProperty: string,
    sections: SectionModel[]
  ): Promise<ProjectModel | null> {
    try {
      const oldProject = await this.projectRepository.findById(
        projectId,
        `users/${userId}/projects`
      );
      if (!oldProject) {
        logger.warn(`Original project not found with ID: ${projectId} for user: ${userId}`);
        return null;
      }

      const newProject = {
        ...oldProject,
        analysisResultModel: {
          ...oldProject.analysisResultModel,
          [modelProperty]: {
            sections: sections,
          },
        },
      };

      const updatedProject = await this.projectRepository.update(
        projectId,
        newProject,
        `users/${userId}/projects`
      );
      logger.info(
        `Successfully updated project with ID: ${projectId} with new ${modelProperty} sections`
      );

      return updatedProject;
    } catch (error) {
      logger.error(`Error updating project with ${modelProperty} sections:`, error);
      return null;
    }
  }
}
