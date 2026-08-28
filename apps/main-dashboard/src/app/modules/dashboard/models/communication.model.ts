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
  week: number;
  hashtags: string[];
  callToAction: string;
  intent?: VisualIntent;
  status: ContentStatus;
  flyerIds?: string[];
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

export interface Flyer {
  id: string;
  contentId: string;
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

export interface CommunicationModel {
  context?: CommunicationContext;
  strategy?: CommunicationStrategy;
  calendar?: EditorialCalendar;
  moments?: MomentIdea[];
  momentSuggestions?: MomentSuggestion[];
  flyers?: Flyer[];
  publications?: Publication[];
  trends?: TrendSignal[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Streaming event emitted by the backend during strategy/calendar generation. */
export interface CommunicationStreamEvent {
  type: 'step-start' | 'step-complete' | 'complete' | 'error';
  step?: 'context' | 'trends' | 'strategy' | 'calendar';
  payload?: any;
  message?: string;
}
