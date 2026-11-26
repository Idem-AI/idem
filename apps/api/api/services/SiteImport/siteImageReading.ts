/**
 * LE MANIFESTE DES IMAGES D'UNE REFONTE : chaque image recopiée de l'ancien site est regardée par le modèle de vision
 * (une vignette de 512 px, une réponse JSON courte), pendant que la recopie et la lecture de la marque continuent.
 *
 * La lecture est OBJECTIVE (ce que montre l'image, sa nature, du texte incrusté, des défauts) : elle ne dit pas si
 * l'image convient. C'est l'agent média de la refonte (iCode, `mediaDirector.ts`) qui choisit, section par section,
 * l'image qui sert le projet — ou constate qu'aucune ne convient, et passe alors à la banque puis à la génération.
 *
 * Ne lève jamais : une image non lue reste dans le relevé, sans `vision` (le moteur la traite comme avant).
 */
import sharp from 'sharp';
import type { ImageReading } from '../../../../ivision/core/src/site/site-crawler';

const KINDS: ImageReading['kind'][] = ['photo', 'illustration', '3d', 'logo', 'icon', 'screenshot', 'text', 'decorative'];

/** Le plus grand côté de la vignette envoyée : assez pour lire la scène, peu de jetons. */
const THUMB_SIDE = 512;
/** En dessous, c'est une icône ou un pictogramme : pas la peine de la regarder. */
const MIN_SIDE = 160;

export const READING_INSTRUCTION = `Describe this image taken from a company website, objectively. Do not judge whether it fits.
Answer ONLY with this JSON object:
{
  "description": "what the image shows, in English, 1-2 precise sentences: subject, action, place, framing",
  "kind": "photo|illustration|3d|logo|icon|screenshot|text|decorative",
  "people": true|false,
  "text": true|false (legible words embedded in the image: slogan, poster, price, banner),
  "generic": true|false (a generic stock photo: handshake, anonymous office, people smiling at the camera),
  "flaws": ["visible problems only: watermark, collage, cropped subject, too dark, blurry, low resolution"]
}
"kind": "logo" for a brand mark, "icon" for a pictogram, "screenshot" for a software or website capture, "text" when the image is mostly words, "decorative" for a background texture, pattern or plain shape.
When people are visible, say how many and describe each one so they can be told apart from other photos: apparent gender, apparent age range, skin tone, hair, clothing, pose (portrait, at work, group), background. Never guess a name.`;

/**
 * Le texte qui accompagnait l'image sur l'ancien site (nom et rôle sous une photo d'équipe, titre d'un projet) : dit au
 * modèle pour qu'il comprenne le RÔLE de l'image (portrait de ce membre, photo de ce projet), pas pour qu'il le décrive.
 */
export function readingInstruction(caption?: string): string {
  if (!caption) return READING_INSTRUCTION;
  return `${READING_INSTRUCTION}
On the website, this image is shown next to this text: "${caption.replace(/"/g, "'").slice(0, 200)}". It tells you what the image stands for (for example the portrait of the person named there, or the project titled there): start the description with that role (e.g. "Portrait of the team member captioned '…': …"). This text is NOT embedded in the image: do not set "text" because of it.`;
}

/** La réponse du modèle, vérifiée champ par champ ; `null` si elle n'est pas lisible. */
export function parseReading(raw: string): ImageReading | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const description = typeof value.description === 'string' ? value.description.replace(/\s+/g, ' ').trim().slice(0, 480) : '';
  const kind = KINDS.includes(value.kind as ImageReading['kind']) ? (value.kind as ImageReading['kind']) : null;
  if (description.length < 8 || !kind) return null;
  return {
    description,
    kind,
    people: value.people === true,
    text: value.text === true,
    generic: value.generic === true,
    flaws: Array.isArray(value.flaws) ? value.flaws.filter((f): f is string => typeof f === 'string' && !!f.trim()).map((f) => f.trim().slice(0, 40)).slice(0, 4) : [],
  };
}

/** Une image matricielle assez grande pour illustrer une section : seule celle-là est regardée. */
export function worthReading(mimeType: string, width: number, height: number): boolean {
  return /^image\/(png|jpe?g|webp|avif|tiff|gif)$/i.test(mimeType) && Math.min(width, height) >= MIN_SIDE;
}

/**
 * Regarde une image (fichier d'origine). `null` en cas d'échec ou de délai dépassé : la refonte continue sans elle.
 */
export async function readSiteImage(
  buffer: Buffer,
  vision: (base64: string, mimeType: string, instruction: string) => Promise<string>,
  timeoutMs = 20_000,
  caption?: string
): Promise<ImageReading | null> {
  let thumb: Buffer;
  try {
    thumb = await sharp(buffer, { failOn: 'none', animated: false })
      .rotate()
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch {
    return null;
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    const answer = await Promise.race([
      vision(thumb.toString('base64'), 'image/jpeg', readingInstruction(caption)),
      new Promise<string>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), timeoutMs))),
    ]);
    return parseReading(answer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Une petite file : au plus `size` lectures à la fois (la recopie, elle, garde ses propres six fils). */
export function readingQueue(size: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= size) await new Promise<void>((resolve) => waiting.push(resolve));
    running += 1;
    try {
      return await task();
    } finally {
      running -= 1;
      waiting.shift()?.();
    }
  };
}
