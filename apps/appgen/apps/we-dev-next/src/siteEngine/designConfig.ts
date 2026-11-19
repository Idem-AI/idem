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
/**
 * LE LANGAGE DE STYLE d'un site, tiré de son projet (toujours le même pour un projet, différent d'un projet à l'autre).
 *
 * Avant : six « personnalités » qui ne réglaient que le rayon, la densité et la variante de bouton. Résultat : tous les
 * boutons étaient des rectangles qui s'assombrissent au survol, toutes les cartes un cadre à 1 px de la même teinte
 * grise, et deux projets sur six avaient strictement le même réglage.
 *
 * Maintenant : quatorze LANGAGES — chacun un parti pris cohérent (éditorial net, néo-brutaliste, pilules douces, feuilles
 * organiques, précision technique…) — et, dans chaque langage, des listes de choix par AXE : forme des boutons et des
 * cartes, survol, appui, trait d'accent, teinte, épaisseur et trait des bordures, soulignement des liens. Le projet
 * choisit son langage (selon la famille de sa direction artistique), puis tire chaque axe dans la liste du langage : deux
 * projets du même langage se distinguent encore par leurs gestes, et rien n'est jamais incohérent (une ombre dure ne
 * rencontre jamais une forme de pilule, une bordure double jamais un survol qui la masque).
 *
 * Les couleurs et les polices de la marque n'en dépendent jamais.
 */
export type Family = 'structured' | 'expressive' | 'soft';

export interface StyleLanguage {
  id: string;
  /** Les familles de direction artistique auxquelles il va. */
  families: Family[];
  note: string;
  radius: string[];
  density: 'compact' | 'comfortable' | 'spacious';
  headingCase: 'none' | 'uppercase';
  motion: 'subtle' | 'moderate' | 'expressive';
  elevation: 'none' | 'subtle' | 'soft' | 'pronounced' | 'hard';
  button: { variant: string[]; shape: string[]; hover: string[]; press: string[]; shadow: string[]; case: ('none' | 'uppercase')[] };
  card: { variant: string[]; shape: string[]; hover: string[]; accent: string[]; elevation: string[] };
  borders: { tone: string[]; width: string[]; style: string[] };
  badge: string[];
  link: string[];
}

