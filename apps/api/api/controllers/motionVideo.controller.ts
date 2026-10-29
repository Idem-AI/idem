import { journeyService } from '../services/journey/journey.service';
import { normalizeCreativity } from '../models/creativity.model';
import { Response } from 'express';
import sharp from 'sharp';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { MotionStyle, MUSIC_MOODS, MusicMood, VideoFormat } from '../models/motionVideo.model';
import { CommunicationService } from '../services/Communication/communication.service';
import { CreateVideoInput, MotionVideoService, sanitizeVideoPatch, VideoInputError } from '../../../ivision/core/src/video/motionVideo.service';
import { MOTION_LANGUAGES, MotionLanguage, PRODUCTION_MODES, ProductionMode, VIDEO_GOALS, VideoGoal } from '../../../ivision/core/src/video/request/intent';
import { normalizeScope, videoCost } from '../../../ivision/core/src/video/pricing';
import { videoOptions } from '../../../ivision/core/src/video/options';
import { MediaInputError } from '../../../ivision/core/src/video/assets/media';
import { resolvePublicSound } from '../../../ivision/core/src/video/audio/sfx';
import { VIDEO_TYPES, VideoType } from '../models/motionVideo.model';
import { PromptService } from '../services/prompt.service';
import '../services/ivision/host';
import { IdemVideoStore } from '../services/Communication/video/idemVideoStore';
import { StorageService } from '../services/storage.service';
import { getRequestLanguage } from '../utils/request-language';
import { refundRequestCredits } from '../middleware/billing.middleware';

const communicationService = new CommunicationService(new PromptService());
// Le service vidéo est celui du moteur partagé iVision ; IDEM lui donne ses projets.
export const motionVideoService = new MotionVideoService(new IdemVideoStore(communicationService));
const storage = new StorageService();

function ids(req: CustomRequest, res: Response): { userId: string; projectId: string } | null {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  if (!projectId) {
    res.status(400).json({ message: 'projectId is required' });
    return null;
  }
  return { userId, projectId };
}

function fail(res: Response, error: any, label: string): void {
  if (error instanceof MediaInputError) {
    res.status(400).json({ error: error.message, message: error.message });
    return;
  }
  if (error instanceof VideoInputError) {
    const status = error.message === 'project_not_found' ? 404 : error.message === 'already_rendering' || error.message === 'scene_errors' || error.message === 'legacy_video' ? 409 : error.message === 'model_unavailable' ? 503 : 400;
    res.status(status).json({ error: error.message, message: error.message });
    return;
  }
  logger.error(`${label}: ${error?.message}`, { stack: error?.stack });
  res.status(500).json({ message: 'Video generation failed' });
}

/** POST /project/communication/:projectId/videos/enhance — « Améliorer ma demande » (gratuit). */
export const enhanceVideoRequestController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const media = Array.isArray(req.body?.media) ? req.body.media.slice(0, 8) : [];
    res.json(await motionVideoService.enhanceRequest(id.userId, id.projectId, String(req.body?.text || ''), media));
  } catch (error) {
    fail(res, error, 'enhanceVideoRequestController');
  }
};

/** Type demandé : un des types, ou « auto » (le modèle choisit). */
const videoTypeOf = (raw: unknown): VideoType | 'auto' | undefined => (raw === 'auto' ? 'auto' : VIDEO_TYPES.includes(raw as VideoType) ? (raw as VideoType) : undefined);

/** L'interprétation revue par l'utilisateur : seules les valeurs admises passent (le reste est ignoré). */
function intentOf(raw: unknown): CreateVideoInput['intent'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const list = <T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined => {
    const out = (Array.isArray(value) ? value : []).filter((v): v is T => allowed.includes(v as T)).slice(0, 3);
    return out.length ? out : undefined;
  };
  const yna = (v: unknown): 'yes' | 'no' | undefined => (v === 'yes' || v === 'no' ? v : undefined);
  const intent = {
    objective: VIDEO_GOALS.includes(o.objective as VideoGoal) ? (o.objective as VideoGoal) : undefined,
    productionModes: list<ProductionMode>(o.productionModes, PRODUCTION_MODES),
    motionDirection: list<MotionLanguage>(o.motionDirection, MOTION_LANGUAGES),
    subtitles: yna(o.subtitles),
    voiceover: yna(o.voiceover),
    music: yna(o.music),
  };
  return Object.values(intent).some((v) => v !== undefined) ? intent : undefined;
}

const clarificationOf = (raw: unknown): CreateVideoInput['clarification'] => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  return o && typeof o.id === 'string' && typeof o.option === 'string' ? { id: o.id.slice(0, 40), option: o.option.slice(0, 40) } : undefined;
};

