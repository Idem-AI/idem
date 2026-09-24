/**
 * Présence des entrées d'un projet — `npm run check:inputs`.
 *
 * Ces trois comptages décident de deux choses visibles : l'avertissement du
 * simulateur avant une lecture, et le REFUS d'écrire une stratégie de
 * communication. Les deux se trompent de la même façon si la règle de présence
 * se relâche — et les deux erreurs sont silencieuses :
 *
 *   trop indulgent → on réclame un livrable déjà produit, ou l'inverse : on
 *                    écrit une stratégie sur des valeurs d'usine et l'on
 *                    annonce qu'elle dérive du business plan ;
 *   trop sévère    → on barre la route à un projet complet.
 *
 * Or aucun des trois ne peut se juger par sa simple présence : `finance`
 * s'écrit garni de ses barèmes d'impôt à la première ouverture du module,
 * `communication` existe dès le premier visuel d'atelier, et un business plan
 * existe dès qu'on a choisi son sommaire. C'est ce qui est vérifié ici, cas par
 * cas, sans réseau ni base.
 *
 *   npx ts-node --transpile-only api/scripts/checkProjectInputs.ts
 */

import {
  PROJECT_INPUT_KEYS,
  ProjectInputKey,
  STRATEGY_REQUIRED_INPUTS,
  assessProjectInputs,
  missingAmong,
} from '../services/common/project-inputs';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Les livrables absents d'un `analysisResultModel` donné. */
const missingOf = (analysis: unknown): ProjectInputKey[] =>
  assessProjectInputs({ analysisResultModel: analysis } as never).missing;

const filledPlan = { id: 'a', sections: [{ name: 'Résumé', type: 'summary', data: '<p>x</p>', summary: 's' }] };
const emptyPlan = { id: 'a', sections: [{ name: 'Résumé', type: 'summary', data: null, summary: '' }] };
const filledFinance = {
  products: [{ id: 'p', name: 'Abonnement', unitPrice: 2000 }],
  salesObjectives: [{ productId: 'p' }],
};
const factoryFinance = { products: [], salesObjectives: [], meta: { currency: 'XAF' } };

// ── Rien du tout ───────────────────────────────────────────────────────────
console.log('\n  Projet sans livrable');

check(
  'les trois entrées sont signalées absentes',
  missingOf({}).join(',') === PROJECT_INPUT_KEYS.join(','),
  missingOf({}).join(', ')
);
check(
  'un projet sans analyse ne lève rien',
  assessProjectInputs(null).missing.length === PROJECT_INPUT_KEYS.length
);

// ── Le business plan ───────────────────────────────────────────────────────
console.log('\n  Business plan');

check(
  "un sommaire choisi mais vide ne compte pas comme un plan",
  missingOf({ businessPlans: [emptyPlan] }).includes('businessPlan')
);
check(
  'une seule section remplie suffit',
  !missingOf({ businessPlans: [filledPlan] }).includes('businessPlan')
);
check(
  "l'ancien emplacement unique compte aussi",
  !missingOf({ businessPlan: filledPlan }).includes('businessPlan')
);
check(
  'un plan vide à côté d’un plan rempli ne masque pas le rempli',
  !missingOf({ businessPlans: [emptyPlan, filledPlan] }).includes('businessPlan')
);

// ── Les prévisions financières ─────────────────────────────────────────────
console.log('\n  Prévisions financières');

check(
  "un modèle aux valeurs d'usine ne compte pas",
  missingOf({ finance: factoryFinance }).includes('finance')
);
check(
  'des produits sans objectif de vente ne suffisent pas',
  missingOf({ finance: { products: filledFinance.products, salesObjectives: [] } }).includes(
    'finance'
  )
);
check(
  'des objectifs sans produit ne suffisent pas',
  missingOf({ finance: { products: [], salesObjectives: filledFinance.salesObjectives } }).includes(
    'finance'
  )
);
check(
  'produits ET objectifs comptent',
  !missingOf({ finance: filledFinance }).includes('finance')
);

// ── La stratégie de communication ──────────────────────────────────────────
console.log('\n  Stratégie de communication');

check(
  'des visuels sans stratégie ne comptent pas',
  missingOf({ communication: { visuals: [{ id: 'v1' }], plans: [{ id: 'p1' }] } }).includes(
    'communication'
  )
);
check(
  'une stratégie sans contenu ne compte pas',
  missingOf({
    communication: { strategy: { summary: '   ', blocks: [{ kind: 'channels', body: '' }] } },
  }).includes('communication')
);
check(
  'un résumé seul suffit',
  !missingOf({ communication: { strategy: { summary: 'Parler aux artisans.', blocks: [] } } }).includes(
    'communication'
  )
);
check(
  'un bloc rempli seul suffit',
  !missingOf({
    communication: { strategy: { summary: '', blocks: [{ kind: 'channels', body: 'LinkedIn' }] } },
  }).includes('communication')
);

// ── Ce que la stratégie exige ──────────────────────────────────────────────
console.log('\n  Exigences de la stratégie de communication');

check(
  'elle exige le business plan et les prévisions, et rien d’autre',
  STRATEGY_REQUIRED_INPUTS.join(',') === 'businessPlan,finance'
);
check(
  "elle ne s'exige pas elle-même",
  !missingAmong(assessProjectInputs(null).inputs, STRATEGY_REQUIRED_INPUTS).includes(
    'communication'
  )
);
check(
  'un projet nu doit produire les deux',
  missingAmong(assessProjectInputs(null).inputs, STRATEGY_REQUIRED_INPUTS).join(',') ===
    'businessPlan,finance'
);
check(
  'plan et prévisions présents : plus rien à exiger',
  missingAmong(
    assessProjectInputs({
      analysisResultModel: { businessPlans: [filledPlan], finance: filledFinance },
    } as never).inputs,
    STRATEGY_REQUIRED_INPUTS
  ).length === 0
);
check(
  "l'ordre de production est respecté (le plan avant les prévisions)",
  missingAmong(assessProjectInputs(null).inputs, ['finance', 'businessPlan']).join(',') ===
    'businessPlan,finance'
);

// ── Le projet complet ──────────────────────────────────────────────────────
console.log('\n  Projet complet');

const complete = {
  businessPlans: [filledPlan],
  finance: filledFinance,
  communication: { strategy: { summary: 'Parler aux artisans.', blocks: [] } },
};
const assessment = assessProjectInputs({ analysisResultModel: complete } as never);
check('aucune entrée manquante', assessment.missing.length === 0, assessment.missing.join(', '));
check(
  'les trois drapeaux sont levés',
  PROJECT_INPUT_KEYS.every((key) => assessment.inputs[key])
);

if (failures > 0) {
  console.error(`\n✗ Entrées d'un projet : ${failures} vérification(s) en échec.\n`);
  process.exit(1);
}
console.log("\n✓ Entrées d'un projet : tout est conforme.\n");
