/**
 * LE SCAN D'UN SITE — l'utilisateur colle son lien, iVision en tire sa marque.
 *
 * Un navigateur (Chromium, garde réseau : aucune adresse privée n'est jamais atteinte) ouvre
 * la page d'accueil, puis jusqu'à deux pages internes (« à propos », « produits »…). Il relève
 * ce qu'un graphiste relèverait :
 *
 *   couleurs     chaque couleur vue, pesée par sa surface et son rôle (fond, texte, bouton, lien,
 *                titre, bordure), les variables CSS de la marque, la couleur de thème du navigateur
 *   polices      la famille des titres et du texte courant, la surface qu'elles couvrent
 *   logo         SVG en ligne de l'en-tête, image « logo », icônes, image de partage
 *   images       les grandes photos (héros, partage) : des visuels déjà « à la marque »
 *   textes       titre, description, titres de sections, paragraphes, langue
 *   capture      le haut de page, pour la lecture de la direction artistique
 *
 * Puis, sans modèle : palette (et trois propositions), typographie (et trois propositions).
 * Avec les modèles de l'hôte (facultatifs) : le ton, la promesse, le secteur, les mots-clés
 * (texte) et une ébauche de direction artistique (vision). Sans eux, des replis lisibles.
 *
 * Le résultat est un `BrandKit` : la même forme qu'une charte IDEM, lue par les mêmes moteurs.
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../runtime/logger';
import { installRenderNetworkGuard, isRenderUrlAllowed, RENDER_BROWSER_ARGS } from '../render/network-guard';
import type { ArtDirectionModel, ArtDirectionStyleId } from '../brand/art-direction.model';
import type { BrandKit, BrandPalette, BrandVoice } from '../brand/brand-kit';
import { clusterColors, ColorCluster, PaletteProposal, paletteFromClusters, paletteProposals, SeenColor } from './palette';
import { cleanFamilyName, firstFamily, SeenFont, typographyProposals, TypographyProposal } from './typography';

export type SiteScanStep = 'open' | 'colors' | 'fonts' | 'logo' | 'content' | 'voice' | 'art' | 'done';

export interface SiteScanOptions {
  url: string;
  /** Pages internes visitées en plus de l'accueil (0 à 2). */
  maxPages?: number;
  timeoutMs?: number;
  /** Modèle de texte de l'hôte : ton, promesse, secteur, mots-clés (facultatif). */
  textModel?: (system: string, user: string) => Promise<string>;
  /** Modèle de vision de l'hôte : ébauche de direction artistique depuis la capture (facultatif). */
  vision?: (base64: string, mimeType: string, instruction: string) => Promise<string>;
  onProgress?: (step: SiteScanStep, data?: Record<string, unknown>) => void;
}

export interface SiteLogo {
  /** SVG en ligne (nettoyé plus tard par le moteur vidéo) ou URL d'image. */
  svg?: string;
  url?: string;
  iconUrl?: string;
  source: 'inline-svg' | 'img' | 'icon' | 'og-image' | 'none';
}

/** Un fichier de police du site (règle `@font-face`, sous-ensemble latin) : de quoi l'héberger chez nous. */
export interface SiteFontFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** URL absolue (ou `data:` base64) du fichier. */
  url: string;
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
}

export interface SiteScanResult {
  url: string;
  finalUrl: string;
  brandName: string;
  title: string;
  description?: string;
  language: string;
  palette: BrandPalette;
  palettes: PaletteProposal[];
  colors: ColorCluster[];
  typography: { display: string; body: string; original: { display?: string; body?: string } };
  typographies: TypographyProposal[];
  /** Les fichiers des polices de titre et de texte du site, tels que le site les sert. */
  fontFaces: SiteFontFace[];
  /**
   * Ce que le site MONTRE de son style, relevé (typographie, formes, couleurs par usage) et lu sur la capture
   * (composition, gestes, images) : la matière de sa direction artistique — on codifie la marque, on ne
   * l'invente pas.
   */
  styleEvidence: string;
  /** Les textes du site (titres, paragraphes) : de quoi décrire le projet de la marque. */
  texts: { headings: string[]; paragraphs: string[] };
  logo: SiteLogo;
  /** Grandes images du site (URL absolues) : l'hôte les recopie dans son stockage. */
  images: string[];
  voice: BrandVoice;
  artDirection?: Partial<ArtDirectionModel>;
  /** Le haut de page (JPEG). */
  screenshot?: Buffer;
  pages: string[];
  warnings: string[];
}

export class SiteScanError extends Error {
  constructor(
    readonly code: 'invalid_url' | 'blocked_url' | 'unreachable' | 'timeout',
    message: string
  ) {
    super(message);
  }
}

