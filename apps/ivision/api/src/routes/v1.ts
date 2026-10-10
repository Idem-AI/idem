/**
 * L'API publique d'iVision (`/v1`), pour son interface et pour le tableau de bord IDEM.
 * Toutes les routes exigent la session IDEM (cookie `session`), sauf les sons de l'aperçu.
 */
import { Response, Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { CREATIVITY_LEVELS } from '../../../core/src/creativity/levels';
import { VideoInputError } from '../../../core/src/video/motionVideo.service';
import { MediaInputError } from '../../../core/src/video/video.media';
import { MOTION_STYLES, MUSIC_MOODS, MotionStyle, MusicMood, VideoFormat } from '../../../core/src/video/video.model';
import { videoOptions } from '../../../core/src/video/video.options';
import { resolvePublicSound } from '../../../core/src/video/video.sfx';
import { SiteScanError } from '../../../core/src/site/site-scanner';
import { CAPTION_STYLES, CUT_MODES, MONTAGE_LIMITS } from '../../../core/src/montage/montage.model';
import { MontageInputError } from '../../../core/src/montage/montage.service';
import fs from 'fs';
import os from 'os';
import { FLYER_FORMATS } from '../../../core/src/visual/visual.model';
import axios from 'axios';
import { publicUrl, storage } from '../config/storage';
import logger from '../config/logger';
import { authenticate, AuthedRequest } from '../middleware/auth';
import { asyncRoute, HttpError } from '../middleware/error';
import { validate } from '../middleware/validate';
import { charge, PaymentRequired, quote, refund } from '../services/billing';
import * as brands from '../services/brands.service';
import * as chat from '../services/chat.service';
import { idem } from '../services/idem.client';
import * as refs from '../services/references.service';
import { montages, montageView, refundMontage } from '../services/montages.service';
import { motionVideos } from '../services/videos.service';
import * as visuals from '../services/visuals.service';
import { openSse } from '../utils/sse';

export const v1 = Router();

const uid = (req: AuthedRequest) => req.user!.uid;
const lang = (req: AuthedRequest) => (String(req.headers['accept-language'] || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr');

/** Les refus du montage, dits à l'utilisateur. */
const MONTAGE_MESSAGES: Record<string, string> = {
  unreadable_video: 'Cette vidéo ne peut pas être lue. Essayez un MP4 ou un MOV.',
  no_audio: 'Cette vidéo n’a pas de son : le montage part de ce que vous dites.',
  too_short: 'La vidéo est trop courte (3 secondes au moins).',
  too_long: `La vidéo est trop longue (${MONTAGE_LIMITS.maxDurationSec / 60} minutes au plus).`,
  still_processing: 'Le montage est encore en préparation.',
  already_rendering: 'Un export est déjà en cours.',
  not_ready: 'Le montage n’est pas encore prêt.',
};

/** Les erreurs du moteur, traduites en réponses HTTP lisibles. */
function engineError(error: unknown): never {
  if (error instanceof MediaInputError) throw new HttpError(400, 'invalid_media', error.message);
  if (error instanceof MontageInputError) throw new HttpError(['still_processing', 'already_rendering'].includes(error.message) ? 409 : 400, error.message, MONTAGE_MESSAGES[error.message] || error.message);
  if (error instanceof VideoInputError) throw new HttpError(error.message === 'project_not_found' ? 404 : error.message === 'already_rendering' ? 409 : 400, error.message);
  throw error;
}

// ─── Sons de l'aperçu (publics : la page d'aperçu les charge sans cookie) ───

v1.get('/sfx/:name', (req, res) => {
  const file = resolvePublicSound(String(req.params.name || ''));
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
});

v1.use(authenticate);

// ─── Compte ─────────────────────────────────────────────────────────────────

v1.get(
  '/me',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const balance = await idem.billing.balance(uid(req)).catch(() => null);
    res.json({ user: req.user, credits: balance?.credits ?? null, plan: balance?.plan ?? null });
  })
);

// ─── Marques ────────────────────────────────────────────────────────────────

v1.get(
  '/brands',
  asyncRoute<AuthedRequest>(async (req, res) => res.json({ brands: (await brands.listBrands(uid(req))).map(brands.brandView) }))
);

v1.get(
  '/brands/:id',
  asyncRoute<AuthedRequest>(async (req, res) => res.json(brands.brandView(await brands.getBrand(uid(req), req.params.id))))
);

/** Scan d'un site en flux (étapes réelles), hors conversation (page « Marques »). */
v1.post(
  '/brands/scan',
  validate({ body: z.object({ url: z.string().min(3).max(500) }) }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const sse = openSse(req, res);
    try {
      const brand = await brands.scanBrand(uid(req), req.body.url, (step, data) => sse.send({ type: 'status', key: `chat.status.scan.${step}`, data }));
      sse.send({ type: 'brand', brand: brands.brandView(brand) });
    } catch (error) {
      logger.warn('brand.scan_failed', { event: 'brand.scan_failed', error });
      sse.send({ type: 'error', error: error instanceof SiteScanError ? error.code : 'scan_failed', message: error instanceof SiteScanError ? error.message : 'Je n’ai pas pu lire ce site.' });
    } finally {
      sse.end();
    }
  })
);

