export enum LLMProvider {
  GEMINI = 'GEMINI',
  CHATGPT = 'CHATGPT',
  DEEPSEEK = 'DEEPSEEK',
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
    imageModel: 'gemini-2.5-flash-image',
  },


  // Onboarding service configurations
  onboarding: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    } as FeatureAIConfig,
    parseAnswer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    } as FeatureAIConfig,
  },

  // Business Plan service configuration
  businessPlan: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
  } as FeatureAIConfig,

  // Pitch Deck service configuration
  pitchDeck: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
  } as FeatureAIConfig,

  // Advisor service configuration
  advisor: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
    promptType: 'advisor',
  } as FeatureAIConfig,

  // Legal Docs service configuration
  legalDocs: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
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
  finance: {
    autofill: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'finance',
      llmOptions: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    } as FeatureAIConfig,
    intent: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'finance',
      llmOptions: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    } as FeatureAIConfig,
    pdfCover: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'finance-cover-generation',
      llmOptions: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    } as FeatureAIConfig,
    pdfInterpretation: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'finance-pdf-interpretation',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 1500,
      },
    } as FeatureAIConfig,
  },

  // Simulation configurations
  // La découverte des facteurs et la Red Team ont besoin de place: ce sont les
  // deux étapes qui produisent des dizaines d'entrées structurées d'un coup.
  simulation: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation',
      llmOptions: { temperature: 0.4, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    understanding: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_understanding',
      llmOptions: { temperature: 0.2, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    factors: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_factors',
      llmOptions: { temperature: 0.5, maxOutputTokens: 32768 },
    } as FeatureAIConfig,
    scenarios: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_scenarios',
      llmOptions: { temperature: 0.5, maxOutputTokens: 16384 },
    } as FeatureAIConfig,
    analysis: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_analysis',
      llmOptions: { temperature: 0.3, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    recommendations: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_recommendations',
      llmOptions: { temperature: 0.4, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    redTeam: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_red_team',
      llmOptions: { temperature: 0.7, maxOutputTokens: 32768 },
    } as FeatureAIConfig,
    customers: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_customers',
      llmOptions: { temperature: 0.5, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    investors: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_investors',
      llmOptions: { temperature: 0.6, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    blackSwan: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_black_swan',
      llmOptions: { temperature: 0.8, maxOutputTokens: 12288 },
    } as FeatureAIConfig,
    universes: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_universes',
      llmOptions: { temperature: 0.7, maxOutputTokens: 8192 },
    } as FeatureAIConfig,
    experiments: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'simulation_experiments',
      llmOptions: { temperature: 0.5, maxOutputTokens: 8192 },
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
      imageModel: 'gemini-2.5-flash-image',
      visionModel: 'gemini-2.0-flash',
    },
  },

  // Branding configurations
  branding: {
    logo: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      llmOptions: {
        maxOutputTokens: 600,
        temperature: 0.5,
        topP: 0.95,
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
    mockupHtml: {
      modelName: 'gemini-3.5-flash',
    },
    brandMockup: {
      imageModel: 'gemini-2.5-flash-image',
    },
  },
};
