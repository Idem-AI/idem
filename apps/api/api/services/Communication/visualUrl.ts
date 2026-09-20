/**
 * URL capacitaire d'un visuel rendu.
 *
 * ── Le problème ───────────────────────────────────────────────────────────────
 * L'endpoint de rendu (`GET …/flyer/:id/image`) n'est pas authentifié, et il ne
 * peut pas l'être : une balise `<img src>` ne porte pas d'en-tête `Authorization`.
 * Or son chemin était DEVINABLE — `flyer-<slug produit par le modèle>-<format>-
 * <timestamp base36>` — donc les visuels d'un projet dont on connaissait l'id
 * étaient énumérables par un tiers.
 *
 * ── La réponse ────────────────────────────────────────────────────────────────
 * Un jeton HMAC, dérivé du secret du serveur et du couple (projet, visuel). Le
 * chemin reste public, mais il devient imprévisible : c'est une URL capacitaire,
 * du même ordre qu'une clé d'objet aléatoire dans un bucket.
 *
 * ── Pourquoi PAS d'expiration ─────────────────────────────────────────────────
 * Un jeton qui expire casse toute URL déjà recopiée — un visuel collé dans un
 * brouillon de post, un aperçu en cache, un onglet resté ouvert — pour un gain
 * nul : le visuel finira de toute façon publié publiquement par l'utilisateur.
 * Ce qu'on ferme ici, c'est l'ÉNUMÉRATION, pas la durée de vie.
 *
 * ── Compatibilité ─────────────────────────────────────────────────────────────
 * Les visuels déjà en base portent une `imageUrl` sans jeton. Elle n'est plus
 * jamais servie telle quelle : toutes les lectures la réécrivent (cf.
 * `signVisualUrl`), si bien qu'aucun visuel existant ne se casse.
 */
import crypto from 'crypto';
import logger from '../../config/logger';

/**
 * Secret de signature.
 *
 * `JWT_SECRET` est déjà exigé par l'API pour d'autres usages ; s'en servir évite
 * une variable d'environnement de plus à provisionner. En son absence on tire un
 * secret de processus : les URLs ne survivent alors pas à un redémarrage, ce qui
 * est bruyant en développement et le bon signal pour ne pas déployer comme ça.
 */
const SIGNING_SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.API_SIGNING_SECRET;
  if (secret) return secret;
  logger.warn(
    '[Communication] Aucun JWT_SECRET : les URLs de visuels sont signées avec un secret de processus et changeront au redémarrage.'
  );
  return crypto.randomBytes(32).toString('hex');
})();

/** Jeton d'un visuel : 16 hexadécimaux, soit 64 bits — non énumérable. */
export function visualImageToken(projectId: string, visualId: string): string {
  return crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`visual-image:${projectId}:${visualId}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Comparaison à temps constant.
 *
 * `===` sur un jeton fuit sa longueur de préfixe commun ; c'est théorique sur un
 * HMAC de 64 bits derrière un réseau, mais la version correcte ne coûte rien.
 */
export function verifyVisualImageToken(
  projectId: string,
  visualId: string,
  token: string | undefined
): boolean {
  if (!token) return false;
  const expected = visualImageToken(projectId, visualId);
  const given = Buffer.from(token);
  const want = Buffer.from(expected);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

/** Base publique de l'API, telle que le front la joindra. */
export function apiBaseUrl(): string {
  const port = process.env.PORT || '3001';
  return process.env.API_URL || `http://localhost:${port}`;
}

/** L'URL de rendu signée d'un visuel. Seule forme servie au client. */
export function signedVisualImageUrl(projectId: string, visualId: string): string {
  const token = visualImageToken(projectId, visualId);
  return `${apiBaseUrl()}/project/communication/${projectId}/flyer/${visualId}/image?t=${token}`;
}
