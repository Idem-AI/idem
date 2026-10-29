/**
 * BUDGETS DE GÉNÉRATION — ce que chaque génération IA peut consommer, et ce que cela coûte.
 *
 * Le prix d'une action (en francs, modèle au portefeuille) ne vaut que s'il couvre le coût de ce qu'il fait tourner. Ce
 * fichier décrit, pour CHAQUE action facturée (et chaque aide gratuite), l'ENVELOPPE de jetons d'une
 * génération : quelles étapes appellent quel modèle, combien de fois, avec combien de jetons en
 * entrée et en sortie — en valeur typique et en plafond. Multipliée par le tarif OpenRouter du modèle
 * (`openrouter.config.ts`, relevé sur l'API publique), l'enveloppe donne :
 *
 *   - le COÛT typique et plafond d'une génération, à chaque cran de créativité ;
 *   - le PRIX MINIMUM en francs qui garantit de ne jamais perdre d'argent ;
 *   - le BUDGET d'exécution : au-delà, la génération est signalée (mode `log`) ou arrêtée (`enforce`).
 *
 * Deux valeurs nettes d'un franc de prix encadrent le calcul (cf. `CREDIT_VALUE_XAF`) : la valeur
 * PLANCHER (pire grille pays, bonus maximal) et la valeur de RÉFÉRENCE (frais seuls). Les règles :
 *
 *   R1 · jamais à perte  : coût plafond ≤ prix × valeur plancher ;
 *   R2 · très rentable   : coût typique ≤ 25 % du prix × valeur de référence (marge ≥ 75 %).
 *
 * `npm run quotas:matrix` écrit `docs/QUOTAS.md` depuis ce fichier ; `npm run check:quotas` échoue si
 * une action facturée n'a pas d'enveloppe. Les enveloppes sont des ESTIMATIONS tirées des plafonds
 * configurés et des volumes mesurés en développement ; `npm run quotas:calibrate` les confronte au
 * journal réel (`ai_usage_events`) — une enveloppe se corrige ici, jamais dans le code appelant.
 *
 * Les modèles se lisent dans la configuration (`cfg:<chemin AI_CONFIG>`), dans les échelles de crans
 * (`ladder:design`, `ladder:code`, `ladder:code+1` pour la réparation qui monte d'un cran) ou par rôle
 * (`role:mechanical`…) : quand un modèle change, le coût suit sans toucher à ce fichier.
 */
import type { BillingEngine } from '../models/billing.model';
import { getXafPerUsd } from '../models/billing.model';
import { CREATIVITY_LEVELS, CreativityLevel } from '../models/creativity.model';
import { DELIVERABLES, ICODE, KIT_CAP_XAF, KIT_SUM_XAF, SIGNATURE_PRICE_XAF } from '../models/offer.model';
import { policyFor } from '../services/billing/action-policy';
import type { QuotaGroup } from '../models/usage-quota.model';
import { AI_CONFIG } from './ai.config';
import { getModelPricing } from './ai-pricing.config';
import { ladderModel } from './ai-models.config';
import { CODE_MODEL, OPENROUTER_DEFAULT_ROLES, OPENROUTER_MEDIA, findOpenRouterModel } from './openrouter.config';

// ============================================
// VALEUR D'UN FRANC DE PRIX
// ============================================

/**
 * Ce que rapporte réellement 1 F de prix affiché, NET (modèle au portefeuille, `offer.model.ts`).
 *
 * Le nom historique est gardé (les rapports et scénarios le lisent) ; l'unité est désormais le
 * franc, plus le crédit :
 * - `floor` : le pire cas — frais d'encaissement (~3 %), bonus de recharge maximal (10 %) et
 *   grille pays la plus basse (écart borné) : 0,85 F net par franc affiché ;
 * - `reference` : le cas courant — frais d'encaissement seuls : 0,97 F.
 *
 * Les droits OFFERTS (bêta, cadeau d'accueil, esquisses) valent zéro : leur coût est borné par les
 * quotas, pas par le prix.
 */
export const CREDIT_VALUE_XAF = { floor: 0.85, reference: 0.97 } as const;

/** Marge brute visée sur le coût TYPIQUE, à la valeur de référence (R2). */
export const TARGET_TYPICAL_MARGIN = 0.75;

// ============================================
// PRIX DES MÉDIAS (hors jetons)
// ============================================

/**
 * Coûts unitaires qu'OpenRouter ne facture pas au jeton.
 *
 * - `web_result` : le greffon `web` d'OpenRouter (moteur Exa) facture 4 $ pour 1 000 résultats.
 *   ⚠ Ce coût n'est PAS encore inscrit au journal `ai_usage_events` (seuls les jetons le sont).
 * - `image` : FLUX.2 klein (le modèle d'image par défaut), une image d'un mégapixel.
 * - `image_gemini` : Gemini 3.1 Flash Image (mises en situation de la charte), ~1 290 jetons image.
 * - `video_second` : clip vidéo généré (Seedance 2.0 / Veo 3.1 Fast). OpenRouter ne publie pas ce
 *   prix dans son API : valeur à confirmer sur la facture (Veo Fast public : 0,10 à 0,15 $/s).
 * - `speech_char` : voix off Kokoro, 0,62 $ par million de caractères.
 */
export const MEDIA_UNIT_USD = {
  web_result: 0.004,
  image: findOpenRouterModel(OPENROUTER_MEDIA.image)?.pricing?.perImage ?? 0.0034,
  image_gemini: findOpenRouterModel('google/gemini-3.1-flash-image')?.pricing?.perImage ?? 0.077,
  video_second: 0.12,
  speech_char: 0.62 / 1_000_000,
} as const;

