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

/**
 * Réglages propres à UNE section d'une feature (une section de business plan,
 * un slide de pitch deck…). Tout champ omis retombe sur la config de la feature.
 */
export interface SectionAIConfig {
  provider?: LLMProvider;
  modelName?: string;
  llmOptions?: LLMOptions;
  promptType?: string;
  fallbackModels?: string[];
}

export interface FeatureAIConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  promptType?: string;
  fallbackModels?: string[];
  /**
   * Réglages par section, indexés par le `stepName` EXACT de la section.
   *
   * Un budget unique pour toute une feature est un compromis: il est soit trop
   * court pour la section la plus lourde (plan financier, slide financials →
   * réponse tronquée), soit inutilement large pour les autres. Les modèles
   * utilisés ici sont « thinking » : le raisonnement est décompté de
   * `maxOutputTokens`, donc un budget serré ampute d'abord la réflexion, puis
   * la sortie elle-même — la qualité tombe bien avant que la troncature ne
   * devienne visible.
   */
  sections?: Record<string, SectionAIConfig>;
}

/**
 * Fusionne la config d'une feature avec celle d'une de ses sections.
 *
 * `llmOptions` est fusionné champ par champ (et non remplacé) : une section
 * peut ne redéfinir que `maxOutputTokens` sans perdre la température de la
 * feature. `extraBody` suit la même règle, pour pouvoir activer le raisonnement
 * sur une seule section.
 */
export function resolveSectionConfig(
  feature: FeatureAIConfig,
  sectionName?: string
): FeatureAIConfig {
  const section = sectionName ? feature.sections?.[sectionName] : undefined;

  if (!section) {
    return feature;
  }

  return {
    provider: section.provider ?? feature.provider,
    modelName: section.modelName ?? feature.modelName,
    promptType: section.promptType ?? feature.promptType,
    fallbackModels: section.fallbackModels ?? feature.fallbackModels,
    llmOptions: {
      ...feature.llmOptions,
      ...section.llmOptions,
      ...(feature.llmOptions?.extraBody || section.llmOptions?.extraBody
        ? {
            extraBody: {
              ...feature.llmOptions?.extraBody,
              ...section.llmOptions?.extraBody,
            },
          }
        : {}),
    },
    sections: feature.sections,
  };
}

/**
 * Chaîne de repli standard pour la génération de texte.
 *
 * Ordre = qualité décroissante / disponibilité croissante. Google renvoie 503
 * « high demand » par MODÈLE : rejouer le même ne sert à rien, il faut basculer.
 * Centralisée ici pour qu'une feature ne se retrouve pas sans repli par oubli.
 */
export const TEXT_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
];

