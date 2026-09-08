/**
 * Le module Finance, traduit en BLOCS de section.
 *
 * ── LA DOCTRINE, APPLIQUÉE AUX CHIFFRES ─────────────────────────────────────
 *
 * Une page de nuancier ne demande pas au modèle de recopier six chiffres
 * hexadécimaux : le service les POSE (`prependBlocks`), parce qu'un modèle
 * recopie mal, et qu'une charte qui affiche une couleur fausse est un défaut de
 * fabrication. Un plan financier pose exactement le même problème, en pire : un
 * modèle à qui l'on donne « CA an 1 = 1 006 000 000 » dans un contexte de
 * plusieurs milliers de mots en écrit 1 000 000 000 une page plus loin, arrondit
 * une marge, invente un exercice « 2026-2027 ».
 *
 * Les tableaux financiers du business plan sont donc CONSTRUITS ici, à partir de
 * `finance.computed`, et posés en tête de la section. Il reste au modèle ce
 * qu'il sait faire : écrire l'analyse autour.
 *
 * ── CE QUE CES BLOCS APPORTENT AU DOSSIER ───────────────────────────────────
 *
 * Le plan financier livré ne portait ni tableau d'investissements, ni besoin en
 * fonds de roulement, ni plan de financement, ni montant sollicité. Un banquier
 * ouvre un dossier par cette dernière ligne. Elle est ici la première.
 */

import { Block } from '../design/sectionContent';
import { FinanceComputed, FinanceModel } from '../../models/finance.model';

const fmt = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  return sign + Math.round(Math.abs(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const pctOf = (value: number, decimals = 1): string =>
  Number.isFinite(value) ? `${value.toFixed(decimals).replace('.', ',')} %` : '—';

const short = (value: number, currency: string): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2).replace('.', ',')} Md ${currency}`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)} M ${currency}`;
  return `${fmt(value)} ${currency}`;
};

/**
 * Blocs financiers du plan, dans l'ordre où un prêteur les lit.
 *
 * Renvoie un tableau vide quand le module Finance n'a pas été calculé : mieux
 * vaut une section entièrement rédigée qu'une section ouverte par des tableaux
 * de zéros.
 */
