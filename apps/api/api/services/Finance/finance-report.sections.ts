/**
 * Les sections du rapport financier.
 *
 * Une fonction par section, chacune ne lisant que le `FinanceModel` et son
 * `computed`. Aucun chiffre n'est recalculé ici : le rapport PUBLIE ce que le
 * moteur a établi. Recalculer au moment du rendu est le mécanisme exact par
 * lequel deux tableaux d'un même document finissent par ne plus dire la même
 * chose.
 *
 * L'ordre suit la lecture d'un analyste crédit : ce que l'affaire rapporte, ce
 * qu'elle coûte, ce qu'elle doit à l'État, ce qu'elle immobilise, ce qu'il faut
 * apporter pour la lancer — puis les états de synthèse, puis seulement les
 * indicateurs de rentabilité.
 */

import {
  FinanceModel,
  FinanceComputed,
  firstYearActiveMonths,
  fiscalYearPeriod,
} from '../../models/finance.model';
import {
  AccountingJurisdiction,
  fiscalYearStatement,
} from '../common/accounting-jurisdiction';
import { INITIAL_OPERATING_MONTHS } from './finance-statements.service';
import {
  ReportChrome,
  assumption,
  caption,
  compact,
  esc,
  grid,
  groupedColumns,
  hero,
  horizontalBars,
  money,
  num,
  page,
  pct,
  sectionTitle,
  stat,
  subTitle,
  table,
  warningBlock,
  zeroAnchoredBars,
} from './finance-report.template';

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Colonnes d'exercice : « 2026 », « 2027 »… jamais « 2026-2027 ». */
const yearHeaders = (labels: string[]): string[] => labels.map((label) => `Exercice ${label}`);

// =====================================================================
// 01 · SYNTHÈSE
// =====================================================================

export function summarySection(
  c: ReportChrome,
  finance: FinanceModel,
  jurisdiction: AccountingJurisdiction
): string {
  const k = finance.computed as FinanceComputed;
  const ce = k.compteExploitation;
  const labels = k.fiscalYearLabels;
  const first = ce[0];
  const last = ce[ce.length - 1];
  const seuil = k.seuilRentabilite[0];
  const funding = k.fundingPlan;
  const ratios = k.ratios;

  const besoin = funding.besoinDeFinancement;
  const heroBlock =
    besoin > 0
      ? hero(
          c,
          'Besoin de financement',
          money(besoin, c.currency),
          `Coût total du projet ${money(funding.coutTotalProjet, c.currency)}, dont ` +
            `${money(funding.totalFinancement, c.currency)} déjà mobilisés. Le solde est le ` +
            `montant sollicité, détaillé au chapitre 07.`
        )
      : hero(
          c,
          'Couverture du plan de financement',
          pct(funding.couverturePct),
          `Le coût total du projet, ${money(funding.coutTotalProjet, c.currency)}, est couvert ` +
            `par ${money(funding.totalFinancement, c.currency)} de ressources identifiées. ` +
            `Aucun financement complémentaire n'est sollicité.`
        );

  return page(
    c,
    'Synthèse',
    `
    ${sectionTitle(
      c,
      1,
      'Synthèse financière',
      `Prévisions établies sur ${ce.length} exercices, ${fiscalYearPeriod(finance.fiscalCalendar, 0)} ` +
        `pour le premier. ${jurisdiction.frameworkLabel} · ${jurisdiction.country}. ` +
        `Tous les montants sont exprimés en ${c.currency}.`
    )}

    ${heroBlock}

    ${grid([
      stat(c, `Chiffre d'affaires ${labels[0]}`, compact(first?.chiffreAffaires ?? 0, c.currency)),
      stat(c, `Résultat net ${labels[0]}`, compact(first?.resultatNet ?? 0, c.currency), `Marge nette ${pct(first?.chiffreAffaires ? (first.resultatNet / first.chiffreAffaires) * 100 : 0)}`),
      stat(c, 'Taux de marge sur coûts variables', pct(first?.tauxMargePct ?? 0)),
      stat(c, 'Coût total du projet', compact(funding.coutTotalProjet, c.currency), `Investissements + BFR de démarrage`),
      stat(c, 'Point mort', seuil ? `${num(seuil.pointMortJours)} jours` : '—', seuil ? `Seuil ${compact(seuil.seuilRentabilite, c.currency)}` : undefined),
      stat(c, `Résultat net ${labels[labels.length - 1]}`, compact(last?.resultatNet ?? 0, c.currency)),
    ])}

    ${groupedColumns(
      c,
      `Chiffre d'affaires et résultat net`,
      labels,
      [
        { name: "Chiffre d'affaires", data: ce.map((row) => row.chiffreAffaires) },
        { name: 'Résultat net', data: ce.map((row) => row.resultatNet) },
      ],
      ce.length > 1 && ce[0].chiffreAffaires > 0
        ? `Le résultat net représente ${pct((ce[0].resultatNet / ce[0].chiffreAffaires) * 100)} du ` +
          `chiffre d'affaires au premier exercice et ${pct(last.chiffreAffaires ? (last.resultatNet / last.chiffreAffaires) * 100 : 0)} au dernier.`
        : "Le chiffre d'affaires porte la trajectoire ; le résultat net en mesure la conversion.",
      (value) => compact(value, '')
    )}

    ${
      !ratios.significant
        ? warningBlock(
            c,
            'Indicateurs de rentabilité non significatifs',
            ratios.significanceNote ?? ''
          )
        : ''
    }
  `
  );
}

// =====================================================================
// 02 · MODÈLE DE REVENUS
// =====================================================================

export function revenueSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const years = labels.length;

  const priceRows = finance.products.map((product) => [
    esc(product.name),
    ...Array.from({ length: years }, (_, y) => num(product.prices?.[y] ?? 0)),
    num(product.unitCosts?.[0] ?? 0),
  ]);

  const volumeRows = finance.products.map((product) => {
    const objective = finance.salesObjectives.find((o) => o.productId === product.id);
    const monthly = objective?.monthlyQuantities ?? [];
    const perYear = Array.from({ length: years }, (_, y) =>
      monthly.slice(y * 12, y * 12 + 12).reduce((a, b) => a + (b || 0), 0)
    );
    return [esc(product.name), ...perYear.map((v) => num(v))];
  });

  const caRows = finance.products.map((product) => {
    const monthly = k.revenue.monthlyByProduct?.[product.id] ?? [];
    const perYear = Array.from({ length: years }, (_, y) =>
      monthly.slice(y * 12, y * 12 + 12).reduce((a, b) => a + (b || 0), 0)
    );
    return [esc(product.name), ...perYear.map((v) => num(v))];
  });
  caRows.push(['Total', ...k.revenue.yearlyTotal.map((v) => num(v))]);

  const empty = finance.products.length === 0;

  return page(
    c,
    'Modèle de revenus',
    `
    ${sectionTitle(
      c,
      2,
      'Modèle de revenus',
      "Prix unitaires, volumes et chiffre d'affaires par ligne de produit. Le chiffre " +
        "d'affaires n'est jamais saisi : il est le produit du prix par la quantité, mois par mois."
    )}

    ${
      empty
        ? `<p style="font-size:${c.ds.typeScale.sm}px;color:${c.inkMuted}">Aucun produit n'est renseigné dans le module Finance : les tableaux de revenus ne peuvent pas être établis.</p>`
        : `
      ${subTitle(c, 'Grille tarifaire', 0)}
      ${table(c, ['Produit', ...yearHeaders(labels), 'Coût unitaire'], priceRows)}
      ${caption(c, `Prix de vente unitaires hors taxes, en ${c.currency}, et coût d'achat unitaire du premier exercice.`)}

      ${subTitle(c, 'Objectifs de ventes, en quantité')}
      ${table(c, ['Produit', ...yearHeaders(labels)], volumeRows)}

      ${subTitle(c, "Chiffre d'affaires prévisionnel")}
      ${table(c, ['Produit', ...yearHeaders(labels)], caRows, { strongRows: [caRows.length - 1] })}
      ${caption(c, "Chiffre d'affaires d'un produit sur un mois = prix unitaire × quantité vendue. Le total annuel est la somme des douze mois de l'exercice.")}

      ${subTitle(c, 'Créances clients')}
      ${table(
        c,
        ['Poste', ...yearHeaders(labels)],
        [
          ["Chiffre d'affaires", ...k.revenue.yearlyTotal.map((v) => num(v))],
          [
            `Créances clients (${pct(finance.revenueParams.clientReceivablesRatePct, 0)} du CA)`,
            ...k.creancesClients.map((v) => num(v)),
          ],
        ],
        { strongRows: [1] }
      )}
      ${caption(c, 'Créances clients = chiffre d’affaires × taux de créances clients. Elles pèsent sur le besoin en fonds de roulement et sur la trésorerie.')}
    `
    }
  `
  );
}

