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
    // Une icône SVG accompagne une ligne de contact : sans la valeur, elle partirait seule.
    // Seule une image (logo) garde un bloc vide de texte.
    var hasMedia = el.querySelector('img[src]') !== null;
    if (!hasText && !hasMedia) el.remove();
  }
})();
`;

/**
 * Script exécuté dans le document de rendu, APRÈS le chargement des polices : la face a été composée et
 * mesurée avec ses marqueurs (`{{email}}`), une valeur réelle peut être plus longue (un nom composé, une
 * adresse sur deux lignes). Si la carte déborde, les textes des champs cèdent de la taille, ensemble et par
 * pas, jamais sous le plancher d'impression (8,5 px CSS ≈ 6,4 pt) ; un mot encore trop long (une adresse
 * électronique) se coupe plutôt que de sortir de la carte. Même logique dans l'aperçu du tableau de bord.
 */
export const FIELD_FIT = `
(function () {
  var card = document.querySelector('.ge-page') || document.body.firstElementChild;
  if (!card) return;
  var FLOOR = 8.5;
  var fields = Array.prototype.slice.call(card.querySelectorAll('[data-field]'));
  if (!fields.length) return;
  function overflowing() {
    var box = card.getBoundingClientRect();
    if (card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1) return true;
    for (var i = 0; i < fields.length; i++) {
      var r = fields[i].getBoundingClientRect();
      if (r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5) return true;
      if (fields[i].scrollWidth > fields[i].clientWidth + 1) return true;
    }
    return false;
  }
  var base = fields.map(function (el) { return parseFloat(getComputedStyle(el).fontSize) || FLOOR; });
  for (var step = 1; step <= 14 && overflowing(); step++) {
    var factor = Math.pow(0.95, step), moved = false;
    for (var j = 0; j < fields.length; j++) {
      var next = Math.max(Math.min(base[j], FLOOR), base[j] * factor);
      if (next < parseFloat(getComputedStyle(fields[j]).fontSize) - 0.01) { fields[j].style.fontSize = next.toFixed(2) + 'px'; moved = true; }
    }
    if (!moved) break;
  }
  if (overflowing()) for (var k = 0; k < fields.length; k++) fields[k].style.overflowWrap = 'anywhere';
})();
`;
