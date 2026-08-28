import {
  Evidence,
  Factor,
  FinancialPoint,
  LinkedProject,
  Recommendation,
  Scenario,
  SensitivityEntry,
  Simulation,
  SimulationReport,
  ViabilityCondition,
  summariseFactors,
} from '../models';

/**
 * Demo dataset served when `environment.useMockData` is on.
 *
 * It stands in for the simulation API so the product can be developed and
 * reviewed end to end before the backend exists. The narrative content is in
 * French because in production it is generated per-run in the user's language,
 * not translated from UI bundles.
 */

const NOW = new Date('2026-08-24T09:12:00.000Z');

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

export const DEMO_PROJECTS: LinkedProject[] = [
  {
    id: 'prj-tamtam',
    name: 'TamTam Delivery',
    description:
      "Livraison de repas et de colis à Douala, avec une flotte de livreurs à moto et une application de commande.",
    sector: 'Livraison urbaine',
    availableAssets: [
      'Business plan',
      'Analyse de marché',
      'Prévisions financières',
      'Modèle économique',
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
      "Application de micro-épargne et de tontine numérique pour les travailleurs informels au Cameroun.",
    sector: 'Fintech',
    availableAssets: ['Business plan', 'Analyse de marché', 'Juridique', 'Modèle économique'],
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

const FACTORS: Factor[] = [
  {
    id: 'f-retention',
    name: 'Rétention client à 3 mois',
    category: 'Demande',
    tier: 'critical',
    impact: 96,
    description:
      "La part de clients encore actifs après trois mois détermine le nombre de commandes amorties par acquisition. C'est le facteur qui déplace le plus les résultats simulés.",
    evidence: {
      id: 'e-retention',
      label: 'Rétention à 3 mois retenue',
      value: '31 %',
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
    description:
      "Le budget publicitaire par client acquis pèse directement sur le point mort, d'autant plus que le panier moyen est faible.",
    evidence: {
      id: 'e-cac',
      label: 'CAC moyen modélisé',
      value: '4 200 FCFA',
      kind: 'estimate',
      confidence: 'medium',
      source: 'Coûts publicitaires Meta observés sur le marché camerounais, pondérés par le taux de conversion projeté',
      asOf: '2026-06',
    },
  },
  {
    id: 'f-fuel',
    name: 'Prix du carburant',
    category: 'Coûts opérationnels',
    tier: 'critical',
    impact: 84,
    description:
      "Le carburant représente une part importante du coût par livraison et n'est pas répercutable à court terme sur le prix client.",
    evidence: {
      id: 'e-fuel',
      label: 'Super à la pompe, Douala',
      value: '840 FCFA / litre',
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
    description:
      "Le modèle suppose une rémunération à la course. Une pression à la hausse, ou une requalification en salariat, change la structure de coûts.",
    evidence: {
      id: 'e-courier',
      label: 'Coût moyen par course',
      value: '1 150 FCFA',
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
    description:
      "Le prix facturé au client conditionne à la fois la marge unitaire et l'élasticité de la demande. Les deux effets jouent en sens contraire.",
    evidence: {
      id: 'e-price',
      label: 'Prix de livraison prévu',
      value: '1 500 FCFA',
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
    description:
      "Trois plateformes couvrent déjà Douala. Une baisse de prix coordonnée est le scénario défavorable le plus plausible.",
    evidence: {
      id: 'e-competition',
      label: 'Plateformes actives sur la zone',
      value: '3 acteurs',
      kind: 'data',
      confidence: 'high',
      source: 'Recensement des applications disponibles sur Play Store pour la zone Douala',
      asOf: '2026-07',
    },
  },
  {
    id: 'f-density',
    name: 'Densité urbaine de la zone de couverture',
    category: 'Marché',
    tier: 'important',
    impact: 64,
    description:
      "Plus les points de retrait et de livraison sont denses, plus le nombre de courses par livreur et par heure augmente.",
    evidence: {
      id: 'e-density',
      label: 'Densité, arrondissements couverts',
      value: '~9 800 hab./km²',
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
    description:
      "La part payée en mobile money conditionne les frais de transaction et le besoin en fonds de roulement lié aux encaissements en espèces.",
    evidence: {
      id: 'e-payment',
      label: 'Part du mobile money projetée',
      value: '62 %',
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
    description:
      "De juillet à octobre, les temps de trajet augmentent et le nombre de courses par livreur baisse mécaniquement.",
    evidence: {
      id: 'e-roads',
      label: 'Allongement moyen des trajets',
      value: '+22 % (juil.-oct.)',
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
    description:
      "Aucun texte stable n'encadre aujourd'hui le statut des livreurs de plateforme au Cameroun. L'impact potentiel est élevé mais la probabilité n'est pas estimable.",
  },
  {
    id: 'f-purchasing-power',
    name: "Évolution du pouvoir d'achat urbain",
    category: 'Contexte économique',
    tier: 'unknown',
    impact: 55,
    description:
      "La fréquence de commande dépend du revenu disponible. Les projections disponibles divergent trop pour être utilisées telles quelles.",
  },
  {
    id: 'f-seasonality',
    name: 'Saisonnalité de la demande',
    category: 'Demande',
    tier: 'secondary',
    impact: 38,
    description:
      "Les pics de fin d'année et les périodes de rentrée créent des variations de volume absorbables par la flotte prévue.",
  },
  {
    id: 'f-support',
    name: 'Charge du support client',
    category: 'Opérations',
    tier: 'secondary',
    impact: 29,
    description:
      "Le coût de traitement des incidents de livraison reste faible au volume simulé, mais croît plus vite que le chiffre d'affaires.",
  },
];

const SCENARIOS: Scenario[] = [
  {
    id: 's-baseline',
    name: 'Scénario de référence',
    kind: 'baseline',
    question: 'Les hypothèses centrales du projet se vérifient.',
    shifts: [],
    viability: 68,
    breakEvenMonth: 19,
    runwayMonths: 22,
    survives: true,
    outcome:
      "Le modèle atteint son point mort au 19e mois, avec trois mois de trésorerie de marge. La rentabilité dépend d'une rétention tenue à 31 %.",
  },
  {
    id: 's-favourable',
    name: 'Densification réussie',
    kind: 'favourable',
    question: "La couverture se concentre sur deux arrondissements au lieu de cinq.",
    shifts: [
      { factorId: 'f-density', label: 'Courses par livreur et par heure', delta: '+34 %' },
      { factorId: 'f-cac', label: "Coût d'acquisition", delta: '-15 %' },
    ],
    viability: 81,
    breakEvenMonth: 13,
    runwayMonths: 31,
    survives: true,
    outcome:
      "Le point mort avance de six mois. C'est le scénario favorable le plus accessible car il ne dépend d'aucun facteur externe.",
  },
  {
    id: 's-price-war',
    name: 'Guerre des prix',
    kind: 'stress',
    question: 'Le principal concurrent baisse ses prix de 30 %.',
    shifts: [
      { factorId: 'f-competition', label: 'Prix concurrent', delta: '-30 %' },
      { factorId: 'f-price', label: 'Prix aligné pour tenir les volumes', delta: '-18 %' },
    ],
    viability: 34,
    breakEvenMonth: null,
    runwayMonths: 11,
    survives: false,
    outcome:
      "La marge unitaire passe sous le coût par course. Le modèle ne revient à l'équilibre dans aucune des trajectoires testées sans réduire la zone couverte.",
  },
  {
    id: 's-cac-drift',
    name: "Dérive du coût d'acquisition",
    kind: 'stress',
    question: "Le coût d'acquisition augmente de 40 %.",
    shifts: [{ factorId: 'f-cac', label: "Coût d'acquisition", delta: '+40 %' }],
    viability: 41,
    breakEvenMonth: 34,
    runwayMonths: 14,
    survives: false,
    outcome:
      "Le point mort sort de l'horizon de financement. Le capital prévu est épuisé quatorze mois après le lancement.",
  },
  {
    id: 's-funding-delay',
    name: 'Financement retardé',
    kind: 'adverse',
    question: 'La levée de fonds arrive six mois plus tard que prévu.',
    shifts: [{ factorId: 'f-cac', label: 'Budget acquisition disponible', delta: '-50 % sur 6 mois' }],
    viability: 52,
    breakEvenMonth: 27,
    runwayMonths: 16,
    survives: true,
    outcome:
      "Le modèle survit en réduisant l'acquisition, au prix d'une croissance divisée par deux sur la première année.",
  },
  {
    id: 's-slow-growth',
    name: 'Croissance deux fois plus lente',
    kind: 'adverse',
    question: 'La croissance est moitié moindre que prévu.',
    shifts: [{ factorId: 'f-retention', label: 'Commandes par client et par mois', delta: '-50 %' }],
    viability: 45,
    breakEvenMonth: 38,
    runwayMonths: 15,
    survives: false,
    outcome:
      "Le volume ne suffit jamais à absorber les coûts fixes de la flotte. Le modèle casse sur la structure de coûts, pas sur la demande.",
  },
  {
    id: 's-regulation',
    name: 'Requalification des livreurs',
    kind: 'extreme',
    question: 'Une réglementation impose la salarisation des livreurs.',
    shifts: [
      { factorId: 'f-courier-cost', label: 'Coût par livreur', delta: '+65 %' },
      { factorId: 'f-regulation', label: 'Charges sociales', delta: 'Nouvelles' },
    ],
    viability: 18,
    breakEvenMonth: null,
    runwayMonths: 8,
    survives: false,
    outcome:
      "Le modèle à la course ne tient pas. Une bascule vers un abonnement B2B restaurants est la seule sortie testée qui reste viable.",
  },
  {
    id: 's-compound',
    name: 'Choc combiné',
    kind: 'extreme',
    question: 'Saison des pluies prolongée, carburant en hausse et retard de financement.',
    shifts: [
      { factorId: 'f-roads', label: 'Temps de trajet', delta: '+35 %' },
      { factorId: 'f-fuel', label: 'Prix du carburant', delta: '+25 %' },
      { factorId: 'f-cac', label: 'Budget acquisition', delta: '-50 % sur 6 mois' },
    ],
    viability: 12,
    breakEvenMonth: null,
    runwayMonths: 7,
    survives: false,
    outcome:
      "Combinaison rare mais plausible sur ce marché. La trésorerie devient négative au septième mois.",
  },
];

function buildFinancialPoints(): FinancialPoint[] {
  const points: FinancialPoint[] = [];
  let cash = 42_000_000;
  for (let month = 1; month <= 24; month++) {
    const revenue = Math.round(1_850_000 * Math.pow(1.115, month - 1));
    const costs = Math.round(6_200_000 + revenue * 0.58);
    const cashflow = revenue - costs;
    cash += cashflow;
    points.push({ month, revenue, costs, cashflow, cash });
  }
  return points;
}

const SENSITIVITY: SensitivityEntry[] = [
  { factorId: 'f-retention', factorName: 'Rétention à 3 mois', change: '+10 points', viabilityDelta: 14 },
  { factorId: 'f-cac', factorName: "Coût d'acquisition", change: '-20 %', viabilityDelta: 9 },
  { factorId: 'f-density', factorName: 'Densité de la zone couverte', change: 'Zone réduite de 5 à 2 arrondissements', viabilityDelta: 8 },
  { factorId: 'f-price', factorName: 'Prix de la livraison', change: '+200 FCFA', viabilityDelta: 5 },
  { factorId: 'f-cac', factorName: 'Budget marketing', change: '+20 %', viabilityDelta: 2 },
  { factorId: 'f-fuel', factorName: 'Prix du carburant', change: '+15 %', viabilityDelta: -6 },
  { factorId: 'f-courier-cost', factorName: 'Rémunération des livreurs', change: '+15 %', viabilityDelta: -11 },
];

const CONDITIONS: ViabilityCondition[] = [
  { id: 'c-cac', label: "Coût d'acquisition client", threshold: '< 4 500 FCFA', currentValue: '4 200 FCFA', met: true },
  { id: 'c-retention', label: 'Rétention à 3 mois', threshold: '> 35 %', currentValue: '31 %', met: false },
  { id: 'c-margin', label: 'Marge brute par course', threshold: '> 28 %', currentValue: '24 %', met: false },
  { id: 'c-orders', label: 'Courses par livreur et par jour', threshold: '> 14', currentValue: '11', met: false },
  { id: 'c-capital', label: 'Capital disponible avant point mort', threshold: '> 55 M FCFA', currentValue: '42 M FCFA', met: false },
  { id: 'c-payment', label: 'Part des encaissements en mobile money', threshold: '> 55 %', currentValue: '62 %', met: true },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'r-density',
    title: 'Réduire la zone de couverture avant d’augmenter le budget publicitaire',
    body: "Les simulations montrent que la densité de courses pèse davantage que le volume de clients acquis. Concentrer la couverture sur Akwa et Bonanjo augmente le nombre de courses par livreur sans dépense d'acquisition supplémentaire, et améliore la marge unitaire dès le premier mois.",
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'medium',
  },
  {
    id: 'r-retention',
    title: 'Mesurer la rétention réelle avant de figer les prévisions',
    body: "La rétention retenue (31 %) est une extrapolation, pas une mesure. C'est aussi le facteur le plus sensible du modèle : dix points de rétention valent quatorze points d'indice. Une cohorte de 200 clients suivie sur douze semaines suffit à trancher.",
    expectedImpact: 'high',
    priority: 'critical',
    confidence: 'high',
  },
  {
    id: 'r-b2b',
    title: 'Tester un contrat B2B restaurants en parallèle du B2C',
    body: "Dans le scénario de requalification des livreurs, seule la variante B2B par abonnement reste viable. Signer deux à trois restaurants en récurrent réduit la dépendance au volume B2C et donne une base de revenus prévisible.",
    expectedImpact: 'medium',
    priority: 'high',
    confidence: 'medium',
  },
  {
    id: 'r-fuel',
    title: 'Indexer le prix de livraison sur le carburant',
    body: "Le prix du carburant est administré et connu à l'avance. Prévoir contractuellement une clause de révision évite que chaque hausse soit absorbée intégralement par la marge.",
    expectedImpact: 'medium',
    priority: 'medium',
    confidence: 'high',
  },
  {
    id: 'r-capital',
    title: 'Sécuriser 15 M FCFA de trésorerie supplémentaire',
    body: "Le capital prévu couvre le scénario de référence mais aucun des scénarios défavorables testés. Un matelas de 15 M FCFA fait passer trois scénarios sur quatre du statut « ne survit pas » à « survit ».",
    expectedImpact: 'high',
    priority: 'high',
    confidence: 'medium',
  },
];

const EVIDENCE: Evidence[] = FACTORS.filter((factor) => factor.evidence).map(
  (factor) => factor.evidence as Evidence,
);

export const DEMO_SIMULATIONS: Simulation[] = [
  {
    id: 'sim-tamtam-2',
    name: 'TamTam Delivery — zone resserrée',
    origin: 'idem-project',
    projectId: 'prj-tamtam',
    projectName: 'TamTam Delivery',
    tier: 'pack',
    status: 'completed',
    createdAt: isoDaysAgo(2),
    updatedAt: isoDaysAgo(2),
    hasReport: true,
    previousRunId: 'sim-tamtam-1',
    revision: 2,
    progress: {
      percent: 100,
      stages: [
        { id: 'understand', state: 'done', note: '9 livrables IDEM analysés' },
        { id: 'discover-factors', state: 'done', note: '147 facteurs identifiés' },
        { id: 'research', state: 'done', note: '38 données externes collectées' },
        { id: 'model', state: 'done' },
        { id: 'simulate', state: 'done', note: '8 scénarios, dont 4 stress tests' },
        { id: 'analyse', state: 'done' },
      ],
    },
    understanding: {
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
      items: [
        { id: 'k-model', label: 'Modèle économique', state: 'known', value: 'Commission par course' },
        { id: 'k-price', label: 'Prix de la livraison', state: 'known', value: '1 500 FCFA' },
        { id: 'k-funding', label: 'Capital disponible', state: 'known', value: '42 000 000 FCFA' },
        { id: 'k-fuel', label: 'Prix du carburant', state: 'researchable', value: '840 FCFA / litre' },
        { id: 'k-density', label: 'Densité de la zone couverte', state: 'researchable', value: '~9 800 hab./km²' },
        {
          id: 'k-retention',
          label: 'Rétention client réelle',
          state: 'uncertain',
          detail: "Aucune donnée publique sur ce marché. Estimée à partir de plateformes comparables.",
        },
        {
          id: 'k-regulation',
          label: 'Statut réglementaire des livreurs',
          state: 'uncertain',
          detail: "Aucun texte stable applicable aujourd'hui au Cameroun.",
        },
        {
          id: 'k-churn-b2b',
          label: 'Durée moyenne des contrats restaurants',
          state: 'missing',
          detail: "Nécessaire pour simuler la variante B2B.",
          answerable: true,
        },
      ],
    },
    result: {
      viabilityIndex: 68,
      robustness: 'medium',
      confidence: 'medium',
      verdict: 'go-with-conditions',
      verdictRationale:
        "Le modèle tient dans le scénario de référence mais casse dans quatre des huit scénarios testés. Les points de rupture sont concentrés sur deux variables maîtrisables : la rétention client et la densité de la zone couverte.",
      factorSummary: summariseFactors(FACTORS),
      criticalFactors: FACTORS.filter((factor) => factor.tier === 'critical'),
      scenarios: SCENARIOS,
      risks: [
        {
          id: 'risk-price-war',
          title: 'Aucune marge de manœuvre en cas de baisse des prix concurrents',
          severity: 'critical',
          description:
            "La marge unitaire de 24 % ne permet pas d'absorber un alignement sur une baisse de 30 %. Le modèle passe sous le coût par course.",
        },
        {
          id: 'risk-retention',
          title: 'La variable la plus déterminante est la moins documentée',
          severity: 'critical',
          description:
            "La rétention pilote l'indice à elle seule, et repose sur une extrapolation à confiance faible.",
        },
        {
          id: 'risk-capital',
          title: 'Le capital ne couvre aucun scénario défavorable',
          severity: 'high',
          description:
            "42 M FCFA suffisent au scénario de référence uniquement. Trois scénarios défavorables épuisent la trésorerie avant le point mort.",
        },
        {
          id: 'risk-regulation',
          title: 'Exposition réglementaire non quantifiable',
          severity: 'moderate',
          description:
            "Le statut des livreurs de plateforme n'est pas stabilisé. L'impact simulé est majeur, la probabilité inconnue.",
        },
      ],
      strengths: [
        'Structure de coûts variable, ajustable rapidement à la baisse',
        'Part du mobile money supérieure au seuil de viabilité, besoin en fonds de roulement contenu',
        'Densité urbaine favorable sur la zone visée',
      ],
      weaknesses: [
        'Marge unitaire trop faible pour absorber un choc de prix',
        'Rétention client insuffisamment documentée alors qu’elle pilote le modèle',
        'Capital calibré sur le seul scénario de référence',
      ],
      keyUncertainties: [
        'Rétention client réelle sur le marché de Douala',
        "Coût d'acquisition à volume plus élevé",
        'Réaction des plateformes concurrentes à une entrée',
        'Évolution du statut réglementaire des livreurs',
      ],
    },
  },
  {
    id: 'sim-tamtam-1',
    name: 'TamTam Delivery — première simulation',
    origin: 'idem-project',
    projectId: 'prj-tamtam',
    projectName: 'TamTam Delivery',
    tier: 'run',
    status: 'completed',
    createdAt: isoDaysAgo(9),
    updatedAt: isoDaysAgo(9),
    hasReport: false,
    revision: 1,
    progress: {
      percent: 100,
      stages: [
        { id: 'understand', state: 'done' },
        { id: 'discover-factors', state: 'done', note: '132 facteurs identifiés' },
        { id: 'research', state: 'done' },
        { id: 'model', state: 'done' },
        { id: 'simulate', state: 'done', note: '6 scénarios' },
        { id: 'analyse', state: 'done' },
      ],
    },
    result: {
      viabilityIndex: 55,
      robustness: 'low',
      confidence: 'medium',
      verdict: 'go-with-conditions',
      verdictRationale:
        "Sur une couverture de cinq arrondissements, le nombre de courses par livreur reste sous le seuil de rentabilité dans la majorité des scénarios.",
      factorSummary: summariseFactors(FACTORS.slice(0, 11)),
      criticalFactors: FACTORS.filter((factor) => factor.tier === 'critical').slice(0, 4),
      scenarios: SCENARIOS.slice(0, 5),
      risks: [],
      strengths: ['Demande confirmée sur le segment repas'],
      weaknesses: ['Zone de couverture trop large pour la flotte prévue', 'Point mort au-delà de l’horizon de financement'],
      keyUncertainties: ['Rétention client réelle', "Coût d'acquisition à volume plus élevé"],
    },
  },
  {
    id: 'sim-shamba-1',
    name: 'Shamba Fresh — chaîne du froid',
    origin: 'imported-document',
    documentName: 'shamba-business-plan-v3.pdf',
    tier: 'run',
    status: 'running',
    createdAt: isoDaysAgo(0),
    updatedAt: isoDaysAgo(0),
    hasReport: false,
    revision: 1,
    progress: {
      percent: 46,
      stages: [
        { id: 'understand', state: 'done', note: 'Business plan de 24 pages analysé' },
        { id: 'discover-factors', state: 'done', note: '96 facteurs identifiés' },
        { id: 'research', state: 'active', note: 'Prix des intrants et rendements agricoles' },
        { id: 'model', state: 'pending' },
        { id: 'simulate', state: 'pending' },
        { id: 'analyse', state: 'pending' },
      ],
    },
  },
];

export const DEMO_REPORT: SimulationReport = {
  simulationId: 'sim-tamtam-2',
  generatedAt: isoDaysAgo(2),
  executiveSummary: {
    viabilityIndex: 68,
    robustness: 'medium',
    confidence: 'medium',
    verdict: 'go-with-conditions',
    statement:
      "Le projet est viable dans les scénarios étudiés à condition de resserrer la zone de couverture et de valider la rétention client par une mesure réelle. En l'état, le capital prévu ne couvre aucun scénario défavorable.",
  },
  profile: (DEMO_SIMULATIONS[0].understanding as NonNullable<Simulation['understanding']>).profile,
  factors: FACTORS,
  scenarios: SCENARIOS,
  financials: {
    currency: 'FCFA',
    monthlyBurnRate: 4_350_000,
    breakEvenMonth: 19,
    capitalRequired: 57_000_000,
    runwayMonths: 22,
    grossMargin: 0.24,
    points: buildFinancialPoints(),
  },
  sensitivity: SENSITIVITY,
  conditions: CONDITIONS,
  recommendations: RECOMMENDATIONS,
  evidence: EVIDENCE,
  validationNeeded: [
    'Rétention à 3 mois, mesurée sur une cohorte réelle de 200 clients',
    "Coût d'acquisition observé sur un budget publicitaire de 1 M FCFA",
    'Nombre de courses par livreur et par jour sur la zone resserrée',
    'Disposition des restaurants à souscrire un abonnement mensuel',
  ],
};
