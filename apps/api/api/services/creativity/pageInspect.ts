/**
 * MESURE ET RÉPARATION D'UNE PAGE COMPOSÉE — le garde-fou des crans Max et Ultra des documents
 * (charte graphique, business plan, pitch deck).
 *
 * Le compositeur écrit le HTML d'une page ; la fidélité au contenu est vérifiée sur la chaîne
 * (`pageComposer.ts#fidelityIssues`). Ce qui ne se lit pas dans la chaîne se MESURE ici, sur la
 * page rendue dans Chromium, au format réel du document.
 *
 * ── RÉPARER PLUTÔT QUE REFUSER ───────────────────────────────────────────────
 *
 * Ce module refusait la page au moindre écart : 4 % de hauteur en trop, un contraste à 4,0:1 au
 * lieu de 4,5:1, un corps à 9 px. Mesuré dans les journaux : 26 pages Ultra refusées contre 3
 * retenues — autrement dit un cran Ultra qui rendait des pages de gabarit, exactement le reproche
 * qui lui était fait. Or ces trois défauts ont une réponse déterministe, et le compositeur de
 * visuels l'applique depuis toujours (`poster.render.ts#FIT_AND_MEASURE`) : le navigateur mesure,
 * le code corrige, et ce qui est mesuré ENSUITE est ce qui sera imprimé.
 *
 * Le code répare donc, dans l'ordre :
 *  - la page trop haute → une mise à l'échelle (`zoom`) qui la ramène à son format, jusqu'à 26 % ;
 *  - un texte sous le contraste → l'encre de la charte qui passe, choisie sur le fond MESURÉ ;
 *  - un corps sous 7 pt → remonté à 7 pt.
 *
 * Et ne refuse plus que l'irréparable : un texte hors page, un texte coupé par sa boîte, un
 * contraste sous 3:1 (2:1 pour un grand titre) qu'aucune encre de la charte ne sauve, une page qui
 * dépasse encore après mise à l'échelle. Le reste part au compositeur comme CONSEIL, sans lui
 * coûter sa page.
 *
 * Un contrôle impossible (Chromium absent) ne refuse plus la page : elle a déjà passé la fidélité
 * et les règles de charte, et un serveur sans Chromium ferait retomber tout le cran Ultra sur les
 * gabarits sans que rien ne le dise.
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
  /**
   * Les encres de la charte, de la plus foncée à la plus claire. Le code en choisit une pour
   * réparer un texte sous le contraste : la charte décide de la couleur, la mesure décide laquelle.
   */
  inks?: string[];
  /**
   * LA MESURE RÉPARE SANS JAMAIS REFUSER (cran Ultra).
   *
   * Ce qui reste après réparation est alors un CONSEIL : la page de l'IA est livrée telle quelle,
   * jamais remplacée par un gabarit pour un écart de mesure. C'est la règle au cran le plus haut —
   * la page composée par l'IA est le livrable, pas une proposition soumise à un arbitrage.
   */
  repairOnly?: boolean;
}