export type MediaUnit = keyof typeof MEDIA_UNIT_USD;

// ============================================
// ENVELOPPES
// ============================================

/** [valeur typique, plafond]. */
export type Range = readonly [number, number];

/** Une étape qui appelle un modèle de texte. */
export interface CallLine {
  step: string;
  /** Identifiant OpenRouter, `cfg:<chemin AI_CONFIG>`, `role:<rôle>`, `ladder:design|code|code+1`, ou `code`. */
  model: string;
  /** Nombre d'appels par génération. */
  calls: Range;
  /** Jetons d'entrée PAR appel. */
  input: Range;
  /** Jetons de sortie PAR appel (raisonnement compris). */
  output: Range;
}

/** Une étape facturée à l'unité (recherche web, image, seconde de vidéo, voix). */
export interface MediaLine {
  step: string;
  unit: MediaUnit;
  count: Range;
}

export interface GenerationEnvelope {
  label: string;
  /** Moteur facturé ; `free` pour une aide IA gratuite. */
  engine: BillingEngine | 'free';
  /** Action du barème (ou nom de l'aide gratuite). */
  action: string;
  group: QuotaGroup;
  /** Le cran de créativité choisit les modèles `ladder:*` ET multiplie le prix. */
  creativity: boolean;
  calls: CallLine[];
  media?: MediaLine[];
  /** Points d'entrée qui déclenchent cette génération. */
  entrypoints: string[];
  /** Ce que le lecteur doit savoir : hypothèse, écart connu, recommandation. */
  note?: string;
}

const r = (typical: number, max: number): Range => [typical, max];

/**
 * Les enveloppes, clé `<moteur>.<action>` (`free.<aide>` pour les aides gratuites).
 *
 * Volumes typiques : mesurés sur le trafic de développement (sortie du rédacteur de section ~2 400
 * jetons, de section de business plan ~1 100, page d'auteur ~5 000) ; plafonds : les `maxOutputTokens`
 * configurés pour l'étape, le nombre maximal de sections, pages ou scènes, et les reprises bornées.
 */
