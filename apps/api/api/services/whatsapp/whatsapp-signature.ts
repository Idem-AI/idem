import crypto from 'crypto';

/**
 * Authenticité d'un webhook WhatsApp.
 *
 * Meta signe le corps EXACT de chaque appel (`X-Hub-Signature-256: sha256=<hmac>`, clé = secret de
 * l'application). Sans cette vérification, n'importe qui pourrait poster un faux « oui » sur notre
 * URL publique et faire publier. Comparaison à temps constant ; un en-tête absent, mal formé ou un
 * secret non configuré = refus (jamais d'« ouvert par défaut »).
 */
export function verifyWebhookSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string | undefined): boolean {
  if (!rawBody || !header || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(match[1], 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Vérification de l'abonnement au webhook (GET) : le jeton doit être le nôtre. */
export function verifySubscription(query: Record<string, unknown>, verifyToken: string | undefined): string | null {
  if (!verifyToken) return null;
  const mode = String(query['hub.mode'] ?? '');
  const token = String(query['hub.verify_token'] ?? '');
  const challenge = String(query['hub.challenge'] ?? '');
  if (mode !== 'subscribe' || !challenge || token.length !== verifyToken.length) return null;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken)) ? challenge : null;
}
