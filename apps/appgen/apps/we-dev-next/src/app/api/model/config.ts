// Model configuration file
// Configure models based on actual scenarios and environment variables

interface ModelConfig {
  modelName: string;
  modelKey: string;
  useImage: boolean;
  description?: string;
  iconUrl?: string;
  provider?: string; // Model provider
  apiKey?: string;
  apiUrl?: string;
  functionCall: boolean;
}

// Default model configurations
const defaultModelConfigs: ModelConfig[] = [
  {
    modelName: 'gemini-3-pro-preview',
    modelKey: 'gemini-3-pro-preview',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 3 Pro model',
    functionCall: true,
  }
];

// Function to parse model configurations from environment variable
function parseModelConfigs(): ModelConfig[] {
  const envModels = process.env.AI_MODELS_CONFIG;

  if (!envModels) {
    console.log('No AI_MODELS_CONFIG found, using default models');
    return defaultModelConfigs;
  }

  try {
    const parsedModels = JSON.parse(envModels) as ModelConfig[];

    // Validate that parsed models have required fields
    const validModels = parsedModels.filter(
      (model) =>
        model.modelName &&
        model.modelKey &&
        model.provider &&
        typeof model.useImage === 'boolean' &&
        typeof model.functionCall === 'boolean'
    );

    if (validModels.length === 0) {
      console.warn('No valid models found in AI_MODELS_CONFIG, using defaults');
      return defaultModelConfigs;
    }

    console.log(`Loaded ${validModels.length} models from environment configuration`);
    return validModels;
  } catch (error) {
    console.error('Error parsing AI_MODELS_CONFIG:', error);
    console.log('Falling back to default model configuration');
    return defaultModelConfigs;
  }
}

// Get default model key from environment or use fallback
export function getDefaultModelKey(): string {
  const envDefaultModel = process.env.AI_DEFAULT_MODEL;

  if (envDefaultModel) {
    // Verify that the default model exists in the configuration
    const modelExists = modelConfig.some((model) => model.modelKey === envDefaultModel);
    if (modelExists) {
      console.log(`Using default model from environment: ${envDefaultModel}`);
      return envDefaultModel;
    } else {
      console.warn(`Default model ${envDefaultModel} not found in configuration, using fallback`);
    }
  }

  // Fallback to first available model
  const fallbackModel = modelConfig[0]?.modelKey || 'gemini-3-pro-preview';
  console.log(`Using fallback default model: ${fallbackModel}`);
  return fallbackModel;
}

// Export the model configuration (parsed from env or defaults)
export const modelConfig: ModelConfig[] = parseModelConfigs();