const hex = z.string().regex(/^#?[0-9a-fA-F]{3,8}$/);
const palette = z.object({ primary: hex.optional(), secondary: hex.optional(), accent: hex.optional(), background: hex.optional(), text: hex.optional() }).optional();

v1.post(
  '/brands',
  validate({ body: z.object({ name: z.string().min(1).max(80), colors: palette, display: z.string().max(60).optional(), body: z.string().max(60).optional(), tone: z.string().max(200).optional(), businessType: z.string().max(120).optional(), language: z.string().max(5).optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.status(201).json(brands.brandView(await brands.createManualBrand(uid(req), req.body))))
);

v1.post(
  '/brands/import-idem',
  validate({ body: z.object({ projectId: z.string().min(1).max(128) }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.status(201).json(brands.brandView(await brands.importIdemProject(uid(req), req.body.projectId))))
);

v1.post(
  '/brands/:id/choose',
  validate({ body: z.object({ palette: z.string().max(40).optional(), typography: z.string().max(40).optional(), name: z.string().max(80).optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.json(brands.brandView(await brands.chooseProposals(uid(req), req.params.id, req.body))))
);

v1.patch(
  '/brands/:id',
  validate({ body: z.object({ name: z.string().max(80).optional(), colors: palette, display: z.string().max(60).optional(), body: z.string().max(60).optional(), tone: z.string().max(200).optional(), businessType: z.string().max(120).optional(), valueProposition: z.string().max(400).optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.json(brands.brandView(await brands.updateBrand(uid(req), req.params.id, req.body))))
);

v1.delete(
  '/brands/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    await brands.deleteBrand(uid(req), req.params.id);
    res.status(204).end();
  })
);

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 8 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) });

/** Photos de la marque (produit, équipe, boutique) : la meilleure matière des vidéos et visuels. */
v1.post(
  '/brands/:id/photos',
  photoUpload.array('photos', 8),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) throw new HttpError(400, 'photos_required', 'Ajoutez au moins une photo.');
    const brand = await brands.getBrand(uid(req), req.params.id);
    const urls = await Promise.all(
      files.map(async (file, i) => {
        const jpeg = await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
        return (await storage.uploadFile(jpeg, `photo-${Date.now().toString(36)}-${i}.jpg`, `users/${uid(req)}/brands/${brand._id}/photos`, 'image/jpeg')).downloadURL;
      })
    );
    res.status(201).json(brands.brandView(await brands.addBrandPhotos(uid(req), brand._id, urls)));
  })
);

/** Les projets IDEM de l'utilisateur (import de charte). */
v1.get(
  '/idem/projects',
  asyncRoute<AuthedRequest>(async (req, res) => res.json(await idem.projects.list(uid(req))))
);

// ─── Conversations ──────────────────────────────────────────────────────────

const mode = z.enum(['image', 'video']);

v1.get(
  '/sessions',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const m = req.query.mode === 'video' || req.query.mode === 'image' ? req.query.mode : undefined;
    res.json({ sessions: await chat.listSessions(uid(req), m) });
  })
);

v1.post(
  '/sessions',
  validate({ body: z.object({ mode, brandId: z.string().max(80).optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.status(201).json(chat.sessionView(await chat.createSession(uid(req), req.body.mode, req.body.brandId))))
);

v1.get(
  '/sessions/:id',
  asyncRoute<AuthedRequest>(async (req, res) => res.json(chat.sessionView(await chat.getSession(uid(req), req.params.id))))
);

v1.patch(
  '/sessions/:id',
  validate({ body: z.object({ brandId: z.string().min(1).max(80) }) }),
  asyncRoute<AuthedRequest>(async (req, res) => res.json(chat.sessionView(await chat.setSessionBrand(uid(req), req.params.id, req.body.brandId))))
);

v1.delete(
  '/sessions/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    await chat.deleteSession(uid(req), req.params.id);
    res.status(204).end();
  })
);

const mediaAsset = z.object({
  id: z.string().max(64),
  kind: z.enum(['image', 'video', 'model3d', 'lottie', 'rive']),
  url: z.string().url().max(2000),
  name: z.string().max(80).optional(),
  durationSec: z.number().optional(),
  posterUrl: z.string().max(2000).optional(),
});

const turnBody = z.object({
  text: z.string().max(2000).optional(),
  referenceId: z.string().max(80).optional(),
  noReference: z.boolean().optional(),
  media: z.array(mediaAsset).max(16).optional(),
  photoUrl: z.string().url().max(2000).optional(),
  resume: z.boolean().optional(),
  options: z
    .object({
      creativity: z.enum(CREATIVITY_LEVELS as unknown as [string, ...string[]]).optional(),
      durationSec: z.number().int().min(4).max(90).optional(),
      formats: z.array(z.string().max(16)).max(4).optional(),
      quality: z.string().max(16).optional(),
      type: z.string().max(24).optional(),
      musicMood: z.string().max(16).optional(),
      sfx: z.boolean().optional(),
      voice: z.boolean().optional(),
      format: z.enum(FLYER_FORMATS as unknown as [string, ...string[]]).optional(),
      withPhoto: z.boolean().optional(),
    })
    .optional(),
});

/** Un tour de conversation, en flux : messages, étapes réelles, résultat. */
v1.post(
  '/sessions/:id/turn',
  validate({ body: turnBody }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    // Vérifié avant d'ouvrir le flux : une conversation inconnue reste un 404 classique.
    await chat.getSession(uid(req), req.params.id);
    const sse = openSse(req, res);
    try {
      await chat.runTurn(uid(req), req.params.id, req.body as chat.TurnInput, (event) => sse.send(event), lang(req));
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) logger.error('chat.turn_failed', { event: 'chat.turn_failed', sessionId: req.params.id, error });
      sse.send({ type: 'error', error: known ? error.code : 'turn_failed', message: known ? error.message : 'Une erreur est survenue.' });
    } finally {
      sse.send({ type: 'done' });
      sse.end();
    }
  })
);

// ─── Modèles (vidéo ou image à reproduire) ──────────────────────────────────

const referenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 120 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, refs.isReferenceType(file.mimetype)) });

