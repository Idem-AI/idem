/**
 * LA MARQUE DANS L'EN-TÊTE D'UN SITE — mesurée et préparée par le code, jamais par un modèle.
 *
 * Trois défauts faisaient disparaître le logo des en-têtes iCode (relevés le 21/11/2026 sur des refontes réelles) :
 *
 *   - le cadre vide : un logo vectorisé garde la toile de l'image d'origine (EKnumeriK : 170 × 170 pour un logo de
 *     40 px de haut au centre). Affiché à 36 px de haut, il en mesurait 10 : invisible ;
 *   - l'icône muette : une icône seule (une carte, un symbole) s'affichait sans le nom, et le visiteur ne savait
 *     pas sur quel site il était ;
 *   - le logo blanc : dessiné pour un en-tête sombre, posé sur un en-tête clair.
 *
 * D'où, pour chaque projet, une « marque d'en-tête » rangée dans `branding.logo.header` :
 *
 *   src      le logo rogné au plus juste (SVG : viewBox recadré, toujours net ; image : PNG rogné)
 *   kind     `wordmark` (le logo porte déjà le nom : on l'affiche seul) ou `icon` (on affiche l'icône ET le nom)
 *   light    le logo est clair sur transparent : il se pose sur une pastille sombre, sinon il ne se voit pas
 *
 * Calculée une fois, recalculée quand le logo change (`from`) ou quand la règle change (`v`).
 */
import crypto from 'crypto';
import sharp from 'sharp';
import logger from '../../config/logger';
import type { ProjectModel } from '../../models/project.model';
import { projectService } from '../project.service';
import { storageService } from '../storage.service';
import { safeFetch } from '../../../../ivision/core/src/render/safe-fetch';

export interface HeaderBrandMark {
  /** Le logo rogné, prêt pour l'en-tête. */
  src: string;
  kind: 'wordmark' | 'icon';
  /** Largeur ÷ hauteur du logo rogné. */
  aspect: number;
  /** Clair sur transparent : à poser sur une pastille sombre. */
  light?: boolean;
  /** Empreinte des emplacements du logo au moment du calcul. */
  from: string;
  v: number;
}

/** Version de la règle : la changer recalcule toutes les marques à leur prochaine lecture. */
const VERSION = 1;

/**
 * Au-delà, le logo est un logo « avec texte » (le nom y est écrit) : on l'affiche seul. En deçà, c'est une icône ou
 * un symbole, auquel on joint le nom. Mesuré sur les logos des refontes réelles : un logotype descend rarement sous
 * 2:1, une icône dépasse rarement 1,4:1 ; un lockup empilé (icône au-dessus du nom, ~1,2:1) reçoit aussi le nom,
 * mieux vaut un nom répété qu'un nom illisible à 36 px.
 */
const WORDMARK_ASPECT = 1.75;

/** Le logo complet d'abord (le logo d'origine d'une refonte, puis les déclinaisons avec texte), l'icône ensuite. */
const FULL_SLOTS = ['originalUrl', 'assetUrls.withText.lightBackground', 'variations.withText.lightBackground', 'assetUrls.primary', 'svg'];
const ICON_SLOTS = ['assetUrls.iconOnly.lightBackground', 'variations.iconOnly.lightBackground', 'iconSvg', 'assetUrls.icon'];

const readPath = (source: unknown, path: string): string => {
  const value = path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), source);
  return typeof value === 'string' ? value.trim() : '';
};

/** Une valeur d'emplacement exploitable : une adresse, ou un SVG en ligne (projets anciens). */
const usable = (value: string) => /^https?:\/\//.test(value) || value.startsWith('<svg') || value.startsWith('<?xml');

