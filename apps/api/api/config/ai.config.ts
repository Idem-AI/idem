export enum LLMProvider {
  GEMINI = 'GEMINI',
  CHATGPT = 'CHATGPT',
  DEEPSEEK = 'DEEPSEEK',
  // GLM-5.2 (Zhipu / Z.ai), via API OpenAI-compatible — voir ai-providers.config.ts.
  GLM = 'GLM',
}

/**
 * Fournisseur servant la plateforme par défaut.
 *
 * Déclaré UNE fois. Aucune configuration de feature ne nomme plus de
 * fournisseur : elles déclarent un RÔLE, et le fournisseur est une décision
 * d'exploitation (`AI_DEFAULT_PROVIDER`), pas un choix par-feature. Quarante
 * configurations qui répétaient `provider: LLMProvider.GLM` rendaient la
 * bascule inatteignable autrement que par une réécriture.
 */
export const DEFAULT_PROVIDER = LLMProvider.GLM;

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
   * est ignoré, jamais une cause d'erreur.
   *
   * ⚠️ NE PAS L'ÉCRIRE À LA MAIN dans une configuration : `feature({ thinking:
   * false })` le pose, et pose le dialecte de l'autre famille avec lui. Écrits
   * séparément, les deux dialectes se contredisaient — cf. `AiSpec.thinking`.
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
 * RÔLE d'un modèle — LE VOCABULAIRE UNIQUE de toute la configuration IA.
 *
 * Une feature ne déclare ni fournisseur ni nom de modèle : elle déclare ce
 * qu'elle attend du modèle. « Le modèle qui raisonne » se traduit chez chaque
 * fournisseur (`ai-providers.config.ts`, table `models`) ; le nom, lui, ne
 * survit à aucune bascule.
 *
 * Déclaré ICI et non dans le registre des fournisseurs pour que `ai.config.ts`
 * reste la FEUILLE du graphe d'imports : le registre et le routeur dépendent de
 * cette config, jamais l'inverse. `ai-providers.config.ts` le réexporte, pour
 * que les importateurs historiques ne changent pas.
 *
 * ── POURQUOI UN SEUL VOCABULAIRE ─────────────────────────────────────────────
 *
 * Il y en avait TROIS pour la même chose : `GLM_MODELS.mechanical`, le rôle
 * `mechanical`, et l'étage `XS`. Trois tables à tenir alignées, deux fonctions
 * de recherche inverse (`roleOfModel`, `tierOfModel`) pour retrouver au jugé,
 * dans le nom du modèle, l'intention qu'on venait d'y perdre en l'écrivant. Un
 * étage n'est plus qu'un ALIAS de rôle (cf. `TIER_ROLE`).
 */
export type ModelRole =
  | 'mechanical'
  | 'writing'
  | 'reasoning'
  | 'vision'
  | 'image'
  | 'ocr';

/** Les rôles, énumérés — source unique pour valider une surcharge ou balayer un registre. */
export const MODEL_ROLES: readonly ModelRole[] = [
  'mechanical',
  'writing',
  'reasoning',
  'vision',
  'image',
  'ocr',
] as const;

/**
 * Étage de modèle (cf. `model-router.ts`) — ALIAS DE RÔLE, rien de plus.
 *
 *   XS — mécanique (résumé, vérification, classification)  ≡ `mechanical`
 *   M  — rédaction                                          ≡ `writing`
 *   S  — raisonnement                                       ≡ `reasoning`
 *
 * Les deux noms coexistent parce qu'ils servent deux conversations : l'étage
 * parle de COÛT et d'escalade (on tente en bas, on monte si le contrôle échoue),
 * le rôle parle de CAPACITÉ. Mais ils désignent le même modèle, et c'est
 * désormais écrit une seule fois — ici.
 */
export type ModelTier = 'XS' | 'M' | 'S';

/** La traduction étage → rôle. L'unique endroit où XS/M/S prennent un sens. */
export const TIER_ROLE: Record<ModelTier, ModelRole> = {
  XS: 'mechanical',
  M: 'writing',
  S: 'reasoning',
};

/**
 * Réglages propres à UNE section d'une feature (une section de business plan,
 * un slide de pitch deck…). Tout champ omis retombe sur la config de la feature.
 */
export interface SectionAIConfig {
  provider?: LLMProvider;
  modelName?: string;
  /** Rôle attendu du modèle. Voir `FeatureAIConfig.role`. */
  role?: ModelRole;
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
  /**
   * RÔLE dont `modelName` est la traduction chez `provider`.
   *
   * Porté sur la config plutôt que redevine par `roleOfModel` : c'est ce qui
   * permet à `resolveGlobalOverride` de traduire EXACTEMENT lors d'une bascule
   * de fournisseur, au lieu d'inférer l'intention d'un nom de modèle avec des
   * expressions régulières. Absent (modèle épinglé à la main), l'inférence
   * reprend son rôle de repli.
   */
  role?: ModelRole;
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
    // Le rôle suit le modèle : une section qui épingle un `modelName` n'a plus
    // de rôle connu, et laisser celui de la feature ferait traduire la bascule
    // vers un modèle que la section avait justement écarté.
    role: section.role ?? (section.modelName ? undefined : feature.role),
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
  /**
   * Repli vision : le modèle GRATUIT de la même famille. Un repli identique au
   * modèle principal ne servirait à rien, la saturation étant par modèle.
   */
  visionFallback: 'glm-4.6v-flash',
  /** Extraction de texte dans une image. */
  ocr: 'glm-ocr',
  /** Génération d'image, et son repli. */
  image: 'glm-image',
  imageFallback: 'cogview-4-250304',
  /** Moteur de recherche web de Z.ai (endpoint `/web_search`). */
  searchEngine: 'search-prime',
} as const;

/**
 * Le modèle servant chaque rôle chez le fournisseur PAR DÉFAUT.
 *
 * Lu par l'usine `feature()` (ici) ET par le registre des fournisseurs, qui en
 * fait la table `models` de GLM : une seule affectation rôle → modèle, deux
 * lecteurs. C'est ce qui empêche `MODEL_TIERS` et `AI_PROVIDERS.GLM.models` de
 * diverger, comme ils le faisaient en se recopiant l'un l'autre à la main.
 */
export const ROLE_MODELS: Record<ModelRole, string> = {
  mechanical: GLM_MODELS.mechanical,
  writing: GLM_MODELS.writing,
  reasoning: GLM_MODELS.reasoning,
  vision: GLM_MODELS.vision,
  image: GLM_MODELS.image,
  ocr: GLM_MODELS.ocr,
};

/**
 * Chaîne de repli standard pour la génération de texte.
 *
 * Ordre = qualité décroissante / disponibilité croissante. Google renvoie 503
 * « high demand » par MODÈLE : rejouer le même ne sert à rien, il faut basculer.
 *
 * ⚠️ NE PAS la recopier dans une configuration de feature. Elle est déclarée
 * comme repli du FOURNISSEUR (`AI_PROVIDERS[GLM].defaultFallbackModels`) et
 * appliquée au point de passage unique, à toute config qui n'en déclare aucune
 * (cf. `prompt.service.ts`). Vingt-huit features la répétaient : sans effet
 * quand le fournisseur est GLM, et activement nuisible après une bascule, une
 * chaîne de noms GLM n'étant qu'une cascade de 404 chez Gemini.
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
export type SamplingProfile = 'divergent' | 'composition' | 'precision';

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
 * Ce plafond est APPLIQUÉ, et pas seulement écrit : cf. l'étape ② de
 * `reconcileThinkingBudget`, exécutée au point de passage unique.
 */
const MAX_TEMPERATURE_WITH_THINKING = MAX_TEMPERATURE_FOR_THINKING;

const SAMPLING: Record<SamplingProfile, Pick<LLMOptions, 'temperature' | 'topP' | 'topK'>> = {
  /**
   * Divergence : concept de marque, direction artistique, couverture, accroche.
   * C'est le réglage le plus chaud qu'un modèle raisonnant supporte sans que sa
   * réflexion cesse de converger.
   */
  divergent: { temperature: MAX_TEMPERATURE_WITH_THINKING, topP: 0.95, topK: 64 },
  /**
   * Composition sous contrainte : une page de charte, une slide, une section de
   * plan. Le modèle compose librement mais dans une grille, une palette et une
   * typographie imposées.
   */
  composition: { temperature: 0.55, topP: 0.92, topK: 50 },
  /**
   * Précision : géométrie, JSON de schéma, chiffres. La créativité n'y est que
   * de la variance, et la variance y est un défaut.
   */
  precision: { temperature: 0.25, topP: 0.85, topK: 30 },
};

/** Raisonnement GLM activé — écrase le `thinking: disabled` du fournisseur. */
const THINKING_ON = { thinking: { type: 'enabled' } } as const;

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
  let thinkingEnabled = thinking?.type === 'enabled';
  const budget = options.maxOutputTokens;

  // ── UNE INTENTION, TOUS LES DIALECTES ────────────────────────────────────
  //
  // `thinkingBudget: 0` et `extraBody.thinking: disabled` disent la MÊME chose,
  // chacun dans le dialecte d'un fournisseur. Les laisser vivre séparément a un
  // défaut mesuré : une feature qui coupe le raisonnement pour Gemini
  // (`thinkingBudget: 0`) continuait de l'activer sur un fournisseur
  // openai-compatible si son `extraBody` disait l'inverse — et inversement.
  //
  // Depuis que les configurations passent par `feature({ thinking })`, les deux
  // dialectes sont posés ENSEMBLE et ne peuvent plus se contredire à la source.
  // Ce rattrapage reste pour les appelants qui composent leurs `llmOptions` à
  // la main (agents, édition de section, scripts).
  if (options.thinkingBudget === 0 && thinkingEnabled) {
    return {
      options: {
        ...options,
        extraBody: { ...options.extraBody, thinking: { type: 'disabled' } },
      },
      downgraded: false,
    };
  }
  if (options.thinkingBudget === 0) {
    thinkingEnabled = false;
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// L'USINE — le seul point d'entrée pour déclarer une configuration de feature.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ce qu'une feature déclare : une INTENTION, pas une infrastructure.
 *
 * Avant, chaque entrée répétait quatre lignes mécaniques — le fournisseur
 * (toujours le même), le nom du modèle (la traduction d'un rôle qu'on ne
 * disait pas), la chaîne de repli (déjà garantie par le fournisseur) et un
 * `as FeatureAIConfig` qui désactivait précisément le typage censé les
 * vérifier. Quarante fois. Une bascule de fournisseur demandait donc quarante
 * modifications, et la moindre faute de frappe passait le compilateur.
 *
 * Ici, on ne déclare que ce qui DIFFÈRE d'une feature à l'autre.
 */
export interface AiSpec {
  /** Ce qu'on attend du modèle. Traduit en nom chez le fournisseur en service. */
  role?: ModelRole;
  /**
   * Fournisseur imposé. Échappatoire : le fournisseur est normalement une
   * décision d'exploitation (`AI_DEFAULT_PROVIDER`), pas un choix de feature.
   */
  provider?: LLMProvider;
  /**
   * Modèle imposé, par son nom. Échappatoire de dernier recours — un nom ne
   * survit à aucune bascule de fournisseur. Préférer `role`.
   */
  modelName?: string;
  /** Étage de départ des sections (cf. `FeatureAIConfig.tier`). */
  tier?: ModelTier;
  promptType?: string;
  /** Profil d'échantillonnage. Les réglages fins ci-dessous le surchargent. */
  sampling?: SamplingProfile;
  temperature?: number;
  topP?: number;
  topK?: number;
  /** `maxOutputTokens` — RAISONNEMENT COMPRIS, il s'y décompte. */
  tokens?: number;
  /**
   * Raisonnement du modèle.
   *
   * UN SEUL DRAPEAU, LES DEUX DIALECTES. `thinkingBudget: 0` (famille Gemini)
   * et `extraBody.thinking` (fournisseurs openai-compatible) disent la même
   * chose ; écrits à la main, quatorze configurations disaient l'un et neuf
   * l'autre, et rien n'empêchait une même entrée de se contredire — la coupure
   * ne survivait alors pas à une bascule de fournisseur, c'est-à-dire au seul
   * moment où elle comptait.
   *
   * ⚠️ `true` exige `tokens >= MIN_TOKENS_FOR_THINKING`, sans quoi le point de
   * passage le coupe (cf. `reconcileThinkingBudget`) : la réflexion consomme le
   * budget de sortie et la réponse revient VIDE.
   */
  thinking?: boolean;
  /** Sortie JSON garantie par le fournisseur, pas espérée du prompt. */
  json?: boolean;
  /** Le modèle est un PLANCHER : jamais d'essai plus bas (cf. `pinModel`). */
  pin?: boolean;
  /**
   * Chaîne de repli propre à cette feature. À n'employer que pour DÉVIER du
   * repli du fournisseur : le laisser vide est le bon défaut, il est appliqué
   * au point de passage unique.
   */
  fallbackModels?: string[];
  /** Champs de corps bruts, hors contrat. Fusionnés après `thinking`. */
  extraBody?: Record<string, unknown>;
}

/** Réglages d'une section : mêmes leviers, sans imbrication. */
export type SectionSpec = AiSpec;

function buildOptions(spec: AiSpec): LLMOptions | undefined {
  const options: LLMOptions = {};

  if (spec.sampling) Object.assign(options, SAMPLING[spec.sampling]);
  if (spec.temperature !== undefined) options.temperature = spec.temperature;
  if (spec.topP !== undefined) options.topP = spec.topP;
  if (spec.topK !== undefined) options.topK = spec.topK;
  if (spec.tokens !== undefined) options.maxOutputTokens = spec.tokens;

  // Les deux dialectes, posés ensemble et jamais séparément.
  if (spec.thinking === true) options.extraBody = { ...THINKING_ON };
  else if (spec.thinking === false) options.thinkingBudget = 0;

  if (spec.extraBody) options.extraBody = { ...options.extraBody, ...spec.extraBody };
  if (spec.json) options.jsonMode = true;

  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Traduit une intention de section en réglages.
 *
 * Ne pose QUE ce qui est déclaré : tout champ absent doit rester `undefined`
 * pour que `resolveSectionConfig` retombe sur la feature. Poser un défaut ici
 * reviendrait à écraser silencieusement la feature avec une valeur que
 * personne n'a demandée.
 */
function buildSection(spec: SectionSpec): SectionAIConfig {
  const options = buildOptions(spec);
  return {
    ...(spec.role ? { role: spec.role } : {}),
    ...(spec.provider ? { provider: spec.provider } : {}),
    ...(spec.modelName ? { modelName: spec.modelName } : {}),
    ...(spec.tier ? { tier: spec.tier } : {}),
    ...(spec.promptType ? { promptType: spec.promptType } : {}),
    ...(spec.pin !== undefined ? { pinModel: spec.pin } : {}),
    ...(spec.fallbackModels ? { fallbackModels: spec.fallbackModels } : {}),
    ...(options ? { llmOptions: options } : {}),
  };
}

/**
 * Déclare la configuration IA d'une feature.
 *
 * `feature({ role: 'writing', promptType: 'x', tokens: 8192, json: true })`
 * remplace six lignes dont quatre étaient identiques d'une feature à l'autre.
 */
export function feature(
  spec: AiSpec & { sections?: Record<string, SectionSpec> }
): FeatureAIConfig {
  // Un nom de modèle imposé n'a pas de rôle connu : le laisser deviner
  // ferait retraduire la bascule vers le modèle que l'auteur avait écarté.
  const role: ModelRole | undefined = spec.modelName ? spec.role : (spec.role ?? 'writing');
  const options = buildOptions(spec);
  const sections = spec.sections
    ? Object.fromEntries(
        Object.entries(spec.sections).map(([name, section]) => [name, buildSection(section)])
      )
    : undefined;

  return {
    provider: spec.provider ?? DEFAULT_PROVIDER,
    // Un nom imposé l'emporte ; sinon le rôle est traduit chez le fournisseur
    // par défaut, et `resolveGlobalOverride` le retraduira à la bascule.
    modelName: spec.modelName ?? ROLE_MODELS[role ?? 'writing'],
    ...(role ? { role } : {}),
    ...(spec.promptType ? { promptType: spec.promptType } : {}),
    ...(spec.tier ? { tier: spec.tier } : {}),
    ...(spec.pin ? { pinModel: true } : {}),
    ...(spec.fallbackModels ? { fallbackModels: spec.fallbackModels } : {}),
    ...(options ? { llmOptions: options } : {}),
    ...(sections ? { sections } : {}),
  };
}

/**
 * ÉTAGE DE DÉPART DES SECTIONS + ÉPINGLAGE TRANSITOIRE.
 *
 * Ces deux réglages vont ensemble et valent pour les trois livrables composés
 * page à page (plan, deck, charte). Ils étaient recopiés mot pour mot, avec
 * leurs vingt-cinq lignes de justification, dans les trois configurations.
 *
 * ── L'ÉTAGE ─────────────────────────────────────────────────────────────────
 *
 * `modelName` d'une feature ne sert qu'aux sections ÉPINGLÉES (les pages en
 * composition libre). Une section sous gabarit est dépinglée d'office par
 * `generic.service.ts`, et partait donc à l'étage de sa TÂCHE — `draft` → M,
 * l'étage de rédaction. C'est le bon défaut pour le volume courant ; ce ne l'est
 * pas pour les trois livrables qu'un investisseur lit. Déclarer l'étage le rend
 * explicite et PORTABLE : sur Gemini il se traduit par le rôle `reasoning`,
 * donc par `IDEM_GEMINI_REASONING_MODEL`.
 *
 * ── L'ÉPINGLAGE, ⚠️ TRANSITOIRE — à retirer section par section ─────────────
 *
 * Le routeur sait partir à l'étage bas et escalader sur échec du contrôle
 * (cf. `pinModel`). Mais l'escalade ne rattrape que ce que la grille DÉTECTE :
 * troncature, balises déséquilibrées, gabarit non rempli. Elle ne détecte pas
 * « la page est plate ». Tant que la composition est demandée au modèle en HTML
 * libre, descendre d'étage échangerait donc du coût contre de la qualité sans
 * filet.
 *
 * Le retrait se fait quand le rendu par gabarit couvre la section : à ce moment
 * la grille, la palette, la typographie et le balisage sont garantis par le
 * code, et le modèle ne fournit plus que le contenu — une tâche que l'étage bas
 * remplit. Retirer AVANT est une régression.
 */
const COMPOSED_DOCUMENT = { role: 'reasoning', tier: 'S', pin: true } as const;

export const AI_CONFIG = {
  /** Défaut global : rédaction, sans réglage particulier. */
  default: feature({ role: 'writing' }),

  /** Replis nommés, pour les appelants qui choisissent leur modèle eux-mêmes. */
  fallback: {
    textModel: GLM_MODELS.mechanical,
    imageModel: GLM_MODELS.imageFallback,
  },

  // Onboarding — étage mécanique et raisonnement COUPÉ des deux côtés : poser la
  // question suivante et lire une réponse sont des tâches de forme, pas de fond
  // (chat + formulaire de création de projet).
  onboarding: {
    default: feature({
      role: 'mechanical',
      promptType: 'onboarding',
      temperature: 0.5,
      tokens: 2048,
      thinking: false,
    }),
    parseAnswer: feature({
      role: 'mechanical',
      promptType: 'onboarding',
      temperature: 0.1,
      // 256 tokens ne laissaient AUCUNE place au raisonnement, qui est décompté
      // du même budget : l'appel revenait vide dès que le modèle décidait de
      // réfléchir. Sans raisonnement, 256 suffisent largement.
      tokens: 256,
      thinking: false,
      json: true,
    }),
  },

  // Business Plan — research-team (rédacteur) réutilise cette config ; le
  // chercheur (grounding Google Search) reste figé Gemini.
  //
  // ⚠️ PRIORITÉ QUALITÉ (choix produit). Les sections sortent du HTML + Tailwind
  // minifié sur une seule ligne, et le modèle est « thinking » : le raisonnement
  // consomme le même budget que la sortie. Les valeurs ci-dessous laissent de la
  // marge au raisonnement AVANT la rédaction. Ne pas rabaisser pour gagner du
  // temps : une section tronquée casse le parseur HTML et la section est perdue.
  businessPlan: feature({
    ...COMPOSED_DOCUMENT,
    // Raisonnement activé : une section de plan est un arbitrage (quel angle,
    // quelles hypothèses, quelles preuves), pas une reformulation. Le budget
    // double en conséquence — la réflexion s'y décompte.
    sampling: 'composition',
    thinking: true,
    tokens: 28000,
    sections: {
      // Page de garde : c'est la première page qu'un investisseur ouvre. Elle
      // sort de l'étage M — la composition d'une couverture est le travail le
      // plus créatif du document, pas de la mise en page mécanique.
      'Cover Page': { sampling: 'divergent', tokens: 18000 },
      // Synthèse : la section la plus lue, elle doit être dense et juste.
      'Company Summary': { tokens: 44000, temperature: 0.55 },
      // Sections nourries par la recherche : beaucoup de matière à structurer.
      Opportunity: { tokens: 44000, temperature: 0.5 },
      'Target Audience': { tokens: 44000, temperature: 0.55 },
      'Products & Services': { tokens: 44000, temperature: 0.55 },
      'Marketing & Sales': { tokens: 44000, temperature: 0.6 },
      // Section la plus lourde : tableaux chiffrés, hypothèses, projections.
      // PRÉCISION assumée : monter la température ici produit des chiffres qui
      // ne s'additionnent plus. Le gain de qualité vient du raisonnement et du
      // budget, pas de l'échantillonnage.
      'Financial Plan': { sampling: 'precision', tokens: 44000 },
      // Jalons et annexes : restructuration de matière déjà produite en amont
      // (elles reçoivent les digests des sections dont elles dépendent).
      'Goal Planning': { tokens: 44000, temperature: 0.5 },
      Appendix: { tier: 'M', tokens: 44000, temperature: 0.5 },
    },
  }),

  // Pitch Deck — chaque slide est du HTML + Tailwind autonome. Budgets plus
  // resserrés que le business plan (un slide reste un slide), mais larges devant
  // le raisonnement.
  pitchDeck: feature({
    ...COMPOSED_DOCUMENT,
    // Onze slides qui doivent se distinguer les unes des autres : c'est le
    // livrable où la convergence vers une même mise en page se voit le plus.
    sampling: 'composition',
    temperature: 0.6,
    thinking: true,
    tokens: 24000,
    sections: {
      // Slide d'ouverture : la première impression du deck. Sortie de l'étage M
      // pour la même raison que la couverture du plan — c'est de la création.
      Cover: { sampling: 'divergent', tokens: 22000 },
      Problem: { tokens: 22000, temperature: 0.62 },
      Solution: { tokens: 24000, temperature: 0.62 },
      // Chiffres de marché : structure dense (TAM/SAM/SOM), la divergence n'y
      // apporte rien et fait dériver les ordres de grandeur.
      Market: { sampling: 'precision', tokens: 28000, temperature: 0.35 },
      Product: { tokens: 26000, temperature: 0.6 },
      'Business Model': { tokens: 26000, temperature: 0.55 },
      Traction: { tokens: 22000, temperature: 0.55 },
      // Tableau comparatif : beaucoup de cellules pour peu de mots.
      Competition: { tokens: 28000, temperature: 0.55 },
      Team: { tokens: 20000, temperature: 0.6 },
      // Projections chiffrées : le slide le plus dense du deck.
      Financials: { sampling: 'precision', tokens: 32000 },
      Ask: { tokens: 20000, temperature: 0.6 },
    },
  }),

  // Advisor — function-calling requis : la boucle Context Engine tourne dessus.
  advisor: feature({ role: 'writing', promptType: 'advisor' }),

  legalDocs: feature({ role: 'writing' }),

  deployment: {
    terraform: feature({
      role: 'writing',
      promptType: 'terraform_tfvars_generation',
      temperature: 0.3,
      tokens: 4000,
    }),
    chat: feature({ role: 'writing', temperature: 0.7, tokens: 1024 }),
  },

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
    autofill: feature({
      role: 'reasoning',
      promptType: 'finance',
      sampling: 'precision',
      temperature: 0.35,
      thinking: true,
      tokens: 48000,
    }),
    // Détection d'intention : de la classification. Aucun raisonnement à payer,
    // et 1024 tokens redeviennent un budget de sortie plein plutôt qu'un budget
    // partagé avec la réflexion.
    intent: feature({
      role: 'mechanical',
      promptType: 'finance',
      temperature: 0.2,
      tokens: 1024,
      thinking: false,
      json: true,
    }),
    // `pdfCover` a été RETIRÉE : la couverture du rapport financier est
    // désormais construite par le code (`finance-pdf.service.ts`). C'était un
    // élément fixe — un titre, un nom, une date, un logo — que rien n'obligeait
    // à faire écrire par un modèle, et qui ne garantissait pas la charte.
    pdfInterpretation: feature({
      role: 'reasoning',
      promptType: 'finance-pdf-interpretation',
      temperature: 0.6,
      topP: 0.93,
      thinking: true,
      tokens: 12000,
    }),
  },

  // Simulation — la découverte des facteurs et la Red Team ont besoin de place :
  // ce sont les deux étapes qui produisent des dizaines d'entrées structurées
  // d'un coup. Tout le module sort du même moule, à trois leviers près.
  simulation: {
    default: feature({ role: 'writing', promptType: 'simulation', temperature: 0.4, tokens: 8192, json: true }),
    understanding: feature({ role: 'writing', promptType: 'simulation_understanding', temperature: 0.2, tokens: 8192, json: true }),
    factors: feature({ role: 'writing', promptType: 'simulation_factors', temperature: 0.5, tokens: 32768, json: true }),
    // glm-4.7 (writing) tronque le JSON de scénarios vers 6 500 caractères : son
    // plafond de sortie effectif est inférieur à sa limite déclarée. Le modèle de
    // raisonnement supporte des sorties structurées plus longues et produit un
    // JSON plus discipliné, ce qui évite la troncature silencieuse.
    scenarios: feature({ role: 'reasoning', promptType: 'simulation_scenarios', temperature: 0.5, tokens: 8192, json: true }),
    analysis: feature({ role: 'writing', promptType: 'simulation_analysis', temperature: 0.3, tokens: 8192, json: true }),
    recommendations: feature({ role: 'writing', promptType: 'simulation_recommendations', temperature: 0.4, tokens: 8192, json: true }),
    redTeam: feature({ role: 'writing', promptType: 'simulation_red_team', temperature: 0.7, tokens: 32768, json: true }),
    customers: feature({ role: 'writing', promptType: 'simulation_customers', temperature: 0.5, tokens: 8192, json: true }),
    investors: feature({ role: 'writing', promptType: 'simulation_investors', temperature: 0.6, tokens: 8192, json: true }),
    blackSwan: feature({ role: 'writing', promptType: 'simulation_black_swan', temperature: 0.8, tokens: 12288, json: true }),
    universes: feature({ role: 'writing', promptType: 'simulation_universes', temperature: 0.7, tokens: 8192, json: true }),
    experiments: feature({ role: 'writing', promptType: 'simulation_experiments', temperature: 0.5, tokens: 8192, json: true }),
  },

  // Communication
  //
  // ⚠️ PRIORITÉ QUALITÉ & CRÉATIVITÉ > VITESSE (choix produit assumé).
  //
  // Tous les modèles employés ici sont « thinking » : leurs tokens de
  // raisonnement sont décomptés de `maxOutputTokens`. Un budget serré n'ampute
  // donc pas d'abord la sortie mais la RÉFLEXION — la composition retombe sur
  // le réflexe « photo plein cadre + titre + logo » bien avant que la
  // troncature ne devienne visible. Les budgets ci-dessous laissent
  // délibérément de la marge au raisonnement AVANT la production.
  communication: {
    default: feature({ role: 'reasoning' }),
    // Extraction du contexte de marque : lecture et reformulation d'un projet
    // existant, aucune création — modèle SANS raisonnement.
    context: feature({
      role: 'mechanical',
      promptType: 'communication_context',
      temperature: 0.2,
      tokens: 2500,
      thinking: false,
      json: true,
    }),
    // Signaux de tendance : restitution de ce que le modèle sait déjà d'un
    // secteur, en 3 à 5 lignes. De la mémoire, pas du raisonnement.
    trends: feature({
      role: 'mechanical',
      promptType: 'communication_trends',
      temperature: 0.5,
      tokens: 2000,
      thinking: false,
      json: true,
    }),
    // Stratégie éditoriale : c'est la matière dont dérivent le calendrier PUIS
    // les visuels. Une stratégie plate produit des visuels plats.
    strategy: feature({
      role: 'reasoning',
      promptType: 'communication_strategy',
      temperature: 0.7,
      topP: 0.95,
      topK: 50,
      tokens: 16000,
    }),
    // Calendrier : 12 à 20 idées de contenu distinctes en un seul JSON. Le
    // volume de sortie ET l'exigence de non-répétition justifient le modèle de
    // raisonnement et une température haute.
    calendar: feature({
      role: 'reasoning',
      promptType: 'communication_calendar',
      temperature: 0.8,
      topP: 0.95,
      topK: 64,
      tokens: 20000,
    }),
    // Brief d'image : deux phrases et une orientation. Le raisonnement n'y
    // apportait rien mais consommait tout le budget (400 tokens à l'origine),
    // d'où des réponses vides et un repli silencieux sur la requête
    // heuristique — donc des photos hors sujet. Modèle sans raisonnement,
    // budget confortable : l'appel redevient fiable ET moins cher.
    imageBrief: feature({
      role: 'mechanical',
      promptType: 'communication_image_brief',
      temperature: 0.7,
      tokens: 1200,
      thinking: false,
      json: true,
    }),
    // Composition du visuel — la tâche la plus exigeante du module : le modèle
    // doit tenir une graine de design, une image analysée, une charte de marque
    // et sortir un bloc HTML/Tailwind complet sur UNE seule ligne.
    // ⚠️ NE PAS RÉDUIRE `tokens` : le raisonnement de direction artistique
    // (choix d'archétype, calage typographique, contrastes) pèse ici plus lourd
    // que le HTML lui-même.
    flyer: feature({
      role: 'reasoning',
      promptType: 'communication_flyer',
      // 0.8 est le plafond raisonnable : au-delà, la créativité gagnée se paie
      // en JSON malformé (le HTML voyage dans une chaîne JSON, une guillemet
      // mal échappée perd toute la génération). La diversité des compositions
      // vient d'abord de la graine de design tirée au sort côté service, pas de
      // la température.
      temperature: 0.8,
      topP: 0.97,
      topK: 64,
      tokens: 48000,
    }),
    momentSuggestions: feature({
      role: 'writing',
      promptType: 'communication_moment_suggestions',
      temperature: 0.7,
      tokens: 5000,
    }),
    // Contenu d'un moment : la légende est publiée telle quelle par
    // l'utilisateur — c'est de l'écriture, pas du remplissage de gabarit.
    moment: feature({
      role: 'reasoning',
      promptType: 'communication_moment',
      temperature: 0.75,
      topP: 0.95,
      topK: 50,
      tokens: 8000,
    }),
    // Image de fond du visuel : génération (modèle image) puis scan de vision
    // (sujet, humeur, couleurs dominantes, zones vides) qui nourrit ensuite la
    // composition. Les replis sont déclarés ICI plutôt que déduits de
    // `AI_CONFIG.fallback` : ce module doit pouvoir changer de modèle image
    // sans embarquer le repli texte global, et l'inverse.
    imageSourcing: {
      imageModel: GLM_MODELS.image,
      imageFallbackModel: GLM_MODELS.imageFallback,
      visionModel: GLM_MODELS.vision,
      visionFallbackModel: GLM_MODELS.visionFallback,
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

  branding: {
    brandIdentity: feature({
      ...COMPOSED_DOCUMENT,
      // Le défaut le plus visible de la charte était sa monotonie : douze pages
      // composées sur la même grille. Une température de 0.35 en était la cause
      // directe — à ce niveau, le modèle reproduit la mise en page la plus
      // probable, page après page.
      sampling: 'composition',
      thinking: true,
      tokens: 28000,
      // Sections de la charte (clés = `stepName` de branding.service.ts). Celles
      // qui portent du SVG demandent bien plus de budget que celles qui ne
      // produisent que de la mise en page : un SVG tronqué est inutilisable.
      sections: {
        // Couverture de la charte : la page la plus libre du document.
        'Brand Header': { sampling: 'divergent', tokens: 40000 },
        // Pages logo : elles PRÉSENTENT un logo déjà dessiné, elles ne le
        // redessinent pas. La composition peut donc diverger sans risque pour
        // la géométrie, qui est importée telle quelle.
        'Logo Principal': { tokens: 36000, temperature: 0.6 },
        'Logo Variation Fond Clair': { tokens: 30000, temperature: 0.6 },
        'Logo Variation Fond Sombre': { tokens: 30000, temperature: 0.6 },
        'Logo Variation Monochrome': { tokens: 30000, temperature: 0.6 },
        // Règles d'usage : du texte structuré, peu de balisage.
        'Logo Bonnes Pratiques': { tokens: 36000, temperature: 0.55 },
        // Nuanciers et spécimens : les VALEURS y sont exactes (hex, tailles),
        // la mise en page reste libre. On garde donc une divergence moyenne
        // plutôt que la précision — la page palette générique venait d'un 0.25.
        'Color Palette': { tokens: 26000, temperature: 0.6 },
        Typography: { tokens: 26000, temperature: 0.62 },
        // Page de direction artistique : elle doit DÉMONTRER le style en
        // construisant ses propres blocs de démonstration en CSS. C'est la page
        // la plus inventive de la charte après la couverture.
        'Direction Artistique': { tokens: 36000, temperature: 0.62 },
      },
    }),

    logo: feature({
      role: 'reasoning',
      // ⚠️ NE PAS RÉDUIRE. Les tokens de raisonnement sont décomptés du budget.
      // Un SVG de logo complet (types name/initial = paths de letterforms) pèse
      // déjà 2–4k tokens ; raisonnement + SVG sous un budget trop court tronque
      // la réponse → JSON cassé → "no usable SVG".
      tokens: 48000,
      // Le raisonnement est ici le vrai levier de qualité, pas la température.
      // Le prompt exige une construction PARAMÉTRIQUE (« calculer chaque
      // sommet, jamais à main levée ») : sans réflexion, le modèle ne calcule
      // pas, il approxime — d'où des symétries fausses au demi-point près.
      thinking: true,
      // Relevée de 0.28 à 0.45 : à 0.28 le modèle proposait l'archétype le plus
      // probable pour le secteur, c'est-à-dire le logo que tout le monde a. La
      // géométrie reste protégée par la construction paramétrique et par la
      // boucle critique → révision, pas par une température basse.
      temperature: 0.45,
      topP: 0.93,
      topK: 50,
      // Épinglé : un SVG géométriquement faux ou une direction artistique
      // inapplicable passent tous les contrôles automatiques. Sans détection,
      // pas d'escalade — donc pas de filet si l'on part trop bas.
      pin: true,
    }),

    /**
     * Palettes.
     *
     * Une température de 0.05 sur le petit modèle produisait toujours la même
     * réponse : le bleu de confiance, le vert de croissance, le violet
     * d'innovation. C'est mécaniquement la palette moyenne du secteur — donc la
     * palette de tous les concurrents. Le prompt encadre déjà les contraintes
     * dures (contrastes WCAG, rôles, 60/30/10) : la divergence peut donc monter
     * sans produire de palette inutilisable.
     *
     * RÔLE DE RÉDACTION, et non de raisonnement — conséquence directe du
     * `thinking: false` ci-dessous. Le modèle de raisonnement de Gemini est un
     * `pro`, et un `pro` REFUSE de ne pas raisonner : son plancher est
     * `thinkingLevel: 'low'`, soit ~350 tokens prélevés sur les 6 000 du budget
     * de sortie, pour une réflexion dont cette configuration a justement établi
     * qu'elle n'apportait plus rien.
     *
     * RAISONNEMENT COUPÉ — le code a repris la décision qu'il servait :
     * l'échappée hors de la palette moyenne vient de `buildPaletteConstraint`
     * (648 régions chromatiques tirées par projet, dans lesquelles le modèle
     * choisit). Le tirage est déterministe et ne dépend d'aucun modèle.
     */
    colors: feature({
      role: 'writing',
      temperature: 0.6,
      topP: 0.95,
      topK: 50,
      thinking: false,
      // Trois palettes complètes + justifications, sans réflexion à financer.
      tokens: 6000,
    }),

    /**
     * Appariements typographiques.
     *
     * La police est le levier le plus rapide pour qu'une marque cesse de
     * ressembler à toutes les autres, et le petit modèle à 0.3 ramenait
     * invariablement les familles les plus employées du web. Le prompt bannit
     * désormais ces familles et impose trois registres différents : il faut un
     * modèle capable d'arbitrer entre eux, et de la divergence pour ne pas
     * reproposer le même appariement à chaque projet.
     *
     * Rôle et raisonnement : même arbitrage que la palette ci-dessus. Le
     * REGISTRE est tiré par `buildTypographyConstraint`, et c'est lui qui
     * empêche de reproposer l'appariement le plus vu du web. Le modèle choisit
     * les familles à l'intérieur du registre — un arbitrage, pas une
     * délibération.
     */
    typography: feature({
      role: 'writing',
      temperature: 0.6,
      topP: 0.95,
      topK: 50,
      thinking: false,
      tokens: 6000,
    }),

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
    artDirection: feature({
      role: 'reasoning',
      sampling: 'divergent',
      thinking: true,
      // Le raisonnement se décompte du budget : un JSON de direction tronqué
      // est inutilisable, et il n'y a pas de repli à ce niveau.
      tokens: 24000,
      // Épinglé, même raison que le logo : l'échec n'est pas détectable, donc
      // il n'y a pas d'escalade pour le rattraper.
      pin: true,
    }),

    logoAnalysis: feature({ role: 'writing', temperature: 0.2, tokens: 2000, json: true }),

    // Template de carte de visite : deux faces HTML complètes + concept.
    // ⚠️ NE PAS RÉDUIRE `tokens`. Comme pour le logo, le modèle est « thinking » :
    // les tokens de raisonnement sont décomptés du budget. Deux faces de HTML
    // Tailwind pèsent déjà 2–4k tokens ; sous un budget trop court la réponse est
    // tronquée en plein milieu du HTML et devient illisible côté parseur.
    businessCard: feature({
      role: 'reasoning',
      sampling: 'composition',
      thinking: true,
      tokens: 40000,
    }),

    /**
     * Mise en situation de marque. Deux modèles, deux rôles distincts :
     * l'un PHOTOGRAPHIE le support nu, l'autre LIT la photo pour dire où le
     * logo doit être imprimé. Sans cette seconde lecture, le logo retombait au
     * centre géométrique de l'image, souvent à côté du support.
     */
    brandMockup: {
      imageModel: GLM_MODELS.image,
      visionModel: GLM_MODELS.vision,
      visionFallbackModel: GLM_MODELS.visionFallback,
      // Le JSON de zone tient en ~60 tokens, mais le modèle est « thinking » :
      // son raisonnement se décompte du même budget et une réponse vide ferait
      // retomber la composition sur son repli, donc sur un placement à l'aveugle.
      visionMaxOutputTokens: 1500,
    },
  },
};

/**
 * Budget de sortie d'une section rendue par gabarit.
 *
 * Une page A4 pleine porte 550 à 700 mots utiles, soit ~900 tokens ; le contenu
 * structuré qui les transporte tient largement sous 6 000, blocs et libellés
 * compris. Le reste de l'ancien budget servait à écrire du balisage — la partie
 * que le rendu produit désormais gratuitement, et instantanément.
 */
export const TEMPLATE_OUTPUT_TOKENS = Number(process.env.IDEM_TEMPLATE_OUTPUT_TOKENS ?? 6000);

/**
 * Réglages imposés à toute étape rendue par GABARIT.
 *
 * ── POURQUOI LE RAISONNEMENT EST COUPÉ ICI ──────────────────────────────────
 *
 * Le raisonnement se justifiait par ce qu'on demandait au modèle : arbitrer une
 * mise en page, tenir une charte, décider d'un angle. Le code a repris les
 * trois — le gabarit compose, le linter tient la charte, l'étape de plan décide
 * l'angle. Il ne reste à ce prompt qu'à ÉCRIRE ce qui a déjà été décidé, et
 * réfléchir pour écrire ne rapporte rien : cela se décompte du budget de sortie
 * et se paie en latence, deux fois.
 *
 * ── POURQUOI ICI, ET PAS DANS LES CONFIGURATIONS ────────────────────────────
 *
 * Trois features sont MIXTES : leurs sections passent par le gabarit, mais leur
 * couverture reste en composition libre — et là, le modèle compose vraiment.
 * Couper au niveau de la feature dégraderait donc exactement les pages qui
 * n'ont aucun filet. Couper sur le CHEMIN sépare les deux sans arbitrage
 * manuel, vaut pour toute section templatée à venir, et ne peut pas être
 * oublié en ajoutant une feature.
 *
 * ── POURQUOI LES DEUX DIALECTES ─────────────────────────────────────────────
 *
 * `thinkingBudget` pour Gemini, `extraBody.thinking` pour les fournisseurs
 * openai-compatible. Une coupure qui ne parle qu'un dialecte ne survit pas à
 * une bascule de fournisseur — c'est-à-dire au seul moment où elle compte.
 * C'est la même règle que `feature({ thinking: false })` applique aux
 * configurations ; ici elle s'applique au CHEMIN, après leur résolution.
 */
export function templatedLlmOptions(base?: LLMOptions): Partial<LLMOptions> {
  return {
    // Le gabarit change la NATURE de la sortie : ~2 500 tokens de contenu
    // structuré au lieu de ~10 000 de balisage.
    maxOutputTokens: TEMPLATE_OUTPUT_TOKENS,
    jsonMode: true,
    thinkingBudget: 0,
    extraBody: { ...base?.extraBody, thinking: { type: 'disabled' } },
  };
}
