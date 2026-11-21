/**
 * LA QUALITÉ D'UNE IMAGE, MESURÉE PAR LE CODE — sans modèle, sans réseau, quelques dizaines de millisecondes.
 *
 * Sert la refonte de sites (iCode, iVision) : une image recopiée d'un vieux site peut être floue, déjà agrandie ou
 * trop compressée. On ne propose de l'améliorer QUE si la mesure le dit. Mesures sur les niveaux de gris, à la
 * taille réelle du fichier (bornée à 2 048 px) :
 *
 *   netteté    énergie du laplacien (les transitions les plus fines) rapportée au contraste ;
 *   détail     ce qui disparaît quand on réduit l'image de moitié puis qu'on la réagrandit (bande moyenne) ;
 *   mollesse   détail ÷ netteté. Sur une photo nette, les plus fines transitions dominent : 0,27 à 0,36. Une image
 *              floue ou déjà agrandie les a perdues avant la bande moyenne : 0,42 à 0,55 agrandie ×2, 0,6 à 0,9
 *              floue. Ce rapport ne dépend presque pas du sujet — contrairement à la netteté seule (de 0,13 pour un
 *              produit sur fond uni à 1,25 pour une façade, toutes deux nettes) ;
 *   blocs      les écarts entre pixels sur la grille 8×8 du JPEG comparés aux autres : ≤ 1,15 propre, 1,3-1,5 en
 *              qualité 30, 1,6-2,1 en qualité 10 ;
 *   photo      assez de teintes et peu d'aplats : une photo, pas un logo, un schéma, une capture ou une affiche.
 *
 * Seuils calés le 21/11/2026 sur le jeu Kodak (14 photos), des portraits et des illustrations, dégradés par le code
 * (réduits puis réagrandis, floutés, JPEG qualité 10 et 30) ; vérifiés par `npm run check:image-quality`.
 *
 * La TAILLE seule ne dit rien : une image de 600 px est parfaite dans une carte de 300 px. Ce qui compte, c'est la
 * place où le nouveau site l'affiche — voir `needsEnhancement`.
 */
import sharp from 'sharp';

export type ImageIssue = 'small' | 'blurry' | 'blocky';

export interface ImageQuality {
  /** Taille réelle du fichier (et non celle annoncée par la page). */
  width: number;
  height: number;
  /** Netteté brute (dépend du sujet : ne juge rien seule). */
  sharpness: number;
  /** Détail de bande moyenne. */
  detail: number;
  /** Détail ÷ netteté : au-delà de `THRESHOLDS.soft`, l'image paraît floue. */
  softness: number;
  /** Marque des blocs JPEG 8×8 (≈ 1 = aucune). */
  blockiness: number;
  /** Photo plutôt qu'aplat (logo, schéma, capture d'écran, affiche). */
  photo: boolean;
  /** Défauts propres au fichier (`small` n'est posé que face à une place, par `needsEnhancement`). */
  issues: ImageIssue[];
}

export const THRESHOLDS = {
  /** Mollesse au-delà de laquelle l'image paraît floue (photos Kodak nettes ≤ 0,36, agrandies ×2 ≥ 0,419). */
  soft: 0.4,
  /** Blocs JPEG visibles (qualité 10 : ≥ 1,6 ; qualité 30 : 1,3-1,5, encore acceptable). */
  blocky: 1.45,
  /** Rapport (pixels du fichier ÷ pixels qu'il faudrait à cette place) en dessous duquel l'image paraît floue. */
  resolution: 0.75,
} as const;

const MEASURE_SIDE = 2048;

interface Grey {
  data: Uint8Array;
  width: number;
  height: number;
}

async function greyOf(buffer: Buffer): Promise<Grey> {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: MEASURE_SIDE, height: MEASURE_SIDE, fit: 'inside', withoutEnlargement: true })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
  const out = new Uint8Array(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return { data: out, width: info.width, height: info.height };
}

function deviation(g: Grey): number {
  let sum = 0;
  let sq = 0;
  for (const v of g.data) {
    sum += v;
    sq += v * v;
  }
  const n = g.data.length || 1;
  return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
}

/** Racine de l'énergie du laplacien (4 voisins) rapportée au contraste. */
function sharpnessOf(g: Grey, contrast: number): number {
  const { data, width: w, height: h } = g;
  if (w < 3 || h < 3) return 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      const lap = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      sq += lap * lap;
      n++;
    }
  }
  return Math.sqrt(sq / n) / (contrast + 8);
}

/** Les écarts entre colonnes (et entre lignes) à la frontière des blocs 8×8, rapportés aux autres. */
function blockinessOf(g: Grey): number {
  const { data, width: w, height: h } = g;
  if (w < 32 || h < 32) return 1;
  let edge = 0;
  let edgeN = 0;
  let inner = 0;
  let innerN = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w - 1; x++) {
      const d = Math.abs(data[row + x + 1] - data[row + x]);
      if (x % 8 === 7) {
        edge += d;
        edgeN++;
      } else {
        inner += d;
        innerN++;
      }
    }
  }
  for (let y = 0; y < h - 1; y++) {
    const row = y * w;
    const onEdge = y % 8 === 7;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(data[row + w + x] - data[row + x]);
      if (onEdge) {
        edge += d;
        edgeN++;
      } else {
        inner += d;
        innerN++;
      }
    }
  }
  // Le +2 : sur un fond uni, deux écarts presque nuls ne font pas un rapport.
  return (edge / Math.max(1, edgeN) + 2) / (inner / Math.max(1, innerN) + 2);
}

