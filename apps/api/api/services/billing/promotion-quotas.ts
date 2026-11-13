import { CREATIVITY_LEVELS } from '../../models/creativity.model';
import { GENERATION_ENVELOPES, envelopeCost } from '../../config/generation-budgets';
import { ACTION_QUOTA_GROUP, QUOTA_GROUPS, QuotaGroup } from '../../models/usage-quota.model';
import type { PromotionQuotas } from '../../../../../packages/shared-promotions/src/model';

/**
 * Les « crédits du jour » d'une campagne, calculés et non devinés.
 *
 * On décrit UN TOUR COMPLET de la plateforme — tout ce qu'un utilisateur peut produire aujourd'hui
 * sur IDEM, chaque élément une fois, avec des retouches et des aides réalistes — puis on le
 * multiplie par le nombre de tours voulus par jour (5 pour la bêta gratuite) :
 *
 *  - le NOMBRE de générations par groupe vient des actions réellement branchées
 *    (`ACTION_QUOTA_GROUP`) : une action ajoutée au site agrandit le tour toute seule ;
 *  - le PLAFOND DE COÛT IA vient des enveloppes (`config/generation-budgets.ts`) au cran le plus cher
 *    et en valeur plafond : on ne peut pas être arrêté par le disjoncteur avant d'avoir fini ses tours.
 *
 * Les limites ne portent que sur la journée (semaine et mois libres) : c'est une allocation
 * QUOTIDIENNE, qui repart à zéro à minuit (UTC).
 */

/** Ce qu'on ajoute à un tour, au-delà d'« une fois chaque action » : retouches, aides, modifications. */
const ROUND_EXTRAS = {
  /** Retouches par tour (3 par livrable et par contenu, en moyenne). */
  edits: 30,
  /** Sollicitations des aides IA (onboarding, suggestions, analyses) par aide disponible. */
  assistPerHelper: 3,
  /** Générations initiales iCode : un site et une application. */
  appgenInitial: 2,
  /** Modifications iCode : celles d'un Pass Projet, plus les images et clips de site. */
  appgenEdits: 40,
  /** Simulations : complète, rapport, approfondie, re-simulation. */
  simulations: 4,
} as const;

/** Nombre de générations d'un tour complet, par groupe. */
export function roundCounts(): Record<QuotaGroup, number> {
  const counts = Object.fromEntries(QUOTA_GROUPS.map((group) => [group, 0])) as Record<QuotaGroup, number>;
  for (const group of Object.values(ACTION_QUOTA_GROUP.business)) counts[group] += 1;

  counts.edit = Math.max(counts.edit, ROUND_EXTRAS.edits);
  counts.appgen_initial = ROUND_EXTRAS.appgenInitial;
  counts.appgen_edit = ROUND_EXTRAS.appgenEdits;
  counts.simulation = ROUND_EXTRAS.simulations;
  const helpers = Object.keys(GENERATION_ENVELOPES).filter((key) => key.startsWith('free.') && !key.startsWith('free.simulation')).length;
  counts.assist = helpers * ROUND_EXTRAS.assistPerHelper;
  return counts;
}

/** Coût IA plafond (en dollars) d'une génération, au cran le plus cher. */
function worstCostUsd(key: string): number {
  if (!GENERATION_ENVELOPES[key]) return 0;
  return Math.max(...CREATIVITY_LEVELS.map((level) => envelopeCost(key, level, 'max').usd));
}

/** Coût IA plafond d'un tour complet, en dollars. */
export function roundCostUsd(): number {
  let usd = 0;
  for (const action of Object.keys(ACTION_QUOTA_GROUP.business)) usd += worstCostUsd(`business.${action}`);
  usd += (ROUND_EXTRAS.edits - 2) * worstCostUsd('business.revision');
  usd += ROUND_EXTRAS.appgenInitial * worstCostUsd('appgen.initial_generation');
  usd += (ROUND_EXTRAS.appgenEdits - 6) * worstCostUsd('appgen.message') + 5 * worstCostUsd('appgen.site_image') + worstCostUsd('appgen.site_video');
  usd += worstCostUsd('free.simulation_run') * 3 + worstCostUsd('free.simulation_extra');
  for (const key of Object.keys(GENERATION_ENVELOPES).filter((entry) => entry.startsWith('free.') && !entry.startsWith('free.simulation'))) {
    usd += ROUND_EXTRAS.assistPerHelper * worstCostUsd(key);
  }
  return usd;
}

/** Les crédits du jour d'une campagne : `timesPerDay` tours complets, chaque jour. */
export function campaignQuotaPreset(timesPerDay = 5): PromotionQuotas & { roundCostUsd: number } {
  const times = Math.max(1, Math.min(50, Math.round(timesPerDay)));
  const counts = roundCounts();
  const limits: PromotionQuotas['limits'] = {};
  for (const group of QUOTA_GROUPS) limits[group] = { day: counts[group] * times, week: null, month: null };
  const perRound = roundCostUsd();
  // Arrondi au dollar supérieur : le disjoncteur ne doit jamais s'ouvrir avant la fin du dernier tour.
  const day = Math.ceil(perRound * times);
  return { enabled: true, timesPerDay: times, limits, spendCapsUsd: { day, week: null, month: null }, roundCostUsd: Math.round(perRound * 100) / 100 };
}