export const STYLE_LANGUAGES: StyleLanguage[] = [
  {
    id: 'editorial-sharp', families: ['structured'], note: 'angles vifs, filets francs, grands blancs, la typographie porte tout', radius: ['0px'], density: 'spacious', headingCase: 'none', motion: 'subtle', elevation: 'none',
    button: { variant: ['primary', 'outline'], shape: ['square'], hover: ['underline', 'invert', 'slide', 'arrow'], press: ['none'], shadow: ['none'], case: ['none', 'uppercase'] },
    card: { variant: ['flat', 'outline'], shape: ['square'], hover: ['none', 'bar', 'border', 'tint'], accent: ['none', 'top', 'bottom', 'left'], elevation: ['none'] },
    borders: { tone: ['strong', 'ink', 'hairline', 'normal'], width: ['1px', '2px'], style: ['solid'] }, badge: ['square'], link: ['underline', 'bar', 'none'],
  },
  {
    id: 'neo-brutal', families: ['expressive'], note: 'contours épais encre, ombres dures décalées, aplats francs, boutons qui s’enfoncent', radius: ['0.25rem', '0.5rem', '0px'], density: 'comfortable', headingCase: 'uppercase', motion: 'expressive', elevation: 'hard',
    button: { variant: ['primary', 'accent', 'secondary'], shape: ['square', 'uniform'], hover: ['shift', 'grow', 'tilt'], press: ['sink'], shadow: ['none'], case: ['uppercase', 'none'] },
    card: { variant: ['outline', 'filled', 'flat'], shape: ['uniform', 'square'], hover: ['shift', 'tilt'], accent: ['none', 'top'], elevation: ['none'] },
    borders: { tone: ['ink'], width: ['2px', '3px'], style: ['solid'] }, badge: ['square', 'uniform'], link: ['underline', 'bar'],
  },
  {
    id: 'soft-pill', families: ['soft', 'expressive'], note: 'pilules et grandes courbes, aplats pâles, ombres diffuses, tout invite à toucher', radius: ['1rem', '1.25rem', '0.75rem'], density: 'spacious', headingCase: 'none', motion: 'moderate', elevation: 'soft',
    button: { variant: ['primary', 'secondary', 'accent'], shape: ['pill'], hover: ['lift', 'glow', 'grow', 'ring', 'arrow'], press: ['shrink', 'none'], shadow: ['sm', 'md', 'none'], case: ['none'] },
    card: { variant: ['filled', 'elevated'], shape: ['uniform'], hover: ['lift', 'tint', 'shadow', 'glow', 'zoom'], accent: ['none', 'top'], elevation: ['sm', 'md'] },
    borders: { tone: ['soft', 'hairline', 'brand'], width: ['1px'], style: ['solid'] }, badge: ['pill'], link: ['none', 'underline', 'bar'],
  },
  {
    id: 'organic-leaf', families: ['soft'], note: 'coins en feuille (un sur deux), bulles, courbes végétales, tout penche un peu', radius: ['1.25rem', '1.5rem', '1rem'], density: 'comfortable', headingCase: 'none', motion: 'moderate', elevation: 'soft',
    button: { variant: ['primary', 'accent', 'secondary'], shape: ['leaf', 'leaf-reverse'], hover: ['grow', 'lift', 'tilt', 'arrow', 'glow'], press: ['shrink', 'none'], shadow: ['none', 'sm'], case: ['none'] },
    card: { variant: ['filled', 'flat', 'elevated'], shape: ['leaf', 'blob', 'leaf-reverse'], hover: ['tilt', 'zoom', 'tint', 'rise'], accent: ['none'], elevation: ['none', 'sm'] },
    borders: { tone: ['soft', 'brand', 'hairline'], width: ['1px'], style: ['solid', 'dotted'] }, badge: ['pill', 'uniform'], link: ['bar', 'none'],
  },
  {
    id: 'tech-precise', families: ['structured', 'expressive'], note: 'précision, traits fins de la couleur de marque, survols qui glissent, traits d’accent latéraux', radius: ['0.375rem', '0.25rem', '0.5rem'], density: 'comfortable', headingCase: 'none', motion: 'subtle', elevation: 'subtle',
    button: { variant: ['primary', 'secondary'], shape: ['uniform', 'square'], hover: ['slide', 'ring', 'arrow', 'glow', 'underline'], press: ['sink', 'none'], shadow: ['none'], case: ['none'] },
    card: { variant: ['outline', 'flat'], shape: ['uniform', 'square'], hover: ['border', 'glow', 'rise', 'bar', 'lift'], accent: ['left', 'top', 'none', 'bottom'], elevation: ['none'] },
    borders: { tone: ['normal', 'brand', 'strong', 'hairline'], width: ['1px', '2px'], style: ['solid'] }, badge: ['uniform', 'square'], link: ['underline', 'bar'],
  },
  {
    id: 'luxury-minimal', families: ['structured', 'soft'], note: 'angles droits, filets presque invisibles, capitales espacées, survols qui s’inversent', radius: ['0px', '2px'], density: 'spacious', headingCase: 'none', motion: 'subtle', elevation: 'none',
    button: { variant: ['outline', 'primary', 'ghost'], shape: ['square'], hover: ['invert', 'slide', 'underline', 'arrow'], press: ['none'], shadow: ['none'], case: ['uppercase'] },
    card: { variant: ['flat'], shape: ['square'], hover: ['none', 'zoom', 'bar', 'tint'], accent: ['bottom', 'none', 'top'], elevation: ['none'] },
    borders: { tone: ['hairline', 'soft', 'normal'], width: ['1px'], style: ['solid'] }, badge: ['square'], link: ['bar', 'underline'],
  },
  {
    id: 'playful-bounce', families: ['expressive', 'soft'], note: 'bord épais, couleurs franches, boutons qui rebondissent et se penchent', radius: ['0.875rem', '1rem', '0.625rem'], density: 'comfortable', headingCase: 'none', motion: 'expressive', elevation: 'pronounced',
    button: { variant: ['accent', 'primary', 'secondary'], shape: ['uniform', 'pill'], hover: ['grow', 'tilt', 'lift', 'glow', 'ring'], press: ['shrink'], shadow: ['none', 'sm'], case: ['none'] },
    card: { variant: ['outline', 'filled'], shape: ['uniform', 'blob'], hover: ['tilt', 'lift', 'rise', 'glow'], accent: ['none', 'top'], elevation: ['none', 'sm'] },
    borders: { tone: ['strong', 'ink', 'brand'], width: ['2px', '3px'], style: ['solid'] }, badge: ['pill', 'uniform'], link: ['none', 'underline'],
  },
  {
    id: 'classic-framed', families: ['structured'], note: 'cadres à double filet, coins à peine arrondis, ombres posées, allure de papier à en-tête', radius: ['0.25rem', '0px', '0.125rem'], density: 'comfortable', headingCase: 'none', motion: 'subtle', elevation: 'subtle',
    button: { variant: ['primary', 'outline'], shape: ['uniform', 'square'], hover: ['darken', 'underline', 'ring', 'arrow'], press: ['none'], shadow: ['none', 'sm'], case: ['none', 'uppercase'] },
    card: { variant: ['outline'], shape: ['square', 'uniform'], hover: ['shadow', 'border', 'bar', 'none'], accent: ['none', 'top'], elevation: ['none'] },
    borders: { tone: ['strong', 'normal', 'ink'], width: ['3px'], style: ['double', 'solid'] }, badge: ['uniform', 'square'], link: ['underline', 'bar'],
  },
  {
    id: 'airy-light', families: ['soft', 'structured'], note: 'filets de verre, halos doux au survol, ombres légères, beaucoup d’air', radius: ['0.75rem', '1rem', '0.5rem'], density: 'spacious', headingCase: 'none', motion: 'moderate', elevation: 'soft',
    button: { variant: ['primary', 'secondary'], shape: ['uniform', 'pill'], hover: ['ring', 'glow', 'darken', 'lift', 'arrow'], press: ['none', 'shrink'], shadow: ['none', 'sm'], case: ['none'] },
    card: { variant: ['elevated', 'flat'], shape: ['uniform'], hover: ['lift', 'shadow', 'tint', 'zoom', 'glow'], accent: ['none', 'top'], elevation: ['sm', 'md'] },
    borders: { tone: ['hairline', 'soft', 'brand'], width: ['1px'], style: ['solid'] }, badge: ['pill', 'uniform'], link: ['none', 'bar', 'underline'],
  },
  {
    id: 'industrial-tab', families: ['structured', 'expressive'], note: 'onglets (coins hauts arrondis seulement), bandes d’accent latérales, capitales, traits épais', radius: ['0.25rem', '0.5rem'], density: 'comfortable', headingCase: 'uppercase', motion: 'subtle', elevation: 'none',
    button: { variant: ['primary', 'accent'], shape: ['tab', 'square'], hover: ['slide', 'shift', 'invert', 'underline'], press: ['sink'], shadow: ['none'], case: ['uppercase'] },
    card: { variant: ['outline', 'flat'], shape: ['tab', 'square'], hover: ['bar', 'border', 'tint', 'lift'], accent: ['left', 'top'], elevation: ['none'] },
    borders: { tone: ['strong', 'ink'], width: ['2px', '3px'], style: ['solid'] }, badge: ['square'], link: ['underline', 'bar'],
  },
  {
    id: 'arch-gallery', families: ['soft', 'structured'], note: 'arches et pilules, cartes à haut arrondi comme des niches, photos qui s’agrandissent', radius: ['0.75rem', '1rem', '0.5rem'], density: 'spacious', headingCase: 'none', motion: 'moderate', elevation: 'soft',
    button: { variant: ['primary', 'secondary', 'accent'], shape: ['pill'], hover: ['arrow', 'lift', 'glow', 'ring'], press: ['shrink', 'none'], shadow: ['none', 'sm'], case: ['none'] },
    card: { variant: ['filled', 'flat'], shape: ['arch'], hover: ['zoom', 'rise', 'lift', 'glow'], accent: ['none'], elevation: ['none'] },
    borders: { tone: ['soft', 'normal', 'hairline'], width: ['1px'], style: ['solid'] }, badge: ['pill'], link: ['none', 'bar'],
  },
  {
    id: 'ink-outline', families: ['structured', 'expressive'], note: 'boutons au trait qui se remplissent, encre sur papier, bordures nettes et sûres d’elles', radius: ['0.5rem', '0.375rem', '0.75rem'], density: 'comfortable', headingCase: 'none', motion: 'moderate', elevation: 'none',
    button: { variant: ['outline'], shape: ['uniform', 'pill'], hover: ['invert', 'slide', 'arrow', 'ring'], press: ['sink', 'none'], shadow: ['none'], case: ['none', 'uppercase'] },
    card: { variant: ['outline'], shape: ['uniform'], hover: ['border', 'rise', 'bar', 'lift'], accent: ['none', 'bottom'], elevation: ['none'] },
    borders: { tone: ['ink', 'strong'], width: ['2px', '1px', '3px'], style: ['solid'] }, badge: ['uniform', 'pill'], link: ['underline', 'bar'],
  },
  {
    id: 'warm-round', families: ['soft'], note: 'courbes généreuses, cartes en relief, halos chauds, photos à bords arrondis', radius: ['1.5rem', '1.25rem', '1rem'], density: 'comfortable', headingCase: 'none', motion: 'moderate', elevation: 'soft',
    button: { variant: ['primary', 'accent'], shape: ['uniform', 'pill'], hover: ['glow', 'lift', 'grow', 'ring', 'tilt'], press: ['shrink'], shadow: ['sm', 'md'], case: ['none'] },
    card: { variant: ['elevated', 'filled'], shape: ['uniform', 'blob'], hover: ['lift', 'glow', 'tilt', 'zoom', 'tint'], accent: ['none'], elevation: ['sm', 'md'] },
    borders: { tone: ['soft', 'brand', 'hairline'], width: ['1px'], style: ['solid'] }, badge: ['pill'], link: ['none', 'bar'],
  },
  {
    id: 'compact-pro', families: ['structured'], note: 'dense et informatif, tableaux et listes, filets nets, peu d’effets', radius: ['0.25rem', '0.375rem', '0.125rem'], density: 'compact', headingCase: 'none', motion: 'subtle', elevation: 'subtle',
    button: { variant: ['primary', 'secondary'], shape: ['uniform', 'square'], hover: ['darken', 'ring', 'underline', 'arrow', 'slide'], press: ['sink', 'none'], shadow: ['none'], case: ['none'] },
    card: { variant: ['flat', 'outline'], shape: ['uniform', 'square'], hover: ['border', 'none', 'bar', 'tint'], accent: ['top', 'left', 'none'], elevation: ['none'] },
    borders: { tone: ['normal', 'strong', 'hairline'], width: ['1px'], style: ['solid', 'dashed'] }, badge: ['uniform', 'square'], link: ['underline', 'none'],
  },
];

