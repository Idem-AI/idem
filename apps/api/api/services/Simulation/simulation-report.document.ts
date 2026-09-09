/**
 * Composition du rapport de simulation : l'ordre des chapitres, les images de
 * marque, et les options de rendu.
 *
 * ── POURQUOI CE MODULE EXISTE À PART ────────────────────────────────────────
 *
 * Composer le document et aller le chercher en base sont deux métiers. Tant
 * qu'ils vivaient ensemble, importer la composition importait aussi le service
 * de simulation, donc le dépôt, donc la connexion à la base : un harnais qui
 * veut seulement RENDRE le document sur des données de test restait bloqué à
 * l'ouverture de la connexion, et l'alternative — recopier la liste des
 * chapitres dans le harnais — aurait vérifié la copie plutôt que le document.
 *
 * Ici, rien n'est persistant : on entre avec une simulation et son rapport, on
 * sort avec un PDF.
 */

import * as fs from 'fs-extra';
import * as path from 'path';

import logger from '../../config/logger';
import { SectionModel } from '../../models/section.model';
import { SimulationModel, SimulationReport } from '../../models/simulation.model';
import { PdfGenerationOptions, PdfService } from '../pdf.service';
import {
  IDEM_FONTS_URL,
  ReportChrome,
  actionsSection,
  coverSection,
  evidenceSection,
  factorsSection,
  financialsSection,
  guideSection,
  leversSection,
  profileSection,
  scenariosSection,
  summarySection,
} from './simulation-report.template';

/** Le nom doit correspondre à `fixedPageSections` : la couverture n'est jamais paginée. */
export const COVER_SECTION_NAME = 'Couverture';

/**
 * L'ordre des chapitres du rapport, et rien d'autre.
 *
 * Source unique : le téléchargement et le contrôle de mise en page composent
 * le même document. Un harnais qui recopierait cette liste cesserait de
 * vérifier le rapport dès qu'un chapitre s'ajouterait d'un seul côté.
 */
export function buildReportSections(
  chrome: ReportChrome,
  simulation: SimulationModel,
  report: SimulationReport,
): SectionModel[] {
  return [
    section(COVER_SECTION_NAME, coverSection(chrome, simulation, report)),
    // Le mode d'emploi vient AVANT le premier chiffre. Sans lui, le lecteur
    // arrivait sur un indice sans savoir ce qu'il mesure, et sur neuf chapitres
    // sans savoir lequel répond à sa question.
    section('Mode d’emploi', guideSection(chrome, report)),
    section('Synthèse', summarySection(chrome, report)),
    section('Le projet', profileSection(chrome, report)),
    section('Facteurs', factorsSection(chrome, report.factors, report.factorSummary)),
    section('Scénarios', scenariosSection(chrome, report.scenarios, report.financials.currency)),
    section('Trajectoire financière', financialsSection(chrome, report.financials)),
    section('Leviers', leversSection(chrome, report.sensitivity, report.conditions)),
    // Un seul chapitre, mené par l'ACTION : chaque recommandation imprime le
    // problème qu'elle traite. Les séparer obligeait le lecteur à faire
    // l'appariement lui-même trente pages plus loin — ce que personne ne fait ;
    // mener par le problème le laissait savoir ce qui ne va pas sans savoir
    // quoi faire.
    section(
      'Recommandations',
      actionsSection(chrome, report.risks ?? [], report.recommendations, report.validationNeeded),
    ),
    section('Sources', evidenceSection(chrome, report.evidence, report.keyUncertainties ?? [])),
  ];
}

function section(name: string, html: string): SectionModel {
  return { name, type: 'simulation-report', data: html, summary: '' };
}

/**
 * Les images de marque voyagent en data URI : le rendu se fait dans un
 * navigateur headless sans origine, un chemin relatif n'y résoudrait pas.
 */
let assets: { motif: string; logo: string } | null = null;

export async function loadReportAssets(): Promise<{ motif: string; logo: string }> {
  if (assets) return assets;

  const [motif, logo] = await Promise.all([
    readAsDataUri(path.join('assets', 'images', 'motif.png')),
    readAsDataUri('logo.png'),
  ]);

  assets = { motif, logo };
  return assets;
}

/** Une image de marque absente ne doit pas empêcher la génération. */
async function readAsDataUri(relativePath: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'public', relativePath);
  try {
    const buffer = await fs.readFile(filePath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error: any) {
    logger.warn(`Rapport de simulation : image indisponible (${relativePath}) : ${error?.message}`);
    return '';
  }
}

/** Compose et rend le document. Renvoie le chemin du PDF produit. */
export async function renderReportDocument(
  simulation: SimulationModel,
  report: SimulationReport,
  onPaginationReport?: PdfGenerationOptions['onPaginationReport'],
): Promise<string> {
  const images = await loadReportAssets();
  const chrome: ReportChrome = {
    motifDataUri: images.motif,
    logoDataUri: images.logo,
    projectName: report.profile.name,
  };

  return new PdfService().generatePdf({
    title: 'Rapport de simulation',
    projectName: report.profile.name,
    projectDescription: report.profile.product,
    sections: buildReportSections(chrome, simulation, report),
    // Le contenu varie d'une exécution à l'autre : le paginateur redécoupe le
    // flux en pages exactes plutôt que de rogner ce qui dépasse.
    multiPage: true,
    fixedPageSections: [COVER_SECTION_NAME],
    // Le remplisseur dispose de deux élasticités : l'espace ENTRE les blocs, et
    // l'espace À L'INTÉRIEUR des blocs à plusieurs rangées. La seconde est ce
    // qui écartait de deux centimètres les quatre lignes d'une décomposition ou
    // les deux rangées d'une grille de chiffres — le template la lui retire
    // désormais bloc par bloc (`data-keep-together`). Il reste donc la
    // première, et c'est elle qu'on desserre : allonger la respiration entre un
    // chapeau et un tableau est typographiquement neutre, distendre un tableau
    // ne l'est pas.
    // `balance` reste actif. Le remplissage au fil donne des pages pleines, mais
    // rejette la fin de chapitre sur une page presque vide — et, mesuré, il
    // détachait un intertitre de son tableau : « Conditions de viabilité »
    // restait au bas d'une page, sa seule ligne ouvrait la suivante. Un
    // chapitre réparti sur deux pages à 60 % ne se lit jamais aussi mal qu'un
    // titre orphelin.
    pagination: { maxGapAddMm: 5, maxGapAddHardMm: 10, minFillRatio: 0.2 },
    footerText: `${report.profile.name} — Rapport de simulation IDEM`,
    onPaginationReport,
    typography: {
      id: 'idem-jura',
      name: 'IDEM',
      url: IDEM_FONTS_URL,
      primaryFont: 'Jura',
      secondaryFont: 'Jura',
    },
  });
}