function candidatesOf(logo: unknown): string[] {
  const out: string[] = [];
  for (const slot of [...FULL_SLOTS, ...ICON_SLOTS]) {
    const value = readPath(logo, slot);
    if (value && usable(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

const fingerprint = (values: string[]) => crypto.createHash('sha1').update(values.join('\n')).digest('hex').slice(0, 16);

async function load(value: string): Promise<{ buffer: Buffer; svg: boolean } | null> {
  if (!/^https?:\/\//.test(value)) return { buffer: Buffer.from(value), svg: true };
  try {
    const objectPath = storageService.objectPathOf(value);
    const own = objectPath ? await storageService.readObjectBuffer(objectPath, 8 * 1024 * 1024) : null;
    const buffer = own ?? (await safeFetch(value, { accept: ['image/'], maxBytes: 8 * 1024 * 1024, timeoutMs: 15_000 })).buffer;
    const head = buffer.subarray(0, 512).toString('utf8').trimStart();
    return { buffer, svg: head.startsWith('<svg') || head.startsWith('<?xml') || /\.svg(\?|$)/i.test(value) };
  } catch (error: any) {
    logger.warn('brand_mark.load_failed', { event: 'brand_mark.load_failed', error: error?.message });
    return null;
  }
}

interface Measure {
  /** Boîte de l'encre, en fractions de l'image (0..1). */
  box: { x: number; y: number; w: number; h: number };
  aspect: number;
  light: boolean;
}

/**
 * La boîte de l'encre et sa clarté. Le fond se lit aux quatre coins : transparent (l'encre = ce qui est opaque) ou
 * uni (l'encre = ce qui s'en écarte). Un logo sans encre détectable rend `null`.
 */
export async function measure(buffer: Buffer, svg: boolean): Promise<Measure | null> {
  const { data, info } = await sharp(buffer, { failOn: 'none', ...(svg ? { density: 144 } : {}) })
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const;
  };
  const corners = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
  const transparent = corners.filter((c) => c[3] < 24).length >= 3;
  const bg = corners[0];
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  let luminance = 0;
  let inked = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = at(x, y);
      const ink = transparent ? a >= 24 : a >= 24 && Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 48;
      if (!ink) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      inked += 1;
    }
  }
  if (maxX < 0 || inked < 12) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    box: { x: minX / W, y: minY / H, w: w / W, h: h / H },
    aspect: w / h,
    // Clair sur transparent seulement : un logo blanc sur son propre fond coloré se voit partout.
    light: transparent && luminance / inked > 0.86,
  };
}

/** Le SVG recadré sur son encre (une marge de 3 %), ou `null` s'il n'a pas de repère lisible. */
export function cropSvg(svg: string, box: Measure['box']): string | null {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return null;
  const attr = (name: string) => root.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
  let vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) {
    const w = parseFloat(attr('width') ?? '');
    const h = parseFloat(attr('height') ?? '');
    if (!(w > 0 && h > 0)) return null;
    vb = [0, 0, w, h];
  }
  const [vx, vy, vw, vh] = vb;
  const padX = box.w * vw * 0.03;
  const padY = box.h * vh * 0.03;
  const next = [vx + box.x * vw - padX, vy + box.y * vh - padY, box.w * vw + 2 * padX, box.h * vh + 2 * padY].map((n) => Math.round(n * 100) / 100);
  const rewritten = root
    .replace(/\s(width|height|viewBox|preserveAspectRatio)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<svg\b/i, `<svg viewBox="${next.join(' ')}" preserveAspectRatio="xMidYMid meet"`);
  return svg.replace(root, rewritten);
}

/** L'image rognée sur son encre (une marge de 3 %), en PNG transparent de 320 px de haut au plus. */
async function cropRaster(buffer: Buffer, box: Measure['box']): Promise<Buffer> {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const pad = 0.03;
  const left = Math.max(0, Math.floor((box.x - box.w * pad) * W));
  const top = Math.max(0, Math.floor((box.y - box.h * pad) * H));
  const width = Math.min(W - left, Math.ceil(box.w * (1 + 2 * pad) * W));
  const height = Math.min(H - top, Math.ceil(box.h * (1 + 2 * pad) * H));
  return sharp(buffer, { failOn: 'none' }).extract({ left, top, width: Math.max(1, width), height: Math.max(1, height) }).resize({ height: 320, withoutEnlargement: true }).png().toBuffer();
}

