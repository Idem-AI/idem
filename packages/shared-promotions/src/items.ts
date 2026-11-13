import type { PromoService } from './model';

/**
 * Le catalogue des ARTICLES qu'une promotion peut viser. La clé est stable (`famille.article`), le
 * libellé sert au panel. Un article absent d'ici ne peut pas être remisé : c'est voulu, une remise
 * ne doit jamais s'appliquer à quelque chose qu'on n'a pas nommé.
 *
 * `itemOfSpend` traduit une action de débit du portefeuille (`unlock_business_plan`, `pass_croissance`,
 * `meter_day`…) vers son article. C'est le seul pont entre la facturation et les promotions.
 */

export const PROMO_SERVICES: Record<PromoService, { label: string; description: string }> = {
  idem: { label: 'Livrables IDEM', description: 'Versions finales, Signature, retouches, mises en page' },
  communication: { label: 'Communication', description: 'Visuels, carrousels, vidéos, calendriers, stratégies' },
  icode: { label: 'iCode', description: 'Pass Projet, modifications, médias de site' },
  ideploy: { label: 'iDeploy', description: 'Compteurs d’hébergement et options' },
  ivision: { label: 'iVision', description: 'Exports HD' },
  isimulate: { label: 'iSimulate', description: 'Simulations et rapports' },
  idomain: { label: 'Noms de domaine', description: 'Achat et renouvellement (coût réel chez le registraire)' },
  passes: { label: 'Forfaits', description: 'IDEM Croissance, IDEM Entreprise, iVision Créateur' },
  packs: { label: 'Packs', description: 'Pack Lancement, avec domaine, À plusieurs' },
};

export const PROMO_SERVICE_KEYS = Object.keys(PROMO_SERVICES) as PromoService[];

export interface PromoItem {
  service: PromoService;
  label: string;
}

export const PROMO_ITEMS: Record<string, PromoItem> = {
  // Livrables (Garder)
  'deliverable.logo_brand': { service: 'idem', label: 'Logo + charte graphique' },
  'deliverable.business_plan': { service: 'idem', label: 'Business plan' },
  'deliverable.pitch_deck': { service: 'idem', label: 'Pitch deck' },
  'deliverable.legal_kit': { service: 'idem', label: 'Kit juridique OHADA' },
  'deliverable.financial_forecast': { service: 'idem', label: 'Prévisionnel 3 ans' },
  'deliverable.business_card': { service: 'idem', label: 'Cartes de visite' },
  'deliverable.signature': { service: 'idem', label: 'Version Signature' },
  'deliverable.edit': { service: 'idem', label: 'Retouche hors fenêtre' },
  'deliverable.relayout': { service: 'idem', label: 'Nouvelle mise en page' },
  'deliverable.regenerate': { service: 'idem', label: 'Nouvelle version complète' },
  /** Le Kit plafonné, pour l'AFFICHAGE seulement : au débit, ce sont les livrables qui sont remisés. */
  'deliverable.kit': { service: 'idem', label: 'Kit Entreprise (affichage)' },

  // Communication
  'communication.flyer': { service: 'communication', label: 'Visuel' },
  'communication.ai_visual': { service: 'communication', label: 'Visuel généré par l’IA' },
  'communication.carousel': { service: 'communication', label: 'Carrousel' },
  'communication.motion_video': { service: 'communication', label: 'Vidéo motion design' },
  'communication.motion_video_rerender': { service: 'communication', label: 'Nouvel export vidéo' },
  'communication.ai_clip': { service: 'communication', label: 'Plan filmé par l’IA' },
  'communication.editorial_calendar': { service: 'communication', label: 'Calendrier éditorial' },
  'communication.communication_plan': { service: 'communication', label: 'Période de communication' },
  'communication.communication_strategy': { service: 'communication', label: 'Stratégie de communication' },
  'communication.short_video': { service: 'communication', label: 'Clip vidéo IA' },

  // Forfaits
  'pass.croissance': { service: 'passes', label: 'IDEM Croissance' },
  'pass.entreprise': { service: 'passes', label: 'IDEM Entreprise' },
  'pass.createur': { service: 'passes', label: 'iVision Créateur' },

  // Packs
  'pack.lancement': { service: 'packs', label: 'Pack Lancement' },
  'pack.lancement_domaine': { service: 'packs', label: 'Pack Lancement + domaine' },
  'pack.a_plusieurs': { service: 'packs', label: 'À plusieurs (5 codes Pack Lancement)' },

  // iCode
  'icode.project_pass': { service: 'icode', label: 'Pass Projet' },
  'icode.pack_100': { service: 'icode', label: 'Pack 100 modifications' },
  'icode.modification': { service: 'icode', label: 'Modification' },
  'icode.premium': { service: 'icode', label: 'Modification premium' },
  'icode.site_image': { service: 'icode', label: 'Image de site' },
  'icode.site_video': { service: 'icode', label: 'Clip de site' },

  // iDeploy
  'ideploy.meter': { service: 'ideploy', label: 'Compteur (jour)' },
  'ideploy.team': { service: 'ideploy', label: 'Espace équipe' },

  // iVision
  'ivision.export_visual': { service: 'ivision', label: 'Export HD d’un visuel' },
  'ivision.export_video': { service: 'ivision', label: 'Export HD d’une vidéo' },

  // iSimulate
  'isimulate.run': { service: 'isimulate', label: 'Simulation complète' },
  'isimulate.report': { service: 'isimulate', label: 'Rapport pour la banque' },
  'isimulate.rerun': { service: 'isimulate', label: 'Re-simulation' },
  'isimulate.deep': { service: 'isimulate', label: 'Simulation approfondie' },

  // Domaines
  'idomain.domain': { service: 'idomain', label: 'Nom de domaine' },
};