v1.post(
  '/references',
  referenceUpload.single('file'),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'file_required', 'Ajoutez une vidéo ou une image modèle.');
    res.status(201).json(refs.referenceView(await refs.createReference(uid(req), file)));
  })
);

v1.get(
  '/references',
  asyncRoute<AuthedRequest>(async (req, res) => res.json({ references: (await refs.listReferences(uid(req))).map(refs.referenceView) }))
);

v1.get(
  '/references/:id',
  asyncRoute<AuthedRequest>(async (req, res) => res.json(refs.referenceView(await refs.getReference(uid(req), req.params.id))))
);

v1.get(
  '/references/:id/sheets/:index',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const jpeg = await refs.referenceSheet(uid(req), req.params.id, Number(req.params.index) || 0);
    if (!jpeg) throw new HttpError(404, 'sheet_not_found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(jpeg);
  })
);

// ─── Vidéos ─────────────────────────────────────────────────────────────────

v1.get('/videos/options', (_req, res) => {
  res.json(videoOptions());
});

const videoMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm|x-m4v)|model\/gltf-binary|application\/(json|octet-stream|zip))$/.test(file.mimetype) || /\.(glb|json|lottie|riv)$/i.test(file.originalname)),
});

/** Médias d'une vidéo (photos, clips réencodés, GLB, Lottie, Rive), rangés sous la marque. */
v1.post(
  '/brands/:brandId/media',
  videoMedia.array('files', 8),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) throw new HttpError(400, 'files_required', 'Ajoutez au moins un fichier.');
    await brands.getBrand(uid(req), req.params.brandId);
    const assets = [];
    try {
      for (const file of files) assets.push(await motionVideos.uploadMedia(uid(req), req.params.brandId, file));
    } catch (error) {
      engineError(error);
    }
    res.status(201).json({ assets });
  })
);

