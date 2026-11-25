/**
 * Ce que fait une carte de recommandation, quel que soit le framework qui la dessine : se signaler une fois
 * affichée, mener à sa destination (projet déjà sélectionné), se retirer quand on l'écarte. Les rendus React
 * et Angular n'ajoutent que le balisage.
 */
import type { JourneyClient } from './client';
import { journeyLink, JourneyUrls } from './links';
import type { IdemApp, Recommendation } from './model';
import { journeyUiText, recommendationText, RecommendationText } from './texts';

export interface JourneyCardOptions {
  recommendation: Recommendation;
  urls: JourneyUrls;
  /** L'application qui affiche la carte. */
  from: IdemApp;
  lang?: string;
  client?: JourneyClient;
  /**
   * Avant de partir : l'hôte peut finir ce qui doit l'être (enregistrer le code) ou ouvrir la destination
   * lui-même (une fenêtre de mise en ligne sur place). Rendre `false` annule la navigation par défaut.
   */
  beforeOpen?: (recommendation: Recommendation, href: string) => Promise<boolean | void> | boolean | void;
}

/**
 * `inline` : la carte dans le fil (sous la conversation, sous un livrable, sur une page).
 * `float` : la même, posée EN HAUT AU CENTRE dans `.idem-float-stack`, une ligne par texte, une croix pour la fermer.
 */
export type JourneyCardVariant = 'inline' | 'float';

export interface JourneyCardView {
  text: RecommendationText;
  dismissLabel: string;
  closeLabel: string;
  label: string;
  href: string;
}

export function journeyCardView(options: JourneyCardOptions): JourneyCardView {
  const { recommendation, urls, from, lang } = options;
  const ui = journeyUiText(lang);
  return {
    text: recommendationText(recommendation.id, recommendation.destination, lang),
    dismissLabel: ui.dismiss,
    closeLabel: ui.close,
    label: ui.label,
    href: journeyLink(recommendation.destination, { urls, projectId: recommendation.projectId, from }),
  };
}

export function journeyShown(options: JourneyCardOptions): void {
  void options.client?.feedback(options.recommendation.id, 'shown', options.recommendation.projectId);
}

/** Mène à la destination, dans le même onglet : le projet y est déjà ouvert. */
export async function journeyOpen(options: JourneyCardOptions): Promise<void> {
  const { recommendation } = options;
  const href = journeyCardView(options).href;
  // Le suivi part avant la navigation, sans l'attendre longtemps : une API lente ne retient pas l'utilisateur.
  await Promise.race([options.client?.feedback(recommendation.id, 'clicked', recommendation.projectId), new Promise((resolve) => setTimeout(resolve, 600))]);
  const proceed = await options.beforeOpen?.(recommendation, href);
  if (proceed === false) return;
  window.location.assign(href);
}

export function journeyDismiss(options: JourneyCardOptions): void {
  void options.client?.feedback(options.recommendation.id, 'dismissed', options.recommendation.projectId);
}

const FLOAT_SEEN = 'idem.journey.float';

/**
 * La carte flottante d'une recommandation, une seule fois par session de navigateur : elle annonce la suite au moment
 * où elle arrive ; la carte du fil reste pour y revenir. Rien n'est retenu si le stockage est refusé (navigation
 * privée) : la carte s'affiche alors à chaque fois, jamais une erreur.
 */
export function journeyFloatFirstTime(recommendation: { id: string; projectId?: string }): boolean {
  const key = `${recommendation.id}:${recommendation.projectId ?? ''}`;
  try {
    const seen = JSON.parse(sessionStorage.getItem(FLOAT_SEEN) ?? '[]') as string[];
    if (seen.includes(key)) return false;
    sessionStorage.setItem(FLOAT_SEEN, JSON.stringify([...seen.slice(-40), key]));
  } catch {
    /* stockage refusé : la carte s'affiche */
  }
  return true;
}