export const PROMO_ITEM_KEYS = Object.keys(PROMO_ITEMS);

export function isPromoItem(value: unknown): value is string {
  return typeof value === 'string' && value in PROMO_ITEMS;
}

export function serviceOfItem(item: string): PromoService | null {
  return PROMO_ITEMS[item]?.service ?? null;
}

const COMMUNICATION = new Set(
  PROMO_ITEM_KEYS.filter((key) => key.startsWith('communication.')).map((key) => key.slice('communication.'.length))
);
const DELIVERABLES = new Set(
  PROMO_ITEM_KEYS.filter((key) => key.startsWith('deliverable.')).map((key) => key.slice('deliverable.'.length))
);

/** Retouches et régénérations des livrables, telles que les routes de génération les nomment. */
const EDIT_ACTIONS = new Set(['revision', 'logo_relaunch', 'logo_regenerate', 'brand_regenerate']);
const RELAYOUT_ACTIONS = new Set(['business_plan_relayout', 'pitch_deck_relayout']);

/**
 * L'article d'un débit du portefeuille. `null` : rien à remiser (action inconnue — on préfère ne pas
 * remiser plutôt que remiser par erreur).
 */
export function itemOfSpend(action: string, feature?: string): string | null {
  if (!action) return null;
  if (feature === 'idomain' || action.startsWith('domain') || action.startsWith('idomain')) return 'idomain.domain';

  if (action.startsWith('unlock_')) {
    const key = action.slice('unlock_'.length);
    return DELIVERABLES.has(key) ? `deliverable.${key}` : null;
  }
  if (action.startsWith('signature_')) return 'deliverable.signature';
  if (action.startsWith('pass_')) {
    const key = `pass.${action.slice('pass_'.length)}`;
    return key in PROMO_ITEMS ? key : null;
  }
  if (action.startsWith('pack_')) {
    const key = `pack.${action.slice('pack_'.length)}`;
    return key in PROMO_ITEMS ? key : null;
  }
  if (action === 'icode_project_pass') return 'icode.project_pass';
  if (action === 'icode_pack_100') return 'icode.pack_100';
  if (action === 'icode_premium' || action === 'premium') return 'icode.premium';
  if (action === 'site_image') return 'icode.site_image';
  if (action === 'site_video') return 'icode.site_video';
  if (action.startsWith('icode_') || (feature === 'appgen' && (action === 'message' || action === 'build'))) return 'icode.modification';

  if (action === 'meter_day' || action.startsWith('meter_')) return 'ideploy.meter';
  if (action === 'deploy_team' || action === 'team_space') return 'ideploy.team';

  if (action === 'export_visual') return 'ivision.export_visual';
  if (action === 'export_video') return 'ivision.export_video';

  if (action.startsWith('simulation_')) {
    const tier = action.slice('simulation_'.length);
    if (tier === 'report') return 'isimulate.report';
    if (tier === 'rerun' || tier === 'sim-rerun') return 'isimulate.rerun';
    if (tier === 'deep' || tier === 'sim-deep') return 'isimulate.deep';
    return 'isimulate.run';
  }

  if (COMMUNICATION.has(action)) return `communication.${action}`;
  if (RELAYOUT_ACTIONS.has(action)) return 'deliverable.relayout';
  if (EDIT_ACTIONS.has(action)) return 'deliverable.edit';
  // Une régénération complète d'un livrable possédé se débite sous le nom du livrable.
  if (DELIVERABLES.has(action)) return 'deliverable.regenerate';
  if (action === 'logo_variations') return 'deliverable.regenerate';
  return null;
}
