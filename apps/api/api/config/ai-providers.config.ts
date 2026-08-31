/**
 * Registre central des fournisseurs de modèles IA.
 *
 * Objectif : ajouter/permuter un fournisseur (ou brancher un futur modèle IDEM
 * auto-hébergé) doit se faire ICI en ajoutant une entrée + une variable d'env,
 * SANS toucher au code métier. `prompt.service.ts` lit ce registre pour savoir
 * quel adaptateur utiliser (`gemini` natif ou `openai-compatible`), avec quelle
 * clé/URL, et quelles capacités sont réellement supportées.
 *
 * Deux familles d'adaptateurs suffisent aujourd'hui :
 *   - `gemini`            → SDK @google/genai (grounding Google Search, cache de
 *                           contexte, image/vision, function-calling natif).
 *   - `openai-compatible` → SDK `openai` avec baseURL custom. Couvre OpenAI,
 *                           DeepSeek, GLM (Z.ai), et demain nos modèles maison
 *                           servis par vLLM/TGI/SGLang qui exposent tous cette
 *                           même API.
 */

import { LLMProvider, FeatureAIConfig, GLM_MODELS } from './ai.config';

export type ProviderKind = 'gemini' | 'openai-compatible';

/**
 * Ce qu'un fournisseur sait faire. Sert de garde-fou : on n'aiguille jamais une
 * fonctionnalité vers un fournisseur incapable de la servir (ex: grounding
 * Google Search reste propre à Gemini).
 */
export interface ProviderCapabilities {
  /** Function-calling / boucle agentique (runPromptWithTools). */
  tools: boolean;
  /** Recherche fondée via Google Search (runGroundedResearch). Gemini only. */
  grounding: boolean;
  /** Réponse en flux (runPromptStream). */
  streaming: boolean;
  /** Cache de contexte serveur (caches.create). Gemini only. */
  contextCache: boolean;
  /** Compréhension d'images en entrée. */
  vision: boolean;
  /** Génération d'images. */
  imageGeneration: boolean;
}

/**
 * Backend qui sert les modèles Gemini.
 *
 * `vertex` facture sur Google Cloud et s'authentifie par compte de service ;
 * `ai-studio` facture sur une clé API. Les modèles servis sont les mêmes des
 * deux côtés — c'est bien un choix d'infrastructure, pas de capacités.
 */
export type GeminiBackendMode = 'vertex' | 'ai-studio';

export interface GeminiBackend {
  mode: GeminiBackendMode;
  /** Projet Google Cloud portant la facturation (mode vertex). */
  project?: string;
  /** Région Vertex, ou `global`. */
  location: string;
  /** Compte de service signant les appels : celui de Firebase (mode vertex). */
  credentials?: { client_email: string; private_key: string };
  /** Clé AI Studio (mode ai-studio). */
  apiKey?: string;
}

