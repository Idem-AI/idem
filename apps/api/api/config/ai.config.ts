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
  /**
   * Budget de raisonnement Gemini, en tokens. `0` DÉSACTIVE le « thinking »,
   * `-1` le laisse automatique (défaut du modèle).
   *
   * À poser à 0 sur toute génération MÉCANIQUE — classification, extraction,
   * reformulation, petit JSON de brief. Deux gains, pas un :
   *  - le prix : on cesse de facturer des tokens de raisonnement pour une tâche
   *    qui n'en tire rien ;
   *  - la FIABILITÉ : le raisonnement est décompté de `maxOutputTokens`, donc
   *    sur un petit budget (256, 400…) il consommait tout et la réponse
   *    revenait vide ou tronquée. Ces appels échouaient en silence, chacun
   *    derrière son propre repli heuristique.
   *
   * ⚠️ Réglage propre à la famille Gemini 2.5 : les modèles 3.x pilotent leur
   * raisonnement par `thinkingLevel` et n'acceptent pas de budget nul. Le
   * drapeau n'est donc transmis QUE lorsque le modèle réellement appelé le
   * supporte (cf. `PromptService._runGeminiPrompt`) — sur un autre modèle il
   * est ignoré, jamais une cause d'erreur. Une feature qui déclare
   * `thinkingBudget: 0` doit épingler un modèle 2.5 pour que ce soit effectif.
   */
  thinkingBudget?: number;
}

/**
 * Étage de modèle (cf. `model-router.ts`).
 *
 * Déclaré ici et non dans le routeur pour que `ai.config.ts` reste la feuille
 * du graphe d'imports : le routeur dépend de cette config, jamais l'inverse.
 *
 *   XS — mécanique (résumé, vérification, classification)
 *   M  — rédaction
 *   S  — raisonnement
 */
export type ModelTier = 'XS' | 'M' | 'S';

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
  /**
   * Route cette section vers un étage de modèle plutôt que vers le modèle de la
   * feature. Sert à ne pas payer le tarif « raisonnement » pour une section dont
   * le travail est de la mise en page ou de la reformulation.
   *
   * Prioritaire sur `modelName` de la feature, dominé par un `modelName` déclaré
   * sur la section elle-même (échappatoire explicite).
   */
  tier?: ModelTier;
}

