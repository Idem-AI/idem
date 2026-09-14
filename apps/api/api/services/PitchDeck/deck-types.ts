/**
 * TYPES DE PITCH DECK.
 *
 * Un deck de levée, un dossier présenté à une banque, une présentation
 * commerciale et un pitch devant un jury ne racontent pas la même histoire. Le
 * banquier cherche la capacité de remboursement et les garanties, là où
 * l'investisseur cherche la taille du marché et la traction ; un client veut
 * savoir ce qu'il gagne et combien cela coûte. Un deck unique en onze slides
 * « investisseur » répond mal aux trois autres.
 *
 * Chaque type fixe donc ses slides, dans l'ordre où son lecteur les attend,
 * et son destinataire, qui choisit le cadre de lecture de chaque brief
 * (`prompts/slide-briefs.prompt.ts`). Les slides viennent d'un catalogue FERMÉ :
 * chacune y arrive avec son brief de contenu et ses dépendances déjà écrits et
 * vérifiés (`npm run check:prompts`, `npm run check:agents`).
 *
 * MODULE PUR : ni base, ni fournisseur de modèle.
 */

import type { ProjectSectionKey } from '../../models/revision.model';

/** Lecteur du deck — il choisit le cadre de lecture appliqué à chaque slide. */
export type PitchDeckAudience = 'investor' | 'bank' | 'customer' | 'partner' | 'jury';

export interface PitchDeckSlideDefinition {
  /**
   * Nom canonique : stocké dans `sections[].name`, clé i18n du libellé et cible
   * d'une régénération. Il ne change JAMAIS une fois publié.
   */
  name: string;
  /** Composition libre, hors gabarit (la couverture). */
  freeform?: boolean;
  /**
   * Slides dont le digest est injecté SI elles font partie du deck. Une
   * dépendance absente du type est ignorée, elle ne casse pas le graphe.
   */
  requires?: string[];
  /** Autres modules du projet consultés via le Context Engine. */
  consults?: ProjectSectionKey[];
}

export interface PitchDeckTypeDefinition {
  id: string;
  audience: PitchDeckAudience;
  /** Slides, DANS L'ORDRE de présentation. */
  slides: string[];
  isDefault?: boolean;
  /** Durée de présentation typique, en minutes (ex. "10-15"). */
  speakingMinutes: string;
}

/**
 * Le catalogue des slides.
 *
 * Les graphes restent PLATS (trois vagues au plus par type) : chaque dépendance
 * ajoutée coûte une vague entière de latence. On ne garde que celles qui
 * évitent une vraie contradiction — un montant demandé qui ne découle pas des
 * projections, une capacité de remboursement calculée sur un autre prêt.
 */
export const PITCH_DECK_SLIDE_CATALOG: PitchDeckSlideDefinition[] = [
  { name: 'Cover', freeform: true, consults: ['branding'] },
  { name: 'Problem' },
  { name: 'Solution', requires: ['Problem'] },
  { name: 'Market' },
  { name: 'Product', requires: ['Problem', 'Business Model'] },
  { name: 'Business Model' },
  { name: 'Traction', requires: ['Product', 'Business Model'] },
  { name: 'Competition', requires: ['Market'] },
  { name: 'Team' },
  { name: 'Financials', requires: ['Business Model', 'Market'], consults: ['finance'] },
  { name: 'Ask', requires: ['Financials', 'Business Model'] },

  // ── Financement bancaire ────────────────────────────────────────────────
  { name: 'Company Overview' },
  { name: 'Funding Request', requires: ['Business Model'], consults: ['finance'] },
  {
    name: 'Repayment Capacity',
    requires: ['Financials', 'Funding Request'],
    consults: ['finance'],
  },
  { name: 'Guarantees', requires: ['Funding Request'] },

  // ── Présentation commerciale ────────────────────────────────────────────
  { name: 'Customer Benefits', requires: ['Problem', 'Solution'] },
  { name: 'Case Studies', requires: ['Problem'] },
  { name: 'Pricing', requires: ['Product'] },
  { name: 'Next Steps', requires: ['Solution', 'Partnership Model'] },

  // ── Partenariat ─────────────────────────────────────────────────────────
  { name: 'Partnership Model', requires: ['Company Overview', 'Solution'] },
  { name: 'Partner Benefits', requires: ['Partnership Model', 'Market'] },

  // ── Concours, incubateur, subvention ────────────────────────────────────
  { name: 'Impact', requires: ['Problem', 'Solution'] },
  { name: 'Milestones', requires: ['Business Model'] },
  { name: 'Use of Funds', requires: ['Milestones'], consults: ['finance'] },
];

