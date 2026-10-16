/**
 * LES MÉDIAS QUE L'UTILISATEUR N'A PAS FOURNIS — produits pour LEUR scène.
 *
 * Le storyboard du film décrit chaque média à produire (`new image: …`, `new clip: …` : ce qu'on
 * voit, en anglais, et une requête de banque). Ce module les obtient :
 *
 *   registre    un média du projet déjà obtenu qui convient au plan est repris tel quel ;
 *   génération  l'image d'abord (FLUX.2), contrôlée par la vision (pas de texte, le bon sujet) ; le
 *               clip anime cette image (image → vidéo). TROIS essais par média, consigne resserrée ;
 *   Pexels      seulement après trois échecs, avec la requête du plan ;
 *   visuels     dernier recours (photos) : celles déjà utilisées dans les visuels de la marque.
 */
import logger from '../../runtime/logger';
import { coreHost } from '../../runtime/host';
import { VideoMediaAsset } from '../contracts/model';
import { generateClip, generateStill, MediaStorage, Orientation, searchPexelsPhotos, searchPexelsVideos } from './media';
import { matchAsset, type AssetRecord, type AssetRequirement } from '@idem/graphic-engine';

/** Trois essais de génération par média avant de chercher sur Pexels (demande produit). */
export const GENERATION_ATTEMPTS = 3;

export interface MediaNeed {
  /** Index de la scène dans le film. */
  scene: number;
  /** Clé de la scène (« s2 »). */
  sceneId: string;
  kind: 'image' | 'video';
  /** Rang du média dans la scène (galerie : 0, 1, 2). */
  slot: number;
  /** Les textes à l'écran de la scène (le plan doit leur correspondre). */
  texts: string[];
}

export interface ShotPlan extends MediaNeed {
  /** Ce qu'on voit (anglais : les modèles d'image et de vidéo le comprennent le mieux). */
  shot: string;
  move?: string;
  /** Deux à quatre mots pour la banque d'images. */
  query: string;
  /** Durée du plan (s) : un clip de 10 s quand le plan dépasse 5,5 s (sinon 5 s, bouclé au besoin). */
  durationSec?: number;
}

export interface MediaDirection {
  look: string;
  shots: ShotPlan[];
  source: 'llm' | 'heuristic';
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
  /** Médias repris du registre du projet (déjà obtenus par un autre livrable). */
  fromRegistry?: number;
  /** Le plan de médias résolu, plan par plan : `scène.rang ← source (fournisseur)` ou `scène.rang ✗`. */
  assets?: string[];
  /**
   * La génération a été coupée pour toute la vidéo : `payment` (le fournisseur n'a plus de
   * crédits — 402), `unavailable` (port non branché, service en panne répétée).
   */
  blocked?: 'payment' | 'unavailable';
}

/** Une erreur de paiement du fournisseur (402, crédits épuisés) : inutile de réessayer, ni ce média ni les suivants. */
export function isPaymentError(error: unknown): boolean {
  const e = error as { status?: number; response?: { status?: number }; message?: string } | undefined;
  return e?.status === 402 || e?.response?.status === 402 || /\b402\b|payment required|insufficient (?:credits|balance|funds)|crédits? insuffisants?|out of credits/i.test(String(e?.message || ''));
}