export interface FeatureAIConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  promptType?: string;
  fallbackModels?: string[];
  /** Étage par défaut de la feature — même sémantique que sur une section. */
  tier?: ModelTier;
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
    // L'étage n'est PAS résolu ici (ce fichier ne connaît pas le routeur) : il
    // est propagé tel quel, `applyTier` le traduit en modèle au moment de l'appel.
    // Un `modelName` déclaré sur la section est une décision explicite : elle
    // annule l'étage, sinon le routeur écraserait le choix de l'auteur.
    tier: section.modelName ? undefined : (section.tier ?? feature.tier),
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
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-pro'
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
    imageModel: 'gemini-2.5-flash-image',
  },

  // Onboarding service configurations
  // gemini-2.5-flash : modèle rapide pour la génération des questions et le
  // parsing des réponses lors de la création de projet (chat + formulaire).
  // Raisonnement DÉSACTIVÉ des deux côtés : poser la question suivante et lire
  // une réponse sont des tâches de forme, pas de fond.
  onboarding: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 2048,
        thinkingBudget: 0,
      },
    } as FeatureAIConfig,
    parseAnswer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.1,
        // 256 tokens ne laissaient AUCUNE place au raisonnement, qui est
        // décompté du même budget : l'appel revenait vide dès que le modèle
        // décidait de réfléchir. Sans raisonnement, 256 suffisent largement.
        maxOutputTokens: 256,
        thinkingBudget: 0,
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
      // `tier: 'M'` — c'est de la mise en page à partir d'éléments déjà connus
      // (nom, marque, couleurs) : le modèle de raisonnement n'y apporte rien.
      'Cover Page': { tier: 'M', llmOptions: { maxOutputTokens: 9000, temperature: 0.6 } },
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
      // Jalons et annexes : restructuration de matière déjà produite en amont
      // (elles reçoivent les digests des sections dont elles dépendent).
      'Goal Planning': { tier: 'M', llmOptions: { maxOutputTokens: 14000, temperature: 0.5 } },
      Appendix: { tier: 'M', llmOptions: { maxOutputTokens: 12000, temperature: 0.45 } },
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
      // Slide d'ouverture : c'est la première impression, on lui laisse de la
      // marge — mais le travail est de la composition, pas du raisonnement.
      Cover: { tier: 'M', llmOptions: { maxOutputTokens: 12000, temperature: 0.7 } },
      Problem: { llmOptions: { maxOutputTokens: 12000, temperature: 0.62 } },
      Solution: { llmOptions: { maxOutputTokens: 13000, temperature: 0.62 } },
      // Chiffres de marché : structure dense (TAM/SAM/SOM), créativité inutile.
      Market: { llmOptions: { maxOutputTokens: 15000, temperature: 0.4, topP: 0.88 } },
      Product: { llmOptions: { maxOutputTokens: 14000, temperature: 0.6 } },
      'Business Model': { llmOptions: { maxOutputTokens: 14000, temperature: 0.45 } },
      Traction: { llmOptions: { maxOutputTokens: 12000, temperature: 0.45 } },
      // Tableau comparatif : beaucoup de cellules pour peu de mots.
      Competition: { llmOptions: { maxOutputTokens: 15000, temperature: 0.45 } },
      // Trombinoscope : mise en page de données fournies, aucun arbitrage.
      Team: { tier: 'M', llmOptions: { maxOutputTokens: 11000, temperature: 0.55 } },
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
    // Détection d'intention : de la classification. Aucun raisonnement à payer,
    // et 1024 tokens redeviennent un budget de sortie plein plutôt qu'un budget
    // partagé avec la réflexion.
    intent: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance',
      llmOptions: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        thinkingBudget: 0,
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
  //
  // ⚠️ PRIORITÉ QUALITÉ & CRÉATIVITÉ > VITESSE (choix produit assumé).
  //
  // Tous les modèles employés ici sont « thinking » : leurs tokens de
  // raisonnement sont décomptés de `maxOutputTokens`. Un budget serré n'ampute
  // donc pas d'abord la sortie mais la RÉFLEXION — la composition retombe sur
  // le réflexe « photo plein cadre + titre + logo » bien avant que la
  // troncature ne devienne visible. Les budgets ci-dessous laissent
  // délibérément de la marge au raisonnement AVANT la production.
  //
  // Chaque entrée porte aussi sa chaîne de repli : Google renvoie 503 « high
  // demand » PAR MODÈLE, et une génération de visuel qui échoue faute de
  // second choix est perçue comme une panne du produit.
  communication: {
    default: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
    } as FeatureAIConfig,
    // Extraction du contexte de marque : lecture et reformulation d'un projet
    // existant, aucune création — modèle SANS raisonnement.
    context: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_context',
      llmOptions: {
        maxOutputTokens: 2500,
        temperature: 0.2,
        thinkingBudget: 0,
      },
    } as FeatureAIConfig,
    // Signaux de tendance : restitution de ce que le modèle sait déjà d'un
    // secteur, en 3 à 5 lignes. De la mémoire, pas du raisonnement.
    trends: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_trends',
      llmOptions: {
        maxOutputTokens: 2000,
        temperature: 0.5,
        thinkingBudget: 0,
      },
    } as FeatureAIConfig,
    // Stratégie éditoriale : c'est la matière dont dérivent le calendrier PUIS
    // les visuels. Une stratégie plate produit des visuels plats.
    strategy: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_strategy',
      llmOptions: {
        maxOutputTokens: 16000,
        temperature: 0.7,
        topP: 0.95,
        topK: 50,
      },
    } as FeatureAIConfig,
    // Calendrier : 12 à 20 idées de contenu distinctes en un seul JSON. Le
    // volume de sortie ET l'exigence de non-répétition justifient le modèle de
    // raisonnement et une température haute.
    calendar: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_calendar',
      llmOptions: {
        maxOutputTokens: 20000,
        temperature: 0.8,
        topP: 0.95,
        topK: 64,
      },
    } as FeatureAIConfig,
    // Brief d'image : deux phrases et une orientation. Le raisonnement n'y
    // apportait rien mais consommait tout le budget (400 tokens à l'origine),
    // d'où des réponses vides et un repli silencieux sur la requête
    // heuristique — donc des photos hors sujet. Modèle sans raisonnement,
    // budget confortable : l'appel redevient fiable ET moins cher.
    imageBrief: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-2.5-flash',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_image_brief',
      llmOptions: {
        maxOutputTokens: 1200,
        temperature: 0.7,
        thinkingBudget: 0,
      },
    } as FeatureAIConfig,
    // Composition du visuel — la tâche la plus exigeante du module : le modèle
    // doit tenir une graine de design, une image analysée, une charte de marque
    // et sortir un bloc HTML/Tailwind complet sur UNE seule ligne.
    // ⚠️ NE PAS RÉDUIRE maxOutputTokens : le raisonnement de direction
    // artistique (choix d'archétype, calage typographique, contrastes) pèse ici
    // plus lourd que le HTML lui-même.
    flyer: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_flyer',
      llmOptions: {
        maxOutputTokens: 48000,
        // 0.8 est le plafond raisonnable : au-delà, la créativité gagnée se
        // paie en JSON malformé (le HTML voyage dans une chaîne JSON, une
        // guillemet mal échappée perd toute la génération). La diversité des
        // compositions vient d'abord de la graine de design tirée au sort
        // côté service, pas de la température.
        temperature: 0.8,
        topP: 0.97,
        topK: 64,
      },
    } as FeatureAIConfig,
    momentSuggestions: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_moment_suggestions',
      llmOptions: {
        maxOutputTokens: 5000,
        temperature: 0.7,
      },
    } as FeatureAIConfig,
    // Contenu d'un moment : la légende est publiée telle quelle par
    // l'utilisateur — c'est de l'écriture, pas du remplissage de gabarit.
    moment: {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3.1-pro-preview',
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_moment',
      llmOptions: {
        maxOutputTokens: 8000,
        temperature: 0.75,
        topP: 0.95,
        topK: 50,
      },
    } as FeatureAIConfig,
    // Image de fond du visuel : génération (modèle image) puis scan de vision
    // (sujet, humeur, couleurs dominantes, zones vides) qui nourrit ensuite la
    // composition. Les replis sont déclarés ICI plutôt que déduits de
    // `AI_CONFIG.fallback` : ce module doit pouvoir changer de modèle image
    // sans embarquer le repli texte global, et l'inverse.
    imageSourcing: {
      imageModel: 'gemini-3.1-flash-image',
      imageFallbackModel: 'gemini-3-pro-image',
      visionModel: 'gemini-2.5-flash',
      // `gemini-2.0-flash` a été retiré ici : Vertex ne le sert plus (404
      // « Publisher model ... was not found »), le repli vision était donc
      // garanti perdant et l'analyse retombait sur `fallbackAnalysis`.
      visionFallbackModel: 'gemini-3-flash-preview',
      /**
       * Budget du scan de vision. Le JSON d'analyse tient en ~150 tokens, mais
       * le modèle est « thinking » : à 256 tokens le raisonnement épuisait le
       * budget et la réponse revenait vide, la pipeline retombant en silence
       * sur une analyse neutre (`fallbackAnalysis`). Le visuel était alors
       * composé à l'aveugle sur sa propre image — couleurs et zones de texte
       * choisies au hasard.
       */
      visionMaxOutputTokens: 1500,
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
        'Brand Header': { llmOptions: { maxOutputTokens: 24000, temperature: 0.4 } },
        // Rendu du logo principal en HTML/SVG : la pièce maîtresse de la page.
        'Logo Principal': { llmOptions: { maxOutputTokens: 20000, temperature: 0.3 } },
        'Logo Variation Fond Clair': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        'Logo Variation Fond Sombre': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        'Logo Variation Monochrome': { llmOptions: { maxOutputTokens: 16000, temperature: 0.28 } },
        // Règles d'usage : du texte structuré, peu de balisage.
        'Logo Bonnes Pratiques': { llmOptions: { maxOutputTokens: 24000, temperature: 0.4 } },
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
      imageModel: 'gemini-2.5-flash-image',
    },
  },
};
