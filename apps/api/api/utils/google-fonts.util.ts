/**
 * Feuille de style Google Fonts d'une marque, construite à partir des NOMS de
 * familles.
 *
 * Pourquoi ce module existe : `TypographyModel.url` ne contient pas une URL de
 * feuille de style mais un slug (« typography/systeme-premium ») — c'est ce que
 * l'agent de typographie produit, et c'est ce que le front utilise comme
 * identifiant. Or les quatre moteurs de rendu serveur (PDF des livrables,
 * visuel social, carte de visite, maquettes) l'injectaient tel quel dans un
 * `<link rel="stylesheet">`. Le lien ne chargeait rien, le `font-family` de la
 * marque retombait sur la police système, et TOUS les rendus sortaient dans une
 * typographie qui n'était pas celle de la charte — sans la moindre erreur.
 *
 * On ne corrige donc pas la donnée (le slug sert d'identifiant côté front) : on
 * calcule l'URL au moment du rendu, à partir des familles réellement choisies.
 */

import { brandFontFaceStyle, isSelfHostedFamily } from './brand-font.util';

/** Familles à ne jamais demander à Google : ce sont des piles système. */
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

/** Nettoie un nom de famille : retire les guillemets, la pile de repli et l'espace. */
export function normalizeFontFamily(raw?: string | null): string {
  const first = String(raw ?? '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim();
  return first;
}

/**
 * Une valeur déjà utilisable telle quelle comme href de feuille de style.
 *
 * Trois formes existent désormais : Google (`fonts.googleapis.com`), Fontshare
 * (`api.fontshare.com/v2/css?...`, qui ne finit pas par `.css`), et tout ce qui
 * se termine par `.css` — Fontsource via jsDelivr comme la feuille `@font-face`
 * que nous fabriquons dans notre bucket pour une police importée.
 */
export function isStylesheetHref(value?: string | null): boolean {
  const v = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(v)) return false;
  return /fonts\.googleapis\.com|api\.fontshare\.com\/v2\/css|\.css(\?|$)/i.test(v);
}

function familyParam(family: string): string {
  return encodeURIComponent(family).replace(/%20/g, '+');
}

/**
 * Liens `<link>` chargeant les familles demandées.
 *
 * Deux liens par famille, et c'est délibéré :
 *  1. la famille SANS spécification de graisse — cette forme est toujours
 *     valide, elle garantit que la police se charge ;
 *  2. la même famille avec la plage complète de graisses — l'API `css2` renvoie
 *     une erreur 400 quand une graisse n'existe pas dans la famille, et un
 *     `<link>` en erreur n'a aucun effet de bord puisque le premier a déjà
 *     chargé la police.
 *
 * Une seule requête combinant les deux familles ferait échouer les DEUX polices
 * dès qu'une graisse manque à l'une d'elles : c'est précisément le genre de
 * panne silencieuse qu'on cherche à éliminer ici.
 */
export function buildGoogleFontLinks(families: Array<string | undefined | null>): string {
  const requested = [...new Set(families.map(normalizeFontFamily).filter(Boolean))];

  // Vilevile est fabriquée par IDEM : Google ne la connaît pas. On l'embarque
  // depuis le paquet partagé plutôt que d'émettre un lien qui ne chargerait rien.
  const selfHosted = requested.some(isSelfHostedFamily) ? brandFontFaceStyle() : '';

  const wanted = requested.filter(
    (f) => !SYSTEM_STACKS.has(f.toLowerCase()) && !isSelfHostedFamily(f)
  );
  if (!wanted.length) return selfHosted;

  const links = [
    selfHosted,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  ].filter(Boolean);
  for (const family of wanted) {
    const param = familyParam(family);
    links.push(
      `<link href="https://fonts.googleapis.com/css2?family=${param}&display=swap" rel="stylesheet">`
    );
    links.push(
      `<link href="https://fonts.googleapis.com/css2?family=${param}:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">`
    );
  }
  return links.join('\n');
}

/**
 * URL unique de feuille de style, pour les contextes qui n'acceptent qu'un href
 * (le `<link>` que le modèle doit recopier dans un visuel, par exemple).
 *
 * Elle demande la plage complète de graisses : c'est ce qui rend possible le
 * contraste typographique (une graisse 200 contre une 800). Si une famille ne
 * l'offre pas, le navigateur synthétise — dégradé, mais jamais vide.
 */
