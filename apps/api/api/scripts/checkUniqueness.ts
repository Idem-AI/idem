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
    const combos =
      (space.archetypes?.length ?? 1) *
      (space.colorStrategies?.length ?? 1) *
      (space.typographyMoods?.length ?? 1) *
      (space.layoutTensions?.length ?? 1) *
      (space.contentDensities?.length ?? 1) *
      (space.graphicAccents?.length ?? 1) *
      5 * // spacingMultiplier
      10 * // imagePosition
      6; // readingDirection
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
  check('le style le plus contraint garde un espace suffisant', smallest >= 50_000);
  check('l\'espace total reste au-dessus du million', total >= 1_000_000);
}

console.log('');
if (failures > 0) {
  console.error(`Unicité: ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log('Unicité: toutes les vérifications passent.\n');
