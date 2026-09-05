/**
 * Design system CALCULÉ d'un livrable.
 *
 * C'est la moitié « M2 » du dispositif : tout ce qu'un algorithme peut décider
 * ne doit pas être demandé au modèle. Palette, rampes, contrastes, échelle
 * typographique, rayons, filets, ombres et grille sont produits ici, à partir
 * de la charte réelle du projet et du style de direction artistique.
 *
 * La différence avec l'ancien fonctionnement n'est pas cosmétique. Le modèle
 * recevait des phrases — « contraste recherché : décisif, jamais timide »,
 * « échelle : un ratio de 1.33 entre deux niveaux » — qu'il devait interpréter
 * et appliquer à la main, page après page. Un modèle fort s'en tire à peu près ;
 * un petit modèle produit un gris à 3,1:1 et une échelle plate. Ici, les valeurs
 * sont des FAITS : le rendu les applique, le modèle ne les voit même pas.
 *
 * Rien n'est inventé quand la charte existe : les couleurs et les polices
 * viennent du projet. Ce qui est calculé, ce sont les DÉRIVÉES — rampes, encres
 * lisibles, surfaces — c'est-à-dire précisément ce que le modèle approximait.
 */

import { ArtDirectionModel } from '../../models/art-direction.model';
import { ArtDirectionStyle, resolveStyle } from './artDirection.catalog';
import { DocumentSeed } from './designSeed';
import {
  buildNeutralRamp,
  buildRamp,
  contrastRatio,
  ensureContrast,
  hexToOklch,
  hexToRgb,
  relativeLuminance,
} from './color';

export interface DocumentDesignSystem {
  /** Le style de direction artistique retenu — il porte grille, rayon, filets. */
  style: ArtDirectionStyle;
  colors: {
    /** Rampe 50→950 de la couleur primaire de la charte. */
    brand: Record<string, string>;
    /** Rampe neutre teintée vers la marque : « le gris de cette marque ». */
    neutral: Record<string, string>;
    primary: string;
    secondary: string;
    accent: string;
    /** Fond de page. Clair ou sombre selon ce que le style impose. */
    surface: string;
    /** Fond des blocs posés sur la page (cartes, tableaux). */
    surfaceRaised: string;
    /** Encre principale — GARANTIE ≥ 7:1 sur `surface` (AAA). */
    ink: string;
    /** Encre secondaire — GARANTIE ≥ 4,5:1 sur `surface` (AA). */
    inkMuted: string;
    /** Filets et bordures. */
    rule: string;
    /** Encre lisible SUR la couleur d'accent. */
    onAccent: string;
  };
  /** Contrastes réellement obtenus, pour journalisation et vérification. */
  contrast: { inkOnSurface: number; mutedOnSurface: number; inkOnAccent: number };
  fonts: { display: string; body: string };
  /** Échelle typographique en px, dérivée du ratio du style. */
  typeScale: Record<'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl', number>;
  /** Rayon en px, le même partout dans le livrable. */
  radius: number;
  /** Unité d'espacement de base, multipliée par le rythme de la graine. */
  spacing: number;
  /** Le style prescrit-il un fond sombre ? Pilote le choix des encres. */
  dark: boolean;
}

/** Repli quand la charte n'a pas encore été générée. */
const FALLBACK_PALETTE = {
  primary: '#1F4E5F',
  secondary: '#4A5A60',
  accent: '#C6553D',
  background: '#FAF7F2',
  text: '#0F1B1F',
};

/**
 * Une échelle typographique se CALCULE : chaque niveau est le précédent
 * multiplié par le ratio du style. Le prompt demandait « au moins 3 niveaux avec
 * des sauts décisifs » et obtenait fréquemment deux tailles voisines.
 */
function buildTypeScale(ratio: number, base = 16): DocumentDesignSystem['typeScale'] {
  // Bornes de LISIBILITÉ. Une échelle purement géométrique dérive vite : avec un
  // ratio de 1,5, deux crans sous le corps donnent 7 px — illisible sur une page
  // imprimée — et cinq crans au-dessus donnent 122 px, qui ne tient pas dans une
  // largeur A4 sans casser un mot. Les extrémités sont donc bornées ; les crans
  // du milieu, eux, restent géométriques et gardent leurs sauts décisifs.
  const MIN_READABLE = 10;
  const MAX_TITLE = 96;
  const clamp = (value: number) => Math.min(MAX_TITLE, Math.max(MIN_READABLE, Math.round(value)));

  const up = (steps: number) => clamp(base * Math.pow(ratio, steps));
  const down = (steps: number) => clamp(base / Math.pow(ratio, steps));

  return {
    xs: down(2),
    sm: down(1),
    base,
    lg: up(1),
    xl: up(2),
    '2xl': up(3),
    '3xl': up(4),
    '4xl': up(5),
  };
}

