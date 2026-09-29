import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from '../../config/logger';
import { brandFontFaceStyle } from '../../utils/brand-font.util';
import { installRenderNetworkGuard } from '../../utils/render-network-guard';
import { PdfService } from '../pdf.service';

/**
 * Les images de partage d'IDEM (Open Graph / X), dessinées à la demande.
 *
 * Une image = le gabarit `public/og/template.html`, les textes d'une page dans
 * une langue (`public/og/i18n/<langue>.json`), une illustration africaine
 * (`public/og/illustrations/<clé>.svg`), le motif et les jetons du design
 * system. Tout se modifie dans ces fichiers ; aucun texte n'est écrit ici.
 *
 * En production les sources sont lues une fois ; en développement elles sont
 * relues à chaque requête, pour voir une modification au rechargement. Les
 * images sont gardées en mémoire, indexées par l'empreinte de leur HTML : une
 * modification des sources donne une nouvelle empreinte, donc une nouvelle
 * image, sans purge à faire.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const OG_DIR = path.join(process.cwd(), 'public', 'og');
const MOTIF_FILE = path.join(process.cwd(), 'public', 'assets', 'images', 'motif.png');
const LOGO_FILE = path.join(process.cwd(), 'public', 'logo.png');

/** Les jetons du design system dont le gabarit a besoin, pris dans le thème clair. */
const DESIGN_TOKENS = [
  '--idem-bg-darker',
  '--idem-text-primary',
  '--idem-text-secondary',
  '--idem-text-tertiary',
  '--idem-heading',
    '--idem-motif-strength',
  '--color-primary-500',
  '--color-secondary-500',
];

interface OgPageText {
  /** Nom du service ou de la rubrique ; vide = masqué (le logo suffit). */
  eyebrow: string;
  title: string;
  subtitle: string;
}

interface OgDictionary {
  lang: string;
  pages: Record<string, OgPageText>;
}

interface OgSources {
  template: string;
  dictionaries: Map<string, OgDictionary>;
  illustrations: Map<string, string>;
  tokens: string;
  fonts: string;
  motif: string;
  logo: string;
}

export interface OgImage {
  png: Buffer;
  etag: string;
}

const MAX_CACHED = 120;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dataUri = (file: string, mime: string): string =>
  `data:${mime};base64,${readFileSync(file).toString('base64')}`;

/**
 * Les valeurs CLAIRES des jetons, lues dans `@idem/shared-styles`. Les images
 * de partage sont toujours au thème clair (politique de surface claire) :
 *  1. les jetons de thème sont pris dans le bloc `:root, .light { … }`, et
 *     nulle part ailleurs ;
 *  2. les autres (couleurs de marque, force du motif) sont cherchés dans le
 *     reste de la feuille, blocs sombres (`.dark`, `html.dark …`) retirés.
 * Un jeton sombre ne peut donc pas entrer dans une image, même si l'ordre
 * des blocs du design system change.
 */
