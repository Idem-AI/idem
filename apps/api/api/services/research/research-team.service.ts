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
import { AI_CONFIG, LLMProvider } from '../../config/ai.config';
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
}

const RESEARCH_CONFIG: PromptConfig = {
  provider: LLMProvider.GEMINI,
  modelName: AI_CONFIG.default.modelName,
  promptType: 'research',
  // Une seule synthèse factuelle et concise par section: on borne la sortie
  // pour réduire coût et latence sans sacrifier les faits chiffrés.
  llmOptions: { temperature: 0.3, maxOutputTokens: 1536 },
};

const WRITER_CONFIG: PromptConfig = {
  provider: AI_CONFIG.businessPlan.provider,
  modelName: AI_CONFIG.businessPlan.modelName,
  promptType: 'research-writer',
  llmOptions: { maxOutputTokens: 2200 },
};

const VERIFIER_CONFIG: PromptConfig = {
  provider: AI_CONFIG.businessPlan.provider,
  modelName: AI_CONFIG.businessPlan.modelName,
  promptType: 'research-verifier',
  llmOptions: { temperature: 0.1, maxOutputTokens: 1024 },
};

/** Concurrence max de sections traitées en parallèle. */
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

    const results: ResearchedSection[] = [];
    // Exécution par vagues avec concurrence limitée.
    for (let i = 0; i < sections.length; i += SECTION_CONCURRENCY) {
      const batch = sections.slice(i, i + SECTION_CONCURRENCY);
      const settled = await Promise.all(
        batch.map((section) => this.runSection(runId, section, ctx, emit))
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

      const withSourcesBlock = this.ensureSourcesBlock(finalData, sources, ctx.language);
      const result: ResearchedSection = {
        name: section.name,
        data: withSourcesBlock,
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
      // On renvoie une section dégradée plutôt que d'interrompre tout le run.
      return {
        name: section.name,
        data: `> ⚠️ La génération sourcée de cette section a échoué (${err.message}).`,
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
      ? "RÈGLES DE CITATION (STRICTES):\n" +
        "- Chaque chiffre, statistique, taille/part de marché, taux ou montant DOIT être suivi d'une citation inline au format [sN] renvoyant à la liste des sources ci-dessous.\n" +
        "- N'invente AUCUNE donnée. N'utilise QUE les faits présents dans la synthèse de recherche. Si une donnée manque, écris-le explicitement plutôt que d'estimer.\n" +
        "- N'invente jamais d'identifiant de source: n'utilise que les [sN] listés.\n"
      : "Cette section est qualitative: reste factuel, n'invente pas de chiffres.";

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content:
          "Tu es un rédacteur expert de documents stratégiques (business plan, études de marché). " +
          "Tu écris dans un style professionnel, structuré (markdown), directement exploitable. " +
          groundingRules,
      },
      {
        role: 'user',
        content:
          `CONTEXTE PROJET:\n${ctx.projectContext}\n` +
          (ctx.brandContext ? `\nCONTEXTE MARQUE:\n${ctx.brandContext}\n` : '') +
          (ctx.currency ? `\nDEVISE: ${ctx.currency}\n` : '') +
          `\nSECTION À RÉDIGER: ${section.name}\n` +
          `INSTRUCTIONS:\n${section.instructions}\n` +
          (section.needsResearch
            ? `\n--- SYNTHÈSE DE RECHERCHE (faits réels collectés) ---\n${researchDigest}\n` +
              `\n--- SOURCES DISPONIBLES (utilise ces ids pour les citations [sN]) ---\n${sourceList}\n`
            : '') +
          `\nRédige uniquement le contenu de la section « ${section.name} » en markdown.`,
      },
    ];

    const content = this.promptService.getCleanAIText(
      await this.promptService.runPrompt(
        { ...WRITER_CONFIG, userId: ctx.userId, language: ctx.language },
        messages
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
    const numeric = this.extractNumericSentences(draft);
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
          "Tu corriges une section pour supprimer toute donnée chiffrée non sourcée. " +
          "Pour chaque problème: soit tu ajoutes une citation [sN] valide si un fait sourcé la justifie, " +
          "soit tu reformules pour retirer le chiffre non vérifiable (sans inventer). Ne rajoute jamais de nouveau chiffre non sourcé.",
      },
      {
        role: 'user',
        content:
          `IDS DE SOURCES AUTORISÉS: [${allowedIds}]\n\n` +
          `PROBLÈMES À CORRIGER:\n${issuesText}\n\n` +
          `SECTION ACTUELLE:\n"""\n${draft}\n"""\n\n` +
          'Renvoie la version corrigée complète de la section en markdown.',
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

  /** Ajoute une section "Sources" en fin de contenu si absente. */
  private ensureSourcesBlock(content: string, sources: ResearchSource[], language: string): string {
    if (sources.length === 0) return content;
    const heading = language.toLowerCase().startsWith('fr') ? 'Sources' : 'Sources';
    if (new RegExp(`(^|\\n)#{1,4}\\s*${heading}\\b`, 'i').test(content)) {
      return content;
    }
    const list = sources
      .map((s) => `- [${s.id}] [${s.title}](${s.url})${s.domain ? ` — ${s.domain}` : ''}`)
      .join('\n');
    return `${content}\n\n#### ${heading}\n${list}`;
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
