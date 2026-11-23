/**
 * LE LOGO EN TRAITS (22/11/2026, idée de text-to-lottie, appliquée par le code) — un logo SVG est posé DANS la page du
 * film (et non comme une image) pour que la scène de signature le dessine : ses chemins se tracent dans leur propre
 * sens, puis se remplissent. Le SVG est ASSAINI avant : aucun script, aucun gestionnaire d'événement, aucun objet
 * étranger, aucune référence hors du fichier (la page n'a pas de réseau de toute façon) ; au-delà de 300 Ko, ou s'il ne
 * porte aucune forme dessinable, il n'est pas posé (le logo reste une image).
 */
export function sanitizeLogoSvg(raw: string): string | null {
  let s = String(raw || '');
  if (s.length > 300_000) return null;
  const start = s.search(/<svg[\s>]/i);
  const end = s.lastIndexOf('</svg>');
  if (start < 0 || end < start) return null;
  s = s.slice(start, end + 6);
  s = s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|image|use|a|animate\w*|set|style)\b[\s\S]*?(<\/\1>|\/>)/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|image|use|a|animate\w*|set|style)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/url\(\s*['"]?\s*(?!#)[^)]*\)/gi, 'none')
    .replace(/javascript:/gi, '');
  if (!/<(path|circle|ellipse|rect|polygon|polyline|line)\b/i.test(s)) return null;
  // Une largeur et une hauteur fixes empêcheraient le logo de suivre la place que lui donne la mise en page.
  s = s.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '')} preserveAspectRatio="xMidYMid meet">`);
  return s;
}
