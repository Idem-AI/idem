/** Les objets de l'API iVision, tels que l'interface les lit. */
export type ChatMode = 'image' | 'video';
export type Creativity = 'low' | 'medium' | 'high' | 'max' | 'ultra';
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text';

export interface PaletteProposal {
  id: 'site' | 'contrast' | 'harmony';
  label: string;
  rationale: string;
  colors: Record<PaletteRole, string>;
}

export interface TypographyProposal {
  id: 'site' | 'pairing' | 'alternative';
  label: string;
  rationale: string;
  display: string;
  body: string;
  displayCss: string;
  bodyCss: string;
}

export interface Brand {
  id: string;
  name: string;
  source: 'site' | 'idem' | 'manual';
  siteUrl?: string;
  idemProjectId?: string;
  status: 'draft' | 'ready';
  palette: Partial<Record<PaletteRole, string>>;
  fonts: { display?: string; body?: string; displayCss?: string; bodyCss?: string };
  logoUrl?: string;
  voice: { tone?: string; businessType?: string; valueProposition?: string; language?: string };
  photos: string[];
  proposals?: { palettes: PaletteProposal[]; typographies: TypographyProposal[]; chosen: { palette: string; typography: string }; screenshot?: string; pages: string[]; warnings: string[] };
  updatedAt: string;
}

export type ChatAsk = { kind: 'brand' } | { kind: 'brand-choice'; brandId: string } | { kind: 'reference'; mode: ChatMode };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  i18n?: { key: string; params?: Record<string, string | number> };
  createdAt: string;
  attachments?: { kind: 'reference' | 'media'; id: string; url: string; name?: string; mimeType?: string }[];
  ask?: ChatAsk;
  result?: { kind: 'video'; videoId: string } | { kind: 'visual'; visualId: string };
  status?: 'done' | 'error';
  error?: string;
}

export interface ChatSession {
  id: string;
  mode: ChatMode;
  brandId?: string;
  title: string;
  messages: ChatMessage[];
  pending: { text: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  mode: ChatMode;
  brandId?: string;
  title: string;
  updatedAt: string;
  last?: string;
}

export interface ChatOptions {
  creativity?: Creativity;
  durationSec?: number;
  formats?: string[];
  quality?: string;
  musicMood?: string;
  sfx?: boolean;
  voice?: boolean;
  format?: string;
  withPhoto?: boolean;
}

export interface MediaAsset {
  id: string;
  kind: 'image' | 'video' | 'model3d' | 'lottie' | 'rive';
  url: string;
  name?: string;
  durationSec?: number;
  posterUrl?: string;
}

export interface Reference {
  id: string;
  kind: 'video' | 'image';
  name: string;
  url: string;
  mimeType: string;
  status: 'analyzing' | 'ready' | 'failed';
  progress?: { step: string; done?: number; total?: number };
  error?: string;
  meta?: { duration?: number; orientation?: string; shots?: number };
  summary?: string;
  shots?: { index: number; start: number; duration: number; role: string; layout: string; media: string; hasSheet: boolean }[];
  createdAt: string;
}

export interface Visual {
  id: string;
  brandId: string;
  prompt: string;
  format: string;
  imageUrl: string;
  layout?: string;
  creativity: Creativity;
  score?: number;
  createdAt: string;
}

export interface VideoScene {
  key: string;
  sceneId: string;
  start: number;
  duration: number;
  slots: Record<string, string>;
  image?: string;
}

export interface VideoRender {
  format: string;
  status: 'queued' | 'rendering' | 'done' | 'failed';
  progress: number;
  url?: string;
  posterUrl?: string;
  error?: string;
}

export interface MotionVideo {
  id: string;
  title: string;
  status: 'draft' | 'rendering' | 'ready' | 'failed';
  scope: { durationSec: number; formats: string[]; quality: string };
  storyboard: { scenes: VideoScene[]; style: string; direction?: string; creative?: { reference?: { shots: number; summary: string } } };
  brief: { message: string; musicMood: string; sfx?: boolean; voice?: boolean; language?: string };
  music?: { title: string; artist: string };
  sfx?: { enabled: boolean };
  /** Voix off : une ligne par scène ; `unavailable` quand la langue ou le service l'ont empêchée. */
  voice?: { enabled: boolean; language: string; persona: string; lines: { sceneKey: string; text: string }[]; unavailable?: string };
  renders: VideoRender[];
  exportCount: number;
  paidCredits: number;
  creativity?: Creativity;
  dirty?: boolean;
  createdAt: string;
}

export interface VideoOptions {
  scenes: Record<string, { key: string; max: number; required: boolean }[]>;
  moods: string[];
}

/** Les événements d'un tour de conversation (flux SSE). */
export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'status'; key: string; text: string; data?: Record<string, unknown> }
  | { type: 'progress'; stage: string; state: 'running' | 'done'; data?: Record<string, unknown> }
  | { type: 'brand'; brand: Brand }
  | { type: 'result'; message: ChatMessage; video?: MotionVideo; visual?: Visual }
  | { type: 'error'; error: string; message: string; payment?: { cost?: number; balance?: number; missing?: number } }
  | { type: 'done' };
