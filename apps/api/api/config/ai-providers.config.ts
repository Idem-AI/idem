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

import { LLMProvider, FeatureAIConfig, GLM_MODELS, TEXT_FALLBACK_MODELS } from './ai.config';

export type ProviderKind = 'gemini' | 'openai-compatible';

/**
 * RÔLE d'un modèle, indépendamment du fournisseur qui le sert.
 *
 * C'est la clé de la portabilité. Une feature déclare `GLM_MODELS.reasoning` ;
 * ce qui compte n'est pas le nom, c'est le rôle — « le modèle qui raisonne ».
 * Changer de fournisseur devient alors une traduction de rôles, et non une
 * réécriture de quarante configurations.
 *
 * Sans cette table, l'interrupteur global `AI_DEFAULT_PROVIDER` changeait le
 * fournisseur SANS traduire le nom du modèle : Gemini recevait « glm-4.7 » et
 * répondait 404. Il fallait alors fixer `AI_DEFAULT_MODEL`, ce qui écrasait
 * TOUS les étages avec un seul modèle — le routeur XS/M/S disparaissait au
 * moment précis où l'on voulait le tester.
 */
export type ModelRole =
  | 'mechanical'
  | 'writing'
  | 'reasoning'
  | 'vision'
  | 'image'
  | 'ocr';

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
  /**
   * Modèle servant chaque RÔLE chez ce fournisseur.
   *
   * C'est la table de traduction : elle permet de basculer la plateforme d'un
   * fournisseur à l'autre en gardant le routage par étage et les choix
   * par-feature. Chaque entrée est surchargeable par variable d'environnement
   * (`IDEM_<PROVIDER>_<ROLE>_MODEL`), pour ajuster sans redéploiement.
   */
  models?: Partial<Record<ModelRole, string>>;
  /**
   * Chaîne de repli appliquée aux appels de CE fournisseur qui n'en déclarent
   * aucune. C'est une propriété du FOURNISSEUR, jamais d'une famille de modèles.
   *
   * Le garde-fou vivait auparavant dans `prompt.service.ts` sous la forme
   * « si le fournisseur est Gemini, appliquer TEXT_FALLBACK_MODELS ». La
   * migration vers GLM a rempli cette constante de modèles GLM sans toucher à
   * la condition, si bien que le filet faisait l'inverse de ce qu'il annonçait :
   * les appels Gemini recevaient une chaîne de noms que Vertex ne connaît pas
   * (404 garantis, latence perdue, cause réelle masquée) et les appels GLM
   * n'avaient plus aucun repli — un 429 perdait l'étape.
   *
   * Déclaré ici, le repli suit le fournisseur : une prochaine bascule ne
   * pourra plus le désaligner.
   */
  defaultFallbackModels?: string[];
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

/**
 * Traduit « pas de raisonnement » dans le dialecte du modèle Gemini appelé.
 *
 * Une seule intention côté configuration — `thinkingBudget: 0`, posé par
 * l'étage XS et par toute génération mécanique — et TROIS contrats côté Google,
 * vérifiés par appel réel :
 *
 *   famille 2.5   `thinkingConfig: { thinkingBudget: 0 }`        ✔
 *   3.x flash     `thinkingConfig: { thinkingLevel: 'minimal' }` ✔
 *                 (`thinkingBudget: 0` → 400 INVALID_ARGUMENT)
 *   3.x pro       `thinkingConfig: { thinkingLevel: 'low' }`     ✔
 *                 (`minimal` → 400 « not supported for this model »,
 *                  `thinkingBudget: 0` → 400 « only works in thinking mode »)
 *
 * Pourquoi cela compte, et pas seulement pour le prix : les tokens de réflexion
 * se décomptent de `maxOutputTokens`. Mesuré sur `gemini-3.6-flash` avec un
 * budget de 8 tokens, la réflexion en consomme 5 et la réponse revient VIDE —
 * pas une erreur, pas une troncature visible : rien. C'est la panne que
 * `MIN_TOKENS_FOR_THINKING` documente pour GLM, à l'identique.
 *
 * Un modèle inconnu ne reçoit AUCUN réglage : ignorer une consigne d'économie
 * est bénin, envoyer un argument que le modèle refuse casse la génération.
 */
