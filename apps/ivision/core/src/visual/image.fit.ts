/**
 * L'IMAGE QUI CONVIENT AU GABARIT — choisie, demandée et préparée par le code, sans aucun appel de modèle (24/11/2026).
 *
 * Le gabarit d'un visuel est désormais PLANIFIÉ avant la photo (`planSingle` du moteur graphique) : il dit ce qu'il
 * demande à son image (`ImageNeeds` : cadre, sujet, place du sujet, orientation, taille, fond calme, détourage). Ce
 * module en tire tout ce qui suit :
 *
 *   sourceOrder        génération ou banque d'abord, selon le gabarit et le médium de la DA
 *   compositionClause  la consigne de COMPOSITION ajoutée à la génération (le rendu de la DA y est déjà) et le
 *                      traitement local de la DA dit en mots, pour qu'une image générée sorte DÉJÀ traitée
 *   fitScore           l'adéquation mesurée d'une photo au cadre : perte au recadrage, définition, place du sujet,
 *                      fond chargé ou calme (vision par ordinateur locale, `sharp`)
 *   prepareImage       recadrage sur le sujet au format exact du cadre, puis — pour une photo de BANQUE — les
 *                      traitements locaux de la DA (`image.local` de sa fiche) : grain, contraste, ombres relevées,
 *                      netteté, vignetage
 *   colourDrift        la GARDE : la couleur moyenne (plan a*b* de Lab) avant / après ; au-delà du seuil, le
 *                      traitement est annulé et seule la découpe reste.
 *
 * RÈGLE DU 18/11/2026, intacte : une photo n'est JAMAIS recolorée (ni teinte, ni duotone, ni monochrome, ni
 * vectorisation). Tout traitement ici agit sur la lumière et la matière, et la garde le vérifie pixel par pixel.
 */
import sharp, { type OverlayOptions } from 'sharp';
import type { ImageNeeds } from '@idem/graphic-engine';
import { getDirection } from '@idem/graphic-engine';
import type { CreativityLevel } from '../creativity/levels';
import { attentionPoint } from './visual.images';

/** Les traitements locaux déclarés par une DA (`image.local` de sa fiche dans idem-templates). */
export interface LocalTreatment {
  grain?: number;
  contrast?: number;
  lift?: number;
  sharpen?: number;
  vignette?: number;
  cutout?: 'prefer' | 'never';
}

/** Ce que la DA dit de l'image : son médium (photo, illustration, rendu 3D…) et ses traitements locaux. */
export interface DirectionImage {
  medium: 'photography' | 'illustration' | 'render-3d' | 'collage' | 'abstract' | 'mixed';
  local: LocalTreatment;
}

export function directionImage(styleId?: string): DirectionImage {
  const d = styleId ? getDirection(styleId) : undefined;
  const imagery = (d?.tags as { imagery?: string } | undefined)?.imagery;
  const variantMedium = (d?.variants as { imagery?: Array<{ medium?: string }> } | undefined)?.imagery?.[0]?.medium;
  const medium = (variantMedium ?? (imagery === 'illustration' ? 'illustration' : 'photography')) as DirectionImage['medium'];
  return { medium, local: ((d?.image as { local?: LocalTreatment } | undefined)?.local ?? {}) as LocalTreatment };
}

// ─── 1. D'où vient l'image ─────────────────────────────────────────────────────────────────────────────

/**
 * La GÉNÉRATION d'abord quand la banque ne peut pas répondre : une DA qui veut une illustration ou un rendu 3D, un cadre
 * qui exige une composition précise (sujet centré dans un cercle, une arche, un galet ; sujet à détourer ; bandeau très
 * vertical). La BANQUE d'abord pour une photo documentaire en cadre rectangulaire. L'autre source reste le repli.
 */