/** La requête de banque d'images, ancrée sur le personnage voulu (« african » si la demande l'exige). */
export function stockQuery(query: string, cast?: string): string {
  const q = String(query || '').trim();
  if (!q) return q;
  if (cast && /afric|black|noir/i.test(cast) && !/afric|black/i.test(q)) return `african ${q}`.split(/\s+/).slice(0, 5).join(' ');
  return q;
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
  /** Le personnage voulu (cohérence et requête de banque d'images). */
  cast?: string;
  /**
   * Le REGISTRE des ressources du projet (commun aux documents et aux vidéos) : un média déjà obtenu qui
   * convient au plan est repris avant toute génération ; ce qui est produit y est inscrit.
   */
  registry?: { records: AssetRecord[]; remember: (records: AssetRecord[]) => Promise<void> };
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
  // Disjoncteur : un fournisseur sans crédit (402) ne se réessaie pas — ni ce média, ni les suivants.
  const blocked = { image: false, video: false };
  // Un modèle refusé d'office (plan non commandé, esquisse, aucun modèle posé) l'est aussi : réessayer
  // ne change rien, et ces refus instantanés passaient pour trois échecs du fournisseur.
  const trip = (kind: 'image' | 'video', error: unknown) => {
    const reason = isPaymentError(error) ? 'payment' : /(?:video|image)_model_unavailable/.test(String((error as Error)?.message || '')) ? 'unavailable' : null;
    if (!reason) return false;
    if (!blocked[kind]) logger.info('video.media.generation_blocked', { kind, reason });
    blocked[kind] = true;
    report.blocked = report.blocked === 'payment' ? 'payment' : reason;
    return true;
  };
  let done = 0;
  const tick = (asset?: VideoMediaAsset) => opts.onProgress?.(++done, shots.length, asset ? { kind: asset.kind, origin: asset.origin } : undefined);

  /** Une image générée et acceptée, en trois essais au plus. */
  const still = async (plan: ShotPlan): Promise<(VideoMediaAsset & { jpeg: Buffer }) | null> => {
    if (!canImage) return null;
    const prompts = imagePrompts(plan, opts.direction.look, opts.artModifier);
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS && !blocked.image; attempt++) {
      try {
        const asset = await generateStill(prompts[attempt], opts.orientation, opts.storage, opts.folder, !!opts.artModifier, plan.query);
        if (await imageAccepted(asset.jpeg, plan)) return asset;
        report.failedAttempts++;
        logger.info('video.media.image_rejected', { scene: plan.scene, attempt });
      } catch (error: any) {
        report.failedAttempts++;
        if (trip('image', error)) break;
        logger.warn('video.media.image_failed', { scene: plan.scene, attempt, error: String(error?.message || error) });
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
    // Veo n'accepte que 4, 6 ou 8 s (au-delà, le clip est tenu par la scène).
    const wanted = plan.durationSec || 0;
    const durationSec: 4 | 6 | 8 = wanted <= 4.5 ? 4 : wanted <= 6.5 ? 6 : 8;
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS && !blocked.video; attempt++) {
      const image = first && attempt < 2 ? { base64: first.jpeg.toString('base64'), mimeType: 'image/jpeg' } : undefined;
      try {
        return await generateClip({ prompt: prompts[attempt], image, orientation: opts.orientation, quality: image ? opts.clipQuality : 'speed', durationSec, model: image && opts.clipQuality === 'quality' ? 'google/veo-3.1' : 'google/veo-3.1-fast' }, opts.storage, opts.folder, plan.query);
      } catch (error: any) {
        report.failedAttempts++;
        if (trip('video', error)) break;
        logger.warn('video.media.clip_failed', { scene: plan.scene, attempt, error: String(error?.message || error) });
      }
    }
    return null;
  };

  // Le registre d'abord : un média du projet qui montre ce que le plan demande (photo du deck, clip d'une
  // autre vidéo, photo importée) est repris tel quel — ni génération, ni banque.
  const registryUsed = new Set<string>();
  const ratio = opts.orientation === 'landscape' ? 16 / 9 : opts.orientation === 'square' ? 1 : 9 / 16;
  const requirementOf = (plan: ShotPlan): AssetRequirement => ({
    assetId: `scene-${plan.scene}-${plan.slot}`,
    role: plan.kind === 'video' ? 'clip' : 'photo',
    purpose: (plan.texts.join(' ') || plan.query).slice(0, 240) || plan.query,
    subject: `${plan.query}. ${plan.shot}`.slice(0, 240),
    aspectRatio: ratio,
    safeArea: 'none',
    sources: ['user', 'project', 'generated', 'stock'],
    fallback: 'skip',
    target: {},
  });
  for (const plan of shots) {
    const hit = opts.registry?.records.length ? matchAsset(requirementOf(plan), opts.registry.records, registryUsed) : null;
    if (!hit) continue;
    registryUsed.add(hit.url);
    const asset: VideoMediaAsset = { id: `registry-${plan.scene}-${plan.slot}`, kind: hit.kind, url: hit.url, origin: hit.source === 'user' ? 'upload' : hit.source === 'stock' ? 'pexels' : hit.source === 'generated' ? 'generated' : 'library', name: hit.subject.slice(0, 80), ...(hit.width ? { width: hit.width } : {}), ...(hit.height ? { height: hit.height } : {}), ...(hit.provenance.attribution ? { credit: hit.provenance.attribution } : {}) };
    byNeed.set(plan, asset);
    assets.push(asset);
    report.fromRegistry = (report.fromRegistry ?? 0) + 1;
    tick(asset);
  }

  const queue = shots.filter((plan) => !byNeed.has(plan));
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

  // Pexels, seulement pour ce que trois essais n'ont pas produit — avec la requête de chaque plan,
  // ancrée sur le personnage voulu. Un plan filmé sans vidéo libre prend une photo libre (animée
  // par le moteur) plutôt que de rester vide.
  const used = new Set<string>();
  for (const plan of shots.filter((s) => !byNeed.has(s))) {
    if (!opts.allowStock) break;
    const query = stockQuery(plan.query, opts.cast);
    try {
      if (plan.kind === 'video') {
        const found = (await searchPexelsVideos(query, opts.orientation, 3, opts.storage, opts.folder, { locale: 'en-US' })).find((v) => !used.has(v.url));
        if (found) {
          used.add(found.url);
          byNeed.set(plan, found);
          assets.push(found);
          report.stockVideos++;
          continue;
        }
        if (stills.has(plan)) continue;
      }
      const found = (await searchPexelsPhotos(query, opts.orientation, 4, 'en-US')).find((p) => !used.has(p.url));
      if (found) {
        used.add(found.url);
        byNeed.set(plan, found);
        assets.push(found);
        report.stockPhotos++;
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
  report.assets = shots.map((plan) => {
    const a = byNeed.get(plan);
    const id = `scene-${plan.scene}.${plan.slot}:${plan.kind === 'video' ? 'clip' : 'photo'}`;
    if (!a) return `${id} ✗`;
    const source = a.id.startsWith('registry-') ? 'registre' : a.origin === 'pexels' ? 'stock' : a.origin === 'visual' ? 'project' : a.origin;
    return `${id} ← ${source} (${a.credit || a.origin})`.slice(0, 160);
  });
  // Ce qui vient d'être généré ou trouvé rejoint le registre du projet (le deck ou la vidéo suivante le reprendra).
  if (opts.registry) {
    const fresh: AssetRecord[] = [];
    for (const [plan, asset] of byNeed) {
      if (asset.origin !== 'generated' && asset.origin !== 'pexels') continue;
      if (asset.id.startsWith('registry-')) continue;
      fresh.push({ id: `video:${asset.id}`.slice(0, 120), url: asset.url, kind: asset.kind === 'video' ? 'video' : 'image', role: asset.kind === 'video' ? 'clip' : 'photo', source: asset.origin === 'pexels' ? 'stock' : 'generated', subject: `${plan.query}. ${plan.shot}`.slice(0, 240), ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), origin: 'video', provenance: { provider: asset.origin === 'pexels' ? 'pexels' : 'openrouter', ...(asset.credit ? { attribution: asset.credit.slice(0, 160) } : {}), ...(asset.sourceUrl ? { sourceUrl: asset.sourceUrl } : {}) }, createdAt: new Date().toISOString() });
    }
    if (fresh.length) await opts.registry.remember(fresh).catch((error: any) => logger.warn('video.media.registry_failed', { error: error?.message }));
  }
  return { byNeed, assets, report };
}