/** La marque d'en-tête d'un logo, calculée (sans rien enregistrer). `null` si aucun emplacement n'est lisible. */
export async function computeBrandMark(userId: string, projectId: string, logo: unknown): Promise<HeaderBrandMark | null> {
  const values = candidatesOf(logo);
  if (!values.length) return null;
  const from = fingerprint(values);
  type Candidate = { value: string; buffer: Buffer; svg: boolean; m: Measure };
  let first: Candidate | null = null;
  let chosen: Candidate | null = null;
  for (const value of values) {
    const loaded = await load(value);
    if (!loaded) continue;
    const m = await measure(loaded.buffer, loaded.svg).catch(() => null);
    if (!m) continue;
    const entry = { value, ...loaded, m };
    first ??= entry;
    // Un logo blanc sur transparent ne se voit pas sur un en-tête clair : la déclinaison suivante est préférée.
    if (!m.light) {
      chosen = entry;
      break;
    }
  }
  chosen ??= first;
  if (!chosen) return null;

  const folder = `users/${userId}/projects/${projectId}/logos`;
  const stamp = Date.now().toString(36);
  let src = chosen.value;
  try {
    if (chosen.svg) {
      const cropped = cropSvg(chosen.buffer.toString('utf8'), chosen.m.box);
      if (cropped) src = await storageService.uploadSvgFile(cropped, `logo-header-${stamp}.svg`, folder);
      else src = (await storageService.uploadFile(await cropRaster(await sharp(chosen.buffer, { density: 288 }).png().toBuffer(), chosen.m.box), `logo-header-${stamp}.png`, folder, 'image/png')).downloadURL;
    } else {
      src = (await storageService.uploadFile(await cropRaster(chosen.buffer, chosen.m.box), `logo-header-${stamp}.png`, folder, 'image/png')).downloadURL;
    }
  } catch (error: any) {
    // Sans recadrage, le logo d'origine reste meilleur que le nom seul.
    logger.warn('brand_mark.crop_failed', { event: 'brand_mark.crop_failed', projectId, error: error?.message });
    if (!/^https?:\/\//.test(src)) return null;
  }

  const l = (logo ?? {}) as { type?: string; nameBeside?: boolean };
  const fromIconSlot = ICON_SLOTS.some((slot) => readPath(logo, slot) === chosen!.value) && !FULL_SLOTS.some((slot) => readPath(logo, slot) === chosen!.value);
  // Le nom écrit à côté du logo sur l'ancien site, ou une icône prise faute de mieux : le logo ne porte pas le nom.
  // Un logo très large (≥ 2,6:1) porte forcément le nom : un texte « à côté » n'était alors qu'un libellé masqué
  // (« Accueil » pour les lecteurs d'écran), jamais un nom à répéter.
  const kind: HeaderBrandMark['kind'] =
    l.type === 'name' ? 'wordmark' : (l.nameBeside && chosen.m.aspect < 2.6) || fromIconSlot ? 'icon' : chosen.m.aspect >= WORDMARK_ASPECT ? 'wordmark' : 'icon';
  return { src, kind, aspect: Math.round(chosen.m.aspect * 100) / 100, ...(chosen.m.light ? { light: true } : {}), from, v: VERSION };
}

/**
 * La marque d'en-tête du projet : celle déjà rangée si elle vaut pour le logo actuel, sinon calculée puis rangée
 * dans `branding.logo.header`. `null` sans logo lisible (l'en-tête montre alors le nom).
 */
export async function ensureBrandMark(userId: string, projectId: string, project?: ProjectModel | null): Promise<HeaderBrandMark | null> {
  const current = project ?? (await projectService.getUserProjectById(userId, projectId).catch(() => null));
  const logo = current?.analysisResultModel?.branding?.logo as (Record<string, unknown> & { header?: HeaderBrandMark }) | undefined;
  if (!current || !logo) return null;
  const values = candidatesOf(logo);
  if (!values.length) return null;
  if (logo.header?.src && logo.header.v === VERSION && logo.header.from === fingerprint(values)) return logo.header;

  const header = await computeBrandMark(userId, projectId, logo);
  if (!header) return null;
  // Relu juste avant d'écrire : seule la marque d'en-tête change, rien de ce qu'une autre tâche a écrit entre-temps.
  const fresh = await projectService.getUserProjectById(userId, projectId).catch(() => null);
  const branding = fresh?.analysisResultModel?.branding as Record<string, any> | undefined;
  if (fresh && branding?.logo) {
    await projectService
      .editUserProject(userId, projectId, {
        analysisResultModel: { ...fresh.analysisResultModel, branding: { ...branding, logo: { ...branding.logo, header } } } as unknown as ProjectModel['analysisResultModel'],
      })
      .catch((error: any) => logger.warn('brand_mark.save_failed', { event: 'brand_mark.save_failed', projectId, error: error?.message }));
  }
  logger.info('brand_mark.computed', { event: 'brand_mark.computed', projectId, kind: header.kind, aspect: header.aspect, light: !!header.light });
  return header;
}
