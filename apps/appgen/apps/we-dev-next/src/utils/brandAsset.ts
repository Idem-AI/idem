/**
 * Récupère un fichier de la marque (logo) depuis le stockage IDEM, côté serveur.
 *
 * Le site généré pointait l'adresse du logo dans le bucket. Trois façons d'échouer :
 * en développement le bucket est en `http://` et l'aperçu, servi en HTTPS, bloque
 * l'image ; une adresse signée expire ; et le site publié dépend d'un stockage
 * qu'il ne contrôle pas. Le logo est donc DÉPOSÉ dans le projet, comme n'importe
 * quel fichier du site.
 *
 * Seuls les hôtes du stockage IDEM sont interrogés : sans cette liste, la route
 * deviendrait un relais vers n'importe quelle adresse interne.
 */

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;

const IMAGE_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

function storageHosts(): string[] {
  const hosts = (process.env.ASSET_INLINE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of [process.env.MINIO_PUBLIC_URL, process.env.ASSET_BASE_URL]) {
    if (!candidate) continue;
    try {
      hosts.push(new URL(candidate).host.toLowerCase());
    } catch {
      // Valeur d'environnement mal formée : ignorée plutôt que bloquante.
    }
  }

  return Array.from(new Set([...hosts, 'localhost:9000', '127.0.0.1:9000']));
}

export interface BrandAsset {
  contentType: string;
  /** Contenu texte pour un SVG, base64 sinon. */
  text?: string;
  base64?: string;
}

export async function fetchBrandAsset(url: string): Promise<BrandAsset | null> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(target.protocol)) return null;
  if (!storageHosts().includes(target.host.toLowerCase())) return null;

  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;

    const declared = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) return null;

    // Un SVG servi en `application/octet-stream` reste un SVG : on regarde le contenu.
    const head = buffer.subarray(0, 256).toString('utf8').trimStart();
    const isSvg = declared === 'image/svg+xml' || head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));

    if (isSvg) {
      return { contentType: 'image/svg+xml', text: buffer.toString('utf8') };
    }

    if (!IMAGE_TYPES.includes(declared)) return null;
    return { contentType: declared, base64: buffer.toString('base64') };
  } catch {
    return null;
  }
}
