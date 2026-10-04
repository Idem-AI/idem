/**
 * LE CATALOGUE DE SCÈNES — ce que chaque scène attend.
 *
 * Chaque scène déclare ses CASES de texte (clé, longueur maximale, obligatoire
 * ou non) — c'est tout ce que le modèle voit et remplit —, ses besoins en
 * images, ses durées et ses variantes. Le RENDU vit dans le moteur React
 * (`apps/api/video-engine/src/scenes.tsx`), qui compose chaque scène selon la
 * direction de motion choisie.
 */
import { VideoSceneInstance } from '../../../models/motionVideo.model';

export interface SlotDef {
  key: string;
  /** Longueur maximale, en caractères. */
  max: number;
  required?: boolean;
  /** Indication donnée au modèle, en anglais (plus court en tokens). */
  hint: string;
}

export interface SceneDef {
  id: string;
  slots: SlotDef[];
  /** `required` : sans image la scène est retirée ; `optional` : une variante sans image existe. */
  image?: 'required' | 'optional';
  /** Images minimum pour une galerie. */
  minImages?: number;
  variants: number;
  /** Durée confortable (s) et bornes. */
  nominal: number;
  min: number;
  max: number;
  /** Surfaces qui conviennent, par ordre de préférence. */
  surfaces: VideoSceneInstance['surface'][];
}