export const GENERATION_ENVELOPES: Record<string, GenerationEnvelope> = {
  // ── iBusiness : livrables phares ─────────────────────────────────────────
  'business.business_plan': {
    label: 'Business plan complet',
    engine: 'business',
    action: 'business_plan',
    group: 'flagship',
    creativity: true,
    entrypoints: ['GET /project/businessPlans/generate/:projectId'],
    calls: [
      { step: 'Recherche sourcée (synthèse)', model: 'role:mechanical', calls: r(14, 54), input: r(6000, 9000), output: r(1200, 1536) },
      { step: 'Rédaction des sections', model: 'cfg:businessPlan', calls: r(12, 18), input: r(12000, 16000), output: r(2500, 10000) },
      { step: 'Vérification des chiffres', model: 'role:mechanical', calls: r(12, 18), input: r(8000, 12000), output: r(600, 1024) },
      { step: 'Correction après vérification', model: 'cfg:businessPlan', calls: r(3, 18), input: r(14000, 18000), output: r(2500, 10000) },
      { step: 'Direction du document', model: 'ladder:design', calls: r(1, 2), input: r(12000, 16000), output: r(2000, 2500) },
      { step: 'Écriture des pages (HTML)', model: 'ladder:code', calls: r(13, 19), input: r(14000, 18000), output: r(5000, 12000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 6), input: r(16000, 18000), output: r(5000, 12000) },
      { step: 'Couverture (sur-titre et promesse)', model: 'cfg:coverBrief', calls: r(1, 1), input: r(3000, 3000), output: r(1200, 1500) },
    ],
    media: [{ step: 'Résultats de recherche web', unit: 'web_result', count: r(112, 648) }],
    note:
      'La recherche web pèse la moitié du coût typique (jusqu’à 3 recherches de 12 résultats par section). ' +
      'Leviers : 6 résultats par recherche, 2 recherches par section, réutilisation des recherches déjà payées (secteur × pays), ' +
      'rédacteur sur un modèle ouvert (DeepSeek V4 Flash : sortie ~20× moins chère que Gemini 3.8 Flash).',
  },
  'business.business_plan_relayout': {
    label: 'Business plan — nouvelle mise en page',
    engine: 'business',
    action: 'business_plan_relayout',
    group: 'flagship',
    creativity: true,
    entrypoints: ['POST /project/businessPlans/:projectId/relayout'],
    calls: [
      { step: 'Direction du document', model: 'ladder:design', calls: r(1, 1), input: r(12000, 16000), output: r(2000, 2500) },
      { step: 'Écriture des pages (HTML)', model: 'ladder:code', calls: r(13, 19), input: r(14000, 18000), output: r(5000, 12000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 4), input: r(16000, 18000), output: r(5000, 12000) },
    ],
  },
  'business.pitch_deck': {
    label: 'Pitch deck',
    engine: 'business',
    action: 'pitch_deck',
    group: 'flagship',
    creativity: true,
    entrypoints: ['GET /project/pitch-deck/generate/:projectId'],
    calls: [
      { step: 'Rédaction des slides', model: 'cfg:pitchDeck', calls: r(9, 11), input: r(8000, 12000), output: r(2000, 6000) },
      { step: 'Direction du document', model: 'ladder:design', calls: r(1, 2), input: r(10000, 14000), output: r(2000, 2500) },
      { step: 'Écriture des slides (HTML)', model: 'ladder:code', calls: r(9, 11), input: r(12000, 16000), output: r(4000, 8000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 3), input: r(12000, 16000), output: r(4000, 8000) },
      { step: 'Couverture (sur-titre et promesse)', model: 'cfg:coverBrief', calls: r(0, 1), input: r(3000, 3000), output: r(1200, 1500) },
    ],
  },
  'business.pitch_deck_relayout': {
    label: 'Pitch deck — nouvelle mise en page',
    engine: 'business',
    action: 'pitch_deck_relayout',
    group: 'flagship',
    creativity: true,
    entrypoints: ['POST /project/pitch-deck/:projectId/relayout'],
    calls: [
      { step: 'Direction du document', model: 'ladder:design', calls: r(1, 1), input: r(10000, 14000), output: r(2000, 2500) },
      { step: 'Écriture des slides (HTML)', model: 'ladder:code', calls: r(9, 11), input: r(12000, 16000), output: r(4000, 8000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 2), input: r(12000, 16000), output: r(4000, 8000) },
    ],
  },
  'business.logo_brand': {
    label: 'Logo et charte graphique',
    engine: 'business',
    action: 'logo_brand',
    group: 'flagship',
    creativity: true,
    entrypoints: ['GET /project/brandings/generate/:projectId', 'POST /project/brandings/generate/logo-concepts/:projectId'],
    calls: [
      { step: 'Moteur de logos (toujours Ultra)', model: 'deepseek/deepseek-v4-pro', calls: r(8, 16), input: r(8000, 10000), output: r(3000, 6000) },
      { step: 'Direction artistique, couleurs, typographie', model: 'cfg:branding.artDirection', calls: r(3, 4), input: r(8000, 12000), output: r(3000, 8000) },
      { step: 'Sections de la charte', model: 'cfg:branding.brandIdentity', calls: r(11, 12), input: r(10000, 14000), output: r(3000, 8000) },
      { step: 'Direction du document', model: 'ladder:design', calls: r(1, 1), input: r(10000, 14000), output: r(2000, 2500) },
      { step: 'Écriture des pages (HTML)', model: 'ladder:code', calls: r(12, 14), input: r(12000, 16000), output: r(5000, 10000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 3), input: r(12000, 16000), output: r(5000, 10000) },
    ],
    media: [
      { step: 'Mises en situation (Gemini Image)', unit: 'image_gemini', count: r(2, 2) },
      { step: 'Motifs et visuels (FLUX.2)', unit: 'image', count: r(2, 6) },
    ],
    note: 'Le logo tourne au cran Ultra quel que soit le cran choisi ; le cran ne joue que sur les pages de la charte.',
  },
  'business.legal_kit': {
    label: 'Kit juridique OHADA',
    engine: 'business',
    action: 'legal_kit',
    group: 'flagship',
    creativity: false,
    entrypoints: ['POST /project/legal-docs/generate/:projectId', 'GET /project/legal-docs/generate/:projectId'],
    calls: [
      { step: 'Rédaction des actes (statuts, pacte, CGV/CGU…)', model: 'cfg:legalDocs', calls: r(4, 6), input: r(8000, 12000), output: r(5000, 12000) },
      { step: 'Contexte et recommandations', model: 'role:mechanical', calls: r(1, 2), input: r(4000, 6000), output: r(800, 1500) },
    ],
  },
  'business.financial_forecast': {
    label: 'Prévisions financières 3 ans',
    engine: 'business',
    action: 'financial_forecast',
    group: 'flagship',
    creativity: false,
    entrypoints: ['POST /project/finance/:projectId/ai-fill-all', 'GET /project/finance/:projectId/ai-fill-stream'],
    calls: [
      { step: 'Remplissage du prévisionnel', model: 'cfg:finance.autofill', calls: r(1, 6), input: r(12000, 20000), output: r(6000, 12000) },
      { step: 'Lecture de l’intention', model: 'cfg:finance.intent', calls: r(1, 2), input: r(2000, 3000), output: r(300, 1024) },
    ],
    note: 'Les chiffres sont recalculés par le code (`finance.computed`) : le modèle propose des hypothèses, il ne recopie aucun total.',
  },
  'business.procedures_manual': {
    label: 'Manuel de procédures (feuille de route)',
    engine: 'business',
    action: 'procedures_manual',
    group: 'flagship',
    creativity: false,
    entrypoints: [],
    calls: [{ step: 'Rédaction des procédures', model: 'role:writing', calls: r(8, 12), input: r(8000, 12000), output: r(3000, 8000) }],
    note: 'Pas encore commercialisé : enveloppe prévisionnelle.',
  },

  // ── iBusiness : communication ────────────────────────────────────────────
  'business.communication_strategy': {
    label: 'Stratégie de communication',
    engine: 'business',
    action: 'communication_strategy',
    group: 'create',
    creativity: false,
    entrypoints: ['GET /project/communication/:projectId/generate-strategy'],
    calls: [
      { step: 'Stratégie', model: 'cfg:communication.strategy', calls: r(1, 1), input: r(10000, 14000), output: r(6000, 16000) },
      { step: 'Contexte et tendances', model: 'cfg:communication.context', calls: r(2, 2), input: r(3000, 4000), output: r(1500, 2500) },
    ],
  },
  'business.editorial_calendar': {
    label: 'Calendrier éditorial',
    engine: 'business',
    action: 'editorial_calendar',
    group: 'create',
    creativity: false,
    entrypoints: ['GET /project/communication/:projectId/generate-calendar'],
    calls: [{ step: 'Calendrier', model: 'cfg:communication.calendar', calls: r(1, 1), input: r(10000, 14000), output: r(8000, 20000) }],
  },
  'business.communication_plan': {
    label: 'Période de communication',
    engine: 'business',
    action: 'communication_plan',
    group: 'create',
    creativity: false,
    entrypoints: ['GET /project/communication/:projectId/plans/:planId/generate'],
    calls: [
      { step: 'Brief de la période', model: 'cfg:communication.planBrief', calls: r(1, 1), input: r(8000, 10000), output: r(3000, 8000) },
      { step: 'Contenus datés', model: 'cfg:communication.planContent', calls: r(1, 1), input: r(10000, 12000), output: r(8000, 20000) },
      { step: 'Occasions', model: 'cfg:communication.occasions', calls: r(0, 1), input: r(3000, 3000), output: r(1500, 4000) },
    ],
  },
  'business.flyer': {
    label: 'Visuel / flyer',
    engine: 'business',
    action: 'flyer',
    group: 'create',
    creativity: true,
    entrypoints: ['POST /project/communication/:projectId/visuals', 'POST /project/communication/:projectId/flyer/:contentId', 'iVision · visuel'],
    calls: [
      { step: 'Rédaction du visuel', model: 'cfg:communication.imageBrief', calls: r(1, 1), input: r(5000, 7000), output: r(800, 1200) },
      { step: 'Écriture de la page (HTML)', model: 'ladder:code', calls: r(1, 1), input: r(8000, 10000), output: r(3000, 6000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(0, 1), input: r(8000, 10000), output: r(3000, 6000) },
    ],
    media: [{ step: 'Photo générée (FLUX.2)', unit: 'image', count: r(0.5, 1) }],
  },
  'business.ai_visual': {
    label: 'Visuel 100 % généré par IA',
    engine: 'business',
    action: 'ai_visual',
    group: 'create',
    creativity: true,
    entrypoints: [],
    calls: [
      { step: 'Rédaction du visuel', model: 'cfg:communication.imageBrief', calls: r(1, 1), input: r(5000, 7000), output: r(800, 1200) },
      { step: 'Écriture de la page (HTML)', model: 'ladder:code', calls: r(1, 1), input: r(8000, 10000), output: r(3000, 6000) },
    ],
    media: [{ step: 'Image générée (Gemini Image)', unit: 'image_gemini', count: r(1, 1) }],
    note: 'À 100 F, une image générée par un modèle coûteux mange le prix au plancher : rester sur FLUX.2 (20× moins cher).',
  },
  'business.carousel': {
    label: 'Carrousel (jusqu’à 10 vues)',
    engine: 'business',
    action: 'carousel',
    group: 'create',
    creativity: true,
    entrypoints: [],
    calls: [
      { step: 'Rédaction des vues', model: 'cfg:communication.imageBrief', calls: r(1, 1), input: r(6000, 8000), output: r(2000, 3000) },
      { step: 'Écriture des vues (HTML)', model: 'ladder:code', calls: r(6, 10), input: r(8000, 10000), output: r(3000, 5000) },
    ],
  },
  'business.business_card': {
    label: 'Carte de visite',
    engine: 'business',
    action: 'business_card',
    group: 'create',
    creativity: true,
    entrypoints: ['POST /project/business-card/:projectId/generate'],
    calls: [
      { step: 'Contenu de la carte', model: 'cfg:branding.businessCard', calls: r(1, 1), input: r(6000, 8000), output: r(1500, 4000) },
      { step: 'Écriture du gabarit (recto, verso)', model: 'ladder:code', calls: r(2, 2), input: r(9000, 11000), output: r(3000, 6000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(0, 2), input: r(9000, 11000), output: r(3000, 6000) },
    ],
  },
  'business.motion_video': {
    label: 'Vidéo motion design (15 s, 1 format, HD)',
    engine: 'business',
    action: 'motion_video',
    group: 'video',
    creativity: true,
    entrypoints: ['POST /project/communication/:projectId/videos', 'POST /project/communication/:projectId/videos/stream', 'iVision · vidéo'],
    calls: [
      { step: 'Compréhension de la demande', model: 'cfg:communication.videoAgents', calls: r(1, 2), input: r(3000, 4000), output: r(300, 600) },
      { step: 'Concept du film', model: 'ladder:design', calls: r(1, 1), input: r(8000, 10000), output: r(1500, 2500) },
      { step: 'Storyboard', model: 'ladder:design', calls: r(1, 1), input: r(10000, 12000), output: r(4000, 9000) },
      { step: 'Code de chaque scène', model: 'ladder:code', calls: r(5, 8), input: r(12000, 14000), output: r(4000, 8000) },
      { step: 'Réparation technique (cran +1)', model: 'ladder:code+1', calls: r(1, 3), input: r(12000, 14000), output: r(4000, 8000) },
    ],
    media: [
      { step: 'Photos générées (FLUX.2)', unit: 'image', count: r(2, 6) },
      { step: 'Clips générés (Seedance / Veo)', unit: 'video_second', count: r(0, 10) },
      { step: 'Voix off (Kokoro)', unit: 'speech_char', count: r(300, 1200) },
    ],
    note: 'Prix et enveloppe suivent le périmètre (durée × formats × qualité, `video/pricing.ts`). Les clips générés dominent le plafond : 3 essais au plus, puis banque d’images.',
  },
  'business.motion_video_rerender': {
    label: 'Vidéo — nouvel export',
    engine: 'business',
    action: 'motion_video_rerender',
    group: 'video',
    creativity: false,
    entrypoints: ['POST /project/communication/:projectId/videos/:videoId/export'],
    calls: [
      { step: 'Lecture de la retouche', model: 'ladder:design', calls: r(0, 1), input: r(4000, 8000), output: r(500, 800) },
      { step: 'Scènes réécrites', model: 'ladder:code', calls: r(0, 2), input: r(12000, 14000), output: r(4000, 8000) },
    ],
  },
  'business.short_video': {
    label: 'Clip vidéo IA (8 s)',
    engine: 'business',
    action: 'short_video',
    group: 'video',
    creativity: false,
    entrypoints: [],
    calls: [{ step: 'Prompt du clip', model: 'cfg:communication.videoWriting', calls: r(1, 1), input: r(3000, 4000), output: r(500, 1600) }],
    media: [{ step: 'Clip généré', unit: 'video_second', count: r(8, 8) }],
    note: 'Clip de site à 1 000 F : préférer Seedance 2.0 Mini, un clip Veo 3.1 Fast de 8 s ne couvre pas son coût au plancher.',
  },

  // ── iBusiness : retouches et créations courantes ─────────────────────────
  'business.revision': {
    label: 'Retouche IA (révision)',
    engine: 'business',
    action: 'revision',
    group: 'edit',
    creativity: false,
    entrypoints: [
      'POST …/sections/:sectionId/ai-edit (plan, deck, carte, charte)',
      'POST /project/advisor/:projectId/messages',
      'POST /project/finance/:projectId/ai-fill/:section, chat/parse, import/analyze',
      'GET /project/diagrams/generate/:projectId',
      'POST …/colors-typography, art-direction, moments, extract-context, declinate',
    ],
    calls: [
      { step: 'Retouche du texte', model: 'cfg:businessPlan', calls: r(1, 1), input: r(8000, 16000), output: r(1200, 3000) },
      { step: 'Page réécrite par l’auteur (si forme demandée)', model: 'ladder:code', calls: r(0.3, 1), input: r(14000, 16000), output: r(5000, 8000) },
    ],
    note:
      '« Révision » recouvre des usages de coût très différents (une phrase, une page réécrite, un relevé bancaire analysé). ' +
      'Une retouche est incluse 30 jours après la version finale (et avec Croissance), sinon 100 F : la page réécrite et l’import de document sont couverts à ce prix ; à surveiller dans le journal d’usage.',
  },
  'business.brand_regenerate': {
    label: 'Nouvelles palettes / polices',
    engine: 'business',
    action: 'brand_regenerate',
    group: 'edit',
    creativity: false,
    entrypoints: ['POST /project/brandings/:projectId/identity/jobs/palettes|fonts'],
    calls: [{ step: 'Propositions', model: 'cfg:branding.colors', calls: r(1, 1), input: r(6000, 10000), output: r(2000, 6000) }],
  },
  'business.logo_relaunch': {
    label: 'Relance de logos',
    engine: 'business',
    action: 'logo_relaunch',
    group: 'create',
    creativity: false,
    entrypoints: ['POST /project/brandings/edit-logo/:projectId', 'relance de session de logo'],
    calls: [{ step: 'Moteur de logos (Ultra)', model: 'deepseek/deepseek-v4-pro', calls: r(4, 8), input: r(8000, 10000), output: r(3000, 6000) }],
    media: [{ step: 'Images de référence', unit: 'image', count: r(0, 2) }],
  },
  'business.logo_regenerate': {
    label: 'Nouveaux logos depuis le panneau',
    engine: 'business',
    action: 'logo_regenerate',
    group: 'create',
    creativity: false,
    entrypoints: ['POST /project/brandings/:projectId/identity/jobs/logos'],
    calls: [{ step: 'Moteur de logos (Ultra)', model: 'deepseek/deepseek-v4-pro', calls: r(4, 8), input: r(8000, 10000), output: r(3000, 6000) }],
  },

  // ── iCode ────────────────────────────────────────────────────────────────
  'appgen.initial_generation': {
    label: 'Génération initiale d’une application (gratuite)',
    engine: 'appgen',
    action: 'initial_generation',
    group: 'appgen_initial',
    creativity: false,
    entrypoints: ['AppGen · première demande (POST /billing/consume)'],
    calls: [{ step: 'Agent de code', model: 'code', calls: r(2, 5), input: r(25000, 60000), output: r(6000, 16000) }],
    note: 'Gratuite par choix (« générer est gratuit, posséder se paie ») : c’est un coût d’acquisition, borné par le quota du jour.',
  },
  'appgen.message': {
    label: 'iCode — message / planification',
    engine: 'appgen',
    action: 'message',
    group: 'appgen_edit',
    creativity: false,
    entrypoints: ['AppGen · chat (POST /billing/consume)'],
    calls: [{ step: 'Agent de code', model: 'code', calls: r(1, 1), input: r(20000, 60000), output: r(1000, 4000) }],
  },
  'appgen.build': {
    label: 'iCode — build standard',
    engine: 'appgen',
    action: 'build',
    group: 'appgen_edit',
    creativity: false,
    entrypoints: ['AppGen · modification (POST /billing/consume)'],
    calls: [{ step: 'Agent de code', model: 'code', calls: r(1, 3), input: r(40000, 120000), output: r(6000, 16000) }],
    note: 'Le contexte du projet entier repart à chaque tour : le cache d’entrée d’OpenRouter (−40 % sur Qwen3 Coder Next) est le premier levier.',
  },
  'appgen.premium': {
    label: 'iCode — action premium',
    engine: 'appgen',
    action: 'premium',
    group: 'appgen_edit',
    creativity: false,
    entrypoints: ['AppGen · modèle premium (POST /billing/consume)'],
    calls: [{ step: 'Agent de code (480B)', model: 'qwen/qwen3-coder', calls: r(1, 3), input: r(40000, 120000), output: r(6000, 16000) }],
  },
  'appgen.site_image': {
    label: 'iCode — image de site générée',
    engine: 'appgen',
    action: 'site_image',
    group: 'appgen_edit',
    creativity: false,
    entrypoints: ['POST /appgen/media/image'],
    calls: [],
    media: [{ step: 'Image générée', unit: 'image', count: r(1, 2) }],
  },
  'appgen.site_video': {
    label: 'iCode — clip vidéo de site (5-6 s)',
    engine: 'appgen',
    action: 'site_video',
    group: 'appgen_edit',
    creativity: false,
    entrypoints: ['POST /appgen/media/video'],
    calls: [],
    media: [{ step: 'Clip généré', unit: 'video_second', count: r(5, 6) }],
  },

  // ── Aides IA gratuites (quota `assist`) ──────────────────────────────────
  'free.onboarding': {
    label: 'Onboarding (questions, lecture des réponses)',
    engine: 'free',
    action: 'onboarding',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /onboarding/questions', 'POST /onboarding/parse'],
    calls: [{ step: 'Questions / lecture', model: 'cfg:onboarding.default', calls: r(1, 1), input: r(2000, 4000), output: r(500, 2048) }],
  },
  'free.prompt': {
    label: 'Amélioration de la demande, « J’ai de la chance »',
    engine: 'free',
    action: 'prompt',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /prompt/prompt', 'POST /prompt/improve', 'POST /prompt/feeling-lucky'],
    calls: [{ step: 'Reformulation', model: 'role:writing', calls: r(1, 1), input: r(2000, 6000), output: r(500, 3000) }],
  },
  'free.occasions': {
    label: 'Occasions de communication',
    engine: 'free',
    action: 'occasions',
    group: 'assist',
    creativity: false,
    entrypoints: ['GET /project/communication/:projectId/occasions'],
    calls: [{ step: 'Occasions', model: 'cfg:communication.occasions', calls: r(1, 1), input: r(2000, 3000), output: r(1500, 4000) }],
  },
  'free.studio': {
    label: 'Assistant du studio de communication',
    engine: 'free',
    action: 'studio',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/communication/:projectId/studio/message'],
    calls: [{ step: 'Réponse', model: 'cfg:communication.studio', calls: r(1, 2), input: r(6000, 12000), output: r(1500, 6000) }],
  },
  'free.video_assist': {
    label: 'Vidéo : interprétation et amélioration de la demande',
    engine: 'free',
    action: 'video_assist',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST …/videos/interpret', 'POST …/videos/enhance'],
    calls: [{ step: 'Lecture', model: 'cfg:communication.video', calls: r(1, 2), input: r(3000, 8000), output: r(400, 900) }],
  },
  'free.video_revise': {
    label: 'Vidéo : retouche écrite (textes, voix, musique, scène)',
    engine: 'free',
    action: 'video_revise',
    group: 'edit',
    creativity: false,
    entrypoints: ['POST …/videos/:videoId/revise'],
    calls: [
      { step: 'Lecture de la retouche', model: 'ladder:design', calls: r(1, 1), input: r(4000, 8000), output: r(500, 900) },
      { step: 'Scène réécrite par l’auteur', model: 'ladder:code', calls: r(0, 2), input: r(12000, 14000), output: r(4000, 8000) },
    ],
    media: [{ step: 'Voix off redite', unit: 'speech_char', count: r(0, 600) }],
    note: 'Gratuite (l’export suivant est facturé « nouvel export ») : bornée par le quota « Retouches IA ».',
  },
  'free.coherence': {
    label: 'Contrôle de cohérence du projet',
    engine: 'free',
    action: 'coherence',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/coherence/:projectId/check'],
    calls: [{ step: 'Audit', model: 'role:writing', calls: r(1, 1), input: r(8000, 20000), output: r(1500, 4000) }],
  },
  'free.finance_assist': {
    label: 'Finance : suggestions',
    engine: 'free',
    action: 'finance_assist',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/finance/:projectId/ai-suggestions'],
    calls: [{ step: 'Suggestions', model: 'cfg:finance.intent', calls: r(1, 1), input: r(3000, 6000), output: r(500, 1024) }],
  },
  'free.logo_analysis': {
    label: 'Analyse d’un logo importé',
    engine: 'free',
    action: 'logo_analysis',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /logo/analyze'],
    calls: [{ step: 'Lecture du logo', model: 'cfg:branding.logoAnalysis', calls: r(1, 1), input: r(3000, 6000), output: r(800, 2000) }],
  },
  'free.simulation_analysis': {
    label: 'Simulation : pré-analyse (avant paiement)',
    engine: 'free',
    action: 'simulation_analysis',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/simulation/:projectId/analysis', 'POST /project/simulation/import/analysis'],
    calls: [{ step: 'Compréhension du projet', model: 'cfg:simulation.understanding', calls: r(1, 1), input: r(8000, 30000), output: r(2000, 8192) }],
  },
  'free.deployment': {
    label: 'Déploiement : assistant et configuration',
    engine: 'free',
    action: 'deployment',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/deployments/generate', 'POST /project/deployments/chat'],
    calls: [{ step: 'Assistant', model: 'cfg:deployment.terraform', calls: r(1, 1), input: r(4000, 8000), output: r(800, 4000) }],
  },
  'free.site_import': {
    label: 'iVision / iCode : projet créé depuis un site',
    engine: 'free',
    action: 'site_import',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /internal/ivision/projects/from-site', 'POST /appgen/site-import'],
    calls: [
      { step: 'Lecture des pages', model: 'role:vision', calls: r(2, 4), input: r(3000, 6000), output: r(600, 1400) },
      { step: 'Rédaction du projet', model: 'cfg:communication.videoWriting', calls: r(1, 2), input: r(6000, 10000), output: r(800, 1600) },
    ],
  },

  // ── iSimulate (vendu à l'acte, en F CFA) ─────────────────────────────────
  'free.simulation_run': {
    label: 'Simulation (exécution standard)',
    engine: 'free',
    action: 'simulation_run',
    group: 'simulation',
    creativity: false,
    entrypoints: ['POST /project/simulation/:projectId', 'POST /project/simulation/import/run'],
    calls: [
      { step: 'Facteurs du secteur', model: 'cfg:simulation.factors', calls: r(1, 1), input: r(10000, 20000), output: r(6000, 20000) },
      { step: 'Scénarios', model: 'cfg:simulation.scenarios', calls: r(2, 6), input: r(10000, 16000), output: r(4000, 8192) },
      { step: 'Analyse et recommandations', model: 'cfg:simulation.analysis', calls: r(2, 3), input: r(12000, 20000), output: r(3000, 8192) },
    ],
    media: [{ step: 'Résultats de recherche web', unit: 'web_result', count: r(25, 60) }],
    note: 'Facturée à l’acte depuis le portefeuille (1 500 à 9 500 F) : la marge se lit sur le prix de l’offre.',
  },
  'free.simulation_extra': {
    label: 'Simulation : rapport complet ou laboratoire',
    engine: 'free',
    action: 'simulation_extra',
    group: 'assist',
    creativity: false,
    entrypoints: ['POST /project/simulation/:projectId/:simulationId/report', 'POST …/labs/:lab'],
    calls: [{ step: 'Rapport / laboratoire', model: 'cfg:simulation.redTeam', calls: r(2, 6), input: r(12000, 20000), output: r(4000, 12000) }],
  },
};

// ============================================
// RÉSOLUTION DES MODÈLES ET DES COÛTS
// ============================================

const LEVEL_UP: Record<CreativityLevel, CreativityLevel> = { low: 'medium', medium: 'high', high: 'ultra', ultra: 'ultra' };

/** Lit `modelName` à un chemin d'`AI_CONFIG` (`businessPlan`, `communication.strategy`…). */
function configModel(path: string): string | undefined {
  let node: unknown = AI_CONFIG;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  const model = (node as { modelName?: unknown } | undefined)?.modelName;
  return typeof model === 'string' ? model : undefined;
}

/** Modèle effectif d'une étape, au cran donné. */
export function resolveEnvelopeModel(ref: string, level: CreativityLevel): string {
  if (ref === 'ladder:design') return ladderModel('design', level);
  if (ref === 'ladder:code') return ladderModel('code', level);
  if (ref === 'ladder:code+1') return ladderModel('code', LEVEL_UP[level]);
  if (ref === 'code') return CODE_MODEL;
  if (ref.startsWith('role:')) {
    const role = ref.slice(5) as keyof typeof OPENROUTER_DEFAULT_ROLES;
    return OPENROUTER_DEFAULT_ROLES[role] ?? OPENROUTER_DEFAULT_ROLES.writing;
  }
  if (ref.startsWith('cfg:')) return configModel(ref.slice(4)) ?? OPENROUTER_DEFAULT_ROLES.writing;
  return ref;
}

export interface EnvelopeLineCost {
  step: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export interface EnvelopeCost {
  key: string;
  level: CreativityLevel;
  which: 'typical' | 'max';
  inputTokens: number;
  outputTokens: number;
  usd: number;
  xaf: number;
  lines: EnvelopeLineCost[];
}

/** Coût d'une génération, au cran donné, en valeur typique ou plafond. */
export function envelopeCost(key: string, level: CreativityLevel, which: 'typical' | 'max'): EnvelopeCost {
  const envelope = GENERATION_ENVELOPES[key];
  if (!envelope) throw new Error(`Enveloppe inconnue : ${key}`);

  const pick = (range: Range) => (which === 'typical' ? range[0] : range[1]);
  const lines: EnvelopeLineCost[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let usd = 0;

  for (const line of envelope.calls) {
    const model = resolveEnvelopeModel(line.model, envelope.creativity ? level : 'medium');
    const pricing = getModelPricing(model);
    const calls = pick(line.calls);
    const input = calls * pick(line.input);
    const output = calls * pick(line.output);
    const cost = (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;
    inputTokens += input;
    outputTokens += output;
    usd += cost;
    lines.push({ step: line.step, model, calls, inputTokens: input, outputTokens: output, usd: cost });
  }

  for (const line of envelope.media ?? []) {
    const count = pick(line.count);
    const cost = count * MEDIA_UNIT_USD[line.unit];
    usd += cost;
    lines.push({ step: line.step, model: line.unit, calls: count, inputTokens: 0, outputTokens: 0, usd: cost });
  }

  return { key, level, which, inputTokens, outputTokens, usd, xaf: usd * getXafPerUsd(), lines };
}

/**
 * Prix en francs que rapporte une action au cran donné, dans le modèle au portefeuille.
 *
 * - un LIVRABLE du Kit rapporte sa part du Kit plafonné (2 500 F pour 7 500 F de prix à l'unité) :
 *   la lecture prudente, celle de l'utilisateur qui prend tout ; Ultra = version Signature (+1 000 F) ;
 * - une retouche, un contenu de communication, une modification iCode : leur prix unitaire ;
 * - une ESQUISSE, une aide, la génération initiale iCode : 0 (bornées par les quotas).
 */
export function creditPriceOf(key: string, level: CreativityLevel): number {
  const envelope = GENERATION_ENVELOPES[key];
  if (!envelope || envelope.engine === 'free') return 0;
  const action = envelope.action;

  if (envelope.engine === 'appgen') {
    if (action === 'premium') return ICODE.premiumModificationXaf;
    if (action === 'message' || action === 'build' || action === 'site_image') return ICODE.modificationXaf;
    if (action === 'site_video') return ICODE.siteVideoXaf;
    return 0;
  }

  const policy = policyFor('business', action);
  switch (policy.kind) {
    case 'deliverable': {
      const share = Math.round((DELIVERABLES[policy.deliverable].priceXaf * KIT_CAP_XAF) / KIT_SUM_XAF);
      return share + (envelope.creativity && level === 'ultra' ? SIGNATURE_PRICE_XAF : 0);
    }
    case 'edit':
    case 'unit':
      return policy.priceXaf;
    default:
      return 0;
  }
}

export interface EnvelopeEconomics {
  key: string;
  level: CreativityLevel;
  credits: number;
  typical: EnvelopeCost;
  max: EnvelopeCost;
  /** Marge brute au coût plafond, au prix net plancher (R1 : ≥ 0). */
  marginAtFloor: number | null;
  /** Marge brute au coût typique, au prix net de référence (R2 : ≥ 75 %). */
  typicalMarginAtReference: number | null;
  /** Prix minimum, en francs, pour respecter R1 et R2. */
  minimumCredits: number;
  /** Les deux règles sont-elles tenues au prix actuel ? */
  ok: boolean;
}

export function envelopeEconomics(key: string, level: CreativityLevel): EnvelopeEconomics {
  const credits = creditPriceOf(key, level);
  const typical = envelopeCost(key, level, 'typical');
  const max = envelopeCost(key, level, 'max');
  const floorRevenue = credits * CREDIT_VALUE_XAF.floor;
  const referenceRevenue = credits * CREDIT_VALUE_XAF.reference;

  const marginAtFloor = floorRevenue > 0 ? 1 - max.xaf / floorRevenue : null;
  const typicalMarginAtReference = referenceRevenue > 0 ? 1 - typical.xaf / referenceRevenue : null;

  const minimumCredits = Math.max(
    Math.ceil(max.xaf / CREDIT_VALUE_XAF.floor),
    Math.ceil(typical.xaf / (CREDIT_VALUE_XAF.reference * (1 - TARGET_TYPICAL_MARGIN)))
  );

  const ok =
    credits > 0 && (marginAtFloor ?? -1) >= 0 && (typicalMarginAtReference ?? -1) >= TARGET_TYPICAL_MARGIN;

  return { key, level, credits, typical, max, marginAtFloor, typicalMarginAtReference, minimumCredits, ok };
}

// ============================================
// BUDGET D'EXÉCUTION
// ============================================

export interface GenerationBudget {
  key: string;
  level: CreativityLevel;
  /** Au-delà : la génération a coûté plus que ce que rapporte son prix au plancher (alerte). */
  softUsd: number;
  /** Au-delà : la génération boucle — arrêtée en mode `enforce`, signalée en mode `log`. */
  hardUsd: number;
}

/**
 * Budget d'une génération, en dollars de coût IA.
 *
 * - souple : le prix payé × la valeur plancher du crédit (au-delà, la génération est à perte au pire
 *   prix de vente) ; pour une aide gratuite, le coût plafond de son enveloppe ;
 * - dur : le plus grand de « prix × valeur de référence » et « deux fois le coût plafond » — aucune
 *   génération légitime ne l'atteint, une boucle l'atteint vite.
 *
 * `chargedCredits` est le prix réellement débité (cran, première fois ou révision, périmètre vidéo) ;
 * à défaut, le prix du barème.
 */
export function generationBudget(key: string, level: CreativityLevel, chargedCredits?: number): GenerationBudget | null {
  if (!GENERATION_ENVELOPES[key]) return null;

  const rate = getXafPerUsd();
  const credits = chargedCredits ?? creditPriceOf(key, level);
  const maxUsd = envelopeCost(key, level, 'max').usd;

  if (credits <= 0) {
    return { key, level, softUsd: maxUsd, hardUsd: maxUsd * 3 };
  }

  const softUsd = (credits * CREDIT_VALUE_XAF.floor) / rate;
  const hardUsd = Math.max((credits * CREDIT_VALUE_XAF.reference) / rate, maxUsd * 2);
  return { key, level, softUsd, hardUsd };
}

/** Clé d'enveloppe d'une action facturée. */
export function envelopeKey(engine: BillingEngine | 'free', action: string): string {
  return `${engine}.${action}`;
}

export const ENVELOPE_LEVELS = CREATIVITY_LEVELS;
