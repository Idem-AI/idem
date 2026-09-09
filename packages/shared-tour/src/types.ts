/**
 * Types du moteur de visite guidée.
 *
 * Le paquet ne connaît ni framework ni langue : l'application hôte fournit
 * les textes déjà traduits et les sélecteurs de ses propres éléments.
 */

/** Où poser la bulle par rapport à l'élément mis en avant. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  /**
   * Sélecteur CSS de l'élément à mettre en lumière.
   * Absent — ou introuvable — l'étape s'affiche centrée à l'écran.
   */
  target?: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  /**
   * Illustration de l'étape : balisage SVG inséré tel quel au-dessus du titre.
   *
   * Le paquet ne connaît aucun framework : il construit du DOM. L'application
   * hôte fournit donc le SVG déjà sérialisé, et reste maîtresse de son style —
   * `currentColor` et les jetons du design system y fonctionnent normalement.
   *
   * Le contenu est inséré via `innerHTML` : il vient du code de l'application,
   * jamais d'une saisie utilisateur.
   */
  illustration?: string;
  /**
   * Étape de célébration : la bulle s'orne d'une petite pluie de confettis.
   * Réservée à la dernière étape.
   */
  celebrate?: boolean;
  /**
   * Préparation avant affichage (déplier un menu, faire défiler…).
   * Attendue avant le calcul de position.
   */
  before?: () => void | Promise<void>;
}

/** Libellés de l'interface, fournis traduits par l'application hôte. */
export interface TourLabels {
  next: string;
  back: string;
  skip: string;
  finish: string;
  /** Gabarit du compteur, ex. « Étape {current} sur {total} » */
  stepOf: string;
  /** Texte lu par les lecteurs d'écran pour la fenêtre de visite */
  dialogLabel: string;
}

export interface TourOptions {
  /** Identifiant stable, utilisé par l'hôte pour mémoriser la visite */
  id: string;
  steps: TourStep[];
  labels: TourLabels;
  /**
   * Fin de visite. `completed` vaut `false` si l'utilisateur a passé la
   * visite ou fermé la fenêtre.
   */
  onFinish?: (completed: boolean) => void;
  /** Changement d'étape, pour la télémétrie éventuelle */
  onStep?: (index: number, step: TourStep) => void;
}

export interface TourHandle {
  /** Arrête la visite (équivalent d'un « Passer »). */
  stop(): void;
  /** Étape affichée, ou -1 si la visite est terminée. */
  currentIndex(): number;
  next(): void;
  back(): void;
}
