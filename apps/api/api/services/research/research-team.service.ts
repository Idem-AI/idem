/**
 * ResearchTeamService — moteur mutualisé "équipe d'agents".
 *
 * Un orchestrateur pilote, pour chaque section d'un livrable, une petite équipe:
 *   1. Chercheur(s)  — interrogent le web via le grounding Google Search, ne
 *      retiennent que des faits appuyés par de vraies sources (URLs réelles).
 *   2. Rédacteur     — compose la section UNIQUEMENT à partir des faits sourcés,
 *      avec citations inline [sN] et une liste de sources.
 *   3. Vérificateur  — contrôle que chaque donnée chiffrée porte une source; les
 *      affirmations non sourcées sont signalées (et, si critique, corrigées).
 *
 * Chaque micro-action est diffusée en temps réel via `emit` pour alimenter la
 * "salle de contrôle" côté UI. Le service est agnostique du livrable: business
 * plan, prévisions financières… lui passent une liste de DeliverableSection.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import { AI_CONFIG, GLM_MODELS, LLMProvider } from '../../config/ai.config';
import { cacheService } from '../cache.service';
import {
  PromptService,
  PromptConfig,
  AIChatMessage,
  GroundedSourceRaw,
  GroundedSupport,
  promptService,
} from '../prompt.service';
import {
  AgentEvent,
  AgentEventPayload,
  AgentRole,
  DeliverableSection,
  ResearchEmit,
  ResearchFinding,
  ResearchSource,
  ResearchedSection,
  VerificationVerdict,
} from './research.types';

/** Résultat interne d'un brief de recherche fondé (conserve les index de grounding). */
interface BriefResult {
  brief: string;
  queries: string[];
  sources: GroundedSourceRaw[];
  supports: GroundedSupport[];
  narrative: string;
}

export interface ResearchTeamContext {
  /** Contexte projet compact (nom, description, cible, pays…). */
  projectContext: string;
  /** Contexte de marque optionnel (couleurs, langue…). */
  brandContext?: string;
  /** Langue de sortie ('French' | 'English'). */
  language: string;
  userId: string;
  /** Devise, pour ancrer les données financières (optionnel). */
  currency?: string;
  /** Nom d'un cache de contexte partagé (renseigné en interne par le run). */
  sharedCache?: string;
}

const RESEARCH_CONFIG: PromptConfig = {
  provider: LLMProvider.GLM,
  // Synthétiser des résultats de recherche est une tâche mécanique : on résume
  // ce qui est là, on n'invente pas de raisonnement. Mesuré sur une section,
  // l'étage mécanique rend la même synthèse 1,5× plus vite (4,2 s contre 6,5 s).
  modelName: GLM_MODELS.mechanical,
  promptType: 'research',
  // Une seule synthèse factuelle et concise par section: on borne la sortie
  // pour réduire coût et latence sans sacrifier les faits chiffrés.
  llmOptions: { temperature: 0.3, maxOutputTokens: 1536 },
};

const WRITER_CONFIG: PromptConfig = {
  provider: AI_CONFIG.businessPlan.provider,
  modelName: AI_CONFIG.businessPlan.modelName,
  promptType: 'research-writer',
  // Le rédacteur produit une PAGE A4 HTML riche (Tailwind + graphes Chart.js),
  // pouvant s'étendre sur plusieurs pages : budget de sortie large, sinon le HTML
  // est tronqué en plein milieu (section coupée / graphe cassé).
  llmOptions: { maxOutputTokens: 16000, temperature: 0.55 },
};

const VERIFIER_CONFIG: PromptConfig = {
  provider: AI_CONFIG.businessPlan.provider,
  // Vérifier qu'une affirmation chiffrée figure bien dans les sources est un
  // contrôle, pas une rédaction : l'étage mécanique le fait aussi bien et plus
  // vite, sur chaque section.
  modelName: GLM_MODELS.mechanical,
  promptType: 'research-verifier',
  llmOptions: { temperature: 0.1, maxOutputTokens: 1024 },
};

