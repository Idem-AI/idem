import crypto from 'crypto';

/**
 * Comparaison de secrets à temps constant.
 *
 * Les deux valeurs sont hachées avant `timingSafeEqual` : les condensats ont
 * toujours la même longueur, ce qui évite à la fois l'exception sur longueurs
 * différentes et la fuite de la longueur du secret attendu.
 */
export function safeEqual(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
