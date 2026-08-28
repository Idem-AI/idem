/**
 * Jeu de démonstration servi quand `environment.useMockData` est actif.
 *
 * C'est une fixture, pas un moteur : les chiffres sont figés, seules les
 * séries répétitives (trésorerie, courbe de prix, trajectoires) sont générées
 * pour éviter des centaines de lignes de littéraux. Elle existe pour que le
 * produit soit développable et démontrable sans dépendre de l'API ni de crédits
 * LLM.
 *
 * Les textes sont en français parce qu'en production ils sont générés par
 * exécution dans la langue de l'utilisateur, et non traduits depuis les
 * bundles i18n de l'interface.
 */

import {
  BlackSwanReport,
  BusinessBaseline,
  CustomerSimulation,
  Evidence,
  ExperimentPlan,
  Factor,
  FinancialPoint,
  InvestorReadiness,
  LinkedProject,
  Recommendation,
  RedTeamReport,
  Scenario,
  SensitivityEntry,
  Simulation,
  SimulationReport,
  TimeMachineReport,
  UniverseComparison,
  ViabilityCondition,
  summariseFactors,
} from '../models';

const NOW = new Date('2026-08-28T09:12:00.000Z');

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------
// PROJETS
// ---------------------------------------------------------------------

export const DEMO_PROJECTS: LinkedProject[] = [
  {
    id: 'prj-tamtam',
    name: 'TamTam Delivery',
    description:
      'Livraison de repas et de colis à Douala, avec une flotte de livreurs à moto et une application de commande.',
    sector: 'Livraison urbaine',
    availableAssets: [
      'Business plan',
      'Analyse de marché',
      'Prévisions financières',
      'Identité de marque',
      'Marketing & communication',
      'Pitch deck',
    ],
    updatedAt: isoDaysAgo(3),
  },
  {
    id: 'prj-nkap',
    name: 'Nkap Micro-épargne',
    description:
      'Application de micro-épargne et de tontine numérique pour les travailleurs informels au Cameroun.',
    sector: 'Fintech',
    availableAssets: ['Business plan', 'Analyse de marché', 'Juridique'],
    updatedAt: isoDaysAgo(11),
  },
  {
    id: 'prj-shamba',
    name: 'Shamba Fresh',
    description:
      "Circuit court entre maraîchers de l'Ouest et restaurants de Yaoundé, avec chaîne du froid partagée.",
    sector: 'Agroalimentaire',
    availableAssets: ['Business plan', 'Analyse de marché', 'Prévisions financières'],
    updatedAt: isoDaysAgo(26),
  },
];

// ---------------------------------------------------------------------
// PARAMÈTRES DU MODÈLE
// ---------------------------------------------------------------------

const BASELINE: BusinessBaseline = {
  unitPrice: 1500,
  unitVariableCost: 1140,
  monthlyFixedCosts: 6_200_000,
  acquisitionCost: 4200,
  initialMonthlyCustomers: 620,
  monthlyGrowthRate: 0.115,
  monthlyRetentionRate: 0.69,
  purchasesPerCustomerPerMonth: 4.2,
  startingCapital: 42_000_000,
  currency: 'FCFA',
};

// ---------------------------------------------------------------------
// FACTEURS
// ---------------------------------------------------------------------

const FACTORS: Factor[] = [
  {
    id: 'f-retention',
    name: 'Rétention client à 3 mois',
    category: 'Demande',
    tier: 'critical',
    impact: 96,
    lever: 'retention',
    leverElasticity: 1.2,
    description:
      "La part de clients encore actifs après trois mois détermine le nombre de commandes amorties par acquisition. C'est le facteur qui déplace le plus les résultats simulés.",
    evidence: {
      id: 'e-retention',
      label: 'Rétention mensuelle retenue',
      value: '69 %',
      numericValue: 0.69,
      kind: 'estimate',
      confidence: 'low',
      source: "Extrapolation à partir de plateformes de livraison comparables en Afrique de l'Ouest",
      asOf: '2026-02',
      note: "Aucune donnée propre au marché de Douala n'a été trouvée : à vérifier en priorité.",
    },
  },
  {
    id: 'f-cac',
    name: "Coût d'acquisition client",
    category: 'Acquisition',
    tier: 'critical',
    impact: 91,
    lever: 'acquisitionCost',
    leverElasticity: 1,
    description:
      "Le budget publicitaire par client acquis pèse directement sur le point mort, d'autant plus que le panier moyen est faible.",
    evidence: {
      id: 'e-cac',
      label: 'CAC moyen modélisé',
      value: '4 200 FCFA',
      numericValue: 4200,
      kind: 'estimate',
      confidence: 'medium',
      source:
        'Coûts publicitaires Meta observés sur le marché camerounais, pondérés par le taux de conversion projeté',
      asOf: '2026-06',
    },
  },
  {
    id: 'f-fuel',
    name: 'Prix du carburant',
    category: 'Coûts opérationnels',
    tier: 'critical',
    impact: 84,
    lever: 'variableCost',
    leverElasticity: 0.4,
    description:
      "Le carburant représente une part importante du coût par livraison et n'est pas répercutable à court terme sur le prix client.",
    evidence: {
      id: 'e-fuel',
      label: 'Super à la pompe, Douala',
      value: '840 FCFA / litre',
      numericValue: 840,
      kind: 'data',
      confidence: 'high',
      source: 'Prix administré publié par la Caisse de stabilisation des prix des hydrocarbures',
      asOf: '2026-05',
    },
  },
  {
    id: 'f-courier-cost',
    name: 'Rémunération des livreurs',
    category: 'Coûts opérationnels',
    tier: 'critical',
    impact: 79,
    lever: 'variableCost',
    leverElasticity: 0.6,
    description:
      "Le modèle suppose une rémunération à la course. Une pression à la hausse, ou une requalification en salariat, change la structure de coûts.",
    evidence: {
      id: 'e-courier',
      label: 'Coût moyen par course',
      value: '1 150 FCFA',
      numericValue: 1150,
      kind: 'estimate',
      confidence: 'medium',
      source: 'Moyenne des rémunérations pratiquées par les acteurs existants à Douala et Yaoundé',
      asOf: '2026-04',
    },
  },
  {
    id: 'f-price',
    name: 'Prix de la livraison',
    category: 'Modèle économique',
    tier: 'critical',
    impact: 76,
    lever: 'price',
    leverElasticity: 1,
    description:
      "Le prix facturé conditionne à la fois la marge unitaire et l'élasticité de la demande. Les deux effets jouent en sens contraire.",
    evidence: {
      id: 'e-price',
      label: 'Prix de livraison prévu',
      value: '1 500 FCFA',
      numericValue: 1500,
      kind: 'data',
      confidence: 'high',
      source: 'Prévisions financières du projet IDEM',
      asOf: '2026-08',
    },
  },
  {
    id: 'f-competition',
    name: 'Réaction concurrentielle',
    category: 'Concurrence',
    tier: 'important',
    impact: 68,
    lever: 'price',
    leverElasticity: 0.8,
    description:
      'Trois plateformes couvrent déjà Douala. Une baisse de prix coordonnée est le scénario défavorable le plus plausible.',
    evidence: {
      id: 'e-competition',
      label: 'Plateformes actives sur la zone',
      value: '3 acteurs',
      numericValue: 3,
      kind: 'data',
      confidence: 'high',
      source: 'Recensement des applications disponibles sur Play Store pour la zone Douala',
      asOf: '2026-07',
    },
  },
  {
    id: 'f-density',
    name: 'Densité urbaine de la zone couverte',
    category: 'Marché',
    tier: 'important',
    impact: 64,
    lever: 'frequency',
    leverElasticity: 0.7,
    description:
      'Plus les points de retrait et de livraison sont denses, plus le nombre de courses par livreur et par heure augmente.',
    evidence: {
      id: 'e-density',
      label: 'Densité, arrondissements couverts',
      value: '~9 800 hab./km²',
      numericValue: 9800,
      kind: 'data',
      confidence: 'high',
      source: 'Recensement urbain, Communauté urbaine de Douala',
      asOf: '2024',
    },
  },
  {
    id: 'f-payment',
    name: 'Moyens de paiement disponibles',
    category: 'Opérations',
    tier: 'important',
    impact: 57,
    lever: 'variableCost',
    leverElasticity: 0.2,
    description:
      "La part payée en mobile money conditionne les frais de transaction et le besoin en fonds de roulement lié aux encaissements en espèces.",
    evidence: {
      id: 'e-payment',
      label: 'Part du mobile money projetée',
      value: '62 %',
      numericValue: 0.62,
      kind: 'estimate',
      confidence: 'medium',
      source: "Taux d'usage du mobile money au Cameroun ajusté au profil de clientèle visé",
      asOf: '2025',
    },
  },
  {
    id: 'f-roads',
    name: 'État du réseau routier en saison des pluies',
    category: 'Environnement local',
    tier: 'important',
    impact: 52,
    lever: 'frequency',
    leverElasticity: 0.5,
    description:
      'De juillet à octobre, les temps de trajet augmentent et le nombre de courses par livreur baisse mécaniquement.',
    evidence: {
      id: 'e-roads',
      label: 'Allongement moyen des trajets',
      value: '+22 % (juil.-oct.)',
      numericValue: 0.22,
      kind: 'estimate',
      confidence: 'low',
      source: 'Hypothèse construite à partir des relevés de trafic saisonniers disponibles',
      asOf: '2025',
    },
  },
  {
    id: 'f-regulation',
    name: 'Statut réglementaire des livreurs',
    category: 'Réglementation',
    tier: 'unknown',
    impact: 61,
    lever: 'variableCost',
    description:
      "Aucun texte stable n'encadre aujourd'hui le statut des livreurs de plateforme au Cameroun. L'impact potentiel est élevé mais la probabilité n'est pas estimable.",
  },
  {
    id: 'f-purchasing-power',
    name: "Évolution du pouvoir d'achat urbain",
    category: 'Contexte économique',
    tier: 'unknown',
    impact: 55,
    lever: 'growth',
    description:
      'La fréquence de commande dépend du revenu disponible. Les projections disponibles divergent trop pour être utilisées telles quelles.',
  },
  {
    id: 'f-fx',
    name: 'Stabilité du franc CFA',
    category: 'Contexte économique',
    tier: 'unknown',
    impact: 44,
    lever: 'none',
    description:
      "Une évolution du régime de change modifierait le coût des équipements importés, sans qu'aucune probabilité sérieuse puisse y être attachée.",
  },
  {
    id: 'f-seasonality',
    name: 'Saisonnalité de la demande',
    category: 'Demande',
    tier: 'secondary',
    impact: 38,
    lever: 'growth',
    leverElasticity: 0.3,
    description:
      'Les pics de fin d\'année et les périodes de rentrée créent des variations de volume absorbables par la flotte prévue.',
  },
  {
    id: 'f-support',
    name: 'Charge du support client',
    category: 'Opérations',
    tier: 'secondary',
    impact: 29,
    lever: 'fixedCost',
    leverElasticity: 0.25,
    description:
      "Le coût de traitement des incidents reste faible au volume simulé, mais croît plus vite que le chiffre d'affaires.",
  },
  {
    id: 'f-app-quality',
    name: "Qualité perçue de l'application",
    category: 'Produit',
    tier: 'secondary',
    impact: 34,
    lever: 'retention',
    leverElasticity: 0.3,
    description:
      "Les frictions de commande pèsent sur la rétention, mais restent second ordre face au délai de livraison.",
  },
];

