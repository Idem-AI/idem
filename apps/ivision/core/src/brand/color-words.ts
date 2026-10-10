/**
 * Les couleurs NOMMÉES dans une demande (« une vidéo en bleu et or », « tons verts ») : la
 * préférence de couleur d'un utilisateur qui n'a pas de charte. Français et anglais ; l'ordre
 * de la phrase donne l'ordre des rôles (la première nommée devient la primaire).
 */
const WORDS: [RegExp, string][] = [
  [/\b(bleu marine|navy)\b/i, '#1b2a4a'],
  [/\b(bleu ciel|sky blue|bleu clair|light blue)\b/i, '#4aa3df'],
  [/\b(turquoise|teal|bleu canard)\b/i, '#0f8b8d'],
  [/\b(bleus?|blue)\b/i, '#1f5fbf'],
  [/\b(vert olive|olive)\b/i, '#6b7a2a'],
  [/\b(vert pomme|lime)\b/i, '#7cbf2f'],
  [/\b(verts?|vertes?|green)\b/i, '#1f7a4a'],
  [/\b(bordeaux|burgundy|maroon)\b/i, '#7a1f2b'],
  [/\b(rouges?|red)\b/i, '#c8312b'],
  [/\b(oranges?|orangé)\b/i, '#e8752a'],
  [/\b(jaunes?|yellow|moutarde|mustard)\b/i, '#e8b923'],
  [/\b(dorée?s?|or|gold|golden)\b/i, '#c9a227'],
  [/\b(roses?|pink|fuchsia)\b/i, '#d6457f'],
  [/\b(violets?|violettes?|mauve|purple|lilas)\b/i, '#6b3fa0'],
  [/\b(marrons?|brun|brown|chocolat|terre)\b/i, '#7a4a2a'],
  [/\b(beige|sable|sand|crème|cream)\b/i, '#d9c7a3'],
  [/\b(noirs?|noires?|black)\b/i, '#16181d'],
  [/\b(gris|grey|gray|argent|silver)\b/i, '#6b7280'],
];

/** Les couleurs dites, dans l'ordre de la phrase (trois au plus). « or » seul n'est retenu qu'après « en », « et », « , ». */
export function colorsNamed(text: string): string[] {
  const found: { at: number; hex: string }[] = [];
  for (const [re, hex] of WORDS) {
    const g = new RegExp(re.source, 'gi');
    for (const m of text.matchAll(g)) {
      // « or » est aussi une conjonction (« or, nous… ») : seulement s'il suit en/et/virgule/couleur.
      if (/^or$/i.test(m[0]) && !/(\ben|\bet|,|\bde l['’]|\bcouleur|\bton)\s*$/i.test(text.slice(Math.max(0, (m.index || 0) - 12), m.index))) continue;
      if (!found.some((f) => Math.abs(f.at - (m.index || 0)) < 3)) found.push({ at: m.index || 0, hex });
    }
  }
  return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.hex))].slice(0, 3);
}

/** Une palette complète à partir des couleurs dites (fond clair, texte lisible, toujours). */
export function paletteFromNamed(colors: string[]): Record<'primary' | 'secondary' | 'accent' | 'background' | 'text', string> | null {
  if (!colors.length) return null;
  const dark = colors.find((c) => ['#16181d', '#1b2a4a', '#6b7280'].includes(c));
  const chromatic = colors.filter((c) => c !== dark);
  const primary = chromatic[0] || colors[0];
  return {
    primary,
    secondary: dark || chromatic[2] || '#14324a',
    accent: chromatic[1] || '#f2a93b',
    background: '#fbfaf7',
    text: '#16181d',
  };
}
