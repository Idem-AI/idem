/**
 * La direction artistique dans les prompts d'IMAGE.
 *
 * Les pages, les visuels et les cartes ne reçoivent plus la direction artistique en prose : le moteur
 * graphique (@idem/graphic-engine) la lit sous forme de jetons et de motifs. Restent les modèles d'image
 * (mockups, illustrations), à qui le rendu se décrit encore en mots : un seul endroit le produit, pour
 * que deux images d'une même marque aient le même grain, la même lumière et la même palette.
 */

import { ArtDirectionModel } from './art-direction.model';
import { resolveStyle } from '../design/artDirection.catalog';
import { COLOUR_FILTER_NEGATIVE, naturalColourModifier } from '../../../../../packages/design-tools/src';

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
  // Une consigne de rendu n'altère jamais les couleurs d'une image (duotone, noir et blanc, posterisation…) :
  // ces segments sont retirés, le reste (grain, lumière, cadrage) est gardé — design-tools/photo-integrity.
  return naturalColourModifier([ad.imagePromptModifier || style.imagePromptModifier || '', ad.imagery?.lighting, ad.imagery?.treatment].filter(Boolean).join(', '));
}

/** Prompt négatif du style, pour les modèles d'image qui l'acceptent. */
export function buildImageNegativePrompt(ad?: ArtDirectionModel | null): string {
  const style = resolveStyle(ad?.styleId);
  return [
    style.imageNegativePrompt,
    'generic stock photo, watermark, distorted text, extra fingers, low resolution, oversaturated HDR, AI artifacts',
    COLOUR_FILTER_NEGATIVE,
  ]
    .filter(Boolean)
    .join(', ');
}
