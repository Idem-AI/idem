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
 * Deux sorties, parce qu'il y a deux modes de rendu :
 *
 *   composeBrief()       mode GABARIT (défaut) — le modèle produit du contenu
 *                        structuré, le serveur produit la page.
 *   composeHtmlPrompt()  repli `IDEM_SECTION_TEMPLATE=off` — la section produit
 *                        sa page elle-même, et récupère alors les règles de
 *                        composition partagées.
 *
 * Les neuf `agent-*.prompt.ts` d'origine restent utilisés tels quels par les
 * sections historiques en mode repli : ils ont été écrits et éprouvés page par
 * page, et les remplacer par une composition générique serait une régression.
 * Les vingt-huit autres sections n'en ont jamais eu : elles reçoivent le prompt
 * HTML composé ci-dessous, qui porte les mêmes règles de page et de marque.
 */

import type { BusinessPlanAudience } from '../structure/audience.types';
import { audienceLens } from './audience-lens.prompt';
import {
  BP_FRAME,
  composeSectionBrief,
  SectionPromptContext,
  SectionPromptSpec,
} from './section-prompt.types';
import { BP_BRAND_RULES, BP_HTML_RULES, bpPageFormat } from './_shared.prompt';
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

export const getSectionPromptSpec = (key: string): SectionPromptSpec | undefined => BY_KEY.get(key);

export const getSectionPromptSpecByName = (name: string): SectionPromptSpec | undefined =>
  BY_NAME.get(name);

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

/** Consigne de CONTENU d'une section, pour le mode gabarit. */
export function composeBrief(
  key: string,
  ctx: SectionPromptContext = NEUTRAL_CONTEXT
): string | undefined {
  const spec = BY_KEY.get(key);
  if (!spec) return undefined;
  return composeSectionBrief(spec, ctx, audienceLens(ctx.audience));
}

/**
 * Prompt COMPLET d'une section qui produit sa page elle-même.
 *
 * Il reprend la consigne de contenu et lui ajoute ce que le gabarit prenait en
 * charge : format de page, règles de marque, contraintes techniques. C'est la
 * seule sortie de ce module qui a le droit de décrire une composition, et
 * `check:prompts` le sait.
 */
export function composeHtmlPrompt(
  key: string,
  ctx: SectionPromptContext = NEUTRAL_CONTEXT
): string | undefined {
  const spec = BY_KEY.get(key);
  if (!spec) return undefined;

  return [
    composeSectionBrief(spec, ctx, audienceLens(ctx.audience)),
    bpPageFormat(spec.fallbackPages ?? '1-2'),
    BP_BRAND_RULES,
    BP_HTML_RULES,
    '<project_context>',
  ].join('\n\n');
}

/**
 * Lentille du destinataire, exposée seule.
 *
 * La couverture est composée librement par un prompt écrit à la main : elle
 * n'a pas de spécification ici, mais elle a un lecteur, et une couverture de
 * dossier bancaire ne ressemble pas à une couverture de deck d'amorçage.
 */
export function readerBlock(audience: BusinessPlanAudience): string {
  return `<reader>\n${audienceLens(audience)}\n</reader>`;
}

export { BP_FRAME };
export type { SectionPromptContext, SectionPromptSpec };
