/**
 * Le LOOK d'une section : les cinq dimensions de style traduites en valeurs que le compilateur LIT.
 *
 * Leçon du moteur précédent : une dimension tirée par la graine mais jamais lue par le rendu ne
 * produit aucune variété tout en gonflant les compteurs d'unicité. Chaque dimension a donc ici un
 * lecteur nommé :
 *   · stratégie de couleur → les rôles de la palette (titre, sur-titre, emphase, panneau, bandeau) ;
 *   · humeur typographique → casse, graisse, interlettrage, interlignage et gestes du titre ;
 *   · tension → décors et gestes de mise en page (lus par les patterns et `chrome`) ;
 *   · accent → l'ornement unique de la page (filet épais, forme, motif, marque…) ;
 *   · densité → l'échelle des espaces (déjà dans les jetons) et le volume des composants.
 *
 * La stratégie ne change pas les COULEURS (elles viennent de la charte), elle change leur RÔLE :
 * c'est ce qui distingue deux marques de palettes voisines.
 */
import type { Accent, ColorStrategy, Density, Tension, TypeMood } from '../contracts/design-spec';
import { contrastRatio, ensureContrast, isDeep, mixHex, readableInk } from '../foundation/color';
import type { DesignTokens } from './tokens';

export interface TypeTreatment {
  titleCase: 'none' | 'upper' | 'lower';
  titleWeight: number;
  /** Interlettrage du titre, en em. */
  titleTracking: number;
  titleLeading: number;
  /** Multiplicateur de la taille du titre (une capitale aérée doit être plus petite). */
  titleScale: number;
  kickerCase: 'none' | 'upper' | 'lower';
  kickerTracking: number;
  kickerWeight: number;
  bodyWeight: number;
  /** Poids des chiffres-clés. */
  figureWeight: number;
  /** Le dernier mot du titre en contour. */
  outlineWord: boolean;
  /** La première lettre du titre agrandie, en couleur. */
  anchorLetter: boolean;
  /** Le chapô décalé d'un cran de grille. */
  stagger: boolean;
}

export interface Look {
  strategy: ColorStrategy;
  mood: TypeMood;
  tension: Tension;
  accent: Accent;
  density: Density;
  /** Fond de la page. */
  ground: string;
  /** Encre du texte courant sur ce fond. */
  ink: string;
  muted: string;
  heading: string;
  kicker: string;
  /** Couleur d'emphase (filets, chiffres, puces) — lisible à 3:1 au moins sur le fond. */
  emphasis: string;
  /** Panneau mis en avant (carte emphase, encadré). */
  panel: string;
  /** Bandeau d'en-tête ou de rail. */
  band: string;
  rule: string;
  /** La page est-elle une page d'inversion (fond de couleur) ? */
  inverted: boolean;
  type: TypeTreatment;
}

/** La couleur de marque lisible sur ce fond (teinte gardée, clarté déplacée), ou l'encre de repli. */
export function readableBrand(hex: string, ground: string, target: number): string {
  return contrastRatio(hex, ground) >= target ? hex : ensureContrast(hex, ground, target);
}

const TREATMENTS: Record<TypeMood, TypeTreatment> = {
  neutral: { titleCase: 'none', titleWeight: 700, titleTracking: -0.015, titleLeading: 1.08, titleScale: 1, kickerCase: 'upper', kickerTracking: 0.14, kickerWeight: 600, bodyWeight: 400, figureWeight: 700, outlineWord: false, anchorLetter: false, stagger: false },
  'wide-whisper': { titleCase: 'upper', titleWeight: 300, titleTracking: 0.12, titleLeading: 1.12, titleScale: 0.7, kickerCase: 'upper', kickerTracking: 0.28, kickerWeight: 500, bodyWeight: 400, figureWeight: 300, outlineWord: false, anchorLetter: false, stagger: false },
  'weight-clash': { titleCase: 'none', titleWeight: 850, titleTracking: -0.025, titleLeading: 1.02, titleScale: 1.08, kickerCase: 'upper', kickerTracking: 0.16, kickerWeight: 300, bodyWeight: 300, figureWeight: 850, outlineWord: false, anchorLetter: false, stagger: false },
  lowercase: { titleCase: 'lower', titleWeight: 600, titleTracking: -0.01, titleLeading: 1.08, titleScale: 1, kickerCase: 'lower', kickerTracking: 0.02, kickerWeight: 500, bodyWeight: 400, figureWeight: 600, outlineWord: false, anchorLetter: false, stagger: false },
  'tight-display': { titleCase: 'none', titleWeight: 800, titleTracking: -0.035, titleLeading: 0.96, titleScale: 1.12, kickerCase: 'upper', kickerTracking: 0.1, kickerWeight: 700, bodyWeight: 400, figureWeight: 800, outlineWord: false, anchorLetter: false, stagger: false },
  'outline-mix': { titleCase: 'upper', titleWeight: 800, titleTracking: -0.01, titleLeading: 1, titleScale: 0.86, kickerCase: 'upper', kickerTracking: 0.18, kickerWeight: 600, bodyWeight: 400, figureWeight: 800, outlineWord: true, anchorLetter: false, stagger: false },
  staggered: { titleCase: 'none', titleWeight: 700, titleTracking: -0.02, titleLeading: 1.06, titleScale: 1, kickerCase: 'upper', kickerTracking: 0.14, kickerWeight: 600, bodyWeight: 400, figureWeight: 700, outlineWord: false, anchorLetter: false, stagger: true },
  'letter-anchor': { titleCase: 'none', titleWeight: 700, titleTracking: -0.015, titleLeading: 1.06, titleScale: 1, kickerCase: 'upper', kickerTracking: 0.14, kickerWeight: 600, bodyWeight: 400, figureWeight: 700, outlineWord: false, anchorLetter: true, stagger: false },
};

