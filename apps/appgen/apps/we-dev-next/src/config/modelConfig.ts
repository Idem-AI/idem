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
    modelName: 'GLM 4.7',
    modelKey: 'glm-4.7',
    useImage: false,
    provider: 'glm',
    description: 'GLM 4.7 — repli lorsque GLM 5.2 est saturé',
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
];

/** Premier de la liste : le modèle proposé par défaut à l'ouverture. */
export function getDefaultModelKey(): string {
  return defaultModelConfigs[0]?.modelKey;
}

/** Le catalogue complet, repli inclus — usage interne (résolution, repli). */
export const allModelConfigs: ModelConfig[] = defaultModelConfigs;

/**
 * Ordre de repli quand un modèle est indisponible. Avec un seul modèle ouvert,
 * la chaîne se réduit à lui : la fonction reste en place pour que l'ajout d'un
 * second modèle n'ait rien d'autre à changer.
 */
export function getFallbackModelKeys(preferredKey?: string): string[] {
  const configured = defaultModelConfigs.map(({ modelKey }) => modelKey);
  const keys = preferredKey && configured.includes(preferredKey) ? [preferredKey] : [];

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
  return defaultModelConfigs
    .filter((model) => model.selectable !== false)
    .map(({ apiKeyEnv, apiUrlEnv, defaultApiUrl, ...pub }) => pub);
}

export const modelConfig: PublicModelConfig[] = getPublicModelConfig();
