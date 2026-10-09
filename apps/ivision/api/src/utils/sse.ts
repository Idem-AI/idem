/**
 * Flux d'événements (SSE) : la progression réelle d'un scan ou d'une création, envoyée dès
 * qu'elle a lieu. Un battement toutes les 15 s empêche les proxys de couper un flux silencieux.
 */
import { Request, Response } from 'express';

export interface SseStream {
  send: (payload: object) => void;
  end: () => void;
  isOpen: () => boolean;
}

export function openSse(req: Request, res: Response): SseStream {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  let open = true;
  req.on('close', () => (open = false));
  const heartbeat = setInterval(() => open && res.write(': ping\n\n'), 15_000);
  return {
    send: (payload) => {
      if (!open) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      (res as Response & { flush?: () => void }).flush?.();
    },
    end: () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    },
    isOpen: () => open,
  };
}
