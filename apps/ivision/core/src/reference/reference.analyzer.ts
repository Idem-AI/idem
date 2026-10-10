/**
 * LA VIDÉO MODÈLE — l'utilisateur montre une vidéo qu'il aime, on en reproduit les animations.
 *
 * On ne reproduit ni la musique, ni les sons, ni les images, ni les textes : on reproduit la
 * MISE EN SCÈNE — combien de plans, combien de temps chacun, ce qui s'y passe, comment le texte
 * entre, comment on passe d'un plan à l'autre, où se pose une photo ou un clip — avec la marque,
 * les textes et les médias de l'utilisateur. Sans aucun modèle d'abord, avec la vision ensuite :
 *
 *   1. ffprobe   durée, format, piste son ;
 *   2. ffmpeg    les coupes (changement de scène + saut de couleur), puis, pour un long plan continu
 *                (fréquent en motion design : tout bouge sans coupe), des « temps » de 4 s ;
 *   3. images    pour chaque plan : fin du plan précédent, début, milieu, fin (planche) ;
 *                l'énergie du mouvement se mesure par différence d'images ;
 *   4. vision    chaque planche est décrite DANS NOTRE VOCABULAIRE (mise en page, entrée du texte,
 *                transition, caméra, média, rôle dans le récit) : le résultat se branche tel quel
 *                sur le moteur — motifs, techniques, transitions du graphe de capacités.
 *
 * Le plan de reproduction (`ReferenceBlueprint`) sert aux deux pipelines : les menus (Low → Max :
 * scènes, durées, mises en page, entrées, coupes imposées) et le film d'auteur (Ultra : chaque
 * plan est décrit au directeur et au codeur, la critique visuelle compare au modèle).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import logger from '../runtime/logger';
import type { DirectionId, MotionTransition, TextTechnique } from '../video/video.direction';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export type ShotRole = 'hook' | 'claim' | 'proof' | 'list' | 'offer' | 'show' | 'cta' | 'signature';
export type ShotMedia = 'none' | 'photo' | 'video';

/** Les mises en page reconnues (vocabulaire de la vision) → motifs du moteur. */
export const REFERENCE_LAYOUTS = {
  'centered-title': { pattern: 'directionClassic', label: 'titre centré' },
  'left-title': { pattern: 'directionClassic', label: 'titre ferré à gauche' },
  'poster-stack': { pattern: 'posterStack', label: 'mots empilés en affiche' },
  'giant-number': { pattern: 'counterAcceleration', label: 'chiffre géant' },
  'split-blocks': { pattern: 'colorSplit', label: 'deux blocs de couleur' },
  'diagonal-band': { pattern: 'diagonalCross', label: 'bandeau diagonal' },
  circle: { pattern: 'circleStage', label: 'cercle de la marque' },
  cards: { pattern: 'cardStack', label: 'cartes superposées' },
  grid: { pattern: 'bentoFocus', label: 'grille' },
  checklist: { pattern: 'checkTrail', label: 'liste cochée' },
  quote: { pattern: 'quoteGiant', label: 'citation' },
  ticker: { pattern: 'tickerFrame', label: 'bandeaux défilants' },
  'spotlight-word': { pattern: 'wordSpotlight', label: 'mot sous le projecteur' },
  'frame-offset': { pattern: 'frameOffset', label: 'bloc et cadre décalés' },
  'ring-chart': { pattern: 'ringSweep', label: 'anneau de pourcentage' },
  'bar-chart': { pattern: 'chartExplosion', label: 'barres' },
  gauge: { pattern: 'gaugeFill', label: 'jauge' },
  'price-burst': { pattern: 'priceBurst', label: 'prix en étoile' },
  'photo-full': { pattern: 'photoCinema', label: 'photo plein cadre' },
  'photo-split': { pattern: 'photoSplit', label: 'photo sur une moitié' },
  'photo-window': { pattern: 'photoWindow', label: 'photo dans une forme' },
  'photo-in-text': { pattern: 'photoKnockout', label: 'image dans les lettres' },
  'word-swap': { pattern: 'typeCascade', label: 'mot qui change' },
  'kinetic-words': { pattern: 'kineticBurst', label: 'mots qui jaillissent' },
  logo: { pattern: 'logoDraw', label: 'logo' },
} as const;
export type ReferenceLayout = keyof typeof REFERENCE_LAYOUTS;

