/**
 * Linter « slop » pour les livrables HTML.
 *
 * Le prompt DEMANDE de ne pas produire les marqueurs génériques ; ce module
 * VÉRIFIE qu'ils ne sont pas là, et répare ce qui peut l'être sans modèle. La
 * différence compte : une consigne de prompt est respectée la plupart du temps,
 * ce qui, à l'échelle d'un document de douze pages, garantit qu'il en reste.
 *
 * Le coût est nul (des expressions régulières sur une chaîne, aucun appel IA),
 * donc la vérification peut tourner sur CHAQUE section produite.
 *
 * Deux niveaux :
 *  - `lintHtml` : diagnostic, journalisé et réinjectable dans une passe de
 *    correction ;
 *  - `repairHtml` : corrections déterministes de ce qui a une bonne réponse
 *    unique (couleur hors charte → couleur de charte la plus proche, police
 *    arbitraire → police de la marque, image sans alt, logo absent). Ce qui
 *    relève du goût n'est jamais « réparé » en aveugle, seulement signalé.
 */

import logger from '../../config/logger';

export type SlopSeverity = 'error' | 'warning';

export interface SlopViolation {
  rule: string;
  severity: SlopSeverity;
  message: string;
  /** Ce qu'il faut faire à la place, formulé pour être réinjecté dans un prompt. */
  fix: string;
  /** Extrait fautif, tronqué. */
  excerpt?: string;
  /** Nombre d'occurrences. */
  count: number;
}

export interface BrandPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface SlopLintOptions {
  /** Palette de la charte : toute autre valeur hexadécimale est hors charte. */
  palette?: BrandPalette;
  /** Familles typographiques autorisées (celles de la charte). */
  fonts?: string[];
  /** URLs de logo attendues : au moins une doit être référencée. */
  expectedLogoUrls?: string[];
  /**
   * Couleurs légitimes en plus de la palette.
   *
   * Sur un visuel social, les teintes dominantes de la photo servent
   * légitimement au traitement de l'image (duotone, voile, filtre) : les
   * ramener à la couleur de charte la plus proche détruirait les stratégies
   * IMAGE_EXTRACTED et SPLIT_COMPLEMENTARY. Elles sont donc déclarées ici
   * plutôt que traitées comme des couleurs inventées.
   */
  extraAllowedColors?: string[];
  /**
   * Identifiant du style de direction artistique. Certains marqueurs
   * (glassmorphisme, dégradés, arrondis) sont des défauts par défaut mais des
   * choix légitimes quand le style les prescrit.
   */
  styleId?: string;
  /** Contexte pour les journaux. */
  label?: string;
}

export interface SlopLintReport {
  violations: SlopViolation[];
  errorCount: number;
  warningCount: number;
  /** Consigne de correction prête à être réinjectée, ou null si tout va bien. */
  repairPrompt: string | null;
}

/** Styles pour lesquels un marqueur cesse d'être un défaut. */
const STYLE_EXEMPTIONS: Record<string, string[]> = {
  'gradient-decorative': ['aurora', 'y2k', 'glassmorphism', 'futuristic', 'cyberpunk'],
  glassmorphism: ['glassmorphism', 'y2k', 'futuristic'],
  'heavy-radius': ['clay', 'bohemian', 'y2k', 'glassmorphism', 'retro', 'vector-art'],
  'neon-glow': ['cyberpunk', 'futuristic', 'aurora', 'y2k'],
  emoji: ['handwritten'],
};

const BUZZWORDS = [
  'révolutionnaire',
  'solution clé en main',
  'propulsez',
  'boostez',
  'libérez le potentiel',
  "à l'ère du numérique",
  'dans un monde en constante évolution',
  'au cœur de votre réussite',
  'elevate your',
  'unlock the',
  'empower your',
  'supercharge',
  'seamless',
  'cutting-edge',
  'game-chang',
  'next-generation',
  'world-class',
  'harness the power',
  'take it to the next level',
];

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /\b(Fonctionnalité|Feature|Card|Item|Section|Service|Produit)\s?(Un|Deux|Trois|One|Two|Three|1|2|3)\b/,
  /Votre (entreprise|marque|logo|texte) ici/i,
  /Your (Company|Brand|Product) (Name|Here)/i,
  /\bXXX+\b|\bTODO\b|\[à compléter\]/i,
];

