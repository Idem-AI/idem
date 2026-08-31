/**
 * Injection de la direction artistique dans les prompts.
 *
 * Un seul endroit produit le bloc `<art_direction>` : charte graphique, visuels
 * sociaux, business plan, pitch deck, mockups et site web reçoivent donc
 * exactement la même consigne. C'est la condition pour qu'un projet ait l'air
 * d'avoir été dessiné par la même personne d'un livrable à l'autre — le défaut
 * qu'on corrige n'était pas la qualité de chaque prompt pris isolément, mais le
 * fait que chacun réinventait un parti pris.
 */

import { ArtDirectionModel } from '../models/art-direction.model';
import {
  ART_DIRECTION_STYLES,
  buildStyleSheet,
  resolveStyle,
} from '../services/design/artDirection.catalog';

/** Rendu compact d'une liste, sans laisser de puce vide. */
function bullets(items?: string[]): string {
  const clean = (items || []).map((i) => (i || '').trim()).filter(Boolean);
  return clean.length ? clean.map((i) => `- ${i}`).join('\n') : '- (non spécifié)';
}

export interface ArtDirectionBlockOptions {
  /**
   * Support visé. Le même parti pris ne s'applique pas de la même façon à une
   * affiche et à un document de vingt pages : on le précise plutôt que de
   * laisser le modèle transposer au jugé.
   */
  medium?: 'poster' | 'document' | 'slide' | 'web' | 'mockup';
  /** Inclure la fiche complète du style du catalogue (plus long, plus précis). */
  includeStyleSheet?: boolean;
}

const MEDIUM_NOTE: Record<string, string> = {
  poster:
    "Support : AFFICHE. Une seule idée, lisible à deux mètres. La direction artistique s'exprime à plein — le geste de composition signature doit être visible immédiatement.",
  document:
    "Support : DOCUMENT paginé. La direction artistique s'exprime par la constance : même grille, même rayon de bordure, même traitement des filets et des images sur toutes les pages. Les gestes spectaculaires sont réservés à la couverture et aux ouvertures de section.",
  slide:
    "Support : DIAPOSITIVE. Un message par écran. La direction artistique porte le fond, la structure et le traitement des images ; le contenu reste lisible de loin.",
  web:
    "Support : INTERFACE WEB. La direction artistique fixe la grille, le rayon, les ombres, l'échelle typographique et le traitement des images. Elle ne dispense pas des règles d'accessibilité ni des états d'interaction.",
  mockup:
    "Support : MISE EN SITUATION PHOTORÉALISTE. La direction artistique pilote la lumière, la matière, le cadrage et l'étalonnage de la photo — pas le sujet, qui est imposé par le support à présenter.",
};

/**
 * Bloc `<art_direction>` à insérer dans un prompt de génération.
 *
 * Renvoie une chaîne vide quand aucune direction n'est disponible : mieux vaut
 * l'absence de bloc qu'un bloc rempli de « non spécifié », qui apprend au modèle
 * que la consigne est facultative.
 */
