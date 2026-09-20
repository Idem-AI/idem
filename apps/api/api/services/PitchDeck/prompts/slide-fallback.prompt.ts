/**
 * Repli HTML des slides, quand le gabarit est coupé (`IDEM_SECTION_TEMPLATE=off`),
 * et note de couverture selon le type de deck.
 *
 * Les onze slides historiques ont un prompt de composition écrit à la main
 * (`slide-*.prompt.ts`). Les slides apportées par les autres types de deck n'en
 * ont pas : leur repli est composé ici à partir de leur brief, sous les règles
 * de slide communes (`PITCH_DECK_SHARED_RULES`, portées par le préfixe stable).
 */

import type { PitchDeckAudience } from '../deck-types';
import { DECK_READER_FRAMES, SLIDE_BRIEF_PARTS } from './slide-briefs.prompt';

/** Prompt de composition HTML d'une slide sans prompt écrit à la main. */
export function composeSlideHtmlPrompt(name: string, audience: PitchDeckAudience): string {
  const parts = SLIDE_BRIEF_PARTS[name];
  // La ligne « Blocks: » décrit le vocabulaire du gabarit : en HTML libre, elle
  // ne veut rien dire.
  const mandatory = parts?.mustCover.replace(/^Blocks:[\s\S]*$/m, '').trim();
  return [
    '',
    '<role>Senior pitch deck designer at a top-tier design agency</role>',
    `<reader>\n${DECK_READER_FRAMES[audience]}\n</reader>`,
    `<objective>${parts?.objective ?? `Design the ${name.toUpperCase()} slide.`}</objective>`,
    mandatory ? `<mandatory_content>\n${mandatory}\n</mandatory_content>` : '',
    '<project_context>',
    '',
  ]
    .filter((line, index, lines) => line !== '' || index === 0 || index === lines.length - 1)
    .join('\n');
}

/** Nature du document que la couverture ouvre, hors deck investisseur. */
const COVER_KIND: Record<PitchDeckAudience, string | null> = {
  investor: null,
  bank: 'a financing file presented to a bank or a microfinance institution',
  customer: 'a sales presentation for prospective customers',
  partner: 'a partnership proposal',
  jury: 'a pitch for a competition jury, an incubator or a grant committee',
};

/**
 * Le prompt de couverture annonce « PITCH DECK ». Sur une présentation
 * commerciale, ce libellé dit au client qu'on lui présente une levée de fonds.
 */
export function coverKindNote(audience: PitchDeckAudience): string | null {
  const kind = COVER_KIND[audience];
  return kind
    ? `<deck_kind>\nThis cover opens ${kind}. The uppercase label names that kind of document, in the language of the deck, instead of "PITCH DECK".\n</deck_kind>`
    : null;
}
