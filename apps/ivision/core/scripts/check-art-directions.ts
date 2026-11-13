/**
 * CONTRÔLE DES DIRECTIONS ARTISTIQUES — `npm run check:art-directions` (aucun modèle, aucun réseau).
 *
 * Décision du 11/11/2026 : la DA d'une marque est CHOISIE dans le catalogue (`idem-templates/catalog/directions`),
 * jamais rédigée par un modèle. On vérifie :
 *   §1 le catalogue : 30 DA, ≥ 5 inspirations chacune, des déclinaisons pour chaque champ, des voisines existantes ;
 *   §2 le choix : une DA inventée, à fond sombre imposé ou écartée retombe sur une DA proposable ; une déclinaison
 *      inventée prend la première ; chaque texte de la direction composée vient MOT POUR MOT de la fiche ;
 *   §3 l'import d'un site : la direction rangée dans la marque est celle du catalogue, jamais l'ébauche de la vision ;
 *   §4 le moteur graphique lit les fiches (rayon, échelle, humeurs) ; les catalogues filtrent par DA.
 */
import path from 'path';
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');

import { STYLE_DATA, catalog, directionsSync, getDirection, resolveStyle as engineStyle } from '@idem/graphic-engine';
import { brandTraits, inDirection } from '../../../../packages/graphic-engine/src/catalog/graph';
import { composeArtDirection, directionFromReplies, DIRECTION_FIELDS, recomposeArtDirection } from '../src/brand/art-direction.compose';
import { brandKitFromScan } from '../src/site/site-scanner';
import { videoCatalog } from '../src/video/catalog/registry';
import { inDirection as videoInDirection } from '../src/video/catalog/graph';

