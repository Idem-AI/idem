/**
 * Communication feature models.
 *
 * Architecture overview (MCP-style modular pipeline):
 *
 *   Project Data
 *       │
 *       ▼
 *   ┌──────────────────────┐
 *   │ Context Extraction   │  -> CommunicationContext  (lightweight, structured)
 *   └──────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────┐
 *   │ Trend Signals (cache)│  -> TrendSignal[]
 *   └──────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────┐
 *   │ Strategy Generator   │  -> CommunicationStrategy
 *   └──────────────────────┘
 *       │
 *       ▼
 *   ┌──────────────────────┐
 *   │ Calendar Generator   │  -> EditorialCalendar
 *   └──────────────────────┘
 *       │  (user selects a content idea, clicks "Generate Visual")
 *       ▼
 *   ┌──────────────────────┐
 *   │ Flyer Generator      │  -> Flyer (HTML + concept + marketing text)
 *   └──────────────────────┘
 *
 * Stored under `analysisResultModel.communication` on the project document.
 */

/**
 * Structured context extracted ONCE from the project and reused.
 * This is the ONLY payload sent to downstream steps so we never re-send
 * a full business plan.
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
  /** Branding summary (colors + primary font) used by the flyer step */
  branding: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
    primaryFont?: string;
    secondaryFont?: string;
    fontUrl?: string;
    logoSvg?: string;
    logoUrls?: {
      primary: string;
      withText?: {
        light?: string;
        dark?: string;
        mono?: string;
      };
      iconOnly?: {
        light?: string;
        dark?: string;
        mono?: string;
      };
    };
  };
  extractedAt: Date;
}

/** Light-weight trend signal. Sourced from cached external APIs / periodic jobs. */
export interface TrendSignal {
  id: string;
  label: string;
  description?: string;
  relevance: number; // 0..1
  source?: string;
  capturedAt: Date;
}

/** Actionable block inside the strategy. User can edit each block. */
export interface StrategyBlock {
  id: string;
  title: string;
  body: string;
  /** Canonical slug used by the UI to pin block types (positioning, pillars, kpis...) */
  kind:
    | 'positioning'
    | 'pillars'
    | 'messaging'
    | 'channels'
    | 'cadence'
    | 'kpis'
    | 'tone'
    | 'custom';
}

export interface CommunicationStrategy {
  summary: string;
  blocks: StrategyBlock[];
  createdAt: Date;
  updatedAt: Date;
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

/**
 * Communication purpose of a visual. Drives the TONE and the message of the
 * composition (atmospheric for awareness, factual for an announcement, the
 * offer as a headline for a promotion) — never the presence of a button: a
 * generated visual never carries a CTA, whatever the intent.
 */
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
  /** ISO date string (weekly/monthly slot) */
  scheduledFor: string;
  week: number;
  hashtags: string[];
  /** Appel à l'action de la LÉGENDE du post — jamais dessiné sur le visuel. */
  callToAction: string;
  /** Communication purpose — drives the tone of the visual. */
  intent?: VisualIntent;
  status: ContentStatus;
  /** Set after a flyer is generated on-demand for this content. */
  flyerIds?: string[];
}