export function buildGeminiThinkingConfig(
  modelName: string,
  thinkingBudget: number | undefined
): Record<string, unknown> {
  if (thinkingBudget === undefined) return {};

  // Budget négatif = « laisse le modèle décider » : on ne transmet rien.
  if (thinkingBudget < 0) return {};

  if (/gemini-2\.5/i.test(modelName)) {
    return { thinkingConfig: { thinkingBudget } };
  }

  if (/gemini-3/i.test(modelName)) {
    // Seul `0` exprime « coupe le raisonnement ». Un budget positif sur un 3.x
    // n'a pas d'équivalent : on laisse le modèle à son réglage par défaut.
    if (thinkingBudget > 0) return {};
    // `pro` refuse `minimal` ; `low` est son plancher.
    return { thinkingConfig: { thinkingLevel: /pro/i.test(modelName) ? 'low' : 'minimal' } };
  }

  return {};
}

/**
 * Le modèle sait-il RÉELLEMENT ne pas raisonner ?
 *
 * C'est la question qui compte pour l'étage mécanique : un digest, un plan ou
 * une vérification tiennent en un millier de tokens, et si la réflexion se
 * décompte du même budget, la réponse revient vide.
 *
 * Distingue trois cas, vérifiés par appel réel :
 *   · 2.5           — budget nul accepté                       → oui
 *   · 3.x flash     — `thinkingLevel: 'minimal'`, 0 token pensé → oui
 *   · 3.x pro       — plancher `low`, ~90 tokens pensés         → NON
 */
