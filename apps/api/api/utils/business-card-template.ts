/**
 * Interpolation du template de carte de visite.
 *
 * Le template contient des marqueurs `{{champ}}` (fullName, email, …). Rendre
 * la carte d'une personne = remplacer ces marqueurs par ses valeurs. Les blocs
 * optionnels portent `data-field="champ"` : lorsqu'une valeur est absente, le
 * bloc devenu vide est retiré au moment du rendu (script `EMPTY_FIELD_CLEANUP`
 * exécuté dans le document de rendu, côté navigateur — le serveur n'a pas de
 * DOM et une suppression par regex ne saurait pas équilibrer les balises).
 */

/** Échappe une valeur utilisateur avant injection dans le HTML du template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remplace tous les `{{champ}}` par les valeurs fournies. Un champ absent est
 * remplacé par une chaîne vide (le bloc `data-field` correspondant sera retiré
 * au rendu).
 */
export function interpolateBusinessCard(
  html: string,
  values: Record<string, string | undefined>
): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value ? escapeHtml(String(value).trim()) : '';
  });
}

/**
 * Script exécuté dans le document de rendu : retire les blocs optionnels dont
 * la valeur était absente (plus aucun texte ni image après interpolation).
 */
export const EMPTY_FIELD_CLEANUP = `
(function () {
  var nodes = document.querySelectorAll('[data-field]');
  for (var i = nodes.length - 1; i >= 0; i--) {
    var el = nodes[i];
    var hasText = (el.textContent || '').trim().length > 0;
    var hasMedia = el.querySelector('img[src], svg') !== null;
    if (!hasText && !hasMedia) el.remove();
  }
})();
`;
