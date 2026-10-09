/**
 * Le pont d'édition entre un éditeur et l'aperçu d'une vidéo (moteur `apps/ivision/core/engine`).
 *
 * L'aperçu est une page autonome jouée dans un iframe ; il accepte des messages de son parent
 * direct (retouche d'un texte ou d'une image, pose sur une scène, lecture, pause) et en envoie
 * deux : `ivision:ready` (durée, scènes et l'instant où leurs textes sont à l'écran) et
 * `ivision:time` (instant courant). Ce module décrit ce protocole et les libellés des scènes ;
 * le composant Angular (`./angular`) s'en sert, d'autres frameworks le peuvent.
 */

export type PreviewToEditor =
  | { type: 'ivision:ready'; duration: number; scenes: { key: string; sceneId: string; start: number; end: number; moment: number | null }[] }
  | { type: 'ivision:time'; t: number; playing: boolean };

export type EditorToPreview =
  | { type: 'ivision:edit'; key: string; slots?: Record<string, string>; image?: string; images?: string[]; focus?: boolean }
  | { type: 'ivision:focus'; key: string }
  | { type: 'ivision:seek'; t: number }
  | { type: 'ivision:play' }
  | { type: 'ivision:pause' };

/** Une scène telle que l'éditeur la montre (sous-ensemble d'une scène du storyboard). */
export interface EditorScene {
  key: string;
  sceneId: string;
  start: number;
  duration: number;
  slots: Record<string, string>;
  image?: string;
}

/** Les cases d'un type de scène et leur longueur maximale (`GET …/videos/options` → `scenes`). */
export type EditorSlotDefs = Record<string, { key: string; max: number; required: boolean }[]>;

export type EditorLang = 'fr' | 'en';

const SCENES: Record<string, [string, string]> = {
  hook: ['Accroche', 'Hook'],
  statement: ['Affirmation', 'Statement'],
  kinetic: ['Typographie animée', 'Kinetic type'],
  wordswap: ['Mots qui changent', 'Word swap'],
  stat: ['Chiffre clé', 'Key figure'],
  benefits: ['Avantages', 'Benefits'],
  offer: ['Offre', 'Offer'],
  product: ['Produit', 'Product'],
  gallery: ['Galerie', 'Gallery'],
  footage: ['Séquence vidéo', 'Footage'],
  quote: ['Citation', 'Quote'],
  event: ['Événement', 'Event'],
  cta: ['Appel à l’action', 'Call to action'],
  logo: ['Signature', 'Sign-off'],
  lottie: ['Animation', 'Animation'],
  showcase3d: ['Vitrine 3D', '3D showcase'],
};

const SLOTS: Record<string, [string, string]> = {
  title: ['Titre', 'Title'],
  sub: ['Sous-titre', 'Subtitle'],
  kicker: ['Surtitre', 'Kicker'],
  action: ['Bouton', 'Button'],
  contact: ['Contact', 'Contact'],
  tagline: ['Signature', 'Tagline'],
  value: ['Chiffre', 'Figure'],
  label: ['Légende', 'Label'],
  name: ['Nom', 'Name'],
  price: ['Prix', 'Price'],
  oldPrice: ['Ancien prix', 'Old price'],
  badge: ['Pastille', 'Badge'],
  note: ['Précision', 'Note'],
  quote: ['Citation', 'Quote'],
  author: ['Auteur', 'Author'],
  date: ['Date', 'Date'],
  time: ['Heure', 'Time'],
  place: ['Lieu', 'Place'],
  caption: ['Légende', 'Caption'],
  lead: ['Début de phrase', 'Lead'],
};

/** Le nom lisible d'un type de scène (`hook` → « Accroche »). */
export function sceneLabel(sceneId: string, lang: EditorLang = 'fr'): string {
  const entry = SCENES[sceneId];
  return entry ? entry[lang === 'en' ? 1 : 0] : sceneId;
}

/** Le nom lisible d'une case (`l2` → « Ligne 2 », `b1` → « Point 1 »). */
export function slotLabel(key: string, lang: EditorLang = 'fr'): string {
  const entry = SLOTS[key];
  if (entry) return entry[lang === 'en' ? 1 : 0];
  const line = /^l(\d)$/.exec(key);
  if (line) return `${lang === 'en' ? 'Line' : 'Ligne'} ${line[1]}`;
  const item = /^b(\d)$/.exec(key);
  if (item) return `${lang === 'en' ? 'Benefit' : 'Avantage'} ${item[1]}`;
  const word = /^w(\d)$/.exec(key);
  if (word) return `${lang === 'en' ? 'Word' : 'Mot'} ${word[1]}`;
  return key;
}

export function formatSeconds(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
