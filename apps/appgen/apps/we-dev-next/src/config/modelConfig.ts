// Test trigger: AppGen deployment pipeline (Update 2)
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
 * Le catalogue exposé à l'interface.
 *
 * Un seul modèle : les autres ne sont pas encore ouverts, et les proposer dans
 * la liste reviendrait à laisser choisir ce qui échouera ensuite. Ajouter une
 * entrée ici suffit à la faire apparaître — c'est cette liste que sert
 * `/api/model/config`, et sa première entrée qui devient le défaut.
 */
const defaultModelConfigs: ModelConfig[] = [
  {
    modelName: 'GLM 5.2',
    modelKey: 'glm-5.2',
    useImage: false,
    provider: 'glm',
    description: 'GLM 5.2 — génération de code et appels d\'outils',
    functionCall: true,
    // ⚠️ RÉGIME DE PRÉCISION, PAS DE DIVERGENCE.
    //
    // La température était à 0.7 pour produire du React de production. Or du
    // code relève de la précision : imports valides, JSX équilibré, hooks
    // corrects — la bonne réponse est unique, et une température haute y produit
    // des bugs, pas de la créativité. Le constat est déjà écrit côté API
    // (ai.config.ts, « une température haute y produit une géométrie fausse, un
    // JSON cassé […] elle FAIT BAISSER la qualité »).
    //
    // La créativité attendue ici est VISUELLE, et elle ne vient pas de
    // l'échantillonnage : elle vient du design system calculé (tokenForge), de
    // la direction artistique tirée par projet et des skills routés.
    temperature: 0.35,
    topP: 0.9,
    // Était absent : le budget retombait sur le défaut du fournisseur, qui n'est
    // pas garanti et peut tronquer une génération longue en plein artefact.
    maxOutputTokens: 32000,
    // Z.ai sert un endpoint OpenAI-compatible ; les identifiants lui sont
    // propres et ne passent donc pas par les THIRD_API_* génériques.
    apiKeyEnv: 'GLM_API_KEY',
    apiUrlEnv: 'GLM_API_URL',
    defaultApiUrl: 'https://api.z.ai/api/paas/v4',
  },
  {
    // REPLI. La saturation est PAR MODÈLE chez Z.ai : sans second modèle, les
    // 318 lignes de `resilientStream.ts` — détection du transitoire, bascule,
    // message utilisateur — n'avaient nulle part où basculer, et toute panne du
    // modèle principal devenait une panne du produit.
    modelName: 'GLM 5.3 Flash',
    modelKey: 'glm-5.3-flash',
    useImage: false,
    provider: 'glm',
    description: 'GLM 5.3 Flash — repli lorsque GLM 5.2 est saturé',
    functionCall: true,
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 32000,
    // Repli d'infrastructure, pas une option offerte à l'utilisateur : il
    // n'apparaît pas dans le sélecteur de modèles.
    selectable: false,
    apiKeyEnv: 'GLM_API_KEY',
    apiUrlEnv: 'GLM_API_URL',
    defaultApiUrl: 'https://api.z.ai/api/paas/v4',
  },
  {
    // OPENROUTER — modèles OUVERTS (poids publics, Apache-2.0), auto-hébergeables
    // plus tard en ne changeant que OPENROUTER_BASE_URL. Mêmes identifiants
    // exacts et licences vérifiés côté API IDEM (config/openrouter.config.ts).
    // Température de précision : c'est du code, cf. le commentaire de GLM 5.2.
    modelName: 'Qwen3 Coder Next',
    modelKey: 'qwen/qwen3-coder-next',
    useImage: false,
    provider: 'openrouter',
    description: 'Qwen3 Coder Next — code et agents, poids ouverts (Apache-2.0)',
    functionCall: true,
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 32000,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiUrlEnv: 'OPENROUTER_BASE_URL',
    defaultApiUrl: 'https://openrouter.ai/api/v1',
  },
  {
    // ALTERNATIVE À TESTER face à Qwen3 Coder Next. Il n'existe plus de « DeepSeek
    // Coder » sur OpenRouter : le code est servi par DeepSeek V4 (MIT, poids ouverts).
    modelName: 'DeepSeek V4 Flash',
    modelKey: 'deepseek/deepseek-v4-flash',
    useImage: false,
    provider: 'openrouter',
    description: 'DeepSeek V4 Flash — alternative open-weight (MIT) pour le code',
    functionCall: true,
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 32000,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiUrlEnv: 'OPENROUTER_BASE_URL',
    defaultApiUrl: 'https://openrouter.ai/api/v1',
  },
  {
    // REPLI d'OpenRouter : autre famille de poids (MoE généraliste), pas dans le sélecteur.
    modelName: 'Qwen3.5 122B',
    modelKey: 'qwen/qwen3.5-122b-a10b',
    useImage: false,
    provider: 'openrouter',
    description: 'Qwen3.5 122B A10B — repli lorsque Qwen3 Coder Next est saturé',
    functionCall: true,
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 32000,
    selectable: false,
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiUrlEnv: 'OPENROUTER_BASE_URL',
    defaultApiUrl: 'https://openrouter.ai/api/v1',
  },
];

