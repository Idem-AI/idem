/**
 * Les images d'un visuel : leur point d'intérêt (pour cadrer sans couper le sujet), et le CHOIX de
 * la photo — pertinente pour le message, de la marque d'abord.
 *
 * Ordre de préférence : la photo de l'utilisateur, les photos de la marque (site, projet IDEM,
 * imports), une photo de banque VÉRIFIÉE par la vision, une image générée, aucune (composition
 * typographique). Une photo hors sujet est pire que pas de photo.
 */
import sharp from 'sharp';
import { safeFetch } from '../render/safe-fetch';
import { coreHost } from '../runtime/host';
import logger from '../runtime/logger';

/** Une photo retenue pour un visuel : son point d'intérêt (pour cadrer sans couper le sujet) et d'où elle vient. */
export interface VisualPhoto {
  url: string;
  /** Point d'intérêt (0–1). */
  focal: { x: number; y: number };
  /** Largeur / hauteur de l'image source. */
  aspect: number;
  origin: 'user' | 'brand' | 'stock' | 'generated';
  /** Ce que montre la photo (vision). */
  subject?: string;
}

const cache = new Map<string, Promise<Buffer | null>>();

/** Le fichier d'une image (data-URI, fichier du stockage, URL publique), mis en cache le temps du processus. */
export function imageBuffer(url: string): Promise<Buffer | null> {
  let hit = cache.get(url);
  if (!hit) {
    hit = (async () => {
      try {
        if (url.startsWith('data:')) return Buffer.from(url.split(',')[1] || '', /;base64,/.test(url) ? 'base64' : 'utf8');
        if (url.startsWith('file://') && process.env.NODE_ENV !== 'production') return (await import('fs')).readFileSync(new URL(url));
        return (await safeFetch(url, { accept: ['image/'], maxBytes: 20 * 1024 * 1024, timeoutMs: 20_000 })).buffer;
      } catch (error) {
        logger.warn('visual.image_unavailable', { event: 'visual.image_unavailable', url: url.slice(0, 120), error });
        return null;
      }
    })();
    cache.set(url, hit);
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  }
  return hit;
}

/** Point d'intérêt (stratégie « attention » de sharp : visages, contrastes, couleurs vives). */
export async function focalOf(buffer: Buffer): Promise<{ focal: { x: number; y: number }; aspect: number }> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const side = 256;
  const scale = side / Math.min(w, h);
  const { info } = await sharp(buffer).resize(side, side, { fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
  const ax = (info as { attentionX?: number }).attentionX;
  const ay = (info as { attentionY?: number }).attentionY;
  const sw = w * scale;
  const sh = h * scale;
  return {
    focal: { x: ax != null ? Math.min(0.92, Math.max(0.08, ax / sw)) : 0.5, y: ay != null ? Math.min(0.85, Math.max(0.15, ay / sh)) : 0.42 },
    aspect: w / h,
  };
}

export async function describePhoto(url: string, origin: VisualPhoto['origin']): Promise<VisualPhoto | null> {
  const buffer = await imageBuffer(url);
  if (!buffer) return null;
  try {
    const { focal, aspect } = await focalOf(buffer);
    return { url, focal, aspect, origin };
  } catch {
    return null;
  }
}

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export type ImageKind = 'photo' | 'poster' | 'graphic' | 'logo' | 'screenshot';

export interface ClassifiedImage {
  url: string;
  kind: ImageKind;
  subject?: string;
  /** Luminance moyenne (0–1) : une affiche sombre dit que la marque assume les fonds sombres. */
  luminance: number;
}

const kinds = new Map<string, Promise<ClassifiedImage>>();

/**
 * Ce qu'est une image de la marque : une PHOTO (utilisable dans un visuel), une AFFICHE de la
 * marque (référence de style, jamais posée comme photo), une illustration, un logo, une capture.
 * La transparence trahit d'abord les logos et illustrations ; la vision tranche le reste.
 */
export function classifyImage(url: string): Promise<ClassifiedImage> {
  let hit = kinds.get(url);
  if (!hit) {
    hit = (async (): Promise<ClassifiedImage> => {
      const buffer = await imageBuffer(url);
      if (!buffer) return { url, kind: 'graphic', luminance: 0.5 };
      const { data, info } = await sharp(buffer).ensureAlpha().resize(48, 48, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      let transparent = 0;
      let lum = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i + 3] < 200) transparent++;
        lum += 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
      }
      const px = data.length / info.channels;
      const luminance = lum / px;
      if (transparent / px > 0.03) return { url, kind: 'graphic', luminance };
      const analyze = coreHost().analyzeImage;
      if (!analyze) return { url, kind: 'photo', luminance };
      try {
        const raw = await analyze(
          await thumb(buffer),
          'image/jpeg',
          'What is this image? Reply ONLY with JSON: {"kind":"photo|poster|graphic|logo|screenshot","subject":"<12 words"}. "photo" = a real photograph with little or no text; "poster" = a designed flyer/social visual with text; "graphic" = illustration, icon or pattern.',
          { maxOutputTokens: 80, temperature: 0, purpose: 'visual-analysis' }
        );
        const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        const kind = (['photo', 'poster', 'graphic', 'logo', 'screenshot'] as const).find((k) => String(json.kind || '').toLowerCase().includes(k)) || 'photo';
        return { url, kind, subject: typeof json.subject === 'string' ? json.subject.slice(0, 100) : undefined, luminance };
      } catch {
        return { url, kind: 'photo', luminance };
      }
    })();
    kinds.set(url, hit);
  }
  return hit;
}

/** Une vignette JPEG (pour la vision), petite : la pertinence se juge sans détail. */
async function thumb(buffer: Buffer): Promise<string> {
  return (await sharp(buffer).rotate().resize(384, 384, { fit: 'inside' }).jpeg({ quality: 72 }).toBuffer()).toString('base64');
}

/**
 * Note la pertinence de photos pour un message (0–10), par la vision de l'hôte. Une seule
 * planche par photo, consigne courte ; sans vision, l'ordre d'origine (notes neutres).
 */
export async function rankByRelevance(urls: string[], subject: string, brand: { name: string; business?: string }): Promise<{ url: string; score: number; reason?: string }[]> {
  const analyze = coreHost().analyzeImage;
  if (!analyze || !urls.length) return urls.map((url) => ({ url, score: 5 }));
  const instruction = [
    `Brand: ${brand.name}${brand.business ? ` (${brand.business})` : ''}. The social-media visual says: "${subject.slice(0, 220)}".`,
    'Would THIS photo be a fitting, professional illustration for that visual and that brand?',
    'Penalise: unrelated subject, people who contradict the audience (e.g. a man for a women-only community), stock clichés, abstract textures, screenshots, text-heavy images, low quality.',
    'Reply ONLY with JSON: {"score": 0-10, "reason": "<8 words"}',
  ].join('\n');
  const out = await Promise.all(
    urls.map(async (url) => {
      try {
        const buffer = await imageBuffer(url);
        if (!buffer) return { url, score: 0, reason: 'unavailable' };
        const raw = await analyze(await thumb(buffer), 'image/jpeg', instruction, { maxOutputTokens: 80, temperature: 0, purpose: 'visual-analysis' });
        const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        const score = Math.max(0, Math.min(10, Number(json.score)));
        return { url, score: Number.isFinite(score) ? score : 5, reason: typeof json.reason === 'string' ? json.reason.slice(0, 80) : undefined };
      } catch {
        return { url, score: 5 };
      }
    })
  );
  return out.sort((a, b) => b.score - a.score);
}
