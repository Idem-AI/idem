/**
 * LE KIT DE COMPOSANTS DES DOCUMENTS — types et contrat.
 *
 * Même marché que le kit graphique des visuels et que les mises en page du moteur vidéo :
 * l'agent NOMME un composant et lui donne ses données ; le CODE le dessine, aux jetons de la
 * marque, à une qualité qu'un modèle n'atteint pas en écrivant du HTML à la main.
 *
 * Ce que ça change, mesurable :
 *  - la qualité : une matrice concurrentielle, un entonnoir ou un SWOT dessinés par le code sont
 *    alignés, contrastés et imprimables — là où un modèle produit des divs approximatives ;
 *  - les jetons : ~40 signes de données contre 2 à 4 Ko de HTML écrit pour le même bloc ;
 *  - la correction : un composant se répare une fois pour tous les documents.
 *
 * Un composant ne décide jamais du CONTENU (les chiffres, les noms, les critères viennent du
 * rédacteur, validés) ni des COULEURS (elles viennent de la charte) : il décide de la forme.
 */

/** Les jetons que tout composant reçoit — ceux du document, jamais une couleur libre. */
export interface UiTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    surfaceRaised: string;
    ink: string;
    inkMuted: string;
    rule: string;
    onAccent: string;
    /** Rampe de la marque (50 → 950) : les nuances d'une série restent dans la marque. */
    brand?: Record<string, string>;
  };
  fonts: { display: string; body: string };
  /** Échelle typographique du document, en px. */
  typeScale: { xs: number; sm: number; base: number; lg: number; xl: number; '2xl': number; '3xl': number };
  /** Rythme vertical de base, en px. */
  spacing: number;
  /** Rayon des angles du style, en px (0 = angles vifs). */
  radius: number;
}

/** Les livrables : un composant ne s'offre qu'à ceux où il a du sens. */
export type UiDeliverable = 'business plan' | 'pitch deck' | 'brand guidelines' | 'business card';

/** Un paramètre borné d'un composant, tel que l'agent peut le donner. */
export interface UiParamSpec {
  /** `text` et `list` viennent du contenu validé ; `enum` et `number` sont bornés par le code. */
  kind: 'text' | 'list' | 'enum' | 'number' | 'rows';
  summary: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface UiComponent {
  /** `ui.comparison-matrix` — l'identifiant que l'agent nomme. */
  id: string;
  label: string;
  /** Ce à quoi il répond, en une ligne : c'est ce que l'agent lit dans son menu. */
  summary: string;
  deliverables: UiDeliverable[];
  /** Hauteur occupée, en fraction de page utile : le paginateur et le menu s'en servent. */
  weight: number;
  params: Record<string, UiParamSpec>;
  /** Le rendu. Reçoit des données DÉJÀ validées, rend du HTML autonome (styles en ligne). */
  render: (data: Record<string, unknown>, t: UiTokens) => string;
}

/** Ce qu'un composant refuse : la raison repart à l'agent, mot pour mot. */
export class UiDataError extends Error {}
