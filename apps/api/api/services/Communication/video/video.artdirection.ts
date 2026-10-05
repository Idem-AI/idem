/**
 * LA DIRECTION ARTISTIQUE DE LA CHARTE, TRADUITE EN MOUVEMENT.
 *
 * La charte IDEM porte une DA complète (style du catalogue, grille, densité,
 * casse, contraste, médium d'image, traitement, éléments graphiques, à faire / à
 * éviter). La vidéo la RESPECTE : pas en la recopiant dans un prompt, mais en la
 * traduisant ici, par le code, en paramètres du moteur :
 *
 *   style du catalogue      → directions de motion admises (la DA l'emporte sur le type)
 *   casse et interlettrage  → casse des titres
 *   densité / espace        → rythme (une DA aérée laisse respirer)
 *   contraste couleur       → stratégie de couleur (monochrome + accent, aplats…)
 *   traitement d'image      → grain, bichromie
 *   éléments graphiques     → fonds et annotations du kit (bonus dans le graphe)
 *   médium d'image          → scènes privilégiées (3D, illustration, photo, clips)
 *
 * Tout est déterministe ; une DA absente ne change rien.
 */
import { ArtDirectionModel } from '../../../models/art-direction.model';
import { VideoArtOverrides } from '../../../models/motionVideo.model';
import { DirectionId } from './video.direction';

/** Style du catalogue → directions de motion qui le prolongent (toutes les entrées du catalogue). */
export const ART_DIRECTIONS: Record<string, DirectionId[]> = {
  minimalism: ['precision', 'swiss', 'editorial'],
  maximalism: ['kinetic', 'brutal', 'collage'],
  futuristic: ['precision', 'kinetic', 'drenched'],
  'vector-art': ['kinetic', 'swiss', 'collage'],
  'collage-art': ['collage', 'editorial'],
  retro: ['collage', 'editorial'],
  cyberpunk: ['kinetic', 'brutal', 'drenched'],
  'pop-art': ['kinetic', 'collage', 'brutal'],
  glassmorphism: ['precision', 'cinematic'],
  clay: ['collage', 'kinetic'],
  'pixel-art': ['kinetic', 'brutal'],
  editorial: ['editorial', 'cinematic', 'swiss'],
  y2k: ['kinetic', 'collage', 'drenched'],
  swiss: ['swiss', 'precision'],
  surreal: ['cinematic', 'drenched', 'collage'],
  bohemian: ['collage', 'editorial'],
  victorian: ['editorial', 'cinematic'],
  graffiti: ['brutal', 'collage', 'kinetic'],
  aurora: ['cinematic', 'drenched'],
  handwritten: ['collage', 'editorial'],
};

export interface MotionArt {
  /** Directions admises par la DA (vide = pas de contrainte). */
  directions: DirectionId[];
  /** Réglages posés sur la direction retenue. */
  overrides: VideoArtOverrides;
  /** Bonus de nœuds du graphe (id de nœud → poids). */
  boosts: Record<string, number>;
  /** Médium d'image : oriente le découpage (3D, illustration, photo, clips). */
  medium?: 'photography' | 'illustration' | 'render-3d' | 'collage' | 'abstract' | 'mixed';
  /** Résumé court pour le planificateur (quelques mots). */
  summary?: string;
}

const has = (text: string | undefined, re: RegExp) => !!text && re.test(text.toLowerCase());

export function motionFromArtDirection(ad: Partial<ArtDirectionModel> | null | undefined): MotionArt {
  const out: MotionArt = { directions: [], overrides: {}, boosts: {} };
  if (!ad) return out;
  out.directions = ART_DIRECTIONS[(ad.styleId || '').toLowerCase()] || [];

  const caseText = ad.typography?.caseAndTracking;
  if (has(caseText, /majuscul|capitales|uppercase|all.?caps/)) out.overrides.displayCase = 'upper';
  else if (has(caseText, /minuscul|lowercase|bas de casse|casse normale|sentence/)) out.overrides.displayCase = 'none';

  const density = `${ad.layout?.density || ''} ${ad.layout?.whitespace || ''}`;
  if (has(density, /airy|a[ée]r[ée]|respir|g[ée]n[ée]reux|beaucoup d.espace|vide/)) out.overrides.pace = 1.15;
  else if (has(density, /dense|serr[ée]|rempli|charg[ée]/)) out.overrides.pace = 0.9;

  const contrast = `${ad.color?.contrast || ''} ${ad.color?.application || ''}`;
  if (has(contrast, /monochrom|ton sur ton|sobre|doux|subtil/)) out.overrides.color = 'restrained';
  else if (has(contrast, /aplat|satur|vif|brutal|fort contraste|audacieux/)) out.overrides.color = 'committed';

  const treatment = ad.imagery?.treatment;
  if (has(treatment, /grain|argentique|film|bruit/)) out.overrides.decor = 'grain';
  if (has(treatment, /papier|texture|kraft/)) out.overrides.decor = 'paper';

  const devices = [...(ad.graphicDevices || []), ad.layout?.signatureMove || '', ad.typography?.treatment || ''].join(' ').toLowerCase();
  const boost = (id: string, w: number) => (out.boosts[id] = (out.boosts[id] || 0) + w);
  if (/filet|ligne|rule|trait fin/.test(devices)) boost('bg:ticks', 1);
  if (/grille|grid|module/.test(devices)) boost('bg:dot-grid', 2);
  if (/point|pois|dot/.test(devices)) boost('bg:dot-grid', 1);
  if (/trame|halftone|demi-teinte|s[ée]rigraph/.test(devices)) boost('bg:halftone', 2);
  if (/forme|g[ée]om[ée]tri|cercle|shape|pastille/.test(devices)) boost('bg:shape-field', 2);
  if (/halo|lueur|glow|aurore|d[ée]grad/.test(devices)) boost('bg:spotlight', 2);
  if (/bandeau|d[ée]filant|marquee|typo g[ée]ante|outline/.test(devices)) boost('bg:marquee', 2);
  if (/soulign|underline/.test(devices)) boost('annotate:underline', 2);
  if (/surlign|marqueur|highlight/.test(devices)) boost('annotate:marker', 2);
  if (/entour|cercl[ée] [àa] la main|griffon|manuscrit|main lev/.test(devices)) boost('annotate:circle', 2);
  if (/trac[ée]|contour|ligne continue|line art/.test(devices)) boost('logo:draw', 1.5);
  // « À éviter » de la charte : on retire ce qu'elle interdit.
  const donts = (ad.donts || []).join(' ').toLowerCase();
  if (/d[ée]cor|ornement|surcharg/.test(donts)) for (const id of ['bg:shape-field', 'bg:marquee', 'bg:halftone']) boost(id, -3);
  if (/rebond|bounce|cartoon|enfantin/.test(donts)) boost('easing:spring', -5);

  const medium = (ad.imagery?.medium || '').toLowerCase();
  if (['photography', 'illustration', 'render-3d', 'collage', 'abstract', 'mixed'].includes(medium)) out.medium = medium as MotionArt['medium'];
  out.summary = [ad.styleName || ad.styleId, ad.tagline, out.medium ? `imagery: ${out.medium}` : '', (ad.keywords || []).slice(0, 4).join(', ')].filter(Boolean).join(' · ').slice(0, 200);
  return out;
}
