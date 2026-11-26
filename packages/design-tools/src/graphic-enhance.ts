/**
 * RENDRE NETS UN LOGO, UNE ICÔNE, UN PICTOGRAMME — sans IA payante, sur le processeur.
 *
 * Pourquoi un palier à part. Un logo n'est pas une photo : ce sont des aplats aux contours francs. Les logos récupérés
 * d'un ancien site sont presque toujours trop petits (80 à 200 px), enregistrés en JPEG (halo de moustiques autour des
 * lettres) ou déjà agrandis. Un agrandissement Lanczos + accentuation ne fait que grossir ces défauts, et le modèle
 * Real-ESRGAN, entraîné sur des photos, déforme les lettres. Ici on RECONSTRUIT les contours :
 *
 *   1. agrandissement Lanczos 3 (×2 à ×4, borné), puis filtre médian : les moustiques JPEG et la crénelure des
 *      pixels agrandis disparaissent sans émousser les angles (à cette taille, un rayon de 3 px est sous le pixel
 *      d'origine) ;
 *   2. VECTORISATION par vtracer (`vectorize.ts`) de cette image nettoyée : les contours deviennent des courbes, nets à
 *      toute taille ; l'image est ensuite rendue à la taille voulue (anti-crénelage du moteur de rendu) ;
 *   3. GARDE DE FIDÉLITÉ : le rendu vectoriel est comparé à l'original agrandi. Trop d'écart (dégradé, ombre, photo,
 *      texte minuscule) ou trop de tracés → on abandonne le vecteur ;
 *   4. REPLI « nettoyé » : l'image médiane, alpha raidi (le bord translucide d'un logo détouré devient un trait net
 *      plutôt qu'un halo), accentuation des contours. Gardé seulement s'il est plus net qu'un simple agrandissement.
 *
 * Les couleurs ne bougent pas : le vecteur reprend celles de l'image (jamais de palette imposée) et un écart de teinte
 * moyenne rejette le résultat. La transparence est conservée (PNG).
 *
 * Mesuré par `npm run check:graphic-enhance` : logos synthétiques dégradés (réduits, JPEG qualité 25) puis comparés à
 * leur rendu de référence, l'amélioration doit réduire l'erreur par rapport à un simple agrandissement.
 */
import sharp, { type Metadata, type Sharp } from 'sharp';
import { vectorizeImage } from './vectorize';
import { measureImageQuality } from './image-quality';

export interface GraphicEnhanceOptions {
  /** Le plus grand côté visé, en pixels (défaut 1 024 : un logo d'en-tête Retina, une icône d'application). */
  targetSide?: number;
  /** `false` : jamais de vectorisation (repli nettoyé seul). */
  allowVector?: boolean;
}

export interface GraphicEnhanceResult {
  buffer: Buffer;
  mimeType: 'image/png';
  width: number;
  height: number;
  method: 'vector' | 'clean';
  /** Le tracé, quand la voie vectorielle a été retenue : un logo net à toute taille. */
  svg?: string;
  /** Écart moyen (0-255) entre le résultat et l'original agrandi : plus c'est bas, plus c'est fidèle. */
  fidelity: number;
  ms: number;
}

const DEFAULT_SIDE = 1024;
const MAX_SIDE = 1536;
/** Le facteur d'agrandissement ne dépasse jamais ×4 : au-delà, on invente. */
const MAX_FACTOR = 4;
/** Les tracés au-delà desquels l'image n'est plus un logo (photo, dégradé). */
const MAX_PATHS = 700;
/** Écart moyen toléré entre le vecteur et l'original agrandi, sur 255. */
const MAX_MEAN_ERROR = 16;
/** Part des pixels qui peuvent s'écarter de plus de 90/255 (les contours déplacés d'un demi-pixel). */
const MAX_BAD_SHARE = 0.05;
const MAX_INPUT_PIXELS = 4096 * 4096;

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

async function rgbaOf(image: Sharp): Promise<Raw> {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Écart entre deux images RGBA de même taille, vues sur fond blanc : moyenne et part des pixels très éloignés. */
function compare(a: Raw, b: Raw): { mean: number; bad: number } {
  const n = a.width * a.height;
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const aa = a.data[o + 3] / 255;
    const ba = b.data[o + 3] / 255;
    let worst = 0;
    for (let c = 0; c < 3; c++) {
      const av = a.data[o + c] * aa + 255 * (1 - aa);
      const bv = b.data[o + c] * ba + 255 * (1 - ba);
      const d = Math.abs(av - bv);
      if (d > worst) worst = d;
      sum += d;
    }
    if (worst > 90) bad++;
  }
  return { mean: sum / (n * 3), bad: bad / n };
}

/** L'image a-t-elle des pixels vraiment transparents (un logo détouré) ? */
async function hasRealAlpha(buffer: Buffer): Promise<boolean> {
  const stats = await sharp(buffer, { failOn: 'none' }).stats();
  const alpha = stats.channels[3];
  return !!alpha && alpha.min < 250;
}

