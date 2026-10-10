/**
 * Les palettes d'un visuel, tirées de la charte — jamais une couleur inventée.
 *
 *   paper   le fond clair de la charte (ou blanc), texte de la charte, la couleur de marque en accent
 *   tint    un voile très léger de la couleur de marque, même lecture que paper
 *   brand   la couleur principale en aplat, texte blanc ou de la charte selon le contraste
 *   accent  la couleur d'accent en aplat (si elle porte un texte lisible)
 *   ink     fond sombre — SEULEMENT si la charte ou la demande l'appelle (surfaces claires par défaut)
 *
 * Chaque encre est vérifiée : ≥ 4,5:1 pour le texte courant, ≥ 3:1 pour l'accent (grand texte).
 */
import { contrastRatio, hexToOklch, oklchToHex } from '../../design/color';
import type { PosterScheme } from './poster.types';

const HEX = /^#[0-9a-f]{6}$/i;
const valid = (c?: string): c is string => !!c && HEX.test(c);

export interface SchemePalette {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

/** Mélange deux couleurs (t = part de `b`). */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export const isDarkColor = (hex: string) => contrastRatio('#ffffff', hex) > contrastRatio('#111111', hex);

/** L'encre la plus lisible sur ce fond, parmi les couleurs de la charte puis le noir et le blanc. */
export function inkOn(bg: string, candidates: (string | undefined)[], min = 4.5): string {
  const list = [...candidates.filter(valid), '#111111', '#ffffff'];
  return list.find((c) => contrastRatio(c, bg) >= min) || list.sort((x, y) => contrastRatio(y, bg) - contrastRatio(x, bg))[0];
}

/** Une couleur de marque qui se détache sur ce fond en grand (≥ 3:1), assombrie si besoin (même teinte). */
export function accentOn(bg: string, candidates: (string | undefined)[], fallback: string): string {
  for (const c of candidates.filter(valid)) {
    if (contrastRatio(c, bg) >= 3) return c;
  }
  // La teinte de la marque, plus profonde ou plus claire, plutôt qu'une couleur étrangère.
  const base = candidates.find(valid);
  const o = base ? hexToOklch(base) : null;
  if (o) {
    for (let step = 1; step <= 8; step++) {
      const l = isDarkColor(bg) ? Math.min(0.95, o.l + step * 0.06) : Math.max(0.15, o.l - step * 0.06);
      const c = oklchToHex({ ...o, l });
      if (contrastRatio(c, bg) >= 3) return c;
    }
  }
  return fallback;
}

/** Une encre secondaire (sous-titre) : adoucie vers le fond, mais jamais sous 4,5:1. */
export function mutedOn(ink: string, bg: string): string {
  for (const t of [0.32, 0.24, 0.16, 0.08]) {
    const c = mix(ink, bg, t);
    if (contrastRatio(c, bg) >= 4.5) return c;
  }
  return ink;
}

export function buildSchemes(p: SchemePalette, opts: { allowDark?: boolean } = {}): PosterScheme[] {
  const primary = valid(p.primary) ? p.primary : '#1447e6';
  const secondary = valid(p.secondary) ? p.secondary : undefined;
  const accent = valid(p.accent) ? p.accent : undefined;
  const text = valid(p.text) ? p.text : '#111111';
  // Le fond « papier » : celui de la charte s'il est clair, sinon blanc.
  const paper = valid(p.background) && !isDarkColor(p.background) ? p.background : '#ffffff';
  const out: PosterScheme[] = [];

  const make = (id: PosterScheme['id'], label: string, bg: string, accents: (string | undefined)[], panel?: string): PosterScheme => {
    const ink = inkOn(bg, [text, paper]);
    const acc = accentOn(bg, accents, ink);
    const pnl = panel || (isDarkColor(bg) ? paper : primary);
    return {
      id,
      label,
      bg,
      ink,
      muted: mutedOn(ink, bg),
      accent: acc,
      panel: pnl,
      panelInk: inkOn(pnl, [text, paper]),
      rule: mix(ink, bg, 0.75),
      dark: isDarkColor(bg),
    };
  };

  out.push(make('paper', 'fond clair, couleur de marque en accent', paper, [primary, secondary, accent]));
  out.push(make('tint', 'voile léger de la couleur de marque', mix(paper, primary, 0.08), [primary, secondary, accent]));
  // L'aplat de marque, si un texte s'y lit (blanc ou encre de la charte).
  if (Math.max(contrastRatio('#ffffff', primary), contrastRatio(text, primary)) >= 4.5) {
    out.push(make('brand', 'aplat de la couleur de marque', primary, [accent, paper, secondary], paper));
  }
  // L'aplat d'accent, sauf une couleur fluo : en grand fond, elle crie (elle reste un accent).
  const accentOk = accent && (() => {
    const o = hexToOklch(accent);
    return !o || !(o.c > 0.2 && o.l > 0.7);
  })();
  if (accent && accentOk && accent.toLowerCase() !== primary.toLowerCase() && Math.max(contrastRatio('#ffffff', accent), contrastRatio(text, accent)) >= 4.5 && !isDarkColor(accent)) {
    out.push(make('accent', "aplat de la couleur d'accent", accent, [text, primary], paper));
  }
  if (opts.allowDark) {
    // Un fond profond teinté de la couleur de marque, avec sa lueur : celui des affiches sombres
    // des marques qui en font (jamais un noir neutre plaqué).
    const deep = mix(primary, '#07060b', 0.84);
    const scheme = make('ink', 'fond profond teinté de la couleur de marque', deep, [primary, accent, paper], primary);
    scheme.bgCss = `radial-gradient(110% 80% at 88% 8%, ${mix(primary, deep, 0.35)} 0%, ${mix(primary, deep, 0.78)} 38%, ${deep} 72%)`;
    out.push(scheme);
  }
  return out;
}
