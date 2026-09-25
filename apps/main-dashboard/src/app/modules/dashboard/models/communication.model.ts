/**
 * Frontend mirror of the backend Communication model.
 * Kept in sync with `apps/api/api/models/communication.model.ts`.
 */

export interface CommunicationContext {
  brandName: string;
  businessType: string;
  valueProposition: string;
  targetAudience: string;
  objectives: string[];
  tone: string;
  keywords: string[];
  channels: string[];
  language: string;
  branding: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
    primaryFont?: string;
    secondaryFont?: string;
    /**
     * Feuille de styles des polices de la marque.
     *
     * Indispensable aux aperçus : sans elle, l'iframe rend le visuel dans la
     * police système, et l'on modifierait une composition qui n'est pas celle du
     * PNG livré.
     */
    fontUrl?: string;
    logoSvg?: string;
  };
  extractedAt: string | Date;
}

export interface TrendSignal {
  id: string;
  label: string;
  description?: string;
  relevance: number;
  source?: string;
  capturedAt: string | Date;
}

export type StrategyBlockKind =
  | 'positioning'
  | 'pillars'
  | 'messaging'
  | 'channels'
  | 'cadence'
  | 'kpis'
  | 'tone'
  | 'custom';

export interface StrategyBlock {
  id: string;
  title: string;
  body: string;
  kind: StrategyBlockKind;
}

