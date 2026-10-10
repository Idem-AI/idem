/**
 * LES MÉDIAS QUE L'UTILISATEUR N'A PAS FOURNIS — générés au contexte de chaque scène.
 *
 *   besoins          chaque scène qui montre une photo ou un clip a ses besoins (produit : une
 *                    photo, galerie : trois, plan filmé : un clip…) ; les imports de l'utilisateur
 *                    les remplissent d'abord, dans l'ordre du film ;
 *   directeur photo  (agent) un PLAN par besoin restant : ce qu'on voit, au texte de SA scène, à la
 *                    marque et à sa DA, un « look » commun à tout le film, le mouvement de caméra
 *                    d'un clip (menu), la requête de banque d'images ; repli : le code ;
 *   génération       les modèles de l'hôte (famille GLM chez IDEM) : l'image d'abord (GLM-Image,
 *                    repli CogView-4), contrôlée par la vision (pas de texte, le bon sujet) ; le clip
 *                    anime cette image (CogVideoX-3, image → vidéo) — un plan cohérent avec la photo
 *                    et la charte. TROIS essais par média, la consigne simplifiée à chaque essai ;
 *   Pexels           seulement après trois échecs, avec la requête du plan ;
 *   visuels          dernier recours (photos) : celles déjà utilisées dans les visuels de la marque.
 */
import logger from '../runtime/logger';
import { coreHost } from '../runtime/host';
import { BriefFacts, CopyWriter, estimateTokens } from './video.copy';
import { VideoMediaAsset } from './video.model';
import { generateClip, generateStill, MediaStorage, Orientation, searchPexelsPhotos, searchPexelsVideos } from './video.media';
import { AgentRun, callAgent } from './video.agents';
import { LETTERS, pickOption } from '../creativity/agent-io';

/** Trois essais de génération par média avant de chercher sur Pexels (demande produit). */
export const GENERATION_ATTEMPTS = 3;

const maxGenerated = () => ({
  images: Math.max(0, Number(process.env.VIDEO_GEN_MAX_IMAGES ?? 6)),
  videos: Math.max(0, Number(process.env.VIDEO_GEN_MAX_CLIPS ?? 4)),
});

// ─── Besoins ────────────────────────────────────────────────────────────────

export interface MediaNeed {
  /** Index de la scène dans le film (ordre des scènes prévues). */
  scene: number;
  sceneId: string;
  kind: 'image' | 'video';
  /** Rang du média dans la scène (galerie : 0, 1, 2). */
  slot: number;
  /** Les textes à l'écran de la scène (le plan doit leur correspondre). */
  texts: string[];
}

/** Ce que chaque type de scène montre. */
const SCENE_MEDIA: Record<string, { images?: number; videos?: number }> = {
  product: { images: 1 },
  footage: { videos: 1 },
  gallery: { images: 3 },
  showcase3d: { images: 2 },
};

export interface SceneMedia {
  image?: string;
  images?: string[];
  video?: string;
}

/**
 * Les besoins du film, remplis d'abord par les imports de l'utilisateur. Rend les médias déjà
 * attribués par scène et la liste de ce qu'il reste à produire (borné par les plafonds).
 */
export function planMediaNeeds(
  scenes: { sceneId: string; texts: string[] }[],
  owned: { images: string[]; videos: string[]; models: number }
): { assigned: Record<number, SceneMedia>; missing: MediaNeed[] } {
  const assigned: Record<number, SceneMedia> = {};
  const missing: MediaNeed[] = [];
  let img = 0;
  let vid = 0;
  const cap = maxGenerated();
  let genImages = 0;
  let genVideos = 0;
  scenes.forEach((sc, i) => {
    const want = SCENE_MEDIA[sc.sceneId];
    if (!want) return;
    // Un modèle 3D importé remplace les cartes photo de la scène 3D.
    if (sc.sceneId === 'showcase3d' && owned.models > 0) return;
    for (let k = 0; k < (want.videos || 0); k++) {
      if (vid < owned.videos.length) assigned[i] = { ...assigned[i], video: owned.videos[vid++] };
      else if (genVideos < cap.videos) {
        missing.push({ scene: i, sceneId: sc.sceneId, kind: 'video', slot: k, texts: sc.texts });
        genVideos++;
      }
    }
    for (let k = 0; k < (want.images || 0); k++) {
      if (img < owned.images.length) {
        const url = owned.images[img++];
        assigned[i] = want.images === 1 ? { ...assigned[i], image: url } : { ...assigned[i], images: [...(assigned[i]?.images || []), url] };
      } else if (genImages < cap.images) {
        missing.push({ scene: i, sceneId: sc.sceneId, kind: 'image', slot: k, texts: sc.texts });
        genImages++;
      }
    }
  });
  return { assigned, missing };
}

