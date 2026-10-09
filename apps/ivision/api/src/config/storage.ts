/**
 * Stockage d'objets : le MinIO d'IDEM (mêmes variables `MINIO_*`), sous le préfixe `ivision/`.
 * C'est le port `storage` du moteur partagé : médias importés, photos des sites scannés,
 * rendus MP4 et affiches.
 */
import { Readable } from 'stream';
import * as Minio from 'minio';
import type { CoreStorage, StoredFile } from '../../../core/src/runtime/host';
import logger from './logger';

let client: Minio.Client | null = null;
const bucket = () => process.env.MINIO_BUCKET_NAME || 'idem-storage';

function minio(): Minio.Client {
  if (client) return client;
  client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    region: process.env.MINIO_REGION || 'us-east-1',
  });
  return client;
}

export function publicUrl(objectName: string): string {
  const base = process.env.MINIO_PUBLIC_URL;
  if (base) return `${base.replace(/\/+$/, '')}/${bucket()}/${objectName}`;
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  return `${protocol}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}/${bucket()}/${objectName}`;
}

export const storage: CoreStorage = {
  async uploadFile(content: Buffer | string, fileName: string, folder: string, contentType = 'application/octet-stream'): Promise<StoredFile> {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    // Tout ce qu'iVision écrit vit sous `ivision/` : jamais dans l'arborescence des projets IDEM.
    const path = `${folder.startsWith('ivision/') ? folder : `ivision/${folder}`}/${fileName}`.replace(/\/{2,}/g, '/');
    await minio().putObject(bucket(), path, Readable.from(buffer), buffer.length, { 'Content-Type': contentType });
    const downloadURL = publicUrl(path);
    logger.info('storage.uploaded', { event: 'storage.uploaded', path, bytes: buffer.length, contentType });
    return { fileName, filePath: path, downloadURL };
  },
};
