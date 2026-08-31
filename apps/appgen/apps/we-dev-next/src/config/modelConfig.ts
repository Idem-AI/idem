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
    temperature: 0.7,
    topP: 0.95,
    // Z.ai sert un endpoint OpenAI-compatible ; les identifiants lui sont
    // propres et ne passent donc pas par les THIRD_API_* génériques.
    apiKeyEnv: 'GLM_API_KEY',
    apiUrlEnv: 'GLM_API_URL',
    defaultApiUrl: 'https://api.z.ai/api/paas/v4',
  },
];

/** Premier de la liste : le modèle proposé par défaut à l'ouverture. */
export function getDefaultModelKey(): string {
  return defaultModelConfigs[0]?.modelKey;
}

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
  return defaultModelConfigs.map(({ apiKeyEnv, apiUrlEnv, defaultApiUrl, ...pub }) => pub);
}

export const modelConfig: PublicModelConfig[] = getPublicModelConfig();
