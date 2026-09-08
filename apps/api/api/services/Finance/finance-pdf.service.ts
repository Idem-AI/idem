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
import { buildDocumentSeed } from '../design/designSeed';
import {
  buildDocumentDesignSystem,
  DocumentDesignSystem,
} from '../design/documentDesignSystem';
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
  summarySection,
  taxesSection,
} from './finance-report.sections';
import { TypographyModel } from '../../models/brand-identity.model';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { cacheService } from '../cache.service';
import * as crypto from 'crypto';
import { AGENT_FINANCE_COVER_PROMPT } from './prompts/agent-finance-cover.prompt';
import { resolveLogoDeclensions } from '../../utils/brand-context.util';


/** Doit correspondre à `fixedPageSections` : la couverture n'est jamais paginée. */
const COVER_SECTION_NAME = 'Couverture';

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
    
    // La couverture est CONSTRUITE, pas générée : élément fixe, aucun jugement
    // à porter. Un appel de modèle et son attente disparaissent du chemin
    // critique — le rapport ne dépend plus que de l'interprétation.
    const designSystem = this.designSystemOf(project);
    // La juridiction comptable vient du PAYS du projet : le rapport cite le
    // référentiel réellement applicable, et non celui d'une zone supposée.
    const jurisdiction = resolveJurisdiction(project.additionalInfos?.country);
    const coverSection = this.buildCoverSection(
      companyName,
      designSystem,
      project,
      project.id ?? projectId
    );
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
      section('Synthèse', summarySection(chrome, finance, jurisdiction)),
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
      fixedPageSections: [COVER_SECTION_NAME],
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
   * Design system du projet, calculé une fois par rapport.
   *
   * La graine est dérivée du projet : deux rapports du même projet sont
   * identiques, deux projets différents ne le sont pas.
   */
  private designSystemOf(project: ProjectModel): DocumentDesignSystem {
    const branding = project.analysisResultModel?.branding;
    const artDirection = branding?.artDirection;
    const seed = buildDocumentSeed(artDirection?.styleId, `finance:${project.id ?? 'projet'}`);
    return buildDocumentDesignSystem(branding, artDirection, seed);
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

  /**
   * Couverture du rapport financier — construite par le CODE.
   *
   * ── POURQUOI PLUS D'IA ICI ─────────────────────────────────────────────────
   *
   * Une couverture de rapport financier est un élément FIXE : un titre, un nom
   * d'entreprise, une date, un logo. Rien n'y demande de jugement. La faire
   * écrire par un modèle coûtait des tokens et de la latence pour un résultat
   * que le code produit à l'identique — et sans jamais garantir la charte, ce
   * qui était précisément le reproche.
   *
   * ── CE QUI A CHANGÉ DANS LA COMPOSITION ────────────────────────────────────
   *
   * L'ancienne version empilait trois à cinq disques flous (`blur(120px)`) sous
   * une carte translucide bordée de blanc. C'est le vocabulaire visuel par
   * défaut des générateurs, et il contredit frontalement la direction
   * artistique de ce projet, qui prescrit des aplats nets, des filets d'1px et
   * aucune ombre portée. La direction artistique n'était d'ailleurs lue nulle
   * part dans ce fichier.
   *
   * La composition vient maintenant du design system : aplats, filet, échelle
   * typographique, rayon hérité du style. La variation d'un projet à l'autre
   * reste déterministe, mais elle porte sur la MISE EN PAGE (position de la
   * bande, alignement) et non sur des effets — donc elle ne peut pas sortir de
   * la charte.
   */
  private buildCoverSection(
    companyName: string,
    ds: DocumentDesignSystem,
    project: ProjectModel,
    projectId: string
  ): SectionModel {
    const today = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const rand = this.getSeededRandom(projectId || companyName);
    // Deux décisions de mise en page seulement, tirées de la graine : la bande
    // colorée est en haut ou en bas, et le bloc de titre est haut ou bas de
    // page. Quatre compositions, toutes tenables — on ne tire pas au sort ce
    // qui pourrait être laid.
    const bandAtTop = rand() > 0.5;
    const titleLow = rand() > 0.5;

    const logoHtml = this.buildCoverLogoHtml(project, ds, companyName);

    // La bande porte la couleur de marque en aplat : c'est le seul grand geste
    // de la page, et il suffit.
    const band = `<div style="position:absolute;left:0;right:0;${bandAtTop ? 'top:0' : 'bottom:0'};height:34mm;background-color:${ds.colors.primary};"></div>`;

    // Le nom est ajusté à sa longueur : un nom long ne doit pas casser en
    // escalier, défaut déjà corrigé sur les autres livrables.
    const nameSize = Math.round(
      Math.max(ds.typeScale.xl, Math.min(ds.typeScale["4xl"], 1400 / Math.max(companyName.length, 8)))
    );

    const html = `
    <div style="width:210mm;height:297mm;position:relative;overflow:hidden;box-sizing:border-box;background-color:${ds.colors.surface};color:${ds.colors.ink};font-family:'${ds.fonts.body}', sans-serif;padding:28mm 24mm;display:flex;flex-direction:column;justify-content:${titleLow ? 'flex-end' : 'flex-start'};">
      ${band}
      <div style="position:relative;z-index:1;">
        ${logoHtml}
        <div style="text-transform:uppercase;letter-spacing:0.28em;font-size:${ds.typeScale.xs}px;font-weight:700;color:${ds.colors.primary};margin-bottom:${ds.spacing * 1.5}px;">
          Rapport financier
        </div>
        <h1 style="margin:0;font-family:'${ds.fonts.display}', serif;font-size:${nameSize}px;line-height:1.05;font-weight:700;color:${ds.colors.ink};">
          ${this.esc(companyName)}
        </h1>
        <div style="margin-top:${ds.spacing * 2}px;border-top:2px solid ${ds.colors.primary};width:46mm;"></div>
        <p style="margin:${ds.spacing * 1.5}px 0 0;font-size:${ds.typeScale.base}px;color:${ds.colors.inkMuted};max-width:120mm;line-height:1.55;">
          États financiers prévisionnels, seuil de rentabilité et ratios de gestion.
        </p>
      </div>
      <div style="position:absolute;left:24mm;right:24mm;${bandAtTop ? 'bottom:16mm' : 'top:16mm'};z-index:1;display:flex;justify-content:space-between;font-size:${ds.typeScale.xs}px;color:${ds.colors.inkMuted};text-transform:uppercase;letter-spacing:0.12em;">
        <span>${this.esc(today)}</span>
        <span>Idem</span>
      </div>
    </div>`;

    return { name: COVER_SECTION_NAME, type: 'cover', data: html, summary: '' };
  }

  private getSeededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };
  }

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
        ? `VAN ${Math.round(r.van)}, TRI ${r.tri.toFixed(1)}%, délai de récupération ${r.drci.toFixed(2)} ans, indice de profitabilité ${r.indiceProfitabilite.toFixed(2)}`
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
