/**
 * Test de collision — `npm run check:uniqueness`.
 *
 * L'unicité d'un projet est une exigence produit : deux marques ne doivent pas
 * se ressembler, y compris quand elles appartiennent au même secteur. Elle était
 * jusqu'ici ESPÉRÉE — obtenue d'une température élevée et d'une consigne de
 * composition transmise en prose, donc soumise à ce que le modèle voulait bien
 * en faire.
 *
 * Elle est désormais TIRÉE par le code (graine de composition, région
 * chromatique, registre typographique), ce qui la rend vérifiable sans appeler
 * un seul modèle. C'est tout l'intérêt : ce script mesure la propriété
 * elle-même, pas une sortie de modèle, donc son résultat est le MÊME sur un gros
 * et sur un petit modèle. Un écart signalerait qu'une dimension est encore
 * laissée au modèle.
 *
 * Aucun réseau, aucune base, aucune clé d'API : il tourne partout, en une
 * seconde, et peut donc être exécuté en intégration continue.
 *
 *   npx ts-node --transpile-only api/scripts/checkUniqueness.ts
 */

import {
  ART_DIRECTION_STYLE_IDS,
  ART_DIRECTION_STYLES,
} from '../services/design/artDirection.catalog';
import { ARCHETYPE_LANDSCAPE } from '../services/design/sectionRenderer';
import {
  FAMILY_DIMENSIONS,
  familiesForStyle,
  familyDistance,
  LAYOUT_FAMILIES,
  pickFamily,
} from '../services/design/layoutFamilies';
import {
  buildDocumentSeed,
  buildPaletteConstraint,
  buildSectionSeed,
  buildTypographyConstraint,
} from '../services/design/designSeed';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Trente projets, dont dix dans le MÊME secteur : le cas qui fait converger. */
const PROJECTS = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `fintech-${i}`, sector: 'fintech' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `agri-${i}`, sector: 'agritech' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `health-${i}`, sector: 'healthtech' })),
];

/** Sections d'un business plan — la structure qui doit varier page à page. */
const SECTIONS = [
  'Cover Page',
  'Company Summary',
  'Opportunity',
  'Target Audience',
  'Products & Services',
  'Marketing & Sales',
  'Financial Plan',
  'Goal Planning',
  'Appendix',
];

console.log("\nTest de collision — unicité par projet\n");

