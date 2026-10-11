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

export type OpenRouterKind = 'text' | 'image' | 'video' | 'speech';

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
  /**
   * Dérogation EXPLICITE à la règle « poids ouverts seulement » : décision produit
   * (pas d'équivalent ouvert pour ce besoin). Le modèle reste fermé et non
   * auto-hébergeable ; il est simplement autorisé sans couper `OPENROUTER_OPEN_ONLY`.
   */
  allowClosed?: boolean;
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
  {
    id: 'qwen/qwen3-coder-30b-a3b-instruct', kind: 'text', hfId: 'Qwen/Qwen3-Coder-30B-A3B-Instruct', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: [],
    pricing: { input: 0.07, output: 0.28 },
    note: 'Code léger. 1 GPU 48–80 Go. Pas de « DeepSeek Coder » sur OpenRouter : fusionné dans DeepSeek V3+/V4.',
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
    pricing: { input: 0.04, output: 2.3 }, note: '1 M de contexte. Candidat rédaction.',
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
  {
    id: 'qwen/qwen-image-3', kind: 'image', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    pricing: { perImage: 0.003 },
    note: 'Qwen Image sur OpenRouter = API fermée : alternative À TESTER, pas auto-hébergeable (poids ouverts Qwen-Image hors OpenRouter).',
  },
  // ── Voix off ───────────────────────────────────────────────────────────────
  // Le catalogue « speech » ne renseigne PAS hugging_face_id : la preuve des poids
  // ouverts est ici la fiche Hugging Face lue à la main (hfId + licence ci-dessous).
  {
    id: 'hexgrad/kokoro-82m', kind: 'speech', hfId: 'hexgrad/Kokoro-82M', license: 'apache-2.0',
    openWeights: true, commercialOk: true, selfHost: 'léger', roles: [],
    pricing: { input: 0.62 },
    note: 'SEUL modèle vocal ouvert et utilisable sur OpenRouter. Voix française `ff_siwis`. 82 M de paramètres : tourne sur CPU.',
  },
  {
    id: 'mistralai/voxtral-mini-tts-2603', kind: 'speech', hfId: 'mistralai/Voxtral-4B-TTS-2603', license: 'cc-by-nc-4.0',
    openWeights: true, commercialOk: false, selfHost: 'moyen', roles: [],
    note: 'Bon français (voix `fr_marie_*`) mais licence NON COMMERCIALE : exclu.',
  },
  {
    id: 'qwen/qwen-audio-3.0-tts-flash', kind: 'speech', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'API DashScope fermée. Qwen3-TTS ouvert (Apache-2.0, Qwen/Qwen3-TTS-12Hz-1.7B-*) n’est PAS sur OpenRouter : à servir soi-même (IDEM_TTS_URL).',
  },
  {
    id: 'microsoft/mai-voice-2.1-flash', kind: 'speech', license: 'propriétaire',
    openWeights: false, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'Fermé. Voix françaises fr-FR-*. Référence de qualité pour comparer.',
  },
  // ── Vidéo : AUCUN modèle ouvert sur OpenRouter ; Seedance 2.0 par dérogation ──
  {
    id: 'bytedance/seedance-2.0', kind: 'video', license: 'propriétaire',
    openWeights: false, allowClosed: true, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'VIDÉO PAR DÉFAUT (décision produit, dérogation à l’open-weight). 4–15 s, 480p–4K, image → vidéo (première/dernière image). Facturé au token vidéo.',
  },
  {
    id: 'bytedance/seedance-2.0-fast', kind: 'video', license: 'propriétaire',
    openWeights: false, allowClosed: true, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'Variante rapide, 480p–720p. Repli de Seedance 2.0.',
  },
  {
    id: 'bytedance/seedance-2.0-mini', kind: 'video', license: 'propriétaire',
    openWeights: false, allowClosed: true, commercialOk: true, selfHost: 'impossible', roles: [],
    note: 'Variante économique, 480p–720p.',
  },
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
/** Vidéo par défaut (dérogation produit à l'open-weight, cf. `allowClosed`). */
export const DEFAULT_VIDEO_MODEL = 'bytedance/seedance-2.0';

/**
 * Les modèles des médias, sous les noms que les configurations de features
 * emploient. Texte : voir `OPENROUTER_DEFAULT_ROLES` (par rôle).
 */
export const OPENROUTER_MEDIA = {
  image: OPENROUTER_DEFAULT_ROLES.image,
  /** Repli image : à défaut de variable, le même modèle (la saturation est rare, le repli ouvert unique). */
  imageFallback: process.env.IDEM_OPENROUTER_IMAGE_FALLBACK_MODEL?.trim() || OPENROUTER_DEFAULT_ROLES.image,
  vision: OPENROUTER_DEFAULT_ROLES.vision,
  /** Repli vision : le modèle de lecture de texte, d'une autre taille. */
  visionFallback: OPENROUTER_DEFAULT_ROLES.ocr,
  video: process.env.IDEM_VIDEO_CLIP_MODEL?.trim() || DEFAULT_VIDEO_MODEL,
  tts: 'hexgrad/kokoro-82m',
} as const;

/** Voix off par défaut : le seul modèle vocal ouvert, commercial et francophone du catalogue. */
export const SPEECH_MODEL_DEFAULT: string = OPENROUTER_MEDIA.tts;

/** Voix Kokoro par langue (identifiants relevés au catalogue OpenRouter). */
export const KOKORO_VOICES: Record<string, string> = {
  fr: 'ff_siwis', en: 'af_heart', es: 'ef_dora', it: 'if_sara',
  pt: 'pf_dora', hi: 'hf_alpha', ja: 'jf_alpha', zh: 'zf_xiaobei',
};

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
  return (entry.openWeights && entry.commercialOk) || Boolean(entry.allowClosed) || !openOnly();
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
