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
  /**
   * Champs de corps bruts fusionnés dans la requête du fournisseur, PAR-FEATURE.
   * Ils PRIORISENT sur le `extraBody` par-défaut du provider (ai-providers.config.ts).
   * Usage principal: réactiver le raisonnement GLM sur une génération précise
   * (`{ thinking: { type: 'enabled' } }`) alors qu'il est désactivé globalement.
   * Ignoré par l'adaptateur Gemini natif.
   */
  extraBody?: Record<string, unknown>;
}

export interface FeatureAIConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  promptType?: string;
  fallbackModels?: string[];
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
  // Note: research-team (rédacteur) réutilise cette config ;
  // le chercheur (grounding Google Search) reste figé Gemini.
  businessPlan: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3.1-pro-preview',
    fallbackModels: [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview'
    ],
  } as FeatureAIConfig,

  // Pitch Deck service configuration
  pitchDeck: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3.1-pro-preview',
    fallbackModels: [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview'
    ],
  } as FeatureAIConfig,

  // Advisor service configuration
  // Function-calling requis : la boucle Context Engine tourne sur Gemini.
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
        maxOutputTokens: 18192,
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
    momentSuggestions: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'communication_moment_suggestions',
      llmOptions: {
        maxOutputTokens: 1200,
      },
    } as FeatureAIConfig,
    moment: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'communication_moment',
      llmOptions: {
        maxOutputTokens: 1200,
      },
    } as FeatureAIConfig,
    imageSourcing: {
      imageModel: 'gemini-3.1-flash-image',
      visionModel: 'gemini-2.5-flash',
    },
  },

  // Branding configurations
  // Génération de logos (SVG) : Gemini configuré pour une qualité vectorielle maximale.
  // PRIORITÉ QUALITÉ > VITESSE (choix produit assumé) :
  //  - budget de tokens très large : un SVG complet (paths de letterforms pour les
  //    types "name"/"initial") dépasse facilement 1–2k tokens ; un budget trop court
  //    tronquait le JSON et cassait la génération de ces types.
  //  - température basse : sorties déterministes et géométriquement exactes.
  branding: {
    brandIdentity: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash-preview'
      ],
      llmOptions: {
        maxOutputTokens: 12000,
        temperature: 0.35,
        topP: 0.9,
        topK: 40,
      },
    } as FeatureAIConfig,
    logo: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash-preview'
      ],
      llmOptions: {
        // ⚠️ NE PAS RÉDUIRE. gemini-3-flash-preview est un modèle "thinking" :
        // les tokens de raisonnement sont décomptés de maxOutputTokens. Un SVG de
        // logo complet (types name/initial = paths de letterforms) pèse déjà 2–4k
        // tokens ; raisonnement + SVG sous un budget trop court (ex: 4000) tronque
        // la réponse → JSON cassé → "no usable SVG". Valeur large validée = 24000.
        maxOutputTokens: 24000,
        temperature: 0.28,
        topP: 0.9,
        topK: 40,
      },
    } as FeatureAIConfig,
    colors: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: [
      ],
      llmOptions: {

        temperature: 0.05,
        topP: 0.8,
        topK: 20,
      },
    } as FeatureAIConfig,
    typography: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: [
      ],
      llmOptions: {
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
    // Template de carte de visite : deux faces HTML complètes + concept.
    // ⚠️ NE PAS RÉDUIRE maxOutputTokens. Comme pour le logo, le modèle est
    // « thinking » : les tokens de raisonnement sont décomptés du budget. Deux
    // faces de HTML Tailwind pèsent déjà 2–4k tokens ; sous un budget trop
    // court la réponse est tronquée en plein milieu du HTML et devient
    // illisible côté parseur.
    businessCard: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'],
      llmOptions: {
        maxOutputTokens: 24000,
        temperature: 0.45,
        topP: 0.9,
        topK: 40,
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
