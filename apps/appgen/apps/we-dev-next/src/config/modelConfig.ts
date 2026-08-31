// Test trigger: AppGen deployment pipeline (Update 2)
interface ModelConfig {
  modelName: string;
  modelKey: string;
  useImage: boolean;
  description?: string;
  iconUrl?: string;
  provider?: string;
  apiKey?: string;
  apiUrl?: string;
  functionCall: boolean;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
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
    modelName: 'GLM 5.3',
    modelKey: 'glm-5.3',
    useImage: false,
    provider: 'glm',
    description: 'GLM 5.3 — génération de code et appels d\'outils',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
    // Z.ai sert un endpoint OpenAI-compatible ; les identifiants lui sont
    // propres et ne passent donc pas par les THIRD_API_* génériques.
    apiUrl: process.env.GLM_API_URL || 'https://api.z.ai/api/paas/v4',
    apiKey: process.env.GLM_API_KEY,
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

export const modelConfig: ModelConfig[] = defaultModelConfigs;
