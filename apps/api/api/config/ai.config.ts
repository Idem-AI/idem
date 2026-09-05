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
  /**
   * Exige du FOURNISSEUR une sortie JSON syntaxiquement valide
   * (`response_format: { type: 'json_object' }`).
   *
   * Jusqu'ici le format n'était porté que par le prompt, et la validité
   * rattrapée après coup par quatre fonctions de réparation heuristique
   * (`utils/llm-json.util.ts` : clôtures de bloc, caractères de contrôle dans
   * les chaînes, virgules traînantes). Quand la réparation échoue, ce n'est pas
   * un défaut mineur : c'est la génération ENTIÈRE qui est perdue.
   *
   * C'est le mode d'échec nº1 d'un petit modèle. Un grand modèle produit du JSON
   * valide par habitude ; un petit oublie une virgule, ajoute un commentaire, ou
   * préfixe par « Voici le JSON demandé ». Le fournisseur, lui, contraint le
   * décodage — le format cesse d'être une consigne pour devenir une garantie.
   *
   * ⚠️ Ne PAS activer sur une sortie qui transporte du HTML : là, la bonne
   * réponse est de sortir du JSON (délimiteurs `<html>…</html>`), pas d'y entrer
   * plus fort — l'échappement d'une longue chaîne est lui-même une source
   * d'échec, et il coûte 10 à 15 % de tokens.
   *
   * Le prompt doit continuer à décrire la FORME attendue : `json_object`
   * garantit un JSON valide, pas le bon schéma.
   */
  jsonMode?: boolean;
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
  /** Voir `FeatureAIConfig.pinModel`. */
  pinModel?: boolean;
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
   * `true` : le modèle déclaré est un PLANCHER, on ne tente jamais plus bas.
   *
   * Le routeur annonce « on tente au plus bas, on n'escalade que si le contrôle
   * ÉCHOUE ». Dans les faits, il ne le faisait pas : `agent-runtime` respecte
   * le `baseConfig` de la feature au premier essai, et toutes les générations
   * par sections en fournissent un. Le volume principal partait donc
   * systématiquement au tarif haut, et l'étage n'entrait en jeu qu'en escalade —
   * exactement l'inverse de l'intention.
   *
   * Le défaut est désormais `false` : on part à l'étage de la tâche et on
   * escalade sur échec du contrôle qualité. L'épinglage reste disponible pour
   * les sorties dont l'échec n'est PAS détectable automatiquement — un SVG de
   * logo géométriquement faux passe toutes les grilles, seul un modèle capable
   * de construction paramétrique l'évite.
   */
  pinModel?: boolean;
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
    // Une section qui déclare son propre `modelName` l'a choisi explicitement :
    // elle est donc épinglée de fait, sinon le routeur écraserait sa décision.
    pinModel: section.pinModel ?? (section.modelName ? true : feature.pinModel),
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
 * Catalogue GLM (Zhipu / Z.ai) — la plateforme tourne entièrement dessus.
 *
 * Les identifiants sont ceux de l'API Z.ai (`https://api.z.ai/api/paas/v4`).
 * Réunis ici pour qu'un changement de modèle soit une ligne, et non une
 * fouille dans quarante configurations de features.
 *
 * Tarifs relevés sur docs.z.ai (août 2026), en dollars par million de tokens —
 * ils justifient l'affectation par étage :
 *
 *   glm-4.7-flashx  0,07 / 0,40   mécanique  : résumer, classer, extraire
 *   glm-4.7         0,60 / 2,20   rédaction  : le gros du volume
 *   glm-5.2         1,40 / 4,40   haut de gamme : stratégie, finance, SVG
 *   glm-4.6v        0,30 / 0,90   vision     : lecture d'image
 *   glm-ocr         0,03 / 0,03   OCR        : texte dans une image
 *   glm-image       0,015 / image génération d'image
 *   cogview-4       0,010 / image repli image
 */
export const GLM_MODELS = {
  /** Tâches mécaniques : résumé, vérification, classification, extraction. */
  mechanical: 'glm-4.7-flashx',
  /** Rédaction : le défaut de la plateforme. */
  writing: 'glm-4.7',
  /**
   * Le haut de gamme : stratégie, plan financier, concept de logo, SVG.
   *
   * ⚠️ NE PAS passer sur `glm-5.3` ni `glm-5.3-flash` : ces modèles raisonnent
   * TOUJOURS et refusent `thinking: disabled` par un HTTP 400
   * (« This model always engages in thinking and cannot be disabled »). Laissés
   * à leur raisonnement, ils mettent une minute et rendent une sortie VIDE, le
   * budget de tokens étant intégralement consommé par la réflexion.
   * Mesuré sur une génération de SVG : 5.3 → 59 s et 0 caractère ;
   * 5.2 sans raisonnement → 2,5 s et un SVG complet.
   */
  reasoning: 'glm-5.2',
  /** Compréhension d'image. */
  vision: 'glm-4.6v',
  /** Extraction de texte dans une image. */
  ocr: 'glm-ocr',
  /** Génération d'image, et son repli. */
  image: 'glm-image',
  imageFallback: 'cogview-4-250304',
  /** Moteur de recherche web de Z.ai (endpoint `/web_search`). */
  searchEngine: 'search-prime',
} as const;

