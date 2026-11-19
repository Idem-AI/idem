/**
 * Compilateur du design system — posé par IDEM, NE PAS MODIFIER.
 *
 * Entrée : `src/design-system/design-system.json`, la configuration du projet
 * (couleurs, typographies, rayons, recettes des composants, mouvement).
 * Sorties : les variables CSS lues par Tailwind et par les composants
 * (`theme.generated.css`), les réglages des composants
 * (`component-config.generated.json`) et les feuilles des polices.
 *
 * Le même fichier tourne à deux endroits : sur le serveur IDEM, au moment de
 * la génération, et dans le projet, par le plugin Vite, chaque fois que
 * `design-system.json` change. Il n'a donc aucune dépendance.
 *
 * Ce que le compilateur contrôle : la FORME (types, unités, couleurs lisibles
 * par un navigateur). Une valeur mal formée est signalée dans le rapport et
 * remplacée par sa valeur par défaut. Il ne juge pas l'esthétique : il ne note
 * rien, ne cherche pas « mieux », ne régénère rien. La seule retouche qu'il se
 * permet est d'accessibilité — un texte posé sur une couleur doit se lire
 * (contraste WCAG AA) — et elle est écrite dans le rapport.
 */

export const SCHEMA_VERSION = 1;
export const COMPILER_VERSION = '1.1.0';

/* -------------------------------------------------------------------------- */
/*  Configuration par défaut                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CONFIG = {
  schemaVersion: SCHEMA_VERSION,
  appearance: { colorMode: 'light', density: 'comfortable' },
  tokens: {
    colors: {
      background: '#ffffff',
      foreground: '#111827',
      primary: '#2563eb',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingWeight: 650,
      bodyWeight: 400,
      baseSize: '1rem',
      scale: 1.2,
      headingLineHeight: 1.1,
      bodyLineHeight: 1.6,
      headingLetterSpacing: '-0.02em',
      headingCase: 'none',
      eyebrowCase: 'uppercase',
    },
    radius: { base: '0.5rem' },
    borders: { width: '1px', tone: 'normal', style: 'solid' },
    elevation: { style: 'soft' },
    spacing: {},
  },
  components: {
    button: { variant: 'primary', size: 'md', case: 'none', shadow: 'none', shape: 'uniform', hover: 'darken', press: 'none' },
    input: { style: 'outline' },
    card: { variant: 'outline', elevation: 'none', shape: 'uniform', hover: 'none', accent: 'none' },
    badge: { variant: 'soft', case: 'none', shape: 'uniform' },
    link: { hover: 'none' },
  },
  motion: {
    durationMs: 300,
    staggerMs: 70,
    easing: 'standard',
    intensity: 'moderate',
    respectReducedMotion: true,
  },
};

const ENUMS = {
  colorMode: ['light', 'dark'],
  density: ['compact', 'comfortable', 'spacious'],
  textCase: ['none', 'uppercase'],
  elevationStyle: ['none', 'subtle', 'soft', 'pronounced', 'hard'],
  shadowLevel: ['none', 'sm', 'md', 'lg', 'xl'],
  buttonVariant: ['primary', 'secondary', 'outline', 'ghost', 'accent'],
  size: ['sm', 'md', 'lg'],
  inputStyle: ['outline', 'filled', 'underline'],
  cardVariant: ['outline', 'flat', 'elevated', 'filled'],
  badgeVariant: ['soft', 'solid', 'outline'],
  // Formes : le rayon donne la courbure, la forme dit OÙ elle s'applique (coins égaux, un coin sur deux, haut seul…).
  buttonShape: ['uniform', 'square', 'pill', 'leaf', 'leaf-reverse', 'tab'],
  cardShape: ['uniform', 'square', 'leaf', 'leaf-reverse', 'tab', 'arch', 'blob'],
  badgeShape: ['uniform', 'square', 'pill'],
  // Survols et appui : ce que fait un bouton ou une carte quand on le survole.
  buttonHover: ['darken', 'lift', 'invert', 'slide', 'glow', 'grow', 'shift', 'underline', 'arrow', 'ring', 'tilt'],
  buttonPress: ['none', 'sink', 'shrink'],
  cardHover: ['none', 'lift', 'border', 'tint', 'zoom', 'shadow', 'shift', 'bar', 'glow', 'rise', 'tilt'],
  cardAccent: ['none', 'top', 'left', 'bottom'],
  linkHover: ['none', 'underline', 'bar'],
  // Bordures : leur teinte (de presque invisible à l'encre pleine), leur trait.
  borderTone: ['hairline', 'soft', 'normal', 'strong', 'ink', 'brand'],
  borderStyle: ['solid', 'dashed', 'dotted', 'double'],
  intensity: ['none', 'subtle', 'moderate', 'expressive'],
  easing: ['standard', 'emphasized', 'gentle', 'snappy', 'linear'],
};

const COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'cardForeground',
  'popover',
  'popoverForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'border',
  'input',
  'ring',
];

/* -------------------------------------------------------------------------- */
/*  Couleurs                                                                   */
/* -------------------------------------------------------------------------- */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinear({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (linear) => linear.every((v) => v >= -0.0001 && v <= 1.0001);

/** OKLCH → sRGB ; hors gamut, la chroma est réduite plutôt que la couleur écrêtée. */
function oklchToRgb({ L, C, H }) {
  const lab = (c) => ({ L, a: c * Math.cos((H * Math.PI) / 180), b: c * Math.sin((H * Math.PI) / 180) });
  let linear = oklabToLinear(lab(C));
  if (!inGamut(linear)) {
    let low = 0;
    let high = C;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklabToLinear(lab(mid)))) low = mid;
      else high = mid;
    }
    linear = oklabToLinear(lab(low));
  }
  const [r, g, b] = linear.map((v) => Math.round(clamp(toGamma(clamp(v, 0, 1)), 0, 1) * 255));
  return { r, g, b };
}

