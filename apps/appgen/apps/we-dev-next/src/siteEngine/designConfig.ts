/**
 * Opération A, volet visuel : la configuration du design system d'un site.
 *
 * Le modèle décrit l'identité visuelle UNE fois, sous la forme d'un petit
 * objet JSON (tokens, recettes des composants, mouvement). Il ne réécrit ni
 * bouton ni carte : le compilateur applique ses choix à tout le template.
 *
 * Il ne part pas de rien : la charte du projet fournit une configuration de
 * départ (couleurs, polices, rayon, densité). Ce que la charte a décidé est un
 * fait — la couleur primaire, les deux polices — et reste celui de la charte ;
 * le modèle décide du reste. Un modèle modeste qui rend la configuration de
 * départ telle quelle donne donc déjà un site à la charte.
 */

import { ProjectModel } from '../types/project.js';
import { forgeDesignSystem, DesignSystem } from '../design/tokenForge.js';
import { isLightSurface, readFonts, readPalette } from '../design/charter.js';
import { formatOklch, hexToRgb, rgbToOklch } from '../design/color.js';
import { ChatLogger } from '../utils/logger.js';
import { ModelCaller, SHAPE_REMINDER, Verdict } from './modelCaller.js';
import { SiteFacts } from './siteFacts.js';
import { compiler, CompiledDesignSystem, designSystemFiles } from './template.js';
import type { MediaStyle } from './media/mediaDirector.js';

type Json = Record<string, any>;

const FAMILY_BY_STYLE: Record<string, MediaStyle['family']> = {
  swiss: 'structured',
  editorial: 'structured',
  victorian: 'structured',
  minimalism: 'structured',
  'pixel-art': 'structured',
  retro: 'structured',
  'pop-art': 'expressive',
  y2k: 'expressive',
  maximalism: 'expressive',
  graffiti: 'expressive',
  'collage-art': 'expressive',
  'vector-art': 'expressive',
  clay: 'expressive',
  aurora: 'expressive',
  glassmorphism: 'expressive',
  futuristic: 'expressive',
  cyberpunk: 'expressive',
  handwritten: 'soft',
  bohemian: 'soft',
  surreal: 'soft',
};

export function styleFamily(system: DesignSystem): MediaStyle['family'] {
  const id = system.direction.id.replace(/^charter-/, '');
  return FAMILY_BY_STYLE[id] ?? (/brutal|drenched|bold/.test(id) ? 'expressive' : 'structured');
}

/** Une demande de thème sombre, écrite en toutes lettres. Sans elle, le site reste clair. */
const DARK_REQUEST = /th[eè]me sombre|mode sombre|fond (noir|sombre)|dark (mode|theme|background)|site sombre/i;

/**
 * La configuration de départ, tirée de la charte par la forge de jetons.
 */
export function seedConfig(projectData: ProjectModel | undefined, system: DesignSystem = forgeDesignSystem(projectData)): Json {
  const branding = (projectData?.analysisResultModel?.branding ?? {}) as Json;
  const fonts = readFonts(branding);
  const { direction, colors } = system;
  const family = styleFamily(system);

  return {
    schemaVersion: 1,
    appearance: {
      colorMode: 'light',
      density: direction.spacingBase >= 10 ? 'spacious' : direction.spacingBase <= 5 ? 'compact' : 'comfortable',
    },
    tokens: {
      colors: {
        background: colors.surface,
        foreground: colors.ink,
        primary: colors.brand['600'],
        primaryForeground: colors.onBrand,
        mutedForeground: colors.inkMuted,
        ring: colors.brand['600'],
      },
      typography: {
        headingFont: system.fonts.display,
        bodyFont: system.fonts.body,
        ...(fonts.displayCss ? { headingFontUrl: fonts.displayCss } : {}),
        ...(fonts.bodyCss ? { bodyFontUrl: fonts.bodyCss } : {}),
        headingWeight: family === 'expressive' ? 750 : 650,
        bodyWeight: 400,
        scale: Math.min(1.333, Math.max(1.15, direction.typeRatio || 1.25)),
        headingCase: 'none',
      },
      radius: { base: `${direction.radius}px` },
      borders: { width: '1px' },
      elevation: { style: /none/i.test(direction.shadows) ? 'none' : family === 'expressive' ? 'pronounced' : 'soft' },
      spacing: {},
    },
    components: {
      button: { variant: 'primary', size: 'md', case: 'none', shadow: 'none' },
      input: { style: 'outline' },
      card: { variant: /no card/i.test(direction.avoid + direction.borders) ? 'flat' : 'outline', elevation: 'none' },
      badge: { variant: 'soft', case: 'none' },
    },
    motion: {
      durationMs: family === 'expressive' ? 420 : 300,
      staggerMs: 70,
      easing: family === 'expressive' ? 'emphasized' : 'standard',
      intensity: family === 'expressive' ? 'expressive' : family === 'soft' ? 'moderate' : 'subtle',
      respectReducedMotion: true,
    },
  };
}