/** Entrées de texte reconnues → techniques du moteur. */
export const REFERENCE_TEXT_MOTIONS: Record<string, TextTechnique> = {
  'mask-up': 'maskUp',
  'letter-cascade': 'charCascade',
  typewriter: 'typewriter',
  'scale-blur': 'scaleBlur',
  'word-by-word': 'blurWords',
  'slide-alternate': 'slideAlternate',
  stack: 'stackPush',
  zoom: 'zoomWords',
  wave: 'wave',
  scramble: 'scramble',
  'box-reveal': 'boxReveal',
  'line-wipe': 'lineWipe',
  'track-in': 'trackIn',
  'spring-up': 'springUp',
  skew: 'skewIn',
  outline: 'outlineFill',
  fade: 'blurWords',
};

/** Passages reconnus → transitions du moteur. */
export const REFERENCE_TRANSITIONS: Record<string, MotionTransition> = {
  cut: 'cut',
  'flash-cut': 'flashCut',
  fade: 'dissolve',
  wipe: 'wipe',
  push: 'push',
  slide: 'slideOver',
  'zoom-through': 'zoomThrough',
  'zoom-blur': 'zoomBlur',
  whip: 'whip',
  iris: 'iris',
  'shape-wipe': 'shapeWipe',
  stripes: 'stripes',
  'color-blocks': 'blockStack',
  split: 'split',
  liquid: 'liquid',
  cube: 'cube',
  glitch: 'glitch',
};

export const REFERENCE_CAMERAS = ['still', 'push', 'pull', 'drift', 'rise', 'tilt'] as const;

export interface ReferenceText {
  role: 'headline' | 'support' | 'label' | 'number' | 'button';
  /** Nombre de mots vus (la copie de l'utilisateur en garde l'ordre de grandeur). */
  words: number;
  position: 'top' | 'center' | 'bottom' | 'left' | 'right';
}

export interface ReferenceShot {
  index: number;
  start: number;
  duration: number;
  role: ShotRole;
  media: ShotMedia;
  layout: ReferenceLayout;
  /** Entrée du titre (technique du moteur). */
  textMotion?: TextTechnique;
  /** Passage DEPUIS le plan précédent (transition du moteur). */
  transitionIn?: MotionTransition;
  camera: (typeof REFERENCE_CAMERAS)[number];
  background: 'light' | 'brand' | 'dark' | 'photo' | 'video' | 'pattern';
  texts: ReferenceText[];
  energy: 'calm' | 'medium' | 'high';
  /** Ce qu'on voit et comment ça bouge, en anglais : la consigne du directeur et du codeur (Ultra). */
  description: string;
  /** Planche du plan (JPEG) : aperçu dans l'interface, référence de la critique visuelle. */
  sheet?: Buffer;
}

export interface ReferenceBlueprint {
  kind: 'video';
  duration: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'square' | 'landscape';
  hasAudio: boolean;
  shots: ReferenceShot[];
  /** Coupes par seconde : le tempo du modèle. */
  pace: number;
  /** Direction de motion la plus proche, et rythme. */
  direction?: DirectionId;
  rhythm?: 'steady' | 'crescendo' | 'staccato' | 'breathe' | 'drop';
  /** Résumé lisible (interface, journal). */
  summary: string;
  /** Lu par la vision (`vision`) ou seulement mesuré (`measured`). */
  source: 'vision' | 'measured';
}

