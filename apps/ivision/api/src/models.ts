/**
 * Les documents d'iVision (MongoDB, collections `ivision_*`).
 *
 * Une MARQUE porte la charte au format du moteur partagé (`BrandKit`, la même forme qu'une
 * charte IDEM) : c'est elle que les vidéos et les visuels lisent. Une CONVERSATION a un mode
 * fixe — images OU vidéos, jamais les deux — et une marque. Un MODÈLE est une vidéo ou une
 * image que l'utilisateur veut voir reproduite (animations, composition), analysée une fois.
 */
import type { BrandKit, BrandVoice } from '../../core/src/brand/brand-kit';
import type { PaletteProposal } from '../../core/src/site/palette';
import type { TypographyProposal } from '../../core/src/site/typography';
import type { ReferenceBlueprint, ReferenceImage, ReferenceShot } from '../../core/src/reference/reference.analyzer';
import type { MotionVideo, VideoMediaAsset } from '../../core/src/video/video.model';
import type { MontageVideo } from '../../core/src/montage/montage.model';
import type { CreativityLevel } from '../../core/src/creativity/levels';
import type { FlyerFormat } from '../../core/src/visual/visual.model';

export type ChatMode = 'image' | 'video';

export interface IvisionBrand {
  _id: string;
  userId: string;
  name: string;
  /**
   * D'où vient la charte : un site scanné, un projet IDEM importé, une saisie, un fichier de
   * charte (PDF, image, logo), ou `auto` — la marque provisoire d'une création sans charte
   * (invisible dans la liste des marques ; ses couleurs viennent de la demande).
   */
  source: 'site' | 'idem' | 'manual' | 'file' | 'auto';
  siteUrl?: string;
  idemProjectId?: string;
  /** `draft` : scannée, palette et typographie pas encore validées par l'utilisateur. */
  status: 'draft' | 'ready';
  kit: BrandKit;
  voice: BrandVoice;
  /** Photos de la marque (site, visuels IDEM, imports) : la matière des vidéos et des visuels. */
  photos: string[];
  /** Ce que le scan propose (les choix sont gardés pour changer d'avis plus tard). */
  proposals?: {
    palettes: PaletteProposal[];
    typographies: TypographyProposal[];
    chosen: { palette: string; typography: string };
    screenshot?: string;
    pages: string[];
    warnings: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  kind: 'reference' | 'media';
  id: string;
  url: string;
  name?: string;
  mimeType?: string;
  posterUrl?: string;
}

/** Ce que l'assistant demande avant de produire : la conversation reprend sur la réponse. */
export type ChatAsk =
  | { kind: 'brand' }
  | { kind: 'brand-choice'; brandId: string }
  | { kind: 'reference'; mode: ChatMode };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Texte de l'assistant en français ; `i18n` permet à l'interface de l'afficher dans sa langue. */
  text: string;
  i18n?: { key: string; params?: Record<string, string | number> };
  createdAt: string;
  attachments?: ChatAttachment[];
  ask?: ChatAsk;
  /** Le livrable produit par ce tour. */
  result?: { kind: 'video'; videoId: string } | { kind: 'visual'; visualId: string } | { kind: 'montage'; montageId: string };
  status?: 'done' | 'error';
  error?: string;
  /** La marque que ce message annonce (site lu, charte appliquée). */
  brandId?: string;
}

/** Les réglages d'une demande (bandeau du compositeur). */
export interface ChatOptions {
  creativity?: CreativityLevel;
  /** Vidéo. */
  durationSec?: number;
  formats?: string[];
  quality?: string;
  type?: string;
  musicMood?: string;
  sfx?: boolean;
  /** Voix off dans la langue de l'utilisateur (désactivée par défaut). */
  voice?: boolean;
  /** Montage d'une prise de parole : retirer les blancs (`tight`) ou non. */
  cuts?: 'tight' | 'natural' | 'none';
  /** Visuel. */
  format?: FlyerFormat;
  withPhoto?: boolean;
}

export interface ChatSession {
  _id: string;
  userId: string;
  mode: ChatMode;
  brandId?: string;
  title: string;
  messages: ChatMessage[];
  /** La demande en attente d'une réponse (marque, modèle) : rejouée quand la réponse arrive. */
  pending?: { text: string; options: ChatOptions; media?: VideoMediaAsset[]; photoUrl?: string; videos?: { url: string; name?: string; posterUrl?: string }[] };
  createdAt: string;
  updatedAt: string;
}

export type StoredBlueprint = Omit<ReferenceBlueprint, 'shots'> & { shots: (Omit<ReferenceShot, 'sheet'> & { sheetB64?: string })[] };

export interface IvisionReference {
  _id: string;
  userId: string;
  kind: 'video' | 'image';
  name: string;
  url: string;
  mimeType: string;
  status: 'analyzing' | 'ready' | 'failed';
  progress?: { step: string; done?: number; total?: number };
  /** Le plan de reproduction ; les planches des plans y sont en base64 (lues en `Buffer`). */
  blueprint?: StoredBlueprint;
  image?: ReferenceImage;
  /** Durée et orientation, pour l'affichage. */
  meta?: { duration?: number; orientation?: string; shots?: number };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IvisionVisual {
  _id: string;
  userId: string;
  brandId: string;
  sessionId?: string;
  prompt: string;
  format: FlyerFormat;
  imageUrl: string;
  html: string;
  layout?: string;
  /** Palette de la composition (paper, brand, ink…) : une révision en propose une autre. */
  scheme?: string;
  creativity: CreativityLevel;
  referenceId?: string;
  audit?: { score: number; blocking: boolean };
  paidCredits: number;
  createdAt: string;
  /** Dernière retouche dans l'éditeur (HTML et image re-rendue). */
  updatedAt?: string;
}

/** Une vidéo d'iVision : la vidéo du moteur, rangée sous sa marque. */
/** Un montage d'une vidéo parlée (moteur partagé, `core/src/montage`). */
export interface IvisionMontageDoc {
  _id: string;
  userId: string;
  brandId: string;
  montage: MontageVideo;
  updatedAt: string;
}

export interface IvisionVideoDoc {
  _id: string;
  userId: string;
  brandId: string;
  video: MotionVideo;
  updatedAt: string;
}
