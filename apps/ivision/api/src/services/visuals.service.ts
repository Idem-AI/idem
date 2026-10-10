/**
 * Les VISUELS d'iVision : le compositeur du moteur partagé (`core/src/visual`), le même
 * qu'IDEM — composition par le code ou par l'IA selon le cran, rendu mesuré, contrôle de
 * composition — sur la marque de l'utilisateur. Une image modèle en impose la structure et la
 * composition ; une photo de l'utilisateur remplace la photo de banque.
 */
import crypto from 'crypto';
import type { CreativityLevel } from '../../../core/src/creativity/levels';
import { coreHost } from '../../../core/src/runtime/host';
import type { ReferenceImage } from '../../../core/src/reference/reference.analyzer';
import { composeVisual, knownLogoUrls } from '../../../core/src/visual/visual.composer';
import { flyerRenderService, FORMAT_DIMENSIONS } from '../../../core/src/visual/flyer.render';
import { sanitizeSectionHtml, stripActiveContent } from '../../../core/src/render/sanitize-html';
import { isPosterDocument, renderPosterHtml } from '../../../core/src/visual/poster/poster.render';
import { classifyImage } from '../../../core/src/visual/poster/poster.images';
import { visualContextFromBrand } from '../../../core/src/visual/visual.context';
import type { FlyerFormat } from '../../../core/src/visual/visual.model';
import { collection } from '../config/db';
import logger from '../config/logger';
import { storage } from '../config/storage';
import { HttpError } from '../middleware/error';
import type { IvisionBrand, IvisionVisual } from '../models';
import { idem } from './idem.client';

const visuals = () => collection<IvisionVisual>('visuals');

/** La demande, découpée comme un contenu : une accroche courte, le reste en description. */
function contentOf(prompt: string) {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  const first = clean.split(/(?<=[.!?])\s|\n/)[0] || clean;
  return { title: first.slice(0, 120), description: clean.slice(0, 1200) };
}

