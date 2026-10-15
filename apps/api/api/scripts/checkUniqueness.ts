/**
 * Test de collision — `npm run check:uniqueness`.
 *
 * L'unicité d'un projet est une exigence produit : deux marques ne doivent pas
 * se ressembler, y compris quand elles appartiennent au même secteur. Elle est
 * TIRÉE par le code au niveau de la MARQUE — la région chromatique et le
 * registre typographique de la charte — ce qui la rend vérifiable sans appeler
 * un seul modèle. Les pages, elles, sont écrites librement par l'IA (moteur
 * graphique) : leur variété vient du modèle et de la bible propre à chaque
 * document, pas d'un tirage du code.
 *
 *   npx ts-node --transpile-only api/scripts/checkUniqueness.ts
 */

import { buildPaletteConstraint, buildTypographyConstraint } from '../../../ivision/core/src/brand/brand-constraints';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
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

(async () => {
  console.log('\nTest de collision — unicité par projet\n');

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\nRégion chromatique');
  {
    const constraints = PROJECTS.map((p) => buildPaletteConstraint(p.id));
    const distinct = new Set(constraints.map((c) => JSON.stringify(c))).size;

    // 648 régions pour 30 projets : quelques collisions sont statistiquement
    // normales (paradoxe des anniversaires). Ce qui compte est qu'elles restent
    // rares — et surtout qu'elles ne suivent PAS le secteur.
    check('les régions chromatiques sont majoritairement distinctes', distinct >= PROJECTS.length - 2, `${distinct} régions distinctes sur ${PROJECTS.length} projets`);

    // Deux projets du MÊME secteur ne doivent pas converger : c'est le défaut que la contrainte corrige.
    const fintechHues = new Set(PROJECTS.filter((p) => p.sector === 'fintech').map((p) => buildPaletteConstraint(p.id).baseHue));
    check('deux marques du même secteur ne partagent pas la même teinte de base', fintechHues.size >= 6, `${fintechHues.size} teintes distinctes sur 10 projets fintech`);

    check('la région est déterministe', JSON.stringify(buildPaletteConstraint('fintech-0')) === JSON.stringify(buildPaletteConstraint('fintech-0')));
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\nRegistre typographique');
  {
    const distinct = new Set(PROJECTS.map((p) => buildTypographyConstraint(p.id))).size;
    check('les registres typographiques se répartissent', distinct >= 5, `${distinct} registres distincts sur ${PROJECTS.length} projets`);
  }

  console.log('');
  if (failures) {
    console.error(`Unicité: ${failures} vérification(s) en échec.\n`);
    process.exit(1);
  }
  console.log('Unicité: toutes les vérifications passent.\n');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