/** Ce que la charte a décidé et que le modèle ne peut pas changer. */
function charterLocks(projectData: ProjectModel, seed: Json, preserve = false): Array<[string[], unknown]> {
  const branding = (projectData.analysisResultModel?.branding ?? {}) as Json;
  const palette = readPalette(branding);
  const fonts = readFonts(branding);
  const locks: Array<[string[], unknown]> = [];
  // Une refonte garde la couleur EXACTE du site, pas une teinte voisine de la gamme calculée.
  if (palette.primary) locks.push([['tokens', 'colors', 'primary'], preserve ? palette.primary : seed.tokens.colors.primary]);
  if (fonts.display) locks.push([['tokens', 'typography', 'headingFont'], seed.tokens.typography.headingFont]);
  if (fonts.body) locks.push([['tokens', 'typography', 'bodyFont'], seed.tokens.typography.bodyFont]);
  if (fonts.displayCss) locks.push([['tokens', 'typography', 'headingFontUrl'], fonts.displayCss]);
  if (fonts.bodyCss) locks.push([['tokens', 'typography', 'bodyFontUrl'], fonts.bodyCss]);
  return locks;
}

function setPath(target: Json, path: string[], value: unknown) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[path[path.length - 1]] = value;
}

const SCHEMA = `{
  "schemaVersion": 1,
  "appearance": { "colorMode": "light", "density": "compact | comfortable | spacious" },
  "tokens": {
    "colors": {
      "background", "foreground", "primary", "primaryForeground",
      "secondary", "secondaryForeground", "muted", "mutedForeground",
      "accent", "accentForeground", "border", "input", "ring", "card", "cardForeground"
      : couleurs CSS (hex, rgb(), hsl() ou oklch()). Sens shadcn/ui : "secondary" = fond discret d'un bouton secondaire,
        "muted" = fond calme d'une zone, "accent" = fond de survol ou de mise en valeur légère. Celles que tu omets sont déduites.
    },
    "typography": {
      "headingFont", "bodyFont" : familles Google Fonts,
      "headingWeight", "bodyWeight" : 100 à 900,
      "scale" : rapport entre deux tailles de titre, 1.15 à 1.4,
      "headingLineHeight" : 0.9 à 1.3, "bodyLineHeight" : 1.4 à 1.8,
      "headingLetterSpacing" : longueur en em (ex. "-0.02em"),
      "headingCase", "eyebrowCase" : "none | uppercase"
    },
    "radius": { "base", "button", "input", "card", "badge" : longueurs CSS ("0", "6px", "0.75rem", "full") },
    "borders": { "width" : "1px" ou "2px" },
    "elevation": { "style": "none | subtle | soft | pronounced | hard" },
    "spacing": { "section" : espace vertical entre sections (ex. "6rem"), "contentWidth" : largeur du contenu (ex. "72rem") }
  },
  "components": {
    "button": { "variant": "primary | secondary | outline | ghost | accent", "size": "sm | md | lg", "weight": 400-800, "case": "none | uppercase", "shadow": "none | sm | md" },
    "input": { "style": "outline | filled | underline" },
    "card": { "variant": "outline | flat | elevated | filled", "elevation": "none | sm | md | lg" },
    "badge": { "variant": "soft | solid | outline", "case": "none | uppercase" }
  },
  "motion": {
    "durationMs": 0-1200, "staggerMs": 0-300,
    "easing": "standard | emphasized | gentle | snappy",
    "intensity": "none | subtle | moderate | expressive",
    "respectReducedMotion": true
  }
}`;