/** Une démo produit à filmer : un lien http(s) (la garde réseau du moteur refuse les adresses privées). */
const demoOf = (raw: unknown): CreateVideoInput['demo'] => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!o || typeof o.url !== 'string' || !o.url.trim()) return undefined;
  return { url: o.url.trim().slice(0, 500), ...(typeof o.goal === 'string' && o.goal.trim() ? { goal: o.goal.trim().slice(0, 600) } : {}), ...(o.device === 'mobile' ? { device: 'mobile' as const } : {}) };
};

/**
 * POST /project/communication/:projectId/videos/interpret — l'interprétation d'une demande AVANT la création
 * (gratuite) : objectif, matière, langage de motion, et la question à poser si une décision manque.
 */
export const interpretVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    res.json(await motionVideoService.interpretVideo(id.userId, id.projectId, { brief: req.body?.brief ?? {}, type: videoTypeOf(req.body?.type), language: getRequestLanguage(), creativity: normalizeCreativity(req.body?.creativity) }));
  } catch (error) {
    fail(res, error, 'interpretVideoController');
  }
};

/** GET /project/communication/:projectId/videos/options — la même description qu'iVision (moteur partagé). */
export const videoOptionsController = async (_req: CustomRequest, res: Response): Promise<void> => {
  res.json(videoOptions());
};

/** GET /project/communication/:projectId/videos */
export const listVideosController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    res.json(await motionVideoService.listVideos(id.userId, id.projectId));
  } catch (error) {
    fail(res, error, 'listVideosController');
  }
};

/** POST /project/communication/:projectId/videos */
export const createVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const scope = normalizeScope(req.body?.scope);
    const paid = req.billing?.charged ? req.billing.cost : videoCost(scope);
    const video = await motionVideoService.createVideo(
      id.userId,
      id.projectId,
      { brief: req.body?.brief, scope, type: videoTypeOf(req.body?.type), contentId: typeof req.body?.contentId === 'string' ? req.body.contentId.slice(0, 120) : undefined, language: getRequestLanguage(), creativity: normalizeCreativity(req.body?.creativity), intent: intentOf(req.body?.intent), clarification: clarificationOf(req.body?.clarification), demo: demoOf(req.body?.demo) },
      paid
    );
    res.status(201).json(video);
  } catch (error) {
    fail(res, error, 'createVideoController');
  }
};

/** GET /project/communication/:projectId/videos/:videoId */
export const getVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const video = await motionVideoService.getVideo(id.userId, id.projectId, req.params.videoId as string);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json(video);
  } catch (error) {
    fail(res, error, 'getVideoController');
  }
};

/**
 * PATCH /project/communication/:projectId/videos/:videoId — retouches gratuites : textes et photos (données),
 * musique, effets, voix, sous-titres, et nouvelles versions du code d'une scène (`visual`, `fix`, `regenerate`).
 */
export const updateVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const video = await motionVideoService.updateVideo(id.userId, id.projectId, req.params.videoId as string, sanitizeVideoPatch(req.body));
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json(video);
  } catch (error) {
    fail(res, error, 'updateVideoController');
  }
};

/** POST /project/communication/:projectId/videos/:videoId/revise — une retouche écrite en clair (gratuite). */
export const reviseVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  const text = String(req.body?.text || '').trim().slice(0, 2000);
  if (text.length < 2) {
    res.status(400).json({ error: 'message_required', message: 'message_required' });
    return;
  }
  try {
    const result = await motionVideoService.reviseFromText(id.userId, id.projectId, req.params.videoId as string, text, getRequestLanguage() || 'fr');
    if (!result.video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    fail(res, error, 'reviseVideoController');
  }
};

/** GET /project/communication/:projectId/videos/:videoId/preview?format= */
export const previewVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const html = await motionVideoService.previewHtml(
      id.userId,
      id.projectId,
      req.params.videoId as string,
      req.query.format as VideoFormat | undefined
    );
    if (!html) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ html });
  } catch (error) {
    fail(res, error, 'previewVideoController');
  }
};

/** GET /project/communication/:projectId/videos/:videoId/music?mood= */
export const videoMusicController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const video = await motionVideoService.getVideo(id.userId, id.projectId, req.params.videoId as string);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    const mood = MUSIC_MOODS.includes(req.query.mood as MusicMood) ? (req.query.mood as MusicMood) : video.brief.musicMood;
    const style = (video.brief.style && video.brief.style !== 'auto' ? video.brief.style : 'energetic') as MotionStyle;
    res.json(await motionVideoService.musicOptions(mood, style, video.brief.objective, video.scope.durationSec));
  } catch (error) {
    fail(res, error, 'videoMusicController');
  }
};