export function sourceOrder(needs: ImageNeeds | null, dir: DirectionImage, o: { level?: CreativityLevel; illustration?: boolean } = {}): 'generate' | 'stock' {
  if (o.illustration || dir.medium === 'illustration' || dir.medium === 'render-3d') return 'generate';
  if (!needs) return o.level === 'high' || o.level === 'ultra' ? 'generate' : 'stock';
  const demanding = needs.shape === 'circle' || needs.shape === 'arch' || needs.shape === 'blob' || needs.cutout === true || needs.aspect < 0.5 || needs.aspect > 2.4;
  return demanding ? 'generate' : 'stock';
}

// ─── 2. Ce qu'on demande au modèle d'image ─────────────────────────────────────────────────────────────

/** Les traitements locaux de la DA, dits en mots (une image générée sort déjà traitée, sans retouche après). */
export function treatmentWords(local: LocalTreatment): string[] {
  const w: string[] = [];
  if ((local.grain ?? 0) >= 0.03) w.push(local.grain! >= 0.07 ? 'visible fine film grain' : 'subtle fine film grain');
  if ((local.contrast ?? 0) >= 0.05) w.push('crisp contrast, deep clean shadows');
  if ((local.contrast ?? 0) <= -0.03 || (local.lift ?? 0) >= 0.04) w.push('soft airy light, gently lifted shadows, matte finish');
  if ((local.sharpen ?? 0) >= 0.4) w.push('sharp precise detail');
  if ((local.vignette ?? 0) >= 0.08) w.push('gentle natural vignette');
  return w;
}

/** La consigne de composition que le CADRE impose à l'image (en anglais, pour le modèle d'image). */
export function compositionClause(needs: ImageNeeds | null, dir: DirectionImage): string {
  if (!needs) return treatmentWords(dir.local).join(', ');
  const parts: string[] = [];
  const subject = needs.subject === 'person' ? 'one person' : needs.subject === 'object' ? 'a single object' : needs.subject === 'scene' ? 'the scene' : needs.subject === 'texture' ? 'a material texture filling the frame' : 'the main subject';
  if (needs.cutout || dir.local.cutout === 'prefer') parts.push(`${subject} isolated against a plain seamless studio backdrop, clean separable edges, nothing touching the frame edges`);
  if (needs.framing === 'centered') parts.push(`${subject} perfectly centred with even breathing room on every side`);
  else if (needs.framing === 'wide') parts.push('wide establishing shot, the subject small in a broad setting');
  else parts.push(`${subject} placed on a third of the frame`);
  if (needs.shape === 'circle' || needs.shape === 'blob') parts.push('composition that survives a round crop: nothing important near the corners');
  if (needs.shape === 'arch') parts.push('tall composition that survives an arched top: head room above the subject');
  if (needs.calm) parts.push('calm uncluttered background with large quiet areas');
  parts.push(`${needs.orientation} framing, aspect ratio about ${needs.aspect.toFixed(2)}:1`);
  return [...parts, ...treatmentWords(dir.local)].join(', ');
}

// ─── 3. L'adéquation d'une photo au cadre (mesurée, 0 jeton) ──────────────────────────────────────────

export interface FitReport {
  /** 0 (ne convient pas) → 1 (convient parfaitement). */
  score: number;
  reasons: string[];
  /** Le point d'intérêt (0–1) dans l'image source. */
  focal: { x: number; y: number };
}

async function attention(buffer: Buffer, w: number, h: number): Promise<{ x: number; y: number }> {
  return attentionPoint(buffer, w, h);
}

/** La part de contours forts d'une image (0 : calme, 1 : très chargée), sur une vignette en niveaux de gris. */
async function busyness(buffer: Buffer): Promise<number> {
  const { data } = await sharp(buffer).resize(96, 96, { fit: 'cover' }).greyscale().convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] }).raw().toBuffer({ resolveWithObject: true });
  let strong = 0;
  for (const v of data) if (v > 40) strong++;
  return Math.min(1, strong / data.length / 0.25);
}