/** Polices que le modèle écrit par défaut quand on ne le contraint pas. */
const DEFAULT_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Source Sans',
  'Helvetica Neue',
  'Arial',
  'system-ui',
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

/** Gris/blanc/noir neutres : tolérés partout, ils ne trahissent aucune marque. */
const NEUTRAL_HEX = new Set([
  '#fff',
  '#ffffff',
  '#000',
  '#000000',
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#0f172a',
]);

function isExempt(rule: string, styleId?: string): boolean {
  if (!styleId) return false;
  return (STYLE_EXEMPTIONS[rule] || []).includes(styleId);
}

function normaliseHex(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = normaliseHex(hex);
  if (!/^#[0-9a-f]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** Distance euclidienne RGB : suffisante pour ramener une couleur à la charte. */
function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  return Math.sqrt((ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2);
}

function paletteHexes(palette?: BrandPalette): string[] {
  if (!palette) return [];
  return [palette.primary, palette.secondary, palette.accent, palette.background, palette.text]
    .filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(c.trim()))
    .map((c) => normaliseHex(c.trim()));
}

/** Palette de la charte + couleurs explicitement tolérées pour ce rendu. */
function allowedHexes(options: SlopLintOptions): string[] {
  const extra = (options.extraAllowedColors || [])
    .filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(c.trim()))
    .map((c) => normaliseHex(c.trim()));
  return [...new Set([...paletteHexes(options.palette), ...extra])];
}