export function buildArtDirectionBlock(
  ad?: ArtDirectionModel | null,
  options: ArtDirectionBlockOptions = {}
): string {
  if (!ad || !ad.styleId) return '';

  const style = resolveStyle(ad.styleId);
  const medium = options.medium ? MEDIUM_NOTE[options.medium] : '';
  const sheet = options.includeStyleSheet === false ? '' : buildStyleSheet(style.id);

  return `<art_direction>
La direction artistique de cette marque est FIXÉE. Elle n'est pas une suggestion et elle prime sur toute habitude de composition : deux livrables de cette marque doivent se reconnaître entre eux.

Direction retenue : ${ad.styleName || style.name} — « ${ad.tagline || style.essence} »
Pourquoi ce parti pris pour cette marque : ${ad.rationale || style.essence}
Mots-clés de moodboard : ${(ad.keywords || []).join(', ') || style.essence}
${medium ? `\n${medium}\n` : ''}
${sheet ? `<style_sheet>\n${sheet}\n</style_sheet>\n` : ''}
<composition>
- Grille : ${ad.layout?.grid || style.layout}
- Densité : ${ad.layout?.density || 'équilibrée'}
- Espace négatif : ${ad.layout?.whitespace || 'marges généreuses et régulières'}
- Geste de composition signature (doit être visible) : ${ad.layout?.signatureMove || 'un recadrage ou un débord assumé'}
</composition>

<color_usage>
- Répartition : ${ad.color?.distribution || '60 / 30 / 10'}
- Application : ${ad.color?.application || style.color}
- Contraste recherché : ${ad.color?.contrast || 'franc, jamais timide'}
Aucune couleur hors palette de la charte. Les nuances se font en opacité, jamais en changeant de teinte.
</color_usage>

<typography_usage>
- Contraste d'échelle : ${ad.typography?.scaleContrast || `rapport ${style.typeRatio} entre deux niveaux consécutifs, trois niveaux minimum`}
- Casse et interlettrage : ${ad.typography?.caseAndTracking || style.typography}
- Traitement particulier : ${ad.typography?.treatment || 'aucun effet qui ne serve la hiérarchie'}
Seules les deux familles de la charte sont autorisées.
</typography_usage>

<imagery>
- Médium : ${ad.imagery?.medium || style.imagery}
- Sujets : ${ad.imagery?.subjects || 'liés à l\'activité réelle de la marque'}
- Traitement : ${ad.imagery?.treatment || style.imagery}
- Lumière : ${ad.imagery?.lighting || 'cohérente sur tous les visuels de la marque'}
- Cadrage : ${ad.imagery?.framing || 'constant d\'un visuel à l\'autre'}
Toutes les images d'un même livrable partagent ce traitement : une photo non traitée au milieu de photos traitées ruine la direction.
</imagery>

<graphic_devices>
${bullets(ad.graphicDevices?.length ? ad.graphicDevices : [style.devices])}
Rayon de bordure : ${style.radius}px, le même sur TOUS les éléments.
Filets : ${style.borders}
Ombres : ${style.shadows}
</graphic_devices>

<art_direction_rules>
À FAIRE :
${bullets(ad.dos)}
À NE PAS FAIRE :
${bullets(ad.donts?.length ? ad.donts : style.bans)}
</art_direction_rules>
</art_direction>`;
}

/**
 * Fragment de rendu à concaténer à un prompt de génération d'IMAGE.
 *
 * Le sujet vient de l'appelant, le RENDU vient d'ici. Cette séparation est ce
 * qui permet à des images produites par des modules différents (mockups de la
 * charte, visuel d'un post, illustration d'une slide) d'avoir le même grain, la
 * même lumière et la même palette.
 */
export function buildImageStyleModifier(ad?: ArtDirectionModel | null): string {
  if (!ad || !ad.styleId) return '';
  const style = resolveStyle(ad.styleId);
  const modifier = (ad.imagePromptModifier || style.imagePromptModifier || '').trim();
  const lighting = ad.imagery?.lighting ? `, ${ad.imagery.lighting}` : '';
  const treatment = ad.imagery?.treatment ? `, ${ad.imagery.treatment}` : '';
  return `${modifier}${lighting}${treatment}`.trim();
}

/** Prompt négatif du style, pour les modèles d'image qui l'acceptent. */
export function buildImageNegativePrompt(ad?: ArtDirectionModel | null): string {
  const style = resolveStyle(ad?.styleId);
  return [
    style.imageNegativePrompt,
    'generic stock photo, watermark, distorted text, extra fingers, low resolution, oversaturated HDR, AI artifacts',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Résumé d'une ligne, pour les contextes où le bloc complet ne tient pas
 * (en-tête de contexte projet, journaux, digest de section).
 */
export function summarizeArtDirection(ad?: ArtDirectionModel | null): string {
  if (!ad || !ad.styleId) return '';
  const style = ART_DIRECTION_STYLES[ad.styleId];
  return `${ad.styleName || style?.name || ad.styleId} — ${ad.tagline || style?.essence || ''} (mots-clés: ${(ad.keywords || []).slice(0, 6).join(', ')})`;
}