v1.get(
  '/brands/:brandId/videos',
  asyncRoute<AuthedRequest>(async (req, res) => res.json({ videos: await motionVideos.listVideos(uid(req), req.params.brandId) }))
);

async function videoOr404(req: AuthedRequest) {
  const video = await motionVideos.getVideo(uid(req), req.params.brandId, req.params.videoId);
  if (!video) throw new HttpError(404, 'video_not_found', 'Vidéo introuvable.');
  return video;
}

v1.get(
  '/brands/:brandId/videos/:videoId',
  asyncRoute<AuthedRequest>(async (req, res) => res.json(await videoOr404(req)))
);

/** Retouches gratuites : textes par scène, style, musique, effets, voix off, direction, kit. */
v1.patch(
  '/brands/:brandId/videos/:videoId',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const body = req.body || {};
    const kit: Record<string, string> = {};
    for (const k of ['logo', 'background', 'annotate', 'iconSet']) if (typeof body.kit?.[k] === 'string' && body.kit[k].length < 40) kit[k] = body.kit[k];
    try {
      const video = await motionVideos.updateVideo(uid(req), req.params.brandId, req.params.videoId, {
        slots: body.slots && typeof body.slots === 'object' ? body.slots : undefined,
        style: MOTION_STYLES.includes(body.style) ? (body.style as MotionStyle) : undefined,
        musicMood: MUSIC_MOODS.includes(body.musicMood) ? (body.musicMood as MusicMood) : undefined,
        musicTrackId: typeof body.musicTrackId === 'string' ? body.musicTrackId : undefined,
        scope: body.scope,
        sfx: typeof body.sfx === 'boolean' ? body.sfx : undefined,
        voice: typeof body.voice === 'boolean' ? body.voice : undefined,
        direction: typeof body.direction === 'string' ? body.direction : undefined,
        kit: Object.keys(kit).length ? kit : undefined,
        images: body.images && typeof body.images === 'object' ? body.images : undefined,
      });
      if (!video) throw new HttpError(404, 'video_not_found', 'Vidéo introuvable.');
      res.json(video);
    } catch (error) {
      engineError(error);
    }
  })
);

v1.delete(
  '/brands/:brandId/videos/:videoId',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const removed = await motionVideos.deleteVideo(uid(req), req.params.brandId, req.params.videoId);
    res.status(removed ? 204 : 404).end();
  })
);

/** Le lecteur HTML autonome (même moteur que le MP4), pour un iframe `srcdoc` de l'éditeur. */
v1.get(
  '/brands/:brandId/videos/:videoId/preview',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const html = await motionVideos.previewHtml(uid(req), req.params.brandId, req.params.videoId, req.query.format as VideoFormat | undefined);
    if (!html) throw new HttpError(404, 'video_not_found', 'Vidéo introuvable.');
    res.json({ html });
  })
);

