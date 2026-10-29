/**
 * LA COMPOSITION CALCULÉE (compilateur 0.3) DANS LE MOTEUR — ce que l'orchestrateur demande au code :
 *
 *   planFilm            la direction visuelle (jamais la même deux films de suite), l'énergie de chaque scène, le
 *                       système de design du film, les coutures et les sons des transitions ;
 *   sceneLowering       les entrées des solveurs pour une scène (textes, médias préparés, système résolu par format,
 *                       temps de la musique, voix, coutures) ;
 *   authorCard          la fiche de l'auteur d'intentions ;
 *   probeCandidates     le contrôle RÉEL d'un lot de variantes (Motion Canvas, chaque format) : erreurs, défauts
 *                       d'affichage, contraste mesuré, encombrement et couleurs de la vignette ;
 *   relower             le code d'une scène recalculé depuis son intention (texte retouché, nouvelle version du
 *                       compilateur) — sans modèle ;
 *   rescueOptions       les correctifs sans appel de modèle d'une scène en défaut : la seconde variante, puis les
 *                       correctifs proposés par le rapport mesuré du juge.
 */
import sharp from 'sharp';
import type { FilmBrand } from './assets/brand';
import type { FilmScene, MotionVideo, VideoFilm, VideoFormat, VideoMediaAsset } from './contracts/model';
import type { FilmData, FilmSceneData } from '../../motion/runtime/film-data';
import type { Candidate, ProbeVerdict } from './author/sampler';
import type { IntentAuthorInput } from './author/intent.author';
import { iconMenu, resolveIcon } from './assets/icons';
import { buildFilmBundle } from './rendering/compiler';
import { COMPOSITION, frameSpec } from './rendering/formats';
import { localizeFilm, probeFilm } from './rendering/runner';
import {
  buildFilmDesign,
  compileProgram,
  DIRECTION_IDS,
  DIRECTIONS,
  energyArc,
  lowerIntent,
  pixelMetrics,
  planSeams,
  planTransitionCues,
  prejudge,
  resolveSceneDesign,
  roleOf,
  safeBox,
  seamOutSeconds,
  validateProgram,
} from '../../../../../packages/motion-compiler/src';
import type { DirectionId, FilmDesign, LowerInput, SceneIntent, SeamSpec, TransitionCue, VariantChoice } from '../../../../../packages/motion-compiler/src';

// ─── Le film ─────────────────────────────────────────────────────────────────

export interface FilmPlan {
  design: FilmDesign;
  seams: SeamSpec[];
  cues: TransitionCue[];
  roles: (string | undefined)[];
  direction: { id: DirectionId; alternative?: DirectionId; repeatedAvoided?: boolean };
}

/**
 * La direction (celle du directeur ; si elle vient de servir au film précédent, sa seconde, sinon la suivante de la
 * liste), l'énergie (planificateur › directeur › rôles), le système de design, les coutures, les sons.
 */
export function planFilm(input: { brand: FilmBrand; scenes: { role?: string; energy?: number }[]; direction?: DirectionId; alternative?: DirectionId; energy?: number[]; previousDirection?: string; seed: number }): FilmPlan {
  let id: DirectionId = input.direction || DIRECTION_IDS[input.seed % DIRECTION_IDS.length];
  let repeatedAvoided = false;
  if (input.previousDirection && id === input.previousDirection) {
    repeatedAvoided = true;
    id = input.alternative && input.alternative !== input.previousDirection ? input.alternative : DIRECTION_IDS[(DIRECTION_IDS.indexOf(id) + 1) % DIRECTION_IDS.length];
  }
  const roles = input.scenes.map((s) => roleOf(s.role));
  const given = input.scenes.map((s, i) => s.energy ?? input.energy?.[i]);
  const energy = energyArc(roles, DIRECTIONS[id].energyBias, given);
  const design = buildFilmDesign({ brand: input.brand.tokens.colors, direction: id, energy });
  const seams = planSeams(design, roles, energy, input.seed);
  return { design, seams, cues: planTransitionCues(seams, energy), roles, direction: { id, ...(input.alternative ? { alternative: input.alternative } : {}), ...(repeatedAvoided ? { repeatedAvoided } : {}) } };
}