/**
 * Chaîne de repli standard pour la génération de texte.
 *
 * Ordre = qualité décroissante / disponibilité croissante. Google renvoie 503
 * « high demand » par MODÈLE : rejouer le même ne sert à rien, il faut basculer.
 * Centralisée ici pour qu'une feature ne se retrouve pas sans repli par oubli.
 */
export const TEXT_FALLBACK_MODELS = [
  GLM_MODELS.writing,
  GLM_MODELS.mechanical,
  GLM_MODELS.reasoning,
  // Derniers recours, gratuits et bridés : mieux vaut une réponse lente qu'une
  // fonctionnalité indisponible.
  'glm-4.7-flash',
  'glm-4.5-flash',
];

/**
 * Profils d'échantillonnage — priorité QUALITÉ, la latence est assumée.
 *
 * « Qualité » n'est pas un curseur unique, et c'est l'erreur qu'on ne veut pas
 * refaire : monter la température partout dégrade autant qu'elle améliore. Deux
 * régimes s'opposent, et une génération relève toujours de l'un ou de l'autre.
 *
 *   DIVERGENCE — concept, direction artistique, composition, rédaction.
 *     Le modèle doit s'écarter de la réponse moyenne. Température et top-p
 *     hauts : c'est là que la créativité se joue.
 *
 *   PRÉCISION — coordonnées SVG, schémas JSON, tableaux de chiffres.
 *     La bonne réponse est unique. Une température haute y produit une
 *     géométrie fausse, un JSON cassé, des chiffres incohérents : elle FAIT
 *     BAISSER la qualité. On la garde donc basse, délibérément.
 *
 * Le levier qui sert les DEUX régimes est ailleurs : le RAISONNEMENT. Il est
 * coupé par défaut chez le fournisseur (cf. ai-providers.config.ts) parce qu'il
 * triple la latence et qu'il se décompte du budget de sortie. Le rallumer est
 * exactement ce qu'on achète en acceptant d'attendre — à condition de doubler
 * le budget de sortie en même temps, sinon la réflexion le consomme et la
 * réponse revient vide. C'est la panne documentée en tête de GLM_MODELS.
 *
 * ⚠️ `topK` n'est PAS transmis à GLM : l'API OpenAI-compatible ne l'expose pas
 * (cf. prompt.service, « Pas de topK dans l'API OpenAI »). Il n'est conservé
 * ici que pour un éventuel retour sur Gemini natif, où il est appliqué. Ne pas
 * compter dessus pour régler la diversité sur la plateforme actuelle : c'est
 * `topP` qui travaille.
 */

/**
 * Budget de sortie en dessous duquel le raisonnement ne laisse plus de place à
 * la réponse.
 *
 * Les tokens de réflexion se décomptent de `max_tokens`. Sous ce seuil, le
 * modèle réfléchit jusqu'à épuisement et renvoie `finish_reason=length` avec un
 * contenu VIDE — pas une erreur, pas une troncature visible : rien. Le repli
 * hérite du même réglage et échoue pareil, si bien que toute la chaîne tombe.
 *
 * Observé en production sur « Logo Critique » : 4 096 tokens hérités d'un
 * appelant qui les avait fixés à une époque où le raisonnement était coupé.
 */
export const MIN_TOKENS_FOR_THINKING = 8000;

/** Exporté pour la vérification de configuration (`npm run check:agents`). */
export const MAX_TEMPERATURE_FOR_THINKING = 0.65;

/**
 * Filet de sécurité : rend impossible la combinaison « raisonnement actif +
 * budget trop court ».
 *
 * Le choix de COUPER le raisonnement plutôt que de gonfler le budget est
 * délibéré. Un appelant qui fixe 4 096 tokens exprime une intention — il attend
 * un petit JSON, pas une dissertation. Gonfler son budget changerait son coût
 * sans son accord et ne garantirait toujours rien ; couper la réflexion lui rend
 * exactement ce qu'il demandait, en un seul appel. La qualité perdue est
 * signalée, elle n'est pas silencieuse.
 *
 * Appliqué au point de passage unique (`PromptService.runPrompt`) plutôt qu'à
 * chaque appelant, où le prochain l'oublierait — comme pour la chaîne de repli.
 */
