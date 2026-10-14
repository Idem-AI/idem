/**
 * LES RÔLES CRÉATIFS — une orchestration qui ne dépend d'aucun fournisseur.
 *
 * Les moteurs (graphique, vidéo) appellent des RÔLES logiques, jamais un modèle : le directeur graphique,
 * le codeur de plans, le critique visuel… Chaque rôle déclare ce dont il a BESOIN (code, vision, sortie
 * structurée, long contexte) et ses plafonds de jetons par cran ; le modèle effectif se résout ICI, par la
 * configuration du service — jamais dans un prompt :
 *
 *   IDEM_ROLE_<RÔLE>_MODEL      un modèle précis pour ce rôle (OpenRouter : vérifié par la liste blanche) ;
 *   IDEM_ROLE_<RÔLE>_ENDPOINT   `selfhosted` : le rôle part sur nos machines (`IDEM_SELFHOSTED_BASE_URL`,
 *                               API compatible OpenAI), avec `IDEM_ROLE_<RÔLE>_MODEL` ou le modèle du rôle ;
 *   sans rien                   le profil par défaut du rôle (`AI_CONFIG.creative[profile]`).
 *
 * `<RÔLE>` : le nom en majuscules, `.` et `-` remplacés par `_` (`video.author` → `VIDEO_AUTHOR`).
 * Un rôle qui exige la vision n'est jamais aiguillé vers un point d'accès qui ne la déclare pas.
 */
import type { CreativityLevel } from '@idem/shared-models';
import { AI_CONFIG, FeatureAIConfig, LLMProvider } from './ai.config';
import { isProviderConfigured, providerSupports } from './ai-providers.config';
import { isAllowedOpenRouterModel } from './openrouter.config';
import logger from './logger';

export type RoleCapability = 'code' | 'vision' | 'json' | 'long-context';
export type CreativeProfile = 'agents' | 'critic' | 'coder';

export interface CreativeRole {
  /** Le profil de modèle par défaut (`AI_CONFIG.creative`). */
  profile: CreativeProfile;
  needs: RoleCapability[];
  /** Plafond de jetons de SORTIE d'un appel, par cran (0 : le rôle ne travaille pas à ce cran). */
  maxOutputTokens: Record<CreativityLevel, number>;
  /** Ce que fait le rôle (documentation, journaux). */
  mission: string;
}

const UP_TO = (high: number, max: number, ultra: number, medium = 0, low = 0): Record<CreativityLevel, number> => ({ low, medium, high, max, ultra });

/** Le registre : les rôles logiques du plan directeur, et les noms historiques qui y mènent. */
export const CREATIVE_ROLES: Record<string, CreativeRole> = {
  'graphic.content': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(3000, 3500, 4000, 3000, 3000), mission: 'rédiger le contenu structuré des livrables' },
  'graphic.director': { profile: 'coder', needs: ['json', 'code'], maxOutputTokens: UP_TO(5000, 6500, 8000), mission: 'concevoir l’arbre de composition d’une page ou d’une diapositive' },
  'graphic.artDirector': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(300, 400, 400), mission: 'choisir et régler la composition de repli' },
  'graphic.pattern-designer': { profile: 'coder', needs: ['code'], maxOutputTokens: UP_TO(2500, 3000, 3500, 2500, 2500), mission: 'dessiner la tuile de motif propre à la marque (SVG)' },
  'graphic.asset-planner': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(600, 800, 1000), mission: 'déterminer les ressources visuelles nécessaires' },
  'video.intent-classifier': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(300, 300, 300, 300), mission: 'comprendre le besoin vidéo et les médias disponibles' },
  // Le film Motion Canvas : tous les crans travaillent ; le cran donne des MOYENS (plafonds), jamais des contraintes.
  'video.concept': { profile: 'coder', needs: ['long-context'], maxOutputTokens: UP_TO(1800, 2200, 3000, 1500, 0), mission: 'inventer le film : concept, bible visuelle, idée de chaque scène' },
  'video.planner': { profile: 'agents', needs: ['long-context'], maxOutputTokens: UP_TO(4000, 4500, 5000, 3500, 3500), mission: 'écrire le storyboard : durées, intentions, idées, textes, médias, voix' },
  'video.author': { profile: 'coder', needs: ['code', 'long-context'], maxOutputTokens: UP_TO(6000, 7000, 8000, 5000, 4500), mission: 'écrire le code Motion Canvas de chaque scène' },
  'video.reviser': { profile: 'agents', needs: [], maxOutputTokens: UP_TO(800, 800, 800, 800, 800), mission: 'lire une retouche écrite par le client' },
  'visual.critic': { profile: 'critic', needs: ['vision', 'json'], maxOutputTokens: UP_TO(300, 400, 500), mission: 'évaluer un rendu réel et formuler des corrections ciblées' },
  'generation.repair': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(400, 500, 600), mission: 'corriger un défaut technique précis' },
};