/**
 * Ce qui complète un langage : le caractère des TITRES (épaisseur, espacement des lettres) et celui des CHAMPS de saisie.
 * Les graisses restent dans ce que presque toutes les polices de titre portent (500 à 800).
 */
const FLAVOR: Record<string, { weight: number[]; tracking: string[]; input: string[] }> = {
  'editorial-sharp': { weight: [600, 700], tracking: ['-0.03em', '-0.02em'], input: ['underline', 'outline'] },
  'neo-brutal': { weight: [800, 700], tracking: ['-0.01em', '0.01em'], input: ['filled', 'outline'] },
  'soft-pill': { weight: [600, 650], tracking: ['-0.02em', '-0.01em'], input: ['filled', 'outline'] },
  'organic-leaf': { weight: [600, 500], tracking: ['-0.01em', '0em'], input: ['filled', 'underline'] },
  'tech-precise': { weight: [600, 700], tracking: ['-0.025em', '-0.015em'], input: ['outline', 'filled'] },
  'luxury-minimal': { weight: [500, 400], tracking: ['0.02em', '0.06em'], input: ['underline'] },
  'playful-bounce': { weight: [750, 800], tracking: ['-0.02em', '0em'], input: ['outline', 'filled'] },
  'classic-framed': { weight: [600, 700], tracking: ['0em', '0.01em'], input: ['outline'] },
  'airy-light': { weight: [500, 600], tracking: ['-0.01em', '0em'], input: ['filled', 'outline'] },
  'industrial-tab': { weight: [700, 800], tracking: ['0.02em', '0.04em'], input: ['outline', 'filled'] },
  'arch-gallery': { weight: [500, 600], tracking: ['-0.01em', '0em'], input: ['filled', 'outline'] },
  'ink-outline': { weight: [600, 700], tracking: ['-0.02em', '0em'], input: ['outline', 'underline'] },
  'warm-round': { weight: [600, 650], tracking: ['-0.01em', '0em'], input: ['filled', 'outline'] },
  'compact-pro': { weight: [600, 650], tracking: ['-0.02em', '-0.01em'], input: ['outline', 'filled'] },
};