export interface LookInput {
  strategy: ColorStrategy;
  mood: TypeMood;
  tension: Tension;
  accent: Accent;
  density: Density;
  /** La page peut-elle être une page de couleur (diapositive, visuel, couverture) ? */
  allowInverted: boolean;
  /** Couleurs dominantes d'une image (stratégie `image-extracted`). */
  imageColors?: string[];
}

export function resolveLook(tokens: DesignTokens, input: LookInput): Look {
  const c = tokens.color;
  const brandText = c.neonPrimary ? c.deep : c.primary;
  const accentText = c.neonAccent ? c.accentRamp['800'] ?? c.deep : c.accent;
  const type = TREATMENTS[input.mood];

  // La page d'inversion : un fond de couleur de marque (jamais fluo). Elle n'existe que sur les toiles
  // fixes ; un document paginé la porte en bandeau, son fond reste clair. Une couleur de marque SOMBRE
  // ne devient jamais un fond de page sans autorisation explicite : ce serait un thème sombre.
  const brandGround = c.neonPrimary ? c.deep : c.primary;
  const inverted = input.strategy === 'inverse' && input.allowInverted && (!isDeep(brandGround) || tokens.allowDark);
  const ground = inverted ? brandGround : c.ground;

  const ink = readableInk(inverted ? c.onBrand : c.ink, ground, 7);
  const muted = inverted ? readableInk(mixHex(ink, ground, 0.28), ground, 4.5) : c.muted;
  const rule = inverted ? mixHex(ground, ink, 0.28) : c.rule;
  const strongBrand = readableBrand(brandText, ground, 4.5);
  const strongAccent = readableBrand(accentText, ground, 4.5);
  const image = (input.imageColors ?? []).find((hex) => contrastRatio(hex, ground) >= 3);

  let heading = ink;
  let kicker = muted;
  let emphasis = readableBrand(brandText, ground, 3);
  let panel = c.raised;
  let band = c.primary;
  switch (input.strategy) {
    case 'monochrome-accent':
      kicker = inverted ? muted : strongBrand;
      band = c.deep;
      break;
    case 'duotone':
      heading = inverted ? ink : strongBrand;
      kicker = inverted ? muted : readableBrand(c.secondary, ground, 4.5);
      emphasis = readableBrand(c.secondary, ground, 3);
      panel = inverted ? mixHex(ground, ink, 0.12) : c.brandSoft;
      band = c.secondary;
      break;
    case 'inverse':
      heading = ink;
      kicker = inverted ? readableInk(c.accent, ground, 4.5) : strongBrand;
      emphasis = inverted ? readableInk(c.accent, ground, 3) : emphasis;
      panel = inverted ? mixHex(ground, ink, 0.12) : c.brandSoft;
      band = c.deep;
      break;
    case 'brand-full':
      heading = inverted ? ink : strongBrand;
      kicker = inverted ? readableInk(c.accent, ground, 4.5) : strongAccent;
      emphasis = inverted ? readableInk(c.accent, ground, 3) : readableBrand(accentText, ground, 3);
      panel = inverted ? mixHex(ground, ink, 0.14) : c.brandSoft;
      band = c.primary;
      break;
    case 'split-complementary':
      kicker = inverted ? muted : strongAccent;
      emphasis = inverted ? readableInk(c.accent, ground, 3) : readableBrand(accentText, ground, 3);
      panel = inverted ? mixHex(ground, ink, 0.12) : c.accentSoft;
      band = c.neonAccent ? c.deep : c.accent;
      break;
    case 'image-extracted':
      kicker = image ? readableBrand(image, ground, 4.5) : strongBrand;
      emphasis = image ?? emphasis;
      panel = image ? mixHex(ground, image, 0.12) : c.raised;
      band = image ?? c.primary;
      break;
  }
  if (c.neonPrimary && band === c.primary) band = c.deep;

  return { strategy: input.strategy, mood: input.mood, tension: input.tension, accent: input.accent, density: input.density, ground, ink, muted, heading, kicker, emphasis, panel, band, rule, inverted, type };
}

export const treatmentOf = (mood: TypeMood): TypeTreatment => TREATMENTS[mood];
