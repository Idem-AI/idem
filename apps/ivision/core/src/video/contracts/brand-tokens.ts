/**
 * LES JETONS DE MARQUE D'UN FILM — couleurs, polices, logo. Partagés par l'assemblage de la marque (`assets/brand.ts`)
 * et la composition HyperFrames (`rendering/hyperframes/composition.ts`).
 */
export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BrandTokens {
  name: string;
  colors: BrandColors;
  fonts: { display: string; body: string };
  /** Le logo : image (URL ou data URI) pour fond clair, pour fond sombre, et son SVG brut s'il existe. */
  logo?: { light?: string; dark?: string; svg?: string; width: number; height: number };
}
