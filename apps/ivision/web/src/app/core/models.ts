/** Les objets de l'API iVision, tels que l'interface les lit. */
export type ChatMode = 'image' | 'video';
export type Creativity = 'low' | 'medium' | 'high' | 'ultra';
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

/** Une question à cliquer : ses choix, celui qui convient le mieux marqué « recommandé ». */
export interface ChatQuestion {
  id: string;
  question: string;
  options: { id: string; label: string; description?: string; recommended?: boolean }[];
}

export type ChoicesPurpose = 'montage' | 'site';

export type ChatAsk =
  | { kind: 'brand' }
  | { kind: 'brand-choice'; brandId: string }
  | { kind: 'reference'; mode: ChatMode }
  /** Une décision qui change le résultat manque : la question et ses choix, rédigés par le serveur. */
  | { kind: 'video-intent'; clarificationId: string; question: string; options: { id: string; label: string; description: string; recommended?: boolean }[] }
  /** Quelques questions à cliquer, une à la fois (réglages d'un montage, que faire d'un lien de site). */
  | { kind: 'choices'; purpose: ChoicesPurpose; questions: ChatQuestion[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  i18n?: { key: string; params?: Record<string, string | number> };
  createdAt: string;
  attachments?: { kind: 'reference' | 'media'; id: string; url: string; name?: string; mimeType?: string; posterUrl?: string }[];
  ask?: ChatAsk;
  /** La marque que ce message annonce (site lu, charte appliquée). */
  brandId?: string;
  /** Le projet IDEM né du site lu : sa charte s'ouvre dans IDEM. */
  idemProjectId?: string;
  result?: { kind: 'video'; videoId: string } | { kind: 'visual'; visualId: string } | { kind: 'montage'; montageId: string } | { kind: 'charter'; brandId: string };
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
  /** Montage d'une prise de parole : retirer les blancs ou non. */
  cuts?: 'tight' | 'natural' | 'none';
  format?: string;
  withPhoto?: boolean;
  /** Plans filmés par l'IA commandés (1 000 F l'un) ; 0 : motion design et banque d'images. */
  aiClips?: number;
  /** Les réglages choisis par l'utilisateur (ou lus dans sa demande) : un modèle ne les remplace pas. */
  chosen?: ('duration' | 'format')[];
}

/** La charte graphique d'une marque (projet IDEM), telle qu'iVision l'affiche. */
export interface Charter {
  brandId: string;
  projectId?: string;
  status: 'none' | 'running' | 'ready' | 'failed';
  /** Pages terminées pendant la génération en cours. */
  done: number;
  step?: string;
  error?: string;
  pages?: { id: string; name: string; type: string; html: string }[];
  pdfFormat?: string;
  fonts?: { primaryFont?: string; secondaryFont?: string; fontUrl?: string };
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
  /** Export HD sans signature déjà réglé. */
  exported?: boolean;
  createdAt: string;
}

export interface VideoRender {
  format: string;
  status: 'queued' | 'rendering' | 'done' | 'failed';
  progress: number;
  url?: string;
  posterUrl?: string;
  error?: string;
  renderedAt?: string;
  /** Rendu fait d'avance, pas encore réclamé (se télécharge par « Télécharger »). */
  prerender?: boolean;
  /** Le fichier ne reflète plus la vidéo (retouchée depuis). */
  stale?: boolean;
}

/** Une scène du film : intention, textes (données lues par son code), médias, état technique. */
export interface FilmScene {
  key: string;
  start: number;
  duration: number;
  purpose: string;
  visual: string;
  motion: string;
  texts: Record<string, string>;
  media: string[];
  voiceText?: string;
  code?: string;
  author?: { at: string; instruction?: string };
  status: 'planned' | 'ready' | 'error';
  error?: { stage: 'author' | 'compile' | 'runtime'; message: string };
  thumbnail?: string;
}

export interface MotionVideo {
  id: string;
  title: string;
  status: 'draft' | 'rendering' | 'ready' | 'failed';
  scope: { durationSec: number; formats: string[]; quality: string };
  /** Le film (moteur Motion Canvas) ; absent pour une vidéo de l'ancien moteur (`legacy`). */
  film?: {
    title: string;
    concept: string;
    scenes: FilmScene[];
    captions: boolean;
    /** Ce que la vidéo n'a pas pu suivre de la demande, dit dans la langue de la vidéo. */
    fidelity?: { notes: string[] };
    reference?: { summary: string };
  };
  /** Vidéo de l'ancien moteur : téléchargeable, plus retouchable. */
  legacy?: boolean;
  media?: { id: string; kind: string; url: string }[];
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
  moods: string[];
  types: { id: string; icon: string }[];
}

/** Les événements d'un tour de conversation (flux SSE). */
export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'status'; key: string; text: string; data?: Record<string, unknown> }
  | { type: 'progress'; stage: string; state: 'running' | 'done'; data?: Record<string, unknown> }
  | { type: 'brand'; brand: Brand }
  | { type: 'result'; message: ChatMessage; video?: MotionVideo; visual?: Visual; montage?: Montage }
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
  /** La conversation vidéo d'où il vient. */
  sessionId?: string;
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
  intro?: { title: string; kicker?: string; durationSec: number };
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