export const DEFAULT_PITCH_DECK_TYPE_ID = 'investor';

export const PITCH_DECK_TYPES: PitchDeckTypeDefinition[] = [
  {
    // Le deck historique : onze slides, dans l'ordre attendu par un fonds.
    id: 'investor',
    audience: 'investor',
    isDefault: true,
    speakingMinutes: '10-15',
    slides: [
      'Cover',
      'Problem',
      'Solution',
      'Market',
      'Product',
      'Business Model',
      'Traction',
      'Competition',
      'Team',
      'Financials',
      'Ask',
    ],
  },
  {
    id: 'bank',
    audience: 'bank',
    speakingMinutes: '10-15',
    slides: [
      'Cover',
      'Company Overview',
      'Market',
      'Business Model',
      'Team',
      'Financials',
      'Funding Request',
      'Repayment Capacity',
      'Guarantees',
    ],
  },
  {
    id: 'sales',
    audience: 'customer',
    speakingMinutes: '10-20',
    slides: [
      'Cover',
      'Problem',
      'Solution',
      'Product',
      'Customer Benefits',
      'Case Studies',
      'Pricing',
      'Next Steps',
    ],
  },
  {
    id: 'partnership',
    audience: 'partner',
    speakingMinutes: '10-15',
    slides: [
      'Cover',
      'Company Overview',
      'Market',
      'Solution',
      'Partnership Model',
      'Partner Benefits',
      'Traction',
      'Team',
      'Next Steps',
    ],
  },
  {
    id: 'competition',
    audience: 'jury',
    speakingMinutes: '5-7',
    slides: [
      'Cover',
      'Problem',
      'Solution',
      'Impact',
      'Market',
      'Business Model',
      'Traction',
      'Team',
      'Milestones',
      'Use of Funds',
    ],
  },
  {
    // Trois minutes sur scène : une idée par slide, rien d'accessoire.
    id: 'elevator',
    audience: 'investor',
    speakingMinutes: '3',
    slides: ['Cover', 'Problem', 'Solution', 'Market', 'Traction', 'Ask'],
  },
];

const SLIDES_BY_NAME = new Map(PITCH_DECK_SLIDE_CATALOG.map((slide) => [slide.name, slide]));

export const getSlideDefinition = (name: string): PitchDeckSlideDefinition | undefined =>
  SLIDES_BY_NAME.get(name);

export const isKnownPitchDeckType = (id: unknown): id is string =>
  typeof id === 'string' && PITCH_DECK_TYPES.some((type) => type.id === id);

/** Type d'un deck ; un type absent ou inconnu retombe sur le deck investisseur. */
export function getPitchDeckType(id?: string | null): PitchDeckTypeDefinition {
  return (
    PITCH_DECK_TYPES.find((type) => type.id === id) ??
    PITCH_DECK_TYPES.find((type) => type.id === DEFAULT_PITCH_DECK_TYPE_ID)!
  );
}

/** Type résolu et définitions de ses slides, dans l'ordre du deck. */
export function resolvePitchDeckSlides(typeId?: string | null): {
  type: PitchDeckTypeDefinition;
  slides: PitchDeckSlideDefinition[];
} {
  const type = getPitchDeckType(typeId);
  return {
    type,
    slides: type.slides
      .map(getSlideDefinition)
      .filter((slide): slide is PitchDeckSlideDefinition => !!slide),
  };
}
