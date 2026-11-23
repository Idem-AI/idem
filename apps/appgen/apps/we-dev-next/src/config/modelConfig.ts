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
  /** Qui sert l'appel : OpenRouter, ou nos machines (passerelle d'idem-ml). */
  backend: 'openrouter' | 'idem-ml';
}

// ── OpenRouter ou nos machines (idem-ml) ────────────────────────────────────
//
// Même réglage que l'API (`apps/api/api/config/ai-backend.config.ts`) : `IDEM_AI_BACKEND_TEXT` › `IDEM_AI_BACKEND`.
// `idem-ml` envoie le code sur la passerelle d'idem-ml (`IDEM_ML_URL`, `IDEM_ML_API_KEY`), qui sert les MÊMES
// identifiants de modèles ; en panne, l'appel repart chez OpenRouter (`IDEM_AI_FALLBACK=off` pour l'interdire).

/** L'adresse de la passerelle, normalisée en `…/v1`. */
export function idemMlBaseUrl(): string | undefined {
  const raw = readEnv('IDEM_ML_URL')?.replace(/\/+$/, '');
  if (!raw) return undefined;
  return /\/v1$/.test(raw) ? raw : `${raw}/v1`;
}

export function textBackend(): 'openrouter' | 'idem-ml' {
  const raw = (readEnv('IDEM_AI_BACKEND_TEXT') ?? readEnv('IDEM_AI_BACKEND') ?? '').toLowerCase();
  const wanted = ['idem-ml', 'idem_ml', 'selfhosted', 'self-hosted'].includes(raw);
  return wanted && idemMlBaseUrl() && readEnv('IDEM_ML_API_KEY') ? 'idem-ml' : 'openrouter';
}

/** Les identifiants d'OpenRouter (repli de la passerelle), ou `undefined` sans clé ou repli coupé. */
export function openRouterFallbackCredentials(): ModelCredentials | undefined {
  const flag = (readEnv('IDEM_AI_FALLBACK') ?? 'openrouter').toLowerCase();
  const apiKey = readEnv(OPENROUTER_ENDPOINT.apiKeyEnv);
  if (flag === 'off' || flag === 'none' || !apiKey) return undefined;
  return { apiKey, apiUrl: readEnv(OPENROUTER_ENDPOINT.apiUrlEnv) ?? OPENROUTER_ENDPOINT.defaultApiUrl, backend: 'openrouter' };
}

/**
 * Le catalogue exposé à l'interface — modèles OUVERTS, servis par OpenRouter, ou par
 * nos machines avec `IDEM_AI_BACKEND=idem-ml` (passerelle d'idem-ml, mêmes identifiants). Mêmes identifiants exacts et licences vérifiés côté API
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

/**
 * UN SEUL MODÈLE (18/11/2026, décision produit) : le moins cher et le plus rapide entre Qwen, DeepSeek et GLM, aux
 * poids ouverts — DeepSeek V4.1 Flash 1017 (MIT). Mesuré le 18/11/2026 sur le moteur de sites : 1,5 s pour une
 * section, sans invention ; sortie à 0,07 $/M chez l'hébergeur le moins cher ; lit les images ; coupe son
 * raisonnement à la demande (GLM-5.3-Flash l'impose). Le cran de créativité ne change PLUS le modèle : il choisit
 * des gabarits plus premium dans le catalogue (idem-templates, champ `tier`).
 *
 * La résilience vient des hébergeurs : OpenRouter sert ce modèle chez plus de 40 fournisseurs et bascule de l'un à
 * l'autre (`allow_fallbacks`). Changer de modèle : `APPGEN_TEXT_MODEL` (une clé de ce catalogue) ou
 * `POST /api/model/default`.
 */
export const SINGLE_MODEL_KEY = 'deepseek/deepseek-v4.1-flash-1017';

