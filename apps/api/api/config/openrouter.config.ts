/**
 * OpenRouter — LISTE BLANCHE des modèles ouverts, et table rôle → modèle.
 *
 * Objectif produit : tourner sur des modèles dont les POIDS sont publiés, pour
 * pouvoir les auto-héberger plus tard (vLLM/SGLang pour le texte, diffusers pour
 * l'image) en ne changeant que `OPENROUTER_BASE_URL`.
 *
 * ── POURQUOI UNE LISTE BLANCHE ──────────────────────────────────────────────
 *
 * « Disponible sur OpenRouter » ne veut PAS dire « open-weight ». Relevé sur le
 * catalogue réel : `qwen/qwen3.5-plus`, `qwen/qwen3.5-flash`, `qwen/qwen3.7-*`,
 * `qwen/qwen-image-3`, `black-forest-labs/flux.2-pro|max|flex` et tous les
 * modèles vidéo (Wan 3.0 compris) sont des API FERMÉES : aucun poids public.
 * Un nom qui ressemble à un modèle ouvert est donc refusé tant qu'il n'a pas
 * été vérifié ici, avec ses trois preuves :
 *
 *   1. `hugging_face_id` renseigné dans le catalogue OpenRouter ;
 *   2. licence lue sur la fiche Hugging Face (pas sur le nom du modèle) ;
 *   3. identifiant OpenRouter EXACT.
 *
 * `npm run openrouter:matrix` refait ces vérifications sur le catalogue en
 * direct et signale tout écart (modèle retiré, licence changée, poids retirés).
 * Date de la dernière vérification : voir `VERIFIED_ON`.
 *
 * Ce fichier est la SOURCE UNIQUE : le registre des fournisseurs, le garde-fou
 * et la matrice de comparaison le lisent tous.
 */

import type { ModelRole } from './ai.config';

export const VERIFIED_ON = '2026-10-11';

export type OpenRouterKind = 'text' | 'image' | 'video';

/** Effort d'hébergement estimé — matériel pour servir le modèle en production. */
export type SelfHost = 'léger' | 'moyen' | 'lourd' | 'impossible';

export interface OpenRouterModel {
  /** Identifiant OpenRouter exact. */
  id: string;
  kind: OpenRouterKind;
  /** Dépôt Hugging Face des poids (absent = API fermée). */
  hfId?: string;
  /** Licence lue sur la fiche Hugging Face. `propriétaire` si les poids ne sont pas publics. */
  license: string;
  openWeights: boolean;
  /** Utilisable commercialement sans accord supplémentaire. */
  commercialOk: boolean;
  selfHost: SelfHost;
  /** Rôles pour lesquels ce modèle est un candidat. */
  roles: ModelRole[];
  /** $/M tokens (texte) ou $/image — relevé au `VERIFIED_ON`, indicatif. */
  pricing?: { input?: number; output?: number; perImage?: number };
  /** Contexte et matériel : ce qui compte pour choisir ou héberger. */
  note: string;
}

/**
 * Les modèles autorisés. Ajouter une ligne = avoir vérifié les trois preuves
 * ci-dessus. Les API fermées figurent dans la liste (`openWeights: false`) pour
 * être SÉLECTIONNABLES en test de qualité, mais `OPENROUTER_OPEN_ONLY` (défaut :
 * actif) les écarte de toute affectation de rôle.
 */
