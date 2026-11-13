/**
 * LE CONTRÔLE TECHNIQUE D'UN FILM HTML — avant de le montrer : la page est ouverte dans le Chrome du moteur vidéo (sur
 * une origine locale, sans réseau), chaque scène est amenée à 60 % de sa durée, ses erreurs de script relevées et sa
 * vignette photographiée. Ce qui plante est attribué à SA scène (elle passe « en erreur » et se corrige) ; rien n'est
 * jugé d'autre.
 */
import type { Page } from 'puppeteer';
import { filmBrowser, releaseFilmBrowser } from '../runner';

const ORIGIN = 'http://idem-hyperframes.local';

export interface ProbeFile {
  name: string;
  data: Buffer;
  mimeType: string;
}

export interface CompositionProbe {
  errors: { key: string; message: string }[];
  thumbnails: Record<string, Buffer>;
  /** Scènes du catalogue dont un texte ne tient pas, même au plus petit corps permis (la composition est à changer). */
  fit?: string[];
}

export async function probeComposition(html: string, files: ProbeFile[], scenes: { key: string; start: number; duration: number }[], size: { width: number; height: number }): Promise<CompositionProbe> {
  const browser = await filmBrowser();
  let page: Page | undefined;
  try {
    page = await browser.newPage();
    // Les vignettes à demi-taille suffisent (la page est mise à l'échelle par la composition elle-même).
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    const byName = new Map(files.map((f) => [`/${f.name}`, f]));
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled()) return;
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return void req.continue();
      if (!url.startsWith(`${ORIGIN}/`)) return void req.abort('blockedbyclient');
      const pathname = url.slice(ORIGIN.length).split('?')[0];
      if (pathname === '/') return void req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      const file = byName.get(decodeURIComponent(pathname));
      return void req.respond(file ? { status: 200, contentType: file.mimeType, body: file.data } : { status: 404, body: '' });
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String((e as Error)?.message || e)));
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate('document.fonts && document.fonts.ready').catch(() => undefined);
    const ready = await page.evaluate('Boolean(window.__timelines && window.__timelines.film)');
    if (!ready) return { errors: scenes.map((s) => ({ key: s.key, message: `the page did not register its timeline: ${pageErrors.join(' · ').slice(0, 240) || 'unknown error'}` })), thumbnails: {} };
    // Les scènes du catalogue se construisent quand les polices sont prêtes : on laisse passer cette tâche.
    await page.evaluate('new Promise(function (r) { setTimeout(r, 0); })').catch(() => undefined);
    const thumbnails: Record<string, Buffer> = {};
    for (const s of scenes) {
      const t = s.start + s.duration * 0.6;
      await page.evaluate(
        `(function (t, key) {
          window.__timelines.film.seek(t, false);
          document.querySelectorAll('section.scene').forEach(function (el) { el.style.visibility = el.id === key ? 'visible' : 'hidden'; });
        })(${t}, ${JSON.stringify(s.key)})`
      );
      const shot = await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: size.width, height: size.height } });
      thumbnails[s.key] = Buffer.from(shot);
    }
    const errors = (await page.evaluate('window.__sceneErrors || []')) as { key: string; message: string }[];
    const fit = (await page.evaluate('window.__fitIssues || []').catch(() => [])) as string[];
    // Une erreur levée hors d'une scène (syntaxe d'un script) est attribuée à toutes : la page entière ne tourne pas.
    if (pageErrors.length && !errors.length) return { errors: scenes.map((s) => ({ key: s.key, message: pageErrors[0].slice(0, 300) })), thumbnails, fit };
    return { errors, thumbnails, ...(fit.length ? { fit: [...new Set(fit)] } : {}) };
  } finally {
    await page?.close().catch(() => undefined);
    releaseFilmBrowser();
  }
}