const defaultModelConfigs: ModelConfig[] = [
  {
    ...GENERATION,
    useImage: true,
    modelName: 'DeepSeek V4.1 Flash',
    modelKey: SINGLE_MODEL_KEY,
    description: 'DeepSeek V4.1 Flash 1017 — le modèle unique d’IDEM, poids ouverts (MIT)',
  },
];

// ── Le NIVEAU DE CRÉATIVITÉ ne choisit plus le modèle ──────────────────────
//
// Depuis le 18/11/2026, le cran choisit la gamme des gabarits (catalogue iCode, champ `tier`), jamais le modèle :
// tous les crans partent sur le modèle unique. `APPGEN_CREATIVITY_MODELS` reste lu pour un essai ponctuel.
export const CREATIVITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const;
export type CreativityLevel = (typeof CREATIVITY_LEVELS)[number];

const CREATIVITY_LADDER: Record<CreativityLevel, string> = {
  low: SINGLE_MODEL_KEY,
  medium: SINGLE_MODEL_KEY,
  high: SINGLE_MODEL_KEY,
  ultra: SINGLE_MODEL_KEY,
};

export function normalizeCreativity(value: unknown): CreativityLevel | undefined {
  const v = String(value ?? '').toLowerCase();
  if (v === 'max') return 'high';
  return (CREATIVITY_LEVELS as readonly string[]).includes(v) ? (v as CreativityLevel) : undefined;
}

/** Le modèle d'un niveau de créativité (réglage d'environnement d'abord, puis l'échelle). */
export function modelForCreativity(level: CreativityLevel): string {
  let overrides: Partial<Record<CreativityLevel, string>> = {};
  try {
    overrides = JSON.parse(readEnv('APPGEN_CREATIVITY_MODELS') || '{}');
  } catch {
    overrides = {};
  }
  const wanted = overrides[level] || CREATIVITY_LADDER[level];
  // Un modèle hors catalogue (faute de frappe) : le modèle par défaut, jamais une erreur pour l'utilisateur.
  return isKnown(wanted) ? wanted : getDefaultModelKey();
}

// ── Le fournisseur le plus RAPIDE, toujours ─────────────────────────────────
//
// Chaque appel part chez l'hébergeur au meilleur débit mesuré par OpenRouter (`provider.sort = throughput`), sous un
// plafond de prix qui écarte les paliers « priorité » (`:nitro` les inclut, au double du prix pour le même débit).
// Mesuré le 18/11/2026 sur des textes de section (~300 jetons) : 1,5 s et 0,0004 $, contre 4 à 7 s sans tri.
export const FASTEST_ROUTING = {
  sort: 'throughput',
  /** Dollars par million de jetons. */
  max_price: { prompt: 0.4, completion: 1.5 },
} as const;

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
  return textBackend() === 'idem-ml' || Boolean(readEnv(conf.apiKeyEnv));
}

/** Le catalogue complet, repli inclus — usage interne (résolution, repli). */
export const allModelConfigs: ModelConfig[] = defaultModelConfigs;

/** Le modèle voulu en tête : le choix à chaud, puis la variable d'environnement. */
function preferredKey(): string | undefined {
  const fromEnv = readEnv('APPGEN_TEXT_MODEL') ?? readEnv('APPGEN_DEFAULT_MODEL');
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

  if (textBackend() === 'idem-ml') {
    return { apiKey: readEnv('IDEM_ML_API_KEY') as string, apiUrl: idemMlBaseUrl() as string, backend: 'idem-ml' };
  }

  const apiUrl = readEnv(conf.apiUrlEnv) ?? conf.defaultApiUrl ?? '';
  const apiKey = readEnv(conf.apiKeyEnv);

  if (!apiKey) {
    throw new Error(
      `Aucune clé d'API pour le modèle « ${modelKey} ». ` +
        `Renseignez ${conf.apiKeyEnv} dans apps/we-dev-next/.env, puis redémarrez le serveur.`,
    );
  }

  return { apiKey, apiUrl, backend: 'openrouter' };
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
