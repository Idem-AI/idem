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
 * Ordered list of models to try for a single request: the requested one first,
 * then the other configured ones. Gemini answers 503 ("this model is currently
 * experiencing high demand") during spikes, so a generation that would die on
 * one model can land on a sibling instead of failing in the user's face.
 */
export function getFallbackModelKeys(preferredKey?: string): string[] {
  const keys = preferredKey ? [preferredKey] : [];

  for (const { modelKey } of defaultModelConfigs) {
    if (!keys.includes(modelKey)) {
      keys.push(modelKey);
    }
  }

  return keys;
}

export const modelConfig: ModelConfig[] = defaultModelConfigs;