// ---------------------------------------------------------------------
// SCÉNARIOS
// ---------------------------------------------------------------------

const SCENARIOS: Scenario[] = [
  {
    id: 's-baseline',
    name: 'Scénario de référence',
    kind: 'baseline',
    question: 'Les hypothèses centrales du projet se vérifient.',
    shifts: [],
    outcome: {
      viability: 68,
      breakEvenMonth: 19,
      runwayMonths: null,
      survives: true,
      lowestCash: 4_180_000,
      revenueYear1: 78_400_000,
      revenueYear3: 412_600_000,
      narrative:
        "Le modèle atteint son point mort au mois 19 et la trésorerie reste positive sur tout l'horizon.",
    },
  },
  {
    id: 's-favourable',
    name: 'Densification réussie',
    kind: 'favourable',
    question: 'La couverture se concentre sur deux arrondissements au lieu de cinq.',
    shifts: [
      { factorId: 'f-density', label: 'Courses par livreur', lever: 'frequency', magnitude: 0.34, delta: '+34 %' },
      { factorId: 'f-cac', label: "Coût d'acquisition", lever: 'acquisitionCost', magnitude: -0.15, delta: '-15 %' },
    ],
    outcome: {
      viability: 81,
      breakEvenMonth: 13,
      runwayMonths: null,
      survives: true,
      lowestCash: 18_900_000,
      revenueYear1: 105_100_000,
      revenueYear3: 553_800_000,
      narrative:
        "Le point mort avance de six mois. C'est le scénario favorable le plus accessible car il ne dépend d'aucun facteur externe.",
    },
  },
  {
    id: 's-price-war',
    name: 'Guerre des prix',
    kind: 'stress',
    question: 'Le principal concurrent baisse ses prix de 30 %.',
    shifts: [
      { factorId: 'f-competition', label: 'Prix aligné', lever: 'price', magnitude: -0.18, delta: '-18 %' },
    ],
    outcome: {
      viability: 34,
      breakEvenMonth: null,
      runwayMonths: 11,
      survives: false,
      lowestCash: -14_300_000,
      revenueYear1: 64_300_000,
      revenueYear3: 338_300_000,
      narrative:
        "La marge unitaire passe sous le coût par course. Le modèle ne revient à l'équilibre dans aucune trajectoire testée.",
    },
  },
  {
    id: 's-cac-drift',
    name: "Dérive du coût d'acquisition",
    kind: 'stress',
    question: "Le coût d'acquisition augmente de 40 %.",
    shifts: [
      { factorId: 'f-cac', label: "Coût d'acquisition", lever: 'acquisitionCost', magnitude: 0.4, delta: '+40 %' },
    ],
    outcome: {
      viability: 41,
      breakEvenMonth: 34,
      runwayMonths: 14,
      survives: false,
      lowestCash: -9_600_000,
      revenueYear1: 78_400_000,
      revenueYear3: 412_600_000,
      narrative:
        "Le point mort sort de l'horizon de financement. Le capital prévu est épuisé quatorze mois après le lancement.",
    },
  },
  {
    id: 's-fuel-shock',
    name: 'Choc sur le carburant',
    kind: 'stress',
    question: 'Le prix du carburant augmente de 25 % et reste haut.',
    shifts: [
      { factorId: 'f-fuel', label: 'Coût par course', lever: 'variableCost', magnitude: 0.1, delta: '+10 %' },
    ],
    outcome: {
      viability: 52,
      breakEvenMonth: 26,
      runwayMonths: 21,
      survives: false,
      lowestCash: -2_100_000,
      revenueYear1: 78_400_000,
      revenueYear3: 412_600_000,
      narrative:
        'Le point mort recule de sept mois et la trésorerie passe brièvement sous zéro au mois 21.',
    },
  },
  {
    id: 's-funding-delay',
    name: 'Financement retardé',
    kind: 'adverse',
    question: 'La levée de fonds arrive six mois plus tard que prévu.',
    shifts: [
      { factorId: 'f-cac', label: 'Budget acquisition', lever: 'capital', magnitude: -0.35, delta: '-35 %' },
    ],
    outcome: {
      viability: 52,
      breakEvenMonth: 27,
      runwayMonths: 16,
      survives: false,
      lowestCash: -6_400_000,
      revenueYear1: 61_200_000,
      revenueYear3: 380_100_000,
      narrative:
        "Le modèle survit en réduisant l'acquisition, au prix d'une croissance divisée par deux la première année.",
    },
  },
  {
    id: 's-slow-growth',
    name: 'Croissance deux fois plus lente',
    kind: 'adverse',
    question: 'La croissance est moitié moindre que prévu.',
    shifts: [
      { factorId: 'f-purchasing-power', label: 'Rythme d\'acquisition', lever: 'growth', magnitude: -0.5, delta: '-50 %' },
    ],
    outcome: {
      viability: 45,
      breakEvenMonth: 38,
      runwayMonths: 15,
      survives: false,
      lowestCash: -11_800_000,
      revenueYear1: 52_700_000,
      revenueYear3: 198_400_000,
      narrative:
        'Le volume ne suffit jamais à absorber les coûts fixes de la flotte. Le modèle casse sur la structure de coûts, pas sur la demande.',
    },
  },
  {
    id: 's-regulation',
    name: 'Requalification des livreurs',
    kind: 'extreme',
    question: 'Une réglementation impose la salarisation des livreurs.',
    shifts: [
      { factorId: 'f-regulation', label: 'Coût par livreur', lever: 'variableCost', magnitude: 0.4, delta: '+40 %' },
      { factorId: 'f-regulation', label: 'Charges sociales', lever: 'fixedCost', magnitude: 0.25, delta: '+25 %' },
    ],
    outcome: {
      viability: 18,
      breakEvenMonth: null,
      runwayMonths: 8,
      survives: false,
      lowestCash: -28_700_000,
      revenueYear1: 78_400_000,
      revenueYear3: 412_600_000,
      narrative:
        "Le modèle à la course ne tient pas. Une bascule vers un abonnement B2B restaurants est la seule sortie testée qui reste viable.",
    },
  },
  {
    id: 's-compound',
    name: 'Choc combiné',
    kind: 'extreme',
    question: 'Saison des pluies prolongée, carburant en hausse et retard de financement.',
    shifts: [
      { factorId: 'f-roads', label: 'Courses par livreur', lever: 'frequency', magnitude: -0.25, delta: '-25 %' },
      { factorId: 'f-fuel', label: 'Coût par course', lever: 'variableCost', magnitude: 0.12, delta: '+12 %' },
      { factorId: 'f-cac', label: 'Capital disponible', lever: 'capital', magnitude: -0.35, delta: '-35 %' },
    ],
    outcome: {
      viability: 12,
      breakEvenMonth: null,
      runwayMonths: 7,
      survives: false,
      lowestCash: -33_400_000,
      revenueYear1: 58_800_000,
      revenueYear3: 309_400_000,
      narrative:
        'Combinaison rare mais plausible sur ce marché. La trésorerie devient négative au septième mois.',
    },
  },
];

