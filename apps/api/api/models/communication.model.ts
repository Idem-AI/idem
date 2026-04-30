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
    logoSvg?: string;
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
  callToAction: string;
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

export type FlyerFormat = 'square' | 'story' | 'banner' | 'post' | 'a4';

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
    cta: string;
  };
  /** Single-line Tailwind HTML ready to render in a preview pane. */
  html: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationModel {
  context?: CommunicationContext;
  strategy?: CommunicationStrategy;
  calendar?: EditorialCalendar;
  flyers?: Flyer[];
  trends?: TrendSignal[];
  createdAt?: Date;
  updatedAt?: Date;
}
