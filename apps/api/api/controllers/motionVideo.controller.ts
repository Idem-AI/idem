import { Response } from 'express';
import sharp from 'sharp';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import {
  MOTION_STYLES,
  MUSIC_MOODS,
  MotionStyle,
  MusicMood,
  VIDEO_OBJECTIVES,
  VideoFormat,
} from '../models/motionVideo.model';
import { CommunicationService } from '../services/Communication/communication.service';
import { MotionVideoService, VideoInputError } from '../services/Communication/video/motionVideo.service';
import { normalizeScope, pricingTable, videoCost } from '../services/Communication/video/video.pricing';
import { SCENES } from '../services/Communication/video/video.scenes';
import { TYPE_DEFS } from '../services/Communication/video/video.types';
import { DIRECTION_IDS } from '../services/Communication/video/video.direction';
import { CAPABILITIES } from '../services/Communication/video/video.capabilities';
import { MediaInputError } from '../services/Communication/video/video.media';
import { resolvePublicSound } from '../services/Communication/video/video.sfx';
import { VIDEO_TYPES, VideoType } from '../models/motionVideo.model';
import { PromptService } from '../services/prompt.service';
import { StorageService } from '../services/storage.service';
import { getRequestLanguage } from '../utils/request-language';
import { refundRequestCredits } from '../middleware/billing.middleware';

const communicationService = new CommunicationService(new PromptService());
export const motionVideoService = new MotionVideoService(communicationService);
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
    const status = error.message === 'project_not_found' ? 404 : error.message === 'already_rendering' ? 409 : 400;
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

/** GET /project/communication/:projectId/videos/options */
export const videoOptionsController = async (_req: CustomRequest, res: Response): Promise<void> => {
  res.json({
    pricing: pricingTable(),
    objectives: VIDEO_OBJECTIVES,
    moods: MUSIC_MOODS,
    styles: ['auto', ...MOTION_STYLES],
    directions: ['auto', ...DIRECTION_IDS],
    // Les choix du kit (graphe de capacités) : la vidéo dit lesquels sont possibles pour elle.
    kit: Object.fromEntries(
      (['logo', 'background', 'annotate', 'icons'] as const).map((kind) => [kind, CAPABILITIES.filter((n) => n.kind === kind).map((n) => ({ id: n.id.split(':')[1], label: n.label }))])
    ),
    // Les types de motion proposés à la création, avec ce dont ils ont besoin.
    types: VIDEO_TYPES.map((id) => ({ id, icon: TYPE_DEFS[id].icon, style: TYPE_DEFS[id].style, needs: TYPE_DEFS[id].needs, durations: TYPE_DEFS[id].durations })),
    // Les cases de chaque scène et leur longueur maximale : l'éditeur de textes les borne.
    scenes: Object.fromEntries(
      Object.values(SCENES).map((scene) => [scene.id, scene.slots.map(({ key, max, required }) => ({ key, max, required: !!required }))])
    ),
  });
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
      { brief: req.body?.brief, scope, type: videoTypeOf(req.body?.type), contentId: typeof req.body?.contentId === 'string' ? req.body.contentId.slice(0, 120) : undefined, language: getRequestLanguage() },
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

/** Seuls les champs du kit, en texte court (la validation réelle est celle du graphe). */
function pickKit(raw: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const k of ['logo', 'background', 'annotate', 'iconSet']) if (typeof raw[k] === 'string' && (raw[k] as string).length < 40) out[k] = raw[k] as string;
  return out;
}

/** PATCH /project/communication/:projectId/videos/:videoId — retouches gratuites. */
export const updateVideoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const id = ids(req, res);
  if (!id) return;
  const body = req.body || {};
  try {
    const video = await motionVideoService.updateVideo(id.userId, id.projectId, req.params.videoId as string, {
      slots: body.slots && typeof body.slots === 'object' ? body.slots : undefined,
      style: MOTION_STYLES.includes(body.style) ? (body.style as MotionStyle) : undefined,
      musicMood: MUSIC_MOODS.includes(body.musicMood) ? (body.musicMood as MusicMood) : undefined,
      musicTrackId: typeof body.musicTrackId === 'string' ? body.musicTrackId : undefined,
      scope: body.scope,
      sfx: typeof body.sfx === 'boolean' ? body.sfx : undefined,
      direction: typeof body.direction === 'string' ? body.direction : undefined,
      kit: body.kit && typeof body.kit === 'object' ? pickKit(body.kit) : undefined,
    });
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json(video);
  } catch (error) {
    fail(res, error, 'updateVideoController');
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
    res.json(await motionVideoService.musicOptions(mood, video.storyboard.style, video.brief.objective, video.scope.durationSec));
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
 * Photos, clips vidéo, modèles 3D (GLB) et animations Lottie (JSON).
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
      { brief: req.body?.brief, scope, type: videoTypeOf(req.body?.type), contentId: typeof req.body?.contentId === 'string' ? req.body.contentId.slice(0, 120) : undefined, language: getRequestLanguage() },
      paid,
      (event) => send({ type: 'progress', ...event })
    );
    send({ type: 'complete', video });
  } catch (error: any) {
    logger.error(`createVideoStreamController: ${error?.message}`, { stack: error?.stack });
    await refundRequestCredits(req, 'Création de vidéo en échec — crédits restitués').catch(() => undefined);
    send({ type: 'error', error: error instanceof VideoInputError ? error.message : 'video_failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
};