// ---------------------------------------------------------------------
// SÉRIES CALCULÉES POUR LA FIXTURE
// ---------------------------------------------------------------------

/** Projection de référence, générée pour éviter 36 lignes de littéraux. */
function buildPoints(): FinancialPoint[] {
  const points: FinancialPoint[] = [];
  let active = 0;
  let cash = BASELINE.startingCapital;

  for (let month = 1; month <= 36; month++) {
    const newCustomers =
      BASELINE.initialMonthlyCustomers * Math.pow(1 + BASELINE.monthlyGrowthRate, month - 1);
    active = active * BASELINE.monthlyRetentionRate + newCustomers;

    const transactions = active * BASELINE.purchasesPerCustomerPerMonth;
    const revenue = transactions * BASELINE.unitPrice;
    const costs =
      BASELINE.monthlyFixedCosts +
      transactions * BASELINE.unitVariableCost +
      newCustomers * BASELINE.acquisitionCost;

    cash += revenue - costs;
    points.push({
      month,
      activeCustomers: Math.round(active),
      revenue: Math.round(revenue),
      costs: Math.round(costs),
      cashflow: Math.round(revenue - costs),
      cash: Math.round(cash),
    });
  }
  return points;
}

const POINTS = buildPoints();

const SENSITIVITY: SensitivityEntry[] = [
  { factorId: 'f-retention', factorName: 'Rétention à 3 mois', lever: 'retention', change: '+10 % de rétention', viabilityDelta: 14 },
  { factorId: 'f-courier-cost', factorName: 'Rémunération des livreurs', lever: 'variableCost', change: '+15 % de coût variable', viabilityDelta: -11 },
  { factorId: 'f-cac', factorName: "Coût d'acquisition", lever: 'acquisitionCost', change: "-20 % de coût d'acquisition", viabilityDelta: 9 },
  { factorId: 'f-density', factorName: 'Densité de la zone couverte', lever: 'frequency', change: "+15 % de fréquence d'achat", viabilityDelta: 8 },
  { factorId: 'f-fuel', factorName: 'Prix du carburant', lever: 'fixedCost', change: '+20 % de charges fixes', viabilityDelta: -6 },
  { factorId: 'f-price', factorName: 'Prix de la livraison', lever: 'price', change: '+10 % de prix', viabilityDelta: 5 },
  { factorId: 'f-seasonality', factorName: 'Saisonnalité', lever: 'growth', change: '+25 % de croissance', viabilityDelta: 3 },
];

const CONDITIONS: ViabilityCondition[] = [
  { id: 'cond-cac', label: "Coût d'acquisition client", threshold: '< 4 850 FCFA', currentValue: '4 200 FCFA', met: true },
  { id: 'cond-retention', label: 'Rétention mensuelle', threshold: '> 72 %', currentValue: '69 %', met: false },
  { id: 'cond-price', label: 'Prix unitaire', threshold: '> 1 420 FCFA', currentValue: '1 500 FCFA', met: true },
  { id: 'cond-fixed', label: 'Charges fixes mensuelles', threshold: '< 5 900 000 FCFA', currentValue: '6 200 000 FCFA', met: false },
  { id: 'cond-capital', label: 'Capital disponible', threshold: '> 55 000 000 FCFA', currentValue: '42 000 000 FCFA', met: false },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-density',
    title: "Réduire la zone de couverture avant d'augmenter le budget publicitaire",
    body: "Les simulations montrent que la densité de courses pèse davantage que le volume de clients acquis. Concentrer la couverture sur Akwa et Bonanjo augmente le nombre de courses par livreur sans dépense d'acquisition supplémentaire, et améliore la marge unitaire dès le premier mois.",
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'medium',
  },
  {
    id: 'rec-retention',
    title: 'Mesurer la rétention réelle avant de figer les prévisions',
    body: "La rétention retenue est une extrapolation, pas une mesure. C'est aussi le facteur le plus sensible du modèle : dix points de rétention valent quatorze points d'indice. Une cohorte de 200 clients suivie sur douze semaines suffit à trancher.",
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'high',
  },
  {
    id: 'rec-b2b',
    title: 'Tester un contrat B2B restaurants en parallèle du B2C',
    body: "Dans le scénario de requalification des livreurs, seule la variante B2B par abonnement reste viable. Signer deux à trois restaurants en récurrent réduit la dépendance au volume B2C et donne une base de revenus prévisible.",
    expectedImpact: 'medium',
    priority: 'high',
    confidence: 'medium',
  },
  {
    id: 'rec-fuel',
    title: 'Indexer le prix de livraison sur le carburant',
    body: "Le prix du carburant est administré et connu à l'avance. Prévoir contractuellement une clause de révision évite que chaque hausse soit absorbée intégralement par la marge.",
    expectedImpact: 'medium',
    priority: 'medium',
    confidence: 'high',
  },
  {
    id: 'rec-capital',
    title: 'Sécuriser 15 M FCFA de trésorerie supplémentaire',
    body: "Le capital prévu couvre le scénario de référence mais aucun des scénarios défavorables testés. Un matelas de 15 M FCFA fait passer trois scénarios sur quatre du statut « ne survit pas » à « survit ».",
    expectedImpact: 'high',
    priority: 'high',
    confidence: 'medium',
  },
];