/** Le détail perdu par un aller-retour à la moitié de la taille, rapporté au contraste. */
async function detailOf(g: Grey, contrast: number): Promise<number> {
  const { data, width: w, height: h } = g;
  if (w < 16 || h < 16) return 0;
  const hw = Math.max(1, Math.round(w / 2));
  const hh = Math.max(1, Math.round(h / 2));
  const half = await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 1 } }).resize({ width: hw, height: hh, kernel: 'lanczos3' }).toColourspace('b-w').raw().toBuffer();
  const back = await sharp(half, { raw: { width: hw, height: hh, channels: 1 } }).resize({ width: w, height: h, kernel: 'cubic' }).toColourspace('b-w').raw().toBuffer();
  let sq = 0;
  let n = 0;
  // Les bords sont ignorés : le rééchantillonnage y est moins fidèle.
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const d = data[y * w + x] - back[y * w + x];
      sq += d * d;
      n++;
    }
  return Math.sqrt(sq / Math.max(1, n)) / (contrast + 8);
}

/**
 * Photo ou aplat, sur une vignette en couleur : nombre de teintes (4 bits par canal) et part de pixels voisins
 * identiques. Photos Kodak : 129 à 478 teintes, 3 à 50 % d'aplats ; illustrations, logos, maquettes : moins de 125
 * teintes ou plus de 52 % d'aplats.
 */
async function isPhoto(buffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(96, 96, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = new Set<number>();
  let flat = 0;
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    bins.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    if (i % info.width < info.width - 1 && Math.abs(data[i * 3 + 3] - r) + Math.abs(data[i * 3 + 4] - g) + Math.abs(data[i * 3 + 5] - b) <= 3) flat++;
  }
  return bins.size >= 125 && flat / px < 0.52;
}

/** Les blocs 8×8 d'une image, quel que soit son format (pour comparer avant et après un déblocage). */
export async function gridBlockiness(buffer: Buffer): Promise<number> {
  return blockinessOf(await greyOf(buffer));
}

const isJpeg = (buffer: Buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** La mesure d'une image ; `null` si le fichier n'est pas une image matricielle lisible (SVG, GIF animé exclus). */
export async function measureImageQuality(buffer: Buffer): Promise<ImageQuality | null> {
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height || meta.format === 'svg' || (meta.pages ?? 1) > 1) return null;
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = rotated ? meta.height : meta.width;
    const height = rotated ? meta.width : meta.height;
    const grey = await greyOf(buffer);
    const contrast = deviation(grey);
    const sharpness = sharpnessOf(grey, contrast);
    const detail = await detailOf(grey, contrast);
    const softness = sharpness > 0.005 ? detail / sharpness : 1;
    // La grille 8×8 ne se lit qu'à la taille du fichier (au-delà de 2 048 px, la réduction l'efface).
    const blockiness = isJpeg(buffer) && grey.width === width ? blockinessOf(grey) : 1;
    const photo = await isPhoto(buffer);
    const issues: ImageIssue[] = [];
    // Un aplat presque uni (fond, dégradé) n'a pas de transitions : ni net ni flou, il ne se juge pas.
    if (contrast >= 6 && Math.min(width, height) >= 32 && softness > THRESHOLDS.soft) issues.push('blurry');
    if (blockiness > THRESHOLDS.blocky) issues.push('blocky');
    return { width, height, sharpness: round(sharpness), detail: round(detail), softness: round(softness), blockiness: round(blockiness), photo, issues };
  } catch {
    return null;
  }
}

/** La place qu'une image occupe dans le site, en pixels CSS, et la densité d'écran visée (2 : écrans Retina). */
export interface ImageSlot {
  displayWidth: number;
  displayHeight: number;
  density?: number;
}

/** La largeur en pixels que l'image devrait avoir pour être nette à cette place (bornée à 2 400 px). */
export function targetWidthFor(quality: Pick<ImageQuality, 'width' | 'height'>, slot: ImageSlot): number {
  const density = slot.density ?? 2;
  // L'image couvre son cadre (`object-fit: cover`) : c'est le côté le plus exigeant qui décide.
  const byWidth = slot.displayWidth * density;
  const byHeight = (slot.displayHeight * density * quality.width) / Math.max(1, quality.height);
  return Math.min(2400, Math.round(Math.max(byWidth, byHeight)));
}

/**
 * Les défauts d'une image à SA place dans le site : ceux du fichier, plus `small` quand elle a moins de 75 % des
 * pixels qu'il faudrait. Une image sans défaut n'est jamais retouchée.
 */
export function needsEnhancement(quality: ImageQuality, slot?: ImageSlot): ImageIssue[] {
  const issues = [...quality.issues];
  if (slot && slot.displayWidth > 0) {
    const ratio = quality.width / Math.max(1, targetWidthFor(quality, slot));
    if (ratio < THRESHOLDS.resolution) issues.unshift('small');
  }
  return issues;
}

/** Un score pour ranger les images d'une section : la plus grande et la plus nette en tête. */
export function qualityRank(quality: ImageQuality | undefined): number {
  if (!quality) return 0;
  const pixels = Math.min(quality.width * quality.height, 2400 * 1600) / (2400 * 1600);
  return pixels - quality.issues.length * 0.25;
}
