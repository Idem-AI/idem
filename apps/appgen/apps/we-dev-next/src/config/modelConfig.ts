interface ModelConfig {
  modelName: string;
  modelKey: string;
  useImage: boolean;
  description?: string;
  iconUrl?: string;
  provider?: string;
  functionCall: boolean;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  // Les identifiants ne sont pas stockés ici : seulement le *nom* des variables
  // qui les portent. Lire `process.env` au niveau module se ferait pendant la
  // phase d'import, donc avant le `dotenv.config()` de server.ts, et figerait
  // la clé à `undefined` pour toute la durée du process. La résolution est donc
  // repoussée à l'appel, dans `resolveModelCredentials`.
  apiKeyEnv?: string;
  apiUrlEnv?: string;
  defaultApiUrl?: string;
  /**
   * Proposé dans le sélecteur de l'interface. `false` = présent dans la chaîne
   * de repli mais jamais offert au choix : un modèle de secours n'est pas une
   * option produit.
   */
  selectable?: boolean;
}

/** Ce que l'on sert à l'interface : le catalogue *sans* les identifiants. */
export type PublicModelConfig = Omit<
  ModelConfig,
  'apiKeyEnv' | 'apiUrlEnv' | 'defaultApiUrl'
>;

export interface ModelCredentials {
  apiKey: string;
  apiUrl: string;
}

/**
 * Le catalogue exposé à l'interface — modèles OUVERTS, tous servis par OpenRouter
 * (poids publiés : auto-hébergeables plus tard en changeant seulement
 * `OPENROUTER_BASE_URL`). Mêmes identifiants exacts et licences vérifiés côté API
 * IDEM (`config/openrouter.config.ts`).
 *
 * Ajouter une entrée ici suffit à la faire apparaître — c'est cette liste que sert
 * `/api/model/config`, et sa première entrée sélectionnable qui devient le défaut.
 * Température de précision : c'est du code — imports valides, JSX équilibré, hooks
 * corrects, la bonne réponse est unique et une température haute y produit des
 * bugs, pas de la créativité. La créativité attendue est VISUELLE, et elle ne
 * vient pas de l'échantillonnage : elle vient du design system calculé
 * (tokenForge), de la direction artistique tirée par projet et des skills routés.
 */
const OPENROUTER_ENDPOINT = {
  apiKeyEnv: 'OPENROUTER_API_KEY',
  apiUrlEnv: 'OPENROUTER_BASE_URL',
  defaultApiUrl: 'https://openrouter.ai/api/v1',
} as const;

const GENERATION = {
  useImage: false,
  functionCall: true,
  temperature: 0.35,
  topP: 0.9,
  // Sans budget, celui du fournisseur n'est pas garanti et peut tronquer une
  // génération longue en plein artefact.
  maxOutputTokens: 32000,
  provider: 'openrouter',
  ...OPENROUTER_ENDPOINT,
} as const;

const defaultModelConfigs: ModelConfig[] = [
  {
    ...GENERATION,
    modelName: 'Qwen3 Coder Next',
    modelKey: 'qwen/qwen3-coder-next',
    description: 'Qwen3 Coder Next — code et agents, poids ouverts (Apache-2.0)',
  },
  {
    // ALTERNATIVE À TESTER face à Qwen3 Coder Next. Il n'existe plus de « DeepSeek
    // Coder » sur OpenRouter : le code est servi par DeepSeek V4 (MIT, poids ouverts).
    ...GENERATION,
    modelName: 'DeepSeek V4 Flash',
    modelKey: 'deepseek/deepseek-v4-flash',
    description: 'DeepSeek V4 Flash — alternative open-weight (MIT) pour le code',
  },
  {
    // REPLI. La saturation est PAR MODÈLE : sans second modèle, la chaîne de
    // `resilientStream.ts` — détection du transitoire, bascule, message
    // utilisateur — n'aurait nulle part où basculer, et toute panne du modèle
    // principal deviendrait une panne du produit. Repli d'infrastructure, pas une
    // option offerte à l'utilisateur.
    ...GENERATION,
    modelName: 'Qwen3.5 122B',
    modelKey: 'qwen/qwen3.5-122b-a10b',
    description: 'Qwen3.5 122B A10B — repli lorsque le modèle principal est saturé',
    selectable: false,
  },
];

// ── Modèle par défaut, modifiable À CHAUD ───────────────────────────────────
//
// Départ : `APPGEN_DEFAULT_MODEL` (une clé du catalogue), sinon la première entrée
// sélectionnable. Ensuite : `POST /api/model/default` (cf. routes/model.ts) change
// le modèle par défaut sans redémarrage. L'état vit en mémoire de l'instance : avec
// plusieurs instances, appeler chacune, ou fixer la variable d'environnement.
let chosenModelKey: string | undefined;

