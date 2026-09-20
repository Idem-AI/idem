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

/**
 * Longueur de la queue transmise au continuateur. Assez pour faire le raccord
 * (balises ouvertes, phrase en cours, style), pas assez pour qu'on repaie la
 * section. C'est tout l'intérêt du chemin.
 */
const TAIL_CHARS = 3_000;

const CONTINUE_SYSTEM_PROMPT = `You continue a truncated fragment. You are given only its ENDING.
Absolute rules:
- Emit ONLY the missing tail, starting exactly where the excerpt stops — mid-word if that is where it stops.
- Never repeat anything from the excerpt, never restate what precedes.
- Close every tag left open, in the right order.
- Keep the same language, the same tone and the same markup conventions as the excerpt.
- No explanation, no preamble, no code fence.`;

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

const REPAIR_SYSTEM_PROMPT = `You repair generated output. You are given a piece of generated content and the EXACT list of its defects.
Absolute rules:
- Return ONLY the corrected content, nothing else: no explanation, no preamble, no code fence.
- Fix ONLY the listed defects. Everything else stays identical, word for word.
- If the content is truncated, complete it in the same style and structure, without rewriting what is already there.
- Keep the content in its ORIGINAL LANGUAGE.
- Never change the figures, proper nouns, colours or URLs present.`;

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

  // Palier 3a — TRONCATURE SEULE : on continue, on ne réécrit pas.
  //
  // C'est le défaut le plus fréquent, et la réparation générique y répondait de
  // la pire façon : réémettre l'intégralité de la section (jusqu'à 15 000 tokens)
  // à l'étage bas. Cela coûte une génération complète de plus ET dégrade le
  // texte déjà correct, puisqu'un plus petit modèle le réécrit.
  //
  // Une troncature ne se répare pas en réécrivant : elle se répare en
  // CONTINUANT. Le modèle ne reçoit que la fin du fragment — de quoi faire le
  // raccord — et produit la queue manquante, au MÊME étage que l'auteur pour
  // qu'il n'y ait aucune rupture de niveau au milieu de la page.
  const truncationOnly =
    stillBroken.blocking.length > 0 &&
    stillBroken.blocking.every((i) => i.code === 'truncated' || i.code === 'unbalanced_html');

  if (truncationOnly) {
    try {
      const continuation = await runAgentPrompt(
        {
          role: 'section-continue',
          task: 'draft',
          systemPrompt: CONTINUE_SYSTEM_PROMPT,
          promptType: 'quality-continue',
          llmOptions: { maxOutputTokens: 8000, temperature: 0.3 },
        },
        `SECTION: ${ctx.sectionName}\n\nEXCERPT ENDING (truncated — continue from exactly here):\n${base.slice(-TAIL_CHARS)}`,
        {
          userId: ctx.userId,
          projectId: ctx.projectId,
          element: ctx.sectionName,
          budget: ctx.budget,
          language: ctx.language,
        }
      );

      const merged = `${base}${continuation.text}`;
      const mergedReport = inspectOutput(merged, expectation);
      if (mergedReport.ok) {
        logAIEvent('quality.repaired_by_continuation', {
          projectId: ctx.projectId,
          section: ctx.sectionName,
          addedChars: continuation.text.length,
          // La comparaison qui justifie ce chemin : la réécriture complète aurait
          // coûté la longueur ENTIÈRE de la section.
          rewriteCharsAvoided: base.length,
        });
        return {
          content: merged,
          repaired: true,
          repairedByModel: true,
          flagged: false,
          report: mergedReport,
        };
      }
      logger.warn(
        `Section "${ctx.sectionName}": continuation insuffisante — repli sur la réparation complète.`
      );
    } catch (error: any) {
      logger.warn(
        `Section "${ctx.sectionName}": continuation impossible (${error?.message}) — repli sur la réparation complète.`
      );
    }
  }

  const issueList = stillBroken.blocking.map((i) => `- ${i.message}`).join('\n');
  const prompt = `SECTION: ${ctx.sectionName}

DEFECTS TO FIX:
${issueList}

CONTENT TO FIX:
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
