/**
 * FinancePdfService — assemble le rapport financier PDF d'un projet.
 *
 * Le service ne compose plus : il ORCHESTRE. La grammaire visuelle vit dans
 * `finance-report.template`, les chapitres dans `finance-report.sections`, et
 * les chiffres viennent tous de `finance.computed` — aucun n'est recalculé ici.
 *
 * Le rapport suit l'ordre de lecture d'un analyste crédit et comporte
 * désormais les chapitres qui manquaient : modèle de revenus détaillé,
 * structure de coûts poste par poste, fiscalité au barème, tableau des
 * investissements, besoin en fonds de roulement, plan de financement et
 * MONTANT SOLLICITÉ, flux O.E.C. détaillés, actualisation ligne à ligne et
 * valorisation. Le calendrier des exercices suit la JURIDICTION du pays du
 * projet (cf. services/common/accounting-jurisdiction), et non une zone supposée.
 */

import logger from '../../config/logger';
import { ReportTheme as DocumentDesignSystem, reportThemeOf } from './finance-theme';
import { PdfService } from '../pdf.service';
import { SectionModel } from '../../models/section.model';
import { financeService } from './finance.service';
import { financeAIService } from './finance-ai.service';
import { ProjectModel } from '../../models/project.model';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { FinanceModel } from '../../models/finance.model';
import { resolveJurisdiction } from '../common/accounting-jurisdiction';
import { buildChrome } from './finance-report.template';
import {
  analysisSection,
  bfrSection,
  bilanSection,
  breakEvenSection,
  cashflowSection,
  costStructureSection,
  exploitationSection,
  fundingSection,
  investmentsSection,
  methodSection,
  ratiosSection,
  revenueSection,
  taxesSection,
} from './finance-report.sections';
import { TypographyModel } from '../../models/brand-identity.model';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { cacheService } from '../cache.service';
import * as crypto from 'crypto';
import { resolveLogoDeclensions } from '../../utils/brand-context.util';
import { openGraphicDocument, renderGraphicPage, coverDateLabel } from '../graphic/graphic.service';
import { documentDesignKey } from '../common/deliverable-documents';
import { financeReportCoverCatalogSection, financeReportSummaryCatalogSection } from './finance-report-catalog';


/** Doit correspondre à `fixedPageSections` : la couverture n'est jamais paginée. */
const COVER_SECTION_NAME = 'Couverture';
/**
 * La synthèse aussi : composée par le moteur graphique comme la couverture, c'est une page déjà mesurée et
 * ajustée à son format — le paginateur de flux (pensé pour des tableaux qui débordent) ne doit pas tenter
 * de la redécouper.
 */
const CATALOG_SUMMARY_SECTION_NAME = 'Synthèse';

function section(name: string, html: string): SectionModel {
  return { name, type: 'finance-report', data: html, summary: '' };
}