export const AI_CONFIG = {
  // Global / default settings
  default: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
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
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    } as FeatureAIConfig,
    parseAnswer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
  // ⚠️ PRIORITÉ QUALITÉ (choix produit). Les sections sortent du HTML + Tailwind
  // minifié sur une seule ligne, et le modèle est « thinking » : le raisonnement
  // consomme le même budget que la sortie. Les valeurs ci-dessous laissent de la
  // marge au raisonnement AVANT la rédaction. Ne pas rabaisser pour gagner du
  // temps : une section tronquée casse le parseur HTML et la section est perdue.
  businessPlan: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3.1-pro-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: {
      maxOutputTokens: 14000,
      temperature: 0.55,
      topP: 0.92,
      topK: 40,
    },
    sections: {
      // Page de garde : peu de contenu, mais la mise en page doit être soignée.
      'Cover Page': { llmOptions: { maxOutputTokens: 9000, temperature: 0.6 } },
      // Synthèse : c'est la section la plus lue, elle doit être dense et juste.
      'Company Summary': { llmOptions: { maxOutputTokens: 16000, temperature: 0.5 } },
      // Sections nourries par la recherche : beaucoup de matière à structurer.
      Opportunity: { llmOptions: { maxOutputTokens: 20000, temperature: 0.5 } },
      'Target Audience': { llmOptions: { maxOutputTokens: 18000, temperature: 0.55 } },
      'Products & Services': { llmOptions: { maxOutputTokens: 18000, temperature: 0.55 } },
      'Marketing & Sales': { llmOptions: { maxOutputTokens: 18000, temperature: 0.6 } },
      // Section la plus lourde : tableaux chiffrés, hypothèses, projections.
      // Température basse : on veut des chiffres cohérents, pas de la créativité.
      'Financial Plan': { llmOptions: { maxOutputTokens: 24000, temperature: 0.3, topP: 0.85 } },
      'Goal Planning': { llmOptions: { maxOutputTokens: 14000, temperature: 0.5 } },
      Appendix: { llmOptions: { maxOutputTokens: 12000, temperature: 0.45 } },
    },
  } as FeatureAIConfig,

  // Pitch Deck service configuration
  // Chaque slide est du HTML + Tailwind autonome. Budgets plus resserrés que le
  // business plan (un slide reste un slide), mais large devant le raisonnement.
  pitchDeck: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3.1-pro-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: {
      maxOutputTokens: 12000,
      temperature: 0.6,
      topP: 0.92,
      topK: 40,
    },
    sections: {
      // Slide d'ouverture : c'est la première impression, on lui laisse de la marge.
      Cover: { llmOptions: { maxOutputTokens: 12000, temperature: 0.7 } },
      Problem: { llmOptions: { maxOutputTokens: 12000, temperature: 0.62 } },
      Solution: { llmOptions: { maxOutputTokens: 13000, temperature: 0.62 } },
      // Chiffres de marché : structure dense (TAM/SAM/SOM), créativité inutile.
      Market: { llmOptions: { maxOutputTokens: 15000, temperature: 0.4, topP: 0.88 } },
      Product: { llmOptions: { maxOutputTokens: 14000, temperature: 0.6 } },
      'Business Model': { llmOptions: { maxOutputTokens: 14000, temperature: 0.45 } },
      Traction: { llmOptions: { maxOutputTokens: 12000, temperature: 0.45 } },
      // Tableau comparatif : beaucoup de cellules pour peu de mots.
      Competition: { llmOptions: { maxOutputTokens: 15000, temperature: 0.45 } },
      Team: { llmOptions: { maxOutputTokens: 11000, temperature: 0.55 } },
      // Projections chiffrées : le slide le plus dense du deck.
      Financials: { llmOptions: { maxOutputTokens: 18000, temperature: 0.3, topP: 0.85 } },
      Ask: { llmOptions: { maxOutputTokens: 11000, temperature: 0.45 } },
    },
  } as FeatureAIConfig,

  // Advisor service configuration
  // Function-calling requis : la boucle Context Engine tourne sur Gemini.
  advisor: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
    promptType: 'advisor',
  } as FeatureAIConfig,

  // Legal Docs service configuration
  legalDocs: {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
  } as FeatureAIConfig,

  // Deployment configurations
  deployment: {
    terraform: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'terraform_tfvars_generation',
      llmOptions: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    } as FeatureAIConfig,
    chat: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance',
      llmOptions: {
        temperature: 0.4,
        maxOutputTokens: 18192,
      },
    } as FeatureAIConfig,
    intent: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance',
      llmOptions: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    } as FeatureAIConfig,
    pdfCover: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance-cover-generation',
      llmOptions: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    } as FeatureAIConfig,
    pdfInterpretation: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
      fallbackModels: TEXT_FALLBACK_MODELS,
    } as FeatureAIConfig,
    trends: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_trends',
      llmOptions: {
        maxOutputTokens: 800,
      },
    } as FeatureAIConfig,
    flyer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      // Priorité à la qualité
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_flyer',
      llmOptions: {
        maxOutputTokens: 32000, // Budget de tokens étendu pour laisser le temps de 'thinking'
        temperature: 0.65, // Température ajustée pour plus de créativité
        topP: 0.95,
        topK: 64,
      },
    } as FeatureAIConfig,
    momentSuggestions: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_moment_suggestions',
      llmOptions: {
        maxOutputTokens: 1200,
      },
    } as FeatureAIConfig,
    moment: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        maxOutputTokens: 12000,
        temperature: 0.35,
        topP: 0.9,
        topK: 40,
      },
      // Sections de la charte graphique (clés = `stepName` de branding.service.ts).
      // Celles qui portent du SVG demandent bien plus de budget que celles qui
      // ne produisent que de la mise en page : un SVG tronqué est inutilisable.
      sections: {
        'Brand Header': { llmOptions: { maxOutputTokens: 10000, temperature: 0.4 } },
        // Rendu du logo principal en HTML/SVG : la pièce maîtresse de la page.
        'Logo Principal': { llmOptions: { maxOutputTokens: 20000, temperature: 0.3 } },
        'Logo Variation Fond Clair': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        'Logo Variation Fond Sombre': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        'Logo Variation Monochrome': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        // Règles d'usage : du texte structuré, peu de balisage.
        'Logo Bonnes Pratiques': { llmOptions: { maxOutputTokens: 10000, temperature: 0.4 } },
        // Nuanciers et spécimens typographiques : beaucoup de petites cellules.
        'Color Palette': { llmOptions: { maxOutputTokens: 14000, temperature: 0.25 } },
        Typography: { llmOptions: { maxOutputTokens: 14000, temperature: 0.3 } },
      },
    } as FeatureAIConfig,
    logo: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
      // La liste était vide : une saturation du modèle faisait échouer l'étape
      // sans seconde chance, alors que le repli ne coûte rien tant qu'il ne sert pas.
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        temperature: 0.05,
        topP: 0.8,
        topK: 20,
      },
    } as FeatureAIConfig,
    typography: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      // La liste était vide : une saturation du modèle faisait échouer l'étape
      // sans seconde chance, alors que le repli ne coûte rien tant qu'il ne sert pas.
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        temperature: 0.3,
        topP: 0.8,
        topK: 20,
      },
    } as FeatureAIConfig,
    logoAnalysis: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
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
      fallbackModels: TEXT_FALLBACK_MODELS,
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