// =====================================================================
// 03 · STRUCTURE DE COÛTS
// =====================================================================

export function costStructureSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const cs = k.costStructure;

  const variableRows = cs.variableByLine
    .filter((line) => line.yearly.some((v) => v !== 0))
    .map((line) => [esc(line.label || line.category), ...line.yearly.map((v) => num(v))]);
  variableRows.push(['Total charges variables', ...cs.totalVariable.map((v) => num(v))]);

  const fixedRows = cs.fixedByLine
    .filter((line) => line.yearly.some((v) => v !== 0))
    .map((line) => [esc(line.label || line.category), ...line.yearly.map((v) => num(v))]);
  const salaryRows = cs.salariesByLine
    .filter((line) => line.yearly.some((v) => v !== 0))
    .map((line) => [esc(line.position), ...line.yearly.map((v) => num(v))]);

  const socialRows = [
    ...salaryRows,
    ['Total rémunérations brutes', ...cs.totalSalaries.map((v) => num(v))],
    [
      `Charges sociales (${pct(finance.fixedCharges.socialChargesRatePct, 1)})`,
      ...cs.chargesSociales.map((v) => num(v)),
    ],
    [`Taxe sur les salaires (${pct(finance.fixedCharges.tusRatePct, 1)})`, ...cs.tus.map((v) => num(v))],
  ];

  const topCosts = [
    ...cs.variableByLine.map((l) => ({ label: l.label || l.category, value: l.yearly[0] || 0 })),
    ...cs.fixedByLine.map((l) => ({ label: l.label || l.category, value: l.yearly[0] || 0 })),
    { label: 'Rémunérations et charges', value: (cs.totalSalaries[0] || 0) + (cs.chargesSociales[0] || 0) + (cs.tus[0] || 0) },
  ]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return page(
    c,
    'Structure de coûts',
    `
    ${sectionTitle(
      c,
      3,
      'Structure de coûts',
      'Charges variables et charges fixes séparées : cette séparation est ce qui rend le seuil ' +
        'de rentabilité calculable, et elle seule.'
    )}

    ${subTitle(c, 'Charges variables', 0)}
    ${
      variableRows.length > 1
        ? table(c, ['Poste', ...yearHeaders(labels)], variableRows, {
            strongRows: [variableRows.length - 1],
          })
        : `<p style="font-size:${c.ds.typeScale.sm}px;color:${c.inkMuted}">Aucune charge variable renseignée.</p>`
    }

    ${subTitle(c, 'Charges fixes')}
    ${
      fixedRows.length > 0
        ? table(c, ['Poste', ...yearHeaders(labels)], fixedRows)
        : `<p style="font-size:${c.ds.typeScale.sm}px;color:${c.inkMuted}">Aucune charge fixe hors masse salariale.</p>`
    }

    ${subTitle(c, 'Masse salariale et charges assises sur les salaires')}
    ${table(c, ['Poste', ...yearHeaders(labels)], socialRows, {
      strongRows: [salaryRows.length],
    })}
    ${caption(c, 'Charges sociales = taux de charges sociales × rémunérations brutes. Le total des charges fixes du compte d’exploitation intègre les rémunérations et ces charges.')}

    ${subTitle(c, 'Total des charges fixes et dette fournisseur')}
    ${table(
      c,
      ['Poste', ...yearHeaders(labels)],
      [
        ['Total charges fixes', ...cs.totalFixed.map((v) => num(v))],
        ['dont charges externes (base de la valeur ajoutée)', ...cs.chargesExternes.map((v) => num(v))],
        [
          `Dette fournisseur (${pct(finance.variableCharges.supplierDebtRatePct, 0)} des charges variables)`,
          ...cs.detteFournisseur.map((v) => num(v)),
        ],
      ],
      { strongRows: [0] }
    )}

    ${
      topCosts.length
        ? horizontalBars(
            c,
            `Postes de charges les plus lourds · exercice ${labels[0]}`,
            topCosts,
            `Le premier poste représente ${pct(
              topCosts.reduce((a, b) => a + b.value, 0) > 0
                ? (topCosts[0].value / topCosts.reduce((a, b) => a + b.value, 0)) * 100
                : 0
            )} des charges listées : c'est sur lui que porte le premier effort de négociation.`,
            (value) => compact(value, '')
          )
        : ''
    }
  `
  );
}

// =====================================================================
// 04 · FISCALITÉ
// =====================================================================

export function taxesSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const t = k.taxes;
  const firstYear = t.rows[0];

  const bracketRows = (firstYear?.brackets ?? []).map((bracket) => [
    `De ${num(bracket.seuil)} à ${num(bracket.plafond)}`,
    pct(bracket.ratePct, 3),
    num(bracket.plafond - bracket.seuil),
    num(bracket.montant),
  ]);
  bracketRows.push(['Total patente', '', '', num(firstYear?.patente ?? 0)]);

  const summaryRows = t.rows.map((row) => [
    `Exercice ${row.label}`,
    num(row.chiffreAffaires),
    num(row.patente),
    num(row.taxeOccupation),
    num(row.tus),
    num(row.totalImpotsTaxes),
    num(row.impotSocietes),
  ]);

  const d = t.droitsEnregistrement;

  return page(
    c,
    'Fiscalité',
    `
    ${sectionTitle(
      c,
      4,
      'Fiscalité',
      "Patente au barème progressif, impôts et taxes d'exploitation, impôt sur les sociétés et " +
        "droits d'enregistrement. Chaque montant est reproductible à partir du barème publié ici."
    )}

    ${subTitle(c, `Patente · barème par tranche, exercice ${firstYear?.label ?? ''}`, 0)}
    ${
      bracketRows.length > 1
        ? table(c, ['Tranche de chiffre d’affaires', 'Taux', 'Assiette', 'Montant'], bracketRows, {
            strongRows: [bracketRows.length - 1],
          })
        : `<p style="font-size:${c.ds.typeScale.sm}px;color:${c.inkMuted}">Chiffre d’affaires nul : aucune patente due.</p>`
    }
    ${caption(c, "Patente d'une tranche = (plafond atteint − seuil de la tranche) × taux de la tranche. Le montant total est la somme des tranches franchies.")}

    ${subTitle(c, 'Impôts et taxes par exercice')}
    ${table(
      c,
      ['Exercice', "Chiffre d'affaires", 'Patente', 'Taxe d’occupation', 'Taxe sur salaires', 'Total impôts et taxes', 'Impôt sociétés'],
      summaryRows
    )}
    ${caption(c, `Impôt sur les sociétés au taux de ${pct(finance.taxesParams.isRatePct, 0)} du résultat avant impôts. Taxe d’occupation des locaux : catégorie « ${esc(finance.taxesParams.locationSize)} ».`)}

    ${subTitle(c, "Droits d'enregistrement et droits fonciers")}
    ${table(
      c,
      ['Poste', 'Taux', 'Montant'],
      [
        ["Droits d'enregistrement", pct(finance.taxesParams.droitsEnregistrementPct, 2), num(d.droitsEnregistrement)],
        ['Centimes additionnels', pct(finance.taxesParams.centimesAdditionnelsPct, 2), num(d.centimesAdditionnels)],
        ['Frais de publicité foncière', pct(finance.taxesParams.publiciteFonciereePct, 3), num(d.publiciteFonciere)],
        ['Travaux cadastraux', pct(finance.taxesParams.travauxCadastrauxPct, 3), num(d.travauxCadastraux)],
        ['Total', '', num(d.total)],
      ],
      { aligns: ['l', 'r', 'r'], strongRows: [4] }
    )}
    ${caption(c, `Droit = taux × base imposable. Base retenue : ${money(d.base, c.currency)} — capital social apporté et immobilisations foncières inscrites au plan d'investissement.`)}
  `
  );
}

// =====================================================================
// 05 · INVESTISSEMENTS & AMORTISSEMENTS
// =====================================================================

const GROUP_LABEL: Record<string, string> = {
  incorporelles: 'Immobilisations incorporelles',
  batiments: 'Bâtiments et infrastructures',
  mobilier: 'Mobilier',
  materielOutillage: 'Matériel et outillage',
  financieres: 'Immobilisations financières',
};

export function investmentsSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const pc = k.projectCost;

  const capexRows = pc.rows
    .filter((row) => row.montant !== 0)
    .map((row) => [
      esc(row.label || row.category),
      GROUP_LABEL[row.amortGroup] ?? row.amortGroup,
      row.moisEngagement ? `Mois ${row.moisEngagement}` : 'Étalé',
      row.dureeAmortissement ? `${row.dureeAmortissement} ans` : 'Non amortissable',
      num(row.montant),
    ]);
  capexRows.push(['Total des investissements', '', '', '', num(pc.totalInvestissements)]);

  const amortRows = k.amortization.rows
    .filter((row) => row.base > 0)
    .map((row) => [
      GROUP_LABEL[row.category] ?? row.category,
      pct(row.ratePct, 0),
      num(row.base),
      ...row.annualDotations.map((v) => num(v)),
      num(row.vna[row.vna.length - 1] ?? 0),
    ]);
  amortRows.push([
    'Total des dotations',
    '',
    num(pc.totalInvestissements),
    ...k.amortization.totalAnnualDotations.map((v) => num(v)),
    '',
  ]);

  return page(
    c,
    'Investissements',
    `
    ${sectionTitle(
      c,
      5,
      'Investissements et amortissements',
      "Le tableau des immobilisations : ce que l'entreprise achète pour produire, quand elle " +
        "l'achète, et sur combien d'exercices la dépense est étalée."
    )}

    ${
      pc.rows.length === 0
        ? warningBlock(
            c,
            'Aucun investissement renseigné',
            "Le tableau des investissements est vide. Le coût du projet se réduit alors au besoin " +
              "en fonds de roulement, et les indicateurs de rentabilité (VAN, TRI, délai de " +
              'récupération) perdent leur sens : ils rapportent des bénéfices à une mise de fonds nulle.'
          )
        : `
      ${subTitle(c, 'Tableau des investissements', 0)}
      ${table(c, ['Immobilisation', 'Nature', 'Engagement', 'Durée', 'Montant'], capexRows, {
        aligns: ['l', 'l', 'l', 'l', 'r'],
        strongRows: [capexRows.length - 1],
      })}

      ${grid(
        [
          stat(c, 'Incorporelles', compact(pc.immobilisationsIncorporelles, c.currency)),
          stat(c, 'Corporelles', compact(pc.immobilisationsCorporelles, c.currency)),
          stat(c, 'Financières', compact(pc.immobilisationsFinancieres, c.currency)),
        ],
        3
      )}

      ${subTitle(c, 'Tableau des amortissements')}
      ${table(
        c,
        ['Catégorie', 'Taux', "Base d'amortissement", ...labels.map((l) => `Dotation ${l}`), 'VNC finale'],
        amortRows,
        { aligns: ['l', 'r', 'r', ...labels.map(() => 'r' as const), 'r'], strongRows: [amortRows.length - 1] }
      )}
      ${caption(c, "Taux d'amortissement = 1 / durée d'amortissement. Dotation annuelle = base × taux. Valeur nette comptable = base − cumul des amortissements.")}
    `
    }
  `
  );
}

// =====================================================================
// 06 · BESOIN EN FONDS DE ROULEMENT
// =====================================================================

export function bfrSection(
  c: ReportChrome,
  finance: FinanceModel,
  jurisdiction: AccountingJurisdiction
): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const pc = k.projectCost;
  const startMonth = MONTH_NAMES[Math.min(11, Math.max(0, (finance.fiscalCalendar?.activityStartMonth ?? 1) - 1))];
  const activeMonths = firstYearActiveMonths(finance.fiscalCalendar);

  return page(
    c,
    'Fonds de roulement',
    `
    ${sectionTitle(
      c,
      6,
      'Besoin en fonds de roulement',
      "Ce qu'il faut avancer avant que le premier client paie : le stock d'ouverture et les " +
        'charges des premiers mois de fonctionnement.'
    )}

    ${table(
      c,
      ['Composante', 'Montant'],
      [
        ['Stock initial — marchandises et matières premières', num(pc.stockInitial)],
        [`Frais de premier fonctionnement (${INITIAL_OPERATING_MONTHS} mois de charges d'exploitation)`, num(pc.fraisPremierFonctionnement)],
        ['Fonds de roulement de démarrage', num(pc.besoinFondsRoulement)],
      ],
      { strongRows: [2] }
    )}
    ${caption(c, 'Fonds de roulement = stock initial (marchandises + matières premières) + frais de premier fonctionnement.')}

    ${subTitle(c, "Besoin en fonds de roulement d'exploitation")}
    ${table(
      c,
      ['Poste', ...yearHeaders(labels)],
      [
        ['Créances clients', ...k.bilan.map((row) => num(row.creancesClients))],
        ['Stocks', ...k.bilan.map((row) => num(row.stocks))],
        ['Dettes fournisseurs', ...k.bilan.map((row) => num(-row.dettesFournisseurs))],
        ['BFR à la clôture', ...k.bilan.map((row) => num(row.bfr))],
        ['Variation du BFR', ...k.bfr.variationAnnuelle.map((v) => num(v))],
      ],
      { strongRows: [3] }
    )}
    ${caption(c, "Le BFR d'exploitation mesure le décalage permanent entre encaissements et décaissements une fois l'activité lancée. Sa variation annuelle est un décaissement au tableau de flux.")}

    ${assumption(
      c,
      `Les frais de premier fonctionnement retiennent ${INITIAL_OPERATING_MONTHS} mois de charges ` +
        `d'exploitation à compter du démarrage — charges sociales comprises, achats stockés exclus ` +
        `puisqu'ils figurent déjà au stock initial — auxquels s'ajoutent les charges de structure ` +
        `courant avant l'ouverture.`,
      `Activité démarrée en ${startMonth}, soit ${activeMonths} mois d'exploitation sur le premier ` +
        `exercice comptable ${labels[0]}, ${fiscalYearPeriod(finance.fiscalCalendar, 0)}.`
    )}
  `
  );
}

// =====================================================================
// 07 · COÛT DU PROJET, FINANCEMENT ET DEMANDE
// =====================================================================

export function fundingSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const pc = k.projectCost;
  const fp = k.fundingPlan;
  const besoin = fp.besoinDeFinancement;

  const sourceRows = fp.sources
    .filter((source) => source.amount > 0)
    .map((source) => [
      esc(source.label),
      source.nature === 'equity' ? 'Fonds propres' : 'Endettement',
      source.ratePct !== undefined && source.ratePct > 0 ? pct(source.ratePct, 2) : '—',
      source.durationLabel ?? '—',
      num(source.amount),
      pct(source.sharePct),
    ]);
  sourceRows.push(['Total des ressources mobilisées', '', '', '', num(fp.totalFinancement), pct(100)]);

  const affectationRows = fp.affectation.map((entry) => [
    esc(entry.label),
    num(entry.montant),
    pct(entry.sharePct),
  ]);
  affectationRows.push(['Coût total du projet', num(pc.coutTotalProjet), pct(100)]);

  const loans: [string, typeof k.financing.cmtSchedule][] = [
    ['Emprunt bancaire (CMT)', k.financing.cmtSchedule],
    ['Crédit-bail', k.financing.creditBailSchedule],
    ['Compte courant d’associés', k.financing.compteCourantSchedule],
  ];

  // Les échéanciers sont mensuels ; on les présente PAR EXERCICE. Aligner
  // soixante mensualités dans un dossier de financement noie la seule
  // information utile — ce que chaque exercice coûte en trésorerie.
  const loanTables = loans
    .filter(([, schedule]) => schedule.annuites.some((v) => v > 0))
    .map(([label, schedule]) => {
      const yearCount = Math.ceil(schedule.annuites.length / 12);
      const rows = Array.from({ length: yearCount }, (_, y) => {
        const slice = <T,>(series: T[]) => series.slice(y * 12, y * 12 + 12);
        const sumOf = (series: number[]) => slice(series).reduce((a, b) => a + (b || 0), 0);
        return [
          `Année ${y + 1}`,
          num(schedule.capitalDu[y * 12] ?? 0),
          num(sumOf(schedule.interets)),
          num(sumOf(schedule.amortissements)),
          num(sumOf(schedule.annuites)),
        ];
      });
      return `${subTitle(c, `Échéancier · ${label}`)}
        ${table(c, ['Exercice de remboursement', 'Capital dû à l’ouverture', 'Intérêts', 'Amortissement du capital', 'Annuité'], rows)}
        ${caption(c, `Remboursement mensuel. Intérêt d'une période = capital dû en début de période × taux mensuel. Annuité = amortissement du capital + intérêt. Total des intérêts sur la durée : ${money(schedule.totalInterets, c.currency)}.`)}`;
    })
    .join('');

  return page(
    c,
    'Plan de financement',
    `
    ${sectionTitle(
      c,
      7,
      'Coût du projet, plan de financement et demande',
      "Le coût total du projet, les ressources déjà réunies, et le solde à financer. C'est le " +
        'chapitre que lit un analyste crédit avant tous les autres.'
    )}

    ${
      besoin > 0
        ? hero(
            c,
            'Montant sollicité',
            money(besoin, c.currency),
            `Différence entre le coût total du projet (${money(pc.coutTotalProjet, c.currency)}) et ` +
              `les ressources déjà mobilisées (${money(fp.totalFinancement, c.currency)}). ` +
              `Le plan est couvert à ${pct(fp.couverturePct)}.`
          )
        : hero(
            c,
            'Solde du plan de financement',
            money(Math.abs(besoin), c.currency) + (besoin < 0 ? ' d’excédent' : ''),
            besoin < 0
              ? `Les ressources mobilisées dépassent le coût du projet : cet excédent constitue une ` +
                `marge de trésorerie de démarrage, non un besoin.`
              : `Le plan de financement équilibre exactement le coût du projet. Aucun concours ` +
                `extérieur n'est sollicité.`
          )
    }

    ${subTitle(c, 'Coût total du projet', 0)}
    ${table(c, ['Emploi', 'Montant', 'Part'], affectationRows, {
      aligns: ['l', 'r', 'r'],
      strongRows: [affectationRows.length - 1],
    })}
    ${caption(c, 'Coût total du projet = total des investissements (incorporels, corporels, financiers) + besoin en fonds de roulement de démarrage.')}

    ${subTitle(c, 'Ressources mobilisées')}
    ${
      sourceRows.length > 1
        ? table(c, ['Ressource', 'Nature', 'Taux', 'Durée', 'Montant', 'Part'], sourceRows, {
            aligns: ['l', 'l', 'r', 'l', 'r', 'r'],
            strongRows: [sourceRows.length - 1],
          })
        : `<p style="font-size:${c.ds.typeScale.sm}px;color:${c.inkMuted}">Aucune ressource de financement n'est renseignée : la totalité du coût du projet reste à financer.</p>`
    }

    ${grid(
      [
        stat(c, 'Fonds propres', compact(fp.totalEquity, c.currency)),
        stat(c, 'Endettement', compact(fp.totalDebt, c.currency)),
        stat(c, "Taux d'endettement", pct(fp.tauxEndettementPct), 'Dettes / (dettes + fonds propres)'),
      ],
      3
    )}

    ${loanTables}
  `
  );
}

// =====================================================================
// 08 · COMPTE D'EXPLOITATION
// =====================================================================

export function exploitationSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const ce = k.compteExploitation;

  const line = (label: string, values: number[], suffix = ''): string[] => [
    label,
    ...values.map((v) => (suffix === '%' ? pct(v) : num(v))),
  ];

  const rows = [
    line("Chiffre d'affaires", ce.map((r) => r.chiffreAffaires)),
    line('Charges variables', ce.map((r) => -r.chargesVariables)),
    line('Marge sur coûts variables', ce.map((r) => r.margeBrute)),
    line('Taux de marge sur coûts variables', ce.map((r) => r.tauxMargePct), '%'),
    line('Charges externes', k.costStructure.chargesExternes.map((v) => -v)),
    line('Valeur ajoutée', ce.map((r) => r.valeurAjoutee)),
    line('Rémunérations', ce.map((r) => -r.remunerations)),
    line('Impôts et taxes', ce.map((r) => -r.impotsTaxes)),
    line("Excédent brut d'exploitation", ce.map((r) => r.ebe)),
    line('Dotations aux amortissements', ce.map((r) => -r.dotationsAmortissements)),
    line("Résultat d'exploitation", ce.map((r) => r.resultatExploitation)),
    line('Produits financiers', k.cashFlowOec.map((r) => r.produitsFinanciers)),
    line('Charges financières', ce.map((r) => -r.chargesFinancieres)),
    line('Résultat financier', ce.map((r, y) => (k.cashFlowOec[y]?.produitsFinanciers ?? 0) - r.chargesFinancieres)),
    line('Résultat avant impôts', ce.map((r) => r.resultatAvantImpot)),
    line(`Impôt sur les sociétés (${pct(finance.taxesParams.isRatePct, 0)})`, ce.map((r) => -r.is)),
    line('Résultat net', ce.map((r) => r.resultatNet)),
  ];

  return page(
    c,
    'Compte d’exploitation',
    `
    ${sectionTitle(
      c,
      8,
      "Compte d'exploitation prévisionnel",
      'La cascade des soldes intermédiaires de gestion, du chiffre d’affaires au résultat net. ' +
        'Chaque solde se déduit du précédent : le calcul est refaisable ligne à ligne.'
    )}

    ${table(c, ['Solde intermédiaire de gestion', ...yearHeaders(labels)], rows, {
      strongRows: [2, 5, 8, 10, 13, 14, 16],
      firstColumnMm: 62,
    })}
    ${caption(c, "Marge = CA − charges variables. Valeur ajoutée = marge − charges externes. EBE = VA − rémunérations − impôts et taxes. Résultat d'exploitation = EBE − dotations. Résultat financier = produits financiers − charges financières. Résultat avant impôts = résultat d'exploitation + résultat financier. Résultat net = résultat avant impôts − impôt.")}

    ${groupedColumns(
      c,
      'Excédent brut d’exploitation et résultat net',
      labels,
      [
        { name: "Excédent brut d'exploitation", data: ce.map((r) => r.ebe) },
        { name: 'Résultat net', data: ce.map((r) => r.resultatNet) },
      ],
      "L'écart entre les deux séries mesure ce que les amortissements, les frais financiers et l'impôt prélèvent sur l'exploitation.",
      (value) => compact(value, '')
    )}
  `
  );
}

// =====================================================================
// 09 · BILAN
// =====================================================================

export function bilanSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const bilan = k.bilan;

  const actif = [
    ['Immobilisations brutes', ...bilan.map((r) => num(r.immobilisationsBrutes))],
    ['Amortissements cumulés', ...bilan.map((r) => num(-r.amortissementsCumules))],
    ['Valeur nette comptable', ...bilan.map((r) => num(r.vnc))],
    ['Stocks', ...bilan.map((r) => num(r.stocks))],
    ['Créances clients', ...bilan.map((r) => num(r.creancesClients))],
    ['Trésorerie', ...bilan.map((r) => num(r.tresorerie))],
    ['Total actif', ...bilan.map((r) => num(r.totalActif))],
  ];

  const passif = [
    ['Capital social', ...bilan.map((r) => num(r.capitalSocial))],
    ['Report à nouveau', ...bilan.map((r) => num(r.reportANouveau))],
    ["Résultat de l'exercice", ...bilan.map((r) => num(r.resultatExercice))],
    ['Compte courant d’associés', ...bilan.map((r) => num(r.compteCourantAssocies))],
    ['Fonds propres', ...bilan.map((r) => num(r.fondsPropres))],
    ['Emprunts', ...bilan.map((r) => num(r.emprunts))],
    ['Dettes fournisseurs', ...bilan.map((r) => num(r.dettesFournisseurs))],
    ['Dettes fiscales et sociales', ...bilan.map((r) => num(r.dettesFiscalesSociales))],
    ['Total dettes', ...bilan.map((r) => num(r.totalDettes))],
    ['Total passif', ...bilan.map((r) => num(r.totalPassif))],
  ];

  const negativeCash = bilan.some((row) => row.tresorerie < 0);

  return page(
    c,
    'Bilan',
    `
    ${sectionTitle(
      c,
      9,
      'Bilan prévisionnel',
      "Position patrimoniale à la clôture de chaque exercice. La trésorerie est la variable " +
        "d'équilibrage : elle se déduit du passif diminué des autres postes d'actif."
    )}

    ${subTitle(c, 'Actif', 0)}
    ${table(c, ['Poste', ...yearHeaders(labels)], actif, { strongRows: [2, 6] })}

    ${subTitle(c, 'Passif')}
    ${table(c, ['Poste', ...yearHeaders(labels)], passif, { strongRows: [4, 8, 9] })}
    ${caption(c, "Trésorerie = total passif − valeur nette comptable − créances clients − stocks. Report à nouveau = cumul des résultats des exercices antérieurs, net des dividendes distribués.")}

    ${
      negativeCash
        ? warningBlock(
            c,
            'Trésorerie négative à la clôture',
            "Au moins un exercice se clôt sur une trésorerie négative : le plan suppose alors un " +
              'découvert ou un apport complémentaire non inscrit au plan de financement. ' +
              'Ce point doit être arbitré avant présentation à un prêteur.'
          )
        : ''
    }
  `
  );
}

// =====================================================================
// 10 · FLUX DE TRÉSORERIE
// =====================================================================

export function cashflowSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const oec = k.cashFlowOec;
  const labels = k.fiscalYearLabels;

  const rows = [
    ["Résultat d'exploitation", ...oec.map((r) => num(r.resultatExploitation))],
    ['Dotations aux amortissements', ...oec.map((r) => num(r.dotationsAmortissements))],
    ["Résultat brut d'exploitation", ...oec.map((r) => num(r.resultatBrutExploitation))],
    ['Variation des stocks', ...oec.map((r) => num(-r.variationStocks))],
    ["Variation des créances d'exploitation", ...oec.map((r) => num(-r.variationCreances))],
    ["Variation des dettes d'exploitation", ...oec.map((r) => num(r.variationDettesExploitation))],
    ["Flux net de trésorerie d'exploitation", ...oec.map((r) => num(r.fluxNetExploitation))],
    ['Frais financiers', ...oec.map((r) => num(-r.fraisFinanciers))],
    ['Impôt sur les sociétés', ...oec.map((r) => num(-r.impotSocietes))],
    ["A · Flux généré par l'activité", ...oec.map((r) => num(r.fluxActivite))],
    ["Acquisitions d'immobilisations", ...oec.map((r) => num(-r.acquisitionsImmobilisations))],
    ["B · Flux lié à l'investissement", ...oec.map((r) => num(r.fluxInvestissement))],
    ['Augmentation de capital', ...oec.map((r) => num(r.augmentationCapital))],
    ["Émissions d'emprunts", ...oec.map((r) => num(r.emissionsEmprunts))],
    ["Remboursements d'emprunts", ...oec.map((r) => num(-r.remboursementsEmprunts))],
    ['Dividendes versés', ...oec.map((r) => num(-r.dividendesVerses))],
    ['Subventions reçues', ...oec.map((r) => num(r.subventions))],
    ['C · Flux lié au financement', ...oec.map((r) => num(r.fluxFinancement))],
    ['Variation de trésorerie (A + B + C)', ...oec.map((r) => num(r.variationTresorerie))],
    ["Trésorerie d'ouverture", ...oec.map((r) => num(r.tresorerieOuverture))],
    ['Trésorerie de clôture', ...oec.map((r) => num(r.tresorerieCloture))],
  ];

  const lowest = Math.min(...oec.map((r) => r.tresorerieCloture));

  return page(
    c,
    'Trésorerie',
    `
    ${sectionTitle(
      c,
      10,
      'Tableau des flux de trésorerie',
      'Méthode O.E.C. : le flux généré par l’activité, le flux d’investissement et le flux de ' +
        'financement, puis la variation qui en résulte.'
    )}

    ${table(c, ['Poste', ...yearHeaders(labels)], rows, {
      strongRows: [2, 6, 9, 11, 17, 18, 20],
      firstColumnMm: 62,
    })}

    ${zeroAnchoredBars(
      c,
      'Trésorerie de clôture par exercice',
      oec.map((row) => ({ label: row.label, value: row.tresorerieCloture })),
      lowest < 0
        ? `Le point bas s'établit à ${money(lowest, c.currency)} : c'est un DÉFICIT de trésorerie, ` +
          `et il dicte le montant à réunir avant démarrage.`
        : `La trésorerie reste positive sur tout l'horizon, au plus bas à ${money(lowest, c.currency)}.`,
      (value) => compact(value, '')
    )}
  `
  );
}

// =====================================================================
// 11 · SEUIL DE RENTABILITÉ
// =====================================================================

export function breakEvenSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const rows = k.seuilRentabilite.map((row, y) => [
    `Exercice ${labels[y] ?? row.year}`,
    num(row.chargesFixes),
    pct(row.tauxMargeCoutsVariablesPct),
    num(row.seuilRentabilite),
    num(row.caJournalier),
    `${num(row.pointMortJours)} j`,
    pct(row.partSeuilDansCAPct),
  ]);
  const first = k.seuilRentabilite[0];

  return page(
    c,
    'Seuil de rentabilité',
    `
    ${sectionTitle(
      c,
      11,
      'Seuil de rentabilité et point mort',
      "Le chiffre d'affaires à partir duquel les charges fixes sont couvertes, et la date à " +
        "laquelle il est atteint dans l'exercice."
    )}

    ${grid(
      [
        stat(c, 'Seuil de rentabilité', first ? compact(first.seuilRentabilite, c.currency) : '—'),
        stat(c, 'Point mort', first ? `${num(first.pointMortJours)} jours` : '—', 'Sur une base de 360 jours'),
        stat(c, 'Part du seuil dans le CA', first ? pct(first.partSeuilDansCAPct) : '—'),
      ],
      3
    )}

    ${table(
      c,
      ['Exercice', 'Charges fixes', 'Taux de marge sur CV', 'Seuil de rentabilité', 'CA journalier', 'Point mort', 'Part du CA'],
      rows
    )}
    ${caption(c, 'Seuil de rentabilité = charges fixes totales / taux de marge sur coûts variables. Point mort (en jours) = seuil / chiffre d’affaires journalier, le CA journalier étant le CA annuel divisé par 360.')}
  `
  );
}

// =====================================================================
// 12 · INDICATEURS DE RENTABILITÉ ET VALORISATION
// =====================================================================

export function ratiosSection(c: ReportChrome, finance: FinanceModel): string {
  const k = finance.computed as FinanceComputed;
  const r = k.ratios;

  const flowRows = r.fluxActualisesDetail.map((row) => [
    row.year === 0 ? 'Année 0 · investissement' : `Exercice ${row.label}`,
    num(row.flux),
    num(row.facteurActualisation, 4),
    num(row.fluxActualise),
    num(row.cumulFlux),
    num(row.cumulFluxActualise),
  ]);

  const shareRows = r.valeurAction.map((row) => [
    `Exercice ${row.label}`,
    num(row.fondsPropres),
    num(row.valeurAction),
    row.croissanceActionPct === null ? '—' : pct(row.croissanceActionPct),
    num(row.dividendesADistribuer),
    num(row.dividendeParAction),
  ]);

  const cmpc = r.cmpc;

  return page(
    c,
    'Rentabilité',
    `
    ${sectionTitle(
      c,
      12,
      'Indicateurs de rentabilité et valorisation',
      "Valeur actuelle nette, taux de rentabilité interne, délai de récupération et valorisation " +
        "par actualisation des flux. L'année 0 porte l'investissement initial : sans elle, ces " +
        'indicateurs ne mesurent rien.'
    )}

    ${
      r.significant
        ? ''
        : warningBlock(c, 'Indicateurs non significatifs', r.significanceNote ?? '')
    }

    ${grid(
      [
        stat(c, 'Valeur actuelle nette', compact(r.van, c.currency), `Taux d'actualisation ${pct(finance.ratiosParams.vanDiscountRatePct, 0)}`),
        stat(c, 'Taux de rentabilité interne', r.significant ? pct(r.tri) : 'n. s.'),
        stat(
          c,
          'Délai de récupération',
          !r.significant
            ? 'n. s.'
            : r.drciAtteintAnnee === null
              ? 'Non atteint'
              : `${num(r.drci, 2)} ans`,
          r.drciAtteintAnnee === null && r.significant
            ? `L'investissement n'est pas récupéré sur les ${r.fluxActualisesDetail.length - 1} exercices projetés`
            : undefined
        ),
        stat(c, 'Indice de profitabilité', r.significant ? num(r.indiceProfitabilite, 2) : 'n. s.', 'Valeur actuelle des flux / investissement initial'),
        stat(c, 'VAN / investissement initial', r.significant ? num(r.indiceProfitabiliteVanSurI0, 2) : 'n. s.'),
        stat(c, 'Investissement initial', compact(r.investissementInitial, c.currency), 'Année 0 du tableau ci-dessous'),
      ],
      3
    )}

    ${subTitle(c, "Tableau d'actualisation des flux")}
    ${table(
      c,
      ['Période', 'Flux de trésorerie', "Facteur d'actualisation", 'Flux actualisé', 'Cumul des flux', 'Cumul actualisé'],
      flowRows,
      { strongRows: [0] }
    )}
    ${caption(c, `Facteur d'actualisation (année n) = (1 + taux)^(−n). VAN = − investissement initial + Σ flux actualisés. Le délai de récupération est l'exercice où le cumul des flux devient positif${r.drciAtteintAnnee ? ` : exercice ${r.drciAtteintAnnee}` : " : il n'est pas atteint sur l'horizon étudié"}.`)}

    ${subTitle(c, "Coût moyen pondéré du capital et valorisation")}
    ${table(
      c,
      ['Élément', 'Valeur'],
      [
        ['Coût des fonds propres', pct(cmpc.costOfEquityPct)],
        ['Coût de la dette', pct(cmpc.costOfDebtPct)],
        ['Poids des fonds propres', pct(cmpc.equityWeightPct)],
        ['Poids de la dette', pct(cmpc.debtWeightPct)],
        [`Coût moyen pondéré du capital (${cmpc.source})`, pct(cmpc.valuePct)],
        ['Flux normatif de trésorerie', num(r.dcf.fluxNormatif)],
        ['Valeur terminale actualisée', num(r.dcf.valeurTerminale)],
        ["Valeur de l'entreprise", num(r.dcf.valeurTotaleEntreprise)],
      ],
      { aligns: ['l', 'r'], strongRows: [4, 7] }
    )}
    ${caption(c, "CMPC = coût des fonds propres × FP/(FP+D) + coût de la dette × (1 − taux d'IS) × D/(FP+D). Valeur terminale = flux normatif × (1 + croissance à l'infini) / (CMPC − croissance à l'infini). Valeur de l'entreprise = somme des flux actualisés + valeur terminale actualisée.")}
    ${
      // La valeur terminale prolonge le DERNIER flux à l'infini. Quand elle
      // porte l'essentiel de la valorisation, celle-ci ne dit plus rien de
      // l'horizon étudié — et le lecteur doit l'apprendre ici, pas le déduire.
      r.dcf.valeurTotaleEntreprise > 0 &&
      r.dcf.valeurTerminale / r.dcf.valeurTotaleEntreprise > 0.6
        ? caption(
            c,
            `La valeur terminale représente ${pct((r.dcf.valeurTerminale / r.dcf.valeurTotaleEntreprise) * 100)} de la valorisation : ` +
              `celle-ci repose donc sur la perpétuation du dernier flux projeté, non sur les exercices étudiés` +
              (r.van < 0
                ? `, alors même que la valeur actuelle nette du projet est négative sur cet horizon. Les deux chiffres ne se contredisent pas — ils ne portent pas sur la même période — mais seul le second est établi.`
                : '.')
          )
        : ''
    }

    ${subTitle(c, "Valorisation de la part sociale")}
    ${table(
      c,
      ['Exercice', 'Fonds propres', "Valeur d'une part", 'Croissance', 'Dividendes à distribuer', 'Dividende par part'],
      shareRows
    )}
    ${caption(c, `Sur la base de ${num(finance.ratiosParams.numberOfShares ?? 100)} parts sociales et d'un taux de distribution de ${pct(finance.ratiosParams.dividendDistributionRatePct, 0)} du résultat net.`)}
  `
  );
}

// =====================================================================
// 13 · ANALYSE
// =====================================================================

export function analysisSection(c: ReportChrome, paragraphs: string[]): string {
  const { ds } = c;
  const body = paragraphs.length
    ? paragraphs
        .map(
          (paragraph) =>
            `<p style="margin:0 0 4mm;font-size:${ds.typeScale.sm}px;line-height:1.7;color:${c.ink};max-width:150mm">${esc(paragraph)}</p>`
        )
        .join('')
    : `<p style="font-size:${ds.typeScale.sm}px;color:${c.inkMuted}">L'analyse rédigée n'a pas pu être produite pour ce rapport. Les états qui précèdent restent complets.</p>`;

  return page(
    c,
    'Analyse',
    `${sectionTitle(c, 13, 'Analyse et points de vigilance', "Lecture des états qui précèdent : ce qui tient, ce qui reste à sécuriser, et dans quel ordre.")}${body}`
  );
}

// =====================================================================
// 14 · MÉTHODE ET HYPOTHÈSES
// =====================================================================

export function methodSection(
  c: ReportChrome,
  finance: FinanceModel,
  jurisdiction: AccountingJurisdiction
): string {
  const k = finance.computed as FinanceComputed;
  const labels = k.fiscalYearLabels;
  const startMonth = MONTH_NAMES[Math.min(11, Math.max(0, (finance.fiscalCalendar?.activityStartMonth ?? 1) - 1))];
  const activeMonths = firstYearActiveMonths(finance.fiscalCalendar);

  return page(
    c,
    'Méthode',
    `
    ${sectionTitle(
      c,
      14,
      'Méthode, hypothèses et conventions',
      "Ce que le modèle suppose. Un plan dont les hypothèses sont visibles se discute ; un plan " +
        'qui les cache se refuse.'
    )}

    ${subTitle(c, 'Calendrier comptable', 0)}
    ${table(
      c,
      ['Convention', 'Valeur retenue'],
      [
        ['Juridiction retenue', jurisdiction.country],
        ['Référentiel comptable', jurisdiction.frameworkLabel],
        ['Base réglementaire', jurisdiction.fiscalYearBasis],
        ['Durée de l’exercice', fiscalYearPeriod(finance.fiscalCalendar, 0)],
        ['Premier exercice', `Exercice ${labels[0]}`],
        ['Démarrage effectif de l’activité', `${startMonth}`],
        ['Mois d’exploitation au premier exercice', `${activeMonths} mois sur 12`],
        ['Horizon de projection', `${labels.length} exercices (${labels[0]} — ${labels[labels.length - 1]})`],
        ['Devise', c.currency],
      ],
      { aligns: ['l', 'l'] }
    )}
    ${caption(c, fiscalYearStatement(jurisdiction, finance.fiscalCalendar?.fiscalYearEndMonth ?? 12))}
    ${
      activeMonths < 12
        ? caption(c, `Le premier exercice ne porte que ${activeMonths} mois d'exploitation : c'est un exercice tronqué, et ses agrégats ne sont pas comparables à ceux d'une année pleine.`)
        : ''
    }
    ${
      jurisdiction.defaultCorporateTaxRatePct !== undefined && jurisdiction.taxAsOf
        ? caption(c, `Le taux d'impôt sur les sociétés proposé par défaut (${pct(jurisdiction.defaultCorporateTaxRatePct, 0)}) reflète le régime de droit commun de ${jurisdiction.country} à ${jurisdiction.taxAsOf}. Il est indicatif : un régime sectoriel, une zone franche ou une loi de finances récente peuvent le modifier, et il doit être confirmé.`)
        : ''
    }

    ${
      jurisdiction.framework === 'unknown'
        ? warningBlock(
            c,
            'Juridiction comptable non déterminée',
            "Le pays du projet n'est pas renseigné ou n'est pas couvert par le référentiel interne. " +
              "Le rapport applique par défaut un exercice calé sur l'année civile, sans garantie de " +
              'conformité locale. Renseignez le pays du projet pour que le référentiel applicable et ' +
              "la règle d'exercice soient établis.",
          )
        : ''
    }

    ${subTitle(c, 'Paramètres du modèle')}
    ${table(
      c,
      ['Paramètre', 'Valeur'],
      [
        ['Taux de créances clients', pct(finance.revenueParams.clientReceivablesRatePct, 0)],
        ['Taux de dette fournisseur', pct(finance.variableCharges.supplierDebtRatePct, 0)],
        ['Stock de sécurité', pct(finance.variableCharges.safetyStockRatePct, 0)],
        ['Charges sociales', pct(finance.fixedCharges.socialChargesRatePct, 1)],
        ['Taxe unique sur les salaires', pct(finance.fixedCharges.tusRatePct, 1)],
        ['Impôt sur les sociétés', pct(finance.taxesParams.isRatePct, 0)],
        ["Taux d'actualisation (VAN)", pct(finance.ratiosParams.vanDiscountRatePct, 0)],
        ['Coût moyen pondéré du capital', `${pct(k.ratios.cmpc.valuePct)} (${k.ratios.cmpc.source})`],
        ["Croissance à l'infini", pct(finance.ratiosParams.perpetualGrowthRatePct, 0)],
        ['Taux de distribution des dividendes', pct(finance.ratiosParams.dividendDistributionRatePct, 0)],
        ['Nombre de parts sociales', num(finance.ratiosParams.numberOfShares ?? 100)],
      ],
      { aligns: ['l', 'r'] }
    )}

    ${assumption(
      c,
      `Le besoin en fonds de roulement de démarrage retient ${INITIAL_OPERATING_MONTHS} mois de ` +
        `charges d'exploitation et le stock d'ouverture correspondant.`,
      "À défaut, un fonds de roulement calculé sur un seul mois sous-estime le coût du projet et " +
        'fait disparaître le besoin de financement du dossier.'
    )}

    ${assumption(
      c,
      "La patente est calculée au barème progressif par tranche, et non par application d'un taux unique au chiffre d'affaires.",
      'Le détail par tranche figure au chapitre 04 et permet de refaire le calcul.'
    )}

    ${assumption(
      c,
      "La trésorerie du bilan est la variable d'équilibrage ; le tableau de flux et le bilan sont issus du même calcul.",
      "Deux tableaux produits par deux chemins différents finissent toujours par diverger ; le rapport n'en publie qu'un."
    )}
  `
  );
}
