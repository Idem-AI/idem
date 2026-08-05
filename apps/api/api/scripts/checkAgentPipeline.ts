/**
 * Vérification du socle d'orchestration — `npm run check:agents`.
 *
 * Le projet n'a pas (encore) de harnais de tests ; ce script en tient lieu pour
 * la partie du socle qui est PURE et dont une régression serait silencieuse :
 * la grille de qualité, les graphes de livrables, le routeur de modèles et le
 * budget de run. Aucun appel réseau, aucun modèle, aucune base : il s'exécute
 * partout et en une seconde.
 *
 *   npx ts-node api/scripts/checkAgentPipeline.ts
 */

import {
  BUSINESS_PLAN_GRAPH,
  PITCH_DECK_GRAPH,
  graphDepth,
  validateGraph,
} from '../services/agents/deliverable-graph';
import { inspectOutput, qualityValidator } from '../services/agents/quality-gate';
import { stripMarkup } from '../services/agents/text-extract';
import { createRunBudget } from '../services/agents/run-budget';
import { MODEL_TIERS, applyTier, nextTier, tierForTask, tierOfModel } from '../config/model-router';
import { AI_CONFIG, resolveSectionConfig } from '../config/ai.config';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------- graphes ----
section('Graphes de livrables');

const businessPlanSteps = Object.keys(BUSINESS_PLAN_GRAPH);
const pitchDeckSteps = Object.keys(PITCH_DECK_GRAPH);

validateGraph(BUSINESS_PLAN_GRAPH, businessPlanSteps);
validateGraph(PITCH_DECK_GRAPH, pitchDeckSteps);
check('business plan et deck sont acycliques et complets', true);

check(
  `profondeur du business plan ≤ 3 vagues (mesurée: ${graphDepth(BUSINESS_PLAN_GRAPH)})`,
  graphDepth(BUSINESS_PLAN_GRAPH) <= 3
);
check(
  `profondeur du deck ≤ 3 vagues (mesurée: ${graphDepth(PITCH_DECK_GRAPH)})`,
  graphDepth(PITCH_DECK_GRAPH) <= 3
);
check(
  "'Ask' dépend bien de 'Financials'",
  (PITCH_DECK_GRAPH.Ask.requires ?? []).includes('Financials')
);

let cycleDetected = false;
try {
  validateGraph({ A: { requires: ['B'] }, B: { requires: ['A'] } }, ['A', 'B']);
} catch {
  cycleDetected = true;
}
check('un cycle est refusé', cycleDetected);

let unknownDetected = false;
try {
  validateGraph({ A: { requires: ['Fantôme'] } }, ['A']);
} catch {
  unknownDetected = true;
}
check('une dépendance inconnue est refusée', unknownDetected);

// ----------------------------------------------------------- quality gate ----
section('Grille de qualité (déterministe)');

const validHtml =
  '<section class="p-8"><h1>Plan financier</h1><div class="grid">' +
  '<p>Chiffre d\'affaires prévisionnel de 45 000 000 FCFA en année 1, porté par 3 gammes.</p>' +
  '<p>Le seuil de rentabilité est atteint au 14e mois avec une marge brute de 38 %.</p>' +
  '</div></section>';

check('un HTML complet passe', inspectOutput(validHtml, { format: 'html' }).ok);

check(
  'une balise conteneur non refermée est détectée',
  !inspectOutput('<section><div><p>Contenu coupé au milieu de la génération</p>', {
    format: 'html',
    minChars: 10,
  }).ok
);

check(
  'une sortie finissant dans une balise est détectée',
  !inspectOutput(`${validHtml}<div class="`, { format: 'html' }).ok
);

check(
  'une clôture de bloc de code est détectée',
  !inspectOutput('```html\n<section><p>Contenu</p></section>\n```', {
    format: 'html',
    minChars: 10,
  }).ok
);

check(
  'un gabarit non rempli est détecté',
  !inspectOutput(validHtml.replace('45 000 000 FCFA', '[INSERT REVENUE]'), { format: 'html' }).ok
);

check(
  'une fuite du prompt interne est détectée',
  !inspectOutput(`SPECIFIC INSTRUCTIONS FOR 'Cover Page':\n${validHtml}`, { format: 'html' }).ok
);

check(
  'un bavardage introductif est détecté',
  !inspectOutput(`Voici le HTML demandé pour la section :\n${validHtml}`, { format: 'html' }).ok
);