function isKnown(modelKey: string | undefined): modelKey is string {
  return Boolean(modelKey && defaultModelConfigs.some((item) => item.modelKey === modelKey));
}

export function getCatalogKeys(): string[] {
  return defaultModelConfigs.filter((item) => item.selectable !== false).map((item) => item.modelKey);
}

/** `undefined` rétablit la variable d'environnement. Renvoie `false` si la clé est inconnue. */
export function setDefaultModelKey(modelKey: string | undefined): boolean {
  if (modelKey !== undefined && !isKnown(modelKey)) return false;
  chosenModelKey = modelKey;
  return true;
}

/** Le modèle a-t-il de quoi répondre (clé présente) ? Un modèle sans clé n'est jamais proposé. */
function hasCredentials(conf: ModelConfig): boolean {
  return Boolean(readEnv(conf.apiKeyEnv));
}

/** Le catalogue complet, repli inclus — usage interne (résolution, repli). */
export const allModelConfigs: ModelConfig[] = defaultModelConfigs;

/** Le modèle voulu en tête : le choix à chaud, puis la variable d'environnement. */
function preferredKey(): string | undefined {
  const fromEnv = readEnv('APPGEN_DEFAULT_MODEL');
  if (isKnown(chosenModelKey)) return chosenModelKey;
  return isKnown(fromEnv) ? fromEnv : undefined;
}

/**
 * Les modèles dans l'ordre d'essai : le modèle choisi d'abord, puis le reste du
 * catalogue. Sans aucune clé, le catalogue entier (l'erreur nommera la variable
 * manquante).
 */
function orderedConfigs(): ModelConfig[] {
  const head = preferredKey();
  const ranked = [
    ...defaultModelConfigs.filter((item) => item.modelKey === head),
    ...defaultModelConfigs.filter((item) => item.modelKey !== head),
  ];
  const usable = ranked.filter(hasCredentials);
  return usable.length > 0 ? usable : ranked;
}

/** Le modèle proposé par défaut : le choix à chaud, sinon le premier sélectionnable. */
export function getDefaultModelKey(): string {
  const first = orderedConfigs().find((item) => item.selectable !== false);
  return (first ?? defaultModelConfigs[0])?.modelKey;
}

/**
 * Ordre de repli quand un modèle est indisponible.
 *
 * Le modèle demandé par le client passe en tête SAUF si un choix à chaud est en
 * vigueur : une bascule n'aurait aucun effet si l'interface, qui a mémorisé une
 * ancienne clé, la réimposait à chaque requête.
 */
export function getFallbackModelKeys(preferred?: string): string[] {
  const configured = orderedConfigs().map(({ modelKey }) => modelKey);
  const keys =
    !isKnown(chosenModelKey) && isKnown(preferred) && configured.includes(preferred) ? [preferred] : [];

  for (const modelKey of configured) {
    if (!keys.includes(modelKey)) {
      keys.push(modelKey);
    }
  }

  return keys;
}

/** Une variable d'environnement vide vaut absente : `""` n'est pas une clé. */
function readEnv(name?: string): string | undefined {
  if (!name) return undefined;
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Résout les identifiants d'un modèle, à l'appel et non à l'import.
 *
 * Un modèle sans clé échoue en nommant la variable à renseigner, plutôt qu'avec
 * un « Authentication Failed » opaque très loin de la vraie cause.
 */
export function resolveModelCredentials(modelKey: string): ModelCredentials {
  const conf = defaultModelConfigs.find((item) => item.modelKey === modelKey);

  if (!conf) {
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  const apiUrl = readEnv(conf.apiUrlEnv) ?? conf.defaultApiUrl ?? '';
  const apiKey = readEnv(conf.apiKeyEnv);

  if (!apiKey) {
    throw new Error(
      `Aucune clé d'API pour le modèle « ${modelKey} ». ` +
        `Renseignez ${conf.apiKeyEnv} dans apps/we-dev-next/.env, puis redémarrez le serveur.`,
    );
  }

  return { apiKey, apiUrl };
}

/**
 * Le catalogue public. Sert `/api/model/config`, donc part vers le navigateur :
 * il ne doit contenir aucun identifiant.
 */
export function getPublicModelConfig(): PublicModelConfig[] {
  return orderedConfigs()
    .filter((model) => model.selectable !== false)
    .map(({ apiKeyEnv, apiUrlEnv, defaultApiUrl, ...pub }) => pub);
}
