/**
 * Prix d'une vidéo motion design, selon le PÉRIMÈTRE choisi par l'utilisateur.
 *
 * Règle de départ (décision produit) : au périmètre de référence — 15 s, un
 * format, HD — une vidéo coûte DEUX FOIS la charte graphique. Le prix vient du
 * barème (`BUSINESS_CREDIT_COSTS.motion_video`), jamais d'un nombre recopié :
 * si la charte change de prix, la vidéo suit.
 *
 * Le périmètre module ensuite ce prix :
 *   - la DURÉE, presque linéaire (une scène de plus = du rendu et de la copie) ;
 *   - chaque FORMAT supplémentaire, moins cher que le premier : la copie, la
 *     musique et le storyboard sont réutilisés, seul le rendu est refait ;
 *   - la QUALITÉ, qui pèse sur le temps de rendu (60 i/s = deux fois plus
 *     d'images à capturer).
 *
 * Un nouvel export après retouche ne repaie pas la vidéo : il coûte une
 * fraction du périmètre, plus la différence si le périmètre a été élargi.
 */
import { CreativityLevel, creativityCost } from '../../../models/creativity.model';
import { BUSINESS_CREDIT_COSTS } from '../../../models/billing.model';
import {
  VIDEO_DURATIONS,
  VIDEO_FORMATS,
  VIDEO_QUALITIES,
  VideoDuration,
  VideoFormat,
  VideoQuality,
  VideoScope,
} from '../../../models/motionVideo.model';

export const VIDEO_PRICING = {
  /** 15 s · 1 format · HD = 2 × la charte. */
  referenceCost: BUSINESS_CREDIT_COSTS.motion_video as number,
  durationFactor: { 6: 0.5, 15: 1, 30: 1.75, 60: 3 } as Record<VideoDuration, number>,
  /** Chaque format au-delà du premier ajoute 35 % du prix du premier. */
  extraFormatFactor: 0.35,
  qualityFactor: { standard: 0.8, hd: 1, premium: 1.3 } as Record<VideoQuality, number>,
  /** Un nouvel export coûte 10 % du périmètre (minimum : une révision). */
  rerenderFactor: 0.1,
  minRerender: BUSINESS_CREDIT_COSTS.revision as number,
} as const;

export const DEFAULT_VIDEO_SCOPE: VideoScope = { durationSec: 15, formats: ['story'], quality: 'hd' };

/**
 * Périmètre validé : valeurs hors liste ramenées au plus proche, formats
 * dédoublonnés. Une requête mal formée donne un périmètre valide, jamais une
 * erreur 500 — mais le prix est toujours calculé sur CE périmètre normalisé.
 */
export function normalizeScope(raw: unknown): VideoScope {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof VideoScope, unknown>>;

  const requested = Number(input.durationSec);
  const durationSec = Number.isFinite(requested)
    ? VIDEO_DURATIONS.reduce((best, d) => (Math.abs(d - requested) < Math.abs(best - requested) ? d : best))
    : DEFAULT_VIDEO_SCOPE.durationSec;

  const formats = (Array.isArray(input.formats) ? input.formats : [input.formats])
    .filter((f): f is VideoFormat => VIDEO_FORMATS.includes(f as VideoFormat))
    .filter((f, i, all) => all.indexOf(f) === i);

  const quality = VIDEO_QUALITIES.includes(input.quality as VideoQuality)
    ? (input.quality as VideoQuality)
    : DEFAULT_VIDEO_SCOPE.quality;

  return {
    durationSec,
    formats: formats.length ? formats : [...DEFAULT_VIDEO_SCOPE.formats],
    quality,
  };
}

/** Prix complet d'une vidéo pour ce périmètre. */
export function videoCost(scope: VideoScope): number {
  const s = normalizeScope(scope);
  const formatsFactor = 1 + VIDEO_PRICING.extraFormatFactor * (s.formats.length - 1);
  return Math.ceil(
    VIDEO_PRICING.referenceCost *
      VIDEO_PRICING.durationFactor[s.durationSec] *
      formatsFactor *
      VIDEO_PRICING.qualityFactor[s.quality]
  );
}

/**
 * Prix d'un nouvel export.
 *
 * - le premier export est INCLUS dans le prix de la vidéo ;
 * - ensuite : 10 % du périmètre demandé, plus la différence avec ce qui a déjà
 *   été payé si le périmètre grandit (ajouter un format, passer en premium).
 */
export function exportCost(opts: { paidCredits: number; exportCount: number; scope: VideoScope; creativity?: CreativityLevel }): number {
  // Le cran de créativité choisi à la création s'applique aussi au périmètre élargi.
  const full = creativityCost(videoCost(opts.scope), opts.creativity || 'medium');
  const upgrade = Math.max(0, full - (opts.paidCredits || 0));
  if (opts.exportCount <= 0) return upgrade;
  const fee = Math.max(VIDEO_PRICING.minRerender, Math.ceil(full * VIDEO_PRICING.rerenderFactor));
  return upgrade + fee;
}

/** Table publique : le front calcule le prix en direct sans aller-retour. */
export function pricingTable() {
  return {
    referenceCost: VIDEO_PRICING.referenceCost,
    durationFactor: VIDEO_PRICING.durationFactor,
    extraFormatFactor: VIDEO_PRICING.extraFormatFactor,
    qualityFactor: VIDEO_PRICING.qualityFactor,
    rerenderFactor: VIDEO_PRICING.rerenderFactor,
    minRerender: VIDEO_PRICING.minRerender,
    durations: VIDEO_DURATIONS,
    formats: VIDEO_FORMATS,
    qualities: VIDEO_QUALITIES,
  };
}