/**
 * Concurrence max de sections traitées en parallèle.
 *
 * ⚠️ NE PAS AUGMENTER sans mesurer. Monter à 5 paraît évident — neuf sections
 * en deux vagues au lieu de trois — et donne l'inverse : mesuré sur le pipeline
 * complet, 162 s contre 121 s. Chaque section lance quatre recherches et trois
 * appels ; à cinq de front, la file d'attente côté fournisseur coûte plus que
 * la vague économisée.
 */
const SECTION_CONCURRENCY = 3;
/** Nombre max d'axes de recherche fusionnés dans l'unique appel grounded. */
const MAX_BRIEFS_PER_SECTION = 3;
/** Durée de vie du cache des recherches (reprise/régénération sans re-chercher). */
const RESEARCH_CACHE_TTL = 7200;
/** Borne de la synthèse de recherche transmise au rédacteur. */
const MAX_DIGEST_CHARS = 4000;

export class ResearchTeamService {
  constructor(private readonly promptService: PromptService) {}

  /**
   * Exécute l'équipe pour un ensemble de sections. Retourne les sections
   * finalisées. `persistSection` est appelé après chaque section (persistance
   * incrémentale, comme le flux business plan existant).
   */
  async runResearchTeam(
    sections: DeliverableSection[],
    ctx: ResearchTeamContext,
    emit: ResearchEmit,
    persistSection?: (section: ResearchedSection) => Promise<void>
  ): Promise<ResearchedSection[]> {
    const runId = uuidv4();
    logger.info(`ResearchTeam run ${runId} started for ${sections.length} sections`);

    await this.safeEmit(emit, {
      type: 'agent_event',
      timestamp: new Date().toISOString(),
      agentEvent: this.event(runId, 'orchestrator', 'orchestrator', {
        kind: 'agent_status',
        status: 'planning',
        message: `Constitution de l'équipe et répartition de ${sections.length} sections`,
      }),
    });

    // Cache de contexte partagé (best-effort): le contexte projet+marque est
    // réutilisé par tous les appels rédacteur → moins d'input tokens facturés.
    const sharedContextText = this.buildSharedContext(ctx);
    const cacheName = await this.promptService.createContextCache(
      WRITER_CONFIG.modelName,
      sharedContextText,
      RESEARCH_CACHE_TTL
    );
    const runCtx: ResearchTeamContext = { ...ctx, sharedCache: cacheName ?? undefined };

    const results: ResearchedSection[] = [];
    try {
    // Exécution par vagues avec concurrence limitée.
    for (let i = 0; i < sections.length; i += SECTION_CONCURRENCY) {
      const batch = sections.slice(i, i + SECTION_CONCURRENCY);
      const settled = await Promise.all(
        batch.map((section) => this.runSection(runId, section, runCtx, emit))
      );
      for (const section of settled) {
        results.push(section);
        if (persistSection) {
          try {
            await persistSection(section);
          } catch (err: any) {
            logger.error(`persistSection failed for "${section.name}": ${err.message}`);
          }
        }
        await this.safeEmit(emit, {
          type: 'section_completed',
          section,
          timestamp: new Date().toISOString(),
        });
      }
    }

    await this.safeEmit(emit, {
      type: 'agent_event',
      timestamp: new Date().toISOString(),
      agentEvent: this.event(runId, 'orchestrator', 'orchestrator', {
        kind: 'agent_status',
        status: 'done',
        message: 'Livrable finalisé et vérifié',
      }),
    });
    await this.safeEmit(emit, {
      type: 'run_completed',
      sectionCount: results.length,
      timestamp: new Date().toISOString(),
    });

    logger.info(`ResearchTeam run ${runId} completed (${results.length} sections)`);
    return results;
    } finally {
      // Libère le cache de contexte du run (best-effort).
      if (cacheName) {
        await this.promptService.deleteContextCache(cacheName);
      }
    }
  }

  /** Bloc de contexte partagé mis en cache et réutilisé par les rédacteurs. */
  private buildSharedContext(ctx: ResearchTeamContext): string {
    return (
      `CONTEXTE PROJET:\n${ctx.projectContext}\n` +
      (ctx.brandContext ? `\nCONTEXTE MARQUE:\n${ctx.brandContext}\n` : '') +
      (ctx.currency ? `\nDEVISE: ${ctx.currency}\n` : '')
    );
  }

  // -------------------------------------------------------------------------
  // Pipeline d'une section
  // -------------------------------------------------------------------------

