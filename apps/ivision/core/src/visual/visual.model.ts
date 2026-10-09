/**
 * Les visuels (flyers, publications, bannières) : le modèle du moteur partagé.
 * IDEM (module Communication) et iVision composent leurs visuels avec les mêmes types.
 */
import type { ArtDirectionModel } from '../brand/art-direction.model';

/**
 * Communication purpose of a visual. Drives the TONE and the message of the
 * composition (atmospheric for awareness, factual for an announcement, the
 * offer as a headline for a promotion) — never the presence of a button: a
 * generated visual never carries a CTA, whatever the intent.
 */
export type VisualIntent = 'awareness' | 'celebration' | 'promotion' | 'recruitment' | 'announcement';

export type FlyerFormat = 'square' | 'story' | 'banner' | 'post' | 'a4';
export const FLYER_FORMATS: FlyerFormat[] = ['square', 'story', 'banner', 'post', 'a4'];

/** `upload` : la photo de l'utilisateur (iVision), mise en page telle quelle. */
export type FlyerImageSource = 'stock' | 'generated' | 'upload';

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

/**
 * La marque, telle que la composition d'un visuel la lit : couleurs à plat, polices, logos par
 * usage, direction artistique. Le contexte du module Communication d'IDEM
 * (`CommunicationContext`) l'est déjà ; iVision le construit depuis sa marque (`visualContextFromBrand`, visual.context.ts).
 */
export interface VisualBrandContext {
  brandName: string;
  businessType: string;
  tone: string;
  keywords: string[];
  language: string;
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
      withText?: { light?: string; dark?: string; mono?: string };
      iconOnly?: { light?: string; dark?: string; mono?: string };
    };
  };
  artDirection?: ArtDirectionModel;
}

/** Ce qu'un visuel doit dire : le brief (un contenu du calendrier IDEM, ou une demande iVision). */
export interface VisualContent {
  id: string;
  title: string;
  hook?: string;
  description?: string;
  format?: string;
  channel?: string;
  intent?: VisualIntent;
  hashtags?: string[];
  callToAction?: string;
}

/** Ce que la composition dit d'elle-même (métadonnées gardées avec le visuel). */
export interface VisualMeta {
  html?: string;
  concept?: string;
  layoutNotes?: string;
  marketingText?: { headline?: string; subheadline?: string; body?: string };
  /** URL du logo posé par le modèle (le rendu en corrige taille et polarité). */
  logoUsed?: string;
  /** Composition du code retenue (crans Low → High). */
  layout?: string;
  creativity?: string;
  agents?: unknown[];
}