export async function createVisual(
  userId: string,
  brand: IvisionBrand,
  input: {
    prompt: string;
    brief?: string;
    format: FlyerFormat;
    creativity: CreativityLevel;
    withPhoto: boolean;
    photoUrl?: string;
    reference?: ReferenceImage & { id: string };
    sessionId?: string;
    /** Retour sur la version précédente (« pas assez pro ») et ce qu'elle était. */
    feedback?: string;
    avoid?: { template?: string; scheme?: string }[];
    /** Fond sombre demandé explicitement. */
    wantsDark?: boolean;
  },
  paidCredits: number,
  /** L'avancement réel de la composition (étapes du chat). */
  onStage?: (stage: string, state: 'running' | 'done') => void
): Promise<IvisionVisual> {
  const id = `vis_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const context = visualContextFromBrand({ brandName: brand.name, voice: brand.voice, branding: brand.kit });
  const recent = await visuals().find({ userId, brandId: brand._id }, { projection: { layout: 1 } }).sort({ createdAt: -1 }).limit(6).toArray();
  // Les propres visuels de la marque (affiches trouvées sur son site) disent si elle assume les
  // fonds sombres ; sinon, surfaces claires.
  const kinds = await Promise.all(brand.photos.slice(0, 12).map((url) => classifyImage(url).catch(() => null)));
  const posters = kinds.filter((k): k is NonNullable<typeof k> => !!k && k.kind === 'poster');
  const darkBrand = posters.length > 0 && posters.reduce((sum, p) => sum + p.luminance, 0) / posters.length < 0.24;
  const started = Date.now();
  const composed = await composeVisual(
    {
      runPrompt: (feature, messages) => idem.ai.prompt({ userId, feature, messages }),
      agentCall: coreHost().agentCall?.({ userId, projectId: brand._id, element: 'flyer' }),
    },
    userId,
    brand._id,
    // Le message en titre ; la demande complète en description (ton, public, consignes).
    { id, title: contentOf(input.prompt).title, description: contentOf(input.brief || input.prompt).description },
    context,
    input.format,
    `ivision:${brand._id}`,
    `${brand._id}:${id}`,
    undefined,
    // Sans photo : demandé, ou le modèle n'en a pas (et l'utilisateur n'en fournit pas).
    !input.photoUrl && (!input.withPhoto || input.reference?.hasPhoto === false),
    {
      creativity: input.creativity,
      recentLayouts: recent.map((v) => v.layout).filter((l): l is string => !!l),
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.photoUrl ? { image: { url: input.photoUrl } } : {}),
      brandPhotos: brand.photos,
      allowDark: !!input.wantsDark || darkBrand,
      ...(input.feedback ? { feedback: input.feedback } : {}),
      ...(input.avoid?.length ? { avoid: input.avoid } : {}),
      ...(onStage ? { onStage } : {}),
    }
  );
  const uploaded = await storage.uploadFile(composed.png, `${id}.png`, `users/${userId}/brands/${brand._id}/visuals`, 'image/png');
  const visual: IvisionVisual = {
    _id: id,
    userId,
    brandId: brand._id,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    prompt: (input.brief || input.prompt).slice(0, 2000),
    format: input.format,
    imageUrl: uploaded.downloadURL,
    html: composed.html,
    layout: (composed.parsed as { layout?: string }).layout,
    scheme: (composed.parsed as { scheme?: string }).scheme,
    creativity: input.creativity,
    ...(input.reference ? { referenceId: input.reference.id } : {}),
    audit: { score: composed.audit.score, blocking: composed.audit.blocking },
    paidCredits,
    createdAt: new Date().toISOString(),
  };
  await visuals().insertOne(visual);
  logger.info('visual.created', { event: 'visual.created', visualId: id, brandId: brand._id, format: input.format, creativity: input.creativity, layout: visual.layout, score: composed.audit.score, reference: !!input.reference, ms: Date.now() - started });
  return visual;
}

export async function getVisual(userId: string, id: string): Promise<IvisionVisual> {
  const visual = await visuals().findOne({ _id: id, userId });
  if (!visual) throw new HttpError(404, 'visual_not_found', 'Visuel introuvable.');
  return visual;
}

export async function listVisuals(userId: string, brandId?: string): Promise<IvisionVisual[]> {
  return visuals()
    .find({ userId, ...(brandId ? { brandId } : {}) }, { projection: { html: 0 } })
    .sort({ createdAt: -1 })
    .limit(60)
    .toArray();
}

export async function deleteVisual(userId: string, id: string): Promise<void> {
  const res = await visuals().deleteOne({ _id: id, userId });
  if (!res.deletedCount) throw new HttpError(404, 'visual_not_found', 'Visuel introuvable.');
}

/**
 * Enregistre le HTML retouché dans l'éditeur partagé (`@idem/shared-document-editor`) et
 * re-rend l'image : le PNG téléchargé et la vignette restent ceux du visuel tel qu'il est.
 * Même rendu qu'IDEM (`flyerRenderService`), logo reconnu et remis à l'échelle si besoin.
 */
export async function updateVisualHtml(userId: string, brand: IvisionBrand, id: string, html: string): Promise<IvisionVisual> {
  const visual = await getVisual(userId, id);
  const cleaned = stripActiveContent(sanitizeSectionHtml(html));
  if (!/<[a-z][\s\S]*>/i.test(cleaned) || !cleaned.replace(/<[^>]*>/g, '').trim() && !/<img\b/i.test(cleaned)) throw new HttpError(400, 'empty_html', 'Le visuel ne peut pas être vide.');
  const context = visualContextFromBrand({ brandName: brand.name, voice: brand.voice, branding: brand.kit });
  const dims = FORMAT_DIMENSIONS[visual.format] || FORMAT_DIMENSIONS.square;
  // Un visuel du compositeur est un document complet (styles et polices embarqués) : il est
  // photographié tel quel. Un fragment de l'ancien format passe par le rendu Tailwind d'IDEM.
  const png = isPosterDocument(cleaned)
    ? await renderPosterHtml(cleaned, dims.width, dims.height)
    : await flyerRenderService.renderFlyerToPng(
        cleaned,
        visual.format,
        { primaryFont: context.branding.primaryFont, secondaryFont: context.branding.secondaryFont, url: context.branding.fontUrl },
        knownLogoUrls(context)
      );
  // Un nouveau nom à chaque version : aucun cache (navigateur, CDN) ne garde l'ancienne image.
  const uploaded = await storage.uploadFile(png, `${id}-${Date.now().toString(36)}.png`, `users/${userId}/brands/${visual.brandId}/visuals`, 'image/png');
  const updatedAt = new Date().toISOString();
  await visuals().updateOne({ _id: id, userId }, { $set: { html: cleaned, imageUrl: uploaded.downloadURL, updatedAt } });
  logger.info('visual.edited', { event: 'visual.edited', visualId: id, brandId: visual.brandId, bytes: cleaned.length });
  return { ...visual, html: cleaned, imageUrl: uploaded.downloadURL, updatedAt };
}

export function visualView(v: IvisionVisual) {
  return { id: v._id, brandId: v.brandId, sessionId: v.sessionId, prompt: v.prompt, format: v.format, imageUrl: v.imageUrl, layout: v.layout, creativity: v.creativity, referenceId: v.referenceId, score: v.audit?.score, createdAt: v.createdAt };
}
