import { Response } from 'express';

/** En deçà des coupures des proxys (Cloudflare : 100 s, nginx : 60 s par défaut). */
const HEARTBEAT_MS = 15_000;

/**
 * Garde un flux SSE ouvert pendant les longs silences d'une génération (une
 * seule réponse de modèle peut durer plusieurs minutes).
 *
 * Sans battement, le proxy coupait le flux en pleine génération : l'écran
 * restait figé, et l'ancien client se reconnectait en relançant tout depuis le
 * début. Le battement est un commentaire SSE (`: ping`), ignoré par le client.
 *
 * @returns la fonction qui arrête le battement — à appeler avant `res.end()`.
 */
export function startSseHeartbeat(res: Response): () => void {
  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    res.write(': ping\n\n');
    (res as any).flush?.();
  }, HEARTBEAT_MS);
  const stop = () => clearInterval(timer);
  res.on('close', stop);
  res.on('finish', stop);
  return stop;
}