// ─────────────────────────────────────────────────────────────────────────────
console.log('Graine de document');
{
  // Toutes les directions artistiques sont représentées, pour ne pas mesurer
  // l'unicité sur le seul style le plus large.
  const seeds = PROJECTS.map((project, index) => {
    const styleId = ART_DIRECTION_STYLE_IDS[index % ART_DIRECTION_STYLE_IDS.length];
    return JSON.stringify(buildDocumentSeed(styleId, `businessplan:${project.id}`));
  });

  const distinct = new Set(seeds).size;
  check(
    'aucune collision de graine entre projets',
    distinct === seeds.length,
    `${seeds.length - distinct} collision(s) sur ${seeds.length} projets`
  );

  // Reproductibilité : c'est ce qui distingue « unique » de « aléatoire ». Un
  // document régénéré doit retrouver sa composition.
  const again = buildDocumentSeed(ART_DIRECTION_STYLE_IDS[0], 'businessplan:fintech-0');
  const first = buildDocumentSeed(ART_DIRECTION_STYLE_IDS[0], 'businessplan:fintech-0');
  check('la graine est déterministe (même clé ⇒ même graine)',
    JSON.stringify(again) === JSON.stringify(first));

  // Deux livrables d'un même projet ne partagent PAS leur graine : ils se
  // ressemblent par la charte, pas par la composition.
  const plan = buildDocumentSeed(ART_DIRECTION_STYLE_IDS[0], 'businessplan:fintech-0');
  const deck = buildDocumentSeed(ART_DIRECTION_STYLE_IDS[0], 'pitchdeck:fintech-0');
  check('deux livrables d\'un même projet ont des graines distinctes',
    JSON.stringify(plan) !== JSON.stringify(deck));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nGraine de section');
{
  // Dans un même document, les archétypes ne doivent pas se répéter tant que
  // l'espace du style n'est pas épuisé.
  let worstRepeat = 0;
  let worstStyle = '';

  for (const styleId of ART_DIRECTION_STYLE_IDS) {
    const used = new Set<string>();
    const archetypes = SECTIONS.map(
      (name) => buildSectionSeed(styleId, 'businessplan:fintech-0', name, used).archetype
    );
    const available = ART_DIRECTION_STYLES[styleId].seedSpace?.archetypes?.length ?? 12;
    const expectedDistinct = Math.min(available, SECTIONS.length);
    const distinct = new Set(archetypes).size;
    const repeats = expectedDistinct - distinct;
    if (repeats > worstRepeat) {
      worstRepeat = repeats;
      worstStyle = styleId;
    }
  }
  check(
    'aucune répétition d\'archétype tant que le style offre des alternatives',
    worstRepeat === 0,
    `${worstRepeat} répétition(s) évitable(s) sur "${worstStyle}"`
  );

  // Les INVARIANTS, eux, doivent être identiques d'une page à l'autre : c'est
  // ce qui fait un document plutôt qu'une pile de pages.
  const used = new Set<string>();
  const seeds = SECTIONS.map((name) =>
    buildSectionSeed('editorial', 'businessplan:fintech-0', name, used)
  );
  const invariants = seeds.map((seed) =>
    JSON.stringify({
      colorStrategy: seed.colorStrategy,
      typographyMood: seed.typographyMood,
      spacingMultiplier: seed.spacingMultiplier,
      graphicAccent: seed.graphicAccent,
      family: seed.family,
    })
  );
  check('les invariants sont partagés par toutes les pages du document',
    new Set(invariants).size === 1);

  // …et les VARIANTES doivent, elles, varier.
  const variants = seeds.map((seed) => `${seed.archetype}|${seed.layoutTension}`);
  check('la composition varie d\'une page à l\'autre',
    new Set(variants).size >= Math.min(SECTIONS.length, 6),
    `${new Set(variants).size} compositions distinctes sur ${SECTIONS.length} pages`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nRégion chromatique');
{
  const constraints = PROJECTS.map((p) => buildPaletteConstraint(p.id));
  const distinct = new Set(constraints.map((c) => JSON.stringify(c))).size;

  // 648 régions pour 30 projets : quelques collisions sont statistiquement
  // normales (paradoxe des anniversaires). Ce qui compte est qu'elles restent
  // rares — et surtout qu'elles ne suivent PAS le secteur.
  check(
    'les régions chromatiques sont majoritairement distinctes',
    distinct >= PROJECTS.length - 2,
    `${distinct} régions distinctes sur ${PROJECTS.length} projets`
  );

  // Le test qui compte vraiment : deux projets du MÊME secteur ne doivent pas
  // converger. C'est le défaut que la contrainte existe pour corriger.
  const fintech = PROJECTS.filter((p) => p.sector === 'fintech').map((p) =>
    buildPaletteConstraint(p.id)
  );
  const fintechHues = new Set(fintech.map((c) => c.baseHue));
  check(
    'deux marques du même secteur ne partagent pas la même teinte de base',
    fintechHues.size >= 6,
    `${fintechHues.size} teintes distinctes sur ${fintech.length} projets fintech`
  );

  check('la région est déterministe',
    JSON.stringify(buildPaletteConstraint('fintech-0')) ===
      JSON.stringify(buildPaletteConstraint('fintech-0')));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nRegistre typographique');
{
  const registers = PROJECTS.map((p) => buildTypographyConstraint(p.id));
  const distinct = new Set(registers).size;
  check(
    'les registres typographiques se répartissent',
    distinct >= 5,
    `${distinct} registres distincts sur ${PROJECTS.length} projets`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nEspace de tirage');
{
  let total = 0;
  let smallest = Number.POSITIVE_INFINITY;
  let smallestStyle = '';

  for (const styleId of ART_DIRECTION_STYLE_IDS) {
    const space = ART_DIRECTION_STYLES[styleId].seedSpace;
    if (!space) continue;
    // ── CE QUI EST COMPTÉ EST CE QUI EST RENDU ───────────────────────────
    //
    // Le décompte incluait `imagePosition` (facteur 10) et `readingDirection`
    // (facteur 6). Aucune des deux n'était lue par le rendu : elles étaient
    // tirées, transmises au prompt, puis oubliées. Le « million de
    // combinaisons » était donc soixante fois trop optimiste, et c'est
    // précisément pourquoi ce contrôle passait au vert pendant que les chartes
    // sortaient identiques.
    //
    // `readingDirection` reste comptée, mais pour ce qu'elle FAIT : elle
    // reflète les deux dispositions latérales, soit un facteur deux — pas six.
    // `imagePosition` n'est plus comptée du tout, faute de lecteur.
    const combos =
      (space.archetypes?.length ?? 1) *
      (space.colorStrategies?.length ?? 1) *
      (space.typographyMoods?.length ?? 1) *
      (space.layoutTensions?.length ?? 1) *
      (space.contentDensities?.length ?? 1) *
      (space.graphicAccents?.length ?? 1) *
      5 * // spacingMultiplier
      2 * // readingDirection — le reflet des dispositions latérales
      // Les familles de mise en page ouvertes au style. Chacune a ses lecteurs
      // nommés (`familyChrome.ts`, `familyBlocks.ts`) : c'est une dimension
      // RENDUE, et `check:render` vérifie que deux familles ne rendent jamais la
      // même page.
      familiesForStyle(styleId).length;
    total += combos;
    if (combos < smallest) {
      smallest = combos;
      smallestStyle = styleId;
    }
  }

  console.log(`     espace total : ${total.toLocaleString('fr-FR')} combinaisons`);
  console.log(`     style le plus contraint : ${smallestStyle} (${smallest.toLocaleString('fr-FR')})`);

  // Le seuil protège contre une réduction d'espace passée inaperçue : retirer
  // des archétypes d'un `seedSpace` réduit l'unicité sans qu'aucun test ne le
  // signale autrement.
  // Seuils divisés par trente, comme le décompte : ils portaient sur un espace
  // soixante fois surévalué. Les abaisser n'affaiblit pas le contrôle — c'est
  // le contraire, ils mesurent enfin quelque chose.
  check('le style le plus contraint garde un espace suffisant', smallest >= 1_500);
  check('l\'espace total reste au-dessus de cent mille', total >= 100_000);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nStructures réellement rendues');
{
  /*
   * ── LE CONTRÔLE QUI MANQUAIT ────────────────────────────────────────────
   *
   * Tout ce qui précède mesure l'espace de TIRAGE. Rien ne mesurait ce que ce
   * tirage produit à l'écran. Les deux avaient divergé sans bruit : douze
   * archétypes se ramenaient à DEUX structures de page, et un style n'en tire
   * que quatre ou cinq. Deux styles — « minimalism » et « retro » — n'avaient
   * ainsi accès qu'à des archétypes de la même structure : toutes les pages de
   * leurs chartes sortaient identiques, et aucun contrôle ne pouvait le dire.
   *
   * Celui-ci le dit. Il ne regarde pas le catalogue : il regarde la table que
   * le rendu consulte réellement.
   */
  // Relevé à cinq : une charte compte désormais une vingtaine de pages, et
  // trois structures y font six pages identiques. Chaque style tire dans sept à
  // neuf archétypes — le seuil est donc atteignable sans contorsion, et il
  // empêche qu'un élargissement futur n'ajoute que des en-têtes.
  const MIN_STRUCTURES = 5;
  let worst = Number.POSITIVE_INFINITY;
  let worstStyle = '';
  const offenders: string[] = [];

  for (const styleId of ART_DIRECTION_STYLE_IDS) {
    const pool = ART_DIRECTION_STYLES[styleId].seedSpace?.archetypes;
    if (!pool || pool.length === 0) continue;
    const structures = new Set(pool.map((a) => ARCHETYPE_LANDSCAPE[a]));
    if (structures.size < worst) {
      worst = structures.size;
      worstStyle = styleId;
    }
    if (structures.size < MIN_STRUCTURES) {
      offenders.push(`${styleId} (${structures.size} : ${[...structures].join(', ')})`);
    }
  }

  const rendered = new Set(Object.values(ARCHETYPE_LANDSCAPE));
  console.log(`     ${rendered.size} structures de page distinctes : ${[...rendered].sort().join(', ')}`);
  console.log(`     style le plus pauvre : ${worstStyle} (${worst} structures)`);

  check(
    'le rendu propose au moins quatre structures de page',
    rendered.size >= 4,
    `${rendered.size} structures`
  );
  check(
    `chaque style atteint ${MIN_STRUCTURES} structures distinctes`,
    offenders.length === 0,
    offenders.join(' · ')
  );
  check(
    'chaque structure est atteignable par au moins un style',
    [...rendered].every((layout) =>
      ART_DIRECTION_STYLE_IDS.some((styleId) =>
        (ART_DIRECTION_STYLES[styleId].seedSpace?.archetypes ?? []).some(
          (a) => ARCHETYPE_LANDSCAPE[a] === layout
        )
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nFamilles de mise en page');
{
  /*
   * ── POURQUOI CE CONTRÔLE ─────────────────────────────────────────────────
   *
   * Constaté par l'utilisateur le 13 septembre 2026 : « peu importe le projet,
   * c'est toujours les mêmes styles, exactement les mêmes dispositions ». Les
   * contrôles précédents passaient au vert pendant ce temps-là : ils comptaient
   * des réglages, pas des dessins. Ici, chaque valeur vérifiée désigne une
   * fonction de rendu distincte.
   */
  const count = LAYOUT_FAMILIES.length;
  console.log(`     ${count} familles`);
  check('le catalogue compte au moins trente familles', count >= 30, `${count} familles`);
  check(
    'les identifiants de famille sont uniques',
    new Set(LAYOUT_FAMILIES.map((entry) => entry.id)).size === count
  );

  // L'ÉCART : une famille qui ressemble à une autre n'ajoute pas de variété,
  // elle ajoute un doublon.
  let closest = { distance: Number.POSITIVE_INFINITY, pair: '' };
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const distance = familyDistance(LAYOUT_FAMILIES[i], LAYOUT_FAMILIES[j]);
      total += distance;
      pairs += 1;
      if (distance < closest.distance) {
        closest = { distance, pair: `${LAYOUT_FAMILIES[i].id} ~ ${LAYOUT_FAMILIES[j].id}` };
      }
    }
  }
  const dimensions = FAMILY_DIMENSIONS.length + 1;
  console.log(
    `     écart minimal : ${closest.distance} dimensions sur ${dimensions} (${closest.pair}), moyenne ${(total / pairs).toFixed(1)}`
  );
  check(
    'deux familles diffèrent toujours sur au moins huit dimensions visibles',
    closest.distance >= 8,
    `${closest.distance} seulement entre ${closest.pair}`
  );

  // LA COUVERTURE : un utilisateur fidèle à un style doit rencontrer beaucoup de
  // familles, pas trois.
  const pools = ART_DIRECTION_STYLE_IDS.map((styleId) => ({ styleId, size: familiesForStyle(styleId).length }));
  const poorest = pools.reduce((a, b) => (b.size < a.size ? b : a));
  console.log(`     style le moins pourvu : ${poorest.styleId} (${poorest.size} familles)`);
  check('chaque style ouvre au moins neuf familles', poorest.size >= 9, `${poorest.styleId} : ${poorest.size}`);
  const narrow = LAYOUT_FAMILIES.filter((entry) => entry.fits.length < 4);
  check(
    'chaque famille convient à au moins quatre styles',
    narrow.length === 0,
    narrow.map((entry) => entry.id).join(', ')
  );

  // CHAQUE DESSIN SERT : une valeur déclarée dans le vocabulaire mais portée par
  // une seule famille (ou aucune) est un dessin qu'on ne rencontre presque
  // jamais — ou du code mort.
  const vocabulary: Record<string, string[]> = {
    headers: ['archetype', 'hanging-number', 'bleed-band', 'centered-rule', 'underscored', 'opener', 'split-lede', 'boxed', 'margin-kicker', 'numbered-rule'],
    folio: ['rule-split', 'centered', 'index-right', 'heavy-bar', 'mark-only', 'tinted-strip'],
    body: ['full', 'offset', 'indexed', 'narrow', 'paired'],
    metrics: ['ruled-row', 'ledger', 'hero-list', 'tiles', 'divided', 'band', 'label-first', 'stacked-rows'],
    table: ['banded', 'booktabs', 'gridded', 'accent-head', 'first-column', 'row-cards', 'inverted-head', 'airy'],
    cards: ['panels', 'numbered', 'outlined', 'edge-stack', 'ruled-columns', 'inverted-lead', 'definitions', 'tagged'],
    timeline: ['rail', 'steps', 'date-column', 'boxes', 'leaders', 'big-dates'],
    quote: ['panel', 'display', 'centered', 'inverted', 'hanging', 'caps'],
    assumption: ['ruled', 'boxed', 'margin', 'inline', 'edge'],
    prose: ['plain', 'drop-cap', 'lead-in', 'columns', 'indented', 'essay'],
    chart: ['keyline', 'headline', 'boxed', 'bare'],
    label: ['caps', 'small-caps', 'italic', 'bold', 'underlined'],
    numbering: ['padded', 'roman', 'section', 'dotted', 'bracketed', 'plain'],
    rules: ['hairline', 'heavy', 'double', 'dotted', 'none'],
    figures: ['accent', 'ink'],
    corners: ['style', 'square'],
    titleScale: ['mood', 'moderate', 'discreet'],
    swatches: ['0', '1', '2'],
  };
  const rare: string[] = [];
  for (const [dimension, values] of Object.entries(vocabulary)) {
    for (const value of values) {
      const users = LAYOUT_FAMILIES.filter((entry) =>
        ([] as unknown[]).concat((entry as unknown as Record<string, unknown>)[dimension]).map(String).includes(value)
      ).length;
      if (users < 2) rare.push(`${dimension}=${value} (${users})`);
    }
  }
  check('chaque dessin du vocabulaire est porté par au moins deux familles', rare.length === 0, rare.join(' · '));

  // LE TIRAGE : quarante projets du même style ne retombent pas sur trois
  // familles, et un même document retrouve la sienne.
  const styleId = 'editorial';
  const drawn = new Set(Array.from({ length: 40 }, (_, i) => pickFamily(styleId, `businessplan:projet-${i}`).id));
  const pool = familiesForStyle(styleId).length;
  check(
    'quarante projets du même style se répartissent sur la plupart de ses familles',
    drawn.size >= Math.min(pool, 10),
    `${drawn.size} familles tirées sur ${pool}`
  );
  check(
    'la famille d\'un document est déterministe',
    pickFamily(styleId, 'businessplan:x').id === pickFamily(styleId, 'businessplan:x').id
  );
  check(
    'la graine de document porte sa famille',
    buildDocumentSeed(styleId, 'businessplan:projet-0').family === pickFamily(styleId, 'businessplan:projet-0').id
  );
}

console.log('');
if (failures > 0) {
  console.error(`Unicité: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Unicité: toutes les vérifications passent.\n');