// ─── Le directeur photo (agent) ─────────────────────────────────────────────

/** Les mouvements de caméra d'un clip (menu de l'agent). */
export const CAMERA_MOVES = ['slow push-in', 'slow pull-back', 'slow pan left', 'slow pan right', 'gentle orbit', 'tracking forward', 'static shot, the subject moves', 'handheld, close and alive'] as const;

export interface ShotPlan extends MediaNeed {
  /** Ce qu'on voit (anglais : les modèles d'image et de vidéo le comprennent le mieux). */
  shot: string;
  move?: string;
  /** Deux à quatre mots pour la banque d'images. */
  query: string;
}

export interface MediaDirection {
  look: string;
  shots: ShotPlan[];
  source: 'llm' | 'heuristic';
}

export interface MediaDirectorInput {
  sheet: string;
  brief: string;
  businessType?: string;
  /** Lieux du brief (marché, ville) : les plans y sont ancrés. */
  facts: BriefFacts;
  /** Rendu imposé par la DA de la charte aux images générées. */
  artModifier?: string;
  /** Mots-clés de recherche écrits par le rédacteur (repli de la requête). */
  query: string;
  needs: MediaNeed[];
  orientation: Orientation;
}

export function buildMediaDirectorPrompt(input: MediaDirectorInput): { system: string; user: string } {
  const system = [
    'You are the director of photography of a short brand video. For each SHOT, write what an AI image or video model must show, true to the scene, the brand and its market.',
    'Output ONLY these lines (English):',
    'look: one line shared by every shot (light, palette, lens, mood), true to the art direction',
    'N.shot: subject, action, setting, framing; concrete and photographic; max 40 words',
    'N.move: the letter of one camera move from MOVES (video shots only)',
    'N.query: 2 to 4 words to search a stock library for this shot',
    'Rules: no text, letters, signs, logos, watermarks or screens with writing; people only when the scene needs them, and from the brand market; every shot shows something different; each shot illustrates the on-screen text of its scene.',
  ].join('\n');
  const user = [
    input.sheet,
    `BRIEF: ${input.brief.replace(/\s+/g, ' ').trim().slice(0, 500)}`,
    input.businessType ? `BUSINESS: ${input.businessType}` : '',
    input.facts.places.length ? `PLACES: ${input.facts.places.slice(0, 3).join(', ')}` : '',
    input.artModifier ? `ART DIRECTION OF IMAGES: ${input.artModifier.slice(0, 300)}` : '',
    `FORMAT: ${input.orientation}`,
    'SHOTS:',
    ...input.needs.map((n, i) => `${i + 1}. ${n.kind === 'video' ? 'video clip (5 s)' : 'photo'} for a ${n.sceneId} scene${n.texts.length ? ` — on screen: ${n.texts.slice(0, 2).map((t) => `"${t.slice(0, 70)}"`).join(' / ')}` : ''}`),
    'MOVES:',
    ...CAMERA_MOVES.map((m, i) => `${LETTERS[i]}) ${m}`),
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

/** Ce qu'un plan ne doit jamais demander au modèle (texte imprimé, marque d'autrui). */
const cleanShot = (value: string, max: number) =>
  (value || '')
    .replace(/["«»“”`*_#]/g, '')
    .replace(/\b(text|caption|logo|watermark|letters?|signage|sign that reads)\b[^,.]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export function parseMediaDirection(raw: string, input: MediaDirectorInput): MediaDirection | null {
  const text = (raw || '').replace(/```[a-z]*\n?/gi, '');
  const shots: Record<number, Partial<ShotPlan>> = {};
  let look = '';
  for (const line of text.split(/\r?\n/)) {
    const lk = line.match(/^[\s*_#>-]*look\s*[:=]\s*(.+)$/i);
    if (lk) look = cleanShot(lk[1], 220);
    const m = line.match(/^[\s*_#>-]*(\d{1,2})\s*[.)]\s*(shot|move|query|camera)\s*[:=]\s*(.+)$/i);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (!input.needs[i]) continue;
    const key = m[2].toLowerCase();
    shots[i] = shots[i] || {};
    if (key === 'shot') shots[i].shot = cleanShot(m[3], 320);
    else if (key === 'query') shots[i].query = cleanShot(m[3], 48).split(/\s+/).slice(0, 5).join(' ');
    else shots[i].move = pickOption(m[3], CAMERA_MOVES as readonly string[]);
  }
  const fallback = heuristicMediaDirection(input);
  const planned = input.needs.map((need, i) => {
    const s = shots[i];
    const base = fallback.shots[i];
    return { ...need, shot: s?.shot && s.shot.split(/\s+/).length >= 4 ? s.shot : base.shot, move: need.kind === 'video' ? s?.move || base.move : undefined, query: s?.query || base.query };
  });
  const kept = Object.values(shots).filter((s) => s.shot).length;
  if (!kept) return null;
  return { look: look || fallback.look, shots: planned, source: 'llm' };
}

/** Repli sans modèle : la requête du rédacteur, le métier et le texte de la scène. */
export function heuristicMediaDirection(input: MediaDirectorInput): MediaDirection {
  const subject = [input.query, input.businessType].filter(Boolean).join(', ');
  const place = input.facts.places[0] ? ` in ${input.facts.places[0]}` : '';
  const angles = ['wide establishing shot', 'medium shot', 'close-up detail', 'over-the-shoulder shot', 'low-angle shot', 'top-down shot'];
  return {
    look: 'soft natural light, true colors, shallow depth of field, premium commercial photography',
    shots: input.needs.map((need, i) => ({
      ...need,
      shot: `${angles[i % angles.length]} of ${subject}${place}${need.texts[0] ? `, evoking "${need.texts[0].slice(0, 60)}"` : ''}`,
      move: need.kind === 'video' ? CAMERA_MOVES[i % CAMERA_MOVES.length] : undefined,
      query: input.query || subject.split(',')[0] || 'business',
    })),
    source: 'heuristic',
  };
}

export async function runMediaDirector(writer: CopyWriter | undefined, input: MediaDirectorInput): Promise<{ direction: MediaDirection; run: AgentRun }> {
  if (!input.needs.length) return { direction: { look: '', shots: [], source: 'heuristic' }, run: { agent: 'mediaDirector', source: 'graph', tokens: { input: 0, output: 0 }, ms: 0, kept: 0 } };
  const prompt = buildMediaDirectorPrompt(input);
  const res = await callAgent(writer, prompt.system, prompt.user);
  const parsed = parseMediaDirection(res.raw, input);
  return {
    direction: parsed || heuristicMediaDirection(input),
    run: { agent: 'mediaDirector', source: parsed ? 'llm' : 'graph', tokens: { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(res.raw) }, ms: res.ms, kept: parsed ? parsed.shots.length : 0 },
  };
}

// ─── Génération (trois essais), puis Pexels ─────────────────────────────────

export interface SourcingReport {
  generatedImages: number;
  generatedVideos: number;
  stockPhotos: number;
  stockVideos: number;
  /** Essais de génération en échec (tous médias confondus). */
  failedAttempts: number;
  fromVisuals: number;
}

export interface SourcingOptions {
  direction: MediaDirection;
  orientation: Orientation;
  storage: MediaStorage;
  folder: string;
  allowGenerate: boolean;
  allowStock: boolean;
  /** Rendu imposé par la DA de la charte (images générées). */
  artModifier?: string;
  /** Qualité du modèle vidéo : « quality » aux crans élevés, « speed » sinon. */
  clipQuality: 'speed' | 'quality';
  /** Photos des visuels de la marque (dernier recours). */
  visualPhotos: string[];
  onProgress?: (done: number, total: number, last?: { kind: string; origin: string }) => void;
}

/** Les trois consignes successives d'une image : complète, resserrée, minimale. */
function imagePrompts(plan: ShotPlan, look: string, art?: string): string[] {
  return [
    [plan.shot, look, art?.slice(0, 300)].filter(Boolean).join('. '),
    [plan.shot.split(/[,;]/).slice(0, 2).join(','), art ? art.slice(0, 160) : look].filter(Boolean).join('. '),
    `${plan.query}, professional photograph`,
  ];
}

/** Les trois consignes successives d'un clip (≤ 500 signes : la limite du modèle vidéo). */
function clipPrompts(plan: ShotPlan, look: string): string[] {
  const move = plan.move || 'slow push-in';
  return [
    `${move}. ${plan.shot}. ${look}. Smooth cinematic motion, realistic physics, no text.`.slice(0, 500),
    `${move}. ${plan.shot.split(/[,;]/)[0]}. Natural motion, no text.`.slice(0, 500),
    `${move}, ${plan.query}, cinematic, natural light, no text.`.slice(0, 500),
  ];
}

/** Contrôle d'une image générée par la vision : pas de texte imprimé, le bon sujet. */
async function imageAccepted(jpeg: Buffer, plan: ShotPlan): Promise<boolean> {
  const analyze = coreHost().analyzeImage;
  if (!analyze || process.env.VIDEO_MEDIA_CHECK === 'off') return true;
  try {
    const answer = await analyze(
      jpeg.toString('base64'),
      'image/jpeg',
      `Check this generated photo for a brand video. Expected: ${plan.shot.slice(0, 240)}\nAnswer ONLY two lines:\ntext: yes if any readable text, letters, logo or watermark is visible, else no\nmatch: yes if the photo shows the expected subject, else no`,
      { maxOutputTokens: 300, temperature: 0, purpose: 'media-check' }
    );
    const text = /text\s*[:=]\s*yes/i.test(answer);
    const match = !/match\s*[:=]\s*no/i.test(answer);
    return !text && match;
  } catch {
    // La vision en panne ne coûte pas une image : elle est acceptée.
    return true;
  }
}

/**
 * Produit chaque plan : génération (trois essais), puis Pexels, puis les photos des visuels.
 * Trois plans à la fois (la file du fournisseur au-delà coûte plus qu'elle ne rapporte).
 */
export async function sourceShots(opts: SourcingOptions): Promise<{ byNeed: Map<ShotPlan, VideoMediaAsset>; assets: VideoMediaAsset[]; report: SourcingReport }> {
  const report: SourcingReport = { generatedImages: 0, generatedVideos: 0, stockPhotos: 0, stockVideos: 0, failedAttempts: 0, fromVisuals: 0 };
  const byNeed = new Map<ShotPlan, VideoMediaAsset>();
  const assets: VideoMediaAsset[] = [];
  const shots = opts.direction.shots;
  const canImage = opts.allowGenerate && !!coreHost().generateImage;
  const canClip = opts.allowGenerate && !!coreHost().generateVideo;
  let done = 0;
  const tick = (asset?: VideoMediaAsset) => opts.onProgress?.(++done, shots.length, asset ? { kind: asset.kind, origin: asset.origin } : undefined);

  /** Une image générée et acceptée, en trois essais au plus. */
  const still = async (plan: ShotPlan): Promise<(VideoMediaAsset & { jpeg: Buffer }) | null> => {
    if (!canImage) return null;
    const prompts = imagePrompts(plan, opts.direction.look, opts.artModifier);
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
      try {
        const asset = await generateStill(prompts[attempt], opts.orientation, opts.storage, opts.folder, !!opts.artModifier, plan.query);
        if (await imageAccepted(asset.jpeg, plan)) return asset;
        report.failedAttempts++;
        logger.info('video.media.image_rejected', { scene: plan.scene, attempt });
      } catch (error: any) {
        report.failedAttempts++;
        logger.warn('video.media.image_failed', { scene: plan.scene, attempt, error: error?.message });
      }
    }
    return null;
  };

  /** L'image d'un plan vidéo : animée par le modèle, et le repli de la scène si aucun clip n'aboutit. */
  const stills = new Map<ShotPlan, VideoMediaAsset>();

  /** Un clip : l'image du plan animée (deux essais), puis le texte seul (troisième essai). */
  const clip = async (plan: ShotPlan): Promise<VideoMediaAsset | null> => {
    if (!canClip) return null;
    const first = await still(plan);
    if (first) {
      const { jpeg: _jpeg, ...image } = first;
      stills.set(plan, image);
    }
    const prompts = clipPrompts(plan, opts.direction.look);
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
      const image = first && attempt < 2 ? { base64: first.jpeg.toString('base64'), mimeType: 'image/jpeg' } : undefined;
      try {
        return await generateClip({ prompt: prompts[attempt], image, orientation: opts.orientation, quality: image ? opts.clipQuality : 'speed' }, opts.storage, opts.folder, plan.query);
      } catch (error: any) {
        report.failedAttempts++;
        logger.warn('video.media.clip_failed', { scene: plan.scene, attempt, error: error?.message });
      }
    }
    return null;
  };

  const queue = [...shots];
  const worker = async () => {
    for (let plan = queue.shift(); plan; plan = queue.shift()) {
      const asset = plan.kind === 'video' ? await clip(plan) : await still(plan);
      if (asset) {
        const { jpeg: _jpeg, ...clean } = asset as VideoMediaAsset & { jpeg?: Buffer };
        byNeed.set(plan, clean);
        assets.push(clean);
        if (clean.kind === 'video') report.generatedVideos++;
        else report.generatedImages++;
      }
      tick(asset || undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, Math.max(1, shots.length)) }, worker));

  // Pexels, seulement pour ce que trois essais n'ont pas produit — avec la requête de chaque plan.
  const used = new Set<string>();
  for (const plan of shots.filter((s) => !byNeed.has(s))) {
    if (!opts.allowStock) break;
    try {
      if (plan.kind === 'video') {
        const [found] = await searchPexelsVideos(plan.query, opts.orientation, 1, opts.storage, opts.folder, { locale: 'en-US' });
        if (found) {
          byNeed.set(plan, found);
          assets.push(found);
          report.stockVideos++;
        }
      } else {
        const found = (await searchPexelsPhotos(plan.query, opts.orientation, 3, 'en-US')).find((p) => !used.has(p.url));
        if (found) {
          used.add(found.url);
          byNeed.set(plan, found);
          assets.push(found);
          report.stockPhotos++;
        }
      }
    } catch (error: any) {
      logger.warn('video.media.stock_failed', { scene: plan.scene, error: error?.message });
    }
  }

  // Un plan vidéo sans clip garde l'image générée pour lui : la scène montre la photo, animée par le moteur.
  for (const plan of shots.filter((s) => !byNeed.has(s) && stills.has(s))) {
    const image = stills.get(plan)!;
    byNeed.set(plan, image);
    assets.push(image);
    report.generatedImages++;
  }

  // Dernier recours (photos) : celles des visuels de la marque, payées et à la charte.
  const visuals = [...opts.visualPhotos];
  for (const plan of shots.filter((s) => !byNeed.has(s) && s.kind === 'image')) {
    const url = visuals.shift();
    if (!url) break;
    const asset: VideoMediaAsset = { id: `visual-${plan.scene}-${plan.slot}`, kind: 'image', url, origin: 'visual' };
    byNeed.set(plan, asset);
    assets.push(asset);
    report.fromVisuals++;
  }
  return { byNeed, assets, report };
}

/** Les médias de chaque scène : imports d'abord, puis ce qui a été produit pour elle. */
export function sceneMediaOf(assigned: Record<number, SceneMedia>, byNeed: Map<ShotPlan, VideoMediaAsset>): Record<number, SceneMedia> {
  const out: Record<number, SceneMedia> = Object.fromEntries(Object.entries(assigned).map(([k, v]) => [Number(k), { ...v, ...(v.images ? { images: [...v.images] } : {}) }]));
  const ordered = [...byNeed.entries()].sort((a, b) => a[0].scene - b[0].scene || a[0].slot - b[0].slot);
  for (const [plan, asset] of ordered) {
    const cur = out[plan.scene] || {};
    if (asset.kind === 'video') out[plan.scene] = { ...cur, video: asset.url };
    else if (['gallery', 'showcase3d'].includes(plan.sceneId)) out[plan.scene] = { ...cur, images: [...(cur.images || []), asset.url] };
    else out[plan.scene] = { ...cur, image: asset.url };
  }
  return out;
}