export const OPENROUTER_MODELS: readonly OpenRouterModel[] = [
  // ── Texte : Qwen (première piste : multilingue, agents) ───────────────────
  {
    id: 'qwen/qwen3.5-9b', kind: 'text', hfId: 'Qwen/Qwen3.5-9B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: ['mechanical'],
    pricing: { input: 0.1, output: 0.15 },
    note: '262k ctx, multimodal. Tient sur un GPU 24 Go en 4 bits.',
  },
  {
    id: 'qwen/qwen3.5-35b-a3b', kind: 'text', hfId: 'Qwen/Qwen3.5-35B-A3B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: ['mechanical', 'vision', 'ocr'],
    pricing: { input: 0.08, output: 0.75 },
    note: 'MoE 3 B actifs : rapide. 1 GPU 48–80 Go en 8 bits.',
  },
  {
    id: 'qwen/qwen3.5-27b', kind: 'text', hfId: 'Qwen/Qwen3.5-27B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'moyen', roles: ['writing'],
    pricing: { input: 0.26, output: 2.6 },
    note: 'Dense : qualité de rédaction régulière. 1 GPU 80 Go.',
  },
  {
    id: 'qwen/qwen3.5-122b-a10b', kind: 'text', hfId: 'Qwen/Qwen3.5-122B-A10B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'moyen', roles: ['writing'],
    pricing: { input: 0.26, output: 2.08 },
    note: 'MoE 10 B actifs. 2–4 GPU 80 Go en 8 bits.',
  },
  {
    id: 'qwen/qwen3.5-397b-a17b', kind: 'text', hfId: 'Qwen/Qwen3.5-397B-A17B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'lourd', roles: ['reasoning'],
    pricing: { input: 0.55, output: 3.5 },
    note: 'Le plus capable de la gamme 3.5. 8 GPU 80 Go.',
  },
  {
    id: 'qwen/qwen3-vl-30b-a3b-instruct', kind: 'text', hfId: 'Qwen/Qwen3-VL-30B-A3B-Instruct', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: ['ocr', 'vision'],
    pricing: { input: 0.15, output: 0.6 },
    note: 'Vision/OCR dédié. 1 GPU 48–80 Go.',
  },
  // ── Texte : génération de code ────────────────────────────────────────────
  {
    id: 'qwen/qwen3-coder-next', kind: 'text', hfId: 'Qwen/Qwen3-Coder-Next', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'moyen', roles: [],
    pricing: { input: 0.12, output: 0.8 },
    note: 'Code et agents (iCode). Rôle `code` non modélisé ici : exporté par CODE_MODEL.',
  },
  {
    id: 'qwen/qwen3-coder', kind: 'text', hfId: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'lourd', roles: [],
    pricing: { input: 0.3, output: 1.0 },
    note: 'Repli code, 480 B. 8 GPU 80 Go.',
  },
  // ── Texte : Qwen plus récents, à tester contre la gamme 3.5 ───────────────
  {
    id: 'qwen/qwen3.6-35b-a3b', kind: 'text', hfId: 'Qwen/Qwen3.6-35B-A3B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: ['mechanical', 'vision'],
    pricing: { input: 0.1, output: 0.95 }, note: 'Candidat au remplacement de 3.5-35b.',
  },
  {
    id: 'qwen/qwen3.8-27b', kind: 'text', hfId: 'Qwen/Qwen3.8-27B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'moyen', roles: ['writing'],
    pricing: { input: 0.425, output: 2.55 }, note: '1 M de contexte. Candidat rédaction.',
  },
  // ── Texte : DeepSeek (alternative à tester) ───────────────────────────────
  {
    id: 'deepseek/deepseek-v4-flash', kind: 'text', hfId: 'deepseek-ai/DeepSeek-V4-Flash', license: 'mit',
    openWeights: true, commercialOk: true, selfHost: 'lourd', roles: ['writing', 'mechanical'],
    pricing: { input: 0.03, output: 1.28 }, note: '1 M ctx. Licence MIT.',
  },
  {
    id: 'deepseek/deepseek-v4-pro', kind: 'text', hfId: 'deepseek-ai/DeepSeek-V4-Pro', license: 'mit',
    openWeights: true, commercialOk: true, selfHost: 'lourd', roles: ['reasoning'],
    pricing: { input: 0.209, output: 0.418 }, note: '1 M ctx. Licence MIT. Cluster multi-nœuds.',
  },
  // ── Image : FLUX.2 ─────────────────────────────────────────────────────────
  {
    id: 'black-forest-labs/flux.2-klein-4b', kind: 'image', hfId: 'black-forest-labs/FLUX.2-klein-4B', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: ['image'],
    pricing: { perImage: 0.0034 },
    note: 'SEUL FLUX.2 aux poids ouverts disponible sur OpenRouter. 1 GPU 24 Go.',
  },
  {
    id: 'black-forest-labs/flux.2-pro', kind: 'image', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    pricing: { perImage: 0.0073 },
    note: 'API fermée : pour COMPARER la qualité, pas pour la trajectoire auto-hébergée.',
  },
  {
    id: 'black-forest-labs/flux.2-flex', kind: 'image', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    pricing: { perImage: 0.0146 }, note: 'API fermée. Meilleur rendu du texte dans l’image.',
  },
  {
    id: 'black-forest-labs/flux.2-max', kind: 'image', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    pricing: { perImage: 0.0171 }, note: 'API fermée, plafond de qualité de la gamme.',
  },
  // ── Vidéo : AUCUN modèle ouvert sur OpenRouter à ce jour ───────────────────
  {
    id: 'alibaba/wan-2.7', kind: 'video', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'Wan sur OpenRouter = API fermée. Les poids ouverts (Wan 2.1/2.2) ne passent pas par OpenRouter.',
  },
  {
    id: 'alibaba/wan-3.0', kind: 'video', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'API fermée. $0,05–0,20 / s selon la résolution.',
  },
];