export const SCENES: Record<string, SceneDef> = {
  hook: {
    id: 'hook',
    slots: [
      { key: 'kicker', max: 24, hint: 'tiny label above, e.g. NEW, LIMITED OFFER' },
      { key: 'title', max: 42, required: true, hint: 'punchy opening line, 3-7 words' },
    ],
    variants: 3,
    nominal: 2.6,
    min: 1.6,
    max: 4,
    surfaces: ['primary', 'light', 'secondary'],
  },
  statement: {
    id: 'statement',
    slots: [
      { key: 'title', max: 60, required: true, hint: 'the main promise, one sentence' },
      { key: 'sub', max: 80, hint: 'supporting line' },
    ],
    variants: 2,
    nominal: 3,
    min: 2,
    max: 5,
    surfaces: ['light', 'secondary', 'primary'],
  },
  product: {
    id: 'product',
    slots: [
      { key: 'name', max: 32, required: true, hint: 'product or service name' },
      { key: 'tagline', max: 60, hint: 'what it brings, short' },
      { key: 'price', max: 18, hint: 'price ONLY if given in brief' },
    ],
    image: 'optional',
    variants: 3,
    nominal: 3.2,
    min: 2.2,
    max: 5,
    surfaces: ['light', 'primary', 'secondary'],
  },
  benefits: {
    id: 'benefits',
    slots: [
      { key: 'title', max: 36, hint: 'short heading' },
      { key: 'b1', max: 34, required: true, hint: 'benefit 1, 2-5 words' },
      { key: 'b2', max: 34, required: true, hint: 'benefit 2, 2-5 words' },
      { key: 'b3', max: 34, hint: 'benefit 3, 2-5 words' },
    ],
    variants: 2,
    nominal: 3.6,
    min: 2.6,
    max: 5.5,
    surfaces: ['light', 'secondary', 'primary'],
  },
  stat: {
    id: 'stat',
    slots: [
      { key: 'value', max: 10, required: true, hint: 'a figure FROM THE BRIEF, e.g. 500+, 24h, 98%' },
      { key: 'label', max: 48, required: true, hint: 'what the figure means' },
    ],
    variants: 2,
    nominal: 2.8,
    min: 2,
    max: 4,
    surfaces: ['primary', 'light', 'accent'],
  },
  offer: {
    id: 'offer',
    slots: [
      { key: 'kicker', max: 24, hint: 'e.g. SPECIAL OFFER' },
      { key: 'oldPrice', max: 16, hint: 'previous price ONLY if given' },
      { key: 'price', max: 18, required: true, hint: 'price or discount FROM THE BRIEF' },
      { key: 'badge', max: 10, hint: 'e.g. -30%' },
      { key: 'note', max: 48, hint: 'condition or end date FROM THE BRIEF' },
    ],
    variants: 2,
    nominal: 3.2,
    min: 2.2,
    max: 5,
    surfaces: ['accent', 'primary', 'light'],
  },
  quote: {
    id: 'quote',
    slots: [
      { key: 'quote', max: 110, required: true, hint: 'customer testimonial FROM THE BRIEF' },
      { key: 'author', max: 32, required: true, hint: 'name of the customer' },
    ],
    variants: 1,
    nominal: 4,
    min: 3,
    max: 6,
    surfaces: ['light', 'secondary'],
  },
  event: {
    id: 'event',
    slots: [
      { key: 'title', max: 40, required: true, hint: 'event name' },
      { key: 'date', max: 24, required: true, hint: 'date FROM THE BRIEF' },
      { key: 'time', max: 16, hint: 'time FROM THE BRIEF' },
      { key: 'place', max: 40, hint: 'place FROM THE BRIEF' },
    ],
    variants: 1,
    nominal: 3.6,
    min: 2.6,
    max: 5.5,
    surfaces: ['light', 'primary'],
  },
  gallery: {
    id: 'gallery',
    slots: [{ key: 'caption', max: 40, hint: 'short caption' }],
    image: 'required',
    minImages: 2,
    variants: 1,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['light', 'secondary'],
  },
  wordswap: {
    id: 'wordswap',
    slots: [
      { key: 'lead', max: 24, required: true, hint: 'lead-in, e.g. "Here it is"' },
      { key: 'w1', max: 16, required: true, hint: 'one strong word' },
      { key: 'w2', max: 16, required: true, hint: 'one strong word' },
      { key: 'w3', max: 16, required: true, hint: 'one strong word' },
    ],
    variants: 1,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['secondary', 'primary', 'light'],
  },
  cta: {
    id: 'cta',
    slots: [
      { key: 'title', max: 40, required: true, hint: 'closing invitation' },
      { key: 'action', max: 26, required: true, hint: 'button text, e.g. Order on WhatsApp' },
      { key: 'contact', max: 40, hint: 'phone, address or site FROM THE BRIEF' },
    ],
    variants: 2,
    nominal: 3,
    min: 2.2,
    max: 4.5,
    surfaces: ['primary', 'accent', 'light'],
  },
  footage: {
    id: 'footage',
    slots: [
      { key: 'kicker', max: 24, hint: 'tiny label above' },
      { key: 'title', max: 42, required: true, hint: 'line shown over the video, 3-7 words' },
      { key: 'sub', max: 70, hint: 'supporting line' },
    ],
    variants: 3,
    nominal: 3.4,
    min: 2.4,
    max: 6,
    surfaces: ['secondary', 'primary', 'light'],
  },
  kinetic: {
    id: 'kinetic',
    slots: [
      { key: 'l1', max: 16, required: true, hint: 'word or very short phrase' },
      { key: 'l2', max: 16, required: true, hint: 'word or very short phrase' },
      { key: 'l3', max: 16, hint: 'word or very short phrase' },
      { key: 'l4', max: 24, hint: 'final punchline' },
    ],
    variants: 2,
    nominal: 3.2,
    min: 2.2,
    max: 5,
    surfaces: ['primary', 'secondary', 'light', 'accent'],
  },
  lottie: {
    id: 'lottie',
    slots: [
      { key: 'title', max: 40, required: true, hint: 'line under the animation' },
      { key: 'sub', max: 70, hint: 'supporting line' },
    ],
    variants: 2,
    nominal: 3.2,
    min: 2.4,
    max: 5,
    surfaces: ['light', 'primary'],
  },
  showcase3d: {
    id: 'showcase3d',
    slots: [
      { key: 'title', max: 36, required: true, hint: 'what is shown in 3D' },
      { key: 'sub', max: 60, hint: 'supporting line' },
    ],
    variants: 1,
    nominal: 4,
    min: 3,
    max: 7,
    surfaces: ['light', 'secondary', 'primary'],
  },
  logo: {
    id: 'logo',
    slots: [{ key: 'tagline', max: 48, hint: 'brand signature line' }],
    variants: 3,
    nominal: 2.4,
    min: 1.8,
    max: 3.5,
    surfaces: ['light', 'primary'],
  },
};