/** Teinte moyenne des pixels opaques (vignette) : le résultat ne doit pas être recoloré. */
async function meanColour(buffer: Buffer): Promise<[number, number, number]> {
  const { data } = await sharp(buffer, { failOn: 'none' }).resize(24, 24, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    for (let c = 0; c < 3; c++) sum[c] += data[i + c] * a;
    weight += a;
  }
  return weight ? [sum[0] / weight, sum[1] / weight, sum[2] / weight] : [0, 0, 0];
}

/**
 * Les couleurs réelles du logo : celles qui couvrent assez de surface, fusionnées quand elles sont voisines. Les teintes
 * de halo JPEG et de bord adouci, trop rares et trop proches d'un aplat, n'y entrent pas : en ramenant l'image à cette
 * palette avant le tracé, le vecteur ne reproduit plus les moustiques.
 */
async function dominantPalette(buffer: Buffer): Promise<string[]> {
  const { data, info } = await sharp(buffer, { failOn: 'none' }).flatten({ background: '#ffffff' }).resize(120, 120, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 3) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const k = buckets.get(key);
    if (k) {
      k.r += data[i];
      k.g += data[i + 1];
      k.b += data[i + 2];
      k.n++;
    } else buckets.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], n: 1 });
  }
  const total = info.width * info.height;
  const merged: { r: number; g: number; b: number; n: number }[] = [];
  for (const k of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const c = { r: k.r / k.n, g: k.g / k.n, b: k.b / k.n, n: k.n };
    const near = merged.find((m) => Math.hypot(m.r - c.r, m.g - c.g, m.b - c.b) < 64);
    if (near) {
      const sum = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / sum;
      near.g = (near.g * near.n + c.g * c.n) / sum;
      near.b = (near.b * near.n + c.b * c.n) / sum;
      near.n = sum;
    } else merged.push(c);
  }
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const kept = merged.filter((m) => m.n / total >= 0.012).slice(0, 10);
  // Un rose entre un rouge et un blanc est un bord adouci, pas une couleur : une teinte rare posée sur le segment
  // qui relie deux teintes plus fortes est un mélange, on la retire.
  const blend = (c: (typeof kept)[number], i: number) => {
    if (c.n / total >= 0.08) return false;
    const others = kept.filter((o, j) => j !== i && o.n > c.n);
    for (let a = 0; a < others.length; a++) {
      for (let b = a + 1; b < others.length; b++) {
        const A = others[a];
        const B = others[b];
        const d = [B.r - A.r, B.g - A.g, B.b - A.b];
        const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((c.r - A.r) * d[0] + (c.g - A.g) * d[1] + (c.b - A.b) * d[2]) / len2));
        if (Math.hypot(A.r + t * d[0] - c.r, A.g + t * d[1] - c.g, A.b + t * d[2] - c.b) < 34) return true;
      }
    }
    return false;
  };
  return kept
    .filter((m, i) => !blend(m, i))
    .slice(0, 8)
    .map((m) => `#${hex(m.r)}${hex(m.g)}${hex(m.b)}`);
}

/**
 * Chaque pixel prend une couleur de la palette. Un pixel de bord (mélange de deux aplats) est rattaché à l'UNE des
 * deux teintes qu'il mélange, pas à une troisième teinte qui lui ressemblerait par hasard : sans cela, le bord entre un
 * bleu nuit et un blanc devenait un liseré rouge, la couleur de palette la plus proche de leur mélange.
 */
async function snapToPalette(buffer: Buffer, palette: string[]): Promise<Buffer> {
  const { data, info } = await sharp(buffer, { failOn: 'none' }).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const colours = palette.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16)));
  const dist = (p: number[], c: number[]) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
  const cache = new Map<number, number>();
  const pick = (p: number[]): number => {
    let best = 0;
    let bestD = Infinity;
    colours.forEach((c, i) => {
      const d = dist(p, c);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (bestD < 22) return best;
    // Un mélange : le segment le plus proche, puis son extrémité la plus proche.
    let segD = Infinity;
    let segPick = best;
    for (let a = 0; a < colours.length; a++) {
      for (let b = a + 1; b < colours.length; b++) {
        const A = colours[a];
        const B = colours[b];
        const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / len2));
        const sd = Math.hypot(A[0] + t * d[0] - p[0], A[1] + t * d[1] - p[1], A[2] + t * d[2] - p[2]);
        if (sd < segD) {
          segD = sd;
          segPick = t < 0.5 ? a : b;
        }
      }
    }
    return segD < bestD * 0.6 ? segPick : best;
  };
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
    let idx = cache.get(key);
    if (idx === undefined) {
      idx = pick([data[i], data[i + 1], data[i + 2]]);
      cache.set(key, idx);
    }
    out[i] = colours[idx][0];
    out[i + 1] = colours[idx][1];
    out[i + 2] = colours[idx][2];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

/** L'image nettoyée : agrandie, médiane, sans moustiques. */
async function cleaned(buffer: Buffer, width: number, factor: number): Promise<Buffer> {
  let image = sharp(buffer, { failOn: 'none' }).rotate().ensureAlpha().resize({ width, kernel: 'lanczos3' });
  // Sous ×1,5 la médiane émousserait les angles : un léger flou suffit à casser les blocs.
  image = factor >= 1.5 ? sharp(await image.png().toBuffer()).median(3) : sharp(await image.png().toBuffer()).blur(0.5);
  return image.png().toBuffer();
}