export async function fitScore(buffer: Buffer, needs: ImageNeeds | null): Promise<FitReport> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const focal = await attention(buffer, w, h);
  if (!needs) return { score: 1, reasons: [], focal };
  const reasons: string[] = [];
  const src = w / h;
  // La part de l'image gardée au recadrage.
  const kept = Math.min(src, needs.aspect) / Math.max(src, needs.aspect);
  if (kept < 0.55) reasons.push(`recadrage lourd (${Math.round(kept * 100)} % gardés)`);
  // La définition une fois recadrée, rapportée à la taille du cadre sur la toile.
  const cropW = src > needs.aspect ? h * needs.aspect : w;
  const cropH = src > needs.aspect ? h : w / needs.aspect;
  const resolution = Math.min(1, Math.min(cropW / needs.width, cropH / needs.height));
  if (resolution < 0.8) reasons.push(`définition faible (${Math.round(resolution * 100)} % du cadre)`);
  // La place du sujet : un cadre centré le veut au milieu ; un recadrage ne doit pas le couper.
  let placement = 1;
  if (needs.framing === 'centered') placement = 1 - Math.min(1, Math.hypot(focal.x - 0.5, focal.y - 0.5) / 0.45);
  const cut = src > needs.aspect ? Math.abs(focal.x - 0.5) > kept / 2 - 0.05 : Math.abs(focal.y - 0.5) > kept / 2 - 0.05;
  if (cut) {
    placement *= 0.5;
    reasons.push('sujet trop au bord pour ce cadre');
  }
  // Un cadre qui veut un fond calme (fond perdu, détourage, arche) refuse une image très chargée.
  const busy = needs.calm || needs.cutout ? await busyness(buffer) : 0;
  if (busy > 0.7) reasons.push('fond très chargé');
  const score = 0.3 * kept + 0.3 * resolution + 0.25 * placement + 0.15 * (1 - busy);
  return { score: Math.round(score * 100) / 100, reasons, focal };
}

// ─── 4. Préparer l'image : découpe au cadre, puis traitements locaux de la DA ─────────────────────────

