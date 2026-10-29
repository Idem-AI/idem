/**
 * Ce que le directeur et le planificateur reçoivent : la demande, la marque, les médias, le cadre.
 * Compilé une fois par le service ; chaque agent n'en lit que ce qui le concerne.
 */
import type { CreativityLevel } from '../../creativity/levels';
import type { VideoFormat } from '../contracts/model';
import type { RequestSpec } from '../request/request';
import type { VideoIntentSpec } from '../request/intent';
import { languageName } from '../../text/language';
import { PRODUCT_SKELETON } from '../../../../../../packages/motion-compiler/src';

export interface FilmBrief {
  /** La demande de l'utilisateur, en entier (bornée). */
  request: string;
  /** Langue des textes et de la voix (code court). */
  language: string;
  objective?: string;
  /** Famille demandée (kinetic, product, footage…) : une indication, jamais une recette. */
  type?: string;
  intent?: VideoIntentSpec;
  spec?: RequestSpec;
  /** La marque en quelques lignes (nom, secteur, ton, couleurs, polices, direction artistique). */
  brandSheet: string;
  anonymous: boolean;
  format: VideoFormat;
  durationSec: number;
  /** Les médias disponibles (imports, captures de la marque) : identifiant, nature, description. */
  media: { id: string; kind: 'image' | 'video'; note?: string; durationSec?: number; origin?: string }[];
  voice: boolean;
  /** Ce que la génération peut encore produire (0 : rien). */
  newMedia: { images: number; clips: number };
  /** La vidéo modèle à suivre (résumé de son analyse). */
  reference?: string;
  /** Ses plans, un par scène (déjà ramenés au nombre de scènes admis) : la fiche de chacun est donnée à l'auteur de sa scène. */
  referenceShots?: { line: string; transition?: string }[];
  /** Les films déjà faits pour la marque (titre — concept) : pour ne pas refaire le même. */
  previous: string[];
  /** Les directions visuelles des films précédents (la plus récente d'abord) : jamais la même deux films de suite. */
  previousDirections?: string[];
  /** Vidéo produit / promotion : les huit temps (accroche … signature) servent de squelette. */
  skeleton?: boolean;
  level: CreativityLevel;
}

/** Les huit temps d'une vidéo produit, en une ligne (squelette donné au directeur et au planificateur). */
export function skeletonLine(): string {
  return PRODUCT_SKELETON.map((s, i) => `${i + 1}. ${s.role} (${s.en}, ~${Math.round(s.share * 100)} %)`).join(' · ');
}

/** Nombre de scènes admis pour une durée (lisibilité : ~2 à 4 s par scène). */
export function sceneRange(durationSec: number): [number, number] {
  if (durationSec <= 8) return [2, 3];
  if (durationSec <= 16) return [3, 6];
  if (durationSec <= 32) return [5, 9];
  if (durationSec <= 64) return [8, 16];
  return [14, 32];
}

export const formatLine = (b: Pick<FilmBrief, 'format' | 'durationSec'>) => {
  const shape = { story: 'vertical 9:16 (1080×1920)', square: 'square 1:1 (1080×1080)', portrait: 'portrait 4:5 (1080×1350)', landscape: 'horizontal 16:9 (1920×1080)' }[b.format];
  return `${b.durationSec} seconds, ${shape}`;
};

export const languageLine = (code: string) => `${languageName(code)} (${code})`;

/** Les médias, une ligne chacun : « m1 — photo — description ». */
export function mediaLines(b: Pick<FilmBrief, 'media'>): string {
  if (!b.media.length) return '(none)';
  return b.media
    .map((m) => `${m.id} — ${m.kind === 'video' ? `video clip${m.durationSec ? ` ${Math.round(m.durationSec)}s` : ''}` : 'image'}${m.origin ? ` (${m.origin})` : ''}${m.note ? ` — ${m.note.slice(0, 180)}` : ''}`)
    .join('\n');
}

/** Le scénario de l'utilisateur, scène par scène (textes mot pour mot). */
export function scriptLines(spec: RequestSpec): string {
  return spec.scenes
    .map((s, i) =>
      [
        `SCENE ${i + 1}${s.label ? ` « ${s.label} »` : ''}: ${s.description.slice(0, 500)}`,
        s.texts.length ? `  on-screen texts (fixed, exact): ${s.texts.map((t) => JSON.stringify(t)).join(' · ')}` : '',
        s.props.length ? `  texts inside an interface/image (fixed): ${s.props.map((t) => JSON.stringify(t)).join(' · ')}` : '',
        s.voice.length ? `  voice-over written by the client (fixed): ${s.voice.join(' ')}` : '',
        s.media.length ? `  medium: ${s.media.join(', ')}${s.footage ? ` — filmed shot: ${s.footage}` : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');
}

/** L'intention lue (objectif, mode de production, langage de motion) : des indications. */
export function intentLine(b: Pick<FilmBrief, 'intent' | 'objective' | 'type'>): string {
  const parts = [
    b.intent?.objective ? `goal: ${b.intent.objective}` : b.objective ? `goal: ${b.objective}` : '',
    b.intent?.productionModes?.length ? `production: ${b.intent.productionModes.join(', ')}` : '',
    b.intent?.motionDirection?.length ? `motion language wished: ${b.intent.motionDirection.join(', ')}` : '',
    b.type && b.type !== 'auto' && b.type !== 'mix' ? `family asked by the client: ${b.type}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}
