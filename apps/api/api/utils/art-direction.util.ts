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
  return clean.length ? clean.map((i) => `- ${i}`).join('\n') : '- (not specified)';
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
    'Medium: POSTER. One idea, readable from two metres away. The art direction expresses itself at full strength — the signature compositional gesture must be visible immediately.',
  document:
    'Medium: PAGINATED DOCUMENT. The art direction expresses itself through consistency: the same grid, the same border radius, the same treatment of rules and images on every page. Spectacular gestures are reserved for the cover and for section openers.',
  slide:
    'Medium: SLIDE. One message per screen. The art direction drives the ground, the structure and the image treatment; the content stays readable from a distance.',
  web:
    'Medium: WEB INTERFACE. The art direction sets the grid, the radius, the shadows, the type scale and the image treatment. It does not exempt you from accessibility rules or interaction states.',
  mockup:
    'Medium: PHOTOREALISTIC MOCKUP. The art direction drives the light, the material, the framing and the grading of the photograph — not the subject, which is imposed by the support being shown.',
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
This brand's art direction is SETTLED. It is not a suggestion and it overrides every composition habit: two deliverables of this brand must recognise each other.

Direction: ${ad.styleName || style.name} — "${ad.tagline || style.essence}"
Why this stance for this brand: ${ad.rationale || style.essence}
Moodboard keywords: ${(ad.keywords || []).join(', ') || style.essence}
${medium ? `\n${medium}\n` : ''}
${sheet ? `<style_sheet>\n${sheet}\n</style_sheet>\n` : ''}
<composition>
- Grid: ${ad.layout?.grid || style.layout}
- Density: ${ad.layout?.density || 'balanced'}
- Negative space: ${ad.layout?.whitespace || 'generous, even margins'}
- Signature compositional gesture (must be visible): ${ad.layout?.signatureMove || 'a deliberate crop or bleed'}
</composition>

<color_usage>
- Distribution: ${ad.color?.distribution || '60 / 30 / 10'}
- Application: ${ad.color?.application || style.color}
- Contrast sought: ${ad.color?.contrast || 'decisive, never timid'}
No colour outside the charter palette. Tints come from opacity, never from a hue shift.
</color_usage>

<typography_usage>
- Scale contrast: ${ad.typography?.scaleContrast || `a ratio of ${style.typeRatio} between two consecutive levels, three levels minimum`}
- Case and tracking: ${ad.typography?.caseAndTracking || style.typography}
- Specific treatment: ${ad.typography?.treatment || 'no effect that does not serve the hierarchy'}
Only the two charter typefaces are allowed.
</typography_usage>

<imagery>
- Medium: ${ad.imagery?.medium || style.imagery}
- Subjects: ${ad.imagery?.subjects || "the brand's actual activity"}
- Treatment: ${ad.imagery?.treatment || style.imagery}
- Lighting: ${ad.imagery?.lighting || 'consistent across every visual of the brand'}
- Framing: ${ad.imagery?.framing || 'consistent from one visual to the next'}
Every image in a given deliverable shares this treatment: one untreated photograph among treated ones destroys the direction.
</imagery>

<graphic_devices>
${bullets(ad.graphicDevices?.length ? ad.graphicDevices : [style.devices])}
Border radius: ${style.radius}px, the same on EVERY element.
Rules: ${style.borders}
Shadows: ${style.shadows}
</graphic_devices>

<art_direction_rules>
DO:
${bullets(ad.dos)}
DO NOT:
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
  return `${ad.styleName || style?.name || ad.styleId} — ${ad.tagline || style?.essence || ''} (keywords: ${(ad.keywords || []).slice(0, 6).join(', ')})`;
}
