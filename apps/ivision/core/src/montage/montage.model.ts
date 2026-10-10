/**
 * LE MONTAGE D'UNE VIDÉO PARLÉE — une personne s'enregistre, iVision rend une vidéo prête à publier.
 *
 *   transcription  Whisper (local), au mot près ;
 *   coupes         silences et hésitations retirés, faux départs supprimés ;
 *   sous-titres    mot par mot, calés sur la voix ;
 *   habillage      mots-clés, pictos, chiffres, listes, images d'illustration, bandeau du nom,
 *                  appel à l'action, carton final, zooms — chacun ANCRÉ SUR DES MOTS : il apparaît
 *                  quand la personne les dit, et suit le texte si les coupes changent.
 *
 * Le temps de référence de tous les éléments est l'index des mots (`words[]`), jamais une seconde :
 * les instants sont recalculés à chaque composition depuis les mots retimés par les coupes.
 */
import type { CreativityLevel } from '../creativity/levels';
import type { VideoFormat, VideoQuality, VideoRender } from '../video/video.model';

/** Un mot transcrit, dans le temps de l'ORIGINAL (avant coupes). */
export interface MontageWord {
  text: string;
  start: number;
  end: number;
  /** Probabilité moyenne de ses jetons (0–1) : les mots incertains sont signalés à la retouche. */
  p?: number;
}

/** Un passage gardé de l'original, et sa place dans la vidéo montée. */
export interface MontageRange {
  start: number;
  end: number;
  /** Début dans la vidéo montée. */
  at: number;
}

export const CAPTION_STYLES = ['pop', 'karaoke', 'minimal', 'none'] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const CUT_MODES = ['tight', 'natural', 'none'] as const;
/** `tight` : blancs ramenés à ~0,2 s, faux départs retirés · `natural` : seuls les longs blancs · `none` : intacte. */
export type CutMode = (typeof CUT_MODES)[number];

export const ELEMENT_TYPES = ['keyword', 'stat', 'icon', 'list', 'callout', 'broll', 'lowerThird', 'cta', 'zoom'] as const;
export type MontageElementType = (typeof ELEMENT_TYPES)[number];

/**
 * Un élément d'habillage, ancré sur les mots [from, to] (index dans `words`). Il apparaît sur le
 * premier mot et reste au moins jusqu'au dernier (plus un temps de lecture).
 */
export interface MontageElement {
  id: string;
  type: MontageElementType;
  from: number;
  to: number;
  /** Mot-clé, texte d'un encadré, titre d'une liste, appel à l'action. */
  text?: string;
  /** Chiffre (stat), nom (bandeau), précision (contact de l'appel). */
  value?: string;
  label?: string;
  items?: string[];
  /** Pictogramme (concept du vocabulaire d'icônes). */
  icon?: string;
  /** Image d'illustration : URL déposée, recherche ou description, et cadrage. */
  image?: string;
  query?: string;
  mode?: 'full' | 'card';
  credit?: string;
  /** Désactivé à la retouche : gardé pour pouvoir le remettre. */
  off?: boolean;
}

export interface MontageOutro {
  text: string;
  detail?: string;
  durationSec: number;
}

export type MontageStage = 'upload' | 'transcribe' | 'cut' | 'plan' | 'media' | 'ready';
export type MontageStatus = 'processing' | 'ready' | 'failed';

export interface MontageMusic {
  id: string;
  url: string;
  title: string;
  artist: string;
  provider: string;
  attribution?: string;
  startAt: number;
}

export interface MontageVideo {
  id: string;
  title: string;
  status: MontageStatus;
  stage: MontageStage;
  /** Avancement de l'étape en cours (0–1) quand il est mesurable (transcription). */
  progress?: number;
  error?: string;
  /** Ce que l'utilisateur a demandé en plus de sa vidéo (ton, appel, consignes). */
  prompt: string;
  format: VideoFormat;
  quality: VideoQuality;
  creativity: CreativityLevel;
  language?: string;
  source: { url: string; durationSec: number; width: number; height: number; name?: string };
  /** La vidéo montée (coupée, recadrée), lue par l'aperçu et par le rendu. */
  edit?: { url: string; posterUrl?: string; durationSec: number; width: number; height: number };
  words: MontageWord[];
  /** `dropped` : index des mots retirés (hésitations, faux départs). */
  cuts: { mode: CutMode; ranges: MontageRange[]; removedSec: number; dropped?: number[] };
  captions: { style: CaptionStyle };
  elements: MontageElement[];
  outro?: MontageOutro;
  music?: MontageMusic;
  musicEnabled: boolean;
  /** Qui a choisi l'habillage : le monteur IA, ou les règles (Low, ou modèle indisponible). */
  plannedBy?: 'llm' | 'rules';
  paidCredits: number;
  exportCount: number;
  renders: VideoRender[];
  createdAt: string;
  updatedAt: string;
}

/** Les limites d'un import (une prise de parole, pas un film). */
export const MONTAGE_LIMITS = {
  maxBytes: 600 * 1024 * 1024,
  maxDurationSec: 300,
  minDurationSec: 3,
};
