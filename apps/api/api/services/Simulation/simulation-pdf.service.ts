/**
 * SimulationPdfService — produit le rapport de simulation en PDF, côté serveur.
 *
 * Le rapport est l'artefact que l'on transmet : à un associé, à une banque, à
 * un investisseur. Il ne peut donc pas dépendre de l'impression navigateur, qui
 * change de rendu d'un poste à l'autre et emporte les couleurs de l'écran. Le
 * document est ici composé à partir d'un template fixe (charte IDEM) et rendu
 * par le PdfService commun (Puppeteer), comme le rapport financier.
 */

import * as fs from 'fs-extra';
import * as path from 'path';

import logger from '../../config/logger';
import { SectionModel } from '../../models/section.model';
import { SimulationModel } from '../../models/simulation.model';
import { PdfService } from '../pdf.service';
import { simulationService } from './simulation.service';
import {
  IDEM_FONTS_URL,
  coverSection,
  evidenceSection,
  factorsSection,
  financialsSection,
  leversSection,
  profileSection,
  recommendationsSection,
  scenariosSection,
  summarySection,
} from './simulation-report.template';

/** Le nom doit correspondre à `fixedPageSections` : la couverture n'est jamais paginée. */
const COVER_SECTION_NAME = 'Couverture';

export class SimulationPdfService {
  private readonly pdfService = new PdfService();

  /**
   * Les images de marque voyagent en data URI : le rendu se fait dans un
   * navigateur headless sans origine, un chemin relatif n'y résoudrait pas.
   */
  private assets: { motif: string; logo: string } | null = null;

  /** Génère le PDF et renvoie le chemin du fichier produit. */
  async generateReportPdf(
    userId: string,
    projectId: string,
    simulationId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    logger.info(
      `SimulationPdfService.generateReportPdf userId=${userId} projectId=${projectId} simulationId=${simulationId}`,
    );

    const simulation = await simulationService.getSimulation(userId, projectId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    // Le rapport est composé à la demande s'il manque alors que le forfait
    // l'inclut : sans cela une simulation payée dont la génération enchaînée
    // n'a pas abouti n'avait plus aucun moyen de livrer son document.
    const report = await simulationService.ensureReport(userId, projectId, simulationId);
    if (!report) {
      throw new Error('This simulation has not produced a report yet');
    }
    const assets = await this.loadAssets();
    const chrome = {
      motifDataUri: assets.motif,
      logoDataUri: assets.logo,
      projectName: report.profile.name,
    };

    const sections: SectionModel[] = [
      section(COVER_SECTION_NAME, coverSection(chrome, simulation, report)),
      section('Synthèse', summarySection(chrome, report)),
      section('Le projet', profileSection(chrome, report)),
      section('Facteurs', factorsSection(chrome, report.factors)),
      section('Scénarios', scenariosSection(chrome, report.scenarios, report.financials.currency)),
      section('Trajectoire financière', financialsSection(chrome, report.financials)),
      section('Leviers', leversSection(chrome, report.sensitivity, report.conditions)),
      section(
        'Recommandations',
        recommendationsSection(chrome, report.recommendations, report.validationNeeded),
      ),
      section('Sources', evidenceSection(chrome, report.evidence)),
    ];

    const filePath = await this.pdfService.generatePdf({
      title: 'Rapport de simulation',
      projectName: report.profile.name,
      projectDescription: report.profile.product,
      sections,
      // Le contenu varie d'une exécution à l'autre : le paginateur redécoupe le
      // flux en pages exactes plutôt que de rogner ce qui dépasse.
      multiPage: true,
      fixedPageSections: [COVER_SECTION_NAME],
      // Le remplisseur écarte les blocs pour occuper la page ; sur un rapport
      // aussi structuré, 12 mm par interligne creusent des trous entre le
      // chapeau et le tableau. On le bride : mieux vaut une page qui s'arrête
      // qu'une page distendue.
      pagination: { maxGapAddMm: 2, maxGapAddHardMm: 4, minFillRatio: 0.2 },
      footerText: `${report.profile.name} — Rapport de simulation IDEM`,
      typography: {
        id: 'idem-jura',
        name: 'IDEM',
        url: IDEM_FONTS_URL,
        primaryFont: 'Jura',
        secondaryFont: 'Jura',
      },
    });

    return { filePath, fileName: buildFileName(simulation) };
  }

  private async loadAssets(): Promise<{ motif: string; logo: string }> {
    if (this.assets) return this.assets;

    const [motif, logo] = await Promise.all([
      this.readAsDataUri(path.join('assets', 'images', 'motif.png')),
      this.readAsDataUri('logo.png'),
    ]);

    this.assets = { motif, logo };
    return this.assets;
  }

  /** Une image de marque absente ne doit pas empêcher la génération. */
  private async readAsDataUri(relativePath: string): Promise<string> {
    const filePath = path.join(process.cwd(), 'public', relativePath);
    try {
      const buffer = await fs.readFile(filePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error: any) {
      logger.warn(`SimulationPdfService: asset unavailable (${relativePath}): ${error?.message}`);
      return '';
    }
  }
}

function section(name: string, html: string): SectionModel {
  return { name, type: 'simulation-report', data: html, summary: '' };
}

/** Nom de fichier lisible et sans surprise une fois téléchargé. */
function buildFileName(simulation: SimulationModel): string {
  const slug = (simulation.report?.profile.name || simulation.name || 'simulation')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `rapport-simulation-${slug || 'projet'}-${date}.pdf`;
}

export const simulationPdfService = new SimulationPdfService();
