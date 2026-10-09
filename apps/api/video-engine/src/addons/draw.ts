/**
 * Addon dessin : le trait humain et le vivant.
 *
 *  - rough.js : formes « dessinées à la main » (cadres, cercles, flèches, hachures), générées
 *    en tracés SVG avec une graine : la même forme à chaque image ;
 *  - perfect-freehand : traits de pinceau ou de feutre à pression variable, fonction pure ;
 *  - simplex-noise : bruit continu pour les mouvements organiques (champs de flux, blobs),
 *    créé avec le générateur pseudo-aléatoire du moteur (jamais Math.random).
 */
import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { registerAddon } from '../shared';

registerAddon('draw', {
  generator: () => rough.generator(),
  getStroke,
  createNoise2D,
  createNoise3D,
});
