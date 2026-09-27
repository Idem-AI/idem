import dns from 'dns/promises';
import net from 'net';
import type { HTTPRequest, Page } from 'puppeteer';
import logger from '../config/logger';

/**
 * Garde réseau des navigateurs de rendu (PDF, flyers, cartes, PSD).
 *
 * Le HTML rendu contient du contenu fourni par l'utilisateur ou produit par un
 * modèle : il ne doit pas pouvoir faire parler le serveur à son propre réseau
 * (bases, Redis, services internes, métadonnées du fournisseur cloud) ni lire
 * des fichiers locaux. Chaque requête du navigateur est donc filtrée :
 *
 *  - schémas autorisés : `http`, `https`, `data`, `blob`, `about` ;
 *  - hôtes explicitement autorisés (stockage d'objets, URL publique de l'API,
 *    `RENDER_ALLOWED_HOSTS`) : toujours acceptés, même sur un réseau privé ;
 *  - tout autre hôte : refusé s'il résout vers une adresse privée, de boucle
 *    locale, lien-local (dont 169.254.169.254) ou réservée.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'data:', 'blob:', 'about:']);

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(): Set<string> {
  const hosts = [
    hostOf(process.env.MINIO_PUBLIC_URL),
    hostOf(process.env.MINIO_ENDPOINT),
    hostOf(process.env.API_URL),
    ...(process.env.RENDER_ALLOWED_HOSTS || '').split(',').map((h) => hostOf(h.trim())),
  ].filter((h): h is string => !!h);
  return new Set(hosts);
}

/** Vrai pour toute adresse qui ne doit pas être joignable depuis un rendu. */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // lien-local, métadonnées cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

const verdictCache = new Map<string, { allowed: boolean; at: number }>();
const VERDICT_TTL_MS = 60_000;

/** Décide si une URL peut être chargée par un navigateur de rendu. */
export async function isRenderUrlAllowed(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (allowedHosts().has(host)) return true;

  const cached = verdictCache.get(host);
  if (cached && Date.now() - cached.at < VERDICT_TTL_MS) return cached.allowed;

  let allowed: boolean;
  if (net.isIP(host)) {
    allowed = !isPrivateAddress(host);
  } else {
    try {
      const addresses = await dns.lookup(host, { all: true });
      allowed = addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
    } catch {
      allowed = false;
    }
  }

  verdictCache.set(host, { allowed, at: Date.now() });
  return allowed;
}

/**
 * Installe le filtre sur une page. `extraFilter` permet à l'appelant d'ajouter
 * ses propres refus (types de ressources inutiles, par exemple) dans le même
 * gestionnaire — Puppeteer n'accepte qu'une décision par requête.
 */
export async function installRenderNetworkGuard(
  page: Page,
  extraFilter?: (req: HTTPRequest) => boolean
): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    void (async () => {
      if (req.isInterceptResolutionHandled()) return;
      const urlAllowed = await isRenderUrlAllowed(req.url());
      const wanted = extraFilter ? extraFilter(req) : true;
      if (req.isInterceptResolutionHandled()) return;

      if (urlAllowed && wanted) {
        await req.continue();
        return;
      }
      if (!urlAllowed) {
        logger.warn('Render request blocked by network guard', { url: req.url().slice(0, 200) });
      }
      await req.abort('blockedbyclient');
    })().catch((error: Error) => {
      logger.warn(`Render network guard error: ${error.message}`);
    });
  });
}

/** Arguments Chromium communs : jamais de `--disable-web-security`. */
export const RENDER_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--disable-default-apps',
];
