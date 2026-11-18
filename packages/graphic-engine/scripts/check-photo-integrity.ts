/**
 * `npm run check:photo` — une photo garde SES couleurs (18/11/2026). Reproduit les causes des photos « filtrées » :
 * gabarit duotone (grayscale + calque mix-blend-color), filtre posé sur un parent, calque en mélange sur la photo,
 * consignes de rendu d'image qui demandent une bichromie. Aucun appel de modèle.
 */
import { naturalColourModifier, altersColours } from '@idem/design-tools';
import { stripImageFilters } from '../src/runtime/photo-integrity';
import { pageDocument, withPage } from '../src/runtime/browser';

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
};

const PHOTO = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#c0392b"/><circle cx="200" cy="200" r="120" fill="#27ae60"/></svg>').toString('base64')}`;

async function main() {
  // 1. Le code gardé (gabarit figure.duotone d'avant le 18/11).
  const duotone = `<figure class="relative h-full w-full overflow-hidden"><img src="${PHOTO}" alt="x" class="h-full w-full object-cover grayscale contrast-[1.1] brightness-[1.2] sepia hover:grayscale-0"><div data-ge-decor class="absolute inset-0 bg-brand-primary mix-blend-color"></div></figure>`;
  const cleaned = stripImageFilters(duotone);
  check('html : filtres retirés de l’image', !/grayscale|contrast-|brightness-|sepia/.test(cleaned.html) && /object-cover/.test(cleaned.html), cleaned.html);
  check('html : le calque qui recolore la photo est supprimé', !/mix-blend-color/.test(cleaned.html), cleaned.html);
  const logo = '<img data-ge-logo src="x.png" class="h-[40px] brightness-0 invert">';
  check('html : le logo (passé en blanc volontairement) est intact', stripImageFilters(logo).html === logo);
  const decor = '<div class="absolute right-0 top-0 h-[20%] w-[34%] bg-brand-accent/60 mix-blend-multiply"></div>';
  check('html : une forme de décor en mélange, hors photo, est gardée', stripImageFilters(decor).html === decor);

  // 2. Dans le navigateur : ce que le texte ne voit pas (filtre sur un parent, calque partiel posé sur la photo).
  const body = `<div class="ge-page" style="position:relative;width:600px;height:600px">
    <div id="parent" style="filter:sepia(1) hue-rotate(90deg);width:600px;height:400px"><img id="photo" src="${PHOTO}" style="width:600px;height:400px;mix-blend-mode:luminosity"></div>
    <div id="tint" style="position:absolute;left:0;top:0;width:500px;height:300px;background:#f80;mix-blend-mode:multiply"></div>
    <div id="text" style="position:absolute;left:20px;top:20px;mix-blend-mode:difference;color:#fff">Titre</div>
    <img data-ge-logo id="logo" src="${PHOTO}" style="position:absolute;right:0;bottom:0;width:200px;height:200px;filter:brightness(0) invert(1)">
  </div>`;
  const state = await withPage(pageDocument(body), { width: 600, height: 600 }, (page) =>
    page.evaluate(`(function () {
      var cs = function (id) { return getComputedStyle(document.getElementById(id)); };
      return { parent: cs('parent').filter, photoBlend: cs('photo').mixBlendMode, tint: cs('tint').visibility, text: cs('text').mixBlendMode, textVisible: cs('text').visibility, logo: cs('logo').filter };
    })()`) as Promise<Record<string, string>>
  );
  check('navigateur : filtre de couleur sur un parent de la photo neutralisé', state.parent === 'none', state.parent);
  check('navigateur : mélange posé sur la photo elle-même neutralisé', state.photoBlend === 'normal', state.photoBlend);
  check('navigateur : calque de teinte posé sur la photo masqué', state.tint === 'hidden', state.tint);
  check('navigateur : un petit texte en mélange (ne recolore pas la photo) reste visible et intact', state.text === 'difference' && state.textVisible === 'visible', JSON.stringify(state));
  check('navigateur : le filtre du logo est respecté', /brightness/.test(state.logo), state.logo);

  // 3. Les consignes envoyées au modèle d'image.
  const riso = naturalColourModifier('risograph print aesthetic, two spot color duotone, visible halftone grain, paper texture, slight misregistration, warm printed look, flat lighting');
  check('consigne d’image : bichromie et trame retirées, le reste gardé', !altersColours(riso) && /paper texture/.test(riso) && /flat lighting/.test(riso), riso);
  const pop = naturalColourModifier('pop art treatment, bold halftone dot texture, posterized two-tone subject, thick black outlines');
  check('consigne d’image : posterisation retirée', !/posteri|halftone|two-tone/i.test(pop) && /thick black outlines/.test(pop), pop);
  check('consigne d’image : noir et blanc retiré', !/black and white/i.test(naturalColourModifier('swiss photography, black and white or single accent color, even lighting')));

  console.log(`\n${failed ? `${failed} échec(s)` : 'tout est vert'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
