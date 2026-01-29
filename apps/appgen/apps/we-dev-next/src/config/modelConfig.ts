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
    modelName: 'gemini-3-pro-preview',
    modelKey: 'gemini-3-pro-preview',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3 Pro model',
    functionCall: true,
    temperature: 0.7,
    topP: 0.95,
  },
];

export function getDefaultModelKey(): string {
  const fallbackModel = defaultModelConfigs[0]?.modelKey;

  return fallbackModel;
}

export const modelConfig: ModelConfig[] = defaultModelConfigs;
