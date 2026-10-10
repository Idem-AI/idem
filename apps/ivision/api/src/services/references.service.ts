/**
 * Les MODÈLES : une vidéo (ou une image) que l'utilisateur veut voir reproduite.
 *
 * Le fichier est gardé (aperçu dans la conversation), puis analysé une fois en tâche de fond
 * (`core/src/reference`) : coupes, plans, planches, puis lecture par la vision dans le
 * vocabulaire du moteur. Le plan de reproduction est ensuite réutilisé par chaque génération
 * qui cite ce modèle. L'analyse est incluse (aucun crédit) mais bornée par utilisateur.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeReferenceImage, analyzeReferenceVideo, ReferenceBlueprint } from '../../../core/src/reference/reference.analyzer';
import { collection } from '../config/db';
import logger from '../config/logger';
import { storage } from '../config/storage';
import { HttpError } from '../middleware/error';
import type { IvisionReference, StoredBlueprint } from '../models';
import { idem } from './idem.client';

const references = () => collection<IvisionReference>('references');
const now = () => new Date().toISOString();

const VIDEO_TYPES = /^video\/(mp4|quicktime|webm|x-m4v)$/;
const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;
/** Analyses par utilisateur et par jour (chacune appelle la vision une fois par plan). */
const DAILY_LIMIT = Number(process.env.IVISION_REFERENCE_DAILY_LIMIT) || 20;

export function isReferenceType(mimeType: string): boolean {
  return VIDEO_TYPES.test(mimeType) || IMAGE_TYPES.test(mimeType);
}

const toStored = (bp: ReferenceBlueprint): StoredBlueprint => ({
  ...bp,
  shots: bp.shots.map(({ sheet, ...shot }) => ({ ...shot, ...(sheet ? { sheetB64: sheet.toString('base64') } : {}) })),
});

/** Le plan de reproduction tel que le moteur l'attend (planches en `Buffer`). */
export function blueprintOf(ref: IvisionReference): (ReferenceBlueprint & { id: string }) | null {
  if (!ref.blueprint) return null;
  return {
    ...ref.blueprint,
    id: ref._id,
    shots: ref.blueprint.shots.map(({ sheetB64, ...shot }) => ({ ...shot, ...(sheetB64 ? { sheet: Buffer.from(sheetB64, 'base64') } : {}) })),
  };
}

export async function createReference(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<IvisionReference> {
  if (!isReferenceType(file.mimetype)) throw new HttpError(415, 'unsupported_reference', 'Ajoutez une vidéo (MP4, MOV, WebM) ou une image (JPEG, PNG, WebP).');
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  if ((await references().countDocuments({ userId, createdAt: { $gte: since } })) >= DAILY_LIMIT) {
    throw new HttpError(429, 'reference_limit', 'Vous avez atteint le nombre de modèles analysés aujourd’hui. Réessayez demain.');
  }
  const kind = VIDEO_TYPES.test(file.mimetype) ? 'video' : 'image';
  const id = `ref_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
  const ext = (path.extname(file.originalname || '').toLowerCase() || (kind === 'video' ? '.mp4' : '.jpg')).replace(/[^.a-z0-9]/g, '');
  const stored = await storage.uploadFile(file.buffer, `${id}${ext}`, `users/${userId}/references`, file.mimetype);
  const doc: IvisionReference = {
    _id: id,
    userId,
    kind,
    name: (file.originalname || `modele${ext}`).slice(0, 120),
    url: stored.downloadURL,
    mimeType: file.mimetype,
    status: 'analyzing',
    progress: { step: 'probe' },
    createdAt: now(),
    updatedAt: now(),
  };
  await references().insertOne(doc);
  // L'analyse tourne en tâche de fond : la conversation affiche sa progression.
  void analyze(doc, file.buffer).catch(() => undefined);
  return doc;
}

async function analyze(doc: IvisionReference, buffer: Buffer): Promise<void> {
  const vision = (base64: string, mimeType: string, instruction: string) =>
    idem.ai.vision({ userId: doc.userId, base64, mimeType, instruction, options: { maxOutputTokens: 1500, temperature: 0.2, purpose: 'reference' } });
  const set = (patch: Partial<IvisionReference>) => references().updateOne({ _id: doc._id }, { $set: { ...patch, updatedAt: now() } });
  const started = Date.now();
  try {
    if (doc.kind === 'image') {
      const image = await analyzeReferenceImage(buffer, doc.mimeType, vision);
      await set({ status: 'ready', image, progress: { step: 'done' } });
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-upload-'));
      const file = path.join(dir, `source${path.extname(doc.name) || '.mp4'}`);
      fs.writeFileSync(file, buffer);
      try {
        let shots = 0;
        const blueprint = await analyzeReferenceVideo(file, {
          vision,
          maxShots: 12,
          onProgress: (step, data) => {
            if (typeof data?.shots === 'number') shots = data.shots;
            void set({ progress: { step, ...(typeof data?.done === 'number' ? { done: data.done } : {}), ...(shots ? { total: shots } : {}) } });
          },
        });
        await set({ status: 'ready', blueprint: toStored(blueprint), meta: { duration: blueprint.duration, orientation: blueprint.orientation, shots: blueprint.shots.length }, progress: { step: 'done' } });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    logger.info('reference.analyzed', { event: 'reference.analyzed', referenceId: doc._id, kind: doc.kind, ms: Date.now() - started });
  } catch (error) {
    logger.warn('reference.analysis_failed', { event: 'reference.analysis_failed', referenceId: doc._id, error });
    const message = (error as Error).message === 'reference_too_short' ? 'La vidéo est trop courte (au moins une seconde).' : 'Ce modèle n’a pas pu être analysé. Essayez un autre fichier.';
    await set({ status: 'failed', error: message });
  }
}

export async function getReference(userId: string, id: string): Promise<IvisionReference> {
  const ref = await references().findOne({ _id: id, userId });
  if (!ref) throw new HttpError(404, 'reference_not_found', 'Modèle introuvable.');
  return ref;
}

export async function listReferences(userId: string): Promise<IvisionReference[]> {
  return references().find({ userId }, { projection: { 'blueprint.shots.sheetB64': 0 } }).sort({ createdAt: -1 }).limit(50).toArray();
}

/** Une planche de plan (JPEG), pour l'aperçu du modèle dans la conversation. */
export async function referenceSheet(userId: string, id: string, index: number): Promise<Buffer | null> {
  const ref = await getReference(userId, id);
  const b64 = ref.blueprint?.shots[index]?.sheetB64;
  return b64 ? Buffer.from(b64, 'base64') : null;
}

/** Ce que l'interface affiche d'un modèle (sans les planches). */
export function referenceView(ref: IvisionReference) {
  return {
    id: ref._id,
    kind: ref.kind,
    name: ref.name,
    url: ref.url,
    mimeType: ref.mimeType,
    status: ref.status,
    progress: ref.progress,
    error: ref.error,
    meta: ref.meta,
    summary: ref.blueprint?.summary || ref.image?.description,
    shots: ref.blueprint?.shots.map((s) => ({ index: s.index, start: s.start, duration: s.duration, role: s.role, layout: s.layout, media: s.media, textMotion: s.textMotion, transitionIn: s.transitionIn, hasSheet: !!s.sheetB64 })),
    image: ref.image ? { layout: ref.image.layout, structure: ref.image.structure, hasPhoto: ref.image.hasPhoto } : undefined,
    createdAt: ref.createdAt,
  };
}