function rgbToOklch(rgb) {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

const NUMBER = '[-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?';

function parseNumber(token, percentScale = 1) {
  const value = parseFloat(token);
  if (!Number.isFinite(value)) return NaN;
  return token.trim().endsWith('%') ? (value / 100) * percentScale : value;
}

function parseHue(token) {
  const value = parseFloat(token);
  if (!Number.isFinite(value)) return NaN;
  if (/turn$/.test(token)) return value * 360;
  if (/rad$/.test(token)) return (value * 180) / Math.PI;
  return value;
}

/** Les arguments d'une fonction de couleur, virgules ou espaces, alpha ignoré. */
function argumentsOf(body) {
  return body
    .split('/')[0]
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Une couleur CSS → `{ r, g, b }` (0-255), ou `null`.
 * Formes lues : `#rgb`, `#rrggbb` (alpha ignoré), `rgb()`, `hsl()`, `oklch()`,
 * et le triplet nu de shadcn (`210 40% 50%`, lu comme du HSL).
 */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();

  const hex = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = digits.split('').map((c) => c + c).join('');
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    };
  }

  const fn = text.match(/^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/);
  const bareHsl = new RegExp(`^(${NUMBER})(deg)?\\s+(${NUMBER})%\\s+(${NUMBER})%$`).test(text);
  const name = fn ? fn[1] : bareHsl ? 'hsl' : null;
  const args = fn ? argumentsOf(fn[2]) : bareHsl ? argumentsOf(text) : null;
  if (!name || !args || args.length < 3) return null;

  if (name.startsWith('rgb')) {
    const [r, g, b] = args.slice(0, 3).map((arg) => parseNumber(arg, 255));
    if ([r, g, b].some((v) => !Number.isFinite(v))) return null;
    return { r: Math.round(clamp(r, 0, 255)), g: Math.round(clamp(g, 0, 255)), b: Math.round(clamp(b, 0, 255)) };
  }

  if (name.startsWith('hsl')) {
    const h = parseHue(args[0]);
    const s = parseFloat(args[1]) / 100;
    const l = parseFloat(args[2]) / 100;
    if ([h, s, l].some((v) => !Number.isFinite(v))) return null;
    return hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 1), clamp(l, 0, 1));
  }

  const L = parseNumber(args[0], 1);
  const C = parseNumber(args[1], 0.4);
  const H = parseHue(args[2]);
  if ([L, C, H].some((v) => !Number.isFinite(v))) return null;
  return oklchToRgb({ L: clamp(L > 1 ? L / 100 : L, 0, 1), C: clamp(C, 0, 0.5), H: ((H % 360) + 360) % 360 });
}

const channels = ({ r, g, b }) => `${r} ${g} ${b}`;
const hexOf = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