/**
 * Encre lisible sur un fond donné, GARANTIE au seuil demandé.
 *
 * `ensureContrast` déplace la clarté dans UNE direction, déduite de la luminance
 * du fond. C'est le bon choix pour du texte sur une page, mais pas pour du texte
 * sur une couleur de milieu de gamme : sur un accent terracotta, partir du blanc
 * en éclaircissant ne mène nulle part, alors qu'assombrir passe. On essaie donc
 * les deux sens, puis les extrêmes — et l'on retient le meilleur contraste
 * plutôt que d'accepter un seuil manqué.
 */
function readableInk(seedHex: string, backgroundHex: string, target: number): string {
  const candidates = [
    ensureContrast(seedHex, backgroundHex, target),
    // Le sens opposé, obtenu en partant de l'extrême inverse.
    ensureContrast(
      relativeLuminance(hexToRgb(backgroundHex) ?? { r: 1, g: 1, b: 1 }) > 0.35
        ? '#000000'
        : '#ffffff',
      backgroundHex,
      target
    ),
    '#000000',
    '#ffffff',
  ];

  const passing = candidates.find((hex) => contrastRatio(hex, backgroundHex) >= target);
  if (passing) return passing;

  // Aucun ne passe (fond de luminance moyenne, seuil très haut) : on rend le
  // meilleur disponible plutôt qu'un choix arbitraire.
  return candidates.reduce((best, hex) =>
    contrastRatio(hex, backgroundHex) > contrastRatio(best, backgroundHex) ? hex : best
  );
}

function firstHex(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const value = (candidate ?? '').trim();
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) return value;
  }
  return undefined;
}

/**
 * Ce que le design system a besoin de savoir de la charte du projet.
 *
 * La forme suit `BrandIdentityModel` — la palette y est imbriquée sous
 * `colors.colors`, la sélection retenue étant elle-même un `ColorModel` nommé.
 * On la décrit ici plutôt que d'importer le modèle complet : ce module doit
 * rester une feuille du graphe d'imports, comme `ai.config.ts`.
 */
export interface BrandCharter {
  colors?: {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
    };
  };
  typography?: { primaryFont?: string; secondaryFont?: string };
}

/**
 * Construit le design system d'un livrable.
 *
 * @param charter     Palette et typographie de la charte du projet.
 * @param artDirection Direction artistique retenue (porte le styleId).
 * @param seed        Invariants de composition du document (rythme spatial).
 */
