/**
 * REGISTRE DES PROMPTS DE SECTION — le point d'entrée unique.
 *
 * Une section n'existe pour le générateur que si elle a une entrée ici. Le
 * catalogue (`structure/section-catalog.ts`) dit ce qu'une structure peut
 * contenir ; ce registre dit comment chacune de ces sections est écrite. Les
 * deux sont vérifiés l'un contre l'autre par `npm run check:prompts` : une
 * section au catalogue sans prompt retomberait sur une consigne générique,
 * exactement le défaut que ce module supprime.
 *
 * Une sortie : `composeBrief()`, la consigne de CONTENU de la section. Le modèle
 * produit du contenu structuré ; la page est composée par le moteur graphique
 * (@idem/graphic-engine), qui ne demande jamais de mise en page à un modèle.
 */

import { audienceLens } from './audience-lens.prompt';
import {
  BP_FRAME,
  composeSectionBrief,
  SectionPromptContext,
  SectionPromptSpec,
} from './section-prompt.types';
import { OPENING_SECTION_PROMPTS } from './sections/opening.prompts';
import { COMPANY_SECTION_PROMPTS } from './sections/company.prompts';
import { MARKET_SECTION_PROMPTS } from './sections/market.prompts';
import { OFFER_SECTION_PROMPTS } from './sections/offer.prompts';
import { STRATEGY_SECTION_PROMPTS } from './sections/strategy.prompts';
import { OPERATIONS_SECTION_PROMPTS } from './sections/operations.prompts';
import { FINANCE_SECTION_PROMPTS } from './sections/finance.prompts';
import { IMPACT_SECTION_PROMPTS } from './sections/impact.prompts';
import { CLOSING_SECTION_PROMPTS } from './sections/closing.prompts';

export const SECTION_PROMPT_SPECS: SectionPromptSpec[] = [
  ...OPENING_SECTION_PROMPTS,
  ...COMPANY_SECTION_PROMPTS,
  ...MARKET_SECTION_PROMPTS,
  ...OFFER_SECTION_PROMPTS,
  ...STRATEGY_SECTION_PROMPTS,
  ...OPERATIONS_SECTION_PROMPTS,
  ...FINANCE_SECTION_PROMPTS,
  ...IMPACT_SECTION_PROMPTS,
  ...CLOSING_SECTION_PROMPTS,
];

const BY_KEY = new Map(SECTION_PROMPT_SPECS.map((spec) => [spec.key, spec]));
const BY_NAME = new Map(SECTION_PROMPT_SPECS.map((spec) => [spec.name, spec]));

/** Deux sections sous le même nom canonique fusionneraient en silence. */
{
  const names = SECTION_PROMPT_SPECS.map((spec) => spec.name);
  const duplicated = names.filter((name, i) => names.indexOf(name) !== i);
  if (duplicated.length > 0) {
    throw new Error(
      `Registre de prompts invalide : nom(s) canonique(s) en double ${duplicated.join(', ')}.`
    );
  }
}

/**
 * Contexte neutre : utilisé par les briefs par défaut et par les contrôles.
 * Une consigne composée sans contexte reste valable, elle est seulement moins
 * précise — c'est le comportement voulu, pas un cas d'erreur.
 */
export const NEUTRAL_CONTEXT: SectionPromptContext = {
  audience: 'general',
  position: 1,
  total: 1,
};

/** Consigne de CONTENU d'une section. */
export function composeBrief(
  key: string,
  ctx: SectionPromptContext = NEUTRAL_CONTEXT
): string | undefined {
  const spec = BY_KEY.get(key);
  if (!spec) return undefined;
  return composeSectionBrief(spec, ctx, audienceLens(ctx.audience));
}

export { BP_FRAME };
export type { SectionPromptContext, SectionPromptSpec };