const withChartJs =
  '<section><div id="chart"><canvas id="c"></canvas></div>' +
  '<script>const tpl = \'<div class="legend"><span>CA</span></div>\'; new Chart(c, {});</script>' +
  '<p>Projection de chiffre d\'affaires sur trois exercices, en francs CFA.</p></section>';
check(
  'une balise écrite dans du JavaScript ne fausse pas le comptage',
  inspectOutput(withChartJs, { format: 'html' }).ok,
  inspectOutput(withChartJs, { format: 'html' }).summary
);

check(
  'une troncature à l\'intérieur d\'un script reste détectée',
  !inspectOutput('<section><div><script>const a = "<div>"; ', {
    format: 'html',
    minChars: 10,
  }).ok
);

const currencyReport = inspectOutput(validHtml.replace('FCFA', '$'), {
  format: 'html',
  currency: 'XAF',
});
check(
  'une devise étrangère est signalée sans bloquer',
  currencyReport.ok && currencyReport.issues.some((i) => i.code === 'currency_mismatch')
);

check('un JSON invalide est détecté', !inspectOutput('{"a": 1,', { format: 'json', minChars: 5 }).ok);
check('un JSON valide passe', inspectOutput('{"a": 1, "b": [2, 3]}', { format: 'json', minChars: 5 }).ok);

const validator = qualityValidator({ format: 'html' });
check('le validateur relaie le verdict au runtime', validator(validHtml).ok && !validator('').ok);

// ----------------------------------------------------------------- digest ----
section('Extraction de texte (digest déterministe)');

const stripped = stripMarkup(
  '<style>.a{color:red}</style><section><h1>Marché</h1><p>TAM de 12 M€ &amp; 3 segments.</p></section>'
);
check('le balisage et les styles sont retirés', !/[<>]/.test(stripped), stripped);
check('les faits sont conservés', stripped.includes('12 M€') && stripped.includes('3 segments'));
check(
  'la réduction est significative',
  stripped.length < 60,
  `${stripped.length} caractères: "${stripped}"`
);

// ----------------------------------------------------------------- routeur ----
section('Routeur de modèles');

check("une tâche mécanique part au tier XS", tierForTask('digest') === 'XS');
check('une rédaction part au tier M', tierForTask('draft') === 'M');
check('une tâche de raisonnement part au tier S', tierForTask('strategy') === 'S');
check("l'escalade s'arrête au sommet", nextTier('S') === undefined && nextTier('XS') === 'M');
check(
  'un modèle « pro » est reconnu comme tier S',
  tierOfModel(MODEL_TIERS.S.modelName) === 'S' && tierOfModel('gemini-3.1-pro-preview') === 'S'
);

const coverConfig = resolveSectionConfig(AI_CONFIG.businessPlan, 'Cover Page');
check("la page de garde est routée au tier M", coverConfig.tier === 'M');
const coverRouted = applyTier(coverConfig);
check(
  'le routage remplace bien le modèle de la feature',
  coverRouted.modelName === MODEL_TIERS.M.modelName,
  `obtenu: ${coverRouted.modelName}`
);
check(
  'le budget de tokens de la section survit au routage',
  coverRouted.llmOptions?.maxOutputTokens === 9000,
  `obtenu: ${coverRouted.llmOptions?.maxOutputTokens}`
);

const financialConfig = applyTier(resolveSectionConfig(AI_CONFIG.businessPlan, 'Financial Plan'));
check(
  'une section non routée garde le modèle de la feature',
  financialConfig.modelName === AI_CONFIG.businessPlan.modelName
);

const explicitModel = applyTier(
  resolveSectionConfig(
    { ...AI_CONFIG.businessPlan, sections: { X: { modelName: 'modele-impose', tier: 'XS' } } },
    'X'
  )
);
check(
  "un modelName explicite l'emporte sur l'étage",
  explicitModel.modelName === 'modele-impose',
  `obtenu: ${explicitModel.modelName}`
);

// ------------------------------------------------------------------ budget ----
section('Budget de run');

const budget = createRunBudget('test', 1000);
budget.consume(400);
check('la consommation est suivie', budget.used === 400 && budget.remaining === 600);
check("le budget n'est pas épuisé prématurément", !budget.exhausted);
budget.consume(700);
check('le dépassement coupe le circuit', budget.exhausted && budget.remaining === 0);

// ------------------------------------------------------------------ verdict ----
console.log('');
if (failures > 0) {
  console.error(`${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('Socle d\'orchestration: toutes les vérifications passent.');
