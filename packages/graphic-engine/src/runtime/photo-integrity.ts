/**
 * L'INTÉGRITÉ DES PHOTOS dans la page — une image de contenu s'affiche avec SES couleurs, quel que soit le code
 * qui l'a posée (gabarit du catalogue, auteur IA, retouche). Pendant HTML de `@idem/design-tools/photo-integrity`.
 *
 * Deux niveaux, tous deux déterministes :
 *   1. `stripImageFilters(html)` — sur le code GARDÉ : retire des `<img>` les utilitaires qui altèrent les couleurs
 *      (grayscale, sepia, invert, hue-rotate, saturate, contrast, brightness, blur, mix-blend, `[filter:…]`) et
 *      supprime les calques vides qui recolorent ce qu'il y a dessous (`mix-blend-color|hue|saturation|luminosity|…`).
 *   2. `PHOTO_GUARD` — dans le navigateur, juste avant toute capture (`withPage`) : ce que le texte n'a pas vu
 *      (filtre posé sur un parent, calque en mélange qui couvre la photo, filtre SVG) est neutralisé sur les
 *      styles CALCULÉS. Le logo et les petites images (icônes) ne sont pas concernés.
 */

/** Un utilitaire Tailwind qui altère les couleurs ou la netteté d'une image. */
const FILTER_TOKEN =
  /^(?:[\w-]+:)*!?(?:grayscale(?:-\S+)?|sepia(?:-\S+)?|invert(?:-\S+)?|-?hue-rotate-\S+|saturate-\S+|contrast-\S+|brightness-\S+|blur(?:-\S+)?|mix-blend-\S+|filter|\[filter:\S+\]|\[mix-blend-mode:\S+\])$/;

/** Les modes de mélange qui RECOLORENT la couche du dessous (un calque de couleur posé dessus). */
const RECOLOUR_BLEND = /\bmix-blend-(?:color|hue|saturation|luminosity|difference|exclusion|multiply|screen|overlay|soft-light|hard-light|color-burn|color-dodge|darken|lighten)\b/;

function cleanClass(cls: string): { cls: string; removed: string[] } {
  const removed: string[] = [];
  const kept = cls.split(/\s+/).filter((t) => {
    if (t && FILTER_TOKEN.test(t)) {
      removed.push(t);
      return false;
    }
    return !!t;
  });
  return { cls: kept.join(' '), removed };
}

export function stripImageFilters(html: string): { html: string; removed: string[] } {
  const removed: string[] = [];
  // 1. Les images de contenu (jamais le logo, qui peut être passé en blanc volontairement).
  let out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\sdata-ge-logo\b/i.test(tag)) return tag;
    return tag
      .replace(/\sclass="([^"]*)"/i, (_m, cls: string) => {
        const c = cleanClass(cls);
        removed.push(...c.removed);
        return c.cls ? ` class="${c.cls}"` : '';
      })
      .replace(/\sstyle="([^"]*)"/i, (m, style: string) => {
        const kept = style.split(';').filter((d) => !/^\s*(-webkit-)?(filter|mix-blend-mode)\s*:/i.test(d));
        if (kept.length === style.split(';').length) return m;
        removed.push('style:filter');
        return kept.join(';').trim() ? ` style="${kept.join(';')}"` : '';
      });
  });
  // 2. Les calques VIDES qui recolorent ce qu'ils couvrent : une couche en mode de mélange qui couvre toute sa
  //    boîte (inset-0, ou pleine taille en absolu) n'a qu'un rôle, teinter l'image de dessous.
  out = out.replace(/<(div|span)\b([^>]*\sclass="([^"]*)"[^>]*)>\s*<\/\1>/gi, (m, _tag: string, _attrs: string, cls: string) => {
    if (!RECOLOUR_BLEND.test(cls)) return m;
    const covers = /\binset-0\b/.test(cls) || (/\babsolute\b/.test(cls) && /\bh-full\b/.test(cls) && /\bw-full\b/.test(cls));
    if (!covers) return m;
    removed.push('overlay:mix-blend');
    return '';
  });
  return { html: out, removed };
}

/**
 * Exécuté DANS la page (chaîne, pas de fonction TypeScript : voir `WAIT_FOR_ASSETS`). Rend le nombre de
 * neutralisations. Une image « de contenu » : visible, ≥ 2 % de la page, hors logo.
 */
export const PHOTO_GUARD = `(function () {
  var COLOUR_FN = /(grayscale|sepia|invert|hue-rotate|saturate|contrast|brightness|blur|url\\()/i;
  var vw = Math.max(1, document.documentElement.clientWidth), vh = Math.max(1, document.documentElement.clientHeight);
  var fixed = 0;
  var imgs = Array.prototype.filter.call(document.images, function (img) {
    if (img.closest('[data-ge-logo]') || img.hasAttribute('data-ge-logo')) return false;
    var r = img.getBoundingClientRect();
    return r.width * r.height >= 0.02 * vw * vh;
  });
  if (!imgs.length) return 0;
  function inter(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  imgs.forEach(function (img) {
    // L'image et ses parents : aucun filtre de couleur, aucun mélange.
    for (var el = img; el && el !== document.body; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if (cs.filter && cs.filter !== 'none' && COLOUR_FN.test(cs.filter)) { el.style.setProperty('filter', 'none', 'important'); fixed++; }
      if (el === img && cs.mixBlendMode && cs.mixBlendMode !== 'normal') { el.style.setProperty('mix-blend-mode', 'normal', 'important'); fixed++; }
    }
  });
  // Les calques posés SUR une photo : en mode de mélange, ou en filtre d'arrière-plan qui recolore.
  var all = document.body.getElementsByTagName('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.tagName === 'IMG' || el.hasAttribute('data-ge-pattern-layer') || el.closest('[data-ge-logo]')) continue;
    var cs = getComputedStyle(el);
    var blend = cs.mixBlendMode && cs.mixBlendMode !== 'normal';
    var back = cs.backdropFilter && cs.backdropFilter !== 'none' && /(grayscale|sepia|invert|hue-rotate|saturate|contrast|brightness)/i.test(cs.backdropFilter);
    if (!blend && !back) continue;
    var r = el.getBoundingClientRect();
    var covered = imgs.some(function (img) { var ir = img.getBoundingClientRect(); return img.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || el.contains(img) ? inter(r, ir) >= 0.15 * ir.width * ir.height : false; });
    if (!covered) continue;
    if (back) { el.style.setProperty('backdrop-filter', 'none', 'important'); el.style.setProperty('-webkit-backdrop-filter', 'none', 'important'); fixed++; }
    if (blend) {
      // Un calque sans texte n'existe que pour teinter : il disparaît. Un bloc de texte garde son texte, sans mélange.
      if (!(el.textContent || '').trim()) el.style.setProperty('visibility', 'hidden', 'important');
      else el.style.setProperty('mix-blend-mode', 'normal', 'important');
      fixed++;
    }
  }
  return fixed;
})()`;