function prompt(facts: SiteFacts, system: DesignSystem, seed: Json, request: string, locked: string[], redesign?: string): string {
  const { direction, colors } = system;
  return `${redesign ? `${redesign}\n\n` : ''}# Le projet
${facts.name} : ${facts.description}
${facts.audience ? `Clientèle : ${facts.audience}\n` : ''}${request.trim() && request.trim() !== facts.description ? `Demande : ${request.trim().slice(0, 800)}\n` : ''}
# La charte graphique du projet
Direction artistique : ${direction.name}. ${direction.signature}
Bordures : ${direction.borders}
Ombres : ${direction.shadows}
Couleurs de la marque : primaire ${colors.brand['600']}, secondaire ${colors.secondary}, accent ${colors.accent}.
Polices : ${system.fonts.display} (titres), ${system.fonts.body} (texte).
${locked.length ? `Imposé par la charte, à garder tel quel : ${locked.join(', ')}.\n` : ''}
# Configuration de départ (tirée de la charte)
${JSON.stringify(seed, null, 2)}

# Ta tâche
Tu fixes le design system de ce site : l'apparence de ses composants de base (boutons, champs, cartes, badges, titres) et son mouvement. Tu ne décris aucune page.
Pars de la configuration de départ et ajuste ce qui sert ce projet et sa direction artistique : rayons, densité, ombres, recettes des composants, rapport typographique, nuances discrètes (secondary, muted, accent, border) tirées des couleurs de la marque, mouvement.
Le site reste sur fond clair. Les textes doivent rester lisibles sur leurs fonds.

# Forme de la réponse
Renvoie UNIQUEMENT l'objet JSON complet, de cette forme :
${SCHEMA}`;
}

export interface DesignOutcome {
  files: Record<string, string>;
  compiled: CompiledDesignSystem;
  /** Le modèle a-t-il donné une configuration exploitable ? */
  fromModel: boolean;
  /** Les décisions de la charte ou de la politique de surfaces claires rétablies. */
  enforced: string[];
  /** Style lu par les agents média. */
  mediaStyle: MediaStyle;
}

/**
 * La configuration du site : celle du modèle, vérifiée par le compilateur
 * (forme seulement), avec les décisions de la charte et la surface claire.
 */
