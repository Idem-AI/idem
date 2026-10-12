/**
 * Le NAVIGATEUR du moteur : un Chromium partagé (Puppeteer), qui mesure et photographie les pages.
 *
 * C'est le même moteur de rendu que celui qui imprime les PDF : ce qu'il mesure ici est ce que le
 * lecteur verra. Une page ne charge que ce que la liste blanche admet (polices, actifs déclarés par
 * l'hôte, data-URI) : un document n'appelle jamais une adresse arbitraire pendant son rendu.
 */
import type { Browser, HTTPRequest, Page } from 'puppeteer';

let browserPromise: Promise<Browser> | null = null;

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com', 'cdn.jsdelivr.net'];

export interface BrowserOptions {
  /** Hôtes d'actifs admis en plus des polices (MinIO public, CDN d'images…). */
  assetHosts?: string[];
  /** Admettre `localhost` (développement). */
  allowLocal?: boolean;
  /**
   * Le Chromium de l'hôte (celui de son service PDF, par exemple) : le moteur s'en sert au lieu d'en
   * lancer un second, et ne le ferme jamais — il appartient à l'hôte.
   */
  shared?: () => Promise<Browser>;
  /**
   * Le filtre réseau de l'hôte, consulté pour toute adresse que la liste blanche n'admet pas (images
   * publiques d'un visuel, par exemple) : l'hôte refuse les adresses privées, internes, de métadonnées.
   */
  allow?: (url: string) => boolean | Promise<boolean>;
}

let defaults: BrowserOptions = { assetHosts: [], allowLocal: process.env.NODE_ENV !== 'production' };

export function configureBrowser(options: BrowserOptions): void {
  defaults = { ...defaults, ...options, assetHosts: [...new Set([...(defaults.assetHosts ?? []), ...(options.assetHosts ?? [])])] };
}

export async function getBrowser(): Promise<Browser> {
  if (defaults.shared) return defaults.shared();
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
  }
  browserPromise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer') as typeof import('puppeteer');
    return puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--font-render-hinting=none'],
      timeout: 30_000,
    });
  })();
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const b = browserPromise ? await browserPromise.catch(() => null) : null;
  browserPromise = null;
  if (b) await b.close().catch(() => undefined);
}

function allowed(url: string, options: BrowserOptions): boolean {
  if (/^(data|blob|about):/i.test(url)) return true;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (FONT_HOSTS.includes(host)) return true;
  if ((options.assetHosts ?? []).some((h) => host === h || host.endsWith(`.${h}`))) return true;
  if (options.allowLocal && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return true;
  return false;
}

async function guard(page: Page, options: BrowserOptions): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (request: HTTPRequest) => {
    const url = request.url();
    const verdict = allowed(url, options) ? true : options.allow ? Promise.resolve(options.allow(url)).catch(() => false) : false;
    Promise.resolve(verdict).then((ok) => (ok ? request.continue() : request.abort('blockedbyclient'))).catch(() => undefined);
  });
}

/** Un document complet autour d'un fragment : marges nulles, polices de la marque, rien d'autre. */
export function pageDocument(body: string, head = '', options: { lang?: string; background?: string } = {}): string {
  return `<!doctype html><html lang="${options.lang ?? 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}<style>html,body{margin:0;padding:0;background:${options.background ?? '#ffffff'}}*,*::before,*::after{box-sizing:border-box}</style></head><body>${body}</body></html>`;
}

/**
 * Le code exécuté DANS la page est une chaîne, jamais une fonction TypeScript : la cible ES2016 du projet
 * transpile `async` et la décomposition d'objet en appels à des assistants (`__awaiter`, `__assign`) qui
 * n'existent pas dans le navigateur.
 */
export const WAIT_FOR_ASSETS = `(async function () {
  if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
  await Promise.all(Array.prototype.map.call(document.images, function (img) {
    return img.complete ? null : new Promise(function (resolve) { img.addEventListener('load', resolve); img.addEventListener('error', resolve); });
  }));
  return true;
})()`;

/** Ouvre une page (taille, document), attend polices et images, exécute `fn`, referme. */
export async function withPage<T>(html: string, size: { width: number; height: number; scale?: number }, fn: (page: Page) => Promise<T>, options: BrowserOptions = {}): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await guard(page, { ...defaults, ...options, assetHosts: [...(defaults.assetHosts ?? []), ...(options.assetHosts ?? [])] });
    await page.setViewport({ width: Math.ceil(size.width), height: Math.ceil(size.height), deviceScaleFactor: size.scale ?? 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(WAIT_FOR_ASSETS);
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Une photographie de la première page (ou de l'élément `.ge-page`). */
export async function screenshot(html: string, size: { width: number; height: number; scale?: number }, options: BrowserOptions & { fullPage?: boolean } = {}): Promise<Buffer> {
  return withPage(
    html,
    size,
    async (page) => {
      const target = await page.$('.ge-page');
      const raw = target && !options.fullPage ? await target.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png', fullPage: options.fullPage ?? false });
      return Buffer.from(raw);
    },
    options
  );
}
