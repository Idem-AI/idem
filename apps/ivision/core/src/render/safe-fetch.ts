/**
 * Téléchargement SÛR d'une ressource désignée par un tiers (logo et photos d'un site scanné,
 * lien collé par l'utilisateur) : le serveur ne doit jamais devenir un relais vers son propre
 * réseau (SSRF).
 *
 *   - http(s) seulement, 3 redirections au plus, chacune revérifiée ;
 *   - l'adresse est contrôlée AU MOMENT DE LA CONNEXION (résolveur de l'agent HTTP) : un nom
 *     qui résout vers une adresse privée est refusé, même s'il a changé depuis une première
 *     vérification (« DNS rebinding ») ;
 *   - taille et durée bornées, type de contenu attendu.
 *
 * Les hôtes autorisés de la garde de rendu (stockage, API, `RENDER_ALLOWED_HOSTS`) passent.
 */
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import { allowedHosts, isPrivateAddress, resolveHost } from './network-guard';

export class SafeFetchError extends Error {
  constructor(
    readonly code: 'invalid_url' | 'blocked' | 'too_large' | 'bad_type' | 'http_error' | 'timeout',
    message: string
  ) {
    super(message);
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  const decide = (list: dns.LookupAddress[]) => {
    if (!allowedHosts().has(hostname.toLowerCase()) && (!list.length || list.some((a) => isPrivateAddress(a.address)))) {
      return callback(Object.assign(new Error(`blocked address for ${hostname}`), { code: 'EBLOCKED' }), '');
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  };
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    const list = (addresses as dns.LookupAddress[] | undefined) ?? [];
    if (!err && list.length) return decide(list);
    // Le résolveur du système ne connaît pas ce nom (box, cache négatif) : requête DNS directe, puis résolveurs
    // publics (`resolveHost`). L'adresse trouvée passe par la même garde (jamais d'adresse privée).
    const notFound = err ?? Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' });
    resolveHost(hostname)
      .then(({ addresses: found }) => (found.length ? decide(found.map((address) => ({ address, family: net.isIPv6(address) ? 6 : 4 }))) : callback(notFound, '')))
      .catch(() => callback(notFound, ''));
  });
}

const agents = {
  'http:': new http.Agent({ lookup: guardedLookup as never }),
  'https:': new https.Agent({ lookup: guardedLookup as never }),
};

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  /** Types acceptés (préfixes) : `image/`, `video/`… */
  accept?: string[];
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}, redirects = 0): Promise<{ buffer: Buffer; mimeType: string; url: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError('invalid_url', 'Lien illisible.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SafeFetchError('invalid_url', 'Seuls les liens http(s) sont acceptés.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateAddress(host) && !allowedHosts().has(host)) throw new SafeFetchError('blocked', 'Adresse non joignable.');
  const maxBytes = options.maxBytes ?? 15 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, { agent: agents[url.protocol as 'http:' | 'https:'], headers: { 'User-Agent': 'iVisionBot/1.0 (+https://idem.africa)', Accept: (options.accept || ['*/']).map((a) => `${a}*`).join(',') }, timeout: options.timeoutMs ?? 15_000 }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 3) return reject(new SafeFetchError('http_error', 'Trop de redirections.'));
        return resolve(safeFetch(new URL(res.headers.location, url).toString(), options, redirects + 1));
      }
      if (status !== 200) {
        res.resume();
        return reject(new SafeFetchError('http_error', `HTTP ${status}`));
      }
      const mimeType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (options.accept && !options.accept.some((a) => mimeType.startsWith(a))) {
        res.resume();
        return reject(new SafeFetchError('bad_type', `Type ${mimeType || 'inconnu'} refusé.`));
      }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared > maxBytes) {
        res.resume();
        return reject(new SafeFetchError('too_large', 'Fichier trop lourd.'));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          reject(new SafeFetchError('too_large', 'Fichier trop lourd.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), mimeType, url: url.toString() }));
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new SafeFetchError('timeout', 'Le site ne répond pas.'));
    });
    req.on('error', (error: NodeJS.ErrnoException) => reject(error.code === 'EBLOCKED' ? new SafeFetchError('blocked', 'Adresse non joignable.') : error));
  });
}