export async function configureDesignSystem(options: {
  projectData: ProjectModel;
  facts: SiteFacts;
  request: string;
  caller: ModelCaller;
  /** Refonte : le style relevé sur le site actuel, à moderniser sans perdre la marque (`redesign/brief.ts`). */
  redesign?: string;
}): Promise<DesignOutcome> {
  const { projectData, facts, request, caller, redesign } = options;
  const system = forgeDesignSystem(projectData);
  const seed = seedConfig(projectData, system);
  const locks = charterLocks(projectData, seed, !!redesign);
  const { parseColor } = compiler;

  const outcome = await caller.json(
    'design-system',
    "Tu es directeur artistique et tu configures le design system d'un site vitrine. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.",
    prompt(facts, system, seed, request, locks.map(([path]) => path.slice(1).join('.')), redesign),
    (raw): Verdict<Json> =>
      raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as Json).tokens ? { value: raw as Json } : { problem: SHAPE_REMINDER },
    2200
  );

  const config: Json = outcome.value ? JSON.parse(JSON.stringify(outcome.value)) : JSON.parse(JSON.stringify(seed));
  const enforced: string[] = [];

  for (const [path, value] of locks) {
    const current = path.reduce<any>((node, key) => node?.[key], config);
    if (current !== value) {
      setPath(config, path, value);
      if (current !== undefined) enforced.push(`${path.slice(1).join('.')} (charte)`);
    }
  }

  // Pas de couleur fluo : une couleur choisie par le modèle (hors couleurs de la marque) trop saturée et trop
  // lumineuse est ramenée à une teinte posée — même teinte, moins de chroma.
  enforced.push(...tameNeon(config, Object.values(readPalette((projectData.analysisResultModel?.branding ?? {}) as Json)), new Set(locks.map(([path]) => path.join('.')))));

  // Surfaces claires, sauf demande explicite d'un thème sombre.
  if (!DARK_REQUEST.test(request)) {
    const background = parseColor(config.tokens?.colors?.background);
    const light = background ? isLightSurface(`#${[background.r, background.g, background.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`) : true;
    if (config.appearance?.colorMode === 'dark' || !light) {
      setPath(config, ['appearance', 'colorMode'], 'light');
      setPath(config, ['tokens', 'colors', 'background'], seed.tokens.colors.background);
      setPath(config, ['tokens', 'colors', 'foreground'], seed.tokens.colors.foreground);
      for (const key of ['card', 'cardForeground', 'popover', 'popoverForeground', 'muted', 'mutedForeground', 'border', 'input']) {
        delete config.tokens.colors[key];
      }
      enforced.push('surface claire');
    }
  }

  const { files, compiled } = designSystemFiles(config, seed);

  ChatLogger.info('SITE_DESIGN', outcome.value ? 'Design system configuré par le modèle' : 'Design system de la charte (sans réponse du modèle)', {
    errors: compiled.report.errors.length,
    adjusted: compiled.report.adjusted,
    enforced,
  });

  return {
    files,
    compiled,
    fromModel: !!outcome.value,
    enforced,
    mediaStyle: {
      name: system.direction.name,
      signature: system.direction.signature,
      family: styleFamily(system),
      palette: [system.colors.brand['600'], system.colors.accent, system.colors.secondary, system.colors.brand['300'] ?? system.colors.brand['400']].filter(Boolean),
      ground: system.colors.brand['50'] ?? system.colors.surface,
    },
  };
}

/** Au-delà de ce chroma (OKLCH) et dans cette lumière, une couleur passe pour fluo à l'écran. */
const NEON_CHROMA = 0.2;
const CALM_CHROMA = 0.13;

/**
 * Ramène les couleurs fluo choisies par le modèle à une teinte posée. Les couleurs de la marque (et leurs proches
 * voisines) restent telles quelles : une marque vive a le droit de l'être.
 */
export function tameNeon(config: Json, brandHexes: string[], locked: Set<string>): string[] {
  const colors = config.tokens?.colors;
  if (!colors || typeof colors !== 'object') return [];
  const brand = brandHexes.map((hex) => hexToRgb(hex)).filter((rgb): rgb is NonNullable<typeof rgb> => !!rgb).map(rgbToOklch);
  const changed: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (locked.has(`tokens.colors.${key}`) || typeof value !== 'string') continue;
    const parsed = compiler.parseColor(value);
    if (!parsed) continue;
    // `parseColor` rend des canaux 0–255, `color.ts` travaille en 0–1.
    const lch = rgbToOklch({ r: parsed.r / 255, g: parsed.g / 255, b: parsed.b / 255 });
    if (lch.c < NEON_CHROMA || lch.l < 0.5 || lch.l > 0.95) continue;
    const nearBrand = brand.some((b) => Math.abs(b.l - lch.l) < 0.12 && Math.abs(b.c - lch.c) < 0.08 && Math.min(Math.abs(b.h - lch.h), 360 - Math.abs(b.h - lch.h)) < 18);
    if (nearBrand) continue;
    colors[key] = formatOklch({ ...lch, c: CALM_CHROMA });
    changed.push(`${key} (fluo)`);
  }
  return changed;
}

/** Le design system de départ, sans modèle : celui que l'atelier monte avant la génération. */
export function seedDesignSystemFiles(projectData?: ProjectModel): Record<string, string> {
  const seed = seedConfig(projectData);
  return designSystemFiles(seed, seed).files;
}