export interface EditorialCalendar {
  rhythm: 'weekly' | 'monthly' | 'biweekly';
  horizonWeeks: number;
  items: ContentIdea[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A timely / one-off communication opportunity ("moment"): national holidays,
 * hiring, company anniversary, seasonal promos… Sits OUTSIDE the weekly calendar
 * and carries a ready-to-publish caption. A MomentIdea is a ContentIdea (so it
 * reuses the whole visual-generation pipeline) enriched with occasion metadata.
 */
export interface MomentIdea extends ContentIdea {
  /** Human label of the occasion, e.g. "Fête nationale", "Nous recrutons". */
  occasion: string;
  /** ISO date of the occasion when known. */
  occasionDate?: string;
  /** Where this moment came from. */
  source: 'suggestion' | 'custom';
  /** Ready-to-publish social caption (post body). */
  caption?: string;
}

/** A suggested occasion surfaced to the user (before it becomes a MomentIdea). */
export interface MomentSuggestion {
  id: string;
  occasion: string;
  /** ISO date of the occasion. */
  date?: string;
  intent: VisualIntent;
  /** One-line angle proposal for the brand. */
  angle: string;
  /** Why this occasion is relevant for this brand. */
  why?: string;
  /** Emoji/icon hint for the UI. */
  emoji?: string;
}

export type FlyerFormat = 'square' | 'story' | 'banner' | 'post' | 'a4';

export type FlyerImageSource = 'stock' | 'generated';

/**
 * Quick vision scan of the chosen image. Used to make the marketing copy
 * and layout coherent with the picture (no brand / tone / content mismatch).
 */
export interface FlyerImageAnalysis {
  subject: string;
  mood: string;
  /** Dominant hex colors picked from the image, primary first. */
  dominantColors: string[];
  /** 'dark' | 'light' | 'mixed' — decides text-on-image contrast. */
  luminance: 'dark' | 'light' | 'mixed';
  /** Composition hint: where is the subject / where is there empty space. */
  composition?: string;
  /** Any text detected inside the image (avoid overlaying near it). */
  detectedText?: string;
}

export interface FlyerImageAttribution {
  /** Photographer or AI model. */
  author?: string;
  sourceUrl?: string;
  provider: 'pexels' | 'unsplash' | 'gemini' | 'glm' | 'openai' | 'other';
}

export interface Flyer {
  id: string;
  contentId: string;
  format: FlyerFormat;
  concept: string;
  layoutNotes: string;
  marketingText: {
    headline: string;
    subheadline?: string;
    body: string;
    /**
     * @deprecated Legacy — plus jamais renseigné. Un visuel ne porte aucun
     * appel à l'action (cf. `CommunicationService.generateFlyer`) : le CTA vit
     * dans la légende du post (`ContentIdea.callToAction`). Le champ subsiste
     * pour les visuels déjà persistés avant ce changement.
     */
    cta?: string;
  };
  /** Communication purpose used to compose this visual. */
  intent?: VisualIntent;
  /** The exact logo declension URL the AI placed inside the visual. */
  logoUsed?: string;
  /** Single-line Tailwind HTML used internally to render the PNG. */
  html: string;
  /** Public URL of the rendered flyer PNG (served from MinIO). */
  imageUrl?: string;
  /** Public URL of the background image used inside the flyer. */
  backgroundImageUrl?: string;
  imageSource?: FlyerImageSource;
  imageAnalysis?: FlyerImageAnalysis;
  imageAttribution?: FlyerImageAttribution;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Social networks Idem can publish to. Phase 1 ships assisted publishing (no
 * OAuth): Idem prepares the caption + visual and deep-links the user to the
 * network composer. The connector abstraction (services/Connectors) is built so
 * real API publishing can be dropped in later without touching callers.
 */
export type SocialNetwork = 'linkedin' | 'x';

export type PublicationStatus = 'draft' | 'scheduled' | 'published';

export interface Publication {
  id: string;
  /** Id of the owning ContentIdea or MomentIdea. */
  contentId: string;
  network: SocialNetwork;
  status: PublicationStatus;
  /** Ready-to-post caption (already includes hashtags). */
  caption: string;
  hashtags: string[];
  /** Rendered visual image URL, when a flyer exists. */
  imageUrl?: string;
  flyerId?: string;
  /** Deep link that opens the network composer (assisted publishing). */
  shareUrl?: string;
  /** ISO date the user scheduled the post for. */
  scheduledFor?: string;
  /** Set once the user confirms the post is live. */
  publishedAt?: string;
  /** Optional URL of the live post (entered by the user). */
  externalUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationModel {
  context?: CommunicationContext;
  strategy?: CommunicationStrategy;
  calendar?: EditorialCalendar;
  /** One-off, occasion-driven contents (see MomentIdea). */
  moments?: MomentIdea[];
  /** Cached list of suggested occasions for the "Moments" tab. */
  momentSuggestions?: MomentSuggestion[];
  flyers?: Flyer[];
  /** Assisted/queued social publications. */
  publications?: Publication[];
  trends?: TrendSignal[];
  createdAt?: Date;
  updatedAt?: Date;
}
