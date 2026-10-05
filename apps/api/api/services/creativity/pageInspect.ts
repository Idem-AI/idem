/**
 * CONTRÔLE MESURÉ D'UNE PAGE COMPOSÉE — le garde-fou du cran Ultra des documents
 * (charte graphique, business plan, pitch deck).
 *
 * Le compositeur écrit le HTML d'une page ; la fidélité au contenu est vérifiée sur la chaîne
 * (`pageComposer.ts#acceptComposedPage`). Ce qui ne se lit pas dans la chaîne se MESURE ici,
 * sur la page rendue dans Chromium, au format réel du document :
 *
 *  - une page unique (diapositive, page de charte) qui dépasse sa hauteur : la fin est rognée ;
 *  - un texte hors de la page, ou coupé par son conteneur ;
 *  - un corps sous 7 pt ;
 *  - un contraste sous 4,5:1 (3:1 pour un grand titre) sur un fond uni.
 *
 * Une liste vide : la page est livrable. Sinon, les constats repartent au compositeur pour UNE
 * réparation, puis la page retombe sur son gabarit. Un contrôle impossible (Chromium absent)
 * ne laisse pas passer la page : il la refuse, le gabarit est toujours là.
 */
import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';
import logger from '../../config/logger';
import { buildGoogleFontLinks } from '../../utils/google-fonts.util';
import { installRenderNetworkGuard } from '../../utils/render-network-guard';
import type { PageFormat } from '../design/sectionRenderer';

const MM_TO_PX = 96 / 25.4;

/** « 210mm », « 1123px », « 11.7in » → pixels CSS. */
export function cssLengthToPx(value: string): number {
  const m = String(value || '').trim().match(/^([\d.]+)\s*(mm|cm|in|px)?$/i);
  if (!m) return NaN;
  const n = Number(m[1]);
  switch ((m[2] || 'px').toLowerCase()) {
    case 'mm':
      return n * MM_TO_PX;
    case 'cm':
      return n * 10 * MM_TO_PX;
    case 'in':
      return n * 96;
    default:
      return n;
  }
}

export interface PageInspectOptions {
  page: PageFormat;
  /** Une section = exactement une page (diapositive, page de charte) : la hauteur est bornée. */
  singlePage: boolean;
  fonts?: { display?: string; body?: string };
  label?: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'],
    timeout: 30000,
  });
  return browser;
}

/** Ferme le Chromium du contrôle (scripts de vérification). */
export async function closePageInspector(): Promise<void> {
  const b = browser;
  browser = null;
  await b?.close().catch(() => undefined);
}

/**
 * Le Tailwind du rendu PDF (`public/scripts/tailwind.js`, cf. pdf.service.ts) : la page est
 * mesurée avec le moteur qui l'imprimera, et sans attendre le CDN. Le CDN reste le repli.
 */
let tailwindScript: string | null | undefined;
function tailwindTag(): string {
  if (tailwindScript === undefined) {
    const candidates = [path.join(process.cwd(), 'public', 'scripts', 'tailwind.js'), path.resolve(__dirname, '../../../public/scripts/tailwind.js')];
    const found = candidates.find((file) => fs.existsSync(file));
    tailwindScript = found ? fs.readFileSync(found, 'utf8').replace(/<\/script/gi, '<\\/script') : null;
  }
  return tailwindScript ? `<script>${tailwindScript}</script>` : '<script src="https://cdn.tailwindcss.com"></script>';
}

function documentFor(html: string, opts: PageInspectOptions): string {
  const display = opts.fonts?.display || 'Archivo';
  const body = opts.fonts?.body || display;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${buildGoogleFontLinks([display, body])}
${tailwindTag()}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: '${body}', system-ui, sans-serif; }
</style>
</head>
<body>${html}</body>
</html>`;
}

export async function inspectComposedPage(html: string, opts: PageInspectOptions): Promise<string[]> {
  const width = Math.round(cssLengthToPx(opts.page.width));
  const height = Math.round(cssLengthToPx(opts.page.minHeight));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return [];
  let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await installRenderNetworkGuard(page);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // Tailwind est embarqué : le DOM suffit. Les polices de la marque sont attendues, mais un
    // réseau lent ne doit pas faire retomber chaque page sur son gabarit : 10 s au plus.
    await page.setContent(documentFor(html, opts), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => Promise.race([document.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 10000))]));
    return await page.evaluate(
      (pageHeight: number, singlePage: boolean) => {
        const issues: string[] = [];
        const root = document.body.firstElementChild as HTMLElement | null;
        if (!root) return ['empty page'];
        const box = root.getBoundingClientRect();
        if (singlePage && root.scrollHeight > pageHeight + 4) {
          issues.push(`the page is ${Math.round(root.scrollHeight)}px tall but must fit in ${Math.round(pageHeight)}px: the end is cut — tighten the layout`);
        }
        const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.slice(0, 3).map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bgOf = (el: Element | null): number[] | null => {
          for (let n = el; n; n = n.parentElement) {
            const st = getComputedStyle(n);
            if (st.backgroundImage && st.backgroundImage !== 'none') return null;
            const c = parse(st.backgroundColor);
            if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return c;
          }
          return [255, 255, 255];
        };
        for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
          const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
          if (!own || el.closest('[aria-hidden="true"]')) continue;
          const st = getComputedStyle(el);
          if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.05) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
          if (r.left < box.left - 1 || r.right > box.right + 1) issues.push(`text outside the page width: "${label}"`);
          if (singlePage && r.bottom > box.top + pageHeight + 1) issues.push(`text below the bottom of the page (cut): "${label}"`);
          const clipsX = /hidden|clip/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2;
          const clipsY = /hidden|clip/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4;
          if (clipsX || clipsY) issues.push(`text cut by its box: "${label}"`);
          const size = parseFloat(st.fontSize);
          if (size < 9.3) issues.push(`text smaller than 7 pt: "${label}" (${size.toFixed(1)} px)`);
          const bg = bgOf(el);
          if (bg && st.color !== 'rgba(0, 0, 0, 0)') {
            const a = lum(parse(st.color));
            const c = lum(bg);
            const ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
            const large = size >= 24 || (size >= 18.6 && Number(st.fontWeight) >= 700);
            if (ratio < (large ? 3 : 4.5)) issues.push(`low contrast (${ratio.toFixed(1)}:1): "${label}"`);
          }
        }
        return [...new Set(issues)].slice(0, 8);
      },
      height,
      opts.singlePage
    );
  } catch (error: any) {
    logger.warn(`[PageInspect] ${opts.label || 'page'} : contrôle impossible, la page n'est pas retenue`, { error: error?.message });
    return ['the page could not be measured'];
  } finally {
    await page?.close().catch(() => undefined);
  }
}