const EVIDENCE: Evidence[] = FACTORS.filter((factor) => factor.evidence).map(
  (factor) => factor.evidence as Evidence
);

// ---------------------------------------------------------------------
// LABORATOIRES
// ---------------------------------------------------------------------

export const DEMO_RED_TEAM: RedTeamReport = {
  generatedAt: isoDaysAgo(1),
  verdict:
    "L'exposition principale n'est pas commerciale mais structurelle : la marge unitaire ne laisse aucune marge de manœuvre face à une attaque par les prix, et le statut des livreurs est une bombe à retardement réglementaire.",
  summary: { total: 31, critical: 6, important: 12, secondary: 13 },
  vulnerabilities: [
    {
      id: 'v-1',
      title: 'Aucune défense contre un alignement tarifaire',
      role: 'competitor',
      severity: 'critical',
      attack:
        "Je baisse ma commission de 30 % pendant trois mois sur vos deux arrondissements. Je perds de l'argent, vous aussi, mais j'ai dix-huit mois de trésorerie et vous en avez onze.",
      exposure:
        'Marge brute de 24 % et capital de 42 M FCFA, contre des acteurs déjà installés et financés.',
      mitigation:
        'Construire une base B2B récurrente avant le lancement grand public, pour ne pas dépendre du seul volume B2C.',
    },
    {
      id: 'v-2',
      title: 'La rétention repose sur une extrapolation',
      role: 'investor',
      severity: 'critical',
      attack:
        "Votre modèle entier tient sur un taux de rétention que vous n'avez jamais mesuré. Montrez-moi une cohorte réelle et on reparle de la valorisation.",
      exposure:
        "Le facteur au plus fort impact du modèle est classé en confiance faible, sans source propre au marché.",
      mitigation: 'Mesurer une cohorte de 200 clients sur douze semaines avant toute levée.',
    },
    {
      id: 'v-3',
      title: 'Statut des livreurs non traité',
      role: 'regulator',
      severity: 'critical',
      attack:
        "Vos livreurs travaillent exclusivement pour vous, avec vos outils et vos horaires. Rien ne les distingue de salariés. Une requalification est plausible à tout moment.",
      exposure:
        "Aucun texte stable n'encadre le statut, et le modèle ne provisionne aucune charge sociale.",
      mitigation:
        'Provisionner le coût de la requalification dans le plan de trésorerie et documenter une organisation réellement indépendante.',
    },
    {
      id: 'v-4',
      title: 'Le capital ne couvre aucun scénario défavorable',
      role: 'cfo',
      severity: 'critical',
      attack:
        "42 M FCFA couvrent le scénario de référence et rien d'autre. Trois de vos scénarios défavorables épuisent la trésorerie avant le point mort.",
      exposure: 'Point mort au mois 19, autonomie de 14 à 16 mois dans les scénarios dégradés.',
      mitigation: 'Sécuriser 15 M FCFA supplémentaires ou réduire les charges fixes de 5 %.',
    },
    {
      id: 'v-5',
      title: 'Dépendance à un seul canal d\'acquisition',
      role: 'operations',
      severity: 'critical',
      attack:
        "Toute votre acquisition passe par la publicité payante. Le jour où le coût par clic double, votre croissance s'arrête net.",
      exposure: "CAC de 4 200 FCFA entièrement dépendant d'enchères publicitaires.",
      mitigation: 'Tester un canal organique (parrainage, partenariats de quartier) avant le lancement.',
    },
    {
      id: 'v-6',
      title: 'La saison des pluies n\'est pas provisionnée',
      role: 'operations',
      severity: 'critical',
      attack:
        "Quatre mois par an, vos livreurs font 25 % de courses en moins. Votre plan suppose un volume constant toute l'année.",
      exposure: 'Allongement des trajets de +22 % de juillet à octobre, non modélisé dans le plan initial.',
      mitigation: 'Modéliser deux saisons distinctes et ajuster la taille de flotte en conséquence.',
    },
    {
      id: 'v-7',
      title: 'Le client ne perçoit pas de différence',
      role: 'skeptical-customer',
      severity: 'important',
      attack:
        "Trois applications font déjà exactement la même chose dans mon quartier. Pourquoi j'installerais une quatrième ?",
      exposure: "Aucune différenciation produit documentée face aux plateformes existantes.",
      mitigation: 'Choisir un créneau étroit (livraison de nuit, colis inter-quartiers) plutôt que le marché entier.',
    },
    {
      id: 'v-8',
      title: 'Le paiement à la livraison mobilise la trésorerie',
      role: 'cfo',
      severity: 'important',
      attack:
        '38 % des encaissements se font en espèces, chez le livreur. Cet argent met des jours à remonter, et une partie ne remonte jamais.',
      exposure: 'Part du mobile money estimée à 62 %, sans procédure de collecte documentée.',
      mitigation: 'Imposer le prépaiement mobile money au-delà d\'un certain montant.',
    },
  ],
};

export const DEMO_CUSTOMERS: CustomerSimulation = {
  generatedAt: isoDaysAgo(1),
  panelSize: 10_000,
  currency: 'FCFA',
  caveat:
    "Ces résultats décrivent le comportement de profils simulés à partir de données de marché. Ils servent à comparer des prix entre eux, pas à affirmer que le marché achètera.",
  optimalPrice: 1500,
  segments: [
    {
      id: 'seg-1',
      name: 'Employés de bureau, Akwa / Bonanjo',
      share: 0.34,
      budget: '150 000 – 350 000 FCFA / mois',
      needs: 'Déjeuner livré rapidement, fiabilité du créneau',
      priceSensitivity: 0.45,
      willingnessToPay: 2000,
      purchaseFrequencyPerYear: 96,
    },
    {
      id: 'seg-2',
      name: 'Étudiants, campus et quartiers périphériques',
      share: 0.26,
      budget: '30 000 – 80 000 FCFA / mois',
      needs: 'Prix bas avant tout, tolérants sur le délai',
      priceSensitivity: 0.9,
      willingnessToPay: 1000,
      purchaseFrequencyPerYear: 24,
    },
    {
      id: 'seg-3',
      name: 'Familles urbaines',
      share: 0.22,
      budget: '200 000 – 500 000 FCFA / mois',
      needs: 'Courses et colis le week-end, gros paniers',
      priceSensitivity: 0.55,
      willingnessToPay: 1800,
      purchaseFrequencyPerYear: 36,
    },
    {
      id: 'seg-4',
      name: 'Commerçants et petites entreprises',
      share: 0.18,
      budget: 'Budget logistique dédié',
      needs: 'Livraison de colis récurrente, facturation mensuelle',
      priceSensitivity: 0.3,
      willingnessToPay: 2800,
      purchaseFrequencyPerYear: 180,
    },
  ],
  pricePoints: [
    { price: 900, conversionRate: 0.712, buyers: 7120, estimatedRevenue: 6_408_000 },
    { price: 1200, conversionRate: 0.611, buyers: 6110, estimatedRevenue: 7_332_000 },
    { price: 1500, conversionRate: 0.508, buyers: 5080, estimatedRevenue: 7_620_000 },
    { price: 1875, conversionRate: 0.372, buyers: 3720, estimatedRevenue: 6_975_000 },
    { price: 2250, conversionRate: 0.244, buyers: 2440, estimatedRevenue: 5_490_000 },
  ],
};

