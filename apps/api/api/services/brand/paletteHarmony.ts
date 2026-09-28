/**
 * Harmonisation d'une palette modifiée par l'utilisateur — sans IA.
 *
 * Le problème : l'utilisateur change UNE couleur (le plus souvent la primaire)
 * et s'attend à ce que le reste suive. Garder l'ancienne secondaire à côté
 * d'une nouvelle primaire donne une palette qui n'a jamais été pensée
 * ensemble ; tout régénérer efface les choix qu'il avait faits.
 *
 * La réponse est un TRANSPORT : chaque rôle non modifié garde sa RELATION à la
 * primaire — l'écart de teinte, le décalage de clarté, le rapport de chroma —
 * et cette relation est reportée sur la nouvelle primaire. Une secondaire
 * « analogue plus profonde » reste analogue plus profonde ; un accent
 * complémentaire reste complémentaire ; un fond blanc teinté de la marque se
 * teinte de la nouvelle marque.
 *
 * Puis les règles qui font une palette professionnelle sont imposées en code,
 * jamais espérées :
 *
 *   · surface claire (cf. `lightSurface.ts`) ;
 *   · encre ≥ 7:1 sur le fond (AAA), plancher 4,5:1 même sur un choix explicite ;
 *   · secondaire et accent lisibles comme éléments graphiques (≥ 3:1) ;
 *   · rôles distincts (cf. `paletteRoles.ts`).
 *
 * Un rôle que l'utilisateur a fixé n'est corrigé que sous le plancher de
 * lisibilité ; au-dessus, on respecte son choix et on l'avertit.
 */

import {
  contrastRatio,
  ensureContrast,
  hexToOklch,
  oklchToHex,
  Oklch,
} from '../design/color';
import { isLightSurface, LIGHT_SURFACE_MIN_LUMINANCE } from '../design/lightSurface';
import { areRolesDistinct, deriveAccent, deriveSecondary } from '../design/paletteRoles';
import { BrandPalette, normalizeHex, PaletteRole, PALETTE_ROLES } from './brandTokens';

export interface HarmonizeRequest {
  /** Palette actuellement en base. */
  current: Partial<BrandPalette>;
  /** Couleurs choisies par l'utilisateur dans cette modification. */
  changes: Partial<BrandPalette>;
  /** Rôles à conserver tels quels bien qu'ils ne soient pas dans `changes`. */
  keep?: PaletteRole[];
}

export interface PaletteAdjustment {
  role: PaletteRole;
  from?: string;
  to: string;
  reason: string;
}

export interface PaletteContrastReport {
  /** Encre sur fond — texte courant. */
  textOnBackground: number;
  /** Primaire sur fond — titres, aplats, filets. */
  primaryOnBackground: number;
  secondaryOnBackground: number;
  accentOnBackground: number;
}

export interface HarmonizeResult {
  palette: BrandPalette;
  /** Ce que le code a changé, et pourquoi — affiché tel quel à l'utilisateur. */
  adjustments: PaletteAdjustment[];
  warnings: string[];
  contrast: PaletteContrastReport;
}

/** Palette de repli quand rien n'existe encore — celle du design system. */
const FALLBACK_PRIMARY = '#1f4e5f';

/** Chroma sous laquelle une couleur se lit comme un gris : sa teinte ne compte pas. */
const ACHROMATIC = 0.03;

/** Seuils de lisibilité (WCAG). */
const TEXT_TARGET = 7; // AAA, texte courant
const TEXT_FLOOR = 4.5; // AA : jamais en dessous, même sur choix explicite
const GRAPHIC_TARGET = 3; // éléments graphiques et grands titres

/** Écart de teinte sous lequel un fond ou une encre est « teinté de la marque ». */
const TINT_HUE_TOLERANCE = 35;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Écart circulaire entre deux teintes, en degrés (0-180). */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}
const round1 = (value: number) => Math.round(value * 10) / 10;

function oklch(hex: string): Oklch | null {
  return hexToOklch(hex);
}

function isChromatic(color: Oklch | null): boolean {
  return !!color && color.c >= ACHROMATIC;
}

/**
 * Reporte la relation d'une couleur à l'ancienne primaire sur la nouvelle.
 *
 * `role` distingue deux familles : les couleurs de MARQUE (secondaire, accent)
 * suivent teinte, clarté et chroma ; les couleurs de SUPPORT (fond, encre)
 * gardent leur clarté et leur chroma — un fond reste un fond — et ne font que
 * suivre la teinte, pour rester « le blanc de cette marque ».
 */