export function reconcileThinkingBudget(options: LLMOptions): {
  options: LLMOptions;
  downgraded: boolean;
  /** Température écrêtée parce que le raisonnement est actif (cf. plus bas). */
  temperatureClamped?: number;
} {
  const thinking = (options.extraBody as any)?.thinking;
  const thinkingEnabled = thinking?.type === 'enabled';
  const budget = options.maxOutputTokens;

  // ① Raisonnement actif + budget trop court ⇒ on coupe le raisonnement.
  if (thinkingEnabled && budget && budget < MIN_TOKENS_FOR_THINKING) {
    return {
      options: {
        ...options,
        extraBody: { ...options.extraBody, thinking: { type: 'disabled' } },
      },
      downgraded: true,
    };
  }

  // ② Raisonnement actif + température trop haute ⇒ on écrête la température.
  //
  // Ce plafond était DOCUMENTÉ sans être appliqué : seule une vérification
  // manuelle (`npm run check:agents`) le contrôlait, donc une config ajoutée
  // entre deux exécutions du script passait. Or la panne qu'il évite est
  // silencieuse et coûteuse — une réflexion qui diverge remplit l'enveloppe
  // entière et renvoie un contenu VIDE.
  if (
    thinkingEnabled &&
    options.temperature !== undefined &&
    options.temperature > MAX_TEMPERATURE_FOR_THINKING
  ) {
    return {
      options: { ...options, temperature: MAX_TEMPERATURE_FOR_THINKING },
      downgraded: false,
      temperatureClamped: options.temperature,
    };
  }

  return { options, downgraded: false };
}

/** Raisonnement GLM activé — écrase le `thinking: disabled` du fournisseur. */
const THINKING_ON = { thinking: { type: 'enabled' } } as const;

/**
 * ⚠️ PLAFOND DE TEMPÉRATURE SUR UN MODÈLE QUI RAISONNE.
 *
 * Erreur commise puis mesurée en production : avec le raisonnement actif, la
 * température ne s'applique pas qu'à la réponse, elle s'applique AUSSI aux
 * tokens de réflexion. À 0.85, la réflexion part en digression, n'atteint jamais
 * sa conclusion, et consomme l'enveloppe entière — 24 000 tokens brûlés en 97
 * secondes pour une réponse VIDE (finish_reason=length). Augmenter le budget
 * n'y change rien : une réflexion qui ne converge pas remplira n'importe quelle
 * enveloppe.
 *
 * La divergence vient donc du RAISONNEMENT et des contraintes du prompt (le
 * catalogue de styles, la graine de composition, les interdits), pas d'un
 * échantillonnage chaud. Au-delà de ~0.65 sur un modèle « thinking », on
 * n'achète plus de créativité, on achète de l'incohérence — puis du vide.
 *
 * Ce plafond est désormais APPLIQUÉ, et pas seulement écrit : cf. l'étape ②
 * de `reconcileThinkingBudget`, exécutée au point de passage unique.
 */
const MAX_TEMPERATURE_WITH_THINKING = MAX_TEMPERATURE_FOR_THINKING;

/**
 * Divergence : concept de marque, direction artistique, couverture, accroche.
 * C'est le réglage le plus chaud qu'un modèle raisonnant supporte sans que sa
 * réflexion cesse de converger.
 */
const SAMPLING_DIVERGENT = { temperature: MAX_TEMPERATURE_WITH_THINKING, topP: 0.95, topK: 64 };

/**
 * Composition sous contrainte : une page de charte, une slide, une section de
 * plan. Le modèle compose librement mais dans une grille, une palette et une
 * typographie imposées.
 */
const SAMPLING_COMPOSITION = { temperature: 0.55, topP: 0.92, topK: 50 };

/**
 * Précision : géométrie, JSON de schéma, chiffres. La créativité n'y est que de
 * la variance, et la variance y est un défaut.
 */
const SAMPLING_PRECISION = { temperature: 0.25, topP: 0.85, topK: 30 };

