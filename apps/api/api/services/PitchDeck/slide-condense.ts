/**
 * La CORRECTION CIBLÉE d'une slide trop textuelle — à TOUS les crans : c'est de l'écriture (le contenu est
 * confié à l'IA à chaque cran), pas de la composition. Un appel de plus, seulement pour une slide qui déborde.
 *
 * Le moteur graphique mesure la charge de texte d'une slide contre son budget et la signale (`text_heavy`) ;
 * il ne retire jamais un mot lui-même. Réduire le corps jusqu'à l'illisible n'est pas une réponse : la slide
 * repart UNE fois chez le rédacteur, avec le constat chiffré, pour changer de représentation (des points
 * illustrés au lieu de paragraphes) ou laisser tomber le point le plus faible. La version corrigée n'est
 * gardée que si elle est réellement plus légère ; sinon la slide d'origine reste.
 */
import { contentContract, sectionFromModel, SectionContent, sectionTextLoad, SectionFromModelOptions, WRITING_RULES } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { parseLlmJson } from '../../utils/llm-json.util';
import { runAgentPrompt } from '../agents/agent-runtime';

/** Au-delà de ce dépassement du budget, la slide est renvoyée au rédacteur. */
export const CONDENSE_THRESHOLD = 1.1;

export async function condenseSlide(
  section: SectionContent,
  o: { userId: string; projectId?: string; slideName: string; intent: NonNullable<SectionFromModelOptions['intent']> }
): Promise<SectionContent | null> {
  const before = sectionTextLoad(section, o.intent.textBudget);
  if (before.over <= CONDENSE_THRESHOLD) return null;
  const read = (text: string) => sectionFromModel(parseLlmJson(text) ?? text, { id: section.id, role: section.role, fallbackTitle: section.title, intent: o.intent }).section;
  const lighter = (s: SectionContent | null): s is SectionContent => Boolean(s) && sectionTextLoad(s as SectionContent, o.intent.textBudget).over < before.over;
  const { intent, id: _id, role: _role, ...draft } = section;
  try {
    const result = await runAgentPrompt(
      {
        role: 'slide-condenser',
        task: 'draft',
        promptType: 'slide-condense',
        systemPrompt: [
          `You are editing ONE slide of a pitch deck. It carries too much text for a slide: ${before.detail}.`,
          'Rewrite it so it fits: SHOW instead of writing (sentences become "points" with short labels and one-line details), keep the decisive figures exactly as they are, drop the weakest point rather than squeezing. Same language as the input. Never invent a figure, a name or a quote.',
          WRITING_RULES,
          contentContract({ deliverable: 'pitch-deck', visual: { strategies: o.intent.allowStrategies ?? [o.intent.visualStrategy] } }),
        ].join('\n\n'),
        llmOptions: { maxOutputTokens: 1800, temperature: 0.3, jsonMode: true },
        validate: (text: string) => (lighter(read(text)) ? { ok: true } : { ok: false, reason: 'slide toujours trop textuelle ou illisible' }),
      },
      JSON.stringify({ ...draft, ...(intent ? { visual: { strategy: intent.visualStrategy, keyMessage: intent.keyMessage, image: intent.image } } : {}) }),
      { userId: o.userId, projectId: o.projectId, element: `condense:${o.slideName}`, skipQuotaCheck: true }
    );
    const condensed = read(result.text);
    if (!lighter(condensed)) return null;
    logger.info('pitchdeck.slide_condensed', { event: 'pitchdeck.slide_condensed', slide: o.slideName, before: before.detail, after: sectionTextLoad(condensed, o.intent.textBudget).detail });
    return condensed;
  } catch (error: any) {
    logger.warn('pitchdeck.slide_condense_failed', { event: 'pitchdeck.slide_condense_failed', slide: o.slideName, error: error?.message });
    return null;
  }
}