/** La couleur moyenne de deux images dans le plan a*b* de Lab (ΔE de chroma moyen) : la garde des couleurs naturelles. */
export async function colourDrift(before: Buffer, after: Buffer): Promise<number> {
  const sample = async (b: Buffer) => (await sharp(b).resize(48, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  const [a, b] = await Promise.all([sample(before), sample(after)]);
  const lab = (r: number, g: number, bl: number): [number, number] => {
    const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [R, G, B] = [lin(r), lin(g), lin(bl)];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
    const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
    const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [500 * (x - y), 200 * (y - z)];
  };
  let sum = 0;
  const n = Math.min(a.length, b.length) / 3;
  for (let i = 0; i < n; i++) {
    const [a1, b1] = lab(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
    const [a2, b2] = lab(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
    sum += Math.hypot(a1 - a2, b1 - b2);
  }
  return sum / n;
}

/** Au-delà, la couleur a bougé : le traitement est annulé (règle des photos naturelles). */
export const MAX_COLOUR_DRIFT = 4.5;

export interface PreparedImage {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/png';
  /** Les traitements appliqués (journal), ou la raison de leur abandon. */
  applied: string[];
  drift?: number;
  /** Le point d'intérêt dans l'image préparée (0–1). */
  focal: { x: number; y: number };
}

function noiseLayer(width: number, height: number, amount: number, seed = 7): Buffer {
  // Un bruit de LUMIÈRE (gris autour du gris moyen) : en fusion « overlay », il donne du grain sans toucher la teinte.
  const amp = Math.round(255 * amount);
  const out = Buffer.alloc(width * height);
  let s = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = 128 + (((s >>> 8) % (2 * amp + 1)) - amp);
  }
  return out;
}

/**
 * La découpe au format exact du cadre (centrée sur le sujet), puis — si demandé — les traitements locaux de la DA.
 * `treat: false` (photo de l'utilisateur, de la marque, ou image générée déjà traitée) : la découpe seule.
 */
export async function prepareImage(buffer: Buffer, needs: ImageNeeds | null, local: LocalTreatment, o: { treat: boolean; focal?: { x: number; y: number } }): Promise<PreparedImage> {
  const meta = await sharp(buffer).rotate().metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const focal = o.focal ?? (await attention(buffer, w, h));
  const applied: string[] = [];
  let img = sharp(buffer).rotate();
  let outFocal = focal;
  if (needs) {
    const src = w / h;
    const cw = Math.round(src > needs.aspect ? h * needs.aspect : w);
    const ch = Math.round(src > needs.aspect ? h : w / needs.aspect);
    const left = Math.round(Math.min(w - cw, Math.max(0, focal.x * w - cw / 2)));
    const top = Math.round(Math.min(h - ch, Math.max(0, focal.y * h - ch / 2)));
    if (cw < w || ch < h) {
      img = img.extract({ left, top, width: cw, height: ch });
      applied.push(`découpe ${cw}×${ch} au cadre ${needs.shape} (${needs.aspect.toFixed(2)})`);
      outFocal = { x: (focal.x * w - left) / cw, y: (focal.y * h - top) / ch };
    }
    // Jamais plus grand que 1,6 × le cadre (poids), jamais agrandi.
    const target = Math.round(Math.min(2400, needs.width * 1.6));
    if (Math.min(cw, w) > target) img = img.resize({ width: target, withoutEnlargement: true });
  }
  const cropped = await img.jpeg({ quality: 90 }).toBuffer();
  if (!o.treat || !Object.keys(local).some((k) => k !== 'cutout')) return { buffer: cropped, contentType: 'image/jpeg', applied, focal: outFocal };

  // Les traitements locaux, dans l'ordre d'un tirage : lumière, netteté, grain, vignetage.
  const m = await sharp(cropped).metadata();
  const W = m.width || 1;
  const H = m.height || 1;
  let t = sharp(cropped);
  const contrast = local.contrast ?? 0;
  const lift = local.lift ?? 0;
  if (contrast || lift) {
    // Même pente sur les trois canaux, pivot au gris moyen : la teinte ne bouge pas.
    const a = (1 + contrast) * (1 - lift);
    const b = -128 * contrast * (1 - lift) + 255 * lift;
    t = t.linear([a, a, a], [b, b, b]);
    applied.push(`${contrast ? `contraste ${contrast > 0 ? '+' : ''}${contrast}` : ''}${contrast && lift ? ', ' : ''}${lift ? `ombres relevées ${lift}` : ''}`);
  }
  if ((local.sharpen ?? 0) > 0) {
    t = t.sharpen({ sigma: 0.6 + local.sharpen! * 0.8 });
    applied.push(`netteté ${local.sharpen}`);
  }
  const layers: OverlayOptions[] = [];
  if ((local.grain ?? 0) > 0) {
    layers.push({ input: noiseLayer(W, H, local.grain!), raw: { width: W, height: H, channels: 1 }, blend: 'overlay' });
    applied.push(`grain ${local.grain}`);
  }
  if ((local.vignette ?? 0) > 0) {
    const o2 = local.vignette!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${o2}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
    layers.push({ input: Buffer.from(svg), blend: 'multiply' });
    applied.push(`vignetage ${o2}`);
  }
  if (layers.length) t = sharp(await t.toBuffer()).composite(layers);
  const treated = await t.jpeg({ quality: 88 }).toBuffer();
  const drift = await colourDrift(cropped, treated);
  if (drift > MAX_COLOUR_DRIFT) return { buffer: cropped, contentType: 'image/jpeg', applied: [...applied.slice(0, 1), `traitements annulés : la couleur a bougé (ΔE ${drift.toFixed(1)})`], drift, focal: outFocal };
  return { buffer: treated, contentType: 'image/jpeg', applied, drift, focal: outFocal };
}