function readDesignTokens(): string {
  try {
    const css = readFileSync(require.resolve('@idem/shared-styles/styles.css'), 'utf8');
    const light = /:root,\s*\.light\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const withoutDark = css.replace(/(^|\n)[^\n{}]*\.dark\b[^{]*\{[\s\S]*?\n\}/g, '');
    const declarations = DESIGN_TOKENS.map((name) => {
      const pattern = new RegExp(`${name}:\\s*([^;]+);`);
      const match = pattern.exec(light) ?? pattern.exec(withoutDark);
      if (!match) logger.warn(`[og] jeton ${name} introuvable dans le thème clair du design system`);
      return match ? `  ${name}: ${match[1].trim()};` : '';
    }).filter(Boolean);
    return `:root {\n  color-scheme: light;\n${declarations.join('\n')}\n}`;
  } catch (error) {
    logger.error('[og] design system introuvable — images rendues sans jetons', error);
    return '';
  }
}

function loadSources(): OgSources {
  const dictionaries = new Map<string, OgDictionary>();
  for (const file of readdirSync(path.join(OG_DIR, 'i18n'))) {
    if (!file.endsWith('.json')) continue;
    const dict = JSON.parse(readFileSync(path.join(OG_DIR, 'i18n', file), 'utf8')) as OgDictionary;
    dictionaries.set(path.basename(file, '.json'), dict);
  }

  const illustrations = new Map<string, string>();
  for (const file of readdirSync(path.join(OG_DIR, 'illustrations'))) {
    if (!file.endsWith('.svg')) continue;
    illustrations.set(
      path.basename(file, '.svg'),
      readFileSync(path.join(OG_DIR, 'illustrations', file), 'utf8'),
    );
  }

  return {
    // Les commentaires du gabarit (sa notice) ne partent pas dans l'image.
    template: readFileSync(path.join(OG_DIR, 'template.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, ''),
    dictionaries,
    illustrations,
    tokens: readDesignTokens(),
    fonts: brandFontFaceStyle(),
    motif: existsSync(MOTIF_FILE) ? dataUri(MOTIF_FILE, 'image/png') : '',
    logo: dataUri(LOGO_FILE, 'image/png'),
  };
}

class OgImageService {
  private sources: OgSources | null = null;
  private readonly cache = new Map<string, OgImage>();
  private readonly inflight = new Map<string, Promise<OgImage>>();

  private getSources(): OgSources {
    if (process.env.NODE_ENV !== 'production') return loadSources();
    if (!this.sources) this.sources = loadSources();
    return this.sources;
  }

  /** Vrai si la page existe dans cette langue et a son dessin. */
  has(lang: string, key: string): boolean {
    const sources = this.getSources();
    return !!sources.dictionaries.get(lang)?.pages[key] && sources.illustrations.has(key);
  }

  /** Le document HTML de l'image, tel qu'il sera photographié. */
  renderHtml(lang: string, key: string): string {
    const sources = this.getSources();
    const dict = sources.dictionaries.get(lang);
    const page = dict?.pages[key];
    const illustration = sources.illustrations.get(key);
    if (!dict || !page || !illustration) throw new Error(`Image de partage inconnue : ${lang}/${key}`);

    const raw: Record<string, string> = {
      tokens: sources.tokens,
      fonts: sources.fonts,
      illustration,
    };
    const text: Record<string, string> = {
      lang: dict.lang,
      eyebrow: page.eyebrow,
      title: page.title,
      subtitle: page.subtitle,
      motif: sources.motif,
      logo: sources.logo,
    };

    // Dans le titre et la phrase, `**…**` met un passage en valeur
    // (couleur primaire, classe `.hl` du gabarit). Le reste est échappé.
    const highlighted = new Set(['title', 'subtitle']);
    return sources.template
      .replace(/\{\{\{\s*([\w-]+)\s*\}\}\}/g, (_m, name: string) => raw[name] ?? '')
      .replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_m, name: string) => {
        const value = escapeHtml(text[name] ?? '');
        return highlighted.has(name) ? value.replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>') : value;
      });
  }

  /** L'image PNG (1200 × 630), dessinée au premier appel puis servie de la mémoire. */
  async renderPng(lang: string, key: string): Promise<OgImage> {
    const html = this.renderHtml(lang, key);
    const etag = `"${createHash('sha1').update(html).digest('hex').slice(0, 20)}"`;

    const cached = this.cache.get(etag);
    if (cached) return cached;

    const pending = this.inflight.get(etag);
    if (pending) return pending;

    const job = this.capture(html)
      .then((png) => {
        const image = { png, etag };
        this.cache.set(etag, image);
        if (this.cache.size > MAX_CACHED) {
          const oldest = this.cache.keys().next().value;
          if (oldest) this.cache.delete(oldest);
        }
        return image;
      })
      .finally(() => this.inflight.delete(etag));

    this.inflight.set(etag, job);
    return job;
  }

  private async capture(html: string): Promise<Buffer> {
    const started = Date.now();
    const browser = await PdfService.sharedBrowser();
    const page = await browser.newPage();
    try {
      await installRenderNetworkGuard(page);
      await page.setViewport({ width: OG_WIDTH, height: OG_HEIGHT, deviceScaleFactor: 1 });
      // Toujours au thème clair, quel que soit le réglage du système qui rend.
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      // Le gabarit ajuste le titre une fois la police prête, puis se déclare prêt.
      await page.waitForSelector('body[data-ready]', { timeout: 10000 }).catch(() => undefined);
      const shot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
      });
      const png = await sharp(Buffer.from(shot))
        .png({ compressionLevel: 9, palette: true, quality: 92, effort: 8 })
        .toBuffer();
      logger.info(`[og] image rendue en ${Date.now() - started} ms (${Math.round(png.length / 1024)} Ko)`);
      return png;
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}

export const ogImageService = new OgImageService();