/** Modèle de génération de code (iCode, agents) — hors table de rôles. */
export const CODE_MODEL = process.env.IDEM_OPENROUTER_CODE_MODEL || 'qwen/qwen3-coder-next';

/**
 * Affectation rôle → modèle, première piste Qwen. Chaque rôle reste surchargeable
 * sans redéploiement par `IDEM_OPENROUTER_<ROLE>_MODEL`, sous réserve de la liste
 * blanche (cf. `resolveOpenRouterModel`).
 */
export const OPENROUTER_DEFAULT_ROLES: Record<ModelRole, string> = {
  mechanical: 'qwen/qwen3.5-9b',
  writing: 'qwen/qwen3.5-122b-a10b',
  reasoning: 'qwen/qwen3.5-397b-a17b',
  vision: 'qwen/qwen3.5-35b-a3b',
  ocr: 'qwen/qwen3-vl-30b-a3b-instruct',
  image: 'black-forest-labs/flux.2-klein-4b',
};

/** Repli du fournisseur : modèles ouverts de la liste, d'une autre famille en dernier. */
export const OPENROUTER_FALLBACK_MODELS = [
  'qwen/qwen3.5-122b-a10b',
  'qwen/qwen3.5-35b-a3b',
  'deepseek/deepseek-v4-flash',
  'qwen/qwen3.5-9b',
];

/** Seuls les modèles aux poids ouverts peuvent être affectés à un rôle ? Défaut : oui. */
export function openOnly(): boolean {
  return (process.env.OPENROUTER_OPEN_ONLY ?? 'on').toLowerCase() !== 'off';
}

export function findOpenRouterModel(id: string): OpenRouterModel | undefined {
  const needle = (id || '').toLowerCase();
  return OPENROUTER_MODELS.find((model) => model.id.toLowerCase() === needle);
}

/**
 * Un identifiant est-il autorisé ?
 *
 * Refusé : tout ce qui n'est pas dans la liste, et — tant que `OPENROUTER_OPEN_ONLY`
 * n'est pas coupé — toute API fermée. `OPENROUTER_ALLOW_UNLISTED=on` lève le
 * premier refus (essai ponctuel d'un nouveau modèle), jamais le second.
 */
export function isAllowedOpenRouterModel(id: string): boolean {
  const entry = findOpenRouterModel(id);
  if (!entry) return (process.env.OPENROUTER_ALLOW_UNLISTED ?? 'off').toLowerCase() === 'on';
  return entry.openWeights || !openOnly();
}

/**
 * Modèle servant un rôle chez OpenRouter : variable d'env si elle est AUTORISÉE,
 * sinon le défaut. Une valeur refusée est ignorée avec un avertissement plutôt
 * que d'envoyer silencieusement un modèle fermé en production.
 */
export function resolveOpenRouterModel(
  role: ModelRole,
  warn: (message: string) => void = () => undefined
): string {
  const envName = `IDEM_OPENROUTER_${role.toUpperCase()}_MODEL`;
  const wanted = process.env[envName]?.trim();
  if (wanted) {
    if (isAllowedOpenRouterModel(wanted)) return wanted;
    warn(`${envName}=${wanted} refusé (hors liste blanche ou API fermée) — défaut conservé`);
  }
  return OPENROUTER_DEFAULT_ROLES[role];
}

export const OPENROUTER_BASE_URL = () =>
  process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/**
 * Corps ajouté à chaque requête OpenRouter.
 *
 * `data_collection: 'deny'` : seuls les hébergeurs qui s'engagent à ne pas
 * conserver ni entraîner sur les requêtes sont éligibles. Les données projet
 * des utilisateurs transitent ici ; le défaut d'OpenRouter les autorise.
 * `OPENROUTER_DATA_COLLECTION=allow` le relâche (hébergeurs moins nombreux = moins de
 * résilience, c'est le compromis).
 */
export function openRouterRouting(): Record<string, unknown> {
  const collection = (process.env.OPENROUTER_DATA_COLLECTION ?? 'deny').toLowerCase();
  return {
    provider: {
      data_collection: collection === 'allow' ? 'allow' : 'deny',
      allow_fallbacks: true,
    },
  };
}

/** En-têtes d'attribution OpenRouter (classement et journal de leur tableau de bord). */
export function openRouterHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://idem.africa',
    'X-Title': process.env.OPENROUTER_APP_TITLE || 'IDEM',
  };
}