  private async runSection(
    runId: string,
    section: DeliverableSection,
    ctx: ResearchTeamContext,
    emit: ResearchEmit
  ): Promise<ResearchedSection> {
    try {
      let sources: ResearchSource[] = [];
      let researchDigest = '';

      if (section.needsResearch) {
        const research = await this.research(runId, section, ctx, emit);
        sources = research.sources;
        researchDigest = research.digest;
      }

      const draft = await this.write(runId, section, ctx, sources, researchDigest, emit);
      const verdict = await this.verify(runId, section, ctx, draft, sources, emit);

      let finalData = draft;
      // Une seule passe de correction si des problèmes critiques subsistent.
      if (!verdict.passed && verdict.issues.some((iss) => iss.severity === 'critical')) {
        finalData = await this.reviseAfterVerification(
          runId,
          section,
          ctx,
          draft,
          sources,
          verdict,
          emit
        );
      }

      const finalizedHtml = this.finalizeSectionHtml(finalData, sources, ctx.language);
      const result: ResearchedSection = {
        name: section.name,
        data: finalizedHtml,
        summary: `${section.name} — ${sources.length} source(s) vérifiée(s)`,
        sources,
        verdict,
      };

      await this.emitAgent(emit, runId, 'writer', `writer:${section.name}`, section.name, {
        kind: 'agent_status',
        status: 'done',
        message: 'Section finalisée',
      });
      return result;
    } catch (err: any) {
      logger.error(`ResearchTeam section "${section.name}" failed: ${err.message}`, {
        stack: err.stack,
      });
      await this.emitAgent(emit, runId, 'orchestrator', 'orchestrator', section.name, {
        kind: 'agent_status',
        status: 'error',
        message: `Échec sur "${section.name}": ${err.message}`,
      });
      // On renvoie une section dégradée (HTML) plutôt que d'interrompre tout le run.
      return {
        name: section.name,
        data:
          '<div class="w-[210mm] min-h-[297mm] p-[12mm] flex items-center justify-center">' +
          '<p class="text-sm text-gray-500">⚠️ La génération sourcée de cette section a échoué. ' +
          'Vous pouvez la régénérer.</p></div>',
        summary: `${section.name} — échec de génération`,
        sources: [],
      };
    }
  }

  // -------------------------------------------------------------------------
  // Agent chercheur (grounding)
  // -------------------------------------------------------------------------

