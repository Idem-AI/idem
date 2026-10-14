/**
 * Le pont d'édition entre un éditeur et l'aperçu d'une vidéo (moteur Motion Canvas, `apps/ivision/core/motion`).
 *
 * L'aperçu est une page autonome jouée dans un iframe isolé ; il accepte des messages de son parent
 * direct (lecture, pause, position, scène, retouche d'un texte ou d'une image) et en envoie trois :
 * `ivision:ready` (durée, scènes, erreurs), `ivision:time` (instant courant) et `ivision:errors`.
 * Ce module décrit ce protocole, la scène telle que l'éditeur la montre et les libellés des textes ;
 * le composant Angular (`./angular`) s'en sert, d'autres frameworks le peuvent.
 */

export interface PreviewSceneError {
  key: string;
  stage: 'compile' | 'runtime';
  message: string;
}

export type PreviewToEditor =
  | { type: 'ivision:ready'; duration: number; scenes: { key: string; start: number; end: number }[]; errors: PreviewSceneError[] }
  | { type: 'ivision:time'; t: number; playing: boolean }
  | { type: 'ivision:errors'; errors: PreviewSceneError[] };

export type EditorToPreview =
  | { type: 'ivision:edit'; key: string; texts?: Record<string, string>; media?: { id: string; url: string }[]; focus?: boolean }
  | { type: 'ivision:focus'; key: string }
  | { type: 'ivision:seek'; t: number }
  | { type: 'ivision:play' }
  | { type: 'ivision:pause' };

/** Une scène telle que l'éditeur la montre (sous-ensemble d'une scène du film). */
export interface EditorScene {
  key: string;
  start: number;
  duration: number;
  /** Ce que la scène doit faire comprendre (intention du storyboard). */
  purpose: string;
  /** Les textes à l'écran, par clé : lus par le code de la scène. */
  texts: Record<string, string>;
  /** Les médias de la scène (le premier, s'il est une image, peut être remplacé). */
  media: { id: string; kind: 'image' | 'video'; url: string }[];
  thumbnail?: string;
  status: 'planned' | 'ready' | 'error';
  error?: { stage: 'author' | 'compile' | 'runtime'; message: string };
  /** La dernière demande de retouche visuelle faite sur cette scène. */
  instruction?: string;
}

/** Ce que l'éditeur demande à son hôte (l'hôte appelle l'API, puis recharge la vidéo). */
export type SceneAction =
  | { kind: 'revise'; key: string; instruction: string }
  | { kind: 'fix'; key: string }
  | { kind: 'regenerate'; key: string };

export type EditorLang = 'fr' | 'en';

const TEXTS: Record<string, [string, string]> = {
  headline: ['Titre', 'Headline'],
  title: ['Titre', 'Title'],
  sub: ['Sous-titre', 'Subtitle'],
  subtitle: ['Sous-titre', 'Subtitle'],
  kicker: ['Surtitre', 'Kicker'],
  cta: ['Appel à l’action', 'Call to action'],
  button: ['Bouton', 'Button'],
  caption: ['Légende', 'Caption'],
  label: ['Légende', 'Label'],
  figure: ['Chiffre', 'Figure'],
  number: ['Chiffre', 'Figure'],
  price: ['Prix', 'Price'],
  date: ['Date', 'Date'],
  place: ['Lieu', 'Place'],
  contact: ['Contact', 'Contact'],
  quote: ['Citation', 'Quote'],
  author: ['Auteur', 'Author'],
  tagline: ['Signature', 'Tagline'],
  name: ['Nom', 'Name'],
  url: ['Adresse web', 'Web address'],
};

/** Le nom lisible d'un texte (`headline` → « Titre », `text2` → « Texte 2 », `prop1` → « Dans l'écran 1 »). */
export function textLabel(key: string, lang: EditorLang = 'fr'): string {
  const entry = TEXTS[key];
  if (entry) return entry[lang === 'en' ? 1 : 0];
  const text = /^text(\d+)$/.exec(key);
  if (text) return `${lang === 'en' ? 'Text' : 'Texte'} ${text[1]}`;
  const prop = /^prop(\d+)$/.exec(key);
  if (prop) return `${lang === 'en' ? 'In the screen' : 'Dans l’écran'} ${prop[1]}`;
  const spaced = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatSeconds(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/**
 * Les scènes d'un film pour l'éditeur, à partir de la vidéo telle que l'API la rend (`video.film`,
 * `video.media`). Même forme côté IDEM et iVision.
 */
export function editorScenes(video: { film?: { scenes: Array<Omit<EditorScene, 'media' | 'instruction'> & { media: string[]; author?: { instruction?: string } }> }; media?: { id: string; kind: string; url: string }[] } | null | undefined): EditorScene[] {
  const byId = new Map((video?.media || []).map((m) => [m.id, m]));
  return (video?.film?.scenes || []).map((s) => ({
    key: s.key,
    start: s.start,
    duration: s.duration,
    purpose: s.purpose,
    texts: s.texts,
    media: s.media
      .map((id) => byId.get(id))
      .filter((m): m is { id: string; kind: string; url: string } => !!m && (m.kind === 'image' || m.kind === 'video'))
      .map((m) => ({ id: m.id, kind: m.kind as 'image' | 'video', url: m.url })),
    ...(s.thumbnail ? { thumbnail: s.thumbnail } : {}),
    status: s.status,
    ...(s.error ? { error: s.error } : {}),
    ...(s.author?.instruction ? { instruction: s.author.instruction } : {}),
  }));
}