export function buildFinanceBlocks(finance: FinanceModel | undefined): Block[] {
  const k = finance?.computed as FinanceComputed | undefined;
  if (!finance || !k || !k.compteExploitation?.length) return [];

  const currency = finance.meta?.currency || 'FCFA';
  const labels = k.fiscalYearLabels ?? k.compteExploitation.map((row) => String(row.year));
  const ce = k.compteExploitation;
  const fp = k.fundingPlan;
  const pc = k.projectCost;
  const ratios = k.ratios;
  const blocks: Block[] = [];

  // ── 1. Les chiffres de tête ──────────────────────────────────────────────
  blocks.push({
    kind: 'metrics',
    items: [
      {
        value: short(ce[0].chiffreAffaires, currency),
        label: `Chiffre d'affaires ${labels[0]}`,
        note: `Exercice du 1er janvier au 31 décembre ${labels[0]}`,
      },
      {
        value: short(ce[0].resultatNet, currency),
        label: `Résultat net ${labels[0]}`,
        note: `Marge nette ${pctOf(ce[0].chiffreAffaires ? (ce[0].resultatNet / ce[0].chiffreAffaires) * 100 : 0)}`,
      },
      {
        value: short(pc.coutTotalProjet, currency),
        label: 'Coût total du projet',
        note: 'Investissements + besoin en fonds de roulement',
      },
      {
        value: short(Math.max(0, fp.besoinDeFinancement), currency),
        label: 'Besoin de financement',
        note:
          fp.besoinDeFinancement > 0
            ? `Solde après ${short(fp.totalFinancement, currency)} de ressources mobilisées`
            : 'Plan de financement équilibré',
      },
    ],
  });

  // ── 2. La trajectoire ────────────────────────────────────────────────────
  blocks.push({
    kind: 'chart',
    chartType: ce.length > 2 ? 'line' : 'bar',
    labels,
    series: [
      { name: "Chiffre d'affaires", data: ce.map((row) => Math.round(row.chiffreAffaires)) },
      { name: 'Résultat net', data: ce.map((row) => Math.round(row.resultatNet)) },
    ],
    unit: currency,
    readingKey:
      ce.length > 1 && ce[0].chiffreAffaires > 0
        ? `Le résultat net passe de ${pctOf((ce[0].resultatNet / ce[0].chiffreAffaires) * 100)} ` +
          `du chiffre d'affaires en ${labels[0]} à ` +
          `${pctOf(ce[ce.length - 1].chiffreAffaires ? (ce[ce.length - 1].resultatNet / ce[ce.length - 1].chiffreAffaires) * 100 : 0)} en ${labels[labels.length - 1]}.`
        : "Trajectoire du chiffre d'affaires et du résultat net sur l'horizon du plan.",
  });

  // ── 3. Le compte d'exploitation ──────────────────────────────────────────
  blocks.push({
    kind: 'table',
    headers: ['Poste', ...labels.map((label) => `Exercice ${label}`)],
    rows: [
      ["Chiffre d'affaires", ...ce.map((row) => fmt(row.chiffreAffaires))],
      ['Charges variables', ...ce.map((row) => fmt(-row.chargesVariables))],
      ['Marge sur coûts variables', ...ce.map((row) => fmt(row.margeBrute))],
      ['Charges fixes', ...ce.map((row) => fmt(-row.chargesFixes))],
      ["Excédent brut d'exploitation", ...ce.map((row) => fmt(row.ebe))],
      ['Dotations aux amortissements', ...ce.map((row) => fmt(-row.dotationsAmortissements))],
      ['Charges financières', ...ce.map((row) => fmt(-row.chargesFinancieres))],
      ['Impôt sur les sociétés', ...ce.map((row) => fmt(-row.is))],
      ['Résultat net', ...ce.map((row) => fmt(row.resultatNet))],
    ],
    caption: `Compte d'exploitation prévisionnel, en ${currency}. Exercices calés sur l'année civile conformément au SYSCOHADA.`,
  });

  // ── 4. Le coût du projet ─────────────────────────────────────────────────
  const capexRows: string[][] = [
    ['Immobilisations incorporelles', fmt(pc.immobilisationsIncorporelles)],
    ['Immobilisations corporelles', fmt(pc.immobilisationsCorporelles)],
    ['Immobilisations financières', fmt(pc.immobilisationsFinancieres)],
    ['Stock initial', fmt(pc.stockInitial)],
    ['Frais de premier fonctionnement', fmt(pc.fraisPremierFonctionnement)],
    ['Coût total du projet', fmt(pc.coutTotalProjet)],
  ].filter(
    (row, index) => index >= 3 || Number(row[1].replace(/[^\d]/g, '')) > 0 || index === 5
  );

  blocks.push({
    kind: 'table',
    headers: ['Emploi des fonds', `Montant (${currency})`],
    rows: capexRows,
    caption:
      'Coût total du projet = total des investissements + besoin en fonds de roulement de démarrage.',
  });

  // ── 5. Le plan de financement et la DEMANDE ──────────────────────────────
  const sourceRows = fp.sources
    .filter((source) => source.amount > 0)
    .map((source) => [
      source.label,
      source.nature === 'equity' ? 'Fonds propres' : 'Endettement',
      fmt(source.amount),
      pctOf(source.sharePct),
    ]);

  if (sourceRows.length > 0) {
    sourceRows.push(['Total des ressources mobilisées', '', fmt(fp.totalFinancement), pctOf(100)]);
  }
  if (fp.besoinDeFinancement > 0) {
    sourceRows.push([
      'Besoin de financement à couvrir',
      'Concours sollicité',
      fmt(fp.besoinDeFinancement),
      pctOf(fp.coutTotalProjet > 0 ? (fp.besoinDeFinancement / fp.coutTotalProjet) * 100 : 0),
    ]);
  }

  if (sourceRows.length > 0) {
    blocks.push({
      kind: 'table',
      headers: ['Ressource', 'Nature', `Montant (${currency})`, 'Part'],
      rows: sourceRows,
      caption:
        fp.besoinDeFinancement > 0
          ? `Le solde de ${short(fp.besoinDeFinancement, currency)} constitue le montant sollicité. ` +
            `Taux d'endettement du plan : ${pctOf(fp.tauxEndettementPct)}.`
          : `Plan de financement couvert à ${pctOf(fp.couverturePct)}. Taux d'endettement : ${pctOf(fp.tauxEndettementPct)}.`,
    });
  }

  // ── 6. Seuil de rentabilité et trésorerie ────────────────────────────────
  const seuil = k.seuilRentabilite[0];
  const lowestCash = Math.min(...k.cashFlowOec.map((row) => row.tresorerieCloture));
  if (seuil) {
    blocks.push({
      kind: 'metrics',
      items: [
        {
          value: short(seuil.seuilRentabilite, currency),
          label: 'Seuil de rentabilité',
          note: `Exercice ${labels[0]}`,
        },
        {
          value: `${Math.round(seuil.pointMortJours)} jours`,
          label: 'Point mort',
          note: 'Sur une base de 360 jours',
        },
        {
          value: pctOf(ce[0].tauxMargePct),
          label: 'Taux de marge sur coûts variables',
        },
        {
          value: short(lowestCash, currency),
          label: 'Trésorerie au point bas',
          note: lowestCash < 0 ? 'Déficit à couvrir avant démarrage' : 'Trésorerie toujours positive',
        },
      ],
    });
  }

  // ── 7. Les indicateurs de rentabilité, avec leur réserve ─────────────────
  if (ratios.significant) {
    blocks.push({
      kind: 'table',
      headers: ['Indicateur', 'Valeur', 'Lecture'],
      rows: [
        [
          'Valeur actuelle nette',
          short(ratios.van, currency),
          `Actualisation à ${pctOf(finance.ratiosParams.vanDiscountRatePct, 0)}, investissement initial de ${short(ratios.investissementInitial, currency)} imputé en année 0`,
        ],
        [
          'Taux de rentabilité interne',
          pctOf(ratios.tri),
          ratios.tri >= finance.ratiosParams.vanDiscountRatePct
            ? "Supérieur au taux d'actualisation retenu"
            : "Inférieur au taux d'actualisation retenu",
        ],
        [
          'Délai de récupération',
          ratios.drciAtteintAnnee === null
            ? "Non atteint sur l'horizon"
            : `${ratios.drci.toFixed(2).replace('.', ',')} ans`,
          "Année où le cumul des flux de trésorerie devient positif",
        ],
        [
          'Indice de profitabilité',
          ratios.indiceProfitabilite.toFixed(2).replace('.', ','),
          ratios.indiceProfitabilite >= 1
            ? 'Supérieur à 1 : le projet crée de la valeur sur l’horizon étudié'
            : 'Inférieur à 1 : le projet ne récupère pas sa mise sur l’horizon étudié',
        ],
      ],
      caption:
        "Ces indicateurs rapportent les flux de trésorerie prévisionnels à l'investissement " +
        "initial, imputé en année 0. Sans cette imputation, ils sont sans objet.",
    });
  } else {
    blocks.push({
      kind: 'assumption',
      statement:
        ratios.significanceNote ??
        "Les indicateurs de rentabilité ne sont pas calculables en l'absence d'investissement initial.",
      basis:
        "La valeur actuelle nette et le taux de rentabilité interne rapportent des flux à une mise " +
        "de fonds. Sans tableau d'investissements ni besoin en fonds de roulement, ils rapportent " +
        'des bénéfices à zéro et prennent une valeur arbitrairement flatteuse.',
    });
  }

  return blocks;
}