/** `exemple.com`, `http://…`, espaces → URL https normalisée ; refus des schémas exotiques. */
export function normalizeSiteUrl(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\s+/g, '');
  if (!trimmed) throw new SiteScanError('invalid_url', 'Lien vide.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new SiteScanError('invalid_url', 'Ce lien n’est pas une adresse de site.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new SiteScanError('invalid_url', 'Seuls les sites web (http, https) se scannent.');
  if (!/\./.test(url.hostname) && url.hostname !== 'localhost') throw new SiteScanError('invalid_url', 'Ce lien n’a pas de nom de domaine.');
  url.hash = '';
  return url.toString();
}

/** Ce que la page dit d'elle-même, relevé DANS le navigateur (styles calculés, surfaces). */
interface PageFacts {
  colors: SeenColor[];
  fonts: SeenFont[];
  stacks: Record<string, string>;
  logo: SiteLogo;
  images: string[];
  title: string;
  siteName?: string;
  description?: string;
  language?: string;
  headings: string[];
  paragraphs: string[];
  links: { href: string; text: string }[];
  /** Les titres (h1, h2) : taille, graisse, casse, approche (em) ; et la taille du texte courant. */
  titleStyles: { size: number; weight: number; transform: string; tracking: number }[];
  bodySizes: number[];
  /** Les arrondis vus (px) et la forme des boutons. */
  radii: number[];
  buttons: string[];
  /** Le CSS en ligne (`<style>`) : les `@font-face` des polices auto-hébergées. */
  inlineCss: string;
}

/* eslint-disable no-var */
declare var document: any;
declare var window: any;
declare var getComputedStyle: any;
/* eslint-enable no-var */

/**
 * Exécuté dans la page : aucune dépendance, aucun réseau, et aucune syntaxe que TypeScript
 * traduirait par une aide (`async`, étalement d'objet) — la page ne la connaît pas.
 */