export function canSuppressThinking(modelName: string): boolean {
  if (/gemini-2\.5/i.test(modelName)) return true;
  if (/gemini-3/i.test(modelName)) return !/pro/i.test(modelName);
  // Fournisseurs openai-compatible : le raisonnement se coupe par `extraBody`,
  // pas par ce chemin. On répond « oui » pour ne pas déclencher d'alerte à tort.
  return !/^gemini/i.test(modelName);
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
    /**
     * Famille 2.5, volontairement.
     *
     * C'est la seule dont le code implémente déjà le contrat de raisonnement :
     * `thinkingBudget` en tokens, `0` pour le couper (cf. `supportsThinkingBudget`
     * dans prompt.service). Les modèles 3.x pilotent leur réflexion par
     * `thinkingLevel` et refusent un budget nul — l'étage XS, dont c'est la
     * définition même, se remettrait alors à payer du raisonnement en silence.
     *
     * Passer en 3.x demande donc d'étendre `supportsThinkingBudget` d'abord.
     */
    models: {
      // ⚠️ FAMILLE 3.x — la 2.5 est RETIRÉE aux nouveaux comptes.
      //
      // Vérifié par appel réel (`AI_PROBE=1 npm run check:provider`) :
      // `gemini-2.5-flash` et `gemini-2.5-pro` répondent tous deux 404
      // « no longer available to new users », en renvoyant vers les 3.x.
      //
      // Le choix de chaque rôle tient au RAISONNEMENT, pas à la puissance :
      //
      //   · `flash-lite` ne raisonne pas par défaut — mesuré, il répond même
      //     sur un budget de 8 tokens. C'est le seul profil qui convienne à
      //     l'étage mécanique, dont les appels tiennent en 1 024 tokens ;
      //   · `flash` accepte `thinkingLevel: 'minimal'`, donc le raisonnement y
      //     reste coupable à la demande ;
      //   · `pro` REFUSE de ne pas raisonner (« only works in thinking mode »),
      //     son plancher est `low`. Il ne convient qu'aux rôles où la réflexion
      //     est justement ce qu'on achète.
      //
      // Ne pas remonter `mechanical` sur un `pro` ou un `flash` non-lite : les
      // tokens de réflexion se décomptent du budget de sortie, et un digest à
      // 1 024 tokens reviendrait VIDE.
      mechanical: process.env.IDEM_GEMINI_MECHANICAL_MODEL || 'gemini-3.5-flash-lite',
      writing: process.env.IDEM_GEMINI_WRITING_MODEL || 'gemini-3.6-flash',
      reasoning: process.env.IDEM_GEMINI_REASONING_MODEL || 'gemini-3.1-pro-preview',
      vision: process.env.IDEM_GEMINI_VISION_MODEL || 'gemini-3.6-flash',
      ocr: process.env.IDEM_GEMINI_OCR_MODEL || 'gemini-3.6-flash',
      // `image` n'est PAS déclaré : la génération d'image passe uniquement par
      // les endpoints Z.ai (`glm-media.service`), gardés par `isGlmConfigured`.
      // Déclarer ici un modèle jamais appelé donnerait une fausse assurance.
      ...(process.env.IDEM_GEMINI_IMAGE_MODEL
        ? { image: process.env.IDEM_GEMINI_IMAGE_MODEL }
        : {}),
    },
    // Repli entre modèles GOOGLE : la saturation est par modèle, mais un nom
    // hors catalogue est un 404, pas un repli. Seuls des modèles VÉRIFIÉS
    // disponibles ont leur place ici — d'où la sonde `AI_PROBE=1`.
    defaultFallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
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
    models: {
      mechanical: GLM_MODELS.mechanical,
      writing: GLM_MODELS.writing,
      reasoning: GLM_MODELS.reasoning,
      vision: GLM_MODELS.vision,
      image: GLM_MODELS.image,
      ocr: GLM_MODELS.ocr,
    },
    // Le fournisseur de la plateforme : c'est lui qui doit porter le filet.
    // Une quinzaine de configurations (tout le module Simulation, l'audit de
    // cohérence) ne déclarent aucun repli et étaient donc mono-coup.
    defaultFallbackModels: TEXT_FALLBACK_MODELS,
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
/**
 * Rôle d'un modèle, quel que soit le fournisseur qui le déclare.
 *
 * Recherche inverse dans les tables `models` du registre. Un modèle inconnu est
 * traité comme `writing` : c'est l'étage de rédaction, le défaut le moins
 * surprenant — mieux vaut router une génération inconnue vers le milieu de gamme
 * que vers le haut (coûteux) ou le bas (dégradé).
 */
export function roleOfModel(modelName: string): ModelRole {
  const needle = (modelName || '').toLowerCase();

  for (const definition of Object.values(AI_PROVIDERS)) {
    for (const [role, name] of Object.entries(definition.models ?? {})) {
      if (name && name.toLowerCase() === needle) return role as ModelRole;
    }
  }

  // Modèles hors table (replis gratuits, variantes datées) : on les rattache au
  // rôle que leur nom suggère, plutôt que de les envoyer tous en rédaction.
  if (/pro\b/.test(needle)) return 'reasoning';
  if (/lite|flashx|flash-lite/.test(needle)) return 'mechanical';
  if (/vision|-v\b|4\.6v/.test(needle)) return 'vision';
  if (/image|cogview/.test(needle)) return 'image';
  if (/ocr/.test(needle)) return 'ocr';
  return 'writing';
}

/** Modèle servant un rôle chez un fournisseur, ou `undefined` s'il n'en a pas. */
export function modelForRole(provider: LLMProvider, role: ModelRole): string | undefined {
  return getProvider(provider).models?.[role];
}

/**
 * Interrupteur global (test A/B, bascule de fournisseur).
 *
 * Si `AI_DEFAULT_PROVIDER` est défini, TOUTE configuration passant par le choke
 * point texte est réaiguillée vers ce fournisseur — et son modèle est TRADUIT
 * par RÔLE, pas remplacé par un modèle unique.
 *
 * C'est ce qui distingue une bascule utilisable d'une bascule cosmétique : une
 * section de business plan déclarée sur le modèle de raisonnement reste sur le
 * modèle de raisonnement du nouveau fournisseur, un digest reste mécanique, et
 * le routeur XS/M/S continue de travailler. `AI_DEFAULT_MODEL` reste disponible
 * pour forcer un modèle unique — utile pour isoler un problème, à ne pas
 * employer pour un test de qualité, puisqu'il supprime précisément ce qu'on veut
 * observer.
 *
 * Sans variable d'env, renvoie la config inchangée.
 */
export function resolveGlobalOverride<T extends Pick<FeatureAIConfig, 'provider' | 'modelName'>>(
  config: T
): T {
  const overrideProvider = process.env.AI_DEFAULT_PROVIDER as LLMProvider | undefined;
  if (!overrideProvider || !AI_PROVIDERS[overrideProvider]) {
    return config;
  }
  if (overrideProvider === config.provider) {
    return config;
  }

  // Modèle unique forcé : échappatoire explicite, jamais le chemin nominal.
  const forcedModel = process.env.AI_DEFAULT_MODEL;
  if (forcedModel) {
    return { ...config, provider: overrideProvider, modelName: forcedModel };
  }

  const role = roleOfModel(config.modelName);
  const translated = modelForRole(overrideProvider, role);

  if (!translated) {
    // Le fournisseur cible ne sert pas ce rôle : on ne bascule PAS. Envoyer un
    // nom qu'il ne connaît pas produirait un 404 là où l'appel d'origine
    // aurait abouti.
    return config;
  }

  return { ...config, provider: overrideProvider, modelName: translated };
}
