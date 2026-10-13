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
