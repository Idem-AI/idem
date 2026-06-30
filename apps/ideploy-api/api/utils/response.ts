import { Response } from 'express';

/** Standard success envelope (matches apps/api convention). */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

/** Standard error envelope. */
export function fail(res: Response, message: string, status = 500, code?: string): void {
  res.status(status).json({ success: false, error: { code: code ?? null, message } });
}