/** Le style tiré d'un projet : un langage, et le choix de chaque axe dans la liste de ce langage. */
export interface Personality {
  id: string;
  note: string;
  radius: string;
  density: 'compact' | 'comfortable' | 'spacious';
  headingCase: 'none' | 'uppercase';
  motion: 'subtle' | 'moderate' | 'expressive';
  elevation: StyleLanguage['elevation'];
  button: { variant: string; shape: string; hover: string; press: string; shadow: string; case: 'none' | 'uppercase' };
  card: { variant: string; shape: string; hover: string; accent: string; elevation: string };
  borders: { tone: string; width: string; style: string };
  badge: string;
  link: string;
  heading: { weight: number; tracking: string };
  input: string;
}

const hashOf = (source: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619) >>> 0;
  return hash;
};

/**
 * Le style d'un projet. `family` : la famille de sa direction artistique (le langage est choisi parmi ceux qui lui vont).
 * Les axes sont tirés indépendamment (un hachage par axe) : changer le nom du projet change plusieurs gestes à la fois.
 */
export function personalityOf(projectData?: ProjectModel, family?: Family): Personality {
  const source = String(projectData?.id || projectData?.name || 'idem');
  const fitting = family ? STYLE_LANGUAGES.filter((l) => l.families.includes(family)) : STYLE_LANGUAGES;
  const pool = fitting.length ? fitting : STYLE_LANGUAGES;
  const language = pool[hashOf(`${source}:langage`) % pool.length];
  const draw = <T,>(axis: string, list: T[]): T => list[hashOf(`${source}:${axis}`) % list.length];
  return {
    id: language.id,
    note: language.note,
    radius: draw('rayon', language.radius),
    density: language.density,
    headingCase: language.headingCase,
    motion: language.motion,
    elevation: language.elevation,
    button: {
      variant: draw('bouton.variante', language.button.variant),
      shape: draw('bouton.forme', language.button.shape),
      hover: draw('bouton.survol', language.button.hover),
      press: draw('bouton.appui', language.button.press),
      shadow: draw('bouton.ombre', language.button.shadow),
      case: draw('bouton.casse', language.button.case),
    },
    card: {
      variant: draw('carte.variante', language.card.variant),
      shape: draw('carte.forme', language.card.shape),
      hover: draw('carte.survol', language.card.hover),
      accent: draw('carte.accent', language.card.accent),
      elevation: draw('carte.ombre', language.card.elevation),
    },
    borders: { tone: draw('bordure.teinte', language.borders.tone), width: draw('bordure.epaisseur', language.borders.width), style: draw('bordure.trait', language.borders.style) },
    badge: draw('badge.forme', language.badge),
    link: draw('lien.survol', language.link),
    heading: { weight: draw('titre.graisse', FLAVOR[language.id].weight), tracking: draw('titre.espacement', FLAVOR[language.id].tracking) },
    input: draw('champ.style', FLAVOR[language.id].input),
  };
}