/** Le catalogue complet, repli inclus — usage interne (résolution, repli). */
export const allModelConfigs: ModelConfig[] = defaultModelConfigs;

// ── Fournisseur actif, modifiable À CHAUD ───────────────────────────────────
//
// Départ : `APPGEN_MODEL_PROVIDER` (glm | openrouter), sinon `glm`. Ensuite :
// `POST /api/model/switch` (cf. routes/model.ts) change le fournisseur sans
// redémarrage. L'état vit en mémoire de l'instance : avec plusieurs instances,
// appeler chacune, ou fixer la variable d'environnement.
export type ModelProvider = 'glm' | 'openrouter';
export const MODEL_PROVIDERS: readonly ModelProvider[] = ['glm', 'openrouter'];

function parseProvider(value: unknown): ModelProvider | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (MODEL_PROVIDERS as readonly string[]).includes(normalized)
    ? (normalized as ModelProvider)
    : undefined;
}

let activeProvider: ModelProvider | undefined;

export function getActiveProvider(): ModelProvider {
  return activeProvider ?? parseProvider(process.env.APPGEN_MODEL_PROVIDER) ?? 'glm';
}

/** `undefined` rétablit la variable d'environnement. */
export function setActiveProvider(provider: ModelProvider | undefined): void {
  activeProvider = provider;
}

/** Le modèle a-t-il de quoi répondre (clé présente) ? Un modèle sans clé n'est jamais proposé. */
function hasCredentials(conf: ModelConfig): boolean {
  return Boolean(readEnv(conf.apiKeyEnv ?? 'THIRD_API_KEY'));
}

/**
 * Les modèles dans l'ordre d'essai : ceux du fournisseur actif d'abord, puis
 * l'autre en dernier recours — une panne d'un fournisseur ne devient pas une
 * panne du produit. Sans aucune clé, le catalogue entier (l'erreur nommera la
 * variable manquante).
 */
function orderedConfigs(): ModelConfig[] {
  const active = getActiveProvider();
  const ranked = [
    ...defaultModelConfigs.filter((item) => item.provider === active),
    ...defaultModelConfigs.filter((item) => item.provider !== active),
  ];
  const usable = ranked.filter(hasCredentials);
  return usable.length > 0 ? usable : ranked;
}

/** Le modèle proposé par défaut : le premier sélectionnable du fournisseur actif. */
export function getDefaultModelKey(): string {
  const first = orderedConfigs().find((item) => item.selectable !== false);
  return (first ?? defaultModelConfigs[0])?.modelKey;
}

/**
 * Ordre de repli quand un modèle est indisponible.
 *
 * Le modèle demandé par le client passe en tête SAUF s'il appartient à l'autre
 * fournisseur : une bascule n'aurait aucun effet si l'interface, qui a mémorisé
 * « glm-5.2 », le réimposait à chaque requête.
 */
export function getFallbackModelKeys(preferredKey?: string): string[] {
  const configured = orderedConfigs().map(({ modelKey }) => modelKey);
  const preferred = defaultModelConfigs.find((item) => item.modelKey === preferredKey);
  const keys =
    preferred && preferred.provider === getActiveProvider() && configured.includes(preferred.modelKey)
      ? [preferred.modelKey]
      : [];

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
 * Un modèle qui déclare son propre `apiKeyEnv` ne retombe jamais sur les
 * THIRD_API_* : envoyer la clé d'un autre fournisseur à Z.ai ne produit qu'un
 * « Authentication Failed » opaque, très loin de la vraie cause. Mieux vaut
 * échouer en nommant la variable à renseigner.
 */
export function resolveModelCredentials(modelKey: string): ModelCredentials {
  const conf = defaultModelConfigs.find((item) => item.modelKey === modelKey);

  if (!conf) {
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  const apiUrl = readEnv(conf.apiUrlEnv) ?? conf.defaultApiUrl ?? readEnv('THIRD_API_URL') ?? '';
  const apiKey = conf.apiKeyEnv
    ? readEnv(conf.apiKeyEnv)
    : readEnv('THIRD_API_KEY');

  if (!apiKey) {
    const varName = conf.apiKeyEnv ?? 'THIRD_API_KEY';
    throw new Error(
      `Aucune clé d'API pour le modèle « ${modelKey} » (fournisseur : ${conf.provider ?? 'third-party'}). ` +
        `Renseignez ${varName} dans apps/we-dev-next/.env, puis redémarrez le serveur.`,
    );
  }

  return { apiKey, apiUrl };
}

/**
 * Le catalogue public. Sert `/api/model/config`, donc part vers le navigateur :
 * il ne doit contenir aucun identifiant.
 */
export function getPublicModelConfig(): PublicModelConfig[] {
  const active = getActiveProvider();
  const offered = orderedConfigs().filter(
    (model) => model.selectable !== false && model.provider === active
  );
  // Aucun modèle sélectionnable chez le fournisseur actif : on montre le reste.
  const list = offered.length > 0 ? offered : orderedConfigs().filter((m) => m.selectable !== false);
  return list.map(({ apiKeyEnv, apiUrlEnv, defaultApiUrl, ...pub }) => pub);
}
