export enum LLMProvider {
  GEMINI = 'GEMINI',
  CHATGPT = 'CHATGPT',
  DEEPSEEK = 'DEEPSEEK',
  // GLM-5.2 (Zhipu / Z.ai), via API OpenAI-compatible — voir ai-providers.config.ts.
  GLM = 'GLM',
}
// Test trigger: API deployment pipeline (Update 2)

export interface LLMOptions {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface FeatureAIConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  promptType?: string;
}

export const AI_CONFIG = {
  // Global / default settings
  default: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
  } as FeatureAIConfig,

  // Fallback settings
  fallback: {
    textModel: 'gemini-2.5-flash',
    imageModel: 'gemini-3-pro-image',
  },


  // Onboarding service configurations
  // gemini-2.5-flash : modèle rapide pour la génération des questions et le
  // parsing des réponses lors de la création de projet (chat + formulaire).
  onboarding: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    } as FeatureAIConfig,
    parseAnswer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    } as FeatureAIConfig,
  },

  // Business Plan service configuration
  // [Migration GLM-5.2] Ancienne valeur: { GEMINI, 'gemini-3-flash-preview' }.
  // Note: research-team (rédacteur) réutilise cette config → passe aussi sur GLM ;
  // le chercheur (grounding Google Search) reste figé Gemini.
  businessPlan: {
    provider: LLMProvider.GLM,
    modelName: 'glm-5.2',
  } as FeatureAIConfig,

  // Pitch Deck service configuration
  // [Migration GLM-5.2] Ancienne valeur: { GEMINI, 'gemini-3-flash-preview' }.
  pitchDeck: {
    provider: LLMProvider.GLM,
    modelName: 'glm-5.2',
  } as FeatureAIConfig,

  // Advisor service configuration
  // [Migration GLM-5.2] Ancienne valeur: { GEMINI, 'gemini-3-flash-preview' }.
  // GLM supporte le function-calling → la boucle Context Engine tourne sur GLM.
  advisor: {
    provider: LLMProvider.GLM,
    modelName: 'glm-5.2',
    promptType: 'advisor',
  } as FeatureAIConfig,

  // Legal Docs service configuration
  // [Migration GLM-5.2] Ancienne valeur: { GEMINI, 'gemini-3-flash-preview' }.
  legalDocs: {
    provider: LLMProvider.GLM,
    modelName: 'glm-5.2',
  } as FeatureAIConfig,

  // Deployment configurations
  deployment: {
    terraform: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'terraform_tfvars_generation',
      llmOptions: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    } as FeatureAIConfig,
    chat: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      llmOptions: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    } as FeatureAIConfig,
  },

  // Finance configurations
  // [Migration GLM-5.2] Ancienne valeur de chaque clé: { GEMINI, 'gemini-3-flash-preview' }.
  finance: {
    autofill: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      promptType: 'finance',
      llmOptions: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    } as FeatureAIConfig,
    intent: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      promptType: 'finance',
      llmOptions: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    } as FeatureAIConfig,
    pdfCover: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      promptType: 'finance-cover-generation',
      llmOptions: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    } as FeatureAIConfig,
    pdfInterpretation: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      promptType: 'finance-pdf-interpretation',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 1500,
      },
    } as FeatureAIConfig,
  },

  // Communication configurations
  communication: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
    } as FeatureAIConfig,
    trends: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'communication_trends',
      llmOptions: {
        maxOutputTokens: 800,
      },
    } as FeatureAIConfig,
    flyer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'communication_flyer',
      llmOptions: {
        maxOutputTokens: 2000,
      },
    } as FeatureAIConfig,
    imageSourcing: {
      imageModel: 'gemini-3.1-flash-image',
      visionModel: 'gemini-2.5-flash',
    },
  },

  // Branding configurations
  // Génération de logos (SVG) : GLM-5.2 configuré pour une qualité vectorielle maximale
  // (budget de tokens étendu à 12000 et température optimisée à 0.35 pour la précision géométrique).
  branding: {
    brandIdentity: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      llmOptions: {
        maxOutputTokens: 12000,
        temperature: 0.35,
        topP: 0.9,
        topK: 40,
      },
    } as FeatureAIConfig,
    logo: {
      provider: LLMProvider.GLM,
      modelName: 'glm-5.2',
      llmOptions: {
        maxOutputTokens: 12000,
        temperature: 0.35,
        topP: 0.9,
        topK: 40,
      },
    } as FeatureAIConfig,
    colors: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-flash-lite',
      llmOptions: {
        maxOutputTokens: 1200,
        temperature: 0.05,
        topP: 0.8,
        topK: 20,
      },
    } as FeatureAIConfig,
    typography: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-flash-lite',
      llmOptions: {
        maxOutputTokens: 1800,
        temperature: 0.3,
        topP: 0.8,
        topK: 20,
      },
    } as FeatureAIConfig,
    logoAnalysis: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      llmOptions: {
        maxOutputTokens: 2000,
        temperature: 0.2,
      },
    } as FeatureAIConfig,
    mockupHtml: {
      modelName: 'gemini-3.5-flash',
    },
    brandMockup: {
      imageModel: 'gemini-3.1-flash-image',
    },
  },
};