export interface ProviderDefinition {
  /** Quelle famille d'adaptateur pilote ce fournisseur. */
  kind: ProviderKind;
  /** Nom de la variable d'environnement contenant la clé API. */
  apiKeyEnv: string;
  /** URL de base (fournisseurs openai-compatible uniquement). */
  baseUrl?: string;
  /** En-têtes additionnels éventuels (ex: routage passerelle). */
  defaultHeaders?: Record<string, string>;
  /** Modèle de repli propre au fournisseur (optionnel). */
  fallbackModel?: string;
  /** Backend résolu (fournisseurs `gemini` uniquement). Rempli par `getProvider`. */
  backend?: GeminiBackend;
  /**
   * Champs de corps supplémentaires ajoutés à CHAQUE requête chat.completions du
   * fournisseur (hors contrat OpenAI standard). Ex: GLM/Z.ai accepte
   * `thinking: { type: 'disabled' }` — indispensable car le raisonnement des
   * modèles GLM consomme le budget `max_tokens` (calibré pour Gemini) et renvoie
   * sinon un `content` vide sur les prompts lourds (logo, SVG…).
   */
  extraBody?: Record<string, unknown>;
  capabilities: ProviderCapabilities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend Gemini — LE SEUL BLOC À MODIFIER pour changer d'infrastructure.
//
// Rien d'autre dans le code ne lit ces variables ni ne construit de client :
// `config/google-genai.client.ts` se contente d'exécuter ce qui est déclaré ici,
// et les services demandent le client à cette fabrique. Une prochaine bascule
// (autre région, autre projet, retour AI Studio, futur backend) se joue donc
// dans ce fichier seul.
// ─────────────────────────────────────────────────────────────────────────────

/** Mode par défaut : Vertex, pour que la consommation soit facturée sur GCP. */
const DEFAULT_GEMINI_MODE: GeminiBackendMode = 'vertex';

/**
 * Région par défaut.
 *
 * `global` route la requête vers la région disponible la plus proche : c'est ce
 * qui donne la meilleure résilience et la meilleure couverture de modèles.
 * Contrepartie assumée : l'endpoint global ne sert pas le cache de contexte —
 * `contextCache` est donc déclaré faux plus bas quand cette valeur est active,
 * et les appels concernés repartent en inline (voir `geminiCapabilities`).
 */
const DEFAULT_GEMINI_LOCATION = 'global';

/** Régions sans cache de contexte. `global` est la seule aujourd'hui. */
const LOCATIONS_WITHOUT_CONTEXT_CACHE = ['global'];

const trimmed = (value?: string): string | undefined => {
  const result = value?.trim();
  return result ? result : undefined;
};

let geminiBackend: GeminiBackend | undefined;

/**
 * Backend Gemini résolu depuis l'environnement.
 *
 * Résolution PARESSEUSE et mémorisée : les secrets sont chargés par
 * `loadSecrets()` au démarrage, donc après l'import de ce module. Lire
 * `process.env` au niveau du module donnerait des valeurs vides.
 */
export function getGeminiBackend(): GeminiBackend {
  if (geminiBackend) {
    return geminiBackend;
  }

  const mode: GeminiBackendMode =
    trimmed(process.env.GEMINI_BACKEND)?.toLowerCase() === 'ai-studio'
      ? 'ai-studio'
      : DEFAULT_GEMINI_MODE;

  // Identité et projet : ceux de Firebase. Un projet Firebase EST un projet
  // Google Cloud, donc le compte de service déjà configuré pour l'Admin SDK
  // signe aussi les appels Vertex. Pas de second compte à créer, pas de second
  // secret à faire tourner. Il lui faut seulement le rôle `roles/aiplatform.user`
  // (voir docs/VERTEX_AI.md).
  const clientEmail = trimmed(process.env.FIREBASE_CLIENT_EMAIL);
  // `secrets.normalize()` a déjà déséchappé les \n, mais la variable peut aussi
  // arriver d'ailleurs (docker-compose, CI) : on reste tolérant.
  const privateKey = trimmed(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  geminiBackend = {
    mode,
    project: trimmed(process.env.FIREBASE_PROJECT_ID),
    location: trimmed(process.env.GOOGLE_CLOUD_LOCATION) ?? DEFAULT_GEMINI_LOCATION,
    ...(clientEmail && privateKey
      ? { credentials: { client_email: clientEmail, private_key: privateKey } }
      : {}),
    apiKey: trimmed(process.env.GEMINI_API_KEY),
  };

  return geminiBackend;
}

/** Réinitialise le backend mémorisé. Réservé aux tests. */
export function resetGeminiBackend(): void {
  geminiBackend = undefined;
}

/** Le backend actif est-il utilisable ? */
export function isGeminiConfigured(): boolean {
  const backend = getGeminiBackend();

  // En mode Vertex il faut le projet ET l'identité Firebase qui le signe : sans
  // les deux, l'appel partirait sans authentification utilisable.
  return backend.mode === 'vertex'
    ? Boolean(backend.project && backend.credentials)
    : Boolean(backend.apiKey);
}

/** Description lisible du backend actif, pour les logs et les messages d'erreur. */
export function describeGeminiBackend(): string {
  const backend = getGeminiBackend();

  if (backend.mode === 'ai-studio') {
    return `AI Studio (clé API${backend.apiKey ? '' : ' MANQUANTE'})`;
  }

  const auth = backend.credentials
    ? `compte de service Firebase (${backend.credentials.client_email})`
    : 'IDENTITÉ MANQUANTE (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)';

  const cache = providerSupportsContextCache() ? '' : ', sans cache de contexte';

  return `Vertex AI (projet=${backend.project ?? 'MANQUANT'}, région=${backend.location}, auth=${auth}${cache})`;
}

/**
 * Le backend actif sert-il le cache de contexte ?
 *
 * Déclaré plutôt que découvert : sans cela chaque appel tenterait un
 * `caches.create` voué à échouer, avalé par son `catch`. Le coût serait un
 * aller-retour inutile par génération et une cause invisible dans les logs.
 */
function providerSupportsContextCache(): boolean {
  const backend = getGeminiBackend();
  return (
    backend.mode !== 'vertex' || !LOCATIONS_WITHOUT_CONTEXT_CACHE.includes(backend.location)
  );
}

const ALL_CAPABILITIES: ProviderCapabilities = {
  tools: true,
  grounding: true,
  streaming: true,
  contextCache: true,
  vision: true,
  imageGeneration: true,
};

/**
 * Le registre. Ajouter un fournisseur = ajouter une entrée ici + définir sa clé
 * d'env. Rien d'autre à changer côté code.
 */
export const AI_PROVIDERS: Record<LLMProvider, ProviderDefinition> = {
  [LLMProvider.GEMINI]: {
    kind: 'gemini',
    // Le client `gemini` est construit par `config/google-genai.client.ts` et
    // vise Vertex AI par défaut (facturation Google Cloud, authentification par
    // compte de service). `apiKeyEnv` ne sert donc que si `GEMINI_BACKEND` est
    // repassé sur `ai-studio`.
    apiKeyEnv: 'GEMINI_API_KEY',
    capabilities: { ...ALL_CAPABILITIES },
  },

  // GLM (Zhipu / Z.ai) — le fournisseur de la plateforme. API
  // OpenAI-compatible pour le texte, endpoints dédiés pour la recherche web et
  // la génération d'image (cf. GLM_ENDPOINTS).
  [LLMProvider.GLM]: {
    kind: 'openai-compatible',
    apiKeyEnv: 'GLM_API_KEY',
    // ⚠️ Endpoint OpenAI-compatible de Z.ai = `/api/paas/v4` (et NON `/api/openai/v1`,
    // qui renvoie un faux HTTP 200 `{code:500, msg:"404 NOT_FOUND"}`).
    baseUrl: process.env.GLM_API_URL || 'https://api.z.ai/api/paas/v4',
    fallbackModel: GLM_MODELS.writing,
    // Raisonnement coupé PAR DÉFAUT : il se décompte du budget de sortie, et
    // sur une réponse courte il le consommait entièrement — la réponse
    // revenait vide. L'étage S le rallume explicitement, avec le budget qui va
    // avec (cf. model-router.ts).
    extraBody: { thinking: { type: 'disabled' } },
    capabilities: {
      tools: true,
      // Recherche web par l'endpoint `/web_search` de Z.ai, et non par un
      // outil intégré au modèle : c'est un appel à part, avec ses sources.
      grounding: true,
      streaming: true,
      // Z.ai n'expose pas de cache de contexte serveur.
      contextCache: false,
      vision: true,
      imageGeneration: true,
    },
  },

  [LLMProvider.CHATGPT]: {
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENAI_API_KEY',
    // baseUrl omis → défaut du SDK OpenAI (api.openai.com).
    capabilities: {
      tools: true,
      grounding: false,
      streaming: true,
      contextCache: false,
      vision: true,
      imageGeneration: false,
    },
  },

  [LLMProvider.DEEPSEEK]: {
    kind: 'openai-compatible',
    // Historique : la clé DeepSeek transitait par OPENROUTER_API_KEY.
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    capabilities: {
      tools: true,
      grounding: false,
      streaming: true,
      contextCache: false,
      vision: false,
      imageGeneration: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GABARIT — futur modèle IDEM auto-hébergé.
  // Décommenter + ajouter `IDEM = 'IDEM'` à l'enum LLMProvider (ai.config.ts),
  // puis pointer les features voulues dessus. Aucun autre code à écrire :
  //
  // [LLMProvider.IDEM]: {
  //   kind: 'openai-compatible',
  //   apiKeyEnv: 'IDEM_LLM_API_KEY',
  //   baseUrl: process.env.IDEM_LLM_URL, // ex: http://vllm.internal:8000/v1
  //   capabilities: { tools: true, grounding: false, streaming: true,
  //                   contextCache: false, vision: false, imageGeneration: false },
  // },
  // ─────────────────────────────────────────────────────────────────────────
};

/**
 * Endpoints Z.ai qui ne relèvent pas du contrat OpenAI : la recherche web et
 * la génération d'image ont leurs propres routes, avec leurs propres corps de
 * requête. Le client OpenAI ne sait pas les appeler — on passe par HTTP.
 */
export const GLM_ENDPOINTS = {
  get base(): string {
    return process.env.GLM_API_URL || 'https://api.z.ai/api/paas/v4';
  },
  get webSearch(): string {
    return `${GLM_ENDPOINTS.base}/web_search`;
  },
  get images(): string {
    return `${GLM_ENDPOINTS.base}/images/generations`;
  },
};

/** Clé Z.ai, ou `undefined` si le fournisseur n'est pas configuré. */
export function getGlmApiKey(): string | undefined {
  return process.env.GLM_API_KEY || undefined;
}

/** Retourne la définition d'un fournisseur (throw si inconnu). */
export function getProvider(provider: LLMProvider): ProviderDefinition {
  const def = AI_PROVIDERS[provider];
  if (!def) {
    throw new Error(`Fournisseur IA inconnu dans le registre: ${provider}`);
  }

  // Certaines capacités de Gemini dépendent du backend choisi, pas du modèle :
  // l'endpoint `global` ne sert pas le cache de contexte. Résolu ici pour que
  // tout le code passe par le même garde-fou `providerSupports`.
  if (def.kind === 'gemini') {
    return {
      ...def,
      backend: getGeminiBackend(),
      capabilities: { ...def.capabilities, contextCache: providerSupportsContextCache() },
    };
  }

  return def;
}

/** Indique si un fournisseur supporte une capacité donnée. */
export function providerSupports(
  provider: LLMProvider,
  capability: keyof ProviderCapabilities
): boolean {
  // Passe par getProvider : les capacités de Gemini varient selon le backend.
  return AI_PROVIDERS[provider] ? Boolean(getProvider(provider).capabilities[capability]) : false;
}

/**
 * Interrupteur global (test A/B). Si `AI_DEFAULT_PROVIDER` est défini, il
 * remplace le fournisseur (et `AI_DEFAULT_MODEL` le modèle) de TOUTE config qui
 * passe par le choke point texte — permet de faire tourner idem entièrement sur
 * un fournisseur sans éditer chaque feature. Les cas image/grounding ne passent
 * pas par ce chemin et restent donc sur Gemini.
 *
 * Sans variable d'env, renvoie la config inchangée (comportement par défaut).
 */
export function resolveGlobalOverride<T extends Pick<FeatureAIConfig, 'provider' | 'modelName'>>(
  config: T
): T {
  const overrideProvider = process.env.AI_DEFAULT_PROVIDER as LLMProvider | undefined;
  if (!overrideProvider || !AI_PROVIDERS[overrideProvider]) {
    return config;
  }
  const overrideModel = process.env.AI_DEFAULT_MODEL;
  return {
    ...config,
    provider: overrideProvider,
    ...(overrideModel ? { modelName: overrideModel } : {}),
  };
}