/** Repli : alpha raidi + contours accentués, sur l'image nettoyée. */
async function crisp(clean: Buffer, transparent: boolean): Promise<Buffer> {
  const base = sharp(clean);
  if (!transparent) return base.sharpen({ sigma: 0.9, m1: 0.4, m2: 3, x1: 2, y2: 10, y3: 20 }).png().toBuffer();
  const rgb = await sharp(clean).removeAlpha().sharpen({ sigma: 0.9, m1: 0.4, m2: 3, x1: 2, y2: 10, y3: 20 }).png().toBuffer();
  // alpha' = 1,7 × (alpha − 128) + 128 : le bord translucide devient un trait net.
  const alpha = await sharp(clean).extractChannel(3).linear(1.7, 128 - 1.7 * 128).png().toBuffer();
  return sharp(rgb).joinChannel(alpha).png().toBuffer();
}

/**
 * Le logo ou l'icône rendu net à `targetSide` ; `null` s'il n'en a pas besoin (déjà grand et propre), si ce n'est
 * pas une image matricielle lisible, ou si aucune voie ne fait mieux qu'un simple agrandissement.
 */
export async function enhanceGraphic(buffer: Buffer, options: GraphicEnhanceOptions = {}): Promise<GraphicEnhanceResult | null> {
  const started = Date.now();
  let meta: Metadata;
  try {
    meta = await sharp(buffer, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return null;
  }
  if (!meta.width || !meta.height || meta.format === 'svg' || (meta.pages ?? 1) > 1) return null;
  const longest = Math.max(meta.width, meta.height);
  const target = Math.min(MAX_SIDE, options.targetSide ?? DEFAULT_SIDE);
  const factor = Math.min(MAX_FACTOR, Math.max(1, target / longest));
  const quality = await measureImageQuality(buffer);
  const defects = quality ? quality.issues.filter((i) => i !== 'small') : [];
  // Déjà grand et propre : on n'y touche pas.
  if (factor < 1.25 && !defects.length) return null;

  const width = Math.round(meta.width * factor);
  const transparent = await hasRealAlpha(buffer).catch(() => false);
  const colour = await meanColour(buffer);
  const plain = await rgbaOf(sharp(buffer, { failOn: 'none' }).rotate().resize({ width, kernel: 'lanczos3' }));
  const clean = await cleaned(buffer, width, factor);

  if (options.allowVector !== false) {
    try {
      // Un fond transparent n'est pas une couleur : sans palette (le tracé garde alors l'alpha tel quel).
      const palette = transparent ? [] : await dominantPalette(clean);
      const traced = await vectorizeImage({ image: palette.length >= 2 ? await snapToPalette(clean, palette) : clean, size: Math.max(plain.width, plain.height), detail: 0.8, ...(palette.length >= 2 ? { palette } : {}) });
      if (traced.paths > 0 && traced.paths <= MAX_PATHS) {
        const rendered = await sharp(Buffer.from(traced.svg), { density: 72 }).resize({ width: plain.width, height: plain.height, fit: 'fill' }).png().toBuffer();
        const raw = await rgbaOf(sharp(rendered));
        if (raw.width === plain.width && raw.height === plain.height) {
          const { mean, bad } = compare(plain, raw);
          const after = await meanColour(rendered);
          const tint = Math.max(...after.map((v, i) => Math.abs(v - colour[i])));
          if (mean <= MAX_MEAN_ERROR && bad <= MAX_BAD_SHARE && tint <= 10) {
            return { buffer: rendered, mimeType: 'image/png', width: raw.width, height: raw.height, method: 'vector', svg: traced.svg, fidelity: Math.round(mean * 100) / 100, ms: Date.now() - started };
          }
        }
      }
    } catch {
      // Le traceur indisponible ou en échec : le repli nettoyé suffit.
    }
  }

  const output = await crisp(clean, transparent);
  const after = await meanColour(output);
  if (Math.max(...after.map((v, i) => Math.abs(v - colour[i]))) > 10) return null;
  const [before, now] = await Promise.all([measureImageQuality(await sharp(plain.data, { raw: { width: plain.width, height: plain.height, channels: 4 } }).png().toBuffer()), measureImageQuality(output)]);
  // Gardé seulement s'il est plus net qu'un simple agrandissement, ou s'il a perdu ses blocs.
  const sharper = !!before && !!now && now.sharpness >= before.sharpness * 1.03;
  const deblocked = !!before && !!now && before.blockiness > 1.3 && now.blockiness < before.blockiness * 0.85;
  if (!sharper && !deblocked) return null;
  const meta2 = await sharp(output).metadata();
  const raw = await rgbaOf(sharp(output));
  return { buffer: output, mimeType: 'image/png', width: meta2.width ?? width, height: meta2.height ?? plain.height, method: 'clean', fidelity: Math.round(compare(plain, raw).mean * 100) / 100, ms: Date.now() - started };
}
