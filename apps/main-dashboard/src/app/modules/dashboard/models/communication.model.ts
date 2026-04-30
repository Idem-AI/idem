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
  html: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CommunicationModel {
  context?: CommunicationContext;
  strategy?: CommunicationStrategy;
  calendar?: EditorialCalendar;
  flyers?: Flyer[];
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
