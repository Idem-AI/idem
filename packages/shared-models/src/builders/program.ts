/**
 * Idem Builders — le programme qui met en avant les projets qui font rayonner
 * l'Afrique et qui se gèrent avec IDEM.
 *
 * Une seule source pour l'API (qui accorde les avantages), la console (qui les
 * annonce au candidat) et la landing (qui les présente) : un chiffre changé
 * ici change partout, et l'e-mail de bienvenue du panel les reçoit de l'API au
 * moment de la validation.
 */

/** Ce qu'il advient d'une candidature. */
export const BUILDER_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type BuilderStatus = (typeof BUILDER_STATUSES)[number];

/**
 * Les signes qu'un projet est géré avec IDEM, lus sur le projet lui-même (ce
 * sont les faits de `@idem/shared-journey`). Les quatre premiers disent que le
 * projet **tourne** avec IDEM : c'est la condition d'entrée. Les autres disent
 * qu'il y a été construit : ils pèsent dans l'examen, ils ne suffisent pas.
 */
export const BUILDER_OPERATING_SIGNALS = ['sitePublished', 'appPublished', 'communication', 'domain'] as const;
export const BUILDER_BUILDING_SIGNALS = ['brand', 'charter', 'businessPlan', 'pitchDeck', 'legal', 'video'] as const;

export type BuilderOperatingSignal = (typeof BUILDER_OPERATING_SIGNALS)[number];
export type BuilderBuildingSignal = (typeof BUILDER_BUILDING_SIGNALS)[number];
export type BuilderSignal = BuilderOperatingSignal | BuilderBuildingSignal;

export type BuilderSignals = Record<BuilderSignal, boolean>;

/** Le projet est-il géré avec IDEM ? Au moins un signe d'exploitation. */
export function isBuilderEligible(signals: Partial<BuilderSignals>): boolean {
  return BUILDER_OPERATING_SIGNALS.some((signal) => signals[signal] === true);
}

/** Les avantages accordés à l'entrée dans le programme. */
export const BUILDERS_PROGRAM = {
  /** Versé une seule fois par compte, à la première candidature validée. */
  welcomeBonusXaf: 5_000,
  /** Crédit offert en plus sur chaque recharge du portefeuille (cumulable avec le bonus de palier). */
  topupBonusRate: 0.15,
  /** Réduction sur les compteurs d'hébergement iDeploy (palier, hors options). */
  hostingDiscountRate: 0.3,
  /** Longueur minimale de la présentation : de quoi juger, pas une ligne. */
  pitchMinLength: 120,
  pitchMaxLength: 1_500,
  /** Délai d'examen annoncé au candidat, en jours ouvrés. */
  reviewDays: 5,
} as const;

/**
 * Version des conditions de participation et de la politique de confidentialité
 * du programme (landing : /builders-terms, /builders-privacy), acceptées
 * ensemble avant chaque candidature. Toute modification de fond de l'un des
 * deux textes change cette version : l'API refuse alors une acceptation
 * d'une version antérieure, et la candidature garde celle qui a été lue.
 */
export const BUILDERS_LEGAL_VERSION = '2026-11-05';

/** Bonus Builders d'une recharge, en francs. */
export function builderTopupBonusXaf(amountXaf: number): number {
  return Math.round(amountXaf * BUILDERS_PROGRAM.topupBonusRate);
}

/** Prix d'un jour d'hébergement après la réduction Builders. */
export function builderHostingPriceXaf(priceXaf: number): number {
  return Math.round(priceXaf * (1 - BUILDERS_PROGRAM.hostingDiscountRate));
}

/** Un Builder tel que la vitrine publique le montre — rien de privé. */
export interface BuilderShowcaseEntry {
  id: string;
  projectName: string;
  tagline: string;
  country?: string;
  url?: string;
  featured: boolean;
  since: string;
}