v1.get(
  '/brands/:brandId/videos/:videoId/music',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const video = await videoOr404(req);
    const m = MUSIC_MOODS.includes(req.query.mood as MusicMood) ? (req.query.mood as MusicMood) : video.brief.musicMood;
    res.json(await motionVideos.musicOptions(m, video.storyboard.style, video.brief.objective, video.scope.durationSec));
  })
);

/** Le prix d'un export pour un périmètre (formats, qualité), avant de le lancer. */
v1.post(
  '/brands/:brandId/videos/:videoId/export-quote',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const video = await videoOr404(req);
    res.json(motionVideos.quoteExport(video, req.body?.scope));
  })
);

/** Export MP4 : le premier est inclus dans le prix de la vidéo, les suivants coûtent 10 %. */
v1.post(
  '/brands/:brandId/videos/:videoId/export',
  asyncRoute<AuthedRequest>(async (req, res: Response) => {
    const video = await videoOr404(req);
    const { cost } = motionVideos.quoteExport(video, req.body?.scope);
    const action = video.exportCount === 0 ? 'motion_video' : 'motion_video_rerender';
    let paid;
    try {
      paid = await charge(uid(req), { action, cost }, video.id);
    } catch (error) {
      if (error instanceof PaymentRequired) {
        res.status(402).json(error.body);
        return;
      }
      throw error;
    }
    try {
      const started = await motionVideos.startExport(uid(req), req.params.brandId, video.id, req.body?.scope, paid.charged ? { cost: paid.cost, action } : undefined);
      if (!started) throw new HttpError(404, 'video_not_found', 'Vidéo introuvable.');
      res.status(202).json(started);
    } catch (error) {
      await refund(uid(req), paid, 'Export vidéo iVision refusé — crédits restitués');
      engineError(error);
    }
  })
);

// ─── Montages (une prise de parole → une vidéo prête à publier) ─────────────

const montageUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir(), filename: (_req, file, cb) => cb(null, `ivision-montage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${(file.originalname.match(/\.[a-z0-9]{2,5}$/i) || ['.mp4'])[0].toLowerCase()}`) }),
  limits: { fileSize: MONTAGE_LIMITS.maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^video\/(mp4|quicktime|webm|x-m4v|3gpp|x-matroska)$/.test(file.mimetype) || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(file.originalname)),
});

v1.get('/montages/status', (_req, res) => {
  res.json({ available: montages.available(), limits: MONTAGE_LIMITS });
});

/** Le prix pour une durée (lue par le navigateur) : affiché avant de lancer. */
v1.post(
  '/montages/quote',
  validate({ body: z.object({ durationSec: z.number().min(0).max(3600), creativity: z.string().optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const level = (CREATIVITY_LEVELS as readonly string[]).includes(String(req.body.creativity)) ? req.body.creativity : 'medium';
    res.json(montages.quote(req.body.durationSec, level));
  })
);

v1.get(
  '/montages',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const list = await montages.list(uid(req), typeof req.query.brandId === 'string' ? req.query.brandId : undefined);
    res.json({ montages: list.map((x) => montageView(x.brandId, x.montage)) });
  })
);

