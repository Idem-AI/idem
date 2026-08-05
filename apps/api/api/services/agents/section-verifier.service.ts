/**
 * Vérification bornée d'une section produite.
 *
 * Trois paliers, dans cet ordre — chacun n'est atteint que si le précédent n'a
 * pas suffi, ce qui borne le coût par construction:
 *
 *   1. Contrôle déterministe   (`quality-gate.ts`)            — gratuit.
 *   2. Réparation déterministe (fences, bavardage d'intro)    — gratuit.
 *   3. Réparation IA, UNE passe, au tier bas                  — payante, rare.
 *
 * Ce qui n'est PAS fait ici, volontairement: pas de débat entre agents, pas de
 * boucle « critique → réécriture » sans borne. Au-delà d'une passe, on livre la
 * section avec un drapeau plutôt que de dépenser en aveugle: une section
 * imparfaite affichée vaut mieux qu'une section coûteuse jamais livrée.
 */

import logger from '../../config/logger';
import { logAIEvent } from '../../utils/ai-trace.util';
import { RunBudget, runAgentPrompt } from './agent-runtime';
import { QualityExpectation, QualityReport, inspectOutput, qualityValidator } from './quality-gate';

/** Au-delà, réparer coûte plus cher que de laisser passer: on se contente du drapeau. */
const MAX_REPAIR_CHARS = 60_000;

export interface VerificationContext {
  userId?: string;
  projectId?: string;
  /** Nom de la section — journalisé et injecté dans le prompt de réparation. */
  sectionName: string;
  budget?: RunBudget;
  language?: string;
}

export interface VerificationOutcome {
  content: string;
  /** Une correction a été appliquée (déterministe ou IA). */
  repaired: boolean;
  /** La correction a nécessité un appel modèle. */
  repairedByModel: boolean;
  /** Des défauts bloquants subsistent — la section est livrée telle quelle. */
  flagged: boolean;
  report: QualityReport;
}

const REPAIR_SYSTEM_PROMPT = `Tu es un réparateur de sortie. On te donne un contenu généré et la liste EXACTE de ses défauts.
Règles absolues:
- Tu renvoies UNIQUEMENT le contenu corrigé, rien d'autre: pas d'explication, pas de préambule, pas de bloc de code.
- Tu corriges UNIQUEMENT les défauts listés. Tout le reste doit rester identique, mot pour mot.
- Si un contenu est tronqué, tu le complètes dans le même style et la même structure, sans réécrire l'existant.
- Tu ne changes jamais les chiffres, les noms propres, les couleurs ni les URLs présents.`;

/**
 * Nettoyages qu'aucun modèle ne devrait avoir à faire: on les applique en code.
 * Renvoie le contenu nettoyé (identique si rien à faire).
 */
function deterministicRepair(content: string): string {
  let out = content;

  // Clôtures de bloc de code résiduelles autour du livrable.
  out = out.replace(/^\s*```(?:html|json|markdown|md)?\s*\n?/i, '');
  out = out.replace(/\n?\s*```\s*$/i, '');

  // Phrase d'introduction du modèle avant le vrai contenu ("Voici le HTML…").
  out = out.replace(
    /^\s*(voici|here is|here's|bien s[ûu]r|certainly)\b[^\n]{0,120}(html|section|slide|code|contenu|content)[^\n]*\n+/i,
    ''
  );

  return out.trim();
}

/**
 * Contrôle une section et la répare si nécessaire — au plus une passe modèle.
 */
export async function verifySection(
  content: string,
  expectation: QualityExpectation,
  ctx: VerificationContext
): Promise<VerificationOutcome> {
  const initial = inspectOutput(content, expectation);
  if (initial.ok) {
    return {
      content,
      repaired: false,
      repairedByModel: false,
      flagged: false,
      report: initial,
    };
  }

  logAIEvent('quality.gate_failed', {
    projectId: ctx.projectId,
    section: ctx.sectionName,
    issues: initial.issues.map((i) => i.code),
  });

  // Palier 2 — réparation gratuite.
  const cleaned = deterministicRepair(content);
  if (cleaned !== content) {
    const afterCleanup = inspectOutput(cleaned, expectation);
    if (afterCleanup.ok) {
      logAIEvent('quality.repaired_deterministic', {
        projectId: ctx.projectId,
        section: ctx.sectionName,
      });
      return {
        content: cleaned,
        repaired: true,
        repairedByModel: false,
        flagged: false,
        report: afterCleanup,
      };
    }
  }

  const base = cleaned || content;
  const stillBroken = inspectOutput(base, expectation);

  // Palier 3 — une passe IA, seulement si elle est rentable et finançable.
  if (base.length > MAX_REPAIR_CHARS || ctx.budget?.exhausted) {
    logger.warn(
      `Section "${ctx.sectionName}": réparation IA ignorée (taille=${base.length}, budget épuisé=${Boolean(
        ctx.budget?.exhausted
      )}) — livrée avec drapeau.`
    );
    return flag(base, stillBroken, cleaned !== content);
  }

  const issueList = stillBroken.blocking.map((i) => `- ${i.message}`).join('\n');
  const prompt = `SECTION: ${ctx.sectionName}

DÉFAUTS À CORRIGER:
${issueList}

CONTENU À CORRIGER:
${base}`;

  try {
    const result = await runAgentPrompt(
      {
        role: 'section-repair',
        task: 'repair',
        systemPrompt: REPAIR_SYSTEM_PROMPT,
        promptType: 'quality-repair',
        // Le réparateur doit pouvoir réémettre tout le contenu reçu.
        llmOptions: { maxOutputTokens: Math.min(32000, Math.ceil(base.length / 2) + 2000) },
        validate: qualityValidator(expectation),
        // Un seul cran: si le tier bas n'y arrive pas, le tier de rédaction essaie.
        escalate: true,
      },
      prompt,
      {
        userId: ctx.userId,
        projectId: ctx.projectId,
        element: ctx.sectionName,
        budget: ctx.budget,
        language: ctx.language,
        bypassOutputTokenCap: true,
      }
    );

    const repairedReport = inspectOutput(result.text, expectation);
    if (repairedReport.ok) {
      logAIEvent('quality.repaired_by_model', {
        projectId: ctx.projectId,
        section: ctx.sectionName,
        tier: result.tier,
        escalated: result.escalated,
      });
      return {
        content: result.text,
        repaired: true,
        repairedByModel: true,
        flagged: false,
        report: repairedReport,
      };
    }

    // La réparation n'a pas convergé: on garde la MEILLEURE des deux versions
    // (moins de défauts bloquants), jamais une version dégradée.
    const keepRepaired = repairedReport.blocking.length < stillBroken.blocking.length;
    const finalContent = keepRepaired ? result.text : base;
    const finalReport = keepRepaired ? repairedReport : stillBroken;
    return flag(finalContent, finalReport, keepRepaired || cleaned !== content, keepRepaired);
  } catch (error: any) {
    logger.warn(`Réparation de "${ctx.sectionName}" impossible: ${error?.message}`);
    return flag(base, stillBroken, cleaned !== content);
  }
}

function flag(
  content: string,
  report: QualityReport,
  repaired: boolean,
  repairedByModel = false
): VerificationOutcome {
  logAIEvent('quality.flagged', { issues: report.blocking.map((i) => i.code) });
  return { content, repaired, repairedByModel, flagged: true, report };
}