/** POST /project/communication/:projectId/videos/:videoId/export */
export const exportVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const charge = req.billing?.charged ? { cost: req.billing.cost, action: req.billing.action } : undefined;
    const video = await motionVideoService.startExport(id.userId, id.projectId, req.params.videoId as string, req.body?.scope, charge);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.status(202).json(video);
  } catch (error) {
    fail(res, error, 'exportVideoController');
  }
};

/** DELETE /project/communication/:projectId/videos/:videoId */
export const deleteVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  try {
    const removed = await motionVideoService.deleteVideo(id.userId, id.projectId, req.params.videoId as string);
    res.status(removed ? 204 : 404).end();
  } catch (error) {
    fail(res, error, 'deleteVideoController');
  }
};

/**
 * POST /project/communication/:projectId/videos/photos (multipart, champ `photos`)
 * Les photos du commerce (produit, équipe, local) : la meilleure matière d'une vidéo.
 */
export const uploadVideoPhotosController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  const files = ((req as any).files as Express.Multer.File[] | undefined) || [];
  if (!files.length) {
    res.status(400).json({ message: 'photos are required' });
    return;
  }
  try {
    const folder = `users/${id.userId}/projects/${id.projectId}/videos/photos`;
    const urls = await Promise.all(
      files.map(async (file, i) => {
        const jpeg = await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
        const uploaded = await storage.uploadFile(jpeg, `photo-${Date.now().toString(36)}-${i}.jpg`, folder, 'image/jpeg');
        return uploaded.downloadURL;
      })
    );
    res.status(201).json({ urls });
  } catch (error) {
    fail(res, error, 'uploadVideoPhotosController');
  }
};

/**
 * POST /project/communication/:projectId/videos/media (multipart, champ `files`)
 * Photos et clips vidéo (le moteur Motion Canvas ne lit ni 3D, ni Lottie, ni Rive).
 */
export const uploadVideoMediaController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  const files = ((req as any).files as Express.Multer.File[] | undefined) || [];
  if (!files.length) {
    res.status(400).json({ message: 'files are required' });
    return;
  }
  try {
    const assets = [];
    for (const file of files) assets.push(await motionVideoService.uploadMedia(id.userId, id.projectId, file));
    res.status(201).json({ assets });
  } catch (error) {
    fail(res, error, 'uploadVideoMediaController');
  }
};

/** GET /project/communication/sfx/:name — sons CC0 traités, pour l'aperçu (sans authentification). */
export const sfxFileController = async (req: CustomRequest, res: Response): Promise<void> => {
  const file = resolvePublicSound(String(req.params.name || ''));
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
};

/**
 * POST /project/communication/:projectId/videos/stream — création en flux (SSE).
 *
 * Même création que `POST …/videos`, mais chaque étape réelle est envoyée dès
 * qu'elle a lieu (scènes prévues, textes écrits, médias trouvés, piste choisie,
 * effets, montage) : l'utilisateur suit la fabrication en direct.
 * Le code HTTP est déjà parti quand une erreur survient : les crédits sont
 * restitués ici, explicitement.
 */
export const createVideoStreamController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  let open = true;
  req.on('close', () => (open = false));
  const send = (payload: object) => {
    if (!open) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    (res as any).flush?.();
  };
  // Un battement toutes les 15 s : les proxys ne coupent pas un flux silencieux.
  const heartbeat = setInterval(() => open && res.write(': ping\n\n'), 15000);
  try {
    const scope = normalizeScope(req.body?.scope);
    const paid = req.billing?.charged ? req.billing.cost : videoCost(scope);
    const video = await motionVideoService.createVideo(
      id.userId,
      id.projectId,
      { brief: req.body?.brief, scope, type: videoTypeOf(req.body?.type), contentId: typeof req.body?.contentId === 'string' ? req.body.contentId.slice(0, 120) : undefined, language: getRequestLanguage(), creativity: normalizeCreativity(req.body?.creativity), intent: intentOf(req.body?.intent), clarification: clarificationOf(req.body?.clarification), demo: demoOf(req.body?.demo) },
      paid,
      (event) => send({ type: 'progress', ...event })
    );
    send({ type: 'complete', video });
    journeyService.signal(id.userId, 'video.created', id.projectId);
  } catch (error: any) {
    logger.error(`createVideoStreamController: ${error?.message}`, { stack: error?.stack });
    await refundRequestCredits(req, 'Création de vidéo en échec — crédits restitués').catch(() => undefined);
    send({ type: 'error', error: error instanceof VideoInputError ? error.message : 'video_failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
};