export function buildGoogleFontsHref(
  families: Array<string | undefined | null>,
  fallback = 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'
): string {
  const wanted = [...new Set(families.map(normalizeFontFamily).filter(Boolean))].filter(
    (f) => !SYSTEM_STACKS.has(f.toLowerCase()) && !isSelfHostedFamily(f)
  );
  if (!wanted.length) return fallback;
  const params = wanted.map((f) => `family=${familyParam(f)}:wght@100;200;300;400;500;600;700;800;900`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

/**
 * Une famille retenue pour la marque, telle qu'elle est stockée en base.
 *
 * `cssUrl` est le seul champ qui compte ici : quelle que soit la source
 * (Google, Fontshare, Fontsource, ou une police importée servie depuis notre
 * bucket), il pointe sur une feuille qui déclare `family`.
 */
export interface BrandFontLike {
  family?: string;
  source?: string;
  cssUrl?: string;
}

export interface BrandTypographyLike {
  url?: string;
  primaryFont?: string;
  secondaryFont?: string;
  primary?: BrandFontLike | null;
  secondary?: BrandFontLike | null;
}

/**
 * Bloc `<link>` des polices de la marque, prêt à être inséré dans un `<head>`.
 *
 * Trois cas, dans cet ordre :
 *  1. la famille porte sa propre feuille (`primary.cssUrl`) — c'est le cas dès
 *     qu'elle vient d'ailleurs que de Google, et le SEUL moyen de charger une
 *     police importée : elle n'existe dans aucun catalogue public ;
 *  2. `typography.url` contient réellement une feuille de style ;
 *  3. à défaut, on reconstruit le lien Google à partir du NOM de la famille —
 *     le comportement historique, qui reste juste pour les projets existants.
 */
export function brandFontLinks(typography?: BrandTypographyLike | null): string {
  const descriptors = [typography?.primary, typography?.secondary].filter(Boolean) as BrandFontLike[];

  const hosted = descriptors.filter((font) => isStylesheetHref(font.cssUrl));
  const hostedFamilies = new Set(
    hosted.map((font) => normalizeFontFamily(font.family).toLowerCase()).filter(Boolean)
  );

  // Seules les familles SANS feuille propre sont redemandées à Google : sinon
  // le même fichier serait chargé deux fois, et une police non-Google
  // produirait en plus un lien mort.
  const remaining = [typography?.primaryFont, typography?.secondaryFont].filter(
    (family) => !hostedFamilies.has(normalizeFontFamily(family).toLowerCase())
  );

  const explicit = isStylesheetHref(typography?.url) ? [typography!.url!] : [];
  const hrefs = [...new Set([...hosted.map((font) => font.cssUrl!), ...explicit])];

  return [
    buildGoogleFontLinks(remaining),
    ...hrefs.map((href) => `<link href="${escapeHref(href)}" rel="stylesheet">`),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Href unique des polices de la marque (contextes à un seul lien).
 *
 * Un seul lien ne peut pas couvrir deux sources différentes : on privilégie
 * alors la feuille de la police PRIMAIRE, celle qui porte les titres et donc
 * l'identité de la marque.
 */
export function brandFontsHref(typography?: BrandTypographyLike | null, fallback?: string): string {
  if (isStylesheetHref(typography?.url)) return typography!.url!;
  if (isStylesheetHref(typography?.primary?.cssUrl)) return typography!.primary!.cssUrl!;
  if (isStylesheetHref(typography?.secondary?.cssUrl)) return typography!.secondary!.cssUrl!;
  return buildGoogleFontsHref([typography?.primaryFont, typography?.secondaryFont], fallback);
}

/**
 * Bloc `<link>` des polices d'un système de document.
 *
 * Même règle que `brandFontLinks`, exprimée dans le vocabulaire du design
 * system : une famille qui porte sa feuille est chargée depuis SA source, les
 * autres restent demandées à Google par leur nom.
 */
export function designFontLinks(fonts: {
  display?: string;
  body?: string;
  displayCss?: string;
  bodyCss?: string;
}): string {
  return brandFontLinks({
    primaryFont: fonts.display,
    secondaryFont: fonts.body,
    primary: fonts.displayCss ? { family: fonts.display, cssUrl: fonts.displayCss } : null,
    secondary: fonts.bodyCss ? { family: fonts.body, cssUrl: fonts.bodyCss } : null,
  });
}

/** Une URL de catalogue peut contenir `&` ou `"` : elle finit dans un attribut HTML. */
function escapeHref(href: string): string {
  return href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
