/**
 * L'INTÉGRITÉ DES PHOTOS — une photo (banque, générée, du client) garde SES couleurs, partout.
 *
 * Constat du 18/11/2026 : des visuels sortaient avec des photos « filtrées » (orange→vert, monochrome jaune,
 * personnages posterisés en aplats). Quatre causes, toutes dans notre code, aucune dans le navigateur :
 *   1. le directeur d'idées choisissait un traitement (duotone, mono, teinte) appliqué aux pixels par `treatPhoto` ;
 *   2. le rôle « illustration » vectorisait/posterisait une PHOTO (`vectorizeImage`) ;
 *   3. le gabarit `figure.duotone` posait `grayscale` + un calque `mix-blend-color` de la couleur primaire ;
 *   4. les consignes d'image de certaines directions artistiques (« two spot color duotone », « posterized two-tone »,
 *      « black and white ») étaient envoyées telles quelles au modèle d'image.
 *
 * Ce module est la règle UNIQUE côté texte : ce qui part vers un modèle d'image ne demande jamais d'altérer les
 * couleurs, et dit en POSITIF (FLUX n'applique pas de guidage négatif) que les couleurs sont naturelles. Le pendant
 * HTML/navigateur est dans `@idem/graphic-engine` (`runtime/photo-integrity.ts`).
 *
 * Ce n'est pas une lecture de la demande de l'utilisateur : on assainit NOS consignes de rendu (catalogue des
 * directions, charte), phrase par phrase.
 */

/** Une consigne qui altère les couleurs d'une image (traitement, filtre, impression à encres limitées). */
const COLOUR_ALTERING =
  /\b(duo-?tones?|tri-?tones?|two[- ](spot[- ])?(colou?rs?|tones?|inks?)|spot[- ]colou?rs?|bichrom\w*|monochrom\w*|mono-?tone|black[- ](and|&)[- ]white|b\s*&\s*w|gr[ae]yscale|sepia|tint(ed|s)?|colou?r[- ](cast|filter|grad(e|ing)|wash|overlay)|filter(ed)?|posteri[sz]\w*|halftone\w*|risograph\w*|riso\b|screen[- ]print\w*|solari[sz]\w*|invert\w*|desaturat\w*|single[- ]accent[- ]colou?r|limited[- ](colou?r[- ])?palette|split[- ]ton\w*|cross[- ]process\w*|faded|bleach[- ]bypass|colou?r[- ]block\w*|brand[- ]colou?rs?\b)/i;

/** Retire d'une consigne de rendu les segments qui demandent d'altérer les couleurs ; garde tout le reste. */
export function naturalColourModifier(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .split(/\s*[,;]\s*|\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !COLOUR_ALTERING.test(s))
    .join(', ');
}

/** Vrai quand une consigne demande d'altérer les couleurs (pour les contrôles). */
export const altersColours = (text: string): boolean => COLOUR_ALTERING.test(text);

/** Dit en positif au modèle d'image que l'image garde des couleurs naturelles. */
export const NATURAL_COLOUR_CLAUSE =
  'True-to-life natural colours exactly as the camera sees them: full colour, faithful skin tones, neutral white balance, untouched by any colour filter or print effect.';

/** Pour les modèles qui acceptent un prompt négatif : les altérations de couleur. */
export const COLOUR_FILTER_NEGATIVE = 'duotone, monochrome, black and white, sepia, colour cast, colour filter, tinted photo, posterized, halftone, two-tone, inverted colours, solarized';