/** Le style en une phrase lisible (journaux, prompt) : « pilules douces — pill, lift, 1px soft ». */
export function describeStyle(p: Personality): string {
  return `${p.id} : bouton ${p.button.shape}/${p.button.hover}, carte ${p.card.shape}/${p.card.hover}${p.card.accent !== 'none' ? `/trait ${p.card.accent}` : ''}, bordure ${p.borders.width} ${p.borders.tone} ${p.borders.style}, titres ${p.heading.weight}, champ ${p.input}`;
}

export function seedConfig(projectData: ProjectModel | undefined, system: DesignSystem = forgeDesignSystem(projectData)): Json {
  const branding = (projectData?.analysisResultModel?.branding ?? {}) as Json;
  const fonts = readFonts(branding);
  const { direction, colors } = system;
  const family = styleFamily(system);
  const personality = personalityOf(projectData, family);

  return withPersonality(personality, {
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
  });
}

/** Le style posé sur la configuration de départ (le modèle peut encore l'ajuster, jamais la marque). */
function withPersonality(personality: Personality, seed: Json): Json {
  seed.appearance = { ...seed.appearance, density: personality.density };
  seed.tokens.radius = { ...seed.tokens.radius, base: personality.radius };
  seed.tokens.typography = { ...seed.tokens.typography, headingCase: personality.headingCase, headingWeight: personality.heading.weight, headingLetterSpacing: personality.heading.tracking };
  seed.components.input = { ...seed.components.input, style: personality.input };
  seed.tokens.borders = { ...seed.tokens.borders, width: personality.borders.width, tone: personality.borders.tone, style: personality.borders.style };
  seed.tokens.elevation = { ...seed.tokens.elevation, style: personality.elevation };
  seed.components.button = { ...seed.components.button, ...personality.button };
  seed.components.card = { ...seed.components.card, ...personality.card };
  seed.components.badge = { ...seed.components.badge, shape: personality.badge };
  seed.components.link = { hover: personality.link };
  seed.motion = { ...seed.motion, intensity: personality.motion };
  return seed;
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

/** Les gestes et leur valeur banale : ce que tous les sites auraient sans choix. */
const GESTURES: Array<[string[], string]> = [
  [['tokens', 'borders', 'tone'], 'normal'],
  [['tokens', 'borders', 'style'], 'solid'],
  [['tokens', 'borders', 'width'], '1px'],
  [['components', 'button', 'shape'], 'uniform'],
  [['components', 'button', 'hover'], 'darken'],
  [['components', 'button', 'press'], 'none'],
  [['components', 'card', 'shape'], 'uniform'],
  [['components', 'card', 'hover'], 'none'],
  [['components', 'card', 'accent'], 'none'],
  [['components', 'badge', 'shape'], 'uniform'],
  [['components', 'link', 'hover'], 'none'],
  [['components', 'input', 'style'], 'outline'],
];

/** Rétablit le geste du projet partout où la réponse du modèle l'a perdu ou ramené au banal. */
export function keepGestures(config: Json, seed: Json): string[] {
  const restored: string[] = [];
  for (const [path, banal] of GESTURES) {
    const chosen = path.reduce<any>((node, key) => node?.[key], seed);
    if (chosen === undefined || chosen === banal) continue;
    const given = path.reduce<any>((node, key) => node?.[key], config);
    if (given === undefined || given === banal) {
      setPath(config, path, chosen);
      restored.push(`${path.slice(1).join('.')} (style du projet)`);
    }
  }
  return restored;
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
    "borders": {
      "width" : "1px", "2px" ou "3px",
      "tone" : "hairline | soft | normal | strong | ink | brand" (teinte des filets : presque invisible → encre pleine, ou couleur de marque),
      "style" : "solid | dashed | dotted | double" (le trait de TOUTES les bordures ; double impose 3px)
    },
    "elevation": { "style": "none | subtle | soft | pronounced | hard" },
    "spacing": { "section" : espace vertical entre sections (ex. "6rem"), "contentWidth" : largeur du contenu (ex. "72rem") }
  },
  "components": {
    "button": {
      "variant": "primary | secondary | outline | ghost | accent", "size": "sm | md | lg", "weight": 400-800, "case": "none | uppercase", "shadow": "none | sm | md",
      "shape" : "uniform | square | pill | leaf | leaf-reverse | tab" (où s'applique la courbure : tous les coins, aucun, tous au maximum, un coin sur deux, le haut seul),
      "hover" : "darken | lift | invert | slide | glow | grow | shift | underline | arrow | ring | tilt" (ce que fait le bouton au survol ; shift = ombre dure qui s'écrase),
      "press" : "none | sink | shrink"
    },
    "input": { "style": "outline | filled | underline" },
    "card": {
      "variant": "outline | flat | elevated | filled", "elevation": "none | sm | md | lg",
      "shape" : "uniform | square | leaf | leaf-reverse | tab | arch | blob",
      "hover" : "none | lift | border | tint | zoom | shadow | shift | bar | glow | rise | tilt",
      "accent" : "none | top | left | bottom" (un trait de la couleur de marque sur un bord de la carte)
    },
    "badge": { "variant": "soft | solid | outline", "case": "none | uppercase", "shape" : "uniform | square | pill" },
    "link": { "hover" : "none | underline | bar" } (liens de navigation et de pied de page)
  },
  "motion": {
    "durationMs": 0-1200, "staggerMs": 0-300,
    "easing": "standard | emphasized | gentle | snappy",
    "intensity": "none | subtle | moderate | expressive",
    "respectReducedMotion": true
  }
}`;

function prompt(facts: SiteFacts, system: DesignSystem, seed: Json, request: string, locked: string[], redesign: string | undefined, personality: string): string {
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

# La personnalité de ce site
${personality}
Les formes, survols, traits d'accent, teintes et traits de bordure de la configuration de départ (shape, hover, press, accent, tone, style) sont CHOISIS pour que ce site ne ressemble pas aux autres : garde-les tels quels. Ne les ramène jamais vers « uniform / darken / none / normal / solid » : c'est ce que tous les sites ont. Ne les change que si la direction artistique du projet les contredit clairement (un site sobre et institutionnel n'a pas de bouton qui tangue), et change alors le geste, pas la banalité.

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
    prompt(facts, system, seed, request, locks.map(([path]) => path.slice(1).join('.')), redesign, personalityOf(projectData, styleFamily(system)).note),
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

  // Les GESTES du projet (formes, survols, appui, traits d'accent, teinte et trait des bordures). Un modèle qui renvoie
  // sa configuration tend à les ramener aux valeurs que tous les sites ont (`uniform`, `darken`, `none`, `normal`,
  // `solid`) : on rétablit alors celui du projet. Un autre geste que le banal, il le garde.
  enforced.push(...keepGestures(config, seed));

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