/** Découpe l'analyse rédigée en paragraphes, en écartant les lignes vides. */
function splitParagraphs(text: string): string[] {
  return String(text || '')
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export class FinancePdfService {
  private readonly pdfService = new PdfService();
  private readonly promptService = new PromptService();
  private readonly projectRepository = RepositoryFactory.getRepository<ProjectModel>();

  /** Génère un PDF du rapport financier. Renvoie le chemin du fichier généré. */
  async generateFinancePdf(userId: string, projectId: string): Promise<string> {
    logger.info(`FinancePdfService.generateFinancePdf userId=${userId} projectId=${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const finance = await financeService.getFinance(userId, projectId);
    if (!finance || !finance.computed) {
      throw new Error(
        'Aucune donnée financière disponible. Veuillez d\u2019abord remplir le module Finance.',
      );
    }

    const typography = this.extractTypography(project);
    const companyName = project.name || 'Projet';
    const currency = finance.meta?.currency || 'FCFA';

    // La juridiction comptable vient du PAYS du projet : le rapport cite le
    // référentiel réellement applicable, et non celui d'une zone supposée.
    const jurisdiction = resolveJurisdiction(project.additionalInfos?.country);
    const designSystem = this.designSystemOf(project);

    // La couverture et la synthèse passent par le MOTEUR GRAPHIQUE, la même
    // logique que le business plan : le catalogue choisit le squelette, l'habillage
    // et le gabarit selon la charte réelle du projet (cran bas : 0 appel, le code
    // choisit). Les chapitres chiffrés qui suivent restent sur la grammaire fixe
    // ci-dessous — un barème fiscal ou un bilan SYSCOHADA ne gagne rien à varier.
    const graphic = await openGraphicDocument({
      project,
      documentType: 'report',
      format: 'a4-portrait',
      seed: documentDesignKey('financereport', projectId, project.id ?? projectId),
      creativity: 'low',
      documentLabel: 'Rapport financier',
      userId,
      sections: [
        { id: 'cover', role: 'cover' },
        { id: 'summary', role: 'data' },
      ],
    });
    const coverHtml = await renderGraphicPage(
      graphic,
      financeReportCoverCatalogSection({
        companyName,
        currency,
        exercises: finance.computed.compteExploitation.length,
        dateLabel: coverDateLabel(),
      }),
      { index: 0, total: 2 }
    );
    const summaryHtml = await renderGraphicPage(
      graphic,
      financeReportSummaryCatalogSection({ finance, jurisdiction, currency }),
      { index: 1, total: 2 }
    );
    const coverSection: SectionModel = { name: COVER_SECTION_NAME, type: 'cover', data: coverHtml, summary: '' };

    const interpretation = await this.generateInterpretation(project, finance, jurisdiction);

    // ── L'ORDRE DE LECTURE D'UN ANALYSTE CRÉDIT ─────────────────────────────
    //
    // Ce que l'affaire rapporte, ce qu'elle coûte, ce qu'elle doit à l'État, ce
    // qu'elle immobilise, ce qu'il faut apporter pour la lancer — puis les états
    // de synthèse, puis seulement les indicateurs de rentabilité. Les chapitres
    // 02 à 07 n'existaient pas : le rapport passait du chiffre d'affaires au
    // compte d'exploitation sans jamais dire ce que le projet coûtait ni ce
    // qu'il demandait.
    const chrome = buildChrome(
      designSystem,
      finance.meta?.currency || 'FCFA',
      companyName,
      this.buildCoverLogoHtml(project, designSystem, companyName),
      jurisdiction.frameworkLabel
    );

    const sections: SectionModel[] = [
      coverSection,
      section(CATALOG_SUMMARY_SECTION_NAME, summaryHtml),
      section('Modèle de revenus', revenueSection(chrome, finance)),
      section('Structure de coûts', costStructureSection(chrome, finance)),
      section('Fiscalité', taxesSection(chrome, finance)),
      section('Investissements', investmentsSection(chrome, finance)),
      section('Fonds de roulement', bfrSection(chrome, finance, jurisdiction)),
      section('Plan de financement', fundingSection(chrome, finance)),
      section("Compte d'exploitation", exploitationSection(chrome, finance)),
      section('Bilan', bilanSection(chrome, finance)),
      section('Trésorerie', cashflowSection(chrome, finance)),
      section('Seuil de rentabilité', breakEvenSection(chrome, finance)),
      section('Rentabilité', ratiosSection(chrome, finance)),
      section('Analyse', analysisSection(chrome, splitParagraphs(interpretation))),
      section('Méthode', methodSection(chrome, finance, jurisdiction)),
    ];

    return this.pdfService.generatePdf({
      title: 'Rapport financier',
      projectName: companyName,
      projectDescription: project.longDescription || project.description || '',
      sections,
      // Les tableaux d'un rapport financier sont longs par nature. Sans
      // paginateur de flux, tout ce qui dépassait la première page était
      // simplement rogné — un compte d'exploitation amputé de son résultat net.
      multiPage: true,
      fixedPageSections: [COVER_SECTION_NAME, CATALOG_SUMMARY_SECTION_NAME],
      // Un rapport aussi tabulaire se distend mal : mieux vaut une page qui
      // s'arrête qu'une page aux interlignes creusés.
      pagination: { maxGapAddMm: 2, maxGapAddHardMm: 4, minFillRatio: 0.2 },
      footerText: `Rapport financier — ${companyName} — Généré par Idem`,
      typography: typography,
    });
  }

  // -----------------------------------------------------------------
  // Brand & utilities
  // -----------------------------------------------------------------

  /**
   * Le thème du rapport : la charte du projet, lue par le moteur graphique
   * (mêmes encres, mêmes polices que les autres livrables du projet).
   */
  private designSystemOf(project: ProjectModel): DocumentDesignSystem {
    return reportThemeOf(project.name || 'Projet', project.analysisResultModel?.branding as never);
  }

  /**
   * Typographie transmise au shell PDF, qui en émet les `<link>` de chargement.
   *
   * On renvoie les polices RÉSOLUES par le design system, pas celles de la
   * charte brute : ce sont elles que le CSS du rapport nomme. Transmettre les
   * unes et écrire les autres chargerait une police pour en afficher une autre —
   * exactement le genre d'écart qui rend un livrable « presque » conforme.
   */
  private extractTypography(project: ProjectModel): TypographyModel | undefined {
    const ds = this.designSystemOf(project);
    const source = project.analysisResultModel?.branding?.typography;
    return {
      ...(source ?? ({ id: '', name: '', url: '' } as TypographyModel)),
      primaryFont: ds.fonts.display,
      secondaryFont: ds.fonts.body,
    };
  }

  /**
   * Produit le balisage HTML du logo pour la couverture.
   *
   * Gère à la fois :
   * 1. Les déclinaisons d'images hébergées (URLs MinIO / Cloud Storage / bucket dans
   *    `assetUrls` ou `variations`, adaptées au fond clair ou sombre).
   * 2. Une URL directe dans `logo.svg` (MinIO stocke souvent l'URL du fichier).
   * 3. Un SVG inline brut (`<svg ...>`).
   *
   * Évite ainsi d'injecter une simple URL de bucket sous forme de texte sur la page.
   */
  private buildCoverLogoHtml(
    project: ProjectModel,
    ds: DocumentDesignSystem,
    companyName: string
  ): string {
    const branding = project.analysisResultModel?.branding;
    const logo = branding?.logo;
    if (!logo) return '';

    // 1. Déclinaisons résolues (assetUrls, variations, URLs de bucket)
    const declensions = resolveLogoDeclensions(logo as any);
    const resolvedUrl = declensions
      ? (ds.dark
          ? (declensions.withTextDark || declensions.primary)
          : (declensions.withTextLight || declensions.primary))
      : null;

    // 2. URL de bucket directe dans logo.svg ou déclinaison
    let candidateUrl = resolvedUrl;
    if (!candidateUrl && typeof logo.svg === 'string') {
      const trimmed = logo.svg.trim();
      if (/^(https?:\/\/|data:)/i.test(trimmed)) {
        candidateUrl = trimmed;
      }
    }

    if (candidateUrl) {
      return `<div style="width:56mm;max-height:26mm;margin-bottom:${ds.spacing * 2}px;display:flex;align-items:center;">` +
        `<img src="${this.esc(candidateUrl)}" alt="${this.esc(companyName)} logo" style="max-width:56mm;max-height:26mm;width:auto;height:auto;object-fit:contain;display:block;" />` +
        `</div>`;
    }

    // 3. SVG inline brut (<svg ...>)
    let rawSvg = typeof logo.svg === 'string' ? logo.svg : null;
    if (rawSvg) {
      rawSvg = rawSvg.replace(/```(xml|svg)?/gi, '').replace(/```/g, '').trim();
      if (rawSvg.includes('<svg')) {
        return `<div style="width:56mm;max-height:26mm;margin-bottom:${ds.spacing * 2}px;">` +
          rawSvg.replace('<svg ', '<svg style="max-width:100%;max-height:26mm;width:auto;height:auto;display:block;" ') +
          `</div>`;
      }
    }

    return '';
  }

  // -----------------------------------------------------------------
  // Section builders (chaque section retourne un SectionModel)
  // -----------------------------------------------------------------
  //
  // La couverture et la synthèse sont désormais composées par le moteur
  // graphique (`finance-report-catalog.ts`), la même logique que le business
  // plan : voir leur construction au début de `generateFinancePdf`. Elles ont
  // remplacé ici une couverture dessinée à la main (quatre compositions fixes
  // tirées d'une graine, hors du catalogue, qui portait encore un sur-titre en
  // bandeau — le motif retiré partout ailleurs).

  // -----------------------------------------------------------------
  // AI interpretation
  // -----------------------------------------------------------------

  private async generateInterpretation(
    project: ProjectModel,
    finance: FinanceModel,
    jurisdiction: ReturnType<typeof resolveJurisdiction>,
  ): Promise<string> {
    const c = finance.computed!;
    const ce = c.compteExploitation;
    const currency = finance.meta?.currency || 'FCFA';
    const labels = c.fiscalYearLabels;
    const fp = c.fundingPlan;
    const r = c.ratios;

    // Le contexte porte désormais ce qui décide de la lecture d'un dossier :
    // le coût du projet, le besoin de financement et la sincérité des
    // indicateurs. Sans eux, l'analyse commentait une rentabilité hors sol.
    const summary = [
      `Projet: ${project.name}`,
      `Type: ${project.type}`,
      `Devise: ${currency}`,
      `Juridiction comptable: ${jurisdiction.country} — ${jurisdiction.frameworkLabel}`,
      `Exercices: ${labels.join(', ')} (${jurisdiction.fiscalYearRule === 'free-choice' ? 'date de clôture libre' : 'année civile'})`,
      ...ce.map(
        (row, y) =>
          `Exercice ${labels[y]}: CA ${Math.round(row.chiffreAffaires)}, marge sur coûts variables ${row.tauxMargePct.toFixed(1)}%, EBE ${Math.round(row.ebe)}, résultat net ${Math.round(row.resultatNet)}`
      ),
      `Point mort exercice 1: ${c.seuilRentabilite[0]?.pointMortJours?.toFixed(0)} jours`,
      `Trésorerie de clôture par exercice: ${c.cashFlowOec.map((row) => Math.round(row.tresorerieCloture)).join(' / ')}`,
      `Investissements: ${Math.round(c.projectCost.totalInvestissements)}`,
      `Besoin en fonds de roulement de démarrage: ${Math.round(c.projectCost.besoinFondsRoulement)}`,
      `Coût total du projet: ${Math.round(fp.coutTotalProjet)}`,
      `Ressources mobilisées: ${Math.round(fp.totalFinancement)} (fonds propres ${Math.round(fp.totalEquity)}, dettes ${Math.round(fp.totalDebt)})`,
      `BESOIN DE FINANCEMENT (montant sollicité): ${Math.round(fp.besoinDeFinancement)}`,
      `Taux d'endettement: ${fp.tauxEndettementPct.toFixed(1)}%`,
      r.significant
        ? `VAN ${Math.round(r.van)}, TRI ${r.triCalculable === false ? 'non calculable' : `${r.tri.toFixed(1)}%`}, délai de récupération ${r.drci.toFixed(2)} ans, indice de profitabilité ${r.indiceProfitabilite.toFixed(2)}`
        : `VAN / TRI / indice de profitabilité NON SIGNIFICATIFS: ${r.significanceNote}`,
    ].join('\n');

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: `You are a credit analyst writing the reading note of a financial
projection for a Cameroonian SME. Answer IN FRENCH, professional and direct.

Four paragraphs, in this order:
1) What the projection establishes: profitability, its level, and what carries it.
2) What holds up: the strengths, each anchored in a figure supplied below.
3) What must be secured: cash position, break-even, cost concentration, debt load.
   Name the figure that worries you and say why.
4) What to do next, in order of priority, each action tied to a figure.

Rules:
- Never contradict a figure supplied below, and never invent one.
- If the indicators are marked NON SIGNIFICATIFS, say so plainly in paragraph 1
  and do not comment on the VAN or the TRI as if they meant something.
- If there is a funding need, name the amount in paragraph 1: it is what the
  reader is looking for.
- Name fiscal years EXACTLY as they are given above. Where a label spans two
  calendar years ("2026-2027"), that is correct: the accounting year does not
  follow the calendar year in this jurisdiction. Where it is a single year, never
  turn it into a span.
- Plain text only, no markdown, one blank line between paragraphs.`,
      },
      { role: 'user', content: `Indicateurs:\n${summary}\n\nRédige la note de lecture.` },
    ];

    const config: PromptConfig = {
      provider: AI_CONFIG.finance.pdfInterpretation.provider,
      modelName: AI_CONFIG.finance.pdfInterpretation.modelName,
      promptType: AI_CONFIG.finance.pdfInterpretation.promptType,
      llmOptions: {
        ...AI_CONFIG.finance.pdfInterpretation.llmOptions,
      },
    };
    try {
      const raw = await this.promptService.runPrompt(config, messages);
      return this.promptService.getCleanAIText(raw).trim();
    } catch (err: any) {
      logger.warn(`FinancePdf.interpretation failed: ${err?.message}`);
      return 'L\u2019analyse automatique n\u2019a pas pu être générée pour ce rapport. Les indicateurs ci-avant offrent néanmoins une vue complète de la santé financière prévisionnelle du projet.';
    }
  }

  private esc(s: string): string {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const financePdfService = new FinancePdfService();