function readPage(): PageFacts {
  const colors: SeenColor[] = [];
  const fonts: SeenFont[] = [];
  const stacks: Record<string, string> = {};
  const vw = window.innerWidth;
  const vh = Math.max(window.innerHeight, 1);
  const toHex = (value: string): string | null => {
    const m = String(value || '').match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (alpha < 0.5) return null;
    return `#${[m[1], m[2], m[3]].map((n: string) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  };
  const visible = (el: any) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.2) return null;
    // Le premier écran pèse double : c'est ce qu'un visiteur voit de la marque.
    const top = r.top + window.scrollY;
    const fold = top < vh ? 2 : top < vh * 3 ? 1 : 0.5;
    return { r, s, area: Math.min(r.width, vw) * Math.min(r.height, vh * 2) * fold };
  };
  const titleStyles: PageFacts['titleStyles'] = [];
  const bodySizes: number[] = [];
  const radii: number[] = [];
  const buttons: string[] = [];
  const all = Array.from(document.querySelectorAll('body, body *')).slice(0, 4000) as any[];
  for (const el of all) {
    const v = visible(el);
    if (!v) continue;
    const tag = el.tagName.toLowerCase();
    const cls = `${el.className && typeof el.className === 'string' ? el.className : ''} ${el.id || ''}`.toLowerCase();
    const isButton = tag === 'button' || el.getAttribute('role') === 'button' || /\bbtn\b|button|cta/.test(cls) || (tag === 'a' && /btn|button|cta/.test(cls));
    const bg = toHex(v.s.backgroundColor);
    if (bg) colors.push({ hex: bg, weight: v.area, role: isButton ? 'action' : tag === 'body' || tag === 'main' ? 'background' : 'surface' });
    const ownText = Array.from(el.childNodes).some((n: any) => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
    // La FORME de la marque : arrondis des boutons, des images, des cartes ; boutons pleins, pilules ou filets.
    const radius = parseFloat(v.s.borderTopLeftRadius) || 0;
    if (isButton && buttons.length < 40) {
      radii.push(radius);
      buttons.push(bg ? (radius >= v.r.height / 2 - 1 ? 'pill' : 'filled') : parseFloat(v.s.borderTopWidth) >= 1 ? 'outline' : 'text');
    } else if (radii.length < 200 && (tag === 'img' || (bg && v.r.width > 120 && v.r.height > 80 && tag !== 'body' && tag !== 'main' && tag !== 'html'))) radii.push(radius);
    if (ownText && /^h[12]$/.test(tag) && titleStyles.length < 20) {
      const px = parseFloat(v.s.fontSize) || 16;
      titleStyles.push({ size: px, weight: parseInt(v.s.fontWeight, 10) || 400, transform: v.s.textTransform || 'none', tracking: v.s.letterSpacing === 'normal' ? 0 : (parseFloat(v.s.letterSpacing) || 0) / px });
    }
    if (ownText && tag === 'p' && bodySizes.length < 60) bodySizes.push(parseFloat(v.s.fontSize) || 16);
    if (ownText) {
      const fg = toHex(v.s.color);
      const textArea = Math.min(v.area, (el.textContent || '').trim().length * parseFloat(v.s.fontSize) * parseFloat(v.s.fontSize) * 0.6);
      const isHeading = /^h[1-3]$/.test(tag) || parseFloat(v.s.fontSize) >= 30;
      if (fg) colors.push({ hex: fg, weight: textArea, role: isButton ? 'action' : tag === 'a' ? 'link' : isHeading ? 'heading' : 'text' });
      const family = v.s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (family) {
        stacks[family] = v.s.fontFamily;
        fonts.push({ family, usage: isHeading ? 'heading' : isButton ? 'button' : 'body', weight: parseInt(v.s.fontWeight, 10) || 400, area: textArea });
      }
    }
    const border = toHex(v.s.borderTopColor);
    if (border && parseFloat(v.s.borderTopWidth) >= 2) colors.push({ hex: border, weight: v.r.width * 4, role: 'border' });
  }
  // Variables CSS de la marque (--primary, --brand-color, --accent…).
  for (const sheet of Array.from(document.styleSheets) as any[]) {
    let rules: any[] = [];
    try {
      rules = Array.from(sheet.cssRules || []);
    } catch {
      continue; // feuille d'un autre domaine : illisible, c'est normal
    }
    for (const rule of rules.slice(0, 400)) {
      if (rule.selectorText !== ':root' || !rule.style) continue;
      for (let i = 0; i < rule.style.length; i++) {
        const name = rule.style[i];
        if (!/^--.*(primary|brand|accent|secondary|main|theme)/i.test(name)) continue;
        const probe = document.createElement('span');
        probe.style.color = rule.style.getPropertyValue(name).trim();
        document.body.appendChild(probe);
        const hex = toHex(getComputedStyle(probe).color);
        probe.remove();
        if (hex) colors.push({ hex, weight: 40000, role: 'variable' });
      }
    }
  }
  const theme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
  if (theme) {
    const probe = document.createElement('span');
    probe.style.color = theme;
    document.body.appendChild(probe);
    const hex = toHex(getComputedStyle(probe).color);
    probe.remove();
    if (hex) colors.push({ hex, weight: 50000, role: 'theme' });
  }

  // Logo : SVG en ligne dans l'en-tête, image « logo », icônes.
  const abs = (u?: string | null) => {
    try {
      return u ? new URL(u, document.baseURI).href : undefined;
    } catch {
      return undefined;
    }
  };
  const header = document.querySelector('header, nav, [class*="header"], [id*="header"]') || document.body;
  const logoish = (el: any) => /logo|brand|marque/i.test(`${el.id} ${typeof el.className === 'string' ? el.className : el.className?.baseVal || ''} ${el.getAttribute('alt') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('src') || ''}`);
  let logo: SiteLogo = { source: 'none' };
  const svg = (Array.from(header.querySelectorAll('svg')) as any[]).find((s) => logoish(s) || logoish(s.parentElement || s) || (s.closest('a') && s.closest('a').getAttribute('href') === '/'));
  if (svg && svg.outerHTML.length < 80000 && svg.getBoundingClientRect().width > 24) logo = { svg: svg.outerHTML, source: 'inline-svg' };
  if (logo.source === 'none') {
    const img = (Array.from(header.querySelectorAll('img')) as any[]).find((i) => logoish(i) || logoish(i.parentElement || i)) || (Array.from(header.querySelectorAll('a[href="/"] img')) as any[])[0];
    if (img?.currentSrc || img?.src) logo = { url: abs(img.currentSrc || img.src), source: 'img' };
  }
  const icon = (Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) as any[]).sort((a, b) => parseInt(b.getAttribute('sizes') || '0', 10) - parseInt(a.getAttribute('sizes') || '0', 10))[0];
  if (icon) logo.iconUrl = abs(icon.getAttribute('href'));
  const ogImage = abs(document.querySelector('meta[property="og:image"]')?.getAttribute('content'));
  // Pas d'étalement d'objet ici : la fonction tourne dans la page, sans les aides de TypeScript.
  if (logo.source === 'none' && logo.iconUrl) logo = { url: logo.iconUrl, iconUrl: logo.iconUrl, source: 'icon' };

  // Grandes images : celles qu'un visiteur voit en grand (héros, sections), et l'image de partage.
  const images = [
    ...(ogImage ? [ogImage] : []),
    ...(Array.from(document.images) as any[])
      .filter((i) => i.naturalWidth >= 600 && i.naturalHeight >= 400 && !logoish(i))
      .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
      .map((i) => abs(i.currentSrc || i.src)),
  ].filter((u, k, arr): u is string => !!u && !/\.svg(\?|$)/i.test(u) && arr.indexOf(u) === k).slice(0, 8);

  const text = (sel: string, n: number, min = 3) =>
    (Array.from(document.querySelectorAll(sel)) as any[]).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= min).slice(0, n);
  return {
    colors,
    fonts,
    stacks,
    logo,
    images,
    title: (document.title || '').trim(),
    siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || undefined,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined,
    language: (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase() || undefined,
    headings: text('h1, h2', 8),
    paragraphs: text('main p, section p, article p, p', 12, 40).map((p) => p.slice(0, 300)),
    links: (Array.from(document.querySelectorAll('a[href]')) as any[])
      .map((a) => ({ href: abs(a.getAttribute('href')) || '', text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) }))
      .filter((l) => l.href && l.text)
      .slice(0, 120),
    titleStyles,
    bodySizes,
    radii,
    buttons,
    inlineCss: (Array.from(document.querySelectorAll('style')) as any[])
      .map((st) => st.textContent || '')
      .filter((css: string) => css.indexOf('@font-face') >= 0)
      .join('\n')
      .slice(0, 600000),
  };
}

/** Les pages internes qui disent le plus de la marque. */
function pickInnerPages(links: { href: string; text: string }[], origin: string, max: number): string[] {
  const wanted = /(about|a-propos|à-propos|qui-sommes|notre-histoire|story|produit|product|service|boutique|shop|offre|menu|collection)/i;
  const out: string[] = [];
  for (const l of links) {
    if (out.length >= max) break;
    try {
      const u = new URL(l.href);
      if (u.origin !== origin || u.pathname === '/' || /\.(pdf|jpg|png|zip)$/i.test(u.pathname)) continue;
      if (!wanted.test(`${u.pathname} ${l.text}`)) continue;
      u.hash = '';
      if (!out.includes(u.toString())) out.push(u.toString());
    } catch {
      /* lien illisible */
    }
  }
  return out;
}

/** Les feuilles de style que la page a chargées (pour leurs `@font-face`). */
type Sheets = { url: string; css: string }[];

async function openPage(browser: Browser, url: string, timeoutMs: number, sheets?: Sheets): Promise<Page> {
  const page = await browser.newPage();
  if (sheets) {
    page.on('response', (res) => {
      if (res.request().resourceType() !== 'stylesheet' || sheets.length >= 30 || !res.ok()) return;
      res
        .text()
        .then((css) => {
          if (css.length < 800_000 && css.includes('@font-face')) sheets.push({ url: res.url(), css });
        })
        .catch(() => undefined);
    });
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 iVision/1.0');
  // Garde réseau : jamais d'adresse privée ; ni vidéo ni sons (inutiles au scan).
  await installRenderNetworkGuard(page, (req) => !['media', 'websocket', 'eventsource'].includes(req.resourceType()));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch(async (error: Error) => {
    if (/timeout/i.test(error.message)) return; // une page qui charge sans fin a quand même son premier écran
    throw error;
  });
  // Les sites qui révèlent leur contenu au défilement : on descend, puis on remonte.
  // Code passé en texte : une fonction transpilée emporterait des aides TypeScript absentes de la page.
  // Une redirection côté client pendant le défilement détruit le contexte : on attend la nouvelle page.
  await page.evaluate(`new Promise((done) => { let y = 0; const step = () => { if (y++ >= 3) { window.scrollTo(0, 0); return done(true); } window.scrollBy(0, window.innerHeight); setTimeout(step, 250); }; step(); })`).catch(async (error: Error) => {
    if (!/context was destroyed|detached/i.test(error.message)) throw error;
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined);
  });
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

const STYLE_IDS: ArtDirectionStyleId[] = ['minimalism', 'maximalism', 'futuristic', 'vector-art', 'collage-art', 'retro', 'cyberpunk', 'pop-art', 'glassmorphism', 'clay', 'pixel-art', 'editorial', 'y2k', 'swiss', 'surreal', 'bohemian', 'victorian', 'graffiti', 'aurora', 'handwritten'];

function parseJson(raw: string): Record<string, any> | null {
  const m = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/** Le ton, la promesse, le secteur : par le modèle s'il est là, sinon depuis les textes. */
async function readVoice(facts: PageFacts, brandName: string, model?: SiteScanOptions['textModel']): Promise<BrandVoice> {
  const fallback: BrandVoice = {
    brandName,
    valueProposition: (facts.description || facts.headings[0] || '').slice(0, 200) || undefined,
    language: facts.language || 'fr',
    keywords: keywordsOf([facts.title, facts.description || '', ...facts.headings].join(' ')),
  };
  if (!model) return fallback;
  const system = [
    'You read a company website and describe the brand for a motion designer. Answer ONLY a JSON object:',
    '{"brandName": "...", "businessType": "what they sell or do, 2-5 words", "valueProposition": "one sentence, in the site language", "tone": "3 adjectives", "keywords": ["5 short keywords"], "language": "fr|en|..."}',
    'Use only what the site says. Never invent prices, numbers or claims.',
  ].join('\n');
  const user = [`TITLE: ${facts.title}`, facts.siteName ? `SITE NAME: ${facts.siteName}` : '', facts.description ? `DESCRIPTION: ${facts.description}` : '', `HEADINGS: ${facts.headings.join(' | ')}`, `TEXT: ${facts.paragraphs.slice(0, 6).join(' ')}`].filter(Boolean).join('\n').slice(0, 3500);
  try {
    const json = parseJson(await model(system, user));
    if (!json) return fallback;
    return {
      brandName: String(json.brandName || brandName).slice(0, 60),
      businessType: json.businessType ? String(json.businessType).slice(0, 80) : undefined,
      valueProposition: json.valueProposition ? String(json.valueProposition).slice(0, 220) : fallback.valueProposition,
      tone: json.tone ? String(json.tone).slice(0, 80) : undefined,
      keywords: Array.isArray(json.keywords) ? json.keywords.map((k: unknown) => String(k).slice(0, 30)).slice(0, 6) : fallback.keywords,
      language: /^[a-z]{2}$/.test(String(json.language || '')) ? String(json.language) : fallback.language,
    };
  } catch (error) {
    logger.warn('site.voice_failed', { event: 'site.voice_failed', error });
    return fallback;
  }
}

/** Ce que la vision lit sur la capture, en plus de l'ébauche : la composition, les formes, les gestes. */
interface SeenArt {
  composition?: string;
  shapes?: string;
  ornaments?: string;
  typography?: string;
}

/** Une ébauche de direction artistique, lue sur la capture du haut de page. */
async function readArtDirection(screenshot: Buffer, brandName: string, vision?: SiteScanOptions['vision']): Promise<(Partial<ArtDirectionModel> & { seen?: SeenArt }) | undefined> {
  if (!vision) return undefined;
  const instruction = [
    `This is the top of the website of the brand "${brandName}". Describe its art direction precisely enough for a designer to make social-media visuals that look like they come from the same studio. Answer ONLY JSON:`,
    `{"styleId": one of ${STYLE_IDS.join('|')}, "keywords": ["4 concrete words: materials, light, objects"], "density": "airy|balanced|dense", "contrast": "soft|balanced|strong", "imagery": "photography|illustration|3d|mixed|none", "treatment": "how photos are treated (crop, colour grade, masks, overlays), 10 words", "composition": "how the hero is laid out: where the title, the image, the buttons sit and how much is empty, 25 words", "shapes": "rounded|sharp|organic|mixed, and where (buttons, images, sections), 12 words", "ornaments": "recurring graphic devices (rules, shapes, badges, patterns, gradients, outlines), 15 words", "typography": "how titles are set (case, weight, size contrast, tight or loose), 12 words", "signature": "the most recognisable graphic device, 8 words", "avoid": ["2 things this brand would never do"]}`,
  ].join('\n');
  try {
    const json = parseJson(await vision(screenshot.toString('base64'), 'image/jpeg', instruction));
    if (!json) return undefined;
    const said = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
    const styleId = STYLE_IDS.includes(json.styleId) ? (json.styleId as ArtDirectionStyleId) : 'minimalism';
    const keywords = Array.isArray(json.keywords) ? json.keywords.map(String).slice(0, 5) : [];
    return {
      styleId,
      styleName: styleId,
      tagline: keywords.join(' · '),
      rationale: 'Ébauche lue sur le site (scan iVision).',
      keywords,
      layout: { grid: '', density: String(json.density || ''), whitespace: json.density === 'airy' ? 'généreux' : '', signatureMove: String(json.signature || '') },
      color: { distribution: '', application: '', contrast: String(json.contrast || '') },
      typography: { scaleContrast: '', caseAndTracking: '', treatment: '' },
      imagery: { medium: String(json.imagery || 'photography'), subjects: '', treatment: String(json.treatment || ''), lighting: '', framing: '' },
      graphicDevices: json.signature ? [String(json.signature)] : [],
      dos: [],
      donts: Array.isArray(json.avoid) ? json.avoid.map(String).slice(0, 3) : [],
      imagePromptModifier: String(json.treatment || ''),
      seen: { composition: said(json.composition, 240), shapes: said(json.shapes, 140), ornaments: said(json.ornaments, 180), typography: said(json.typography, 140) },
    };
  } catch (error) {
    logger.warn('site.art_failed', { event: 'site.art_failed', error });
    return undefined;
  }
}

const STOP = new Set('le la les de des du un une et en à au aux pour par sur avec dans votre vos nos notre est sont plus the and for with your our you are from that this to of in on a an we it is'.split(' '));

function keywordsOf(text: string): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 4 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
}

function brandNameOf(facts: PageFacts, host: string): string {
  if (facts.siteName) return facts.siteName.trim().slice(0, 60);
  const fromTitle = facts.title.split(/\s[|–—-]\s|\s·\s|:/).map((s) => s.trim()).filter(Boolean);
  const short = fromTitle.sort((a, b) => a.length - b.length)[0];
  if (short && short.length <= 40) return short;
  const label = host.replace(/^www\./, '').split('.')[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const FORMATS: Record<string, SiteFontFace['format']> = { woff2: 'woff2', woff: 'woff', truetype: 'ttf', ttf: 'ttf', opentype: 'otf', otf: 'otf' };
const FORMAT_RANK: SiteFontFace['format'][] = ['woff2', 'woff', 'ttf', 'otf'];

/**
 * Les `@font-face` des feuilles du site : un fichier par famille, graisse et style (le meilleur format), le
 * sous-ensemble LATIN seulement — une police découpée par alphabets (cyrillique, grec…) n'a besoin que de lui
 * pour nos rendus. Une police variable (« font-weight: 100 900 ») sert à chacune des graisses utiles.
 */
export function parseFontFaces(sheets: { url: string; css: string }[]): SiteFontFace[] {
  const out = new Map<string, SiteFontFace>();
  for (const sheet of sheets) {
    for (const match of sheet.css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const body = match[1];
      const prop = (name: string) => body.match(new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+)`, 'i'))?.[1]?.trim();
      const family = cleanFamilyName(prop('font-family') || '');
      if (!family || /fallback/i.test(prop('font-family') || '')) continue;
      const range = prop('unicode-range');
      if (range && !/U\+0{0,4}(?:0|20)-0{0,2}(?:7E|7F|FF)\b/i.test(range.replace(/\s+/g, ''))) continue;
      const style: SiteFontFace['style'] = /italic|oblique/i.test(prop('font-style') || '') ? 'italic' : 'normal';
      const declared = (prop('font-weight') || '400').replace(/\bnormal\b/i, '400').replace(/\bbold\b/i, '700').split(/\s+/).map(Number).filter((n) => n >= 100 && n <= 1000);
      const lo = declared[0] ?? 400;
      const hi = declared[1] ?? lo;
      // Un même fichier variable pour chaque graisse utile : texte (400), titre (700), affiche (900).
      const weights = hi > lo ? [...new Set([400, 700, 900].filter((w) => w >= lo && w <= hi))] : [lo];
      if (!weights.length) weights.push(lo);
      const sources = [...(prop('src') || '').matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)\s*(?:format\(\s*['"]?([\w-]+)['"]?\s*\))?/gi)]
        .map((m) => {
          const raw = m[2].trim();
          const ext = (raw.match(/\.(woff2|woff|ttf|otf)(?:[?#]|$)/i)?.[1] || '').toLowerCase();
          const format = FORMATS[(m[3] || ext || (raw.startsWith('data:') ? (raw.match(/font\/(woff2|woff|ttf|otf)/)?.[1] ?? '') : '')).toLowerCase()];
          let url = raw;
          if (!raw.startsWith('data:')) {
            try {
              url = new URL(raw, sheet.url).toString();
            } catch {
              return null;
            }
          }
          return format && (url.startsWith('https://') || url.startsWith('http://') || /^data:[^;]+;base64,/.test(url)) ? { url, format } : null;
        })
        .filter((x): x is { url: string; format: SiteFontFace['format'] } => !!x)
        .sort((a, b) => FORMAT_RANK.indexOf(a.format) - FORMAT_RANK.indexOf(b.format));
      if (!sources.length) continue;
      for (const weight of weights) {
        const key = `${family.toLowerCase()}|${weight}|${style}`;
        if (!out.has(key)) out.set(key, { family, weight, style, url: sources[0].url, format: sources[0].format });
      }
    }
  }
  return [...out.values()].slice(0, 24);
}

const median = (values: number[]): number => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/**
 * Ce que le site montre de son style, en lignes factuelles : la direction artistique de la marque est tirée
 * de LUI (le site existe, on le codifie), pas d'un catalogue.
 */
function styleEvidenceOf(facts: PageFacts, palette: BrandPalette, typo: { display: string; body: string; original: { display?: string; body?: string } }, art: (Partial<ArtDirectionModel> & { seen?: SeenArt }) | undefined, voice: BrandVoice): string {
  const lines: string[] = [];
  const titles = facts.titleStyles;
  if (titles.length) {
    const upper = titles.filter((t) => t.transform === 'uppercase').length / titles.length > 0.5;
    const tracking = median(titles.map((t) => t.tracking));
    const ratio = median(titles.map((t) => t.size)) / Math.max(10, median(facts.bodySizes) || 16);
    lines.push(`Typography seen: titles in ${typo.original.display || typo.display} weight ${median(titles.map((t) => t.weight))}${upper ? ', UPPERCASE' : ', sentence case'}${Math.abs(tracking) >= 0.01 ? `, letter-spacing ${tracking > 0 ? '+' : ''}${tracking.toFixed(2)}em` : ''}; body in ${typo.original.body || typo.body}; title/body size ratio ${ratio.toFixed(1)}.`);
  }
  if (facts.radii.length) {
    const r = median(facts.radii);
    const kinds = facts.buttons.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b]: (acc[b] || 0) + 1 }), {});
    const button = Object.entries(kinds).sort((a, b) => b[1] - a[1])[0]?.[0];
    lines.push(`Shapes seen: corner radius ~${Math.round(r)}px (${r < 2 ? 'square corners' : r < 10 ? 'slightly rounded' : r < 24 ? 'rounded' : 'very rounded'})${button ? `; buttons are mostly ${button}` : ''}.`);
  }
  lines.push(`Colours as used on the site: background ${palette.background}, text ${palette.text}, primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}.`);
  if (art) {
    const seen = art.seen ?? {};
    lines.push(
      [
        `Read on the homepage: ${art.styleId ? `closest style ${art.styleId}` : ''}${art.layout?.density ? `, density ${art.layout.density}` : ''}${art.color?.contrast ? `, contrast ${art.color.contrast}` : ''}.`,
        seen.composition ? `Composition: ${seen.composition}.` : '',
        seen.typography ? `Titles: ${seen.typography}.` : '',
        seen.shapes ? `Shapes: ${seen.shapes}.` : '',
        seen.ornaments ? `Graphic devices: ${seen.ornaments}.` : '',
        art.layout?.signatureMove ? `Signature: ${art.layout.signatureMove}.` : '',
        art.imagery?.medium ? `Imagery: ${art.imagery.medium}${art.imagery.treatment ? `, ${art.imagery.treatment}` : ''}.` : '',
        art.donts?.length ? `Never: ${art.donts.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
  if (voice.tone || voice.keywords?.length) lines.push(`Voice: ${[voice.tone, voice.keywords?.join(', ')].filter(Boolean).join(' — ')}.`);
  return lines.join('\n').slice(0, 2400);
}

/** Le scan complet. */
export async function scanWebsite(options: SiteScanOptions): Promise<SiteScanResult> {
  const url = normalizeSiteUrl(options.url);
  if (!(await isRenderUrlAllowed(url))) throw new SiteScanError('blocked_url', 'Ce site n’est pas joignable depuis iVision (adresse privée ou inconnue).');
  const timeout = options.timeoutMs ?? 25_000;
  const progress = options.onProgress || (() => undefined);
  const warnings: string[] = [];
  // Sans cela, Chrome « monte » en https les redirections vers http (idem.africa → http://…/en/) et,
  // sous interception, abandonne la navigation au bout de 3 s : net::ERR_BLOCKED_BY_CLIENT.
  const browser = await puppeteer.launch({ headless: true, args: [...RENDER_BROWSER_ARGS, '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable'] });
  try {
    progress('open', { url });
    let home: Page;
    const sheets: Sheets = [];
    try {
      home = await openPage(browser, url, timeout, sheets);
    } catch (error) {
      throw new SiteScanError('unreachable', `Le site ne répond pas (${(error as Error).message.slice(0, 80)}).`);
    }
    const finalUrl = home.url();
    const facts: PageFacts = await home.evaluate(readPage);
    if (facts.inlineCss) sheets.push({ url: finalUrl, css: facts.inlineCss });
    const screenshot = Buffer.from(await home.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1440, height: 900 } }));
    await home.close();

    // Les pages internes complètent couleurs, polices, textes et images (poids réduit).
    const inner = pickInnerPages(facts.links, new URL(finalUrl).origin, Math.max(0, Math.min(2, options.maxPages ?? 2)));
    for (const pageUrl of inner) {
      try {
        const page = await openPage(browser, pageUrl, Math.min(timeout, 15_000), sheets);
        const more: PageFacts = await page.evaluate(readPage);
        if (more.inlineCss) sheets.push({ url: pageUrl, css: more.inlineCss });
        facts.titleStyles.push(...more.titleStyles);
        facts.bodySizes.push(...more.bodySizes);
        facts.radii.push(...more.radii);
        facts.buttons.push(...more.buttons);
        await page.close();
        facts.colors.push(...more.colors.map((c) => ({ ...c, weight: c.weight * 0.4 })));
        facts.fonts.push(...more.fonts.map((f) => ({ ...f, area: f.area * 0.4 })));
        Object.assign(facts.stacks, more.stacks);
        facts.paragraphs.push(...more.paragraphs.slice(0, 4));
        facts.images.push(...more.images.filter((i) => !facts.images.includes(i)).slice(0, 3));
      } catch (error) {
        warnings.push(`Page « ${new URL(pageUrl).pathname} » ignorée (ne répond pas).`);
      }
    }

    progress('colors', { seen: facts.colors.length });
    const clusters = clusterColors(facts.colors);
    const { palette, warnings: paletteWarnings } = paletteFromClusters(clusters);
    warnings.push(...paletteWarnings);

    progress('fonts', { seen: facts.fonts.length });
    const typo = typographyProposals(facts.fonts, facts.stacks);
    if (!typo.site.exactDisplay || !typo.site.exactBody) warnings.push(typo.proposals[0].rationale);

    progress('logo', { source: facts.logo.source });
    if (facts.logo.source === 'none') warnings.push('Aucun logo trouvé sur le site : ajoutez-le à la main (SVG ou PNG).');

    const brandName = brandNameOf(facts, new URL(finalUrl).hostname);
    progress('content', { brandName, headings: facts.headings.length });
    progress('voice');
    const [voice, read] = await Promise.all([readVoice(facts, brandName, options.textModel), (progress('art'), readArtDirection(screenshot, brandName, options.vision))]);
    const { seen, ...artDirection } = read ?? {};
    const wanted = new Set([typo.site.original.display, typo.site.original.body].filter((f): f is string => !!f).map((f) => cleanFamilyName(f).toLowerCase()));
    const fontFaces = parseFontFaces(sheets).filter((f) => wanted.has(f.family.toLowerCase()));
    progress('done');
    return {
      url,
      finalUrl,
      brandName: voice.brandName || brandName,
      title: facts.title,
      description: facts.description,
      language: voice.language || facts.language || 'fr',
      palette,
      palettes: paletteProposals(palette),
      colors: clusters.slice(0, 12),
      typography: { display: typo.site.display, body: typo.site.body, original: typo.site.original },
      typographies: typo.proposals,
      fontFaces,
      styleEvidence: styleEvidenceOf(facts, palette, typo.site, read ? { ...artDirection, seen } : undefined, voice),
      texts: { headings: facts.headings.slice(0, 10), paragraphs: facts.paragraphs.slice(0, 14) },
      logo: facts.logo,
      images: facts.images.slice(0, 8),
      voice,
      artDirection: read ? (artDirection as Partial<ArtDirectionModel>) : undefined,
      screenshot,
      pages: [finalUrl, ...inner],
      warnings,
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Le `BrandKit` d'un scan, avec la palette et la typographie choisies parmi les propositions. */
/**
 * Un SVG copié du DOM d'une page n'a souvent pas d'espace de noms (inutile en HTML) ; servi
 * seul (fichier, data-URI) il devient illisible. On l'ajoute, avec les dimensions du viewBox.
 */
export function standaloneSvg(svg: string): string {
  let out = svg.trim();
  if (!/^<svg\b/i.test(out)) return out;
  if (!/\sxmlns=/.test(out.slice(0, out.indexOf('>')))) out = out.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return out;
}

export function brandKitFromScan(scan: Pick<SiteScanResult, 'palettes' | 'typographies' | 'logo' | 'artDirection'>, choice: { palette?: string; typography?: string } = {}, hostedLogo?: { svg?: string; url?: string; iconUrl?: string }): BrandKit {
  const palette = (scan.palettes.find((p) => p.id === choice.palette) || scan.palettes[0]).colors;
  const typo = scan.typographies.find((t) => t.id === choice.typography) || scan.typographies[0];
  const logo = hostedLogo || scan.logo;
  return {
    colors: { colors: { ...palette } },
    typography: { primary: { family: typo.display, cssUrl: typo.displayCss }, secondary: { family: typo.body, cssUrl: typo.bodyCss } },
    logo: {
      ...(logo.svg ? { svg: standaloneSvg(logo.svg) } : {}),
      assetUrls: {
        ...(logo.url ? { primary: logo.url, withText: { lightBackground: logo.url } } : {}),
        ...(logo.iconUrl ? { icon: logo.iconUrl } : {}),
      },
    },
    artDirection: (scan.artDirection as ArtDirectionModel | undefined) || null,
  };
}

export { firstFamily };