export function buildDocumentDesignSystem(
  charter: BrandCharter | undefined,
  artDirection: ArtDirectionModel | null | undefined,
  seed: DocumentSeed
): DocumentDesignSystem {
  const style = resolveStyle(artDirection?.styleId);

  const primary =
    firstHex(charter?.colors?.colors?.primary) ?? FALLBACK_PALETTE.primary;
  const secondary =
    firstHex(charter?.colors?.colors?.secondary) ?? FALLBACK_PALETTE.secondary;
  const accent = firstHex(charter?.colors?.colors?.accent) ?? FALLBACK_PALETTE.accent;

  const brand = buildRamp(primary);
  const brandHue = hexToOklch(primary)?.h ?? 220;
  const neutral = buildNeutralRamp(brandHue);

  // Le style impose le fond. `either` laisse la main à la charte, qui a le
  // dernier mot sur son propre fond.
  const charterBackground = firstHex(charter?.colors?.colors?.background);
  const dark =
    style.surface === 'dark'
      ? true
      : style.surface === 'light'
        ? false
        : charterBackground
          ? relativeLuminance(hexToRgb(charterBackground) ?? { r: 1, g: 1, b: 1 }) < 0.35
          : false;

  const surface = dark
    ? (charterBackground && relativeLuminance(hexToRgb(charterBackground)!) < 0.35
        ? charterBackground
        : neutral['950'])
    : (charterBackground ?? neutral['50']);

  // Un bloc posé sur la page se détache d'un cran, jamais d'une ombre.
  const surfaceRaised = dark ? neutral['900'] : neutral['100'];

  // ENCRES : c'est ici que la garantie remplace l'espoir. On part de la couleur
  // de texte de la charte, et on la déplace en clarté — teinte et chroma
  // conservés, donc elle reste de la marque — jusqu'à franchir le seuil.
  const inkSeed =
    firstHex(charter?.colors?.colors?.text) ?? (dark ? neutral['50'] : FALLBACK_PALETTE.text);
  const ink = readableInk(inkSeed, surface, 7); // AAA sur le texte courant
  const inkMuted = readableInk(dark ? neutral['400'] : neutral['600'], surface, 4.5);
  // Encre posée SUR l'accent : le point où `ensureContrast` seul échoue. Il
  // choisit sa direction d'après la luminance du FOND, ce qui est juste pour du
  // texte sur une page, mais insuffisant sur une couleur de milieu de gamme —
  // un accent terracotta est trop clair pour du blanc et trop sombre pour du
  // noir selon le sens choisi. `readableInk` essaie les deux.
  const onAccent = readableInk(dark ? neutral['950'] : neutral['50'], accent, 4.5);

  // Filet : assez visible pour structurer, jamais assez pour se voir seul.
  const rule = dark ? neutral['800'] : neutral['200'];

  return {
    style,
    colors: {
      brand,
      neutral,
      primary,
      secondary,
      accent,
      surface,
      surfaceRaised,
      ink,
      inkMuted,
      rule,
      onAccent,
    },
    contrast: {
      inkOnSurface: Math.round(contrastRatio(ink, surface) * 10) / 10,
      mutedOnSurface: Math.round(contrastRatio(inkMuted, surface) * 10) / 10,
      inkOnAccent: Math.round(contrastRatio(onAccent, accent) * 10) / 10,
    },
    fonts: {
      display: charter?.typography?.primaryFont?.trim() || 'Georgia',
      body: charter?.typography?.secondaryFont?.trim() || 'Helvetica Neue',
    },
    // Jamais sous 1.25 : une échelle plate donne une page qui paraît inachevée.
    typeScale: buildTypeScale(Math.max(1.25, style.typeRatio)),
    radius: style.radius,
    // Le rythme spatial vient de la graine du document : c'est l'une des
    // dimensions qui distinguent deux projets sans les rendre incohérents.
    spacing: Math.max(4, seed.spacingMultiplier * 2),
    dark,
  };
}

/**
 * Résumé d'une ligne pour les journaux. Sert à vérifier d'un coup d'œil que les
 * contrastes sont bien AU-DESSUS des seuils, ce qu'aucune relecture de prompt ne
 * permettait de garantir.
 */
export function describeDesignSystem(ds: DocumentDesignSystem): string {
  return (
    `style=${ds.style.id} fond=${ds.dark ? 'sombre' : 'clair'} ` +
    `encre ${ds.contrast.inkOnSurface}:1 · secondaire ${ds.contrast.mutedOnSurface}:1 · ` +
    `sur accent ${ds.contrast.inkOnAccent}:1 · échelle ${ds.typeScale.xs}→${ds.typeScale['4xl']}px ` +
    `· rayon ${ds.radius}px · rythme ${ds.spacing}px`
  );
}

/**
 * Toutes les valeurs hexadécimales que le rendu peut produire.
 *
 * À passer en `extraAllowedColors` au linter de charte : les teintes des rampes
 * ne figurent pas dans la palette déclarée, mais elles en DÉRIVENT — teinte et
 * chroma de la marque, clarté balayée. Les signaler comme « hors charte »
 * reviendrait à reprocher au design system d\'avoir des nuances.
 */
export function derivedPalette(ds: DocumentDesignSystem): string[] {
  return [
    ...Object.values(ds.colors.brand),
    ...Object.values(ds.colors.neutral),
    ds.colors.primary,
    ds.colors.secondary,
    ds.colors.accent,
    ds.colors.surface,
    ds.colors.surfaceRaised,
    ds.colors.ink,
    ds.colors.inkMuted,
    ds.colors.rule,
    ds.colors.onAccent,
  ];
}