export const AI_CONFIG = {
  // Global / default settings
  default: {
    provider: LLMProvider.GLM,
    modelName: GLM_MODELS.writing,
    fallbackModels: TEXT_FALLBACK_MODELS,
  } as FeatureAIConfig,

  // Fallback settings
  fallback: {
    textModel: GLM_MODELS.mechanical,
    imageModel: GLM_MODELS.imageFallback,
  },

  // Onboarding service configurations
  // Étage mécanique : poser la question suivante et lire une réponse sont des
  // tâches de forme, pas de fond (chat + formulaire de création de projet).
  // Raisonnement DÉSACTIVÉ des deux côtés : poser la question suivante et lire
  // une réponse sont des tâches de forme, pas de fond.
  onboarding: {
    default: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.5,
        maxOutputTokens: 2048,
        thinkingBudget: 0,
      },
    } as FeatureAIConfig,
    parseAnswer: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'onboarding',
      llmOptions: {
        temperature: 0.1,
        // 256 tokens ne laissaient AUCUNE place au raisonnement, qui est
        // décompté du même budget : l'appel revenait vide dès que le modèle
        // décidait de réfléchir. Sans raisonnement, 256 suffisent largement.
        maxOutputTokens: 256,
        thinkingBudget: 0,
        // Sortie JSON garantie par le fournisseur, pas espérée du prompt.
        jsonMode: true,
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
    provider: LLMProvider.GLM,
    modelName: GLM_MODELS.reasoning,
    // ⚠️ ÉPINGLAGE TRANSITOIRE — à retirer section par section.
    //
    // Le routeur sait désormais partir à l'étage bas et escalader sur échec du
    // contrôle (cf. `pinModel`). Mais l'escalade ne rattrape que ce que la
    // grille DÉTECTE : troncature, balises déséquilibrées, gabarit non rempli.
    // Elle ne détecte pas « la page est plate ». Tant que la composition est
    // demandée au modèle en HTML libre, descendre d'étage échangerait donc du
    // coût contre de la qualité sans filet.
    //
    // Le retrait se fait quand le rendu par gabarit couvre la section : à ce
    // moment la grille, la palette, la typographie et le balisage sont garantis
    // par le code, et le modèle ne fournit plus que le contenu — une tâche que
    // l'étage bas remplit. Retirer cette ligne AVANT est une régression.
    pinModel: true,
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: {
      // Raisonnement activé : une section de plan est un arbitrage (quel angle,
      // quelles hypothèses, quelles preuves), pas une reformulation. Le budget
      // double en conséquence — la réflexion s'y décompte.
      ...SAMPLING_COMPOSITION,
      extraBody: { ...THINKING_ON },
      maxOutputTokens: 28000,
    },
    sections: {
      // Page de garde : c'est la première page qu'un investisseur ouvre. Elle
      // sort de l'étage M — la composition d'une couverture est le travail le
      // plus créatif du document, pas de la mise en page mécanique.
      'Cover Page': {
        llmOptions: { ...SAMPLING_DIVERGENT, maxOutputTokens: 18000 },
      },
      // Synthèse : la section la plus lue, elle doit être dense et juste.
      'Company Summary': { llmOptions: { maxOutputTokens: 30000, temperature: 0.55 } },
      // Sections nourries par la recherche : beaucoup de matière à structurer.
      Opportunity: { llmOptions: { maxOutputTokens: 36000, temperature: 0.5 } },
      'Target Audience': { llmOptions: { maxOutputTokens: 32000, temperature: 0.55 } },
      'Products & Services': { llmOptions: { maxOutputTokens: 32000, temperature: 0.55 } },
      'Marketing & Sales': { llmOptions: { maxOutputTokens: 32000, temperature: 0.6 } },
      // Section la plus lourde : tableaux chiffrés, hypothèses, projections.
      // PRÉCISION assumée : monter la température ici produit des chiffres qui
      // ne s'additionnent plus. Le gain de qualité vient du raisonnement et du
      // budget, pas de l'échantillonnage.
      'Financial Plan': {
        llmOptions: { ...SAMPLING_PRECISION, maxOutputTokens: 44000 },
      },
      // Jalons et annexes : restructuration de matière déjà produite en amont
      // (elles reçoivent les digests des sections dont elles dépendent).
      'Goal Planning': { llmOptions: { maxOutputTokens: 24000, temperature: 0.5 } },
      Appendix: { tier: 'M', llmOptions: { maxOutputTokens: 20000, temperature: 0.5 } },
    },
  } as FeatureAIConfig,

  // Pitch Deck service configuration
  // Chaque slide est du HTML + Tailwind autonome. Budgets plus resserrés que le
  // business plan (un slide reste un slide), mais large devant le raisonnement.
  pitchDeck: {
    provider: LLMProvider.GLM,
    modelName: GLM_MODELS.reasoning,
    // ⚠️ ÉPINGLAGE TRANSITOIRE — à retirer section par section.
    //
    // Le routeur sait désormais partir à l'étage bas et escalader sur échec du
    // contrôle (cf. `pinModel`). Mais l'escalade ne rattrape que ce que la
    // grille DÉTECTE : troncature, balises déséquilibrées, gabarit non rempli.
    // Elle ne détecte pas « la page est plate ». Tant que la composition est
    // demandée au modèle en HTML libre, descendre d'étage échangerait donc du
    // coût contre de la qualité sans filet.
    //
    // Le retrait se fait quand le rendu par gabarit couvre la section : à ce
    // moment la grille, la palette, la typographie et le balisage sont garantis
    // par le code, et le modèle ne fournit plus que le contenu — une tâche que
    // l'étage bas remplit. Retirer cette ligne AVANT est une régression.
    pinModel: true,
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: {
      // Onze slides qui doivent se distinguer les unes des autres : c'est le
      // livrable où la convergence vers une même mise en page se voit le plus.
      ...SAMPLING_COMPOSITION,
      temperature: 0.6,
      extraBody: { ...THINKING_ON },
      maxOutputTokens: 24000,
    },
    sections: {
      // Slide d'ouverture : la première impression du deck. Sortie de l'étage M
      // pour la même raison que la couverture du plan — c'est de la création.
      Cover: { llmOptions: { ...SAMPLING_DIVERGENT, maxOutputTokens: 22000 } },
      Problem: { llmOptions: { maxOutputTokens: 22000, temperature: 0.62 } },
      Solution: { llmOptions: { maxOutputTokens: 24000, temperature: 0.62 } },
      // Chiffres de marché : structure dense (TAM/SAM/SOM), la divergence n'y
      // apporte rien et fait dériver les ordres de grandeur.
      Market: { llmOptions: { ...SAMPLING_PRECISION, maxOutputTokens: 28000, temperature: 0.35 } },
      Product: { llmOptions: { maxOutputTokens: 26000, temperature: 0.6 } },
      'Business Model': { llmOptions: { maxOutputTokens: 26000, temperature: 0.55 } },
      Traction: { llmOptions: { maxOutputTokens: 22000, temperature: 0.55 } },
      // Tableau comparatif : beaucoup de cellules pour peu de mots.
      Competition: { llmOptions: { maxOutputTokens: 28000, temperature: 0.55 } },
      Team: { llmOptions: { maxOutputTokens: 20000, temperature: 0.6 } },
      // Projections chiffrées : le slide le plus dense du deck.
      Financials: { llmOptions: { ...SAMPLING_PRECISION, maxOutputTokens: 32000 } },
      Ask: { llmOptions: { maxOutputTokens: 20000, temperature: 0.6 } },
    },
  } as FeatureAIConfig,

  // Advisor service configuration
  // Function-calling requis : la boucle Context Engine tourne sur Gemini.
  advisor: {
    provider: LLMProvider.GLM,
    modelName: GLM_MODELS.writing,
    fallbackModels: TEXT_FALLBACK_MODELS,
    promptType: 'advisor',
  } as FeatureAIConfig,

  // Legal Docs service configuration
  legalDocs: {
    provider: LLMProvider.GLM,
    modelName: GLM_MODELS.writing,
    fallbackModels: TEXT_FALLBACK_MODELS,
  } as FeatureAIConfig,

  // Deployment configurations
  deployment: {
    terraform: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'terraform_tfvars_generation',
      llmOptions: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    } as FeatureAIConfig,
    chat: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    } as FeatureAIConfig,
  },

  // Finance configurations
  finance: {
    /**
     * Prévisions financières.
     *
     * PRÉCISION, pas divergence : trente-six mois de séries chiffrées qui
     * doivent s'additionner, respecter des taux réels et rester cohérentes
     * entre elles. Monter la température y produirait des chiffres plausibles
     * pris un par un et faux pris ensemble.
     *
     * La qualité vient donc d'ailleurs : le modèle de raisonnement (estimer un
     * coût unitaire pour un secteur et un pays donnés EST un raisonnement) et
     * un budget de sortie qui laisse la place à la réflexion sans amputer les
     * tableaux.
     */
    autofill: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance',
      llmOptions: {
        ...SAMPLING_PRECISION,
        temperature: 0.35,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 48000,
      },
    } as FeatureAIConfig,
    // Détection d'intention : de la classification. Aucun raisonnement à payer,
    // et 1024 tokens redeviennent un budget de sortie plein plutôt qu'un budget
    // partagé avec la réflexion.
    intent: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance',
      llmOptions: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        thinkingBudget: 0,
        // Sortie JSON garantie par le fournisseur, pas espérée du prompt.
        jsonMode: true,
      },
    } as FeatureAIConfig,
    // Couverture du rapport financier : une page pleine, c'est de la création.
    // 2000 tokens ne suffisaient pas à produire une page A4 en HTML+Tailwind ;
    // avec le raisonnement actif, ils ne suffisaient plus du tout.
    pdfCover: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance-cover-generation',
      llmOptions: {
        ...SAMPLING_DIVERGENT,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 20000,
      },
    } as FeatureAIConfig,
    // Lecture commentée des indicateurs : le seul endroit du module finance où
    // l'on rédige. ⚠️ Le budget est passé de 1500 à 12000 : à 1500, activer le
    // raisonnement aurait consommé l'intégralité de l'enveloppe et renvoyé une
    // interprétation VIDE — la panne exacte décrite en tête de GLM_MODELS.
    pdfInterpretation: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'finance-pdf-interpretation',
      llmOptions: {
        temperature: 0.6,
        topP: 0.93,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 12000,
      },
    } as FeatureAIConfig,
  },

  // Simulation configurations
  // La découverte des facteurs et la Red Team ont besoin de place: ce sont les
  // deux étapes qui produisent des dizaines d'entrées structurées d'un coup.
  simulation: {
    default: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation',
      llmOptions: { temperature: 0.4, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    understanding: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_understanding',
      llmOptions: { temperature: 0.2, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    factors: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_factors',
      llmOptions: { temperature: 0.5, maxOutputTokens: 32768, jsonMode: true },
    } as FeatureAIConfig,
    scenarios: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_scenarios',
      llmOptions: { temperature: 0.5, maxOutputTokens: 16384, jsonMode: true },
    } as FeatureAIConfig,
    analysis: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_analysis',
      llmOptions: { temperature: 0.3, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    recommendations: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_recommendations',
      llmOptions: { temperature: 0.4, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    redTeam: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_red_team',
      llmOptions: { temperature: 0.7, maxOutputTokens: 32768, jsonMode: true },
    } as FeatureAIConfig,
    customers: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_customers',
      llmOptions: { temperature: 0.5, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    investors: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_investors',
      llmOptions: { temperature: 0.6, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    blackSwan: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_black_swan',
      llmOptions: { temperature: 0.8, maxOutputTokens: 12288, jsonMode: true },
    } as FeatureAIConfig,
    universes: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_universes',
      llmOptions: { temperature: 0.7, maxOutputTokens: 8192, jsonMode: true },
    } as FeatureAIConfig,
    experiments: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      promptType: 'simulation_experiments',
      llmOptions: { temperature: 0.5, maxOutputTokens: 8192, jsonMode: true },
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
    } as FeatureAIConfig,
    // Extraction du contexte de marque : lecture et reformulation d'un projet
    // existant, aucune création — modèle SANS raisonnement.
    context: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_context',
      llmOptions: {
        maxOutputTokens: 2500,
        temperature: 0.2,
        thinkingBudget: 0,
        // Sortie JSON garantie par le fournisseur, pas espérée du prompt.
        jsonMode: true,
      },
    } as FeatureAIConfig,
    // Signaux de tendance : restitution de ce que le modèle sait déjà d'un
    // secteur, en 3 à 5 lignes. De la mémoire, pas du raisonnement.
    trends: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_trends',
      llmOptions: {
        maxOutputTokens: 2000,
        temperature: 0.5,
        thinkingBudget: 0,
        jsonMode: true,
      },
    } as FeatureAIConfig,
    // Stratégie éditoriale : c'est la matière dont dérivent le calendrier PUIS
    // les visuels. Une stratégie plate produit des visuels plats.
    strategy: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.mechanical,
      fallbackModels: TEXT_FALLBACK_MODELS,
      promptType: 'communication_image_brief',
      llmOptions: {
        maxOutputTokens: 1200,
        temperature: 0.7,
        thinkingBudget: 0,
        // Sortie JSON garantie par le fournisseur, pas espérée du prompt.
        jsonMode: true,
      },
    } as FeatureAIConfig,
    // Composition du visuel — la tâche la plus exigeante du module : le modèle
    // doit tenir une graine de design, une image analysée, une charte de marque
    // et sortir un bloc HTML/Tailwind complet sur UNE seule ligne.
    // ⚠️ NE PAS RÉDUIRE maxOutputTokens : le raisonnement de direction
    // artistique (choix d'archétype, calage typographique, contrastes) pèse ici
    // plus lourd que le HTML lui-même.
    flyer: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
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
      imageModel: GLM_MODELS.image,
      imageFallbackModel: GLM_MODELS.imageFallback,
      visionModel: GLM_MODELS.vision,
      // Repli vision : le modèle gratuit de la même famille. Un repli identique
      // au modèle principal ne servirait à rien, la saturation étant par modèle.
      visionFallbackModel: 'glm-4.6v-flash',
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
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      // ⚠️ ÉPINGLAGE TRANSITOIRE — à retirer section par section.
      //
      // Le routeur sait désormais partir à l'étage bas et escalader sur échec du
      // contrôle (cf. `pinModel`). Mais l'escalade ne rattrape que ce que la
      // grille DÉTECTE : troncature, balises déséquilibrées, gabarit non rempli.
      // Elle ne détecte pas « la page est plate ». Tant que la composition est
      // demandée au modèle en HTML libre, descendre d'étage échangerait donc du
      // coût contre de la qualité sans filet.
      //
      // Le retrait se fait quand le rendu par gabarit couvre la section : à ce
      // moment la grille, la palette, la typographie et le balisage sont garantis
      // par le code, et le modèle ne fournit plus que le contenu — une tâche que
      // l'étage bas remplit. Retirer cette ligne AVANT est une régression.
      pinModel: true,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        // Le défaut le plus visible de la charte était sa monotonie : douze
        // pages composées sur la même grille. Une température de 0.35 en était
        // la cause directe — à ce niveau, le modèle reproduit la mise en page
        // la plus probable, page après page.
        ...SAMPLING_COMPOSITION,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 28000,
      },
      // Sections de la charte graphique (clés = `stepName` de branding.service.ts).
      // Celles qui portent du SVG demandent bien plus de budget que celles qui
      // ne produisent que de la mise en page : un SVG tronqué est inutilisable.
      sections: {
        // Couverture de la charte : la page la plus libre du document.
        'Brand Header': { llmOptions: { ...SAMPLING_DIVERGENT, maxOutputTokens: 40000 } },
        // Pages logo : elles PRÉSENTENT un logo déjà dessiné, elles ne le
        // redessinent pas. La composition peut donc diverger sans risque pour
        // la géométrie, qui est importée telle quelle.
        'Logo Principal': { llmOptions: { maxOutputTokens: 36000, temperature: 0.6 } },
        'Logo Variation Fond Clair': { llmOptions: { maxOutputTokens: 30000, temperature: 0.6 } },
        'Logo Variation Fond Sombre': { llmOptions: { maxOutputTokens: 30000, temperature: 0.6 } },
        'Logo Variation Monochrome': { llmOptions: { maxOutputTokens: 30000, temperature: 0.6 } },
        // Règles d'usage : du texte structuré, peu de balisage.
        'Logo Bonnes Pratiques': { llmOptions: { maxOutputTokens: 36000, temperature: 0.55 } },
        // Nuanciers et spécimens : les VALEURS y sont exactes (hex, tailles),
        // la mise en page reste libre. On garde donc une divergence moyenne
        // plutôt que la précision — la page palette générique venait d'un 0.25.
        'Color Palette': { llmOptions: { maxOutputTokens: 26000, temperature: 0.6 } },
        Typography: { llmOptions: { maxOutputTokens: 26000, temperature: 0.62 } },
        // Page de direction artistique : elle doit DÉMONTRER le style en
        // construisant ses propres blocs de démonstration en CSS. C'est la page
        // la plus inventive de la charte après la couverture.
        'Direction Artistique': { llmOptions: { maxOutputTokens: 36000, temperature: 0.62 } },
      },
    } as FeatureAIConfig,
    logo: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        // ⚠️ NE PAS RÉDUIRE. Les tokens de raisonnement sont décomptés de
        // maxOutputTokens. Un SVG de logo complet (types name/initial = paths de
        // letterforms) pèse déjà 2–4k tokens ; raisonnement + SVG sous un budget
        // trop court tronque la réponse → JSON cassé → "no usable SVG".
        // Le raisonnement étant désormais ACTIF, le budget est doublé.
        maxOutputTokens: 48000,
        // Le raisonnement est ici le vrai levier de qualité, pas la température.
        // Le prompt exige une construction PARAMÉTRIQUE (« calculer chaque
        // sommet, jamais à main levée ») : sans réflexion, le modèle ne calcule
        // pas, il approxime — d'où des symétries fausses au demi-point près.
        extraBody: { ...THINKING_ON },
        // Relevée de 0.28 à 0.5 : à 0.28 le modèle proposait l'archétype le plus
        // probable pour le secteur, c'est-à-dire le logo que tout le monde a.
        // La géométrie reste protégée par la construction paramétrique et par la
        // boucle critique → révision, pas par une température basse.
        temperature: 0.45,
        topP: 0.93,
        topK: 50,
      },
      // Épinglé : un SVG géométriquement faux ou une direction artistique
      // inapplicable passent tous les contrôles automatiques. Sans détection,
      // pas d'escalade — donc pas de filet si l'on part trop bas.
      pinModel: true,
    } as FeatureAIConfig,
    /**
     * Palettes.
     *
     * Une température de 0.05 sur le petit modèle produisait toujours la même
     * réponse : le bleu de confiance, le vert de croissance, le violet
     * d'innovation. C'est mécaniquement la palette moyenne du secteur — donc la
     * palette de tous les concurrents. Le prompt encadre déjà les contraintes
     * dures (contrastes WCAG, rôles, 60/30/10) : la divergence peut donc monter
     * sans produire de palette inutilisable.
     */
    colors: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        temperature: 0.6,
        topP: 0.95,
        topK: 50,
        extraBody: { ...THINKING_ON },
        // Trois palettes complètes + justifications, raisonnement compris.
        maxOutputTokens: 12000,
      },
    } as FeatureAIConfig,
    /**
     * Appariements typographiques.
     *
     * La police est le levier le plus rapide pour qu'une marque cesse de
     * ressembler à toutes les autres, et le petit modèle à 0.3 ramenait
     * invariablement les familles les plus employées du web. Le prompt bannit
     * désormais ces familles et impose trois registres différents : il faut un
     * modèle capable d'arbitrer entre eux, et de la divergence pour ne pas
     * reproposer le même appariement à chaque projet.
     */
    typography: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        temperature: 0.6,
        topP: 0.95,
        topK: 50,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 12000,
      },
    } as FeatureAIConfig,
    /**
     * Direction artistique : l'arbitrage visuel dont dépendent tous les autres
     * livrables.
     *
     * La température était basse pour éviter des directions « poétiques et
     * inapplicables ». Le remède s'est révélé être ailleurs : c'est le CATALOGUE
     * qui garantit l'applicabilité (le styleId est validé, la fiche de style
     * fournit les règles opérables), pas la température. À 0.3, le modèle
     * retenait simplement le style le plus attendu pour le secteur — et c'est
     * exactement ce qu'on cherche à éviter, puisque cette décision se propage
     * ensuite à la charte, aux visuels, au plan, au deck et au site.
     *
     * Divergence haute + raisonnement : un choix osé mais argumenté, et des
     * consignes qui restent exécutables parce que le catalogue les borne.
     */
    artDirection: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        ...SAMPLING_DIVERGENT,
        extraBody: { ...THINKING_ON },
        // Le raisonnement se décompte du budget : un JSON de direction tronqué
        // est inutilisable, et il n'y a pas de repli à ce niveau.
        maxOutputTokens: 24000,
      },
      // Épinglé : un SVG géométriquement faux ou une direction artistique
      // inapplicable passent tous les contrôles automatiques. Sans détection,
      // pas d'escalade — donc pas de filet si l'on part trop bas.
      pinModel: true,
    } as FeatureAIConfig,
    logoAnalysis: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.writing,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        maxOutputTokens: 2000,
        temperature: 0.2,
        jsonMode: true,
      },
    } as FeatureAIConfig,
    // Template de carte de visite : deux faces HTML complètes + concept.
    // ⚠️ NE PAS RÉDUIRE maxOutputTokens. Comme pour le logo, le modèle est
    // « thinking » : les tokens de raisonnement sont décomptés du budget. Deux
    // faces de HTML Tailwind pèsent déjà 2–4k tokens ; sous un budget trop
    // court la réponse est tronquée en plein milieu du HTML et devient
    // illisible côté parseur.
    businessCard: {
      provider: LLMProvider.GLM,
      modelName: GLM_MODELS.reasoning,
      fallbackModels: TEXT_FALLBACK_MODELS,
      llmOptions: {
        ...SAMPLING_COMPOSITION,
        extraBody: { ...THINKING_ON },
        maxOutputTokens: 40000,
      },
    } as FeatureAIConfig,
    /**
     * Mise en situation de marque. Deux modèles, deux rôles distincts :
     * l'un PHOTOGRAPHIE le support nu, l'autre LIT la photo pour dire où le
     * logo doit être imprimé. Sans cette seconde lecture, le logo retombait au
     * centre géométrique de l'image, souvent à côté du support.
     */
    brandMockup: {
      imageModel: GLM_MODELS.image,
      visionModel: GLM_MODELS.vision,
      // Repli vision : le modèle gratuit de la même famille, la saturation
      // étant par modèle (cf. imageSourcing).
      visionFallbackModel: 'glm-4.6v-flash',
      // Le JSON de zone tient en ~60 tokens, mais le modèle est « thinking » :
      // son raisonnement se décompte du même budget et une réponse vide ferait
      // retomber la composition sur son repli, donc sur un placement à l'aveugle.
      visionMaxOutputTokens: 1500,
    },
  },
};