export interface AnalyzeVideoOptions {
  vision?: (base64: string, mimeType: string, instruction: string) => Promise<string>;
  /** Au-delà, les plans les plus courts sont fusionnés. */
  maxShots?: number;
  onProgress?: (step: 'probe' | 'cuts' | 'frames' | 'vision' | 'done', data?: Record<string, unknown>) => void;
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d.toString().slice(-200000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} ${code}: ${stderr.slice(-300)}`))));
  });
}

async function probe(file: string) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  const json = JSON.parse(stdout);
  const video = (json.streams || []).find((s: any) => s.codec_type === 'video');
  if (!video) throw new Error('reference_without_video');
  const duration = Number(json.format?.duration || video.duration || 0);
  return { duration, width: Number(video.width) || 1080, height: Number(video.height) || 1920, hasAudio: (json.streams || []).some((s: any) => s.codec_type === 'audio') };
}

/** Instants de coupe (s), par la détection de changement de scène de ffmpeg. */
async function sceneCuts(file: string, threshold = 0.28): Promise<number[]> {
  const { stderr } = await run(FFMPEG, ['-hide_banner', '-i', file, '-filter:v', `select='gt(scene,${threshold})',showinfo`, '-an', '-f', 'null', '-']);
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => Number.isFinite(t));
}

const CUT_FPS = 8;
const CUT_SIDE = 24;

/** Les vignettes couleur de la vidéo, 8 par seconde (la détection de scène de ffmpeg ne lit que la luminance). */
function thumbnails(file: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${CUT_FPS},scale=${CUT_SIDE}:${CUT_SIDE}`, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const chunks: Buffer[] = [];
    let stderr = '';
    p.stdout.on('data', (d: Buffer) => chunks.push(d));
    p.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${FFMPEG} ${code}: ${stderr.slice(-300)}`))));
  });
}

/** Coupes par écart de COULEUR : un saut net d'une image à l'autre, bien au-dessus du mouvement autour. */
async function colorCuts(file: string): Promise<number[]> {
  const raw = await thumbnails(file);
  const size = CUT_SIDE * CUT_SIDE * 3;
  const frames = Math.floor(raw.length / size);
  const diffs: number[] = [0];
  for (let f = 1; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Math.abs(raw[f * size + i] - raw[(f - 1) * size + i]);
    diffs.push(sum / size / 255);
  }
  const cuts: number[] = [];
  for (let f = 1; f < frames; f++) {
    const around = diffs.slice(Math.max(1, f - 4), f).concat(diffs.slice(f + 1, f + 5)).sort((a, b) => a - b);
    const level = around.length ? around[Math.floor(around.length / 2)] : 0;
    if (diffs[f] > 0.12 && diffs[f] > level * 3 + 0.02) cuts.push(f / CUT_FPS);
  }
  return cuts;
}

/** Les coupes du film : changement de scène (luminance) ∪ saut de couleur, à 0,3 s près. */
async function detectCuts(file: string): Promise<number[]> {
  const [scene, color] = await Promise.all([
    sceneCuts(file),
    colorCuts(file).catch((error) => {
      logger.warn('reference.color_cuts_failed', { event: 'reference.color_cuts_failed', error });
      return [] as number[];
    }),
  ]);
  const all = [...scene, ...color].sort((a, b) => a - b);
  return all.filter((t, i) => !i || t - all[i - 1] > 0.3);
}

/** Coupes → plans : plans trop courts fusionnés, longs plans continus découpés en « temps ». */
export function shotsFromCuts(cuts: number[], duration: number, maxShots = 12): { start: number; duration: number }[] {
  const bounds = [0, ...cuts.filter((t) => t > 0.4 && t < duration - 0.4).sort((a, b) => a - b), duration];
  let shots: { start: number; duration: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const d = bounds[i + 1] - start;
    if (d < 0.6 && shots.length) {
      shots[shots.length - 1].duration += d;
      continue;
    }
    // Un plan continu de plus de 6 s porte plusieurs « temps » d'animation.
    const parts = d > 6 ? Math.round(d / 4) : 1;
    for (let k = 0; k < parts; k++) shots.push({ start: start + (d / parts) * k, duration: d / parts });
  }
  while (shots.length > maxShots) {
    let shortest = 0;
    shots.forEach((s, i) => (s.duration < shots[shortest].duration ? (shortest = i) : 0));
    const into = shortest === 0 ? 1 : shortest - 1;
    const a = Math.min(shortest, into);
    const merged = { start: shots[a].start, duration: shots[a].duration + shots[a + 1].duration };
    shots = [...shots.slice(0, a), merged, ...shots.slice(a + 2)];
  }
  return shots.map((s) => ({ start: Math.round(s.start * 100) / 100, duration: Math.round(s.duration * 100) / 100 }));
}

async function frameAt(file: string, t: number, out: string): Promise<Buffer> {
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, t)), '-i', file, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4', '-y', out]);
  return fs.readFileSync(out);
}

/** Écart moyen entre deux images (0 → 1) : l'énergie du mouvement à l'intérieur du plan. */
async function frameDiff(a: Buffer, b: Buffer): Promise<number> {
  const [x, y] = await Promise.all([sharp(a).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer(), sharp(b).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer()]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  return sum / x.length / 255;
}

async function contactSheet(frames: Buffer[], height = 300): Promise<Buffer> {
  const tiles = await Promise.all(frames.map((f) => sharp(f).resize({ height }).jpeg().toBuffer({ resolveWithObject: true })));
  const width = tiles.reduce((w, t) => w + t.info.width, 0) + (tiles.length - 1) * 6;
  let x = 0;
  const composite = tiles.map((t) => {
    const left = x;
    x += t.info.width + 6;
    return { input: t.data, left, top: 0 };
  });
  return sharp({ create: { width, height, channels: 3, background: '#7f7f7f' } }).composite(composite).jpeg({ quality: 78 }).toBuffer();
}

function parseJson(raw: string): Record<string, any> | null {
  const m = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

const ROLES: ShotRole[] = ['hook', 'claim', 'proof', 'list', 'offer', 'show', 'cta', 'signature'];
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(String(value || '').toLowerCase() as T) ? (String(value).toLowerCase() as T) : fallback);

function shotInstruction(index: number, count: number, duration: number): string {
  return [
    `Frames of shot ${index + 1} of ${count} of a motion-design video (${duration.toFixed(1)} s). Left to right: ${index ? 'END of the previous shot, then ' : ''}start, middle, end of THIS shot.`,
    'Describe it for a motion designer who must REPRODUCE the animation (not the content). Answer ONLY JSON:',
    `{"role": ${ROLES.join('|')},`,
    ` "media": "none|photo|video" (a photo or live footage occupies the frame?),`,
    ` "layout": ${Object.keys(REFERENCE_LAYOUTS).join('|')},`,
    ` "textMotion": ${Object.keys(REFERENCE_TEXT_MOTIONS).join('|')} (how the main text enters),`,
    index ? ` "transitionIn": ${Object.keys(REFERENCE_TRANSITIONS).join('|')} (how the previous shot hands over to this one),` : '',
    ` "camera": ${REFERENCE_CAMERAS.join('|')},`,
    ' "background": "light|brand|dark|photo|video|pattern",',
    ' "texts": [{"role": "headline|support|label|number|button", "words": n, "position": "top|center|bottom|left|right"}],',
    ' "energy": "calm|medium|high",',
    ' "description": "what we see and exactly how it moves, 40 words max, no brand names, no quoted text"}',
  ]
    .filter(Boolean)
    .join('\n');
}

const DIRECTION_HINT: Record<string, DirectionId> = { calm: 'cinematic', medium: 'editorial', high: 'kinetic' };

/** L'analyse complète d'une vidéo modèle (fichier local). */
export async function analyzeReferenceVideo(file: string, options: AnalyzeVideoOptions = {}): Promise<ReferenceBlueprint> {
  const progress = options.onProgress || (() => undefined);
  progress('probe');
  const meta = await probe(file);
  if (meta.duration < 1) throw new Error('reference_too_short');
  const duration = Math.min(meta.duration, 120);
  progress('cuts');
  const cuts = await detectCuts(file).catch((error) => {
    logger.warn('reference.cuts_failed', { event: 'reference.cuts_failed', error });
    return [] as number[];
  });
  const spans = shotsFromCuts(cuts, duration, options.maxShots ?? 12);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-ref-'));
  try {
    progress('frames', { shots: spans.length });
    const shots: ReferenceShot[] = [];
    let previousEnd: Buffer | undefined;
    for (const [i, span] of spans.entries()) {
      const t = (k: number) => span.start + Math.max(0.08, Math.min(span.duration - 0.08, span.duration * k));
      const [start, middle, end] = await Promise.all([frameAt(file, t(0.08), path.join(dir, `${i}-a.jpg`)), frameAt(file, t(0.5), path.join(dir, `${i}-b.jpg`)), frameAt(file, t(0.92), path.join(dir, `${i}-c.jpg`))]);
      const motion = Math.max(await frameDiff(start, middle), await frameDiff(middle, end));
      const sheet = await contactSheet(previousEnd ? [previousEnd, start, middle, end] : [start, middle, end]);
      previousEnd = end;
      const energy: ReferenceShot['energy'] = motion > 0.16 ? 'high' : motion > 0.06 ? 'medium' : 'calm';
      shots.push({
        index: i,
        start: span.start,
        duration: span.duration,
        role: i === 0 ? 'hook' : i === spans.length - 1 ? 'signature' : 'claim',
        media: 'none',
        layout: i === spans.length - 1 ? 'logo' : 'centered-title',
        camera: 'still',
        background: 'brand',
        texts: [{ role: 'headline', words: 4, position: 'center' }],
        energy,
        description: `Shot ${i + 1}: ${energy} motion, ${span.duration.toFixed(1)} s.`,
        sheet,
        ...(i ? { transitionIn: (span.duration < 1.2 ? 'cut' : 'dissolve') as MotionTransition } : {}),
      });
    }

    let source: ReferenceBlueprint['source'] = 'measured';
    if (options.vision) {
      progress('vision', { shots: shots.length });
      // Trois plans lus en même temps au plus : le fournisseur ralentit au-delà.
      let next = 0;
      const worker = async () => {
        while (next < shots.length) {
          const shot = shots[next++];
          try {
            const json = parseJson(await options.vision!(shot.sheet!.toString('base64'), 'image/jpeg', shotInstruction(shot.index, shots.length, shot.duration)));
            if (!json) continue;
            source = 'vision';
            shot.role = pick(json.role, ROLES, shot.role);
            shot.media = pick(json.media, ['none', 'photo', 'video'] as const, shot.media);
            shot.layout = pick(json.layout, Object.keys(REFERENCE_LAYOUTS) as ReferenceLayout[], shot.layout);
            if (REFERENCE_TEXT_MOTIONS[json.textMotion]) shot.textMotion = REFERENCE_TEXT_MOTIONS[json.textMotion];
            if (shot.index && REFERENCE_TRANSITIONS[json.transitionIn]) shot.transitionIn = REFERENCE_TRANSITIONS[json.transitionIn];
            shot.camera = pick(json.camera, REFERENCE_CAMERAS, shot.camera);
            shot.background = pick(json.background, ['light', 'brand', 'dark', 'photo', 'video', 'pattern'] as const, shot.background);
            shot.energy = pick(json.energy, ['calm', 'medium', 'high'] as const, shot.energy);
            if (Array.isArray(json.texts)) {
              shot.texts = json.texts.slice(0, 4).map((x: any) => ({
                role: pick(x?.role, ['headline', 'support', 'label', 'number', 'button'] as const, 'headline'),
                words: Math.max(1, Math.min(20, Math.round(Number(x?.words) || 3))),
                position: pick(x?.position, ['top', 'center', 'bottom', 'left', 'right'] as const, 'center'),
              }));
            }
            if (typeof json.description === 'string') shot.description = json.description.replace(/["«»“”]/g, '').slice(0, 320);
          } catch (error) {
            logger.warn('reference.vision_failed', { event: 'reference.vision_failed', shot: shot.index, error });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, shots.length) }, worker));
    }

    // La signature : le dernier plan, s'il montre un logo ; sinon le moteur en ajoute une.
    const pace = Math.round(((shots.length - 1) / duration) * 100) / 100;
    const energies = shots.map((s) => s.energy);
    const dominant = (['high', 'medium', 'calm'] as ('high' | 'medium' | 'calm')[]).sort((a, b) => energies.filter((e) => e === b).length - energies.filter((e) => e === a).length)[0];
    const hardCuts = shots.filter((s) => s.transitionIn === 'cut' || s.transitionIn === 'flashCut').length;
    const direction: DirectionId = dominant === 'high' && hardCuts > shots.length / 2 ? 'brutal' : DIRECTION_HINT[dominant];
    const durations = shots.map((s) => s.duration);
    const firstHalf = durations.slice(0, Math.ceil(durations.length / 2));
    const secondHalf = durations.slice(Math.ceil(durations.length / 2));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const rhythm: ReferenceBlueprint['rhythm'] = pace > 0.55 ? 'staccato' : pace < 0.22 ? 'breathe' : mean(firstHalf) > mean(secondHalf) * 1.35 ? 'crescendo' : 'steady';
    const orientation = meta.width > meta.height * 1.1 ? 'landscape' : meta.height > meta.width * 1.1 ? 'portrait' : 'square';
    progress('done', { shots: shots.length, source });
    return {
      kind: 'video',
      duration: Math.round(duration * 100) / 100,
      width: meta.width,
      height: meta.height,
      orientation,
      hasAudio: meta.hasAudio,
      shots,
      pace,
      direction,
      rhythm,
      summary: `${shots.length} plans en ${duration.toFixed(1)} s (${pace.toFixed(2)} coupe/s), ${orientation}, ${shots.filter((s) => s.media !== 'none').length} plan(s) avec média, tempo ${rhythm}.`,
      source,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Image modèle (visuels) ─────────────────────────────────────────────────

export interface ReferenceImage {
  kind: 'image';
  /** Composition du code la plus proche (`visual/flyer.layouts.ts`). */
  layout: string;
  structure: 'photo' | 'type' | 'fact' | 'quote';
  hasPhoto: boolean;
  texts: ReferenceText[];
  /** La composition décrite pour le compositeur (Max, Ultra). */
  description: string;
  source: 'vision' | 'measured';
}

const FLYER_LAYOUT_IDS = ['photoSplit', 'bandOverPhoto', 'framedPhoto', 'circlePhoto', 'minimalCaption', 'stripeOverPhoto', 'diagonalSplit', 'bentoGrid', 'typePoster', 'outlinePoster', 'bigFact', 'quoteCard'] as const;

export async function analyzeReferenceImage(image: Buffer, mimeType: string, vision?: AnalyzeVideoOptions['vision']): Promise<ReferenceImage> {
  const fallback: ReferenceImage = { kind: 'image', layout: 'typePoster', structure: 'type', hasPhoto: false, texts: [{ role: 'headline', words: 5, position: 'center' }], description: 'A typographic poster on the brand colour.', source: 'measured' };
  if (!vision) return fallback;
  const small = await sharp(image).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const instruction = [
    'This is a social media visual (flyer). Describe its COMPOSITION for a designer who must reproduce it with another brand. Answer ONLY JSON:',
    `{"layout": ${FLYER_LAYOUT_IDS.join('|')} (closest), "structure": "photo|type|fact|quote", "hasPhoto": true|false,`,
    ' "texts": [{"role": "headline|support|label|number|button", "words": n, "position": "top|center|bottom|left|right"}],',
    ' "description": "layout, hierarchy, where the photo sits, colour blocks, typography attitude, 50 words max, no brand names, no quoted text"}',
  ].join('\n');
  try {
    const json = parseJson(await vision(small.toString('base64'), 'image/jpeg', instruction));
    if (!json) return fallback;
    return {
      kind: 'image',
      layout: pick(json.layout, FLYER_LAYOUT_IDS, 'typePoster' as (typeof FLYER_LAYOUT_IDS)[number]),
      structure: pick(json.structure, ['photo', 'type', 'fact', 'quote'] as const, 'type'),
      hasPhoto: json.hasPhoto === true,
      texts: Array.isArray(json.texts)
        ? json.texts.slice(0, 4).map((x: any) => ({ role: pick(x?.role, ['headline', 'support', 'label', 'number', 'button'] as const, 'headline'), words: Math.max(1, Math.min(20, Math.round(Number(x?.words) || 3))), position: pick(x?.position, ['top', 'center', 'bottom', 'left', 'right'] as const, 'center') }))
        : fallback.texts,
      description: typeof json.description === 'string' ? json.description.replace(/["«»“”]/g, '').slice(0, 360) : fallback.description,
      source: 'vision',
    };
  } catch (error) {
    logger.warn('reference.image_failed', { event: 'reference.image_failed', mimeType, error });
    return fallback;
  }
}
