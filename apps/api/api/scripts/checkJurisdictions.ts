/**
 * Cohérence du registre des juridictions comptables — `npm run check:jurisdictions`.
 *
 * Le registre est de la DONNÉE : dix-sept États OHADA, une quinzaine d'autres
 * pays, une soixantaine d'alias de saisie. C'est exactement le genre de table
 * qui pourrit en silence — un alias dupliqué qui écrase l'autre, un pays ajouté
 * sans devise, un État OHADA dont la règle d'exercice diverge du traité. Aucun
 * de ces défauts ne se voit à la lecture, et tous produisent un document dont
 * l'en-tête annonce une conformité qui n'est pas la bonne.
 *
 * Le script ne teste donc pas un modèle : il teste les invariants du registre.
 * Aucun réseau, aucune base, aucune clé d'API.
 *
 *   npx ts-node --transpile-only api/scripts/checkJurisdictions.ts
 */

import {
  JURISDICTIONS,
  UNKNOWN_JURISDICTION,
  fiscalYearStatement,
  requiresCalendarYear,
  resolveJurisdiction,
} from '../services/common/accounting-jurisdiction';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n  Registre des juridictions');

// ── Intégrité de la table ──────────────────────────────────────────────────
const ids = JURISDICTIONS.map((j) => j.id);
check('les identifiants sont uniques', new Set(ids).size === ids.length);

const isoCodes = JURISDICTIONS.map((j) => j.iso2);
check('les codes ISO sont uniques', new Set(isoCodes).size === isoCodes.length);

check(
  'chaque juridiction porte une devise, un référentiel et une base réglementaire',
  JURISDICTIONS.every((j) => !!j.currency && !!j.frameworkLabel && !!j.fiscalYearBasis),
  JURISDICTIONS.filter((j) => !j.currency || !j.frameworkLabel || !j.fiscalYearBasis)
    .map((j) => j.id)
    .join(', ')
);

check(
  'tout taux d’impôt indicatif est daté',
  JURISDICTIONS.every((j) => j.defaultCorporateTaxRatePct === undefined || !!j.taxAsOf),
  JURISDICTIONS.filter((j) => j.defaultCorporateTaxRatePct !== undefined && !j.taxAsOf)
    .map((j) => j.id)
    .join(', ')
);

check(
  'les taux indicatifs restent dans une fourchette plausible (10 %-45 %)',
  JURISDICTIONS.every(
    (j) =>
      j.defaultCorporateTaxRatePct === undefined ||
      (j.defaultCorporateTaxRatePct >= 10 && j.defaultCorporateTaxRatePct <= 45)
  )
);

// ── L'invariant OHADA ──────────────────────────────────────────────────────
console.log('\n  Espace OHADA');

const ohadaStates = JURISDICTIONS.filter((j) => j.ohada);
check('les dix-sept États parties sont présents', ohadaStates.length === 17, `${ohadaStates.length} trouvés`);
check(
  'tous appliquent le SYSCOHADA',
  ohadaStates.every((j) => j.framework === 'syscohada')
);
check(
  'tous imposent l’exercice calé sur l’année civile',
  ohadaStates.every((j) => requiresCalendarYear(j)),
  ohadaStates.filter((j) => !requiresCalendarYear(j)).map((j) => j.id).join(', ')
);
check(
  'aucun pays hors OHADA n’est marqué SYSCOHADA',
  JURISDICTIONS.every((j) => j.ohada || j.framework !== 'syscohada')
);

// ── Résolution depuis une saisie libre ─────────────────────────────────────
console.log('\n  Résolution du pays');

const SAMPLES: [string, string][] = [
  ['Cameroun', 'cm'],
  ['cameroon', 'cm'],
  ['CM', 'cm'],
  ['Douala, Cameroun', 'cm'],
  ["Côte d'Ivoire", 'ci'],
  ['cote divoire', 'ci'],
  ['Ivory Coast', 'ci'],
  ['Guinée', 'gn'],
  ['Guinée équatoriale', 'gq'],
  ['Guinée-Bissau', 'gw'],
  ['RDC', 'cd'],
  ['Nigeria', 'ng'],
  ['Lagos, Nigeria', 'ng'],
  ['South Africa', 'za'],
  ['Afrique du Sud', 'za'],
  ['Maroc', 'ma'],
  ['Égypte', 'eg'],
];
for (const [input, expected] of SAMPLES) {
  const resolved = resolveJurisdiction(input);
  check(`« ${input} » → ${expected}`, resolved.id === expected, `obtenu ${resolved.id}`);
}

check(
  'un pays inconnu retombe sur la juridiction non déterminée',
  resolveJurisdiction('Atlantide').id === UNKNOWN_JURISDICTION.id &&
    resolveJurisdiction('').id === UNKNOWN_JURISDICTION.id &&
    resolveJurisdiction(undefined).id === UNKNOWN_JURISDICTION.id
);

check(
  'la juridiction de repli n’affirme aucun référentiel',
  UNKNOWN_JURISDICTION.framework === 'unknown' && !UNKNOWN_JURISDICTION.ohada
);

// ── La phrase de conformité décrit l'exercice RÉEL ─────────────────────────
//
// C'est le défaut qui a motivé ce contrôle : la phrase annonçait l'année civile
// quel que soit le mois de clôture retenu, et le rapport se contredisait sur la
// page même qui établit sa conformité.
console.log('\n  Phrase de conformité');

for (const jurisdiction of [...JURISDICTIONS, UNKNOWN_JURISDICTION]) {
  for (const endMonth of [3, 6, 12]) {
    const effective = requiresCalendarYear(jurisdiction) ? 12 : endMonth;
    const statement = fiscalYearStatement(jurisdiction, effective);
    const claimsCalendarYear = statement.includes('1ᵉʳ janvier au 31 décembre');
    if (effective !== 12 && claimsCalendarYear) {
      failures += 1;
      console.error(
        `  ✗ ${jurisdiction.id} (clôture mois ${effective}) annonce l’année civile — ${statement}`
      );
    }
  }
}
check('aucune juridiction n’annonce l’année civile sur un exercice décalé', true);

console.log(
  failures === 0
    ? '\nJuridictions comptables: toutes les vérifications passent.\n'
    : `\n${failures} vérification(s) en échec.\n`
);
process.exit(failures === 0 ? 0 : 1);