let passed = 0;
let failed = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail && !cond ? ` — ${detail}` : ''}`);
};

async function main(): Promise<void> {
  console.log('§1 Le catalogue des DA');
  const all = [...directionsSync().values()];
  ok('30 directions artistiques chargées depuis le dépôt', all.length === 30, String(all.length));
  ok('au moins 5 sources d’inspiration par DA', all.every((d) => d.inspirations.length >= 5), all.filter((d) => d.inspirations.length < 5).map((d) => d.id).join(', '));
  ok('des déclinaisons (≥ 2) pour chaque champ de chaque DA', all.every((d) => DIRECTION_FIELDS.every((f) => (d.variants[f] as unknown[]).length >= 2)));
  ok('chaque voisine existe', all.every((d) => d.neighbors.every((n) => directionsSync().has(n))));
  ok('les 20 DA d’origine restent valables (marques déjà enregistrées)', ['minimalism', 'maximalism', 'futuristic', 'vector-art', 'collage-art', 'retro', 'cyberpunk', 'pop-art', 'glassmorphism', 'clay', 'pixel-art', 'editorial', 'y2k', 'swiss', 'surreal', 'bohemian', 'victorian', 'graffiti', 'aurora', 'handwritten'].every((id) => directionsSync().has(id)));
  ok('dix nouvelles DA, dont quatre ancrées dans les cultures visuelles africaines', ['afro-modernism', 'wax-print', 'african-geometry', 'sign-painting', 'neo-brutalism', 'art-deco', 'bauhaus', 'memphis', 'risograph', 'quiet-luxury'].every((id) => directionsSync().has(id)));
  ok('seul un fond sombre imposé est hors choix', all.filter((d) => !d.selectable).every((d) => d.surface === 'dark') && all.filter((d) => d.surface === 'dark').every((d) => !d.selectable));

  console.log('§2 Le choix de l’agent');
  const invented = directionFromReplies({ styleId: 'afro-futurisme-néon', rationale: 'Parce que.' }, { variants: { grid: 'g9', tagline: 'inventée' }, subjects: 'des producteurs au marché' });
  ok('DA inventée → repli sur une DA du catalogue (éditorial)', invented.styleId === 'editorial' && invented.direction.styleId === 'editorial', invented.styleId);
  ok('déclinaison inventée → la première de la fiche', invented.direction.variants?.grid === 'g1' && invented.direction.variants?.tagline === 't1');
  const dark = directionFromReplies({ styleId: 'cyberpunk' }, null);
  ok('DA à fond sombre imposé → jamais retenue', dark.styleId !== 'cyberpunk', dark.styleId);
  const excluded = directionFromReplies({ styleId: 'swiss' }, null, { excluded: ['swiss'] });
  ok('DA écartée (« proposer une autre direction ») → jamais rendue', excluded.styleId !== 'swiss', excluded.styleId);
  const wax = getDirection('wax-print')!;
  const picked = directionFromReplies({ styleId: 'wax-print', rationale: 'Une marque de mode de Dakar.' }, { variants: { tagline: 't2', keywords: 'k3', grid: 'g2', whitespace: 'w1', signatureMove: 's3', recipes: 'r2', color: 'c1', typography: 'y3', imagery: 'i1', graphicDevices: 'd2' }, subjects: 'des mannequins en wax dans les rues de Dakar' });
  const d = picked.direction;
  const fromNode = (text: string, list: string[]) => list.includes(text);
  ok('formule, grille, blanc, geste : mot pour mot depuis les déclinaisons choisies', d.tagline === wax.variants.tagline[1].text && d.layout.grid === wax.variants.grid[1].text && d.layout.whitespace === wax.variants.whitespace[0].text && d.layout.signatureMove === wax.variants.signatureMove[2].text);
  ok('couleur, typographie, image, dispositifs : mot pour mot', fromNode(d.color.application, wax.variants.color.map((v) => v.application)) && fromNode(d.typography.caseAndTracking, wax.variants.typography.map((v) => v.caseAndTracking)) && fromNode(d.imagery.treatment, wax.variants.imagery.map((v) => v.treatment)) && JSON.stringify(d.graphicDevices) === JSON.stringify(wax.variants.graphicDevices[1].items));
  ok('à faire, à éviter, modificateur d’image : ceux de la fiche', JSON.stringify(d.dos) === JSON.stringify(wax.dos) && JSON.stringify(d.donts) === JSON.stringify(wax.donts) && d.imagePromptModifier === wax.image.modifier);
  ok('seuls la raison du choix et les sujets des images viennent de l’agent', d.rationale === 'Une marque de mode de Dakar.' && d.imagery.subjects === 'des mannequins en wax dans les rues de Dakar');
  ok('les inspirations de la DA voyagent avec la direction (charte)', (d.inspirations ?? []).length >= 5);
  const again = recomposeArtDirection({ ...d, tagline: 'texte modifié à la main', layout: { ...d.layout, grid: 'grille inventée' } });
  ok('une direction enregistrée se recompose depuis la fiche (textes hors catalogue effacés)', again.tagline === d.tagline && again.layout.grid === d.layout.grid);

  console.log('§3 L’import d’un site');
  const kit = brandKitFromScan(
    {
      palettes: [{ id: 'p', colors: { primary: '#123456', secondary: '#654321', accent: '#ff9900', background: '#ffffff', text: '#111111' } }],
      typographies: [{ id: 't', display: 'Fraunces', body: 'Karla' }],
      logo: {},
      artDirection: { styleId: 'retro', tagline: 'ébauche inventée par la vision', keywords: ['x'] },
    } as never
  );
  ok('la marque reçoit la DA du catalogue la plus proche, jamais l’ébauche de la vision', kit.artDirection?.styleId === 'retro' && kit.artDirection?.tagline !== 'ébauche inventée par la vision' && getDirection('retro')!.variants.tagline.some((v) => v.text === kit.artDirection?.tagline));

  console.log('§4 Moteurs et catalogues');
  ok('le moteur graphique lit rayon et échelle des fiches (30 DA dans STYLE_DATA)', all.every((x) => STYLE_DATA[x.id]?.radius === x.radius && STYLE_DATA[x.id]?.typeRatio === x.typeRatio));
  ok('une nouvelle DA est connue des jetons du moteur', engineStyle('bauhaus').id === 'bauhaus');
  ok('les humeurs de la marque viennent de sa fiche', JSON.stringify(brandTraits({ styleId: 'memphis' } as never, false).moods.sort()) === JSON.stringify([...getDirection('memphis')!.tags.mood].sort()));
  const cat = await catalog();
  ok('catalogue images : chaque nœud appartient à une DA existante', [...cat.nodes.values()].filter((n) => !n.id.startsWith('builtin.')).every((n) => (n.directions ?? []).length > 0 && n.directions!.every((x) => cat.directions.has(x))) && cat.rejected.length === 0, JSON.stringify(cat.rejected.slice(0, 3)));
  const skins = [...cat.nodes.values()].filter((n) => n.kind === 'skin');
  const forSwiss = inDirection(cat, skins, 'swiss');
  ok('le graphe ne sert à une marque que les habillages de sa DA', forSwiss.length > 0 && forSwiss.every((s) => s.directions?.includes('swiss')), forSwiss.map((s) => s.id).join(', '));
  const vids = await videoCatalog();
  ok('catalogue vidéo : chaque nœud appartient à une DA existante', [...vids.nodes.values()].filter((n) => !n.id.startsWith('builtin.')).every((n) => (n.directions ?? []).length > 0) && vids.rejected.length === 0, JSON.stringify(vids.rejected.slice(0, 3)));
  const themes = [...vids.nodes.values()].filter((n) => n.kind === 'theme' && !n.id.startsWith('builtin.'));
  const forLux = videoInDirection(vids, themes, 'quiet-luxury');
  ok('un film ne prend que les thèmes de la DA de sa marque', forLux.length > 0 && forLux.every((t) => t.directions?.includes('quiet-luxury')), forLux.map((t) => t.id).join(', '));

  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
