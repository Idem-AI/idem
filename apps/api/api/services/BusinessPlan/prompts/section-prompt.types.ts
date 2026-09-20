/**
 * SYSTÈME DE PROMPTS DE SECTION — contrat et composition.
 *
 * Les neuf sections historiques avaient chacune leur `agent-*.prompt.ts`,
 * écrit à la main. Les vingt-huit sections apportées par les structures
 * (dossier bancaire, plan investisseur, demande de subvention…) n'en avaient
 * pas : elles partaient toutes avec le même gabarit de brief, et un plan
 * bancaire recevait exactement la consigne d'un plan de levée de fonds.
 *
 * C'était le défaut : le rendu d'une section ne dépend pas que de son sujet,
 * il dépend de QUI la lit. Un analyste crédit et un associé de fonds
 * d'amorçage ouvrent la même page « plan financier » en cherchant deux choses
 * différentes, et la section qui ne répond qu'à l'une des deux est mauvaise
 * pour l'autre.
 *
 * D'où une consigne DÉCOMPOSÉE plutôt qu'un bloc de texte :
 *
 *   frame      invariants du livrable, identiques partout
 *   reader     ce que CE destinataire cherche (cf. `audience-lens.prompt.ts`)
 *   position   rang dans le document, section précédente et suivante
 *   objective  ce que la section doit accomplir
 *   must_cover le contenu obligatoire
 *   emphasis   l'inflexion de CETTE section pour CE destinataire
 *   pitfalls   les défauts propres à cette section
 *   blocks     le vocabulaire de rendu suggéré
 *
 * Chaque partie est écrite une fois, à un seul endroit, et recomposée pour
 * chaque génération. Ajouter un public revient à écrire une lentille ; ajouter
 * une section revient à écrire une spécification.
 */

import type { BusinessPlanAudience } from '../structure/audience.types';

/**
 * Consigne d'une section, en pièces détachées.
 *
 * Aucune de ces pièces ne décrit une COMPOSITION (balises, Tailwind, Chart.js) :
 * sous gabarit c'est le code qui compose, et une consigne de mise en page dans
 * un prompt dont la sortie est du JSON prend la place d'une consigne utile.
 * `npm run check:prompts` le vérifie section par section.
 */
export interface SectionPromptSpec {
  /** Clé du catalogue (cf. `structure/section-catalog.ts`). */
  key: string;
  /** Nom canonique — doit correspondre exactement à celui du catalogue. */
  name: string;
  /** Ce que la section doit accomplir, en une phrase qui engage. */
  objective: string;
  /** Le contenu obligatoire, numéroté. */
  mustCover: string;
  /** Le vocabulaire de blocs que le rendu sait produire. */
  blocks: string;
  /** Les défauts que CETTE section produit quand on n'y prend pas garde. */
  pitfalls?: string;
  /**
   * Inflexion par destinataire. Renseignée uniquement là où le public change
   * réellement le CONTENU — pas le ton. Une lentille qui dit « soyez
   * convaincant » ne mérite pas d'être écrite.
   */
  lenses?: Partial<Record<BusinessPlanAudience, string>>;
  /**
   * Volume de pages A4 visé quand la section produit son HTML elle-même
   * (repli `IDEM_SECTION_TEMPLATE=off`). Sous gabarit, c'est le `volume` du
   * catalogue qui pilote.
   */
  fallbackPages?: string;
}

/** Ce que la composition sait du document au moment de produire la consigne. */
export interface SectionPromptContext {
  /** Destinataire du plan, déduit du modèle de structure retenu. */
  audience: BusinessPlanAudience;
  /** Rang de la section dans le document, à partir de 1. */
  position: number;
  /** Nombre total de sections du document. */
  total: number;
  /** Nom de la section qui précède, s'il y en a une. */
  previous?: string;
  /** Nom de la section qui suit, s'il y en a une. */
  next?: string;
  /** Résumé du module Finance, ajouté aux sections qui s'appuient dessus. */
  financeContext?: string;
}

/**
 * Invariants du livrable. Identiques pour toutes les sections et tous les
 * publics : c'est ce qui fait que neuf pages forment un document.
 */
export const BP_FRAME = `You are writing ONE section of a business plan that a real decision-maker will read and act on.

- The title states the CONCLUSION, not the topic.
- Every figure carries a unit, a period and how it was obtained. A figure with no
  source is noise, and a reader who catches one stops trusting the others.
- Ground everything in THIS project's country, sector and stage. A paragraph that
  would fit any company in the world is padding.
- Where a number rests on a hypothesis, state the hypothesis with an
  "assumption" block. A plan whose assumptions are visible is read as serious.
- Write what you can defend. A weakness stated plainly costs less than a
  strength the reader disproves in the next meeting.`;

/** Rend un bloc balisé, ou une chaîne vide quand il n'y a rien à dire. */
const tag = (name: string, body?: string): string =>
  body && body.trim() ? `<${name}>\n${body.trim()}\n</${name}>` : '';

/**
 * Situe la section dans le document.
 *
 * Ce bloc n'existait pas, et c'est la cause directe du défaut le plus visible
 * d'un plan généré par sections parallèles : la même idée réexpliquée trois
 * fois, chaque section recommençant par présenter l'entreprise. Dire à une
 * section ce qui la précède et ce qui la suit coûte trente tokens.
 */
const positionBlock = (ctx: SectionPromptContext): string => {
  const lines = [`Section ${ctx.position} of ${ctx.total}.`];
  if (ctx.previous) {
    lines.push(
      `It follows "${ctx.previous}". Do not re-establish what that section already established; refer to it in one clause if you need it.`
    );
  }
  if (ctx.next) {
    lines.push(`It precedes "${ctx.next}". Leave that material to it.`);
  }
  if (!ctx.previous) {
    lines.push('It opens the document: the reader knows nothing yet.');
  }
  if (!ctx.next) {
    lines.push('It closes the document: introduce no new argument here.');
  }
  return lines.join('\n');
};

/**
 * Compose la consigne de CONTENU d'une section — le mode gabarit.
 *
 * Ordre voulu : le cadre, puis le lecteur, puis la position, puis le travail.
 * Un modèle arbitre entre consignes en suivant la plus proche de sa sortie ;
 * ce qui doit peser le plus est donc placé au plus près de la fin.
 */
export function composeSectionBrief(
  spec: SectionPromptSpec,
  ctx: SectionPromptContext,
  readerLens: string
): string {
  return [
    tag('frame', BP_FRAME),
    tag('reader', readerLens),
    tag('position', positionBlock(ctx)),
    tag('objective', spec.objective),
    tag('must_cover', spec.mustCover),
    tag('audience_emphasis', spec.lenses?.[ctx.audience]),
    tag('pitfalls', spec.pitfalls),
    tag('suggested_blocks', spec.blocks),
    ctx.financeContext?.trim() ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