/** Les noms historiques des appelants (moteur graphique, cœur vidéo) → leur rôle logique. */
export const ROLE_ALIASES: Record<string, string> = {
  'graphic.composer': 'graphic.director',
  'graphic.critic': 'visual.critic',
  'graphic.repairer': 'generation.repair',
  director: 'video.concept',
  author: 'video.author',
  critic: 'visual.critic',
};

export const roleOf = (name: string): string => {
  const bare = name.replace(/^creative\./, '').replace(/:.*$/, '');
  return CREATIVE_ROLES[bare] ? bare : ROLE_ALIASES[bare] ?? bare;
};

const envKey = (role: string) => role.toUpperCase().replace(/[.-]/g, '_');

/**
 * La configuration d'appel d'un rôle : le profil par défaut, son modèle ou son point d'accès surchargés par
 * l'environnement, son plafond de sortie au cran donné. Un rôle inconnu garde le profil demandé.
 */
export function roleConfig(name: string, profile: CreativeProfile, level?: CreativityLevel): FeatureAIConfig {
  const role = roleOf(name);
  const def = CREATIVE_ROLES[role];
  const base: FeatureAIConfig = AI_CONFIG.creative[def?.profile ?? profile];
  const key = envKey(role);
  const model = process.env[`IDEM_ROLE_${key}_MODEL`]?.trim();
  const endpoint = process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim().toLowerCase();
  const cap = def && level ? def.maxOutputTokens[level] : 0;
  const llmOptions = { ...base.llmOptions, ...(cap ? { maxOutputTokens: cap } : {}) };

  if (endpoint === 'selfhosted') {
    const visionOk = !def?.needs.includes('vision') || providerSupports(LLMProvider.SELFHOSTED, 'vision');
    if (isProviderConfigured(LLMProvider.SELFHOSTED) && visionOk) {
      return { ...base, provider: LLMProvider.SELFHOSTED, modelName: model || process.env.IDEM_SELFHOSTED_MODEL?.trim() || base.modelName, pinModel: true, fallbackModels: [], llmOptions };
    }
    logger.warn('creative.role_endpoint_unavailable', { event: 'creative.role_endpoint_unavailable', role, reason: visionOk ? 'selfhosted not configured' : 'vision required' });
  }
  if (model) {
    if (isAllowedOpenRouterModel(model)) return { ...base, modelName: model, pinModel: true, llmOptions };
    logger.warn('creative.role_model_refused', { event: 'creative.role_model_refused', role, model });
  }
  return { ...base, llmOptions };
}

/** Un modèle ou un point d'accès est-il configuré pour ce rôle ? (sinon l'appelant garde sa configuration) */
export function hasRoleRouting(name: string): boolean {
  const key = envKey(roleOf(name));
  return Boolean(process.env[`IDEM_ROLE_${key}_MODEL`]?.trim() || process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim());
}