export function transportColor(
  color: string,
  previousPrimary: string,
  nextPrimary: string,
  role: PaletteRole
): string {
  const c = oklch(color);
  const p0 = oklch(previousPrimary);
  const p1 = oklch(nextPrimary);
  if (!c || !p0 || !p1) return color;

  if (role === 'background' || role === 'text') {
    // Un fond ou une encre grise reste grise : on ne colore pas ce qui ne
    // l'était pas.
    if (c.c < 0.004) return color;
    // Seul un support TEINTÉ DE LA MARQUE suit la marque. Un crème chaud posé à
    // côté d'un bleu est un choix à part entière : il reste crème à côté d'un
    // rouge, au lieu de virer au blanc bleuté.
    if (isChromatic(p0) && hueDistance(c.h, p0.h) > TINT_HUE_TOLERANCE) return color;
    // Nouvelle primaire grise : la teinte n'a plus de sens, on désature.
    if (!isChromatic(p1)) return oklchToHex({ ...c, c: Math.min(c.c, 0.006) });
    const offset = isChromatic(p0) ? c.h - p0.h : 0;
    return oklchToHex({ l: c.l, c: c.c, h: (p1.h + offset + 360) % 360 });
  }

  // Ancienne primaire grise : il n'y avait pas de relation de teinte à
  // reporter. La construction canonique repart de la nouvelle primaire.
  if (!isChromatic(p0)) {
    return role === 'accent' ? deriveAccent(nextPrimary) : deriveSecondary(nextPrimary);
  }

  // Nouvelle primaire grise (marque noire, anthracite…) : la secondaire
  // devient un gris décalé en clarté, l'accent garde sa couleur — c'est le
  // schéma classique d'une marque monochrome avec une seule touche vive.
  if (!isChromatic(p1)) {
    if (role === 'accent') return color;
    return oklchToHex({
      l: clamp(p1.l > 0.5 ? p1.l - 0.3 : p1.l + 0.3, 0.2, 0.85),
      c: Math.min(p1.c, 0.012),
      h: p1.h,
    });
  }

  const chromaRatio = p0.c > 0 ? p1.c / p0.c : 1;
  return oklchToHex({
    // La moitié du décalage de clarté : une primaire plus claire éclaircit la
    // palette sans écraser l'écart qui distinguait les rôles.
    l: clamp(c.l + (p1.l - p0.l) * 0.5, 0.18, 0.92),
    c: clamp(c.c * chromaRatio, 0, 0.32),
    h: (c.h + (p1.h - p0.h) + 360) % 360,
  });
}

/** Fond clair construit sur la teinte de la marque. */
function lightSurfaceFor(primary: string): string {
  const p = oklch(primary);
  return oklchToHex({ l: 0.975, c: isChromatic(p) ? 0.012 : 0.004, h: p?.h ?? 250 });
}

/** Encre quasi noire teintée de la marque. */
function inkFor(primary: string): string {
  const p = oklch(primary);
  return oklchToHex({ l: 0.22, c: isChromatic(p) ? 0.02 : 0.005, h: p?.h ?? 250 });
}

/**
 * Remonte un fond sombre en blanc teinté, en gardant sa teinte.
 * Même règle que `enforceLightSurface`, appliquée à un seul rôle.
 */
function liftSurface(background: string, primary: string): string {
  const b = oklch(background);
  const p = oklch(primary);
  return oklchToHex({ l: 0.975, c: Math.min(b?.c ?? 0.012, 0.02), h: b?.h ?? p?.h ?? 250 });
}

export function measurePalette(palette: BrandPalette): PaletteContrastReport {
  return {
    textOnBackground: round1(contrastRatio(palette.text, palette.background)),
    primaryOnBackground: round1(contrastRatio(palette.primary, palette.background)),
    secondaryOnBackground: round1(contrastRatio(palette.secondary, palette.background)),
    accentOnBackground: round1(contrastRatio(palette.accent, palette.background)),
  };
}

