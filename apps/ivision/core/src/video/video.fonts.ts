/**
 * LES POLICES DE LA CHARTE, EMBARQUÉES DANS LA PAGE DU RENDU.
 *
 * La page d'une vidéo chargeait ses polices par des `<link rel="stylesheet">` (Google Fonts
 * ou la fonderie de la charte). Une feuille qui tarde bloque l'événement `load` du navigateur
 * de rendu : l'export attendait 60 s puis échouait. Les feuilles sont donc lues ici, côté
 * serveur, une fois par adresse (cache mémoire), et leurs fichiers intégrés en data URI :
 * la page ne dépend plus du réseau pour ses polices.
 *
 * Google Fonts sert un fichier par sous-ensemble d'écriture : seuls latin et latin-ext sont
 * gardés, plus « vietnamese » quand le texte de la vidéo en a besoin (il porte les voyelles
 * pointées du yoruba, comme ẹ et ọ). Une feuille illisible ou trop lourde garde son `<link>`.
 */
import axios from 'axios';
import logger from '../runtime/logger';

/** Un navigateur récent reçoit du woff2 (le plus léger). */
const MODERN_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const TIMEOUT_MS = 8000;
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
/** Au-delà, la page deviendrait trop lourde : on garde le lien. */
const MAX_SHEET_BYTES = 4 * 1024 * 1024;
const BASE_SUBSETS = ['latin', 'latin-ext'];
/** Caractères du sous-ensemble « vietnamese » (dont ẹ, ọ, ṣ… pointés) ou diacritiques combinants. */
const EXTENDED_TEXT = /[\u0300-\u036f\u1ea0-\u1ef9]/;

const sheets = new Map<string, Promise<string | null>>();

const MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

/** Une coupure réseau passagère ne doit pas coûter la police : une seconde tentative. */
async function twice<T>(job: () => Promise<T>): Promise<T> {
  try {
    return await job();
  } catch {
    return job();
  }
}

async function fetchFile(url: string): Promise<string | null> {
  const ext = (url.split('?')[0].match(/\.(woff2|woff|ttf|otf)$/i)?.[1] || 'woff2').toLowerCase();
  const res = await twice(() => axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: TIMEOUT_MS, maxContentLength: MAX_FILE_BYTES, headers: { 'User-Agent': MODERN_UA } }));
  return `data:${MIME[ext] || 'font/woff2'};base64,${Buffer.from(res.data).toString('base64')}`;
}

/** Une feuille de polices, ses fichiers intégrés ; null si elle n'a pas pu l'être. */
async function inlineSheet(href: string, subsets: Set<string>): Promise<string | null> {
  const res = await twice(() => axios.get<string>(href, { responseType: 'text', timeout: TIMEOUT_MS, headers: { 'User-Agent': MODERN_UA, Accept: 'text/css,*/*;q=0.1' } }));
  let css = String(res.data || '');
  if (!/@font-face/.test(css)) return null;
  // Google : un bloc par sous-ensemble, annoncé par un commentaire (/* latin */).
  if (/\/\*\s*[a-z-]+\s*\*\//i.test(css)) {
    css = css
      .split(/(?=\/\*\s*[a-z-]+\s*\*\/)/i)
      .filter((block) => {
        const subset = block.match(/^\/\*\s*([a-z-]+)\s*\*\//i)?.[1]?.toLowerCase();
        return !subset || subsets.has(subset);
      })
      .join('');
  }
  const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((u) => !u.startsWith('data:')))];
  const files = await Promise.all(urls.map(async (u) => [u, await fetchFile(new URL(u, href).toString())] as const));
  let size = 0;
  for (const [u, data] of files) {
    if (!data) return null;
    size += data.length;
    css = css.split(u).join(data);
  }
  return size > MAX_SHEET_BYTES ? null : css;
}

function cachedSheet(href: string, extended: boolean): Promise<string | null> {
  const key = `${extended ? 'x' : 'b'}:${href}`;
  let job = sheets.get(key);
  if (!job) {
    const subsets = new Set(extended ? [...BASE_SUBSETS, 'vietnamese'] : BASE_SUBSETS);
    job = inlineSheet(href, subsets).catch((error: any) => {
      logger.warn('video.font_inline_failed', { href, error: error?.message || error?.code || error?.errors?.[0]?.code || String(error) });
      return null;
    });
    sheets.set(key, job);
    // Un échec (réseau) n'est pas définitif : on retentera à la prochaine vidéo.
    job.then((css) => (css ? undefined : sheets.delete(key)));
  }
  return job;
}

/**
 * Remplace les feuilles de polices par leur contenu embarqué. Les autres balises (styles
 * déjà embarqués, comme Vilevile) sont gardées ; les `preconnect` deviennent inutiles.
 */
export async function inlineFontLinks(links: string, text = ''): Promise<string> {
  const tags = [...links.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const stylesheets = tags.filter((t) => /rel=["']?stylesheet/i.test(t));
  if (!stylesheets.length) return links;
  const extended = EXTENDED_TEXT.test(text.normalize('NFC')) || EXTENDED_TEXT.test(text.normalize('NFD').replace(/[a-z]/gi, ''));
  const jobs = stylesheets.map(async (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
    if (!href || !/^https:\/\//i.test(href)) return [tag, null] as const;
    return [tag, await cachedSheet(href, extended), href] as const;
  });
  let out = links;
  for (const [tag, css, href] of await Promise.all(jobs)) {
    if (css && href) out = out.replace(tag, `<style data-font="${href.replace(/["<>]/g, '')}">${css}</style>`);
  }
  // Sans feuille externe restante, les préconnexions ne servent plus à rien.
  if (![...out.matchAll(/<link\b[^>]*>/gi)].some((m) => /rel=["']?stylesheet/i.test(m[0]))) out = out.replace(/<link\b[^>]*rel=["']?preconnect[^>]*>\s*/gi, '');
  return out;
}
