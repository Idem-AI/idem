/**
 * Données des graphiques : les chiffres viennent des TEXTES de la scène, jamais d'ailleurs.
 *
 * `numbersIn` lit les nombres d'un texte tel que le rédacteur l'écrit (« 12 000 », « 87 % »,
 * « 1,5 », « -25 % ») ; un graphique ne montre que ceux-là (règle des livrables IDEM : aucun
 * chiffre inventé). Le contrôle de rendu des scènes écrites par l'IA vérifie la même chose
 * sur `data-chart-values`.
 */

/** Les nombres d'un texte : espaces et « . , » suivis de 3 chiffres = milliers ; sinon décimale. */
export function numbersIn(text?: string | null): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const m of String(text).matchAll(/[-−]?\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d+)?|[-−]?\d+(?:[.,]\d+)?/g)) {
    let raw = m[0].replace('−', '-').replace(/[   ]/g, '');
    // « 12.000 » / « 12,000 » : séparateur de milliers ; « 1,5 » / « 1.5 » : décimale.
    raw = raw.replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Les nombres de toutes les cases d'une scène, dans l'ordre des cases. */
export function slotNumbers(slots: Record<string, string | undefined>): number[] {
  return Object.values(slots).flatMap((v) => numbersIn(v));
}

/** Un pourcentage du texte (« 87 % » → 87), s'il y en a un, entre 0 et 100. */
export function percentIn(text?: string | null): number | null {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}

/** Les couleurs de la charte de la scène, lues sur l'élément (variables CSS résolues). */
export interface BrandTokens {
  hl: string;
  hlInk: string;
  hlText: string;
  hlSoft: string;
  soft: string;
  ink: string;
  muted: string;
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  display: string;
  body: string;
}

export function brandTokens(el: Element): BrandTokens {
  const st = getComputedStyle(el);
  const v = (name: string, fallback: string) => st.getPropertyValue(name).trim() || fallback;
  const ink = v('--ink', '#111111');
  return {
    hl: v('--hl', ink),
    hlInk: v('--hl-ink', '#ffffff'),
    hlText: v('--hl-text', ink),
    hlSoft: v('--hl-soft', 'rgba(0,0,0,0.08)'),
    soft: v('--soft', 'rgba(0,0,0,0.06)'),
    ink,
    muted: v('--muted', ink),
    bg: v('--bg', '#ffffff'),
    primary: v('--c-primary', ink),
    secondary: v('--c-secondary', ink),
    accent: v('--c-accent', ink),
    display: v('--f-display', 'sans-serif'),
    body: v('--f-body', 'sans-serif'),
  };
}

/** Une couleur CSS (#rgb, #rrggbb, rgb(), rgba()) avec une opacité. */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
  }
  const rgb = c.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).map(Number);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

/** Les séries de la charte, dans l'ordre : la couleur de la marque d'abord. */
export const seriesColors = (t: BrandTokens) => [t.hl, t.primary, t.secondary, t.accent, t.muted].filter((c, i, all) => c && all.indexOf(c) === i);