function luminance({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

/** Mélange perceptuel (OKLab) : `t = 0` donne `a`, `t = 1` donne `b`. */
function mix(a, b, t) {
  const x = rgbToOklab(a);
  const y = rgbToOklab(b);
  const lab = { L: x.L + (y.L - x.L) * t, a: x.a + (y.a - x.a) * t, b: x.b + (y.b - x.b) * t };
  const C = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  const H = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return oklchToRgb({ L: lab.L, C, H });
}

const WHITE = { r: 255, g: 255, b: 255 };

/** Le texte le plus lisible sur un fond : blanc, ou l'encre du site. */
function readableOn(background, ink) {
  return contrast(WHITE, background) >= contrast(ink, background) ? WHITE : ink;
}

/**
 * Un texte rendu lisible sur son fond, en ne bougeant que sa luminosité.
 * Rend `null` quand il se lisait déjà.
 */
function ensureReadable(foreground, background, target) {
  if (contrast(foreground, background) >= target) return null;
  const color = rgbToOklch(foreground);
  const darker = luminance(background) > 0.18;
  for (let step = 1; step <= 50; step++) {
    const L = clamp(color.L + (darker ? -0.02 : 0.02) * step, 0, 1);
    const candidate = oklchToRgb({ ...color, L });
    if (contrast(candidate, background) >= target) return candidate;
    if (L === 0 || L === 1) break;
  }
  return contrast(WHITE, background) >= contrast({ r: 0, g: 0, b: 0 }, background) ? WHITE : { r: 0, g: 0, b: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Lecture structurelle                                                       */
/* -------------------------------------------------------------------------- */

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em|%))$/;

function reader(input, fallback, errors) {
  const at = (source, path) =>
    path.split('.').reduce((node, key) => (isObject(node) ? node[key] : undefined), source);

  const take = (path, check, describe) => {
    const value = at(input, path);
    const backup = at(fallback, path);
    if (value === undefined || value === null || value === '') return backup;
    const read = check(value);
    if (read !== undefined) return read;
    errors.push(`${path} : ${describe} attendu, reçu ${JSON.stringify(value).slice(0, 60)}`);
    return backup;
  };

  return {
    enumOf: (path, values) => take(path, (v) => (values.includes(v) ? v : undefined), `une valeur parmi ${values.join(', ')}`),
    length: (path) =>
      take(
        path,
        (v) => {
          if (typeof v === 'number' && Number.isFinite(v)) return v === 0 ? '0' : `${v}px`;
          if (v === 'full') return '9999px';
          return typeof v === 'string' && LENGTH.test(v.trim()) ? v.trim() : undefined;
        },
        'une longueur CSS (px, rem, em, %)'
      ),
    number: (path, min, max) =>
      take(
        path,
        (v) => {
          const n = typeof v === 'string' ? Number(v) : v;
          return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
        },
        `un nombre entre ${min} et ${max}`
      ),
    boolean: (path) => take(path, (v) => (typeof v === 'boolean' ? v : undefined), 'un booléen'),
    font: (path) =>
      take(
        path,
        (v) => (typeof v === 'string' && /^[\p{L}\p{N} '&.-]{2,60}$/u.test(v.trim()) ? v.trim() : undefined),
        'un nom de famille de police'
      ),
    url: (path) =>
      take(path, (v) => (typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v.trim()) ? v.trim() : undefined), 'une adresse https'),
    color: (path) =>
      take(path, (v) => (parseColor(v) ? String(v).trim() : undefined), 'une couleur CSS (hex, rgb, hsl, oklch)'),
    easing: (path) =>
      take(
        path,
        (v) =>
          ENUMS.easing.includes(v)
            ? v
            : Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
              ? v.map((n, i) => (i % 2 === 0 ? clamp(n, 0, 1) : clamp(n, -2, 3)))
              : undefined,
        `une courbe parmi ${ENUMS.easing.join(', ')} ou quatre nombres de cubic-bezier`
      ),
  };
}

/**
 * La configuration complète et bien formée : chaque champ du modèle est
 * vérifié, chaque champ absent ou invalide reprend la valeur de `defaults`.
 */
function normalize(input, defaults, errors) {
  const r = reader(input, defaults, errors);

  const colors = {};
  for (const key of COLOR_KEYS) {
    const value = r.color(`tokens.colors.${key}`);
    if (value) colors[key] = value;
  }

  const optional = (value) => (value === undefined ? {} : value);
  const pick = (entries) => Object.fromEntries(entries.filter(([, value]) => value !== undefined));

  return {
    schemaVersion: SCHEMA_VERSION,
    appearance: {
      colorMode: r.enumOf('appearance.colorMode', ENUMS.colorMode),
      density: r.enumOf('appearance.density', ENUMS.density),
    },
    tokens: {
      colors,
      typography: pick([
        ['headingFont', r.font('tokens.typography.headingFont')],
        ['bodyFont', r.font('tokens.typography.bodyFont')],
        ['headingFontUrl', r.url('tokens.typography.headingFontUrl')],
        ['bodyFontUrl', r.url('tokens.typography.bodyFontUrl')],
        ['headingWeight', r.number('tokens.typography.headingWeight', 100, 900)],
        ['bodyWeight', r.number('tokens.typography.bodyWeight', 100, 900)],
        ['baseSize', r.length('tokens.typography.baseSize')],
        ['scale', r.number('tokens.typography.scale', 1.05, 1.5)],
        ['headingLineHeight', r.number('tokens.typography.headingLineHeight', 0.85, 1.6)],
        ['bodyLineHeight', r.number('tokens.typography.bodyLineHeight', 1.2, 2)],
        ['headingLetterSpacing', r.length('tokens.typography.headingLetterSpacing')],
        ['headingCase', r.enumOf('tokens.typography.headingCase', ENUMS.textCase)],
        ['eyebrowCase', r.enumOf('tokens.typography.eyebrowCase', ENUMS.textCase)],
      ]),
      radius: pick([
        ['base', r.length('tokens.radius.base')],
        ['button', r.length('tokens.radius.button')],
        ['input', r.length('tokens.radius.input')],
        ['card', r.length('tokens.radius.card')],
        ['badge', r.length('tokens.radius.badge')],
      ]),
      borders: pick([
        ['width', r.length('tokens.borders.width')],
        ['tone', r.enumOf('tokens.borders.tone', ENUMS.borderTone)],
        ['style', r.enumOf('tokens.borders.style', ENUMS.borderStyle)],
      ]),
      elevation: pick([
        ['style', r.enumOf('tokens.elevation.style', ENUMS.elevationStyle)],
        ['tint', r.color('tokens.elevation.tint')],
      ]),
      spacing: pick([
        ['section', r.length('tokens.spacing.section')],
        ['gutter', r.length('tokens.spacing.gutter')],
        ['contentWidth', r.length('tokens.spacing.contentWidth')],
      ]),
    },
    components: {
      button: pick([
        ['variant', r.enumOf('components.button.variant', ENUMS.buttonVariant)],
        ['size', r.enumOf('components.button.size', ENUMS.size)],
        ['height', r.length('components.button.height')],
        ['paddingX', r.length('components.button.paddingX')],
        ['weight', r.number('components.button.weight', 100, 900)],
        ['borderWidth', r.length('components.button.borderWidth')],
        ['letterSpacing', r.length('components.button.letterSpacing')],
        ['case', r.enumOf('components.button.case', ENUMS.textCase)],
        ['shadow', r.enumOf('components.button.shadow', ENUMS.shadowLevel)],
        ['shape', r.enumOf('components.button.shape', ENUMS.buttonShape)],
        ['hover', r.enumOf('components.button.hover', ENUMS.buttonHover)],
        ['press', r.enumOf('components.button.press', ENUMS.buttonPress)],
      ]),
      input: pick([
        ['style', r.enumOf('components.input.style', ENUMS.inputStyle)],
        ['height', r.length('components.input.height')],
        ['borderWidth', r.length('components.input.borderWidth')],
      ]),
      card: pick([
        ['variant', r.enumOf('components.card.variant', ENUMS.cardVariant)],
        ['borderWidth', r.length('components.card.borderWidth')],
        ['elevation', r.enumOf('components.card.elevation', ENUMS.shadowLevel)],
        ['padding', r.length('components.card.padding')],
        ['shape', r.enumOf('components.card.shape', ENUMS.cardShape)],
        ['hover', r.enumOf('components.card.hover', ENUMS.cardHover)],
        ['accent', r.enumOf('components.card.accent', ENUMS.cardAccent)],
      ]),
      badge: pick([
        ['variant', r.enumOf('components.badge.variant', ENUMS.badgeVariant)],
        ['case', r.enumOf('components.badge.case', ENUMS.textCase)],
        ['shape', r.enumOf('components.badge.shape', ENUMS.badgeShape)],
      ]),
      link: pick([['hover', r.enumOf('components.link.hover', ENUMS.linkHover)]]),
    },
    motion: pick([
      ['durationMs', r.number('motion.durationMs', 0, 2000)],
      ['staggerMs', r.number('motion.staggerMs', 0, 600)],
      ['easing', r.easing('motion.easing')],
      ['intensity', r.enumOf('motion.intensity', ENUMS.intensity)],
      ['respectReducedMotion', r.boolean('motion.respectReducedMotion')],
      ...Object.entries(
        optional(
          isObject(input?.motion?.spring) || isObject(defaults?.motion?.spring)
            ? {
                spring: pick([
                  ['stiffness', r.number('motion.spring.stiffness', 20, 1000)],
                  ['damping', r.number('motion.spring.damping', 2, 100)],
                ]),
              }
            : undefined
        )
      ),
    ]),
  };
}

/* -------------------------------------------------------------------------- */
/*  Dérivations                                                                */
/* -------------------------------------------------------------------------- */

/** Les couleurs sémantiques au complet : celles données, puis celles qui s'en déduisent. */
function resolveColors(config, report) {
  const given = config.tokens.colors;
  const read = (key) => (given[key] ? parseColor(given[key]) : null);
  const out = {};
  const derive = (key, value) => {
    out[key] = value;
    report.derived.push(key);
  };

  const background = read('background') ?? WHITE;
  const foreground = read('foreground') ?? (luminance(background) > 0.18 ? { r: 17, g: 24, b: 39 } : { r: 245, g: 245, b: 245 });
  out.background = background;
  out.foreground = foreground;
  if (!given.foreground) report.derived.push('foreground');

  const primary = read('primary') ?? { r: 37, g: 99, b: 235 };
  out.primary = primary;

  for (const [key, value] of [
    ['card', () => background],
    ['cardForeground', () => foreground],
    ['popover', () => background],
    ['popoverForeground', () => foreground],
    ['primaryForeground', () => readableOn(primary, foreground)],
    ['secondary', () => mix(background, primary, 0.1)],
    ['muted', () => mix(background, foreground, 0.05)],
    ['destructive', () => ({ r: 220, g: 38, b: 38 })],
    // La teinte vient du projet : de presque invisible (filet) à l'encre pleine (éditorial, brutaliste), ou aux couleurs de
    // la marque. Avant : toujours 13 % du texte sur le fond, donc des bordures identiques d'un site à l'autre.
    ['border', () => {
      const tone = config.tokens.borders?.tone ?? 'normal';
      if (tone === 'brand') return mix(background, primary, 0.5);
      return mix(background, foreground, { hairline: 0.07, soft: 0.1, normal: 0.13, strong: 0.38, ink: 0.88 }[tone] ?? 0.13);
    }],
  ]) {
    const color = read(key);
    if (color) out[key] = color;
    else derive(key, value());
  }

  for (const [key, value] of [
    ['secondaryForeground', () => foreground],
    ['mutedForeground', () => mix(foreground, background, 0.38)],
    ['accent', () => out.secondary],
    ['destructiveForeground', () => readableOn(out.destructive, foreground)],
    ['input', () => out.border],
    ['ring', () => primary],
  ]) {
    const color = read(key);
    if (color) out[key] = color;
    else derive(key, value());
  }

  const accentForeground = read('accentForeground');
  if (accentForeground) out.accentForeground = accentForeground;
  else derive('accentForeground', readableOn(out.accent, foreground));

  // Accessibilité : chaque texte se lit sur son fond (AA, 4,5:1). Un texte
  // posé sur un aplat de couleur (bouton, bandeau) passe au blanc ou à
  // l'encre ; un texte courant garde sa teinte et ne change que de luminosité.
  const FILLS = new Set(['primary', 'accent', 'destructive']);
  for (const [text, ground] of [
    ['foreground', 'background'],
    ['cardForeground', 'card'],
    ['popoverForeground', 'popover'],
    ['primaryForeground', 'primary'],
    ['secondaryForeground', 'secondary'],
    ['mutedForeground', 'background'],
    ['mutedForeground', 'muted'],
    ['accentForeground', 'accent'],
    ['destructiveForeground', 'destructive'],
  ]) {
    const solid = FILLS.has(ground) && contrast(out[text], out[ground]) < 4.5 ? readableOn(out[ground], out.foreground) : null;
    const fixed = ensureReadable(solid ?? out[text], out[ground], 4.5) ?? solid;
    if (fixed) {
      report.adjusted.push(`${text} sur ${ground} : ${hexOf(out[text])} → ${hexOf(fixed)} (contraste AA)`);
      out[text] = fixed;
    }
  }

  return out;
}

const SERIF = /serif|playfair|garamond|lora|merriweather|fraunces|baskerville|crimson|cormorant|bodoni|georgia|libre caslon|spectral|newsreader|instrument serif|dm serif|prata|marcellus|cinzel|abril/i;
const MONO = /mono|code|courier/i;

function fontStack(name) {
  const fallback = MONO.test(name)
    ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
    : SERIF.test(name) && !/sans/i.test(name)
      ? 'ui-serif, Georgia, Cambria, "Times New Roman", serif'
      : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  return `"${name.replace(/"/g, '')}", ${fallback}`;
}

/**
 * Une feuille Google Fonts par famille, par l'API historique : elle sert les
 * graisses qui existent et ignore les autres, là où l'API v2 refuse la
 * requête entière pour une seule graisse absente.
 */
function googleFontHref(name, weights) {
  const family = encodeURIComponent(name).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css?family=${family}:${weights.join(',')}&display=swap`;
}

const toRem = (length, base = 16) => {
  const value = parseFloat(length);
  if (/rem$|em$/.test(length)) return value;
  if (/px$/.test(length)) return value / base;
  return value;
};

/** Une taille fluide : `min` sur mobile (320 px), `max` à partir de 1280 px. */
const fluid = (min, max) =>
  min >= max ? `${round(max)}rem` : `clamp(${round(min)}rem, calc(${round(min)}rem + ${round(max - min)} * ((100vw - 20rem) / 60)), ${round(max)}rem)`;

const DENSITY = {
  compact: { control: 2.25, controlSm: 2, controlLg: 2.75, section: 4.5, paddingX: 0.875, card: 1.25 },
  comfortable: { control: 2.625, controlSm: 2.25, controlLg: 3.125, section: 6.5, paddingX: 1.25, card: 1.5 },
  spacious: { control: 2.875, controlSm: 2.5, controlLg: 3.5, section: 8.5, paddingX: 1.5, card: 2 },
};

const EASINGS = {
  standard: [0.4, 0, 0.2, 1],
  emphasized: [0.16, 1, 0.3, 1],
  gentle: [0.25, 0.1, 0.25, 1],
  snappy: [0.3, 0, 0, 1],
  linear: [0, 0, 1, 1],
};

const MOTION_DISTANCE = { none: 0, subtle: 8, moderate: 18, expressive: 36 };
const MOTION_SCALE = { none: 1, subtle: 1, moderate: 0.98, expressive: 0.94 };

function shadows(style, tint) {
  const c = channels(tint);
  const scales = {
    none: null,
    subtle: [
      `0 1px 2px rgb(${c} / 0.05)`,
      `0 1px 3px rgb(${c} / 0.08), 0 1px 2px rgb(${c} / 0.04)`,
      `0 8px 24px -8px rgb(${c} / 0.12)`,
      `0 18px 40px -14px rgb(${c} / 0.16)`,
    ],
    soft: [
      `0 2px 6px -1px rgb(${c} / 0.07)`,
      `0 8px 20px -6px rgb(${c} / 0.12)`,
      `0 18px 44px -12px rgb(${c} / 0.18)`,
      `0 32px 64px -20px rgb(${c} / 0.24)`,
    ],
    pronounced: [
      `0 2px 8px -1px rgb(${c} / 0.12)`,
      `0 10px 24px -6px rgb(${c} / 0.2)`,
      `0 22px 48px -12px rgb(${c} / 0.28)`,
      `0 36px 72px -18px rgb(${c} / 0.36)`,
    ],
    hard: [`2px 2px 0 0 rgb(${c})`, `4px 4px 0 0 rgb(${c})`, `6px 6px 0 0 rgb(${c})`, `8px 8px 0 0 rgb(${c})`],
  }[style];
  const [sm, md, lg, xl] = scales ?? ['none', 'none', 'none', 'none'];
  return { none: 'none', sm, md, lg, xl };
}

/* -------------------------------------------------------------------------- */
/*  Formes, survols, bordures : le CSS des composants                          */
/*                                                                            */
/*  Les variables (`:root`) donnent les valeurs ; ce bloc donne les GESTES —    */
/*  ce qui se passe quand on survole ou appuie, et la forme des coins. Il      */
/*  n'émet que le geste CHOISI par le projet : un site n'embarque pas les      */
/*  onze survols de bouton, seulement le sien.                                 */
/*                                                                            */
/*  Spécificité : un geste est `.ds-button:hover` (0,2,0). Il l'emporte sur    */
/*  l'état de repos d'une classe utilitaire (0,1,0) mais cède, à égalité et    */
/*  par l'ordre, à un `hover:…` écrit par l'appelant : une section qui veut son */
/*  propre survol l'obtient.                                                   */
/* -------------------------------------------------------------------------- */

/** Où s'applique la courbure : un rayon `r` devient une liste de quatre coins. */
const SHAPES = {
  uniform: (r) => r,
  square: () => '0px',
  pill: () => '9999px',
  leaf: (r) => `${r} 0px ${r} 0px`,
  'leaf-reverse': (r) => `0px ${r} 0px ${r}`,
  tab: (r) => `${r} ${r} 0px 0px`,
  arch: (r) => `calc(${r} * 3) calc(${r} * 3) ${r} ${r}`,
  blob: (r) => `calc(${r} * 2) calc(${r} * 0.4) calc(${r} * 2) calc(${r} * 0.4)`,
};
const shapeOf = (shape, r) => (SHAPES[shape] ?? SHAPES.uniform)(r);

/** Chaque variante de bouton nomme ses couleurs ; les gestes les lisent, sans connaître la variante. */
const BUTTON_VARIANTS = {
  primary: { bg: 'rgb(var(--primary))', fg: 'rgb(var(--primary-foreground))', bd: 'transparent', ink: 'var(--primary)', hoverBg: 'rgb(var(--primary) / 0.9)', hoverBd: 'transparent', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
  secondary: { bg: 'rgb(var(--secondary))', fg: 'rgb(var(--secondary-foreground))', bd: 'transparent', ink: 'var(--foreground)', hoverBg: 'rgb(var(--secondary) / 0.75)', hoverBd: 'transparent', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
  accent: { bg: 'rgb(var(--accent))', fg: 'rgb(var(--accent-foreground))', bd: 'transparent', ink: 'var(--accent)', hoverBg: 'rgb(var(--accent) / 0.8)', hoverBd: 'transparent', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
  outline: { bg: 'transparent', fg: 'rgb(var(--foreground))', bd: 'rgb(var(--input))', ink: 'var(--foreground)', hoverBg: 'rgb(var(--muted))', hoverBd: 'rgb(var(--foreground) / 0.4)', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
  ghost: { bg: 'transparent', fg: 'rgb(var(--foreground))', bd: 'transparent', ink: 'var(--foreground)', hoverBg: 'rgb(var(--muted))', hoverBd: 'transparent', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
  destructive: { bg: 'rgb(var(--destructive))', fg: 'rgb(var(--destructive-foreground))', bd: 'transparent', ink: 'var(--destructive)', hoverBg: 'rgb(var(--destructive) / 0.9)', hoverBd: 'transparent', invBg: 'rgb(var(--foreground))', invFg: 'rgb(var(--background))' },
};

/** Un geste : ce qui change à la couleur (`color`, partout) et ce qui BOUGE (`motion`, sauf si l'utilisateur le refuse). */
const BUTTON_HOVER = {
  darken: { color: 'background-color: var(--btn-hover-bg); border-color: var(--btn-hover-bd);' },
  lift: { color: 'box-shadow: 0 12px 24px -12px rgb(var(--btn-ink) / 0.6);', motion: 'transform: translateY(-2px);' },
  invert: { color: 'background-color: var(--btn-inv-bg); color: var(--btn-inv-fg); border-color: var(--btn-inv-bg);' },
  slide: { rest: 'background-image: linear-gradient(var(--btn-inv-bg), var(--btn-inv-bg)); background-repeat: no-repeat; background-position: left center; background-size: 0% 100%;', color: 'background-size: 100% 100%; color: var(--btn-inv-fg); border-color: var(--btn-inv-bg);' },
  glow: { color: 'box-shadow: 0 0 0 4px rgb(var(--btn-ink) / 0.16), 0 10px 28px -6px rgb(var(--btn-ink) / 0.55);' },
  grow: { color: 'background-color: var(--btn-hover-bg);', motion: 'transform: scale(1.05);' },
  shift: { rest: 'box-shadow: 4px 4px 0 0 rgb(var(--foreground));', color: 'box-shadow: 2px 2px 0 0 rgb(var(--foreground));', motion: 'transform: translate(2px, 2px);' },
  underline: { color: 'background-color: var(--btn-hover-bg); border-color: var(--btn-hover-bd); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 5px;' },
  arrow: { color: 'background-color: var(--btn-hover-bg); border-color: var(--btn-hover-bd);', svg: 'transform: translateX(4px);' },
  ring: { color: 'background-color: var(--btn-hover-bg); box-shadow: 0 0 0 3px rgb(var(--btn-ink) / 0.28);' },
  tilt: { color: 'background-color: var(--btn-hover-bg);', motion: 'transform: translateY(-1px) rotate(-1.5deg);' },
};
const BUTTON_PRESS = { none: '', sink: 'transform: translateY(1px);', shrink: 'transform: scale(0.96);' };

const CARD_HOVER = {
  none: {},
  lift: { color: 'box-shadow: var(--shadow-lg);', motion: 'transform: translateY(-4px);' },
  border: { color: 'border-color: rgb(var(--primary));' },
  tint: { color: 'background-color: rgb(var(--muted));', tile: true },
  zoom: { tile: true, zoom: true },
  shadow: { color: 'box-shadow: var(--shadow-xl);' },
  shift: { rest: 'box-shadow: 4px 4px 0 0 rgb(var(--foreground));', color: 'box-shadow: 2px 2px 0 0 rgb(var(--foreground));', motion: 'transform: translate(2px, 2px);' },
  bar: { rest: 'background-image: linear-gradient(rgb(var(--primary)), rgb(var(--primary))); background-repeat: no-repeat; background-position: left bottom; background-size: 0% 3px;', color: 'background-size: 100% 3px;' },
  glow: { color: 'box-shadow: 0 0 0 1px rgb(var(--primary) / 0.4), 0 18px 40px -16px rgb(var(--primary) / 0.5);', tile: true },
  rise: { color: 'border-color: rgb(var(--primary)); box-shadow: var(--shadow-lg);', motion: 'transform: translateY(-4px);', tile: true },
  tilt: { color: 'box-shadow: var(--shadow-md);', motion: 'transform: translateY(-3px) rotate(-0.8deg);' },
};

const ACCENT_STRIP = {
  top: 'background-position: left top; background-size: 100% 3px;',
  left: 'background-position: left top; background-size: 3px 100%;',
  bottom: 'background-position: left bottom; background-size: 100% 3px;',
};

const TRANSITION = 'transition-property: color, background-color, border-color, box-shadow, opacity, transform, background-size; transition-duration: var(--motion-duration); transition-timing-function: var(--motion-ease);';

/**
 * Le CSS des gestes du projet. Les valeurs (rayons, bordures, ombres) restent des variables de `:root` ; ici, ce qui se
 * passe au survol et à l'appui, le trait d'accent des cartes, le soulignement des liens.
 */
function componentsCss(c) {
  const out = [];
  const buttonHover = BUTTON_HOVER[c.button.hover] ?? BUTTON_HOVER.darken;
  const press = BUTTON_PRESS[c.button.press] ?? '';

  // Boutons : les couleurs de chaque variante sous des noms communs, lues par le repos et par les gestes.
  for (const [name, v] of Object.entries(BUTTON_VARIANTS)) {
    out.push(`:where(.ds-btn-${name}) { --btn-bg: ${v.bg}; --btn-fg: ${v.fg}; --btn-bd: ${v.bd}; --btn-ink: ${v.ink}; --btn-hover-bg: ${v.hoverBg}; --btn-hover-bd: ${v.hoverBd}; --btn-inv-bg: ${v.invBg}; --btn-inv-fg: ${v.invFg}; }`);
  }
  // L'ombre réglée du bouton (`components.button.shadow`) est celle du bouton principal, comme avant.
  out.push('.ds-btn-primary { box-shadow: var(--shadow-button); }');
  out.push(`.ds-button { background-color: var(--btn-bg); color: var(--btn-fg); border-color: var(--btn-bd); ${TRANSITION}${buttonHover.rest ? ` ${buttonHover.rest}` : ''} }`);
  out.push('.ds-button svg { transition: transform var(--motion-duration) var(--motion-ease); }');
  const hovered = [buttonHover.color, buttonHover.svg ? '' : ''].filter(Boolean).join(' ');
  out.push('@media (hover: hover) {');
  if (hovered) out.push(`  .ds-button:hover { ${hovered} }`);
  if (buttonHover.svg) out.push(`  .ds-button:hover svg { ${buttonHover.svg} }`);
  out.push('}');
  if (buttonHover.motion || press) {
    out.push('@media (prefers-reduced-motion: no-preference) {');
    if (buttonHover.motion) out.push(`  @media (hover: hover) { .ds-button:hover { ${buttonHover.motion} } }`);
    if (press) out.push(`  .ds-button:active { ${press} }`);
    out.push('}');
  }
  // Un bouton « ombre dure » s'enfonce quand on le presse, quel que soit l'appui choisi.
  if (c.button.hover === 'shift') out.push('@media (prefers-reduced-motion: no-preference) { .ds-button:active { transform: translate(4px, 4px); box-shadow: 0 0 0 0 transparent; } }');

  // Cartes.
  const cardHover = CARD_HOVER[c.card.hover] ?? CARD_HOVER.none;
  const accent = ACCENT_STRIP[c.card.accent];
  const cardRest = [
    TRANSITION,
    accent ? `background-image: linear-gradient(rgb(var(--primary)), rgb(var(--primary))); background-repeat: no-repeat; ${accent}` : '',
    cardHover.rest ?? '',
  ].filter(Boolean).join(' ');
  out.push(`.ds-card { ${cardRest} }`);
  if (cardHover.color || cardHover.motion || cardHover.zoom || cardHover.tile) {
    out.push('@media (hover: hover) {');
    if (cardHover.color) out.push(`  .ds-card:hover { ${cardHover.color} }`);
    if (cardHover.zoom || cardHover.tile) {
      out.push('  .ds-card img, .ds-tile img { transition: transform 700ms var(--motion-ease); }');
      out.push('  @media (prefers-reduced-motion: no-preference) { .ds-card:hover :where(.overflow-hidden) img, .ds-tile:hover img { transform: scale(1.06); } }');
    }
    out.push('}');
    if (cardHover.motion) out.push(`@media (prefers-reduced-motion: no-preference) and (hover: hover) { .ds-card:hover { ${cardHover.motion} } }`);
  }

  // Liens de navigation et de pied de page.
  if (c.link.hover === 'underline') {
    out.push('@media (hover: hover) { :where(header nav a, footer a):not(.ds-button):hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 6px; text-decoration-color: rgb(var(--primary)); } }');
  } else if (c.link.hover === 'bar') {
    out.push(':where(header nav a, footer a):not(.ds-button) { background-image: linear-gradient(rgb(var(--primary)), rgb(var(--primary))); background-repeat: no-repeat; background-position: left bottom; background-size: 0% 2px; padding-bottom: 2px; transition: background-size var(--motion-duration) var(--motion-ease), color var(--motion-duration) var(--motion-ease); }');
    out.push('@media (hover: hover) { :where(header nav a, footer a):not(.ds-button):hover { background-size: 100% 2px; } }');
  }
  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Compilation                                                                */
/* -------------------------------------------------------------------------- */

function cssName(key) {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Compile une configuration.
 *
 * @param {unknown} input           la configuration (souvent écrite par un modèle)
 * @param {{ defaults?: object }} [options]  valeurs de repli champ par champ (la charte du projet)
 * @returns {{
 *   config: object, css: string, componentConfig: object, fonts: string[],
 *   report: { errors: string[], derived: string[], adjusted: string[], files: string[] }
 * }}
 */
export function compileDesignSystem(input, options = {}) {
  const report = { errors: [], derived: [], adjusted: [], files: [] };
  const defaults = mergeDeep(DEFAULT_CONFIG, isObject(options.defaults) ? options.defaults : {});
  if (!isObject(input)) report.errors.push('la configuration doit être un objet JSON');

  const config = normalize(isObject(input) ? input : {}, defaults, report.errors);
  const t = config.tokens;
  const c = config.components;
  const density = DENSITY[config.appearance.density] ?? DENSITY.comfortable;
  const colors = resolveColors(config, report);

  // Typographie.
  const base = toRem(t.typography.baseSize ?? '1rem');
  const scale = t.typography.scale ?? 1.2;
  const step = (n) => base * scale ** n;
  // [mobile, bureau] en rem. Les titres montent de deux crans de l'échelle à
  // chaque niveau au-dessus de h3 : un titre d'ouverture doit dominer la page.
  const size = (n, floor, ratio, ceiling) => {
    const max = Math.min(step(n), ceiling);
    return [Math.min(max, Math.max(floor, max * ratio)), max];
  };
  const sizes = {
    small: [step(-1), step(-1)],
    body: [base, base],
    lead: size(1, base, 0.94, 1.5),
    h4: size(1.5, base * 1.1, 0.9, 1.75),
    h3: size(2.5, base * 1.2, 0.82, 2.25),
    h2: size(4, base * 1.5, 0.7, 3.25),
    h1: size(5.5, base * 1.85, 0.6, 4.5),
    display: size(7, base * 2.2, 0.55, 6),
  };

  const radiusBase = t.radius.base ?? '0.5rem';
  const radius = {
    base: radiusBase,
    button: t.radius.button ?? radiusBase,
    input: t.radius.input ?? radiusBase,
    card: t.radius.card ?? `calc(${radiusBase} * 1.5)`,
    badge: t.radius.badge ?? radiusBase,
  };

  const tint = t.elevation.tint ? parseColor(t.elevation.tint) : colors.foreground;
  const shadow = shadows(t.elevation.style ?? 'soft', tint ?? colors.foreground);
  const borderStyle = t.borders.style ?? 'solid';
  // Un trait double a besoin de trois pixels pour se voir comme double (en dessous, le navigateur le trace plein).
  const borderWidth = borderStyle === 'double' && parseFloat(t.borders.width ?? '1') < 3 ? '3px' : t.borders.width ?? '1px';

  const fonts = [];
  const headingFont = t.typography.headingFont ?? 'Inter';
  const bodyFont = t.typography.bodyFont ?? 'Inter';
  const headingWeight = t.typography.headingWeight ?? 650;
  const bodyWeight = t.typography.bodyWeight ?? 400;
  const weightsFor = (...extra) =>
    Array.from(new Set([400, 500, 600, 700, ...extra.map((w) => Math.round(w / 100) * 100)])).sort((a, b) => a - b);
  if (t.typography.headingFontUrl) fonts.push(t.typography.headingFontUrl);
  else fonts.push(googleFontHref(headingFont, weightsFor(headingWeight, c.button.weight ?? 500)));
  if (bodyFont.toLowerCase() !== headingFont.toLowerCase() || t.typography.bodyFontUrl) {
    if (t.typography.bodyFontUrl) fonts.push(t.typography.bodyFontUrl);
    else fonts.push(googleFontHref(bodyFont, weightsFor(bodyWeight)));
  }

  const motionIntensity = config.motion.intensity ?? 'moderate';
  const easing = config.motion.easing ?? 'standard';
  const ease = Array.isArray(easing) ? easing : EASINGS[easing] ?? EASINGS.standard;
  const durationMs = motionIntensity === 'none' ? 0 : config.motion.durationMs ?? 300;

  const variables = {
    ...Object.fromEntries(COLOR_KEYS.map((key) => [cssName(key), channels(colors[key])])),
    'font-heading': fontStack(headingFont),
    'font-body': fontStack(bodyFont),
    'font-heading-weight': String(headingWeight),
    'font-body-weight': String(bodyWeight),
    'leading-heading': String(t.typography.headingLineHeight ?? 1.1),
    'leading-body': String(t.typography.bodyLineHeight ?? 1.6),
    'tracking-heading': t.typography.headingLetterSpacing ?? '-0.02em',
    'heading-transform': t.typography.headingCase === 'uppercase' ? 'uppercase' : 'none',
    'eyebrow-transform': t.typography.eyebrowCase === 'none' ? 'none' : 'uppercase',
    ...Object.fromEntries(Object.entries(sizes).map(([name, [min, max]]) => [`text-${name}`, fluid(min, max)])),
    radius: radius.base,
    'radius-button': radius.button,
    'radius-input': radius.input,
    'radius-card': radius.card,
    'radius-badge': radius.badge,
    // Les trois coins ensemble : `rounded-button`, `rounded-card` et `rounded-badge` lisent ces variables, si bien que la
    // forme (un coin sur deux, haut seul, arche…) suit partout, dans chaque section, sans qu'aucune ne la connaisse.
    'radius-button-shape': shapeOf(c.button.shape, radius.button),
    'radius-card-shape': shapeOf(c.card.shape, radius.card),
    'radius-badge-shape': shapeOf(c.badge.shape, radius.badge),
    'border-width': borderWidth,
    'border-style': borderStyle,
    'shadow-sm': shadow.sm,
    'shadow-md': shadow.md,
    'shadow-lg': shadow.lg,
    'shadow-xl': shadow.xl,
    'shadow-card': shadow[c.card.elevation ?? (c.card.variant === 'elevated' ? 'md' : 'none')] ?? 'none',
    'shadow-button': shadow[c.button.shadow ?? 'none'] ?? 'none',
    'control-height': c.button.height ?? `${density.control}rem`,
    'control-height-sm': `${density.controlSm}rem`,
    'control-height-lg': `${density.controlLg}rem`,
    'input-height': c.input.height ?? c.button.height ?? `${density.control}rem`,
    'input-border-width': c.input.borderWidth ?? borderWidth,
    'button-padding-x': c.button.paddingX ?? `${density.paddingX}rem`,
    'button-weight': String(c.button.weight ?? 500),
    'button-border-width': c.button.borderWidth ?? borderWidth,
    'button-tracking': c.button.letterSpacing ?? (c.button.case === 'uppercase' ? '0.06em' : '0'),
    'button-transform': c.button.case === 'uppercase' ? 'uppercase' : 'none',
    'badge-transform': c.badge.case === 'uppercase' ? 'uppercase' : 'none',
    'card-border-width': c.card.borderWidth ?? borderWidth,
    'card-padding': c.card.padding ?? `${density.card}rem`,
    'space-section': t.spacing.section ? t.spacing.section : fluid(density.section * 0.58, density.section),
    'space-gutter': t.spacing.gutter ?? 'clamp(1rem, 4vw, 2rem)',
    'content-width': t.spacing.contentWidth ?? '72rem',
    'motion-duration': `${durationMs}ms`,
    'motion-ease': `cubic-bezier(${ease.join(', ')})`,
  };

  const css = `/**
 * Thème du site, généré par IDEM depuis design-system.json — NE PAS MODIFIER.
 * Pour changer l'apparence, modifiez design-system.json : ce fichier est
 * recompilé automatiquement (compilateur ${COMPILER_VERSION}).
 */
:root {
  color-scheme: ${config.appearance.colorMode};
${Object.entries(variables)
  .map(([name, value]) => `  --${name}: ${value};`)
  .join('\n')}
}

/* Formes, survols, appui, traits d'accent : les gestes de ce projet. */
${componentsCss(c)}
`;

  const componentConfig = {
    button: { variant: c.button.variant ?? 'primary', size: c.button.size ?? 'md', shape: c.button.shape ?? 'uniform', hover: c.button.hover ?? 'darken', press: c.button.press ?? 'none' },
    input: { style: c.input.style ?? 'outline' },
    card: { variant: c.card.variant ?? 'outline', shape: c.card.shape ?? 'uniform', hover: c.card.hover ?? 'none', accent: c.card.accent ?? 'none' },
    badge: { variant: c.badge.variant ?? 'soft', shape: c.badge.shape ?? 'uniform' },
    link: { hover: c.link.hover ?? 'none' },
    borders: { tone: t.borders.tone ?? 'normal', style: borderStyle, width: borderWidth },
    motion: {
      durationMs,
      staggerMs: motionIntensity === 'none' ? 0 : config.motion.staggerMs ?? 70,
      ease,
      intensity: motionIntensity,
      distance: MOTION_DISTANCE[motionIntensity] ?? 18,
      scale: MOTION_SCALE[motionIntensity] ?? 1,
      spring: {
        stiffness: config.motion.spring?.stiffness ?? 260,
        damping: config.motion.spring?.damping ?? 30,
      },
      respectReducedMotion: config.motion.respectReducedMotion !== false,
    },
  };

  report.files.push(
    'src/design-system/theme.generated.css',
    'src/design-system/component-config.generated.json'
  );

  return { config, css, componentConfig, fonts, report };
}

/** Les balises `<link>` des polices, pour le `<head>` de chaque page. */
export function fontLinksHtml(fonts) {
  const links = [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    ...fonts.map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}" />`),
  ];
  return links.join('\n    ');
}

function mergeDeep(base, extra) {
  if (!isObject(base) || !isObject(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = isObject(value) && isObject(base[key]) ? mergeDeep(base[key], value) : value;
  }
  return out;
}
