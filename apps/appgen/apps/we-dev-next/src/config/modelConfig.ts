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

const defaultModelConfigs: ModelConfig[] = [
  {
    modelName: 'gemini-3.5-flash',
    modelKey: 'gemini-3.5-flash',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3.5 Flash model',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
  },
  {
    modelName: 'gemini-3.6-flash',
    modelKey: 'gemini-3.6-flash',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3.6 Flash model',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
  },
  {
    modelName: 'gemini-3.1-pro-preview',
    modelKey: 'gemini-3.1-pro-preview',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3 Pro model',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
  },
  {
    modelName: 'gemini-3-flash-preview',
    modelKey: 'gemini-3-flash-preview',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3 Flash model (faster)',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
  },
];

export function getDefaultModelKey(): string {
  const fallbackModel = defaultModelConfigs[0]?.modelKey;

  return fallbackModel;
}

/**
 * Ordre de repli quand un modèle Gemini renvoie 503 « this model is currently
 * experiencing high demand » : la requête est valide, c'est la capacité du
 * modèle qui manque, et les pools sont PAR MODÈLE — réessayer le même ne sert
 * à rien, il faut basculer. Ordre = qualité décroissante / disponibilité
 * croissante (aligné sur les chaînes de apps/api).
 */
const GEMINI_FALLBACK_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
];

/**
 * Liste ordonnée des modèles à essayer pour une requête : celui demandé en
 * tête, puis la chaîne de repli. Les modèles absents de `modelConfig` sont
 * ignorés (impossible d'instancier un client sans leur configuration), et tout
 * modèle configuré hors chaîne est ajouté en dernier recours.
 */
export function getFallbackModelKeys(preferredKey?: string): string[] {
  const configured = new Set(defaultModelConfigs.map(({ modelKey }) => modelKey));
  const keys = preferredKey ? [preferredKey] : [];

  for (const modelKey of [...GEMINI_FALLBACK_CHAIN, ...configured]) {
    if (configured.has(modelKey) && !keys.includes(modelKey)) {
      keys.push(modelKey);
    }
  }

  return keys;
}

export const modelConfig: ModelConfig[] = defaultModelConfigs;
