/** Les objets de l'API iVision, tels que l'interface les lit. */
export type ChatMode = 'image' | 'video';
/** Les ateliers du studio : les deux conversations, et le montage d'une prise de parole. */
export type StudioMode = ChatMode | 'montage';
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
  /** `auto` : la marque provisoire d'une création sans charte ; `file` : une charte déposée. */
  source: 'site' | 'idem' | 'manual' | 'file' | 'auto';
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
  /** La marque que ce message annonce (site lu, charte appliquée). */
  brandId?: string;
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
  /** La conversation qui l'a produit (retour de l'éditeur). */
  sessionId?: string;
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
  renderedAt?: string;
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

// ── Montage d'une prise de parole ──

export type MontageElementType = 'keyword' | 'stat' | 'icon' | 'list' | 'callout' | 'broll' | 'lowerThird' | 'cta' | 'zoom';
export type CaptionStyle = 'pop' | 'karaoke' | 'minimal' | 'none';
export type CutMode = 'tight' | 'natural' | 'none';
export type MontageStage = 'upload' | 'prepare' | 'transcribe' | 'cut' | 'plan' | 'media' | 'ready';

/** Une vidéo déposée pour un montage (avant la création). */
export interface MontageUpload {
  url: string;
  posterUrl?: string;
  name?: string;
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface MontageMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: 'request' | 'progress' | 'result' | 'revision' | 'error';
  inputs?: { url: string; name?: string; posterUrl?: string; durationSec: number }[];
  i18n?: { key: string; params?: Record<string, string | number> };
  createdAt: string;
}

export interface MontageElement {
  id: string;
  type: MontageElementType;
  from: number;
  to: number;
  text?: string;
  value?: string;
  label?: string;
  items?: string[];
  icon?: string;
  image?: string;
  mode?: 'full' | 'card';
  credit?: string;
  clip?: string;
  off?: boolean;
}

export interface Montage {
  id: string;
  brandId: string;
  title: string;
  status: 'processing' | 'ready' | 'failed';
  stage: MontageStage;
  progress?: number;
  error?: string;
  prompt: string;
  format: string;
  creativity: Creativity;
  language?: string;
  source: { url: string; durationSec: number; width: number; height: number; name?: string };
  inputs?: { url: string; name?: string; posterUrl?: string; durationSec: number; speech?: boolean }[];
  clips?: { id: string; url: string; posterUrl?: string; durationSec: number; name?: string }[];
  messages?: MontageMessage[];
  edit?: { url: string; posterUrl?: string; durationSec: number; width: number; height: number };
  words: { text: string; start: number; end: number; p?: number }[];
  cuts: { mode: CutMode; ranges: { start: number; end: number; at: number }[]; removedSec: number; dropped?: number[] };
  captions: { style: CaptionStyle };
  elements: MontageElement[];
  outro?: { text: string; detail?: string; durationSec: number };
  music?: { title: string; artist: string; attribution?: string };
  musicEnabled: boolean;
  plannedBy?: 'llm' | 'rules';
  paidCredits: number;
  exportCount: number;
  renders: VideoRender[];
  createdAt: string;
  updatedAt: string;
}
