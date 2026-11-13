/**
 * Les pages du rapport financier composées par le MOTEUR GRAPHIQUE (@idem/graphic-engine) — la couverture
 * et la synthèse, exactement la même logique que le business plan (squelette, habillage et gabarit choisis
 * par le catalogue, selon la direction artistique réelle de la marque).
 *
 * ── CE QUI RESTE HORS DE CE FICHIER, ET POURQUOI ────────────────────────────
 *
 * Les chapitres chiffrés (modèle de revenus, structure de coûts, fiscalité, compte d'exploitation, bilan,
 * trésorerie, ratios…) restent sur `finance-report.sections.ts` / `finance-report.template.ts` : ce sont des
 * tableaux et des barèmes réglementaires (SYSCOHADA, fiscalité par juridiction), déjà conformes et mesurés
 * (contraste, double nuance de teinte plutôt que couleur d'état). Les reconstruire en blocs génériques
 * table/chart n'apporterait aucune variété utile — un tableau de compte d'exploitation se lit toujours pareil
 * — et ferait courir un risque de régression sur une conformité déjà acquise. Seules la couverture et la page
 * de synthèse, qui sont des pages de PRÉSENTATION plutôt que des états réglementaires, gagnent à varier avec
 * la charte du projet.
 *
 * ── ZÉRO JETON AJOUTÉ ────────────────────────────────────────────────────────
 *
 * Les deux pages sont des `SectionContent` déjà remplis par le CODE à partir des chiffres déjà calculés
 * (`finance.computed`) : aucune n'est confiée à un rédacteur. Seul le CHOIX du squelette/habillage/gabarit
 * passe par le catalogue (cran `low` : 0 appel, le code choisit). C'est la même philosophie qui a retiré
 * l'agent de couverture du business plan ("Un appel de modèle et son attente disparaissent du chemin
 * critique") — appliquée ici à la place d'un homebrew HTML qui dupliquait, à la main, la même composition.
 */

import type { SectionContent } from '@idem/graphic-engine';
import { coverContent } from '@idem/graphic-engine';
import type { AccountingJurisdiction } from '../common/accounting-jurisdiction';
import type { FinanceComputed, FinanceModel } from '../../models/finance.model';
import { fiscalYearPeriod } from '../../models/finance.model';
import { compact, pct } from './finance-report.template';

/** Couverture du rapport financier : des mots fixes, partagés avec le reste du livrable (devise, exercices). */
export function financeReportCoverCatalogSection(o: {
  companyName: string;
  currency: string;
  exercises: number;
  dateLabel: string;
}): SectionContent {
  return coverContent({
    id: 'cover',
    brandName: o.companyName,
    documentLabel: 'Rapport financier',
    promise: `États financiers prévisionnels sur ${o.exercises} exercices, seuil de rentabilité et ratios de gestion, en ${o.currency}.`,
    dateLabel: o.dateLabel,
  });
}

/**
 * La page de synthèse : les mêmes chiffres que `summarySection` (aucun recalcul), reformés en blocs du
 * catalogue — un chiffre qui domine (le besoin de financement, ou sa couverture), les six chiffres-clés
 * de lecture rapide, puis l'évolution du chiffre d'affaires et du résultat net sur tout l'horizon.
 */
export function financeReportSummaryCatalogSection(o: {
  finance: FinanceModel;
  jurisdiction: AccountingJurisdiction;
  currency: string;
}): SectionContent {
  const k = o.finance.computed as FinanceComputed;
  const ce = k.compteExploitation;
  const labels = k.fiscalYearLabels;
  const first = ce[0];
  const last = ce[ce.length - 1];
  const seuil = k.seuilRentabilite[0];
  const funding = k.fundingPlan;
  const besoin = funding.besoinDeFinancement;

  const heroItem =
    besoin > 0
      ? { value: compact(besoin, o.currency), label: 'Besoin de financement', note: `Coût total ${compact(funding.coutTotalProjet, o.currency)}` }
      : { value: pct(funding.couverturePct), label: 'Couverture du plan de financement', note: `Coût total ${compact(funding.coutTotalProjet, o.currency)}` };

  const margeNette = first?.chiffreAffaires ? (first.resultatNet / first.chiffreAffaires) * 100 : 0;
  const margeNetteFin = last?.chiffreAffaires ? (last.resultatNet / last.chiffreAffaires) * 100 : 0;

  return {
    id: 'summary',
    role: 'data',
    title: 'Synthèse financière',
    lede:
      `Prévisions établies sur ${ce.length} exercices, ${fiscalYearPeriod(o.finance.fiscalCalendar, 0)} pour le premier. ` +
      `${o.jurisdiction.frameworkLabel} · ${o.jurisdiction.country}. Tous les montants sont en ${o.currency}.`,
    blocks: [
      // Le chiffre qui domine la page : une unique entrée pour que le gabarit le mette en avant.
      { id: 'headline', kind: 'metrics', items: [heroItem] },
      {
        id: 'key-figures',
        kind: 'metrics',
        items: [
          { value: compact(first?.chiffreAffaires ?? 0, o.currency), label: `Chiffre d'affaires ${labels[0]}` },
          { value: compact(first?.resultatNet ?? 0, o.currency), label: `Résultat net ${labels[0]}`, note: `Marge nette ${pct(margeNette)}` },
          { value: pct(first?.tauxMargePct ?? 0), label: 'Marge sur coûts variables' },
          { value: seuil ? `${Math.round(seuil.pointMortJours)} j` : '—', label: 'Point mort', note: seuil ? `Seuil ${compact(seuil.seuilRentabilite, o.currency)}` : undefined },
          { value: compact(last?.resultatNet ?? 0, o.currency), label: `Résultat net ${labels[labels.length - 1]}`, note: `Marge nette ${pct(margeNetteFin)}` },
        ],
      },
      {
        id: 'trend',
        kind: 'chart',
        chartType: 'groupedBar',
        title: "Chiffre d'affaires et résultat net",
        labels,
        series: [
          { name: "Chiffre d'affaires", data: ce.map((row) => row.chiffreAffaires) },
          { name: 'Résultat net', data: ce.map((row) => row.resultatNet) },
        ],
        readingKey:
          ce.length > 1 && first?.chiffreAffaires
            ? `Le résultat net représente ${pct(margeNette)} du chiffre d'affaires au premier exercice et ${pct(margeNetteFin)} au dernier.`
            : "Le chiffre d'affaires porte la trajectoire ; le résultat net en mesure la conversion.",
      },
    ],
  };
}
