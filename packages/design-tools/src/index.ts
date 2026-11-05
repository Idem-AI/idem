/// <reference path="./vendor.d.ts" />
/**
 * @idem/design-tools — la boîte à outils des agents créatifs d'IDEM (moteur graphique, moteur vidéo).
 *
 * Tout tourne sur le PROCESSEUR, sans GPU ni binaire natif d'inférence (choix du plan qualité du 04/11/2026) :
 * couleur et contraste WCAG 2, paires de polices, motifs procéduraux, saliency « frequency-tuned », vectorisation,
 * embeddings CLIP en WebAssembly, juge visuel à questions fermées (modèle de vision de l'hôte), score des variantes,
 * axes de départ des 13 pays.
 */
export * from './tool';
export * from './color';
export * from './typography';
export * from './pattern';
export * from './saliency';
export * from './vectorize';
export * from './embed';
export * from './judge';
export * from './score';
export * from './seed';
export * from './cutout';
export * from './treat';

import { paletteTool, contrastTool } from './color';
import { typePairsTool } from './typography';
import { patternTool } from './pattern';
import { saliencyTool } from './saliency';
import { vectorizeTool } from './vectorize';

/** Les outils exposés à un agent qui sait appeler des outils (nom → outil). */
export const DESIGN_TOOLS = {
  [paletteTool.name]: paletteTool,
  [contrastTool.name]: contrastTool,
  [typePairsTool.name]: typePairsTool,
  [patternTool.name]: patternTool,
  [saliencyTool.name]: saliencyTool,
  [vectorizeTool.name]: vectorizeTool,
} as const;
