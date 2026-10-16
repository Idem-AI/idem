import RedisConnection from '../../config/redis.config';

const fallback = new Map<string, { count: number; resetAt: number }>();

/**
 * Compte une occurrence et dit si la limite est dépassée (fenêtre fixe).
 * Redis quand il répond, sinon une table locale : une panne de Redis ne doit pas ouvrir les vannes.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const redis = RedisConnection.getInstance();
    const redisKey = `whatsapp:rate:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.pexpire(redisKey, windowMs);
    return count > limit;
  } catch {
    const now = Date.now();
    const entry = fallback.get(key);
    if (!entry || entry.resetAt <= now) {
      fallback.set(key, { count: 1, resetAt: now + windowMs });
      return 1 > limit;
    }
    entry.count += 1;
    return entry.count > limit;
  }
}