/** La couture d'entrée et de sortie d'une scène, avec la couleur de la suivante (coulée de couleur). */
export function seamsOf(film: VideoFilm, i: number): { seamIn?: SeamSpec & { color?: string }; seamOut?: SeamSpec & { color?: string } } {
  const ground = film.design?.colors.ground;
  const bgOf = (k: number) => {
    const bg = film.scenes[k]?.intent?.background;
    const colors = film.design?.colors as unknown as Record<string, string> | undefined;
    return bg && bg !== 'media' ? colors?.[bg] || ground : ground;
  };
  const prev = i > 0 ? film.seams?.[i - 1] : undefined;
  const next = film.seams?.[i];
  return { ...(prev && prev.kind !== 'cut' ? { seamIn: prev } : {}), ...(next && next.kind !== 'cut' ? { seamOut: { ...next, ...(next.kind === 'colour-flood' ? { color: bgOf(i + 1) } : {}) } } : {}) };
}

/** Les sons des transitions planifiés, en instants absolus (le pic du son tombe sur la coupe). */
export function plannedCues(film: VideoFilm): NonNullable<FilmData['cues']> {
  return (film.transitionCues || [])
    .map((c) => {
      const sc = film.scenes[c.scene];
      if (!sc) return null;
      return { kind: c.kind, t: Math.max(0, Math.round((sc.start - c.lead) * 1000) / 1000), scene: sc.key, gain: c.gain, take: c.take };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

/** Les temps de la musique d'une scène (s, depuis son début). */
function sceneBeats(video: MotionVideo, sc: FilmScene): { beats?: number[]; downbeats?: number[] } {
  const grid = video.music?.beat;
  if (!grid?.beats?.length) return {};
  const local = (list?: number[]) => (list || []).filter((b) => b >= sc.start && b < sc.start + sc.duration).map((b) => Math.round((b - sc.start) * 1000) / 1000);
  return { beats: local(grid.beats), downbeats: local(grid.downbeats) };
}

const mediaOf = (video: MotionVideo, sc: FilmScene): VideoMediaAsset[] => sc.media.map((id) => (video.media || []).find((m) => m.id === id)).filter((m): m is VideoMediaAsset => !!m && (m.kind === 'image' || m.kind === 'video'));

/** Les entrées des solveurs pour une scène (sans l'intention ni la variante). */
export function sceneLowering(video: MotionVideo, brand: FilmBrand, i: number): Omit<LowerInput, 'intent' | 'choice'> {
  const film = video.film!;
  const sc = film.scenes[i];
  const formats = (video.scope.formats.length ? video.scope.formats : ['story']) as VideoFormat[];
  const design = film.design!;
  const line = video.voice?.enabled ? video.voice.lines.find((l) => l.sceneKey === sc.key) : undefined;
  const { seamIn, seamOut } = seamsOf(film, i);
  const logo = brand.tokens.logo;
  return {
    texts: sc.texts,
    media: mediaOf(video, sc).map((m) => ({ kind: m.kind as 'image' | 'video', width: m.width || 1600, height: m.height || 1000, ...(m.prep?.calm ? { calmBy: m.prep.calm } : {}) })),
    formats,
    designs: Object.fromEntries(formats.map((f) => [f, resolveSceneDesign(design, f, i)])),
    fonts: brand.tokens.fonts,
    ...(logo && logo.width && logo.height ? { logoAspect: logo.width / logo.height } : logo ? { logoAspect: 3 } : {}),
    duration: sc.duration,
    ...sceneBeats(video, sc),
    ...(line ? { voiceAt: line.offset } : {}),
    ...(seamIn ? { seamIn } : {}),
    seamOut: seamOutSeconds(seamOut?.kind),
  };
}

/** La fiche de l'auteur d'intentions pour une scène. */
export function authorCard(video: MotionVideo, brand: FilmBrand, i: number, screens: Set<string>): IntentAuthorInput {
  const film = video.film!;
  const sc = film.scenes[i];
  const line = video.voice?.enabled ? video.voice.lines.find((l) => l.sceneKey === sc.key) : undefined;
  return {
    film: { title: film.title, concept: film.concept, bible: film.bible, ...(film.design ? { direction: film.design.direction } : {}) },
    formats: video.scope.formats.length ? video.scope.formats : ['story'],
    hasLogo: !!brand.tokens.logo,
    scene: {
      key: sc.key,
      index: i,
      count: film.scenes.length,
      duration: sc.duration,
      ...(sc.role ? { role: sc.role } : {}),
      ...(sc.energy ? { energy: sc.energy } : {}),
      purpose: sc.purpose,
      visual: sc.visual,
      motion: sc.motion,
      ...(sc.transition ? { transition: sc.transition } : {}),
      texts: sc.texts,
      media: mediaOf(video, sc).map((m) => ({ kind: m.kind as 'image' | 'video', width: m.width || 0, height: m.height || 0, ...(m.name ? { note: m.name } : {}), ...(screens.has(m.url) || m.prep?.screen ? { screen: true } : {}) })),
      ...(line ? { voice: { text: line.text, at: line.offset, duration: line.durationSec } } : {}),
      ...(video.music?.beat?.bpm ? { bpm: video.music.beat.bpm } : {}),
    },
    ...(i > 0 ? { previous: `${film.scenes[i - 1].purpose} — ${film.scenes[i - 1].visual}` } : {}),
    ...(i < film.scenes.length - 1 ? { next: `${film.scenes[i + 1].purpose} — ${film.scenes[i + 1].visual}` } : {}),
    icons: iconMenu(`${sc.purpose} ${sc.visual} ${sc.motion}`, 12),
    iconExists: (name) => !!resolveIcon(name),
  };
}

/** La part `media` d'une scène pour la page, avec le recadrage et l'extrait propres au format. */
export function sceneMediaData(video: MotionVideo, sc: FilmScene, format: VideoFormat): FilmSceneData['media'] {
  return mediaOf(video, sc).map((m) => ({
    id: m.id,
    kind: m.kind as 'image' | 'video',
    url: m.url,
    width: m.width || 0,
    height: m.height || 0,
    ...(m.durationSec ? { durationSec: m.durationSec } : {}),
    ...(m.name ? { note: m.name } : {}),
    ...(m.prep?.focus?.[format] ? { focus: m.prep.focus[format] } : {}),
    ...(m.prep?.calm?.[format] ? { calm: m.prep.calm[format] } : {}),
    ...(m.prep?.startAt ? { startAt: m.prep.startAt } : {}),
    ...(m.transparent ? { transparent: true } : {}),
    ...(m.prep?.point ? { point: m.prep.point } : {}),
  }));
}

/** Les données d'une page de contrôle qui joue des VARIANTES d'une scène (chacune à son instant réel dans le film). */
function candidatesData(video: MotionVideo, brand: FilmBrand, i: number, candidates: Candidate[], format: VideoFormat): FilmData {
  const film = video.film!;
  const sc = film.scenes[i];
  const spec = frameSpec(format, 'standard');
  const { seamIn, seamOut } = seamsOf(film, i);
  let start = 0;
  return {
    format,
    ...COMPOSITION[format],
    resolutionScale: 0.4,
    fps: spec.fps,
    background: film.design?.colors.ground || brand.tokens.colors.background,
    brand: brand.tokens,
    fontFamilies: [...new Set([brand.tokens.fonts.display, brand.tokens.fonts.body])],
    lang: (film.language || 'fr').startsWith('en') ? 'en' : 'fr',
    safe: safeBox(format),
    cues: [],
    ...(video.music?.beat?.beats?.length ? { beats: video.music.beat.beats } : {}),
    scenes: candidates.map((c) => {
      const data: FilmSceneData = {
        key: c.id,
        start,
        duration: sc.duration,
        texts: sc.texts,
        media: sceneMediaData(video, sc, format),
        index: i,
        clock: sc.start,
        ...(film.design ? { design: resolveSceneDesign(film.design, format, i) as never } : {}),
        ...(seamIn ? { seamIn: seamIn as never } : {}),
        ...(seamOut ? { seamOut: seamOut as never } : {}),
      };
      start += sc.duration;
      return data;
    }),
  };
}

/** Le contrôle réel d'un lot de variantes, dans chaque format. */
export async function probeCandidates(video: MotionVideo, brand: FilmBrand, i: number, candidates: Candidate[], fontCss: string): Promise<Map<string, ProbeVerdict>> {
  const out = new Map<string, ProbeVerdict>(candidates.map((c) => [c.id, { errors: [], layout: [] }]));
  if (!candidates.length) return out;
  const formats = (video.scope.formats.length ? video.scope.formats : ['story']) as VideoFormat[];
  const bundle = await buildFilmBundle(candidates.map((c) => ({ key: c.id, code: c.code })), 'render');
  for (const [k, format] of formats.entries()) {
    const local = await localizeFilm(candidatesData(video, brand, i, candidates, format));
    const probe = await probeFilm({ data: local.data, bundle, fontCss, files: local.files }, { thumbnails: k === 0 });
    for (const c of candidates) {
      const v = out.get(c.id)!;
      for (const e of probe.errors.filter((x) => x.key === c.id)) v.errors.push(`[${format}] ${e.message}`.slice(0, 300));
      for (const l of probe.layout[c.id] || []) v.layout.push(formats.length > 1 ? `[${format}] ${l}` : l);
      if (probe.minContrast[c.id] !== undefined) v.minContrast = Math.min(v.minContrast ?? 99, probe.minContrast[c.id]);
      const thumb = probe.thumbnails[c.id];
      if (thumb) {
        v.thumbnail = thumb;
        const { data, info } = await sharp(thumb).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        v.pixels = pixelMetrics({ data, width: info.width, height: info.height, channels: info.channels });
      }
    }
  }
  return out;
}

/** Le code d'une scène depuis son intention et sa variante (aucun modèle), ou null. */
export function relower(video: MotionVideo, brand: FilmBrand, i: number, intent: SceneIntent, choice: VariantChoice): { code: string; score: number; report: { choice?: Partial<VariantChoice> }[] } | null {
  try {
    const input = sceneLowering(video, brand, i);
    const lowered = lowerIntent({ ...input, intent, choice });
    const sc = video.film!.scenes[i];
    const v = validateProgram(lowered.program, { texts: Object.keys(sc.texts), values: sc.texts, media: input.media.map((m) => m.kind), duration: sc.duration, hasLogo: !!brand.tokens.logo, icons: resolveIcon });
    if (!v.ok) return null;
    const j = prejudge(intent, lowered, { duration: sc.duration, design: resolveSceneDesign(video.film!.design!, input.formats[0], i), ...(input.beats ? { beats: input.beats } : {}), seamOut: input.seamOut });
    return { code: compileProgram(v.program!, { warnings: v.warnings }).code, score: j.score, report: j.report };
  } catch {
    return null;
  }
}

/**
 * Les correctifs SANS MODÈLE d'une scène en défaut, du plus sûr au plus libre : la seconde variante gardée par le juge,
 * puis les variantes proposées par le rapport mesuré (un cran d'échelle, une autre zone pour le texte…).
 */
export function rescueOptions(video: MotionVideo, brand: FilmBrand, i: number): { label: string; code: string; intent: SceneIntent; choice: VariantChoice }[] {
  const sc = video.film!.scenes[i];
  const out: { label: string; code: string; intent: SceneIntent; choice: VariantChoice }[] = [];
  if (sc.runnerUp) {
    const r = relower(video, brand, i, sc.runnerUp.intent, sc.runnerUp.variant);
    if (r) out.push({ label: 'seconde variante', code: r.code, intent: sc.runnerUp.intent, choice: sc.runnerUp.variant });
  }
  if (sc.intent && sc.variant) {
    const base = relower(video, brand, i, sc.intent, sc.variant);
    for (const line of (base?.report || []).filter((l) => l.choice).slice(0, 3)) {
      const choice = { ...sc.variant, ...line.choice } as VariantChoice;
      const r = relower(video, brand, i, sc.intent, choice);
      if (r) out.push({ label: `correctif du rapport (${Object.entries(line.choice!).map(([k, v]) => `${k}=${v}`).join(', ')})`, code: r.code, intent: sc.intent, choice });
    }
  }
  return out;
}
