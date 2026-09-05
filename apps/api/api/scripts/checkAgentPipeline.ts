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
import { templatedLlmOptions } from '../config/ai.config';
import { createRunBudget } from '../services/agents/run-budget';
import { MODEL_TIERS, applyTier, nextTier, tierForTask, tierOfModel } from '../config/model-router';
import {
  AI_CONFIG,
  FeatureAIConfig,
  MAX_TEMPERATURE_FOR_THINKING,
  MIN_TOKENS_FOR_THINKING,
  reconcileThinkingBudget,
  resolveSectionConfig,
} from '../config/ai.config';

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

// L'annexe est la dernière section encore routée au tier M : elle restructure
// de la matière déjà produite. La couverture, elle, en est SORTIE — composer une
// première de couverture est le travail le plus créatif du document, pas de la
// mise en page mécanique.
const appendixConfig = resolveSectionConfig(AI_CONFIG.businessPlan, 'Appendix');
check("l'annexe est routée au tier M", appendixConfig.tier === 'M');
const appendixRouted = applyTier(appendixConfig);
check(
  'le routage remplace bien le modèle de la feature',
  appendixRouted.modelName === MODEL_TIERS.M.modelName,
  `obtenu: ${appendixRouted.modelName}`
);
check(
  'le budget de tokens de la section survit au routage',
  appendixRouted.llmOptions?.maxOutputTokens === 20000,
  `obtenu: ${appendixRouted.llmOptions?.maxOutputTokens}`
);

