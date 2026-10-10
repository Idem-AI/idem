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
import { firstFamily, SeenFont, typographyProposals, TypographyProposal } from './typography';

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

async function openPage(browser: Browser, url: string, timeoutMs: number): Promise<Page> {
  const page = await browser.newPage();
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

/** Une ébauche de direction artistique, lue sur la capture du haut de page. */
async function readArtDirection(screenshot: Buffer, brandName: string, vision?: SiteScanOptions['vision']): Promise<Partial<ArtDirectionModel> | undefined> {
  if (!vision) return undefined;
  const instruction = [
    `This is the top of the website of the brand "${brandName}". Describe its art direction for a motion designer. Answer ONLY JSON:`,
    `{"styleId": one of ${STYLE_IDS.join('|')}, "keywords": ["4 words"], "density": "airy|balanced|dense", "contrast": "soft|balanced|strong", "imagery": "photography|illustration|3d|mixed|none", "treatment": "how photos are treated, 6 words", "signature": "the most recognisable graphic device, 8 words", "avoid": ["2 things this brand would never do"]}`,
  ].join('\n');
  try {
    const json = parseJson(await vision(screenshot.toString('base64'), 'image/jpeg', instruction));
    if (!json) return undefined;
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
    try {
      home = await openPage(browser, url, timeout);
    } catch (error) {
      throw new SiteScanError('unreachable', `Le site ne répond pas (${(error as Error).message.slice(0, 80)}).`);
    }
    const finalUrl = home.url();
    const facts: PageFacts = await home.evaluate(readPage);
    const screenshot = Buffer.from(await home.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1440, height: 900 } }));
    await home.close();

    // Les pages internes complètent couleurs, polices, textes et images (poids réduit).
    const inner = pickInnerPages(facts.links, new URL(finalUrl).origin, Math.max(0, Math.min(2, options.maxPages ?? 2)));
    for (const pageUrl of inner) {
      try {
        const page = await openPage(browser, pageUrl, Math.min(timeout, 15_000));
        const more: PageFacts = await page.evaluate(readPage);
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
    const [voice, artDirection] = await Promise.all([readVoice(facts, brandName, options.textModel), (progress('art'), readArtDirection(screenshot, brandName, options.vision))]);
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
      logo: facts.logo,
      images: facts.images.slice(0, 8),
      voice,
      artDirection,
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