/** Ce que la mesure rend : la page réparée, ce qui reste à refaire, et ce qui n'est qu'un conseil. */
export interface PageMeasure {
  /** Défauts irréparables : la page repart au compositeur (et, au dernier tour, au gabarit). */
  issues: string[];
  /** Constats non bloquants : transmis au compositeur, ils ne lui coûtent pas sa page. */
  advisories: string[];
  /** La page APRÈS réparation — c'est elle qu'on imprime. */
  html: string;
  /** Ce que le code a corrigé (journal). */
  repaired: string[];
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

/**
 * Chart.js, comme à l'impression (`pdf.service.ts`) : une page du compositeur peut porter un
 * graphique dessiné par le code (`renderStandaloneChart`). Sans la bibliothèque ici, on mesurerait
 * un canvas vide — donc une page jugée sur ce qui ne sera pas imprimé. Absente, le repli dessiné
 * par le serveur reste visible et la mesure vaut quand même.
 */
let chartScript: string | null | undefined;
function chartTag(): string {
  if (chartScript === undefined) {
    const candidates = [path.join(process.cwd(), 'public', 'scripts', 'chart.js'), path.resolve(__dirname, '../../../public/scripts/chart.js')];
    const found = candidates.find((file) => fs.existsSync(file));
    chartScript = found ? fs.readFileSync(found, 'utf8').replace(/<\/script/gi, '<\\/script') : null;
  }
  return chartScript ? `<script>${chartScript}</script>` : '';
}

/** Dessine les graphiques posés par le code (même convention que le runtime d'impression). */
const CHART_BOOT = `<script>
(function () {
  if (!window.Chart) return;
  try { window.Chart.defaults.animation = false; window.Chart.defaults.responsive = true; window.Chart.defaults.maintainAspectRatio = false; } catch (e) {}
  var list = [].slice.call(document.querySelectorAll('canvas[data-idem-chart]'));
  list.forEach(function (canvas) {
    var cfg = null;
    try { cfg = JSON.parse(canvas.getAttribute('data-idem-chart')); } catch (e) { cfg = null; }
    if (!cfg) return;
    try {
      new window.Chart(canvas, cfg);
      var fallback = canvas.parentNode && canvas.parentNode.querySelector('[data-chart-fallback]');
      if (fallback) fallback.style.display = 'none';
    } catch (e) {}
  });
})();
</script>`;

function documentFor(html: string, opts: PageInspectOptions): string {
  const display = opts.fonts?.display || 'Archivo';
  const body = opts.fonts?.body || display;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${buildGoogleFontLinks([display, body])}
${tailwindTag()}
${chartTag()}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: '${body}', system-ui, sans-serif; }
</style>
</head>
<body>${html}${CHART_BOOT}</body>
</html>`;
}

export async function inspectComposedPage(html: string, opts: PageInspectOptions): Promise<PageMeasure> {
  const width = Math.round(cssLengthToPx(opts.page.width));
  const height = Math.round(cssLengthToPx(opts.page.minHeight));
  const asIs: PageMeasure = { issues: [], advisories: [], html, repaired: [] };
  if (!Number.isFinite(width) || !Number.isFinite(height)) return asIs;
  // Les encres candidates : celles de la charte, plus le noir et le blanc — une page illisible
  // n'est jamais préférable à une page dont un mot a changé de valeur dans la même palette.
  const inks = [...new Set([...(opts.inks || []), '#111111', '#ffffff'])].filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
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
    const measured = await page.evaluate(
      (pageHeight: number, pageWidth: number, singlePage: boolean, inkList: string[]) => {
        const issues: string[] = [];
        const advisories: string[] = [];
        const repaired: string[] = [];
        const root = document.body.firstElementChild as HTMLElement | null;
        if (!root) return { issues: ['empty page'], advisories, repaired, html: '' };

        const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.slice(0, 3).map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratioOf = (a: number[], c: number[]) => {
          const la = lum(a);
          const lc = lum(c);
          return (Math.max(la, lc) + 0.05) / (Math.min(la, lc) + 0.05);
        };
        const hexRgb = (hex: string): number[] => {
          const h = hex.replace('#', '');
          const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6);
          return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
        };
        /** Le fond RÉELLEMENT sous un élément (null : une image ou un dégradé, qu'on ne juge pas). */
        const bgOf = (el: Element | null): number[] | null => {
          for (let n = el; n; n = n.parentElement) {
            const st = getComputedStyle(n);
            if (st.backgroundImage && st.backgroundImage !== 'none') return null;
            const c = parse(st.backgroundColor);
            if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return c;
          }
          return [255, 255, 255];
        };
        /** Les éléments qui portent leur PROPRE texte, plus les images : la matière de la page. */
        const carriers = (): HTMLElement[] =>
          Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
            if (el.closest('[aria-hidden="true"]')) return false;
            const st = getComputedStyle(el);
            if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.05) return false;
            if (el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'TABLE') return true;
            return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
          });
        /**
         * La hauteur réellement OCCUPÉE : le bas du dernier élément qui porte de la matière. Les
         * formes décoratives sont exclues — une bande ou un cercle qui sort du cadre est un choix
         * de composition (le plein papier est même demandé au compositeur), pas un débordement.
         */
        const occupied = (): number => {
          const top = root.getBoundingClientRect().top;
          let max = 0;
          for (const el of carriers()) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            max = Math.max(max, r.bottom - top);
          }
          return max;
        };

        // ── 1. LA PAGE TROP HAUTE : ramenée à son format ─────────────────────
        //
        // `zoom` et non `transform` : la page garde sa boîte (210 mm), le plein papier reste plein
        // papier, et Chromium imprime le même résultat. La compensation de largeur et de hauteur
        // maintient le format exact.
        let fit = 1;
        if (singlePage) {
          const used = occupied();
          if (used > pageHeight + 4) {
            fit = Math.max(0.74, (pageHeight - 2) / used);
            root.style.setProperty('zoom', String(Math.round(fit * 1000) / 1000));
            root.style.setProperty('width', `${Math.round(pageWidth / fit)}px`);
            root.style.setProperty('height', `${Math.round(pageHeight / fit)}px`);
            repaired.push(`échelle ${Math.round(fit * 100)}% (la page faisait ${Math.round(used)}px pour ${Math.round(pageHeight)}px)`);
          }
        }

        // ── 2. CHAQUE TEXTE : contraste et corps réparés, bornes vérifiées ───
        const box = root.getBoundingClientRect();
        for (const el of carriers()) {
          const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) || el.tagName.toLowerCase();
          const st = getComputedStyle(el);

          // Hors de la LARGEUR de la page : un mot qui sort du papier ne s'imprime pas.
          const outBy = Math.max(box.left - r.left, r.right - box.right);
          if (outBy > 4) issues.push(`text outside the page width: "${label}"`);
          else if (outBy > 1) advisories.push(`"${label}" touches the page edge — give it a little room`);

          // Coupé par sa propre boîte. Une coupure VOULUE (ellipse, `line-clamp`) n'en est pas une.
          const clamp = (st as unknown as Record<string, string>).webkitLineClamp;
          const deliberate = st.textOverflow === 'ellipsis' || (!!clamp && clamp !== 'none');
          const clipsX = /hidden|clip/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2;
          const clipsY = /hidden|clip/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4;
          if ((clipsX || clipsY) && !deliberate) issues.push(`text cut by its box: "${label}"`);

          if (!own) continue;

          // Un corps sous 7 pt : remonté, jamais refusé. La taille LUE est celle qui s'imprime
          // (`zoom` multiplie les longueurs calculées) : la valeur posée est donc divisée par
          // l'échelle, sinon un corps « remonté » sur une page réduite resterait trop petit.
          let size = parseFloat(st.fontSize);
          if (size < 9.3) {
            el.style.setProperty('font-size', `${(9.4 / fit).toFixed(2)}px`);
            repaired.push(`corps de "${label}" remonté à 7 pt`);
            size = 9.4;
          }

          // Le contraste, sur le fond MESURÉ : l'encre de la charte qui passe est posée.
          const bg = bgOf(el);
          if (!bg || st.color === 'rgba(0, 0, 0, 0)') continue;
          const large = size >= 24 || (size >= 18.6 && Number(st.fontWeight) >= 700);
          const target = large ? 3 : 4.5;
          const floor = large ? 2 : 3;
          const ratio = ratioOf(parse(st.color), bg);
          if (ratio >= target) continue;
          // La PREMIÈRE encre de la charte qui passe, pas la plus contrastée : prendre le maximum
          // posait du noir pur partout et sortait le document de sa charte. Le noir et le blanc
          // ferment la liste — ils ne servent que si aucune encre de la marque ne tient.
          let best = { ink: '', ratio };
          for (const ink of inkList) {
            const candidate = ratioOf(hexRgb(ink), bg);
            if (candidate > best.ratio) best = { ink, ratio: candidate };
            if (candidate >= target) break;
          }
          if (best.ink && best.ratio >= target) {
            el.style.setProperty('color', best.ink);
            repaired.push(`contraste de "${label}" porté à ${best.ratio.toFixed(1)}:1 (encre ${best.ink})`);
          } else if (Math.max(ratio, best.ratio) < floor) {
            issues.push(`unreadable text (${Math.max(ratio, best.ratio).toFixed(1)}:1 at best, on this ground): "${label}" — put it on another ground`);
          } else {
            if (best.ink && best.ratio > ratio) el.style.setProperty('color', best.ink);
            advisories.push(`contrast of "${label}" is ${Math.max(ratio, best.ratio).toFixed(1)}:1 (4.5:1 would read better)`);
          }
        }

        // ── 3. CE QUI RÉSISTE À LA MISE À L'ÉCHELLE ──────────────────────────
        if (singlePage) {
          const used = occupied();
          if (used > pageHeight + 6) {
            issues.push(`the page still runs ${Math.round(used - pageHeight)}px past its ${Math.round(pageHeight)}px even scaled down: give it less to carry (fewer words, a tighter grid)`);
          }
          const top = root.getBoundingClientRect().top;
          for (const el of carriers()) {
            const r = el.getBoundingClientRect();
            if (r.bottom - top > pageHeight + 6 && (el.textContent || '').trim()) {
              issues.push(`text below the bottom of the page (cut): "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`);
              break;
            }
          }
        }

        return {
          issues: [...new Set(issues)].slice(0, 6),
          advisories: [...new Set(advisories)].slice(0, 4),
          repaired: [...new Set(repaired)].slice(0, 8),
          html: root.outerHTML,
        };
      },
      height,
      width,
      opts.singlePage,
      inks
    );
    if (measured.repaired.length) {
      logger.info(`[PageInspect] ${opts.label || 'page'} : réparée par le code`, { repaired: measured.repaired.slice(0, 4) });
    }
    // Au cran le plus haut, ce qui résiste à la réparation ne coûte plus sa page à l'IA : il est
    // journalisé et transmis comme conseil s'il reste un tour.
    if (opts.repairOnly && measured.issues.length) {
      logger.info(`[PageInspect] ${opts.label || 'page'} : livrée telle quelle (mesure sans refus)`, { reste: measured.issues.slice(0, 3) });
      return { ...measured, html: measured.html || html, issues: [], advisories: [...measured.issues, ...measured.advisories].slice(0, 6) };
    }
    return { ...measured, html: measured.html || html };
  } catch (error: any) {
    // UN CONTRÔLE IMPOSSIBLE NE REFUSE PLUS LA PAGE.
    //
    // Il la refusait, « le gabarit est toujours là ». Mais un serveur sans Chromium, ou un rendu
    // qui déborde son délai, faisait alors retomber TOUT le cran Ultra sur les gabarits en silence
    // — la panne la plus coûteuse de la jauge, et invisible. La page a passé la fidélité au contenu
    // et les règles de la charte : elle est livrée, et le journal dit qu'elle ne fut pas mesurée.
    logger.warn(`[PageInspect] ${opts.label || 'page'} : contrôle impossible, la page est livrée non mesurée`, { error: error?.message });
    return { issues: [], advisories: [], html, repaired: ['non mesurée'] };
  } finally {
    await page?.close().catch(() => undefined);
  }
}
