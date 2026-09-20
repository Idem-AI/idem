/**
 * Contrôle de MISE EN PAGE du rapport de simulation — `npm run check:simreport`.
 *
 * La mise en page se mesure, elle ne se demande pas. Ce harnais compose le
 * document RÉEL — même liste de chapitres, mêmes options de rendu que le
 * téléchargement — sur un jeu de données représentatif, le rend dans le vrai
 * Chrome, et relit ce que le paginateur a CONSTATÉ :
 *
 *  1. AUCUN AVERTISSEMENT. Le paginateur signale ce qu'il n'a pas su placer.
 *  2. AUCUN BLOC RÉDUIT. Un bloc que le paginateur a dû mettre à l'échelle est
 *     un bloc qui ne tenait pas dans la page : sur un document composé à la
 *     main, c'est un défaut de composition, pas une fatalité du contenu.
 *  3. REMPLISSAGE. Aucune page INTERMÉDIAIRE sous le seuil — la dernière page
 *     d'un chapitre s'arrête où le contenu s'arrête, c'est une fin de
 *     chapitre et non une page creuse.
 *  4. VOLUME. Le document reste dans une longueur qu'on lit.
 *
 * Le PDF est conservé à côté pour la vérification à l'œil, qu'aucune de ces
 * quatre assertions ne remplace : elles voient la géométrie, pas le document.
 *
 *   npm run check:simreport
 */

import { copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import {
  BusinessBaseline,
  Evidence,
  Factor,
  FinancialPoint,
  Recommendation,
  Risk,
  Scenario,
  SimulationModel,
  SimulationReport,
  createSimulation,
} from '../models/simulation.model';
import { PdfService } from '../services/pdf.service';
import { FlowPaginationReport } from '../services/pdf/flow-pagination.runtime';
import {
  buildFinancialSummary,
  computeSensitivity,
  computeUnitEconomics,
  computeViability,
  computeViabilityConditions,
  projectBusiness,
  runScenario,
} from '../services/Simulation/simulation-engine.service';
import { renderReportDocument } from '../services/Simulation/simulation-report.document';

/** Remplissage minimal accepté sur une page intérieure. */
const MIN_FILL = 0.45;

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Un jeu de données représentatif — volontairement dur
// ---------------------------------------------------------------------------

/**
 * Le cas de test n'est pas un cas facile : marge fine, acquisition coûteuse,
 * rétention moyenne. Un rapport ne casse pas sur le projet qui va bien, il
 * casse sur celui qui a beaucoup à dire.
 */
const BASELINE: BusinessBaseline = {
  unitPrice: 15_000,
  unitVariableCost: 9_200,
  monthlyFixedCosts: 2_400_000,
  acquisitionCost: 12_500,
  initialMonthlyCustomers: 90,
  monthlyGrowthRate: 0.11,
  monthlyRetentionRate: 0.86,
  purchasesPerCustomerPerMonth: 1.4,
  startingCapital: 18_000_000,
  currency: 'FCFA',
};

const FACTORS: Factor[] = [
  {
    id: 'f1',
    name: 'Coût d’acquisition client',
    category: 'Commercial',
    tier: 'critical',
    impact: 92,
    description:
      'Le canal payant absorbe la marge des premiers mois : chaque point de coût d’acquisition en plus retarde le point mort d’environ un mois.',
    lever: 'acquisitionCost',
    leverElasticity: 0.8,
    evidence: {
      id: 'e1',
      label: 'CAC observé sur campagne pilote',
      value: '12 500 FCFA',
      kind: 'data',
      confidence: 'medium',
      source: 'Campagne pilote Douala, T2',
      asOf: '2026-04',
    },
  },
  {
    id: 'f2',
    name: 'Rétention mensuelle',
    category: 'Produit',
    tier: 'critical',
    impact: 88,
    description:
      'La durée de vie client sort directement de la rétention : deux points de rétention en moins retirent près d’un mois de revenus récurrents par client.',
    lever: 'retention',
    leverElasticity: 0.5,
  },
  {
    id: 'f3',
    name: 'Pression concurrentielle sur le prix',
    category: 'Marché',
    tier: 'important',
    impact: 64,
    description:
      'Trois acteurs comparables opèrent sur la même zone ; un alignement tarifaire à la baisse est plausible dès la deuxième année.',
    lever: 'price',
    leverElasticity: 0.4,
    evidence: {
      id: 'e2',
      label: 'Prix moyen des offres comparables',
      value: '13 800 FCFA',
      kind: 'estimate',
      confidence: 'low',
      source: 'Relevé de trois offres concurrentes',
    },
  },
  {
    id: 'f4',
    name: 'Coût logistique du dernier kilomètre',
    category: 'Opérations',
    tier: 'important',
    impact: 57,
    description:
      'La livraison porte l’essentiel du coût variable ; la densité des tournées conditionne la marge unitaire.',
    lever: 'variableCost',
    leverElasticity: 0.35,
  },
  {
    id: 'f5',
    name: 'Saisonnalité des dépenses des ménages',
    category: 'Marché',
    tier: 'secondary',
    impact: 34,
    description:
      'La demande fléchit sur les mois de rentrée scolaire, sans remettre en cause la trajectoire annuelle.',
    lever: 'growth',
    leverElasticity: 0.2,
  },
  {
    id: 'f6',
    name: 'Évolution du cadre réglementaire du paiement mobile',
    category: 'Réglementation',
    tier: 'unknown',
    impact: 41,
    description:
      'Une révision des plafonds de transaction est évoquée sans calendrier : l’effet sur l’encaissement n’a pas pu être établi.',
    lever: 'fixedCost',
  },
];

const SCENARIOS: Scenario[] = [
  {
    id: 's0',
    name: 'Le projet tel qu’il est décrit',
    kind: 'baseline',
    question: 'Que devient le modèle si tout se passe comme prévu ?',
    shifts: [],
  },
  {
    id: 's1',
    name: 'Acquisition plus efficace',
    kind: 'favourable',
    question: 'Et si le bouche-à-oreille réduisait le coût d’acquisition d’un quart ?',
    shifts: [
      { factorId: 'f1', label: 'Coût d’acquisition', lever: 'acquisitionCost', magnitude: -0.25, delta: '−25 %' },
    ],
  },
  {
    id: 's2',
    name: 'Rétention décevante',
    kind: 'adverse',
    question: 'Et si les clients partaient plus vite que prévu ?',
    shifts: [
      { factorId: 'f2', label: 'Rétention', lever: 'retention', magnitude: -0.12, delta: '−12 %' },
    ],
  },
  {
    id: 's3',
    name: 'Guerre des prix',
    kind: 'stress',
    question: 'Et si un concurrent imposait une baisse de prix de 20 % ?',
    shifts: [
      { factorId: 'f3', label: 'Prix unitaire', lever: 'price', magnitude: -0.2, delta: '−20 %' },
      { factorId: 'f1', label: 'Coût d’acquisition', lever: 'acquisitionCost', magnitude: 0.15, delta: '+15 %' },
    ],
  },
  {
    id: 's4',
    name: 'Choc logistique et tarifaire simultané',
    kind: 'extreme',
    question: 'Et si le carburant et la concurrence frappaient le même trimestre ?',
    shifts: [
      { factorId: 'f4', label: 'Coût variable', lever: 'variableCost', magnitude: 0.3, delta: '+30 %' },
      { factorId: 'f3', label: 'Prix unitaire', lever: 'price', magnitude: -0.15, delta: '−15 %' },
      { factorId: 'f2', label: 'Rétention', lever: 'retention', magnitude: -0.1, delta: '−10 %' },
    ],
  },
];

const RISKS: Risk[] = [
  {
    id: 'r1',
    title: 'La marge unitaire ne supporte pas le coût d’acquisition actuel',
    severity: 'critical',
    description:
      'La valeur vie d’un client couvre à peine son acquisition : chaque client gagné consomme de la trésorerie avant d’en produire, et la croissance aggrave le besoin de financement au lieu de le résorber.',
  },
  {
    id: 'r2',
    title: 'Le point mort tombe après l’épuisement de la trésorerie',
    severity: 'critical',
    description:
      'Dans le scénario de référence, la réserve passe sous zéro avant que l’exploitation ne s’équilibre : le modèle est arrêté par sa trésorerie, pas par son marché.',
  },
  {
    id: 'r3',
    title: 'Une baisse de prix de 20 % suffit à casser le modèle',
    severity: 'high',
    description:
      'Le stress test tarifaire ne laisse aucune marge de manœuvre : le modèle repose sur le maintien d’un prix qu’aucun contrat ne protège.',
  },
  {
    id: 'r4',
    title: 'L’effet du cadre réglementaire du paiement mobile reste inconnu',
    severity: 'moderate',
    description:
      'Aucune donnée ne permet de chiffrer l’impact d’une révision des plafonds de transaction sur l’encaissement.',
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'a1',
    title: 'Basculer un tiers de l’acquisition sur la prescription',
    body: 'Le canal payant porte l’essentiel du coût d’acquisition. Un programme de parrainage adossé aux clients des trois premiers mois déplace une part du volume vers un canal dont le coût marginal est proche de zéro, et fait remonter le rapport valeur vie / coût d’acquisition au-dessus du seuil de 3.',
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'medium',
    addressesRiskId: 'r1',
  },
  {
    id: 'a2',
    title: 'Réunir le capital sur la profondeur du creux, pas sur le total des pertes',
    body: 'Le besoin de financement est fixé par le point le plus bas de la courbe de trésorerie, atteint avant le point mort. Le tour doit être dimensionné sur ce creux augmenté d’un trimestre de sécurité, et bouclé avant le lancement commercial.',
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'high',
    addressesRiskId: 'r2',
  },
  {
    id: 'a3',
    title: 'Sécuriser le prix par un engagement de durée',
    body: 'Une offre d’abonnement annuel à prix bloqué sur le premier tiers de la base retire au concurrent la capacité de déclencher un alignement tarifaire immédiat, et transforme une part du chiffre d’affaires en revenu contractuel.',
    expectedImpact: 'medium',
    priority: 'high',
    confidence: 'medium',
    addressesRiskId: 'r3',
  },
  {
    id: 'a4',
    title: 'Mettre la densité de tournée sous pilotage hebdomadaire',
    body: 'Le coût du dernier kilomètre est le second poste de coût variable. Un suivi hebdomadaire du nombre de livraisons par tournée, avec un seuil de déclenchement, protège la marge unitaire sans investissement.',
    expectedImpact: 'medium',
    priority: 'medium',
    confidence: 'high',
  },
];

const EVIDENCE: Evidence[] = [
  {
    id: 'e1',
    label: 'Coût d’acquisition client',
    value: '12 500 FCFA',
    kind: 'data',
    confidence: 'medium',
    source: 'Campagne pilote Douala',
    asOf: '2026-04',
    note: 'Mesuré sur 340 clients acquis, hors coût de structure.',
  },
  {
    id: 'e2',
    label: 'Prix moyen des offres comparables',
    value: '13 800 FCFA',
    kind: 'estimate',
    confidence: 'low',
    source: 'Relevé de trois offres concurrentes',
  },
  {
    id: 'e3',
    label: 'Rétention mensuelle',
    value: '86 %',
    kind: 'assumption',
    confidence: 'low',
    note: 'Aucune cohorte n’a encore douze mois d’ancienneté : valeur retenue par comparaison sectorielle.',
  },
  {
    id: 'e4',
    label: 'Charges fixes mensuelles',
    value: '2 400 000 FCFA',
    kind: 'data',
    confidence: 'high',
    source: 'Budget prévisionnel validé',
    asOf: '2026-01',
  },
  {
    id: 'e5',
    label: 'Fréquence d’achat',
    value: '1,4 / mois',
    kind: 'assumption',
    confidence: 'medium',
    note: 'Extrapolée des huit premières semaines d’exploitation.',
  },
];

function buildFixture(): { simulation: SimulationModel; report: SimulationReport } {
  const points: FinancialPoint[] = projectBusiness(BASELINE);
  const scenarios = SCENARIOS.map((scenario) => ({
    ...scenario,
    outcome: runScenario(BASELINE, scenario),
  }));
  const breakdown = computeViability(BASELINE, points);

  const simulation = createSimulation({
    id: 'sim-fixture',
    projectId: 'project-fixture',
    userId: 'user-fixture',
    name: 'Livraison groupée de produits frais',
    origin: 'idem-project',
    tier: 'pack',
    projectName: 'Livraison groupée de produits frais',
    revision: 3,
  });

  const report: SimulationReport = {
    simulationId: simulation.id,
    generatedAt: new Date(),
    executiveSummary: {
      viabilityIndex: scenarios[0].outcome!.viability,
      robustness: 'low',
      confidence: 'low',
      verdict: 'go-with-conditions',
      statement:
        'Le modèle atteint l’équilibre au cours de la deuxième année, mais uniquement si le coût d’acquisition reste au niveau observé sur la campagne pilote. Sous une baisse de prix de 20 %, il ne l’atteint plus du tout : la viabilité tient à un paramètre commercial qu’aucun engagement ne protège aujourd’hui.',
    },
    profile: {
      name: 'Livraison groupée de produits frais',
      sector: 'Distribution alimentaire',
      businessModel: 'Abonnement hebdomadaire avec livraison groupée par quartier',
      product:
        'Un service d’approvisionnement en produits frais qui regroupe les commandes d’un même quartier pour diviser le coût de livraison.',
      targetCustomer: 'Ménages urbains de deux à cinq personnes, revenus intermédiaires',
      market: 'Douala et Yaoundé',
      location: 'Douala',
      country: 'Cameroun',
      currency: 'FCFA',
      pricePoint: '15 000 FCFA par panier hebdomadaire',
      plannedFunding: '25 000 000 FCFA en amorçage',
      teamSize: '4 personnes à temps plein',
    },
    factors: FACTORS,
    scenarios,
    financials: buildFinancialSummary(BASELINE, points),
    sensitivity: computeSensitivity(BASELINE, FACTORS),
    conditions: computeViabilityConditions(BASELINE),
    risks: RISKS,
    recommendations: RECOMMENDATIONS,
    evidence: EVIDENCE,
    validationNeeded: [
      'Le consentement à payer 15 000 FCFA par panier, mesuré sur une centaine de ménages hors du réseau du fondateur.',
      'La rétention réelle à six mois, qu’aucune cohorte ne permet encore d’établir.',
      'La densité de commandes par quartier nécessaire pour que la tournée reste rentable.',
    ],
    verdictRationale:
      'Le verdict est conditionnel et non favorable parce que la robustesse est faible : le modèle ne traverse qu’un scénario adverse sur quatre. Un indice correct obtenu dans le seul scénario de référence ne dit rien de la tenue du modèle en conditions dégradées.',
    strengths: [
      'La marge brute unitaire couvre le coût variable avec une marge de manœuvre réelle.',
      'Le regroupement par quartier crée un avantage de coût qui se renforce avec la densité.',
      'Les charges fixes sont documentées et validées, ce qui rend la trajectoire de coûts fiable.',
    ],
    weaknesses: [
      'La valeur vie client couvre à peine le coût d’acquisition au niveau actuel.',
      'La rétention repose sur une hypothèse sectorielle qu’aucune cohorte ne confirme.',
      'Aucun engagement contractuel ne protège le prix contre un alignement concurrentiel.',
    ],
    keyUncertainties: [
      'La part des ménages prêts à s’engager sur un abonnement plutôt qu’un achat ponctuel.',
      'La réaction tarifaire des acteurs installés à l’arrivée d’une offre groupée.',
      'L’effet d’une révision des plafonds de paiement mobile sur l’encaissement.',
    ],
    factorSummary: {
      total: FACTORS.length,
      critical: FACTORS.filter((f) => f.tier === 'critical').length,
      important: FACTORS.filter((f) => f.tier === 'important').length,
      secondary: FACTORS.filter((f) => f.tier === 'secondary').length,
      unknown: FACTORS.filter((f) => f.tier === 'unknown').length,
    },
    viabilityBreakdown: breakdown,
    unitEconomics: computeUnitEconomics(BASELINE),
    baseline: BASELINE,
  };

  return { simulation, report };
}

// ---------------------------------------------------------------------------
// Contrôle
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const outDir = resolve(process.cwd(), 'tmp', 'simulation-report');
  mkdirSync(outDir, { recursive: true });

  console.log('\nRAPPORT DE SIMULATION — contrôle de mise en page\n');

  const { simulation, report } = buildFixture();

  await PdfService.initialize();

  let pagination: FlowPaginationReport | undefined;
  const filePath = await renderReportDocument(simulation, report, (r) => {
    pagination = r;
  });

  console.log(`\n  PDF : ${filePath}\n`);

  if (!pagination) {
    check('Le paginateur a rendu son rapport', false, 'aucun rapport de pagination reçu');
    return;
  }

  const paged: FlowPaginationReport = pagination;
  const flowed = paged.sections.filter((s) => !s.fixed);

  console.log(`  ${paged.totalPages} pages, ${paged.sections.length} sections\n`);
  for (const s of paged.sections) {
    const fills = s.fills.map((f) => `${Math.round(f * 100)} %`).join(' · ');
    console.log(
      `  ${s.name.padEnd(24)} ${String(s.pages).padStart(2)} page(s)  remplissage ${fills}` +
        `${s.splits ? `  · ${s.splits} bloc(s) découpé(s)` : ''}` +
        `${s.scaled ? `  · ${s.scaled} bloc(s) réduit(s)` : ''}`,
    );
  }
  console.log('');

  check('Aucun avertissement du paginateur', paged.warnings.length === 0, paged.warnings.join(' | '));

  // Un bloc réduit à l'échelle est un bloc qui ne tenait pas dans la page : sur
  // un document composé à la main, c'est un défaut de composition, pas une
  // fatalité du contenu.
  const scaled = flowed.filter((s) => s.scaled > 0);
  check(
    'Aucun bloc n’a dû être réduit pour tenir dans la page',
    scaled.length === 0,
    scaled.map((s) => `${s.name} (${s.scaled})`).join(', '),
  );

  const underfilled = flowed
    .flatMap((s) => s.fills.map((fill, index) => ({ name: s.name, fill, page: index + 1, pages: s.pages })))
    // La dernière page d'un chapitre s'arrête où le contenu s'arrête : c'est
    // une fin de chapitre, pas une page creuse.
    .filter((entry) => entry.page < entry.pages && entry.fill < MIN_FILL);
  check(
    `Aucune page intermédiaire sous ${Math.round(MIN_FILL * 100)} % de remplissage`,
    underfilled.length === 0,
    underfilled.map((e) => `${e.name} p.${e.page} à ${Math.round(e.fill * 100)} %`).join(', '),
  );

  check(
    'Le document tient dans un volume raisonnable',
    paged.totalPages >= 10 && paged.totalPages <= 32,
    `${paged.totalPages} pages`,
  );

  // Le PDF est rendu dans un dossier temporaire que le service recycle : on le
  // recopie, sinon il a disparu au moment de le regarder.
  const kept = resolve(outDir, 'rapport-simulation.pdf');
  copyFileSync(filePath, kept);
  console.log(`\n  Document conservé pour relecture à l’œil : ${kept}`);
}

main()
  .then(async () => {
    await PdfService.closeBrowser();
    if (failures > 0) {
      console.error(`\n${failures} contrôle(s) en échec.\n`);
      process.exit(1);
    }
    console.log('\nContrôle terminé.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