/**
 * Résumé TEXTUEL du module Finance pour le contexte des agents.
 *
 * Il ne sert plus à faire recopier des tableaux — les blocs s'en chargent —
 * mais à ce que les autres sections du plan ne contredisent pas les chiffres.
 */
export function buildFinanceNarrative(finance: FinanceModel | undefined): string {
  const k = finance?.computed as FinanceComputed | undefined;
  if (!finance || !k || !k.compteExploitation?.length) {
    if (!finance) return '';
    const products = (finance.products || [])
      .map((p) => `${p.name}: ${p.prices?.[0] ?? 0}`)
      .join(', ');
    return products ? `\n\n--- FINANCE MODULE (not computed) ---\nProducts: ${products}` : '';
  }

  const currency = finance.meta?.currency || 'FCFA';
  const labels = k.fiscalYearLabels;
  const fp = k.fundingPlan;

  const lines = [
    '--- REAL FINANCIAL DATA FROM THE FINANCE MODULE ---',
    `Currency: ${currency}`,
    `Fiscal years run 1 January to 31 December (SYSCOHADA). Year labels: ${labels.join(', ')}.`,
    `NEVER write a hyphenated fiscal year such as "${labels[0]}-${labels[1] ?? ''}".`,
    '',
    'Profit and loss:',
    ...k.compteExploitation.map(
      (row, y) =>
        `- Exercice ${labels[y]}: revenue ${Math.round(row.chiffreAffaires)}, gross margin ${Math.round(row.margeBrute)} (${row.tauxMargePct.toFixed(1)}%), EBITDA ${Math.round(row.ebe)}, net income ${Math.round(row.resultatNet)}`
    ),
    '',
    'Project cost and funding:',
    `- Total investments: ${Math.round(k.projectCost.totalInvestissements)}`,
    `- Working capital requirement: ${Math.round(k.projectCost.besoinFondsRoulement)}`,
    `- TOTAL PROJECT COST: ${Math.round(fp.coutTotalProjet)}`,
    `- Funding already secured: ${Math.round(fp.totalFinancement)} (equity ${Math.round(fp.totalEquity)}, debt ${Math.round(fp.totalDebt)})`,
    `- FUNDING REQUEST (the amount asked for): ${Math.round(fp.besoinDeFinancement)}`,
    '',
    'Break-even and cash:',
    ...k.seuilRentabilite.map(
      (row, y) =>
        `- Exercice ${labels[y]}: break-even ${Math.round(row.seuilRentabilite)}, ${Math.round(row.pointMortJours)} days`
    ),
    ...k.cashFlowOec.map((row) => `- Exercice ${row.label}: closing cash ${Math.round(row.tresorerieCloture)}`),
    '',
    k.ratios.significant
      ? `Return indicators: NPV ${Math.round(k.ratios.van)}, IRR ${k.ratios.tri.toFixed(1)}%, payback ${k.ratios.drciAtteintAnnee === null ? 'not reached within the horizon' : `${k.ratios.drci.toFixed(2)} years`}, profitability index ${k.ratios.indiceProfitabilite.toFixed(2)}`
      : `Return indicators are NOT SIGNIFICANT: ${k.ratios.significanceNote}`,
  ];

  return '\n\n' + lines.join('\n');
}