export function harmonizePalette(request: HarmonizeRequest): HarmonizeResult {
  const current: Partial<BrandPalette> = {};
  const changes: Partial<BrandPalette> = {};
  for (const role of PALETTE_ROLES) {
    const before = normalizeHex(request.current?.[role]);
    if (before) current[role] = before;
    const next = normalizeHex(request.changes?.[role]);
    if (next) changes[role] = next;
  }

  const locked = new Set<PaletteRole>([
    ...(Object.keys(changes) as PaletteRole[]),
    ...(request.keep ?? []).filter((role) => PALETTE_ROLES.includes(role)),
  ]);

  const adjustments: PaletteAdjustment[] = [];
  const warnings: string[] = [];

  const previousPrimary = current.primary;
  const primary = changes.primary ?? current.primary ?? FALLBACK_PRIMARY;
  if (!changes.primary && !current.primary) {
    adjustments.push({ role: 'primary', to: primary, reason: 'Aucune couleur principale : couleur de repli.' });
  }
  const primaryMoved = !!previousPrimary && previousPrimary !== primary;

  // ── 1. Chaque rôle part de sa meilleure source ─────────────────────────
  const initial = (role: Exclude<PaletteRole, 'primary'>): string => {
    if (changes[role]) return changes[role]!;
    const before = current[role];
    if (before && locked.has(role)) return before;
    if (before && primaryMoved) {
      const moved = transportColor(before, previousPrimary!, primary, role);
      if (moved !== before) {
        adjustments.push({
          role,
          from: before,
          to: moved,
          reason: 'Suit la nouvelle couleur principale en gardant sa relation avec elle.',
        });
      }
      return moved;
    }
    if (before) return before;

    const built =
      role === 'secondary'
        ? deriveSecondary(primary)
        : role === 'accent'
          ? deriveAccent(primary)
          : role === 'background'
            ? lightSurfaceFor(primary)
            : inkFor(primary);
    adjustments.push({ role, to: built, reason: 'Absente : construite à partir de la couleur principale.' });
    return built;
  };

  const palette: BrandPalette = {
    primary,
    secondary: initial('secondary'),
    accent: initial('accent'),
    background: initial('background'),
    text: initial('text'),
  };

  const set = (role: PaletteRole, value: string, reason: string) => {
    if (value === palette[role]) return;
    adjustments.push({ role, from: palette[role], to: value, reason });
    palette[role] = value;
  };

  // ── 2. Surface claire ─────────────────────────────────────────────────
  if (!isLightSurface(palette.background)) {
    if (locked.has('background')) {
      warnings.push(
        `Fond sombre choisi explicitement (luminance < ${LIGHT_SURFACE_MIN_LUMINANCE}) : ` +
          'tous les supports passeront en thème sombre.'
      );
    } else {
      set('background', liftSurface(palette.background, primary), 'Un fond de page reste clair.');
    }
  }

  // ── 3. Rôles distincts ───────────────────────────────────────────────
  if (!areRolesDistinct(palette.primary, palette.secondary)) {
    if (locked.has('secondary')) {
      warnings.push('La couleur secondaire est presque identique à la principale : la hiérarchie se perd.');
    } else {
      set('secondary', deriveSecondary(primary), 'Trop proche de la couleur principale.');
    }
  }
  if (
    !areRolesDistinct(palette.primary, palette.accent) ||
    !areRolesDistinct(palette.secondary, palette.accent)
  ) {
    if (locked.has('accent')) {
      warnings.push("L'accent se confond avec une autre couleur : il n'attire plus l'œil.");
    } else {
      set('accent', deriveAccent(primary), 'Trop proche des autres couleurs pour jouer son rôle d’accent.');
    }
  }

  // ── 4. Lisibilité ────────────────────────────────────────────────────
  const textTarget = locked.has('text') ? TEXT_FLOOR : TEXT_TARGET;
  if (contrastRatio(palette.text, palette.background) < textTarget) {
    set(
      'text',
      ensureContrast(palette.text, palette.background, textTarget),
      locked.has('text')
        ? 'Illisible sur le fond : assombrie au minimum lisible (4,5:1).'
        : 'Ajustée pour un texte parfaitement lisible (7:1).'
    );
  }

  for (const role of ['secondary', 'accent'] as const) {
    if (contrastRatio(palette[role], palette.background) >= GRAPHIC_TARGET) continue;
    if (locked.has(role)) {
      warnings.push(
        `${role === 'accent' ? "L'accent" : 'La couleur secondaire'} ressort peu sur le fond ` +
          `(${round1(contrastRatio(palette[role], palette.background))}:1) : à réserver aux aplats.`
      );
    } else {
      set(role, ensureContrast(palette[role], palette.background, GRAPHIC_TARGET), 'Rendue visible sur le fond (3:1).');
    }
  }

  if (contrastRatio(palette.primary, palette.background) < GRAPHIC_TARGET) {
    warnings.push(
      `La couleur principale ressort peu sur le fond (${round1(contrastRatio(palette.primary, palette.background))}:1) : ` +
        'elle sera utilisée en aplat, le texte prendra l’encre.'
    );
  }

  return { palette, adjustments, warnings, contrast: measurePalette(palette) };
}

/**
 * Palette proposée à partir des couleurs d'un logo.
 *
 * La couleur la plus présente et chromatique devient la primaire ; la
 * suivante, si elle s'en distingue, la secondaire. Le reste est construit et
 * vérifié par `harmonizePalette`.
 */
export function paletteFromLogoColors(
  logoColors: string[],
  current: Partial<BrandPalette> = {}
): HarmonizeResult {
  const colors = logoColors.map(normalizeHex).filter(Boolean);
  const chromatic = colors.filter((hex) => isChromatic(oklch(hex)));
  const primary = chromatic[0] ?? colors[0] ?? current.primary ?? FALLBACK_PRIMARY;
  const secondary = chromatic.slice(1).find((hex) => areRolesDistinct(primary, hex));

  return harmonizePalette({
    current,
    changes: { primary, ...(secondary ? { secondary } : {}) },
  });
}