  private async research(
    runId: string,
    section: DeliverableSection,
    ctx: ResearchTeamContext,
    emit: ResearchEmit
  ): Promise<{ sources: ResearchSource[]; digest: string }> {
    const agentId = `researcher:${section.name}`;
    const briefs = (section.researchBriefs && section.researchBriefs.length > 0
      ? section.researchBriefs
      : this.deriveBriefs(section, ctx)
    ).slice(0, MAX_BRIEFS_PER_SECTION);

    // Cache: une reprise/régénération ne relance pas des recherches identiques.
    const cacheKey = this.researchCacheKey(ctx, section.name, briefs);
    const cached = await cacheService.get<{ sources: ResearchSource[]; digest: string }>(cacheKey, {
      prefix: 'ai',
      ttl: RESEARCH_CACHE_TTL,
    });
    if (cached && Array.isArray(cached.sources)) {
      await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
        kind: 'agent_status',
        status: 'searching',
        message: `Réutilisation de ${cached.sources.length} source(s) déjà collectée(s)`,
      });
      for (const source of cached.sources) {
        await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
          kind: 'source_found',
          source,
        });
      }
      await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
        kind: 'agent_status',
        status: 'done',
        message: `${cached.sources.length} source(s) réutilisée(s)`,
      });
      return cached;
    }

    await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
      kind: 'agent_status',
      status: 'searching',
      message: `Recherche de données réelles pour « ${section.name} »`,
    });

    // UN SEUL appel grounded consolidé pour toute la section (le modèle lance
    // lui-même plusieurs recherches web internes pour couvrir chaque axe).
    const result = await this.runGrounded(runId, agentId, section.name, briefs, ctx, emit);

    const globalSources: ResearchSource[] = [];
    const urlToId = new Map<string, string>();
    const localIdxToGlobalId = new Map<number, string>();
    for (const src of result.sources) {
      let id = urlToId.get(src.url);
      if (!id) {
        id = `s${globalSources.length + 1}`;
        urlToId.set(src.url, id);
        const source: ResearchSource = {
          id,
          title: src.title,
          url: src.url,
          domain: src.domain,
          retrievedAt: new Date().toISOString(),
        };
        globalSources.push(source);
        await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
          kind: 'source_found',
          source,
        });
      }
      localIdxToGlobalId.set(src.index, id);
    }

    for (const support of result.supports) {
      const sourceIds = support.sourceIndexes
        .map((idx) => localIdxToGlobalId.get(idx))
        .filter((v): v is string => !!v);
      if (sourceIds.length === 0) continue;
      const finding: ResearchFinding = { claim: support.text, sourceIds };
      await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
        kind: 'finding',
        finding,
      });
    }

    await this.emitAgent(emit, runId, 'researcher', agentId, section.name, {
      kind: 'agent_status',
      status: 'done',
      message: `${globalSources.length} source(s) réelle(s) collectée(s)`,
    });

    const narratives = result.narrative.trim() ? [result.narrative.trim()] : [];
    const digest = this.buildResearchDigest(narratives, globalSources);
    const payload = { sources: globalSources, digest };
    await cacheService.set(cacheKey, payload, { prefix: 'ai', ttl: RESEARCH_CACHE_TTL });
    return payload;
  }

  /**
   * Un unique appel grounded pour toute la section: tous les axes sont fusionnés
   * en une seule mission. Gemini exécute plusieurs recherches web internes, ce
   * qui divise par 2–3 le nombre d'appels (donc latence + coût) à couverture égale.
   */
  private async runGrounded(
    runId: string,
    agentId: string,
    sectionName: string,
    briefs: string[],
    ctx: ResearchTeamContext,
    emit: ResearchEmit
  ): Promise<BriefResult> {
    const mission = briefs.map((b, i) => `${i + 1}. ${b}`).join('\n');

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          "Tu es un analyste de recherche rigoureux. Tu utilises la recherche web pour trouver des données FACTUELLES et RÉCENTES. " +
          "Règle absolue: n'affirme AUCUN chiffre, statistique, part de marché, taille de marché, taux ou montant qui ne provienne PAS des résultats de recherche. " +
          "Si une donnée est introuvable, dis-le explicitement plutôt que de l'estimer. Cite systématiquement les chiffres avec leur année et leur périmètre géographique.",
      },
      {
        role: 'user',
        content:
          `CONTEXTE PROJET:\n${ctx.projectContext}\n\n` +
          `DONNÉES À TROUVER (lance autant de recherches web que nécessaire pour couvrir chaque point):\n${mission}\n\n` +
          "Fournis une synthèse factuelle et concise couvrant CHAQUE point (données chiffrées avec année + zone géographique). " +
          "N'invente rien. Si tu ne trouves pas une donnée, indique 'Donnée non trouvée'.",
      },
    ];

    const grounded = await this.promptService.runGroundedResearch(
      { ...RESEARCH_CONFIG, userId: ctx.userId, language: ctx.language },
      messages
    );

    for (const query of grounded.queries) {
      await this.emitAgent(emit, runId, 'researcher', agentId, sectionName, {
        kind: 'search_query',
        query,
      });
    }

    return {
      brief: sectionName,
      queries: grounded.queries,
      sources: grounded.sources,
      supports: grounded.supports,
      narrative: grounded.text,
    };
  }

  /** Clé de cache stable pour la recherche d'une section. */
  private researchCacheKey(
    ctx: ResearchTeamContext,
    sectionName: string,
    briefs: string[]
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${ctx.projectContext}|${ctx.language}|${sectionName}|${briefs.join('||')}`)
      .digest('hex')
      .slice(0, 20);
    return cacheService.generateAIKey('research', ctx.userId, sectionName.replace(/\s+/g, '-'), hash);
  }

  // -------------------------------------------------------------------------
  // Agent rédacteur
  // -------------------------------------------------------------------------

  private async write(
    runId: string,
    section: DeliverableSection,
    ctx: ResearchTeamContext,
    sources: ResearchSource[],
    researchDigest: string,
    emit: ResearchEmit
  ): Promise<string> {
    const agentId = `writer:${section.name}`;
    await this.emitAgent(emit, runId, 'writer', agentId, section.name, {
      kind: 'agent_status',
      status: 'writing',
      message: `Rédaction de « ${section.name} » à partir des faits sourcés`,
    });

    const sourceList = this.renderSourceList(sources);
    const groundingRules = section.needsResearch
      ? 'RÈGLES DE DONNÉES ET DE CITATION (STRICTES):\n' +
        "- Chaque chiffre, statistique, taille/part de marché, taux ou montant affiché DOIT être suivi d'un marqueur de citation inline au format [sN] renvoyant à la liste des sources ci-dessous.\n" +
        '- Les GRAPHIQUES (Chart.js) ne doivent tracer QUE des données réelles issues de la synthèse de recherche ou des données financières fournies. Ne trace JAMAIS un graphique à partir de chiffres inventés : si aucune série chiffrée fiable et sourcée n\'est disponible pour un graphe, remplace-le par un visuel qualitatif (schéma, liste, cartouche) plutôt qu\'un graphe inventé.\n' +
        "- N'utilise QUE les faits présents dans la synthèse de recherche. Si une donnée manque, dis-le explicitement plutôt que d'estimer.\n" +
        "- N'invente jamais d'identifiant de source : n'utilise que les [sN] listés.\n" +
        "- N'ajoute PAS toi-même de liste « Sources » à la fin : elle est ajoutée automatiquement au document."
      : "Cette section est qualitative (pas de recherche web) : n'invente pas de statistiques de marché ni de chiffres externes. Les éventuels graphiques ne doivent illustrer que des éléments internes au plan (jalons, échéancier, répartition d'objectifs), sans chiffres de marché inventés.";

    // Le contexte projet/marque est déjà dans le cache partagé quand il est
    // actif → on ne le renvoie pas (économie d'input tokens).
    const sharedBlock = ctx.sharedCache ? '' : this.buildSharedContext(ctx);

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          "Tu es un directeur artistique éditorial et rédacteur expert de business plans « investor-grade ». " +
          'Tu produis des PAGES A4 en HTML + Tailwind CSS (mise en page soignée, graphes Chart.js), ' +
          'en suivant À LA LETTRE les instructions de contenu et de mise en page fournies (structure, charts, format A4 multi-pages). ' +
          'Tu écris dans la langue demandée, dans un style professionnel et concret. ' +
          groundingRules,
      },
      {
        role: 'user',
        content:
          sharedBlock +
          `\nSECTION À RÉDIGER : ${section.name}\n\n` +
          `INSTRUCTIONS DE CONTENU ET DE MISE EN PAGE (À SUIVRE STRICTEMENT) :\n${section.instructions}\n` +
          (section.needsResearch
            ? `\n--- SYNTHÈSE DE RECHERCHE (faits réels collectés — SEULE source de chiffres autorisée) ---\n${researchDigest}\n` +
              `\n--- SOURCES DISPONIBLES (utilise ces ids pour les citations [sN]) ---\n${sourceList}\n`
            : '') +
          `\nProduis UNIQUEMENT le HTML (Tailwind) de la section « ${section.name} », en respectant le format A4 (la page peut s'étendre sur plusieurs pages A4 si le contenu est riche). ` +
          'Pas de bloc de code markdown, pas de préfixe « html », pas d\'explication : uniquement le HTML de la section.',
      },
    ];

    // Streaming: l'aperçu du texte s'affiche pendant la rédaction (latence
    // perçue). Émission throttlée (~300 ms) de la fin du texte en cours.
    let lastEmitAt = 0;
    const onDelta = (text: string): void => {
      const now = Date.now();
      if (now - lastEmitAt < 300) return;
      lastEmitAt = now;
      void this.safeEmit(emit, {
        type: 'writer_delta',
        section: section.name,
        preview: text.slice(-240),
        timestamp: new Date().toISOString(),
      });
    };

    const content = this.promptService.getCleanAIText(
      await this.promptService.runPromptStream(
        {
          ...WRITER_CONFIG,
          userId: ctx.userId,
          language: ctx.language,
          ...(ctx.sharedCache ? { cachedContent: ctx.sharedCache } : {}),
        },
        messages,
        onDelta
      )
    );

    await this.emitAgent(emit, runId, 'writer', agentId, section.name, {
      kind: 'section_drafted',
      section: section.name,
      wordCount: this.countWords(content),
      sourceCount: sources.length,
    });

    return content;
  }

  // -------------------------------------------------------------------------
  // Agent vérificateur
  // -------------------------------------------------------------------------

  private async verify(
    runId: string,
    section: DeliverableSection,
    ctx: ResearchTeamContext,
    draft: string,
    sources: ResearchSource[],
    emit: ResearchEmit
  ): Promise<VerificationVerdict> {
    const agentId = `verifier:${section.name}`;
    await this.emitAgent(emit, runId, 'verifier', agentId, section.name, {
      kind: 'agent_status',
      status: 'verifying',
      message: `Contrôle des sources de « ${section.name} »`,
    });

    // Section qualitative sans recherche: on ne bloque pas, verdict neutre.
    if (!section.needsResearch) {
      const verdict: VerificationVerdict = {
        passed: true,
        citedClaims: 0,
        uncitedClaims: 0,
        issues: [],
      };
      await this.emitAgent(emit, runId, 'verifier', agentId, section.name, {
        kind: 'verification',
        section: section.name,
        verdict,
      });
      return verdict;
    }

    // Optimisation tokens: on ne soumet au vérificateur que les phrases
    // contenant des chiffres (les seules à devoir porter une citation). Si la
    // section n'avance aucun chiffre, rien à vérifier → aucun appel LLM.
    // IMPORTANT: le draft est du HTML → on ne vérifie que le TEXTE VISIBLE
    // (les classes Tailwind `w-[210mm]`, couleurs `#2563eb` et scripts Chart.js
    // regorgent de nombres qui ne sont PAS des données à sourcer).
    const numeric = this.extractNumericSentences(this.htmlToVisibleText(draft));
    if (!numeric) {
      const verdict: VerificationVerdict = {
        passed: true,
        citedClaims: 0,
        uncitedClaims: 0,
        issues: [],
      };
      await this.emitAgent(emit, runId, 'verifier', agentId, section.name, {
        kind: 'verification',
        section: section.name,
        verdict,
      });
      return verdict;
    }

    const allowedIds = sources.map((s) => s.id).join(', ') || '(aucune)';
    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          "Tu es un vérificateur qualité anti-hallucination. Tu reçois les phrases CHIFFRÉES d'une section et la liste des identifiants de sources autorisés. " +
          "Ta mission: repérer toute donnée chiffrée (statistique, taille/part de marché, taux, montant, date) NON accompagnée d'une citation [sN] valide (id présent dans la liste autorisée). " +
          "Réponds STRICTEMENT en JSON.",
      },
      {
        role: 'user',
        content:
          `IDS DE SOURCES AUTORISÉS: [${allowedIds}]\n\n` +
          `PHRASES CHIFFRÉES À VÉRIFIER:\n"""\n${numeric}\n"""\n\n` +
          'Réponds avec ce schéma JSON exact:\n' +
          '{\n' +
          '  "citedClaims": <nombre de données chiffrées correctement citées>,\n' +
          '  "uncitedClaims": <nombre de données chiffrées sans citation valide>,\n' +
          '  "issues": [{ "claim": "<extrait fautif>", "reason": "<pourquoi>", "severity": "info|warning|critical" }]\n' +
          '}\n' +
          'Une donnée chiffrée sans [sN] valide = severity "critical". Aucune donnée fautive → issues: [].',
      },
    ];

    let verdict: VerificationVerdict = {
      passed: true,
      citedClaims: 0,
      uncitedClaims: 0,
      issues: [],
    };
    try {
      const raw = await this.promptService.runPrompt(
        { ...VERIFIER_CONFIG, userId: ctx.userId, skipQuotaCheck: true },
        messages
      );
      const parsed = this.parseJSON(raw);
      const uncited = Number(parsed.uncitedClaims) || 0;
      verdict = {
        passed: uncited === 0,
        citedClaims: Number(parsed.citedClaims) || 0,
        uncitedClaims: uncited,
        issues: Array.isArray(parsed.issues)
          ? parsed.issues.slice(0, 20).map((iss: any) => ({
              claim: String(iss.claim || '').slice(0, 400),
              reason: String(iss.reason || ''),
              severity: ['info', 'warning', 'critical'].includes(iss.severity)
                ? iss.severity
                : 'warning',
            }))
          : [],
      };
    } catch (err: any) {
      logger.warn(`Verifier failed for "${section.name}": ${err.message}`);
    }

    await this.emitAgent(emit, runId, 'verifier', agentId, section.name, {
      kind: 'verification',
      section: section.name,
      verdict,
    });
    return verdict;
  }

  private async reviseAfterVerification(
    runId: string,
    section: DeliverableSection,
    ctx: ResearchTeamContext,
    draft: string,
    sources: ResearchSource[],
    verdict: VerificationVerdict,
    emit: ResearchEmit
  ): Promise<string> {
    const agentId = `writer:${section.name}`;
    await this.emitAgent(emit, runId, 'writer', agentId, section.name, {
      kind: 'agent_status',
      status: 'writing',
      message: 'Correction des données non sourcées signalées',
    });

    const issuesText = verdict.issues
      .map((iss, i) => `${i + 1}. [${iss.severity}] ${iss.claim} — ${iss.reason}`)
      .join('\n');
    const allowedIds = sources.map((s) => s.id).join(', ') || '(aucune)';

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          'Tu corriges une section de business plan (HTML + Tailwind) pour supprimer toute donnée chiffrée non sourcée. ' +
          'Pour chaque problème : soit tu ajoutes un marqueur de citation [sN] valide si un fait sourcé le justifie, ' +
          'soit tu reformules pour retirer le chiffre non vérifiable (sans inventer). Ne rajoute jamais de nouveau chiffre non sourcé. ' +
          'Conserve intégralement la mise en page HTML, les classes Tailwind et les graphiques Chart.js existants. ' +
          "N'ajoute PAS de liste « Sources » (elle est ajoutée automatiquement).",
      },
      {
        role: 'user',
        content:
          `IDS DE SOURCES AUTORISÉS: [${allowedIds}]\n\n` +
          `PROBLÈMES À CORRIGER:\n${issuesText}\n\n` +
          `SECTION ACTUELLE (HTML):\n"""\n${draft}\n"""\n\n` +
          'Renvoie la version corrigée complète de la section en HTML (Tailwind), sans bloc de code markdown ni préfixe « html ».',
      },
    ];

    const revised = this.promptService.getCleanAIText(
      await this.promptService.runPrompt(
        { ...WRITER_CONFIG, userId: ctx.userId, language: ctx.language, skipQuotaCheck: true },
        messages
      )
    );
    return revised || draft;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private deriveBriefs(section: DeliverableSection, ctx: ResearchTeamContext): string[] {
    // Briefs génériques dérivés du nom de section + contexte. Volontairement
    // simples et déterministes (pas d'appel LLM supplémentaire).
    const base = section.name;
    return [
      `Données de marché récentes et chiffrées liées à « ${base} » pour ce projet: ${ctx.projectContext.slice(0, 300)}`,
      `Statistiques sectorielles, tendances et benchmarks concurrentiels pertinents pour « ${base} »`,
    ];
  }

  private buildResearchDigest(narratives: string[], sources: ResearchSource[]): string {
    if (narratives.length === 0) {
      return 'Aucune donnée sourcée n\'a pu être collectée. Rédige la section sans avancer de chiffres non vérifiables.';
    }
    // Borne le digest transmis au rédacteur (économie de tokens en entrée).
    const joined = narratives.join('\n\n');
    const body =
      joined.length > MAX_DIGEST_CHARS ? `${joined.slice(0, MAX_DIGEST_CHARS)}\n…` : joined;
    return body + '\n\n' + this.renderSourceList(sources);
  }

  /** Extrait les phrases contenant au moins un chiffre (borné), pour la vérif. */
  private extractNumericSentences(text: string): string {
    return text
      .split(/(?<=[.!?\n])\s+/)
      .filter((s) => /\d/.test(s))
      .join('\n')
      .slice(0, 6000);
  }

  private renderSourceList(sources: ResearchSource[]): string {
    if (sources.length === 0) return '(aucune source disponible)';
    return sources
      .map((s) => `[${s.id}] ${s.title}${s.domain ? ` (${s.domain})` : ''} — ${s.url}`)
      .join('\n');
  }

  /**
   * Finalise le HTML d'une section :
   *  1. convertit les marqueurs de citation `[sN]` en exposants HTML discrets
   *     (les ids inconnus sont retirés) — au format inline non capté par le
   *     sanitizer PDF (qui supprimerait les `[sN]` bruts et un bloc markdown) ;
   *  2. ajoute un bloc « Sources » déterministe (généré côté serveur à partir de
   *     `sources`, donc TOUJOURS présent dans le document et jamais halluciné).
   */
  private finalizeSectionHtml(
    content: string,
    sources: ResearchSource[],
    language: string
  ): string {
    const validIds = new Set(sources.map((s) => s.id.toLowerCase()));
    // [sN] → exposant cliquable-like ; garde le mapping numéro ↔ liste des sources.
    let html = content.replace(/\[s(\d+)\]/gi, (_m, n: string) => {
      if (!validIds.has(`s${n}`.toLowerCase())) return '';
      return `<sup class="align-super text-[9px] font-semibold text-[#2563eb]">${n}</sup>`;
    });

    if (sources.length === 0) return html.trim();
    return `${html.trim()}\n${this.renderSourcesHtml(sources, language)}`;
  }

  /**
   * Bloc « Sources » en HTML, volontairement « sanitizer-safe » : pas de titre
   * markdown `#### Sources`, pas de marqueur `[sN]`, pas d'ancre de redirection
   * grounding — tous supprimés par {@link sanitizeSectionHtml} avant le PDF.
   * Le numéro affiché correspond au N des exposants [sN] du corps.
   */
  private renderSourcesHtml(sources: ResearchSource[], language: string): string {
    const title = language.toLowerCase().startsWith('fr') ? 'Sources' : 'Sources';
    const items = sources
      .map((s) => {
        const n = s.id.replace(/^s/i, '');
        const domain = s.domain
          ? ` <span class="text-gray-400">— ${this.escapeHtml(s.domain)}</span>`
          : '';
        return (
          `<li class="mb-1"><span class="font-semibold text-gray-700">${this.escapeHtml(n)}.</span> ` +
          `<span class="text-gray-600">${this.escapeHtml(s.title)}</span>${domain}</li>`
        );
      })
      .join('');
    return (
      '<div class="w-[210mm] px-[12mm] pb-[12mm] pt-6 mt-6 border-t border-gray-200 break-inside-avoid" ' +
      'style="break-inside:avoid;page-break-inside:avoid;">' +
      `<h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">${title}</h3>` +
      `<ol class="list-none text-[10px] leading-snug">${items}</ol></div>`
    );
  }

  /** Texte visible d'un HTML (sans <script>/<style>/balises) pour la vérification. */
  private htmlToVisibleText(html: string): string {
    return html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Échappe le texte injecté dans le HTML des sources. */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  private parseJSON(raw: string): any {
    const cleaned = this.promptService
      .getCleanAIText(raw)
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
      return {};
    }
  }

  // -------------------------------------------------------------------------
  // Émission d'événements
  // -------------------------------------------------------------------------

  private event(
    runId: string,
    role: AgentRole,
    agentId: string,
    payload: AgentEventPayload,
    section?: string
  ): AgentEvent {
    return {
      ts: new Date().toISOString(),
      runId,
      agentId,
      role,
      section,
      ...payload,
    } as AgentEvent;
  }

  private async emitAgent(
    emit: ResearchEmit,
    runId: string,
    role: AgentRole,
    agentId: string,
    section: string | undefined,
    payload: AgentEventPayload
  ): Promise<void> {
    await this.safeEmit(emit, {
      type: 'agent_event',
      timestamp: new Date().toISOString(),
      agentEvent: this.event(runId, role, agentId, payload, section),
    });
  }

  private async safeEmit(emit: ResearchEmit, event: Parameters<ResearchEmit>[0]): Promise<void> {
    try {
      await emit(event);
    } catch (err: any) {
      logger.warn(`ResearchTeam emit failed: ${err.message}`);
    }
  }
}

export const researchTeamService = new ResearchTeamService(promptService);