export const DEMO_INVESTORS: InvestorReadiness = {
  generatedAt: isoDaysAgo(1),
  readinessScore: 54,
  verdicts: [
    {
      profile: 'growth',
      name: 'Fonds croissance early-stage',
      score: 48,
      reaction:
        "Le marché est réel et la traction plausible, mais votre économie unitaire ne tient qu'avec une rétention que vous n'avez pas mesurée. Je ne peux pas valoriser une hypothèse.",
      objections: [
        "Le LTV/CAC repose sur une rétention extrapolée",
        'Le point mort au mois 19 dépasse votre autonomie financière',
        'Aucun canal d\'acquisition organique testé',
      ],
      wouldMeetAgain: true,
    },
    {
      profile: 'impact',
      name: 'Fonds impact Afrique centrale',
      score: 61,
      reaction:
        "La création d'emplois de livreurs est un vrai impact, mais le statut de ces emplois est précisément votre risque réglementaire. L'impact et la faille sont la même chose.",
      objections: [
        'Le modèle repose sur des emplois non salariés et non protégés',
        'Aucun indicateur d\'impact mesuré ni suivi',
      ],
      wouldMeetAgain: true,
    },
    {
      profile: 'technology',
      name: 'Fonds tech deeptech',
      score: 39,
      reaction:
        "Je ne vois pas de barrière technique. Une application de commande et un routage de livreurs, trois acteurs le font déjà sur votre zone. Où est la défense ?",
      objections: [
        'Aucune différenciation technologique défendable',
        'Le routage n\'est pas propriétaire',
        'Pas de donnée exclusive accumulée',
      ],
      wouldMeetAgain: false,
    },
    {
      profile: 'regional',
      name: 'Investisseur panafricain',
      score: 68,
      reaction:
        "L'ancrage local est crédible et la connaissance du terrain se sent. Mais vous attaquez cinq arrondissements avec le capital d'un seul. Resserrez, prouvez l'unité économique, puis étendez.",
      objections: [
        'Zone de couverture trop large pour le capital disponible',
        'Le passage à Yaoundé n\'est pas démontré',
      ],
      wouldMeetAgain: true,
    },
  ],
  expectedObjections: [
    "Votre rétention n'est pas mesurée, elle est extrapolée",
    'Le capital ne couvre pas le délai jusqu\'au point mort',
    'Aucune différenciation face aux trois plateformes existantes',
    'Le statut des livreurs expose l\'entreprise à une requalification',
    'La zone de couverture est trop large pour vos moyens',
  ],
};

export const DEMO_BLACK_SWAN: BlackSwanReport = {
  generatedAt: isoDaysAgo(1),
  absorptionRate: 0.17,
  events: [
    {
      id: 'bs-1',
      title: 'Un géant international entre sur le marché camerounais',
      description:
        "Une plateforme continentale lance Douala avec six mois de livraisons subventionnées. Le prix de marché s'effondre et le coût d'acquisition double sous la pression publicitaire.",
      likelihood: 'plausible',
      shifts: [
        { factorId: 'f-competition', label: 'Prix de marché', lever: 'price', magnitude: -0.3, delta: '-30 %' },
        { factorId: 'f-cac', label: "Coût d'acquisition", lever: 'acquisitionCost', magnitude: 0.8, delta: '+80 %' },
      ],
      survivalNarrative:
        "Se replier immédiatement sur le B2B récurrent et abandonner la concurrence frontale sur le B2C.",
      outcome: {
        viability: 8,
        breakEvenMonth: null,
        runwayMonths: 6,
        survives: false,
        lowestCash: -41_200_000,
        revenueYear1: 54_900_000,
        revenueYear3: 288_800_000,
        narrative: "Le modèle n'atteint jamais l'équilibre et la trésorerie disparaît en six mois.",
      },
    },
    {
      id: 'bs-2',
      title: 'Suppression de la subvention sur les carburants',
      description:
        "L'État met fin au prix administré. Le carburant augmente de 45 % en quelques semaines, sans possibilité de répercussion immédiate sur le prix client.",
      likelihood: 'plausible',
      shifts: [
        { factorId: 'f-fuel', label: 'Coût par course', lever: 'variableCost', magnitude: 0.18, delta: '+18 %' },
      ],
      survivalNarrative:
        'Activer une clause de révision tarifaire et réduire le rayon de livraison pour limiter la distance moyenne.',
      outcome: {
        viability: 31,
        breakEvenMonth: null,
        runwayMonths: 17,
        survives: false,
        lowestCash: -8_900_000,
        revenueYear1: 78_400_000,
        revenueYear3: 412_600_000,
        narrative: 'La marge unitaire tombe sous le seuil de rentabilité de la flotte.',
      },
    },
    {
      id: 'bs-3',
      title: 'Interdiction des motos-taxis en centre-ville',
      description:
        "Une décision municipale restreint la circulation des deux-roues commerciaux dans les arrondissements les plus denses, exactement la zone la plus rentable.",
      likelihood: 'unlikely',
      shifts: [
        { factorId: 'f-density', label: 'Courses par livreur', lever: 'frequency', magnitude: -0.45, delta: '-45 %' },
        { factorId: 'f-courier-cost', label: 'Coût logistique', lever: 'variableCost', magnitude: 0.2, delta: '+20 %' },
      ],
      survivalNarrative:
        'Basculer sur des véhicules autorisés et repositionner l\'offre sur les colis inter-quartiers.',
      outcome: {
        viability: 5,
        breakEvenMonth: null,
        runwayMonths: 5,
        survives: false,
        lowestCash: -47_800_000,
        revenueYear1: 43_100_000,
        revenueYear3: 226_900_000,
        narrative: "L'activité perd sa zone la plus dense et ne couvre plus ses charges fixes.",
      },
    },
    {
      id: 'bs-4',
      title: 'Panne prolongée du principal opérateur mobile money',
      description:
        "Une interruption de plusieurs semaines force le retour au paiement en espèces, avec les pertes et les délais de remontée que cela implique.",
      likelihood: 'rare',
      shifts: [
        { factorId: 'f-payment', label: 'Frais et pertes de collecte', lever: 'variableCost', magnitude: 0.09, delta: '+9 %' },
      ],
      survivalNarrative:
        'Maintenir un second opérateur de paiement actif et une procédure de collecte quotidienne.',
      outcome: {
        viability: 55,
        breakEvenMonth: 24,
        runwayMonths: null,
        survives: true,
        lowestCash: 1_900_000,
        revenueYear1: 78_400_000,
        revenueYear3: 412_600_000,
        narrative: 'Le point mort recule de cinq mois mais la trésorerie tient.',
      },
    },
    {
      id: 'bs-5',
      title: 'Crise de pouvoir d\'achat urbain',
      description:
        "Une poussée inflationniste réduit le revenu disponible. La livraison est l'une des premières dépenses arbitrées à la baisse.",
      likelihood: 'plausible',
      shifts: [
        { factorId: 'f-purchasing-power', label: 'Rythme d\'acquisition', lever: 'growth', magnitude: -0.6, delta: '-60 %' },
        { factorId: 'f-purchasing-power', label: "Fréquence d'achat", lever: 'frequency', magnitude: -0.25, delta: '-25 %' },
      ],
      survivalNarrative:
        'Descendre en gamme avec une offre économique à créneau élargi, et prioriser le B2B moins cyclique.',
      outcome: {
        viability: 14,
        breakEvenMonth: null,
        runwayMonths: 9,
        survives: false,
        lowestCash: -24_600_000,
        revenueYear1: 38_200_000,
        revenueYear3: 121_400_000,
        narrative: 'Le volume ne décolle jamais assez pour couvrir la structure de coûts.',
      },
    },
    {
      id: 'bs-6',
      title: 'Départ simultané de la moitié de la flotte',
      description:
        "Un concurrent recrute agressivement les livreurs expérimentés avec une prime de transfert. La capacité de livraison chute en pleine montée en charge.",
      likelihood: 'unlikely',
      shifts: [
        { factorId: 'f-courier-cost', label: 'Rémunération à aligner', lever: 'variableCost', magnitude: 0.22, delta: '+22 %' },
        { factorId: 'f-density', label: 'Capacité de livraison', lever: 'frequency', magnitude: -0.3, delta: '-30 %' },
      ],
      survivalNarrative:
        'Mettre en place une fidélisation des livreurs (bonus d\'ancienneté, accès au crédit) avant la montée en charge.',
      outcome: {
        viability: 21,
        breakEvenMonth: null,
        runwayMonths: 10,
        survives: false,
        lowestCash: -19_300_000,
        revenueYear1: 61_500_000,
        revenueYear3: 322_700_000,
        narrative: 'La capacité perdue ne se reconstitue pas assez vite pour tenir les coûts fixes.',
      },
    },
  ],
};

