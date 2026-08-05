/**
 * Extraction de texte utile — module pur, sans dépendance d'infrastructure.
 *
 * Les livrables d'IDEM sont des pages HTML+Tailwind: l'écrasante majorité des
 * caractères d'une section sont des classes utilitaires, des attributs et du
 * balisage. Les retirer avant de résumer ou de comparer, c'est retirer le gros
 * du coût sans rien perdre de la substance.
 */

/** Texte lisible d'un contenu balisé (HTML, SVG inclus). */
export function stripMarkup(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