/** Création : la vidéo est sondée (durée → prix), le prix débité, puis le montage tourne en tâche de fond. */
v1.post(
  '/montages',
  montageUpload.single('file'),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'file_required', 'Ajoutez la vidéo où vous parlez.');
    let handedOver = false;
    try {
      if (!montages.available()) throw new HttpError(503, 'transcription_unavailable', 'Le montage est momentanément indisponible.');
      const body = req.body || {};
      const brand = await brands.getBrand(uid(req), String(body.brandId || ''));
      const level = (CREATIVITY_LEVELS as readonly string[]).includes(String(body.creativity)) ? body.creativity : 'medium';
      let info;
      try {
        info = await montages.inspect(file.path);
      } catch (error) {
        engineError(error);
      }
      const q = montages.quote(info.durationSec, level);
      let paid;
      try {
        paid = await charge(uid(req), q, `montage:${brand._id}`);
      } catch (error) {
        if (error instanceof PaymentRequired) {
          res.status(402).json(error.body);
          return;
        }
        throw error;
      }
      try {
        handedOver = true;
        const montage = await montages.create(
          uid(req),
          brand._id,
          {
            file: file.path,
            name: file.originalname,
            prompt: String(body.prompt || '').slice(0, 1200),
            format: body.format,
            creativity: level,
            cuts: (CUT_MODES as readonly string[]).includes(body.cuts) ? body.cuts : 'tight',
            music: body.music !== 'false',
          },
          paid.charged ? paid.cost : 0,
          (failed) => refundMontage(uid(req), failed)
        );
        res.status(202).json(montageView(brand._id, montage));
      } catch (error) {
        handedOver = false;
        await refund(uid(req), paid, 'Montage iVision refusé — crédits restitués');
        engineError(error);
      }
    } finally {
      if (!handedOver) fs.rmSync(file.path, { force: true });
    }
  })
);

async function montageOr404(req: AuthedRequest) {
  const found = await montages.get(uid(req), req.params.id);
  if (!found) throw new HttpError(404, 'montage_not_found', 'Montage introuvable.');
  return found;
}

v1.get(
  '/montages/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const found = await montageOr404(req);
    res.json(montageView(found.brandId, found.montage));
  })
);

/** Retouches gratuites : sous-titres, mots corrigés, éléments, carton final, musique, coupes, format. */
v1.patch(
  '/montages/:id',
  validate({
    body: z.object({
      title: z.string().max(80).optional(),
      captions: z.enum(CAPTION_STYLES as unknown as [string, ...string[]]).optional(),
      words: z.record(z.string(), z.string().max(60)).optional(),
      elements: z.array(z.record(z.string(), z.unknown())).max(80).optional(),
      outro: z.object({ text: z.string().max(80).optional(), detail: z.string().max(80).optional() }).nullable().optional(),
      music: z.boolean().optional(),
      cuts: z.enum(CUT_MODES as unknown as [string, ...string[]]).optional(),
      format: z.enum(['story', 'square', 'portrait', 'landscape']).optional(),
    }),
  }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const found = await montageOr404(req);
    try {
      const updated = await montages.update(uid(req), req.params.id, req.body);
      if (!updated) throw new HttpError(404, 'montage_not_found', 'Montage introuvable.');
      res.json(montageView(found.brandId, updated));
    } catch (error) {
      engineError(error);
    }
  })
);

v1.get(
  '/montages/:id/preview',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const html = await montages.previewHtml(uid(req), req.params.id);
    if (!html) throw new HttpError(404, 'montage_not_ready', 'Le montage n’est pas encore prêt.');
    res.json({ html });
  })
);

v1.post(
  '/montages/:id/export-quote',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const found = await montageOr404(req);
    res.json(montages.quoteExport(found.montage));
  })
);

/** Export MP4 : le premier est inclus, les suivants coûtent 10 % du montage. */
v1.post(
  '/montages/:id/export',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const found = await montageOr404(req);
    const { cost } = montages.quoteExport(found.montage);
    let paid;
    if (cost > 0) {
      try {
        paid = await charge(uid(req), { action: 'motion_video_rerender', cost }, found.montage.id);
      } catch (error) {
        if (error instanceof PaymentRequired) {
          res.status(402).json(error.body);
          return;
        }
        throw error;
      }
    }
    try {
      const started = await montages.startExport(uid(req), req.params.id, paid?.charged ? { cost: paid.cost, action: paid.action } : undefined);
      if (!started) throw new HttpError(404, 'montage_not_found', 'Montage introuvable.');
      res.status(202).json(montageView(found.brandId, started));
    } catch (error) {
      await refund(uid(req), paid, 'Export du montage refusé — crédits restitués');
      engineError(error);
    }
  })
);

