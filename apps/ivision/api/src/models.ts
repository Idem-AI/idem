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
import type { MotionVideo, VideoMediaAsset } from '../../core/src/video/contracts/model';
import type { MontageVideo } from '../../core/src/montage/montage.model';
import type { CreativityLevel } from '../../core/src/creativity/levels';
import type { FlyerFormat } from '../../core/src/visual/visual.model';
import type { WrittenCopy } from '../../core/src/visual/visual.copy';
import type { VisualPhotoRef } from '../../core/src/visual/visual.composer';
import type { SectionSpec } from '@idem/graphic-engine';

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
  /** Descriptions des images de la marque (vision, une fois par image), par empreinte d'URL. */
  mediaNotes?: Record<string, string>;
  /**
   * Classification (`classifyImage`, core) des photos de marque, par empreinte d'URL (même
   * hachage que `mediaNotes`). Calculée une fois et persistée ici : sans cela, `createVisual`
   * rappelait l'IA de vision sur chaque photo à CHAQUE visuel créé, pour un résultat qui ne
   * change jamais pour une même photo.
   */
  photoClassification?: Record<string, { kind: string; luminance: number }>;
  /**
   * La CHARTE GRAPHIQUE du projet IDEM de la marque, générée depuis iVision : son état (le document vit dans
   * IDEM ; iVision l'affiche). Absente : jamais demandée d'ici.
   */
  charter?: { status: 'running' | 'ready' | 'failed'; updatedAt: string; error?: string };
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

/** Une question à cliquer : ses choix, celui qui convient le mieux marqué « recommandé ». */
export interface ChatQuestion {
  id: string;
  question: string;
  options: { id: string; label: string; description?: string; recommended?: boolean }[];
}

/** Les questions posées d'un coup (une à la fois à l'écran) : ce qu'elles décident. */
export type ChoicesPurpose = 'montage' | 'site';

/** Ce que l'assistant demande avant de produire : la conversation reprend sur la réponse. */
export type ChatAsk =
  | { kind: 'brand' }
  | { kind: 'brand-choice'; brandId: string }
  | { kind: 'reference'; mode: ChatMode }
  /** Une décision qui change le pipeline manque (request/intent.ts) : la question, et ses choix adaptés au média. */
  | { kind: 'video-intent'; clarificationId: string; question: string; options: { id: string; label: string; description: string; recommended?: boolean }[] }
  /** Quelques questions à cliquer (réglages d'un montage, que faire d'un lien de site). */
  | { kind: 'choices'; purpose: ChoicesPurpose; questions: ChatQuestion[] };

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
  result?: { kind: 'video'; videoId: string } | { kind: 'visual'; visualId: string } | { kind: 'montage'; montageId: string } | { kind: 'charter'; brandId: string };
  status?: 'done' | 'error';
  error?: string;
  /** La marque que ce message annonce (site lu, charte appliquée). */
  brandId?: string;
  /** Le projet IDEM né du site lu : l'interface propose d'ouvrir sa charte dans IDEM. */
  idemProjectId?: string;
  /** L'étape suivante proposée par la boucle IDEM sous un livrable (créer le site, la charte…). */
  next?: { id: string; destination: string; projectId?: string; because?: string; score: number };
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
  /** Plans filmés par l'IA commandés (1 000 F l'un, 0 par défaut : motion design + banque d'images). */
  aiClips?: number;
  /** Montage d'une prise de parole : retirer les blancs (`tight`) ou non. */
  cuts?: 'tight' | 'natural' | 'none';
  /** Visuel. */
  format?: FlyerFormat;
  withPhoto?: boolean;
  /** Les réglages choisis par l'utilisateur (ou lus dans sa demande) : un modèle ne les remplace pas. */
  chosen?: ('duration' | 'format')[];
}

export interface ChatSession {
  _id: string;
  userId: string;
  mode: ChatMode;
  brandId?: string;
  title: string;
  messages: ChatMessage[];
  /** La demande en attente d'une réponse (marque, modèle) : rejouée quand la réponse arrive. */
  pending?: {
    text: string;
    options: ChatOptions;
    media?: VideoMediaAsset[];
    photoUrl?: string;
    videos?: { url: string; name?: string; posterUrl?: string }[];
    /** Ce que l'utilisateur a déjà décidé pour cette demande : on ne le lui redemande pas. */
    treatment?: string;
    site?: 'charter' | 'brand' | 'no';
    /** Les réponses aux questions du montage. */
    montage?: Record<string, string>;
  };
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
  /** Export HD sans signature payé (ou inclus) : le fichier sort sans « Créé avec iVision ». */
  exportedAt?: string;
  createdAt: string;
  /** Dernière retouche dans l'éditeur (HTML et image re-rendue). */
  updatedAt?: string;
  /** Les mots, la photo, la graine et l'arbre de la page : une retouche les modifie et REJOUE la même page. */
  copy?: WrittenCopy;
  photo?: VisualPhotoRef;
  seed?: string;
  spec?: SectionSpec;
  /** Le visuel dont celui-ci est la retouche (le fil de la conversation garde chaque version). */
  parentId?: string;
  /** Retouché à la main dans l'éditeur : son HTML ne correspond plus à son arbre. */
  handEdited?: boolean;
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