export const DEMO_UNIVERSES: UniverseComparison = {
  generatedAt: isoDaysAgo(1),
  bestUniverseId: 'u-b2b',
  narrative:
    "La variante B2B par abonnement domine nettement : elle échange un volume plus faible contre une prévisibilité de revenus et un coût d'acquisition amorti sur la durée du contrat. La marketplace est la plus fragile, car elle ajoute un problème d'amorçage à deux faces sans résoudre la marge unitaire.",
  universes: [
    {
      id: 'u-b2b',
      name: 'Abonnement restaurants',
      businessModel: 'B2B, abonnement mensuel',
      rationale:
        "Les restaurants livrent déjà, mal et à leurs frais. Un abonnement mensuel à volume garanti remplace un coût d'acquisition répété par un contrat.",
      baselineOverrides: {
        unitPrice: 1150,
        acquisitionCost: 32_000,
        initialMonthlyCustomers: 14,
        monthlyRetentionRate: 0.94,
        purchasesPerCustomerPerMonth: 260,
      },
      robustness: 'high',
      outcome: {
        viability: 84,
        breakEvenMonth: 11,
        runwayMonths: null,
        survives: true,
        lowestCash: 22_400_000,
        revenueYear1: 96_800_000,
        revenueYear3: 498_300_000,
        narrative: 'Le point mort est atteint au mois 11 et la trésorerie ne descend jamais sous 22 M FCFA.',
      },
    },
    {
      id: 'u-hybrid',
      name: 'Mixte B2B + B2C',
      businessModel: 'Abonnement entreprises, complété par la livraison grand public',
      rationale:
        "Les contrats B2B couvrent les charges fixes, le B2C absorbe la capacité résiduelle des livreurs aux heures creuses.",
      baselineOverrides: {
        unitPrice: 1320,
        acquisitionCost: 12_500,
        initialMonthlyCustomers: 90,
        monthlyRetentionRate: 0.82,
        purchasesPerCustomerPerMonth: 42,
      },
      robustness: 'high',
      outcome: {
        viability: 76,
        breakEvenMonth: 14,
        runwayMonths: null,
        survives: true,
        lowestCash: 12_700_000,
        revenueYear1: 88_100_000,
        revenueYear3: 461_200_000,
        narrative: 'Le modèle tient dans six scénarios sur neuf, contre trois pour le modèle actuel.',
      },
    },
    {
      id: 'u-marketplace',
      name: 'Marketplace de livreurs indépendants',
      businessModel: 'Commission sur mise en relation, sans flotte',
      rationale:
        "Supprimer la flotte élimine la charge fixe et le risque de requalification, au prix d'un contrôle bien plus faible sur la qualité de service.",
      baselineOverrides: {
        unitPrice: 380,
        unitVariableCost: 60,
        monthlyFixedCosts: 2_100_000,
        acquisitionCost: 3800,
        initialMonthlyCustomers: 420,
        monthlyRetentionRate: 0.58,
      },
      robustness: 'low',
      outcome: {
        viability: 42,
        breakEvenMonth: 29,
        runwayMonths: 24,
        survives: false,
        lowestCash: -3_100_000,
        revenueYear1: 21_400_000,
        revenueYear3: 142_900_000,
        narrative: "L'amorçage à deux faces retarde le point mort au-delà de l'autonomie disponible.",
      },
    },
    {
      id: 'u-api',
      name: 'API logistique',
      businessModel: 'Facturation à la course, pour les e-commerçants',
      rationale:
        "Se placer en infrastructure derrière les boutiques en ligne existantes, plutôt qu'en marque grand public.",
      baselineOverrides: {
        unitPrice: 1250,
        acquisitionCost: 48_000,
        initialMonthlyCustomers: 7,
        monthlyRetentionRate: 0.91,
        purchasesPerCustomerPerMonth: 420,
      },
      robustness: 'medium',
      outcome: {
        viability: 71,
        breakEvenMonth: 16,
        runwayMonths: null,
        survives: true,
        lowestCash: 8_600_000,
        revenueYear1: 71_300_000,
        revenueYear3: 401_800_000,
        narrative: 'Peu de clients, mais un volume par client qui amortit largement leur acquisition.',
      },
    },
  ],
};

/** Trajectoires annuelles, dérivées des scénarios pour rester cohérentes. */
function buildTimeline(
  id: string,
  name: string,
  kind: 'baseline' | 'favourable' | 'adverse' | 'stress',
  growth: number,
  margin: number,
  divergence: string,
  divergenceYear: number | null,
  endState: string
) {
  let revenue = 78_400_000;
  let cash = 42_000_000;
  const years = [];
  for (let year = 1; year <= 5; year++) {
    const costs = Math.round(revenue * (1 - margin) + 74_400_000);
    cash += Math.round(revenue - costs);
    years.push({
      year,
      revenue: Math.round(revenue),
      costs,
      cash: Math.round(cash),
      activeCustomers: Math.round(revenue / (1500 * 4.2 * 12)),
    });
    revenue *= growth;
  }
  return { id, name, kind, years, divergence, divergenceYear, endState };
}