/** Couleur de la charte la plus proche d'une valeur hors charte. */
export function nearestPaletteColor(hex: string, palette?: BrandPalette): string | null {
  const candidates = paletteHexes(palette);
  if (!candidates.length) return null;
  let best = candidates[0];
  let bestDistance = colorDistance(hex, best);
  for (const candidate of candidates.slice(1)) {
    const d = colorDistance(hex, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

/** Empreinte stable d'une URL de logo : le nom de fichier survit aux query-strings. */
function logoFingerprint(url: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed.slice(0, 64);
  const filename = trimmed.split('?')[0].split('/').filter(Boolean).pop();
  return filename && filename.length > 3 ? filename : trimmed;
}

export function lintHtml(html: string, options: SlopLintOptions = {}): SlopLintReport {
  const violations: SlopViolation[] = [];
  const source = html || '';

  const add = (
    rule: string,
    severity: SlopSeverity,
    message: string,
    fix: string,
    count: number,
    excerpt?: string
  ) => {
    if (count > 0) violations.push({ rule, severity, message, fix, count, excerpt });
  };

  const countOf = (re: RegExp): number => (source.match(re) || []).length;

  // ── Niveau 0 ────────────────────────────────────────────────────────────
  if (!isExempt('gradient-decorative', options.styleId)) {
    add(
      'purple-gradient',
      'error',
      'Purple / indigo / fuchsia gradient: the single most recognisable marker of a generated render.',
      'Replace it with a flat colour from the charter palette.',
      countOf(/(from|via|to)-(purple|violet|indigo|fuchsia)-\d{2,3}/g) +
        countOf(/linear-gradient\([^)]*(#7c3aed|#8b5cf6|#6366f1|#a855f7)/gi)
    );
  }

  add(
    'gradient-text',
    'error',
    'Gradient headline (bg-clip-text): decoration with no intent.',
    'Set the headline in one charter colour; create emphasis through weight or size.',
    countOf(/bg-clip-text/g) + countOf(/background-clip:\s*text/g)
  );

  const allowedFonts = (options.fonts || [])
    .filter(Boolean)
    .map((f) => f.toLowerCase().replace(/['"]/g, '').trim());
  const strayFonts = DEFAULT_FONTS.filter(
    (font) =>
      !allowedFonts.includes(font.toLowerCase()) &&
      new RegExp(`["'\\[]\\s*${font}\\b|family=${font.replace(/ /g, '\\+')}\\b`, 'i').test(source)
  );
  add(
    'default-font',
    'error',
    `Off-charter default typeface detected: ${strayFonts.join(', ')}.`,
    'Use only the two charter families, through the font-primary / font-secondary classes.',
    strayFonts.length,
    strayFonts.join(', ')
  );

  add(
    'generic-font-class',
    'warning',
    'font-sans / font-serif / font-mono class: the render falls back to a system typeface.',
    'Replace it with font-primary (headings) or font-secondary (running text).',
    countOf(/\bfont-(sans|serif|mono)\b/g)
  );

  // Couleurs hors charte.
  const palette = allowedHexes(options);
  if (paletteHexes(options.palette).length) {
    const stray = new Set<string>();
    for (const raw of source.match(HEX_RE) || []) {
      const hex = normaliseHex(raw);
      if (NEUTRAL_HEX.has(hex) || palette.includes(hex)) continue;
      stray.add(hex);
    }
    add(
      'off-palette-color',
      'error',
      `Off-charter colours: ${[...stray].slice(0, 8).join(', ')}.`,
      'Keep only the charter palette values (tints come from opacity, not from a hue shift).',
      stray.size,
      [...stray].slice(0, 8).join(', ')
    );
  }

  if (!isExempt('glassmorphism', options.styleId)) {
    add(
      'glassmorphism',
      'warning',
      'Reflexive glassmorphism (backdrop-blur over a translucent white surface).',
      'Use an opaque surface from the palette; keep blur for genuinely floating layers only.',
      countOf(/backdrop-blur/g)
    );
  }

  if (!isExempt('heavy-radius', options.styleId)) {
    add(
      'rounded-shadow-everywhere',
      'warning',
      'The "rounded-2xl + shadow-lg" pair applied to everything: a generic template.',
      'One border radius across the whole deliverable, the art direction one, and no decorative shadow.',
      Math.max(0, countOf(/rounded-(2xl|3xl)/g) - 2)
    );
  }

  // ── Niveau 1 ────────────────────────────────────────────────────────────
  add(
    'side-stripe',
    'warning',
    'A coloured rule on a single card edge: never a deliberate choice.',
    'Use a full border, a tinted background, or no separator at all.',
    countOf(/border-[lr]-(2|4|8)\b/g)
  );

  const eyebrows = countOf(/uppercase[^"']*tracking-(wide|wider|widest)/g);
  add(
    'repeated-eyebrow',
    'warning',
    'The tiny uppercase tracked eyebrow repeated above every block.',
    'Keep at most one, as a brand element, and let the headings carry the sections.',
    eyebrows >= 2 ? eyebrows : 0
  );

  add(
    'light-gray-body',
    'warning',
    'Light grey running text: it fails AA contrast and sits outside the charter.',
    'Use the charter text colour, at 70% opacity for secondary text if needed.',
    countOf(/text-(gray|slate|zinc|neutral|stone)-(300|400|500)\b/g)
  );

  add(
    'stock-tailwind-color',
    'warning',
    'Stock Tailwind colours sitting next to the brand palette.',
    'Use only the charter hex values.',
    countOf(/\b(bg|text|border)-(blue|indigo|purple|violet|emerald|teal|rose|amber|cyan)-(400|500|600|700)\b/g)
  );

  if (!isExempt('emoji', options.styleId)) {
    add(
      'emoji',
      'warning',
      'Emoji used as an icon or as a bullet.',
      'Use a PrimeIcons icon, a drawn shape, or nothing.',
      EMOJI_RE.test(source) ? (source.match(new RegExp(EMOJI_RE, 'gu')) || []).length : 0
    );
  }

  const lower = source.toLowerCase();
  const foundBuzz = BUZZWORDS.filter((w) => lower.includes(w));
  add(
    'buzzwords',
    'warning',
    `Empty marketing vocabulary: ${foundBuzz.slice(0, 5).join(', ')}.`,
    'Write what the brand does, with a concrete noun and a verb.',
    foundBuzz.length,
    foundBuzz.slice(0, 5).join(', ')
  );

  const placeholders = PLACEHOLDER_PATTERNS.filter((re) => re.test(source));
  add(
    'placeholder-content',
    'error',
    'Filler content left in the output.',
    'Write the real content of the project.',
    placeholders.length
  );

  add(
    'img-without-alt',
    'warning',
    'Image without an alt attribute.',
    'Add a descriptive alt, or alt="" when the image is purely decorative.',
    (source.match(/<img\b[^>]*>/g) || []).filter((tag) => !/\balt=/.test(tag)).length
  );

  add(
    'dead-link',
    'warning',
    'Link pointing at href="#".',
    'Point it at a real destination, or remove the link.',
    countOf(/href=["']#["']/g)
  );

  // ── Logo ────────────────────────────────────────────────────────────────
  const fingerprints = (options.expectedLogoUrls || [])
    .map(logoFingerprint)
    .filter((f): f is string => Boolean(f));
  if (fingerprints.length && !fingerprints.some((f) => source.includes(f))) {
    violations.push({
      rule: 'logo-missing',
      severity: 'error',
      message: 'The brand logo was supplied but appears nowhere in the render.',
      fix: `Place exactly one logo image, using one of the supplied URLs: <img src="${(options.expectedLogoUrls || [])[0]}" alt="logo" />`,
      count: 1,
    });
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.length - errorCount;

  if (violations.length && options.label) {
    logger.info(`[SlopLint] ${options.label}: ${errorCount} erreur(s), ${warningCount} avertissement(s)`, {
      rules: violations.map((v) => `${v.rule}×${v.count}`),
    });
  }

  return {
    violations,
    errorCount,
    warningCount,
    repairPrompt: violations.length ? buildRepairPrompt(violations) : null,
  };
}

/** Consigne de correction, à réinjecter dans une passe de retouche bornée. */
export function buildRepairPrompt(violations: SlopViolation[]): string {
  const lines = violations
    .slice(0, 12)
    .map((v) => `- [${v.severity === 'error' ? 'BLOCKING' : 'To fix'}] ${v.message} → ${v.fix}`);
  return [
    'The render carries markers of automatic generation. Fix the following WITHOUT recomposing the page (same blocks, same positions, same copy):',
    ...lines,
  ].join('\n');
}

export interface SlopRepairResult {
  html: string;
  /** Règles effectivement corrigées. */
  applied: string[];
}

/**
 * Corrections déterministes.
 *
 * Volontairement limitées à ce qui a une réponse unique et vérifiable. Réparer
 * « la mise en page est générique » demanderait de recomposer : c'est le travail
 * du modèle, pas d'une expression régulière — cette fonction lui prépare
 * simplement un terrain sans fautes mécaniques.
 */
export function repairHtml(html: string, options: SlopLintOptions = {}): SlopRepairResult {
  let out = html || '';
  const applied: string[] = [];

  // 1. Couleurs hors charte → couleur de charte la plus proche.
  //    Les couleurs tolérées (teintes de la photo) sont laissées intactes.
  const palette = allowedHexes(options);
  if (paletteHexes(options.palette).length) {
    let replaced = 0;
    out = out.replace(HEX_RE, (raw) => {
      const hex = normaliseHex(raw);
      if (NEUTRAL_HEX.has(hex) || palette.includes(hex)) return raw;
      // Le repli vise la palette de la CHARTE, jamais une couleur tolérée :
      // corriger une couleur inventée en la remplaçant par une teinte de photo
      // n'aurait aucun sens de marque.
      const nearest = nearestPaletteColor(hex, options.palette);
      if (!nearest) return raw;
      replaced += 1;
      return nearest;
    });
    if (replaced) applied.push(`off-palette-color×${replaced}`);
  }

  // 2. Familles typographiques arbitraires → classes de la charte.
  const before = out;
  out = out
    .replace(/\bfont-\[(?:'[^']*'|"[^"]*")\]/g, 'font-primary')
    .replace(/\bfont-(sans|serif|mono)\b/g, 'font-secondary');
  if (out !== before) applied.push('default-font');

  // 3. Images sans alt : l'accessibilité ne se négocie pas, et un alt manquant
  //    casse aussi le repérage du logo au rendu.
  const withAlt = out.replace(/<img\b((?:(?!alt=)[^>])*)>/g, (tag, attrs) =>
    /\balt=/.test(tag) ? tag : `<img${attrs} alt="">`
  );
  if (withAlt !== out) {
    out = withAlt;
    applied.push('img-without-alt');
  }

  // 4. Titre en dégradé : on retire l'écrêtage, la couleur reprend le dessus.
  if (/bg-clip-text/.test(out)) {
    out = out
      .replace(/\bbg-clip-text\b/g, '')
      .replace(/\btext-transparent\b/g, '')
      .replace(/background-clip:\s*text;?/g, '');
    applied.push('gradient-text');
  }

  if (applied.length && options.label) {
    logger.info(`[SlopLint] ${options.label}: corrections déterministes appliquées`, { applied });
  }

  return { html: out, applied };
}
