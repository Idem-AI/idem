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

/** Une valeur déjà utilisable telle quelle comme href de feuille de style. */
export function isStylesheetHref(value?: string | null): boolean {
  const v = String(value ?? '').trim();
  return /^https?:\/\//i.test(v) && /fonts\.googleapis\.com|\.css(\?|$)/i.test(v);
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
  const wanted = [...new Set(families.map(normalizeFontFamily).filter(Boolean))].filter(
    (f) => !SYSTEM_STACKS.has(f.toLowerCase())
  );
  if (!wanted.length) return '';

  const links = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  ];
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
    (f) => !SYSTEM_STACKS.has(f.toLowerCase())
  );
  if (!wanted.length) return fallback;
  const params = wanted.map((f) => `family=${familyParam(f)}:wght@100;200;300;400;500;600;700;800;900`);
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

export interface BrandTypographyLike {
  url?: string;
  primaryFont?: string;
  secondaryFont?: string;
}

/**
 * Bloc `<link>` des polices de la marque, prêt à être inséré dans un `<head>`.
 *
 * Honore `typography.url` quand il contient RÉELLEMENT une feuille de style
 * (cas d'un projet dont le front aurait stocké l'URL), et la reconstruit sinon.
 */
export function brandFontLinks(typography?: BrandTypographyLike | null): string {
  const explicit = isStylesheetHref(typography?.url)
    ? `<link href="${typography?.url}" rel="stylesheet">`
    : '';
  const generated = buildGoogleFontLinks([typography?.primaryFont, typography?.secondaryFont]);
  return [generated, explicit].filter(Boolean).join('\n');
}

/** Href unique des polices de la marque (contextes à un seul lien). */
export function brandFontsHref(typography?: BrandTypographyLike | null, fallback?: string): string {
  if (isStylesheetHref(typography?.url)) return typography!.url!;
  return buildGoogleFontsHref([typography?.primaryFont, typography?.secondaryFont], fallback);
}
