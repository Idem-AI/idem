/**
 * Agent « direction artistique ».
 *
 * Il ne dessine rien : il DÉCIDE. Une fois pour la marque, il choisit un style
 * dans le catalogue et l'adapte au projet, puis toutes les générations
 * (charte, visuels, business plan, deck, mockups, site) s'y conforment.
 *
 * Le choix est contraint au catalogue, délibérément. Laissé libre, un modèle
 * répond « moderne, épuré, professionnel » — trois mots qui ne contraignent
 * rien et produisent la moyenne du corpus. En le forçant à retenir un style
 * nommé, avec sa grammaire, on obtient un parti pris exécutable et vérifiable.
 */

import { buildStyleCatalogBrief } from '../../../design/artDirection.catalog';

export interface ArtDirectionPromptInput {
  projectName: string;
  projectDescription: string;
  industry: string;
  targetAudience: string;
  /** Palette de la charte, sérialisée. */
  colorsJson: string;
  /** Typographie de la charte, sérialisée. */
  typographyJson: string;
  /** Concept du logo retenu, s'il existe. */
  logoConcept?: string;
  /** Type de logo (icon / name / initial). */
  logoType?: string;
  /**
   * Styles à écarter. Sert à la régénération : sans cela, le modèle propose
   * deux fois le même style et l'utilisateur qui demande « autre chose »
   * reçoit la même réponse.
   */
  excludeStyleIds?: string[];
}

export function buildArtDirectionPrompt(input: ArtDirectionPromptInput): string {
  const excluded = (input.excludeStyleIds || []).filter(Boolean);

  return `<role>Directeur artistique de studio de branding. Vous arbitrez le parti pris visuel d'une marque pour les trois prochaines années.</role>
<objective>Choisir UN style dans le catalogue ci-dessous, puis l'adapter à cette marque en une direction artistique exécutable. Sortie : JSON strict.</objective>

<brand_brief>
Marque : ${input.projectName}
Description : ${input.projectDescription}
Secteur : ${input.industry}
Cible : ${input.targetAudience}
Palette validée (intangible) : ${input.colorsJson}
Typographie validée (intangible) : ${input.typographyJson}
${input.logoConcept ? `Concept du logo : ${input.logoConcept}` : ''}
${input.logoType ? `Type de logo : ${input.logoType}` : ''}
</brand_brief>

<style_catalog>
${buildStyleCatalogBrief()}
</style_catalog>
${
  excluded.length
    ? `\n<excluded_styles>\nCes styles ont déjà été proposés et sont écartés : ${excluded.join(', ')}. En choisir un autre.\n</excluded_styles>\n`
    : ''
}
<how_to_choose>
1. Nommer, pour vous-même, ce que cette marque VEND réellement — pas son secteur, sa promesse (la confiance, la vitesse, la chaleur, la rigueur, le statut, l'accessibilité).
2. Éliminer les styles qui contredisent cette promesse. Un cabinet d'audit ne peut pas être Y2K ; une marque de festival ne peut pas être Design Suisse.
3. Parmi ceux qui restent, retenir celui qui rend la marque RECONNAISSABLE face à ses concurrents directs — pas celui qui la fait ressembler à la moyenne de son secteur.
4. Vérifier la compatibilité avec la palette et la typographie déjà validées : un style à fond sombre imposé avec une palette entièrement claire est un mauvais choix, changez de style (la palette, elle, ne se change pas).
5. Ne jamais retenir un style « parce qu'il est sûr ». Le minimalisme choisi par défaut, sans raison tenant à cette marque, est le pire des choix : c'est la moyenne déguisée en parti pris.
</how_to_choose>

<what_makes_it_executable>
La direction n'est utile que si elle décide à la place de celui qui composera ensuite. Chaque champ doit être une CONSIGNE, pas un adjectif.
- « épuré et moderne » ne décide rien.
- « une seule zone occupée par page, alignée sur une grille de 12 colonnes, 55 % du cadre laissé vide, un filet d'1px comme seul ornement » décide tout.
Chaque champ doit pouvoir être exécuté par quelqu'un qui n'a pas lu le reste du document.
</what_makes_it_executable>

<constraints>
- styleId DOIT être un identifiant du catalogue, à la lettre près.
- La palette et la typographie fournies sont intangibles : la direction dit comment les EMPLOYER, jamais quoi changer.
- imagePromptModifier est en ANGLAIS (il est concaténé à des prompts de modèles d'image) et décrit le RENDU uniquement — lumière, matière, grain, étalonnage, cadrage — jamais le sujet. 25 à 60 mots.
- Tous les autres champs sont en FRANÇAIS.
- dos et donts : 4 à 6 entrées chacun, à l'impératif, propres à CETTE marque (pas la recopie générique du style).
- keywords : 5 à 8 mots de moodboard, concrets (une matière, une lumière, un objet), jamais des adjectifs de marque.
</constraints>

<output_format>
JSON strict, sans texte autour, sans balises de code.
{
  "styleId": "identifiant exact du catalogue",
  "styleName": "nom du style",
  "tagline": "la direction en une formule de 8 mots maximum, propre à cette marque",
  "rationale": "2 à 3 phrases : pourquoi ce style pour CETTE marque, et ce qu'il écarte",
  "keywords": ["", "", "", "", ""],
  "layout": {
    "grid": "système de grille précis (nombre de colonnes, gouttières, comportement des marges)",
    "density": "airy | balanced | dense, plus une phrase d'application",
    "whitespace": "part du cadre laissée vide et où elle se situe",
    "signatureMove": "LE geste de composition qui doit être visible sur chaque livrable"
  },
  "color": {
    "distribution": "répartition chiffrée entre les couleurs de la charte",
    "application": "où va chaque couleur (aplats, textes, filets, images)",
    "contrast": "type de contraste recherché"
  },
  "typography": {
    "scaleContrast": "rapport d'échelle entre niveaux et nombre de niveaux",
    "caseAndTracking": "casse dominante et interlettrage, valeurs comprises",
    "treatment": "traitement typographique particulier, ou 'aucun'"
  },
  "imagery": {
    "medium": "photography | illustration | render-3d | collage | abstract | mixed",
    "subjects": "ce que montrent les images de cette marque",
    "treatment": "traitement appliqué à toute image (duotone, grain, recadrage, voile...)",
    "lighting": "direction et qualité de lumière, constantes sur toute la marque",
    "framing": "cadrage et point de vue dominants"
  },
  "graphicDevices": ["3 à 5 éléments graphiques récurrents, décrits assez précisément pour être redessinés"],
  "dos": ["", "", "", ""],
  "donts": ["", "", "", ""],
  "imagePromptModifier": "english render-only modifier, 25-60 words"
}
</output_format>
`;
}