export const DEMO_TIME_MACHINE: TimeMachineReport = {
  generatedAt: isoDaysAgo(1),
  horizonYears: 5,
  timelines: [
    buildTimeline(
      's-baseline',
      'Scénario de référence',
      'baseline',
      1.72,
      0.24,
      'Les hypothèses centrales du projet se vérifient.',
      2,
      "L'activité devient rentable en année 2 et le reste.",
    ),
    buildTimeline(
      's-favourable',
      'Densification réussie',
      'favourable',
      1.95,
      0.31,
      'La couverture se concentre sur deux arrondissements.',
      2,
      "L'activité devient rentable en année 2 avec une trésorerie trois fois supérieure.",
    ),
    buildTimeline(
      's-slow-growth',
      'Croissance deux fois plus lente',
      'adverse',
      1.28,
      0.2,
      'La croissance est moitié moindre que prévu.',
      3,
      'La trésorerie devient négative en année 3.',
    ),
    buildTimeline(
      's-price-war',
      'Guerre des prix',
      'stress',
      1.55,
      0.11,
      'Le principal concurrent baisse ses prix de 30 %.',
      2,
      'La trésorerie devient négative en année 2 et ne se rétablit pas.',
    ),
  ],
};

export const DEMO_EXPERIMENTS: ExperimentPlan = {
  generatedAt: isoDaysAgo(1),
  recommendedExperimentId: 'x-retention',
  rationale:
    "La rétention est à la fois le facteur au plus fort impact et le moins documenté : dix points de rétention valent quatorze points d'indice, et la valeur actuelle est une extrapolation. Aucune autre expérience ne retire autant d'incertitude pour un coût aussi faible.",
  experiments: [
    {
      id: 'x-retention',
      hypothesis: 'Au moins 30 % des clients recommandent dans les 90 jours suivant leur première commande.',
      method: 'Cohorte réelle de 200 clients sur un arrondissement, suivie 12 semaines',
      signal:
        'Le taux de rétention observé tranche directement le facteur le plus sensible du modèle.',
      cost: 'low',
      durationDays: 84,
      uncertaintyReduction: 42,
      priority: 1,
    },
    {
      id: 'x-b2b',
      hypothesis: 'Des restaurants acceptent un abonnement logistique mensuel de 180 000 FCFA.',
      method: 'Précommande auprès de 20 restaurants, avec engagement signé',
      signal:
        "Valide ou invalide l'univers B2B, qui est la seule variante survivant au scénario réglementaire.",
      cost: 'low',
      durationDays: 21,
      uncertaintyReduction: 31,
      priority: 2,
    },
    {
      id: 'x-cac',
      hypothesis: "Le coût d'acquisition réel reste sous 4 500 FCFA à budget publicitaire soutenu.",
      method: 'Campagne test de 1 M FCFA sur deux semaines, mesure du CAC réel',
      signal: "Confirme ou infirme l'hypothèse d'acquisition sur laquelle repose le point mort.",
      cost: 'medium',
      durationDays: 14,
      uncertaintyReduction: 24,
      priority: 3,
    },
    {
      id: 'x-price',
      hypothesis: 'Un prix de 1 800 FCFA ne fait pas chuter la conversion de plus de 15 %.',
      method: 'Test de prix A/B sur deux quartiers comparables',
      signal: "Mesure l'élasticité réelle, aujourd'hui simulée sur un panel synthétique.",
      cost: 'low',
      durationDays: 28,
      uncertaintyReduction: 18,
      priority: 4,
    },
    {
      id: 'x-density',
      hypothesis: 'Un livreur réalise plus de 14 courses par jour sur une zone resserrée.',
      method: 'Pilote sur Akwa uniquement, avec 5 livreurs pendant un mois',
      signal:
        'Valide la recommandation principale du rapport avant tout engagement de flotte.',
      cost: 'medium',
      durationDays: 30,
      uncertaintyReduction: 27,
      priority: 5,
    },
  ],
};

// ---------------------------------------------------------------------
// SIMULATIONS
// ---------------------------------------------------------------------

const FINANCIALS = {
  currency: 'FCFA',
  monthlyBurnRate: 4_350_000,
  breakEvenMonth: 19,
  capitalRequired: 57_000_000,
  runwayMonths: null,
  grossMargin: 0.24,
  revenueYear1: 78_400_000,
  revenueYear3: 412_600_000,
  points: POINTS,
};

const UNDERSTANDING = {
  profile: {
    name: 'TamTam Delivery',
    sector: 'Livraison urbaine',
    businessModel: 'Commission par course, B2C',
    product: 'Application de commande et flotte de livreurs à moto',
    targetCustomer: 'Actifs urbains de 22 à 40 ans, Douala',
    market: 'Livraison de repas et de colis, agglomération de Douala',
    location: 'Douala',
    country: 'Cameroun',
    currency: 'FCFA',
    pricePoint: '1 500 FCFA par livraison',
    plannedFunding: '42 000 000 FCFA',
    teamSize: '6 personnes + 24 livreurs',
  },
  baseline: BASELINE,
  narrative:
    "Une plateforme de livraison B2C à Douala, avec flotte propre, positionnée sur cinq arrondissements et financée à hauteur de 42 M FCFA.",
  items: [
    { id: 'k-model', label: 'Modèle économique', state: 'known' as const, value: 'Commission par course' },
    { id: 'k-price', label: 'Prix de la livraison', state: 'known' as const, value: '1 500 FCFA' },
    { id: 'k-funding', label: 'Capital disponible', state: 'known' as const, value: '42 000 000 FCFA' },
    { id: 'k-team', label: 'Taille de l\'équipe', state: 'known' as const, value: '6 personnes + 24 livreurs' },
    { id: 'k-fuel', label: 'Prix du carburant', state: 'researchable' as const, value: '840 FCFA / litre' },
    { id: 'k-density', label: 'Densité de la zone couverte', state: 'researchable' as const, value: '~9 800 hab./km²' },
    { id: 'k-competition', label: 'Plateformes concurrentes', state: 'researchable' as const, value: '3 acteurs actifs' },
    {
      id: 'k-retention',
      label: 'Rétention client réelle',
      state: 'uncertain' as const,
      detail: 'Aucune donnée publique sur ce marché. Estimée à partir de plateformes comparables.',
    },
    {
      id: 'k-regulation',
      label: 'Statut réglementaire des livreurs',
      state: 'uncertain' as const,
      detail: "Aucun texte stable applicable aujourd'hui au Cameroun.",
    },
    {
      id: 'k-churn-b2b',
      label: 'Durée moyenne des contrats restaurants',
      state: 'missing' as const,
      detail: 'Nécessaire pour simuler la variante B2B.',
      answerable: true,
    },
    {
      id: 'k-fleet-cost',
      label: "Coût d'entretien mensuel d'une moto",
      state: 'missing' as const,
      detail: 'Absent des prévisions financières du projet.',
      answerable: true,
    },
  ],
};

