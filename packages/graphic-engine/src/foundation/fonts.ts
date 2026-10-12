/**
 * Polices : les NOMS de familles suffisent à charger une police Google ; une famille qui vient
 * d'ailleurs (Fontshare, Fontsource, police importée) n'est adressable que par sa feuille de style.
 *
 * Leçon du moteur précédent : l'URL stockée avec une typographie est un slug, pas une feuille de
 * style ; l'injecter telle quelle dans un `<link>` ne chargeait rien et TOUS les rendus sortaient
 * en police système, sans la moindre erreur. On calcule donc le lien au moment du rendu, à partir
 * des familles réellement choisies — et l'hôte peut fournir son propre bloc (`headHtml`) pour les
 * polices qu'il fabrique lui-même.
 */
import { classifyFont, FontClass } from './typeset';

/** Piles système : jamais demandées à Google. */
const SYSTEM_STACKS = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'arial',
  'helvetica',
  'helvetica neue',
  'times new roman',
  'georgia',
  'courier new',
  'verdana',
  'tahoma',
]);

export function normalizeFamily(raw?: string | null): string {
  return String(raw ?? '').split(',')[0].replace(/["']/g, '').trim();
}

export const isSystemFamily = (family: string): boolean => SYSTEM_STACKS.has(normalizeFamily(family).toLowerCase());

/** Une valeur utilisable telle quelle comme `href` de feuille de style (Google, Fontshare, `.css`). */
export function isStylesheetHref(value?: string | null): boolean {
  const v = String(value ?? '').trim();
  return /^https?:\/\//i.test(v) && /fonts\.googleapis\.com|api\.fontshare\.com\/v2\/css|\.css(\?|$)/i.test(v);
}

const FALLBACKS: Record<FontClass, string> = {
  sans: "'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Menlo, Consolas, monospace",
  condensed: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif",
  wide: "'Helvetica Neue', Arial, sans-serif",
  script: "'Brush Script MT', cursive",
};

/** Valeur de `font-family` : la famille, puis une pile de repli de la même nature. */
export function fontStack(family: string, role: 'display' | 'body' = 'body'): string {
  const name = normalizeFamily(family);
  if (!name) return role === 'display' ? FALLBACKS.serif : FALLBACKS.sans;
  const cls = classifyFont(name);
  return `'${name.replace(/'/g, '')}', ${FALLBACKS[cls]}`;
}

const familyParam = (family: string): string => encodeURIComponent(family).replace(/%20/g, '+');

/**
 * Deux liens Google par famille, et c'est délibéré : la forme SANS graisse est toujours valide et
 * garantit que la police se charge ; la forme avec la plage de graisses donne le contraste
 * (200 contre 800) — son erreur 400 éventuelle (graisse absente) est sans effet de bord.
 */
export function googleFontLinks(families: Array<string | undefined | null>): string {
  const wanted = [...new Set(families.map(normalizeFamily).filter(Boolean))].filter((f) => !isSystemFamily(f));
  if (!wanted.length) return '';
  const links = ['<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'];
  for (const family of wanted) {
    const param = familyParam(family);
    links.push(`<link href="https://fonts.googleapis.com/css2?family=${param}&display=swap" rel="stylesheet">`);
    links.push(`<link href="https://fonts.googleapis.com/css2?family=${param}:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">`);
  }
  return links.join('\n');
}

export interface BrandFonts {
  display?: string;
  body?: string;
  /** Feuille de style propre à la famille (Fontshare, Fontsource, police importée). */
  displayCss?: string;
  bodyCss?: string;
  /** Bloc `<link>`/`<style>` déjà prêt, fourni par l'hôte : il prime sur tout le reste. */
  headHtml?: string;
}

const escapeHref = (href: string): string => href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Bloc à poser dans le `<head>` d'un document de rendu. */
export function fontHeadHtml(fonts: BrandFonts): string {
  if (fonts.headHtml?.trim()) return fonts.headHtml;
  const hosted = [
    { family: fonts.display, css: fonts.displayCss },
    { family: fonts.body, css: fonts.bodyCss },
  ].filter((f) => isStylesheetHref(f.css));
  const hostedFamilies = new Set(hosted.map((f) => normalizeFamily(f.family).toLowerCase()));
  const remaining = [fonts.display, fonts.body].filter((f) => !hostedFamilies.has(normalizeFamily(f).toLowerCase()));
  const hrefs = [...new Set(hosted.map((f) => f.css as string))];
  return [googleFontLinks(remaining), ...hrefs.map((href) => `<link href="${escapeHref(href)}" rel="stylesheet">`)].filter(Boolean).join('\n');
}