v1.get(
  '/montages/:id/file',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const found = await montageOr404(req);
    const render = found.montage.renders.find((r) => r.status === 'done' && r.url);
    if (!render?.url) throw new HttpError(404, 'montage_not_rendered', 'Exportez d’abord le montage.');
    await sendAttachment(res, render.url, `ivision-montage-${req.params.id.slice(-6)}.mp4`, 'video/mp4');
  })
);

v1.delete(
  '/montages/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const removed = await montages.remove(uid(req), req.params.id);
    res.status(removed ? 204 : 404).end();
  })
);

// ─── Visuels ────────────────────────────────────────────────────────────────

v1.get(
  '/visuals',
  asyncRoute<AuthedRequest>(async (req, res) => res.json({ visuals: (await visuals.listVisuals(uid(req), typeof req.query.brandId === 'string' ? req.query.brandId : undefined)).map(visuals.visualView) }))
);

/**
 * Envoie un fichier du stockage en PIÈCE JOINTE : le navigateur l'enregistre au lieu de
 * l'ouvrir (un lien `download` vers une autre origine, MinIO, est ignoré par les navigateurs).
 * Seuls les fichiers de notre stockage passent (pas de relais vers une URL quelconque).
 */
async function sendAttachment(res: Response, url: string, fileName: string, contentType: string): Promise<void> {
  if (!url.startsWith(publicUrl(''))) throw new HttpError(404, 'file_not_found', 'Fichier introuvable.');
  const upstream = await axios.get(url, { responseType: 'stream', timeout: 60_000 });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^\w.-]+/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (upstream.headers['content-length']) res.setHeader('Content-Length', String(upstream.headers['content-length']));
  upstream.data.pipe(res);
}

v1.get(
  '/visuals/:id/file',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const v = await visuals.getVisual(uid(req), req.params.id);
    const ext = /\.png($|\?)/i.test(v.imageUrl) ? 'png' : 'jpg';
    await sendAttachment(res, v.imageUrl, `ivision-${v.format}-${String(v._id).slice(-6)}.${ext}`, ext === 'png' ? 'image/png' : 'image/jpeg');
  })
);

v1.get(
  '/brands/:brandId/videos/:videoId/file',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const video = await motionVideos.getVideo(uid(req), req.params.brandId, req.params.videoId);
    const render = video?.renders.find((r) => r.status === 'done' && r.url && (!req.query.format || r.format === req.query.format));
    if (!render?.url) throw new HttpError(404, 'video_not_found', 'Vidéo introuvable.');
    await sendAttachment(res, render.url, `ivision-${render.format}-${req.params.videoId.slice(-6)}.mp4`, 'video/mp4');
  })
);

/** Enregistre le HTML retouché dans l'éditeur (gratuit) ; l'image est re-rendue. */
v1.put(
  '/visuals/:id/html',
  validate({ body: z.object({ html: z.string().min(1).max(1_800_000) }) }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const v = await visuals.getVisual(uid(req), req.params.id);
    const brand = await brands.getBrand(uid(req), v.brandId);
    const updated = await visuals.updateVisualHtml(uid(req), brand, v._id, req.body.html);
    res.json({ ...visuals.visualView(updated), html: updated.html });
  })
);

v1.get(
  '/visuals/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    const v = await visuals.getVisual(uid(req), req.params.id);
    res.json({ ...visuals.visualView(v), html: v.html });
  })
);

v1.delete(
  '/visuals/:id',
  asyncRoute<AuthedRequest>(async (req, res) => {
    await visuals.deleteVisual(uid(req), req.params.id);
    res.status(204).end();
  })
);

/** Le barème d'une création, avant de lancer (affiché à côté du bouton). */
v1.post(
  '/quote',
  validate({ body: z.object({ mode, creativity: z.string().optional(), scope: z.unknown().optional() }) }),
  asyncRoute<AuthedRequest>(async (req, res) => {
    const level = (CREATIVITY_LEVELS as readonly string[]).includes(String(req.body.creativity)) ? req.body.creativity : 'medium';
    res.json(req.body.mode === 'video' ? quote.video(req.body.scope, level) : quote.visual(level));
  })
);