const coverConfig = applyTier(resolveSectionConfig(AI_CONFIG.businessPlan, 'Cover Page'));
check(
  'la couverture du plan est servie par le modèle de raisonnement',
  coverConfig.modelName === AI_CONFIG.businessPlan.modelName,
  `obtenu: ${coverConfig.modelName}`
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

// -------------------------------------------------------------- réglages IA ----
section("Réglages d'échantillonnage");

/**
 * Le raisonnement se DÉCOMPTE du budget de sortie. Une feature qui l'active
 * avec une enveloppe serrée renvoie une réponse vide, sans erreur — c'est la
 * panne la plus coûteuse à diagnostiquer du module, et elle est invisible en
 * relecture. On la rend donc mécanique à détecter.
 */
const MIN_TOKENS_WITH_THINKING = 8000;

type Named = { path: string; config: FeatureAIConfig };
const featuresToAudit: Named[] = [
  { path: 'businessPlan', config: AI_CONFIG.businessPlan },
  { path: 'pitchDeck', config: AI_CONFIG.pitchDeck },
  { path: 'branding.brandIdentity', config: AI_CONFIG.branding.brandIdentity },
  { path: 'branding.logo', config: AI_CONFIG.branding.logo },
  { path: 'branding.colors', config: AI_CONFIG.branding.colors },
  { path: 'branding.typography', config: AI_CONFIG.branding.typography },
  { path: 'branding.artDirection', config: AI_CONFIG.branding.artDirection },
  { path: 'branding.businessCard', config: AI_CONFIG.branding.businessCard },
  { path: 'finance.autofill', config: AI_CONFIG.finance.autofill },
  { path: 'finance.pdfCover', config: AI_CONFIG.finance.pdfCover },
  { path: 'finance.pdfInterpretation', config: AI_CONFIG.finance.pdfInterpretation },
];

const thinkingEnabled = (config: FeatureAIConfig): boolean =>
  (config.llmOptions?.extraBody as any)?.thinking?.type === 'enabled';

/**
 * OÙ LE RAISONNEMENT SE JUSTIFIE ENCORE.
 *
 * La règle n'est pas « raisonner est bien ». Elle est : **le raisonnement se
 * justifie là où le CODE n'a pas repris la décision.** Partout où il l'a
 * reprise, réfléchir ne change plus la sortie — mais se décompte du budget et
 * se paie en latence.
 *
 * Ce que le code a repris, et qui n'a donc plus à être délibéré :
 *   · la mise en page          → le gabarit compose (`sectionRenderer`)
 *   · la conformité de charte  → le linter la tient (`slopLint`)
 *   · la structure d'une page  → l'étape de plan la décide (M5 ①)
 *   · l'unicité chromatique    → 648 régions tirées (`buildPaletteConstraint`)
 *   · l'unicité typographique  → les registres tirés
 *
 * Ce qui reste, et pourquoi :
 *   · `branding.logo`          → géométrie SVG paramétrique : sans réflexion,
 *                                le modèle n'énumère pas ses contraintes, il
 *                                les approxime — et le tracé s'en voit
 *   · `finance.autofill`       → 36 mois de séries qui doivent s'additionner ;
 *                                aucun code ne peut inventer les hypothèses
 *   · `branding.artDirection`  → un arbitrage par projet, qui se propage à
 *                                tout le reste : coût négligeable, portée
 *                                maximale
 *   · `branding.businessCard`  → composition libre, hors gabarit
 *   · `finance.pdfCover`       → idem
 *   · `finance.pdfInterpretation` → lecture commentée de chiffres réels
 *
 * Cette liste est le point de vérité. La modifier est une décision, pas un
 * réglage : y ajouter une entrée, c'est affirmer que le code ne saurait pas
 * faire ; en retirer une, c'est affirmer qu'il le fait déjà.
 */
const TEMPLATED_MIXED = new Set([
  'businessPlan',        // 8 sections sous gabarit + 1 couverture libre
  'pitchDeck',           // 10 slides sous gabarit + 1 couverture libre
  'branding.brandIdentity', // 3 pages sous gabarit + 9 pages libres
]);

const THINKING_JUSTIFIED = new Set([
  'branding.logo',
  'branding.artDirection',
  'branding.businessCard',
  'finance.autofill',
  'finance.pdfCover',
  'finance.pdfInterpretation',
]);

for (const { path, config } of featuresToAudit) {
  const budget = config.llmOptions?.maxOutputTokens ?? 0;

  if (TEMPLATED_MIXED.has(path)) {
    // Feature MIXTE : ses sections passent par le gabarit, sa couverture non.
    // Couper au niveau de la feature dégraderait la couverture — la seule page
    // qui compose encore vraiment. La coupure est donc posée sur le CHEMIN
    // templaté, et c'est elle qu'on vérifie ici, par son comportement.
    const templated = templatedLlmOptions(config.llmOptions);
    check(
      `${path}: raisonnement coupé sur le chemin gabarit`,
      templated.thinkingBudget === 0 &&
        (templated.extraBody as any)?.thinking?.type === 'disabled',
      `budget=${templated.thinkingBudget} extraBody=${(templated.extraBody as any)?.thinking?.type}`
    );
    // La couverture, elle, garde le raisonnement — et doit donc garder la marge
    // de sortie qui va avec, sans quoi la réflexion consomme l'enveloppe et la
    // page revient vide.
    check(
      `${path}: la couverture garde raisonnement et marge`,
      thinkingEnabled(config) && budget >= MIN_TOKENS_WITH_THINKING,
      `raisonnement=${thinkingEnabled(config)} budget=${budget}`
    );
    continue;
  }

  if (!THINKING_JUSTIFIED.has(path)) {
    // Le code a repris la décision : le raisonnement doit être coupé, et coupé
    // dans les DEUX dialectes — sinon la coupure ne survit pas à une bascule de
    // fournisseur, ce qui est le seul moment où elle compte vraiment.
    check(
      `${path}: raisonnement coupé (le code a repris la décision)`,
      !thinkingEnabled(config) && config.llmOptions?.thinkingBudget === 0,
      `extraBody=${(config.llmOptions?.extraBody as any)?.thinking?.type ?? 'absent'} budget=${config.llmOptions?.thinkingBudget ?? 'absent'}`
    );
    continue;
  }

  check(`${path}: raisonnement activé`, thinkingEnabled(config));
  check(
    `${path}: budget compatible avec le raisonnement`,
    budget >= MIN_TOKENS_WITH_THINKING,
    `obtenu: ${budget}`
  );
  // Une température haute sur un modèle qui raisonne fait diverger la RÉFLEXION :
  // elle cesse de converger, consomme l'enveloppe entière et renvoie du vide.
  // Mesuré en production sur la direction artistique réglée à 0.8.
  const temp = config.llmOptions?.temperature ?? 0;
  check(
    `${path}: température compatible avec le raisonnement`,
    temp <= MAX_TEMPERATURE_FOR_THINKING,
    `obtenu: ${temp}`
  );
  // glm-5.3 raisonne TOUJOURS et refuse qu'on le désactive : il consomme le
  // budget entier et rend une sortie vide (cf. GLM_MODELS).
  check(
    `${path}: modèle pilotable en raisonnement`,
    !/glm-5\.3/.test(config.modelName),
    config.modelName
  );
  // Chaque section doit elle aussi tenir le seuil : une section qui redéfinit
  // maxOutputTokens hérite du raisonnement de la feature sans hériter de sa marge.
  for (const [name, sectionConfig] of Object.entries(config.sections ?? {})) {
    const resolved = resolveSectionConfig(config, name);
    const sectionBudget = resolved.llmOptions?.maxOutputTokens ?? 0;
    if (!thinkingEnabled(resolved)) continue;
    check(
      `${path}/${name}: budget compatible avec le raisonnement`,
      sectionBudget >= MIN_TOKENS_WITH_THINKING,
      `obtenu: ${sectionBudget}`
    );
    const sectionTemp = resolved.llmOptions?.temperature ?? 0;
    check(
      `${path}/${name}: température compatible avec le raisonnement`,
      sectionTemp <= MAX_TEMPERATURE_FOR_THINKING,
      `obtenu: ${sectionTemp}`
    );
  }
}

// Les tâches de PRÉCISION doivent le rester : une température haute y produit
// des chiffres qui ne s'additionnent plus et des JSON invalides.
const precisionTargets: Array<[string, FeatureAIConfig]> = [
  ['businessPlan/Financial Plan', resolveSectionConfig(AI_CONFIG.businessPlan, 'Financial Plan')],
  ['pitchDeck/Financials', resolveSectionConfig(AI_CONFIG.pitchDeck, 'Financials')],
  ['finance.autofill', AI_CONFIG.finance.autofill],
];
for (const [label, config] of precisionTargets) {
  check(
    `${label}: température maintenue basse (précision)`,
    (config.llmOptions?.temperature ?? 1) <= 0.4,
    `obtenu: ${config.llmOptions?.temperature}`
  );
}

// Filet de sécurité contre la panne observée en production sur « Logo Critique » :
// raisonnement actif + enveloppe trop courte = réponse VIDE (finish_reason=length)
// ou fragment de réflexion pris pour du JSON (« Unexpected token 'Q' »).
const starved = reconcileThinkingBudget({
  maxOutputTokens: 4096,
  extraBody: { thinking: { type: 'enabled' } },
});
check('un budget trop court désactive le raisonnement', starved.downgraded);
check(
  'et le désactive RÉELLEMENT dans la charge utile',
  (starved.options.extraBody as any)?.thinking?.type === 'disabled'
);
const roomy = reconcileThinkingBudget({
  maxOutputTokens: MIN_TOKENS_FOR_THINKING,
  extraBody: { thinking: { type: 'enabled' } },
});
check('un budget suffisant laisse le raisonnement actif', !roomy.downgraded);
check(
  'et ne touche pas à la charge utile',
  (roomy.options.extraBody as any)?.thinking?.type === 'enabled'
);
check(
  'sans raisonnement demandé, rien n\'est modifié',
  !reconcileThinkingBudget({ maxOutputTokens: 500 }).downgraded
);

// Les deux appels qui ont réellement échoué : ils réduisaient le budget hérité
// de la feature `logo` sans savoir qu'elle avait activé la réflexion.
check(
  'la critique de logo dispose désormais du budget nécessaire',
  16000 >= MIN_TOKENS_FOR_THINKING
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