const RESULT = {
  viabilityIndex: 68,
  robustness: 'medium' as const,
  confidence: 'medium' as const,
  verdict: 'go-with-conditions' as const,
  verdictRationale:
    "Le modèle tient dans le scénario de référence (point mort au mois 19, trésorerie jamais négative) mais casse dans six des neuf scénarios testés. Les deux ruptures les plus probables sont la guerre des prix, où la marge unitaire de 24 % ne laisse aucune marge d'absorption, et la dérive du coût d'acquisition, qui repousse le point mort au mois 34 alors que la trésorerie s'épuise au mois 14. Les points de rupture sont concentrés sur deux variables maîtrisables : la rétention client et la densité de la zone couverte.",
  factorSummary: summariseFactors(FACTORS),
  criticalFactors: FACTORS.filter((factor) => factor.tier === 'critical'),
  scenarios: SCENARIOS,
  risks: [
    {
      id: 'risk-price-war',
      title: 'Aucune marge de manœuvre en cas de baisse des prix concurrents',
      severity: 'critical' as const,
      description:
        "La marge unitaire de 24 % ne permet pas d'absorber un alignement sur une baisse de 30 %. Le modèle passe sous le coût par course dès le premier mois.",
    },
    {
      id: 'risk-retention',
      title: 'La variable la plus déterminante est la moins documentée',
      severity: 'critical' as const,
      description:
        "La rétention pilote l'indice à elle seule (14 points sur 10 points de rétention) et repose sur une extrapolation à confiance faible.",
    },
    {
      id: 'risk-capital',
      title: 'Le capital ne couvre aucun scénario défavorable',
      severity: 'high' as const,
      description:
        '42 M FCFA suffisent au seul scénario de référence. Quatre scénarios défavorables épuisent la trésorerie avant le point mort.',
    },
    {
      id: 'risk-regulation',
      title: 'Exposition réglementaire non quantifiable',
      severity: 'moderate' as const,
      description:
        "Le statut des livreurs de plateforme n'est pas stabilisé. L'impact simulé est majeur (indice à 18), la probabilité inconnue.",
    },
  ],
  strengths: [
    'Structure de coûts majoritairement variable, ajustable rapidement à la baisse',
    'Part du mobile money supérieure au seuil de viabilité, besoin en fonds de roulement contenu',
    'Densité urbaine favorable sur la zone visée, qui reste le levier le plus accessible',
  ],
  weaknesses: [
    'Marge unitaire trop faible pour absorber un choc de prix',
    'Rétention client insuffisamment documentée alors qu\'elle pilote le modèle',
    'Capital calibré sur le seul scénario de référence',
    'Acquisition entièrement dépendante d\'un canal payant',
  ],
  keyUncertainties: [
    'Rétention client réelle sur le marché de Douala',
    "Coût d'acquisition à volume plus élevé",
    'Réaction des plateformes concurrentes à une entrée',
    'Évolution du statut réglementaire des livreurs',
  ],
  financials: FINANCIALS,
  sensitivity: SENSITIVITY,
  conditions: CONDITIONS,
};

export const DEMO_REPORT: SimulationReport = {
  simulationId: 'sim-tamtam-2',
  generatedAt: isoDaysAgo(2),
  executiveSummary: {
    viabilityIndex: 68,
    robustness: 'medium',
    confidence: 'medium',
    verdict: 'go-with-conditions',
    statement:
      "Le projet est viable dans les scénarios étudiés à condition de resserrer la zone de couverture et de valider la rétention client par une mesure réelle. En l'état, le capital prévu ne couvre aucun scénario défavorable, et la marge unitaire ne laisse aucune capacité d'absorption face à une attaque par les prix.",
  },
  profile: UNDERSTANDING.profile,
  factors: FACTORS,
  scenarios: SCENARIOS,
  financials: FINANCIALS,
  sensitivity: SENSITIVITY,
  conditions: CONDITIONS,
  recommendations: RECOMMENDATIONS,
  evidence: EVIDENCE,
  validationNeeded: [
    'Rétention à 3 mois, mesurée sur une cohorte réelle de 200 clients',
    "Coût d'acquisition observé sur un budget publicitaire de 1 M FCFA",
    'Nombre de courses par livreur et par jour sur la zone resserrée',
    'Disposition des restaurants à souscrire un abonnement mensuel',
    "Coût réel d'entretien de la flotte sur douze mois",
  ],
};

export const DEMO_SIMULATIONS: Simulation[] = [
  {
    id: 'sim-tamtam-2',
    projectId: 'prj-tamtam',
    name: 'TamTam Delivery — zone resserrée',
    origin: 'idem-project',
    projectName: 'TamTam Delivery',
    tier: 'pack',
    status: 'completed',
    createdAt: isoDaysAgo(2),
    updatedAt: isoDaysAgo(2),
    completedAt: isoDaysAgo(2),
    hasReport: true,
    previousRunId: 'sim-tamtam-1',
    revision: 2,
    factors: FACTORS,
    evidence: EVIDENCE,
    understanding: UNDERSTANDING,
    result: RESULT,
    report: DEMO_REPORT,
    labs: {},
    progress: {
      percent: 100,
      stages: [
        { id: 'understand', state: 'done', note: '11 éléments identifiés' },
        { id: 'discover-factors', state: 'done', note: '15 facteurs identifiés' },
        { id: 'research', state: 'done', note: '9 valeurs sourcées' },
        { id: 'model', state: 'done', note: '9 scénarios construits' },
        { id: 'simulate', state: 'done', note: '9 scénarios exécutés, dont 5 stress tests' },
        { id: 'analyse', state: 'done' },
      ],
    },
  },
  {
    id: 'sim-tamtam-1',
    projectId: 'prj-tamtam',
    name: 'TamTam Delivery — première simulation',
    origin: 'idem-project',
    projectName: 'TamTam Delivery',
    tier: 'run',
    status: 'completed',
    createdAt: isoDaysAgo(9),
    updatedAt: isoDaysAgo(9),
    completedAt: isoDaysAgo(9),
    hasReport: false,
    revision: 1,
    factors: FACTORS.slice(0, 11),
    evidence: EVIDENCE.slice(0, 6),
    understanding: UNDERSTANDING,
    labs: {},
    result: {
      ...RESULT,
      viabilityIndex: 55,
      robustness: 'low',
      verdictRationale:
        "Sur une couverture de cinq arrondissements, le nombre de courses par livreur reste sous le seuil de rentabilité dans la majorité des scénarios. Le point mort n'est atteint que dans deux scénarios sur six.",
      factorSummary: summariseFactors(FACTORS.slice(0, 11)),
      criticalFactors: FACTORS.filter((f) => f.tier === 'critical').slice(0, 4),
      scenarios: SCENARIOS.slice(0, 6),
      risks: [],
      strengths: ['Demande confirmée sur le segment repas'],
      weaknesses: [
        'Zone de couverture trop large pour la flotte prévue',
        'Point mort au-delà de l\'horizon de financement',
      ],
    },
    progress: {
      percent: 100,
      stages: [
        { id: 'understand', state: 'done' },
        { id: 'discover-factors', state: 'done', note: '11 facteurs identifiés' },
        { id: 'research', state: 'done' },
        { id: 'model', state: 'done' },
        { id: 'simulate', state: 'done', note: '6 scénarios' },
        { id: 'analyse', state: 'done' },
      ],
    },
  },
  {
    id: 'sim-shamba-1',
    projectId: 'prj-shamba',
    name: 'Shamba Fresh — chaîne du froid',
    origin: 'imported-document',
    documentName: 'shamba-business-plan-v3.pdf',
    tier: 'run',
    status: 'running',
    createdAt: isoDaysAgo(0),
    updatedAt: isoDaysAgo(0),
    hasReport: false,
    revision: 1,
    factors: [],
    evidence: [],
    labs: {},
    progress: {
      percent: 46,
      stages: [
        { id: 'understand', state: 'done', note: 'Business plan de 24 pages analysé' },
        { id: 'discover-factors', state: 'done', note: '22 facteurs identifiés' },
        { id: 'research', state: 'active', note: 'Prix des intrants et rendements agricoles' },
        { id: 'model', state: 'pending' },
        { id: 'simulate', state: 'pending' },
        { id: 'analyse', state: 'pending' },
      ],
    },
  },
];