export interface CommunicationStrategy {
  summary: string;
  blocks: StrategyBlock[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type ContentFormat =
  | 'post'
  | 'carousel'
  | 'short-video'
  | 'article'
  | 'newsletter'
  | 'story'
  | 'reel';

export type ContentChannel =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'youtube'
  | 'blog'
  | 'email'
  | 'other';

export type ContentStatus = 'idea' | 'approved' | 'scheduled' | 'published';

/** Communication purpose — drives whether a visual carries a CTA button. */
export type VisualIntent =
  | 'awareness'
  | 'celebration'
  | 'promotion'
  | 'recruitment'
  | 'announcement';

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  description: string;
  format: ContentFormat;
  channel: ContentChannel;
  scheduledFor: string;
  /** Rang de semaine DANS la période. La date fait foi, ceci ne sert qu'au regroupement. */
  week: number;
  hashtags: string[];
  callToAction: string;
  intent?: VisualIntent;
  status: ContentStatus;
  flyerIds?: string[];
  /** Période propriétaire. Absent = contenu libre né dans l'atelier. */
  planId?: string;
  /** Occasion qui a motivé ce contenu (absorbe l'ancien `MomentIdea`). */
  occasion?: string;
  occasionDate?: string;
  /** Légende prête à publier. */
  caption?: string;
}

// ---------------------------------------------------------------------------
// PÉRIODES
// ---------------------------------------------------------------------------

/** La ligne éditoriale d'une période : cinq champs, lisibles d'un coup d'œil. */
export interface PlanBrief {
  angle: string;
  keyMessage: string;
  themes: { label: string; why: string }[];
  successSignals: string[];
  occasions?: { label: string; date: string }[];
}

export type PlanStatus = 'draft' | 'active' | 'done' | 'archived';

/**
 * Une période de communication : un objectif, des DATES RÉELLES, un brief et des
 * contenus datés. Les périodes s'empilent — rien n'est jamais écrasé.
 */
export interface CommunicationPlan {
  id: string;
  name: string;
  objective: string;
  period: { start: string; end: string };
  kind: 'regular' | 'campaign';
  postsPerWeek: number;
  channels: ContentChannel[];
  brief?: PlanBrief;
  items: ContentIdea[];
  status: PlanStatus;
  generatedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface EditorialCalendar {
  rhythm: 'weekly' | 'biweekly' | 'monthly';
  horizonWeeks: number;
  items: ContentIdea[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** A timely, one-off content tied to an occasion (holiday, hiring, promo…). */
export interface MomentIdea extends ContentIdea {
  occasion: string;
  occasionDate?: string;
  source: 'suggestion' | 'custom';
  caption?: string;
}

/** A suggested occasion surfaced in the Moments tab. */
export interface MomentSuggestion {
  id: string;
  occasion: string;
  date?: string;
  intent: VisualIntent;
  angle: string;
  why?: string;
  emoji?: string;
}

export type FlyerFormat = 'square' | 'story' | 'banner' | 'post' | 'a4';

export type FlyerImageSource = 'stock' | 'generated';

export interface FlyerImageAnalysis {
  subject: string;
  mood: string;
  dominantColors: string[];
  luminance: 'dark' | 'light' | 'mixed';
  composition?: string;
  detectedText?: string;
}

export interface FlyerImageAttribution {
  author?: string;
  sourceUrl?: string;
  provider: 'pexels' | 'unsplash' | 'gemini' | 'openai' | 'other';
}

/** D'où vient un visuel — pilote son classement dans la bibliothèque. */
export type VisualOrigin = 'plan' | 'studio' | 'occasion' | 'brandbook';

export interface Flyer {
  id: string;
  /** OPTIONNEL : un visuel d'atelier n'appartient à aucun contenu planifié. */
  contentId?: string;
  planId?: string;
  origin?: VisualOrigin;
  /** La demande d'origine, en langage naturel. */
  brief?: string;
  /** Variantes et déclinaisons issues du même brief. */
  siblingIds?: string[];
  format: FlyerFormat;
  intent?: VisualIntent;
  logoUsed?: string;
  concept: string;
  layoutNotes: string;
  marketingText: {
    headline: string;
    subheadline?: string;
    body: string;
    /**
     * @deprecated Legacy — les visuels générés ne portent plus d'appel à
     * l'action (le CTA vit dans la légende du post). Conservé pour l'affichage
     * des visuels produits avant ce changement.
     */
    cta?: string;
  };
  html: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
  imageSource?: FlyerImageSource;
  imageAnalysis?: FlyerImageAnalysis;
  imageAttribution?: FlyerImageAttribution;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type SocialNetwork = 'linkedin' | 'x';
export type PublicationStatus = 'draft' | 'scheduled' | 'published';

export interface Publication {
  id: string;
  contentId: string;
  network: SocialNetwork;
  status: PublicationStatus;
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  flyerId?: string;
  shareUrl?: string;
  scheduledFor?: string;
  publishedAt?: string;
  externalUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Assisted-share payload returned by the prepare-publication endpoint. */
export interface AssistedShare {
  network: SocialNetwork;
  caption: string;
  shareUrl: string;
  imageUrl?: string;
  requiresManualImage: boolean;
}

// ---------------------------------------------------------------------------
// ATELIER
// ---------------------------------------------------------------------------

export interface StudioPendingAction {
  kind: 'schedule' | 'declinate' | 'publish';
  visualId?: string;
  planId?: string;
  date?: string;
  channel?: ContentChannel;
  formats?: FlyerFormat[];
}

export interface StudioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Visuels produits par ce tour — affichés en cartes dans le fil. */
  visualIds?: string[];
  caption?: string;
  hashtags?: string[];
  pendingAction?: StudioPendingAction;
  /** Crédits débités par ce tour (absent quand il n'a rien coûté). */
  creditsSpent?: number;
  createdAt?: string | Date;
}

export interface StudioConversation {
  messages: StudioMessage[];
  updatedAt?: string | Date;
}

/** Événements du flux de l'atelier. */
export type StudioStreamEvent =
  | { type: 'thinking'; label: string }
  | { type: 'visual'; visual: Flyer }
  | { type: 'message'; message: StudioMessage }
  | {
      type: 'complete';
      payload: { userMessage: StudioMessage; assistantMessage: StudioMessage; visuals: Flyer[] };
    }
  | { type: 'error'; message: string; code?: string; cost?: number; balance?: number };

export interface CommunicationModel {
  context?: CommunicationContext;
  /** LA BOUSSOLE. */
  strategy?: CommunicationStrategy;
  /** LES PÉRIODES — remplacent le calendrier unique. */
  plans?: CommunicationPlan[];
  /** L'ATELIER. */
  studio?: StudioConversation;
  /** LA BIBLIOTHÈQUE (sans le HTML : il est demandé visuel par visuel). */
  visuals?: Flyer[];
  publications?: Publication[];
  occasionSuggestions?: MomentSuggestion[];
  schemaVersion?: number;

  /** @deprecated plus servis par l'API — conservés pour les types de transition. */
  calendar?: EditorialCalendar;
  moments?: MomentIdea[];
  momentSuggestions?: MomentSuggestion[];
  flyers?: Flyer[];
  trends?: TrendSignal[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Streaming event emitted by the backend during strategy/calendar generation. */
export interface CommunicationStreamEvent {
  type: 'step-start' | 'step-complete' | 'complete' | 'error';
  step?: 'context' | 'trends' | 'strategy' | 'calendar' | 'occasions' | 'brief' | 'content';
  payload?: any;
  message?: string;
  /**
   * Refus que l'interface sait traiter, plutôt qu'une panne à afficher.
   * `MISSING_PROJECT_INPUTS` : la génération demande un livrable absent, et
   * `missing` dit lequel.
   */
  code?: string;
  missing?: StrategyInputKey[];
}

/**
 * Les livrables dont la stratégie de communication DÉRIVE.
 *
 * Une stratégie qui ne connaît ni ce qui est vendu ni les moyens disponibles
 * n'est pas une stratégie, c'est un exercice de style — et tout le module en
 * dérive ensuite : chaque période y prend son angle, chaque visuel son ton. Une
 * boussole fausse fait dévier tout ce qui la suit.
 */
export const STRATEGY_INPUT_KEYS = ['businessPlan', 'finance'] as const;

export type StrategyInputKey = (typeof STRATEGY_INPUT_KEYS)[number];
