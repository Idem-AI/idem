/**
 * Réglages de mise en page du PDF du business plan.
 *
 * MODULE À PART, pour que `npm run check:bpquality` imprime avec EXACTEMENT
 * les réglages du service sans importer le service (Mongo, MinIO…). Un harnais
 * qui recopie ses réglages finit par contrôler un autre document que celui
 * qu'on livre.
 */

import type { PdfGenerationOptions } from '../pdf.service';

export const BUSINESS_PLAN_PAGINATION: NonNullable<PdfGenerationOptions['pagination']> = {
  // Empêcher les très grands espaces vides (stretching excessif) après les graphiques
  maxGapAddMm: 3,
  maxGapAddHardMm: 8,
  balance: false,
  // Un bloc sécable comble le bas de page dès 10 % de hauteur libre.
  minSplitRatio: 0.1,
  // Pages vides et grands blancs, corrigés à la composition. Mesurés sur les
  // plans livrés le 13 septembre 2026 : pied de section seul sur sa page
  // (93 % de blanc), fins de section remplies à 23-36 % suivies d'une page
  // neuve, trous de 30 % sous un bloc insécable.
  compact: {
    orphanFolio: true,
    pullBackBelow: 0.35,
    continueBelow: 0.5,
    minFitScale: 0.88,
    dropEmptyPages: true,
  },
};
